import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_THRESHOLD,
  appendTransaction,
  computeCumulativeWeights,
  computeTips,
  idForIndex,
  pickRandomTips,
  type DagNode
} from './dag_consensus';

const node = (id: string, parents: string[]): DagNode => ({ id, x: 400, y: 100, parents, validator: 'Alice', timestamp: 0 });
const initial = (): DagNode[] => [node('A', []), node('B', ['A']), node('C', ['A']), node('D', ['A'])];

/** Deterministic pseudo-random generator for reproducible runs. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

describe('dag consensus model', () => {
  it('names transactions A..Z, then AA, AB…', () => {
    expect([0, 4, 25, 26, 27, 51, 52].map(idForIndex)).toEqual(['A', 'E', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });

  it('cumulative weight counts the transactions approving a node (directly or indirectly)', () => {
    const w = computeCumulativeWeights(initial());
    expect([...w.entries()]).toEqual([['A', 4], ['B', 1], ['C', 1], ['D', 1]]);

    // E approves B and C; F approves E and D.
    const dag = [...initial(), node('E', ['B', 'C']), node('F', ['E', 'D'])];
    const w2 = computeCumulativeWeights(dag);
    expect(w2.get('A')).toBe(6);
    expect(w2.get('B')).toBe(3); // B <- E <- F
    expect(w2.get('D')).toBe(2);
    expect(w2.get('E')).toBe(2);
    expect(w2.get('F')).toBe(1);
  });

  it('a new transaction is never confirmed on arrival, and confirmations are monotonic', () => {
    let dag = initial();
    const rng = seeded(1);
    let confirmed = new Set<string>();
    for (let i = 0; i < 40; i++) {
      dag = appendTransaction(dag, [], 'Eve', rng);
      const w = computeCumulativeWeights(dag);
      const newest = dag[dag.length - 1];
      expect(w.get(newest.id)).toBe(1);
      const now = new Set(dag.filter((n) => (w.get(n.id) ?? 0) >= CONFIRMATION_THRESHOLD).map((n) => n.id));
      for (const id of confirmed) expect(now.has(id)).toBe(true);
      confirmed = now;
    }
  });

  it('defaults to the first two tips as parents and consumes them', () => {
    const dag = appendTransaction(initial(), [], 'Eve', seeded(2));
    expect(dag[4]).toMatchObject({ id: 'E', parents: ['B', 'C'] });
    expect(computeTips(dag)).toEqual(['D', 'E']);
  });

  it('each auto-generated transaction sees the DAG produced by the previous one', () => {
    // Same reducer as the Auto-Generate loop's functional update.
    const rng = seeded(3);
    let dag = initial();
    for (let i = 0; i < 25; i++) {
      const parents = pickRandomTips(dag, rng() > 0.5 ? 2 : 1, rng);
      const tipsBefore = computeTips(dag);
      expect(parents.every((p) => tipsBefore.includes(p))).toBe(true);
      dag = appendTransaction(dag, parents, 'Eve', rng);
    }
    expect(dag).toHaveLength(4 + 25);
    expect(new Set(dag.map((n) => n.id)).size).toBe(dag.length);
    // Early transactions end up confirmed by the ones generated after them.
    const w = computeCumulativeWeights(dag);
    expect(w.get('E')).toBeGreaterThanOrEqual(CONFIRMATION_THRESHOLD);
  });
});
