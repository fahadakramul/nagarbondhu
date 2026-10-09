import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { analyzeBengaliComplaint } from '../services/ai.service';
import { PriorityService } from '../services/priority.service';
import { DuplicateService } from '../services/duplicate.service';
import {
  Report,
  AiAnalysisRecord,
  ReportCategory,
  ReportStatus,
} from '@nagarbondhu/shared';

const router = Router();
const publicReport = (report: Report) => ({ ...report, reporterId: undefined, reporterName: undefined,
  possibleDuplicates: report.possibleDuplicates?.map(duplicate => ({...duplicate, candidateReport: duplicate.candidateReport ? {...duplicate.candidateReport, reporterId: undefined, reporterName: undefined} : undefined})),
});

const CreateReportSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  category: z.enum([
    'ROAD_DAMAGE',
    'WATERLOGGING',
    'DRAINAGE',
    'WASTE',
    'FOOTPATH',
    'STREETLIGHT',
    'OTHER',
  ]).optional(),
  userCategory: z.enum([
    'ROAD_DAMAGE',
    'WATERLOGGING',
    'DRAINAGE',
    'WASTE',
    'FOOTPATH',
    'STREETLIGHT',
    'OTHER',
  ]).optional(),
  latitude: z.number().min(20).max(28),
  longitude: z.number().min(85).max(95),
  addressLabel: z.string().optional(),
  wardId: z.string().optional(),
  imageUrl: z.string().optional().nullable().or(z.literal('')),
});

import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';
import { storeImage } from '../persistence';
import { randomUUID } from 'crypto';
import { photoSchema, fail } from '../services/action.service';

