// MakerDAO vault model: pure functions and a reducer, no React. Tested in model.test.ts.
//
// A vault locks ETH and lets its owner mint DAI against it, as long as
//   collateral ratio = ETH × price / debt ≥ liquidation ratio (e.g. 150%).
// Below that, anyone can trigger a liquidation: an auction sells just enough ETH to repay
// the debt plus a penalty (13% in the classic ETH-A vault), and the rest of the ETH goes
// back to the owner (Liquidations 2.0). If the ETH sold doesn't cover the debt, the system
// is left with bad debt, which Maker covers from its surplus and then by minting MKR.

export type Vault = { eth: number; debt: number };
export type Wallet = { eth: number; dai: number };
export type Params = {
  /** Liquidation ratio, e.g. 1.5 for 150%. */
  lr: number;
  /** Liquidation penalty added to the debt, e.g. 0.13. */
  penalty: number;
  /** How far below the market price the auction sells (congestion), e.g. 0.2. */
  discount: number;
  /** Oracle Security Module: the price the protocol uses lags the market by one hour. */
  osm: boolean;
};

export const DEFAULT_PARAMS: Params = { lr: 1.5, penalty: 0.13, discount: 0, osm: false };

const EPS = 1e-9;
const r = (x: number, digits = 9) => Math.round(x * 10 ** digits) / 10 ** digits;

export const collateralValue = (v: Vault, price: number) => v.eth * price;

/** Collateral ratio (1.5 = 150%). Infinity with no debt. */
export function ratio(v: Vault, price: number): number {
  return v.debt > EPS ? (v.eth * price) / v.debt : Infinity;
}

/** ETH price at which the vault hits the liquidation ratio (0 with no debt). */
export function liquidationPrice(v: Vault, lr: number): number {
  return v.debt > EPS && v.eth > EPS ? (v.debt * lr) / v.eth : 0;
}

/** Most DAI that can still be minted at this price. */
export const maxMint = (v: Vault, price: number, lr: number) => Math.max(0, r((v.eth * price) / lr - v.debt, 6));

/** Most ETH that can be withdrawn while staying at or above the liquidation ratio. */
export const maxWithdraw = (v: Vault, price: number, lr: number) =>
  v.debt <= EPS ? v.eth : Math.max(0, r(v.eth - (v.debt * lr) / price, 9));

export type Health = 'safe' | 'risky' | 'unsafe' | 'empty';

/** Green above lr + 30 points (180% for 150%), orange between, red below. */
export function health(v: Vault, price: number, lr: number): Health {
  if (v.debt <= EPS) return 'empty';
  const cr = ratio(v, price);
  return cr < lr - EPS ? 'unsafe' : cr < lr + 0.3 ? 'risky' : 'safe';
}

export const isUnsafe = (v: Vault, price: number, lr: number) => v.debt > EPS && ratio(v, price) < lr - EPS;

export type LiquidationResult = {
  debt: number;
  eth: number;
  /** debt × (1 + penalty) */
  owed: number;
  salePrice: number;
  soldEth: number;
  returnedEth: number;
  proceeds: number;
  penaltyCollected: number;
  badDebt: number;
  /** What the owner lost vs repaying: value of the ETH sold (at market) minus the debt cleared. */
  ownerLoss: number;
};

/** Liquidate a vault: sell enough ETH at the auction price to cover debt + penalty. */
export function liquidate(v: Vault, marketPrice: number, p: Pick<Params, 'penalty' | 'discount'>): LiquidationResult {
  const salePrice = marketPrice * (1 - p.discount);
  const owed = v.debt * (1 + p.penalty);
  const needed = owed / salePrice;
  const soldEth = Math.min(v.eth, needed);
  const proceeds = soldEth * salePrice;
  const badDebt = Math.max(0, v.debt - proceeds);
  const penaltyCollected = Math.max(0, Math.min(proceeds - v.debt, owed - v.debt));
  return {
    debt: v.debt,
    eth: v.eth,
    owed: r(owed, 6),
    salePrice: r(salePrice, 6),
    soldEth: r(soldEth),
    returnedEth: r(v.eth - soldEth),
    proceeds: r(proceeds, 6),
    penaltyCollected: r(penaltyCollected, 6),
    badDebt: r(badDebt, 6),
    ownerLoss: r(Math.max(0, soldEth * marketPrice - Math.min(v.debt, proceeds)), 6)
  };
}

