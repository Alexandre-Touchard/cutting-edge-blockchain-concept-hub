// Ecosystem map data model (spec: specification/ecosystem-graph-spec.md §5).
// English text lives in the data; French and Spanish come in v1.2 as locale files keyed by id.

export type Layer = 1 | 2 | 3; // 3 = outer rim ("Applications & Layer 3")
export type Kind = 'chain' | 'app' | 'tool';

export type CategoryId =
  | 'ethereum'
  | 'restaking'
  | 'oracles'
  | 'interop'
  | 'interchain'
  | 'altl1'
  | 'privacy'
  | 'bitcoin'
  | 'stablecoins'
  | 'defi'
  | 'wallets'
  | 'devtools';

export type Category = { id: CategoryId; name: string; kind: string; color: string };

export type MapNode = {
  id: string;
  name: string;
  aliases: string[];
  kind: Kind;
  layer: Layer;
  /** Outer rim only: L3 chains sit on an inner sub-band, apps and tools on the outer one. */
  subBand?: 'l3-chain' | 'app-tool';
  category: CategoryId;
  summary: string;
  goodToKnow: string[];
  /** Demo ids from src/demos/demoRegistry.ts */
  demos: string[];
  sources: { label: string; url: string }[];
  verifiedOn: string;
  confidence: 'high' | 'check';
  /** From v1.1 */
  detail?: { whatItIs: string; howItWorks: string };
};

export type EdgeType =
  | 'settles-on'
  | 'deployed-on'
  | 'built-with'
  | 'built-by'
  | 'same-builder'
  | 'data-feed'
  | 'data-availability'
  | 'collateral'
  | 'bridges'
  | 'secures'
  | 'gateway'
  | 'issues';

export type MapEdge = {
  id: string; // `${from}--${type}--${to}`
  from: string;
  to: string;
  type: EdgeType;
  label: string;
  strength: 1 | 2 | 3;
  confidence: 'high' | 'check';
};

export const EDGE_TYPES: EdgeType[] = [
  'settles-on',
  'deployed-on',
  'issues',
  'bridges',
  'data-feed',
  'data-availability',
  'secures',
  'collateral',
  'built-with',
  'built-by',
  'same-builder',
  'gateway'
];

/** Undirected types: drawn without an arrow, listed the same way on both sides. */
export const UNDIRECTED: ReadonlySet<EdgeType> = new Set(['built-with', 'same-builder']);
