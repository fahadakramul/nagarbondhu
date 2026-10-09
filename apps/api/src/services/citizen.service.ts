import { createHash, timingSafeEqual } from 'crypto';
import { Report, assessDuplicate } from '@nagarbondhu/shared';
import { db } from '../db';
import { getPlan, workflowStatus } from './action.service';
import { publicText } from './privacy';

export interface SubmissionReceipt { id:string; reportId:string; fingerprint:string; capabilityHash:string; locationConfirmed:boolean; locationSource:string; createdAt:string }
export interface CitizenFeedback { id:string; reportId:string; receiptId:string; verdict:string; comment:string; reviewStatus:string; reviewedBy:string|null; reviewNote:string|null; createdAt:string; updatedAt:string }
export interface ReportNotice { id:string; reportId:string; message:string; createdBy:string; createdAt:string }
export const hash = (value:string) => createHash('sha256').update(value).digest('hex');
export function receiptFor(reportId:string, capability:string) {
  const digest=hash(capability);
  return Array.from(db.submissionReceipts.values()).find(r=>r.reportId===reportId && timingSafeEqual(Buffer.from(r.capabilityHash),Buffer.from(digest)));
}
export function duplicateSuggestions(input: Pick<Report,'title'|'description'|'category'|'latitude'|'longitude'>) {
  return Array.from(db.reports.values()).filter(r=>!['CLOSED','REJECTED'].includes(workflowStatus(r)) && Date.parse(r.createdAt)>Date.now()-180*86400000).map(r=>({report:r,match:assessDuplicate(input,r,300)})).filter(r=>r.match.isPossibleDuplicate).sort((a,b)=>b.match.similarityScore-a.match.similarityScore).slice(0,8).map(({report:r,match})=>({id:r.id,title:publicText(r.title),status:workflowStatus(r),sourceType:r.sourceType,createdAt:r.createdAt,similarity:match.similarityScore,reasons:match.matchingReasons}));
}
export function publicTracking(reportId:string) {
  const report=db.findReportById(reportId);
  if(!report) return null;
  const plan=getPlan(reportId);
  const progress=Array.from(db.progressUpdates.values()).filter(p=>p.planId===plan?.id).map(p=>({note:publicText(p.note),photoUrl:p.photoUrl,createdAt:p.createdAt}));
  // Audit details, assignment notes, actor identities and internal admin notes are deliberately excluded.
  const timeline=Array.from(db.actionEvents.values()).filter(e=>e.reportId===reportId && ['PLAN_CONFIRMED','ASSIGNMENT_RECORDED','DUE_DATE_CHANGED','STATUS_CHANGED','RESOLUTION_SUBMITTED','RESOLUTION_VERIFIED','RESOLUTION_VERIFICATION_REJECTED','CITIZEN_FEEDBACK_REVIEWED','MISSION_CREATED','MISSION_UPDATED','CLUSTER_REVIEWED'].includes(e.type)).map(e=>({type:e.type,createdAt:e.createdAt,status:typeof e.details?.status==='string'?e.details.status:undefined,message:['REJECTED','ON_HOLD'].includes(String(e.details?.status))?publicText(e.note):undefined}));
  return {id:reportId,status:workflowStatus(report),sourceType:report.sourceType,createdAt:report.createdAt,updatedAt:report.updatedAt,
    assignment:plan?{department:db.departments.get(plan.departmentId)?.displayName,departmentVerification:db.departments.get(plan.departmentId)?.verificationStatus,officer:db.officers.get(plan.officerId || '')?.displayName,officerVerification:db.officers.get(plan.officerId || '')?.verificationStatus,targetDate:plan.targetDate,actionDescription:publicText(plan.actionDescription)}:null,
    resolution:plan?{note:publicText(plan.resolutionNotes || ''),verificationStatus:plan.verificationStatus,verifiedAt:plan.verifiedAt,beforePhotoUrl:plan.beforePhotoUrl,afterPhotoUrl:plan.afterPhotoUrl}:null,
    progress,timeline:[{type:'REPORT_RECEIVED',createdAt:report.createdAt},...timeline,...progress.map(p=>({type:'PROGRESS_UPDATED',createdAt:p.createdAt})),...Array.from(db.notices.values()).filter(n=>n.reportId===reportId).map(n=>({type:'INFORMATION_REQUESTED',message:publicText(n.message),createdAt:n.createdAt}))].sort((a,b)=>a.createdAt.localeCompare(b.createdAt))};
}
