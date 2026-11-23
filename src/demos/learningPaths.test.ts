import { describe, expect, it } from 'vitest';
import { demoMetaRegistry } from './demoRegistry';
import { isNewDemo, LEARNING_PATHS, START_DEMO_ID } from './learningPaths';

const registryIds = new Set(Object.values(demoMetaRegistry).map((m) => m.id));

describe('learning paths', () => {
  it('only reference demos that exist in the registry', () => {
    for (const p of LEARNING_PATHS) for (const id of p.demoIds) expect(registryIds.has(id), `${p.id}: ${id}`).toBe(true);
  });

  it('cover every demo exactly once', () => {
    const all = LEARNING_PATHS.flatMap((p) => p.demoIds);
    expect(new Set(all).size).toBe(all.length);
    expect([...registryIds].filter((id) => !all.includes(id!))).toEqual([]);
  });

  it('start with a live beginner demo', () => {
    const start = Object.values(demoMetaRegistry).find((m) => m.id === START_DEMO_ID)!;
    expect(start.difficulty).toBe('Beginner');
    expect(start.status).not.toBe('coming_soon');
  });
});

describe('learning quests', () => {
  it('every demo declares how many quests it has (shown on hub cards and in the header widget)', () => {
    const missing = Object.values(demoMetaRegistry)
      .filter((m) => !(m.learningQuestsTotal && m.learningQuestsTotal > 0))
      .map((m) => m.id);
    expect(missing).toEqual([]);
  });
});

describe('isNewDemo', () => {
  const now = new Date('2026-12-01T00:00:00Z');
  it('is true within the window and false outside or without a date', () => {
    expect(isNewDemo('2026-11-22', now)).toBe(true);
    expect(isNewDemo('2026-03-28', now)).toBe(false);
    expect(isNewDemo(undefined, now)).toBe(false);
    expect(isNewDemo('2027-01-01', now)).toBe(false);
  });
});
