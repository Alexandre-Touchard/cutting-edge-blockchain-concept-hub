// Deterministic polar layout (spec §2): ring = layer, angle = category sector.
// Pure and stable: the same data always gives the same positions (shareable URLs, no jitter).
import type { Category, CategoryId, MapNode } from './types';

/** Radius of the map in SVG units; the viewBox adds room for sector labels. */
export const R = 500;

/** Radial bands as fractions of R: [single-row radius, two-row radii]. */
const BANDS = {
  ring0: { single: 0.23, rows: [0.18, 0.28] },
  ring1: { single: 0.45, rows: [0.39, 0.51] },
  l3: { single: 0.65, rows: [0.62, 0.68] },
  app: { single: 0.85, rows: [0.78, 0.92] }
} as const;

/** Background annuli drawn behind the nodes (fractions of R). */
export const RING_BACKGROUNDS = [
  { id: 1, inner: 0, outer: 0.32 },
  { id: 2, inner: 0.34, outer: 0.57 },
  { id: 3, inner: 0.59, outer: 0.99 }
] as const;

const MIN_SECTOR_DEG = 12;
/** Minimum distance between neighbouring nodes on the same row, in SVG units. */
const MIN_SPACING = { ring1: 52, l3: 52, app: 58 };

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

/** Sector widths: 12° minimum, the rest shared by number of nodes. The first sector is centred at the top. */
export function computeSectors(categories: Category[], nodes: MapNode[]): Sector[] {
  const count = (id: CategoryId) => nodes.filter((n) => n.category === id).length;
  const total = nodes.length || 1;
  const spare = 360 - MIN_SECTOR_DEG * categories.length;
  const widths = categories.map((c) => MIN_SECTOR_DEG + (spare * count(c.id)) / total);
  let a = -90 - widths[0] / 2;
  return categories.map((c, i) => {
    const s = { id: c.id, name: c.name, color: c.color, start: a, end: a + widths[i], mid: a + widths[i] / 2 };
    a += widths[i];
    return s;
  });
}

function band(n: MapNode): keyof typeof BANDS {
  if (n.layer === 1) return 'ring0';
  if (n.layer === 2) return 'ring1';
  return n.subBand === 'l3-chain' ? 'l3' : 'app';
}

/** Spread nodes of one (sector, band) group across the sector; zigzag on two rows when crowded. */
function placeGroup(group: MapNode[], s: Sector, b: 'ring1' | 'l3' | 'app', out: Map<string, Placed>) {
  const n = group.length;
  const width = s.end - s.start;
  const pad = Math.min(3, width * 0.1);
  const usable = width - 2 * pad;
  const arc = rad(usable) * BANDS[b].single * R;
  const twoRows = n > 1 && arc / n < MIN_SPACING[b];
  group.forEach((node, i) => {
    const angle = s.start + pad + ((i + 0.5) / n) * usable;
    // Application labels point inward: outward they would run into the sector names.
    out.set(node.id, { ...place(angle, twoRows ? BANDS[b].rows[i % 2] : BANDS[b].single), labelIn: b === 'app' });
  });
}

/** Minimum angle between two centre nodes (12 × 24° = 288° fits in the circle). */
const CENTRE_MIN_SEP = 24;

/**
 * Ring 0 holds the Layer 1s in a small circle. Each starts at its own sector's angle (spread a little
 * when a sector has several), then neighbours are pushed apart until they are CENTRE_MIN_SEP degrees
 * apart. Nodes stay as close as possible to their sector without overlapping.
 */
function placeCentre(l1: MapNode[], sectors: Sector[], out: Map<string, Placed>) {
  const n = l1.length;
  if (!n) return;
  const items: { node: MapNode; a: number }[] = [];
  for (const s of sectors) {
    const group = l1.filter((x) => x.category === s.id);
    const step = Math.min((s.end - s.start) / group.length, CENTRE_MIN_SEP);
    group.forEach((node, i) => items.push({ node, a: s.mid + (i - (group.length - 1) / 2) * step }));
  }
  items.sort((x, y) => x.a - y.a);
  const sep = Math.min(CENTRE_MIN_SEP, 360 / n);
  for (let iter = 0; iter < 2000; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const gap = items[j].a + (j === 0 ? 360 : 0) - items[i].a;
      if (gap < sep - 1e-6) {
        const push = (sep - gap) / 2;
        items[i].a -= push;
        items[j].a += push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  // Alternate labels in and out so neighbouring names don't collide.
  items.forEach((it, i) => out.set(it.node.id, { ...place(it.a, BANDS.ring0.single), labelIn: i % 2 === 1 }));
}

export function computeLayout(categories: Category[], nodes: MapNode[]): Layout {
  const sectors = computeSectors(categories, nodes);
  const positions = new Map<string, Placed>();
  placeCentre(
    nodes.filter((n) => n.layer === 1),
    sectors,
    positions
  );
  for (const s of sectors) {
    for (const b of ['ring1', 'l3', 'app'] as const) {
      const group = nodes.filter((n) => n.category === s.id && n.layer !== 1 && band(n) === b);
      if (group.length) placeGroup(group, s, b, positions);
    }
  }
  return { sectors, positions };
}

/** Quadratic Bézier between two nodes, bent toward the centre so edges bundle through the rings. */
export function edgePath(a: Placed, b: Placed): { d: string; mid: { x: number; y: number } } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const cx = mx * 0.55;
  const cy = my * 0.55;
  // Point at t = 0.5 on the curve, for labels.
  const mid = { x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x, y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y };
  return { d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`, mid };
}

/** Where to draw a node's label: next to the node, along its radius (outward, or inward if `labelIn`). */
export function labelAnchor(p: Placed, offset: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const a = rad(p.angle);
  const dir = p.labelIn ? -1 : 1;
  const cos = Math.cos(a) * dir;
  const sin = Math.sin(a) * dir;
  const anchor = Math.abs(cos) < 0.35 ? 'middle' : cos > 0 ? 'start' : 'end';
  return { x: p.x + cos * offset, y: p.y + sin * offset + (Math.abs(cos) < 0.35 ? (sin > 0 ? 8 : -2) : 4), anchor };
}
