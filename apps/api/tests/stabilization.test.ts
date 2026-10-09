import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/db';
import { CONFIG } from '../src/config';
import { seedCompetitionDemo } from '../src/services/competition.service';
import { workflowStatus } from '../src/services/action.service';
import { analyzeBengaliComplaint } from '../src/services/ai.service';
import { DuplicateService } from '../src/services/duplicate.service';
import { PriorityService } from '../src/services/priority.service';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('Final stabilization regression checks',()=>{
  let snapshot:ReturnType<typeof db.snapshot>,key:string;
  beforeEach(()=>{snapshot=db.snapshot();key=CONFIG.GEMINI_API_KEY;CONFIG.GEMINI_API_KEY='';seedCompetitionDemo();});
  afterEach(()=>{db.restore(snapshot);CONFIG.GEMINI_API_KEY=key;jest.restoreAllMocks();});
  const payload=()=>({title:'Road surface inspection',description:'Road damage and pothole observation near a junction.',userCategory:'ROAD_DAMAGE',latitude:24.38,longitude:88.65,locationConfirmed:true,idempotencyKey:randomUUID()});
  test('source-specific summary matches workflow records and excludes resolved high-priority cases',async()=>{
    const response=await request(app).get('/api/v1/dashboard/summary?source=demo_seed');
    const rows=Array.from(db.reports.values()).filter(r=>r.sourceType==='demo_seed');
    const unresolved=rows.filter(r=>!['RESOLVED','CLOSED','REJECTED'].includes(workflowStatus(r)));
    const s=response.body.data;expect(response.status).toBe(200);expect(s.totalReports).toBe(rows.length);expect(s.openReports).toBe(unresolved.length);
    expect(s.inProgressReports).toBe(rows.filter(r=>workflowStatus(r)==='IN_PROGRESS').length);
    expect(s.highPriorityReports+s.criticalPriorityReports).toBe(unresolved.filter(r=>['HIGH','CRITICAL'].includes(db.findPriorityAssessmentByReportId(r.id)?.priorityLevel || '')).length);
    expect(s.byCategory.reduce((n:number,c:any)=>n+c.count,0)).toBe(s.totalReports);expect(Object.values(s.byStatus).reduce((n:any,c:any)=>n+c,0)).toBe(s.totalReports);
    expect((await request(app).get('/api/v1/dashboard/summary?source=bad')).status).toBe(400);
  });
  test('empty real source is a real zero, and submission updates source counts and feed',async()=>{
    expect((await request(app).get('/api/v1/dashboard/summary?source=citizen_report')).body.data.totalReports).toBe(0);
    const result=await request(app).post('/api/v1/reports').send(payload());expect(result.status).toBe(201);expect(result.body.report.category).toBe('ROAD_DAMAGE');
    expect(result.body.report.aiAnalysis.provider).toContain('Fallback');
    const feed=await request(app).get('/api/v1/reports?source=citizen_report');expect(feed.body.total).toBe(1);expect(feed.body.reports[0].id).toBe(result.body.report.id);
    expect((await request(app).get('/api/v1/dashboard/summary?source=citizen_report')).body.data.totalReports).toBe(1);
  });
  test('duplicate summary does not depend on feed pagination and deduplicates mirrored pairs',async()=>{
    const sample=Array.from(db.possibleDuplicates.values())[0];
    if(sample)db.possibleDuplicates.set('mirrored',{...sample,id:'mirrored',reportId:sample.candidateReportId,candidateReportId:sample.reportId});
    const s=(await request(app).get('/api/v1/dashboard/summary?source=demo_seed')).body.data;
    expect(new Set(s.duplicates.map((d:any)=>[d.reportId,d.candidateReportId].sort().join('|'))).size).toBe(s.duplicates.length);
    expect(s.duplicateReportsFlagged).toBe(s.duplicates.length);
  });
  test('live preview missing key is explicit 503, optional rule preview is labelled',async()=>{
    const input={title:'Blocked drain',text:'The drain near the road is blocked.'};
    const failed=await request(app).post('/api/v1/ai/analyze-complaint').send(input);expect(failed.status).toBe(503);expect(failed.body.data).toBeUndefined();expect(failed.body.error).toContain('Live AI');
    const fallback=await request(app).post('/api/v1/ai/analyze-complaint').send({...input,allowFallback:true});expect(fallback.status).toBe(200);expect(fallback.body.metadata.isFallback).toBe(true);expect(fallback.body.data.confidence).toBeNull();
    expect((await request(app).post('/api/v1/ai/analyze-complaint').send({...input,apiKey:'do-not-accept'})).status).toBe(400);
  });
  test('configured provider uses server-only key and validates structured output (mock provider)',async()=>{
    CONFIG.GEMINI_API_KEY='mock-private-key';
    const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({category:'DRAINAGE',summary:'ড্রেনের বাধা পরিদর্শন প্রয়োজন',severity:3,confidence:.7,reasons:['অভিযোগে ড্রেনের বাধার উল্লেখ'],missing_information:[]})}]}}]}),{status:200}));
    const result=await request(app).post('/api/v1/ai/analyze-complaint').send({title:'Blocked drain',text:'Drain is blocked near the road.'});
    expect(result.status).toBe(200);expect(result.body.metadata.isFallback).toBe(false);expect(result.body.data.category).toBe('DRAINAGE');expect(JSON.stringify(result.body)).not.toContain('mock-private-key');
    const options=fetchMock.mock.calls[0][1]!;expect((options.headers as any)['x-goog-api-key']).toBe('mock-private-key');expect(String(options.body)).toContain('Blocked drain');expect(options.signal).toBeDefined();
  });
  test.each(['rate limit','malformed','timeout'])('live provider %s produces an error instead of fabricated live output',async mode=>{
    CONFIG.GEMINI_API_KEY='mock-private-key';const mock=jest.spyOn(global,'fetch');
    if(mode==='timeout')mock.mockRejectedValue(new Error('Timeout'));
    else mock.mockResolvedValue(new Response(mode==='malformed'?JSON.stringify({candidates:[{content:{parts:[{text:'{"severity":99}'}]}}]}):'{}',{status:mode==='rate limit'?429:200}));
    await expect(analyzeBengaliComplaint('Drain blocked near the road',false)).rejects.toMatchObject({statusCode:503});
  });
  test('priority age refreshes consistently across report/map/twin/analytics and terminal age freezes',async()=>{
    const response=await request(app).post('/api/v1/reports').send(payload()),id=response.body.report.id;
    const report=db.reports.get(id)!;report.createdAt=new Date(Date.now()-28*86400000).toISOString();
    const detail=(await request(app).get('/api/v1/reports/'+id)).body.report;
    const map=(await request(app).get('/api/v1/map/reports')).body.markers.find((r:any)=>r.id===id);
    const twin=(await request(app).get('/api/v1/competition/twin?source=citizen_report')).body.data.records.find((r:any)=>r.id===id);
    expect(map.priorityLevel).toBe(detail.priorityAssessment.priorityLevel);expect(map.priorityScore).toBe(detail.priorityAssessment.score);expect(twin.priority).toBe(map.priorityLevel);expect(detail.priorityAssessment.ageFactor).toBe(5);
    report.actionStatus='RESOLVED';report.resolvedAt=new Date(Date.parse(report.createdAt)+2*86400000).toISOString();
    const terminal=PriorityService.assessReportPriority(id)!;expect(terminal.ageFactor).toBe(1);expect(terminal.explanation.factors[1].note).toContain('terminal');
    PriorityService.overridePriority(id,'CRITICAL','Documented provisional review','operator');report.actionStatus='UNDER_REVIEW';
    expect(db.findPriorityAssessmentByReportId(id)?.priorityLevel).toBe('CRITICAL');
  });
  test('duplicate corroboration counts unique counterparts and does not mix fiction with citizen evidence',async()=>{
    const result=await request(app).post('/api/v1/reports').send(payload()),id=result.body.report.id;
    const fictional=db.reports.get('mvp-demo-road-2')!;db.reports.set('fiction-copy',{...fictional,id:'fiction-copy',title:payload().title,description:payload().description,latitude:payload().latitude,longitude:payload().longitude});
    expect(DuplicateService.checkForDuplicates(db.findReportById(id)!).length).toBe(0);
    const second={...db.reports.get(id)!,id:'real-second'};db.reports.set(second.id,second);
    const duplicate=DuplicateService.checkForDuplicates(db.findReportById(id)!)[0];expect(duplicate).toBeDefined();
    DuplicateService.reviewDuplicate(duplicate.id,'CONFIRMED_DUPLICATE','operator');db.possibleDuplicates.set('mirror-real',{...duplicate,id:'mirror-real',reportId:second.id,candidateReportId:id,reviewStatus:'CONFIRMED_DUPLICATE'});
    expect(db.findPriorityAssessmentByReportId(id)?.explanation.factors[2].value).toBe(1);
  });
  test('homepage failed API clears stale charts, shows unavailable; successful empty response shows zero',async()=>{
    const js=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');const fragment=js.slice(js.indexOf('let dataRequestSequence='),js.indexOf('// Render Reports Feed'));
    const elements:Record<string,any>={};const element=(id:string)=>elements[id] ||= {textContent:'old data',innerHTML:'old chart',value:id==='stats-source'?'citizen_report':''};
    const ctx:any={document:{getElementById:element},feedOffset:0,isAdminMode:false,authToken:null,allReports:[],dashboardData:{totalReports:100},AbortSignal,Promise,Number,String,Date,renderReportsFeed:jest.fn(),renderDashboard:jest.fn(),fetch:jest.fn().mockRejectedValue(new Error('offline'))};
    vm.createContext(ctx);vm.runInContext(fragment,ctx);await ctx.loadData();
    expect(element('stat-total').textContent).toBe('অনুপলব্ধ');expect(element('dashboard-category-bars').textContent).toContain('অনুপলব্ধ');expect(ctx.dashboardData).toBeNull();expect(ctx.renderDashboard).not.toHaveBeenCalled();
    ctx.fetch.mockResolvedValue({ok:true,json:async()=>({success:true,data:{totalReports:0,openReports:0,highPriorityReports:0,criticalPriorityReports:0,resolvedReports:0,inProgressReports:0},reports:[],total:0})});
    await ctx.loadData();expect(element('stat-total').textContent).toBe('0');expect(element('stats-message').textContent).toContain('কোনো রিপোর্ট নেই');
  });
});
