import { describe, expect, it } from 'vitest';
import { blockWidth, createScene, makeRng, nextSlotX, resizeScene, SEAL_MARGIN, spacing, stepScene } from './model';

describe('chain background scene', () => {
  it('starts with every lane already filled with evenly spaced blocks', () => {
    const scene = createScene(1200, 360, makeRng(1));
    expect(scene.lanes.length).toBeGreaterThanOrEqual(2);
    for (const lane of scene.lanes) {
      expect(lane.blocks.length).toBeGreaterThan(3);
      for (let i = 1; i < lane.blocks.length; i++) {
        expect(lane.blocks[i].x - lane.blocks[i - 1].x).toBeCloseTo(spacing(lane), 6);
        expect(lane.blocks[i].height).toBe(lane.blocks[i - 1].height + 1);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const a = createScene(1000, 300, makeRng(42));
    const b = createScene(1000, 300, makeRng(42));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('keeps chaining forever: new blocks are sealed at the right, old ones recycled, spacing preserved', () => {
    const rng = makeRng(3);
    const scene = createScene(900, 300, rng);
    const firstHeights = scene.lanes.map((l) => l.nextHeight);
    for (let i = 0; i < 60 * 120; i++) stepScene(scene, 1 / 60, rng); // two minutes
    scene.lanes.forEach((lane, li) => {
      expect(lane.nextHeight).toBeGreaterThan(firstHeights[li]);
      const w = blockWidth(lane);
      for (const b of lane.blocks) {
        expect(b.x + w).toBeGreaterThan(-60);
        expect(b.x + w).toBeLessThanOrEqual(900 - SEAL_MARGIN + 1e-6);
      }
      for (let i = 1; i < lane.blocks.length; i++) {
        expect(lane.blocks[i].x - lane.blocks[i - 1].x).toBeCloseTo(spacing(lane), 3);
        expect(lane.blocks[i].height).toBe(lane.blocks[i - 1].height + 1);
      }
      expect(lane.blocks.length).toBeLessThan(40);
      expect(lane.particles.length).toBeLessThan(30);
    });
  });

  it('clamps long frames so a tab switch does not make blocks jump', () => {
    const rng = makeRng(5);
    const scene = createScene(800, 300, rng);
    const x0 = scene.lanes[0].blocks[0].x;
    stepScene(scene, 30, rng);
    expect(x0 - scene.lanes[0].blocks[0].x).toBeLessThanOrEqual(scene.lanes[0].speed * 0.1 + spacing(scene.lanes[0]));
  });

  it('the next slot is right after the newest block', () => {
    const scene = createScene(800, 300, makeRng(9));
    const lane = scene.lanes[0];
    expect(nextSlotX(lane, 800)).toBeCloseTo(lane.blocks[lane.blocks.length - 1].x + spacing(lane), 6);
  });

  it('rebuilds on big resizes and keeps the scene on small ones', () => {
    const rng = makeRng(2);
    const scene = createScene(1000, 300, rng);
    expect(resizeScene(scene, 1010, 305, rng)).toBe(scene);
    expect(resizeScene(scene, 400, 600, rng)).not.toBe(scene);
  });
});
