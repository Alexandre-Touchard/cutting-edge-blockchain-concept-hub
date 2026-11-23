// Data rules from spec §5.2. Returns human-readable problems (empty = valid).
import type { MapData } from './data';
import type { EdgeType, MapEdge, MapNode, Tour } from './types';
import { EDGE_TYPES } from './types';

export const LIMITS = { summary: 140, edgeLabel: 90, goodToKnow: 3 };

/** Direction rule per edge type (§5.3). */
const DIRECTION: Record<EdgeType, (from: MapNode, to: MapNode) => boolean> = {
  'settles-on': (f, t) => f.kind === 'chain' && t.kind === 'chain' && f.layer > t.layer,
  'deployed-on': (f, t) => f.kind !== 'chain' && t.kind === 'chain',
  'built-with': () => true,
  'built-by': (_f, t) => t.kind !== 'chain',
  'same-builder': () => true,
  'data-feed': (f) => f.category === 'oracles',
  'data-availability': (f, t) => f.category === 'restaking' && t.kind === 'chain',
  collateral: (f) => f.kind !== 'chain',
  bridges: (f, t) => f.category === 'interop' || (f.kind === 'chain' && t.kind === 'chain'),
  secures: (f) => f.category === 'restaking' || f.kind === 'chain',
  gateway: (f) => f.kind !== 'chain',
  issues: (f, t) => f.category === 'stablecoins' && t.kind === 'chain'
};

