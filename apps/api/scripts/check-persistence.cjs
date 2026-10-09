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
  const baseline=db.snapshot();
  // A nonexistent actor deliberately violates the FK inside a real transaction.
  db.actionEvents.set('bad-event',{id:'bad-event',reportId:'rep-001',planId:getPlan('rep-001').id,actorId:'missing-user',type:'TEST',note:'rollback test',details:{},createdAt:new Date().toISOString()});
  await assert.rejects(require('../dist/src/persistence').flushDatabase());
  db.restore(baseline);
  await disconnectDatabase();
  console.log('PASS PostgreSQL migration, draft/assignment/audit persistence, reconnect, photo storage and transactional FK rollback (isolated workflow_smoke_test schema).');
}
main().catch(error=>{console.error(String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[private database URL]').slice(0,2500));process.exit(1);});
