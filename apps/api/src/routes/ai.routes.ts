import { Router } from 'express';
import { z } from 'zod';
import { analyzeBengaliComplaint } from '../services/ai.service';
import { PriorityService } from '../services/priority.service';
import { db } from '../db';
import { AiAnalysisRecord } from '@nagarbondhu/shared';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

const AnalyzeTextSchema = z.object({
  text: z.string().min(3, 'Complaint text must be at least 3 characters').max(6000),
  title: z.string().trim().max(300).optional(),
  allowFallback: z.boolean().default(false),
}).strict();

// POST /api/v1/ai/analyze-complaint
// Real-time analysis for citizen before final submission
router.post('/analyze-complaint', async (req, res, next) => {
  try {
    const { text, title, allowFallback } = AnalyzeTextSchema.parse(req.body);
    const result = await analyzeBengaliComplaint((title ? title+'\n' : '')+text, allowFallback);

    res.json({
      success: true,
      data: result.data,
      metadata: {
        provider: result.provider,
        modelName: result.modelName,
        isFallback: result.isFallback,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/reports/:id/analyze
// Re-analyze an existing report
router.post('/reports/:id/analyze', authenticate, requireRole(['ADMIN','URBAN_PLANNER']), async (req, res, next) => {
  try {
    const report = db.findReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const result = await analyzeBengaliComplaint(report.description);

    const aiRecord: AiAnalysisRecord = {
      id: report.aiAnalysis?.id || `ai-${report.id}`,
      reportId: report.id,
      provider: result.provider,
      modelName: result.modelName,
      category: result.data.category,
      suggestedCategory: result.data.category,
      summary: result.data.summary,
      severity: result.data.severity,
      confidence: result.data.confidence,
      reasons: result.data.reasons,
      missing_information: result.data.missing_information,
      createdAt: new Date().toISOString(),
    };

    db.saveAiAnalysis(aiRecord);

    // Also update priority
    PriorityService.assessReportPriority(report.id, { severity: result.data.severity });

    res.json({
      success: true,
      analysis: aiRecord,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
