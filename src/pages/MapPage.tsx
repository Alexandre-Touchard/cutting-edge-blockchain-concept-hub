// /map — Blockchain Ecosystem Map (spec: specification/ecosystem-graph-spec.md).
// Full-screen, explorable graph: hover for a summary, click for details, links to the hub's demos.
// URL state: selection in the hash (#node=arbitrum); filters, open groups and tours in the query
// (?cat=defi&layer=2&vm=evm&open=wallets&tour=stablecoin&step=2&demoId=amm-demo).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Compass,
  Keyboard,
  RefreshCcw,
  Filter,
  FoldVertical,
  LayoutList,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UnfoldVertical,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import { trackEvent } from '../analytics/client';
import { mapEvent } from '../../api/_map';
import { useDemoI18n } from '../demos/useDemoI18n';
import { loadDemos } from '../demos/loadDemos';
import { applyDemoStatusOverrides, fetchDemoStatusOverrides, type DemoStatusOverrides } from '../demos/demoStatusOverrides';
import { MAP_DATA, TOURS, searchNodes } from '../map/data';
import { computeLayout } from '../map/layout';
import MapCanvas, { type MapCanvasHandle } from '../map/MapCanvas';
import { DetailPanel, Legend, ListView, ShortcutsHelp, TourPanel } from '../map/panels';
import { buildView, type VisibleEdge, type VisibleItem } from '../map/view';
import type { CategoryId, Consensus, EdgeType, Kind, MapNode, RollupType, Vm } from '../map/types';
import { EDGE_TYPES } from '../map/types';
import { MAP_I18N_ID, consensusName, edgeTypeName, kindName, rollupName, vmName } from '../map/vocab';

const PANEL_W = 420;
const ALL_CLUSTERS = MAP_DATA.clusters.map((c) => c.id);

export type Filters = {
  cat?: CategoryId;
  layer?: 1 | 2 | 3;
  kind?: Kind;
  vm?: Vm;
  consensus?: Consensus;
  rollup?: RollupType;
  edge?: EdgeType;
  /** Only nodes that have a demo. */
  demo?: boolean;
  /** Only nodes linked to this demo ("See on the map" from a demo page). */
  demoId?: string;
  hideDiscontinued?: boolean;
};

