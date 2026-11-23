// Stablecoin depeg demo: self-contained display components (gauge, chart, pills…).
// Moved out of stablecoin_depeg_simulation.tsx unchanged.
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
import EduTooltip from '../../../ui/EduTooltip';
import LearningQuestsPortal from '../../../ui/LearningQuestsPortal';
import LinkWithCopy from '../../../ui/LinkWithCopy';
import { define as defineGlossary } from '../../glossary';

const collateralRatioIconUrl = new URL('../../../public/icons/Icon1.png', import.meta.url).href;
const solvencyIconUrl = new URL('../../../public/icons/Icon2.png', import.meta.url).href;
const confidenceIconUrl = new URL('../../../public/icons/Icon3.png', import.meta.url).href;

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
import { useDemoI18n } from '../../useDemoI18n';
import { usePersistedQuests, useReportQuestProgress } from '../../questProgress';

import {
  type ScenarioId,
  type EventType,
  type SimEvent,
  type SeriesPoint,
  type CollateralizedState,
  type ReservePolicy,
  type AlgorithmicState,
  clamp,
  severityColorClass,
  severityTextClass,
  severityFromRange,
  fmt,
  pct,
  nowId,
  initialCollateralized,
  initialAlgorithmic,
  computeCR,
  stablePriceColor,
  outcomeLabel
} from './model';

// Backwards-compatible alias so we don't have to rewrite all usages.
const Tooltip = EduTooltip;

export function EventPill({ type }: { type: EventType }) {
  const { tr } = useDemoI18n('stablecoin-depeg');
  const cls =
    type === 'success'
      ? 'border-emerald-700 bg-emerald-900/20 text-emerald-100'
      : type === 'warn'
        ? 'border-amber-700 bg-amber-900/20 text-amber-100'
        : type === 'error'
          ? 'border-red-700 bg-red-900/25 text-red-100'
          : 'border-blue-700 bg-blue-900/20 text-blue-100';
  const label =
    type === 'warn' ? tr('warning') : type === 'success' ? tr('success') : type === 'error' ? tr('error') : tr('info');
  return <span className={`px-2 py-0.5 rounded border text-[11px] ${cls}`}>{label}</span>;
}

export function TooltipInButton({ text }: { text: React.ReactNode }) {
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

export function QuestRow({ done, text, tip }: { done: boolean; text: string; tip: string }) {
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

export function RedemptionCapacityGauge({
  requested,
  executed,
  cap,
  unfilled,
  compact = false
}: {
  requested: number;
  executed: number;
  cap: number;
  unfilled: number;
  compact?: boolean;
}) {
  const { tr } = useDemoI18n('stablecoin-depeg');
  const safeCap = Math.max(0, cap);
  const safeExecuted = clamp(executed, 0, safeCap);
  const overflow = Math.max(0, requested - safeCap);

  // Normalize widths: show overflow relative to cap (up to 100% extra).
  const base = Math.max(1e-6, safeCap);
  const wExecuted = clamp(safeExecuted / base, 0, 1);
  const wRemaining = clamp((safeCap - safeExecuted) / base, 0, 1);
  const wOverflow = clamp(overflow / base, 0, 1);

  const throttled = requested > executed + 1e-9;

  return (
    <div className={compact ? 'mt-0' : 'mt-2'}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-slate-400">{throttled ? tr('Redemption throttled') : tr('Redemption capacity')}</div>
        {throttled ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-rose-500/40 bg-rose-950/30 text-rose-200 font-semibold">
            {tr('THROTTLED')}
          </span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-950/20 text-emerald-200 font-semibold">
            {tr('OK')}
          </span>
        )}
      </div>

      <div className={`${compact ? 'mt-1 h-2' : 'mt-1 h-3'} rounded-md overflow-hidden border border-slate-700 bg-slate-900/50`}>
        <div className="h-full flex">
          <div className="h-full bg-emerald-500/70" style={{ width: `${wExecuted * 100}%` }} />
          <div className="h-full bg-slate-700/70" style={{ width: `${wRemaining * 100}%` }} />
          {/* Overflow (requested beyond cap). */}
          {wOverflow > 0 ? <div className="h-full bg-rose-500/70" style={{ width: `${wOverflow * 100}%` }} /> : null}
        </div>
      </div>

      {compact ? null : (
        <div className="mt-1 grid grid-cols-4 gap-2 text-[10px] text-slate-400">
          <div className="truncate">{tr('executed')}</div>
          <div className="truncate">{tr('cap')}</div>
          <div className="truncate">{tr('overflow')}</div>
          <div className="truncate">{tr('unfilled')}</div>
          <div className="font-mono text-slate-200">{fmt(executed, 0)}</div>
          <div className="font-mono text-slate-200">{fmt(cap, 0)}</div>
          <div className="font-mono text-rose-200">{fmt(overflow, 0)}</div>
          <div className="font-mono text-rose-200">{fmt(unfilled, 0)}</div>
        </div>
      )}
    </div>
  );
}

export type ChartMarker = {
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

export function SimpleLineChart({
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
  // Space for the right-side ref axis labels (e.g., LUNA price).
  const padRight = 64;
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

  const yRefTickCount = 5;
  const refRange = maxRef - minRef;
  const refLabelDecimals = refRange < 1 ? 3 : refRange < 10 ? 2 : refRange < 100 ? 1 : 0;
  const yRefTicks = (() => {
    if (!Number.isFinite(minRef) || !Number.isFinite(maxRef)) return [] as number[];
    if (maxRef === minRef) return [minRef];

    const raw = Array.from({ length: yRefTickCount }, (_, i) => minRef + (i / (yRefTickCount - 1)) * (maxRef - minRef));
    const roundTo = Math.pow(10, refLabelDecimals);
    const rounded = raw.map((v) => Math.round(v * roundTo) / roundTo);
    return Array.from(new Set(rounded));
  })();

  const refTickLabel = (v: number) => {
    // Use the same formatter used in the legend/value display when available.
    return refValueFormatter ? refValueFormatter(v) : fmt(v, refLabelDecimals);
  };

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
          {/* y-axis (stable price) */}
          <line x1={padLeft} x2={padLeft} y1={padTop} y2={yAxis} stroke="rgba(148,163,184,0.35)" />

          {/* y-axis (ref series, right) */}
          <line
            x1={w - padRight}
            x2={w - padRight}
            y1={padTop}
            y2={yAxis}
            stroke="rgba(148,163,184,0.25)"
          />
          {yRefTicks.map((v) => (
            <g key={`ref_${v}`}>
              <line
                x1={w - padRight}
                x2={w - padRight + 4}
                y1={yScale(v, minRef, maxRef)}
                y2={yScale(v, minRef, maxRef)}
                stroke="rgba(148,163,184,0.25)"
              />
              <text
                x={w - padRight + 6}
                y={yScale(v, minRef, maxRef) + 3}
                textAnchor="start"
                fontSize={10}
                fill="rgba(148,163,184,0.75)"
              >
                {refTickLabel(v)}
              </text>
            </g>
          ))}
          <text
            x={w - 14}
            y={(padTop + yAxis) / 2}
            transform={`rotate(90 ${w - 14} ${(padTop + yAxis) / 2})`}
            textAnchor="middle"
            fontSize={11}
            fill="rgba(148,163,184,0.85)"
          >
            {refLabel}
          </text>
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

export function useWindowHeight() {
  const [h, setH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 900));
  useEffect(() => {
    const onResize = () => setH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return h;
}
