// Opt-in PostgreSQL smoke check. Uses an isolated schema supplied in DATABASE_URL.
require('dotenv').config({path: process.env.PERSISTENCE_ENV_FILE || '.env.persistence-test'});
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
async function main() {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema','workflow_smoke_test');
  process.env.DATABASE_URL=url.toString();
  process.env.DATABASE_PROVIDER='postgres';
  process.env.GEMINI_API_KEY='';
  process.env.NODE_ENV='test';
  const prisma = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath,[prisma,'migrate','deploy'],{stdio:'pipe',env:process.env});
  const {initializeDatabase,disconnectDatabase,storeImage,readImage}=require('../dist/src/persistence');
  const {db}=require('../dist/src/db');
  const {confirmPlan,transition,getPlan}=require('../dist/src/services/action.service');
  const {generateActionRecommendation}=require('../dist/src/services/action-ai.service');
  await initializeDatabase();
  if (!getPlan('rep-001')) {
    const report=db.findReportById('rep-001');
    const recommendation=await generateActionRecommendation(report,'user-admin-01');
    db.recommendations.set(recommendation.id,recommendation);
    confirmPlan('rep-001',{recommendationId:recommendation.id,actionDescription:'Smoke test field inspection and repair review',wardId:report.wardId,wardVerified:true,wardVerificationNote:'Smoke test ward verification recorded',departmentId:'roads',assignmentNote:'Smoke test assignment',targetDate:new Date(Date.now()+86400000*3).toISOString().slice(0,10),priority:'HIGH',urgency:'URGENT',revision:0},'user-admin-01');
    transition('rep-001',{status:'IN_PROGRESS',note:'Smoke test progress begun',revision:1},'user-admin-01');
    await require('../dist/src/persistence').flushDatabase();
  }
  const original = JSON.stringify(getPlan('rep-001'));
  const photoId='workflow-smoke.png';
  if (!(await readImage(photoId))) await storeImage(photoId,'image/png',Buffer.from('89504e470d0a1a0a','hex'));
  await disconnectDatabase();
  db.actionPlans.clear(); db.recommendations.clear(); db.actionEvents.clear();
  await initializeDatabase();
  assert.equal(JSON.stringify(getPlan('rep-001')),original);
  assert.ok(db.recommendations.size); assert.ok(db.actionEvents.size);
  assert.equal((await readImage(photoId)).data.toString('hex'),'89504e470d0a1a0a');
  // Verify a failed SQL commit restores request-local changes before returning an error.
  const request=require('supertest'),{app}=require('../dist/src/app');
  const auth=await request(app).post('/api/v1/auth/login').send({email:'admin@nagarbondhu.gov.bd',password:'DemoAdmin123!'});
  assert.equal(auth.status,200);
  const citizen=await request(app).post('/api/v1/reports').send({title:'Postgres citizen tracking smoke',description:'Drain blockage persistence verification in isolated test schema.',category:'DRAINAGE',latitude:24.36,longitude:88.62,locationConfirmed:true,locationSource:'MAP_PIN',idempotencyKey:'2f93c6ee-90a7-4d19-bab8-227143f47bf2'});
  assert.ok([200,201].includes(citizen.status));
  const citizenId=citizen.body.report.id;
  db.updateReport(citizenId,{status:'RESOLVED',actionStatus:'RESOLVED'});
  await require('../dist/src/persistence').flushDatabase();
  const feedback=await request(app).post(`/api/v1/reports/${citizenId}/feedback`).send({trackingToken:citizen.body.trackingToken,verdict:'PERSISTS',comment:'Isolated persistence test feedback'});
  assert.equal(feedback.status,201);
  const notice=await request(app).post(`/api/v1/admin/reports/${citizenId}/request-information`).set('Authorization','Bearer '+auth.body.token).send({message:'Please verify the condition at the selected test location.'});
  assert.equal(notice.status,201);
  await disconnectDatabase();db.submissionReceipts.clear();db.feedback.clear();db.notices.clear();await initializeDatabase();
  assert.equal(db.submissionReceipts.get('2f93c6ee-90a7-4d19-bab8-227143f47bf2').reportId,citizenId);
  assert.equal(db.feedback.get(feedback.body.data.id).comment,'Isolated persistence test feedback');
  assert.ok(Array.from(db.notices.values()).some(n=>n.reportId===citizenId));
  // Final MVP: explicit fictional seed, mission/review writes, reconnect and safe restore in this isolated schema.
  const competition=require('../dist/src/services/competition.service');
  const realBefore=JSON.stringify(db.reports.get(citizenId));
  competition.seedCompetitionDemo();await require('../dist/src/persistence').flushDatabase();
  const preloaded=db.fieldMissions.get('mission-demo-preloaded');
  const updated=await request(app).post('/api/v1/competition/demo/missions/mission-demo-preloaded/update').set('Authorization','Bearer '+auth.body.token).send({revision:preloaded.revision,status:'IN_PROGRESS',note:'DEMO isolated SQL inspection update',findings:'DEMO field evidence persistence verification',followUp:'DEMO revisit for flow measurement',photoUrl:'/uploads/workflow-smoke.png'});
  assert.equal(updated.status,200);
  const cluster=competition.rootClusters({source:'demo_seed'}).find(c=>c.reportIds.includes('mvp-demo-water-2'));
  const review=await request(app).post(`/api/v1/competition/demo/clusters/${cluster.id}/review`).set('Authorization','Bearer '+auth.body.token).send({revision:cluster.review.revision,state:'UNSUPPORTED',evidence:'DEMO isolated test: observations do not yet support the proposed shared cause.'});
  assert.equal(review.status,200);
  const missionSnapshot=JSON.stringify(db.fieldMissions.get(preloaded.id));
  await disconnectDatabase();db.fieldMissions.clear();db.clusterReviews.clear();await initializeDatabase();
  assert.deepEqual(db.fieldMissions.get(preloaded.id),JSON.parse(missionSnapshot));assert.equal(db.clusterReviews.get(cluster.id).state,'UNSUPPORTED');
  assert.ok(Array.from(db.actionEvents.values()).some(e=>e.reportId==='mvp-demo-water-2' && e.type==='MISSION_UPDATED'));
  competition.seedCompetitionDemo();await require('../dist/src/persistence').flushDatabase();
  assert.equal(JSON.stringify(db.reports.get(citizenId)),realBefore);
  const baseline=db.snapshot();
  // A nonexistent actor deliberately violates the FK inside a real transaction.
  db.actionEvents.set('bad-event',{id:'bad-event',reportId:'rep-001',planId:getPlan('rep-001').id,actorId:'missing-user',type:'TEST',note:'rollback test',details:{},createdAt:new Date().toISOString()});
  await assert.rejects(require('../dist/src/persistence').flushDatabase());
  db.restore(baseline);
  await disconnectDatabase();
  console.log('PASS PostgreSQL additive migration, existing workflow, submission receipt, feedback, information notice, mission/review persistence, demo restore preserving real data, reconnect, photo storage and transactional FK rollback (isolated workflow_smoke_test schema).');
}
main().catch(error=>{console.error(String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[private database URL]').slice(0,2500));process.exit(1);});
