// The map itself: SVG rings, sectors, edges and nodes, with pan/zoom (drag, wheel, pinch, keys),
// hover/focus highlighting, edge explanations and the hover card. No external library.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MapData } from './data';
import { otherEnd } from './data';
import { R, RING_BACKGROUNDS, edgePath, labelAnchor, type Layout } from './layout';
import { placeLabels, type Placement, type Rect } from './labelPlacement';
import type { MapEdge, MapNode } from './types';
import { EDGE_STYLE, edgeTypeName, kindName, layerName, type Tr } from './vocab';

const MIN_K = 0.5;
const MAX_K = 4;
/** Room around the outer ring for sector labels, in SVG units. */
const MARGIN = 130;
/** Hubs: above this many edges, labels appear only for the edge under the pointer. */
const LABEL_ALL_MAX = 8;

export type View = { x: number; y: number; k: number };
export type MapCanvasHandle = {
  zoomBy: (factor: number) => void;
  reset: () => void;
  /** Bring a node to the centre of the visible area (minus the panel: `rightInset` on desktop, `bottomInset` on phones). */
  centerOn: (id: string, rightInset: number, bottomInset?: number) => void;
  focusNode: (id: string) => void;
};

type Props = {
  data: MapData;
  layout: Layout;
  tr: Tr;
  /** Node whose neighbourhood is highlighted (hover, keyboard focus or pinned selection). */
  focusId: string | null;
  selectedId: string | null;
  hoverCardId: string | null;
  isNodeActive: (n: MapNode) => boolean;
  isEdgeShown: (e: MapEdge) => boolean;
  pulseIds: Set<string>;
  demoBadges: boolean;
  reducedMotion: boolean;
  onHover: (id: string | null, touch: boolean) => void;
  onSelect: (id: string) => void;
  onFocusNode: (id: string | null) => void;
  onNeighbourKey: (from: string, dir: 1 | -1) => void;
  onDetails: (id: string) => void;
};

