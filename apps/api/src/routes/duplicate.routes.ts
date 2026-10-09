import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { DuplicateService } from '../services/duplicate.service';

const router = Router();

// GET /api/v1/reports/:id/possible-duplicates
router.get('/reports/:id/possible-duplicates', (req, res) => {
  const duplicates = db.findDuplicatesForReport(req.params.id);
  res.json({
    success: true,
    count: duplicates.length,
    duplicates,
  });
});

const ReviewDuplicateSchema = z.object({
  reviewStatus: z.enum(['CONFIRMED_DUPLICATE', 'DISMISSED']),
});

// POST /api/v1/duplicates/:id/review
// Admin / Urban Planner confirms or rejects duplicate flag
router.post(
  '/duplicates/:id/review',
  authenticate,
  requireRole(['ADMIN', 'URBAN_PLANNER']),
  (req, res, next) => {
    try {
      const { reviewStatus } = ReviewDuplicateSchema.parse(req.body);
      const updated = DuplicateService.reviewDuplicate(
        req.params.id,
        reviewStatus,
        req.user!.displayName
      );

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Duplicate record not found' });
      }

      res.json({
        success: true,
        duplicate: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
