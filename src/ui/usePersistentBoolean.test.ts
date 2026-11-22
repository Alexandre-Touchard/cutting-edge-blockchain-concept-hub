import { beforeEach, describe, expect, it } from 'vitest';
import { readBooleanPreference, writeBooleanPreference } from './usePersistentBoolean';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

describe('boolean preferences', () => {
  it('uses the default until something is saved', () => {
    expect(readBooleanPreference('k', true)).toBe(true);
    expect(readBooleanPreference('k', false)).toBe(false);
  });

  it('remembers false as well as true', () => {
    writeBooleanPreference('k', false);
    expect(readBooleanPreference('k', true)).toBe(false);
    writeBooleanPreference('k', true);
    expect(readBooleanPreference('k', false)).toBe(true);
  });

  it('ignores garbage values and missing storage', () => {
    (globalThis as any).localStorage.setItem('k', 'maybe');
    expect(readBooleanPreference('k', true)).toBe(true);
    delete (globalThis as any).localStorage;
    expect(readBooleanPreference('k', false)).toBe(false);
    expect(() => writeBooleanPreference('k', true)).not.toThrow();
  });
});
