// Ecosystem map data and layout checks (spec §5.2). Adding a node or edge = editing JSON; these tests guard it.
import { describe, expect, it } from 'vitest';
import { demoMetaRegistry } from '../demos/demoRegistry';
import { MAP_DATA, buildMapData, searchNodes } from './data';
import { R, computeLayout, computeSectors } from './layout';
import { staleNodes, validateMapData } from './validate';
import type { MapNode } from './types';

const demoIds = new Set(Object.values(demoMetaRegistry).map((m) => m.id!));

describe('ecosystem map data', () => {
  it('has the v1 inventory: 50 nodes in 3 rings, 12 categories, about 100 edges', () => {
    expect(MAP_DATA.nodes).toHaveLength(50);
    expect(MAP_DATA.categories).toHaveLength(12);
    expect(MAP_DATA.edges.length).toBeGreaterThanOrEqual(95);
    const byLayer = [1, 2, 3].map((l) => MAP_DATA.nodes.filter((n) => n.layer === l).length);
    expect(byLayer).toEqual([12, 8, 30]);
  });

  it('passes every validation rule (edges, directions, limits, sources, demo coverage)', () => {
    expect(validateMapData(MAP_DATA, demoIds)).toEqual([]);
  });

  it('catches broken data', () => {
    const n = (over: Partial<MapNode>): MapNode => ({
      id: 'x',
      name: 'X',
      aliases: [],
      kind: 'chain',
      layer: 1,
      category: 'altl1',
      summary: 'A chain.',
      goodToKnow: [],
      demos: [],
      sources: [{ label: 'Site', url: 'https://example.org' }],
      verifiedOn: '2026-11-23',
      confidence: 'high',
      ...over
    });
    const bad = buildMapData(
      MAP_DATA.categories,
      [n({}), n({ id: 'y', name: 'Y', layer: 2, demos: ['nope'], summary: 'x'.repeat(141), sources: [] })],
      [{ id: 'x--settles-on--y', from: 'x', to: 'y', type: 'settles-on', label: 'L1 settling on an L2', strength: 3, confidence: 'high' }]
    );
    const errs = validateMapData(bad, new Set(['amm-demo']));
    expect(errs.join('\n')).toMatch(/y: summary is 141 chars/);
    expect(errs.join('\n')).toMatch(/y: needs at least one source/);
    expect(errs.join('\n')).toMatch(/y: unknown demo nope/);
    expect(errs.join('\n')).toMatch(/direction or endpoints/);
    expect(errs.join('\n')).toMatch(/demo amm-demo is not linked/);
  });

  it('flags stale entries after six months', () => {
    expect(staleNodes(MAP_DATA.nodes, new Date('2026-12-01'))).toEqual([]);
    expect(staleNodes(MAP_DATA.nodes, new Date('2027-07-01')).length).toBe(50);
  });

  it('finds nodes by name and alias, ignoring case and accents', () => {
    expect(searchNodes(MAP_DATA.nodes, 'arb')[0].id).toBe('arbitrum');
    expect(searchNodes(MAP_DATA.nodes, 'ETHEREUM')[0].id).toBe('ethereum');
    expect(searchNodes(MAP_DATA.nodes, '')).toEqual([]);
  });
});

describe('ecosystem map layout', () => {
  const layout = computeLayout(MAP_DATA.categories, MAP_DATA.nodes);

  it('sectors cover the full circle, at least 12° each', () => {
    const sectors = computeSectors(MAP_DATA.categories, MAP_DATA.nodes);
    expect(sectors.reduce((t, s) => t + (s.end - s.start), 0)).toBeCloseTo(360, 6);
    for (const s of sectors) expect(s.end - s.start).toBeGreaterThanOrEqual(12);
  });

  it('places every node, in its ring, without overlaps', () => {
    expect(layout.positions.size).toBe(50);
    for (const n of MAP_DATA.nodes) {
      const p = layout.positions.get(n.id)!;
      const frac = p.r / R;
      if (n.layer === 1) expect(frac).toBeLessThan(0.32);
      else if (n.layer === 2) expect(frac).toBeGreaterThan(0.34);
      else expect(frac).toBeGreaterThan(0.59);
    }
    const pts = [...layout.positions.entries()];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const [a, pa] = pts[i];
        const [b, pb] = pts[j];
        expect(Math.hypot(pa.x - pb.x, pa.y - pb.y), `${a} vs ${b}`).toBeGreaterThan(34);
      }
  });

  it('puts non-centre nodes inside their category sector', () => {
    const sector = new Map(layout.sectors.map((s) => [s.id, s]));
    for (const n of MAP_DATA.nodes.filter((x) => x.layer !== 1)) {
      const s = sector.get(n.category)!;
      const a = layout.positions.get(n.id)!.angle;
      expect(a, n.id).toBeGreaterThanOrEqual(s.start);
      expect(a, n.id).toBeLessThanOrEqual(s.end);
    }
  });

  it('is deterministic', () => {
    const again = computeLayout(MAP_DATA.categories, MAP_DATA.nodes);
    expect([...again.positions.values()]).toEqual([...layout.positions.values()]);
  });
});
