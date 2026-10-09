import { z } from 'zod';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { PriorityService } from './priority.service';
import { ActionPlan, ActionStatus, ACTION_STATUSES, Report, calculateHaversineDistanceMeters } from '@nagarbondhu/shared';

export const urgencySchema = z.enum(['ROUTINE','SOON','URGENT','IMMEDIATE']);
export const prioritySchema = z.enum(['LOW','MEDIUM','HIGH','CRITICAL']);
export const photoSchema = z.string().max(2000).refine(value => /^https?:\/\//i.test(value) || /^\/uploads\/[\w.-]+$/.test(value), 'Use an HTTP image URL or uploaded photo path');
export const PlanSchema = z.object({
  recommendationId: z.string().nullable().optional(), actionDescription: z.string().trim().min(10).max(4000),
  wardId: z.string().min(1), wardVerified: z.literal(true), wardVerificationNote: z.string().trim().min(10).max(1000),
  locationOverrideReason: z.string().trim().min(10).max(1000).nullable().optional(),
  departmentId: z.string().min(1), officerId: z.string().nullable().optional(), assignmentNote: z.string().trim().min(3).max(2000),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), priority: prioritySchema, urgency: urgencySchema,
  adminNotes: z.string().max(4000).default(''), revision: z.number().int().min(0),
  beforePhotoUrl: photoSchema.nullable().optional(),
}).strict();
export const TransitionSchema = z.object({
  status: z.enum(ACTION_STATUSES), note: z.string().trim().min(3).max(4000), revision: z.number().int().min(0),
  resolutionNotes: z.string().trim().min(10).max(4000).optional(),
  verificationMethod: z.string().trim().min(10).max(1000).optional(), afterPhotoUrl: photoSchema.nullable().optional(),
}).strict();
export const TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW','AWAITING_FIELD_VERIFICATION','REJECTED'],
  UNDER_REVIEW: ['AWAITING_FIELD_VERIFICATION','READY_FOR_ASSIGNMENT','ASSIGNED','REJECTED'],
  AWAITING_FIELD_VERIFICATION: ['UNDER_REVIEW','READY_FOR_ASSIGNMENT','ASSIGNED','REJECTED'],
  READY_FOR_ASSIGNMENT: ['AWAITING_FIELD_VERIFICATION','ASSIGNED','REJECTED'],
  ASSIGNED: ['IN_PROGRESS','ON_HOLD','AWAITING_FIELD_VERIFICATION','REJECTED'],
  IN_PROGRESS: ['ON_HOLD','RESOLVED','AWAITING_FIELD_VERIFICATION'],
  ON_HOLD: ['IN_PROGRESS','AWAITING_FIELD_VERIFICATION','REJECTED'],
  RESOLVED: ['CLOSED','IN_PROGRESS','UNDER_REVIEW'], CLOSED: ['UNDER_REVIEW'], REJECTED: ['UNDER_REVIEW'],
};
export const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
export function getReport(id: string) { return db.findReportById(id) || fail('Report not found', 404); }
export function getPlan(reportId: string) { return Array.from(db.actionPlans.values()).find(p => p.reportId === reportId) || null; }
export function workflowStatus(report: Report): ActionStatus { return getPlan(report.id)?.status || report.actionStatus || (report.status === 'AI_ANALYZED' ? 'UNDER_REVIEW' : report.status); }
export function event(reportId: string, actorId: string, type: string, note: string, details: Record<string, unknown> = {}) {
  const entry = { id: randomUUID(), reportId, planId: getPlan(reportId)?.id || null, actorId, type, note, details, createdAt: new Date().toISOString() };
  db.actionEvents.set(entry.id, entry); return entry;
}
function checkRevision(plan: ActionPlan | null, revision: number) {
  if ((plan?.revision || 0) !== revision) fail('This plan changed. Reload before saving.', 409);
}
export function confirmPlan(reportId: string, body: unknown, actorId: string) {
  const input = PlanSchema.parse(body), report = getReport(reportId), existing = getPlan(reportId);
  checkRevision(existing, input.revision);
  if (['RESOLVED','CLOSED','REJECTED'].includes(workflowStatus(report))) fail('Reopen the report before changing its assignment.');
  const ward = db.findWardById(input.wardId) || fail('Unknown ward; admin verification is required.');
  const distance = calculateHaversineDistanceMeters(report.latitude, report.longitude, ward.centerLatitude, ward.centerLongitude);
  if (distance > 5000 && !input.locationOverrideReason) fail('Selected ward centre is more than 5 km away. A documented location override is required; boundaries are not available.');
  const department = db.departments.get(input.departmentId);
  if (!department?.active) fail('Unknown or inactive department');
  const officer = input.officerId ? db.officers.get(input.officerId) : null;
  if (input.officerId && (!officer?.active || officer.departmentId !== input.departmentId || (officer.wardId && officer.wardId !== input.wardId))) fail('Officer is inactive or does not match the selected ward and department.');
  const recommendation = input.recommendationId ? db.recommendations.get(input.recommendationId) : null;
  if (input.recommendationId && recommendation?.reportId !== reportId) fail('Recommendation does not belong to this report.');
  const due = new Date(`${input.targetDate}T23:59:59.999+06:00`);
  if (!Number.isFinite(due.getTime()) || due.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }) !== input.targetDate) fail('Invalid target date');
  if (due.getTime() < Date.now() && input.targetDate !== existing?.targetDate.slice(0,10)) fail('A newly confirmed target date cannot be in the past.');
  const now = new Date().toISOString();
  const plan: ActionPlan = {
    ...(existing || { id: randomUUID(), reportId, status: 'ASSIGNED', createdAt: now, createdBy: actorId, resolutionNotes: null, verificationMethod: null, verificationStatus: 'PENDING', verificationNote: null, verifiedAt: null, verifiedBy: null, beforePhotoUrl: report.imageUrl || null, afterPhotoUrl: null }),
    actionDescription: input.actionDescription, recommendationId: input.recommendationId || null,
    wardId: input.wardId, wardVerificationNote: input.wardVerificationNote, locationOverrideReason: input.locationOverrideReason || null,
    officerId: input.officerId || null, departmentId: input.departmentId, assignmentNote: input.assignmentNote,
    targetDate: due.toISOString(), priority: input.priority, urgency: input.urgency, adminNotes: input.adminNotes,
    beforePhotoUrl: input.beforePhotoUrl === undefined ? (existing?.beforePhotoUrl || report.imageUrl || null) : input.beforePhotoUrl,
    revision: (existing?.revision || 0) + 1, updatedAt: now, updatedBy: actorId,
  };
  if (!existing || ['SUBMITTED','UNDER_REVIEW','READY_FOR_ASSIGNMENT','AWAITING_FIELD_VERIFICATION'].includes(plan.status)) plan.status = 'ASSIGNED';
  db.actionPlans.set(plan.id, plan);
  db.updateReport(reportId, { actionStatus: plan.status });
  event(reportId, actorId, existing ? 'PLAN_UPDATED' : 'PLAN_CONFIRMED', input.assignmentNote, { previous: existing || null, confirmedPlan: plan, wardCentreDistanceMeters: Math.round(distance), boundaryVerifiedByAdmin: true });
  if (!existing || existing.wardId !== plan.wardId || existing.officerId !== plan.officerId || existing.departmentId !== plan.departmentId) event(reportId, actorId, 'ASSIGNMENT_RECORDED', input.assignmentNote, { wardId: plan.wardId, officerId: plan.officerId, departmentId: plan.departmentId });
  if (existing && existing.targetDate !== plan.targetDate) event(reportId, actorId, 'DUE_DATE_CHANGED', input.assignmentNote, { previousDate: existing.targetDate, targetDate: plan.targetDate });
  return plan;
}
export function transition(reportId: string, body: unknown, actorId: string) {
  const input = TransitionSchema.parse(body), report = getReport(reportId), plan = getPlan(reportId), current = workflowStatus(report);
  checkRevision(plan, input.revision);
  if (!TRANSITIONS[current].includes(input.status)) fail(`Invalid transition: ${current} → ${input.status}`, 409);
  if (['ASSIGNED','IN_PROGRESS','ON_HOLD','RESOLVED','CLOSED'].includes(input.status) && !plan) fail('Confirm an action plan and assignment first.');
  if (input.status === 'ASSIGNED' && plan) fail('Use action-plan confirmation to record an assignment.');
  if (input.status === 'RESOLVED' && (!input.resolutionNotes || (!input.afterPhotoUrl && !input.verificationMethod))) fail('Resolution needs a note and an after photo or documented alternative verification method.');
  if (input.status === 'CLOSED' && plan?.verificationStatus !== 'VERIFIED') fail('Verify the resolution before closing the report.');
  const now = new Date().toISOString();
  if (plan) {
    const updated: ActionPlan = { ...plan, status: input.status, revision: plan.revision + 1, updatedAt: now, updatedBy: actorId };
    if (input.status === 'RESOLVED') Object.assign(updated, { resolutionNotes: input.resolutionNotes, verificationMethod: input.verificationMethod || 'সমাধান-পরবর্তী ছবির পর্যালোচনা প্রয়োজন', afterPhotoUrl: input.afterPhotoUrl || null, verificationStatus: 'PENDING', verificationNote: null, verifiedAt: null, verifiedBy: null });
    if (current === 'RESOLVED' && input.status === 'IN_PROGRESS') Object.assign(updated, { verificationStatus: 'PENDING', verifiedAt: null, verifiedBy: null });
    if (input.status === 'UNDER_REVIEW') Object.assign(updated, { verificationStatus: 'PENDING', verifiedAt: null, verifiedBy: null });
    db.actionPlans.set(plan.id, updated);
  }
  const status = ['SUBMITTED','IN_PROGRESS','RESOLVED','REJECTED'].includes(input.status) ? input.status as Report['status'] : input.status === 'CLOSED' ? 'RESOLVED' : 'UNDER_REVIEW';
  db.updateReport(reportId, { actionStatus: input.status, status, resolvedAt: input.status === 'RESOLVED' || input.status === 'CLOSED' ? (report.resolvedAt || now) : null });
  if(report.sourceType==='citizen_report') PriorityService.assessReportPriority(reportId);
  db.addStatusHistory({ id: randomUUID(), reportId, previousStatus: report.status, newStatus: status, changedBy: actorId, note: `${current} → ${input.status}: ${input.note}`, createdAt: now });
  event(reportId, actorId, input.status === 'RESOLVED' ? 'RESOLUTION_SUBMITTED' : 'STATUS_CHANGED', input.note, { previousStatus: current, status: input.status });
  return getPlan(reportId);
}
export function verifyResolution(reportId: string, body: unknown, actorId: string) {
  const input = z.object({ verified: z.boolean(), note: z.string().trim().min(10).max(2000), revision: z.number().int().min(1) }).strict().parse(body);
  getReport(reportId);
  const plan = getPlan(reportId) || fail('Action plan not found',404);
  checkRevision(plan,input.revision);
  if (plan.status !== 'RESOLVED') fail('Only submitted resolutions can be verified.');
  const updated: ActionPlan = { ...plan, revision: plan.revision + 1, verificationStatus: input.verified ? 'VERIFIED' : 'REJECTED', verificationNote: input.note, verifiedBy: actorId, verifiedAt: new Date().toISOString(), updatedBy: actorId, updatedAt: new Date().toISOString() };
  db.actionPlans.set(plan.id, updated);
  event(reportId, actorId, input.verified ? 'RESOLUTION_VERIFIED' : 'RESOLUTION_VERIFICATION_REJECTED',input.note);
  return updated;
}
export function isOverdue(plan: ActionPlan | null, now = Date.now()) { return !!plan && !['RESOLVED','CLOSED','REJECTED'].includes(plan.status) && Date.parse(plan.targetDate) < now; }
export function actionDashboard(filters: Record<string, string | undefined>, now = Date.now()) {
  const rows = Array.from(db.reports.values()).map(r => {
    const report = db.findReportById(r.id)!, plan = getPlan(r.id);
    const recommendations = Array.from(db.recommendations.values()).filter(rec => rec.reportId === r.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    return { reportId: r.id, title: r.title, category: r.category, sourceType: r.sourceType, location: r.addressLabel,
      wardId: plan?.wardId || r.wardId || null, wardName: db.findWardById(plan?.wardId || r.wardId || '')?.wardName || null,
      priority: plan?.priority || report.priorityAssessment?.priorityLevel || 'UNKNOWN', status: workflowStatus(report),
      departmentId: plan?.departmentId || null, departmentName: db.departments.get(plan?.departmentId || '')?.displayName || null,
      officerId: plan?.officerId || null, officerName: db.officers.get(plan?.officerId || '')?.displayName || null,
      recommendedAction: recommendations[0]?.data.nextAction || null, confirmedAction: plan?.actionDescription || null,
      createdAt:r.createdAt, updatedAt:plan?.updatedAt || r.updatedAt, latestUpdate:Array.from(db.progressUpdates.values()).filter(p=>p.planId===plan?.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]?.note || null,
      targetDate: plan?.targetDate || null, overdue: isOverdue(plan,now), verificationStatus: plan?.verificationStatus || null,
    };
  }).filter(row => Object.entries(filters).every(([key,value]) => !value || ['limit','offset'].includes(key) || (key==='source'?value==='all'||row.sourceType===value:key==='from'?Date.parse(row.createdAt)>=Date.parse(value+'T00:00:00+06:00'):key==='to'?Date.parse(row.createdAt)<=Date.parse(value+'T23:59:59.999+06:00'):key === 'overdue' ? row.overdue === (value === 'true') : (row as any)[key] === value)));
  const count = (fn: (row: typeof rows[number]) => boolean) => rows.filter(fn).length;
  return { summary: {
    totalReports: rows.length, closed: count(r=>r.status==='CLOSED'), unassigned: count(r => !r.departmentId && !['RESOLVED','CLOSED','REJECTED'].includes(r.status)),
    awaitingVerification: count(r => r.status === 'AWAITING_FIELD_VERIFICATION'), assigned: count(r => r.status === 'ASSIGNED'),
    inProgress: count(r => r.status === 'IN_PROGRESS'), overdue: count(r => r.overdue),
    resolvedAwaitingVerification: count(r => r.status === 'RESOLVED' && r.verificationStatus !== 'VERIFIED'),
    highPriorityUnresolved: count(r => ['HIGH','CRITICAL'].includes(r.priority) && !['RESOLVED','CLOSED','REJECTED'].includes(r.status)),
  }, total:rows.length, rows:rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(Number(filters.offset||0),Number(filters.offset||0)+Number(filters.limit||50)) };
}
