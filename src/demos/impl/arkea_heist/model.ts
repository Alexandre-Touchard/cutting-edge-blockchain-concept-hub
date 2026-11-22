// Data model and pure logic for the "Follow the Money" (Crédit Mutuel Arkéa heist) demo.
// Kept free of React so it can be unit-tested (see model.test.ts).

export type ActorRole = 'threat' | 'third_party' | 'victim' | 'platform' | 'issuer' | 'investigator' | 'public';

export type Actor = { id: string; label: string; role: ActorRole };

export type Confidence = 'confirmed' | 'reported' | 'unverified';

export type Source = {
  name: string;
  title?: string;
  /** Publication date, YYYY-MM-DD. */
  date: string;
  url: string;
  /** Archived copy (web.archive.org) for pages that may change or disappear. */
  archiveUrl?: string;
};

/**
 * A sourced money figure shown in the "Known figures" tracker once a step reveals it.
 * Only published figures: when an amount is not public, `amountUsd` is null and
 * `display` says so. Never estimated by the demo.
 */
export type Figure = {
  id: string;
  label: string;
  /** Amount in USD for the bar; null when the amount is not public or not in USD. */
  amountUsd: number | null;
  /** Text shown next to the label, e.g. "$126.0M" or "Not public". */
  display: string;
  confidence: Confidence;
  sources: Source[];
  noPublicSource?: string;
  /** Hides an earlier figure once this one is revealed (e.g. an updated estimate). */
  supersedes?: string;
};

export type Phase = { id: number; title: string; summary: string };

export type Step = {
  id: number;
  phase: number;
  /** `message` = arrow from → to; `note` = box spanning the from..to lifelines. */
  type: 'message' | 'note';
  from: string;
  to: string;
  /** Full title, shown in the detail panel. */
  label: string;
  /** Short label for the diagram (≤ ~45 characters); falls back to `label`. */
  short?: string;
  /** Solid = confirmed action; dashed = hypothetical, undisclosed or return message. */
  style: 'solid' | 'dashed';
  /** ISO date (YYYY-MM-DD) or date-time, when known. */
  timestamp?: string;
  confidence: Confidence;
  explanation: string;
  whyItMatters: string;
  sources: Source[];
  /** Required when `sources` is empty: explains why no public source exists. */
  noPublicSource?: string;
  evidence?: { asset: string; amount?: string; chain?: string; note?: string };
  /** Figure ids that become known at this step. */
  reveals?: string[];
};

export type Scenario = { actors: Actor[]; phases: Phase[]; steps: Step[]; figures: Figure[] };

/** Label used in the diagram. */
export function diagramLabel(step: Step): string {
  return step.short ?? step.label;
}

/** Figures known at step `index`, in order of revelation, without superseded ones. */
export function figuresAt(scenario: Scenario, index: number): Figure[] {
  const byId = new Map(scenario.figures.map((f) => [f.id, f]));
  const revealed: Figure[] = [];
  for (let i = 0; i <= index && i < scenario.steps.length; i++) {
    for (const id of scenario.steps[i].reveals ?? []) {
      const f = byId.get(id);
      if (f && !revealed.includes(f)) revealed.push(f);
    }
  }
  const superseded = new Set(revealed.map((f) => f.supersedes).filter(Boolean));
  return revealed.filter((f) => !superseded.has(f.id));
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export function clampIndex(i: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.trunc(i)));
}

export type StepVisualState = 'past' | 'current' | 'future';

export function stepVisualState(index: number, current: number): StepVisualState {
  if (index === current) return 'current';
  return index < current ? 'past' : 'future';
}

export type PhaseRange = { phase: number; start: number; end: number };

/** Contiguous index ranges of each phase, in order of appearance. */
export function phaseRanges(steps: Step[]): PhaseRange[] {
  const ranges: PhaseRange[] = [];
  steps.forEach((s, i) => {
    const last = ranges[ranges.length - 1];
    if (last && last.phase === s.phase) last.end = i;
    else ranges.push({ phase: s.phase, start: i, end: i });
  });
  return ranges;
}

