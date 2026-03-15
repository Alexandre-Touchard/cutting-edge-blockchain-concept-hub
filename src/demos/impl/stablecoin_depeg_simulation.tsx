import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bug,
  Eye,
  Maximize2,
  X,
  ChevronDown,
  ChevronUp,
  Droplets,
  Gauge,
  ListTodo,
  Plus,
  RefreshCw,
  Play,
  Pause,
  FastForward,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wrench,
  Banknote
} from 'lucide-react';
import EduTooltip from '../../ui/EduTooltip';
import LearningQuestsPortal from '../../ui/LearningQuestsPortal';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { define as defineGlossary } from '../glossary';

const collateralRatioIconUrl = new URL('../../public/icons/Icon1.png', import.meta.url).href;
const solvencyIconUrl = new URL('../../public/icons/Icon2.png', import.meta.url).href;
const confidenceIconUrl = new URL('../../public/icons/Icon3.png', import.meta.url).href;

function WhaleIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  // Simple inline SVG whale (local component to avoid depending on icon availability).
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M3 13c2.2 0 3.7-1.7 5.1-3.3C9.7 7.9 11.4 6 14.5 6c3.1 0 5.2 1.7 6.2 4.2.5 1.2.7 2.5.7 3.8l2.1 1.4-2.1 1.4c0 1.3-.2 2.6-.7 3.8-1 2.5-3.1 4.2-6.2 4.2-2.4 0-4.1-1.1-5.7-2.5-.8-.7-1.6-1.5-2.4-2.3C5.1 18.7 4 18 3 18v-5Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path d="M6.2 9.8c-.5-.8-.7-1.8-.2-2.8.4-.8 1.1-1.4 1.9-1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16.6" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}
import { useDemoI18n } from '../useDemoI18n';

// Backwards-compatible alias so we don't have to rewrite all usages.
const Tooltip = EduTooltip;

type ScenarioId = 'collateralized' | 'algorithmic';

type EventType = 'info' | 'success' | 'warn' | 'error';

type SimEvent = {
  id: number;
  t: number;
  type: EventType;
  message: string;
};

type SeriesPoint = {
  t: number;
  stable: number;
  ref: number; // collateral index or LUNA price
};

type CollateralizedState = {
  t: number;
  stablePrice: number;
  collateralIndex: number; // 1.0 = initial
  debt: number; // stable supply (arbitrary units)
  collateralValue: number; // USD value backing the system
  liquidityDepth: number; // relative depth (0..2)
  confidence: number; // 0..1
  oracleQuality: number; // 0..1
  whaleSell: number; // remaining sell pressure units
  liquidationPressure: number; // 0..1
  lastTick: {
    cr: number;
    equity: number;
    liquidationTrigger: number;
    liquidationPressure: number;
    collateralSellUsd: number;
    collateralImpact: number;
    panicSell: number;
    arbPressure: number;
    stableDelta: number;
    collateralDelta: number;
  };
};

type AlgorithmicState = {
  t: number;
  stablePrice: number;
  lunaPrice: number;
  stableSupply: number;
  lunaSupply: number;
  ammDepth: number; // 0..2
  yieldSupport: number; // 0..1
  confidence: number; // 0..1
  whaleSell: number;
  lastTick: {
    sentiment: number;
    sellPressure: number;
    sellDelta: number;
    priceStress: number;
    redemption: number;
    redemptionCap: number;
    lunaMinted: number;
    supplyInflation: number;
    lunaDeltaPct: number;
    lunaPriceNext: number;
    backstopStrength: number;
    redeemSupport: number;
    stableDelta: number;
  };
};

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function severityColorClass(sev01: number) {
  const s = clamp(sev01, 0, 1);
  // green -> amber -> red
  if (s < 0.34) return 'accent-emerald-500';
  if (s < 0.67) return 'accent-amber-500';
  return 'accent-red-500';
}

function severityTextClass(sev01: number) {
  const s = clamp(sev01, 0, 1);
  if (s < 0.34) return 'text-emerald-200';
  if (s < 0.67) return 'text-amber-200';
  return 'text-red-200';
}

function severityFromRange(value: number, min: number, max: number, opts?: { invert?: boolean }) {
  const t = max === min ? 0 : (value - min) / (max - min);
  const clamped = clamp(t, 0, 1);
  return opts?.invert ? 1 - clamped : clamped;
}

function fmt(x: number, decimals = 2) {
  if (!Number.isFinite(x)) return '—';
  return x.toFixed(decimals);
}

function pct(x: number, decimals = 0) {
  return `${(x * 100).toFixed(decimals)}%`;
}

function nowId() {
  return Date.now() + Math.floor(Math.random() * 1_000_000);
}

function initialCollateralized(): CollateralizedState {
  // Mirrors the spec: stable=$1, CR=165%, deep liquidity, high confidence.
  const debt = 100;
  const collateralValue = debt * 1.65;
  return {
    t: 0,
    stablePrice: 1.0,
    collateralIndex: 1.0,
    debt,
    collateralValue,
    liquidityDepth: 1.0,
    confidence: 0.9,
    oracleQuality: 1.0,
    whaleSell: 0,
    liquidationPressure: 0,
    lastTick: {
      cr: collateralValue / debt,
      equity: collateralValue - debt,
      liquidationTrigger: 1.5,
      liquidationPressure: 0,
      collateralSellUsd: 0,
      collateralImpact: 0,
      panicSell: 0,
      arbPressure: 0,
      stableDelta: 0,
      collateralDelta: 0
    }
  };
}

function initialAlgorithmic(): AlgorithmicState {
  // Mirrors the spec: stable=$1, LUNA $80, 18B stable, 350M LUNA.
  // We keep smaller numbers but preserve ratios.
  return {
    t: 0,
    stablePrice: 1.0,
    lunaPrice: 80,
    stableSupply: 18_000, // 18B scaled down by 1e6
    lunaSupply: 350, // 350M scaled down by 1e6
    ammDepth: 1.0,
    yieldSupport: 0.9,
    confidence: 0.85,
    whaleSell: 0,
    lastTick: {
      sentiment: 0,
      sellPressure: 0,
      sellDelta: 0,
      priceStress: 0,
      redemption: 0,
      redemptionCap: 0,
      lunaMinted: 0,
      supplyInflation: 0,
      lunaDeltaPct: 0,
      lunaPriceNext: 80,
      backstopStrength: 1,
      redeemSupport: 0,
      stableDelta: 0
    }
  };
}

function computeCR(s: CollateralizedState) {
  return s.collateralValue / s.debt;
}

function stablePriceColor(price: number) {
  const dist = Math.abs(price - 1);
  if (dist < 0.003) return 'text-emerald-300';
  if (dist < 0.02) return 'text-yellow-300';
  return 'text-red-300';
}

function outcomeLabel(price: number): 'peg' | 'depeg' | 'collapse' {
  if (price >= 0.99 && price <= 1.01) return 'peg';
  if (price >= 0.8) return 'depeg';
  return 'collapse';
}

function EventPill({ type }: { type: EventType }) {
  const cls =
    type === 'success'
      ? 'border-emerald-700 bg-emerald-900/20 text-emerald-100'
      : type === 'warn'
        ? 'border-amber-700 bg-amber-900/20 text-amber-100'
        : type === 'error'
          ? 'border-red-700 bg-red-900/25 text-red-100'
          : 'border-blue-700 bg-blue-900/20 text-blue-100';
  const label = type === 'warn' ? 'warning' : type;
  return <span className={`px-2 py-0.5 rounded border text-[11px] ${cls}`}>{label}</span>;
}

function TooltipInButton({ text }: { text: React.ReactNode }) {
  return (
    <span
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="inline-flex"
    >
      <Tooltip text={text} />
    </span>
  );
}

function QuestRow({ done, text, tip }: { done: boolean; text: string; tip: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={done ? 'text-emerald-300' : 'text-slate-500'}>{done ? '✓' : '•'}</span>
      <div className={done ? 'text-emerald-100' : 'text-slate-200'}>
        {text}
        <span className="ml-2">
          <Tooltip text={tip} />
        </span>
      </div>
    </div>
  );
}

type ChartMarker = {
  id: string;
  t: number;
  stable: number;
  kind:
    | 'shock_collateral_crash'
    | 'shock_liquidity_drain'
    | 'shock_whale_exit'
    | 'shock_oracle_failure'
    | 'shock_confidence_shock'
    | 'shock_yield_withdrawal'
    | 'shock_whale_sale'
    | 'shock_death_spiral'
    | 'add_liquidity'
    | 'fix_oracle'
    | 'backstop_buy'
    | 'restore_yield';
  label: string;
};

