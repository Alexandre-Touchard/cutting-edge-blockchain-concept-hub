// Data rules from spec §5.2. Returns human-readable problems (empty = valid).
import type { MapData } from './data';
import type { EdgeType, MapEdge, MapNode } from './types';
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
  }

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
