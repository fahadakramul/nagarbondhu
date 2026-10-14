import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { civicLimit } from '../middleware/civicLimit';
import { getReport } from '../services/action.service';
import { nearbySensitive, emptyNearby } from '../services/nearby.service';
import { PriorityService } from '../services/priority.service';
const router=Router();
router.get('/reports/:id/nearby',(req,res,next)=>{try{const r=getReport(req.params.id);res.json({success:true,data:r.nearbySensitive||emptyNearby(true)});}catch(e){next(e);}});
router.post('/admin/backfill-nearby',authenticate,requireRole(['ADMIN','URBAN_PLANNER']),civicLimit,async(req,res,next)=>{
  try{
    const q=z.object({source:z.enum(['all','demo_seed','citizen_report']).default('demo_seed'),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(5).default(3)}).strict().parse(req.body);
    const rows=Array.from(db.reports.values()).filter(r=>q.source==='all'||r.sourceType===q.source).sort((a,b)=>a.id.localeCompare(b.id));
    const batch=rows.slice(q.offset,q.offset+q.limit),results=[];
    for(const r of batch){if(results.length)await new Promise(resolve=>setTimeout(resolve,2000));const data=await nearbySensitive(r.latitude,r.longitude,8000);db.updateReport(r.id,{nearbySensitive:data});PriorityService.assessReportPriority(r.id);results.push({id:r.id,bonus:data.bonus,unavailable:data.unavailable});}
    res.json({success:true,data:{results,nextOffset:q.offset+batch.length,total:rows.length,done:q.offset+batch.length>=rows.length}});
  }catch(e){next(e);}
});
export default router;
