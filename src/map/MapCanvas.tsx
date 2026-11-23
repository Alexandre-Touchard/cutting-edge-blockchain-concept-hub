// The map itself: SVG rings, sectors, connections and items (nodes or cluster bubbles), with pan/zoom
// (drag, wheel, pinch, keys), hover/focus highlighting, connection explanations and the hover card.
// No external library.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MapData } from './data';
import { R, RING_BACKGROUNDS, edgePath, labelAnchor, type Layout } from './layout';
import { placeLabels, type Placement, type Rect } from './labelPlacement';
import { cullLabels, type LabelCandidate } from './labelCulling';
import type { MapNode } from './types';
import { itemName, type MapView, type VisibleEdge, type VisibleItem } from './view';
import { EDGE_STYLE, consensusName, edgeTypeName, kindName, layerName, rollupName, vmName, type Tr } from './vocab';

const MIN_K = 0.5;
const MAX_K = 4;
/** Room around the outer ring for sector labels, in SVG units. */
const MARGIN = 130;
/** Hubs: above this many connections, explanations appear only for the one under the pointer. */
const LABEL_ALL_MAX = 8;

export type Camera = { x: number; y: number; k: number };
export type MapCanvasHandle = {
  zoomBy: (factor: number) => void;
  reset: () => void;
  /** Bring an item to the centre of the visible area (minus the panel: `rightInset` on desktop, `bottomInset` on phones). */
  centerOn: (id: string, rightInset: number, bottomInset?: number, minZoom?: number) => void;
  focusItem: (id: string) => void;
};

type Props = {
  data: MapData;
  view: MapView;
  layout: Layout;
  tr: Tr;
  /** Visible item whose neighbourhood is highlighted (hover, keyboard focus, tour step or pinned selection). */
  focusId: string | null;
  /** Visible item that is selected (white ring). */
  selectedId: string | null;
  hoverCardId: string | null;
  isItemActive: (i: VisibleItem) => boolean;
  isEdgeShown: (e: VisibleEdge) => boolean;
  pulseIds: Set<string>;
  reducedMotion: boolean;
  onHover: (id: string | null) => void;
  /** Click or tap on an item: pins its card (a group expands). */
  onPick: (id: string) => void;
  /** Click or tap on empty map space (not a drag). */
  onBackgroundClick?: () => void;
  /** Enter on an item, or "Details" in its card: a bubble expands, a node opens its details. */
  onActivate: (id: string) => void;
  onFocusItem: (id: string | null) => void;
  onNeighbourKey: (from: string, dir: 1 | -1) => void;
};

/** Explanation of a drawn connection: the single label, or a summary of merged ones. */
export function visibleEdgeText(e: VisibleEdge, view: MapView, data: MapData, tr: Tr): { title: string; body: string } {
  const name = (id: string) => itemName(view.itemById.get(id)!);
  if (e.edges.length === 1) {
    const d = e.edges[0];
    return { title: `${data.nodeById.get(d.from)!.name} → ${data.nodeById.get(d.to)!.name}`, body: d.label };
  }
  const types = [...new Set(e.edges.map((x) => edgeTypeName(x.type, tr)))].join(', ');
  return { title: `${name(e.from)} ↔ ${name(e.to)}`, body: tr('{{n}} connections: {{types}}', { n: e.edges.length, types }) };
}

