import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import { calculateHaversineDistanceMeters, calculateTextSimilarity, Report, ACTION_STATUSES } from '@nagarbondhu/shared';
import { db } from '../db';
import { analytics, AnalyticsFilters, dhakaDay } from './analytics.service';
import { event, fail, workflowStatus } from './action.service';
import { publicText } from './privacy';

export const DEMO_LABEL = 'Demo Data — কাল্পনিক নমুনা তথ্য';
export const MODE_LABEL = 'Demo Mode — কাল্পনিক নমুনা তথ্য';
export const MissionStates = ['DRAFT','PLANNED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'] as const;
export interface ClusterReview {
  id:string; reportIds:string[]; state:string; evidence:string; sourceType:string;
  revision:number; updatedBy:string; createdAt:string; updatedAt:string;
}
export interface FieldMission {
  id:string; title:string; reportIds:string[]; departmentId:string|null; officerId:string|null; team:string;
  status:typeof MissionStates[number]; sourceType:string; route:any[]; updates:any[];
  revision:number; createdBy:string; createdAt:string; updatedAt:string;
}
const distance = (a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}) => calculateHaversineDistanceMeters(a.latitude,a.longitude,b.latitude,b.longitude);
const closed = (status:string) => ['RESOLVED','CLOSED','REJECTED'].includes(status);
const hash = (ids:string[]) => createHash('sha256').update(ids.slice().sort().join('|')).digest('hex').slice(0,24);
const categories = ['ROAD_DAMAGE','WATERLOGGING','DRAINAGE','WASTE','FOOTPATH','STREETLIGHT','OTHER'] as const;
const day = (value:string) => value+'T06:00:00.000Z';

// Fixed fictional cases, coordinates and costs. Never an official incident, cost or outcome feed.
export const demoCases = [
  {id:'mvp-demo-water-1',cat:'WATERLOGGING',ward:'ward-12',lat:24.3636,lng:88.6241,title:'নমুনা বাজার গলিতে বৃষ্টির পানি',description:'কাল্পনিক বাজার গলিতে বৃষ্টির পরে পানি জমে। ড্রেনের প্রবাহ মাঠে যাচাই প্রয়োজন।',start:'2026-08-12',priority:'HIGH',severity:4,cost:2400,steps:[['2026-08-13','UNDER_REVIEW'],['2026-08-18','ASSIGNED'],['2026-08-21','IN_PROGRESS'],['2026-09-02','RESOLVED']]},
  {id:'mvp-demo-water-2',cat:'WATERLOGGING',ward:'ward-12',lat:24.3641,lng:88.625,title:'নমুনা বাজারে আবার জলাবদ্ধতা',description:'একই কাল্পনিক বাজার অংশে পরবর্তী বৃষ্টিতে আবার পানি জমার পর্যবেক্ষণ। আগের কাজের স্থায়িত্ব পরীক্ষা প্রয়োজন।',start:'2026-09-08',priority:'HIGH',severity:4,cost:3000,steps:[['2026-09-09','UNDER_REVIEW'],['2026-09-15','ASSIGNED'],['2026-09-19','IN_PROGRESS']]},
  {id:'mvp-demo-water-3',cat:'WATERLOGGING',ward:'ward-12',lat:24.3648,lng:88.6255,title:'নমুনা মোড়ে জমে থাকা পানি',description:'কাল্পনিক বাজার মোড়ে বৃষ্টির পরে পানি জমে। কাছাকাছি জমা পানির সঙ্গে যোগসূত্র তদন্ত প্রয়োজন।',start:'2026-10-01',priority:'MEDIUM',severity:3,cost:1800,steps:[['2026-10-02','UNDER_REVIEW']]},
  {id:'mvp-demo-drain-1',cat:'DRAINAGE',ward:'ward-12',lat:24.3639,lng:88.6247,title:'নমুনা বাজার ড্রেনে আবর্জনা',description:'কাল্পনিক বাজার অংশের ড্রেনে আবর্জনা ও কম প্রবাহ। বাধার স্থান ও পানি চলাচল পরীক্ষা প্রয়োজন।',start:'2026-09-25',priority:'HIGH',severity:4,cost:2200,steps:[['2026-09-26','AWAITING_FIELD_VERIFICATION']]},
  {id:'mvp-demo-road-1',cat:'ROAD_DAMAGE',ward:'ward-25',lat:24.366,lng:88.631,title:'নমুনা সড়কের ভাঙা পৃষ্ঠ',description:'কাল্পনিক সড়ক অংশে ভাঙা পৃষ্ঠ ও গর্ত। ভিত্তি ও পানি নিষ্কাশন পরীক্ষা প্রয়োজন।',start:'2026-08-05',priority:'MEDIUM',severity:3,cost:4000,steps:[['2026-08-10','ASSIGNED'],['2026-08-18','IN_PROGRESS'],['2026-09-01','RESOLVED']]},
  {id:'mvp-demo-road-2',cat:'ROAD_DAMAGE',ward:'ward-25',lat:24.3664,lng:88.6315,title:'নমুনা সড়কে পুনরায় ক্ষতি',description:'একই কাল্পনিক সড়ক অংশে আবার গর্তের পর্যবেক্ষণ। ভিত্তির অবস্থা ও পানির প্রভাব পরিদর্শন প্রয়োজন।',start:'2026-09-20',priority:'HIGH',severity:4,cost:5000,steps:[['2026-09-21','UNDER_REVIEW']]},
  {id:'mvp-demo-road-3',cat:'ROAD_DAMAGE',ward:'ward-25',lat:24.3668,lng:88.632,title:'নমুনা সড়কে কাছাকাছি গর্ত',description:'কাল্পনিক সড়ক অংশে কাছাকাছি গর্তের আরেক পর্যবেক্ষণ। একই ক্ষতির duplicate কি না মাঠে যাচাই প্রয়োজন।',start:'2026-09-21',priority:'HIGH',severity:4,cost:3500,steps:[['2026-09-22','AWAITING_FIELD_VERIFICATION']]},
  {id:'mvp-demo-waste-1',cat:'WASTE',ward:'ward-12',lat:24.369,lng:88.622,title:'নমুনা সংগ্রহস্থলে জমা বর্জ্য',description:'কাল্পনিক সংগ্রহস্থলে জমা বর্জ্য। সংগ্রহের সময়সূচি ও প্রবেশপথ পরিদর্শন প্রয়োজন।',start:'2026-09-27',priority:'MEDIUM',severity:3,cost:1200,steps:[['2026-09-28','ASSIGNED']]},
  {id:'mvp-demo-light-1',cat:'STREETLIGHT',ward:'ward-14',lat:24.373,lng:88.637,title:'নমুনা পথে অচল সড়কবাতি',description:'কাল্পনিক পথের বাতি জ্বলে না। প্রশিক্ষিত কর্মীর নিরাপদ বৈদ্যুতিক পরিদর্শন প্রয়োজন।',start:'2026-10-03',priority:'CRITICAL',severity:5,cost:1500,steps:[['2026-10-04','UNDER_REVIEW']]},
] as const;
const canonicalDemo = new Set<string>(demoCases.map(r=>r.id));
export function isCanonicalDemo(id:string) {return canonicalDemo.has(id) && db.reports.get(id)?.sourceType==='demo_seed';}

