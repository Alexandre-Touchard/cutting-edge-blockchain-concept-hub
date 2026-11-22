import { describe, expect, it } from 'vitest';
import { clamp, computeCR, fmt, initialAlgorithmic, initialCollateralized, outcomeLabel, pct, severityFromRange } from './model';

describe('stablecoin model', () => {
  it('starts the collateralised scenario at the spec values: $1, 165% collateral ratio', () => {
    const s = initialCollateralized();
    expect(s.stablePrice).toBe(1);
    expect(computeCR(s)).toBeCloseTo(1.65, 10);
    expect(s.lastTick.equity).toBeCloseTo(s.collateralValue - s.debt, 10);
  });

  it('starts the algorithmic scenario on the peg', () => {
    const s = initialAlgorithmic();
    expect(s.stablePrice).toBeCloseTo(1, 10);
  });

  it('classifies the outcome by price', () => {
    expect(outcomeLabel(1)).toBe('peg');
    expect(outcomeLabel(0.99)).toBe('peg');
    expect(outcomeLabel(1.01)).toBe('peg');
    expect(outcomeLabel(0.95)).toBe('depeg');
    expect(outcomeLabel(0.8)).toBe('depeg');
    expect(outcomeLabel(0.79)).toBe('collapse');
  });

  it('clamps and scales severities to [0, 1]', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(severityFromRange(0, 0, 10)).toBe(0);
    expect(severityFromRange(10, 0, 10)).toBe(1);
    expect(severityFromRange(20, 0, 10)).toBe(1);
    expect(severityFromRange(0, 0, 10, { invert: true })).toBe(1);
  });

  it('formats numbers and percentages', () => {
    expect(fmt(1.234, 2)).toBe('1.23');
    expect(pct(0.5)).toBe('50%');
  });
});
