import { db } from '../db';
import { analytics, AnalyticsFilters } from './analytics.service';
import { publicText } from './privacy';
import { CATEGORY_METADATA } from '@nagarbondhu/shared';

// One row per report, using the current action workflow and effective priority.
export function dashboardSummary(filters: AnalyticsFilters = {}) {
  const a = analytics(filters), terminal = ['RESOLVED','CLOSED','REJECTED'];
  const unresolved = a.rows.filter(r => !terminal.includes(r.status));
  const ids = new Set(a.rows.map(r => r.id));
  const pairs = new Set<string>();
  const duplicates = Array.from(db.possibleDuplicates.values()).filter(d => {
    const pair = [d.reportId,d.candidateReportId].sort().join('|');
    if(d.reviewStatus !== 'PENDING' || !ids.has(d.reportId) || !ids.has(d.candidateReportId) || pairs.has(pair)) return false;
    pairs.add(pair); return true;
  }).map(d => ({id:d.id, reportId:d.reportId, candidateReportId:d.candidateReportId,
    title:publicText(db.reports.get(d.reportId)?.title || ''), candidateTitle:publicText(db.reports.get(d.candidateReportId)?.title || ''),
    similarityScore:d.similarityScore, matchingReasons:d.matchingReasons, reviewStatus:d.reviewStatus}));
  const count = (status:string) => a.byStatus[status] || 0;
  return {
    source:a.source, demoCount:a.demoCount, realCount:a.realCount,
    totalReports:a.total, openReports:unresolved.length, inProgressReports:count('IN_PROGRESS'),
    resolvedReports:count('RESOLVED')+count('CLOSED'), rejectedReports:count('REJECTED'),
    highPriorityReports:unresolved.filter(r=>r.priority==='HIGH').length,
    criticalPriorityReports:unresolved.filter(r=>r.priority==='CRITICAL').length,
    unresolvedOver7Days:unresolved.filter(r=>Date.now()-Date.parse(r.createdAt)>=7*86400000).length,
    duplicateReportsFlagged:duplicates.length, duplicates, byStatus:a.byStatus, byPriority:a.byPriority, overdue:a.overdue,
    byCategory:Object.entries(CATEGORY_METADATA).map(([category,metadata])=>({category,categoryLabelBn:metadata.nameBn,count:a.byCategory[category] || 0,percentage:a.total?Math.round((a.byCategory[category] || 0)/a.total*100):0})),
    byWard:Object.entries(a.byWard).map(([wardId,count])=>({wardId,wardName:db.wards.get(wardId)?.wardName || 'ওয়ার্ড অজানা',count,highPriorityCount:unresolved.filter(r=>(r.wardId || 'UNKNOWN')===wardId && ['HIGH','CRITICAL'].includes(r.priority || '')).length})),
    hotspots:a.clusters.map(c=>({areaName:'কাছাকাছি রিপোর্টের ঘনত্ব — নিশ্চিত hazard নয়',latitude:c.latitude,longitude:c.longitude,reportCount:c.count,primaryCategory:c.category})),
    recentActivity:a.rows.slice().sort((x,y)=>y.createdAt.localeCompare(x.createdAt)).slice(0,5).map(r=>({reportId:r.id,title:r.title,category:r.category,status:r.status,priorityLevel:r.priority,wardName:db.wards.get(r.wardId || '')?.wardName || null,createdAt:r.createdAt})),
    recommendedActions:a.reviewFirst.map(r=>{const p=db.findPriorityAssessmentByReportId(r.id);return {reportId:r.id,title:r.title,score:p?.score ?? null,priorityLevel:r.priority,reason:p?.explanation.summary || 'মূল্যায়ন অনুপস্থিত; মাঠে তথ্য সংগ্রহ করুন।',location:publicText(db.reports.get(r.id)?.addressLabel || '')};}),
  };
}
