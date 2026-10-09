import { AiAnalysisSchema, analyzeBengaliComplaint } from '../src/services/ai.service';

describe('AI Complaint Analysis Unit & Schema Tests', () => {
  test('validates correct AI response schema with Zod', () => {
    const validData = {
      category: 'WATERLOGGING',
      summary: 'বৃষ্টির পানিতে রাস্তা তলিয়ে গেছে এবং পথচারী চলাচল ব্যাহত।',
      severity: 4,
      confidence: 0.88,
      reasons: ['রাস্তায় কোমর সমান পানি', 'ড্রেন উপচে যাওয়ার বিবরণ'],
      missing_information: ['পানি কতক্ষণ জমে থাকে?'],
    };

    const parsed = AiAnalysisSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });

  test('rejects invalid categories or out-of-bounds severity', () => {
    const invalidData = {
      category: 'INVALID_CATEGORY',
      summary: 'Invalid summary',
      severity: 10, // out of 1-5 range
      reasons: [],
    };

    const parsed = AiAnalysisSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });

  test('successfully analyzes Bengali text and gracefully falls back without crashing when API key is missing', async () => {
    const complaint = 'তালাইমারী মোড়ে ড্রেন উপচে নোংরা পানি জমে পুরো এলাকা ডুবে গেছে।';
    const result = await analyzeBengaliComplaint(complaint);

    expect(result).toBeDefined();
    expect(result.data.category).toBe('WATERLOGGING');
    expect(result.data.severity).toBeGreaterThanOrEqual(1);
    expect(result.data.severity).toBeLessThanOrEqual(5);
    expect(result.data.reasons.length).toBeGreaterThan(0);
    expect(result.isFallback).toBe(true); // Since GEMINI_API_KEY is not set in test env
    expect(result.provider).toContain('Fallback');
  });

  test('correctly identifies broken streetlight complaint', async () => {
    const complaint = 'উপশহরে রাস্তার বাতি নষ্ট এবং রাতে পুরো সড়ক অন্ধকার থাকে।';
    const result = await analyzeBengaliComplaint(complaint);

    expect(result.data.category).toBe('STREETLIGHT');
    expect(result.data.reasons[0]).toContain('সড়কবাতি');
  });
});
