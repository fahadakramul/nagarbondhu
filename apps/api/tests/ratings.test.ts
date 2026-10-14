import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/db';
import { confirmPlan, getPlan } from '../src/services/action.service';

describe('Citizen resolution photo ratings',()=>{
  let snapshot:ReturnType<typeof db.snapshot>;
  const reportId='rep-001',photo='/uploads/resolved.png';
  const rate=(score=5,voterToken='a'.repeat(64),afterPhotoUrl=photo)=>request(app).post(`/api/v1/reports/${reportId}/rating`).send({score,voterToken,afterPhotoUrl});
  beforeEach(()=>{
    snapshot=db.snapshot();
    confirmPlan(reportId,{actionDescription:'Inspect and repair the damaged road.',wardId:db.reports.get(reportId)!.wardId!,wardVerified:true,wardVerificationNote:'Ward location confirmed during inspection.',departmentId:'roads',officerId:null,assignmentNote:'Repair team assigned',targetDate:'2026-12-01',priority:'HIGH',urgency:'URGENT',adminNotes:'',revision:0},'user-admin-01');
  });
  afterEach(()=>db.restore(snapshot));
  function resolve(){const plan=getPlan(reportId)!;db.actionPlans.set(plan.id,{...plan,status:'RESOLVED',afterPhotoUrl:photo});}
  test('requires resolution and photo, validates whole stars, and rejects stale photos',async()=>{
    expect((await rate()).status).toBe(400);
    resolve();const plan=getPlan(reportId)!;db.actionPlans.set(plan.id,{...plan,afterPhotoUrl:null});
    expect((await rate()).status).toBe(400);resolve();
    for(const score of [0,6,2.5])expect((await rate(score)).status).toBe(400);
    expect((await rate(5,'invalid')).status).toBe(400);
    expect((await rate(5,'a'.repeat(64),'/uploads/old.png')).status).toBe(409);
    expect(db.resolutionRatings.size).toBe(0);
  });
  test('all citizens can rate, retries update one vote, public summary protects identities',async()=>{
    resolve();expect((await rate()).status).toBe(201);
    const retry=await rate(3);expect(retry.status).toBe(200);expect(retry.body.data).toMatchObject({average:3,count:1,score:3});
    expect((await rate(4,'b'.repeat(64))).body.data).toMatchObject({average:3.5,count:2});
    const tracking=await request(app).get(`/api/v1/reports/${reportId}/tracking`);
    expect(tracking.body.data.rating).toEqual({average:3.5,count:2,available:true});
    expect(JSON.stringify(tracking.body)).not.toMatch(/voterHash|voterToken/);
    expect(getPlan(reportId)!.verificationStatus).toBe('PENDING');
    const saved=db.snapshot();db.restore(saved);expect(db.resolutionRatings.size).toBe(2);
  });
  test('replacement photo excludes previous ratings, reopening disables new votes',async()=>{
    resolve();await rate();const plan=getPlan(reportId)!;db.actionPlans.set(plan.id,{...plan,afterPhotoUrl:'/uploads/new.png'});
    expect((await request(app).get(`/api/v1/reports/${reportId}/tracking`)).body.data.rating).toMatchObject({count:0,average:null});
    expect((await rate(4,'a'.repeat(64),'/uploads/new.png')).body.data).toMatchObject({count:1,average:4});
    db.actionPlans.set(plan.id,{...getPlan(reportId)!,status:'UNDER_REVIEW'});expect((await rate()).status).toBe(400);
  });
});
