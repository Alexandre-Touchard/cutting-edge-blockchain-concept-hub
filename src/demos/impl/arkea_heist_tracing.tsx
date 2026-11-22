import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Filter,
  GitBranch,
  Link2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Scan,
  Search,
  ShieldAlert,
  SkipBack,
  SkipForward,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EduTooltip from '../../ui/EduTooltip';
import LearningQuestsPortal from '../../ui/LearningQuestsPortal';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { toast } from '../../ui/toast';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
import {
  clampIndex,
  computeLayout,
  crossesPhaseBoundary,
  diagramLabel,
  effectiveTimestamp,
  figuresAt,
  firstIndexOfPhase,
  fitScale,
  formatStepHash,
  involvesActor,
  isReviewDue,
  parseStepHash,
  phaseRanges,
  stepVisualState,
  timelineFraction,
  validateScenario,
  type ActorRole
} from './arkea_heist/model';
import { CONTENT_AS_OF, REVIEW_BY, SCENARIO, TIMELINE_END, TIMELINE_START } from './arkea_heist/data';
import { ATTENTION_CLASSES, ConfidenceBadge, SourceList, useAttentionHint, type Tr } from './arkea_heist/ui';
import KnownFigures from './arkea_heist/KnownFigures';
import DispersalView from './arkea_heist/DispersalView';
import { usePersistedQuests, useReportQuestProgress } from '../questProgress';

const DEMO_ID = 'arkea-heist';
const DETAILS_HINT_KEY = 'arkea-heist:details-hint-done';
/** Phase from which the dispersal view is shown in full. */
const DISPERSAL_PHASE = 4;

// ---------------------------------------------------------------------------
// Visual constants (400-level tones: ≥ 4.5:1 contrast on the dark background)
// ---------------------------------------------------------------------------

const ROLE_COLOR: Record<ActorRole, string> = {
  threat: '#f87171',
  third_party: '#c084fc',
  victim: '#60a5fa',
  platform: '#fbbf24',
  issuer: '#fb923c',
  investigator: '#34d399',
  public: '#94a3b8'
};

const PHASE_COLOR = ['#f87171', '#60a5fa', '#fbbf24', '#c084fc', '#34d399', '#94a3b8'];

const SPEEDS = [0.5, 1, 2] as const;
const BASE_STEP_MS = 2600;
const HEADER_H = 64;

function phaseColor(phase: number) {
  return PHASE_COLOR[(phase - 1) % PHASE_COLOR.length];
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

function useElementWidth(ref: React.RefObject<HTMLElement>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function formatDate(iso: string | undefined, lang: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Shown in UTC, like the on-chain times quoted in the explanations.
  const hasTime = iso.length > 10;
  const text = d.toLocaleString(lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {})
  });
  return hasTime ? `${text} UTC` : text;
}

function confidenceWord(tr: Tr, c: 'confirmed' | 'reported' | 'unverified') {
  return c === 'confirmed' ? tr('Confirmed') : c === 'reported' ? tr('Reported') : tr('Unverified');
}

