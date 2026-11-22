// Pure simulation for the hub's animated "blocks chaining" background.
// No DOM here, so it can be unit-tested (see model.test.ts); ChainBackground.tsx draws it.

export type Rng = () => number;

/** Small deterministic PRNG (mulberry32), so tests and the static frame are reproducible. */
export function makeRng(seed = 1): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Block = {
  /** Left edge, in CSS pixels. */
  x: number;
  /** Block height (number), shown as a label. */
  height: number;
  /** Seconds since the block was sealed (drives the "mined" glow and link drawing). */
  age: number;
};

export type Particle = { x: number; y: number; vx: number; vy: number; life: number };

export type Lane = {
  /** Vertical centre of the lane. */
  y: number;
  /** Depth: smaller = further away (smaller, slower, fainter). */
  scale: number;
  /** Drift speed to the left, px/s. */
  speed: number;
  color: string;
  blocks: Block[];
  particles: Particle[];
  nextHeight: number;
};

export type Scene = { width: number; height: number; lanes: Lane[] };

export const BLOCK_W = 54;
export const BLOCK_H = 36;
export const GAP = 34;
/** Distance from the right edge where new blocks are sealed. */
export const SEAL_MARGIN = 40;

const COLORS = ['#60a5fa', '#a78bfa', '#f472b6', '#22d3ee'];

export function blockWidth(lane: Lane) {
  return BLOCK_W * lane.scale;
}

export function spacing(lane: Lane) {
  return (BLOCK_W + GAP) * lane.scale;
}

/** Builds lanes already filled with blocks across the width, so the first frame isn't empty. */
export function createScene(width: number, height: number, rng: Rng = makeRng(7)): Scene {
  const laneCount = Math.max(2, Math.min(5, Math.round(height / 90)));
  const lanes: Lane[] = [];
  for (let i = 0; i < laneCount; i++) {
    const scale = 0.55 + rng() * 0.6;
    const lane: Lane = {
      y: ((i + 0.5) * height) / laneCount + (rng() - 0.5) * 24,
      scale,
      speed: 6 + scale * 12,
      color: COLORS[i % COLORS.length],
      blocks: [],
      particles: [],
      nextHeight: 18_000_000 + Math.floor(rng() * 900_000)
    };
    // Fill from the left with a random phase, up to the sealing point.
    const step = spacing(lane);
    let x = -rng() * step;
    while (x <= width - SEAL_MARGIN - blockWidth(lane)) {
      lane.blocks.push({ x, height: lane.nextHeight++, age: 10 });
      x += step;
    }
    lanes.push(lane);
  }
  return { width, height, lanes };
}

/** Where the next block of a lane will be sealed (left edge). */
export function nextSlotX(lane: Lane, width: number): number {
  const last = lane.blocks[lane.blocks.length - 1];
  return last ? last.x + spacing(lane) : width - SEAL_MARGIN - blockWidth(lane);
}

/**
 * Advances the scene by `dt` seconds: drift left, recycle blocks that left the screen,
 * seal a new block once there is room at the right, and move transaction particles
 * toward the slot of the block being built.
 */
export function stepScene(scene: Scene, dt: number, rng: Rng): Scene {
  const d = Math.max(0, Math.min(dt, 0.1)); // clamp long frames (tab switches)
  for (const lane of scene.lanes) {
    const w = blockWidth(lane);
    for (const b of lane.blocks) {
      b.x -= lane.speed * d;
      b.age += d;
    }
    lane.blocks = lane.blocks.filter((b) => b.x + w > -GAP);

    // Seal a new block when the next slot is fully on screen.
    const slot = nextSlotX(lane, scene.width);
    if (slot + w <= scene.width - SEAL_MARGIN) {
      lane.blocks.push({ x: slot, height: lane.nextHeight++, age: 0 });
    }

    // Pending transactions drift into the next slot.
    const target = { x: nextSlotX(lane, scene.width) + w / 2, y: lane.y };
    if (rng() < d * 1.6 * lane.scale) {
      lane.particles.push({
        x: scene.width + 10,
        y: lane.y + (rng() - 0.5) * 80 * lane.scale,
        vx: 0,
        vy: 0,
        life: 0
      });
    }
    for (const p of lane.particles) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      p.vx = dx * 0.9;
      p.vy = dy * 0.9;
      p.x += p.vx * d;
      p.y += p.vy * d;
      p.life += d;
    }
    lane.particles = lane.particles.filter((p) => p.life < 4 && Math.hypot(target.x - p.x, target.y - p.y) > 4);
  }
  return scene;
}

/** Keeps the scene coherent after a resize: rebuild if the size changed a lot, else just update bounds. */
export function resizeScene(scene: Scene, width: number, height: number, rng: Rng): Scene {
  if (Math.abs(height - scene.height) > 40 || width < scene.width * 0.5 || width > scene.width * 1.5) {
    return createScene(width, height, rng);
  }
  scene.width = width;
  scene.height = height;
  return scene;
}