export function reportTimeline(report:Report) {
  const entries:{createdAt:string;status:string;label:string}[]=[{createdAt:report.createdAt,status:'SUBMITTED',label:'রিপোর্ট গ্রহণ'}];
  for(const h of db.statusHistories.filter(h=>h.reportId===report.id)) entries.push({createdAt:h.createdAt,status:h.newStatus==='AI_ANALYZED'?'UNDER_REVIEW':h.newStatus,label:'নথিভুক্ত status history'});
  for(const e of db.actionEvents.values()) {
    if(e.reportId!==report.id) continue;
    const status=e.details?.status || (e.details?.confirmedPlan as any)?.status;
    if(typeof status==='string' && (ACTION_STATUSES as readonly string[]).includes(status)) entries.push({createdAt:e.createdAt,status,label:'নথিভুক্ত action history'});
  }
  // Old records may have only a current state. Do not back-date that state to submission.
  const current=workflowStatus(report);
  entries.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  if(entries[entries.length-1].status!==current)entries.push({createdAt:report.updatedAt,status:current,label:'বর্তমান অবস্থা; মধ্যবর্তী ইতিহাস অসম্পূর্ণ'});
  return entries.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}

export function twin(filters:AnalyticsFilters, at?:string, compareAt?:string) {
  const rows=analytics(filters).rows;
  const state=(timeline:ReturnType<typeof reportTimeline>,date?:string)=>{
    const available=timeline.filter(e=>!date || e.createdAt<=date+'T23:59:59.999+06:00');
    return available[available.length-1]?.status || null;
  };
  const records=rows.map(row=>{
    const report=db.reports.get(row.id)!, timeline=reportTimeline(report), analysis=db.findAiAnalysisByReportId(row.id), priority=db.findPriorityAssessmentByReportId(row.id);
    return {...row,status:state(timeline,at),compareStatus:compareAt?state(timeline,compareAt):null,currentStatus:row.status,
      description:publicText(report.description),addressLabel:publicText(report.addressLabel || ''),timeline,
      classification:{category:analysis?.suggestedCategory || analysis?.category || report.category,provider:analysis?.provider || 'Unavailable',summary:publicText(analysis?.summary || ''),confidence:analysis?.confidence??null},
      priorityRationale:publicText(priority?.explanation?.summary || 'মূল্যায়ন অনুপস্থিত'),
      coordinatesNote:row.sourceType==='demo_seed'?'Simulated approximate location — কাল্পনিক আনুমানিক স্থান':'Reporter-selected coordinates; official boundary verification unavailable',
      comparison:['mvp-demo-water-1','mvp-demo-road-1'].includes(row.id)?{label:DEMO_LABEL,before:'/demo-before.svg',after:'/demo-after.svg',note:'Simulated intervention illustration — ছবি বা বাস্তব কাজের প্রমাণ নয়। পরে কাছাকাছি নতুন রিপোর্ট এসেছে; স্থায়ী সমাধান দাবি করা হচ্ছে না।'}:null};
  }).filter(row=>row.status!==null);
  return {records,at:at || 'current',compareAt:compareAt || null,changed:records.filter(r=>r.compareStatus!==r.status).length,label:records.some(r=>r.sourceType==='demo_seed')?MODE_LABEL:null,limitation:'Lightweight report visualization; not an engineering-grade or 3D twin. Missing history does not establish past conditions.'};
}

