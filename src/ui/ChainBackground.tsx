// Animated hub background: chains of blocks drifting left, new blocks being sealed
// at the right with a short glow, and pending transactions flowing into the next block.
// Decorative only (aria-hidden). Pauses when hidden/off-screen; a still frame under reduced motion.
import React, { useEffect, useRef } from 'react';
import { BLOCK_H, blockWidth, createScene, makeRng, nextSlotX, resizeScene, stepScene, type Lane, type Scene } from './chainBackground/model';

const MINED_GLOW_S = 1.2;
const LINK_DRAW_S = 0.6;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLane(ctx: CanvasRenderingContext2D, lane: Lane, width: number) {
  const w = blockWidth(lane);
  const h = BLOCK_H * lane.scale;
  const depthAlpha = 0.35 + lane.scale * 0.5; // far lanes are fainter
  const top = lane.y - h / 2;

  // Links between consecutive blocks (the "chain").
  for (let i = 1; i < lane.blocks.length; i++) {
    const a = lane.blocks[i - 1];
    const b = lane.blocks[i];
    const progress = Math.min(1, b.age / LINK_DRAW_S);
    const x1 = a.x + w;
    const x2 = x1 + (b.x - x1) * progress;
    ctx.strokeStyle = lane.color;
    ctx.globalAlpha = 0.45 * depthAlpha;
    ctx.lineWidth = 1.2 * lane.scale + 0.4;
    ctx.beginPath();
    ctx.moveTo(x1, lane.y);
    ctx.lineTo(x2, lane.y);
    ctx.stroke();
    // little chain link in the middle
    if (progress >= 1) {
      ctx.beginPath();
      ctx.arc((x1 + b.x) / 2, lane.y, 2.6 * lane.scale + 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Next block being built: dashed outline.
  const slot = nextSlotX(lane, width);
  ctx.globalAlpha = 0.25 * depthAlpha;
  ctx.setLineDash([4 * lane.scale + 1, 4 * lane.scale + 1]);
  ctx.strokeStyle = lane.color;
  ctx.lineWidth = 1;
  roundRect(ctx, slot, top, w, h, 6 * lane.scale);
  ctx.stroke();
  ctx.setLineDash([]);

  // Blocks.
  for (const b of lane.blocks) {
    const fresh = Math.max(0, 1 - b.age / MINED_GLOW_S); // 1 right after sealing → 0
    const appear = Math.min(1, b.age / 0.35);
    ctx.globalAlpha = depthAlpha * (0.25 + 0.75 * appear);

    if (fresh > 0) {
      ctx.save();
      ctx.shadowColor = lane.color;
      ctx.shadowBlur = 22 * fresh;
      ctx.fillStyle = lane.color;
      ctx.globalAlpha = 0.35 * fresh;
      roundRect(ctx, b.x, top, w, h, 6 * lane.scale);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = depthAlpha * (0.25 + 0.75 * appear);
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    roundRect(ctx, b.x, top, w, h, 6 * lane.scale);
    ctx.fill();
    ctx.strokeStyle = lane.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // "header" lines inside the block
    ctx.fillStyle = lane.color;
    const pad = 7 * lane.scale;
    ctx.globalAlpha *= 0.55;
    ctx.fillRect(b.x + pad, top + pad, w * 0.55, 2 * lane.scale + 0.5);
    ctx.fillRect(b.x + pad, top + pad + 6 * lane.scale, w * 0.35, 2 * lane.scale + 0.5);
    if (lane.scale > 0.8) {
      ctx.font = `${Math.round(8 * lane.scale)}px ui-monospace, monospace`;
      ctx.fillText(`#${b.height}`, b.x + pad, top + h - pad);
    }
  }

  // Pending transactions.
  ctx.fillStyle = lane.color;
  for (const p of lane.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2) * 0.7 * depthAlpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6 * lane.scale + 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export default function ChainBackground({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const rng = makeRng(7);
    let scene: Scene | null = null;
    let raf = 0;
    let last = 0;
    let visible = true;

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene = scene ? resizeScene(scene, rect.width, rect.height, rng) : createScene(rect.width, rect.height, rng);
    };

    const draw = () => {
      if (!scene) return;
      ctx.clearRect(0, 0, scene.width, scene.height);
      for (const lane of scene.lanes) drawLane(ctx, lane, scene.width);
    };

    const frame = (t: number) => {
      raf = 0;
      if (!scene || !visible || document.hidden) return;
      const dt = last ? (t - last) / 1000 : 0;
      last = t;
      stepScene(scene, dt, rng);
      draw();
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (reduced || raf || !visible || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    fit();
    draw();
    start();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => (fit(), draw())) : null;
    ro?.observe(canvas);

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) start();
          })
        : null;
    io?.observe(canvas);

    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
