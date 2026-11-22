// Learning analytics: event names sent by the browser and the per-demo funnel computed
// by /api/stats. Shared by both sides (no imports) so the format can't drift.
//
// Events (each browser sends each one at most once per demo, see src/demos/questProgress.ts):
//   quest:<demoId>:<n>/<total>   the visitor completed their n-th quest of that demo
//   completed:<demoId>           the visitor completed every quest of that demo
// The demo id is in the name because the Upstash backend only counts event names.

export function questEventName(demoId: string, n: number, total: number): string {
  return `quest:${demoId}:${n}/${total}`;
}

export function completedEventName(demoId: string): string {
  return `completed:${demoId}`;
}

export type LearningRow = {
  demoId: string;
  /** Demo page views in the range (from pageviews). */
  views: number;
  /** Visitors who completed at least one quest. */
  started: number;
  /** Visitors who completed every quest. */
  completed: number;
  /** Quests in the demo (from the event names; 0 if unknown). */
  total: number;
  /** reached[n-1] = visitors who completed at least n quests. */
  reached: number[];
};

const QUEST_RE = /^quest:([^:]+):(\d+)\/(\d+)$/;
const COMPLETED_RE = /^completed:([^:]+)$/;

/** Builds one row per demo that has views or learning events, most viewed first. */
export function learningFunnel(events: Record<string, number>, demoViews: Record<string, number>): LearningRow[] {
  const rows = new Map<string, LearningRow>();
  const row = (demoId: string) => {
    let r = rows.get(demoId);
    if (!r) {
      r = { demoId, views: demoViews[demoId] ?? 0, started: 0, completed: 0, total: 0, reached: [] };
      rows.set(demoId, r);
    }
    return r;
  };

  for (const [name, count] of Object.entries(events)) {
    const q = QUEST_RE.exec(name);
    if (q) {
      const r = row(q[1]);
      const n = Number(q[2]);
      r.total = Math.max(r.total, Number(q[3]));
      if (n >= 1) r.reached[n - 1] = (r.reached[n - 1] ?? 0) + count;
      continue;
    }
    const c = COMPLETED_RE.exec(name);
    if (c) row(c[1]).completed += count;
  }

  for (const r of rows.values()) {
    r.reached = Array.from({ length: Math.max(r.total, r.reached.length) }, (_, i) => r.reached[i] ?? 0);
    r.started = r.reached[0] ?? 0;
  }
  // Demos with views but no learning events yet are still listed (0 started).
  for (const id of Object.keys(demoViews)) row(id);

  return [...rows.values()].sort((a, b) => b.views - a.views || b.started - a.started || a.demoId.localeCompare(b.demoId));
}