export function rootClusters(filters:AnalyticsFilters) {
  const rows=analytics(filters).rows, unseen=new Set(rows.map(r=>r.id)), result:any[]=[];
  // Same source, compatible categories AND nearby coordinates. Complete-link diameter prevents long chains.
  const compatible=(a:string,b:string)=>a===b || (['DRAINAGE','WATERLOGGING'].includes(a)&&['DRAINAGE','WATERLOGGING'].includes(b));
  for(const seed of rows.slice().sort((a,b)=>a.id.localeCompare(b.id))) {
    if(!unseen.delete(seed.id))continue;
    const members=[seed];
    for(const candidate of rows.slice().sort((a,b)=>a.id.localeCompare(b.id))) if(unseen.has(candidate.id) && candidate.sourceType===seed.sourceType && members.every(r=>compatible(r.category,candidate.category) && distance(r,candidate)<=300)) {unseen.delete(candidate.id);members.push(candidate);}
    if(members.length<2)continue;
    const ids=members.map(r=>r.id).sort(), id='cluster-'+hash(ids), dates=members.map(r=>dhakaDay(r.createdAt)).sort();
    const pairs=members.flatMap((a,i)=>members.slice(i+1).map(b=>({a:a.id,b:b.id,days:Math.abs(Date.parse(a.createdAt)-Date.parse(b.createdAt))/86400000,meters:Math.round(distance(a,b)),descriptionSimilarity:calculateTextSimilarity(db.reports.get(a.id)!.description,db.reports.get(b.id)!.description)})));
    const repeatPairs=pairs.filter(p=>p.days>=7 && p.descriptionSimilarity>=0.15), nearDuplicates=pairs.filter(p=>p.days<=2 && p.meters<=100 && p.descriptionSimilarity>=0.15);
    const categoriesCount=members.reduce<Record<string,number>>((acc,r)=>{acc[r.category]=(acc[r.category]||0)+1;return acc;},{});
    const water=members.some(r=>['WATERLOGGING','DRAINAGE'].includes(r.category)), road=seed.category==='ROAD_DAMAGE';
    const review=db.clusterReviews.get(id);
    result.push({id,reportIds:ids,title:water?'কাছাকাছি পানি ও ড্রেনেজ পর্যবেক্ষণ':road?'একই সড়ক অংশে ক্ষতির পর্যবেক্ষণ':'কাছাকাছি একই ধরনের পর্যবেক্ষণ',count:members.length,
      latitude:members.reduce((n,r)=>n+r.latitude,0)/members.length,longitude:members.reduce((n,r)=>n+r.longitude,0)/members.length,
      approximateArea:members.map(r=>db.wards.get(r.wardId || '')?.wardName || 'ওয়ার্ড অজানা').filter((w,i,a)=>a.indexOf(w)===i).join(', '),
      categories:categoriesCount,from:dates[0],to:dates[dates.length-1],unresolved:members.filter(r=>!closed(r.status)).length,
      recurringCount:new Set(repeatPairs.flatMap(p=>[p.a,p.b])).size,possibleDuplicates:nearDuplicates,
      evidence:[`সব জোড়ার দূরত্ব ≤ 300 m; সর্বোচ্চ ${Math.max(...pairs.map(p=>p.meters))} m`,`${repeatPairs.length} জোড়া অন্তত 7 দিন ব্যবধানে ও description token similarity ≥ 15%; নিশ্চিত পুনরায় ক্ষতি নয়`,`${nearDuplicates.length} জোড়া 100 m / 2 দিনের মধ্যে ও description similarity ≥ 15%; duplicate যাচাই প্রয়োজন`],
      descriptionPatterns:members.map(r=>({id:r.id,text:publicText(db.reports.get(r.id)!.description)})),
      possibleFactors:water?['ড্রেনের বাধা বা প্রবাহ সীমিত কি না পরীক্ষা করুন','বৃষ্টির পানি বের হওয়ার পথ পরীক্ষা করুন']:road?['পৃষ্ঠ ও ভিত্তির অবস্থা পরীক্ষা করুন','পানি নিষ্কাশন ও কাজের স্থায়িত্ব পরীক্ষা করুন']:['সেবা সময়সূচি ও স্থানগত পরিস্থিতি পরীক্ষা করুন'],
      nextAction:'সমন্বিত মাঠ পরিদর্শনে একই সমস্যা, আলাদা সমস্যা ও সম্ভাব্য কারণ আলাদা করে নথিভুক্ত করুন।',
      confidence:repeatPairs.length?'MODERATE_PATTERN':'LIMITED_PATTERN',confidenceNote:'Deterministic pattern confidence, not an AI probability or verified engineering cause.',
      limitations:['Coordinates may be approximate; reporting bias and missing observations remain.','Time-separated reports can be duplicate follow-ups. A common cause requires field evidence.'],
      review:review?{state:review.state,evidence:publicText(review.evidence),revision:review.revision,updatedAt:review.updatedAt}:null,sourceType:seed.sourceType,demoEditable:ids.every(isCanonicalDemo),label:seed.sourceType==='demo_seed'?DEMO_LABEL:null});
  }
  return result;
}

