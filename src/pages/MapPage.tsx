// /map — Blockchain Ecosystem Map (spec: specification/ecosystem-graph-spec.md).
// Full-screen, explorable graph: hover for a summary, click for details, links to the hub's demos.
// Selection lives in the URL hash (#node=arbitrum) and filters in the query (?cat=defi&layer=2).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, LayoutList, Map as MapIcon, Maximize2, Minimize2, Minus, Plus, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import { useDemoI18n } from '../demos/useDemoI18n';
import { loadDemos } from '../demos/loadDemos';
import { applyDemoStatusOverrides, fetchDemoStatusOverrides, type DemoStatusOverrides } from '../demos/demoStatusOverrides';
import { MAP_DATA, searchNodes } from '../map/data';
import { computeLayout } from '../map/layout';
import MapCanvas, { type MapCanvasHandle } from '../map/MapCanvas';
import { DetailPanel, Legend, ListView } from '../map/panels';
import type { CategoryId, EdgeType, Kind, MapEdge, MapNode } from '../map/types';
import { EDGE_TYPES } from '../map/types';
import { MAP_I18N_ID, edgeTypeName, kindName } from '../map/vocab';

const PANEL_W = 420;
const LAYOUT = computeLayout(MAP_DATA.categories, MAP_DATA.nodes);

type Filters = { cat?: CategoryId; layer?: 1 | 2 | 3; kind?: Kind; demo?: boolean; edge?: EdgeType };

function readFilters(search: string): Filters {
  const q = new URLSearchParams(search);
  const f: Filters = {};
  const cat = q.get('cat');
  if (cat && MAP_DATA.categoryById.has(cat as CategoryId)) f.cat = cat as CategoryId;
  const layer = Number(q.get('layer'));
  if (layer === 1 || layer === 2 || layer === 3) f.layer = layer;
  const kind = q.get('kind');
  if (kind === 'chain' || kind === 'app' || kind === 'tool') f.kind = kind;
  if (q.get('demo') === '1') f.demo = true;
  const edge = q.get('edge');
  if (edge && (EDGE_TYPES as string[]).includes(edge)) f.edge = edge as EdgeType;
  return f;
}

