import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/db';
import { CONFIG } from '../src/config';
import { AuthService } from '../src/services/auth.service';
import { rainQueue } from '../src/services/rain.service';
import { duplicateSuggestions } from '../src/services/citizen.service';
import { analytics } from '../src/services/analytics.service';
import { wardScorecard } from '../src/services/scorecard.service';

describe('Final deadline fixes',()=>{
 let snapshot:any,key:string,token:string;
 beforeEach(()=>{snapshot=db.snapshot();key=CONFIG.GEMINI_API_KEY;CONFIG.GEMINI_API_KEY='';token=AuthService.generateToken(db.users.get('user-admin-01')!);});
 afterEach(()=>{db.restore(snapshot);CONFIG.GEMINI_API_KEY=key;});
 test('missing or short titles use analysis while explicit edited titles survive',async()=>{
  for(const title of [undefined,'x','নিজের সংশোধিত শিরোনাম']){const r=await request(app).post('/api/v1/reports').send({title,description:'তালাইমারী মোড়ে ড্রেন উপচে পানি জমেছে এবং চলাচল ব্যাহত হচ্ছে',latitude:24.3655,longitude:88.5985});expect(r.status).toBe(201);expect(r.body.report.title.length).toBeGreaterThan(3);if(title&&title.length>=4)expect(r.body.report.title).toBe(title);else expect(r.body.report.title).toBe(r.body.report.aiAnalysis.title_bn);}
 });
 test('soft delete needs authority and reason, hides every public aggregate, and can restore',async()=>{
  const id='rep-001',r=db.reports.get(id)!;
  expect((await request(app).delete('/api/v1/admin/reports/'+id).send({reason:'ভুল তথ্য সরানো'})).status).toBe(401);
  expect((await request(app).delete('/api/v1/admin/reports/'+id).auth(token,{type:'bearer'}).send({reason:'x'})).status).toBe(400);
  expect((await request(app).delete('/api/v1/admin/reports/'+id).auth(token,{type:'bearer'}).send({reason:'ভুল তথ্য সরানো'})).status).toBe(200);
  expect(db.reports.get(id)?.deletedAt).toBeTruthy();expect(db.statusHistories.some(h=>h.reportId===id&&h.note==='কর্তৃপক্ষ মুছে ফেলেছে: ভুল তথ্য সরানো')).toBe(true);
  expect((await request(app).get('/api/v1/reports/'+id)).status).toBe(404);
  expect(db.findReports({limit:1000}).reports.some(r=>r.id===id)).toBe(false);
  expect(analytics({}).rows.some(r=>r.id===id)).toBe(false);
  expect(duplicateSuggestions(r).some(x=>x.id===id)).toBe(false);
  expect(db.findDuplicatesForReport(id)).toEqual([]);
  const deleted=await request(app).get('/api/v1/admin/reports/deleted').auth(token,{type:'bearer'});expect(deleted.body.data.some((r:any)=>r.id===id)).toBe(true);
  expect((await request(app).post('/api/v1/admin/reports/'+id+'/restore').auth(token,{type:'bearer'}).send({})).status).toBe(200);expect(db.findReportById(id)).not.toBeNull();
 });
});
