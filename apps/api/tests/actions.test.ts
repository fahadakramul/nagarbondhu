import request from 'supertest';
import { app } from '../src/app';
import { db, DatabaseRepository } from '../src/db';
import { CONFIG } from '../src/config';
import { generateActionRecommendation, recommendationContext, RecommendationSchema } from '../src/services/action-ai.service';
import { actionDashboard, isOverdue, getPlan } from '../src/services/action.service';

describe('Admin action workflow', () => {
  let token: string;
  const api = '/api/v1/admin/reports/rep-001';
  const future = new Date(Date.now() + 86400000 * 3).toISOString().slice(0,10);
  const plan = () => ({actionDescription:'Inspect the road and record a verified repair plan.',wardId:db.findReportById('rep-001')!.wardId,wardVerified:true,wardVerificationNote:'Ward location checked by administrator.',departmentId:'roads',officerId:null,assignmentNote:'Assigned for field review',targetDate:future,priority:'HIGH',urgency:'URGENT',revision:0});
  beforeEach(async () => {
    db.restore(new DatabaseRepository().snapshot());
    token=(await request(app).post('/api/v1/auth/login').send({email:'admin@nagarbondhu.gov.bd',password:'DemoAdmin123!'})).body.token;
  });
  const send = (method: 'put'|'post'|'patch', path: string, body: any) => request(app)[method](path).set('Authorization',`Bearer ${token}`).send(body);
  test('protects admin endpoints and rejects citizen tokens',async()=>{
    expect((await request(app).get('/api/v1/admin/actions/dashboard')).status).toBe(401);
    const citizen=await request(app).post('/api/v1/auth/login').send({email:'citizen@rajshahi.test',password:'Citizen123!'});
    expect((await request(app).get('/api/v1/admin/action-directory').set('Authorization',`Bearer ${citizen.body.token}`)).status).toBe(403);
  });
  test('draft remains separate, malformed provider response is rejected, private fields are omitted',async()=>{
    const oldKey=CONFIG.GEMINI_API_KEY;
    CONFIG.GEMINI_API_KEY='';
    try {
      const result=await send('post',`${api}/action-recommendations`,{});
      expect(result.status).toBe(201); expect(result.body.data.isFallback).toBe(true);
      expect(getPlan('rep-001')).toBeNull();
      expect(RecommendationSchema.safeParse({nextAction:'bad'}).success).toBe(false);
      const report=db.findReportById('rep-001')!;
      report.description='Call 01712345678 or private@example.com';
      const context=JSON.stringify(recommendationContext(report));
      expect(context).not.toContain('01712345678'); expect(context).not.toContain('private@example.com'); expect(context).not.toContain('reporterId');
      CONFIG.GEMINI_API_KEY='test-key';
      const mock=jest.spyOn(global,'fetch').mockResolvedValue({ok:false,status:503} as Response);
      await expect(generateActionRecommendation(report,'user-admin-01')).rejects.toMatchObject({statusCode:503});
      mock.mockResolvedValue({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"nextAction":"invalid incomplete draft"}'}]}}]})} as Response);
      await expect(generateActionRecommendation(report,'user-admin-01')).rejects.toMatchObject({statusCode:503});
      mock.mockResolvedValue({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(result.body.data.data)}]}}]})} as Response);
      expect((await generateActionRecommendation(report,'user-admin-01')).isFallback).toBe(false);
      mock.mockRestore();
    } finally { CONFIG.GEMINI_API_KEY=oldKey; jest.restoreAllMocks(); }
  });
  test('validates ward verification, officer membership, stale revisions and unrelated fields',async()=>{
    expect((await send('put',`${api}/action-plan`,{...plan(),wardVerified:false})).status).toBe(400);
    expect((await send('put',`${api}/action-plan`,{...plan(),wardId:'unknown'})).status).toBe(400);
    expect((await send('put',`${api}/action-plan`,{...plan(),officerId:'unknown'})).status).toBe(400);
    const before=db.findReportById('rep-001')!;
    const result=await send('put',`${api}/action-plan`,plan()); expect(result.status).toBe(200);
    expect(result.body.data.status).toBe('ASSIGNED');
    expect(db.findReportById('rep-001')!.description).toBe(before.description);
    expect((await send('put',`${api}/action-plan`,plan())).status).toBe(409);
    expect(getPlan('rep-001')!.revision).toBe(1);
    expect(Array.from(db.actionEvents.values()).map(e=>e.type)).toContain('ASSIGNMENT_RECORDED');
  });
  test('requires assignment, resolution evidence and separate verification before closure',async()=>{
    expect((await send('patch',`${api}/action-status`,{status:'IN_PROGRESS',note:'Start work',revision:0})).status).toBeGreaterThanOrEqual(400);
    await send('put',`${api}/action-plan`,plan());
    expect((await send('patch',`${api}/action-status`,{status:'IN_PROGRESS',note:'Start verified work',revision:1})).status).toBe(200);
    expect((await send('patch',`${api}/action-status`,{status:'RESOLVED',note:'Finished work',revision:2})).status).toBe(400);
    expect(getPlan('rep-001')!.revision).toBe(2);
    const resolved=await send('patch',`${api}/action-status`,{status:'RESOLVED',note:'Resolution submitted',resolutionNotes:'Repairs completed according to field notes.',verificationMethod:'An administrator will inspect the repaired road.',revision:2});
    expect(resolved.status).toBe(200); expect(resolved.body.status).toBe('RESOLVED');
    expect((await send('patch',`${api}/action-status`,{status:'CLOSED',note:'Close verified report',revision:3})).status).toBe(400);
    expect((await send('post',`${api}/resolution-verification`,{verified:true,note:'Field visit confirmed the recorded repairs.',revision:3})).status).toBe(200);
    expect(getPlan('rep-001')!.status).toBe('RESOLVED');
    expect((await send('patch',`${api}/action-status`,{status:'CLOSED',note:'Close verified report',revision:4})).status).toBe(200);
    expect((await send('patch',`${api}/action-status`,{status:'UNDER_REVIEW',note:'Reopened for another inspection',revision:5})).status).toBe(200);
    expect(getPlan('rep-001')!.verificationStatus).toBe('PENDING');
  });
  test('validates officer ward/department, inactive teams, invalid dates and documented distant overrides',async()=>{
    const report=db.findReportById('rep-001')!;
    db.officers.set('sample-officer',{id:'sample-officer',displayName:'Sample test officer',title:'Sample test role',departmentId:'drainage',wardId:report.wardId!,active:true,source:'Test fixture only; not a real person',verificationStatus:'DEMO',contact:null});
    expect((await send('put',`${api}/action-plan`,{...plan(),officerId:'sample-officer'})).status).toBe(400);
    expect((await send('put',`${api}/action-plan`,{...plan(),targetDate:'2026-02-30'})).status).toBe(400);
    const ward=db.wards.get(report.wardId!)!;
    db.wards.set(ward.id,{...ward,centerLatitude:25});
    expect((await send('put',`${api}/action-plan`,plan())).status).toBe(400);
    expect((await send('put',`${api}/action-plan`,{...plan(),locationOverrideReason:'Approximate centre is wrong; checked fixture coordinates'})).status).toBe(200);
  });
  test('records progress and due-date history; aggregates use records and filtered results',async()=>{
    await send('put',`${api}/action-plan`,plan());
    expect((await send('post',`${api}/progress`,{note:'Inspection scheduled with the team.',revision:1})).status).toBe(201);
    await send('put',`${api}/action-plan`,{...plan(),revision:2,targetDate:new Date(Date.now()+86400000*4).toISOString().slice(0,10)});
    expect(Array.from(db.actionEvents.values()).map(e=>e.type)).toContain('DUE_DATE_CHANGED');
    const result=actionDashboard({departmentId:'roads'}); expect(result.rows).toHaveLength(1); expect(result.summary.assigned).toBe(1);
    const row=getPlan('rep-001')!; const due=Date.parse(row.targetDate);
    expect(row.targetDate).toContain('17:59:59.999Z');
    expect(isOverdue(row,due)).toBe(false); expect(isOverdue(row,due+1)).toBe(true);
    expect(isOverdue({...row,status:'RESOLVED'},due+1)).toBe(false);
  });
  test('rejects executable or unsupported uploads',async()=>{
    expect((await request(app).post('/api/v1/reports/upload-image').send({imageBase64:'data:image/svg+xml;base64,PHN2Zz4='})).status).toBe(400);
    expect((await request(app).post('/api/v1/reports/upload-image').send({imageBase64:'data:image/png;base64,PHN2Zz4='})).status).toBe(400);
  });
});
