import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/db';
import { nearbySensitive } from '../src/services/nearby.service';
import { PriorityService } from '../src/services/priority.service';
import { randomUUID } from 'crypto';
import { hash } from '../src/services/citizen.service';
import { deviceHash } from '../src/middleware/civicLimit';
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
});
