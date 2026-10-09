import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { PriorityService } from '../services/priority.service';
import { ReportStatus, PriorityLevel } from '@nagarbondhu/shared';

const router = Router();

const UpdateStatusSchema = z.object({
  status: z.enum([
    'SUBMITTED',
    'AI_ANALYZED',
    'UNDER_REVIEW',
    'IN_PROGRESS',
    'RESOLVED',
    'REJECTED',
  ]),
  note: z.string().optional(),
});

const OverridePrioritySchema = z.object({
  priorityLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  reason: z.string().min(3, 'Override reason is required for audit trail'),
});

// PATCH /api/v1/admin/reports/:id/status
// Update report status with audit note
router.patch(
  '/reports/:id/status',
  authenticate,
  requireRole(['ADMIN', 'URBAN_PLANNER']),
  (req, res, next) => {
    try {
      const { status, note } = UpdateStatusSchema.parse(req.body);
      const existing = db.findReportById(req.params.id);

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Report not found' });
      }

      const previousStatus = existing.status;
      const resolvedAt = status === 'RESOLVED' ? new Date().toISOString() : null;

      const updated = db.updateReport(req.params.id, {
        status: status as ReportStatus,
        resolvedAt: resolvedAt || existing.resolvedAt,
      });

      // Audit history log
      db.addStatusHistory({
        id: `hist-${req.params.id}-${Date.now()}`,
        reportId: req.params.id,
        previousStatus,
        newStatus: status as ReportStatus,
        changedBy: req.user!.displayName,
        note: note || `স্ট্যাটাস পরিবর্তন করা হয়েছে: ${status}`,
        createdAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        report: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/admin/reports/:id/priority
// Admin overrides priority with audit reason
router.patch(
  '/reports/:id/priority',
  authenticate,
  requireRole(['ADMIN', 'URBAN_PLANNER']),
  (req, res, next) => {
    try {
      const { priorityLevel, reason } = OverridePrioritySchema.parse(req.body);
      const updated = PriorityService.overridePriority(
        req.params.id,
        priorityLevel as PriorityLevel,
        reason,
        req.user!.displayName
      );

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Report not found' });
      }

      res.json({
        success: true,
        priorityAssessment: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