const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(props, ref) {
  const { data, layout, tr, focusId, selectedId, hoverCardId, isNodeActive, isEdgeShown, pulseIds, demoBadges, reducedMotion } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const nodeEls = useRef(new Map<string, SVGGElement>());
  const anim = useRef<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 1200, h: el.clientHeight || 800 });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = Math.min(size.w, size.h) / (2 * (R + MARGIN));
  const scale = base * view.k;
  const toScreen = useCallback(
    (x: number, y: number) => ({ x: size.w / 2 + view.x + x * scale, y: size.h / 2 + view.y + y * scale }),
    [size, view, scale]
  );

  // ---- view changes (animated unless reduced motion) ----
  const animateTo = useCallback(
    (target: View) => {
      if (anim.current) cancelAnimationFrame(anim.current);
      if (reducedMotion) return setView(target);
      const start = performance.now();
      let from: View | null = null;
      const step = (t: number) => {
        setView((cur) => {
          from ??= cur;
          const p = Math.min(1, (t - start) / 350);
          const e = 1 - (1 - p) ** 3;
          return { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e };
        });
        if (t - start < 350) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [reducedMotion]
  );

  const zoomAround = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const b = Math.min(size.w, size.h) / (2 * (R + MARGIN));
      const wx = (px - size.w / 2 - v.x) / (b * v.k);
      const wy = (py - size.h / 2 - v.y) / (b * v.k);
      return { k, x: px - size.w / 2 - wx * b * k, y: py - size.h / 2 - wy * b * k };
    });
  }, [size]);

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (f) => zoomAround(f, size.w / 2, size.h / 2),
      reset: () => animateTo({ x: 0, y: 0, k: 1 }),
      centerOn: (id, rightInset, bottomInset = 0) => {
        const p = layout.positions.get(id);
        if (!p) return;
        const k = Math.max(view.k, 1.2);
        const s = base * k;
        // Visible centre: middle of the area left of the panel.
        const cx = (size.w - rightInset) / 2;
        const cy = (size.h - bottomInset) / 2;
        animateTo({ k, x: cx - size.w / 2 - p.x * s, y: cy - size.h / 2 - p.y * s });
      },
      focusNode: (id) => nodeEls.current.get(id)?.focus()
    }),
    [zoomAround, animateTo, layout, view.k, base, size]
  );

  // Wheel zoom (non-passive, so the page doesn't scroll).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAround(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAround]);

  // Drag to pan, two fingers to pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-node]')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const r = wrap.current!.getBoundingClientRect();
      zoomAround(dist / pinch.current.dist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinch.current = { dist };
      return;
    }
    setView((v) => ({ ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // ---- what to draw ----
  const focusEdges = useMemo(() => (focusId ? data.edgesOf.get(focusId) ?? [] : []), [data, focusId]);
  const focusSet = useMemo(() => {
    if (!focusId) return null;
    return new Set([focusId, ...(data.neighbours.get(focusId) ?? [])]);
  }, [data, focusId]);
  const labelEdges = focusEdges.length <= LABEL_ALL_MAX ? focusEdges : focusEdges.filter((e) => e.id === hoverEdge);
  const nodeR = (n: MapNode) => (n.layer === 1 ? 13 : 10) / scale;
  const roomy = Math.min(size.w, size.h) >= 640;
  const showLabel = (n: MapNode) => n.layer !== 3 || n.subBand === 'l3-chain' || roomy || view.k >= 1.4 || focusSet?.has(n.id) || pulseIds.has(n.id);

  // Keyboard order: ring by ring, then by angle.
  const ordered = useMemo(
    () =>
      [...data.nodes].sort((a, b) => a.layer - b.layer || layout.positions.get(a.id)!.angle - layout.positions.get(b.id)!.angle),
    [data, layout]
  );

  const hoverTimer = useRef<number | null>(null);
  const card = hoverCardId ? data.nodeById.get(hoverCardId) : undefined;
  const cardPos = card ? toScreen(layout.positions.get(card.id)!.x, layout.positions.get(card.id)!.y) : null;

  // Explanation boxes: anchored on each connection's midpoint, then moved apart so they don't
  // overlap each other, the hover card or the hovered node (measured after render, before paint).
  const anchors = focusId
    ? labelEdges.map((e) => {
        const { mid } = edgePath(layout.positions.get(e.from)!, layout.positions.get(e.to)!);
        return { edge: e, ...toScreen(mid.x, mid.y) };
      })
    : [];
  const labelEls = useRef(new Map<string, HTMLDivElement>());
  const cardEl = useRef<HTMLDivElement | null>(null);
  const [placements, setPlacements] = useState<Map<string, Placement>>(new Map());
  const placementKey = `${anchors.map((a) => a.edge.id).join(',')}|${Math.round(view.x)},${Math.round(view.y)},${view.k.toFixed(3)}|${size.w}x${size.h}|${card?.id ?? ''}`;
  useLayoutEffect(() => {
    if (!anchors.length) {
      if (placements.size) setPlacements(new Map());
      return;
    }
    const wrapRect = wrap.current?.getBoundingClientRect();
    const obstacles: Rect[] = [];
    if (cardEl.current && wrapRect) {
      const r = cardEl.current.getBoundingClientRect();
      obstacles.push({ left: r.left - wrapRect.left, top: r.top - wrapRect.top, right: r.right - wrapRect.left, bottom: r.bottom - wrapRect.top });
    }
    if (focusId) {
      const f = layout.positions.get(focusId)!;
      const c = toScreen(f.x, f.y);
      obstacles.push({ left: c.x - 22, top: c.y - 22, right: c.x + 22, bottom: c.y + 22 });
    }
    const boxes = anchors.map((a) => {
      const el = labelEls.current.get(a.edge.id);
      return { id: a.edge.id, ax: a.x, ay: a.y, w: el?.offsetWidth ?? 220, h: el?.offsetHeight ?? 44 };
    });
    const next = placeLabels(boxes, obstacles, { w: size.w, h: size.h });
    const same = next.size === placements.size && [...next].every(([id, p]) => {
      const q = placements.get(id);
      return q && Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5;
    });
    if (!same) setPlacements(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementKey]);

  return (
    <div
      ref={wrap}
      className="relative h-full w-full touch-none select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg width={size.w} height={size.h} className="block" role="group" aria-label={tr('Blockchain ecosystem map: Layer 1 in the centre, Layer 2 around it, applications and Layer 3 on the outer ring.')}>
        <g transform={`translate(${size.w / 2 + view.x},${size.h / 2 + view.y}) scale(${scale})`}>
          {/* rings */}
          {RING_BACKGROUNDS.map((ring) => (
            <circle key={ring.id} r={((ring.inner + ring.outer) / 2) * R} fill="none" stroke="#1e293b" strokeOpacity={0.55} strokeWidth={(ring.outer - ring.inner) * R} />
          ))}
          {/* sectors */}
          {layout.sectors.map((s) => {
            const a = (s.start * Math.PI) / 180;
            const m = (s.mid * Math.PI) / 180;
            const lx = Math.cos(m) * (R + 18);
            const ly = Math.sin(m) * (R + 18);
            const cos = Math.cos(m);
            return (
              <g key={s.id}>
                <line x1={Math.cos(a) * 0.33 * R} y1={Math.sin(a) * 0.33 * R} x2={Math.cos(a) * R} y2={Math.sin(a) * R} stroke="#334155" strokeWidth={1 / scale} />
                <path
                  d={`M${Math.cos(a) * R},${Math.sin(a) * R} A${R},${R} 0 0 1 ${Math.cos((s.end * Math.PI) / 180) * R},${Math.sin((s.end * Math.PI) / 180) * R}`}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={4 / scale}
                  strokeOpacity={0.8}
                />
                <text
                  x={lx}
                  y={ly + (Math.abs(cos) < 0.35 ? (Math.sin(m) > 0 ? 12 / scale : -2 / scale) : 4 / scale)}
                  textAnchor={Math.abs(cos) < 0.35 ? 'middle' : cos > 0 ? 'start' : 'end'}
                  fontSize={12 / scale}
                  fontWeight={600}
                  fill={s.color}
                >
                  {tr(s.name)}
                </text>
              </g>
            );
          })}
          {/* edges */}
          {data.edges.map((e) => {
            if (!isEdgeShown(e)) return null;
            const a = layout.positions.get(e.from)!;
            const b = layout.positions.get(e.to)!;
            const { d } = edgePath(a, b);
            const st = EDGE_STYLE[e.type];
            const lit = focusId ? e.from === focusId || e.to === focusId : false;
            return (
              <g key={e.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={lit ? st.color : '#94a3b8'}
                  strokeOpacity={lit ? 1 : focusId ? 0.05 : 0.15}
                  strokeWidth={(lit ? 1.5 + e.strength * 0.5 : 1) / scale}
                  strokeDasharray={st.dash ? st.dash.split(' ').map((x) => +x / scale).join(' ') : undefined}
                  style={{ transition: reducedMotion ? undefined : 'stroke-opacity 150ms ease' }}
                />
                {lit ? (
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={12 / scale}
                    onPointerEnter={() => setHoverEdge(e.id)}
                    onPointerLeave={() => setHoverEdge((h) => (h === e.id ? null : h))}
                  />
                ) : null}
              </g>
            );
          })}
          {/* nodes */}
          {ordered.map((n) => {
            const p = layout.positions.get(n.id)!;
            const cat = data.categoryById.get(n.category)!;
            const active = isNodeActive(n) && (!focusSet || focusSet.has(n.id));
            const r = nodeR(n);
            const selected = n.id === selectedId;
            const lab = labelAnchor(p, r + 5 / scale);
            const edgesN = data.edgesOf.get(n.id)?.length ?? 0;
            return (
              <g
                key={n.id}
                data-node={n.id}
                ref={(el) => {
                  if (el) nodeEls.current.set(n.id, el);
                  else nodeEls.current.delete(n.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={tr('{{name}}: {{layer}}, {{category}}. {{n}} connections.', {
                  name: n.name,
                  layer: layerName(n, tr),
                  category: tr(cat.name),
                  n: edgesN
                })}
                className="cursor-pointer outline-none"
                opacity={active ? 1 : 0.15}
                style={{ transition: reducedMotion ? undefined : 'opacity 150ms ease' }}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'touch') return;
                  if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
                  hoverTimer.current = window.setTimeout(() => props.onHover(n.id, false), 80);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'touch') return;
                  if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
                  props.onHover(null, false);
                }}
                onPointerDown={(e) => {
                  if (e.pointerType !== 'touch') return;
                  e.stopPropagation();
                  // First tap shows the card, second tap opens the panel.
                  if (hoverCardId === n.id) props.onSelect(n.id);
                  else props.onHover(n.id, true);
                }}
                onClick={(e) => {
                  if ((e.nativeEvent as PointerEvent).pointerType === 'touch') return;
                  props.onSelect(n.id);
                }}
                onFocus={() => props.onFocusNode(n.id)}
                onBlur={() => props.onFocusNode(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    props.onSelect(n.id);
                  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ']') {
                    e.preventDefault();
                    props.onNeighbourKey(n.id, 1);
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === '[') {
                    e.preventDefault();
                    props.onNeighbourKey(n.id, -1);
                  }
                }}
              >
                {pulseIds.has(n.id) && !reducedMotion ? (
                  <circle cx={p.x} cy={p.y} r={r * 2} fill="none" stroke="#fbbf24" strokeWidth={2 / scale} className="animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationIterationCount: 1 }} />
                ) : null}
                {selected ? <circle cx={p.x} cy={p.y} r={r + 5 / scale} fill="none" stroke="#ffffff" strokeWidth={2 / scale} /> : null}
                <NodeShape kind={n.kind} x={p.x} y={p.y} r={r} fill={cat.color} />
                {demoBadges && n.demos.length ? (
                  <g aria-hidden>
                    <circle cx={p.x + r * 0.9} cy={p.y - r * 0.9} r={5.5 / scale} fill="#0f172a" stroke="#fbbf24" strokeWidth={1 / scale} />
                    <path
                      d={`M${p.x + r * 0.9 - 1.8 / scale},${p.y - r * 0.9 - 2.6 / scale} L${p.x + r * 0.9 + 2.6 / scale},${p.y - r * 0.9} L${p.x + r * 0.9 - 1.8 / scale},${p.y - r * 0.9 + 2.6 / scale} Z`}
                      fill="#fbbf24"
                    />
                  </g>
                ) : null}
                {showLabel(n) ? (
                  <text
                    x={lab.x}
                    y={lab.y}
                    textAnchor={lab.anchor}
                    fontSize={(n.layer === 1 ? 12.5 : 11) / scale}
                    fontWeight={n.layer === 1 ? 700 : 500}
                    fill="#e2e8f0"
                    stroke="#020617"
                    strokeWidth={3 / scale}
                    paintOrder="stroke"
                  >
                    {n.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Edge explanations (HTML so they stay readable at any zoom), with a leader line when moved */}
      {anchors.length ? (
        <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h} aria-hidden>
          {anchors.map((a) => {
            const p = placements.get(a.edge.id);
            const color = EDGE_STYLE[a.edge.type].color;
            const moved = p && Math.hypot(p.x - a.x, p.y - a.y) > 8;
            return (
              <g key={a.edge.id}>
                {moved ? <line x1={a.x} y1={a.y} x2={p!.x} y2={p!.y} stroke={color} strokeWidth={1} strokeOpacity={0.7} /> : null}
                <circle cx={a.x} cy={a.y} r={3} fill={color} />
              </g>
            );
          })}
        </svg>
      ) : null}
      {anchors.map((a) => {
        const p = placements.get(a.edge.id) ?? { x: a.x, y: a.y };
        const e = a.edge;
        return (
          <div
            key={e.id}
            data-edge-label
            ref={(el) => {
              if (el) labelEls.current.set(e.id, el);
              else labelEls.current.delete(e.id);
            }}
            className="pointer-events-none absolute w-max max-w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-slate-950 px-2 py-1 text-[11px] leading-snug text-slate-100 shadow"
            style={{ left: p.x, top: p.y, borderColor: EDGE_STYLE[e.type].color }}
          >
            <span className="font-semibold" style={{ color: EDGE_STYLE[e.type].color }}>
              {data.nodeById.get(e.from)!.name} → {data.nodeById.get(e.to)!.name}
            </span>
            <br />
            {e.label}
          </div>
        );
      })}

      {/* Hover card */}
      {card && cardPos ? (
        <HoverCard
          node={card}
          data={data}
          tr={tr}
          x={cardPos.x}
          y={cardPos.y}
          width={size.w}
          height={size.h}
          showTop={(data.edgesOf.get(card.id)?.length ?? 0) > LABEL_ALL_MAX}
          onDetails={() => props.onDetails(card.id)}
          elRef={cardEl}
        />
      ) : null}
    </div>
  );
});

export default MapCanvas;

export function NodeShape({ kind, x, y, r, fill }: { kind: MapNode['kind']; x: number; y: number; r: number; fill: string }) {
  if (kind === 'chain') return <circle cx={x} cy={y} r={r} fill={fill} stroke="#020617" strokeWidth={r * 0.15} />;
  if (kind === 'app') return <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.4} fill={fill} stroke="#020617" strokeWidth={r * 0.15} />;
  return <path d={`M${x},${y - r * 1.15} L${x + r * 1.15},${y} L${x},${y + r * 1.15} L${x - r * 1.15},${y} Z`} fill={fill} stroke="#020617" strokeWidth={r * 0.15} />;
}

function HoverCard({
  node,
  data,
  tr,
  x,
  y,
  width,
  height,
  showTop,
  onDetails,
  elRef
}: {
  node: MapNode;
  data: MapData;
  tr: Tr;
  x: number;
  y: number;
  width: number;
  height: number;
  showTop: boolean;
  onDetails: () => void;
  elRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const cat = data.categoryById.get(node.category)!;
  const edges = data.edgesOf.get(node.id) ?? [];
  const W = 300;
  const left = Math.min(Math.max(8, x + 18), width - W - 8);
  const top = y > height / 2 ? undefined : Math.min(y + 18, height - 40);
  const bottom = y > height / 2 ? Math.max(8, height - y + 18) : undefined;
  return (
    <div
      ref={elRef}
      data-hover-card
      className="absolute z-10 rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl"
      style={{ left, top, bottom, width: W }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-white">{node.name}</span>
        {node.demos.length ? <span className="rounded-full border border-amber-500/60 px-1.5 text-[10px] text-amber-200">▶ {tr('demo')}</span> : null}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        <Chip>{kindName(node.kind, tr)}</Chip>
        <Chip>{layerName(node, tr)}</Chip>
        <Chip color={cat.color}>{tr(cat.name)}</Chip>
      </div>
      <p className="mt-2 leading-snug">{node.summary}</p>
      <div className="mt-2 text-slate-400">{tr('{{n}} connections', { n: edges.length })}</div>
      {showTop ? (
        <ul className="mt-1 space-y-1">
          {edges.slice(0, 5).map((e) => (
            <li key={e.id} className="leading-snug">
              <span className="font-semibold" style={{ color: EDGE_STYLE[e.type].color }}>
                {data.nodeById.get(otherEnd(e, node.id))!.name}
              </span>
              <span className="text-slate-400"> · {edgeTypeName(e.type, tr)}: </span>
              {e.label}
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={onDetails} className="mt-2 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold hover:bg-blue-500">
        {tr('Details')}
      </button>
    </div>
  );
}

export function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300">
      {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden /> : null}
      {children}
    </span>
  );
}