// ---------------------------------------------------------------------------
// Other vaults (systemic view)
// ---------------------------------------------------------------------------

export type OtherVault = Vault & { id: string; name: string; liquidation?: LiquidationResult };

/** Eight vaults from 160% to 420% at $2,000. */
export const OTHER_VAULTS: OtherVault[] = [
  { id: 'o1', name: 'Ana', eth: 10, debt: 12_500 },
  { id: 'o2', name: 'Ben', eth: 5, debt: 5_700 },
  { id: 'o3', name: 'Chloé', eth: 8, debt: 8_400 },
  { id: 'o4', name: 'Dmitri', eth: 3, debt: 2_850 },
  { id: 'o5', name: 'Elena', eth: 20, debt: 16_600 },
  { id: 'o6', name: 'Farid', eth: 4, debt: 2_850 },
  { id: 'o7', name: 'Grace', eth: 12, debt: 7_270 },
  { id: 'o8', name: 'Hiro', eth: 6, debt: 2_850 }
];

// ---------------------------------------------------------------------------
// Stress test: a gradual decline over 30 days
// ---------------------------------------------------------------------------

export const STRESS_DAYS = 30;

/** Deterministic path from `start`, falling by `decline` (0.4 = −40%) over 30 days, with small wiggles. */
export function stressPath(start: number, decline: number): number[] {
  return Array.from({ length: STRESS_DAYS + 1 }, (_, d) => {
    const trend = 1 - (decline * d) / STRESS_DAYS;
    const wiggle = d === 0 ? 0 : 0.025 * Math.sin(d * 1.7) + 0.015 * Math.sin(d * 0.6);
    return r(Math.max(start * 0.01, start * (trend + wiggle)), 2);
  });
}

/** First day the price is below the liquidation price, or null if the vault survives. */
export function liquidationDay(path: number[], v: Vault, lr: number): number | null {
  const lp = liquidationPrice(v, lr);
  if (lp <= 0) return null;
  const d = path.findIndex((p) => p < lp - EPS);
  return d < 0 ? null : d;
}

// ---------------------------------------------------------------------------
// Scenarios and reducer
// ---------------------------------------------------------------------------

export type ScenarioId = 'base' | 'safe' | 'aggressive' | 'crash' | 'reaction';

export type LogEntry =
  | { id: number; kind: 'deposit' | 'withdraw' | 'mint' | 'repay'; amount: number }
  | { id: number; kind: 'market'; event: MarketEvent; from: number; to: number; pending: boolean }
  | { id: number; kind: 'oracle'; from: number; to: number }
  | { id: number; kind: 'liquidation'; result: LiquidationResult }
  | { id: number; kind: 'others'; count: number; badDebt: number }
  | { id: number; kind: 'refused'; action: VaultActionKind; reason: RefusalReason }
  | { id: number; kind: 'scenario'; scenario: ScenarioId };

export type VaultActionKind = 'deposit' | 'withdraw' | 'mint' | 'repay';
export type RefusalReason = 'amount' | 'wallet-eth' | 'wallet-dai' | 'vault-eth' | 'unsafe' | 'no-debt';
export type MarketEvent = 'drop' | 'pump' | 'flash';
export const EVENT_FACTOR: Record<MarketEvent, number> = { drop: 0.7, pump: 1.3, flash: 0.5 };

export type Snapshot = { ratio: number; liqPrice: number; eth: number; debt: number };
export type Change = { action: VaultActionKind; amount: number; before: Snapshot; after: Snapshot };

export type Progress = {
  minted: boolean;
  refused: boolean;
  survivedDrop: boolean;
  liquidated: boolean;
  rescued: boolean;
  crashSeen: boolean;
};

export type State = {
  scenario: ScenarioId;
  marketPrice: number;
  oraclePrice: number;
  params: Params;
  vault: Vault;
  wallet: Wallet;
  history: number[];
  others: OtherVault[];
  showOthers: boolean;
  log: LogEntry[];
  lastChange: Change | null;
  lastLiquidation: LiquidationResult | null;
  refusal: { action: VaultActionKind; reason: RefusalReason } | null;
  progress: Progress;
  nextId: number;
};

