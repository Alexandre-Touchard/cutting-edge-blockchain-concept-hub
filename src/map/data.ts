// Loads the map data and builds the indexes the UI needs. Pure; validated in data.test.ts.
import categoriesJson from './data/categories.json';
import nodesJson from './data/nodes.json';
import edgesJson from './data/edges.json';
import clustersJson from './data/clusters.json';
import toursJson from './data/tours.json';
import type { Category, CategoryId, Cluster, MapEdge, MapNode, Tour } from './types';

export type MapData = {
  categories: Category[];
  nodes: MapNode[];
  edges: MapEdge[];
  clusters: Cluster[];
  clusterById: Map<string, Cluster>;
  nodeById: Map<string, MapNode>;
  categoryById: Map<CategoryId, Category>;
  /** Every edge touching a node, strongest first. */
  edgesOf: Map<string, MapEdge[]>;
  /** Ids of directly connected nodes. */
  neighbours: Map<string, Set<string>>;
};

export function buildMapData(categories: Category[], nodes: MapNode[], edges: MapEdge[], clusters: Cluster[] = []): MapData {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const edgesOf = new Map<string, MapEdge[]>(nodes.map((n) => [n.id, []]));
  const neighbours = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set<string>()]));
  for (const e of edges) {
    edgesOf.get(e.from)?.push(e);
    edgesOf.get(e.to)?.push(e);
    neighbours.get(e.from)?.add(e.to);
    neighbours.get(e.to)?.add(e.from);
  }
  for (const list of edgesOf.values()) list.sort((a, b) => b.strength - a.strength);
  return { categories, nodes, edges, clusters, clusterById: new Map(clusters.map((c) => [c.id, c])), nodeById, categoryById, edgesOf, neighbours };
}

export const MAP_DATA = buildMapData(categoriesJson as Category[], nodesJson as MapNode[], edgesJson as MapEdge[], clustersJson as Cluster[]);

export const TOURS = toursJson as Tour[];

/** The node at the other end of an edge. */
export const otherEnd = (e: MapEdge, id: string) => (e.from === id ? e.to : e.from);

/** Case- and accent-insensitive search on name and aliases: exact name, then name prefix, then aliases. */
export function searchNodes(nodes: MapNode[], query: string): MapNode[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(query.trim());
  if (!q) return [];
  const scored: { n: MapNode; score: number }[] = [];
  for (const n of nodes) {
    const names = [n.name, ...n.aliases].map(norm);
    if (names[0] === q) scored.push({ n, score: 0 });
    else if (names[0].startsWith(q)) scored.push({ n, score: 1 });
    else if (names.some((x) => x.startsWith(q))) scored.push({ n, score: 2 });
    else if (names.some((x) => x.includes(q))) scored.push({ n, score: 3 });
  }
  return scored.sort((a, b) => a.score - b.score || a.n.name.localeCompare(b.n.name)).map((s) => s.n);
}