function SimpleLineChart({
  tr,
  title,
  showHeader = true,
  colorizeNow = false,
  points,
  markers,
  legendExtra,
  headerRightExtra,
  footerRightExtra,
  stableLabel,
  refLabel,
  refIsIndex,
  refValueLabel,
  refValueFormatter,
  width,
  height
}: {
  tr: (s: string, opts?: Record<string, unknown>) => string;
  title: string;
  showHeader?: boolean;
  colorizeNow?: boolean;
  points: SeriesPoint[];
  markers?: ChartMarker[];
  legendExtra?: React.ReactNode;
  headerRightExtra?: React.ReactNode;
  footerRightExtra?: React.ReactNode;
  stableLabel: string;
  refLabel: string;
  refIsIndex?: boolean;
  refValueLabel?: string;
  refValueFormatter?: (x: number) => string;
  width?: number;
  height?: number;
}) {
  const w = width ?? 560;
  const h = height ?? 180;
  const padLeft = 54;
  const padRight = 10;
  const padTop = 16;
  const padBottom = 34;
  const yAxis = h - padBottom;

  const xs = points.map((p) => p.t);
  const stableYs = points.map((p) => p.stable);
  const refYs = points.map((p) => p.ref);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  const xTickCount = 5;
  const xTicks = (() => {
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return [] as number[];
    if (maxX === minX) return [minX];
    const raw = Array.from({ length: xTickCount }, (_, i) => minX + (i / (xTickCount - 1)) * (maxX - minX));
    const rounded = raw.map((v) => Math.round(v));
    const unique = Array.from(new Set(rounded));
    // Ensure endpoints exist.
    if (unique[0] !== minX) unique.unshift(minX);
    if (unique[unique.length - 1] !== maxX) unique.push(maxX);
    return unique;
  })();

  // Stable is usually around 1.0; keep scale anchored to show depegs clearly.
  const minStable = Math.min(...stableYs, 0.0);
  const maxStable = Math.max(...stableYs, 1.05);

  const yTickCount = 5;
  const yLabelDecimals = maxStable - minStable < 0.2 ? 3 : 2;
  const yTicks = (() => {
    if (!Number.isFinite(minStable) || !Number.isFinite(maxStable)) return [] as number[];
    if (maxStable === minStable) return [minStable];
    const raw = Array.from({ length: yTickCount }, (_, i) => minStable + (i / (yTickCount - 1)) * (maxStable - minStable));
    const roundTo = Math.pow(10, yLabelDecimals);
    const rounded = raw.map((v) => Math.round(v * roundTo) / roundTo);
    const unique = Array.from(new Set(rounded));
    // Ensure $1 tick is shown when in range.
    if (1 >= minStable && 1 <= maxStable && !unique.some((v) => Math.abs(v - 1) < 1e-9)) {
      unique.push(1);
      unique.sort((a, b) => a - b);
    }
    return unique;
  })();

  const minRef = Math.min(...refYs);
  const maxRef = Math.max(...refYs);

  function xScale(x: number) {
    if (maxX === minX) return padLeft;
    return padLeft + ((x - minX) / (maxX - minX)) * (w - padLeft - padRight);
  }

  function yScale(y: number, min: number, max: number) {
    if (max === min) return h / 2;
    return padTop + (1 - (y - min) / (max - min)) * (h - padTop - padBottom);
  }

  function pathFor(series: number[], min: number, max: number) {
    if (series.length === 0) return '';
    return series
      .map((y, i) => {
        const x = xScale(points[i]!.t);
        const yy = yScale(y, min, max);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${yy.toFixed(2)}`;
      })
      .join(' ');
  }

  const stablePath = pathFor(stableYs, minStable, maxStable);
  const refPath = pathFor(refYs, minRef, maxRef);

  function markerIcon(kind: ChartMarker['kind']) {
    switch (kind) {
      // Interventions
      case 'add_liquidity':
        return <Plus size={14} className="text-emerald-300" />;
      case 'fix_oracle':
        return <Wrench size={14} className="text-amber-300" />;
      case 'backstop_buy':
        return <Banknote size={14} className="text-emerald-200" />;
      case 'restore_yield':
        return <TrendingUp size={14} className="text-blue-200" />;

      // Shocks
      case 'shock_collateral_crash':
        return <TrendingDown size={14} className="text-red-300" />;
      case 'shock_liquidity_drain':
        return <Droplets size={14} className="text-sky-200" />;
      case 'shock_whale_exit':
        return <WhaleIcon size={14} className="text-slate-200" />;
      case 'shock_oracle_failure':
        return <Eye size={14} className="text-red-300" />;
      case 'shock_confidence_shock':
        return <img src={confidenceIconUrl} alt={tr('Confidence')} width={14} height={14} className="opacity-90" />;
      case 'shock_yield_withdrawal':
        return <Gauge size={14} className="text-slate-200" />;
      case 'shock_whale_sale':
        return <TrendingDown size={14} className="text-rose-200" />;
      case 'shock_death_spiral':
        return <AlertTriangle size={14} className="text-red-300" />;

      default:
        return <AlertTriangle size={14} className="text-red-300" />;
    }
  }

  const last = points[points.length - 1];

  return (
    <div id ="control_section" className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-300" />
            <span className="truncate">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-400 whitespace-nowrap">{tr('t={{t}}', { t: last?.t ?? 0 })}</div>
            {headerRightExtra ? headerRightExtra : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 overflow-auto">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
          {/* y-axis (price) */}
          <line x1={padLeft} x2={padLeft} y1={padTop} y2={yAxis} stroke="rgba(148,163,184,0.35)" />
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={padLeft - 4}
                x2={padLeft}
                y1={yScale(v, minStable, maxStable)}
                y2={yScale(v, minStable, maxStable)}
                stroke="rgba(148,163,184,0.35)"
              />
              <text
                x={padLeft - 6}
                y={yScale(v, minStable, maxStable) + 3}
                textAnchor="end"
                fontSize={10}
                fill="rgba(148,163,184,0.85)"
              >
                {`$${fmt(v, yLabelDecimals)}`}
              </text>
            </g>
          ))}
          <text
            x={14}
            y={(padTop + yAxis) / 2}
            transform={`rotate(-90 14 ${(padTop + yAxis) / 2})`}
            textAnchor="middle"
            fontSize={11}
            fill="rgba(148,163,184,0.9)"
          >
            {tr('Price')}
          </text>

          {/* Baseline at $1 */}
          <line
            x1={padLeft}
            x2={w - padRight}
            y1={yScale(1, minStable, maxStable)}
            y2={yScale(1, minStable, maxStable)}
            stroke="rgba(148,163,184,0.35)"
            strokeDasharray="4 4"
          />

          {/* x-axis (t) */}
          <line x1={padLeft} x2={w - padRight} y1={yAxis} y2={yAxis} stroke="rgba(148,163,184,0.35)" />
          {xTicks.map((t) => (
            <g key={t}>
              <line
                x1={xScale(t)}
                x2={xScale(t)}
                y1={yAxis}
                y2={yAxis + 4}
                stroke="rgba(148,163,184,0.35)"
              />
              <text
                x={xScale(t)}
                y={yAxis + 16}
                textAnchor="middle"
                fontSize={10}
                fill="rgba(148,163,184,0.85)"
              >
                {t}
              </text>
            </g>
          ))}
          <text x={w - padRight} y={h - 8} textAnchor="end" fontSize={11} fill="rgba(148,163,184,0.9)">
            t
          </text>

          <path d={refPath} fill="none" stroke="rgba(167,139,250,0.9)" strokeWidth={2} />
          <path d={stablePath} fill="none" stroke="rgba(52,211,153,0.95)" strokeWidth={2.5} />

          {(markers ?? [])
            .filter((m) => m.t >= minX && m.t <= maxX)
            .map((m) => {
              const x = xScale(m.t);
              const y = yScale(m.stable, minStable, maxStable);
              return (
                <g key={m.id}>
                  <title>{m.label}</title>
                  <foreignObject x={x - 10} y={y - 10} width={20} height={20} overflow="visible">
                    <div className="h-5 w-5 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center">
                      {markerIcon(m.kind)}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {stableLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            {refLabel}
          </span>
          {legendExtra ? <span className="ml-2">{legendExtra}</span> : null}
        </div>

        {last ? (
          <div className="text-xs text-slate-400 whitespace-nowrap flex flex-col items-end gap-0.5">
            {footerRightExtra ? <div className="text-[11px] leading-4">{footerRightExtra}</div> : null}
            <div>
              {tr('Now')}: <span className={colorizeNow ? stablePriceColor(last.stable) : ''}>${fmt(last.stable, 3)}</span> •{' '}
              {refIsIndex ? `${tr('Index')} ${fmt(last.ref, 2)}` : `${tr('Price')} $${fmt(last.ref, 2)}`}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function StablecoinDepegSimulation() {
  const { tr } = useDemoI18n('stablecoin-depeg');

  const [scenario, setScenario] = useState<ScenarioId>('collateralized');
  const [showFormulas, setShowFormulas] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [chartMaximized, setChartMaximized] = useState(false);
  const [maxControlsOpen, setMaxControlsOpen] = useState(true);
  const [isAutoRunning, setIsAutoRunning] = useState(true);
  const [autoRunSpeed, setAutoRunSpeed] = useState<1 | 2>(1);
  const [showPlayHint, setShowPlayHint] = useState(true);
  const [mechanicsOverlayOpen, setMechanicsOverlayOpen] = useState(true);

  type KpiKey = 'price' | 'confidence' | 'solvency' | 'cr' | 'liquidity' | 'oracle' | 'yield';
  const [kpiHighlights, setKpiHighlights] = useState<Partial<Record<KpiKey, boolean>>>({});
  const kpiHighlightTimeoutsRef = useRef<Partial<Record<KpiKey, number>>>({});

  function flashKpis(keys: KpiKey[]) {
    setKpiHighlights((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = true;
      return next;
    });

    for (const k of keys) {
      const existing = kpiHighlightTimeoutsRef.current[k];
      if (existing) window.clearTimeout(existing);
      kpiHighlightTimeoutsRef.current[k] = window.setTimeout(() => {
        setKpiHighlights((prev) => {
          const next = { ...prev };
          delete next[k];
          return next;
        });
      }, 3000);
    }
  }

  function kpiGlowClass(key: KpiKey) {
    return kpiHighlights[key]
      ? 'ring-2 ring-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.25)] transition-shadow'
      : '';
  }

  useEffect(() => {
    return () => {
      for (const t of Object.values(kpiHighlightTimeoutsRef.current)) {
        if (t) window.clearTimeout(t);
      }
    };
  }, []);

  const autoRunIntervalRef = useRef<number | null>(null);
  const stepOnceRef = useRef<() => void>(() => undefined);

  // When entering maximized mode, expand controls by default.
  useEffect(() => {
    if (chartMaximized) setMaxControlsOpen(true);
  }, [chartMaximized]);

  // Prevent the underlying page from scrolling when the maximized overlay is open.
  useEffect(() => {
    if (!chartMaximized) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [chartMaximized]);

  const [showQuests, setShowQuests] = useState(true);
  const [questsBlink, setQuestsBlink] = useState(true);

  // Fold quests by default; blink the folded header for 10s.
  useEffect(() => {
    setShowQuests(true);
    setQuestsBlink(true);
    const t = window.setTimeout(() => setQuestsBlink(false), 10_000);
    return () => window.clearTimeout(t);
  }, []);

  const DEFAULT_PARAMS = useMemo(
    () => ({
      // Collateralized
      liquidationTrigger: 1.5, // 150%
      arbEfficiency: 10, // higher -> faster return to peg
      liquidationSeverity: 0.06, // fraction of collateral value sold per tick under full pressure
      collateralImpactK: 0.08,

      // Algorithmic
      redemptionIntensity: 0.08, // fraction of supply per unit of stress
      redemptionCap: 0.12, // cap as fraction of supply per tick
      reflexivityK: 2.8, // how strongly inflation hits price
      ammDepth: 1.0
    }),
    []
  );

  const [params, setParams] = useState(() => ({ ...DEFAULT_PARAMS }));

  const [collat, setCollat] = useState<CollateralizedState>(() => initialCollateralized());
  const [algo, setAlgo] = useState<AlgorithmicState>(() => initialAlgorithmic());

  const [questFlags, setQuestFlags] = useState(() => ({
    everDepegged: false,
    everLiquidated: false,
    everRedeemed: false,
    everCollapsed: false,
    everRecovered: false,

    // Optimization / learning loops
    keptAbove97For10: false,
    recoveredWithMinimalInterventions: false,
    recoveredWithoutBackstopBuy: false,
    regainedConfidence: false,
    survivedCrash10StepsNoInsolvency: false
  }));

  const currentT = scenario === 'collateralized' ? collat.t : algo.t;

  const liquidityDepthNow = scenario === 'collateralized' ? collat.liquidityDepth : algo.ammDepth;
  const oracleQualityNow = scenario === 'collateralized' ? collat.oracleQuality : null;
  const yieldSupportNow = scenario === 'algorithmic' ? algo.yieldSupport : null;
  // Slippage multiplier vs baseline depth=1, using the same nonlinear depthImpact used in the step model.
  const slippageMultiplierNow = (() => {
    const d = clamp(liquidityDepthNow, 0.06, 2);
    const denomBase = 10 + 18 * 1 * 1;
    const denomNow = 10 + 18 * d * d;
    return denomBase / denomNow;
  })();

  const slippageSeverityClass = (() => {
    // 1.0x = baseline. Show amber/red when impact meaningfully increases.
    if (slippageMultiplierNow >= 2.0) return 'text-red-200';
    if (slippageMultiplierNow >= 1.3) return 'text-amber-200';
    return 'text-slate-200';
  })();

  const slippagePillBorderClass = (() => {
    if (slippageMultiplierNow >= 2.0) return 'border-red-700/60';
    if (slippageMultiplierNow >= 1.3) return 'border-amber-700/60';
    return 'border-slate-800';
  })();

  const [events, setEvents] = useState<SimEvent[]>(() => [
    {
      id: nowId(),
      t: 0,
      type: 'info',
      message: tr('Pick a scenario and apply shocks. Then click Step to see how the system reacts.')
    }
  ]);

  const [whyBanner, setWhyBanner] = useState<null | { title: string; body: string }>(null);

  const [chartMarkers, setChartMarkers] = useState<ChartMarker[]>([]);
  const chartMarkerIdRef = useRef(0);

  function addChartMarker(kind: ChartMarker['kind'], label: string) {
    // Anchor markers to the *plotted* curve (series), not the mutable state.
    // Shocks/interventions happen between steps, so the curve only updates when you Step.
    const last = series[series.length - 1];
    if (!last) return;
    const id = `m_${chartMarkerIdRef.current++}`;
    setChartMarkers((prev) => [...prev, { id, t: last.t, stable: last.stable, kind, label }].slice(-40));
  }

  // Optimization quest helpers
  const [interventionsUsed, setInterventionsUsed] = useState(0);
  const interventionsUsedRef = useRef(0);
  const usedBackstopBuyRef = useRef(false);

  // Additional quest trackers
  const everLowConfidenceRef = useRef(false);
  const crashActiveRef = useRef(false);
  const crashTicksRef = useRef(0);
  const crashInsolvencyRef = useRef(false);

  const [above97Streak, setAbove97Streak] = useState(0);
  const above97StreakRef = useRef(0);

  const [everDepeggedAtLeastOnce, setEverDepeggedAtLeastOnce] = useState(false);
  const everDepeggedAtLeastOnceRef = useRef(false);

  function bumpInterventions() {
    setInterventionsUsed((n) => {
      const next = n + 1;
      interventionsUsedRef.current = next;
      return next;
    });
  }

  function markEverDepegged() {
    setEverDepeggedAtLeastOnce(true);
    everDepeggedAtLeastOnceRef.current = true;
  }


  const [series, setSeries] = useState<SeriesPoint[]>(() => [{ t: 0, stable: 1.0, ref: 1.0 }]);

  function addEvent(type: EventType, message: string, tOverride?: number) {
    setEvents((prev) => [{ id: nowId(), t: tOverride ?? currentT, type, message }, ...prev].slice(0, 18));
  }

  function setWhy(title: string, body: string) {
    setWhyBanner({ title, body });
  }

  function reset(nextScenario?: ScenarioId, opts?: { resetAdvanced?: boolean }) {
    const sc = nextScenario ?? scenario;

    const nextParams = opts?.resetAdvanced ? { ...DEFAULT_PARAMS } : params;
    if (opts?.resetAdvanced) {
      setParams(nextParams);
      setShowAdvanced(false);
      setShowFormulas(false);
    }

    const c = initialCollateralized();
    const a = initialAlgorithmic();

    // Initialize state using advanced parameters (either preserved or reset to defaults).
    c.lastTick.liquidationTrigger = nextParams.liquidationTrigger;
    a.ammDepth = nextParams.ammDepth;

    setScenario(sc);
    setCollat(c);
    setAlgo(a);
    setQuestFlags({
      everDepegged: false,
      everLiquidated: false,
      everRedeemed: false,
      everCollapsed: false,
      everRecovered: false,
      keptAbove97For10: false,
      recoveredWithMinimalInterventions: false,
      recoveredWithoutBackstopBuy: false,
      regainedConfidence: false,
      survivedCrash10StepsNoInsolvency: false
    });

    setIsAutoRunning(false);
    setWhyBanner(null);
    setChartMarkers([]);
    chartMarkerIdRef.current = 0;
    setInterventionsUsed(0);
    interventionsUsedRef.current = 0;
    usedBackstopBuyRef.current = false;
    everLowConfidenceRef.current = false;
    crashActiveRef.current = false;
    crashTicksRef.current = 0;
    crashInsolvencyRef.current = false;

    setAbove97Streak(0);
    above97StreakRef.current = 0;
    setEverDepeggedAtLeastOnce(false);
    everDepeggedAtLeastOnceRef.current = false;

    setSeries([{ t: 0, stable: 1.0, ref: sc === 'collateralized' ? 1.0 : a.lunaPrice }]);
    setEvents([{ id: nowId(), t: 0, type: 'info', message: tr('Reset simulation') }]);
  }

  function updateQuestsFromStep(
    nextStablePrice: number,
    opts: { liquidations?: boolean; redeemed?: boolean; confidenceNext?: number; equityNext?: number }
  ) {
    // Optimization quest: keep stable >= 0.97 for 10 consecutive steps.
    setAbove97Streak((prev) => {
      const next = nextStablePrice >= 0.97 ? prev + 1 : 0;
      above97StreakRef.current = next;
      return next;
    });

    // Track whether we have ever depegged (for minimal-intervention recovery quest)
    if (Math.abs(nextStablePrice - 1) > 0.02) markEverDepegged();

    // Track confidence dip -> later recovery
    if (typeof opts.confidenceNext === 'number' && opts.confidenceNext < 0.5) {
      everLowConfidenceRef.current = true;
    }

    // Track collateral-crash survival window (collateralized only)
    if (crashActiveRef.current && typeof opts.equityNext === 'number') {
      crashTicksRef.current += 1;
      if (opts.equityNext < 0) crashInsolvencyRef.current = true;
      if (crashTicksRef.current >= 10) crashActiveRef.current = false;
    }

    setQuestFlags((prev) => {
      const isDepegged = Math.abs(nextStablePrice - 1) > 0.02;
      const recoveredNow = Math.abs(nextStablePrice - 1) <= 0.01;

      const everDepegged = prev.everDepegged || isDepegged;
      const everLiquidated = prev.everLiquidated || Boolean(opts.liquidations);
      const everRedeemed = prev.everRedeemed || Boolean(opts.redeemed);
      const everCollapsed = prev.everCollapsed || nextStablePrice < 0.8;
      const everRecovered = prev.everRecovered || (everDepegged && recoveredNow);

      const keptAbove97For10 =
        prev.keptAbove97For10 || (nextStablePrice >= 0.97 && above97StreakRef.current >= 10);

      const recoveredWithMinimalInterventions =
        prev.recoveredWithMinimalInterventions ||
        (everDepeggedAtLeastOnceRef.current && recoveredNow && interventionsUsedRef.current <= 2);

      const recoveredWithoutBackstopBuy =
        prev.recoveredWithoutBackstopBuy ||
        (everDepeggedAtLeastOnceRef.current && recoveredNow && !usedBackstopBuyRef.current);

      const regainedConfidence =
        prev.regainedConfidence ||
        (everLowConfidenceRef.current && typeof opts.confidenceNext === 'number' && opts.confidenceNext >= 0.75);

      const survivedCrash10StepsNoInsolvency =
        prev.survivedCrash10StepsNoInsolvency ||
        (!crashActiveRef.current && crashTicksRef.current >= 10 && !crashInsolvencyRef.current);

      return {
        everDepegged,
        everLiquidated,
        everRedeemed,
        everCollapsed,
        everRecovered,
        keptAbove97For10,
        recoveredWithMinimalInterventions,
        recoveredWithoutBackstopBuy,
        regainedConfidence,
        survivedCrash10StepsNoInsolvency
      };
    });
  }

  function applyShock(preset: string) {
    if (scenario === 'collateralized') {
      setCollat((s) => {
        const next = { ...s };
        if (preset === 'collateral_crash') {
          next.collateralIndex = clamp(next.collateralIndex * 0.6, 0.05, 2);
          next.collateralValue = next.collateralValue * 0.6;
        }
        if (preset === 'liquidity_drain') {
          // Stronger depth shock => higher slippage for the same sells.
          next.liquidityDepth = clamp(next.liquidityDepth * 0.35, 0.05, 2);
        }
        if (preset === 'whale_exit') {
          next.whaleSell += 14;
        }
        if (preset === 'oracle_failure') {
          next.oracleQuality = 0.25;
        }
        if (preset === 'confidence_shock') {
          next.confidence = clamp(next.confidence - 0.25, 0, 1);
        }
        return next;
      });

      const name =
        preset === 'collateral_crash'
          ? tr('Collateral price crash (-40%)')
          : preset === 'liquidity_drain'
            ? tr('Liquidity drain (LPs withdraw)')
            : preset === 'whale_exit'
              ? tr('Whale exit (sell stable into AMM)')
              : preset === 'oracle_failure'
                ? tr('Oracle failure (bad feed)')
                : tr('Confidence shock (panic)');

      addEvent('warn', tr('Applied shock: {{name}}', { name }));
      const markerKind: ChartMarker['kind'] =
        preset === 'collateral_crash'
          ? 'shock_collateral_crash'
          : preset === 'liquidity_drain'
            ? 'shock_liquidity_drain'
            : preset === 'whale_exit'
              ? 'shock_whale_exit'
              : preset === 'oracle_failure'
                ? 'shock_oracle_failure'
                : 'shock_confidence_shock';
      addChartMarker(markerKind, tr('Shock: {{name}}', { name }));

      if (preset === 'collateral_crash') {
        crashActiveRef.current = true;
        crashTicksRef.current = 0;
        crashInsolvencyRef.current = false;
      }

      flashKpis(
        preset === 'collateral_crash'
          ? ['solvency', 'cr']
          : preset === 'liquidity_drain'
            ? ['liquidity']
            : preset === 'whale_exit'
              ? ['price']
              : preset === 'oracle_failure'
                ? ['oracle', 'confidence']
                : ['confidence']
      );
    } else { 

      setAlgo((s) => {
        const next = { ...s };
        if (preset === 'yield_withdrawal') {
          next.yieldSupport = clamp(next.yieldSupport - 0.35, 0, 1);
          next.confidence = clamp(next.confidence - 0.15, 0, 1);
        }
        if (preset === 'whale_sale') {
          next.whaleSell += 220;
        }
        if (preset === 'death_spiral') {
          next.yieldSupport = 0.2;
          next.confidence = 0.35;
          next.whaleSell += 520;
        }
        return next;
      });

      const name =
        preset === 'yield_withdrawal'
          ? tr('Yield withdrawal')
          : preset === 'whale_sale'
            ? tr('Whale sale')
            : tr('Death spiral starter');

      addEvent('warn', tr('Applied shock: {{name}}', { name }));
      const markerKind: ChartMarker['kind'] =
        preset === 'yield_withdrawal'
          ? 'shock_yield_withdrawal'
          : preset === 'whale_sale'
            ? 'shock_whale_sale'
            : 'shock_death_spiral';
      addChartMarker(markerKind, tr('Shock: {{name}}', { name }));

      flashKpis(
        preset === 'yield_withdrawal'
          ? ['yield', 'confidence']
          : preset === 'whale_sale'
            ? ['price']
            : ['yield', 'confidence', 'price']
      );
    }

    // No auto-scroll on action.
  }

  function applyIntervention(kind: string) {
    bumpInterventions();
    if (kind === 'backstop_buy') usedBackstopBuyRef.current = true;
    if (scenario === 'collateralized') {
      setCollat((s) => {
        const next = { ...s };
        if (kind === 'add_liquidity') next.liquidityDepth = clamp(next.liquidityDepth * 1.25, 0.06, 2);
        if (kind === 'fix_oracle') next.oracleQuality = clamp(next.oracleQuality + 0.35, 0.25, 1);
        if (kind === 'backstop_buy') {
          next.whaleSell = Math.max(0, next.whaleSell - 6);
          next.confidence = clamp(next.confidence + 0.08, 0, 1);
          next.stablePrice = clamp(next.stablePrice + 0.02, 0.05, 1.2);
        }
        return next;
      });

      const name =
        kind === 'add_liquidity'
          ? tr('Add liquidity')
          : kind === 'fix_oracle'
            ? tr('Fix oracle')
            : tr('Backstop buy (buy stable)');

      addEvent('success', tr('Intervention: {{name}}', { name }));
      addChartMarker(kind as ChartMarker['kind'], tr('Intervention: {{name}}', { name }));
      flashKpis(kind === 'add_liquidity' ? ['liquidity', 'price'] : kind === 'fix_oracle' ? ['oracle', 'confidence'] : ['price', 'confidence']);
      setWhy(
        tr('Intervention effect'),
        kind === 'add_liquidity'
          ? tr('Adding liquidity increases pool depth, which reduces price impact (slippage) from sells and makes the peg easier to defend.')
          : kind === 'fix_oracle'
            ? tr('Fixing the oracle improves pricing accuracy, which prevents incorrect liquidations and stabilizes confidence-driven behavior.')
            : tr('A backstop buy adds external buy pressure for the stablecoin, helping it move back toward $1 in the short term.')
      );
    } else {
      setAlgo((s) => {
        const next = { ...s };
        if (kind === 'add_liquidity') next.ammDepth = clamp(next.ammDepth * 1.25, 0.06, 2);
        if (kind === 'restore_yield') next.yieldSupport = clamp(next.yieldSupport + 0.25, 0, 1);
        if (kind === 'backstop_buy') {
          next.whaleSell = Math.max(0, next.whaleSell - 180);
          next.confidence = clamp(next.confidence + 0.06, 0, 1);
          next.stablePrice = clamp(next.stablePrice + 0.03, 0.01, 1.1);
        }
        return next;
      });

      const name =
        kind === 'add_liquidity'
          ? tr('Add liquidity')
          : kind === 'restore_yield'
            ? tr('Restore yield incentives')
            : tr('Backstop buy (buy stable)');

      addEvent('success', tr('Intervention: {{name}}', { name }));
      addChartMarker(kind as ChartMarker['kind'], tr('Intervention: {{name}}', { name }));
      flashKpis(kind === 'add_liquidity' ? ['liquidity', 'price'] : kind === 'restore_yield' ? ['yield', 'confidence'] : ['price', 'confidence']);
      setWhy(
        tr('Intervention effect'),
        kind === 'add_liquidity'
          ? tr('Adding liquidity increases AMM depth, which reduces price impact from sells and makes the peg harder to break.')
          : kind === 'restore_yield'
            ? tr('Restoring yield incentives boosts demand and confidence, reducing sell pressure and slowing the reflexive loop.')
            : tr('A backstop buy adds external buy pressure for the stablecoin, helping it move back toward $1 in the short term.')
      );
    }

    // Auto-scroll disabled (guided mode keeps highlights only).
  }

  function stepOnce() {
    if (scenario === 'collateralized') {
      setCollat((s) => {
        const liquidationTrigger = params.liquidationTrigger;
        const cr = computeCR(s);

        // How deep are we under the trigger?
        const liquidationPressure = clamp((liquidationTrigger - cr) * 1.2, 0, 1);

        // Liquidations sell collateral into the market.
        const collateralSellUsd = liquidationPressure * params.liquidationSeverity * s.collateralValue;
        const collateralImpact =
          (collateralSellUsd / (1 + 12 * s.liquidityDepth)) * params.collateralImpactK;

        const collateralIndexNext = clamp(s.collateralIndex * (1 - collateralImpact), 0.05, 2);
        const collateralValueNext = s.collateralValue * (collateralIndexNext / s.collateralIndex);

        // Confidence reacts to CR, price deviation, and oracle quality.
        const priceStress = Math.abs(s.stablePrice - 1);
        const oracleStress = 1 - s.oracleQuality;
        const confidenceDelta =
          0.01 * (0.45 - priceStress * 6 - oracleStress * 0.4 - clamp(liquidationTrigger - cr, 0, 1));
        const confidenceNext = clamp(s.confidence + confidenceDelta, 0, 1);

        // Liquidity can drain when confidence is low.
        const liquidityDrain = clamp((0.6 - confidenceNext) * 0.04, 0, 0.04);
        const liquidityDepthNext = clamp(s.liquidityDepth * (1 - liquidityDrain), 0.06, 2);

        // Selling pressure combines whale exit + panic. Arbitrage pushes toward $1.
        const panicSell = (1 - confidenceNext) * 1.2 + oracleStress * 0.4;
        const sellPressure = s.whaleSell + panicSell;
        const arbPressure = (1 - s.stablePrice) * params.arbEfficiency * confidenceNext;

        // Nonlinear slippage: shallow liquidity causes disproportionately larger price moves.
        const depthImpact = liquidityDepthNext * liquidityDepthNext;
        const stableDelta = clamp((-sellPressure + arbPressure) / (10 + 18 * depthImpact), -0.08, 0.08);
        const stablePriceNext = clamp(s.stablePrice + stableDelta, 0.05, 1.2);

        // Shocks slowly decay/recover.
        const whaleSellNext = s.whaleSell * 0.55;
        const oracleQualityNext = clamp(s.oracleQuality + 0.06, 0.25, 1);

        const next: CollateralizedState = {
          ...s,
          t: s.t + 1,
          stablePrice: stablePriceNext,
          collateralIndex: collateralIndexNext,
          collateralValue: collateralValueNext,
          confidence: confidenceNext,
          liquidityDepth: liquidityDepthNext,
          oracleQuality: oracleQualityNext,
          whaleSell: whaleSellNext,
          liquidationPressure,
          lastTick: {
            cr,
            equity: collateralValueNext - s.debt,
            liquidationTrigger,
            liquidationPressure,
            collateralSellUsd,
            collateralImpact,
            panicSell,
            arbPressure,
            stableDelta,
            collateralDelta: collateralIndexNext / s.collateralIndex - 1
          }
        };

        updateQuestsFromStep(stablePriceNext, {
          liquidations: liquidationPressure > 0.2,
          confidenceNext,
          equityNext: collateralValueNext - s.debt
        });

        // Events
        if (liquidationPressure > 0.05 && s.liquidationPressure <= 0.05) {
          addEvent(
            'warn',
            tr('Liquidations begin as CR falls below {{thr}}%', { thr: (liquidationTrigger * 100).toFixed(0) }),
            next.t
          );
          setWhy(
            tr('Liquidations started'),
            tr(
              'CR fell to {{cr}} (threshold {{thr}}). Liquidation pressure {{p}} sells about ${{sell}} collateral per step, which can push collateral prices down and worsen CR.',
              {
                cr: fmt(cr, 2),
                thr: fmt(liquidationTrigger, 2),
                p: pct(liquidationPressure, 0),
                sell: fmt(collateralSellUsd, 0)
              }
            )
          );
        }

        if (outcomeLabel(stablePriceNext) === 'collapse' && s.stablePrice >= 0.8) {
          addEvent('error', tr('Stablecoin enters collapse region (< $0.80).'), next.t);
          setWhy(
            tr('Collapse feedback loop'),
            tr(
              'Confidence dropped to {{conf}}, liquidity depth to {{depth}}. With shallow liquidity, the same sells cause larger slippage, which further hurts confidence and accelerates the depeg.',
              {
                conf: fmt(confidenceNext, 2),
                depth: fmt(liquidityDepthNext, 2)
              }
            )
          );
        } else if (Math.abs(stablePriceNext - 1) > 0.02 && Math.abs(s.stablePrice - 1) <= 0.02) {
          addEvent('warn', tr('Peg breaks: price moves away from $1.'), next.t);
          setWhy(
            tr('Why the peg broke'),
            tr(
              'Sell pressure hit a shallow pool (depth {{depth}}) while confidence was {{conf}}. Arbitrage is weaker when confidence is low (arb efficiency {{arb}}), so price can move away from $1 even if solvency still looks okay.',
              {
                depth: fmt(liquidityDepthNext, 2),
                conf: fmt(confidenceNext, 2),
                arb: fmt(params.arbEfficiency, 1)
              }
            )
          );
        } else if (Math.abs(stablePriceNext - 1) <= 0.01 && Math.abs(s.stablePrice - 1) > 0.01) {
          addEvent('success', tr('Peg recovers near $1.'), next.t);
          setWhy(
            tr('Why the peg recovered'),
            tr(
              'Arbitrage regained strength as confidence improved ({{conf}}) and depth stabilized ({{depth}}). With arb efficiency {{arb}}, trades pull price back toward $1.',
              {
                conf: fmt(confidenceNext, 2),
                depth: fmt(liquidityDepthNext, 2),
                arb: fmt(params.arbEfficiency, 1)
              }
            )
          );
        }

        // Solvency threshold: equity < 0 means the system is fundamentally undercollateralized.
        const equityNext = collateralValueNext - s.debt;
        if (equityNext < 0 && s.lastTick.equity >= 0) {
          addEvent('error', tr('Insolvency: collateral value falls below total debt (equity < 0).'), next.t);
          setWhy(
            tr('Insolvency (fundamental failure)'),
            tr(
              'Collateral value (${{coll}}) fell below debt (${{debt}}), so equity is negative (${{eq}}). That means there is not enough backing for $1 redemptions even if market price bounces.',
              {
                coll: fmt(collateralValueNext, 0),
                debt: fmt(s.debt, 0),
                eq: fmt(equityNext, 0)
              }
            )
          );
        } else if (equityNext < s.debt * 0.1 && s.lastTick.equity >= s.debt * 0.1) {
          addEvent('warn', tr('Thin buffer: equity is low, so small shocks can threaten solvency.'), next.t);
          setWhy(
            tr('Thin solvency buffer'),
            tr(
              'Equity is low (${{eq}} vs debt ${{debt}}). The system is still solvent, but small additional shocks can flip equity negative and trigger insolvency.',
              {
                eq: fmt(equityNext, 0),
                debt: fmt(s.debt, 0)
              }
            )
          );
        }

        setSeries((prev) => [...prev, { t: next.t, stable: stablePriceNext, ref: collateralIndexNext }].slice(-60));
        return next;
      });

      return;
    }

    // Algorithmic / Terra-style
    setAlgo((s) => {
      const priceStress = Math.max(0, 1 - s.stablePrice);

      // Yield support and confidence reduce sell pressure.
      const sentiment = clamp((s.confidence + s.yieldSupport) / 2, 0, 1);

      // Whale sells stable into AMMs.
      const sellPressure = s.whaleSell + (1 - sentiment) * 180;

      // Keep AMM depth in sync with advanced params for algorithmic mode.
      const ammDepth = params.ammDepth;

      // Price impact is stronger when AMM depth is low.
      const sellDelta = -sellPressure / (1400 + 2000 * ammDepth);

      // Redemption arbitrage: burn stable for $1 of LUNA.
      const redemptionCap = s.stableSupply * params.redemptionCap;
      const redemption = clamp(
        priceStress * params.redemptionIntensity * s.stableSupply * (0.4 + 0.6 * s.confidence),
        0,
        redemptionCap
      );
      const lunaMinted = redemption / Math.max(0.5, s.lunaPrice);

      const stableSupplyNext = Math.max(1, s.stableSupply - redemption);
      const lunaSupplyNext = s.lunaSupply + lunaMinted;

      // LUNA price becomes reflexive: minting + low confidence crushes it.
      const supplyInflation = lunaMinted / Math.max(1e-6, s.lunaSupply);
      const lunaDeltaPct = clamp(-(supplyInflation * params.reflexivityK + (1 - s.confidence) * 0.06), -0.9, 0.05);
      const lunaPriceNext = clamp(s.lunaPrice * (1 + lunaDeltaPct), 0.02, 200);

      // Stable price depends on selling + (weakening) redemption backstop.
      const backstopStrength = clamp((lunaPriceNext / 80) * s.confidence, 0, 1);
      const redeemSupport = backstopStrength * (redemption / Math.max(1, s.stableSupply)) * 0.9;
      const stableDelta = clamp(sellDelta + redeemSupport, -0.25, 0.12);
      const stablePriceNext = clamp(s.stablePrice + stableDelta, 0.01, 1.1);

      // Confidence decays when stable deviates and when LUNA collapses.
      const confDelta = clamp(
        -Math.abs(stablePriceNext - 1) * 0.25 - Math.max(0, -lunaDeltaPct) * 0.05 + 0.01,
        -0.2,
        0.04
      );
      const confidenceNext = clamp(s.confidence + confDelta, 0, 1);

      const whaleSellNext = s.whaleSell * 0.6;
      const yieldSupportNext = clamp(s.yieldSupport - Math.abs(stablePriceNext - 1) * 0.02, 0, 1);

      const next: AlgorithmicState = {
        ...s,
        t: s.t + 1,
        stablePrice: stablePriceNext,
        lunaPrice: lunaPriceNext,
        stableSupply: stableSupplyNext,
        lunaSupply: lunaSupplyNext,
        ammDepth,
        confidence: confidenceNext,
        yieldSupport: yieldSupportNext,
        whaleSell: whaleSellNext,
        lastTick: {
          sentiment,
          sellPressure,
          sellDelta,
          priceStress,
          redemption,
          redemptionCap,
          lunaMinted,
          supplyInflation,
          lunaDeltaPct,
          lunaPriceNext,
          backstopStrength,
          redeemSupport,
          stableDelta
        }
      };

      updateQuestsFromStep(stablePriceNext, {
        redeemed: redemption > 0.01,
        confidenceNext
      });

      if (stablePriceNext < 0.97 && s.stablePrice >= 0.97) {
        addEvent('warn', tr('Early stress: stablecoin dips below $0.97.'), next.t);
        setWhy(
          tr('Early stress'),
          tr(
            'Price dipped below peg as sell pressure {{sell}} hit AMM depth {{depth}}. Redemptions burn {{redeem}} stable this step. Backstop strength is {{bs}} (reflexivity {{k}}).',
            {
              sell: fmt(sellPressure, 0),
              depth: fmt(ammDepth, 2),
              redeem: fmt(redemption, 0),
              bs: fmt(backstopStrength, 2),
              k: fmt(params.reflexivityK, 2)
            }
          )
        );
      }
      if (stablePriceNext < 0.8 && s.stablePrice >= 0.8) {
        addEvent('error', tr('Panic zone: stablecoin falls below $0.80.'), next.t);
        setWhy(
          tr('Panic zone'),
          tr(
            'Redemptions accelerate ({{redeem}} stable burned), minting {{mint}} backstop tokens. Supply inflation {{infl}} + low confidence {{conf}} pushes the backstop price down, weakening the $1 redemption promise.',
            {
              redeem: fmt(redemption, 0),
              mint: fmt(lunaMinted, 0),
              infl: pct(supplyInflation, 1),
              conf: fmt(confidenceNext, 2)
            }
          )
        );
      }
      if (stablePriceNext < 0.05 && s.stablePrice >= 0.05) {
        addEvent('error', tr('Failure: stablecoin collapses (< $0.05).'), next.t);
        setWhy(
          tr('Reflexive collapse'),
          tr(
            'The backstop token price fell to ${{luna}} (Δ {{d}}). Backstop strength {{bs}} means redemptions no longer create meaningful support, so the stablecoin can spiral down even as supply is burned.',
            {
              luna: fmt(lunaPriceNext, 2),
              d: pct(lunaDeltaPct, 1),
              bs: fmt(backstopStrength, 2)
            }
          )
        );
      }

      // Backstop credibility thresholds (teaching): when redemptions become less meaningful.
      if (backstopStrength < 0.3 && s.lastTick.backstopStrength >= 0.3) {
        addEvent('error', tr('Backstop failure: redemptions lose credibility as the backstop token collapses.'), next.t);
        setWhy(
          tr('Backstop failure'),
          tr(
            'Backstop strength fell to {{bs}}. With a weak backstop, minting more backstop tokens (supply inflation {{infl}}) does not translate into credible $1 support, so confidence breaks.',
            {
              bs: fmt(backstopStrength, 2),
              infl: pct(supplyInflation, 1)
            }
          )
        );
      } else if (backstopStrength < 0.6 && s.lastTick.backstopStrength >= 0.6) {
        addEvent('warn', tr('Backstop weakening: redemptions still work mechanically, but market confidence deteriorates.'), next.t);
        setWhy(
          tr('Backstop weakening'),
          tr(
            'Backstop strength fell to {{bs}}. Redemptions still function, but markets price the risk that future redemptions will be less valuable as backstop supply inflates.',
            {
              bs: fmt(backstopStrength, 2)
            }
          )
        );
      }

      setSeries((prev) => [...prev, { t: next.t, stable: stablePriceNext, ref: lunaPriceNext }].slice(-60));
      return next;
    });

  }

  function runSteps(n: number) {
    for (let i = 0; i < n; i++) stepOnce();
  }

  // Keep a ref to the latest stepOnce closure for interval-based auto-run.
  useEffect(() => {
    stepOnceRef.current = stepOnce;
  });

  // Auto-run loop.
  useEffect(() => {
    if (!isAutoRunning) {
      if (autoRunIntervalRef.current != null) {
        window.clearInterval(autoRunIntervalRef.current);
        autoRunIntervalRef.current = null;
      }
      return;
    }

    const delayMs = autoRunSpeed === 2 ? 250 : 500;
    autoRunIntervalRef.current = window.setInterval(() => {
      stepOnceRef.current();
    }, delayMs);

    return () => {
      if (autoRunIntervalRef.current != null) {
        window.clearInterval(autoRunIntervalRef.current);
        autoRunIntervalRef.current = null;
      }
    };
  }, [isAutoRunning, autoRunSpeed]);

  // Hint: highlight Play button briefly on first load.
  useEffect(() => {
    const t = window.setTimeout(() => setShowPlayHint(false), 10_000);
    return () => window.clearTimeout(t);
  }, []);

  // Stop auto-run when closing the maximized modal.
  const prevChartMaximizedRef = useRef(chartMaximized);
  useEffect(() => {
    if (prevChartMaximizedRef.current && !chartMaximized) setIsAutoRunning(false);
    prevChartMaximizedRef.current = chartMaximized;
  }, [chartMaximized]);

  const stableNow = scenario === 'collateralized' ? collat.stablePrice : algo.stablePrice;
  const outcome = outcomeLabel(stableNow);

  return (
    //<>
      <div className="w-full max-w-7xl mx-auto p-6 text-white">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          {/* Title */}
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 min-w-0">
              <Droplets className="text-blue-300 shrink-0" />
              <span className="min-w-0 truncate whitespace-nowrap" title={tr('Stablecoin Depeg Cascade Simulation')}>
                {tr('Stablecoin Depeg Cascade Simulation')}
              </span>
            </h1>
          </div>

          {/* Subtitle + actions */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <p
              className="text-slate-300 min-w-0"
              title={tr(
                'Apply shocks and watch how liquidity, confidence, and feedback loops can break (or restore) a stablecoin peg.'
              )}
            >
              {tr('Apply shocks and watch how liquidity, confidence, and feedback loops can break (or restore) a stablecoin peg.')}
            </p>

            <div className="shrink-0 flex flex-wrap items-center gap-2 justify-start lg:justify-end">
              <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
            >
              <Gauge size={16} />
              {showAdvanced ? tr('Hide advanced') : tr('Show advanced')}
            </button>

            <button
              type="button"
              onClick={() => setShowFormulas((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
            >
              <BarChart3 size={16} />
              {showFormulas ? tr('Hide formulas') : tr('Show formulas')}
            </button>

            <button
              type="button"
              onClick={() => reset(undefined, { resetAdvanced: true })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
            >
              <RefreshCw size={16} />
              {tr('Reset')}
            </button>
          </div>
          </div>

          {/* 60-second tour + What happened */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[280px_1fr] gap-4 items-start">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 w-full">
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              {tr('60-second tour')}
              <Tooltip
                widthClassName="w-[520px]"
                text={tr(
                  'Stablecoins look like “$1” in calm markets. This tour shows which hidden parts keep the peg stable — and how cascades happen when those parts fail.'
                )}
              />
            </div>
            <ol className="mt-2 text-sm text-slate-300 space-y-2 list-decimal pl-5">
              <li>
                {tr('Pick a scenario (Collateralized or Algorithmic).')}{' '}
                <Tooltip
                  text={tr(
                    'Collateralized stablecoins rely on overcollateralization and liquidations. Algorithmic stablecoins rely on tokenomics and reflexive market confidence.'
                  )}
                />
              </li>
              <li>
                {tr('Apply a shock (e.g., collateral crash or whale sale).')}{' '}
                <Tooltip
                  text={tr(
                    'Shocks create selling pressure and reduce confidence, which can drain liquidity and amplify price moves.'
                  )}
                />
              </li>
              <li>
                {tr('Click Step a few times and watch the chart + event log narrate the cascade.')}{' '}
                <Tooltip
                  text={tr(
                    'Try stepping 5–10 times to see whether the system recovers, temporarily depegs, or collapses.'
                  )}
                />
              </li>
            </ol>
          </div>

          {whyBanner ? (
            <div className="rounded-xl border border-amber-700/60 bg-amber-950/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-amber-200">{tr('Why did this happen?')}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100 truncate">{whyBanner.title}</div>
                  <div className="mt-1 text-sm text-slate-200">{whyBanner.body}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setWhyBanner(null)}
                  className="shrink-0 px-2 py-1 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                >
                  {tr('Dismiss')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Top stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`bg-slate-800 rounded-lg p-4 border border-slate-700 ${kpiGlowClass('price')}`}>
            <div className="flex items-center gap-2 mb-1">
              <Gauge size={18} className="text-emerald-300" />
              <span className="text-xs text-slate-400">
                {tr('Stablecoin price')}
                <Tooltip text={defineGlossary('Stablecoin Price')} />
              </span>
            </div>
            <div className={`text-2xl font-bold ${stablePriceColor(stableNow)}`}>${fmt(stableNow, 3)}</div>
            <div className="text-xs text-slate-500 mt-1">
              {tr('Outcome')}: <span className="font-semibold">{tr(outcome)}</span>
            </div>
          </div>

          <div className={`bg-slate-800 rounded-lg p-4 border border-slate-700 ${kpiGlowClass('confidence')}`}>
            <div className="flex items-center gap-2 mb-1">
              <img
                src={confidenceIconUrl}
                alt={tr('Confidence')}
                width={18}
                height={18}
                className="opacity-90"
              />
              <span className="text-xs text-slate-400">
                {tr('Confidence')}
                <Tooltip text={defineGlossary('Confidence')} />
              </span>
            </div>
            <div className="text-2xl font-bold">
              {pct(scenario === 'collateralized' ? collat.confidence : algo.confidence, 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1">{tr('t={{t}}', { t: currentT })}</div>
          </div>

          <div className={`bg-slate-800 rounded-lg p-4 border border-slate-700 ${kpiGlowClass('solvency')}`}>
            <div className="flex items-center gap-2 mb-1">
              {scenario === 'collateralized' ? (
                <img
                  src={solvencyIconUrl}
                  alt={tr('Solvency (equity)')}
                  width={27}
                  height={27}
                  className="opacity-90"
                />
              ) : (
                <TrendingDown size={18} className="text-purple-300" />
              )}
              <span className="text-xs text-slate-400">
                {scenario === 'collateralized' ? tr('Solvency (equity)') : tr('Backstop strength')}
                {scenario === 'collateralized' ? (
                  <Tooltip text={tr('Equity = collateral value − total stablecoin debt. If equity < 0, the system is insolvent (not enough backing for $1 redemptions).')} />
                ) : (
                  <Tooltip text={tr('A proxy for how credible $1 redemptions are. If it weakens, the reflexive backstop is less able to defend the peg.')} />
                )}
              </span>
            </div>
            <div className="text-2xl font-bold">
              {scenario === 'collateralized'
                ? `$${fmt(collat.lastTick.equity, 2)}`
                : pct(algo.lastTick.backstopStrength, 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {scenario === 'collateralized'
                ? tr('Equity = collateral value − debt')
                : tr('Proxy for how credible $1 redemptions are')}
            </div>
          </div>

          <div className={`bg-slate-800 rounded-lg p-4 border border-slate-700 ${kpiGlowClass('cr')}`}>
            <div className="flex items-center gap-2 mb-1">
              {scenario === 'collateralized' ? (
                <img
                  src={collateralRatioIconUrl}
                  alt={tr('Collateral ratio')}
                  width={18}
                  height={18}
                  className="opacity-90"
                />
              ) : (
                <TrendingUp size={18} className="text-yellow-300" />
              )}
              <span className="text-xs text-slate-400">
                {scenario === 'collateralized' ? tr('Collateral ratio') : tr('Supply inflation')}
                {scenario === 'collateralized' ? (
                  <Tooltip text={tr('CR = collateral value / debt. If CR falls below the liquidation threshold, vaults are liquidated and collateral is sold into the market.')} />
                ) : (
                  <Tooltip text={tr('Minted backstop tokens / prior supply (per step). High inflation weakens the backstop price and can accelerate a death spiral.')} />
                )}
              </span>
            </div>
            <div className="text-2xl font-bold">
              {scenario === 'collateralized' ? pct(computeCR(collat), 0) : pct(algo.lastTick.supplyInflation, 1)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {scenario === 'collateralized'
                ? tr('CR = collateral value / debt')
                : tr('Minted LUNA / prior supply (per step)')}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[280px_1fr] gap-6">
          {/* Controls */}
          <div
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
          >
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldAlert size={18} className="text-blue-300" />
              {tr('Scenario & shocks')}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => reset('collateralized')}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold whitespace-nowrap ${
                  scenario === 'collateralized'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                    : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tr('Collateralized')}
              </button>
              <button
                type="button"
                onClick={() => reset('algorithmic')}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold whitespace-nowrap ${
                  scenario === 'algorithmic'
                    ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                    : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tr('Algorithmic')}
              </button>
            </div>

            <div className="mt-4 text-xs font-semibold text-slate-400">{tr('Apply shock')}</div>

            {scenario === 'collateralized' ? (
              <div className="mt-2 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => applyShock('collateral_crash')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-300" />
                    {tr('Collateral crash')}
                  </span>
                  <TooltipInButton text={tr('A drop in collateral value pushes vaults below safe collateral ratios, triggering liquidations.')} />
                </button>

                <button
                  type="button"
                  onClick={() => applyShock('liquidity_drain')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <TrendingDown size={16} className="text-purple-300" />
                    {tr('Liquidity drain')}
                  </span>
                  <TooltipInButton text={tr('Less pool depth means more slippage: smaller sells move the price more.')} />
                </button>

                <button
                  type="button"
                  onClick={() => applyShock('whale_exit')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <WhaleIcon size={16} className="text-slate-200" />
                    {tr('Whale exit')}
                  </span>
                  <TooltipInButton text={tr('A large holder sells stablecoin into AMMs, creating imbalance and pushing price below $1.')} />
                </button>

                <button
                  type="button"
                  onClick={() => applyShock('oracle_failure')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Eye size={16} className="text-red-300" />
                    {tr('Oracle failure')}
                  </span>
                  <TooltipInButton text={tr('Bad or delayed price feeds can trigger wrong liquidations and reduce arbitrage confidence.')} />
                </button>

                <button
                  type="button"
                  onClick={() => applyShock('confidence_shock')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <img src={confidenceIconUrl} alt={tr('Confidence')} width={16} height={16} className="opacity-90" />
                    {tr('Confidence shock')}
                  </span>
                  <TooltipInButton text={tr('Rumors/hacks/news can cause panic selling and liquidity withdrawal even without a fundamental change.')} />
                </button>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => applyShock('yield_withdrawal')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <TrendingDown size={16} className="text-amber-300" />
                    {tr('Yield withdrawal')}
                  </span>
                  <TooltipInButton text={tr('Demand evaporates when subsidized yields disappear. Lower demand makes the peg fragile.')} />
                </button>

                <button
                  type="button"
                  onClick={() => applyShock('whale_sale')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Activity size={16} className="text-red-300" />
                    {tr('Whale sale')}
                  </span>
                  <TooltipInButton text={tr('Large stablecoin sells push price below $1, triggering redemptions into LUNA.')} />
                </button>

                <button
                  type="button"
                  onClick={() => applyShock('death_spiral')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-300" />
                    {tr('Start death spiral')}
                  </span>
                  <TooltipInButton text={tr('Combines low confidence, low yield support, and heavy selling — a recipe for reflexive collapse.')} />
                </button>
              </div>
            )}

            {showAdvanced ? (
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                <div className="text-sm font-semibold text-slate-200 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <Gauge size={16} className="text-blue-300" />
                    {tr('Advanced settings')}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setParams({
                        liquidationTrigger: 1.5,
                        arbEfficiency: 10,
                        liquidationSeverity: 0.06,
                        collateralImpactK: 0.08,
                        redemptionIntensity: 0.08,
                        redemptionCap: 0.12,
                        reflexivityK: 2.8,
                        ammDepth: 1.0
                      })
                    }
                    className="text-xs text-slate-300 underline hover:text-slate-100"
                  >
                    {tr('Reset params')}
                  </button>
                </div>

                <div className="mt-3 space-y-3 text-xs text-slate-200">
                  {scenario === 'collateralized' ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between">
                          <span>
                            {tr('Liquidation threshold')}
                            <Tooltip text={tr('The CR level below which liquidations begin (e.g., 150%).')} />
                          </span>
                          <span
                            className={`font-mono ${severityTextClass(
                              severityFromRange(params.liquidationTrigger, 1.2, 2.0)
                            )}`}
                          >
                            {pct(params.liquidationTrigger, 0)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1.2}
                          max={2.0}
                          step={0.01}
                          value={params.liquidationTrigger}
                          onChange={(e) => setParams((p) => ({ ...p, liquidationTrigger: Number(e.target.value) }))}
                          className={`w-full ${severityColorClass(
                            severityFromRange(params.liquidationTrigger, 1.2, 2.0)
                          )}`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span>
                            {tr('Arbitrage efficiency')}
                            <Tooltip text={tr('Higher means faster pull back toward $1 when confidence is high.')} />
                          </span>
                          <span
                            className={`font-mono ${severityTextClass(severityFromRange(params.arbEfficiency, 2, 18, { invert: true }))}`}
                          >
                            {fmt(params.arbEfficiency, 1)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={18}
                          step={0.5}
                          value={params.arbEfficiency}
                          onChange={(e) => setParams((p) => ({ ...p, arbEfficiency: Number(e.target.value) }))}
                          className={`w-full ${severityColorClass(
                            severityFromRange(params.arbEfficiency, 2, 18, { invert: true })
                          )}`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span>
                            {tr('Liquidation severity')}
                            <Tooltip text={tr('How much collateral is sold per tick under full liquidation pressure.')} />
                          </span>
                          <span
                            className={`font-mono ${severityTextClass(severityFromRange(params.liquidationSeverity, 0.01, 0.15))}`}
                          >
                            {pct(params.liquidationSeverity, 1)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.01}
                          max={0.15}
                          step={0.005}
                          value={params.liquidationSeverity}
                          onChange={(e) => setParams((p) => ({ ...p, liquidationSeverity: Number(e.target.value) }))}
                          className={`w-full ${severityColorClass(
                            severityFromRange(params.liquidationSeverity, 0.01, 0.15)
                          )}`}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center justify-between">
                          <span>
                            {tr('AMM depth')}
                            <Tooltip text={tr('Lower depth increases price impact of sells.')} />
                          </span>
                          <span
                            className={`font-mono ${severityTextClass(severityFromRange(params.ammDepth, 0.1, 2.0, { invert: true }))}`}
                          >
                            {fmt(params.ammDepth, 2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.1}
                          max={2.0}
                          step={0.05}
                          value={params.ammDepth}
                          onChange={(e) => setParams((p) => ({ ...p, ammDepth: Number(e.target.value) }))}
                          className={`w-full ${severityColorClass(severityFromRange(params.ammDepth, 0.1, 2.0, { invert: true }))}`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span>
                            {tr('Redemption intensity')}
                            <Tooltip text={tr('How aggressively users redeem stable for $1 of LUNA when below peg.')} />
                          </span>
                          <span
                            className={`font-mono ${severityTextClass(severityFromRange(params.redemptionIntensity, 0.02, 0.2))}`}
                          >
                            {fmt(params.redemptionIntensity, 3)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.02}
                          max={0.2}
                          step={0.005}
                          value={params.redemptionIntensity}
                          onChange={(e) => setParams((p) => ({ ...p, redemptionIntensity: Number(e.target.value) }))}
                          className={`w-full ${severityColorClass(severityFromRange(params.redemptionIntensity, 0.02, 0.2))}`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span>
                            {tr('Reflexivity multiplier')}
                            <Tooltip text={tr('How strongly supply inflation hits the backstop token price (LUNA).')} />
                          </span>
                          <span
                            className={`font-mono ${severityTextClass(severityFromRange(params.reflexivityK, 0.8, 4.0))}`}
                          >
                            {fmt(params.reflexivityK, 2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.8}
                          max={4.0}
                          step={0.05}
                          value={params.reflexivityK}
                          onChange={(e) => setParams((p) => ({ ...p, reflexivityK: Number(e.target.value) }))}
                          className={`w-full ${severityColorClass(severityFromRange(params.reflexivityK, 0.8, 4.0))}`}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-3 text-[11px] text-slate-400">
                  {tr('Changing parameters affects the next Step(s). Reset simulation to return to defaults.')}
                </div>
              </div>
            ) : null}

            <div className="mt-4 text-xs font-semibold text-slate-400">{tr('Interventions (teaching)')}</div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => applyIntervention('add_liquidity')}
                className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus size={16} className="text-emerald-300" />
                  {tr('Add liquidity')}
                </span>
                <TooltipInButton text={tr('Increase depth so the same sells cause less slippage.')} />
              </button>

              {scenario === 'collateralized' ? (
                <button
                  type="button"
                  onClick={() => applyIntervention('fix_oracle')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Wrench size={16} className="text-amber-300" />
                    {tr('Fix oracle')}
                  </span>
                  <TooltipInButton text={tr('Improve oracle quality, which increases confidence and reduces wrong liquidations.')} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => applyIntervention('restore_yield')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  {tr('Restore yield incentives')}
                  <TooltipInButton text={tr('Yield can temporarily support demand, but it is not a real collateral backstop.')} />
                </button>
              )}

              <button
                type="button"
                onClick={() => applyIntervention('backstop_buy')}
                className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <Banknote size={16} className="text-emerald-200" />
                  {tr('Backstop buy (buy stable)')}
                </span>
                <TooltipInButton text={tr('A simplified “buyer of last resort” to show how external support can help peg recovery.')} />
              </button>
            </div>

          </div>

          {/* Chart + log */}
          <div className="space-y-6 min-w-0">
            {chartMaximized ? (
              <div
                className="fixed inset-0 z-[200] bg-black/80 p-3 sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-label={tr('Maximized chart')}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setChartMaximized(false);
                }}
              >
                <div id="maximized_modal" className="h-full w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-200 truncate flex items-center gap-2">
                      <BarChart3 size={18} className="text-blue-300 shrink-0" />
                      <span className="truncate">
                        {scenario === 'collateralized' ? tr('Peg vs collateral stress') : tr('Peg vs reflexive backstop (LUNA)')}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => reset(undefined, { resetAdvanced: true })}
                        className="px-2.5 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 inline-flex items-center gap-2"
                        aria-label={tr('Reset')}
                      >
                        <RefreshCw size={18} />
                        <span className="text-xs font-semibold text-slate-200">{tr('Reset')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartMaximized(false)}
                        className="p-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
                        aria-label={tr('Close')}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-0 overflow-hidden relative">
                      {!maxControlsOpen ? (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-20">
                          <button
                            type="button"
                            onClick={() => setMaxControlsOpen(true)}
                            className="flex items-center justify-center p-2 rounded-lg border border-slate-700 bg-slate-900/90 hover:bg-slate-800"
                            aria-label={tr('Controls')}
                          >
                            <ChevronDown size={18} className="text-slate-200" />
                          </button>
                        </div>
                      ) : null}

                      {whyBanner ? (
                        <div className="absolute right-3 top-3 z-20 max-w-[480px] flex flex-col gap-2">
                          <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold text-amber-200">{tr('Why did this happen?')}</div>
                                <div className="mt-0.5 text-[11px] font-semibold text-slate-100 truncate">{whyBanner.title}</div>
                                <div className="mt-0.5 text-[11px] text-slate-200">{whyBanner.body}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setWhyBanner(null)}
                                className="shrink-0 px-1.5 py-0.5 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[10px]"
                                aria-label={tr('Dismiss')}
                              >
                                {tr('Dismiss')}
                              </button>
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                            <button
                              type="button"
                              onClick={() => setMechanicsOverlayOpen((v) => !v)}
                              className="w-full text-left"
                              aria-expanded={mechanicsOverlayOpen}
                            >
                              <div className="text-[11px] font-semibold text-slate-200 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <BarChart3 size={16} className="text-amber-300" />
                                  {tr('Mechanics breakdown (last step)')}
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-md border ${slippagePillBorderClass} bg-slate-900/30 text-[11px] text-slate-200`}>
                                    <Droplets size={14} className="text-sky-200" />
                                    <span className="text-slate-400">{tr('Depth')}</span>
                                    <span className="font-mono">{fmt(liquidityDepthNow, 2)}</span>
                                    <span className="text-slate-500">•</span>
                                    <span className="text-slate-400">{tr('Slippage')}</span>
                                    <span className={`font-mono ${slippageSeverityClass}`}>{fmt(slippageMultiplierNow, 2)}x</span>
                                  </div>

                                  <div className="text-slate-400">
                                    {mechanicsOverlayOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </div>
                                </div>
                              </div>
                            </button>

                            {mechanicsOverlayOpen ? (
                              <div className="mt-2 max-h-[45vh] overflow-auto">
                                {scenario === 'collateralized' ? (
                              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-slate-200 leading-4">
                                <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
                                  <div className="grid grid-cols-3 gap-x-2 text-slate-400">
                                    <div className="truncate whitespace-nowrap">{tr('Collateral ratio (CR)')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Liquidation pressure')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Collateral sold (USD)')}</div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-x-2 font-mono text-slate-100">
                                    <div className="whitespace-nowrap">{fmt(collat.lastTick.cr, 3)}</div>
                                    <div className="whitespace-nowrap">{fmt(collat.lastTick.liquidationPressure, 3)}</div>
                                    <div className="whitespace-nowrap">{fmt(collat.lastTick.collateralSellUsd, 2)}</div>
                                  </div>
                                </div>

                                <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
                                  <div className="grid grid-cols-3 gap-x-2 text-slate-400">
                                    <div className="truncate whitespace-nowrap">{tr('Panic sell')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Arbitrage support')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Δprice')}</div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-x-2 font-mono text-slate-100">
                                    <div className="whitespace-nowrap">{fmt(collat.lastTick.panicSell, 3)}</div>
                                    <div className="whitespace-nowrap">{fmt(collat.lastTick.arbPressure, 3)}</div>
                                    <div className="whitespace-nowrap">{fmt(collat.lastTick.stableDelta, 4)}</div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-slate-200 leading-4">
                                <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
                                  <div className="grid grid-cols-3 gap-x-2 text-slate-400">
                                    <div className="truncate whitespace-nowrap">{tr('Price stress')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Redemption')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('LUNA minted')}</div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-x-2 font-mono text-slate-100">
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.priceStress, 3)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.redemption, 2)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.lunaMinted, 3)}</div>
                                  </div>
                                </div>

                                <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
                                  <div className="grid grid-cols-3 gap-x-2 text-slate-400">
                                    <div className="truncate whitespace-nowrap">{tr('Supply inflation')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Backstop strength')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Δprice')}</div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-x-2 font-mono text-slate-100">
                                    <div className="whitespace-nowrap">{pct(algo.lastTick.supplyInflation, 2)}</div>
                                    <div className="whitespace-nowrap">{pct(algo.lastTick.backstopStrength, 0)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.stableDelta, 4)}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                      ) : null}
                        </div>
                        </div>
                      ) : null}

                      <div className={kpiGlowClass('price')}>
                      <SimpleLineChart
                      tr={tr}
                      title={scenario === 'collateralized' ? tr('Peg vs collateral stress') : tr('Peg vs reflexive backstop (LUNA)')}
                      showHeader={false}
                      colorizeNow={true}
                      footerRightExtra={
                        (() => {
                          const lastStable = series[series.length - 1]?.stable ?? 1;
                          const nowColor = stablePriceColor(lastStable);
                          return (
                            <div className="flex flex-col items-end gap-1">
                              <div className="text-right">{tr('t={{t}}', { t: currentT })}</div>


                              <div className={`flex items-center justify-end gap-2 ${kpiGlowClass('solvency')}`}>
                            {scenario === 'collateralized' ? (
                              <img src={solvencyIconUrl} alt={tr('Solvency (equity)')} width={16} height={16} className="opacity-90" />
                            ) : (
                              <TrendingDown size={16} className="text-purple-300" />
                            )}
                            <span>{scenario === 'collateralized' ? tr('Solvency (equity)') : tr('Backstop strength')}</span>
                            <span className={`font-mono ${nowColor}`}>
                              {scenario === 'collateralized'
                                ? `$${fmt(collat.lastTick.equity, 2)}`
                                : pct(algo.lastTick.backstopStrength, 0)}
                            </span>
                          </div>
                          <div className={`flex items-center justify-end gap-2 ${kpiGlowClass('confidence')}`}>
                            <img src={confidenceIconUrl} alt={tr('Confidence')} width={16} height={16} className="opacity-90" />
                            <span>{tr('Confidence')}</span>
                            <span className={`font-mono ${nowColor}`}>
                              {pct(scenario === 'collateralized' ? collat.confidence : algo.confidence, 0)}
                            </span>
                          </div>
                          <div className={`flex items-center justify-end gap-2 ${kpiGlowClass('cr')}`}>
                            {scenario === 'collateralized' ? (
                              <img src={collateralRatioIconUrl} alt={tr('Collateral ratio')} width={16} height={16} className="opacity-90" />
                            ) : (
                              <TrendingUp size={16} className="text-yellow-300" />
                            )}
                            <span>{scenario === 'collateralized' ? tr('Collateral ratio') : tr('Supply inflation')}</span>
                            <span className={`font-mono ${nowColor}`}>
                              {scenario === 'collateralized'
                                ? pct(computeCR(collat), 0)
                                : pct(algo.lastTick.supplyInflation, 1)}
                            </span>
                          </div>
                        </div>
                          );
                        })()
                      }
                      points={series}
                      markers={chartMarkers}
                      stableLabel={tr('Stablecoin price')}
                      refLabel={scenario === 'collateralized' ? tr('Collateral index') : tr('LUNA price')}
                      refIsIndex={scenario === 'collateralized'}
                      width={1100}
                      height={maxControlsOpen ? 360 : 520}
                      legendExtra={
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => stepOnce()}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
                          >
                            {tr('Step')}
                          </button>
                          <button
                            type="button"
                            onClick={() => runSteps(5)}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
                          >
                            {tr('Run 5')}
                          </button>
                          <button
                            type="button"
                            onClick={() => runSteps(10)}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
                          >
                            {tr('Run 10')}
                          </button>


                          <button
                            type="button"
                            onClick={() => {
                              setShowPlayHint(false);
                              setAutoRunSpeed(1);
                              setIsAutoRunning((v) => !(v && autoRunSpeed === 1));
                            }}
                            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap ${
                              isAutoRunning && autoRunSpeed === 1
                                ? 'bg-blue-600 border-blue-500 hover:bg-blue-700'
                                : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                            } ${showPlayHint ? 'ring-2 ring-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]' : ''}`}
                            aria-pressed={isAutoRunning && autoRunSpeed === 1}
                            aria-label={isAutoRunning && autoRunSpeed === 1 ? tr('Pause') : tr('Play')}
                          >
                            {isAutoRunning && autoRunSpeed === 1 ? <Pause size={14} /> : <Play size={14} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setAutoRunSpeed(2);
                              setIsAutoRunning((v) => !(v && autoRunSpeed === 2));
                            }}
                            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap ${
                              isAutoRunning && autoRunSpeed === 2
                                ? 'bg-blue-600 border-blue-500 hover:bg-blue-700'
                                : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                            }`}
                            aria-pressed={isAutoRunning && autoRunSpeed === 2}
                            aria-label={isAutoRunning && autoRunSpeed === 2 ? tr('Pause') : tr('Play 2x')}
                          >
                            {isAutoRunning && autoRunSpeed === 2 ? <Pause size={14} /> : <FastForward size={14} />}
                            <span className="text-[10px] font-bold">2x</span>
                          </button>
                        </span>
                      }
                    />

                    </div>
                    </div>

                    {/* Scenario, shocks & interventions (horizontal layout in maximized mode) */}
                    {maxControlsOpen ? (
                      <div className="shrink-0 mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 max-h-[42vh] overflow-auto" id="controls_section">
                        <button
                          type="button"
                          onClick={() => setMaxControlsOpen(false)}
                          className="w-full flex items-center justify-between gap-3"
                          aria-expanded={true}
                          aria-label={tr('Controls')}
                        >
                          <div className="text-xs font-semibold text-slate-200">{tr('Controls')}</div>
                          <div className="text-slate-400">
                            <ChevronUp size={18} />
                          </div>
                        </button>

                        <>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-400">{tr('Scenario')}:</span>
                              <button
                                type="button"
                                onClick={() => reset('collateralized')}
                                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                                  scenario === 'collateralized'
                                    ? 'bg-blue-600 border-blue-500'
                                    : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                {tr('Collateralized')}
                              </button>
                              <button
                                type="button"
                                onClick={() => reset('algorithmic')}
                                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                                  scenario === 'algorithmic'
                                    ? 'bg-blue-600 border-blue-500'
                                    : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                {tr('Algorithmic')}
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 xl:grid-cols-[1fr_1fr_1.4fr] gap-3">
                        <div>
                          <div className="text-xs text-slate-500 mb-2">{tr('Shocks')}</div>
                          <div className="flex flex-wrap gap-2">
                            {scenario === 'collateralized' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => applyShock('collateral_crash')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <TrendingDown size={14} className="text-red-300" />
                                  {tr('Collateral crash')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyShock('liquidity_drain')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Droplets size={14} className="text-sky-200" />
                                  {tr('Liquidity drain')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyShock('whale_exit')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <WhaleIcon size={14} className="text-slate-200" />
                                  {tr('Whale exit')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyShock('oracle_failure')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Eye size={14} className="text-red-300" />
                                  {tr('Oracle failure')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyShock('confidence_shock')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <img src={confidenceIconUrl} alt={tr('Confidence')} width={14} height={14} className="opacity-90" />
                                  {tr('Confidence shock')}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => applyShock('yield_withdrawal')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Gauge size={14} className="text-slate-200" />
                                  {tr('Yield withdrawal')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyShock('whale_sale')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <TrendingDown size={14} className="text-rose-200" />
                                  {tr('Whale sale')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyShock('death_spiral')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <AlertTriangle size={14} className="text-red-300" />
                                  {tr('Death spiral')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-slate-500 mb-2">{tr('Interventions')}</div>
                          <div className="flex flex-wrap gap-2">
                            {scenario === 'collateralized' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => applyIntervention('add_liquidity')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Plus size={14} className="text-emerald-300" />
                                  {tr('Add liquidity')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyIntervention('fix_oracle')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Wrench size={14} className="text-amber-300" />
                                  {tr('Fix oracle')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyIntervention('backstop_buy')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Banknote size={14} className="text-emerald-200" />
                                  {tr('Backstop buy')}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => applyIntervention('add_liquidity')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Plus size={14} className="text-emerald-300" />
                                  {tr('Add liquidity')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyIntervention('restore_yield')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <TrendingUp size={14} className="text-blue-200" />
                                  {tr('Restore yield')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyIntervention('backstop_buy')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Banknote size={14} className="text-emerald-200" />
                                  {tr('Backstop buy')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Advanced (maximized mode) */}
                        <div>
                          <div className="text-xs text-slate-500 mb-2">{tr('Advanced')}</div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {scenario === 'collateralized' ? (
                              <>
                                <div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                                    <span className="whitespace-nowrap">{tr('Liquidation threshold')}</span>
                                    <span
                                      className={`font-mono ${severityTextClass(
                                        severityFromRange(params.liquidationTrigger, 1.2, 2.0)
                                      )}`}
                                    >
                                      {pct(params.liquidationTrigger, 0)}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={1.2}
                                    max={2.0}
                                    step={0.01}
                                    value={params.liquidationTrigger}
                                    onChange={(e) =>
                                      setParams((p) => ({ ...p, liquidationTrigger: Number(e.target.value) }))
                                    }
                                    className={`w-full h-1.5 ${severityColorClass(
                                      severityFromRange(params.liquidationTrigger, 1.2, 2.0)
                                    )}`}
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                                    <span className="whitespace-nowrap">{tr('Arbitrage efficiency')}</span>
                                    <span
                                      className={`font-mono ${severityTextClass(
                                        severityFromRange(params.arbEfficiency, 2, 18, { invert: true })
                                      )}`}
                                    >
                                      {fmt(params.arbEfficiency, 1)}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={2}
                                    max={18}
                                    step={0.5}
                                    value={params.arbEfficiency}
                                    onChange={(e) => setParams((p) => ({ ...p, arbEfficiency: Number(e.target.value) }))}
                                    className={`w-full h-1.5 ${severityColorClass(
                                      severityFromRange(params.arbEfficiency, 2, 18, { invert: true })
                                    )}`}
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                                    <span className="whitespace-nowrap">{tr('Liquidation severity')}</span>
                                    <span
                                      className={`font-mono ${severityTextClass(
                                        severityFromRange(params.liquidationSeverity, 0.01, 0.15)
                                      )}`}
                                    >
                                      {pct(params.liquidationSeverity, 1)}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0.01}
                                    max={0.15}
                                    step={0.005}
                                    value={params.liquidationSeverity}
                                    onChange={(e) =>
                                      setParams((p) => ({ ...p, liquidationSeverity: Number(e.target.value) }))
                                    }
                                    className={`w-full h-1.5 ${severityColorClass(
                                      severityFromRange(params.liquidationSeverity, 0.01, 0.15)
                                    )}`}
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                                    <span className="whitespace-nowrap">{tr('AMM depth')}</span>
                                    <span
                                      className={`font-mono ${severityTextClass(
                                        severityFromRange(params.ammDepth, 0.1, 2.0, { invert: true })
                                      )}`}
                                    >
                                      {fmt(params.ammDepth, 2)}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0.1}
                                    max={2.0}
                                    step={0.05}
                                    value={params.ammDepth}
                                    onChange={(e) => setParams((p) => ({ ...p, ammDepth: Number(e.target.value) }))}
                                    className={`w-full h-1.5 ${severityColorClass(
                                      severityFromRange(params.ammDepth, 0.1, 2.0, { invert: true })
                                    )}`}
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                                    <span className="whitespace-nowrap">{tr('Redemption intensity')}</span>
                                    <span
                                      className={`font-mono ${severityTextClass(
                                        severityFromRange(params.redemptionIntensity, 0.02, 0.2)
                                      )}`}
                                    >
                                      {fmt(params.redemptionIntensity, 3)}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0.02}
                                    max={0.2}
                                    step={0.005}
                                    value={params.redemptionIntensity}
                                    onChange={(e) =>
                                      setParams((p) => ({ ...p, redemptionIntensity: Number(e.target.value) }))
                                    }
                                    className={`w-full h-1.5 ${severityColorClass(
                                      severityFromRange(params.redemptionIntensity, 0.02, 0.2)
                                    )}`}
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                                    <span className="whitespace-nowrap">{tr('Reflexivity')}</span>
                                    <span
                                      className={`font-mono ${severityTextClass(
                                        severityFromRange(params.reflexivityK, 0.8, 4.0)
                                      )}`}
                                    >
                                      {fmt(params.reflexivityK, 2)}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0.8}
                                    max={4.0}
                                    step={0.05}
                                    value={params.reflexivityK}
                                    onChange={(e) => setParams((p) => ({ ...p, reflexivityK: Number(e.target.value) }))}
                                    className={`w-full h-1.5 ${severityColorClass(
                                      severityFromRange(params.reflexivityK, 0.8, 4.0)
                                    )}`}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  </div>
                ) : null}
              </div>
                </div>
              </div>
            ) : null}
            {showFormulas ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <BarChart3 size={18} className="text-amber-300" />
                    {tr('Mechanics breakdown (last step)')}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border ${slippagePillBorderClass} bg-slate-900/30 text-[11px] text-slate-200 ${kpiGlowClass('liquidity')}`}>
                      <Droplets size={14} className="text-sky-200" />
                      <span className="text-slate-400">{tr('Depth')}</span>
                      <span className="font-mono">{fmt(liquidityDepthNow, 2)}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">{tr('Slippage')}</span>
                      <span className={`font-mono ${slippageSeverityClass}`}>{fmt(slippageMultiplierNow, 2)}x</span>
                    </div>

                    {scenario === 'collateralized' ? (
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/30 text-[11px] text-slate-200 ${kpiGlowClass('oracle')}`}>
                        <span className="text-slate-400">{tr('Oracle')}</span>
                        <span className="font-mono">{fmt(oracleQualityNow ?? 0, 2)}</span>
                      </div>
                    ) : (
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/30 text-[11px] text-slate-200 ${kpiGlowClass('yield')}`}>
                        <span className="text-slate-400">{tr('Yield')}</span>
                        <span className="font-mono">{fmt(yieldSupportNow ?? 0, 2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {scenario === 'collateralized' ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-200">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                      <div className="text-slate-400 inline-flex items-center gap-2">
                        {tr('Collateral ratio (CR)')}
                        <Tooltip text={tr('Collateral ratio = collateral value / debt. If it falls below the liquidation threshold, liquidations begin.')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.cr, 3)}</div>
                      <div className="mt-2 text-slate-400 inline-flex items-center gap-2">
                        {tr('Liquidation pressure')}
                        <Tooltip text={tr('0..1 measure of how far below the liquidation threshold the system is. Drives forced collateral selling.')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.liquidationPressure, 3)}</div>
                      <div className="mt-2 text-slate-400 inline-flex items-center gap-2">
                        {tr('Collateral sold (USD)')}
                        <Tooltip text={tr('USD value of collateral sold this step due to liquidations. More selling pushes collateral price down.')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.collateralSellUsd, 2)}</div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                      <div className="text-slate-400 inline-flex items-center gap-2">
                        {tr('Panic sell')}
                        <Tooltip text={tr('Selling pressure driven by low confidence and/or oracle stress (not necessarily liquidations).')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.panicSell, 3)}</div>
                      <div className="mt-2 text-slate-400 inline-flex items-center gap-2">
                        {tr('Arbitrage support')}
                        <Tooltip text={tr('Buy pressure from arbitrageurs when price deviates from $1. Stronger with higher confidence and arb efficiency.')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.arbPressure, 3)}</div>
                      <div className="mt-2 text-slate-400 inline-flex items-center gap-2">
                        {tr('Δprice')}
                        <Tooltip text={tr('Stablecoin price change this step (after sells and arbitrage).')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.stableDelta, 4)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-200">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                      <div className="text-slate-400 inline-flex items-center gap-2">
                        {tr('Price stress')}
                        <Tooltip text={tr('How far the stablecoin price is from $1. Higher stress increases redemption and reflexive selling.')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(algo.lastTick.priceStress, 3)}</div>
                      <div className="mt-2 text-slate-400 inline-flex items-center gap-2">
                        {tr('Redemption')}
                        <Tooltip text={tr('Stablecoin redeemed/burned this step when price < $1, which mints backstop tokens.')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(algo.lastTick.redemption, 2)}</div>
                      <div className="mt-2 text-slate-400 inline-flex items-center gap-2">
                        {tr('LUNA minted')}
                        <Tooltip text={tr('Backstop tokens minted to honor redemptions. More minting increases inflation and can accelerate a death spiral.')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(algo.lastTick.lunaMinted, 3)}</div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                      <div className="text-slate-400 inline-flex items-center gap-2">
                        {tr('Supply inflation')}
                        <Tooltip text={tr('Minted backstop tokens relative to prior supply (per step). High inflation weakens the backstop price.')} />
                      </div>
                      <div className="font-mono text-slate-100">{pct(algo.lastTick.supplyInflation, 2)}</div>
                      <div className="mt-2 text-slate-400 inline-flex items-center gap-2">
                        {tr('Backstop strength')}
                        <Tooltip text={tr('0..1 proxy for how credible $1 redemptions are. Falls as inflation rises and backstop price weakens.')} />
                      </div>
                      <div className="font-mono text-slate-100">{pct(algo.lastTick.backstopStrength, 0)}</div>
                      <div className="mt-2 text-slate-400 inline-flex items-center gap-2">
                        {tr('Δprice')}
                        <Tooltip text={tr('Stablecoin price change this step (after redemptions and reflexive effects).')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(algo.lastTick.stableDelta, 4)}</div>
                    </div>
                  </div>
                )}

                <div className="mt-3 text-[11px] text-slate-400">
                  {tr('Tip: This panel shows the simulator’s internal components for the last Step. It helps you connect causes to the observed chart move.')}
                </div>
              </div>
            ) : null}

            <div>
              <SimpleLineChart
                tr={tr}
                title={scenario === 'collateralized' ? tr('Peg vs collateral stress') : tr('Peg vs reflexive backstop (LUNA)')}
                points={series}
                markers={chartMarkers}
                headerRightExtra={
                  <button
                    type="button"
                    onClick={() => setChartMaximized(true)}
                    className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
                    aria-label={tr('Maximize chart')}
                    title={tr('Maximize chart')}
                  >
                    <Maximize2 size={14} />
                  </button>
                }
                legendExtra={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stepOnce()}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
                    >
                      {tr('Step')}
                      <TooltipInButton text={tr('Advance the simulation by 1 tick and observe the chart + log.')} />
                    </button>
                    <button
                      type="button"
                      onClick={() => runSteps(5)}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
                    >
                      {tr('Run 5')}
                    </button>
                    <button
                      type="button"
                      onClick={() => runSteps(10)}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold whitespace-nowrap"
                    >
                      {tr('Run 10')}
                    </button>


                    <button
                      type="button"
                      onClick={() => {
                        setShowPlayHint(false);
                        setAutoRunSpeed(1);
                        setIsAutoRunning((v) => !(v && autoRunSpeed === 1));
                      }}
                      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap ${
                        isAutoRunning && autoRunSpeed === 1
                          ? 'bg-blue-600 border-blue-500 hover:bg-blue-700'
                          : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                      } ${showPlayHint ? 'ring-2 ring-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]' : ''}`}
                      aria-pressed={isAutoRunning && autoRunSpeed === 1}
                      aria-label={isAutoRunning && autoRunSpeed === 1 ? tr('Pause') : tr('Play')}
                    >
                      {isAutoRunning && autoRunSpeed === 1 ? <Pause size={14} /> : <Play size={14} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAutoRunSpeed(2);
                        setIsAutoRunning((v) => !(v && autoRunSpeed === 2));
                      }}
                      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap ${
                        isAutoRunning && autoRunSpeed === 2
                          ? 'bg-blue-600 border-blue-500 hover:bg-blue-700'
                          : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                      }`}
                      aria-pressed={isAutoRunning && autoRunSpeed === 2}
                      aria-label={isAutoRunning && autoRunSpeed === 2 ? tr('Pause') : tr('Play 2x')}
                    >
                      {isAutoRunning && autoRunSpeed === 2 ? <Pause size={14} /> : <FastForward size={14} />}
                      <span className="text-[10px] font-bold">2x</span>
                    </button>

                  </span>
                }
                stableLabel={tr('Stablecoin price')}
                refLabel={scenario === 'collateralized' ? tr('Collateral index') : tr('LUNA price')}
                refIsIndex={scenario === 'collateralized'}
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Activity size={18} className="text-blue-300" />
                {tr('Event log')}
              </div>
              <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                {events.length === 0 ? (
                  <div className="text-sm text-slate-400">{tr('No events yet')}</div>
                ) : (
                  events.map((e) => (
                    <div key={e.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-slate-300">{e.message}</div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 whitespace-nowrap">t={e.t}</span>
                          <EventPill type={e.type} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Quests (moved into header widget dropdown via portal) */}
        <LearningQuestsPortal>
          <div className="p-0">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3"
              onClick={() => {
                setShowQuests((v) => !v);
                setQuestsBlink(false);
              }}
              aria-expanded={showQuests}
            >
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <ListTodo size={18} className={questsBlink ? 'text-amber-300' : 'text-emerald-300'} />
                {tr('Learning quests')}
                <span className="text-xs text-slate-400">({Object.values(questFlags).filter(Boolean).length}/10)</span>
              </div>
              <div className={`text-slate-400 ${!showQuests && questsBlink ? 'motion-safe:animate-pulse' : ''}`}>
                {showQuests ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {showQuests ? (
              <div className="mt-3 space-y-4 text-sm">
                <div>
                  <div className="text-xs text-slate-400 mb-2">{tr('Basics')}</div>
                  <div className="space-y-2">
                    <QuestRow
                      done={questFlags.everDepegged}
                      text={tr('Cause a depeg (|price−1| > 2%)')}
                      tip={tr('Apply a shock (whale sale / collateral crash / liquidity drain) and then step until price moves away from $1.')}
                    />
                    <QuestRow
                      done={questFlags.everRecovered}
                      text={tr('Recover the peg (back within 1%)')}
                      tip={tr('Try adding liquidity or a backstop buy after a small depeg. Collateralized systems often recover if confidence remains high.')}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-2">{tr('Mechanism')}</div>
                  <div className="space-y-2">
                    <QuestRow
                      done={questFlags.everLiquidated}
                      text={tr('Trigger liquidations (collateralized)')}
                      tip={tr('In collateralized mode: apply Collateral crash and step until CR drops and liquidations start.')}
                    />
                    <QuestRow
                      done={questFlags.everRedeemed}
                      text={tr('Trigger redemptions (algorithmic)')}
                      tip={tr('In algorithmic mode: cause price < $1, then step and observe stable is burned and LUNA is minted.')}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-2">{tr('Failure mode')}</div>
                  <div className="space-y-2">
                    <QuestRow
                      done={questFlags.everCollapsed}
                      text={tr('Push the system into collapse (< $0.80)')}
                      tip={tr('Try the Algorithmic “Start death spiral” preset and step 5–10 times. Watch LUNA supply inflate and price fall reflexively.')}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-2">{tr('Optimization')}</div>
                  <div className="space-y-2">
                    <QuestRow
                      done={questFlags.keptAbove97For10}
                      text={tr('Keep price ≥ $0.97 for 10 steps')}
                      tip={tr('Try small shocks, then use Add liquidity / Fix oracle / Backstop buy sparingly. Advanced settings can make the system more or less fragile.')}
                    />
                    <QuestRow
                      done={questFlags.recoveredWithMinimalInterventions}
                      text={tr('Recover the peg with ≤ 2 interventions')}
                      tip={tr('After your first depeg, aim to return within 1% of $1 using at most two interventions. This teaches tradeoffs and timing.')}
                    />
                    <QuestRow
                      done={questFlags.recoveredWithoutBackstopBuy}
                      text={tr('Recover the peg without Backstop buy')}
                      tip={tr('Try to recover using liquidity/oracle fixes and parameter choices — without relying on external bailout buy pressure.')}
                    />
                    <QuestRow
                      done={questFlags.regainedConfidence}
                      text={tr('Let confidence fall (< 0.50) then recover it (≥ 0.75)')}
                      tip={tr('Confidence is a feedback loop amplifier. Create stress, then stabilize price/liquidity so confidence can rebuild.')}
                    />
                    <QuestRow
                      done={questFlags.survivedCrash10StepsNoInsolvency}
                      text={tr('After a collateral crash, survive 10 steps without insolvency')}
                      tip={tr('Apply Collateral crash, then manage liquidations and liquidity so equity never goes negative for 10 steps.')}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </LearningQuestsPortal>

        {/* Real-world applications */}
        <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">🌐 {tr('Real-World Applications')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-emerald-400">{tr('Collateralized stablecoins')}</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="bg-slate-700 rounded p-3 text-xs">
                  {tr('Systems like MakerDAO-style vaults depend on collateral value, liquidations, and deep liquidity for stability.')}
                </div>
                <div className="bg-slate-700 rounded p-3 text-xs">
                  {tr('In stress, the peg can wobble as liquidity drains, even if the system remains solvent.')}
                </div>
              </div>
            </div>
            <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-yellow-400">{tr('Algorithmic stablecoins')}</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="bg-slate-700 rounded p-3 text-xs">
                  {tr('Reflexive systems rely on market confidence: if the backstop token collapses, redemption becomes meaningless.')}
                </div>
                <div className="bg-slate-700 rounded p-3 text-xs">
                  {tr('“Death spirals” are feedback loops: depeg → redemptions → supply inflation → price collapse → worse depeg.')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Further reading */}
        <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">📚 {tr('Further Reading')}</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <LinkWithCopy
                href="https://ethereum.org/en/stablecoins/"
                label={<>Ethereum.org: Stablecoins →</>}
                className="text-blue-300 hover:text-blue-200 underline"
              />
            </li>
            <li>
              <LinkWithCopy
                href="https://docs.makerdao.com/"
                label={<>MakerDAO documentation (vaults & liquidations) →</>}
                className="text-blue-300 hover:text-blue-200 underline"
              />
            </li>
            <li>
              <LinkWithCopy
                href="https://www.terra.money/"
                label={<>Terra (historical context) →</>}
                className="text-blue-300 hover:text-blue-200 underline"
              />
            </li>
          </ul>
        </div>
      </div>
    </div>
    //</div>
  );
}