export function firstIndexOfPhase(steps: Step[], phase: number): number {
  return steps.findIndex((s) => s.phase === phase);
}

/** True when moving from `from` to `to` crosses into a new phase (used by "pause at phases"). */
export function crossesPhaseBoundary(steps: Step[], from: number, to: number): boolean {
  if (!steps[from] || !steps[to]) return false;
  return steps[from].phase !== steps[to].phase;
}

// ---------------------------------------------------------------------------
// Deep link: #step=N (1-based, as shown in the UI)
// ---------------------------------------------------------------------------

export function parseStepHash(hash: string, count: number): number | null {
  const m = /(?:^|[#&])step=(\d+)(?:&|$)/.exec(hash);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > count) return null;
  return n - 1;
}

export function formatStepHash(index: number): string {
  return `#step=${index + 1}`;
}

// ---------------------------------------------------------------------------
// Actor filter
// ---------------------------------------------------------------------------

export function involvesActor(step: Step, actorId: string): boolean {
  return step.from === actorId || step.to === actorId;
}

// ---------------------------------------------------------------------------
// Layout (lifelines at fixed X, steps at incremental Y)
// ---------------------------------------------------------------------------

export type LayoutOptions = {
  laneWidth: number;
  headerHeight: number;
  rowHeight: number;
  noteRowHeight: number;
  phaseHeaderHeight: number;
  paddingX: number;
  paddingBottom: number;
};

export const DEFAULT_LAYOUT: LayoutOptions = {
  laneWidth: 136,
  headerHeight: 64,
  rowHeight: 56,
  noteRowHeight: 60,
  phaseHeaderHeight: 30,
  paddingX: 20,
  paddingBottom: 24
};

export type Layout = {
  width: number;
  height: number;
  actorX: Record<string, number>;
  /** Vertical centre of each step row. */
  stepY: number[];
  phaseBands: Array<{ phase: number; top: number; bottom: number }>;
};

export function computeLayout(scenario: Scenario, opts: LayoutOptions = DEFAULT_LAYOUT): Layout {
  const actorX: Record<string, number> = {};
  scenario.actors.forEach((a, i) => {
    actorX[a.id] = opts.paddingX + opts.laneWidth * i + opts.laneWidth / 2;
  });

  const stepY: number[] = [];
  const phaseBands: Layout['phaseBands'] = [];
  let y = opts.headerHeight;

  for (const r of phaseRanges(scenario.steps)) {
    const top = y;
    y += opts.phaseHeaderHeight;
    for (let i = r.start; i <= r.end; i++) {
      const h = scenario.steps[i].type === 'note' ? opts.noteRowHeight : opts.rowHeight;
      stepY[i] = y + h / 2;
      y += h;
    }
    y += 6;
    phaseBands.push({ phase: r.phase, top, bottom: y - 3 });
  }

  return {
    width: opts.paddingX * 2 + opts.laneWidth * scenario.actors.length,
    height: y + opts.paddingBottom,
    actorX,
    stepY,
    phaseBands
  };
}

/**
 * Scale for "fit to width": shrink the diagram to the container, but never below
 * `minScale` (text gets unreadable); returns 1 when it already fits.
 */
export function fitScale(containerWidth: number, contentWidth: number, minScale = 0.72): number {
  if (containerWidth <= 0 || contentWidth <= 0 || containerWidth >= contentWidth) return 1;
  return Math.max(minScale, containerWidth / contentWidth);
}

// ---------------------------------------------------------------------------
// Content freshness
// ---------------------------------------------------------------------------

/** True once `now` is past the re-check date (YYYY-MM-DD, end of that day UTC). */
export function isReviewDue(reviewBy: string, now: Date): boolean {
  const due = Date.parse(`${reviewBy}T23:59:59Z`);
  return !Number.isNaN(due) && now.getTime() > due;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/** Position of a timestamp between start and end, in [0, 1]; null when unknown. */
export function timelineFraction(timestamp: string | undefined, start: string, end: string): number | null {
  if (!timestamp) return null;
  const t = Date.parse(timestamp);
  const s = Date.parse(start);
  const e = Date.parse(end);
  if ([t, s, e].some((x) => Number.isNaN(x)) || e <= s) return null;
  return Math.max(0, Math.min(1, (t - s) / (e - s)));
}

/** Most recent known timestamp at or before `index` (steps without one inherit it). */
export function effectiveTimestamp(steps: Step[], index: number): string | undefined {
  for (let i = Math.min(index, steps.length - 1); i >= 0; i--) {
    if (steps[i].timestamp) return steps[i].timestamp;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Validation (content rules from the spec)
// ---------------------------------------------------------------------------

export const MAX_SHORT_LABEL = 48;

function checkSources(
  at: string,
  confidence: Confidence,
  sources: Source[],
  noPublicSource: string | undefined,
  errors: string[]
) {
  if (sources.length === 0) {
    if (confidence !== 'unverified') errors.push(`${at}: ${confidence} claim needs at least one source`);
    else if (!noPublicSource) errors.push(`${at}: unverified claim without sources needs a "no public source" note`);
  }
  for (const src of sources) {
    if (!/^https:\/\//.test(src.url)) errors.push(`${at}: source "${src.name}" has no https URL`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(src.date)) errors.push(`${at}: source "${src.name}" has an invalid date`);
    if (src.archiveUrl && !/^https:\/\/web\.archive\.org\//.test(src.archiveUrl)) errors.push(`${at}: source "${src.name}" has an invalid archive URL`);
  }
}

/** Returns a list of problems; empty means the scenario follows the spec's content rules. */
export function validateScenario(s: Scenario): string[] {
  const errors: string[] = [];
  const actorIds = new Set(s.actors.map((a) => a.id));
  const phaseIds = new Set(s.phases.map((p) => p.id));
  const figureIds = new Set(s.figures.map((f) => f.id));

  for (const f of s.figures) {
    const at = `figure ${f.id}`;
    checkSources(at, f.confidence, f.sources, f.noPublicSource, errors);
    if (f.amountUsd !== null && !(f.amountUsd >= 0)) errors.push(`${at}: invalid amount`);
    if (f.supersedes && !figureIds.has(f.supersedes)) errors.push(`${at}: supersedes unknown figure "${f.supersedes}"`);
  }
  const seenIds = new Set<number>();
  const seenPhases = new Set<number>();
  let prevPhase = -Infinity;

  for (const step of s.steps) {
    const at = `step ${step.id}`;
    if (seenIds.has(step.id)) errors.push(`${at}: duplicate id`);
    seenIds.add(step.id);
    if (!actorIds.has(step.from)) errors.push(`${at}: unknown actor "${step.from}"`);
    if (!actorIds.has(step.to)) errors.push(`${at}: unknown actor "${step.to}"`);
    if (!phaseIds.has(step.phase)) errors.push(`${at}: unknown phase ${step.phase}`);
    if (step.phase !== prevPhase && seenPhases.has(step.phase)) errors.push(`${at}: phase ${step.phase} is not contiguous`);
    if (step.phase < prevPhase) errors.push(`${at}: phases out of order`);
    seenPhases.add(step.phase);
    prevPhase = step.phase;

    checkSources(at, step.confidence, step.sources, step.noPublicSource, errors);
    if (diagramLabel(step).length > MAX_SHORT_LABEL) errors.push(`${at}: diagram label longer than ${MAX_SHORT_LABEL} characters (add \`short\`)`);
    for (const id of step.reveals ?? []) if (!figureIds.has(id)) errors.push(`${at}: reveals unknown figure "${id}"`);
    if (step.timestamp && Number.isNaN(Date.parse(step.timestamp))) errors.push(`${at}: invalid timestamp`);
  }

  for (const p of s.phases) if (!seenPhases.has(p.id)) errors.push(`phase ${p.id} has no steps`);
  return errors;
}

// ---------------------------------------------------------------------------
// Peeling chain (illustrative; F15)
// ---------------------------------------------------------------------------

export type PeelExit = 'cex' | 'bridge' | 'xmr';

export type PeelHop = {
  /** Change address that holds the remainder after this hop. */
  changeLabel: string;
  remainder: number;
  peel: number;
  exit: PeelExit;
};

/**
 * Generates an illustrative peeling chain: at each hop a small amount is "peeled"
 * to a throwaway address (which then exits), and the remainder moves to a fresh change address.
 */
export function buildPeelingChain(start: number, peel: number, hops: number): PeelHop[] {
  const exits: PeelExit[] = ['cex', 'cex', 'bridge', 'xmr'];
  const out: PeelHop[] = [];
  let remainder = start;
  for (let i = 0; i < hops && remainder > peel; i++) {
    remainder -= peel;
    out.push({ changeLabel: `C${i + 1}`, remainder, peel, exit: exits[i % exits.length] });
  }
  return out;
}

/**
 * Analysts "collapse" the change addresses of a peeling chain into a single cluster:
 * one wallet whose outflows are the peels. Returns the cluster's total outflow by exit.
 */
export function collapsePeelingChain(hops: PeelHop[]): Record<PeelExit, number> {
  const totals: Record<PeelExit, number> = { cex: 0, bridge: 0, xmr: 0 };
  for (const h of hops) totals[h.exit] += h.peel;
  return totals;
}

// ---------------------------------------------------------------------------
// Documented fan-out (Bitquery): 17 wallets -> 2-3 hops -> 526 addresses,
// each hop a median of ~5 minutes after the funds arrived. Only the end counts
// and the median timing are published; intermediate levels are schematic.
// ---------------------------------------------------------------------------

export const FANOUT = {
  receivingWallets: 17,
  finalAddresses: 526,
  medianHopMinutes: 5,
  /** Schematic sizes of the two intermediate levels (not published). */
  schematicHops: [26, 40]
} as const;

/** Stage reached N minutes after funds land: 0 = receiving wallets, 1-2 = hops, 3 = final addresses. */
export function fanOutStageAt(minutes: number, medianHop: number = FANOUT.medianHopMinutes): 0 | 1 | 2 | 3 {
  if (!(minutes >= 0)) return 0;
  return Math.min(3, Math.floor(minutes / medianHop)) as 0 | 1 | 2 | 3;
}

export type FanOutTree = {
  /** Node count per level: [sources, hop1, hop2, final]. */
  sizes: number[];
  /** parent[level][i] = index of the parent in level-1 (level 0 has none). */
  parent: number[][];
};

/**
 * Schematic tree: children are assigned to parents in order (no crossing lines).
 * Deterministic, so the same picture is drawn every time.
 */
export function buildFanOutTree(sizes: number[] = [FANOUT.receivingWallets, ...FANOUT.schematicHops, FANOUT.finalAddresses]): FanOutTree {
  const parent: number[][] = [[]];
  for (let l = 1; l < sizes.length; l++) {
    parent.push(Array.from({ length: sizes[l] }, (_, i) => Math.floor((i * sizes[l - 1]) / sizes[l])));
  }
  return { sizes, parent };
}

/** Indices, per level, of a source wallet and everything downstream of it. */
export function descendantsOf(tree: FanOutTree, source: number): Set<number>[] {
  const out: Set<number>[] = [new Set([source])];
  for (let l = 1; l < tree.sizes.length; l++) {
    const prev = out[l - 1];
    out.push(new Set(tree.parent[l].flatMap((p, i) => (prev.has(p) ? [i] : []))));
  }
  return out;
}
