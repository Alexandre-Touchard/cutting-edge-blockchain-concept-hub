// What the map shows for a given set of expanded clusters: visible items (nodes, or one bubble per
// collapsed cluster), connections merged between visible items, and neighbours. Pure; tested.
import type { MapData } from './data';
import type { CategoryId, Cluster, Layer, MapEdge, MapNode } from './types';

export const CLUSTER_PREFIX = 'cluster:';
export const clusterItemId = (clusterId: string) => `${CLUSTER_PREFIX}${clusterId}`;
export const isClusterItem = (id: string) => id.startsWith(CLUSTER_PREFIX);

export type VisibleItem =
  | { id: string; type: 'node'; node: MapNode; category: CategoryId; layer: Layer; subBand?: MapNode['subBand'] }
  | { id: string; type: 'cluster'; cluster: Cluster; members: MapNode[]; category: CategoryId; layer: Layer; subBand?: MapNode['subBand'] };

/** A drawn connection between two visible items; several data edges when an end is a collapsed cluster. */
export type VisibleEdge = { id: string; from: string; to: string; edges: MapEdge[]; main: MapEdge };

export type MapView = {
  items: VisibleItem[];
  itemById: Map<string, VisibleItem>;
  /** Visible item standing for a node (itself, or its collapsed cluster's bubble). */
  visibleOf: (nodeId: string) => string;
  edges: VisibleEdge[];
  edgesOf: Map<string, VisibleEdge[]>;
  neighbours: Map<string, Set<string>>;
};

export function buildView(data: MapData, expanded: ReadonlySet<string>): MapView {
  const collapsedOf = new Map<string, Cluster>();
  for (const c of data.clusters) if (!expanded.has(c.id)) for (const m of c.members) collapsedOf.set(m, c);

  const items: VisibleItem[] = [];
  const emitted = new Set<string>();
  for (const n of data.nodes) {
    const c = collapsedOf.get(n.id);
    if (!c) {
      items.push({ id: n.id, type: 'node', node: n, category: n.category, layer: n.layer, subBand: n.subBand });
      continue;
    }
    if (emitted.has(c.id)) continue;
    emitted.add(c.id);
    const members = c.members.map((id) => data.nodeById.get(id)!).filter(Boolean);
    items.push({ id: clusterItemId(c.id), type: 'cluster', cluster: c, members, category: n.category, layer: n.layer, subBand: n.subBand });
  }
  const itemById = new Map(items.map((i) => [i.id, i]));
  const visibleOf = (nodeId: string) => {
    const c = collapsedOf.get(nodeId);
    return c ? clusterItemId(c.id) : nodeId;
  };

  const merged = new Map<string, VisibleEdge>();
  for (const e of data.edges) {
    const from = visibleOf(e.from);
    const to = visibleOf(e.to);
    if (from === to) continue; // inside one collapsed cluster
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    const v = merged.get(key);
    if (v) {
      v.edges.push(e);
      if (e.strength > v.main.strength) v.main = e;
    } else merged.set(key, { id: key, from, to, edges: [e], main: e });
  }
  const edges = [...merged.values()];
  const edgesOf = new Map<string, VisibleEdge[]>(items.map((i) => [i.id, []]));
  const neighbours = new Map<string, Set<string>>(items.map((i) => [i.id, new Set<string>()]));
  for (const e of edges) {
    edgesOf.get(e.from)!.push(e);
    edgesOf.get(e.to)!.push(e);
    neighbours.get(e.from)!.add(e.to);
    neighbours.get(e.to)!.add(e.from);
  }
  for (const list of edgesOf.values()) list.sort((a, b) => b.main.strength - a.main.strength || b.edges.length - a.edges.length);
  return { items, itemById, visibleOf, edges, edgesOf, neighbours };
}

/** Name of a visible item (a node's name, or a cluster's name with its size). */
export const itemName = (i: VisibleItem) => (i.type === 'node' ? i.node.name : `${i.cluster.name} (${i.members.length})`);
