import express from 'express';
import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/db';
import { derivePriority } from '../src/services/priority.service';
import { nearbySensitive } from '../src/services/nearby.service';
import { persistMutations } from '../src/persistence';
import { reportSource } from '../src/services/report-source';
import { Report } from '@nagarbondhu/shared';

describe('Cross-role bug audit regressions',()=>{
  let snapshot:ReturnType<typeof db.snapshot>;
  beforeEach(()=>{snapshot=db.snapshot();});
  afterEach(()=>{db.restore(snapshot);jest.restoreAllMocks();});

  test('explicit legacy QA reports stay out of citizen feed, maps, dashboard and scorecards',async()=>{
    const seed=db.reports.get('rep-001')!;
    db.reports.set('qa-audit',{...seed,id:'qa-audit',title:'QA TEST — বাস্তব অভিযোগ নয়',sourceType:'citizen_report'});
    expect(db.reports.get('qa-audit')!.sourceType).toBe('citizen_report'); // No destructive data migration.
    expect(reportSource({...seed,title:'পরীক্ষার হলের সামনে ভাঙা রাস্তা',sourceType:'citizen_report'})).toBe('citizen_report');
    expect(reportSource({...seed,title:'তালাইমারীর ড্রেন',description:'পরীক্ষামূলক QA রিপোর্ট — এটি সিস্টেম পরীক্ষার অংশ।',sourceType:'citizen_report'})).toBe('demo_seed');
    const citizen=(await request(app).get('/api/v1/reports?source=citizen_report')).body;
    expect(citizen.reports.some((r:any)=>r.id==='qa-audit')).toBe(false);
    const demo=(await request(app).get('/api/v1/reports?source=demo_seed')).body;
    expect(demo.reports.find((r:any)=>r.id==='qa-audit').sourceType).toBe('demo_seed');
    expect((await request(app).get('/api/v1/reports/qa-audit')).body.report.sourceType).toBe('demo_seed');
    expect((await request(app).get('/api/v1/map/reports?source=citizen_report')).body.markers).toHaveLength(0);
    expect((await request(app).get('/api/v1/dashboard/summary?source=citizen_report')).body.data.totalReports).toBe(0);
    expect((await request(app).get('/api/v1/wards/scorecard?source=citizen_report')).body.data.every((w:any)=>w.total===0)).toBe(true);
  });

  test('calculated levels follow the 45/65/85 boundaries, including score-only critical cases',()=>{
    const report:Report={...db.reports.get('rep-001')!,id:'priority-audit',sourceType:'citizen_report',createdAt:new Date().toISOString(),affirmations:undefined,nearbySensitive:undefined};
    db.reports.set(report.id,report);
    expect(derivePriority(report.id,null,{severity:3})).toMatchObject({score:44,priorityLevel:'LOW'});
    report.nearbySensitive={fetchedAt:new Date().toISOString(),radius:200,groups:{},bonus:1,source:'OpenStreetMap (Overpass)'};
    expect(derivePriority(report.id,null,{severity:3})).toMatchObject({score:45,priorityLevel:'MEDIUM'});
    report.nearbySensitive=undefined;
    report.createdAt=new Date(Date.now()-21*86400000).toISOString();
    expect(derivePriority(report.id,null,{severity:5,isCriticalSafety:false})).toMatchObject({score:85,priorityLevel:'CRITICAL'});
  });
  test('report feed filters include assignment, hold and closed states as well as legacy analyzed state',async()=>{
    const seed=db.reports.get('rep-001')!;
    for(const status of ['AWAITING_FIELD_VERIFICATION','READY_FOR_ASSIGNMENT','ASSIGNED','ON_HOLD','CLOSED'] as const){
      db.reports.set('status-audit',{...seed,id:'status-audit',sourceType:'citizen_report',actionStatus:status});
      const response=await request(app).get('/api/v1/reports?source=citizen_report&status='+status);
      expect(response.status).toBe(200);expect(response.body.reports.map((r:any)=>r.id)).toEqual(['status-audit']);
    }
    db.reports.set('status-audit',{...seed,id:'status-audit',sourceType:'citizen_report',actionStatus:'UNDER_REVIEW'});
    expect((await request(app).get('/api/v1/reports?source=citizen_report&status=AI_ANALYZED')).body.reports.map((r:any)=>r.id)).toEqual(['status-audit']);
  });

  test('slow transcription neither blocks page reads and writes nor rolls a successful write back',async()=>{
    const server=express();server.use(persistMutations);
    let release!:()=>void,entered!:()=>void;
    const began=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);
    server.post('/api/v1/ai/transcribe',async(_req,res)=>{entered();await gate;res.status(503).json({success:false});});
    server.post('/api/v1/test-write',(_req,res)=>{db.updateReport('rep-001',{title:'Persisted while voice provider waits'});res.json({success:true});});
    server.get('/api/v1/test-read',(_req,res)=>res.json({success:true}));
    const media=request(server).post('/api/v1/ai/transcribe').then(r=>r);
    await began;
    try{
      await request(server).get('/api/v1/test-read').timeout({response:1000}).expect(200);
      await request(server).post('/api/v1/test-write').timeout({response:1000}).expect(200);
    }finally{release();await media;}
    expect(db.reports.get('rep-001')!.title).toBe('Persisted while voice provider waits');
  });

  test('nearby lookup shares concurrent requests and uses a healthy mirror while primary hangs',async()=>{
    let primaryAborted=false;
    const fetcher=jest.spyOn(global,'fetch').mockImplementation(async(url:any,options:any)=>{
      if(String(url).includes('overpass-api.de'))return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>{primaryAborted=true;reject(new Error('aborted'));},{once:true}));
      return {ok:true,json:async()=>({elements:[]})} as Response;
    });
    const [a,b]=await Promise.all([nearbySensitive(24.38123,88.63123),nearbySensitive(24.38123,88.63123)]);
    expect(a).toBe(b);expect(a.unavailable).toBe(false);expect(primaryAborted).toBe(true);expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
