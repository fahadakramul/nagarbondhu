import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { generateActionRecommendation } from '../services/action-ai.service';
import { ACTION_STATUSES, ResponsiblePerson } from '@nagarbondhu/shared';
import { getReport, getPlan, workflowStatus, TRANSITIONS, event, fail, confirmPlan, transition, verifyResolution, actionDashboard, photoSchema, prioritySchema } from '../services/action.service';
import { persistenceState } from '../persistence';

const router = Router();
router.use(authenticate, requireRole(['ADMIN','URBAN_PLANNER']));
router.get('/action-directory', (req,res) => res.json({ success: true, data: {
  wards: db.getAllWards(), departments: Array.from(db.departments.values()), officers: Array.from(db.officers.values()),
  wardBoundaryAvailable: false, persistence: persistenceState,
} }));
const DirectorySchema = z.object({
  displayName: z.string().trim().min(3).max(200), active: z.boolean().default(true),
  source: z.string().trim().min(10).max(1000), verificationStatus: z.enum(['DEMO','UNVERIFIED','VERIFIED']).default('UNVERIFIED'),
}).strict();
router.post('/departments', (req,res,next) => {
  try { const entry = { ...DirectorySchema.parse(req.body), id: randomUUID() }; db.departments.set(entry.id,entry); res.status(201).json({success:true,data:entry}); } catch(e) { next(e); }
});
router.patch('/departments/:id', (req,res,next) => {
  try { if (!db.departments.has(req.params.id)) fail('Department not found',404); const entry={...DirectorySchema.parse(req.body),id:req.params.id}; db.departments.set(entry.id,entry); res.json({success:true,data:entry}); } catch(e) { next(e); }
});
const OfficerSchema = DirectorySchema.extend({
  title: z.string().trim().min(3).max(200), wardId: z.string().nullable().default(null), departmentId: z.string(), contact: z.string().max(300).nullable().default(null),
}).strict();
function officerInput(body: unknown) {
  const input = OfficerSchema.parse(body);
  if (input.wardId && !db.wards.has(input.wardId)) fail('Unknown ward');
  if (!db.departments.get(input.departmentId)?.active) fail('Unknown or inactive department');
  if (input.verificationStatus === 'DEMO' && input.contact) fail('Do not store contact details in sample records.');
  return input;
}
router.post('/officers', (req,res,next) => {
  try { const entry: ResponsiblePerson = {...officerInput(req.body),id:randomUUID()}; db.officers.set(entry.id,entry); res.status(201).json({success:true,data:entry}); } catch(e) { next(e); }
});
router.patch('/officers/:id', (req,res,next) => {
  try { if (!db.officers.has(req.params.id)) fail('Officer not found',404); const entry: ResponsiblePerson={...officerInput(req.body),id:req.params.id}; db.officers.set(entry.id,entry); res.json({success:true,data:entry}); } catch(e) { next(e); }
});
router.get('/actions/dashboard', (req,res,next) => {
  try {
    const filters = z.object({ wardId:z.string().optional(),category:z.enum(['ROAD_DAMAGE','WATERLOGGING','DRAINAGE','WASTE','FOOTPATH','STREETLIGHT','OTHER']).optional(),priority:prioritySchema.optional(),status:z.enum(ACTION_STATUSES).optional(),departmentId:z.string().optional(),officerId:z.string().optional(),overdue:z.enum(['true','false']).optional() }).strict().parse(req.query);
    res.json({success:true,data:actionDashboard(filters),persistence:persistenceState});
  } catch(e) { next(e); }
});
router.get('/reports/:id/actions', (req,res,next) => {
  try {
    const report=getReport(req.params.id), plan=getPlan(report.id);
    res.json({success:true,data:{ plan,status:workflowStatus(report),allowedTransitions:TRANSITIONS[workflowStatus(report)],
      recommendations:Array.from(db.recommendations.values()).filter(r=>r.reportId===report.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),
      progress:Array.from(db.progressUpdates.values()).filter(p=>p.planId===plan?.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),
      history:Array.from(db.actionEvents.values()).filter(e=>e.reportId===report.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),
      reportHistory:report.statusHistory, persistence:persistenceState,
    }});
  } catch(e) { next(e); }
});
router.post('/reports/:id/action-recommendations', async(req,res,next) => {
  try {
    z.object({}).strict().parse(req.body);
    const report=getReport(req.params.id), recommendation=await generateActionRecommendation(report,req.user!.id);
    db.recommendations.set(recommendation.id,recommendation);
    event(report.id,req.user!.id,'AI_DRAFT_GENERATED','পর্যালোচনার জন্য করণীয় খসড়া তৈরি হয়েছে।',{recommendationId:recommendation.id,provider:recommendation.provider,isFallback:recommendation.isFallback});
    res.status(201).json({success:true,data:recommendation});
  } catch(e) { next(e); }
});
router.put('/reports/:id/action-plan',(req,res,next)=> {
  try { res.json({success:true,data:confirmPlan(req.params.id,req.body,req.user!.id)}); } catch(e) { next(e); }
});
router.patch('/reports/:id/action-status',(req,res,next)=> {
  try { const plan=transition(req.params.id,req.body,req.user!.id); res.json({success:true,data:plan,status:workflowStatus(getReport(req.params.id))}); } catch(e) { next(e); }
});
router.post('/reports/:id/progress',(req,res,next)=> {
  try {
    const input=z.object({note:z.string().trim().min(5).max(4000),photoUrl:photoSchema.nullable().default(null),revision:z.number().int().min(1)}).strict().parse(req.body);
    getReport(req.params.id); const plan=getPlan(req.params.id)||fail('Action plan not found',404);
    if (plan.revision!==input.revision) fail('This plan changed. Reload before saving.',409);
    if (!['ASSIGNED','IN_PROGRESS','ON_HOLD','AWAITING_FIELD_VERIFICATION'].includes(plan.status)) fail('Progress cannot be recorded for a completed or unassigned plan.');
    const progress={id:randomUUID(),planId:plan.id,note:input.note,photoUrl:input.photoUrl,createdBy:req.user!.id,createdAt:new Date().toISOString()};
    db.progressUpdates.set(progress.id,progress); db.actionPlans.set(plan.id,{...plan,revision:plan.revision+1,updatedBy:req.user!.id,updatedAt:progress.createdAt});
    event(req.params.id,req.user!.id,'PROGRESS_RECORDED',input.note,{progressId:progress.id}); res.status(201).json({success:true,data:progress});
  } catch(e) { next(e); }
});
router.post('/reports/:id/resolution-verification',(req,res,next)=> {
  try { res.json({success:true,data:verifyResolution(req.params.id,req.body,req.user!.id)}); } catch(e) { next(e); }
});
export default router;
