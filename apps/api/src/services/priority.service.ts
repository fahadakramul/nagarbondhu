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
      textLower.includes('খোলা বৈদ্যুতিক তার') || textLower.includes('exposed wire') || textLower.includes('open manhole') ||
      textLower.includes('বিপদ') ||
      textLower.includes('কোমর পানি');

    const isCritical = options?.isCriticalSafety ?? (severity >= 4 && hasSafetyKeywords);
    const safetyReason = options?.safetyReason ?? (isCritical ? 'মারাত্মক জননিরাপত্তা বা স্বাস্থ্য ঝুঁকি বিদ্যমান' : undefined);

    const corroborating = db.findDuplicatesForReport(reportId).filter(d=>d.reviewStatus==='CONFIRMED_DUPLICATE').length;
    const recurrence = options?.recurrence ?? 0;
    const impact = options?.impact ?? 0;
    const severityWeight = Number(process.env.PRIORITY_SEVERITY_WEIGHT || 0.65);
    const ageWeight = Number(process.env.PRIORITY_AGE_WEIGHT || 0.25);
    const evidenceWeight = Number(process.env.PRIORITY_EVIDENCE_WEIGHT || 0.10);
    if (![severityWeight,ageWeight,evidenceWeight].every(w=>Number.isFinite(w)&&w>=0) || Math.abs(severityWeight+ageWeight+evidenceWeight-1)>0.001) throw new Error('Priority weights must be nonnegative and sum to one');
    const age = Math.min(5, 1+Math.floor(ageInDays/7));
    const evidence = Math.min(5,corroborating);
    const rawScore = Math.round(20*(severityWeight*severity+ageWeight*age+evidenceWeight*evidence));
    const priorityLevel: PriorityLevel = isCritical ? 'CRITICAL' : rawScore>=65 ? 'HIGH' : rawScore>=40 ? 'MEDIUM' : 'LOW';
    const explanation = {
      summary: 'Priority Engine 2.0: অভিযোগে বর্ণিত তীব্রতা, বয়স ও যাচাইকৃত সমর্থনের ভিত্তিতে পর্যালোচনার সুপারিশ। মাঠপর্যায়ে যাচাই হয়নি।',
      factors: [
        {name:'Reported severity',value:severity,weight:String(severityWeight),contribution:20*severityWeight*severity,note:'Classification is provisional, not an engineering assessment'},
        {name:'Unresolved report age',value:age,weight:String(ageWeight),contribution:20*ageWeight*age,note:`${ageInDays} days since submission; actual problem duration may differ`},
        {name:'Verified corroboration',value:evidence,weight:String(evidenceWeight),contribution:20*evidenceWeight*evidence,note:'Administrative duplicate confirmation only; does not independently establish severity'},
        {name:'Public impact / recurrence',value:0,weight:'0',contribution:0,note:'Unknown unless evidence is supplied; no assumed population impact'},
        {name:'Location / classification confidence',value:0,weight:'0',contribution:0,note:'Official ward boundaries, critical infrastructure, calibrated classification confidence and recurrence evidence are unavailable'},
      ], safetyTriggerTriggered:isCritical,safetyTriggerReason:isCritical?'Potential safety concern described; urgent field review required':undefined,
    };

    const record: PriorityAssessmentRecord = {
      id: `prio-${reportId}`,
      reportId,
      severityFactor: severity,
      impactFactor: impact,
      recurrenceFactor: recurrence,
      ageFactor: age,
      score: rawScore,
      priorityLevel: priorityLevel,
      explanation: explanation,
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