export type Action =
  | { type: VaultActionKind; amount: number }
  | { type: 'market'; event: MarketEvent }
  | { type: 'advanceOracle' }
  | { type: 'params'; patch: Partial<Params> }
  | { type: 'scenario'; id: ScenarioId };

const NO_PROGRESS: Progress = { minted: false, refused: false, survivedDrop: false, liquidated: false, rescued: false, crashSeen: false };

export function scenarioState(id: ScenarioId, keep?: { progress: Progress; nextId: number; log: LogEntry[]; params: Params }): State {
  const base = {
    base: { vault: { eth: 1, debt: 1000 }, wallet: { eth: 4, dai: 1000 }, market: 2000, oracle: 2000, osm: false },
    safe: { vault: { eth: 10, debt: 5000 }, wallet: { eth: 2, dai: 5000 }, market: 2000, oracle: 2000, osm: false },
    aggressive: { vault: { eth: 1, debt: 1250 }, wallet: { eth: 0.5, dai: 1250 }, market: 2000, oracle: 2000, osm: false },
    crash: { vault: { eth: 1, debt: 1000 }, wallet: { eth: 4, dai: 1000 }, market: 2000, oracle: 2000, osm: false },
    // The market already fell to $1,500; the protocol's oracle will report it in one hour.
    reaction: { vault: { eth: 2, debt: 2200 }, wallet: { eth: 2, dai: 2200 }, market: 1500, oracle: 2000, osm: true }
  }[id];
  const params = { ...(keep?.params ?? DEFAULT_PARAMS), osm: base.osm };
  const nextId = keep?.nextId ?? 1;
  return {
    scenario: id,
    marketPrice: base.market,
    oraclePrice: base.oracle,
    params,
    vault: { ...base.vault },
    wallet: { ...base.wallet },
    history: base.market === base.oracle ? [base.market] : [base.oracle, base.market],
    others: OTHER_VAULTS.map((o) => ({ ...o })),
    showOthers: id === 'crash',
    log: [{ id: nextId, kind: 'scenario' as const, scenario: id }, ...(keep?.log ?? [])].slice(0, 40),
    lastChange: null,
    lastLiquidation: null,
    refusal: null,
    progress: keep?.progress ?? NO_PROGRESS,
    nextId: nextId + 1
  };
}

export const initialState = () => scenarioState('base');

const snap = (v: Vault, price: number, lr: number): Snapshot => ({ ratio: ratio(v, price), liqPrice: liquidationPrice(v, lr), eth: v.eth, debt: v.debt });

type NewLog = LogEntry extends infer T ? (T extends LogEntry ? Omit<T, 'id'> : never) : never;

function pushLog(s: State, e: NewLog): State {
  return { ...s, log: [{ ...e, id: s.nextId } as LogEntry, ...s.log].slice(0, 40), nextId: s.nextId + 1 };
}

/** Is this action allowed? (Maker refuses any action that would leave the vault unsafe.) */
export function checkAction(s: State, kind: VaultActionKind, amount: number): RefusalReason | null {
  if (!(amount > 0) || !Number.isFinite(amount)) return 'amount';
  const { vault, wallet, oraclePrice, params } = s;
  switch (kind) {
    case 'deposit':
      return amount > wallet.eth + EPS ? 'wallet-eth' : null;
    case 'withdraw':
      if (amount > vault.eth + EPS) return 'vault-eth';
      return isUnsafe({ eth: vault.eth - amount, debt: vault.debt }, oraclePrice, params.lr) ? 'unsafe' : null;
    case 'mint':
      return isUnsafe({ eth: vault.eth, debt: vault.debt + amount }, oraclePrice, params.lr) || vault.eth <= EPS ? 'unsafe' : null;
    case 'repay':
      if (vault.debt <= EPS) return 'no-debt';
      return Math.min(amount, vault.debt) > wallet.dai + EPS ? 'wallet-dai' : null;
  }
}

