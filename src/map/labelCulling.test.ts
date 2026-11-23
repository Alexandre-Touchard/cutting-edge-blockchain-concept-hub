import { describe, expect, it } from 'vitest';
import { cullLabels, type LabelCandidate } from './labelCulling';

const c = (id: string, x: number, y: number, priority: number, extra: Partial<LabelCandidate> = {}): LabelCandidate => ({
  id,
  x,
  y,
  anchor: 'start',
  text: 'Some label',
  fontPx: 11,
  priority,
  ...extra
});

describe('label culling', () => {
  it('keeps the more important of two overlapping labels', () => {
    expect([...cullLabels([c('low', 100, 100, 1), c('high', 105, 102, 5)], [])]).toEqual(['high']);
  });

  it('keeps labels that do not overlap', () => {
    expect(cullLabels([c('a', 100, 100, 1), c('b', 100, 200, 1)], []).size).toBe(2);
  });

  it('hides a label that would cover another item, but always draws forced ones', () => {
    const marker = { id: 'other', x: 130, y: 96, r: 8 };
    expect(cullLabels([c('a', 100, 100, 1)], [marker]).has('a')).toBe(false);
    expect(cullLabels([c('a', 100, 100, 1, { force: true }), c('b', 102, 101, 9)], [marker])).toEqual(new Set(['a']));
  });
});