const oneOf = <T extends string>(v: string | null, allowed: readonly T[]): T | undefined => (v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

export function readFilters(search: string): Filters {
  const q = new URLSearchParams(search);
  const layer = Number(q.get('layer'));
  return {
    cat: oneOf(q.get('cat'), MAP_DATA.categories.map((c) => c.id)),
    layer: layer === 1 || layer === 2 || layer === 3 ? layer : undefined,
    kind: oneOf(q.get('kind'), ['chain', 'app', 'tool'] as const),
    vm: oneOf(q.get('vm'), ['evm', 'svm', 'move', 'other'] as const),
    consensus: oneOf(q.get('consensus'), ['pow', 'pos', 'other'] as const),
    rollup: oneOf(q.get('rollup'), ['optimistic', 'zk'] as const),
    edge: oneOf(q.get('edge'), EDGE_TYPES),
    demo: q.get('demo') === '1' || undefined,
    demoId: oneOf(q.get('demoId'), [...new Set(MAP_DATA.nodes.flatMap((n) => n.demos))]),
    hideDiscontinued: q.get('live') === '1' || undefined
  };
}

/** Does a node pass the filters? (pure, exported for tests) */
export function passesFilters(n: MapNode, f: Filters, edgeTypeNodes: Set<string> | null): boolean {
  return (
    (!f.cat || n.category === f.cat) &&
    (!f.layer || n.layer === f.layer) &&
    (!f.kind || n.kind === f.kind) &&
    (!f.vm || n.vm === f.vm) &&
    (!f.consensus || n.consensus === f.consensus) &&
    (!f.rollup || n.rollupType === f.rollup) &&
    (!f.demo || n.demos.length > 0) &&
    (!f.demoId || n.demos.includes(f.demoId)) &&
    (!f.hideDiscontinued || n.status !== 'discontinued') &&
    (!edgeTypeNodes || edgeTypeNodes.has(n.id))
  );
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

// Event names: see api/_map.ts (also read by /api/stats).
const track = (event: string, demoId?: string) => trackEvent(event, { path: '/map', ...(demoId ? { demoId } : {}) });

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
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedId = useMemo(() => {
    const m = /node=([a-z0-9-]+)/.exec(location.hash);
    return m && MAP_DATA.nodeById.has(m[1]) ? m[1] : null;
  }, [location.hash]);
  const filters = useMemo(() => readFilters(location.search), [location.search]);
  const openParam = params.get('open') ?? '';
  const open = useMemo(() => new Set(openParam === 'all' ? ALL_CLUSTERS : openParam.split(',').filter((id) => MAP_DATA.clusterById.has(id))), [openParam]);
  const tour = useMemo(() => TOURS.find((x) => x.id === params.get('tour')) ?? null, [params]);
  const tourStep = tour ? Math.min(Math.max(0, Number(params.get('step')) || 0), tour.steps.length) : 0;

  const setQuery = useCallback(
    (patch: Record<string, string | null>, opts: { push?: boolean } = {}) => {
      const q = new URLSearchParams(location.search);
      for (const [k, v] of Object.entries(patch)) (v === null || v === '' ? q.delete(k) : q.set(k, v));
      const s = q.toString();
      navigate({ search: s ? `?${s}` : '', hash: location.hash }, { replace: !opts.push });
    },
    [location.search, location.hash, navigate]
  );
  const setFilters = (f: Filters) =>
    setQuery({
      cat: f.cat ?? null,
      layer: f.layer ? String(f.layer) : null,
      kind: f.kind ?? null,
      vm: f.vm ?? null,
      consensus: f.consensus ?? null,
      rollup: f.rollup ?? null,
      edge: f.edge ?? null,
      demo: f.demo ? '1' : null,
      demoId: f.demoId ?? null,
      live: f.hideDiscontinued ? '1' : null
    });
  const select = useCallback(
    (id: string | null) => {
      if (id) track(mapEvent.node(id));
      navigate({ search: location.search, hash: id ? `node=${id}` : '' });
    },
    [navigate, location.search]
  );
  const setOpen = (ids: Set<string>) => setQuery({ open: ids.size === ALL_CLUSTERS.length ? 'all' : [...ids].join(',') || null });

  // ---- local UI state ----
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** Card pinned by a click/tap: stays until a click on empty space or on another node. */
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [kbdId, setKbdId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [query, setQueryText] = useState('');
  const [pulse, setPulse] = useState<Set<string>>(new Set());
  const [showLegend, setShowLegend] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showTours, setShowTours] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [listView, setListView] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const neighbourIdx = useRef(new Map<string, number>());

  useEffect(() => {
    if (selectedId) setPanelOpen(true);
  }, [selectedId]);

  // ---- groups: the selected node's and the tour step's groups open automatically ----
  const tourNode = tour && tourStep < tour.steps.length ? tour.steps[tourStep].node : null;
  const expanded = useMemo(() => {
    const s = new Set(open);
    for (const id of [selectedId, tourNode]) {
      const c = id ? MAP_DATA.nodeById.get(id)?.cluster : undefined;
      if (c) s.add(c);
    }
    return s;
  }, [open, selectedId, tourNode]);
  const view = useMemo(() => buildView(MAP_DATA, expanded), [expanded]);
  const layout = useMemo(() => computeLayout(MAP_DATA.categories, MAP_DATA.nodes, view.items), [view]);

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
  const isNodeActive = useCallback(
    (n: MapNode) => passesFilters(n, filters, edgeTypeNodes) && (!query.trim() || matchSet.has(n.id)),
    [filters, edgeTypeNodes, query, matchSet]
  );
  const isItemActive = useCallback((i: VisibleItem) => (i.type === 'node' ? isNodeActive(i.node) : i.members.some(isNodeActive)), [isNodeActive]);
  const isEdgeShown = useCallback((e: VisibleEdge) => !filters.edge || e.edges.some((x) => x.type === filters.edge), [filters.edge]);
  const visibleNodes = useMemo(() => MAP_DATA.nodes.filter(isNodeActive), [isNodeActive]);

  const selectedItem = selectedId ? view.visibleOf(selectedId) : null;
  const pinned = pinnedId && view.itemById.has(pinnedId) ? pinnedId : null;
  const focusId = pinned ?? hoverId ?? kbdId ?? (tourNode ? view.visibleOf(tourNode) : null) ?? selectedItem;

  // ---- camera ----
  const recentre = useCallback((itemId: string, minZoom?: number) => {
    if (typeof window === 'undefined') return;
    const wide = window.innerWidth >= 768;
    // Desktop: panel on the right. Phones: bottom sheet up to 62% of the height.
    canvas.current?.centerOn(itemId, wide ? PANEL_W : 0, wide ? 0 : window.innerHeight * 0.62, minZoom);
  }, []);
  useEffect(() => {
    if (selectedId && !listView && !tour) recentre(view.visibleOf(selectedId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  useEffect(() => {
    if (tourNode && !listView && typeof window !== 'undefined') canvas.current?.centerOn(view.visibleOf(tourNode), 0, window.innerWidth >= 768 ? 0 : window.innerHeight * 0.45, 1.3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourNode]);

  const openNode = (id: string) => {
    setHoverId(null);
    setPinnedId(null);
    if (id === selectedId) {
      setPanelOpen(true);
      recentre(view.visibleOf(id));
    } else select(id);
  };

  /** Click/Enter on a map item: a group expands, a node opens its details. */
  const activate = (itemId: string) => {
    const item = view.itemById.get(itemId);
    if (!item) return;
    if (item.type === 'cluster') {
      setHoverId(null);
      setPinnedId(null);
      setOpen(new Set([...open, item.cluster.id]));
      track(mapEvent.group(item.cluster.id));
      // Zoom on the group once it has been laid out.
      window.setTimeout(() => recentre(item.members[0].id, 1.6), 30);
    } else openNode(item.node.id);
  };

  /** Click/tap on a map item: pins a node's card (a group expands). */
  const pick = (itemId: string) => {
    const item = view.itemById.get(itemId);
    if (!item) return;
    if (item.type === 'cluster') return activate(itemId);
    setHoverId(null);
    setPinnedId(itemId);
  };

  /** Back to the starting view: no filters, groups closed, no selection, card, tour or search. */
  const resetAll = () => {
    setPinnedId(null);
    setHoverId(null);
    setQueryText('');
    setShowFilters(false);
    setShowTours(false);
    setShowLegend(false);
    setShowHelp(false);
    setListView(false);
    navigate({ search: '', hash: '' });
    canvas.current?.reset();
  };

  const collapseGroup = (clusterId: string) => {
    const next = new Set(open);
    next.delete(clusterId);
    setOpen(next);
    if (selectedId && MAP_DATA.nodeById.get(selectedId)?.cluster === clusterId) select(null);
  };

  const pulseOnce = (ids: string[]) => {
    setPulse(new Set(ids));
    window.setTimeout(() => setPulse(new Set()), 1100);
  };

  // ---- tours ----
  const startTour = (id: string) => {
    setShowTours(false);
    setPanelOpen(false);
    track(mapEvent.tourStart(id));
    setQuery({ tour: id, step: '0' }, { push: true });
  };
  const goToStep = (i: number) => {
    if (!tour) return;
    const step = Math.max(0, Math.min(i, tour.steps.length));
    if (step === tour.steps.length) track(mapEvent.tourDone(tour.id));
    setQuery({ step: String(step) });
  };
  const exitTour = () => setQuery({ tour: null, step: null });

  // ---- announcements ----
  useEffect(() => {
    if (!kbdId) return;
    const it = view.itemById.get(kbdId);
    if (!it) return;
    if (it.type === 'cluster') setAnnounce(tr('{{name}}: group of {{n}}. Press Enter to expand.', { name: it.cluster.name, n: it.members.length }));
    else setAnnounce(tr('{{name}}. {{summary}} {{n}} connections.', { name: it.node.name, summary: it.node.summary, n: MAP_DATA.edgesOf.get(it.node.id)!.length }));
  }, [kbdId, tr, view]);

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
        if (showLegend || showFilters || showTours || showHelp) {
          setShowLegend(false);
          setShowFilters(false);
          setShowTours(false);
          setShowHelp(false);
        } else if (pinned) {
          // Also drop the hover state: the pointer may still be over the node.
          setPinnedId(null);
          setHoverId(null);
        }
        else if (tour) exitTour();
        else if (selectedId && panelOpen) setPanelOpen(false);
        else if (selectedId) select(null);
        else if (hoverId) setHoverId(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?') setShowHelp((h) => !h);
      else if (e.key === '/') {
        e.preventDefault();
        searchInput.current?.focus();
      } else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      else if (e.key === '+' || e.key === '=') canvas.current?.zoomBy(1.25);
      else if (e.key === '-' || e.key === '_') canvas.current?.zoomBy(0.8);
      else if (e.key === '0') canvas.current?.reset();
      else if (tour && e.key === 'ArrowRight') goToStep(tourStep + 1);
      else if (tour && e.key === 'ArrowLeft') goToStep(tourStep - 1);
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
  const activeFilterCount = (Object.keys(filters) as (keyof Filters)[]).filter((k) => k !== 'demoId' && filters[k]).length;
  const englishOnly = !!lang && !lang.startsWith('en');
  const allOpen = open.size === ALL_CLUSTERS.length;
  const demoFocus = filters.demoId ? demos.get(filters.demoId) : undefined;
  const changed = !!(location.search || location.hash || pinned || query);

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
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) {
                pulseOnce(matches.map((m) => view.visibleOf(m.id)));
                openNode(matches[0].id);
                setQueryText('');
              }
            }}
            placeholder={tr('Search (press /)')}
            aria-label={tr('Search the map')}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {query.trim() ? (
            <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
              {matches.length ? (
                matches.slice(0, 10).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        pulseOnce([view.visibleOf(n.id)]);
                        openNode(n.id);
                        setQueryText('');
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
          <div className="relative">
            <ToolbarButton onClick={() => setShowTours((s) => !s)} pressed={showTours || !!tour} label={tr('Guided tours')}>
              <Compass size={14} />
            </ToolbarButton>
            {showTours ? (
              <ul className="absolute right-0 top-full z-40 mt-1 w-80 space-y-1 rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
                {TOURS.map((x) => (
                  <li key={x.id}>
                    <button type="button" onClick={() => startTour(x.id)} className="block w-full rounded-lg p-2 text-left hover:bg-slate-800">
                      <div className="text-sm font-semibold text-white">{x.title}</div>
                      <div className="text-xs text-slate-400">{x.intro}</div>
                      <div className="mt-0.5 text-[11px] text-amber-300">{tr('{{n}} steps', { n: x.steps.length })}</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <ToolbarButton onClick={() => setShowFilters((s) => !s)} pressed={showFilters} label={activeFilterCount ? tr('Filters ({{n}})', { n: activeFilterCount }) : tr('Filters')}>
            <Filter size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setOpen(allOpen ? new Set() : new Set(ALL_CLUSTERS))}
            pressed={allOpen}
            label={allOpen ? tr('Collapse groups') : tr('Expand groups')}
          >
            {allOpen ? <FoldVertical size={14} /> : <UnfoldVertical size={14} />}
          </ToolbarButton>
          <ToolbarButton onClick={() => setShowLegend((s) => !s)} pressed={showLegend} label={tr('Legend')}>
            <SlidersHorizontal size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => setListView((v) => !v)} pressed={listView} label={listView ? tr('Map view') : tr('List view')}>
            {listView ? <MapIcon size={14} /> : <LayoutList size={14} />}
          </ToolbarButton>
          <ToolbarButton onClick={resetAll} pressed={false} label={tr('Reset the map')} iconOnly disabled={!changed}>
            <RefreshCcw size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => setShowHelp((h) => !h)} pressed={showHelp} label={tr('Keyboard shortcuts (?)')} iconOnly>
            <Keyboard size={14} />
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

      {demoFocus ? (
        <div className="flex items-center justify-center gap-2 border-b border-blue-900/60 bg-blue-950/40 px-3 py-1 text-xs text-blue-100">
          {tr('Showing the nodes linked to the demo “{{title}}”.', { title: demoFocus.title })}
          <a href={`/demo/${demoFocus.id}`} className="underline hover:text-white">
            {tr('Back to the demo')}
          </a>
          <button type="button" onClick={() => setFilters({ ...filters, demoId: undefined })} className="inline-flex items-center gap-1 rounded border border-blue-800 px-1.5 hover:bg-blue-900/50">
            <X size={12} />
            {tr('Show everything')}
          </button>
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
          <Select label={tr('Execution')} value={filters.vm ?? ''} onChange={(v) => setFilters({ ...filters, vm: (v || undefined) as Vm })}>
            <option value="">{tr('All')}</option>
            {(['evm', 'svm', 'move', 'other'] as const).map((k) => (
              <option key={k} value={k}>
                {vmName(k, tr)}
              </option>
            ))}
          </Select>
          <Select label={tr('Consensus')} value={filters.consensus ?? ''} onChange={(v) => setFilters({ ...filters, consensus: (v || undefined) as Consensus })}>
            <option value="">{tr('All')}</option>
            {(['pow', 'pos', 'other'] as const).map((k) => (
              <option key={k} value={k}>
                {consensusName(k, tr)}
              </option>
            ))}
          </Select>
          <Select label={tr('Rollup')} value={filters.rollup ?? ''} onChange={(v) => setFilters({ ...filters, rollup: (v || undefined) as RollupType })}>
            <option value="">{tr('All')}</option>
            {(['optimistic', 'zk'] as const).map((k) => (
              <option key={k} value={k}>
                {rollupName(k, tr)}
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
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={!!filters.hideDiscontinued} onChange={(e) => setFilters({ ...filters, hideDiscontinued: e.target.checked || undefined })} />
            {tr('Hide discontinued')}
          </label>
          {activeFilterCount ? (
            <button type="button" onClick={() => setFilters({ demoId: filters.demoId })} className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800">
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
              view={view}
              layout={layout}
              tr={tr}
              focusId={focusId}
              selectedId={selectedItem}
              hoverCardId={pinned ?? (hoverId && (hoverId !== selectedItem || !panelOpen) ? hoverId : null)}
              isItemActive={isItemActive}
              isEdgeShown={isEdgeShown}
              pulseIds={pulse}
              reducedMotion={reducedMotion}
              onHover={setHoverId}
              cardPinned={!!pinned}
              onCloseCard={() => setPinnedId(null)}
              onPick={pick}
              onBackgroundClick={() => {
                setPinnedId(null);
                setHoverId(null);
              }}
              onActivate={activate}
              onFocusItem={setKbdId}
              onNeighbourKey={(from, dir) => {
                const list = view.edgesOf.get(from) ?? [];
                if (!list.length) return;
                const i = ((neighbourIdx.current.get(from) ?? (dir > 0 ? -1 : 0)) + dir + list.length) % list.length;
                neighbourIdx.current.set(from, i);
                const e = list[i];
                canvas.current?.focusItem(e.from === from ? e.to : e.from);
              }}
            />
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
            {!tour ? (
              <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 rounded-full bg-slate-950/80 px-3 py-1 text-[11px] text-slate-400 md:block">
                {tr('Hover for a summary, click for details or to open a group. Drag to pan, scroll to zoom. Inclusion is not an endorsement.')}
              </p>
            ) : null}
          </>
        )}
        {showLegend ? <Legend data={MAP_DATA} tr={tr} onClose={() => setShowLegend(false)} /> : null}
        {showHelp ? <ShortcutsHelp tr={tr} onClose={() => setShowHelp(false)} /> : null}
        {tour ? (
          <TourPanel
            tour={tour}
            step={tourStep}
            data={MAP_DATA}
            demos={demos}
            tr={tr}
            onStep={goToStep}
            onExit={exitTour}
            onDetails={(id) => {
              exitTour();
              select(id);
            }}
            onDemoClick={(id) => track(mapEvent.toDemo(id), id)}
          />
        ) : null}
        {selected && panelOpen && !tour ? (
          <DetailPanel
            node={selected}
            data={MAP_DATA}
            demos={demos}
            tr={tr}
            lang={lang}
            onNavigate={(id) => select(id)}
            onClose={() => setPanelOpen(false)}
            onDemoClick={(id) => track(mapEvent.toDemo(id), id)}
            onCollapseGroup={selected.cluster ? () => collapseGroup(selected.cluster!) : undefined}
          />
        ) : null}
      </main>
    </div>
  );
}

function ToolbarButton({
  onClick,
  pressed,
  label,
  children,
  iconOnly,
  disabled
}: {
  onClick: () => void;
  pressed: boolean;
  label: string;
  children: React.ReactNode;
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={iconOnly ? label : undefined}
      title={label}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-30 ${
        pressed ? 'border-blue-500 bg-blue-500/20 text-blue-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
      }`}
    >
      {children}
      {iconOnly ? null : <span className="hidden lg:inline">{label}</span>}
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

