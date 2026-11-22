import { describe, expect, it } from 'vitest';
import { SCENARIO, TIMELINE_END, TIMELINE_START } from './data';
import {
  buildFanOutTree,
  buildPeelingChain,
  descendantsOf,
  fanOutStageAt,
  clampIndex,
  collapsePeelingChain,
  computeLayout,
  crossesPhaseBoundary,
  effectiveTimestamp,
  firstIndexOfPhase,
  formatStepHash,
  figuresAt,
  fitScale,
  isReviewDue,
  MAX_SHORT_LABEL,
  diagramLabel,
  involvesActor,
  parseStepHash,
  phaseRanges,
  stepVisualState,
  timelineFraction,
  validateScenario,
  type Figure,
  type Scenario,
  type Step
} from './model';

function step(id: number, phase: number, extra: Partial<Step> = {}): Step {
  return {
    id,
    phase,
    type: 'message',
    from: 'a',
    to: 'b',
    label: `s${id}`,
    style: 'solid',
    confidence: 'confirmed',
    explanation: '',
    whyItMatters: '',
    sources: [{ name: 'X', date: '2026-11-04', url: 'https://example.org' }],
    ...extra
  };
}

function scenario(steps: Step[], figures: Figure[] = []): Scenario {
  const phases = Array.from(new Set(steps.map((s) => s.phase))).map((id) => ({ id, title: `P${id}`, summary: '' }));
  return { actors: [{ id: 'a', label: 'A', role: 'threat' }, { id: 'b', label: 'B', role: 'victim' }], phases, steps, figures };
}

// ---------------------------------------------------------------------------
// The real scenario: spec acceptance criteria 4 and 5
// ---------------------------------------------------------------------------

