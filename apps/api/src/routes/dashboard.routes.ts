import { Router } from 'express';
import { db } from '../db';
import { InsightsService } from '../services/insights.service';

const router = Router();

// GET /api/v1/dashboard/summary
// Comprehensive live counts and aggregates derived from actual DB queries
router.get('/summary', (req, res) => {
  const summary = db.getDashboardSummary();
  res.json({
    success: true,
    data: summary,
  });
});

// GET /api/v1/dashboard/categories
router.get('/categories', (req, res) => {
  const summary = db.getDashboardSummary();
  res.json({
    success: true,
    categories: summary.byCategory,
  });
});

// GET /api/v1/dashboard/wards
router.get('/wards', (req, res) => {
  const summary = db.getDashboardSummary();
  res.json({
    success: true,
    wards: summary.byWard,
  });
});

// GET /api/v1/dashboard/trends
router.get('/trends', (req, res) => {
  const summary = db.getDashboardSummary();
  res.json({
    success: true,
    trends: {
      total: summary.totalReports,
      unresolvedOver7Days: summary.unresolvedOver7Days,
      resolutionRate:
        summary.totalReports > 0
          ? Math.round((summary.resolvedReports / summary.totalReports) * 100)
          : 0,
    },
  });
});

// GET /api/v1/dashboard/insights
// Synthesized planning intelligence and observations
router.get('/insights', async (req, res, next) => {
  try {
    const insights = await InsightsService.getPlanningInsights();
    res.json({
      success: true,
      data: insights,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
