// Deterministic polar layout (spec §2): ring = layer, angle = category sector.
// Pure and stable: the same data always gives the same positions (shareable URLs, no jitter).
// Sector widths come from the full data, so expanding a cluster only rearranges its own sector.
import type { Category, CategoryId, MapNode } from './types';
import type { VisibleItem } from './view';

/** Radius of the map in SVG units; the viewBox adds room for sector labels. */
export const R = 500;

type Band = 'ring1' | 'l3' | 'app';
/** Row radii (fractions of R) for 1, 2 or 3 rows in each band. */
const ROWS: Record<Band, number[][]> = {
  ring1: [[0.45], [0.39, 0.51], [0.37, 0.45, 0.53]],
  l3: [[0.65], [0.62, 0.68], [0.62, 0.68]],
  app: [[0.85], [0.78, 0.92], [0.75, 0.84, 0.93]]
};
/** Minimum distance between neighbouring items on the same row, in SVG units. */
const MIN_SPACING: Record<Band, number> = { ring1: 52, l3: 52, app: 58 };

/** Background annuli drawn behind the nodes (fractions of R). */
export const RING_BACKGROUNDS = [
  { id: 1, inner: 0, outer: 0.33 },
  { id: 2, inner: 0.34, outer: 0.57 },
  { id: 3, inner: 0.59, outer: 0.99 }
] as const;

const MIN_SECTOR_DEG = 12;
/** Centre: one row up to this many Layer 1s, two rows beyond. */
const CENTRE_ONE_ROW_MAX = 14;
const CENTRE_MIN_SEP = 24;

export type Sector = { id: CategoryId; name: string; color: string; start: number; end: number; mid: number };
/** `labelIn`: draw the label toward the centre instead of outward (avoids collisions). */
export type Placed = { x: number; y: number; angle: number; r: number; labelIn?: boolean };
export type Layout = { sectors: Sector[]; positions: Map<string, Placed> };

const rad = (deg: number) => (deg * Math.PI) / 180;
const place = (angleDeg: number, rFrac: number): Placed => ({
  x: Math.cos(rad(angleDeg)) * rFrac * R,
  y: Math.sin(rad(angleDeg)) * rFrac * R,
  angle: angleDeg,
  r: rFrac * R
});

function bandOf(i: { layer: number; subBand?: MapNode['subBand'] }): Band | 'ring0' {
  if (i.layer === 1) return 'ring0';
  if (i.layer === 2) return 'ring1';
  return i.subBand === 'l3-chain' ? 'l3' : 'app';
}

/**
 * Sector widths: 12° minimum, the rest shared by how crowded each sector's busiest ring is
 * (Layer 2s count double: their ring is smaller). The first sector is centred at the top.
 * Centre (Layer 1) nodes don't count: they are spread around the whole centre circle.
 */
export function computeSectors(categories: Category[], nodes: MapNode[]): Sector[] {
  const weight = (id: CategoryId) => {
    const of = (b: string) => nodes.filter((n) => n.category === id && bandOf(n) === b).length;
    return Math.max(of('app'), of('l3'), 2 * of('ring1'));
  };
  const weights = categories.map((c) => weight(c.id));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const spare = 360 - MIN_SECTOR_DEG * categories.length;
  const widths = weights.map((w) => MIN_SECTOR_DEG + (spare * w) / total);
  let a = -90 - widths[0] / 2;
  return categories.map((c, i) => {
    const s = { id: c.id, name: c.name, color: c.color, start: a, end: a + widths[i], mid: a + widths[i] / 2 };
    a += widths[i];
    return s;
  });
}

/** Spread one (sector, band) group across the sector, on as many rows as it needs (up to 3). */
function placeGroup(group: { id: string }[], s: Sector, b: Band, out: Map<string, Placed>) {
  const n = group.length;
  const width = s.end - s.start;
  const pad = Math.min(3, width * 0.1);
  const usable = width - 2 * pad;
  const midR = ROWS[b][0][0];
  const arc = rad(usable) * midR * R;
  const rows = Math.min(3, Math.max(1, Math.ceil((n * MIN_SPACING[b]) / arc)));
  const radii = ROWS[b][rows - 1];
  group.forEach((item, i) => {
    const angle = s.start + pad + ((i + 0.5) / n) * usable;
    // Application labels point inward: outward they would run into the sector names.
    out.set(item.id, { ...place(angle, radii[i % radii.length]), labelIn: b === 'app' });
  });
}

/**
 * Centre: each Layer 1 starts at its own sector's angle (spread a little when a sector has several),
 * then neighbours are pushed apart until evenly spaced enough. With many, two alternating rows.
 */
function placeCentre(items: VisibleItem[], sectors: Sector[], out: Map<string, Placed>) {
  const n = items.length;
  if (!n) return;
  const twoRows = n > CENTRE_ONE_ROW_MAX;
  const sep = twoRows ? 360 / n : Math.min(CENTRE_MIN_SEP, 360 / n);
  const list: { id: string; a: number }[] = [];
  for (const s of sectors) {
    const group = items.filter((x) => x.category === s.id);
    const step = Math.min((s.end - s.start) / group.length, sep);
    group.forEach((it, i) => list.push({ id: it.id, a: s.mid + (i - (group.length - 1) / 2) * step }));
  }
  list.sort((x, y) => x.a - y.a);
  for (let iter = 0; iter < 3000; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const gap = list[j].a + (j === 0 ? 360 : 0) - list[i].a;
      if (gap < sep - 1e-6) {
        const push = (sep - gap) / 2;
        list[i].a -= push;
        list[j].a += push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  list.forEach((it, i) => {
    if (twoRows) {
      const inner = i % 2 === 1;
      out.set(it.id, { ...place(it.a, inner ? 0.17 : 0.29), labelIn: inner });
    } else out.set(it.id, { ...place(it.a, 0.23), labelIn: i % 2 === 1 });
  });
}

/** Positions of the visible items (nodes and cluster bubbles). Sectors come from all nodes. */
export function computeLayout(categories: Category[], nodes: MapNode[], items: VisibleItem[]): Layout {
  const sectors = computeSectors(categories, nodes);
  const positions = new Map<string, Placed>();
  placeCentre(
    items.filter((i) => i.layer === 1),
    sectors,
    positions
  );
  for (const s of sectors) {
    for (const b of ['ring1', 'l3', 'app'] as const) {
      const group = items.filter((i) => i.category === s.id && i.layer !== 1 && bandOf(i) === b);
      if (group.length) placeGroup(group, s, b, positions);
    }
  }
  return { sectors, positions };
}

/** Quadratic Bézier between two items, bent toward the centre so edges bundle through the rings. */
export function edgePath(a: Placed, b: Placed): { d: string; mid: { x: number; y: number } } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const cx = mx * 0.55;
  const cy = my * 0.55;
  // Point at t = 0.5 on the curve, for labels.
  const mid = { x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x, y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y };
  return { d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`, mid };
}

/** Where to draw a label: next to the item, along its radius (outward, or inward if `labelIn`). */
export function labelAnchor(p: Placed, offset: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const a = rad(p.angle);
  const dir = p.labelIn ? -1 : 1;
  const cos = Math.cos(a) * dir;
  const sin = Math.sin(a) * dir;
  const anchor = Math.abs(cos) < 0.35 ? 'middle' : cos > 0 ? 'start' : 'end';
  return { x: p.x + cos * offset, y: p.y + sin * offset + (Math.abs(cos) < 0.35 ? (sin > 0 ? 8 : -2) : 4), anchor };
}
