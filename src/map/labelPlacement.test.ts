import { describe, expect, it } from 'vitest';
import { intersects, placeLabels, type LabelBox, type Rect } from './labelPlacement';

const rect = (p: { x: number; y: number }, b: LabelBox): Rect => ({ left: p.x - b.w / 2, top: p.y - b.h / 2, right: p.x + b.w / 2, bottom: p.y + b.h / 2 });

describe('label placement', () => {
  it('keeps a lone box on its anchor', () => {
    const b = { id: 'a', ax: 300, ay: 200, w: 200, h: 40 };
    expect(placeLabels([b], [], { w: 800, h: 600 }).get('a')).toEqual({ x: 300, y: 200 });
  });

  it('separates boxes that share an anchor, and avoids obstacles and the screen edges', () => {
    const boxes: LabelBox[] = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, ax: 400 + i * 3, ay: 300, w: 210, h: 44 }));
    const card: Rect = { left: 380, top: 250, right: 680, bottom: 420 };
    const placed = placeLabels(boxes, [card], { w: 1200, h: 800 });
    const rects = boxes.map((b) => rect(placed.get(b.id)!, b));
    for (let i = 0; i < rects.length; i++) {
      expect(intersects(rects[i], card)).toBe(false);
      expect(rects[i].left).toBeGreaterThanOrEqual(4);
      expect(rects[i].bottom).toBeLessThanOrEqual(796);
      for (let j = i + 1; j < rects.length; j++) expect(intersects(rects[i], rects[j]), `${i} vs ${j}`).toBe(false);
    }
  });

  it('pulls boxes inside the screen near the edges', () => {
    const b = { id: 'edge', ax: 5, ay: 5, w: 200, h: 40 };
    const p = placeLabels([b], [], { w: 800, h: 600 }).get('edge')!;
    expect(p.x - b.w / 2).toBeGreaterThanOrEqual(4);
    expect(p.y - b.h / 2).toBeGreaterThanOrEqual(4);
  });
});
