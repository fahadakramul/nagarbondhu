import { calculateHaversineDistanceMeters } from '@nagarbondhu/shared';
import { publicText } from './privacy';
import { db } from '../db';
import { getPlan, workflowStatus, isOverdue } from './action.service';

export interface AnalyticsFilters {wardId?:string; category?:string; from?:string; to?:string; source?:string}
export function dhakaDay(timestamp:string) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp));
  const field=(type:string)=>parts.find(p=>p.type===type)!.value;return `${field('year')}-${field('month')}-${field('day')}`;
}
export function analytics(filters:AnalyticsFilters) {
  const reports=Array.from(db.reports.values()).filter(r=>(!filters.wardId || (getPlan(r.id)?.wardId || r.wardId)===filters.wardId) && (!filters.category || r.category===filters.category) && (!filters.from || Date.parse(r.createdAt)>=Date.parse(filters.from+'T00:00:00+06:00')) && (!filters.to || Date.parse(r.createdAt)<=Date.parse(filters.to+'T23:59:59.999+06:00')) && (!filters.source || filters.source==='all' || r.sourceType===filters.source));
  const rows=reports.map(r=>{const p=getPlan(r.id);return {id:r.id,title:publicText(r.title),category:r.category,wardId:p?.wardId || r.wardId || null,status:workflowStatus(r),priority:p?.priority || db.findPriorityAssessmentByReportId(r.id)?.priorityLevel || null,overdue:isOverdue(p),targetDate:p?.targetDate || null,createdAt:r.createdAt,updatedAt:r.updatedAt,sourceType:r.sourceType,latitude:r.latitude,longitude:r.longitude,locationConfirmed:Array.from(db.submissionReceipts.values()).some(s=>s.reportId===r.id && s.locationConfirmed)};});
  const group=(key:keyof typeof rows[number])=>rows.reduce<Record<string,number>>((acc,r)=>{const value=String(r[key]??'UNKNOWN');acc[value]=(acc[value]||0)+1;return acc;},{});
  const months=rows.reduce<Record<string,Record<string,number>>>((acc,r)=>{const month=dhakaDay(r.createdAt).slice(0,7);acc[month] ||= {};acc[month][r.category]=(acc[month][r.category]||0)+1;return acc;},{});
  const monthChanges=Object.keys(months).sort().slice(1).flatMap(month=>{
    const previous=new Date(month+'-01T00:00:00Z');previous.setUTCMonth(previous.getUTCMonth()-1);const prev=previous.toISOString().slice(0,7);
    if(!months[prev])return [];
    return Array.from(new Set([...Object.keys(months[month]),...Object.keys(months[prev])])).map(category=>({month,previousMonth:prev,category,currentCount:months[month][category]||0,previousCount:months[prev][category]||0,change:(months[month][category]||0)-(months[prev][category]||0),limitation:'Observed reports within selected dates; partial months and unequal coverage are not normalized'}));
  });
  // Connected components, same category, within 300 m. Density is a reporting pattern, not a hazard diagnosis.
  const unresolved=rows.filter(r=>!['RESOLVED','CLOSED','REJECTED'].includes(r.status));
  const unseen=new Set(unresolved.map(r=>r.id));const clusters:any[]=[];
  for(const seed of unresolved) {
    if(!unseen.delete(seed.id)) continue;
    const members=[seed];
    for(let i=0;i<members.length;i++) for(const candidate of unresolved) if(unseen.has(candidate.id) && candidate.sourceType===seed.sourceType && candidate.category===seed.category && [candidate.latitude,candidate.longitude,members[i].latitude,members[i].longitude].every(Number.isFinite) && calculateHaversineDistanceMeters(members[i].latitude,members[i].longitude,candidate.latitude,candidate.longitude)<=300) {unseen.delete(candidate.id);members.push(candidate);}
    if(members.length>=2) clusters.push({category:seed.category,reportIds:members.map(r=>r.id),count:members.length,latitude:members.reduce((n,r)=>n+r.latitude,0)/members.length,longitude:members.reduce((n,r)=>n+r.longitude,0)/members.length,distinctMonths:new Set(members.map(r=>dhakaDay(r.createdAt).slice(0,7))).size,interpretation:'Nearby reports; recurrence and common cause require field validation'});
  }
  const sorted=unresolved.slice().sort((a,b)=>Number(b.overdue)-Number(a.overdue) || ['CRITICAL','HIGH','MEDIUM','LOW'].indexOf(a.priority || 'LOW')-['CRITICAL','HIGH','MEDIUM','LOW'].indexOf(b.priority || 'LOW') || a.createdAt.localeCompare(b.createdAt));
  return {period:{from:filters.from || rows.map(r=>dhakaDay(r.createdAt)).sort()[0] || null,to:filters.to || dhakaDay(new Date().toISOString())},source:filters.source || 'all',total:rows.length,demoCount:rows.filter(r=>r.sourceType==='demo_seed').length,realCount:rows.filter(r=>r.sourceType==='citizen_report').length,byCategory:group('category'),byWard:group('wardId'),byStatus:group('status'),byPriority:group('priority'),overdue:rows.filter(r=>r.overdue).length,unresolved:unresolved.length,months,clusters,reviewFirst:sorted.slice(0,5),fieldVerification:rows.filter(r=>r.status==='AWAITING_FIELD_VERIFICATION' || !r.locationConfirmed).map(r=>r.id),locationConfirmedCount:rows.filter(r=>r.locationConfirmed).length,
    monthChanges,overdueByWard:rows.filter(r=>r.overdue).reduce<Record<string,number>>((acc,r)=>{const ward=r.wardId || 'UNKNOWN';acc[ward]=(acc[ward]||0)+1;return acc;},{}),rows,
    limitations:['Available reports only; uneven digital reporting coverage.','Ward centres are approximate; official boundaries and population data are unavailable.','Nearby corroboration does not prove severity, recurrence or common cause.','No critical-infrastructure inventory or comparable intervention baseline; before/after impact cannot be inferred.'],
    suggestedInterventions:Object.keys(group('category')).map(category=>({category,reportIds:rows.filter(r=>r.category===category).map(r=>r.id),suggestion:'স্থান ও ঝুঁকি মাঠপর্যায়ে যাচাই করে সংশ্লিষ্ট সেবা দলের করণীয় পরিকল্পনা পর্যালোচনা করুন।',kind:'REVIEW_SUGGESTION'}))};
}
export function csvExport(rows:ReturnType<typeof analytics>['rows']) {
  const keys=['id','title','category','wardId','status','priority','overdue','targetDate','createdAt','updatedAt','sourceType'] as const;
  // Neutralize spreadsheet formula injection, including leading whitespace/control characters.
  const cell=(value:unknown)=>{let v=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
  return '\uFEFF'+[keys.join(','),...rows.map(row=>keys.map(k=>cell(row[k])).join(','))].join('\r\n');
}
