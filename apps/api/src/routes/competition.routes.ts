import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { AnalyticsQuery } from './platform.routes';
import { coverage, CoverageWeights, twin, rootClusters, scenarios, ScenarioInput, MissionInput, MissionUpdate, saveMission, updateMission, reviewCluster, seedCompetitionDemo, MODE_LABEL } from '../services/competition.service';
import { publicText } from '../services/privacy';
import { fail, workflowStatus } from '../services/action.service';

const router=Router();
const TwinQuery=z.object({source:z.enum(['all','demo_seed','citizen_report']).optional(),wardId:z.string().max(100).optional(),category:z.enum(['ROAD_DAMAGE','WATERLOGGING','DRAINAGE','WASTE','FOOTPATH','STREETLIGHT','OTHER']).optional(),from:z.string().date().optional(),to:z.string().date().optional(),at:z.string().date().optional(),compareAt:z.string().date().optional()}).strict().refine(q=>!q.from || !q.to || q.from<=q.to,'Invalid date range');
const ReviewInput=z.object({state:z.enum(['UNDER_INVESTIGATION','FIELD_VERIFIED','UNSUPPORTED']),evidence:z.string().trim().min(20).max(3000),revision:z.number().int().min(0)}).strict();
router.get('/twin',(req,res,next)=>{try{const {at,compareAt,...filters}=TwinQuery.parse(req.query);res.json({success:true,data:twin(filters,at,compareAt)});}catch(e){next(e);}});
router.get('/overview',(req,res,next)=>{try{const filters=AnalyticsQuery.parse(req.query);res.json({success:true,data:{label:filters.source==='demo_seed'?MODE_LABEL:null,clusters:rootClusters(filters),coverage:coverage(filters),reports:twin(filters).records.map(({description,classification,priorityRationale,timeline,comparison,...r})=>r),missions:Array.from(db.fieldMissions.values()).filter(m=>m.sourceType==='demo_seed' && (!filters.source || filters.source==='all' || filters.source==='demo_seed')),wards:db.getAllWards(),demoLoaded:db.reports.has('mvp-demo-water-1')}});}catch(e){next(e);}});
// Read-only simulation: no state change or spending approval. No privileged operation.
router.post('/scenarios',(req,res,next)=>{try{res.json({success:true,data:scenarios(ScenarioInput.parse(req.body))});}catch(e){next(e);}});
router.post('/coverage',(req,res,next)=>{try{const input=z.object({filters:AnalyticsQuery,weights:CoverageWeights}).strict().parse(req.body);res.json({success:true,data:coverage(input.filters,input.weights)});}catch(e){next(e);}});
router.use(authenticate,requireRole(['ADMIN','URBAN_PLANNER']));
router.get('/directory',(req,res)=>res.json({success:true,data:{departments:Array.from(db.departments.values()).filter(d=>d.active),officers:Array.from(db.officers.values()).filter(o=>o.active).map(({contact,...o})=>o)}}));
router.get('/missions',(req,res)=>res.json({success:true,data:Array.from(db.fieldMissions.values()).filter(m=>req.user!.id!=='user-admin-01' || m.sourceType==='demo_seed').map(m=>({...m,stops:m.route.map(s=>{const r=db.reports.get(s.reportId);return {...s,title:publicText(r?.title || ''),category:r?.category,status:r?workflowStatus(r):'UNKNOWN',priority:db.findPriorityAssessmentByReportId(s.reportId)?.priorityLevel || 'UNKNOWN',address:publicText(r?.addressLabel || '')};})}))}));
router.post('/demo/restore',(req,res,next)=>{try{z.object({confirm:z.literal('RESTORE_FICTIONAL_DATA')}).strict().parse(req.body);res.json({success:true,data:seedCompetitionDemo()});}catch(e){next(e);}});
// Demo writes always restrict to canonical fictional reports; admin writes use the existing operator guard.
for(const scope of ['demo','admin'] as const){
  router.post('/'+scope+'/missions',(req,res,next)=>{try{res.status(201).json({success:true,data:saveMission(MissionInput.parse(req.body),req.user!.id,scope==='demo')});}catch(e){next(e);}});
  router.post('/'+scope+'/missions/:id/update',(req,res,next)=>{try{res.json({success:true,data:updateMission(req.params.id,MissionUpdate.parse(req.body),req.user!.id,scope==='demo')});}catch(e){next(e);}});
  router.post('/'+scope+'/clusters/:id/review',(req,res,next)=>{try{res.json({success:true,data:reviewCluster(req.params.id,ReviewInput.parse(req.body),req.user!.id,scope==='demo')});}catch(e){next(e);}});
}
export default router;
