import { calculatePriorityScore } from '@nagarbondhu/shared';

describe('Priority Engine Unit Tests', () => {
  test('correctly calculates deterministic score using P = 20 * (0.40S + 0.30I + 0.20R + 0.10D)', () => {
    // S=4, I=5, R=4, D=2
    // 0.40*4 = 1.6
    // 0.30*5 = 1.5
    // 0.20*4 = 0.8
    // 0.10*2 = 0.2
    // sum = 4.1
    // P = 20 * 4.1 = 82
    const result = calculatePriorityScore({
      severity: 4,
      impact: 5,
      recurrence: 4,
      reportAgeInDays: 3, // ageFactor = 2
    });

    expect(result.rawScore).toBe(82);
    expect(result.priorityLevel).toBe('HIGH');
    expect(result.severityFactor).toBe(4);
    expect(result.impactFactor).toBe(5);
    expect(result.explanation.factors).toHaveLength(4);
  });

  test('triggers critical safety alert when isCriticalSafety is true', () => {
    const result = calculatePriorityScore({
      severity: 3,
      impact: 2,
      recurrence: 1,
      reportAgeInDays: 0,
      isCriticalSafety: true,
      safetyReason: 'উন্মুক্ত ম্যানহোল এবং ছেঁড়া বৈদ্যুতিক তার',
    });

    expect(result.urgentReviewRequired).toBe(true);
    expect(result.priorityLevel).toBe('CRITICAL');
    expect(result.explanation.safetyTriggerTriggered).toBe(true);
    expect(result.explanation.summary).toContain('নিরাপত্তা ঝুঁকি বিদ্যমান');
  });

  test('clamps severity between 1 and 5', () => {
    const low = calculatePriorityScore({ severity: -2 });
    expect(low.severityFactor).toBe(1);

    const high = calculatePriorityScore({ severity: 10 });
    expect(high.severityFactor).toBe(5);
  });
});
