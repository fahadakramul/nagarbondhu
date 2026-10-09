import { PriorityBreakdown, PriorityLevel } from './types';

export interface PriorityCalculationInput {
  severity: number;           // 1 to 5 (from AI or reviewer)
  impact?: number;            // 1 to 5 (estimated people affected: 1=single household, 5=major arterial road/market)
  recurrence?: number;        // 1 to 5 (frequency: 1=first time, 5=chronic problem)
  reportAgeInDays?: number;   // days since submission
  isCriticalSafety?: boolean; // immediate hazard trigger (open manhole, live wire near water)
  safetyReason?: string;
}

/**
 * Deterministic Explainable Priority Engine for NagarBondhu AI
 * Formula: P = 20 * (0.40*S + 0.30*I + 0.20*R + 0.10*D)
 *
 * S = Severity (1-5)
 * I = Estimated Impact (1-5)
 * R = Recurrence (1-5)
 * D = Report Age Factor (1-5)
 *
 * Range: 20 to 100
 */
export function calculatePriorityScore(input: PriorityCalculationInput): PriorityBreakdown {
  // Clamp severity between 1 and 5
  const S = Math.min(5, Math.max(1, Math.round(input.severity || 1)));

  // Estimate impact if missing (default to 2: moderate neighborhood impact)
  const I = Math.min(5, Math.max(1, Math.round(input.impact ?? 2)));
  const impactIsEstimated = input.impact === undefined;

  // Estimate recurrence if missing (default to 1: first report)
  const R = Math.min(5, Math.max(1, Math.round(input.recurrence ?? 1)));
  const recurrenceIsEstimated = input.recurrence === undefined;

  // Convert report age in days to age factor (1 to 5)
  // 0-1 day = 1, 2-3 days = 2, 4-7 days = 3, 8-14 days = 4, 15+ days = 5
  const ageDays = Math.max(0, input.reportAgeInDays ?? 0);
  let D = 1;
  if (ageDays >= 15) D = 5;
  else if (ageDays >= 8) D = 4;
  else if (ageDays >= 4) D = 3;
  else if (ageDays >= 2) D = 2;

  // Calculate weighted terms
  const sContrib = 0.40 * S;
  const iContrib = 0.30 * I;
  const rContrib = 0.20 * R;
  const dContrib = 0.10 * D;

  const rawScore = Math.round(20 * (sContrib + iContrib + rContrib + dContrib) * 10) / 10;
  // Normalized 0 to 100 for easy display
  const normalizedScore = Math.round(((rawScore - 20) / 80) * 100);

  // Safety trigger check
  const safetyTriggered = Boolean(input.isCriticalSafety || (S === 5 && (input.safetyReason || '').length > 0));

  // Determine Priority Level based on transparent thresholds
  let priorityLevel: PriorityLevel;
  if (safetyTriggered || rawScore >= 85) {
    priorityLevel = 'CRITICAL';
  } else if (rawScore >= 65) {
    priorityLevel = 'HIGH';
  } else if (rawScore >= 45) {
    priorityLevel = 'MEDIUM';
  } else {
    priorityLevel = 'LOW';
  }

  // Generate transparent Bengali/English human-readable explanation
  const factors = [
    {
      name: 'তীব্রতা (Severity - 40%)',
      value: S,
      weight: '40%',
      contribution: Math.round(20 * sContrib * 10) / 10,
      note: `সমস্যার প্রত্যক্ষ ক্ষতি ও বিপদের মাত্রা (${S}/৫)`,
    },
    {
      name: 'প্রভাবিত নাগরিক (Estimated Impact - 30%)',
      value: I,
      weight: '30%',
      contribution: Math.round(20 * iContrib * 10) / 10,
      note: impactIsEstimated
        ? 'জনসংখ্যার উপর আনুমানিক প্রভাব (প্রাথমিক মান ধরা হয়েছে)'
        : `প্রভাবিত এলাকার পরিধি (${I}/৫)`,
    },
    {
      name: 'পুনরাবৃত্তি (Recurrence - 20%)',
      value: R,
      weight: '20%',
      contribution: Math.round(20 * rContrib * 10) / 10,
      note: recurrenceIsEstimated
        ? 'পুনরাবৃত্তির তথ্য পর্যালোচনাধীন'
        : `পূর্বে একই ধরনের সমস্যার পুনরাবৃত্তি (${R}/৫)`,
    },
    {
      name: 'রিপোর্টের বয়স (Report Age - 10%)',
      value: D,
      weight: '10%',
      contribution: Math.round(20 * dContrib * 10) / 10,
      note: `${ageDays} দিন ধরে অমীমাংসিত (বয়সের ফ্যাক্টর: ${D}/৫)`,
    },
  ];

  let summary = `নির্ধারিত প্রায়োরিটি স্কোর: ${rawScore}/১০০ (${priorityLevel === 'CRITICAL' ? 'জরুরি নিরাপত্তা সতর্কতা' : priorityLevel === 'HIGH' ? 'উচ্চ অগ্রাধিকার' : priorityLevel === 'MEDIUM' ? 'মধ্যম অগ্রাধিকার' : 'স্বাভাবিক'})।`;
  if (safetyTriggered) {
    summary += ` ⚠️ নিরাপত্তা ঝুঁকি বিদ্যমান: ${input.safetyReason || 'তাৎক্ষণিক নাগরিক নিরাপত্তা ঝুঁকি চিহ্নিত হয়েছে'}।`;
  }

  return {
    severityFactor: S,
    impactFactor: I,
    recurrenceFactor: R,
    ageFactor: D,
    rawScore,
    normalizedScore,
    priorityLevel,
    urgentReviewRequired: safetyTriggered,
    explanation: {
      summary,
      factors,
      safetyTriggerTriggered: safetyTriggered,
      safetyTriggerReason: input.safetyReason,
    },
  };
}
