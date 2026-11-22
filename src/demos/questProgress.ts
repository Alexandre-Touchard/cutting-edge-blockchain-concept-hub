// Learning progress kept in the browser (localStorage): quest flags per demo,
// a progress summary per demo (shown on hub cards), and recently visited demos.
// Nothing leaves the browser. All functions degrade to no-ops when storage is unavailable.
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const FLAGS_PREFIX = 'quests:';
const SUMMARY_KEY = 'quest-progress';
const RECENT_KEY = 'recent-demos';
const MAX_RECENT = 6;

export type QuestSummary = {
  /** Quests completed the last time the demo reported. */
  done: number;
  total: number;
  /** Best ever, so a "Reset" inside a demo doesn't erase the badge. */
  best: number;
  updatedAt: number;
};

export type RecentVisit = { id: string; at: number };

/** Widens literal flags (`false`) to `boolean`, like `useState` would. */
export type QuestFlags<T> = { [K in keyof T]: boolean };

function storage(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  const s = storage();
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or privacy mode: ignore */
  }
}

// ---------------------------------------------------------------------------
// Quest flags
// ---------------------------------------------------------------------------

/** Saved flags merged over the defaults: only known keys, only booleans. */
export function loadQuestFlags<T extends Record<string, boolean>>(demoId: string, defaults: T): QuestFlags<T> {
  const saved = readJson<Record<string, unknown>>(FLAGS_PREFIX + demoId, {});
  const out: QuestFlags<T> = { ...defaults };
  for (const k of Object.keys(defaults) as Array<keyof T>) {
    const v = saved[k as string];
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export function saveQuestFlags(demoId: string, flags: Record<string, boolean>) {
  writeJson(FLAGS_PREFIX + demoId, flags);
}

/** Drop-in replacement for `useState` holding a demo's quest flags; survives reloads. */
export function usePersistedQuests<T extends Record<string, boolean>>(
  demoId: string,
  init: T | (() => T)
): [QuestFlags<T>, Dispatch<SetStateAction<QuestFlags<T>>>] {
  const [state, setState] = useState<QuestFlags<T>>(() => loadQuestFlags(demoId, typeof init === 'function' ? (init as () => T)() : init));
  useEffect(() => {
    saveQuestFlags(demoId, state);
  }, [demoId, state]);
  return [state, setState];
}

// ---------------------------------------------------------------------------
// Progress summary (hub cards)
// ---------------------------------------------------------------------------

export function readQuestSummaries(): Record<string, QuestSummary> {
  return readJson<Record<string, QuestSummary>>(SUMMARY_KEY, {});
}

export function reportQuestProgress(demoId: string, done: number, total: number, now = Date.now()) {
  if (!(total > 0)) return;
  const all = readQuestSummaries();
  const prev = all[demoId];
  const clamped = Math.max(0, Math.min(total, done));
  if (prev && prev.done === clamped && prev.total === total) return;
  all[demoId] = { done: clamped, total, best: Math.max(prev?.best ?? 0, clamped), updatedAt: now };
  writeJson(SUMMARY_KEY, all);
}

/** Call from a demo with its own count of completed quests. */
export function useReportQuestProgress(demoId: string, done: number, total: number) {
  useEffect(() => {
    reportQuestProgress(demoId, done, total);
  }, [demoId, done, total]);
}

// ---------------------------------------------------------------------------
// Recently visited demos
// ---------------------------------------------------------------------------

export function readRecentDemos(): RecentVisit[] {
  const list = readJson<RecentVisit[]>(RECENT_KEY, []);
  return Array.isArray(list) ? list.filter((v) => v && typeof v.id === 'string' && typeof v.at === 'number') : [];
}

export function recordDemoVisit(demoId: string, now = Date.now()) {
  const list = readRecentDemos().filter((v) => v.id !== demoId);
  writeJson(RECENT_KEY, [{ id: demoId, at: now }, ...list].slice(0, MAX_RECENT));
}
