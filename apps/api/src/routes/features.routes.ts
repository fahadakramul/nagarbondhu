import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authenticate, requireRole, optionalAuthenticate } from '../middleware/auth';
import { civicLimit, deviceHash } from '../middleware/civicLimit';
import { getReport, getPlan, workflowStatus, transition, fail, photoSchema } from '../services/action.service';
import { receiptFor } from '../services/citizen.service';
import { randomUUID } from 'crypto';
import { wardScorecard } from '../services/scorecard.service';
import { checkPhoto, parseMedia, uploadedPhoto, transcribeAudio } from '../services/media-ai.service';
import { rainQueue } from '../services/rain.service';
import { nearbySensitive, emptyNearby } from '../services/nearby.service';
import { PriorityService } from '../services/priority.service';
const router=Router();
router.get('/admin/reports/:id/citizen-verification',authenticate,requireRole(['ADMIN','URBAN_PLANNER']),(req,res,next)=>{try{const report=getReport(req.params.id);res.json({success:true,data:report.citizenVerification?{...report.citizenVerification,items:report.citizenVerification.items.map(({voterHash,...item})=>item)}:null});}catch(e){next(e);}});
let lastBackfillAt=0;
router.get('/rain-queue',async(req,res,next)=>{try{const q=z.object({source:z.enum(['all','demo_seed','citizen_report']).default('citizen_report')}).strict().parse(req.query);res.json({success:true,data:await rainQueue(q.source)});}catch(e){next(e);}});
router.post('/ai/transcribe',civicLimit,async(req,res,next)=>{try{const q=z.object({deviceId:z.string().uuid(),audioBase64:z.string().max(7000000)}).strict().parse(req.body);res.json({success:true,data:await transcribeAudio(parseMedia(q.audioBase64,'audio')),provider:'Google Gemini'});}catch(e){next(e);}});
router.get('/nearby',civicLimit,async(req,res,next)=>{try{const q=z.object({latitude:z.coerce.number().min(20).max(28),longitude:z.coerce.number().min(85).max(95)}).strict().parse(req.query);res.json({success:true,data:await nearbySensitive(q.latitude,q.longitude)});}catch(e){next(e);}});
router.post('/ai/check-photo',civicLimit,async(req,res,next)=>{try{const q=z.object({deviceId:z.string().uuid(),description:z.string().trim().min(5).max(6000),imageBase64:z.string().max(5600000).optional(),imageUrl:z.string().max(2000).optional()}).strict().refine(q=>!!q.imageBase64!==!!q.imageUrl,'একটি ছবি দিন।').parse(req.body);const media=q.imageBase64?parseMedia(q.imageBase64,'image'):await uploadedPhoto(q.imageUrl!);res.json({success:true,data:await checkPhoto(q.description,media),provider:'Google Gemini'});}catch(e){next(e);}});
router.get('/wards/scorecard',(req,res,next)=>{try{const q=z.object({source:z.enum(['all','demo_seed','citizen_report']).default('citizen_report'),category:z.enum(['ROAD_DAMAGE','WATERLOGGING','DRAINAGE','WASTE','FOOTPATH','STREETLIGHT','OTHER']).optional()}).strict().parse(req.query);res.json({success:true,data:wardScorecard(q.source,q.category),source:q.source,unknownWardCount:db.activeReports().filter(r=>!r.wardId&&!getPlan(r.id)?.wardId&&(q.source==='all'||r.sourceType===q.source)&&(!q.category||r.category===q.category)).length});}catch(e){next(e);}});
router.post('/reports/:id/affirm',civicLimit,optionalAuthenticate,(req,res,next)=>{
  try{
    const input=z.object({deviceId:z.string().uuid(),receiptToken:z.string().length(64).optional()}).strict().parse(req.body),report=getReport(req.params.id),voter=deviceHash(input.deviceId);
    if((req.user && report.reporterId===req.user.id)||Array.from(db.submissionReceipts.values()).some(r=>r.reportId===report.id&&r.deviceHash===voter)||(input.receiptToken&&receiptFor(report.id,input.receiptToken)))fail('নিজের রিপোর্টে সমর্থন দিতে পারবেন না।');
    const hashes=report.affirmations?.deviceHashes||[];
    if(!hashes.includes(voter)){const ipDevice=deviceHash(input.deviceId+':'+req.ip);db.updateReport(report.id,{affirmations:{count:hashes.length+1,deviceHashes:[...hashes,voter],ipDeviceHashes:[...(report.affirmations?.ipDeviceHashes||[]),ipDevice]}});PriorityService.assessReportPriority(report.id);}
    res.json({success:true,data:{affirmCount:db.reports.get(report.id)!.affirmations?.count||0,affirmedByMe:true}});
  }catch(e){next(e);}
});
router.post('/reports/:id/citizen-verification',civicLimit,(req,res,next)=>{
  try{
    const input=z.object({deviceId:z.string().uuid().optional(),receiptToken:z.string().length(64).optional(),verdict:z.enum(['FIXED','NOT_FIXED']),note:z.string().trim().max(2000).default(''),photoUrl:photoSchema.nullable().optional()}).strict().refine(r=>!!r.deviceId||!!r.receiptToken,'রিপোর্টের রসিদ অথবা ডিভাইস পরিচয় প্রয়োজন।').parse(req.body);
    const report=getReport(req.params.id),status=workflowStatus(report);
    if(!['RESOLVED','AWAITING_FIELD_VERIFICATION'].includes(status))fail('সমাধান বা মাঠে যাচাইয়ের অপেক্ষায় থাকা রিপোর্টে যাচাই দিন।');
    const receipt=input.receiptToken?receiptFor(report.id,input.receiptToken):undefined;
    if(input.receiptToken&&!receipt)fail('এই রিপোর্টের বৈধ রসিদ প্রয়োজন।',403);
    const reporter=!!receipt,voter=receipt?deviceHash('receipt:'+receipt.id):deviceHash(input.deviceId!);
    if(!reporter&&!report.affirmations?.deviceHashes.includes(voter))fail('যাচাই দিতে আগে এই রিপোর্টে ভুক্তভোগী হিসেবে যুক্ত হোন।',403);
    const now=new Date().toISOString(),old=report.citizenVerification?.items||[];
    // A receipt and its submitting device represent the same reporter, never two votes.
    const items=old.filter(v=>v.voterHash!==voter && !(reporter&&v.reporter));
    items.push({voterHash:voter,reporter,verdict:input.verdict,note:input.note,photoUrl:input.photoUrl||null,at:now});
    const fixedVotes=items.filter(v=>v.verdict==='FIXED').length,notFixedVotes=items.length-fixedVotes,reporterVerdict=items.find(v=>v.reporter)?.verdict||null;
    const citizenVerification={fixedVotes,notFixedVotes,reporterVerdict,lastAt:now,items};
    db.updateReport(report.id,{citizenVerification});
    const reopen=reporterVerdict==='NOT_FIXED'||(notFixedVotes>=3&&notFixedVotes>fixedVotes);
    if(reopen){
      const actor='system-citizen-verification';
      if(!db.users.has(actor))db.users.set(actor,{id:actor,displayName:'নাগরিক যাচাই ব্যবস্থা',passwordHash:randomUUID(),role:'CITIZEN',createdAt:now,updatedAt:now});
      transition(report.id,{status:'UNDER_REVIEW',note:'নাগরিক জানিয়েছেন সমস্যা ঠিক হয়নি',revision:getPlan(report.id)?.revision||0},actor);
      db.updateReport(report.id,{reopenedCount:(report.reopenedCount||0)+1});
    }
    res.json({success:true,data:{fixedVotes,notFixedVotes,reporterVerdict,lastAt:now,reopened:reopen,status:workflowStatus(getReport(report.id))}});
  }catch(e){next(e);}
});
router.get('/reports/:id/nearby',(req,res,next)=>{try{const r=getReport(req.params.id);res.json({success:true,data:r.nearbySensitive||emptyNearby(true)});}catch(e){next(e);}});
router.post('/admin/backfill-nearby',authenticate,requireRole(['ADMIN','URBAN_PLANNER']),civicLimit,async(req,res,next)=>{
  try{
    const q=z.object({source:z.enum(['all','demo_seed','citizen_report']).default('demo_seed'),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(5).default(3)}).strict().parse(req.body);
    const rows=db.activeReports().filter(r=>q.source==='all'||r.sourceType===q.source).sort((a,b)=>a.id.localeCompare(b.id));
    const batch=rows.slice(q.offset,q.offset+q.limit),results=[];
    for(const r of batch){const delay=2000-(Date.now()-lastBackfillAt);if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));lastBackfillAt=Date.now();const data=await nearbySensitive(r.latitude,r.longitude,8000);db.updateReport(r.id,{nearbySensitive:data});PriorityService.assessReportPriority(r.id);results.push({id:r.id,bonus:data.bonus,unavailable:data.unavailable});}
    res.json({success:true,data:{results,nextOffset:q.offset+batch.length,total:rows.length,done:q.offset+batch.length>=rows.length}});
  }catch(e){next(e);}
});
export default router;
