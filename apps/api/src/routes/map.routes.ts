import { Router } from 'express';
import { db } from '../db';
import { ReportCategory, ReportStatus, PriorityLevel } from '@nagarbondhu/shared';

const router = Router();

// GET /api/v1/map/reports
// Returns lightweight geospatial points with privacy protection
router.get('/reports', (req, res) => {
  const { category, status, priority, wardId } = req.query;

  const results = db.findReports({
    category: category as ReportCategory,
    status: status as ReportStatus,
    wardId: wardId as string,
    limit: 1000,
  });

  const markers = results.reports.map((r) => {
    const prio = db.findPriorityAssessmentByReportId(r.id);
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      status: r.status,
      priorityLevel: prio?.priorityLevel || ('MEDIUM' as PriorityLevel),
      priorityScore: prio?.score || 50,
      latitude: r.latitude,
      longitude: r.longitude,
      addressLabel: r.addressLabel,
      wardName: r.wardName,
      imageUrl: r.imageUrl,
      createdAt: r.createdAt,
    };
  });

  // Filter priority if requested
  const filtered = priority
    ? markers.filter((m) => m.priorityLevel === (priority as PriorityLevel))
    : markers;

  res.json({
    success: true,
    count: filtered.length,
    markers: filtered,
  });
});

export default router;
