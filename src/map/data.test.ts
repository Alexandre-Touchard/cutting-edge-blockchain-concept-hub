// Ecosystem map data, view and layout checks (spec §5.2). Adding a node or edge = editing JSON; these tests guard it.
import { describe, expect, it } from 'vitest';
import { demoMetaRegistry } from '../demos/demoRegistry';
import { MAP_DATA, TOURS, buildMapData, searchNodes } from './data';
import { R, computeLayout, computeSectors } from './layout';
import { staleNodes, validateMapData, validateTours, wordCount } from './validate';
import { buildView, clusterItemId } from './view';
import type { MapNode } from './types';

const demoIds = new Set(Object.values(demoMetaRegistry).map((m) => m.id!));
const ALL = new Set(MAP_DATA.clusters.map((c) => c.id));
const NONE = new Set<string>();

describe('ecosystem map data', () => {
  it('has the inventory: 100 nodes in 3 rings, 13 categories, clusters', () => {
    expect(MAP_DATA.nodes).toHaveLength(100);
    expect(MAP_DATA.categories).toHaveLength(13);
    expect(MAP_DATA.edges.length).toBeGreaterThanOrEqual(190);
    expect(MAP_DATA.clusters.length).toBeGreaterThanOrEqual(5);
    const byLayer = [1, 2, 3].map((l) => MAP_DATA.nodes.filter((n) => n.layer === l).length);
    expect(byLayer).toEqual([20, 15, 65]);
  });

  it('passes every validation rule (edges, directions, fields, clusters, limits, sources, demo coverage, v1.1 detail text)', () => {
    expect(validateMapData(MAP_DATA, demoIds, { requireDetail: true })).toEqual([]);
  });

  it('describes every chain: execution environment, consensus for Layer 1s, rollup type for rollups', () => {
    const chains = MAP_DATA.nodes.filter((n) => n.kind === 'chain');
    expect(chains.filter((n) => n.layer === 1 && (!n.vm || !n.consensus)).map((n) => n.id)).toEqual([]);
    expect(MAP_DATA.nodes.find((n) => n.id === 'solana')!.vm).toBe('svm');
    expect(MAP_DATA.nodes.find((n) => n.id === 'aptos')!.vm).toBe('move');
    expect(MAP_DATA.nodes.find((n) => n.id === 'bitcoin')!.consensus).toBe('pow');
    expect(MAP_DATA.nodes.find((n) => n.id === 'arbitrum')!.rollupType).toBe('optimistic');
    expect(MAP_DATA.nodes.find((n) => n.id === 'starknet')!.rollupType).toBe('zk');
  });

  it('has valid guided tours (existing nodes and demos, short steps)', () => {
    expect(TOURS.length).toBeGreaterThanOrEqual(3);
    expect(validateTours(TOURS, MAP_DATA, demoIds)).toEqual([]);
  });

  it('keeps a discontinued node as an example', () => {
    expect(MAP_DATA.nodes.filter((n) => n.status === 'discontinued').map((n) => n.id)).toContain('degen-chain');
  });

  it('catches broken data', () => {
    const n = (over: Partial<MapNode>): MapNode => ({
      id: 'x',
      name: 'X',
      aliases: [],
      kind: 'chain',
      layer: 1,
      category: 'altl1',
      vm: 'evm',
      consensus: 'pos',
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
      [n({ rollupType: 'zk' }), n({ id: 'y', name: 'Y', layer: 2, consensus: undefined, demos: ['nope'], summary: 'x'.repeat(141), sources: [], cluster: 'c1' }), n({ id: 'z', name: 'Z', kind: 'app', layer: 3, subBand: 'app-tool', vm: undefined, consensus: undefined, category: 'defi' })],
      [{ id: 'x--settles-on--y', from: 'x', to: 'y', type: 'settles-on', label: 'L1 settling on an L2', strength: 3, confidence: 'high' }],
      [{ id: 'c1', name: 'Mixed', members: ['y', 'z'] }]
    );
    const errs = validateMapData(bad, new Set(['amm-demo'])).join('\n');
    expect(errs).toMatch(/y: summary is 141 chars/);
    expect(errs).toMatch(/y: needs at least one source/);
    expect(errs).toMatch(/y: unknown demo nope/);
    expect(errs).toMatch(/direction or endpoints/);
    expect(errs).toMatch(/demo amm-demo is not linked/);
    expect(errs).toMatch(/x: a Layer 1 can't be a rollup/);
    expect(errs).toMatch(/cluster c1: members span several categories/);
    expect(errs).toMatch(/z: cluster field should be c1/);
  });

  it('checks the detail text: word ranges, plain text, no promotional wording', () => {
    const words = (k: number) => Array.from({ length: k }, (_, i) => `w${i}`).join(' ');
    const base = MAP_DATA.nodes.find((x) => x.id === 'ethereum')!;
    const nodes = [
      { ...base, id: 'a', detail: { whatItIs: words(59), howItWorks: words(101) } },
      { ...base, id: 'b', detail: { whatItIs: words(70) + ' The leading chain.', howItWorks: words(70) + '\n**bold**' } },
      { ...base, id: 'c', detail: { whatItIs: words(60), howItWorks: words(100) } }
    ];
    const errs = validateMapData(buildMapData(MAP_DATA.categories, nodes, []), demoIds, { requireDetail: true }).join('\n');
    expect(errs).toMatch(/a: whatItIs has 59 words \(60–90\)/);
    expect(errs).toMatch(/a: howItWorks has 101 words \(60–100\)/);
    expect(errs).toMatch(/b: promotional or market wording "leading"/);
    expect(errs).toMatch(/b: howItWorks must be plain text/);
    expect(errs).not.toMatch(/^c: (whatItIs|howItWorks|promotional)/m);
    expect(wordCount('  two   words ')).toBe(2);
  });

  it('flags stale entries after six months', () => {
    expect(staleNodes(MAP_DATA.nodes, new Date('2026-12-01'))).toEqual([]);
    expect(staleNodes(MAP_DATA.nodes, new Date('2027-07-01')).length).toBe(100);
  });

  it('finds nodes by name and alias, exact names first', () => {
    expect(searchNodes(MAP_DATA.nodes, 'arb')[0].id).toBe('arbitrum');
    expect(searchNodes(MAP_DATA.nodes, 'ETHEREUM')[0].id).toBe('ethereum');
    expect(searchNodes(MAP_DATA.nodes, '')).toEqual([]);
  });
});

describe('clusters (view)', () => {
  it('collapses each cluster into one bubble, with connections merged onto it', () => {
    const v = buildView(MAP_DATA, NONE);
    const members = MAP_DATA.clusters.reduce((t, c) => t + c.members.length, 0);
    expect(v.items).toHaveLength(100 - members + MAP_DATA.clusters.length);
    const l2 = clusterItemId('eth-l2s');
    expect(v.visibleOf('arbitrum')).toBe(l2);
    const toEth = v.edgesOf.get('ethereum')!.find((e) => e.from === l2 || e.to === l2)!;
    expect(toEth.edges.length).toBeGreaterThanOrEqual(10); // every L2 settles on Ethereum
    expect(v.neighbours.get(l2)!.has('ethereum')).toBe(true);
  });

  it('shows every node when all clusters are expanded', () => {
    const v = buildView(MAP_DATA, ALL);
    expect(v.items).toHaveLength(100);
    // One drawn line per pair of nodes (a pair can have several connections).
    const pairs = new Set(MAP_DATA.edges.map((e) => [e.from, e.to].sort().join('|')));
    expect(v.edges.length).toBe(pairs.size);
  });
});

describe('ecosystem map layout', () => {
  it('sectors cover the full circle, at least 12° each', () => {
    const sectors = computeSectors(MAP_DATA.categories, MAP_DATA.nodes);
    expect(sectors.reduce((t, s) => t + (s.end - s.start), 0)).toBeCloseTo(360, 6);
    for (const s of sectors) expect(s.end - s.start).toBeGreaterThanOrEqual(12);
  });

  for (const [label, expanded] of [
    ['collapsed (default)', NONE],
    ['fully expanded', ALL]
  ] as const) {
    it(`places every item in its ring and sector, without overlaps (${label})`, () => {
      const view = buildView(MAP_DATA, expanded);
      const layout = computeLayout(MAP_DATA.categories, MAP_DATA.nodes, view.items);
      expect(layout.positions.size).toBe(view.items.length);
      const sector = new Map(layout.sectors.map((s) => [s.id, s]));
      for (const it of view.items) {
        const p = layout.positions.get(it.id)!;
        const frac = p.r / R;
        if (it.layer === 1) expect(frac, it.id).toBeLessThan(0.33);
        else if (it.layer === 2) expect(frac, it.id).toBeGreaterThan(0.34);
        else expect(frac, it.id).toBeGreaterThan(0.59);
        if (it.layer !== 1) {
          const s = sector.get(it.category)!;
          expect(p.angle, it.id).toBeGreaterThanOrEqual(s.start);
          expect(p.angle, it.id).toBeLessThanOrEqual(s.end);
        }
      }
      const pts = [...layout.positions.entries()];
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const [a, pa] = pts[i];
          const [b, pb] = pts[j];
          expect(Math.hypot(pa.x - pb.x, pa.y - pb.y), `${a} vs ${b}`).toBeGreaterThan(30);
        }
    });
  }

  it('expanding one cluster only moves items in its own sector', () => {
    const before = computeLayout(MAP_DATA.categories, MAP_DATA.nodes, buildView(MAP_DATA, NONE).items).positions;
    const after = computeLayout(MAP_DATA.categories, MAP_DATA.nodes, buildView(MAP_DATA, new Set(['wallets'])).items).positions;
    for (const n of MAP_DATA.nodes.filter((x) => x.category !== 'wallets' && before.has(x.id))) expect(after.get(n.id), n.id).toEqual(before.get(n.id));
  });
});
