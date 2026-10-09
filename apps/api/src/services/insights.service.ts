import { db } from '../db';
import { CONFIG } from '../config';

export class InsightsService {
  /**
   * Generates planning insights from real database records
   */
  static async getPlanningInsights() {
    const summary = db.getDashboardSummary();

    // Find highest frequency category
    const sortedCategories = [...summary.byCategory].sort((a, b) => b.count - a.count);
    const topCategory = sortedCategories[0];

    // Find wards with most high-priority issues
    const criticalWards = [...summary.byWard]
      .filter((w) => w.highPriorityCount > 0)
      .sort((a, b) => b.highPriorityCount - a.highPriorityCount);

    // Formulate verified empirical observations
    const observations = [
      `সর্বাধিক নাগরিক অভিযোগ (${topCategory?.percentage || 0}%) '${topCategory?.categoryLabelBn || 'সড়ক'}' বিভাগে জমা পড়েছে।`,
      `বর্তমানে ${summary.unresolvedOver7Days}টি অভিযোগ ৭ দিনের বেশি সময় ধরে অমীমাংসিত রয়েছে, যা দ্রুত মনিটরিং প্রয়োজন।`,
      `${summary.hotspots.length}টি প্রধান এলাকায় ঘন ঘন সমস্যা দেখা যাচ্ছে (হটস্পট), যার মধ্যে '${summary.hotspots[0]?.areaName}' অন্যতম।`,
      `মোট চিহ্নিত সম্ভাব্য ডুপ্লিকেট অভিযোগের সংখ্যা ${summary.duplicateReportsFlagged}টি, যা পুনরাবৃত্তির প্রবণতা প্রমাণ করে।`,
    ];

    let aiPlanningSummary: string | null = null;

    // Optional LLM synthesis using only verified metrics
    if (CONFIG.GEMINI_API_KEY) {
      try {
        const prompt = `You are an urban planning analyst for Rajshahi, Bangladesh.
Write a 3-bullet concise Bengali executive planning brief based ONLY on these verified database numbers. Do not invent any numbers or external claims.
- Total reports: ${summary.totalReports}
- Open/Under review: ${summary.openReports}
- Resolved: ${summary.resolvedReports}
- Top Category: ${topCategory?.categoryLabelBn} (${topCategory?.count} reports)
- Unresolved > 7 days: ${summary.unresolvedOver7Days}
- Top Hotspot: ${summary.hotspots[0]?.areaName}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        if (res.ok) {
          const json: any = await res.json();
          aiPlanningSummary = json?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }
      } catch (e) {
        // Silently fall back to deterministic observations
      }
    }

    return {
      summary,
      observations,
      aiPlanningSummary,
      sourceNote: 'এই পর্যবেক্ষণগুলো নগরবন্ধু এআই প্ল্যাটফর্মে সংরক্ষিত বাস্তব রিপোর্টের গাণিতিক বিশ্লেষণের ভিত্তিতে তৈরি। এটি সামগ্রিক রাজশাহী শহরের পূর্ণাঙ্গ শুমারি নয়।',
    };
  }
}
