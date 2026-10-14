import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/db';
import { nearbySensitive } from '../src/services/nearby.service';
import { PriorityService } from '../src/services/priority.service';
import { randomUUID } from 'crypto';
import { hash } from '../src/services/citizen.service';
import { deviceHash } from '../src/middleware/civicLimit';
import { wardScorecard } from '../src/services/scorecard.service';
import { checkPhoto, parseMedia, transcribeAudio } from '../src/services/media-ai.service';
import { CONFIG } from '../src/config';
import { summarizeRain, rainQueue } from '../src/services/rain.service';
describe('Differentiating civic features',()=>{
  let snapshot:ReturnType<typeof db.snapshot>;
  beforeEach(()=>{snapshot=db.snapshot();});afterEach(()=>{db.restore(snapshot);jest.restoreAllMocks();});
  test('nearby grouping, cap, cache and honest failure preserve explainable priority',async()=>{
    const mock=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({elements:[{type:'node',id:1,lat:24.3655,lon:88.5985,tags:{amenity:'school','name:bn':'স্কুল'}},{type:'way',id:2,center:{lat:24.3656,lon:88.5985},tags:{amenity:'hospital'}},{type:'node',id:3,lat:24.3655,lon:88.5985,tags:{amenity:'marketplace'}}]})} as Response);
    const data=await nearbySensitive(24.3655,88.5985);expect(data.bonus).toBe(12);expect(data.groups.health.count).toBe(1);
    await nearbySensitive(24.3655,88.5985);expect(mock).toHaveBeenCalledTimes(1);
    const base=PriorityService.assessReportPriority('rep-001')!;db.updateReport('rep-001',{nearbySensitive:data});const enriched=PriorityService.assessReportPriority('rep-001')!;
    expect(enriched.score).toBe(Math.min(100,base.score+12));expect(enriched.explanation.factors.find(f=>f.name==='ঝুঁকিপূর্ণ স্থাপনার নৈকট্য')?.note).toContain('২০০');
    mock.mockRejectedValue(new Error('Offline'));expect((await nearbySensitive(24.4,88.7)).unavailable).toBe(true);
    expect((await request(app).get('/api/v1/reports/rep-001/nearby')).body.data.bonus).toBe(12);
    expect((await request(app).post('/api/v1/admin/backfill-nearby').send({})).status).toBe(401);
  });
  test('affirmations are unique, real impact increases, reporter cannot self-affirm, receipt rejection reopens',async()=>{
    const id='rep-001',deviceId=randomUUID(),token='d'.repeat(64); for(const [key,p] of db.priorityAssessments)if(p.reportId===id)db.priorityAssessments.set(key,{...p,impactFactor:0});
    db.submissionReceipts.set('receipt-test',{id:'receipt-test',reportId:id,fingerprint:'test',capabilityHash:hash(token),deviceHash:deviceHash(deviceId),locationConfirmed:true,locationSource:'GPS',createdAt:new Date().toISOString()});
    expect((await request(app).post(`/api/v1/reports/${id}/affirm`).send({deviceId})).status).toBe(400);
    const voters=[randomUUID(),randomUUID(),randomUUID()];
    for(const voter of voters)expect((await request(app).post(`/api/v1/reports/${id}/affirm`).send({deviceId:voter})).status).toBe(200);
    expect((await request(app).post(`/api/v1/reports/${id}/affirm`).send({deviceId:voters[0]})).body.data.affirmCount).toBe(3);
    expect(PriorityService.assessReportPriority(id)!.impactFactor).toBe(3);
    const publicBody=(await request(app).get(`/api/v1/reports/${id}`)).body;
    expect(JSON.stringify(publicBody)).not.toMatch(/deviceHashes|ipDeviceHashes|voterHash/);
    db.updateReport(id,{actionStatus:'RESOLVED',status:'RESOLVED'});
    expect((await request(app).post(`/api/v1/reports/${id}/citizen-verification`).send({deviceId:randomUUID(),verdict:'FIXED'})).status).toBe(403);
    const result=await request(app).post(`/api/v1/reports/${id}/citizen-verification`).send({receiptToken:token,verdict:'NOT_FIXED',note:'সমস্যা এখনও রয়ে গেছে'});
    expect(result.body.data).toMatchObject({reopened:true,status:'UNDER_REVIEW'});expect(db.reports.get(id)!.reopenedCount).toBe(1);
    expect(db.statusHistories.at(-1)!.note).toContain('নাগরিক');
  });
  test('scorecard uses scoped stored data, missing dates never invent fast fixes, low samples have no grade',async()=>{
    const empty=wardScorecard('citizen_report');expect(empty.every(w=>w.total===0&&w.grade===null)).toBe(true);
    const base=db.reports.get('rep-001')!,wardId=base.wardId!;
    for(let i=0;i<3;i++)db.createReport({...base,id:'scorecard-'+i,sourceType:'citizen_report',createdAt:'2026-10-01T00:00:00Z',resolvedAt:i<2?'2026-10-03T00:00:00Z':null,status:i<2?'RESOLVED':'SUBMITTED',actionStatus:i<2?'RESOLVED':'SUBMITTED'});
    const row=wardScorecard('citizen_report').find(w=>w.wardId===wardId)!;expect(row.total).toBe(3);expect(row.resolved).toBe(2);expect(row.medianDaysToResolve).toBe(2);expect(row.grade).not.toBeNull();
    expect(row.index).toBeCloseTo(Object.values(row.breakdown).reduce((s,v)=>s+v,0));
    expect((await request(app).get('/api/v1/wards/scorecard?source=invalid')).status).toBe(400);
    expect((await request(app).get('/api/v1/wards/scorecard?source=citizen_report')).body.data.find((w:any)=>w.wardId===wardId).total).toBe(3);
  });
  test('photo check validates provider output, caches real results, rejects remote URLs and keeps errors honest',async()=>{
    const key=CONFIG.GEMINI_API_KEY;CONFIG.GEMINI_API_KEY='test-only';
    try{const data={photoShowsIssue:true,observedCategory:'DRAINAGE',matchesDescription:'MATCH',observedDetails_bn:'ড্রেনে বর্জ্য জমে আছে',confidence:0.8};
      const mock=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}]})} as Response);
      const image=parseMedia('data:image/png;base64,iVBORw0KGgo=','image');expect((await checkPhoto('ড্রেনে বর্জ্য জমেছে',image)).matchesDescription).toBe('MATCH');await checkPhoto('ড্রেনে বর্জ্য জমেছে',image);expect(mock).toHaveBeenCalledTimes(1);
      expect((await request(app).post('/api/v1/ai/check-photo').send({deviceId:randomUUID(),description:'ড্রেনে বর্জ্য জমেছে',imageUrl:'http://127.0.0.1/private'})).status).toBe(400);
      mock.mockRejectedValue(new Error('offline'));await expect(checkPhoto('ভিন্ন বর্ণনা আছে',image)).rejects.toMatchObject({statusCode:503});
    }finally{CONFIG.GEMINI_API_KEY=key;}
  });
  test('voice transcription is validated and raw audio is never stored',async()=>{
    const old=CONFIG.GEMINI_API_KEY;CONFIG.GEMINI_API_KEY='test-only';
    try{const mock=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"transcript_bn":"রাস্তার পাশে ড্রেন বন্ধ"}'}]}}]})} as Response);
      const before=db.snapshot();expect((await transcribeAudio(parseMedia('data:audio/webm;base64,AQIDBA==','audio'))).transcript_bn).toContain('ড্রেন');expect(db.snapshot()).toEqual(before);
      mock.mockResolvedValue({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"wrong":"data"}'}]}}]})} as Response);await expect(transcribeAudio(parseMedia('data:audio/mp4;base64,AQIDBA==','audio'))).rejects.toMatchObject({statusCode:503});
      expect((await request(app).post('/api/v1/ai/transcribe').send({deviceId:randomUUID(),audioBase64:'data:text/plain;base64,AQID'})).status).toBe(400);
    }finally{CONFIG.GEMINI_API_KEY=old;}
  });
  test('rain calculations select next 24 Dhaka hours and boosts never change stored priority',async()=>{
    const now=Date.now(),hour=Math.floor(now/3600000)*3600000;
    const hourly={time:Array.from({length:49},(_,i)=>new Date(hour+i*3600000+6*3600000).toISOString().slice(0,16)),precipitation:Array(49).fill(1),precipitation_probability:Array(49).fill(70)};
    expect(summarizeRain({hourly},now).next24hMm).toBe(24);
    jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({hourly})} as Response);
    const priorities=JSON.stringify(db.snapshot().priorityAssessments);const data=await rainQueue('demo_seed');expect(data.alert).toBe(true);expect(data.reports.every(r=>r.sourceType==='demo_seed')).toBe(true);expect(data.reports.every(r=>r.rainBoost>0)).toBe(true);expect(JSON.stringify(db.snapshot().priorityAssessments)).toBe(priorities);
    expect(()=>summarizeRain({hourly:{...hourly,precipitation:[1]}})).toThrow();
  });
});
