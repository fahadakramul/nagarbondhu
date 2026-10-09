import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { app } from '../src/app';
import { db } from '../src/db';
import { CONFIG } from '../src/config';
import { analytics, csvExport, dhakaDay } from '../src/services/analytics.service';
import { PriorityService } from '../src/services/priority.service';
import { analyzeBengaliComplaint } from '../src/services/ai.service';
import { provisionOperator } from '../src/services/operator.service';
import bcrypt from 'bcryptjs';

describe('Citizen tracking, analytics and production protection',()=>{
  let snapshot:ReturnType<typeof db.snapshot>,adminToken:string;
  beforeEach(async()=>{snapshot=db.snapshot();adminToken=(await request(app).post('/api/v1/auth/login').send({email:'admin@nagarbondhu.gov.bd',password:'DemoAdmin123!'})).body.token;});
  afterEach(()=>db.restore(snapshot));
  const submission=()=>({title:'Drain blockage report',description:'The drain is blocked near the road.',category:'DRAINAGE',latitude:24.36,longitude:88.62,locationConfirmed:true,idempotencyKey:randomUUID()});
  test('retry returns one persisted report, prevents changed-payload reuse and never guesses ward',async()=>{
    const payload=submission(),before=db.reports.size;
    const first=await request(app).post('/api/v1/reports').send(payload),retry=await request(app).post('/api/v1/reports').send(payload);
    expect(first.status).toBe(201);expect(retry.status).toBe(200);expect(retry.body.report.id).toBe(first.body.report.id);expect(retry.body.trackingToken).toBe(first.body.trackingToken);expect(db.reports.size).toBe(before+1);expect(first.body.report.wardId).toBeNull();expect(first.body.report.actionStatus).toBe('SUBMITTED');expect(first.body.report.reporterId).toBeUndefined();
    expect((await request(app).post('/api/v1/reports').send({...payload,title:'Changed report'})).status).toBe(409);
    expect((await request(app).post('/api/v1/reports').send({...submission(),locationConfirmed:false})).status).toBe(400);
  });
  test('pre-submission matching returns public references without creating duplicate records',async()=>{
    const report=db.reports.get('rep-001')!,before=db.possibleDuplicates.size;
    const result=await request(app).post('/api/v1/reports/duplicate-suggestions').send({title:report.title,description:report.description,category:report.category,latitude:report.latitude,longitude:report.longitude});
    expect(result.status).toBe(200);expect(result.body.data.some((r:any)=>r.id==='rep-001')).toBe(true);expect(db.possibleDuplicates.size).toBe(before);expect(JSON.stringify(result.body)).not.toContain('reporterId');
  });
  test('feedback requires receipt, stays separate from resolution, supports audited admin review',async()=>{
    const created=await request(app).post('/api/v1/reports').send(submission()),id=created.body.report.id;
    db.updateReport(id,{actionStatus:'RESOLVED',status:'RESOLVED'});
    expect((await request(app).post(`/api/v1/reports/${id}/feedback`).send({trackingToken:'0'.repeat(64),verdict:'PERSISTS'})).status).toBe(403);
    const feedback=await request(app).post(`/api/v1/reports/${id}/feedback`).send({trackingToken:created.body.trackingToken,verdict:'PERSISTS',comment:'Issue still visible'});
    expect(feedback.status).toBe(201);expect(db.reports.get(id)?.actionStatus).toBe('RESOLVED');
    const review=await request(app).post(`/api/v1/admin/feedback/${feedback.body.data.id}/review`).set('Authorization','Bearer '+adminToken).send({decision:'REOPEN',note:'Citizen feedback requires another inspection',revision:0});
    expect(review.status).toBe(200);expect(db.reports.get(id)?.actionStatus).toBe('UNDER_REVIEW');expect(Array.from(db.actionEvents.values()).some(e=>e.type==='CITIZEN_FEEDBACK_REVIEWED')).toBe(true);
  });
  test('public tracking omits internal audit details and publishes information requests',async()=>{
    const notice=await request(app).post('/api/v1/admin/reports/rep-001/request-information').set('Authorization','Bearer '+adminToken).send({message:'Please confirm the current condition at the marked location.'});expect(notice.status).toBe(201);
    const tracking=await request(app).get('/api/v1/reports/rep-001/tracking');expect(tracking.status).toBe(200);expect(tracking.body.data.timeline.some((e:any)=>e.type==='INFORMATION_REQUESTED')).toBe(true);expect(JSON.stringify(tracking.body)).not.toMatch(/actorId|passwordHash|adminNotes|capabilityHash/);
  });
  test('registration cannot grant admin role; signed client role is ignored',async()=>{
    const created=await request(app).post('/api/v1/auth/register').send({displayName:'Citizen',email:randomUUID()+'@example.test',password:'Password123!',role:'ADMIN'});expect(created.body.user.role).toBe('CITIZEN');
    const forged=jwt.sign({id:created.body.user.id,role:'ADMIN'},CONFIG.JWT_SECRET);
    expect((await request(app).get('/api/v1/admin/actions/dashboard').set('Authorization','Bearer '+forged)).status).toBe(403);
    expect((await request(app).post('/api/v1/ai/reports/rep-001/analyze').send({})).status).toBe(401);
  });
  test('public demo mutation is blocked in production while controlled copilot remains readable',async()=>{
    const original=CONFIG.NODE_ENV;CONFIG.NODE_ENV='production';try{
      expect((await request(app).patch('/api/v1/admin/reports/rep-001/priority').set('Authorization','Bearer '+adminToken).send({priorityLevel:'HIGH',reason:'test reason'})).status).toBe(403);
      expect((await request(app).post('/api/v1/admin/copilot').set('Authorization','Bearer '+adminToken).send({question:'REVIEW_FIRST',filters:{source:'demo_seed'}})).status).toBe(200);
    }finally{CONFIG.NODE_ENV=original;}
  });
  test('deployment-provisioned operator can use existing session without a separate login page',async()=>{
    const original=CONFIG.NODE_ENV;const env={email:process.env.OPERATOR_EMAIL,hash:process.env.OPERATOR_PASSWORD_HASH,name:process.env.OPERATOR_NAME};
    process.env.OPERATOR_EMAIL='operator@example.test';process.env.OPERATOR_PASSWORD_HASH=bcrypt.hashSync('OperatorTestPassword!',10);process.env.OPERATOR_NAME='Test operator';CONFIG.NODE_ENV='production';
    try{
      await provisionOperator();const login=await request(app).post('/api/v1/auth/login').send({email:'operator@example.test',password:'OperatorTestPassword!'});expect(login.status).toBe(200);
      const result=await request(app).patch('/api/v1/admin/reports/rep-001/priority').set('Authorization','Bearer '+login.body.token).send({priorityLevel:'HIGH',reason:'Operator reviewed the field validation requirement'});expect(result.status).toBe(200);
    }finally{CONFIG.NODE_ENV=original;for(const [key,value] of Object.entries({OPERATOR_EMAIL:env.email,OPERATOR_PASSWORD_HASH:env.hash,OPERATOR_NAME:env.name}))if(value===undefined)delete process.env[key];else process.env[key]=value;}
  });
  test('Dhaka date filters include the local day before the UTC calendar rollover',()=>{
    const report=db.reports.get('rep-001')!;db.updateReport(report.id,{createdAt:'2026-10-09T19:00:00.000Z'});
    const result=analytics({from:'2026-10-10',to:'2026-10-10',source:'demo_seed'});expect(result.rows.some(r=>r.id===report.id)).toBe(true);
    expect(dhakaDay('2026-09-30T19:00:00.000Z')).toBe('2026-10-01');
    expect(analytics({from:'2026-10-11',to:'2026-10-11'}).rows.some(r=>r.id===report.id)).toBe(false);
  });
  test('analytics aggregates match scoped rows, date validation and pagination; export neutralizes formulas',async()=>{
    const data=analytics({source:'demo_seed'});expect(data.total).toBe(data.rows.length);expect(data.realCount).toBe(0);expect(Object.values(data.byCategory).reduce((a,b)=>a+b,0)).toBe(data.total);
    expect((await request(app).get('/api/v1/admin/analytics?from=2026-10-10&to=2026-01-01').set('Authorization','Bearer '+adminToken)).status).toBe(400);
    const page=await request(app).get('/api/v1/admin/actions/dashboard?limit=2&offset=1').set('Authorization','Bearer '+adminToken);expect(page.body.data.rows.length).toBe(2);expect(page.body.data.summary.totalReports).toBe(db.reports.size);
    const csv=csvExport([{...data.rows[0],title:' =HYPERLINK("bad")'}]);expect(csv).toContain("' =HYPERLINK");expect(csv).not.toMatch(/reporterId|passwordHash/);
  });
  test('priority 2 has no invented population impact and configured AI failure allows fallback',async()=>{
    const assessment=PriorityService.assessReportPriority('rep-001')!;expect(assessment.impactFactor).toBe(0);expect(assessment.recurrenceFactor).toBe(0);expect(assessment.explanation.summary).toContain('2.0');
    const key=CONFIG.GEMINI_API_KEY,original=global.fetch;CONFIG.GEMINI_API_KEY='unit-test-only';global.fetch=jest.fn().mockRejectedValue(new Error('network unavailable'));
    try{const result=await analyzeBengaliComplaint('Garbage has accumulated beside the road.');expect(result.isFallback).toBe(true);expect(result.data.confidence).toBeNull();expect(result.data.category).toBe('WASTE');expect(result.data.fieldVerificationNecessary).toBe(true);}finally{CONFIG.GEMINI_API_KEY=key;global.fetch=original;}
  });
});