export const CoverageWeights=z.object({completeness:z.number().min(0).max(1),consistency:z.number().min(0).max(1),categories:z.number().min(0).max(1)}).strict().refine(w=>Math.abs(w.completeness+w.consistency+w.categories-1)<0.001,'Weights must sum to 1');
export function coverage(filters:AnalyticsFilters,weights={completeness:0.4,consistency:0.3,categories:0.3}) {
  CoverageWeights.parse(weights);
  const rows=analytics(filters).rows;
  const to=filters.to || dhakaDay(new Date().toISOString()), from=filters.from || to;
  const windowFrom=filters.from || new Date(Date.parse(to+'T00:00:00Z')-89*86400000).toISOString().slice(0,10);
  const days=Math.max(1,Math.round((Date.parse(to)-Date.parse(windowFrom))/86400000)+1), bucketCount=Math.ceil(days/7);
  const scoped=rows.filter(r=>dhakaDay(r.createdAt)>=windowFrom && dhakaDay(r.createdAt)<=to);
  const entries=[...db.getAllWards().map(w=>({id:w.id,name:w.wardName})),{id:'UNKNOWN',name:'ওয়ার্ড অজানা'}].filter(w=>!filters.wardId || w.id===filters.wardId);
  return {period:{from:windowFrom,to},weights,methodology:'Completeness = mean of description, category (not OTHER), coordinates and ward availability; consistency = occupied weekly buckets / all buckets in selected period; category coverage = distinct configured categories / 7. Score = 100 × weighted sum. No population denominator.',
    recommendation:'আরও মাঠ পর্যবেক্ষণ সংগ্রহ করুন; কম রিপোর্ট মানেই কম সমস্যা বা ভালো সেবা নয়।',
    rows:entries.map(w=>{
      const records=scoped.filter(r=>(r.wardId || 'UNKNOWN')===w.id), n=records.length;
      const completeness=n?records.reduce((s,r)=>s+[db.reports.get(r.id)!.description.trim().length>=5,r.category!=='OTHER',Number.isFinite(r.latitude)&&Number.isFinite(r.longitude),!!r.wardId].filter(Boolean).length/4,0)/n:0;
      const buckets=new Set(records.map(r=>Math.floor((Date.parse(dhakaDay(r.createdAt))-Date.parse(windowFrom))/604800000))).size;
      const diversity=new Set(records.map(r=>r.category)).size, consistency=buckets/bucketCount, categoryCoverage=diversity/categories.length;
      const dates=records.map(r=>dhakaDay(r.createdAt)).sort();
      return {wardId:w.id,wardName:w.name,count:n,categoryDiversity:diversity,unresolved:records.filter(r=>!closed(r.status)).length,first:dates[0] || null,last:dates[n-1] || null,
        classification:n===0?'INSUFFICIENT_DATA':n<4?'LOW_OBSERVED_REPORTING':'HIGHER_OBSERVED_REPORTING',
        components:{completeness:Math.round(100*completeness),consistency:Math.round(100*consistency),categoryCoverage:Math.round(100*categoryCoverage)},
        score:n?Math.round(100*(weights.completeness*completeness+weights.consistency*consistency+weights.categories*categoryCoverage)):null,
        simulated:records.some(r=>r.sourceType==='demo_seed'),limitation:n<4?'Sample too small for infrastructure conclusions':'Observed reporting coverage; not infrastructure quality'};
    })};
}

