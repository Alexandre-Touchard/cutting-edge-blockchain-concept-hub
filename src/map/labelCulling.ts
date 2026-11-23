// Which item labels to draw: most important first, skipping any label that would overlap one
// already drawn or another item's marker. Hidden labels appear when zooming in or on hover/focus.
// Pure; tested in labelCulling.test.ts.

export type LabelCandidate = {
  id: string;
  /** Anchor in screen pixels. */
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  text: string;
  fontPx: number;
  bold?: boolean;
  /** Higher draws first. */
  priority: number;
  /** Always drawn (focused, selected, search match). */
  force?: boolean;
};
export type Marker = { id: string; x: number; y: number; r: number };

type Box = { left: number; top: number; right: number; bottom: number };

/** Approximate text box (no DOM measuring: fast enough to run on every zoom step). */
export function labelBox(c: LabelCandidate): Box {
  const w = c.text.length * c.fontPx * (c.bold ? 0.62 : 0.56);
  const left = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - w : c.x - w / 2;
  // SVG text y is the baseline.
  return { left, top: c.y - c.fontPx * 0.85, right: left + w, bottom: c.y + c.fontPx * 0.25 };
}

const overlap = (a: Box, b: Box, gap = 2) => a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;

export function cullLabels(candidates: LabelCandidate[], markers: Marker[]): Set<string> {
  const shown = new Set<string>();
  const placed: Box[] = [];
  const order = [...candidates].sort((a, b) => Number(!!b.force) - Number(!!a.force) || b.priority - a.priority);
  for (const c of order) {
    const box = labelBox(c);
    const hitsLabel = placed.some((p) => overlap(box, p));
    const hitsMarker = markers.some((m) => m.id !== c.id && overlap(box, { left: m.x - m.r, top: m.y - m.r, right: m.x + m.r, bottom: m.y + m.r }, 0));
    if (c.force || (!hitsLabel && !hitsMarker)) {
      shown.add(c.id);
      placed.push(box);
    }
  }
  return shown;
}
