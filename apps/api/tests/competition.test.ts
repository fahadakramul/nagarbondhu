import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/db';
import { CONFIG } from '../src/config';
import * as analyticsModule from '../src/services/analytics.service';
import { seedCompetitionDemo, scenarios, rootClusters, twin, coverage, demoCases, MissionInput, MissionUpdate, saveMission, updateMission } from '../src/services/competition.service';

describe('Competition MVP integrity and integration',()=>{
  let before:ReturnType<typeof db.snapshot>,token:string;
  beforeEach(async()=>{before=db.snapshot();seedCompetitionDemo();token=(await request(app).post('/api/v1/auth/login').send({email:'admin@nagarbondhu.gov.bd',password:'DemoAdmin123!'})).body.token;});
  afterEach(()=>db.restore(before));
  test('explicit restore is idempotent, preserves real records and rejects collisions before mutations',()=>{
    const real={...db.reports.get('rep-001')!,id:'real-preserve',sourceType:'citizen_report' as const};db.reports.set(real.id,real);
    const count=db.reports.size;seedCompetitionDemo();seedCompetitionDemo();expect(db.reports.size).toBe(count);expect(db.reports.get(real.id)).toEqual(real);
    db.reports.set(demoCases[3].id,{...real,id:demoCases[3].id});const snapshot=db.snapshot();expect(()=>seedCompetitionDemo()).toThrow('collision');expect(db.snapshot()).toEqual(snapshot);
  });
  test('twin snapshots use dated workflow evidence and distinguish not-yet-submitted cases',async()=>{
    const data=twin({source:'demo_seed'},'2026-08-20','2026-10-05');const water=data.records.find(r=>r.id==='mvp-demo-water-1')!;
    expect(water.status).toBe('ASSIGNED');expect(water.compareStatus).toBe('RESOLVED');expect(water.currentStatus).toBe('RESOLVED');expect(water.comparison?.note).toContain('Simulated');
    expect(data.records.some(r=>r.id==='mvp-demo-light-1')).toBe(false);
    const response=await request(app).get('/api/v1/competition/twin?source=demo_seed&at=2026-10-05');expect(response.status).toBe(200);expect(JSON.stringify(response.body)).not.toMatch(/reporterId|actorId|passwordHash|adminNotes/);
    expect((await request(app).get('/api/v1/competition/twin?at=not-a-date')).status).toBe(400);
  });
  test('clusters require compatible categories and geography, show evidence without claiming causes',()=>{
    const clusters=rootClusters({source:'demo_seed'});expect(clusters.some(c=>c.reportIds.includes('mvp-demo-water-2') && c.reportIds.includes('mvp-demo-drain-1'))).toBe(true);
    const road=clusters.find(c=>c.reportIds.includes('mvp-demo-road-2'));expect(road.recurringCount).toBeGreaterThan(0);expect(road.possibleDuplicates.length).toBeGreaterThan(0);
    const distant={...db.reports.get('mvp-demo-road-2')!,id:'distant-word-match',longitude:88.7};db.reports.set(distant.id,distant);expect(rootClusters({source:'demo_seed'}).some(c=>c.reportIds.includes(distant.id))).toBe(false);
    const unrelated={...distant,id:'wrong-category',longitude:88.6315,category:'STREETLIGHT' as const};db.reports.set(unrelated.id,unrelated);expect(rootClusters({source:'demo_seed'}).some(c=>c.reportIds.includes(unrelated.id)&&c.reportIds.includes('mvp-demo-road-2'))).toBe(false);
  });
  test('scenario budget and capacity hold, workload and unknown real costs are explicit',()=>{
    const result=scenarios({filters:{source:'demo_seed'},budget:6000,teams:1,maxCases:4,days:2});expect(result.scenarios.length).toBe(5);
    for(const s of result.scenarios){expect(s.illustrativeCost).toBeLessThanOrEqual(6000);expect(s.selected.length).toBeLessThanOrEqual(4);expect(s.selected.length+s.deferred.length).toBe(result.facts.eligible);}
    expect(new Set(result.scenarios.map(s=>s.selected.map(r=>r.id).join('|'))).size).toBeGreaterThanOrEqual(3);
    const real={...db.reports.get('mvp-demo-water-2')!,id:'actual-unknown-cost',sourceType:'citizen_report' as const};db.reports.set(real.id,real);
    const realResult=scenarios({filters:{source:'citizen_report'},budget:100000,teams:1,maxCases:4,days:2});expect(realResult.scenarios[0].selected.length).toBe(0);expect(realResult.scenarios[0].deferred[0].reason).toContain('unknown');
  });
  test('coverage includes zero-report configured wards, transparent components and weight validation',async()=>{
    const result=coverage({source:'demo_seed',from:'2026-08-01',to:'2026-10-05'});expect(result.rows.length).toBe(db.wards.size+1);expect(result.rows.some(r=>r.count===0 && r.score===null && r.classification==='INSUFFICIENT_DATA')).toBe(true);
    expect(result.rows.find(r=>r.wardId==='ward-12')!.count).toBeGreaterThan(result.rows.find(r=>r.wardId==='ward-14')!.count);
    expect(result.methodology).toContain('No population');expect(()=>coverage({}, {completeness:1,consistency:1,categories:1})).toThrow();
    expect((await request(app).post('/api/v1/competition/coverage').send({filters:{source:'demo_seed'},weights:{completeness:.4,consistency:.3,categories:.3}})).status).toBe(200);
  });
  test('mission saves suggested route, supports later assignment and persists updates in report history',async()=>{
    const mission=saveMission(MissionInput.parse({title:'Demo field mission',reportIds:['mvp-demo-water-3','mvp-demo-drain-1']}),'user-admin-01',true);
    expect(mission.route.map(s=>s.order)).toEqual([1,2]);expect(mission.route.every(s=>s.checklist.length>=4)).toBe(true);
    const planned=updateMission(mission.id,MissionUpdate.parse({revision:1,status:'PLANNED',note:'Demo inspection route reviewed'}),'user-admin-01',true);
    const assigned=updateMission(mission.id,MissionUpdate.parse({revision:planned.revision,status:'ASSIGNED',note:'Demo team assigned for inspection',departmentId:'mvp-demo-drainage',officerId:'mvp-demo-inspector',team:'DEMO team'}),'user-admin-01',true);expect(assigned.status).toBe('ASSIGNED');
    expect(()=>updateMission(mission.id,MissionUpdate.parse({revision:1,status:'IN_PROGRESS',note:'Another update'}),'user-admin-01',true)).toThrow('reload');
    const tracking=await request(app).get('/api/v1/reports/mvp-demo-water-3/tracking');expect(tracking.body.data.timeline.some((e:any)=>e.type==='MISSION_UPDATED')).toBe(true);expect(db.reports.get('mvp-demo-water-3')!.actionStatus).toBe('UNDER_REVIEW');
    expect(()=>updateMission(mission.id,MissionUpdate.parse({revision:assigned.revision,status:'COMPLETED',note:'Cannot skip inspection'}),'user-admin-01',true)).toThrow('transition');
  });
  test('production demo scope cannot mutate real, legacy demo, unverified identities or ordinary admin APIs',async()=>{
    const env=CONFIG.NODE_ENV;CONFIG.NODE_ENV='production';try{
      const post=(path:string,body:any)=>request(app).post('/api/v1/competition'+path).set('Authorization','Bearer '+token).send(body);
      const payload={title:'Fictional visit',reportIds:['mvp-demo-water-2']};expect((await post('/demo/missions',payload)).status).toBe(201);
      expect((await post('/demo/missions',{...payload,reportIds:['rep-001']})).status).toBe(403);
      expect((await post('/admin/missions',payload)).status).toBe(403);
      expect((await request(app).post('/api/v1/competition/demo/missions').send(payload)).status).toBe(401);
      expect((await request(app).patch('/api/v1/admin/reports/rep-001/priority').set('Authorization','Bearer '+token).send({priorityLevel:'HIGH',reason:'Still protected production route'})).status).toBe(403);
      const cluster=rootClusters({source:'demo_seed'}).find(c=>c.reportIds.includes('mvp-demo-water-2'));
      const review=await post('/demo/clusters/'+cluster.id+'/review',{state:'FIELD_VERIFIED',evidence:'DEMO simulated inspection evidence, not an actual field conclusion.',revision:cluster.review.revision});expect(review.status).toBe(200);expect(db.clusterReviews.get(cluster.id)?.sourceType).toBe('demo_seed');
      const legacy=rootClusters({source:'demo_seed'}).find(c=>c.reportIds.includes('rep-001'));if(legacy)expect((await post('/demo/clusters/'+legacy.id+'/review',{state:'UNSUPPORTED',evidence:'Cannot change unrelated legacy samples via scoped demo endpoint',revision:0})).status).toBe(403);
    }finally{CONFIG.NODE_ENV=env;}
  });
  test('empty selection has usable no-data responses; mission validation rejects unknown reports and missing findings',async()=>{
    for(const [id,r] of db.reports)if(r.sourceType==='citizen_report')db.reports.delete(id);
    expect(rootClusters({source:'citizen_report'})).toEqual([]);expect(twin({source:'citizen_report'}).records).toEqual([]);
    expect(coverage({source:'citizen_report'}).rows.every(r=>r.score===null)).toBe(true);
    expect((await request(app).get('/api/v1/competition/overview?source=citizen_report')).status).toBe(200);
    const update=MissionUpdate.parse({revision:db.fieldMissions.get('mission-demo-preloaded')!.revision,status:'COMPLETED',note:'Completed inspection note'});expect(()=>updateMission('mission-demo-preloaded',update,'user-admin-01',true)).toThrow('findings');
    expect(()=>saveMission(MissionInput.parse({title:'Unknown case',reportIds:['missing']}),'user-admin-01')).toThrow('not found');
  });
  test('unavailable repository analytics returns an error rather than invented demo results',async()=>{
    const spy=jest.spyOn(analyticsModule,'analytics').mockImplementation(()=>{throw new Error('Repository unavailable');});
    try{const result=await request(app).get('/api/v1/competition/overview?source=demo_seed');expect(result.status).toBe(500);expect(result.body.success).toBe(false);expect(result.body.data).toBeUndefined();}finally{spy.mockRestore();}
  });
});
