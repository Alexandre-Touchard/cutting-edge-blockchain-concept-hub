// Places connection-explanation boxes so they don't overlap each other, the hover card or the
// hovered node. Each box starts centred on its anchor (the connection's midpoint) and moves to the
// nearest free spot on a spiral around it. Pure; tested in labelPlacement.test.ts.

export type Rect = { left: number; top: number; right: number; bottom: number };
export type LabelBox = { id: string; ax: number; ay: number; w: number; h: number };
export type Placement = { x: number; y: number }; // centre of the box

const GAP = 6;
const STEP = 12;
const MAX_RADIUS = 320;
/** Directions tried at each radius (degrees, 90 = down): straight down/up first, then more sideways. */
const DIRECTIONS = [90, 270, 60, 120, 240, 300, 30, 150, 210, 330, 0, 180];

const rectAt = (x: number, y: number, w: number, h: number): Rect => ({ left: x - w / 2, top: y - h / 2, right: x + w / 2, bottom: y + h / 2 });

export function intersects(a: Rect, b: Rect, gap = 0): boolean {
  return a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
}

export function placeLabels(boxes: LabelBox[], obstacles: Rect[], bounds: { w: number; h: number }): Map<string, Placement> {
  const placed: Rect[] = [...obstacles];
  const out = new Map<string, Placement>();
  // Top to bottom, so nearby boxes settle in a natural reading order.
  const order = [...boxes].sort((a, b) => a.ay - b.ay || a.ax - b.ax);
  for (const b of order) {
    const fits = (x: number, y: number) => {
      const r = rectAt(x, y, b.w, b.h);
      if (r.left < 4 || r.top < 4 || r.right > bounds.w - 4 || r.bottom > bounds.h - 4) return false;
      return !placed.some((p) => intersects(r, p, GAP));
    };
    let best: Placement | null = fits(b.ax, b.ay) ? { x: b.ax, y: b.ay } : null;
    for (let radius = STEP; !best && radius <= MAX_RADIUS; radius += STEP) {
      for (const deg of DIRECTIONS) {
        if (best) break;
        const a = (deg * Math.PI) / 180;
        // Horizontal steps are longer: boxes are wider than they are tall.
        const x = b.ax + Math.cos(a) * radius * 1.6;
        const y = b.ay + Math.sin(a) * radius;
        if (fits(x, y)) best = { x, y };
      }
    }
    const chosen = best ?? { x: Math.min(Math.max(b.ax, b.w / 2 + 4), bounds.w - b.w / 2 - 4), y: Math.min(Math.max(b.ay, b.h / 2 + 4), bounds.h - b.h / 2 - 4) };
    out.set(b.id, chosen);
    placed.push(rectAt(chosen.x, chosen.y, b.w, b.h));
  }
  return out;
}
