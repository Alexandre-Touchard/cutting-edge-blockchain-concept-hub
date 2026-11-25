// Which item labels to draw, and where: most important first. Each label tries its usual position,
// then its alternatives (e.g. the other side of the item); if all would overlap a label already drawn
// or another item's marker, it waits for zoom/hover. Pure; tested in labelCulling.test.ts.

export type LabelPos = { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
export type LabelCandidate = LabelPos & {
  id: string;
  text: string;
  fontPx: number;
  bold?: boolean;
  /** Higher draws first. */
  priority: number;
  /** Always drawn, even over other labels (focused, selected, search match). */
  force?: boolean;
  /** May cover other items' markers (group names, which must stay readable). */
  ignoreMarkers?: boolean;
  /** Other positions to try, in order, when the first one is taken. */
  alts?: LabelPos[];
};
export type Marker = { id: string; x: number; y: number; r: number };

export type Box = { left: number; top: number; right: number; bottom: number };

/** Approximate text box (no DOM measuring: fast enough to run on every zoom step). */
export function labelBox(c: Pick<LabelCandidate, 'x' | 'y' | 'anchor' | 'text' | 'fontPx' | 'bold'>): Box {
  const w = c.text.length * c.fontPx * (c.bold ? 0.62 : 0.56);
  const left = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - w : c.x - w / 2;
  // SVG text y is the baseline.
  return { left, top: c.y - c.fontPx * 0.85, right: left + w, bottom: c.y + c.fontPx * 0.25 };
}

const overlap = (a: Box, b: Box, gap = 2) => a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;

/**
 * Chosen position for each label that is drawn (absent = hidden for now).
 * `fixed`: boxes already taken (e.g. sector names), which labels must avoid.
 */
export function cullLabels(candidates: LabelCandidate[], markers: Marker[], fixed: Box[] = []): Map<string, LabelPos> {
  const shown = new Map<string, LabelPos>();
  const placed: Box[] = [...fixed];
  const order = [...candidates].sort((a, b) => Number(!!b.force) - Number(!!a.force) || b.priority - a.priority);
  for (const c of order) {
    const options: LabelPos[] = [{ x: c.x, y: c.y, anchor: c.anchor }, ...(c.alts ?? [])];
    const fits = (pos: LabelPos, checkMarkers: boolean) => {
      const box = labelBox({ ...c, ...pos });
      if (placed.some((p) => overlap(box, p))) return false;
      return !checkMarkers || !markers.some((m) => m.id !== c.id && overlap(box, { left: m.x - m.r, top: m.y - m.r, right: m.x + m.r, bottom: m.y + m.r }, 0));
    };
    // Every position clear of markers first; labels allowed to cover markers (groups) then retry without that check.
    let chosen: LabelPos | null = options.find((pos) => fits(pos, true)) ?? null;
    if (!chosen && c.ignoreMarkers) chosen = options.find((pos) => fits(pos, false)) ?? null;
    if (!chosen && c.force) chosen = options[0];
    if (chosen) {
      shown.set(c.id, chosen);
      placed.push(labelBox({ ...c, ...chosen }));
    }
  }
  return shown;
}