const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(props, ref) {
  const { data, view, layout, tr, focusId, selectedId, hoverCardId, isItemActive, isEdgeShown, pulseIds, reducedMotion } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, k: 1 });
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const itemEls = useRef(new Map<string, SVGGElement>());
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
  const scale = base * cam.k;
  const toScreen = useCallback(
    (x: number, y: number) => ({ x: size.w / 2 + cam.x + x * scale, y: size.h / 2 + cam.y + y * scale }),
    [size, cam, scale]
  );

  // ---- camera changes (animated unless reduced motion) ----
  const animateTo = useCallback(
    (target: Camera) => {
      if (anim.current) cancelAnimationFrame(anim.current);
      if (reducedMotion) return setCam(target);
      const start = performance.now();
      let from: Camera | null = null;
      const step = (t: number) => {
        setCam((cur) => {
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

  const zoomAround = useCallback(
    (factor: number, px: number, py: number) => {
      setCam((v) => {
        const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
        const b = Math.min(size.w, size.h) / (2 * (R + MARGIN));
        const wx = (px - size.w / 2 - v.x) / (b * v.k);
        const wy = (py - size.h / 2 - v.y) / (b * v.k);
        return { k, x: px - size.w / 2 - wx * b * k, y: py - size.h / 2 - wy * b * k };
      });
    },
    [size]
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (f) => zoomAround(f, size.w / 2, size.h / 2),
      reset: () => animateTo({ x: 0, y: 0, k: 1 }),
      centerOn: (id, rightInset, bottomInset = 0, minZoom = 1.2) => {
        const p = layout.positions.get(id);
        if (!p) return;
        const k = Math.max(cam.k, minZoom);
        const s = base * k;
        const cx = (size.w - rightInset) / 2;
        const cy = (size.h - bottomInset) / 2;
        animateTo({ k, x: cx - size.w / 2 - p.x * s, y: cy - size.h / 2 - p.y * s });
      },
      focusItem: (id) => itemEls.current.get(id)?.focus()
    }),
    [zoomAround, animateTo, layout, cam.k, base, size]
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
  /** Where a single-pointer press started on empty space: a release close to it is a click, not a drag. */
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-node],[data-hover-card]')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pressAt.current = pointers.current.size === 1 ? { x: e.clientX, y: e.clientY } : null;
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
    setCam((v) => ({ ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const start = pressAt.current;
    if (start && pointers.current.size === 1 && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) props.onBackgroundClick?.();
    pressAt.current = null;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // ---- what to draw ----
  const focusEdges = useMemo(() => (focusId ? (view.edgesOf.get(focusId) ?? []).filter(isEdgeShown) : []), [view, focusId, isEdgeShown]);
  const focusSet = useMemo(() => (focusId ? new Set([focusId, ...(view.neighbours.get(focusId) ?? [])]) : null), [view, focusId]);
  const labelEdges = focusEdges.length <= LABEL_ALL_MAX ? focusEdges : focusEdges.filter((e) => e.id === hoverEdge);
  const itemR = (i: VisibleItem) => (i.type === 'cluster' ? 17 : i.layer === 1 ? 13 : 10) / scale;
  const labelText = (i: VisibleItem) => (i.type === 'cluster' ? `${i.cluster.name} +` : i.node.name);
  // Labels: most important first; one that would overlap another label or item waits for zoom/hover.
  // Computed in screen units but without the pan offset, so panning doesn't recompute it.
  const shownLabels = useMemo(() => {
    const pxR = (i: VisibleItem) => (i.type === 'cluster' ? 17 : i.layer === 1 ? 13 : 10);
    const candidates: LabelCandidate[] = view.items.map((i) => {
      const p = layout.positions.get(i.id)!;
      const lab = labelAnchor(p, (pxR(i) + 5) / scale);
      const degree = view.edgesOf.get(i.id)?.length ?? 0;
      const tier = i.layer === 1 ? 100 : i.type === 'cluster' ? 90 : i.layer === 2 ? 80 : i.subBand === 'l3-chain' ? 60 : 40;
      return {
        id: i.id,
        x: lab.x * scale,
        y: lab.y * scale,
        anchor: lab.anchor,
        text: labelText(i),
        fontPx: i.layer === 1 ? 12.5 : 11,
        bold: i.layer === 1 || i.type === 'cluster',
        priority: tier + Math.min(degree, 19),
        force: !!focusSet?.has(i.id) || pulseIds.has(i.id) || i.id === selectedId
      };
    });
    const markers = view.items.map((i) => {
      const p = layout.positions.get(i.id)!;
      return { id: i.id, x: p.x * scale, y: p.y * scale, r: pxR(i) };
    });
    return cullLabels(candidates, markers);
  }, [view, layout, scale, focusSet, pulseIds, selectedId]);
  const showLabel = (i: VisibleItem) => shownLabels.has(i.id);

  // Keyboard order: ring by ring, then by angle.
  const ordered = useMemo(
    () => [...view.items].sort((a, b) => a.layer - b.layer || layout.positions.get(a.id)!.angle - layout.positions.get(b.id)!.angle),
    [view, layout]
  );

  const hoverTimer = useRef<number | null>(null);
  const card = hoverCardId ? view.itemById.get(hoverCardId) : undefined;
  const cardPos = card ? toScreen(layout.positions.get(card.id)!.x, layout.positions.get(card.id)!.y) : null;

  // Explanation boxes: anchored on each connection's midpoint, then moved apart so they don't
  // overlap each other, the hover card or the hovered item (measured after render, before paint).
  const anchors = focusId
    ? labelEdges.map((e) => {
        const { mid } = edgePath(layout.positions.get(e.from)!, layout.positions.get(e.to)!);
        return { edge: e, ...toScreen(mid.x, mid.y) };
      })
    : [];
  const labelEls = useRef(new Map<string, HTMLDivElement>());
  const cardEl = useRef<HTMLDivElement | null>(null);
  const [placements, setPlacements] = useState<Map<string, Placement>>(new Map());
  const placementKey = `${anchors.map((a) => a.edge.id).join(',')}|${Math.round(cam.x)},${Math.round(cam.y)},${cam.k.toFixed(3)}|${size.w}x${size.h}|${card?.id ?? ''}`;
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
    const same =
      next.size === placements.size &&
      [...next].every(([id, p]) => {
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
        <g transform={`translate(${size.w / 2 + cam.x},${size.h / 2 + cam.y}) scale(${scale})`}>
          {RING_BACKGROUNDS.map((ring) => (
            <circle key={ring.id} r={((ring.inner + ring.outer) / 2) * R} fill="none" stroke="#1e293b" strokeOpacity={0.55} strokeWidth={(ring.outer - ring.inner) * R} />
          ))}
          {layout.sectors.map((s) => {
            const a = (s.start * Math.PI) / 180;
            const m = (s.mid * Math.PI) / 180;
            const cos = Math.cos(m);
            return (
              <g key={s.id}>
                <line x1={Math.cos(a) * 0.34 * R} y1={Math.sin(a) * 0.34 * R} x2={Math.cos(a) * R} y2={Math.sin(a) * R} stroke="#334155" strokeWidth={1 / scale} />
                <path
                  d={`M${Math.cos(a) * R},${Math.sin(a) * R} A${R},${R} 0 0 1 ${Math.cos((s.end * Math.PI) / 180) * R},${Math.sin((s.end * Math.PI) / 180) * R}`}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={4 / scale}
                  strokeOpacity={0.8}
                />
                <text
                  x={Math.cos(m) * (R + 18)}
                  y={Math.sin(m) * (R + 18) + (Math.abs(cos) < 0.35 ? (Math.sin(m) > 0 ? 12 / scale : -2 / scale) : 4 / scale)}
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
          {/* connections */}
          {view.edges.map((e) => {
            if (!isEdgeShown(e)) return null;
            const { d } = edgePath(layout.positions.get(e.from)!, layout.positions.get(e.to)!);
            const st = EDGE_STYLE[e.main.type];
            const lit = focusId ? e.from === focusId || e.to === focusId : false;
            const w = (lit ? 1.5 + e.main.strength * 0.5 + Math.min(3, e.edges.length - 1) * 0.6 : 1) / scale;
            return (
              <g key={e.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={lit ? st.color : '#94a3b8'}
                  strokeOpacity={lit ? 1 : focusId ? 0.05 : 0.15}
                  strokeWidth={w}
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
          {/* items */}
          {ordered.map((it) => {
            const p = layout.positions.get(it.id)!;
            const cat = data.categoryById.get(it.category)!;
            const active = isItemActive(it) && (!focusSet || focusSet.has(it.id));
            const discontinued = it.type === 'node' && it.node.status === 'discontinued';
            const r = itemR(it);
            const selected = it.id === selectedId;
            const lab = labelAnchor(p, r + 5 / scale);
            const n = view.edgesOf.get(it.id)?.length ?? 0;
            const demos = it.type === 'node' ? it.node.demos.length : 0;
            return (
              <g
                key={it.id}
                data-node={it.id}
                ref={(el) => {
                  if (el) itemEls.current.set(it.id, el);
                  else itemEls.current.delete(it.id);
                }}
                role="button"
                tabIndex={0}
                aria-expanded={it.type === 'cluster' ? false : undefined}
                aria-label={
                  it.type === 'cluster'
                    ? tr('{{name}}: group of {{n}}, {{category}}. Press Enter to expand.', { name: it.cluster.name, n: it.members.length, category: tr(cat.name) })
                    : tr('{{name}}: {{layer}}, {{category}}. {{n}} connections.', { name: it.node.name, layer: layerName(it.node, tr), category: tr(cat.name), n }) +
                      (discontinued ? ` ${tr('Discontinued.')}` : '')
                }
                className="cursor-pointer outline-none"
                opacity={active ? (discontinued ? 0.55 : 1) : 0.15}
                style={{ transition: reducedMotion ? undefined : 'opacity 150ms ease' }}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'touch') return;
                  if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
                  hoverTimer.current = window.setTimeout(() => props.onHover(it.id), 80);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'touch') return;
                  if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
                  props.onHover(null);
                }}
                onPointerDown={(e) => {
                  if (e.pointerType !== 'touch') return;
                  e.stopPropagation();
                  props.onPick(it.id);
                }}
                onClick={(e) => {
                  if ((e.nativeEvent as PointerEvent).pointerType === 'touch') return;
                  props.onPick(it.id);
                }}
                onFocus={() => props.onFocusItem(it.id)}
                onBlur={() => props.onFocusItem(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    props.onActivate(it.id);
                  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ']') {
                    e.preventDefault();
                    props.onNeighbourKey(it.id, 1);
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === '[') {
                    e.preventDefault();
                    props.onNeighbourKey(it.id, -1);
                  }
                }}
              >
                {pulseIds.has(it.id) && !reducedMotion ? (
                  <circle cx={p.x} cy={p.y} r={r * 2} fill="none" stroke="#fbbf24" strokeWidth={2 / scale} className="animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationIterationCount: 1 }} />
                ) : null}
                {selected ? <circle cx={p.x} cy={p.y} r={r + 5 / scale} fill="none" stroke="#ffffff" strokeWidth={2 / scale} /> : null}
                {it.type === 'cluster' ? (
                  <>
                    <circle cx={p.x} cy={p.y} r={r} fill={cat.color} fillOpacity={0.22} stroke={cat.color} strokeWidth={2 / scale} strokeDasharray={`${4 / scale} ${3 / scale}`} />
                    <text x={p.x} y={p.y + 4.5 / scale} textAnchor="middle" fontSize={13 / scale} fontWeight={700} fill="#f8fafc">
                      {it.members.length}
                    </text>
                  </>
                ) : (
                  <NodeShape kind={it.node.kind} x={p.x} y={p.y} r={r} fill={discontinued ? '#64748b' : cat.color} dashed={discontinued} />
                )}
                {demos ? (
                  <g aria-hidden>
                    <circle cx={p.x + r * 0.9} cy={p.y - r * 0.9} r={5.5 / scale} fill="#0f172a" stroke="#fbbf24" strokeWidth={1 / scale} />
                    <path
                      d={`M${p.x + r * 0.9 - 1.8 / scale},${p.y - r * 0.9 - 2.6 / scale} L${p.x + r * 0.9 + 2.6 / scale},${p.y - r * 0.9} L${p.x + r * 0.9 - 1.8 / scale},${p.y - r * 0.9 + 2.6 / scale} Z`}
                      fill="#fbbf24"
                    />
                  </g>
                ) : null}
                {showLabel(it) ? (
                  <text
                    x={lab.x}
                    y={lab.y}
                    textAnchor={lab.anchor}
                    fontSize={(it.layer === 1 ? 12.5 : 11) / scale}
                    fontWeight={it.layer === 1 || it.type === 'cluster' ? 700 : 500}
                    fontStyle={discontinued ? 'italic' : undefined}
                    fill={it.type === 'cluster' ? cat.color : '#e2e8f0'}
                    stroke="#020617"
                    strokeWidth={3 / scale}
                    paintOrder="stroke"
                  >
                    {labelText(it)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Connection explanations (HTML so they stay readable at any zoom), with a leader line when moved */}
      {anchors.length ? (
        <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h} aria-hidden>
          {anchors.map((a) => {
            const p = placements.get(a.edge.id);
            const color = EDGE_STYLE[a.edge.main.type].color;
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
        const color = EDGE_STYLE[a.edge.main.type].color;
        const text = visibleEdgeText(a.edge, view, data, tr);
        return (
          <div
            key={a.edge.id}
            data-edge-label
            ref={(el) => {
              if (el) labelEls.current.set(a.edge.id, el);
              else labelEls.current.delete(a.edge.id);
            }}
            className="pointer-events-none absolute w-max max-w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-slate-950 px-2 py-1 text-[11px] leading-snug text-slate-100 shadow"
            style={{ left: p.x, top: p.y, borderColor: color }}
          >
            <span className="font-semibold" style={{ color }}>
              {text.title}
            </span>
            <br />
            {text.body}
          </div>
        );
      })}

      {card && cardPos ? (
        <HoverCard
          item={card}
          view={view}
          data={data}
          tr={tr}
          x={cardPos.x}
          y={cardPos.y}
          width={size.w}
          height={size.h}
          showTop={(view.edgesOf.get(card.id)?.length ?? 0) > LABEL_ALL_MAX}
          onActivate={() => props.onActivate(card.id)}
          elRef={cardEl}
        />
      ) : null}
    </div>
  );
});

export default MapCanvas;

export function NodeShape({ kind, x, y, r, fill, dashed }: { kind: MapNode['kind']; x: number; y: number; r: number; fill: string; dashed?: boolean }) {
  const stroke = dashed ? { stroke: '#cbd5e1', strokeWidth: r * 0.15, strokeDasharray: `${r * 0.35} ${r * 0.25}` } : { stroke: '#020617', strokeWidth: r * 0.15 };
  if (kind === 'chain') return <circle cx={x} cy={y} r={r} fill={fill} {...stroke} />;
  if (kind === 'app') return <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.4} fill={fill} {...stroke} />;
  return <path d={`M${x},${y - r * 1.15} L${x + r * 1.15},${y} L${x},${y + r * 1.15} L${x - r * 1.15},${y} Z`} fill={fill} {...stroke} />;
}

/** Chips describing a node: type, layer, category, and the chain fields when present. */
export function NodeChips({ node, data, tr }: { node: MapNode; data: MapData; tr: Tr }) {
  const cat = data.categoryById.get(node.category)!;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      <Chip>{kindName(node.kind, tr)}</Chip>
      <Chip>{layerName(node, tr)}</Chip>
      <Chip color={cat.color}>{tr(cat.name)}</Chip>
      {node.vm ? <Chip>{vmName(node.vm, tr)}</Chip> : null}
      {node.consensus ? <Chip>{consensusName(node.consensus, tr)}</Chip> : null}
      {node.rollupType ? <Chip>{rollupName(node.rollupType, tr)}</Chip> : null}
      {node.status === 'discontinued' ? <Chip tone="warn">{tr('Discontinued')}</Chip> : null}
    </div>
  );
}

function HoverCard({
  item,
  view,
  data,
  tr,
  x,
  y,
  width,
  height,
  showTop,
  onActivate,
  elRef
}: {
  item: VisibleItem;
  view: MapView;
  data: MapData;
  tr: Tr;
  x: number;
  y: number;
  width: number;
  height: number;
  showTop: boolean;
  onActivate: () => void;
  elRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const edges = view.edgesOf.get(item.id) ?? [];
  const W = 300;
  const left = Math.min(Math.max(8, x + 18), width - W - 8);
  const top = y > height / 2 ? undefined : Math.min(y + 18, height - 40);
  const bottom = y > height / 2 ? Math.max(8, height - y + 18) : undefined;
  const cat = data.categoryById.get(item.category)!;
  return (
    <div
      ref={elRef}
      data-hover-card
      className="absolute z-10 rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl"
      style={{ left, top, bottom, width: W }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {item.type === 'cluster' ? (
        <>
          <div className="text-sm font-bold text-white">{item.cluster.name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Chip color={cat.color}>{tr(cat.name)}</Chip>
            <Chip>{tr('Group of {{n}}', { n: item.members.length })}</Chip>
          </div>
          <p className="mt-2 leading-snug text-slate-300">{item.members.map((m) => m.name).join(' · ')}</p>
          <div className="mt-2 text-slate-400">{tr('{{n}} connections', { n: edges.reduce((t, e) => t + e.edges.length, 0) })}</div>
          <button type="button" onClick={onActivate} className="mt-2 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold hover:bg-blue-500">
            {tr('Expand the group')}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-white">{item.node.name}</span>
            {item.node.demos.length ? <span className="rounded-full border border-amber-500/60 px-1.5 text-[10px] text-amber-200">▶ {tr('demo')}</span> : null}
          </div>
          <NodeChips node={item.node} data={data} tr={tr} />
          <p className="mt-2 leading-snug">{item.node.summary}</p>
          <div className="mt-2 text-slate-400">{tr('{{n}} connections', { n: data.edgesOf.get(item.node.id)?.length ?? 0 })}</div>
          {showTop ? (
            <ul className="mt-1 space-y-1">
              {edges.slice(0, 5).map((e) => {
                const t = visibleEdgeText(e, view, data, tr);
                return (
                  <li key={e.id} className="leading-snug">
                    <span className="font-semibold" style={{ color: EDGE_STYLE[e.main.type].color }}>
                      {t.title}
                    </span>
                    <span className="text-slate-400">: </span>
                    {t.body}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <button type="button" onClick={onActivate} className="mt-2 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold hover:bg-blue-500">
            {tr('Details')}
          </button>
        </>
      )}
    </div>
  );
}

export function Chip({ children, color, tone }: { children: React.ReactNode; color?: string; tone?: 'warn' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${
        tone === 'warn' ? 'border-amber-700 bg-amber-950/60 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-300'
      }`}
    >
      {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden /> : null}
      {children}
    </span>
  );
}
