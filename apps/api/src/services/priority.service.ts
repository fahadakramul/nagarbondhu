import {
  calculatePriorityScore,
  PriorityCalculationInput,
  PriorityAssessmentRecord,
  PriorityLevel,
} from '@nagarbondhu/shared';
import { db } from '../db';

export class PriorityService {
  /**
   * Evaluates or recalculates priority for a given report
   */
  static assessReportPriority(
    reportId: string,
    options?: {
      severity?: number;
      impact?: number;
      recurrence?: number;
      isCriticalSafety?: boolean;
      safetyReason?: string;
    }
  ): PriorityAssessmentRecord | null {
    const report = db.findReportById(reportId);
    if (!report) return null;

    // Determine days since submission
    const createdDate = new Date(report.createdAt).getTime();
    const ageInDays = Math.max(0, Math.floor((Date.now() - createdDate) / (1000 * 60 * 60 * 24)));

    // Use AI severity if not explicitly provided
    const severity = options?.severity ?? report.aiAnalysis?.severity ?? 3;

    // Detect critical safety indicators in description/title
    const textLower = (report.title + ' ' + report.description).toLowerCase();
    const hasSafetyKeywords =
      textLower.includes('ম্যানহোল') ||
      textLower.includes('খোলা') ||
      textLower.includes('বিদ্যুৎ') ||
      textLower.includes('তার') ||
      textLower.includes('বিপদ') ||
      textLower.includes('কোমর পানি');

    const isCritical = options?.isCriticalSafety ?? (severity >= 4 && hasSafetyKeywords);
    const safetyReason = options?.safetyReason ?? (isCritical ? 'মারাত্মক জননিরাপত্তা বা স্বাস্থ্য ঝুঁকি বিদ্যমান' : undefined);

    const input: PriorityCalculationInput = {
      severity,
      impact: options?.impact ?? 3,
      recurrence: options?.recurrence ?? 2,
      reportAgeInDays: ageInDays,
      isCriticalSafety: isCritical,
      safetyReason,
    };

    const breakdown = calculatePriorityScore(input);

    const record: PriorityAssessmentRecord = {
      id: `prio-${reportId}`,
      reportId,
      severityFactor: breakdown.severityFactor,
      impactFactor: breakdown.impactFactor,
      recurrenceFactor: breakdown.recurrenceFactor,
      ageFactor: breakdown.ageFactor,
      score: breakdown.rawScore,
      priorityLevel: breakdown.priorityLevel,
      explanation: breakdown.explanation,
      assessedAt: new Date().toISOString(),
    };

    return db.savePriorityAssessment(record);
  }

  /**
   * Allows an authorized admin to manually override the priority
   */
  static overridePriority(
    reportId: string,
    overrideLevel: PriorityLevel,
    overrideReason: string,
    adminId: string
  ): PriorityAssessmentRecord | null {
    const existing = db.findPriorityAssessmentByReportId(reportId);
    if (!existing) return null;

    existing.priorityLevel = overrideLevel;
    existing.overriddenBy = adminId;
    existing.overrideReason = overrideReason;
    existing.assessedAt = new Date().toISOString();

    return db.savePriorityAssessment(existing);
  }
}
