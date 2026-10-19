import { Router } from 'express';
import { db } from '../db';
import { ReportCategory, ReportStatus, PriorityLevel } from '@nagarbondhu/shared';
import { publicText } from '../services/privacy';
import { z } from 'zod';
import { workflowStatus, getPlan } from '../services/action.service';
import { AnalyticsQueryBase, filteredReports } from '../services/analytics.service';

const router = Router();

// GET /api/v1/map/reports
// Returns lightweight geospatial points with privacy protection
router.get('/reports', (req, res, next) => {
  try {
  const { status, priority, ...filters }=AnalyticsQueryBase.extend({status:z.string().max(40).optional(),priority:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional()}).refine(q=>!q.from||!q.to||q.from<=q.to,'Invalid date range').parse(req.query);
  const markers = filteredReports(filters).map((r) => {
    const prio = db.findPriorityAssessmentByReportId(r.id);
    return {
      id: r.id,
      title: publicText(r.title),
      category: r.category,
      status: workflowStatus(r),
      sourceType:r.sourceType,
      priorityLevel: prio?.priorityLevel || null,
      priorityScore: prio?.score ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
      addressLabel: publicText(r.addressLabel || ""),
      wardId: getPlan(r.id)?.wardId || r.wardId,
      wardName: r.wardName,
      locationConfirmed:Array.from(db.submissionReceipts.values()).some(s=>s.reportId===r.id&&s.locationConfirmed),
      imageUrl: r.imageUrl,
      createdAt: r.createdAt,
    };
  });

  // Filter priority if requested
  const filtered = markers.filter(m=>(!priority || m.priorityLevel===priority)&&(!status || m.status===status));

  res.json({
    success: true,
    count: filtered.length,
    markers: filtered,
  });
  } catch(error) { next(error); }
});

export default router;
