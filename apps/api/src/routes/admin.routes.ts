import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authenticate, requireRole } from '../middleware/auth';
import { PriorityService } from '../services/priority.service';
import { PriorityLevel } from '@nagarbondhu/shared';
import { getPlan, transition, fail, event } from '../services/action.service';

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

      if (getPlan(req.params.id)) fail('Use action-status with the current plan revision for workflow changes.',409);
      if (status === 'AI_ANALYZED') fail('AI_ANALYZED is a system analysis state, not an administrative transition.');
      transition(req.params.id, { status, note: note || 'ওয়েব ড্যাশবোর্ড থেকে স্ট্যাটাস পরিবর্তন', revision: 0 }, req.user!.id);
      return res.json({success: true, report: db.findReportById(req.params.id)});
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

      const plan = getPlan(req.params.id);
      if (plan) db.actionPlans.set(plan.id, {...plan, priority: priorityLevel, revision: plan.revision + 1, updatedBy: req.user!.id, updatedAt: new Date().toISOString() });
      event(req.params.id, req.user!.id, 'PRIORITY_OVERRIDDEN', reason, {priorityLevel});

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