/** Liquidate every unsafe vault at the current oracle price. */
function settle(s: State): State {
  const { oraclePrice, marketPrice, params } = s;
  let next = s;
  if (isUnsafe(s.vault, oraclePrice, params.lr)) {
    const res = liquidate(s.vault, marketPrice, params);
    next = pushLog(
      {
        ...next,
        vault: { eth: 0, debt: 0 },
        wallet: { ...next.wallet, eth: r(next.wallet.eth + res.returnedEth) },
        lastLiquidation: res,
        progress: { ...next.progress, liquidated: true }
      },
      { kind: 'liquidation', result: res }
    );
  }
  let count = 0;
  let bad = 0;
  const others = next.others.map((o) => {
    if (o.liquidation || !isUnsafe(o, oraclePrice, params.lr)) return o;
    const res = liquidate(o, marketPrice, params);
    count++;
    bad += res.badDebt;
    return { ...o, eth: 0, debt: 0, liquidation: res };
  });
  if (count > 0) {
    next = pushLog({ ...next, others }, { kind: 'others', count, badDebt: r(bad, 6) });
    if (next.scenario === 'crash') next = { ...next, progress: { ...next.progress, crashSeen: true } };
  }
  return next;
}

/** Oracle moves to `to`: liquidate, and record a survived drop of 25% or more. */
function updateOracle(s: State, to: number): State {
  const from = s.oraclePrice;
  const hadDebt = s.vault.debt > EPS;
  const after = settle({ ...s, oraclePrice: to });
  const notLiquidated = after.lastLiquidation === s.lastLiquidation;
  const bigDrop = to <= from * 0.75 + EPS;
  return {
    ...after,
    progress: {
      ...after.progress,
      survivedDrop: after.progress.survivedDrop || (bigDrop && hadDebt && notLiquidated),
      // "User reaction": the delayed price arrives and the vault is still alive (or was closed in time).
      rescued: after.progress.rescued || (s.scenario === 'reaction' && to < from && notLiquidated)
    }
  };
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'deposit':
    case 'withdraw':
    case 'mint':
    case 'repay': {
      const reason = checkAction(s, a.type, a.amount);
      if (reason) {
        const refused = pushLog({ ...s, refusal: { action: a.type, reason } }, { kind: 'refused', action: a.type, reason });
        return reason === 'unsafe' ? { ...refused, progress: { ...refused.progress, refused: true } } : refused;
      }
      const amount = a.type === 'repay' ? Math.min(a.amount, s.vault.debt) : a.amount;
      const v = { ...s.vault };
      const w = { ...s.wallet };
      if (a.type === 'deposit') (v.eth = r(v.eth + amount)), (w.eth = r(w.eth - amount));
      if (a.type === 'withdraw') (v.eth = r(v.eth - amount)), (w.eth = r(w.eth + amount));
      if (a.type === 'mint') (v.debt = r(v.debt + amount, 6)), (w.dai = r(w.dai + amount, 6));
      if (a.type === 'repay') (v.debt = r(v.debt - amount, 6)), (w.dai = r(w.dai - amount, 6));
      const change: Change = { action: a.type, amount, before: snap(s.vault, s.oraclePrice, s.params.lr), after: snap(v, s.oraclePrice, s.params.lr) };
      return pushLog(
        {
          ...s,
          vault: v,
          wallet: w,
          lastChange: change,
          refusal: null,
          progress: a.type === 'mint' ? { ...s.progress, minted: true } : s.progress
        },
        { kind: a.type, amount }
      );
    }
    case 'market': {
      const to = r(s.marketPrice * EVENT_FACTOR[a.event], 2);
      let next = pushLog(
        { ...s, marketPrice: to, history: [...s.history, to].slice(-24), refusal: null },
        { kind: 'market', event: a.event, from: s.marketPrice, to, pending: s.params.osm }
      );
      if (!s.params.osm) next = updateOracle(next, to);
      return next;
    }
    case 'advanceOracle': {
      if (Math.abs(s.oraclePrice - s.marketPrice) < EPS) return s;
      const next = pushLog(s, { kind: 'oracle', from: s.oraclePrice, to: s.marketPrice });
      return updateOracle(next, s.marketPrice);
    }
    case 'params': {
      const params = { ...s.params, ...a.patch };
      let next: State = { ...s, params };
      // Turning the oracle delay off applies the pending price at once.
      if (a.patch.osm === false && Math.abs(s.oraclePrice - s.marketPrice) > EPS) return updateOracle(next, s.marketPrice);
      if (a.patch.lr !== undefined) next = settle(next);
      return next;
    }
    case 'scenario':
      return scenarioState(a.id, { progress: s.progress, nextId: s.nextId, log: s.log, params: s.params });
  }
}
