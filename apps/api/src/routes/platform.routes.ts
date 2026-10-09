import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { publicTracking, receiptFor } from '../services/citizen.service';
import { analytics, csvExport } from '../services/analytics.service';
import { planningInterpretation } from '../services/planning-ai.service';
import { event, fail, getReport, getPlan, workflowStatus, transition } from '../services/action.service';

const router=Router();
export const AnalyticsQuery=z.object({wardId:z.string().max(100).optional(),category:z.enum(['ROAD_DAMAGE','WATERLOGGING','DRAINAGE','WASTE','FOOTPATH','STREETLIGHT','OTHER']).optional(),from:z.string().date().optional(),to:z.string().date().optional(),source:z.enum(['all','demo_seed','citizen_report']).optional()}).strict().refine(q=>!q.from || !q.to || q.from<=q.to,'Invalid date range');
router.get('/reports/:id/tracking',(req,res,next)=>{try{const data=publicTracking(req.params.id);if(!data)fail('Report not found',404);res.json({success:true,data});}catch(e){next(e);}});
router.post('/reports/:id/feedback',(req,res,next)=>{
  try {
    const input=z.object({trackingToken:z.string().length(64),verdict:z.enum(['APPEARS_RESOLVED','PERSISTS']),comment:z.string().trim().max(2000).default('')}).strict().parse(req.body);
    const receipt=receiptFor(req.params.id,input.trackingToken);if(!receipt)fail('The submission receipt for this report is required.',403);
    if(!['RESOLVED','CLOSED'].includes(workflowStatus(getReport(req.params.id))))fail('Feedback is available after resolution is submitted.');
    const existing=Array.from(db.feedback.values()).find(f=>f.reportId===req.params.id && f.receiptId===receipt!.id);
    const now=new Date().toISOString();const data={id:existing?.id || randomUUID(),reportId:req.params.id,receiptId:receipt!.id,verdict:input.verdict,comment:input.comment,reviewStatus:'PENDING',reviewedBy:null,reviewNote:null,createdAt:existing?.createdAt || now,updatedAt:now};
    db.feedback.set(data.id,data);res.status(201).json({success:true,data:{id:data.id,verdict:data.verdict,reviewStatus:data.reviewStatus}});
  }catch(e){next(e);}
});
router.get('/map/analytics',(req,res,next)=>{try{const data=analytics(AnalyticsQuery.parse(req.query));const {rows,reviewFirst,suggestedInterventions,...summary}=data;res.json({success:true,data:summary});}catch(e){next(e);}});
router.use('/admin',authenticate,requireRole(['ADMIN','URBAN_PLANNER']));
router.get('/admin/analytics',(req,res,next)=>{try{res.json({success:true,data:analytics(AnalyticsQuery.parse(req.query))});}catch(e){next(e);}});
router.get('/admin/planning-brief',async(req,res,next)=>{try{const data=analytics(AnalyticsQuery.parse(req.query));res.json({success:true,data:{...data,aiInterpretation:await planningInterpretation(data,'Planning brief')}});}catch(e){next(e);}});
router.get('/admin/export.csv',(req,res,next)=>{try{res.type('text/csv').set('Content-Disposition','attachment; filename="nagarbondhu-reports.csv"').send(csvExport(analytics(AnalyticsQuery.parse(req.query)).rows));}catch(e){next(e);}});
router.post('/admin/copilot',async(req,res,next)=>{
  try {
    const input=z.object({question:z.enum(['REVIEW_FIRST','OVERDUE_WARDS','MONTHLY_CATEGORIES','FIELD_VERIFICATION','RECURRING_LOCATIONS','WARD_ACTION_PLAN','UNRESOLVED_SUMMARY']),filters:AnalyticsQuery.default({source:'citizen_report'})}).strict().parse(req.body);
    const data=analytics(input.filters);const facts={REVIEW_FIRST:data.reviewFirst,OVERDUE_WARDS:data.overdueByWard,MONTHLY_CATEGORIES:{counts:data.months,changes:data.monthChanges},FIELD_VERIFICATION:data.fieldVerification,RECURRING_LOCATIONS:data.clusters,WARD_ACTION_PLAN:data.suggestedInterventions,UNRESOLVED_SUMMARY:{count:data.unresolved,reportIds:data.rows.filter(r=>!['RESOLVED','CLOSED','REJECTED'].includes(r.status)).map(r=>r.id)}};
    const aiInterpretation=await planningInterpretation(data,input.question);
    res.json({success:true,data:{question:input.question,period:data.period,total:data.total,demoCount:data.demoCount,facts:facts[input.question],interpretation:data.total?'এই তথ্য উপলব্ধ রিপোর্টের পর্যবেক্ষণ; সিদ্ধান্তের আগে মাঠপর্যায়ে যাচাই করুন।':'নির্বাচিত সীমার মধ্যে কোনো রিপোর্ট নেই।',interpretationProvider:aiInterpretation.provider,aiInterpretation,limitations:data.limitations}});
  }catch(e){next(e);}
});
router.get('/admin/feedback',(req,res,next)=>{try{if(process.env.NODE_ENV==='production' && req.user?.id==='user-admin-01')fail('Citizen feedback comments require a provisioned operator session.',403);res.json({success:true,data:Array.from(db.feedback.values()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100)});}catch(e){next(e);}});
router.post('/admin/feedback/:id/review',(req,res,next)=>{
  try {
    const input=z.object({decision:z.enum(['ACKNOWLEDGED','REOPEN']),note:z.string().trim().min(10).max(2000),revision:z.number().int().min(0)}).strict().parse(req.body);
    const existing=db.feedback.get(req.params.id);if(!existing)fail('Feedback not found',404);
    if(input.decision==='REOPEN')transition(existing!.reportId,{status:'UNDER_REVIEW',note:input.note,revision:input.revision},req.user!.id);
    const updated={...existing!,reviewStatus:input.decision,reviewNote:input.note,reviewedBy:req.user!.id,updatedAt:new Date().toISOString()};db.feedback.set(updated.id,updated);
    event(updated.reportId,req.user!.id,'CITIZEN_FEEDBACK_REVIEWED',input.note,{feedbackId:updated.id,decision:input.decision});res.json({success:true,data:updated});
  }catch(e){next(e);}
});
router.post('/admin/reports/:id/request-information',(req,res,next)=>{try{getReport(req.params.id);const {message}=z.object({message:z.string().trim().min(10).max(2000)}).strict().parse(req.body);const notice={id:randomUUID(),reportId:req.params.id,message,createdBy:req.user!.id,createdAt:new Date().toISOString()};db.notices.set(notice.id,notice);event(notice.reportId,req.user!.id,'INFORMATION_REQUESTED','Public information request recorded',{noticeId:notice.id});res.status(201).json({success:true,data:notice});}catch(e){next(e);}});
export default router;
