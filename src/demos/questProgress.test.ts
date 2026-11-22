import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadQuestFlags,
  readQuestSummaries,
  readRecentDemos,
  recordDemoVisit,
  reportQuestProgress,
  saveQuestFlags
} from './questProgress';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

describe('quest flags', () => {
  it('restores saved flags over the defaults', () => {
    saveQuestFlags('d', { a: true, b: false });
    expect(loadQuestFlags('d', { a: false, b: false, c: false })).toEqual({ a: true, b: false, c: false });
  });

  it('ignores unknown keys and non-boolean values', () => {
    (globalThis as any).localStorage.setItem('quests:d', JSON.stringify({ a: 'yes', zzz: true }));
    expect(loadQuestFlags('d', { a: false })).toEqual({ a: false });
  });

  it('survives corrupted storage', () => {
    (globalThis as any).localStorage.setItem('quests:d', '{not json');
    expect(loadQuestFlags('d', { a: false })).toEqual({ a: false });
  });

  it('works without any storage', () => {
    delete (globalThis as any).localStorage;
    expect(loadQuestFlags('d', { a: false })).toEqual({ a: false });
    expect(() => saveQuestFlags('d', { a: true })).not.toThrow();
  });
});

describe('progress summary', () => {
  it('keeps the best progress even after a reset in the demo', () => {
    reportQuestProgress('d', 3, 5, 1);
    reportQuestProgress('d', 0, 5, 2);
    expect(readQuestSummaries().d).toEqual({ done: 0, total: 5, best: 3, updatedAt: 2 });
  });

  it('clamps to the total and ignores demos without quests', () => {
    reportQuestProgress('d', 9, 5, 1);
    reportQuestProgress('none', 1, 0, 1);
    expect(readQuestSummaries().d.done).toBe(5);
    expect(readQuestSummaries().none).toBeUndefined();
  });
});

describe('recent demos', () => {
  it('lists the latest visits first, without duplicates, capped', () => {
    for (let i = 0; i < 8; i++) recordDemoVisit(`d${i}`, i);
    recordDemoVisit('d3', 100);
    const ids = readRecentDemos().map((v) => v.id);
    expect(ids[0]).toBe('d3');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(6);
  });
});
