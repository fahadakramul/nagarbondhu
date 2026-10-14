import { db } from '../db';
import { workflowStatus, getPlan } from './action.service';
export function wardScorecard(source='citizen_report',category?:string){
  const terminal=['RESOLVED','CLOSED','REJECTED'];
  const rows=Array.from(db.reports.values()).filter(r=>(source==='all'||r.sourceType===source)&&(!category||r.category===category));
  return Array.from(db.wards.values()).sort((a,b)=>a.wardNumber-b.wardNumber).map(ward=>{
    const reports=rows.filter(r=>(getPlan(r.id)?.wardId||r.wardId)===ward.id),total=reports.length;
    const resolved=reports.filter(r=>['RESOLVED','CLOSED'].includes(workflowStatus(r)));
    const open=reports.filter(r=>!terminal.includes(workflowStatus(r)));
    const durations=resolved.filter(r=>r.resolvedAt&&Date.parse(r.resolvedAt)>=Date.parse(r.createdAt)).map(r=>(Date.parse(r.resolvedAt!)-Date.parse(r.createdAt))/86400000).sort((a,b)=>a-b);
    const medianDaysToResolve=durations.length?(durations[Math.floor(durations.length/2)]+durations[Math.floor((durations.length-1)/2)])/2:null;
    const overdueCount=open.filter(r=>Date.now()-Date.parse(r.createdAt)>7*86400000).length;
    const confirmed=resolved.filter(r=>r.citizenVerification?.reporterVerdict==='FIXED'||(!r.citizenVerification?.reporterVerdict&&(r.citizenVerification?.fixedVotes||0)>(r.citizenVerification?.notFixedVotes||0))).length;
    const resolutionRate=total?resolved.length/total:0,citizenConfirmedRate=resolved.length?confirmed/resolved.length:0,overdueShare=total?overdueCount/total:0;
    const breakdown={resolution:0.4*resolutionRate,timeliness:medianDaysToResolve===null?0:0.3*Math.max(0,1-medianDaysToResolve/30),overdue:total?0.2*(1-overdueShare):0,citizenConfirmation:0.1*citizenConfirmedRate};
    const index=Object.values(breakdown).reduce((sum,x)=>sum+x,0);
    const assessments=reports.map(r=>db.findPriorityAssessmentByReportId(r.id)).filter(p=>p!==null);
    return {wardId:ward.id,wardName:ward.wardName,wardNumber:ward.wardNumber,total,open:open.length,inProgress:reports.filter(r=>workflowStatus(r)==='IN_PROGRESS').length,resolved:resolved.length,resolutionRate,medianDaysToResolve,overdueCount,avgPriority:assessments.length?assessments.reduce((sum,p)=>sum+p!.score,0)/assessments.length:null,highPriorityOpen:open.filter(r=>['HIGH','CRITICAL'].includes(db.findPriorityAssessmentByReportId(r.id)?.priorityLevel||'')).length,citizenConfirmedRate,reopenedCount:reports.filter(r=>(r.reopenedCount||0)>0).length,grade:total<3?null:index>=0.8?'A':index>=0.65?'B':index>=0.5?'C':index>=0.35?'D':'E',label:total<3?'পর্যাপ্ত তথ্য নেই':'উপলব্ধ রিপোর্টের সূচক',index,breakdown,missingResolutionDates:resolved.length-durations.length,formula:'০.৪০ × সমাধানের হার + ০.৩০ × সর্বোচ্চ(০, ১ − মধ্যম সময়/৩০) + ০.২০ × (১ − ৭ দিন পেরোনো রিপোর্টের অংশ) + ০.১০ × নাগরিক-নিশ্চিত সমাধানের হার। সময়ের তথ্য না থাকলে সময়ের অংশ ০।'};
  });
}