function QuestRow({ done, text, tip }: { done: boolean; text: string; tip: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={done ? 'text-emerald-300' : 'text-slate-400'}>{done ? '✓' : '•'}</span>
      <div className="text-slate-200">
        {text}
        <span className="ml-2">
          <EduTooltip text={tip} />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ArkeaHeistTracing() {
  const { tr } = useDemoI18n(DEMO_ID);
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const reducedMotion = usePrefersReducedMotion();

  const { actors, phases, steps } = SCENARIO;
  const count = steps.length;
  const layout = useMemo(() => computeLayout(SCENARIO), []);
  const ranges = useMemo(() => phaseRanges(steps), [steps]);
  const validation = useMemo(() => validateScenario(SCENARIO), []);
  const actorById = useMemo(() => Object.fromEntries(actors.map((a) => [a.id, a])), [actors]);
  const figureScaleMax = useMemo(() => Math.max(...SCENARIO.figures.map((f) => f.amountUsd ?? 0)), []);
  const reviewDue = useMemo(() => isReviewDue(REVIEW_BY, new Date()), []);

  const [current, setCurrent] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return parseStepHash(window.location.hash, count) ?? 0;
  });
  /** Step shown in the detail panel when it differs from `current` (clicked, not navigated to). */
  const [selected, setSelected] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [pauseAtPhases, setPauseAtPhases] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  /** When set, the detail panel shows this phase's overview instead of a step. */
  const [phasePanel, setPhasePanel] = useState<number | null>(null);
  const [actorFilter, setActorFilter] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [zoom, setZoom] = useState<'fit' | 'actual'>('fit');
  const [tip, setTip] = useState<{ index: number; x: number; y: number } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Point first-time users at Play; stops on the first navigation or after 10 s.
  const [hintPlay, stopHintPlay] = useAttentionHint();
  const startIndex = useRef(current);
  useEffect(() => {
    if (current !== startIndex.current || playing) stopHintPlay();
  }, [current, playing, stopHintPlay]);

  // Then teach that the diagram is clickable: shown until details are opened once (remembered).
  const [detailsHintDone, setDetailsHintDone] = useState(() => {
    try {
      return window.localStorage.getItem(DETAILS_HINT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const markDetailsHintDone = useCallback(() => {
    setDetailsHintDone(true);
    try {
      window.localStorage.setItem(DETAILS_HINT_KEY, '1');
    } catch {
      /* storage unavailable: hint just comes back next visit */
    }
  }, []);

  const [quest, setQuest] = usePersistedQuests(DEMO_ID, {
    reachedEnd: false,
    openedUnverified: false,
    usedFilter: false,
    clustered: false,
    jumpedByKeyboard: false
  });
  const questsDone = Object.values(quest).filter(Boolean).length;
  useReportQuestProgress(DEMO_ID, questsDone, 5);

  const step = steps[current];
  const shownIndex = selected ?? current;
  const showDetailsHint = !detailsHintDone && !hintPlay && !panelOpen && !playing;
  const shown = steps[shownIndex];

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const containerWidth = useElementWidth(scrollRef);
  const scale = zoom === 'fit' ? fitScale(containerWidth - 2, layout.width) : 1;

  /** Navigate: moves the current step and makes the panel follow it. */
  const go = useCallback(
    (i: number) => {
      setCurrent(clampIndex(i, count));
      setSelected(null);
      setPhasePanel(null);
    },
    [count]
  );

  const openDetails = (i: number) => {
    setPlaying(false);
    setPhasePanel(null);
    setSelected(i === current ? null : i);
    setPanelOpen(true);
    markDetailsHintDone();
  };

  const openPhase = (phase: number) => {
    setPlaying(false);
    setPhasePanel(phase);
    setPanelOpen(true);
    markDetailsHintDone();
  };

  const closePanel = () => {
    setPanelOpen(false);
    setSelected(null);
    setPhasePanel(null);
  };

  useEffect(() => {
    if (current === count - 1) setQuest((q) => (q.reachedEnd ? q : { ...q, reachedEnd: true }));
  }, [current, count]);

  useEffect(() => {
    if (panelOpen && phasePanel === null && shown?.confidence === 'unverified') setQuest((q) => (q.openedUnverified ? q : { ...q, openedUnverified: true }));
  }, [panelOpen, phasePanel, shown]);

  // Deep link: keep #step=N in sync without triggering a router navigation.
  useEffect(() => {
    const hash = formatStepHash(current);
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
  }, [current]);

  useEffect(() => {
    const onHash = () => {
      const i = parseStepHash(window.location.hash, count);
      if (i !== null) go(i);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [count, go]);

  // Play mode
  useEffect(() => {
    if (!playing) return;
    if (current >= count - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => {
      const next = current + 1;
      go(next);
      if (pauseAtPhases && crossesPhaseBoundary(steps, current, next)) setPlaying(false);
    }, BASE_STEP_MS / speed);
    return () => window.clearTimeout(t);
  }, [playing, current, count, speed, pauseAtPhases, steps, go]);

  // Keep the current step visible in the diagram.
  useEffect(() => {
    const el = scrollRef.current;
    const yRaw = layout.stepY[current];
    if (!el || yRaw === undefined) return;
    const y = (yRaw - HEADER_H) * scale;
    const top = el.scrollTop;
    if (y < top + 10 || y > top + el.clientHeight - HEADER_H * scale - 60) {
      el.scrollTo({ top: Math.max(0, y - el.clientHeight / 2), behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  }, [current, layout, reducedMotion, scale]);

  // Keyboard control (F5)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        // The scrubber handles its own arrows/Home/End; other keys are still ours.
        if (!(target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range')) return;
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // Space/Enter on a focused button activates that button; don't also toggle playback.
      if ((e.key === ' ' || e.key === 'Enter') && target?.closest('button, [role="button"]')) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPlaying(false);
        go(current + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPlaying(false);
        go(current - 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'Home') {
        e.preventDefault();
        go(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        go(count - 1);
      } else if (e.key === 'Escape') {
        setPanelOpen(false);
        setSelected(null);
        setPhasePanel(null);
        setActorFilter(null);
        setTip(null);
      } else if (e.key === 'f' || e.key === 'F') {
        setFocusMode((f) => !f);
      } else if (/^[1-9]$/.test(e.key)) {
        const i = firstIndexOfPhase(steps, Number(e.key));
        if (i >= 0) {
          setPlaying(false);
          go(i);
          setQuest((q) => (q.jumpedByKeyboard ? q : { ...q, jumpedByKeyboard: true }));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, count, go, steps]);

  const toggleFilter = (actorId: string) => {
    setActorFilter((f) => (f === actorId ? null : actorId));
    setQuest((q) => (q.usedFilter ? q : { ...q, usedFilter: true }));
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${formatStepHash(current)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(tr('Link to this step copied'));
    } catch {
      window.prompt(tr('Copy this link'), url);
    }
  };

  /** Tooltip next to an element (used for hover and keyboard focus). */
  const showTipAt = (index: number, el: Element) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!wrap) return;
    setTip({ index, x: r.left - wrap.left + Math.min(r.width / 2, 120), y: r.bottom - wrap.top });
  };

  const currentTs = effectiveTimestamp(steps, current);
  const timeFrac = timelineFraction(currentTs, TIMELINE_START, TIMELINE_END);
  const knownFigures = useMemo(() => figuresAt(SCENARIO, current), [current]);

  // -------------------------------------------------------------------------
  // Diagram (F1, F4, F7–F9, F11, F12)
  // -------------------------------------------------------------------------

  const header = (
    <svg
      width={layout.width * scale}
      height={HEADER_H * scale}
      viewBox={`0 0 ${layout.width} ${HEADER_H}`}
      className="block"
      role="group"
      aria-label={tr('Actors')}
    >
      {actors.map((a) => {
        const x = layout.actorX[a.id];
        const active = actorFilter === a.id;
        const color = ROLE_COLOR[a.role];
        return (
          <g
            key={a.id}
            className="arkea-focusable cursor-pointer"
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={tr('Filter by {{actor}}', { actor: tr(a.label) })}
            onClick={() => toggleFilter(a.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFilter(a.id);
              }
            }}
          >
            <rect
              className="arkea-ring"
              x={x - 62}
              y={8}
              width={124}
              height={48}
              rx={10}
              fill={active ? color : '#0f172a'}
              fillOpacity={active ? 0.25 : 1}
              stroke={color}
              strokeWidth={active ? 2.5 : 1.25}
            />
            <foreignObject x={x - 58} y={10} width={116} height={44}>
              <div className="flex h-full items-center justify-center text-center text-[11px] font-semibold leading-tight text-slate-100">
                {tr(a.label)}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );

  const bodyH = layout.height - HEADER_H;
  const body = (
    <svg width={layout.width * scale} height={bodyH * scale} viewBox={`0 ${HEADER_H} ${layout.width} ${bodyH}`} className="block">
      <defs>
        {Object.entries(ROLE_COLOR).map(([role, color]) => (
          <marker
            key={role}
            id={`arkea-arrow-${role}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        ))}
      </defs>

      {/* Phase bands (Mermaid `rect`) */}
      {layout.phaseBands.map((b) => {
        const p = phases.find((x) => x.id === b.phase);
        const isActive = step?.phase === b.phase;
        return (
          <g key={b.phase}>
            <rect
              x={4}
              y={b.top}
              width={layout.width - 8}
              height={b.bottom - b.top}
              rx={8}
              fill={phaseColor(b.phase)}
              fillOpacity={isActive ? 0.1 : 0.03}
              stroke={phaseColor(b.phase)}
              strokeOpacity={isActive ? 0.55 : 0.15}
            />
            <g
              className="arkea-focusable cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={tr('Phase {{n}}: {{title}}. Open the phase overview', { n: b.phase, title: p ? tr(p.title) : '' })}
              onClick={() => openPhase(b.phase)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openPhase(b.phase);
                }
              }}
            >
              <rect
                className="arkea-ring"
                x={9}
                y={b.top + 5}
                width={Math.round(`${b.phase}. ${p ? tr(p.title) : ''} ›`.length * 7.1) + 18}
                height={20}
                rx={10}
                fill={phaseColor(b.phase)}
                fillOpacity={phasePanel === b.phase && panelOpen ? 0.3 : 0.12}
                stroke={phaseColor(b.phase)}
                strokeOpacity={0.5}
              />
              <text x={18} y={b.top + 19} fill={phaseColor(b.phase)} fontSize={12} fontWeight={700}>
                {`${b.phase}. ${p ? tr(p.title) : ''} ›`}
              </text>
            </g>
          </g>
        );
      })}

      {/* Lifelines */}
      {actors.map((a) => (
        <line
          key={a.id}
          x1={layout.actorX[a.id]}
          x2={layout.actorX[a.id]}
          y1={HEADER_H}
          y2={layout.height - 10}
          stroke={ROLE_COLOR[a.role]}
          strokeOpacity={actorFilter && actorFilter !== a.id ? 0.12 : 0.35}
          strokeDasharray="4 4"
        />
      ))}

      {/* Steps */}
      {steps.map((s, i) => {
        const state = stepVisualState(i, current);
        const y = layout.stepY[i];
        const x1 = layout.actorX[s.from];
        const x2 = layout.actorX[s.to];
        const fromRole = actorById[s.from]?.role ?? 'public';
        const color = ROLE_COLOR[fromRole];
        const filteredOut = actorFilter !== null && !involvesActor(s, actorFilter);
        const opacity = filteredOut ? 0.12 : state === 'future' ? 0.3 : 1;
        const isCurrent = state === 'current';
        const isShown = i === shownIndex && panelOpen;
        const text = tr(diagramLabel(s));
        const badge = s.confidence === 'unverified' ? '🔴 ' : s.confidence === 'reported' ? '🟡 ' : '';

        const interactive = {
          className: `arkea-focusable${showDetailsHint && isCurrent ? ' arkea-hint' : ''}`,
          role: 'button',
          tabIndex: 0,
          'aria-label': `${tr('Step')} ${i + 1}: ${tr(s.label)} (${confidenceWord(tr, s.confidence)})`,
          onClick: () => openDetails(i),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDetails(i);
            }
          },
          onMouseEnter: (e: React.MouseEvent) => showTipAt(i, e.currentTarget),
          onFocus: (e: React.FocusEvent) => showTipAt(i, e.currentTarget),
          onMouseLeave: () => setTip(null),
          onBlur: () => setTip(null),
          style: { cursor: 'pointer', opacity, transition: reducedMotion ? 'none' : 'opacity 200ms' }
        } as const;

        if (s.type === 'note') {
          const left = Math.min(x1, x2) - 60;
          const right = Math.max(x1, x2) + 60;
          return (
            <g key={s.id} {...interactive}>
              <rect
                className="arkea-ring"
                x={left}
                y={y - 22}
                width={right - left}
                height={44}
                rx={6}
                fill="#1e293b"
                stroke={isCurrent || isShown ? '#f8fafc' : color}
                strokeWidth={isCurrent || isShown ? 2 : 1}
                strokeDasharray={s.style === 'dashed' ? '5 4' : undefined}
              />
              <foreignObject x={left + 6} y={y - 20} width={right - left - 12} height={40}>
                <div className="flex h-full items-center justify-center text-center text-[11px] leading-tight text-slate-200">
                  <span className="line-clamp-2">
                    {badge}
                    {text}
                  </span>
                </div>
              </foreignObject>
            </g>
          );
        }

        const self = s.from === s.to;
        const dir = x2 >= x1 ? 1 : -1;
        const arrowY = y + 12;
        const pathD = self ? `M ${x1} ${arrowY - 10} h 40 v 16 h -36` : `M ${x1 + dir * 4} ${arrowY} L ${x2 - dir * 6} ${arrowY}`;
        const labelW = self ? 200 : Math.max(210, Math.abs(x2 - x1) - 12);
        const labelX = self ? x1 + 46 : (x1 + x2) / 2 - labelW / 2;
        const labelTop = self ? arrowY - 30 : arrowY - 34;
        return (
          <g key={s.id} {...interactive}>
            <path className="arkea-ring" d={pathD} stroke="transparent" strokeWidth={24} fill="none" />
            <path
              key={isCurrent ? `cur-${i}` : `s-${i}`}
              d={pathD}
              stroke={color}
              strokeWidth={isCurrent || isShown ? 3 : 1.75}
              fill="none"
              strokeDasharray={s.style === 'dashed' ? '6 5' : undefined}
              markerEnd={`url(#arkea-arrow-${fromRole})`}
              className={isCurrent && !reducedMotion && s.style === 'solid' ? 'arkea-draw' : undefined}
              pathLength={isCurrent && !reducedMotion && s.style === 'solid' ? 1 : undefined}
            />
            <foreignObject x={labelX} y={labelTop} width={labelW} height={32}>
              <div
                className={`flex h-full items-end ${self ? 'justify-start text-left' : 'justify-center text-center'} text-[11px] leading-tight ${
                  isCurrent || isShown ? 'font-semibold text-white' : 'text-slate-300'
                } ${isCurrent && !reducedMotion ? 'arkea-fade' : ''}`}
              >
                <span className="line-clamp-2 rounded bg-slate-950/80 px-1 [box-decoration-break:clone]">
                  {badge}
                  {text}
                </span>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );

  // -------------------------------------------------------------------------
  // Detail panel (F7, 3.3)
  // -------------------------------------------------------------------------

  const phaseInfo = phasePanel === null ? null : phases.find((x) => x.id === phasePanel);
  const phaseRange = phasePanel === null ? null : ranges.find((r) => r.phase === phasePanel);
  const phaseDetail =
    phaseInfo && phaseRange ? (
      <div className="space-y-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: phaseColor(phaseInfo.id) }}>
            {tr('Phase')} {phaseInfo.id} / {phases.length}
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-100">{tr(phaseInfo.title)}</h3>
        </div>
        <p className="text-sm leading-relaxed text-slate-200">{tr(phaseInfo.summary)}</p>
        <button
          type="button"
          onClick={() => go(phaseRange.start)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold hover:bg-emerald-600"
        >
          <CornerDownRight size={14} />
          {tr('Go to the start of this phase')}
        </button>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-slate-300">
            {tr('{{n}} steps in this phase. Click one for details:', { n: phaseRange.end - phaseRange.start + 1 })}
          </div>
          <ul className="space-y-1.5">
            {steps.slice(phaseRange.start, phaseRange.end + 1).map((s, k) => {
              const i = phaseRange.start + k;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => openDetails(i)}
                    className="flex w-full items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-left text-xs hover:border-slate-600"
                  >
                    <span className="mt-0.5 font-mono text-slate-400">{i + 1}</span>
                    <span className="flex-1 text-slate-200">
                      {tr(diagramLabel(s))}
                      {s.timestamp ? <span className="text-slate-400"> · {formatDate(s.timestamp.slice(0, 10), lang)}</span> : null}
                    </span>
                    <ConfidenceBadge level={s.confidence} tr={tr} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    ) : null;

  const detail = shown ? (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: phaseColor(shown.phase) }}>
            {tr('Step')} {shownIndex + 1} · {tr('Phase')} {shown.phase} · {tr(phases.find((p) => p.id === shown.phase)?.title ?? '')}
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-100">{tr(shown.label)}</h3>
        </div>
        <ConfidenceBadge level={shown.confidence} tr={tr} />
      </div>
      {selected !== null && selected !== current ? (
        <button
          type="button"
          onClick={() => go(selected)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold hover:bg-emerald-600"
        >
          <CornerDownRight size={14} />
          {tr('Go to this step')}
        </button>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
        <span style={{ color: ROLE_COLOR[actorById[shown.from]?.role ?? 'public'] }}>{tr(actorById[shown.from]?.label ?? shown.from)}</span>
        <span aria-hidden>{shown.type === 'note' ? '·' : '→'}</span>
        <span style={{ color: ROLE_COLOR[actorById[shown.to]?.role ?? 'public'] }}>{tr(actorById[shown.to]?.label ?? shown.to)}</span>
        {shown.timestamp ? <span>· {formatDate(shown.timestamp, lang)}</span> : null}
      </div>
      <p className="text-sm leading-relaxed text-slate-200">{tr(shown.explanation)}</p>
      <div className="rounded-lg border border-blue-900 bg-blue-950/30 p-2.5 text-sm text-blue-100">
        <span className="font-semibold">{tr('Why it matters:')}</span> {tr(shown.whyItMatters)}
      </div>
      {shown.evidence ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5 text-xs text-slate-300">
          <div className="mb-1 font-semibold text-slate-200">{tr('On-chain evidence')}</div>
          <div>
            {tr('Asset')}: <span className="font-mono">{shown.evidence.asset}</span>
            {shown.evidence.amount ? (
              <>
                {' '}
                · {tr('Amount')}: <span className="font-mono">{shown.evidence.amount}</span>
              </>
            ) : null}
            {shown.evidence.chain ? (
              <>
                {' '}
                · {tr('Chain')}: {shown.evidence.chain}
              </>
            ) : null}
          </div>
          {shown.evidence.note ? <div className="mt-1 text-slate-400">{tr(shown.evidence.note)}</div> : null}
        </div>
      ) : null}
      <div>
        <div className="mb-1 text-xs font-semibold text-slate-300">{tr('Sources')}</div>
        <SourceList sources={shown.sources} noPublicSource={shown.noPublicSource} tr={tr} />
      </div>
    </div>
  ) : null;

  // -------------------------------------------------------------------------
  // Mini timeline (F14)
  // -------------------------------------------------------------------------

  const miniTimeline = (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-100">
        <span>{tr('Timeline')}</span>
        <span className="text-xs font-normal text-slate-400">{currentTs ? formatDate(currentTs, lang) : tr('Date not public')}</span>
      </div>
      <div className="relative h-8">
        <div className="absolute left-0 right-0 top-3 h-0.5 bg-slate-700" />
        {steps.map((s, i) => {
          const f = timelineFraction(s.timestamp, TIMELINE_START, TIMELINE_END);
          if (f === null) return null;
          return (
            <button
              key={s.id}
              type="button"
              aria-label={`${tr('Go to step')} ${i + 1}: ${tr(diagramLabel(s))}`}
              onClick={() => go(i)}
              className="absolute top-1.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full border border-slate-900"
              style={{ left: `${f * 100}%`, background: i <= current ? phaseColor(s.phase) : '#334155' }}
            />
          );
        })}
        {timeFrac !== null ? (
          <div
            className="absolute top-0 h-6 w-0.5 -translate-x-1/2 bg-white"
            style={{ left: `${timeFrac * 100}%`, transition: reducedMotion ? 'none' : 'left 300ms' }}
          />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{formatDate(TIMELINE_START, lang)}</span>
        <span>{formatDate(TIMELINE_END, lang)}</span>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Quests (9.1)
  // -------------------------------------------------------------------------

  const questsUi = (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-100">{tr('Learning quests')}</div>
        <div className="text-xs text-slate-400">({questsDone}/5)</div>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <QuestRow done={quest.reachedEnd} text={tr('Follow the money to the end')} tip={tr('Step (→) or press Play until the last step of phase 6.')} />
        <QuestRow
          done={quest.jumpedByKeyboard}
          text={tr('Jump to a phase with the keyboard')}
          tip={tr('Press a number key from 1 to 6 to jump to the start of that phase.')}
        />
        <QuestRow
          done={quest.openedUnverified}
          text={tr('Inspect an unverified claim')}
          tip={tr('Click a message marked 🔴 and read why it is not confirmed.')}
        />
        <QuestRow
          done={quest.usedFilter}
          text={tr('Isolate one actor')}
          tip={tr('Click an actor header (for example “ZachXBT & analytics”) to fade every message that does not involve them.')}
        />
        <QuestRow
          done={quest.clustered}
          text={tr('Cluster addresses like an analyst')}
          tip={tr('From phase 4, tick “Cluster addresses like an analyst” in the dispersal view.')}
        />
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const tipStep = tip ? steps[tip.index] : null;
  const hintAnchorX = (() => {
    if (!step) return 0;
    const x1 = layout.actorX[step.from];
    const x2 = layout.actorX[step.to];
    return step.from === step.to && step.type === 'message' ? x1 + 90 : (x1 + x2) / 2;
  })();
  const allSources = Array.from(
    new Map([...steps.flatMap((s) => s.sources), ...SCENARIO.figures.flatMap((f) => f.sources)].map((s) => [s.url, s])).values()
  ).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className={`min-h-screen w-full bg-gradient-to-br from-slate-950 to-slate-900 text-white ${focusMode ? 'p-3' : 'p-4 sm:p-6'}`}>
      <style>{`
        .arkea-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: arkea-draw 300ms ease-out forwards; }
        @keyframes arkea-draw { to { stroke-dashoffset: 0; } }
        .arkea-fade { animation: arkea-fade 300ms ease-out both; }
        @keyframes arkea-fade { from { opacity: 0; } to { opacity: 1; } }
        .arkea-focusable { outline: none; }
        .arkea-focusable:focus-visible .arkea-ring { stroke: #f8fafc !important; stroke-opacity: 0.35; }
        .arkea-focusable:focus-visible rect.arkea-ring { stroke-opacity: 1; stroke-width: 3; }
        .arkea-focusable:hover .arkea-ring { stroke: #f8fafc !important; stroke-opacity: 0.18; }
        .arkea-focusable:hover rect.arkea-ring { stroke-opacity: 0.9; }
        .arkea-hint .arkea-ring { stroke: #fbbf24 !important; stroke-opacity: 0.45; animation: arkea-hint 1.2s ease-in-out infinite; }
        @keyframes arkea-hint { 50% { stroke-opacity: 0.08; } }
        @media (prefers-reduced-motion: reduce) { .arkea-draw, .arkea-fade, .arkea-hint .arkea-ring { animation: none !important; } .arkea-draw { stroke-dasharray: none; } }
      `}</style>
      <LearningQuestsPortal>{questsUi}</LearningQuestsPortal>

      <div aria-live="polite" className="sr-only">
        {step ? `${tr('Step')} ${current + 1} / ${count}. ${tr(step.label)}. ${confidenceWord(tr, step.confidence)}.` : ''}
      </div>

      <div className={focusMode ? 'mx-auto max-w-[1600px]' : 'mx-auto max-w-7xl'}>
        {reviewDue ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-100">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-300" />
            <span>
              {tr('These facts were last checked on {{date}}. The investigation is ongoing, so figures and attributions may have changed since.', {
                date: formatDate(CONTENT_AS_OF, lang)
              })}
            </span>
          </div>
        ) : null}

        {!focusMode ? (
          <>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100 sm:text-3xl">
              <Search className="text-emerald-300" />
              {tr('Follow the Money: the Crédit Mutuel Arkéa heist')}
            </h1>
            <p className="mt-2 max-w-4xl text-slate-300">
              {tr(
                'In early November 2026, attackers moved about €100M out of a French bank with instant transfers, turned it into crypto within hours, and scattered it across exchanges, bridges and Monero. Step through how the theft unfolded and how on-chain analysts reconstructed the path.'
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <ShieldAlert size={14} className="text-amber-300" />
              <span>
                {tr('Based on public reporting as of {{date}}. Every claim carries a confidence level and its sources; the investigation is ongoing.', {
                  date: formatDate(CONTENT_AS_OF, lang)
                })}
              </span>
            </div>

            {/* 60-second tour (9.0) */}
            <div className="mt-4 rounded-xl border border-emerald-900 bg-emerald-950/20 p-4">
              <div className="mb-2 text-sm font-semibold text-emerald-200">⏱ {tr('60-second tour')}</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-200">
                <li>{tr('Press Play (or Space). Each arrow is one action between two actors; the coloured bands are the 6 phases.')}</li>
                <li>
                  {tr('Watch the badges:')} <ConfidenceBadge level="confirmed" tr={tr} /> <ConfidenceBadge level="reported" tr={tr} />{' '}
                  <ConfidenceBadge level="unverified" tr={tr} /> — {tr('not everything you read about this case is proven.')}
                </li>
                <li>{tr('Click any message or phase title (or Tab to it and press Enter) to see the explanation, why it matters, and the sources.')}</li>
                <li>
                  {tr('From phase 4, see how the funds were scattered and how')}{' '}
                  <EduTooltip term={tr('analysts')} text={define('On-chain Analytics')} /> {tr('group the addresses back together.')}
                </li>
              </ol>
            </div>
          </>
        ) : null}

        {/* Controls (F1–F4) */}
        <div className="sticky top-0 z-20 mt-4 rounded-xl border border-slate-800 bg-slate-950/95 p-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => go(0)} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700" aria-label={tr('First step')} title="Home">
              <SkipBack size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                go(current - 1);
              }}
              className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"
              aria-label={tr('Previous step')}
              title="←"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                stopHintPlay();
                if (current >= count - 1) go(0);
                setPlaying((p) => !p);
              }}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold hover:bg-emerald-600 ${
                hintPlay ? ATTENTION_CLASSES : ''
              }`}
              title="Space"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? tr('Pause') : tr('Play')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                go(current + 1);
              }}
              className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"
              aria-label={tr('Next step')}
              title="→"
            >
              <ChevronRight size={16} />
            </button>
            <button type="button" onClick={() => go(count - 1)} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700" aria-label={tr('Last step')} title="End">
              <SkipForward size={16} />
            </button>

            <span className="ml-1 whitespace-nowrap font-mono text-sm text-slate-300">
              {current + 1} / {count}
            </span>

            <div className="flex items-center gap-1" role="group" aria-label={tr('Speed')}>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={`rounded px-2 py-1 text-xs ${speed === s ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {s}×
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-300">
              <input type="checkbox" checked={pauseAtPhases} onChange={(e) => setPauseAtPhases(e.target.checked)} />
              {tr('Pause at phases')}
            </label>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => (z === 'fit' ? 'actual' : 'fit'))}
                aria-pressed={zoom === 'fit'}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700"
              >
                <Scan size={14} />
                {zoom === 'fit' ? tr('Actual size') : tr('Fit to width')}
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700"
              >
                <Link2 size={14} />
                {tr('Copy link to step')}
              </button>
              <button
                type="button"
                onClick={() => setFocusMode((f) => !f)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700"
                title="F"
              >
                {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                {focusMode ? tr('Exit focus') : tr('Focus mode')}
              </button>
            </div>
          </div>

          {/* Phase chips (F4) */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {phases.map((p) => {
              const active = step?.phase === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    go(firstIndexOfPhase(steps, p.id));
                  }}
                  title={`${tr(p.summary)} (${p.id})`}
                  aria-pressed={active}
                  className="whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold"
                  style={{
                    borderColor: phaseColor(p.id),
                    background: active ? phaseColor(p.id) : 'transparent',
                    color: active ? '#0b1120' : phaseColor(p.id)
                  }}
                >
                  {p.id}. {tr(p.title)}
                </button>
              );
            })}
          </div>

          {/* Scrubber (F3) */}
          <div className="relative mt-3">
            <input
              type="range"
              min={0}
              max={count - 1}
              value={current}
              onChange={(e) => {
                setPlaying(false);
                go(Number(e.target.value));
              }}
              className="w-full accent-emerald-500"
              aria-label={tr('Timeline scrubber')}
              aria-valuetext={step ? `${tr('Step')} ${current + 1}: ${tr(step.label)}` : undefined}
            />
            <div className="relative h-2" aria-hidden>
              {ranges.map((r) => (
                <div
                  key={r.phase}
                  className="absolute top-0 h-2 border-l-2"
                  style={{
                    left: `${(r.start / Math.max(1, count - 1)) * 100}%`,
                    width: `${((r.end - r.start + 1) / count) * 100}%`,
                    borderColor: phaseColor(r.phase),
                    background: `${phaseColor(r.phase)}33`
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {actorFilter ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <Filter size={14} />
            {tr('Showing messages involving')} <span className="font-semibold">{tr(actorById[actorFilter]?.label ?? '')}</span>
            <button type="button" onClick={() => setActorFilter(null)} className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 hover:bg-slate-700">
              <X size={12} />
              {tr('Clear filter')}
            </button>
          </div>
        ) : null}

        {/* Diagram + detail panel */}
        <div className={`mt-3 grid gap-4 ${panelOpen ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
          <div ref={wrapRef} className="relative min-w-0">
            <div
              ref={scrollRef}
              className="overflow-auto rounded-xl border border-slate-800 bg-slate-950/70"
              style={{ maxHeight: focusMode ? 'calc(100vh - 220px)' : '640px' }}
            >
              <div className="relative" style={{ width: layout.width * scale }}>
                <div className="sticky top-0 z-10 bg-slate-950/95">{header}</div>
                {body}
                {showDetailsHint && step ? (
                  <div
                    className="absolute z-[5] w-56 rounded-lg border border-amber-500 bg-slate-900 p-2 text-xs text-amber-50 shadow-xl"
                    style={{
                      left: Math.max(4, Math.min(hintAnchorX * scale - 112, layout.width * scale - 232)),
                      top: layout.stepY[current] * scale + 22
                    }}
                    role="note"
                  >
                    <div className="flex items-start gap-2">
                      <span aria-hidden>👆</span>
                      <span className="flex-1">{tr('Click any arrow, box or phase title for the explanation and its sources.')}</span>
                      <button
                        type="button"
                        onClick={markDetailsHintDone}
                        className="rounded p-0.5 text-amber-200 hover:bg-slate-800"
                        aria-label={tr('Dismiss tip')}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
              <span>━ {tr('confirmed action')}</span>
              <span>╍ {tr('undisclosed, hypothetical or return')}</span>
              <span>{tr('Click an actor to filter, a message or phase title for details.')}</span>
              <span className="hidden sm:inline">{tr('Keys: ← → Space 1–6 Home End Esc F · Tab + Enter on a message')}</span>
            </div>

            {tipStep && tip ? (
              <div
                className="pointer-events-none absolute z-30 max-w-xs rounded-lg border border-slate-600 bg-slate-900 p-2 text-xs text-slate-200 shadow-xl"
                style={{
                  left: Math.max(4, Math.min(tip.x - 40, (wrapRef.current?.clientWidth ?? 600) - 300)),
                  top: tip.y + 6
                }}
              >
                <div className="mb-1">
                  <ConfidenceBadge level={tipStep.confidence} tr={tr} />
                </div>
                {tr(tipStep.label)}
              </div>
            ) : null}
          </div>

          {panelOpen ? (
            <aside className="hidden rounded-xl border border-slate-700 bg-slate-900/80 p-4 lg:block" aria-label={tr('Details')}>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800"
                  aria-label={tr('Close details')}
                >
                  <X size={16} />
                </button>
              </div>
              {phaseDetail ?? detail}
            </aside>
          ) : null}
        </div>

        {/* Mobile bottom sheet */}
        {panelOpen ? (
          <div className="fixed inset-x-0 bottom-0 z-40 max-h-[65vh] overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900 p-4 shadow-2xl lg:hidden">
            <div className="mb-2 flex items-center justify-end">
              <button
                type="button"
                onClick={closePanel}
                className="rounded p-1 text-slate-400 hover:bg-slate-800"
                aria-label={tr('Close details')}
              >
                <X size={18} />
              </button>
            </div>
            {phaseDetail ?? detail}
          </div>
        ) : null}

        {/* Current step summary (opens the detail panel) */}
        {!panelOpen && step ? (
          <button
            type="button"
            onClick={() => openDetails(current)}
            className="mt-3 flex w-full items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left hover:border-slate-600"
          >
            <ConfidenceBadge level={step.confidence} tr={tr} />
            <span className="text-sm text-slate-200">
              <span className="font-semibold">{tr(step.label)}</span>
              <span className="text-slate-400"> — {tr('open details and sources')}</span>
            </span>
          </button>
        ) : null}

        {/* Side views (F13–F15) */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <KnownFigures figures={knownFigures} scaleMaxUsd={figureScaleMax} tr={tr} reducedMotion={reducedMotion} />
          {miniTimeline}
        </div>
        {/* Dispersal view: full from phase 4 (current or inspected step), placeholder before. */}
        {(step && step.phase >= DISPERSAL_PHASE) || (panelOpen && phasePanel === null && shown && shown.phase >= DISPERSAL_PHASE) ? (
          <div className="mt-4">
            <DispersalView
              tr={tr}
              lang={lang}
              reducedMotion={reducedMotion}
              onCluster={() => setQuest((q) => (q.clustered ? q : { ...q, clustered: true }))}
            />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
            <GitBranch size={16} className="text-purple-300" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-200">{tr('How the funds were scattered')}</div>
              <div className="text-xs text-slate-400">
                {tr('This interactive view covers the dispersal of the funds, from phase 4 onwards.')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                go(firstIndexOfPhase(steps, DISPERSAL_PHASE));
              }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold hover:bg-purple-600"
            >
              <CornerDownRight size={14} />
              {tr('Jump to phase 4')}
            </button>
          </div>
        )}

        {!focusMode ? (
          <>
            {/* Advanced / debug (9.2) */}
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                className="text-sm font-semibold text-slate-200 hover:text-white"
              >
                {showAdvanced ? '▾' : '▸'} {tr('Advanced: how this demo checks its own content')}
              </button>
              {showAdvanced ? (
                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  <p>
                    {tr(
                      'The scenario is plain data (actors, phases, steps, figures). On load, the demo checks it: confirmed and reported claims and figures have at least one dated https source, unverified claims without a source explain why, diagram labels are short enough, and phases are contiguous. Money figures are only ever published amounts.'
                    )}
                  </p>
                  <div>
                    {validation.length === 0 ? (
                      <span className="text-emerald-300">✓ {tr('All {{n}} steps pass the content checks.', { n: count })}</span>
                    ) : (
                      <ul className="list-disc pl-5 text-red-300">
                        {validation.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="text-slate-400">
                    {tr('Facts last checked: {{checked}} · next check due: {{due}}', {
                      checked: formatDate(CONTENT_AS_OF, lang),
                      due: formatDate(REVIEW_BY, lang)
                    })}
                  </div>
                  {step ? (
                    <div className="font-mono text-slate-400">
                      {tr('Current step')} #{step.id} · {tr('known figures')}: {knownFigures.map((f) => f.id).join(', ') || '—'}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Real-world applications */}
            <section className="mt-8">
              <h2 className="mb-4 text-2xl font-bold text-blue-300">🌐 {tr('Real-World Applications')}</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: tr('Speed is the defence'),
                    text: tr(
                      'Stablecoins and centralised exchanges can freeze funds, but only while the money is still with them. Converting to ETH and then Monero within hours is designed to outrun those freezes.'
                    )
                  },
                  {
                    title: tr('Third-party risk is bank risk'),
                    text: tr(
                      'The entry point was a service provider’s platform, not the bank’s own systems. Supplier access is part of the attack surface, which is what regulations such as DORA ask banks to manage.'
                    )
                  },
                  {
                    title: tr('Public ledgers cut both ways'),
                    text: tr(
                      'The same transparency that lets anyone trace the funds lets attackers watch the investigation. Analysts cluster addresses, follow bridges, and alert exchanges, but privacy coins end the trail.'
                    )
                  }
                ].map((c) => (
                  <div key={c.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="mb-1 font-semibold text-slate-100">{c.title}</div>
                    <p className="text-sm text-slate-300">{c.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Further reading: every source used in the demo */}
            <section className="mt-8">
              <h2 className="mb-4 text-2xl font-bold text-blue-300">📚 {tr('Further Reading')}</h2>
              <div className="space-y-2">
                {allSources.map((s) => (
                  <LinkWithCopy key={s.url} href={s.url} label={`${s.name}${s.title ? ` — ${s.title}` : ''} (${s.date})`} />
                ))}
              </div>
            </section>

            {/* About this demo (content safety) */}
            <section className="mb-10 mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs leading-relaxed text-slate-400">
              <h2 className="mb-2 text-sm font-semibold text-slate-200">{tr('About this demo')}</h2>
              <p>
                {tr(
                  'An educational reconstruction based only on the public reporting cited above. It makes no accusation against any person or company beyond what those sources state, and unproven points are marked as reported or unverified. Amounts and attributions may change as the investigation continues.'
                )}
              </p>
              <p className="mt-2">
                {tr(
                  'It is not affiliated with or endorsed by Crédit Mutuel Arkéa, ZachXBT, Bitquery or any outlet cited. It shows no wallet addresses.'
                )}
              </p>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
