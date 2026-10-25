import { Report } from '@nagarbondhu/shared';

// Explicit provenance only: ordinary complaints mentioning an exam or a test
// must remain citizen evidence. Older QA submissions used citizen_report.
export function reportSource(report: Pick<Report, 'sourceType' | 'title' | 'description'>): Report['sourceType'] {
  const text = report.title + '\n' + report.description;
  return report.sourceType === 'demo_seed' || /\bQA\s+(?:TEST|REPORT)\b|\b(?:TEST|DEMO|SYNTHETIC)\s+(?:REPORT|DATA)\b|বাস্তব অভিযোগ নয়|বাস্তব অভিযোগ নয়|(?:পরীক্ষামূলক|টেস্ট|ডেমো)\s+(?:QA\s+)?রিপোর্ট/im.test(text)
    ? 'demo_seed' : report.sourceType;
}
