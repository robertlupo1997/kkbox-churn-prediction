
/**
 * ROICalculator logic unit tests.
 * Note: These can be run with any JS testing framework like Vitest or Jest.
 */

const calculateROI = (subs: number, arpu: number, churn: number, reduction: number) => {
  const monthlyChurnCount = subs * (churn / 100);
  const usersSaved = monthlyChurnCount * (reduction / 100);
  const revenueSaved = usersSaved * arpu;
  const yearlySavings = revenueSaved * 12;
  return {
    monthlyChurnCount: Math.round(monthlyChurnCount),
    usersSaved: Math.round(usersSaved),
    revenueSaved: Math.round(revenueSaved),
    yearlySavings: Math.round(yearlySavings)
  };
};

describe('ROICalculator Logic', () => {
  test('correctly calculates savings for base scenario', () => {
    const result = calculateROI(100000, 149, 5.5, 15);
    // 5.5% of 100,000 = 5,500
    // 15% of 5,500 = 825 saved
    // 825 * 149 = 122,925 saved per month
    // 122,925 * 12 = 1,475,100 saved per year
    expect(result.monthlyChurnCount).toBe(5500);
    expect(result.usersSaved).toBe(825);
    expect(result.revenueSaved).toBe(122925);
    expect(result.yearlySavings).toBe(1475100);
  });

  test('handles zero reduction correctly', () => {
    const result = calculateROI(100000, 100, 10, 0);
    expect(result.usersSaved).toBe(0);
    expect(result.yearlySavings).toBe(0);
  });

  test('scales linearly with subscriber base', () => {
    const res1 = calculateROI(100000, 100, 10, 10);
    const res2 = calculateROI(200000, 100, 10, 10);
    expect(res2.yearlySavings).toBe(res1.yearlySavings * 2);
  });
});

// Mock helpers for standard testing frameworks
function describe(name: string, fn: Function) { console.log(`\nTesting: ${name}`); fn(); }
function test(name: string, fn: Function) { try { fn(); console.log(`  ✓ ${name}`); } catch (e) { console.error(`  ✕ ${name}: ${e.message}`); } }
function expect(val: any) {
  return {
    toBe: (expected: any) => { if (val !== expected) throw new Error(`Expected ${expected} but got ${val}`); },
    toEqual: (expected: any) => { if (JSON.stringify(val) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(val)}`); }
  };
}