describe('Arkéa scenario content', () => {
  it('passes every content rule (sources, confidence, figures, labels, phases)', () => {
    expect(validateScenario(SCENARIO)).toEqual([]);
  });

  it('every diagram label is short enough to fit two lines', () => {
    for (const s of SCENARIO.steps) expect(diagramLabel(s).length).toBeLessThanOrEqual(MAX_SHORT_LABEL);
  });

  it('every money figure is sourced and revealed by some step', () => {
    const revealed = new Set(SCENARIO.steps.flatMap((s) => s.reveals ?? []));
    for (const f of SCENARIO.figures) {
      expect(f.sources.length).toBeGreaterThan(0);
      expect(revealed.has(f.id)).toBe(true);
    }
  });

  it('shows no figure before the first traceable amount, and the updated ZachXBT estimate at the end', () => {
    expect(figuresAt(SCENARIO, 0)).toEqual([]);
    const end = figuresAt(SCENARIO, SCENARIO.steps.length - 1).map((f) => f.id);
    expect(end).toContain('zach133');
    expect(end).not.toContain('zach106');
  });

  it('every step has a source, or an explicit note when unverified (acceptance 4)', () => {
    for (const s of SCENARIO.steps) {
      if (s.sources.length === 0) {
        expect(s.confidence).toBe('unverified');
        expect(s.noPublicSource).toBeTruthy();
      }
    }
  });

  it('covers the 6 phases in order', () => {
    expect(phaseRanges(SCENARIO.steps).map((r) => r.phase)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps every dated step inside the mini-timeline range', () => {
    for (const s of SCENARIO.steps) {
      if (s.timestamp) expect(timelineFraction(s.timestamp, TIMELINE_START, TIMELINE_END)).not.toBeNull();
    }
    const t = SCENARIO.steps.filter((s) => s.timestamp).map((s) => Date.parse(s.timestamp!));
    expect(Math.min(...t)).toBeGreaterThanOrEqual(Date.parse(TIMELINE_START));
    expect(Math.max(...t)).toBeLessThanOrEqual(Date.parse(TIMELINE_END) + 24 * 3600 * 1000);
  });

  it('never contains anything that looks like a wallet address (content safety)', () => {
    const text = JSON.stringify(SCENARIO.steps.map(({ sources, ...rest }) => rest));
    expect(text).not.toMatch(/0x[0-9a-fA-F]{40}/);
    expect(text).not.toMatch(/\b(bc1|[13])[a-km-zA-HJ-NP-Z1-9]{25,39}\b/);
  });
});

// ---------------------------------------------------------------------------
// Validation catches bad content
// ---------------------------------------------------------------------------

describe('validateScenario', () => {
  it('flags diagram labels that are too long unless a short label is given', () => {
    const long = 'x'.repeat(MAX_SHORT_LABEL + 1);
    expect(validateScenario(scenario([step(1, 1, { label: long })])).join()).toMatch(/diagram label longer/);
    expect(validateScenario(scenario([step(1, 1, { label: long, short: 'Short' })]))).toEqual([]);
  });

  it('flags unsourced figures and unknown figure references', () => {
    const fig: Figure = { id: 'f', label: 'F', amountUsd: 1, display: '$1', confidence: 'reported', sources: [] };
    const errs = validateScenario(scenario([step(1, 1, { reveals: ['f', 'nope'] })], [fig])).join();
    expect(errs).toMatch(/figure f: reported claim needs at least one source/);
    expect(errs).toMatch(/reveals unknown figure "nope"/);
  });

  it('requires a source for confirmed and reported claims', () => {
    expect(validateScenario(scenario([step(1, 1, { sources: [] })])).join()).toMatch(/needs at least one source/);
    expect(validateScenario(scenario([step(1, 1, { sources: [], confidence: 'reported' })])).join()).toMatch(/needs at least one source/);
  });

  it('requires a "no public source" note for unsourced unverified claims', () => {
    const bad = scenario([step(1, 1, { sources: [], confidence: 'unverified' })]);
    expect(validateScenario(bad).join()).toMatch(/no public source/);
    const ok = scenario([step(1, 1, { sources: [], confidence: 'unverified', noPublicSource: 'Not disclosed.' })]);
    expect(validateScenario(ok)).toEqual([]);
  });

  it('rejects non-https sources and bad dates', () => {
    const errs = validateScenario(scenario([step(1, 1, { sources: [{ name: 'X', date: '4 Nov', url: 'http://x' }] })])).join();
    expect(errs).toMatch(/https/);
    expect(errs).toMatch(/invalid date/);
  });

  it('flags unknown actors, duplicate ids and non-contiguous phases', () => {
    const errs = validateScenario(scenario([step(1, 1, { to: 'zz' }), step(1, 2), step(3, 1)])).join();
    expect(errs).toMatch(/unknown actor "zz"/);
    expect(errs).toMatch(/duplicate id/);
    expect(errs).toMatch(/not contiguous/);
  });
});

// ---------------------------------------------------------------------------
// Navigation, deep link, filter
// ---------------------------------------------------------------------------

describe('navigation', () => {
  const steps = [step(1, 1), step(2, 1), step(3, 2), step(4, 3), step(5, 3)];

  it('clamps the index to the step list', () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(2.7, 5)).toBe(2);
  });

  it('marks past, current and future steps', () => {
    expect([0, 1, 2].map((i) => stepVisualState(i, 1))).toEqual(['past', 'current', 'future']);
  });

  it('finds phase ranges and the first step of a phase (acceptance 2)', () => {
    expect(phaseRanges(steps)).toEqual([
      { phase: 1, start: 0, end: 1 },
      { phase: 2, start: 2, end: 2 },
      { phase: 3, start: 3, end: 4 }
    ]);
    expect(firstIndexOfPhase(steps, 3)).toBe(3);
    expect(firstIndexOfPhase(steps, 9)).toBe(-1);
  });

  it('detects phase boundaries for "pause at phases"', () => {
    expect(crossesPhaseBoundary(steps, 0, 1)).toBe(false);
    expect(crossesPhaseBoundary(steps, 1, 2)).toBe(true);
  });

  it('round-trips the #step=N deep link (acceptance 6)', () => {
    for (let i = 0; i < 5; i++) expect(parseStepHash(formatStepHash(i), 5)).toBe(i);
    expect(formatStepHash(13)).toBe('#step=14');
  });

  it('ignores invalid or out-of-range deep links', () => {
    expect(parseStepHash('', 5)).toBeNull();
    expect(parseStepHash('#step=0', 5)).toBeNull();
    expect(parseStepHash('#step=6', 5)).toBeNull();
    expect(parseStepHash('#step=abc', 5)).toBeNull();
    expect(parseStepHash('#foo=1&step=3', 5)).toBe(2);
  });

  it('filters by actor (acceptance 3)', () => {
    expect(involvesActor(step(1, 1, { from: 'a', to: 'b' }), 'b')).toBe(true);
    expect(involvesActor(step(1, 1, { from: 'a', to: 'b' }), 'c')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Layout and timeline
// ---------------------------------------------------------------------------

describe('layout', () => {
  it('places lifelines left to right and steps top to bottom without overlap (acceptance 1)', () => {
    const l = computeLayout(SCENARIO);
    const xs = SCENARIO.actors.map((a) => l.actorX[a.id]);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    for (let i = 1; i < l.stepY.length; i++) expect(l.stepY[i]).toBeGreaterThan(l.stepY[i - 1] + 30);
    expect(l.stepY).toHaveLength(SCENARIO.steps.length);
    expect(l.height).toBeGreaterThan(l.stepY[l.stepY.length - 1]);
  });

  it('gives each phase a band that contains its steps', () => {
    const l = computeLayout(SCENARIO);
    for (const r of phaseRanges(SCENARIO.steps)) {
      const band = l.phaseBands.find((b) => b.phase === r.phase)!;
      expect(l.stepY[r.start]).toBeGreaterThan(band.top);
      expect(l.stepY[r.end]).toBeLessThan(band.bottom);
    }
  });
});

describe('timeline', () => {
  it('maps timestamps to [0, 1] and rejects unknown ones', () => {
    expect(timelineFraction('2026-11-01', '2026-11-01', '2026-11-05')).toBe(0);
    expect(timelineFraction('2026-11-03', '2026-11-01', '2026-11-05')).toBe(0.5);
    expect(timelineFraction('2026-12-01', '2026-11-01', '2026-11-05')).toBe(1);
    expect(timelineFraction(undefined, '2026-11-01', '2026-11-05')).toBeNull();
  });

  it('undated steps inherit the latest earlier timestamp', () => {
    const steps = [step(1, 1, { timestamp: '2026-11-01' }), step(2, 1), step(3, 1, { timestamp: '2026-11-03' })];
    expect(effectiveTimestamp(steps, 1)).toBe('2026-11-01');
    expect(effectiveTimestamp(steps, 2)).toBe('2026-11-03');
    expect(effectiveTimestamp([step(1, 1)], 0)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Peeling chain
// ---------------------------------------------------------------------------

describe('peeling chain', () => {
  it('matches the reference diagram: 10,000 ETH, 50 ETH per peel', () => {
    const hops = buildPeelingChain(10_000, 50, 3);
    expect(hops.map((h) => h.remainder)).toEqual([9_950, 9_900, 9_850]);
  });

  it('conserves value: remainder + peels = start', () => {
    const hops = buildPeelingChain(10_000, 50, 4);
    const peeled = hops.reduce((s, h) => s + h.peel, 0);
    expect(hops[hops.length - 1].remainder + peeled).toBe(10_000);
  });

  it('collapsing the change addresses keeps the same total outflow', () => {
    const hops = buildPeelingChain(10_000, 50, 4);
    const totals = collapsePeelingChain(hops);
    expect(totals.cex + totals.bridge + totals.xmr).toBe(hops.length * 50);
  });

  it('stops when the remainder is too small to peel', () => {
    expect(buildPeelingChain(120, 50, 10)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Figures, fit-to-width, review date
// ---------------------------------------------------------------------------

describe('figuresAt', () => {
  const src = [{ name: 'X', date: '2026-11-04', url: 'https://example.org' }];
  const figs: Figure[] = [
    { id: 'a', label: 'A', amountUsd: 1, display: '$1', confidence: 'reported', sources: src },
    { id: 'b', label: 'B', amountUsd: 2, display: '$2', confidence: 'reported', sources: src, supersedes: 'a' },
    { id: 'c', label: 'C', amountUsd: null, display: 'Not public', confidence: 'confirmed', sources: src }
  ];
  const sc = scenario([step(1, 1, { reveals: ['a'] }), step(2, 1, { reveals: ['c'] }), step(3, 1, { reveals: ['b'] })], figs);

  it('reveals figures step by step, in order', () => {
    expect(figuresAt(sc, 0).map((f) => f.id)).toEqual(['a']);
    expect(figuresAt(sc, 1).map((f) => f.id)).toEqual(['a', 'c']);
  });

  it('hides a figure once an update supersedes it', () => {
    expect(figuresAt(sc, 2).map((f) => f.id)).toEqual(['c', 'b']);
  });
});

describe('fitScale', () => {
  it('does not scale when the diagram fits', () => {
    expect(fitScale(1200, 1000)).toBe(1);
  });
  it('shrinks to the container width', () => {
    expect(fitScale(900, 1000)).toBeCloseTo(0.9, 10);
  });
  it('never goes below the readable minimum', () => {
    expect(fitScale(300, 1000)).toBe(0.72);
  });
  it('the real diagram fits a laptop with the detail panel open at ≥ 90%', () => {
    // max-w-7xl (1280) − page padding (48) − panel (340) − gap (16) ≈ 876 px
    expect(fitScale(876, computeLayout(SCENARIO).width)).toBeGreaterThanOrEqual(0.88);
  });
});

describe('isReviewDue', () => {
  it('is false up to the end of the review day, true after', () => {
    expect(isReviewDue('2026-12-22', new Date('2026-12-22T20:00:00Z'))).toBe(false);
    expect(isReviewDue('2026-12-22', new Date('2026-12-23T00:00:01Z'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Documented fan-out
// ---------------------------------------------------------------------------

describe('fan-out', () => {
  it('reaches one stage per median hop, then stays spread out', () => {
    expect([0, 4.9, 5, 9.9, 10, 15, 60].map((m) => fanOutStageAt(m))).toEqual([0, 0, 1, 1, 2, 3, 3]);
    expect(fanOutStageAt(-1)).toBe(0);
  });

  it('keeps the published end counts: 17 wallets and 526 addresses', () => {
    const t = buildFanOutTree();
    expect(t.sizes[0]).toBe(17);
    expect(t.sizes[t.sizes.length - 1]).toBe(526);
  });

  it('gives every node a valid parent, in order (no crossing branches)', () => {
    const t = buildFanOutTree();
    for (let l = 1; l < t.sizes.length; l++) {
      expect(t.parent[l]).toHaveLength(t.sizes[l]);
      for (let i = 0; i < t.sizes[l]; i++) {
        expect(t.parent[l][i]).toBeGreaterThanOrEqual(0);
        expect(t.parent[l][i]).toBeLessThan(t.sizes[l - 1]);
        if (i > 0) expect(t.parent[l][i]).toBeGreaterThanOrEqual(t.parent[l][i - 1]);
      }
    }
  });

  it('every source wallet has descendants at every level, and they partition the addresses', () => {
    const t = buildFanOutTree();
    let total = 0;
    for (let s = 0; s < t.sizes[0]; s++) {
      const d = descendantsOf(t, s);
      for (const level of d) expect(level.size).toBeGreaterThan(0);
      total += d[d.length - 1].size;
    }
    expect(total).toBe(526);
  });
});