// POST /api/v1/reports/upload-image
// Accepts base64 image data and stores in uploads folder
router.post('/upload-image', async (req, res, next) => {
  try {
    const { imageBase64 } = req.body;
    if (typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    const matches = imageBase64.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: 'Invalid base64 image format' });
    }

    let ext = matches[1].split('/')[1] || 'jpeg';
    if (ext === 'jpeg' || ext === 'jpg') ext = 'jpg';
    else if (ext === 'png') ext = 'png';
    else if (ext === 'webp') ext = 'webp';
    else ext = 'jpg';

    const buffer = Buffer.from(matches[2], 'base64');
    const valid = matches[1] === 'image/png' ? buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) : matches[1] === 'image/jpeg' ? buffer.subarray(0,3).equals(Buffer.from('ffd8ff','hex')) : buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP';
    if (!valid || buffer.length > 4 * 1024 * 1024) return res.status(400).json({success:false,error:'Use a valid JPEG, PNG or WebP image up to 4 MB.'});
    const filename = `img_${randomUUID()}.${ext}`;
    const uploadsDir = CONFIG.UPLOAD_DIR;
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const uploadPath = path.join(uploadsDir, filename);

    if (!(await storeImage(filename, matches[1], buffer))) fs.writeFileSync(uploadPath, buffer);

    res.json({
      success: true,
      imageUrl: `/uploads/${filename}`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/reports
// Submit a civic report with end-to-end AI analysis, priority scoring & duplicate detection
router.post('/', optionalAuthenticate, async (req, res, next) => {
  try {
    const input = CreateReportSchema.parse(req.body);
    if (input.wardId && !db.wards.has(input.wardId)) fail('Unknown ward; select an available ward.');
    if (input.imageUrl) photoSchema.parse(input.imageUrl);
    const reportId = `rep-${Date.now()}`;
    const reporterId = req.user?.id || null;
    const reporterName = req.user?.displayName || 'সচেতন নাগরিক';

    // 1. Run AI Analysis on Bengali complaint text
    const aiResult = await analyzeBengaliComplaint(input.description);
    const finalCategory: ReportCategory = input.userCategory || input.category || aiResult.data.category;

    // Resolve Ward if not provided, by nearest ward center
    let wardId = input.wardId || null;
    let wardName: string | null = null;
    if (wardId) {
      const ward = db.findWardById(wardId);
      wardName = ward?.wardName || null;
    } else {
      // Find closest ward from Rajshahi wards
      const allWards = db.getAllWards();
      if (allWards.length > 0) {
        let closest = allWards[0];
        let minDiff = 999;
        allWards.forEach((w) => {
          const diff = Math.hypot(w.centerLatitude - input.latitude, w.centerLongitude - input.longitude);
          if (diff < minDiff) {
            minDiff = diff;
            closest = w;
          }
        });
        wardId = closest.id;
        wardName = closest.wardName;
      }
    }

    // 2. Create Base Report
    const newReport: Report = {
      id: reportId,
      reporterId,
      reporterName,
      title: input.title,
      description: input.description,
      category: finalCategory,
      userCategory: input.userCategory || null,
      latitude: input.latitude,
      longitude: input.longitude,
      addressLabel: input.addressLabel || 'রাজশাহী',
      wardId,
      wardName,
      imageUrl: input.imageUrl || null,
      status: 'AI_ANALYZED',
      sourceType: 'citizen_report',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createReport(newReport);

    // 3. Save AI Analysis Record
    const aiRecord: AiAnalysisRecord = {
      id: `ai-${reportId}`,
      reportId,
      provider: aiResult.provider,
      modelName: aiResult.modelName,
      category: aiResult.data.category,
      suggestedCategory: aiResult.data.category,
      summary: aiResult.data.summary,
      severity: aiResult.data.severity,
      confidence: aiResult.data.confidence,
      reasons: aiResult.data.reasons,
      missing_information: aiResult.data.missing_information,
      createdAt: new Date().toISOString(),
    };
    db.saveAiAnalysis(aiRecord);
    newReport.aiAnalysis = aiRecord;

    // 4. Compute Explainable Priority
    const priorityRecord = PriorityService.assessReportPriority(reportId, {
      severity: aiResult.data.severity,
    });
    newReport.priorityAssessment = priorityRecord;

    // 5. Scan for Potential Duplicates in vicinity
    const duplicates = DuplicateService.checkForDuplicates(newReport);
    newReport.possibleDuplicates = duplicates;

    // 6. Record Status History
    db.addStatusHistory({
      id: `hist-${reportId}-1`,
      reportId,
      previousStatus: 'SUBMITTED',
      newStatus: 'AI_ANALYZED',
      changedBy: 'নগরবন্ধু এআই ইঞ্জিন',
      note: 'অভিযোগ সফলভাবে গ্রহণ এবং এআই ক্যাটাগরি বিশ্লেষণ সম্পন্ন হয়েছে।',
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      report: newReport,
      flaggedDuplicateCount: duplicates.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports
// Public report feed with filters and sanitized reporter privacy
router.get('/', (req, res) => {
  const { category, status, priority, wardId, limit, offset } = req.query;

  const results = db.findReports({
    category: category as ReportCategory,
    status: status as ReportStatus,
    wardId: wardId as string,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0,
  });

  // Sanitize reports (strip private reporter ids)
  const sanitized = results.reports.map(publicReport);

  res.json({
    success: true,
    total: results.total,
    reports: sanitized,
  });
});

// GET /api/v1/users/me/reports
// Protected: Citizen's own submitted reports
router.get('/me/reports', authenticate, (req, res) => {
  const results = db.findReports({
    reporterId: req.user!.id,
    limit: 100,
  });

  res.json({
    success: true,
    total: results.total,
    reports: results.reports,
  });
});

// GET /api/v1/reports/:id
// Detailed view for a single report
router.get('/:id', (req, res) => {
  const report = db.findReportById(req.params.id);
  if (!report) {
    return res.status(404).json({ success: false, error: 'Report not found' });
  }

  res.json({
    success: true,
    report: publicReport(report),
  });
});

// PATCH /api/v1/reports/:id
// Citizen updates their own report details
router.patch('/:id', authenticate, (req, res, next) => {
  try {
    const report = db.findReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // Ownership or admin check
    if (report.reporterId !== req.user!.id && req.user!.role === 'CITIZEN') {
      return res.status(403).json({ success: false, error: 'Cannot modify reports of other citizens' });
    }

    const updates = CreateReportSchema.pick({title:true,description:true,category:true,addressLabel:true}).partial().strict().parse(req.body);

    const updated = db.updateReport(req.params.id, updates);
    res.json({ success: true, report: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
