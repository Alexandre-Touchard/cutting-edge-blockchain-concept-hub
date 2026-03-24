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
  Waves,
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

type ReservePolicy = 'auto' | 'manual';

type AlgorithmicState = {
  t: number;
  // Core market state
  stablePrice: number; // UST price (USD)
  lunaPrice: number; // LUNA price (USD)
  stableSupply: number; // UST supply (scaled units)
  lunaSupply: number; // LUNA supply (scaled units)

  // Split market depth
  ustDepth: number; // 0..2 (UST/USDC depth proxy)
  lunaDepth: number; // 0..2 (LUNA/USD depth proxy)

  // Demand + confidence
  confidence: number; // 0..1
  yieldSupport: number; // 0..1

  // Anchor module (simplified)
  anchorTVL: number;
  anchorYieldRate: number; // normalized 0..1
  yieldReserve: number;
  withdrawalRate: number; // fraction of TVL per tick
  bankRunTicksRemaining: number;

  // Redemption / swap constraints
  mintCapMultiplier: number; // 1.0 = normal
  unfilledRedemption: number;

  // Reserves (LFG-like)
  reserveUSD: number;
  reserveDeployRateCapPerTick: number;
  reservePolicy: ReservePolicy;
  reserveEffectiveness: number; // 0..1
  reserveManualDeployRequestUsd: number;

  // Drift / regimes
  baselineDriftOn: boolean;

  // Exogenous selling
  whaleSell: number;

  lastTick: {
    // Sell-flow decomposition
    sentiment: number;
    sellWhaleUST: number;
    sellAnchorOutflowUST: number;
    sellFromLowSentimentUST: number;
    sellFromUnfilledRedemptionUST: number;
    ustSellFlow: number;

    // Price formation
    sellDelta: number;
    stablePriceAfterSell: number;
    priceStress: number;

    // Redemptions
    redemptionRequested: number;
    redemptionExecuted: number;
    redemption: number;
    mintCapPerTick: number;
    redemptionCap: number;
    unfilledRedemptionNext: number;

    // LUNA reflexivity
    lunaMinted: number;
    supplyInflation: number;
    lunaDeltaPct: number;
    lunaPriceNext: number;

    // Support terms
    backstopStrength: number;
    redeemSupport: number;
    reserveDeployedUsd: number;
    reserveSupport: number;
    reserveUSDNext: number;

    // Next values
    ustDepthNext: number;
    lunaDepthNext: number;
    confidenceNext: number;
    yieldSupportNext: number;

    // Net
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
  // Terra-style teaching defaults.
  // Mirrors the rough ratios: stable=$1, LUNA ~$80, 18B stable, 350M LUNA.
  const stableSupply = 18_000;
  const lunaSupply = 350;

  const reserveUSD = 3_000;

  return {
    t: 0,

    stablePrice: 1.0,
    lunaPrice: 80,
    stableSupply,
    lunaSupply,

    ustDepth: 1.0,
    lunaDepth: 1.0,

    confidence: 1.0,
    yieldSupport: 1.0,

    anchorTVL: 12_000,
    anchorYieldRate: 1.0,
    yieldReserve: 1_200,
    withdrawalRate: 0.0,
    bankRunTicksRemaining: 0,

    mintCapMultiplier: 1.0,
    unfilledRedemption: 0,

    reserveUSD,
    reserveDeployRateCapPerTick: 220,
    reservePolicy: 'manual',
    reserveEffectiveness: 1.0,
    reserveManualDeployRequestUsd: 0,

    baselineDriftOn: false,

    whaleSell: 0,

    lastTick: {
      sentiment: 1,
      sellWhaleUST: 0,
      sellAnchorOutflowUST: 0,
      sellFromLowSentimentUST: 0,
      sellFromUnfilledRedemptionUST: 0,
      ustSellFlow: 0,

      sellDelta: 0,
      stablePriceAfterSell: 1.0,
      priceStress: 0,

      redemptionRequested: 0,
      redemptionExecuted: 0,
      redemption: 0,
      mintCapPerTick: 0,
      redemptionCap: 0,
      unfilledRedemptionNext: 0,

      lunaMinted: 0,
      supplyInflation: 0,
      lunaDeltaPct: 0,
      lunaPriceNext: 80,

      backstopStrength: 1,
      redeemSupport: 0,
      reserveDeployedUsd: 0,
      reserveSupport: 0,
      reserveUSDNext: reserveUSD,

      ustDepthNext: 1.0,
      lunaDepthNext: 1.0,
      confidenceNext: 1.0,
      yieldSupportNext: 1.0,

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
    | 'shock_shockwave'
    | 'shock_demand_decay'
    | 'shock_anchor_bank_run'
    | 'shock_mint_cap_tightened'
    | 'shock_reserve_confidence_loss'
    | 'marker_mint_cap_binding'
    | 'marker_reserves_depleted'
    | 'marker_reserves_deployed'
    | 'add_liquidity'
    | 'fix_oracle'
    | 'backstop_buy'
    | 'restore_yield'
    | 'toggle_reserve_policy'
    | 'deploy_reserves_now'
    | 'increase_mint_cap';
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
  titleExtra,
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
  titleExtra?: React.ReactNode;
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
    if (maxX === minX) return [Math.round(minX)];

    const range = Math.max(1, Math.round(maxX - minX));
    const step = Math.max(1, Math.round(range / (xTickCount - 1)));

    const ticks: number[] = [Math.round(minX)];
    for (let v = Math.round(minX) + step; v < Math.round(maxX); v += step) ticks.push(v);
    ticks.push(Math.round(maxX));

    return Array.from(new Set(ticks));
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
      case 'toggle_reserve_policy':
        return <RefreshCw size={14} className="text-violet-200" />;
      case 'deploy_reserves_now':
        return <Banknote size={14} className="text-emerald-200" />;
      case 'increase_mint_cap':
        return <TrendingUp size={14} className="text-amber-200" />;

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
      case 'shock_shockwave':
        return <Waves size={14} className="text-violet-200" />;
      case 'shock_demand_decay':
        return <TrendingDown size={14} className="text-slate-300" />;
      case 'shock_anchor_bank_run':
        return <AlertTriangle size={14} className="text-amber-300" />;
      case 'shock_mint_cap_tightened':
        return <Gauge size={14} className="text-amber-200" />;
      case 'shock_reserve_confidence_loss':
        return <Banknote size={14} className="text-slate-300" />;
      case 'marker_mint_cap_binding':
        return <Gauge size={14} className="text-amber-200" />;
      case 'marker_reserves_deployed':
        return <Banknote size={14} className="text-emerald-200" />;
      case 'marker_reserves_depleted':
        return <Banknote size={14} className="text-red-200" />;

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
              {titleExtra ? <span className="ml-2 shrink-0">{titleExtra}</span> : null}
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

  const liquidityDepthNow = scenario === 'collateralized' ? collat.liquidityDepth : algo.ustDepth;
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

  // When stepping many times quickly (runSteps), React state for `series` doesn't update synchronously.
  // Keep a ref to the latest plotted point so markers can be anchored correctly.
  const lastPlottedPointRef = useRef<SeriesPoint>({ t: 0, stable: 1.0, ref: 1.0 });

  function addChartMarker(
    kind: ChartMarker['kind'],
    label: string,
    anchor?: { t: number; stable: number }
  ) {
    // Anchor markers to a known point on the plotted curve.
    // IMPORTANT: when we run many steps in a tight loop (runSteps), React state for `series`
    // does not update synchronously between iterations, so relying on `series[series.length-1]`
    // can anchor everything to t=0 and then get filtered out by "recent" history.
    const last = anchor ?? lastPlottedPointRef.current ?? series[series.length - 1];
    if (!last) return;
    const id = `m_${chartMarkerIdRef.current++}`;
    setChartMarkers((prev) => [...prev, { id, t: last.t, stable: last.stable, kind, label }]);
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
  const [historyMode, setHistoryMode] = useState<'full' | 'slice30'>('full');

  const tNow = scenario === 'collateralized' ? collat.t : algo.t;
  const visibleSeries = useMemo(() => {
    if (historyMode === 'full') return series;
    const cutoff = Math.max(0, tNow - 30);
    return series.filter((p) => p.t >= cutoff);
  }, [historyMode, series, tNow]);

  const visibleChartMarkers = useMemo(() => {
    if (historyMode === 'full') return chartMarkers;
    const cutoff = Math.max(0, tNow - 30);
    return chartMarkers.filter((m) => m.t >= cutoff);
  }, [historyMode, chartMarkers, tNow]);

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
    a.ustDepth = nextParams.ammDepth;
    a.lunaDepth = nextParams.ammDepth;

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

    const initialPoint = { t: 0, stable: 1.0, ref: sc === 'collateralized' ? 1.0 : a.lunaPrice };
    lastPlottedPointRef.current = initialPoint;
    setSeries([initialPoint]);
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
    const markerAnchor =
      scenario === 'collateralized'
        ? { t: collat.t, stable: collat.stablePrice }
        : { t: algo.t, stable: algo.stablePrice };
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
        if (preset === 'shockwave') {
          // A broad market shock: confidence drops, liquidity thins, and some selling starts.
          next.confidence = clamp(next.confidence - 0.25, 0, 1);
          next.ustDepth = clamp(next.ustDepth * 0.55, 0.05, 2);
          next.lunaDepth = clamp(next.lunaDepth * 0.75, 0.05, 2);
          next.yieldSupport = clamp(next.yieldSupport - 0.15, 0, 1);
          next.whaleSell += 140;
        }
        if (preset === 'anchor_bank_run') {
          // A sudden withdrawal wave from Anchor-like demand.
          next.bankRunTicksRemaining = Math.max(next.bankRunTicksRemaining, 8);
          next.withdrawalRate = Math.max(next.withdrawalRate, 0.12);
          next.confidence = clamp(next.confidence - 0.12, 0, 1);
          next.yieldSupport = clamp(next.yieldSupport - 0.1, 0, 1);
        }
        if (preset === 'mint_cap_tightened') {
          next.mintCapMultiplier = clamp(next.mintCapMultiplier * 0.6, 0.05, 2);
          next.confidence = clamp(next.confidence - 0.06, 0, 1);
        }
        if (preset === 'reserve_confidence_loss') {
          next.reserveEffectiveness = clamp(next.reserveEffectiveness * 0.65, 0.1, 1);
          next.confidence = clamp(next.confidence - 0.08, 0, 1);
        }
        if (preset === 'demand_decay') {
          // Toggle mode: enables/disables ongoing baseline erosion applied each tick.
          next.baselineDriftOn = !next.baselineDriftOn;
        }
        return next;
      });

      const name =
        preset === 'yield_withdrawal'
          ? tr('Yield withdrawal')
          : preset === 'anchor_bank_run'
            ? tr('Anchor bank run')
            : preset === 'whale_sale'
              ? tr('Whale sale')
              : preset === 'mint_cap_tightened'
                ? tr('Mint cap tightened')
                : preset === 'reserve_confidence_loss'
                  ? tr('Reserve confidence loss')
                  : preset === 'demand_decay'
                    ? tr('Baseline drift (toggle)')
                    : preset === 'shockwave'
                      ? tr('Shockwave')
                      : tr('Death spiral starter');

      addEvent('warn', tr('Applied shock: {{name}}', { name }));
      const markerKind: ChartMarker['kind'] =
        preset === 'yield_withdrawal'
          ? 'shock_yield_withdrawal'
          : preset === 'anchor_bank_run'
            ? 'shock_anchor_bank_run'
            : preset === 'whale_sale'
              ? 'shock_whale_sale'
              : preset === 'mint_cap_tightened'
                ? 'shock_mint_cap_tightened'
                : preset === 'reserve_confidence_loss'
                  ? 'shock_reserve_confidence_loss'
                  : preset === 'demand_decay'
                    ? 'shock_demand_decay'
                    : preset === 'shockwave'
                      ? 'shock_shockwave'
                      : 'shock_death_spiral';
      addChartMarker(markerKind, tr('Shock: {{name}}', { name }));

      flashKpis(
        preset === 'yield_withdrawal'
          ? ['yield', 'confidence']
          : preset === 'anchor_bank_run'
            ? ['yield', 'price']
            : preset === 'whale_sale'
              ? ['price']
              : preset === 'mint_cap_tightened'
                ? ['confidence', 'price']
                : preset === 'reserve_confidence_loss'
                  ? ['confidence', 'price']
                  : preset === 'demand_decay'
                    ? ['yield', 'confidence']
                    : preset === 'shockwave'
                      ? ['confidence', 'liquidity', 'price']
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
        if (kind === 'add_liquidity') {
          next.ustDepth = clamp(next.ustDepth * 1.25, 0.06, 2);
          next.lunaDepth = clamp(next.lunaDepth * 1.15, 0.06, 2);
        }
        if (kind === 'restore_yield') next.yieldSupport = clamp(next.yieldSupport + 0.25, 0, 1);
        if (kind === 'toggle_reserve_policy') {
          next.reservePolicy = next.reservePolicy === 'auto' ? 'manual' : 'auto';
        }
        if (kind === 'deploy_reserves_now') {
          // In manual policy, request a deployment on the next tick; in auto, this is effectively immediate.
          next.reserveManualDeployRequestUsd += next.reserveDeployRateCapPerTick;
        }
        if (kind === 'increase_mint_cap') {
          next.mintCapMultiplier = clamp(next.mintCapMultiplier * 1.4, 0.05, 2);
          next.confidence = clamp(next.confidence + 0.03, 0, 1);
        }
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
            : kind === 'toggle_reserve_policy'
              ? tr('Toggle reserve policy')
              : kind === 'deploy_reserves_now'
                ? tr('Deploy reserves now')
                : kind === 'increase_mint_cap'
                  ? tr('Increase mint cap')
                  : tr('Backstop buy (buy stable)');

      addEvent('success', tr('Intervention: {{name}}', { name }));
      addChartMarker(kind as ChartMarker['kind'], tr('Intervention: {{name}}', { name }));
      flashKpis(
        kind === 'add_liquidity'
          ? ['liquidity', 'price']
          : kind === 'restore_yield'
            ? ['yield', 'confidence']
            : kind === 'toggle_reserve_policy'
              ? ['confidence', 'price']
              : kind === 'deploy_reserves_now'
                ? ['price']
                : kind === 'increase_mint_cap'
                  ? ['price', 'confidence']
                  : ['price', 'confidence']
      );
      setWhy(
        tr('Intervention effect'),
        kind === 'add_liquidity'
          ? tr('Adding liquidity increases market depth, which reduces price impact from sells and makes the peg harder to break.')
          : kind === 'restore_yield'
            ? tr('Restoring yield incentives boosts demand and confidence, reducing sell pressure and slowing the reflexive loop.')
            : kind === 'toggle_reserve_policy'
              ? tr('Switching reserve policy changes whether reserves deploy automatically when UST is below peg, or only when you click Deploy.')
              : kind === 'deploy_reserves_now'
                ? tr('Deploying reserves adds buy support for UST when it is below peg, but drains remaining reserves and can hurt credibility if depleted.')
                : kind === 'increase_mint_cap'
                  ? tr('Increasing mint cap relieves swap throttles, allowing more redemptions to execute per tick and reducing unfilled redemption pressure.')
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

        setSeries((prev) => {
          const point = { t: next.t, stable: stablePriceNext, ref: collateralIndexNext };
          lastPlottedPointRef.current = point;
          const nextSeries = [...prev, point];
          return nextSeries.length > 5000 ? nextSeries.slice(-5000) : nextSeries;
        });
        return next;
      });

      return;
    }

    // Algorithmic / Terra-style (Appendix spec)
    setAlgo((s) => {
      const peg = 1.0;

      // -----------------------------
      // 1) Demand & sell-flow components
      // -----------------------------
      const sentiment = clamp((s.confidence + s.yieldSupport) / 2, 0, 1);

      const sellWhaleUST = s.whaleSell;

      const effectiveWithdrawalRate =
        s.bankRunTicksRemaining > 0 ? Math.max(s.withdrawalRate, 0.08) : s.withdrawalRate;
      const sellAnchorOutflowUST = s.anchorTVL * clamp(effectiveWithdrawalRate, 0, 0.25);

      // Low-sentiment sells (teaching proxy): increases when confidence/yield fall.
      const sellFromLowSentimentUST = (1 - sentiment) * 180;

      // Failed arb pressure: when mint cap binds, unfilled redemptions become an accelerant.
      const sellFromUnfilledRedemptionUST = clamp(s.unfilledRedemption * 0.06, 0, 320);

      const ustSellFlow = sellWhaleUST + sellAnchorOutflowUST + sellFromLowSentimentUST + sellFromUnfilledRedemptionUST;

      // -----------------------------
      // 2) UST price formation (depth-based impact)
      // -----------------------------
      const ustDepthNow = clamp(s.ustDepth, 0.06, 2);
      const sellDelta = -ustSellFlow / (1400 + 2000 * ustDepthNow);
      const stablePriceAfterSell = clamp(s.stablePrice + sellDelta, 0.01, 1.1);

      const priceStress = stablePriceAfterSell < 0.99 ? Math.max(0, peg - stablePriceAfterSell) : 0;

      // -----------------------------
      // 3) Redemption requested vs executed (capacity-bound)
      // -----------------------------
      const mintCapPerTick = s.stableSupply * params.redemptionCap * clamp(s.mintCapMultiplier, 0.05, 2);

      const redemptionRequested = clamp(
        priceStress * params.redemptionIntensity * s.stableSupply * (0.35 + 0.65 * s.confidence),
        0,
        s.stableSupply
      );
      const redemptionExecuted = Math.min(redemptionRequested, mintCapPerTick);

      // Unfilled is NOT a FIFO queue; treat as failed-arb pressure that worsens sentiment.
      let unfilledRedemptionNext = s.unfilledRedemption + (redemptionRequested - redemptionExecuted);
      // Slow decay when peg is basically restored (pressure dissipates).
      if (stablePriceAfterSell >= 0.995) unfilledRedemptionNext *= 0.85;
      unfilledRedemptionNext = clamp(unfilledRedemptionNext, 0, s.stableSupply * 2);

      // -----------------------------
      // 4) LUNA minting + reflexive price impact
      // -----------------------------
      const redemption = redemptionExecuted;
      const lunaMinted = redemption / Math.max(0.5, s.lunaPrice);

      const stableSupplyNext = Math.max(1, s.stableSupply - redemption);
      const lunaSupplyNext = s.lunaSupply + lunaMinted;

      const supplyInflation = lunaMinted / Math.max(1e-6, s.lunaSupply);
      const lunaDepthNow = clamp(s.lunaDepth, 0.06, 2);

      const lunaDeltaPct = clamp(
        -((supplyInflation * params.reflexivityK) / (0.6 + 0.8 * lunaDepthNow) + (1 - s.confidence) * 0.06),
        -0.92,
        0.08
      );
      const lunaPriceNext = clamp(s.lunaPrice * (1 + lunaDeltaPct), 0.02, 250);

      // Backstop strength is the *credibility* of $1 redemptions.
      const backstopStrength = clamp((lunaPriceNext / 80) * s.confidence, 0, 1);
      const redeemSupport = backstopStrength * (redemption / Math.max(1, s.stableSupply)) * 0.9;

      // -----------------------------
      // 5) Reserves support (LFG-like)
      // -----------------------------
      const reserveThreshold = 0.99;
      const wantsReserveSupport = stablePriceAfterSell < reserveThreshold;

      let reserveDeployedUsd = 0;
      if (wantsReserveSupport) {
        if (s.reservePolicy === 'auto') {
          reserveDeployedUsd = Math.min(s.reserveDeployRateCapPerTick, s.reserveUSD);
        } else {
          reserveDeployedUsd = Math.min(
            s.reserveManualDeployRequestUsd,
            s.reserveDeployRateCapPerTick,
            s.reserveUSD
          );
        }
      }

      const reserveUSDNext = Math.max(0, s.reserveUSD - reserveDeployedUsd);
      const reserveBuyUST = reserveDeployedUsd / Math.max(0.8, stablePriceAfterSell);
      const reserveSupport = s.reserveEffectiveness * (reserveBuyUST / (1400 + 2000 * ustDepthNow)) * 1.25;

      // -----------------------------
      // 6) Final UST price update
      // -----------------------------
      const stableDelta = clamp(sellDelta + redeemSupport + reserveSupport, -0.25, 0.14);
      const stablePriceNext = clamp(s.stablePrice + stableDelta, 0.01, 1.1);

      // -----------------------------
      // 7) Confidence + depth updates
      // -----------------------------
      const reserveDepletionStress = reserveUSDNext <= 1e-6 ? 0.12 : reserveDeployedUsd > 0 ? 0.03 : 0;
      const unfilledStress = clamp(unfilledRedemptionNext / Math.max(1, s.stableSupply), 0, 1);

      const confDelta = clamp(
        -Math.abs(stablePriceNext - peg) * 0.25 - Math.max(0, -lunaDeltaPct) * 0.05 - unfilledStress * 0.08 - reserveDepletionStress + 0.012,
        -0.28,
        0.05
      );

      const baselineDrift = s.baselineDriftOn ? 0.004 : 0;
      const confidenceNext = clamp(s.confidence + confDelta - baselineDrift, 0, 1);

      const yieldSupportNext = clamp(s.yieldSupport - Math.abs(stablePriceNext - peg) * 0.02 - baselineDrift, 0, 1);

      const liquidityDrainUst = clamp((0.6 - confidenceNext) * 0.05 + unfilledStress * 0.03, 0, 0.08);
      const ustDepthNext = clamp(s.ustDepth * (1 - liquidityDrainUst), 0.06, 2);

      const liquidityDrainLuna = clamp((0.65 - confidenceNext) * 0.05 + supplyInflation * 0.18, 0, 0.12);
      const lunaDepthNext = clamp(s.lunaDepth * (1 - liquidityDrainLuna), 0.06, 2);

      // Anchor TVL update
      const anchorTVLNext = clamp(s.anchorTVL - sellAnchorOutflowUST, 0, s.anchorTVL);
      const bankRunTicksRemainingNext = Math.max(0, s.bankRunTicksRemaining - 1);

      const whaleSellNext = s.whaleSell * 0.6;

      const next: AlgorithmicState = {
        ...s,
        t: s.t + 1,
        stablePrice: stablePriceNext,
        lunaPrice: lunaPriceNext,
        stableSupply: stableSupplyNext,
        lunaSupply: lunaSupplyNext,
        ustDepth: ustDepthNext,
        lunaDepth: lunaDepthNext,
        confidence: confidenceNext,
        yieldSupport: yieldSupportNext,
        whaleSell: whaleSellNext,
        unfilledRedemption: unfilledRedemptionNext,
        reserveUSD: reserveUSDNext,
        reserveManualDeployRequestUsd: s.reservePolicy === 'manual' ? 0 : s.reserveManualDeployRequestUsd,
        anchorTVL: anchorTVLNext,
        bankRunTicksRemaining: bankRunTicksRemainingNext,
        lastTick: {
          sentiment,
          sellWhaleUST,
          sellAnchorOutflowUST,
          sellFromLowSentimentUST,
          sellFromUnfilledRedemptionUST,
          ustSellFlow,

          sellDelta,
          stablePriceAfterSell,
          priceStress,

          redemptionRequested,
          redemptionExecuted,
          redemption,
          mintCapPerTick,
          redemptionCap: mintCapPerTick,
          unfilledRedemptionNext,

          lunaMinted,
          supplyInflation,
          lunaDeltaPct,
          lunaPriceNext,

          backstopStrength,
          redeemSupport,
          reserveDeployedUsd,
          reserveSupport,
          reserveUSDNext,

          ustDepthNext,
          lunaDepthNext,
          confidenceNext,
          yieldSupportNext,

          stableDelta
        }
      };

      updateQuestsFromStep(stablePriceNext, {
        redeemed: redemptionExecuted > 0.01,
        confidenceNext
      });

      // Regime ladder markers
      if (stablePriceNext < 0.97 && s.stablePrice >= 0.97) {
        addEvent('warn', tr('Early stress: UST dips below $0.97.'), next.t);
        setWhy(
          tr('Early stress'),
          tr(
            'UST sell flow {{sell}} hit UST depth {{d}}. Redemptions requested {{req}} (executed {{exe}}; cap {{cap}}). Unfilled redemptions {{unf}} increase panic pressure.',
            {
              sell: fmt(ustSellFlow, 0),
              d: fmt(ustDepthNow, 2),
              req: fmt(redemptionRequested, 0),
              exe: fmt(redemptionExecuted, 0),
              cap: fmt(mintCapPerTick, 0),
              unf: fmt(unfilledRedemptionNext, 0)
            }
          )
        );
      }
      if (stablePriceNext < 0.8 && s.stablePrice >= 0.8) {
        addEvent('error', tr('Run begins: UST falls below $0.80.'), next.t);
        setWhy(
          tr('Run begins'),
          tr(
            'When UST is far below peg, redemptions request {{req}} per tick, but only {{exe}} can execute due to mint cap. This creates unfilled pressure and accelerates confidence loss.',
            {
              req: fmt(redemptionRequested, 0),
              exe: fmt(redemptionExecuted, 0)
            }
          )
        );
      }
      if (stablePriceNext < 0.3 && s.stablePrice >= 0.3) {
        addEvent('error', tr('Cascade: UST falls below $0.30.'), next.t);
      }
      if (stablePriceNext < 0.05 && s.stablePrice >= 0.05) {
        addEvent('error', tr('Failure: UST collapses (< $0.05).'), next.t);
      }

      // Mint cap binding marker
      if (redemptionRequested > redemptionExecuted && s.lastTick.redemptionRequested <= s.lastTick.redemptionExecuted) {
        addEvent('warn', tr('Mint cap is binding: redemption demand exceeds execution capacity.'), next.t);
        addChartMarker('marker_mint_cap_binding', tr('Mint cap binding'), { t: next.t, stable: stablePriceNext });
      }

      // Reserves deployed / depleted markers
      if (reserveDeployedUsd > 0 && s.lastTick.reserveDeployedUsd <= 0) {
        addEvent('info', tr('Reserves deployed to support UST.'), next.t);
        addChartMarker('marker_reserves_deployed', tr('Reserves deployed'), { t: next.t, stable: stablePriceNext });
      }
      if (reserveUSDNext <= 1e-6 && s.reserveUSD > 1e-6) {
        addEvent('error', tr('Reserves depleted: credibility drops sharply.'), next.t);
        addChartMarker('marker_reserves_depleted', tr('Reserves depleted'), { t: next.t, stable: stablePriceNext });
      }

      setSeries((prev) => {
        const point = { t: next.t, stable: stablePriceNext, ref: lunaPriceNext };
        lastPlottedPointRef.current = point;
        const nextSeries = [...prev, point];
        return nextSeries.length > 5000 ? nextSeries.slice(-5000) : nextSeries;
      });

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

  // Dev-only debug harness (for fast acceptance testing from the browser console).
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const api = {
      reset,
      applyShock,
      applyIntervention,
      runSteps,
      stepOnce,
      getState: () => ({
        scenario,
        collat,
        algo,
        params,
        series,
        chartMarkers,
        events
      }),
      // Scripted Terra acceptance run.
      terraAcceptance: () => {
        reset('algorithmic');
        runSteps(20);
        applyShock('yield_withdrawal');
        runSteps(8);
        applyShock('anchor_bank_run');
        runSteps(6);
        applyShock('whale_sale');
        runSteps(6);
        applyShock('mint_cap_tightened');
        runSteps(6);
        applyIntervention('toggle_reserve_policy');
        runSteps(40);
        return api.getState();
      }
    };

    (window as any).__depegSim = api;
    return () => {
      if ((window as any).__depegSim === api) delete (window as any).__depegSim;
    };
  }, [scenario, collat, algo, params, series, chartMarkers, events]);

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
                  onClick={() => applyShock('demand_decay')}
                  className={`inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm ${
                    algo.baselineDriftOn
                      ? 'bg-blue-600 border-blue-500 hover:bg-blue-700'
                      : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                  }`}
                  aria-pressed={algo.baselineDriftOn}
                >
                  <span className="inline-flex items-center gap-2">
                    <TrendingDown size={16} className="text-slate-300" />
                    {tr('Baseline drift')}
                  </span>
                  <TooltipInButton
                    text={tr(
                      'Gradually erode yield support and confidence which : 1) reduces sentiment/demand 2) which creates persistent sell pressure → peg fragility → potential redemption/mint reflexivity'
                    )}
                  />
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
                  onClick={() => applyShock('anchor_bank_run')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-300" />
                    {tr('Anchor bank run')}
                  </span>
                  <TooltipInButton text={tr('A wave of withdrawals turns into explicit UST sell flow, stressing the peg.')} />
                </button>

                <button
                  type="button"
                  onClick={() => applyShock('mint_cap_tightened')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Gauge size={16} className="text-amber-200" />
                    {tr('Mint cap tightened')}
                  </span>
                  <TooltipInButton text={tr('Swap throttles: redemption demand exceeds execution capacity, creating unfilled redemptions and panic.')} />
                </button>

                <button
                  type="button"
                  onClick={() => applyShock('reserve_confidence_loss')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Banknote size={16} className="text-slate-200" />
                    {tr('Reserve confidence loss')}
                  </span>
                  <TooltipInButton text={tr('Markets doubt reserves: reserve buys become less effective and confidence drops.')} />
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
                  <TooltipInButton text={tr('Combines low confidence, low yield support, and heavy selling, a recipe for reflexive collapse.')} />
                </button>

                <button
                  type="button"
                  onClick={() => applyShock('shockwave')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Waves size={16} className="text-violet-200" />
                    {tr('Shockwave')}
                  </span>
                  <TooltipInButton text={tr('A broad market shock: liquidity thins and confidence drops, amplifying slippage and reflexive selling.')} />
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
                <>
                  <button
                    type="button"
                    onClick={() => applyIntervention('restore_yield')}
                    className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <TrendingUp size={16} className="text-blue-200" />
                      {tr('Restore yield incentives')}
                    </span>
                    <TooltipInButton text={tr('Yield can temporarily support demand, but it is not a real collateral backstop.')} />
                  </button>

                  <button
                    type="button"
                    onClick={() => applyIntervention('toggle_reserve_policy')}
                    className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw size={16} className="text-violet-200" />
                      {tr('Toggle reserve policy')}
                    </span>
                    <TooltipInButton text={tr('Switch between Auto reserves and Manual reserves (click Deploy to spend reserves).')} />
                  </button>

                  <button
                    type="button"
                    onClick={() => applyIntervention('deploy_reserves_now')}
                    className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Banknote size={16} className="text-emerald-200" />
                      {tr('Deploy reserves now')}
                    </span>
                    <TooltipInButton text={tr('Spend reserves to buy UST when below peg. Helps in the short term but drains remaining reserves.')} />
                  </button>

                  <button
                    type="button"
                    onClick={() => applyIntervention('increase_mint_cap')}
                    className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Gauge size={16} className="text-amber-200" />
                      {tr('Increase mint cap')}
                    </span>
                    <TooltipInButton text={tr('Relieve swap throttles so more redemptions can execute per tick, reducing unfilled pressure.')} />
                  </button>
                </>
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
                      {scenario === 'algorithmic' && algo.baselineDriftOn ? (
                        <span className="mr-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-blue-500/50 bg-blue-950/30 text-xs font-semibold text-blue-200">
                          <span className="h-2 w-2 rounded-full bg-blue-400" />
                          {tr('Baseline drift')}: {tr('ON')}
                        </span>
                      ) : null}

                      {scenario === 'algorithmic' ? (
                        <span className="mr-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900/30 text-xs font-semibold text-slate-200">
                          <span className="h-2 w-2 rounded-full bg-violet-400" />
                          {tr('Reserve policy')}: {tr(algo.reservePolicy === 'auto' ? 'Auto' : 'Manual')}
                        </span>
                      ) : null}
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
                                  <div className="grid grid-cols-5 gap-x-2 text-slate-400">
                                    <div className="truncate whitespace-nowrap">{tr('Sell: whale')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Sell: Anchor')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Sell: sentiment')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Sell: unfilled')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Total sell')}</div>
                                  </div>
                                  <div className="grid grid-cols-5 gap-x-2 font-mono text-slate-100">
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.sellWhaleUST, 0)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.sellAnchorOutflowUST, 0)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.sellFromLowSentimentUST, 0)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.sellFromUnfilledRedemptionUST, 0)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.ustSellFlow, 0)}</div>
                                  </div>
                                </div>

                                <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
                                  <div className="grid grid-cols-4 gap-x-2 text-slate-400">
                                    <div className="truncate whitespace-nowrap">{tr('UST depth')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Δprice (sell)')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Price after sell')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Price stress')}</div>
                                  </div>
                                  <div className="grid grid-cols-4 gap-x-2 font-mono text-slate-100">
                                    <div className="whitespace-nowrap">{fmt(algo.ustDepth, 2)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.sellDelta, 4)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.stablePriceAfterSell, 3)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.priceStress, 3)}</div>
                                  </div>
                                </div>

                                <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
                                  <div className="grid grid-cols-4 gap-x-2 text-slate-400">
                                    <div className="truncate whitespace-nowrap">{tr('Redeem requested')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Executed')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Mint cap')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Unfilled')}</div>
                                  </div>
                                  <div className="grid grid-cols-4 gap-x-2 font-mono text-slate-100">
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.redemptionRequested, 0)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.redemptionExecuted, 0)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.mintCapPerTick, 0)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.unfilledRedemptionNext, 0)}</div>
                                  </div>
                                </div>

                                <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
                                  <div className="grid grid-cols-5 gap-x-2 text-slate-400">
                                    <div className="truncate whitespace-nowrap">{tr('LUNA minted')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Inflation')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('LUNA Δ%')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('LUNA depth')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('LUNA price')}</div>
                                  </div>
                                  <div className="grid grid-cols-5 gap-x-2 font-mono text-slate-100">
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.lunaMinted, 0)}</div>
                                    <div className="whitespace-nowrap">{pct(algo.lastTick.supplyInflation, 2)}</div>
                                    <div className="whitespace-nowrap">{pct(algo.lastTick.lunaDeltaPct, 1)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.lunaDepth, 2)}</div>
                                    <div className="whitespace-nowrap">${fmt(algo.lunaPrice, 2)}</div>
                                  </div>
                                </div>

                                <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
                                  <div className="grid grid-cols-4 gap-x-2 text-slate-400">
                                    <div className="truncate whitespace-nowrap">{tr('Reserves deployed')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Reserves left')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Backstop strength')}</div>
                                    <div className="truncate whitespace-nowrap">{tr('Δprice (net)')}</div>
                                  </div>
                                  <div className="grid grid-cols-4 gap-x-2 font-mono text-slate-100">
                                    <div className="whitespace-nowrap">{fmt(algo.lastTick.reserveDeployedUsd, 0)}</div>
                                    <div className="whitespace-nowrap">{fmt(algo.reserveUSD, 0)}</div>
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
                      points={visibleSeries}
                      markers={visibleChartMarkers}
                      stableLabel={scenario === 'algorithmic' ? tr('UST stablecoin price') : tr('Stablecoin price')}
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

                          <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden" title={tr('Chart window')} aria-label={tr('Chart window')}>
                            <button
                              type="button"
                              onClick={() => setHistoryMode('slice30')}
                              className={`px-2.5 py-1.5 text-xs font-semibold ${
                                historyMode === 'slice30'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
                              }`}
                              aria-pressed={historyMode === 'slice30'}
                            >
                              {tr('Last 30s')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryMode('full')}
                              className={`px-2.5 py-1.5 text-xs font-semibold ${
                                historyMode === 'full'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
                              }`}
                              aria-pressed={historyMode === 'full'}
                            >
                              {tr('Full history')}
                            </button>
                          </div>
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
                                  onClick={() => applyShock('demand_decay')}
                                  className={`inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                                    algo.baselineDriftOn
                                      ? 'bg-blue-600 border-blue-500 hover:bg-blue-700'
                                      : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                                  }`}
                                  aria-pressed={algo.baselineDriftOn}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <TrendingDown size={14} className="text-slate-300" />
                                    {tr('Baseline drift')}
                                  </span>
                                  <TooltipInButton
                                    text={tr(
                                      'Gradually erode yield support and confidence which : 1) reduces sentiment/demand 2) which creates persistent sell pressure → peg fragility → potential redemption/mint reflexivity'
                                    )}
                                  />
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
                                  onClick={() => applyShock('anchor_bank_run')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <AlertTriangle size={14} className="text-amber-300" />
                                  {tr('Anchor bank run')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyShock('mint_cap_tightened')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Gauge size={14} className="text-amber-200" />
                                  {tr('Mint cap tightened')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyShock('reserve_confidence_loss')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Banknote size={14} className="text-slate-200" />
                                  {tr('Reserve confidence loss')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyShock('death_spiral')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <AlertTriangle size={14} className="text-red-300" />
                                  {tr('Death spiral')}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => applyShock('shockwave')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Waves size={14} className="text-violet-200" />
                                  {tr('Shockwave')}
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
                                  onClick={() => applyIntervention('toggle_reserve_policy')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <RefreshCw size={14} className="text-violet-200" />
                                  {tr('Reserve policy')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyIntervention('deploy_reserves_now')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Banknote size={14} className="text-emerald-200" />
                                  {tr('Deploy reserves')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyIntervention('increase_mint_cap')}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                >
                                  <Gauge size={14} className="text-amber-200" />
                                  {tr('Increase cap')}
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
                        {tr('Sell flow (UST)')}
                        <Tooltip text={tr('Decomposed UST sell flow this tick: whale selling + Anchor outflows + low-sentiment selling + failed-arbitrage pressure.')} />
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-slate-100">
                        <div className="text-slate-400">{tr('whale')}</div>
                        <div className="text-right">{fmt(algo.lastTick.sellWhaleUST, 0)}</div>
                        <div className="text-slate-400">{tr('Anchor')}</div>
                        <div className="text-right">{fmt(algo.lastTick.sellAnchorOutflowUST, 0)}</div>
                        <div className="text-slate-400">{tr('sentiment')}</div>
                        <div className="text-right">{fmt(algo.lastTick.sellFromLowSentimentUST, 0)}</div>
                        <div className="text-slate-400">{tr('unfilled')}</div>
                        <div className="text-right">{fmt(algo.lastTick.sellFromUnfilledRedemptionUST, 0)}</div>
                        <div className="text-slate-400">{tr('total')}</div>
                        <div className="text-right">{fmt(algo.lastTick.ustSellFlow, 0)}</div>
                      </div>

                      <div className="mt-3 text-slate-400 inline-flex items-center gap-2">
                        {tr('UST depth')}
                        <Tooltip text={tr('Market depth proxy for UST. Lower depth makes the same sell flow cause larger price impact.')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(algo.ustDepth, 2)}</div>

                      <div className="mt-3 text-slate-400 inline-flex items-center gap-2">
                        {tr('Price after sell')}
                        <Tooltip text={tr('Intermediate price after sell impact, before redemption + reserves support.')} />
                      </div>
                      <div className="font-mono text-slate-100">${fmt(algo.lastTick.stablePriceAfterSell, 3)}</div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                      <div className="text-slate-400 inline-flex items-center gap-2">
                        {tr('Redemption capacity')}
                        <Tooltip text={tr('When UST < $1, users try to redeem UST for $1 worth of LUNA. If capacity is limited, some redemptions fail and become unfilled pressure.')} />
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-slate-100">
                        <div className="text-slate-400">{tr('requested')}</div>
                        <div className="text-right">{fmt(algo.lastTick.redemptionRequested, 0)}</div>
                        <div className="text-slate-400">{tr('executed')}</div>
                        <div className="text-right">{fmt(algo.lastTick.redemptionExecuted, 0)}</div>
                        <div className="text-slate-400">{tr('mint cap')}</div>
                        <div className="text-right">{fmt(algo.lastTick.mintCapPerTick, 0)}</div>
                        <div className="text-slate-400">{tr('unfilled')}</div>
                        <div className="text-right">{fmt(algo.lastTick.unfilledRedemptionNext, 0)}</div>
                      </div>

                      <div className="mt-3 text-slate-400 inline-flex items-center gap-2">
                        {tr('LUNA minted')}
                        <Tooltip text={tr('LUNA minted due to executed redemptions. High minting inflates supply and can crash LUNA price.')} />
                      </div>
                      <div className="font-mono text-slate-100">{fmt(algo.lastTick.lunaMinted, 0)}</div>

                      <div className="mt-3 text-slate-400 inline-flex items-center gap-2">
                        {tr('Supply inflation')}
                        <Tooltip text={tr('Minted LUNA / prior LUNA supply (per step).')} />
                      </div>
                      <div className="font-mono text-slate-100">{pct(algo.lastTick.supplyInflation, 2)}</div>

                      <div className="mt-3 text-slate-400 inline-flex items-center gap-2">
                        {tr('Reserves (USD)')}
                        <Tooltip text={tr('Reserves can buy UST when below peg, but depletion reduces credibility.')} />
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-slate-100">
                        <div className="text-slate-400">{tr('deployed')}</div>
                        <div className="text-right">{fmt(algo.lastTick.reserveDeployedUsd, 0)}</div>
                        <div className="text-slate-400">{tr('left')}</div>
                        <div className="text-right">{fmt(algo.reserveUSD, 0)}</div>
                      </div>

                      <div className="mt-3 text-slate-400 inline-flex items-center gap-2">
                        {tr('Backstop strength')}
                        <Tooltip text={tr('Credibility proxy for the $1 redemption promise: depends on LUNA price and confidence.')} />
                      </div>
                      <div className="font-mono text-slate-100">{pct(algo.lastTick.backstopStrength, 0)}</div>

                      <div className="mt-3 text-slate-400 inline-flex items-center gap-2">
                        {tr('Δprice (net)')}
                        <Tooltip text={tr('UST price change this step after sells + redemption support + reserves support.')} />
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
                titleExtra={
                  scenario === 'algorithmic' && algo.baselineDriftOn ? (
                    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-blue-500/50 bg-blue-950/30 text-[11px] font-semibold text-blue-200">
                      <span className="h-2 w-2 rounded-full bg-blue-400" />
                      {tr('Baseline drift')}: {tr('ON')}
                    </span>
                  ) : null
                }
                points={visibleSeries}
                markers={visibleChartMarkers}
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

                    <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden" title={tr('Chart window')} aria-label={tr('Chart window')}>
                      <button
                        type="button"
                        onClick={() => setHistoryMode('slice30')}
                        className={`px-2.5 py-1.5 text-xs font-semibold ${
                          historyMode === 'slice30'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
                        }`}
                        aria-pressed={historyMode === 'slice30'}
                      >
                        {tr('Last 30s')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryMode('full')}
                        className={`px-2.5 py-1.5 text-xs font-semibold ${
                          historyMode === 'full'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
                        }`}
                        aria-pressed={historyMode === 'full'}
                      >
                        {tr('Full history')}
                      </button>
                    </div>

                  </span>
                }
                stableLabel={scenario === 'algorithmic' ? tr('UST stablecoin price') : tr('Stablecoin price')}
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
