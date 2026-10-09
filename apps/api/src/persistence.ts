import { PrismaClient } from '@prisma/client';
import { RequestHandler } from 'express';
import { CONFIG } from './config';
import { db } from './db';

type Snapshot = Record<string, any[]>;
let client: PrismaClient | null = null;
let committed: Snapshot | null = null;
let writeQueue = Promise.resolve();
export const persistenceState = { provider: CONFIG.DATABASE_PROVIDER, ready: CONFIG.DATABASE_PROVIDER === 'memory' };
const fields = (row: any, names: string[]) => Object.fromEntries(names.map(name => [name, row[name] ?? null]));
const tableMap: Record<string, string> = {
  users: 'user', wards: 'ward', reports: 'report', aiAnalyses: 'aiAnalysis',
  priorityAssessments: 'priorityAssessment', possibleDuplicates: 'possibleDuplicate', statusHistories: 'reportStatusHistory',
  departments: 'department', officers: 'responsiblePerson', recommendations: 'actionRecommendation',
  actionPlans: 'actionPlan', progressUpdates: 'actionProgress', actionEvents: 'actionAuditEvent',
  submissionReceipts: 'submissionReceipt', feedback: 'citizenFeedback', notices: 'reportNotice',
  clusterReviews: 'clusterReview', fieldMissions: 'fieldMission',
};
function rowData(name: string, row: any) {
  if (name === 'reports') return fields(row, ['id','reporterId','title','description','category','userCategory','latitude','longitude','addressLabel','wardId','imageUrl','status','actionStatus','sourceType','createdAt','updatedAt','resolvedAt']);
  if (name === 'aiAnalyses') return { ...fields(row, ['id','reportId','provider','modelName','summary','severity','confidence','reasons','createdAt']), suggestedCategory: row.suggestedCategory || row.category, missingInformation: row.missing_information || [] };
  if (name === 'possibleDuplicates') return fields(row, ['id','reportId','candidateReportId','similarityScore','matchingReasons','reviewStatus','reviewedBy','reviewedAt','createdAt']);
  if (name === 'statusHistories') return { ...row, changedBy: db.users.has(row.changedBy) ? row.changedBy : null, changedByLabel: row.changedBy };
  return row;
}

export async function flushDatabase() {
  if (!client) return;
  const snapshot = db.snapshot();
  await client.$transaction(async tx => {
    // Parent records precede child records; existing report/ward/user entities are reused.
    for (const name of Object.keys(tableMap)) {
      const old = new Map((committed?.[name] || []).map(row => [row.id, JSON.stringify(row)]));
      for (const row of snapshot[name]) {
        if (old.get(row.id) === JSON.stringify(row)) continue;
        const data = rowData(name, row);
        await (tx as any)[tableMap[name]].upsert({ where: { id: row.id }, create: data, update: data });
      }
    }
  }, { maxWait: 10000, timeout: 30000 });
  committed = snapshot;
}

export async function initializeDatabase() {
  if (CONFIG.DATABASE_PROVIDER === 'memory') return;
  if (CONFIG.DATABASE_PROVIDER !== 'postgres') throw new Error('Unsupported DATABASE_PROVIDER');
  client = new PrismaClient({ datasources: { db: { url: CONFIG.DATABASE_URL } } });
  await client.$connect();
  const snapshot: Snapshot = {};
  for (const [name, table] of Object.entries(tableMap)) {
    snapshot[name] = JSON.parse(JSON.stringify(await (client as any)[table].findMany()));
  }
  if (snapshot.users.length || snapshot.reports.length) {
    snapshot.aiAnalyses = snapshot.aiAnalyses.map(row => ({ ...row, category: row.suggestedCategory, missing_information: row.missingInformation || [] })).map(({ missingInformation, ...row }) => row);
    snapshot.statusHistories = snapshot.statusHistories.map(({ changedByLabel, ...row }) => ({ ...row, changedBy: changedByLabel || row.changedBy || 'সিস্টেম' }));
    db.restore(snapshot);
    committed = db.snapshot();
  } else {
    await flushDatabase();
  }
  persistenceState.ready = true;
}

export async function disconnectDatabase() { await client?.$disconnect(); }
export async function storeImage(id: string, mimeType: string, data: Buffer) {
  if (!client) return false;
  await client.uploadedImage.create({ data: { id, mimeType, data } });
  return true;
}
export async function readImage(id: string) { return client ? client.uploadedImage.findUnique({ where: { id } }) : null; }

// Serialize mutations and commit before success is returned. Failed validation or DB writes restore the cache.
// This cache preserves the existing synchronous repository API; deploy one API instance.
export const persistMutations: RequestHandler = (req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (['GET','HEAD','OPTIONS'].includes(req.method)) {
    writeQueue.then(async () => {
      // Do not present the cached counts as available while PostgreSQL is unreachable.
      if(client && req.method!=='OPTIONS') await client.$queryRaw`SELECT 1`;
      next();
    }).catch(() => next(Object.assign(new Error('Database unavailable — তথ্য এখন পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।'),{statusCode:503})));
    return;
  }
  const previous = writeQueue;
  let release!: () => void;
  writeQueue = new Promise<void>(resolve => { release = resolve; });
  previous.then(() => {
    const snapshot = db.snapshot();
    const json = res.json.bind(res);
    let done = false;
    let closed = false;
    res.once('close', () => { closed = true; });
    res.json = ((body: any) => {
      if (done) return res;
      done = true;
      (async () => {
        try {
          if (closed) { db.restore(snapshot); return; }
          if (res.statusCode < 400) await flushDatabase();
          else db.restore(snapshot);
          json(body);
        } catch (error) {
          db.restore(snapshot);
          console.error('[Persistence] Failed to commit request');
          res.status(503); json({ success: false, error: 'Database write failed; no changes saved. Retry.' });
        } finally { release(); }
      })();
      return res;
    }) as typeof res.json;
    next();
  }).catch(error => { release(); next(error); });
};
