// Stablecoin depeg demo: state types and pure helpers (no React).
// Moved out of stablecoin_depeg_simulation.tsx unchanged.

export type ScenarioId = 'collateralized' | 'algorithmic';

export type EventType = 'info' | 'success' | 'warn' | 'error';

export type SimEvent = {
  id: number;
  t: number;
  type: EventType;
  message: string;
};

export type SeriesPoint = {
  t: number;
  stable: number;
  ref: number; // collateral index or LUNA price
};

export type CollateralizedState = {
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

export type ReservePolicy = 'auto' | 'manual';

export type AlgorithmicState = {
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

  // Stability tracking (used to allow partial LUNA recovery in mild depeg scenarios)
  pegStabilityTicks: number;

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

export function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

export function severityColorClass(sev01: number) {
  const s = clamp(sev01, 0, 1);
  // green -> amber -> red
  if (s < 0.34) return 'accent-emerald-500';
  if (s < 0.67) return 'accent-amber-500';
  return 'accent-red-500';
}

export function severityTextClass(sev01: number) {
  const s = clamp(sev01, 0, 1);
  if (s < 0.34) return 'text-emerald-200';
  if (s < 0.67) return 'text-amber-200';
  return 'text-red-200';
}

export function severityFromRange(value: number, min: number, max: number, opts?: { invert?: boolean }) {
  const t = max === min ? 0 : (value - min) / (max - min);
  const clamped = clamp(t, 0, 1);
  return opts?.invert ? 1 - clamped : clamped;
}

export function fmt(x: number, decimals = 2) {
  if (!Number.isFinite(x)) return '—';
  return x.toFixed(decimals);
}

export function pct(x: number, decimals = 0) {
  return `${(x * 100).toFixed(decimals)}%`;
}

export function nowId() {
  return Date.now() + Math.floor(Math.random() * 1_000_000);
}

export function initialCollateralized(): CollateralizedState {
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

export function initialAlgorithmic(): AlgorithmicState {
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
    pegStabilityTicks: 0,

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

export function computeCR(s: CollateralizedState) {
  return s.collateralValue / s.debt;
}

export function stablePriceColor(price: number) {
  const dist = Math.abs(price - 1);
  if (dist < 0.003) return 'text-emerald-300';
  if (dist < 0.02) return 'text-yellow-300';
  return 'text-red-300';
}

export function outcomeLabel(price: number): 'peg' | 'depeg' | 'collapse' {
  if (price >= 0.99 && price <= 1.01) return 'peg';
  if (price >= 0.8) return 'depeg';
  return 'collapse';
}
