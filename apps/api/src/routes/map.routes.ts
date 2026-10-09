import { Router } from 'express';
import { db } from '../db';
import { ReportCategory, ReportStatus, PriorityLevel } from '@nagarbondhu/shared';
import { publicText } from '../services/privacy';
import { z } from 'zod';
import { workflowStatus } from '../services/action.service';

const router = Router();

// GET /api/v1/map/reports
// Returns lightweight geospatial points with privacy protection
router.get('/reports', (req, res, next) => {
  try {
  z.object({category:z.enum(['ROAD_DAMAGE','WATERLOGGING','DRAINAGE','WASTE','FOOTPATH','STREETLIGHT','OTHER']).optional(),status:z.string().max(40).optional(),priority:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),wardId:z.string().max(100).optional()}).strict().parse(req.query);
  const { category, status, priority, wardId } = req.query;

  const results = db.findReports({
    category: category as ReportCategory,
    wardId: wardId as string,
    limit: db.reports.size,
  });

  const markers = results.reports.map((r) => {
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
      wardName: r.wardName,
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
