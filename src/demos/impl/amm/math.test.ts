import { describe, expect, it } from 'vitest';
import { amountAfterFee, impermanentLossPercent, priceImpactPercent, swapOutput } from './math';

describe('swapOutput', () => {
  it('keeps x × y = k constant when there is no fee', () => {
    const out = swapOutput(1000, 2000, 100, 0);
    expect((1000 + 100) * (2000 - out)).toBeCloseTo(1000 * 2000, 6);
  });

  it('matches a hand-computed swap with a 0.3% fee', () => {
    // 99.7 enters the pool: 2000 − 2,000,000 / 1099.7
    expect(swapOutput(1000, 2000, 100, 0.3)).toBeCloseTo(181.3222, 4);
  });

  it('never drains the output reserve, even for huge trades', () => {
    expect(swapOutput(1000, 2000, 1e12, 0.3)).toBeLessThan(2000);
  });

  it('returns 0 for non-positive input', () => {
    expect(swapOutput(1000, 2000, 0, 0.3)).toBe(0);
    expect(swapOutput(1000, 2000, -5, 0.3)).toBe(0);
  });

  it('gives less output with a higher fee', () => {
    expect(swapOutput(1000, 2000, 100, 1)).toBeLessThan(swapOutput(1000, 2000, 100, 0.3));
  });
});

describe('amountAfterFee', () => {
  it('removes the fee percentage', () => {
    expect(amountAfterFee(100, 0.3)).toBeCloseTo(99.7, 10);
  });
});

describe('priceImpactPercent', () => {
  it('is about 10% when swapping 10% of the input reserve (A → B)', () => {
    // Regression: the demo used to compare A-per-B with B-per-A and showed ~72%.
    const out = swapOutput(1000, 2000, 100, 0);
    expect(priceImpactPercent(1000, 2000, 100, out)).toBeCloseTo(10, 6);
  });

  it('is symmetric in direction (B → A uses the same units)', () => {
    const out = swapOutput(2000, 1000, 200, 0);
    expect(priceImpactPercent(2000, 1000, 200, out)).toBeCloseTo(10, 6);
  });

  it('is close to 0 for a tiny trade', () => {
    const out = swapOutput(1000, 2000, 0.001, 0);
    expect(priceImpactPercent(1000, 2000, 0.001, out)).toBeLessThan(0.001);
  });

  it('grows with trade size', () => {
    const impact = (amt: number) => priceImpactPercent(1000, 2000, amt, swapOutput(1000, 2000, amt, 0.3));
    expect(impact(10)).toBeLessThan(impact(100));
    expect(impact(100)).toBeLessThan(impact(500));
  });
});

describe('impermanentLossPercent', () => {
  it('is 0 when the price has not moved', () => {
    expect(impermanentLossPercent(1)).toBeCloseTo(0, 10);
  });

  it('matches the reference values shown in the glossary', () => {
    expect(impermanentLossPercent(2)).toBeCloseTo(-5.72, 2);
    expect(impermanentLossPercent(5)).toBeCloseTo(-25.46, 2);
  });

  it('is the same for a price that halves or doubles', () => {
    expect(impermanentLossPercent(0.5)).toBeCloseTo(impermanentLossPercent(2), 10);
  });

  it('is never positive', () => {
    for (const r of [0.01, 0.3, 0.9, 1.1, 3, 100]) expect(impermanentLossPercent(r)).toBeLessThan(0);
  });
});
