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
 test('demo authority expires after two hours, permits workflow and restore, forbids directory mutation, and strips personal data',async()=>{
  const session=await request(app).post('/api/v1/auth/demo').send({});expect(session.status).toBe(200);expect(session.body.user.role).toBe('demo_authority');const demoToken=session.body.token,claims=require('jsonwebtoken').decode(demoToken);expect(claims.exp-claims.iat).toBe(7200);
  expect((await request(app).get('/api/v1/auth/me').auth(demoToken,{type:'bearer'})).body.user.role).toBe('demo_authority');
  expect((await request(app).post('/api/v1/admin/departments').auth(demoToken,{type:'bearer'}).send({})).status).toBe(403);
  const created=await request(app).post('/api/v1/reports').send({description:'তালাইমারী মোড়ে ড্রেনের বাধা সরানো প্রয়োজন',latitude:24.3655,longitude:88.5985});const freshId=created.body.report.id;
  expect((await request(app).patch('/api/v1/admin/reports/'+freshId+'/action-status').auth(demoToken,{type:'bearer'}).send({status:'UNDER_REVIEW',note:'মাঠে যাচাই হবে',revision:0})).status).toBe(200);
  expect((await request(app).delete('/api/v1/admin/reports/rep-001').auth(demoToken,{type:'bearer'}).send({reason:'সংশোধনের জন্য সরানো'})).status).toBe(200);
  expect((await request(app).post('/api/v1/admin/reports/rep-001/restore').auth(demoToken,{type:'bearer'}).send({})).status).toBe(200);
  db.updateReport('rep-001',{title:'যোগাযোগ 01712345678',description:'ফোন 01712345678'});const csv=await request(app).get('/api/v1/admin/export.csv?source=all').auth(demoToken,{type:'bearer'});expect(csv.status).toBe(200);expect(csv.text).not.toContain('01712345678');expect(csv.text).not.toContain('capabilityHash');
 });
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
