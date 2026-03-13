import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bug,
  Droplets,
  Gauge,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import EduTooltip from '../../ui/EduTooltip';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { define } from '../glossary';
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

function SimpleLineChart({
  tr,
  title,
  points,
  stableLabel,
  refLabel,
  refIsIndex,
  refValueLabel,
  refValueFormatter
}: {
  tr: (s: string, opts?: Record<string, unknown>) => string;
  title: string;
  points: SeriesPoint[];
  stableLabel: string;
  refLabel: string;
  refIsIndex?: boolean;
  refValueLabel?: string;
  refValueFormatter?: (x: number) => string;
}) {
  const w = 560;
  const h = 180;
  const pad = 20;

  const xs = points.map((p) => p.t);
  const stableYs = points.map((p) => p.stable);
  const refYs = points.map((p) => p.ref);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  // Stable is usually around 1.0; keep scale anchored to show depegs clearly.
  const minStable = Math.min(...stableYs, 0.0);
  const maxStable = Math.max(...stableYs, 1.05);

  const minRef = Math.min(...refYs);
  const maxRef = Math.max(...refYs);

  function xScale(x: number) {
    if (maxX === minX) return pad;
    return pad + ((x - minX) / (maxX - minX)) * (w - pad * 2);
  }

  function yScale(y: number, min: number, max: number) {
    if (max === min) return h / 2;
    return pad + (1 - (y - min) / (max - min)) * (h - pad * 2);
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

  const last = points[points.length - 1];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-300" />
          <span className="truncate">{title}</span>
        </div>
        <div className="text-xs text-slate-400 whitespace-nowrap">{tr('t={{t}}', { t: last?.t ?? 0 })}</div>
      </div>

      <div className="mt-3 overflow-auto">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
          {/* Baseline at $1 */}
          <line
            x1={pad}
            x2={w - pad}
            y1={yScale(1, minStable, maxStable)}
            y2={yScale(1, minStable, maxStable)}
            stroke="rgba(148,163,184,0.35)"
            strokeDasharray="4 4"
          />

          <path d={refPath} fill="none" stroke="rgba(167,139,250,0.9)" strokeWidth={2} />
          <path d={stablePath} fill="none" stroke="rgba(52,211,153,0.95)" strokeWidth={2.5} />
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {stableLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            {refLabel}
          </span>
        </div>

        {last ? (
          <div className="text-xs text-slate-400 whitespace-nowrap">
            {tr('Now')}: ${fmt(last.stable, 3)} •{' '}
            {refIsIndex ? `${tr('Index')} ${fmt(last.ref, 2)}` : `${tr('Price')} $${fmt(last.ref, 2)}`}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function StablecoinDepegSimulation() {
  const { tr } = useDemoI18n('stablecoin-depeg');

  const [scenario, setScenario] = useState<ScenarioId>('collateralized');
  const [guidedMode, setGuidedMode] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sectionHighlight, setSectionHighlight] = useState<'controls' | 'chart' | 'log' | 'quests' | null>(null);

  const [params, setParams] = useState(() => ({
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
  }));

  const controlsRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const questsRef = useRef<HTMLDivElement | null>(null);

  const [collat, setCollat] = useState<CollateralizedState>(() => initialCollateralized());
  const [algo, setAlgo] = useState<AlgorithmicState>(() => initialAlgorithmic());

  const [questFlags, setQuestFlags] = useState(() => ({
    everDepegged: false,
    everLiquidated: false,
    everRedeemed: false,
    everCollapsed: false,
    everRecovered: false
  }));

  const currentT = scenario === 'collateralized' ? collat.t : algo.t;

  const [events, setEvents] = useState<SimEvent[]>(() => [
    {
      id: nowId(),
      t: 0,
      type: 'info',
      message: tr('Pick a scenario and apply shocks. Then click Step to see how the system reacts.')
    }
  ]);

  const [series, setSeries] = useState<SeriesPoint[]>(() => [{ t: 0, stable: 1.0, ref: 1.0 }]);

  function addEvent(type: EventType, message: string, tOverride?: number) {
    setEvents((prev) => [{ id: nowId(), t: tOverride ?? currentT, type, message }, ...prev].slice(0, 18));
  }

  function highlight(which: 'controls' | 'chart' | 'log' | 'quests') {
    setSectionHighlight(which);
    const el =
      which === 'controls'
        ? controlsRef.current
        : which === 'chart'
          ? chartRef.current
          : which === 'log'
            ? logRef.current
            : questsRef.current;

    if (guidedMode) el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => setSectionHighlight(null), 900);
  }

  function reset(nextScenario?: ScenarioId) {
    const sc = nextScenario ?? scenario;
    const c = initialCollateralized();
    const a = initialAlgorithmic();

    // Initialize state using current advanced parameters.
    c.lastTick.liquidationTrigger = params.liquidationTrigger;
    a.ammDepth = params.ammDepth;

    setScenario(sc);
    setCollat(c);
    setAlgo(a);
    setQuestFlags({ everDepegged: false, everLiquidated: false, everRedeemed: false, everCollapsed: false, everRecovered: false });

    setSeries([{ t: 0, stable: 1.0, ref: sc === 'collateralized' ? 1.0 : a.lunaPrice }]);
    setEvents([{ id: nowId(), t: 0, type: 'info', message: tr('Reset simulation') }]);
  }

  function updateQuestsFromStep(nextStablePrice: number, opts: { liquidations?: boolean; redeemed?: boolean }) {
    setQuestFlags((prev) => {
      const everDepegged = prev.everDepegged || Math.abs(nextStablePrice - 1) > 0.02;
      const everLiquidated = prev.everLiquidated || Boolean(opts.liquidations);
      const everRedeemed = prev.everRedeemed || Boolean(opts.redeemed);
      const everCollapsed = prev.everCollapsed || nextStablePrice < 0.8;
      const everRecovered = prev.everRecovered || (everDepegged && Math.abs(nextStablePrice - 1) <= 0.01);
      return { everDepegged, everLiquidated, everRedeemed, everCollapsed, everRecovered };
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
          next.liquidityDepth = clamp(next.liquidityDepth * 0.6, 0.05, 2);
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
    }

    if (guidedMode) highlight('controls');
  }

  function applyIntervention(kind: string) {
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
    }

    if (guidedMode) highlight('controls');
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

        const stableDelta = clamp((-sellPressure + arbPressure) / (10 + 18 * liquidityDepthNext), -0.08, 0.08);
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

        updateQuestsFromStep(stablePriceNext, { liquidations: liquidationPressure > 0.2 });

        // Events
        if (liquidationPressure > 0.05 && s.liquidationPressure <= 0.05) {
          addEvent(
            'warn',
            tr('Liquidations begin as CR falls below {{thr}}%', { thr: (liquidationTrigger * 100).toFixed(0) }),
            next.t
          );
        }

        if (outcomeLabel(stablePriceNext) === 'collapse' && s.stablePrice >= 0.8) {
          addEvent('error', tr('Stablecoin enters collapse region (< $0.80).'), next.t);
        } else if (Math.abs(stablePriceNext - 1) > 0.02 && Math.abs(s.stablePrice - 1) <= 0.02) {
          addEvent('warn', tr('Peg breaks: price moves away from $1.'), next.t);
        } else if (Math.abs(stablePriceNext - 1) <= 0.01 && Math.abs(s.stablePrice - 1) > 0.01) {
          addEvent('success', tr('Peg recovers near $1.'), next.t);
        }

        // Solvency threshold: equity < 0 means the system is fundamentally undercollateralized.
        const equityNext = collateralValueNext - s.debt;
        if (equityNext < 0 && s.lastTick.equity >= 0) {
          addEvent('error', tr('Insolvency: collateral value falls below total debt (equity < 0).'), next.t);
        } else if (equityNext < s.debt * 0.1 && s.lastTick.equity >= s.debt * 0.1) {
          addEvent('warn', tr('Thin buffer: equity is low, so small shocks can threaten solvency.'), next.t);
        }

        setSeries((prev) => [...prev, { t: next.t, stable: stablePriceNext, ref: collateralIndexNext }].slice(-60));
        return next;
      });

      if (guidedMode) highlight('chart');
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

      updateQuestsFromStep(stablePriceNext, { redeemed: redemption > 0.01 });

      if (stablePriceNext < 0.97 && s.stablePrice >= 0.97) {
        addEvent('warn', tr('Early stress: stablecoin dips below $0.97.'), next.t);
      }
      if (stablePriceNext < 0.8 && s.stablePrice >= 0.8) {
        addEvent('error', tr('Panic zone: stablecoin falls below $0.80.'), next.t);
      }
      if (stablePriceNext < 0.05 && s.stablePrice >= 0.05) {
        addEvent('error', tr('Failure: stablecoin collapses (< $0.05).'), next.t);
      }

      // Backstop credibility thresholds (teaching): when redemptions become less meaningful.
      if (backstopStrength < 0.3 && s.lastTick.backstopStrength >= 0.3) {
        addEvent('error', tr('Backstop failure: redemptions lose credibility as the backstop token collapses.'), next.t);
      } else if (backstopStrength < 0.6 && s.lastTick.backstopStrength >= 0.6) {
        addEvent('warn', tr('Backstop weakening: redemptions still work mechanically, but market confidence deteriorates.'), next.t);
      }

      setSeries((prev) => [...prev, { t: next.t, stable: stablePriceNext, ref: lunaPriceNext }].slice(-60));
      return next;
    });

    if (guidedMode) highlight('chart');
  }

  function runSteps(n: number) {
    for (let i = 0; i < n; i++) stepOnce();
  }

  const stableNow = scenario === 'collateralized' ? collat.stablePrice : algo.stablePrice;
  const outcome = outcomeLabel(stableNow);

  const concepts = useMemo(() => {
    return [
      { term: tr('Stablecoin'), def: define('Stablecoin') },
      { term: tr('Depeg'), def: define('Depeg') },
      { term: tr('Liquidity'), def: define('Liquidity') },
      { term: tr('Slippage'), def: define('Slippage') },
      { term: tr('Liquidation'), def: define('Liquidation') },
      { term: tr('Oracle'), def: define('Oracle') },
      { term: tr('Arbitrage'), def: define('Arbitrage') },
      { term: tr('Reflexivity'), def: define('Reflexivity') }
    ];
  }, [tr]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 text-white">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <Droplets className="text-blue-300" />
              {tr('Stablecoin Depeg Cascade Simulation')}
            </h1>
            <p className="text-slate-300 mt-2 max-w-3xl">
              {tr('Apply shocks and watch how liquidity, confidence, and feedback loops can break (or restore) a stablecoin peg.')}
            </p>

            {/* 60-second tour */}
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 max-w-3xl">
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
                <li>{tr('Use Guided mode to auto-scroll to the relevant panel as things change.')}</li>
              </ol>
            </div>

            {/* Concepts */}
            <div className="mt-3 flex flex-wrap gap-2">
              {concepts.map((c) => (
                <span
                  key={c.term}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-sm text-slate-200"
                >
                  <span>{c.term}</span>
                  <span>
                    <Tooltip widthClassName="w-96" text={c.def} />
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-200">
              <input type="checkbox" checked={guidedMode} onChange={(e) => setGuidedMode(e.target.checked)} />
              {tr('Guided mode')}
              <Tooltip text={tr('When enabled, shock buttons and Step will scroll to the key panels so beginners can follow cause → effect.')} />
            </label>

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
              onClick={() => setShowDebug((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
            >
              <Bug size={16} />
              {showDebug ? tr('Hide debug') : tr('Show debug')}
            </button>

            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
            >
              <RefreshCw size={16} />
              {tr('Reset')}
            </button>

            <LinkWithCopy href={typeof window !== 'undefined' ? window.location.href : ''} label={tr('Copy link')} />
          </div>
        </div>

        {/* Top stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Gauge size={18} className="text-emerald-300" />
              <span className="text-xs text-slate-400">
                {tr('Stablecoin price')}
                <Tooltip text={define('Stablecoin Price')} />
              </span>
            </div>
            <div className={`text-2xl font-bold ${stablePriceColor(stableNow)}`}>${fmt(stableNow, 3)}</div>
            <div className="text-xs text-slate-500 mt-1">
              {tr('Outcome')}: <span className="font-semibold">{tr(outcome)}</span>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={18} className="text-blue-300" />
              <span className="text-xs text-slate-400">
                {tr('Confidence')}
                <Tooltip text={define('Confidence')} />
              </span>
            </div>
            <div className="text-2xl font-bold">
              {pct(scenario === 'collateralized' ? collat.confidence : algo.confidence, 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1">{tr('t={{t}}', { t: currentT })}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={18} className="text-purple-300" />
              <span className="text-xs text-slate-400">
                {scenario === 'collateralized' ? tr('Solvency (equity)') : tr('Backstop strength')}
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

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={18} className="text-yellow-300" />
              <span className="text-xs text-slate-400">
                {scenario === 'collateralized' ? tr('Collateral ratio') : tr('Supply inflation')}
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

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div
            ref={controlsRef}
            className={`rounded-xl border bg-slate-950/40 p-4 transition-shadow ${
              sectionHighlight === 'controls'
                ? 'border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]'
                : 'border-slate-800'
            }`}
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
                    <Activity size={16} className="text-red-300" />
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
                    <Bug size={16} className="text-yellow-300" />
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
                    <Activity size={16} className="text-blue-300" />
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
                          <span className="font-mono">{pct(params.liquidationTrigger, 0)}</span>
                        </div>
                        <input
                          type="range"
                          min={1.2}
                          max={2.0}
                          step={0.01}
                          value={params.liquidationTrigger}
                          onChange={(e) => setParams((p) => ({ ...p, liquidationTrigger: Number(e.target.value) }))}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span>
                            {tr('Arbitrage efficiency')}
                            <Tooltip text={tr('Higher means faster pull back toward $1 when confidence is high.')} />
                          </span>
                          <span className="font-mono">{fmt(params.arbEfficiency, 1)}</span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={18}
                          step={0.5}
                          value={params.arbEfficiency}
                          onChange={(e) => setParams((p) => ({ ...p, arbEfficiency: Number(e.target.value) }))}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span>
                            {tr('Liquidation severity')}
                            <Tooltip text={tr('How much collateral is sold per tick under full liquidation pressure.')} />
                          </span>
                          <span className="font-mono">{pct(params.liquidationSeverity, 1)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.01}
                          max={0.15}
                          step={0.005}
                          value={params.liquidationSeverity}
                          onChange={(e) => setParams((p) => ({ ...p, liquidationSeverity: Number(e.target.value) }))}
                          className="w-full"
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
                          <span className="font-mono">{fmt(params.ammDepth, 2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.1}
                          max={2.0}
                          step={0.05}
                          value={params.ammDepth}
                          onChange={(e) => setParams((p) => ({ ...p, ammDepth: Number(e.target.value) }))}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span>
                            {tr('Redemption intensity')}
                            <Tooltip text={tr('How aggressively users redeem stable for $1 of LUNA when below peg.')} />
                          </span>
                          <span className="font-mono">{fmt(params.redemptionIntensity, 3)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.02}
                          max={0.2}
                          step={0.005}
                          value={params.redemptionIntensity}
                          onChange={(e) => setParams((p) => ({ ...p, redemptionIntensity: Number(e.target.value) }))}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span>
                            {tr('Reflexivity multiplier')}
                            <Tooltip text={tr('How strongly supply inflation hits the backstop token price (LUNA).')} />
                          </span>
                          <span className="font-mono">{fmt(params.reflexivityK, 2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.8}
                          max={4.0}
                          step={0.05}
                          value={params.reflexivityK}
                          onChange={(e) => setParams((p) => ({ ...p, reflexivityK: Number(e.target.value) }))}
                          className="w-full"
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
                {tr('Add liquidity')}
                <TooltipInButton text={tr('Increase depth so the same sells cause less slippage.')} />
              </button>

              {scenario === 'collateralized' ? (
                <button
                  type="button"
                  onClick={() => applyIntervention('fix_oracle')}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                >
                  {tr('Fix oracle')}
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
                {tr('Backstop buy (buy stable)')}
                <TooltipInButton text={tr('A simplified “buyer of last resort” to show how external support can help peg recovery.')} />
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Activity size={18} className="text-emerald-300" />
                {tr('Run')}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => stepOnce()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold whitespace-nowrap"
                >
                  {tr('Step')}
                  <TooltipInButton text={tr('Advance the simulation by 1 tick and observe the chart + log.')} />
                </button>
                <button
                  type="button"
                  onClick={() => runSteps(5)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold whitespace-nowrap"
                >
                  {tr('Run 5')}
                </button>
                <button
                  type="button"
                  onClick={() => runSteps(10)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold whitespace-nowrap"
                >
                  {tr('Run 10')}
                </button>
              </div>
            </div>
          </div>

          {/* Quests */}
          <div
            ref={questsRef}
            className={`rounded-xl border bg-slate-950/40 p-4 transition-shadow ${
              sectionHighlight === 'quests'
                ? 'border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]'
                : 'border-slate-800'
            }`}
          >
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldAlert size={18} className="text-emerald-300" />
              {tr('Learning quests')}
            </div>
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
            </div>
          </div>

          {/* Chart + log */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-300" />
                {tr('Price vs solvency')}
                <Tooltip text={tr('A stablecoin can depeg due to liquidity/panic even while solvent. This panel separates market price from fundamental backing capacity.')} />
              </div>

              {scenario === 'collateralized' ? (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-200">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                    <div className="text-slate-400">{tr('Market price')}</div>
                    <div className="text-lg font-semibold">${fmt(collat.stablePrice, 3)}</div>
                    <div className="mt-1 text-slate-500">{tr('Can move quickly with slippage')}</div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                    <div className="text-slate-400">{tr('Equity (solvency buffer)')}</div>
                    <div className={`text-lg font-semibold ${collat.lastTick.equity < 0 ? 'text-red-300' : 'text-emerald-200'}`}>${fmt(collat.lastTick.equity, 2)}</div>
                    <div className="mt-1 text-slate-500">{tr('Equity = collateral value − debt')}</div>
                    <div className="mt-2 text-slate-400">{tr('Thresholds')}</div>
                    <div className="mt-1 text-slate-500">{tr('Thin buffer')}: &lt; 10% debt • {tr('Insolvent')}: &lt; 0</div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-200">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                    <div className="text-slate-400">{tr('Market price')}</div>
                    <div className="text-lg font-semibold">${fmt(algo.stablePrice, 3)}</div>
                    <div className="mt-1 text-slate-500">{tr('Depegs trigger redemptions')}</div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                    <div className="text-slate-400">{tr('Backstop capacity')}</div>
                    <div className={`text-lg font-semibold ${algo.lastTick.backstopStrength < 0.3 ? 'text-red-300' : algo.lastTick.backstopStrength < 0.6 ? 'text-amber-200' : 'text-emerald-200'}`}>{pct(algo.lastTick.backstopStrength, 0)}</div>
                    <div className="mt-1 text-slate-500">{tr('Proxy: (LUNA price / $80) × confidence')}</div>
                    <div className="mt-2 text-slate-400">{tr('Thresholds')}</div>
                    <div className="mt-1 text-slate-500">{tr('Weakening')}: &lt; 60% • {tr('Failure')}: &lt; 30%</div>
                  </div>
                </div>
              )}

              <div className="mt-3 text-[11px] text-slate-400">
                {tr('Key idea: price can deviate from $1 before solvency fails. In algorithmic designs, the backstop can fail reflexively even while redemptions still work mechanically.')}
              </div>
            </div>
            {showFormulas ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <BarChart3 size={18} className="text-amber-300" />
                  {tr('Mechanics breakdown (last step)')}
                </div>

                {scenario === 'collateralized' ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-200">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                      <div className="text-slate-400">{tr('Collateral ratio (CR)')}</div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.cr, 3)}</div>
                      <div className="mt-2 text-slate-400">{tr('Liquidation pressure')}</div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.liquidationPressure, 3)}</div>
                      <div className="mt-2 text-slate-400">{tr('Collateral sold (USD)')}</div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.collateralSellUsd, 2)}</div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                      <div className="text-slate-400">{tr('Panic sell')}</div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.panicSell, 3)}</div>
                      <div className="mt-2 text-slate-400">{tr('Arbitrage support')}</div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.arbPressure, 3)}</div>
                      <div className="mt-2 text-slate-400">{tr('Δprice')}</div>
                      <div className="font-mono text-slate-100">{fmt(collat.lastTick.stableDelta, 4)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-200">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                      <div className="text-slate-400">{tr('Price stress')}</div>
                      <div className="font-mono text-slate-100">{fmt(algo.lastTick.priceStress, 3)}</div>
                      <div className="mt-2 text-slate-400">{tr('Redemption')}</div>
                      <div className="font-mono text-slate-100">{fmt(algo.lastTick.redemption, 2)}</div>
                      <div className="mt-2 text-slate-400">{tr('LUNA minted')}</div>
                      <div className="font-mono text-slate-100">{fmt(algo.lastTick.lunaMinted, 3)}</div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                      <div className="text-slate-400">{tr('Supply inflation')}</div>
                      <div className="font-mono text-slate-100">{pct(algo.lastTick.supplyInflation, 2)}</div>
                      <div className="mt-2 text-slate-400">{tr('Backstop strength')}</div>
                      <div className="font-mono text-slate-100">{pct(algo.lastTick.backstopStrength, 0)}</div>
                      <div className="mt-2 text-slate-400">{tr('Δprice')}</div>
                      <div className="font-mono text-slate-100">{fmt(algo.lastTick.stableDelta, 4)}</div>
                    </div>
                  </div>
                )}

                <div className="mt-3 text-[11px] text-slate-400">
                  {tr('Tip: This panel shows the simulator’s internal components for the last Step. It helps you connect causes to the observed chart move.')}
                </div>
              </div>
            ) : null}

            <div
              ref={chartRef}
              className={`transition-shadow ${
                sectionHighlight === 'chart' ? 'rounded-xl shadow-[0_0_0_3px_rgba(245,158,11,0.25)]' : ''
              }`}
            >
              <SimpleLineChart
                tr={tr}
                title={scenario === 'collateralized' ? tr('Peg vs collateral stress') : tr('Peg vs reflexive backstop (LUNA)')}
                points={series}
                stableLabel={tr('Stablecoin price')}
                refLabel={scenario === 'collateralized' ? tr('Collateral index') : tr('LUNA price')}
                refIsIndex={scenario === 'collateralized'}
              />
            </div>

            <div
              ref={logRef}
              className={`rounded-xl border bg-slate-950/40 p-4 transition-shadow ${
                sectionHighlight === 'log'
                  ? 'border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]'
                  : 'border-slate-800'
              }`}
            >
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

              {showDebug ? (
                <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-300 space-y-3">
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <Bug size={14} /> {tr('Debug')}
                  </div>

                  {scenario === 'collateralized' ? (
                    <div className="space-y-1">
                      <div>
                        {tr('CR')}: <span className="font-mono">{fmt(collat.lastTick.cr, 3)}</span>
                      </div>
                      <div>
                        {tr('Liquidation pressure')}: <span className="font-mono">{fmt(collat.liquidationPressure, 3)}</span>
                      </div>
                      <div>
                        {tr('Panic sell')}: <span className="font-mono">{fmt(collat.lastTick.panicSell, 3)}</span>
                      </div>
                      <div>
                        {tr('Arb pressure')}: <span className="font-mono">{fmt(collat.lastTick.arbPressure, 3)}</span>
                      </div>
                      <div>
                        {tr('Liquidity depth')}: <span className="font-mono">{fmt(collat.liquidityDepth, 2)}</span>
                      </div>
                      <div>
                        {tr('Oracle quality')}: <span className="font-mono">{fmt(collat.oracleQuality, 2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div>
                        {tr('Redemption')}: <span className="font-mono">{fmt(algo.lastTick.redemption, 2)}</span>
                      </div>
                      <div>
                        {tr('LUNA minted')}: <span className="font-mono">{fmt(algo.lastTick.lunaMinted, 3)}</span>
                      </div>
                      <div>
                        {tr('Supply inflation')}: <span className="font-mono">{pct(algo.lastTick.supplyInflation, 2)}</span>
                      </div>
                      <div>
                        {tr('Backstop strength')}: <span className="font-mono">{fmt(algo.lastTick.backstopStrength, 2)}</span>
                      </div>
                      <div>
                        {tr('Yield support')}: <span className="font-mono">{fmt(algo.yieldSupport, 2)}</span>
                      </div>
                      <div>
                        {tr('AMM depth')}: <span className="font-mono">{fmt(algo.ammDepth, 2)}</span>
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500">
                    {tr('Note: This is a teaching simulation, not a faithful market model. It aims to illustrate feedback loops and cascade dynamics.')}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

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
  );
}