function writeFilters(f: Filters): string {
  const q = new URLSearchParams();
  if (f.cat) q.set('cat', f.cat);
  if (f.layer) q.set('layer', String(f.layer));
  if (f.kind) q.set('kind', f.kind);
  if (f.demo) q.set('demo', '1');
  if (f.edge) q.set('edge', f.edge);
  const s = q.toString();
  return s ? `?${s}` : '';
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export default function MapPage() {
  const { tr } = useDemoI18n(MAP_I18N_ID);
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const canvas = useRef<MapCanvasHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  // ---- URL state ----
  const selectedId = useMemo(() => {
    const m = /node=([a-z0-9-]+)/.exec(location.hash);
    return m && MAP_DATA.nodeById.has(m[1]) ? m[1] : null;
  }, [location.hash]);
  const filters = useMemo(() => readFilters(location.search), [location.search]);
  const setFilters = (f: Filters) => navigate({ search: writeFilters(f), hash: location.hash }, { replace: true });
  const select = useCallback((id: string | null) => navigate({ search: location.search, hash: id ? `node=${id}` : '' }), [navigate, location.search]);

  // ---- local UI state ----
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [touchCard, setTouchCard] = useState(false);
  const [kbdId, setKbdId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [pulse, setPulse] = useState<Set<string>>(new Set());
  const [showLegend, setShowLegend] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [listView, setListView] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const neighbourIdx = useRef(new Map<string, number>());

  useEffect(() => {
    if (selectedId) setPanelOpen(true);
  }, [selectedId]);

  // Demo titles and live/coming-soon status come from the hub registry (plus admin overrides).
  const [overrides, setOverrides] = useState<DemoStatusOverrides>({});
  useEffect(() => {
    fetchDemoStatusOverrides().then(setOverrides).catch(() => setOverrides({}));
  }, []);
  const demos = useMemo(() => {
    const metas = applyDemoStatusOverrides(
      loadDemos().map((d) => d.meta),
      overrides
    );
    return new Map(metas.map((m) => [m.id, m]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, lang]);

  // ---- filtering and search ----
  const matches = useMemo(() => searchNodes(MAP_DATA.nodes, query), [query]);
  const matchSet = useMemo(() => new Set(matches.map((n) => n.id)), [matches]);
  const edgeTypeNodes = useMemo(() => {
    if (!filters.edge) return null;
    return new Set(MAP_DATA.edges.filter((e) => e.type === filters.edge).flatMap((e) => [e.from, e.to]));
  }, [filters.edge]);
  const passesFilters = useCallback(
    (n: MapNode) =>
      (!filters.cat || n.category === filters.cat) &&
      (!filters.layer || n.layer === filters.layer) &&
      (!filters.kind || n.kind === filters.kind) &&
      (!filters.demo || n.demos.length > 0) &&
      (!edgeTypeNodes || edgeTypeNodes.has(n.id)),
    [filters, edgeTypeNodes]
  );
  const isNodeActive = useCallback((n: MapNode) => passesFilters(n) && (!query.trim() || matchSet.has(n.id)), [passesFilters, query, matchSet]);
  const isEdgeShown = useCallback((e: MapEdge) => !filters.edge || e.type === filters.edge, [filters.edge]);
  const visibleNodes = useMemo(() => MAP_DATA.nodes.filter(isNodeActive), [isNodeActive]);

  const focusId = hoverId ?? kbdId ?? (selectedId && panelOpen ? selectedId : selectedId);

  // ---- selection effects ----
  const recentre = useCallback(
    (id: string) => {
      if (typeof window === 'undefined') return;
      const wide = window.innerWidth >= 768;
      // Desktop: panel on the right. Phones: bottom sheet up to 62% of the height.
      canvas.current?.centerOn(id, wide ? PANEL_W : 0, wide ? 0 : window.innerHeight * 0.62);
    },
    []
  );
  useEffect(() => {
    if (selectedId && !listView) recentre(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const openNode = (id: string) => {
    setHoverId(null);
    setTouchCard(false);
    if (id === selectedId) {
      setPanelOpen(true);
      recentre(id);
    } else select(id);
  };

  const pulseOnce = (ids: string[]) => {
    setPulse(new Set(ids));
    window.setTimeout(() => setPulse(new Set()), 1100);
  };

  // ---- announcements ----
  useEffect(() => {
    const id = kbdId ?? null;
    if (!id) return;
    const n = MAP_DATA.nodeById.get(id)!;
    setAnnounce(tr('{{name}}. {{summary}} {{n}} connections.', { name: n.name, summary: n.summary, n: MAP_DATA.edgesOf.get(id)!.length }));
  }, [kbdId, tr]);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Escape') {
        if (typing) {
          (e.target as HTMLElement).blur();
          return;
        }
        if (showLegend || showFilters) {
          setShowLegend(false);
          setShowFilters(false);
        } else if (selectedId && panelOpen) setPanelOpen(false);
        else if (selectedId) select(null);
        else if (hoverId) setHoverId(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        searchInput.current?.focus();
      } else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      else if (e.key === '+' || e.key === '=') canvas.current?.zoomBy(1.25);
      else if (e.key === '-' || e.key === '_') canvas.current?.zoomBy(0.8);
      else if (e.key === '0') canvas.current?.reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- full screen ----
  const toggleFullscreen = () => {
    const el = root.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
  };
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const selected = selectedId ? MAP_DATA.nodeById.get(selectedId)! : null;
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const englishOnly = !!lang && !lang.startsWith('en');

  return (
    <div ref={root} className="fixed inset-0 flex flex-col bg-slate-950 text-slate-100">
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      {/* Top bar */}
      <header className="relative z-30 flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2">
        <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
          <ArrowLeft size={14} />
          {tr('Back to hub')}
        </Link>
        <h1 className="mr-2 flex items-center gap-2 text-sm font-bold sm:text-base">
          <MapIcon size={18} className="text-blue-300" />
          {tr('Blockchain Ecosystem Map')}
        </h1>

        <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) {
                pulseOnce(matches.map((m) => m.id));
                openNode(matches[0].id);
                setQuery('');
              }
            }}
            placeholder={tr('Search (press /)')}
            aria-label={tr('Search the map')}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {query.trim() ? (
            <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
              {matches.length ? (
                matches.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        pulseOnce([n.id]);
                        openNode(n.id);
                        setQuery('');
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-800"
                    >
                      {n.name}
                      <span className="ml-2 text-xs text-slate-500">{tr(MAP_DATA.categoryById.get(n.category)!.name)}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-slate-400">{tr('No match')}</li>
              )}
            </ul>
          ) : null}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <ToolbarButton onClick={() => setShowFilters((s) => !s)} pressed={showFilters} label={activeFilterCount ? tr('Filters ({{n}})', { n: activeFilterCount }) : tr('Filters')}>
            <Filter size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => setShowLegend((s) => !s)} pressed={showLegend} label={tr('Legend')}>
            <SlidersHorizontal size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => setListView((v) => !v)} pressed={listView} label={listView ? tr('Map view') : tr('List view')}>
            {listView ? <MapIcon size={14} /> : <LayoutList size={14} />}
          </ToolbarButton>
          <ToolbarButton onClick={toggleFullscreen} pressed={fullscreen} label={fullscreen ? tr('Exit full screen') : tr('Full screen')} iconOnly>
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </ToolbarButton>
          <LanguageSwitcher />
        </div>
      </header>

      {englishOnly ? (
        <div className="border-b border-amber-900/60 bg-amber-950/40 px-3 py-1 text-center text-xs text-amber-100">
          {t('map.englishOnly', { defaultValue: 'This map is available in English only for now.' })}
        </div>
      ) : null}

      {/* Filters */}
      {showFilters ? (
        <div className="relative z-20 flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900/90 px-3 py-2 text-xs">
          <Select label={tr('Category')} value={filters.cat ?? ''} onChange={(v) => setFilters({ ...filters, cat: (v || undefined) as CategoryId })}>
            <option value="">{tr('All')}</option>
            {MAP_DATA.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {tr(c.name)}
              </option>
            ))}
          </Select>
          <Select label={tr('Layer')} value={filters.layer ? String(filters.layer) : ''} onChange={(v) => setFilters({ ...filters, layer: v ? (Number(v) as 1 | 2 | 3) : undefined })}>
            <option value="">{tr('All')}</option>
            <option value="1">{tr('Layer 1')}</option>
            <option value="2">{tr('Layer 2')}</option>
            <option value="3">{tr('Applications & Layer 3')}</option>
          </Select>
          <Select label={tr('Type')} value={filters.kind ?? ''} onChange={(v) => setFilters({ ...filters, kind: (v || undefined) as Kind })}>
            <option value="">{tr('All')}</option>
            {(['chain', 'app', 'tool'] as const).map((k) => (
              <option key={k} value={k}>
                {kindName(k, tr)}
              </option>
            ))}
          </Select>
          <Select label={tr('Connection')} value={filters.edge ?? ''} onChange={(v) => setFilters({ ...filters, edge: (v || undefined) as EdgeType })}>
            <option value="">{tr('All')}</option>
            {EDGE_TYPES.map((et) => (
              <option key={et} value={et}>
                {edgeTypeName(et, tr)}
              </option>
            ))}
          </Select>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={!!filters.demo} onChange={(e) => setFilters({ ...filters, demo: e.target.checked || undefined })} />
            {tr('Only nodes with a demo ▶')}
          </label>
          {activeFilterCount ? (
            <button type="button" onClick={() => setFilters({})} className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800">
              {tr('Clear filters')}
            </button>
          ) : null}
          <span className="text-slate-500">{tr('{{n}} of {{total}} nodes match', { n: visibleNodes.length, total: MAP_DATA.nodes.length })}</span>
        </div>
      ) : null}

      {/* Map or list */}
      <main className="relative min-h-0 flex-1">
        {listView ? (
          <ListView data={MAP_DATA} nodes={visibleNodes} tr={tr} onSelect={openNode} selectedId={selectedId} />
        ) : (
          <>
            <MapCanvas
              ref={canvas}
              data={MAP_DATA}
              layout={LAYOUT}
              tr={tr}
              focusId={focusId}
              selectedId={selectedId}
              hoverCardId={hoverId && (!selectedId || hoverId !== selectedId || !panelOpen || touchCard) ? hoverId : null}
              isNodeActive={isNodeActive}
              isEdgeShown={isEdgeShown}
              pulseIds={pulse}
              demoBadges
              reducedMotion={reducedMotion}
              onHover={(id, touch) => {
                setHoverId(id);
                setTouchCard(touch);
              }}
              onSelect={openNode}
              onFocusNode={setKbdId}
              onNeighbourKey={(from, dir) => {
                const list = MAP_DATA.edgesOf.get(from) ?? [];
                if (!list.length) return;
                const i = ((neighbourIdx.current.get(from) ?? (dir > 0 ? -1 : 0)) + dir + list.length) % list.length;
                neighbourIdx.current.set(from, i);
                const e = list[i];
                canvas.current?.focusNode(e.from === from ? e.to : e.from);
              }}
              onDetails={openNode}
            />
            {/* zoom controls */}
            <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1">
              <ZoomButton label={tr('Zoom in')} onClick={() => canvas.current?.zoomBy(1.25)}>
                <Plus size={16} />
              </ZoomButton>
              <ZoomButton label={tr('Zoom out')} onClick={() => canvas.current?.zoomBy(0.8)}>
                <Minus size={16} />
              </ZoomButton>
              <ZoomButton label={tr('Reset view')} onClick={() => canvas.current?.reset()}>
                <RotateCcw size={15} />
              </ZoomButton>
            </div>
            <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 rounded-full bg-slate-950/80 px-3 py-1 text-[11px] text-slate-400 md:block">
              {tr('Hover a node for a summary, click for details. Drag to pan, scroll to zoom. Inclusion is not an endorsement.')}
            </p>
          </>
        )}
        {showLegend ? <Legend data={MAP_DATA} tr={tr} onClose={() => setShowLegend(false)} /> : null}
        {selected && panelOpen ? (
          <DetailPanel node={selected} data={MAP_DATA} demos={demos} tr={tr} lang={lang} onNavigate={(id) => select(id)} onClose={() => setPanelOpen(false)} />
        ) : null}
      </main>
    </div>
  );
}

function ToolbarButton({ onClick, pressed, label, children, iconOnly }: { onClick: () => void; pressed: boolean; label: string; children: React.ReactNode; iconOnly?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={iconOnly ? label : undefined}
      title={label}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs ${
        pressed ? 'border-blue-500 bg-blue-500/20 text-blue-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
      }`}
    >
      {children}
      {iconOnly ? null : <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

function ZoomButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="rounded-lg border border-slate-700 bg-slate-900/90 p-1.5 text-slate-200 hover:bg-slate-800">
      {children}
    </button>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-slate-300">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-100">
        {children}
      </select>
    </label>
  );
}