export function validateMapData(d: MapData, demoIds: Set<string>, opts: { requireDetail?: boolean } = {}): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const n of d.nodes) {
    if (ids.has(n.id)) errs.push(`duplicate node id ${n.id}`);
    ids.add(n.id);
    if (!/^[a-z0-9-]+$/.test(n.id)) errs.push(`${n.id}: id must be a lowercase slug`);
    if (!d.categoryById.has(n.category)) errs.push(`${n.id}: unknown category ${n.category}`);
    if (![1, 2, 3].includes(n.layer)) errs.push(`${n.id}: bad layer`);
    if (n.layer === 3 && !n.subBand) errs.push(`${n.id}: outer-rim node needs a subBand`);
    if (n.layer !== 3 && n.subBand) errs.push(`${n.id}: only outer-rim nodes have a subBand`);
    if (!n.summary.trim()) errs.push(`${n.id}: missing summary`);
    if (n.summary.length > LIMITS.summary) errs.push(`${n.id}: summary is ${n.summary.length} chars (max ${LIMITS.summary})`);
    if (n.goodToKnow.length > LIMITS.goodToKnow) errs.push(`${n.id}: more than ${LIMITS.goodToKnow} "good to know" bullets`);
    if (n.sources.length < 1) errs.push(`${n.id}: needs at least one source`);
    for (const s of n.sources) if (!/^https:\/\//.test(s.url) || !s.label.trim()) errs.push(`${n.id}: bad source ${s.url}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.verifiedOn)) errs.push(`${n.id}: verifiedOn must be an ISO date`);
    for (const demo of n.demos) if (!demoIds.has(demo)) errs.push(`${n.id}: unknown demo ${demo}`);
    if (opts.requireDetail && !n.detail) errs.push(`${n.id}: missing detail (v1.1)`);
    // Fields (spec §5.1): vm for chains, consensus for every Layer 1, rollup type only on rollups.
    if (n.kind !== 'chain' && (n.vm || n.consensus || n.rollupType)) errs.push(`${n.id}: vm/consensus/rollupType are for chains only`);
    if (n.vm && !['evm', 'svm', 'move', 'other'].includes(n.vm)) errs.push(`${n.id}: bad vm ${n.vm}`);
    if (n.consensus && !['pow', 'pos', 'other'].includes(n.consensus)) errs.push(`${n.id}: bad consensus ${n.consensus}`);
    if (n.rollupType && !['optimistic', 'zk'].includes(n.rollupType)) errs.push(`${n.id}: bad rollupType ${n.rollupType}`);
    if (n.layer === 1 && n.kind === 'chain' && (!n.consensus || !n.vm)) errs.push(`${n.id}: Layer 1 needs vm and consensus`);
    if (n.rollupType && n.layer === 1) errs.push(`${n.id}: a Layer 1 can't be a rollup`);
    if (n.status && !['live', 'discontinued'].includes(n.status)) errs.push(`${n.id}: bad status ${n.status}`);
  }

  // Clusters: members exist, share a sector and a band, and point back to their cluster.
  const band = (n: MapNode) => (n.layer === 3 ? `3-${n.subBand}` : String(n.layer));
  const inCluster = new Map<string, string>();
  for (const c of d.clusters) {
    if (c.members.length < 2) errs.push(`cluster ${c.id}: needs at least two members`);
    const members = c.members.map((id) => d.nodeById.get(id));
    if (members.some((m) => !m)) errs.push(`cluster ${c.id}: unknown member`);
    const ok = members.filter(Boolean) as MapNode[];
    if (new Set(ok.map((m) => m.category)).size > 1) errs.push(`cluster ${c.id}: members span several categories`);
    if (new Set(ok.map(band)).size > 1) errs.push(`cluster ${c.id}: members span several rings`);
    for (const m of ok) {
      if (inCluster.has(m.id)) errs.push(`${m.id}: in two clusters`);
      inCluster.set(m.id, c.id);
      if (m.cluster !== c.id) errs.push(`${m.id}: cluster field should be ${c.id}`);
    }
  }
  for (const n of d.nodes) if (n.cluster && inCluster.get(n.id) !== n.cluster) errs.push(`${n.id}: cluster ${n.cluster} doesn't list it`);

  const seen = new Set<string>();
  for (const e of d.edges) {
    const f = d.nodeById.get(e.from);
    const t = d.nodeById.get(e.to);
    if (!f || !t) {
      errs.push(`${e.id}: references a missing node`);
      continue;
    }
    if (!EDGE_TYPES.includes(e.type)) errs.push(`${e.id}: unknown type ${e.type}`);
    if (e.id !== `${e.from}--${e.type}--${e.to}`) errs.push(`${e.id}: id must be from--type--to`);
    const key = `${e.from}|${e.to}|${e.type}`;
    if (seen.has(key)) errs.push(`${e.id}: duplicate edge`);
    seen.add(key);
    if (e.from === e.to) errs.push(`${e.id}: self-loop`);
    if (!DIRECTION[e.type]?.(f, t)) errs.push(`${e.id}: direction or endpoints don't fit type ${e.type}`);
    if (!e.label.trim()) errs.push(`${e.id}: missing label`);
    if (e.label.length > LIMITS.edgeLabel) errs.push(`${e.id}: label is ${e.label.length} chars (max ${LIMITS.edgeLabel})`);
  }

  for (const n of d.nodes) if (!(d.edgesOf.get(n.id)?.length)) errs.push(`${n.id}: has no edge`);

  const linked = new Set(d.nodes.flatMap((n) => n.demos));
  for (const demo of demoIds) if (!linked.has(demo)) errs.push(`demo ${demo} is not linked from any node`);

  return errs;
}

/** verifiedOn older than `months` (a warning, not a failure). */
export function staleNodes(nodes: MapNode[], now: Date, months = 6): string[] {
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() - months);
  return nodes.filter((n) => new Date(n.verifiedOn) < limit).map((n) => n.id);
}

export type { MapEdge };

/** Tours point at existing nodes and demos, with short steps. */
export function validateTours(tours: Tour[], d: MapData, demoIds: Set<string>): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const t of tours) {
    if (ids.has(t.id)) errs.push(`tour ${t.id}: duplicate id`);
    ids.add(t.id);
    if (t.steps.length < 3 || t.steps.length > 8) errs.push(`tour ${t.id}: needs 3 to 8 steps`);
    for (const s of t.steps) {
      if (!d.nodeById.has(s.node)) errs.push(`tour ${t.id}: unknown node ${s.node}`);
      if (!s.text.trim() || s.text.length > 220) errs.push(`tour ${t.id}: step on ${s.node} must be 1-220 chars (${s.text.length})`);
    }
    if (!t.demos.length) errs.push(`tour ${t.id}: should end on at least one demo`);
    for (const demo of t.demos) if (!demoIds.has(demo)) errs.push(`tour ${t.id}: unknown demo ${demo}`);
  }
  return errs;
}
