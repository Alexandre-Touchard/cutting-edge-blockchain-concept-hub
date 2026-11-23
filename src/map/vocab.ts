// Shared UI vocabulary and styles for the ecosystem map (edge colours, layer and kind names).
import type { EdgeType, Kind, MapNode } from './types';

export type Tr = (english: string, opts?: Record<string, unknown>) => string;

export const MAP_I18N_ID = 'ecosystem-map';

export const EDGE_STYLE: Record<EdgeType, { color: string; dash?: string }> = {
  'settles-on': { color: '#818cf8' },
  'deployed-on': { color: '#94a3b8' },
  issues: { color: '#4ade80' },
  bridges: { color: '#f472b6', dash: '8 4' },
  'data-feed': { color: '#38bdf8', dash: '4 3' },
  'data-availability': { color: '#2dd4bf', dash: '8 4' },
  secures: { color: '#2dd4bf' },
  collateral: { color: '#facc15', dash: '2 3' },
  'built-with': { color: '#c084fc', dash: '6 3' },
  'built-by': { color: '#c084fc', dash: '2 3' },
  'same-builder': { color: '#c084fc', dash: '1 4' },
  gateway: { color: '#64748b', dash: '1 3' }
};

export function edgeTypeName(t: EdgeType, tr: Tr): string {
  return {
    'settles-on': tr('Settles on'),
    'deployed-on': tr('Runs on'),
    issues: tr('Issues'),
    bridges: tr('Bridges'),
    'data-feed': tr('Data feed'),
    'data-availability': tr('Data availability'),
    secures: tr('Secures'),
    collateral: tr('Collateral'),
    'built-with': tr('Same tech stack'),
    'built-by': tr('Built by'),
    'same-builder': tr('Same builder'),
    gateway: tr('Gateway / access')
  }[t];
}

export function kindName(k: Kind, tr: Tr): string {
  return { chain: tr('Chain'), app: tr('Application'), tool: tr('Tool / infrastructure') }[k];
}

export function layerName(n: Pick<MapNode, 'layer' | 'subBand'>, tr: Tr): string {
  if (n.layer === 1) return tr('Layer 1');
  if (n.layer === 2) return tr('Layer 2');
  return n.subBand === 'l3-chain' ? tr('Layer 3') : tr('Application layer');
}

/** "Nov 2026" from an ISO date, in the UI language. */
export function monthYear(iso: string, lang?: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