export const ScenarioInput=z.object({filters:z.object({source:z.enum(['demo_seed','citizen_report']).default('demo_seed'),wardId:z.string().max(100).optional(),category:z.enum(categories).optional()}).strict(),useBudget:z.boolean().default(true),budget:z.number().min(0).max(100000000).default(6000),teams:z.number().int().min(1).max(50).default(1),maxCases:z.number().int().min(1).max(100).default(4),days:z.number().int().min(1).max(90).default(2)}).strict();
export function scenarios(raw:z.input<typeof ScenarioInput>) {
  const input=ScenarioInput.parse(raw);
  const rows=analytics(input.filters).rows.filter(r=>!closed(r.status)), clusters=rootClusters(input.filters);
  const recurring=new Set(clusters.filter(c=>c.recurringCount>0).flatMap(c=>c.reportIds));
  const score=(r:typeof rows[number])=>db.findPriorityAssessmentByReportId(r.id)?.score || 0;
  const capacity=Math.min(input.maxCases,input.teams*input.days*2);
  const cost=(id:string)=>isCanonicalDemo(id)?demoCases.find(c=>c.id===id)?.cost ?? null:null;
  const definitions=[['PRIORITY','উচ্চ অগ্রাধিকার আগে'],['NEARBY','কাছাকাছি যৌথ পরিদর্শন'],['RECURRING','পুনরাবৃত্ত পর্যবেক্ষণ আগে'],['SEVERITY','উচ্চ তীব্রতার অসমাধিত'],['CUSTOM','নির্বাচিত ওয়ার্ড / category']] as const;
  return {facts:{eligible:rows.length,source:input.filters.source},assumptions:{...input,capacity,casesPerTeamDay:2,costs:'Only canonical fictional demo cases have illustrative BDT costs. Unknown costs are deferred in budget mode; capacity-only mode selects cases without claiming budget feasibility.',routeDiscount:'Nearby scenario: illustrative 20% shared-visit cost reduction for stops within 300 m. Not a repair-cost estimate.'},label:MODE_LABEL,
    scenarios:definitions.map(([key,title])=>{
      let candidates=rows.slice();
      if(key==='RECURRING')candidates=candidates.filter(r=>recurring.has(r.id));
      if(key==='SEVERITY')candidates=candidates.filter(r=>(db.findAiAnalysisByReportId(r.id)?.severity || 0)>=4);
      candidates.sort((a,b)=>score(b)-score(a) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      if(key==='NEARBY' && candidates.length){const anchors=candidates.filter(r=>!input.useBudget || cost(r.id)!==null);anchors.sort((a,b)=>anchors.filter(r=>distance(r,b)<=300).length-anchors.filter(r=>distance(r,a)<=300).length || score(b)-score(a));const anchor=anchors[0] || candidates[0];candidates.sort((a,b)=>distance(a,anchor)-distance(b,anchor) || score(b)-score(a));}
      const selected:any[]=[], deferred:any[]=[];let spent=0;
      for(const r of rows)if(!candidates.some(c=>c.id===r.id))deferred.push({id:r.id,reason:key==='RECURRING'?'No time-separated nearby pattern': 'Reported severity below 4 or unavailable'});
      for(const r of candidates) {
        const base=cost(r.id), shared=key==='NEARBY' && selected.some(s=>distance(r,s)<=300), estimated=base===null?null:Math.round(base*(shared?0.8:1));
        const reason=selected.length>=capacity?'Team / case capacity reached':input.useBudget && estimated===null?'No configured cost assumption; budget feasibility unknown':input.useBudget && spent+estimated!>input.budget?'Hypothetical budget exceeded':null;
        if(reason){deferred.push({id:r.id,reason});continue;}
        spent+=estimated || 0;selected.push({...r,illustrativeCost:estimated,reason:key==='NEARBY'?(shared?'Nearby shared-visit assumption':'Suggested visit anchor or separate stop'):key==='RECURRING'?'Nearby observations at least 7 days apart':key==='SEVERITY'?'Reported severity ≥ 4':key==='CUSTOM'?'User-selected scope, ordered by recorded priority':'Recorded priority score first'});
      }
      return {key,title,selected,deferred,illustrativeCost:selected.some(r=>r.illustrativeCost===null)?null:spent,unusedBudget:input.useBudget?input.budget-spent:null,workload:{cases:selected.length,illustrativeTeamDays:selected.length/2},groups:groupStops(selected),tradeOff:key==='NEARBY'?'Groups nearby observations; may defer a distant urgent case':key==='RECURRING'?'Examines repeated observations; may defer isolated severe cases':'Focuses selected criteria; inspection duration and costs are assumptions, not guaranteed outcomes'};
    }),limitation:'Human planning support only; no official spending approval, verified population benefits or guaranteed outcomes.'};
}

export function groupStops(rows:{id:string;latitude:number;longitude:number}[]) {
  const groups:typeof rows[]=[];
  for(const row of rows){let g=groups.find(g=>g.every(r=>distance(r,row)<=300));if(!g){g=[];groups.push(g);}g.push(row);}
  return groups.map(g=>({reportIds:g.map(r=>r.id),count:g.length}));
}
export function routeStops(ids:string[]) {
  const pending=ids.map(id=>{const r=db.reports.get(id);if(!r)fail('Report not found',404);return r!;}).sort((a,b)=>a.id.localeCompare(b.id));
  const ordered:Report[]=[];
  while(pending.length){if(ordered.length){const last=ordered[ordered.length-1];pending.sort((a,b)=>distance(last,a)-distance(last,b) || a.id.localeCompare(b.id));}ordered.push(pending.shift()!);}
  const groups=groupStops(ordered);
  return ordered.map((r,index)=>({reportId:r.id,order:index+1,visitGroup:groups.findIndex(g=>g.reportIds.includes(r.id))+1,latitude:r.latitude,longitude:r.longitude,distanceFromPrevious:index?Math.round(distance(ordered[index-1],r)):0,
    checklist:['নিরাপদ প্রবেশ ও সঠিক স্থান নিশ্চিত করুন',...(['DRAINAGE','WATERLOGGING'].includes(r.category)?['বাধা ও প্রবাহ পরীক্ষা করুন','বৃষ্টি / পানির গভীরতা নথিভুক্ত করুন']:r.category==='ROAD_DAMAGE'?['গর্ত ও পৃষ্ঠের মাপ নিন','ভিত্তি ও পানি নিষ্কাশন পরীক্ষা করুন']:r.category==='STREETLIGHT'?['প্রশিক্ষিত কর্মীর বৈদ্যুতিক নিরাপত্তা পরীক্ষা','বাতি ও সংযোগের অবস্থা নথিভুক্ত করুন']:['সমস্যার পরিমাণ ও সেবার প্রবেশপথ নথিভুক্ত করুন']),'ছবি, পর্যবেক্ষণ ও follow-up নথিভুক্ত করুন']}));
}

const Photo=z.string().max(1000).refine(v=>/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(v) || /^https?:\/\//.test(v),'Use uploaded image or HTTP(S) URL').nullable().default(null);
export const MissionInput=z.object({title:z.string().trim().min(3).max(150),reportIds:z.array(z.string().max(100)).min(1).max(20).refine(ids=>new Set(ids).size===ids.length,'Duplicate stops'),departmentId:z.string().max(100).nullable().default(null),officerId:z.string().max(100).nullable().default(null),team:z.string().trim().max(150).default(''),status:z.enum(['DRAFT','PLANNED','ASSIGNED']).default('DRAFT')}).strict();
export const MissionUpdate=z.object({revision:z.number().int().min(1),status:z.enum(MissionStates),note:z.string().trim().min(10).max(2000),findings:z.string().trim().max(3000).default(''),followUp:z.string().trim().max(2000).default(''),photoUrl:Photo,departmentId:z.string().max(100).nullable().optional(),officerId:z.string().max(100).nullable().optional(),team:z.string().trim().max(150).optional()}).strict();
function validateIdentity(input:Pick<FieldMission,'reportIds'|'departmentId'|'officerId'|'team'|'status'>,demoOnly:boolean) {
  if(input.departmentId){const d=db.departments.get(input.departmentId);if(!d?.active || (demoOnly && d.verificationStatus!=='DEMO'))fail('Active compatible department required');}
  if(input.officerId){const o=db.officers.get(input.officerId);if(!o?.active || o.departmentId!==input.departmentId || (demoOnly && o.verificationStatus!=='DEMO'))fail('Active officer in selected department required');}
  if(['ASSIGNED','IN_PROGRESS','COMPLETED'].includes(input.status) && (!input.departmentId || !input.officerId || !input.team))fail('Department, team and officer required for assignment');
  if(!demoOnly && input.reportIds.some(id=>db.reports.get(id)?.sourceType==='citizen_report') && ((input.departmentId && db.departments.get(input.departmentId)?.verificationStatus!=='VERIFIED') || (input.officerId && db.officers.get(input.officerId)?.verificationStatus!=='VERIFIED')))fail('Real reports require verified operational identities');
}
export function saveMission(input:z.infer<typeof MissionInput>,actor:string,demoOnly=false) {
  if(demoOnly && input.reportIds.some(id=>!isCanonicalDemo(id)))fail('Demo mission accepts only the fixed fictional dataset',403);
  if(demoOnly && Array.from(db.fieldMissions.values()).filter(m=>m.id.startsWith('mission-demo-')).length>=40)fail('Demo mission limit reached; reuse an existing fictional mission',429);
  const sources=new Set(input.reportIds.map(id=>db.reports.get(id)?.sourceType));if(sources.has(undefined))fail('Report not found',404);if(sources.size!==1)fail('Keep demo and citizen reports in separate missions');
  validateIdentity(input,demoOnly);
  const now=new Date().toISOString();
  const data:FieldMission={...input,id:(demoOnly?'mission-demo-':'mission-')+randomUUID(),sourceType:Array.from(sources)[0]!,route:routeStops(input.reportIds),updates:[],revision:1,createdBy:actor,createdAt:now,updatedAt:now};
  db.fieldMissions.set(data.id,data);for(const id of data.reportIds)event(id,actor,'MISSION_CREATED','Field inspection mission created',{missionId:data.id,missionStatus:data.status});return data;
}
const transitions:Record<string,string[]>={DRAFT:['PLANNED','CANCELLED'],PLANNED:['ASSIGNED','CANCELLED'],ASSIGNED:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['COMPLETED','CANCELLED'],COMPLETED:[],CANCELLED:[]};
export function updateMission(id:string,input:z.infer<typeof MissionUpdate>,actor:string,demoOnly=false) {
  const old=db.fieldMissions.get(id);if(!old)fail('Mission not found',404);
  if(demoOnly && (old!.sourceType!=='demo_seed' || !old!.id.startsWith('mission-demo-') || old!.reportIds.some(id=>!isCanonicalDemo(id))))fail('Only fictional demo missions can be changed',403);
  if(old!.revision!==input.revision)fail('Mission changed; reload before saving',409);
  if(demoOnly && old!.updates.length>=100)fail('Demo inspection update limit reached',429);
  if(input.status!==old!.status && !transitions[old!.status].includes(input.status))fail('Invalid mission transition');
  const assignment={departmentId:input.departmentId===undefined?old!.departmentId:input.departmentId,officerId:input.officerId===undefined?old!.officerId:input.officerId,team:input.team===undefined?old!.team:input.team};
  if(['COMPLETED','CANCELLED'].includes(old!.status) && (assignment.departmentId!==old!.departmentId || assignment.officerId!==old!.officerId || assignment.team!==old!.team))fail('Completed or cancelled mission assignment cannot change');
  validateIdentity({...old!,...assignment,status:input.status},demoOnly);
  if(input.status==='COMPLETED' && input.findings.trim().length<10)fail('Completion requires inspection findings');
  const now=new Date().toISOString(), update={id:randomUUID(),status:input.status,note:input.note,findings:input.findings,followUp:input.followUp,photoUrl:input.photoUrl,createdAt:now};
  const data={...old!,...assignment,status:input.status,revision:old!.revision+1,updatedAt:now,updates:[...old!.updates,update]};
  db.fieldMissions.set(id,data);for(const reportId of data.reportIds)event(reportId,actor,'MISSION_UPDATED',input.note,{missionId:id,missionStatus:input.status,findings:input.findings,followUp:input.followUp});return data;
}
export function reviewCluster(id:string,input:{state:string;evidence:string;revision:number},actor:string,demoOnly=false) {
  const cluster=rootClusters({source:demoOnly?'demo_seed':'all'}).find(c=>c.id===id);if(!cluster)fail('Cluster not found; reload current membership',404);
  if(demoOnly && cluster!.reportIds.some((r:string)=>!isCanonicalDemo(r)))fail('Only fixed fictional clusters can be reviewed',403);
  const old=db.clusterReviews.get(id);if((old?.revision || 0)!==input.revision)fail('Cluster review changed; reload',409);
  const now=new Date().toISOString();const data:ClusterReview={id,reportIds:cluster!.reportIds,state:input.state,evidence:input.evidence,revision:input.revision+1,sourceType:cluster!.sourceType,updatedBy:actor,createdAt:old?.createdAt || now,updatedAt:now};
  db.clusterReviews.set(id,data);for(const reportId of data.reportIds)event(reportId,actor,'CLUSTER_REVIEWED',input.evidence,{clusterId:id,reviewState:data.state,demo:demoOnly});return data;
}

export function seedCompetitionDemo() {
  // Validate every collision BEFORE changing anything. Restore only known fictional records, never arbitrary prefixes.
  for(const c of demoCases){const r=db.reports.get(c.id);if(r && r.sourceType!=='demo_seed')fail('Demo ID collision with a real report; seed refused',409);if(Array.from(db.actionPlans.values()).some(p=>p.reportId===c.id))fail('Demo case has an operator action plan; preserve it and refuse restore',409);}
  for(const [map,id] of [[db.departments,'mvp-demo-drainage'],[db.officers,'mvp-demo-inspector'],[db.fieldMissions,'mission-demo-preloaded']] as const) {
    const existing=map.get(id) as any;if(existing && (existing.sourceType ? existing.sourceType!=='demo_seed' : existing.verificationStatus!=='DEMO'))fail('Demo identity collision; restore refused',409);
  }
  const now=day('2026-10-05');
  db.departments.set('mvp-demo-drainage',{id:'mvp-demo-drainage',displayName:'DEMO — নমুনা ড্রেনেজ পরিদর্শন দল',active:true,verificationStatus:'DEMO',source:DEMO_LABEL});
  db.officers.set('mvp-demo-inspector',{id:'mvp-demo-inspector',displayName:'DEMO — পরিদর্শক A',title:'Fictional inspection officer',departmentId:'mvp-demo-drainage',wardId:null,contact:null,active:true,verificationStatus:'DEMO',source:DEMO_LABEL});
  for(const c of demoCases){
    const final=c.steps[c.steps.length-1], actionStatus=final[1] as any, createdAt=day(c.start),updatedAt=day(final[0]);
    db.reports.set(c.id,{id:c.id,reporterId:null,title:c.title,description:c.description,category:c.cat,userCategory:c.cat,latitude:c.lat,longitude:c.lng,addressLabel:'Simulated Rajshahi demo area — আনুমানিক কাল্পনিক স্থান',wardId:db.wards.has(c.ward)?c.ward:(c.cat==='ROAD_DAMAGE'?'ward-25':null),imageUrl:null,sourceType:'demo_seed',status:actionStatus==='RESOLVED'?'RESOLVED':actionStatus==='IN_PROGRESS'?'IN_PROGRESS':'UNDER_REVIEW',actionStatus,createdAt,updatedAt,resolvedAt:actionStatus==='RESOLVED'?updatedAt:null});
    db.saveAiAnalysis({id:'analysis-'+c.id,reportId:c.id,provider:'DEMO_RULE_TEMPLATE',modelName:'Fictional fixture, not live AI',category:c.cat,suggestedCategory:c.cat,summary:c.description,severity:c.severity,confidence:null,reasons:['Fictional scenario for presentation; inspect before drawing conclusions'],missing_information:['মাঠ পর্যবেক্ষণ প্রয়োজন'],createdAt});
    db.savePriorityAssessment({id:'priority-'+c.id,reportId:c.id,severityFactor:c.severity,impactFactor:0,recurrenceFactor:0,ageFactor:1,score:c.priority==='CRITICAL'?95:c.priority==='HIGH'?75:50,priorityLevel:c.priority,explanation:{summary:`${DEMO_LABEL}: ${c.priority} প্রাথমিক scenario priority; severity ${c.severity}, জনসংখ্যা বা প্রকৌশল যাচাই নেই।`,factors:[]},assessedAt:createdAt});
    for(const [date,status] of c.steps){const e={id:`timeline-${c.id}-${date}`,reportId:c.id,planId:null,actorId:'user-admin-01',type:'STATUS_CHANGED',note:DEMO_LABEL,details:{status,fictional:true},createdAt:day(date)};db.actionEvents.set(e.id,e);}
  }
  const reportIds=['mvp-demo-water-2','mvp-demo-water-3','mvp-demo-drain-1'];
  db.fieldMissions.set('mission-demo-preloaded',{id:'mission-demo-preloaded',title:'DEMO — বাজার পানি ও ড্রেনেজ পরিদর্শন',reportIds,departmentId:'mvp-demo-drainage',officerId:'mvp-demo-inspector',team:'DEMO — Field Team A',status:'IN_PROGRESS',sourceType:'demo_seed',route:routeStops(reportIds),revision:(db.fieldMissions.get('mission-demo-preloaded')?.revision || 0)+1,createdBy:'user-admin-01',createdAt:day('2026-10-04'),updatedAt:now,updates:[{id:'demo-inspection-update',status:'IN_PROGRESS',note:DEMO_LABEL,findings:'কাল্পনিক পর্যবেক্ষণ: একটি প্রবাহপথে বাধা দেখা গেছে; পানি প্রবাহ পরিমাপ বাকি।',followUp:'দ্বিতীয় পরিদর্শনে বাধা ও বৃষ্টির সময়কাল যাচাই করুন।',photoUrl:null,createdAt:now}]});
  for(const reportId of reportIds)db.actionEvents.set('mission-seed-'+reportId,{id:'mission-seed-'+reportId,reportId,planId:null,actorId:'user-admin-01',type:'MISSION_UPDATED',note:DEMO_LABEL,details:{missionId:'mission-demo-preloaded',missionStatus:'IN_PROGRESS'},createdAt:now});
  // Known cluster review IDs are restored; unrelated/real clusters are untouched.
  for(const c of rootClusters({source:'demo_seed'}).filter(c=>c.reportIds.every((id:string)=>canonicalDemo.has(id)))) {
    const old=db.clusterReviews.get(c.id);db.clusterReviews.set(c.id,{id:c.id,reportIds:c.reportIds,state:'UNDER_INVESTIGATION',evidence:'Demo Data — কাল্পনিক নমুনা তথ্য: যৌথ পরিদর্শন পরিকল্পিত; নিশ্চিত কারণ নয়।',sourceType:'demo_seed',revision:(old?.revision || 0)+1,updatedBy:'user-admin-01',createdAt:now,updatedAt:now});
  }
  return {reports:demoCases.length,missionId:'mission-demo-preloaded',label:DEMO_LABEL,restored:true};
}
