import {
  calculateHaversineDistanceMeters,
  calculateTextSimilarity,
  assessDuplicate,
} from '@nagarbondhu/shared';

describe('Duplicate Detection Engine Unit Tests', () => {
  test('accurately calculates distance between Rajshahi points', () => {
    // Shaheb Bazar Zero Point (24.3636, 88.6241) and near RDA Market (24.3640, 88.6245)
    const distance = calculateHaversineDistanceMeters(24.3636, 88.6241, 24.3640, 88.6245);
    // Should be approx 60-70 meters
    expect(distance).toBeGreaterThan(40);
    expect(distance).toBeLessThan(100);
  });

  test('calculates Bengali text token similarity', () => {
    const textA = 'সাহেব বাজারে মূল রাস্তায় বড় গর্ত তৈরি হয়েছে এবং যানবাহন চলাচল বন্ধ।';
    const textB = 'সাহেব বাজারে রাস্তায় গর্ত তৈরি হয়েছে পথচারী চলাচল বিঘ্নিত।';

    const sim = calculateTextSimilarity(textA, textB);
    expect(sim).toBeGreaterThan(0.3);
  });

  test('flags proximate and semantically matching reports as potential duplicates', () => {
    const reportA = {
      latitude: 24.3636,
      longitude: 88.6241,
      category: 'ROAD_DAMAGE' as const,
      title: 'সাহেব বাজারে ভাঙা সড়ক',
      description: 'রাস্তায় বড় গর্ত তৈরি হয়েছে।',
    };

    const reportB = {
      latitude: 24.3639,
      longitude: 88.6243, // ~40m away
      category: 'ROAD_DAMAGE' as const,
      title: 'সাহেব বাজারে গর্তের কারণে দুর্ঘটনা',
      description: 'রাস্তায় বড় গর্তের জন্য গাড়ি আটকে যাচ্ছে।',
    };

    const result = assessDuplicate(reportA, reportB);
    expect(result.isPossibleDuplicate).toBe(true);
    expect(result.distanceMeters).toBeLessThan(100);
    expect(result.categoryMatch).toBe(true);
    expect(result.matchingReasons.distanceExplanation).toBeDefined();
  });

  test('does not flag reports far apart', () => {
    const reportShahebBazar = {
      latitude: 24.3636,
      longitude: 88.6241,
      category: 'ROAD_DAMAGE' as const,
      title: 'সাহেব বাজার রাস্তা',
      description: 'ভাঙা রাস্তা',
    };

    const reportKazihata = {
      latitude: 24.3820,
      longitude: 88.5895, // ~4km away
      category: 'ROAD_DAMAGE' as const,
      title: 'কাজীহাটা ভাঙা রাস্তা',
      description: 'ভাঙা রাস্তা',
    };

    const result = assessDuplicate(reportShahebBazar, reportKazihata);
    expect(result.isPossibleDuplicate).toBe(false);
  });
});
