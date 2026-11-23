import { describe, expect, it } from 'vitest';
import {
  checkAction,
  health,
  initialState,
  liquidate,
  liquidationDay,
  liquidationPrice,
  maxMint,
  maxWithdraw,
  ratio,
  reducer,
  scenarioState,
  stressPath,
  type Action,
  type State
} from './model';

const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s);

describe('vault maths', () => {
  it('matches the base scenario of the spec: 1 ETH at $2,000 with 1,000 DAI is 200%, liquidated below $1,500', () => {
    const v = { eth: 1, debt: 1000 };
    expect(ratio(v, 2000)).toBe(2);
    expect(liquidationPrice(v, 1.5)).toBe(1500);
    expect(maxMint(v, 2000, 1.5)).toBeCloseTo(333.333333, 5);
    expect(maxWithdraw(v, 2000, 1.5)).toBeCloseTo(0.25, 9);
    expect(health(v, 2000, 1.5)).toBe('safe');
    expect(health(v, 1700, 1.5)).toBe('risky'); // 170%
    expect(health(v, 1400, 1.5)).toBe('unsafe');
    expect(health({ eth: 1, debt: 0 }, 2000, 1.5)).toBe('empty');
  });

  it('liquidation sells just enough ETH for debt + penalty and returns the rest', () => {
    const res = liquidate({ eth: 1, debt: 1000 }, 1400, { penalty: 0.13, discount: 0 });
    expect(res.owed).toBeCloseTo(1130, 6);
    expect(res.soldEth).toBeCloseTo(1130 / 1400, 9);
    expect(res.returnedEth).toBeCloseTo(1 - 1130 / 1400, 9);
    expect(res.penaltyCollected).toBeCloseTo(130, 6);
    expect(res.badDebt).toBe(0);
    expect(res.ownerLoss).toBeCloseTo(130, 6); // the penalty
  });

  it('a deep crash leaves bad debt the system must cover', () => {
    const res = liquidate({ eth: 1, debt: 1000 }, 800, { penalty: 0.13, discount: 0 });
    expect(res.soldEth).toBe(1);
    expect(res.returnedEth).toBe(0);
    expect(res.badDebt).toBeCloseTo(200, 6);
    expect(res.penaltyCollected).toBe(0);
  });

  it('a congested auction (discount) sells more ETH', () => {
    const calm = liquidate({ eth: 1, debt: 1000 }, 1400, { penalty: 0.13, discount: 0 });
    const stressed = liquidate({ eth: 1, debt: 1000 }, 1400, { penalty: 0.13, discount: 0.2 });
    expect(stressed.soldEth).toBeGreaterThan(calm.soldEth);
    expect(stressed.ownerLoss).toBeGreaterThan(calm.ownerLoss);
  });
});

describe('reducer', () => {
  it('mint lowers the ratio and raises the liquidation price; minting past the limit is refused', () => {
    let s = run(initialState(), { type: 'mint', amount: 200 });
    expect(s.vault.debt).toBe(1200);
    expect(s.wallet.dai).toBe(1200);
    expect(s.lastChange!.before.ratio).toBe(2);
    expect(s.lastChange!.after.liqPrice).toBe(1800);
    expect(s.progress.minted).toBe(true);
    s = run(s, { type: 'mint', amount: 200 }); // would be 142%
    expect(s.vault.debt).toBe(1200);
    expect(s.refusal).toEqual({ action: 'mint', reason: 'unsafe' });
    expect(s.progress.refused).toBe(true);
  });

  it('refuses unsafe withdrawals and spending what you don’t have', () => {
    const s = initialState();
    expect(checkAction(s, 'withdraw', 0.3)).toBe('unsafe');
    expect(checkAction(s, 'withdraw', 0.25)).toBeNull();
    expect(checkAction(s, 'deposit', 5)).toBe('wallet-eth');
    expect(checkAction(s, 'repay', 2000)).toBeNull(); // clamped to the debt
    expect(checkAction(s, 'mint', -1)).toBe('amount');
    const repaid = run(s, { type: 'repay', amount: 5000 });
    expect(repaid.vault.debt).toBe(0);
    expect(repaid.wallet.dai).toBe(0);
    expect(checkAction(repaid, 'repay', 1)).toBe('no-debt');
    expect(checkAction(repaid, 'withdraw', 1)).toBeNull(); // no debt: everything can come out
  });

  it('ETH −30% liquidates the base vault (140% < 150%) but the safe vault survives two drops', () => {
    const base = run(initialState(), { type: 'market', event: 'drop' });
    expect(base.marketPrice).toBe(1400);
    expect(base.progress.liquidated).toBe(true);
    expect(base.vault).toEqual({ eth: 0, debt: 0 });
    expect(base.wallet.dai).toBe(1000); // you keep the DAI you minted
    expect(base.wallet.eth).toBeCloseTo(4 + 1 - 1130 / 1400, 9);

    const safe = run(scenarioState('safe'), { type: 'market', event: 'drop' }, { type: 'market', event: 'drop' });
    expect(safe.progress.survivedDrop).toBe(true);
    expect(safe.progress.liquidated).toBe(false);
  });

  it('aggressive vault: a small dip liquidates it; adding collateral first saves it', () => {
    const a = scenarioState('aggressive');
    expect(liquidationPrice(a.vault, 1.5)).toBe(1875);
    expect(run(a, { type: 'market', event: 'drop' }).progress.liquidated).toBe(true);
  });

  it('market crash liquidates several other vaults and records bad debt', () => {
    const s = run(scenarioState('crash'), { type: 'market', event: 'flash' });
    const liquidated = s.others.filter((o) => o.liquidation);
    expect(liquidated.map((o) => o.name)).toEqual(['Ana', 'Ben', 'Chloé', 'Dmitri', 'Elena', 'Farid']);
    expect(liquidated.reduce((t, o) => t + o.liquidation!.badDebt, 0)).toBeGreaterThan(0);
    expect(s.progress.crashSeen).toBe(true);
  });

  it('user reaction: with the oracle delay, acting before the hour passes saves the vault', () => {
    const start = scenarioState('reaction');
    expect(start.params.osm).toBe(true);
    // Doing nothing: liquidated when the oracle catches up.
    const lazy = run(start, { type: 'advanceOracle' });
    expect(lazy.progress.liquidated).toBe(true);
    expect(lazy.progress.rescued).toBe(false);
    // Adding 0.5 ETH first: 2.5 × 1500 / 2200 = 170%.
    const saved = run(start, { type: 'deposit', amount: 0.5 }, { type: 'advanceOracle' });
    expect(saved.oraclePrice).toBe(1500);
    expect(saved.progress.liquidated).toBe(false);
    expect(saved.progress.rescued).toBe(true);
    // Repaying 300 DAI also works: 2 × 1500 / 1900 = 158%.
    expect(run(start, { type: 'repay', amount: 300 }, { type: 'advanceOracle' }).progress.rescued).toBe(true);
  });

  it('with the oracle delay, a market drop is pending until the hour passes', () => {
    const s = run(initialState(), { type: 'params', patch: { osm: true } }, { type: 'market', event: 'drop' });
    expect(s.marketPrice).toBe(1400);
    expect(s.oraclePrice).toBe(2000);
    expect(s.progress.liquidated).toBe(false);
    const later = run(s, { type: 'advanceOracle' });
    expect(later.oraclePrice).toBe(1400);
    expect(later.progress.liquidated).toBe(true);
  });

  it('raising the liquidation ratio can make a vault unsafe', () => {
    const s = run(scenarioState('aggressive'), { type: 'params', patch: { lr: 1.7 } });
    expect(s.progress.liquidated).toBe(true);
  });

  it('keeps quest progress across scenarios', () => {
    const s = run(initialState(), { type: 'mint', amount: 100 }, { type: 'scenario', id: 'safe' });
    expect(s.progress.minted).toBe(true);
    expect(s.vault).toEqual({ eth: 10, debt: 5000 });
  });
});

describe('stress test', () => {
  it('finds the first day below the liquidation price', () => {
    const path = stressPath(2000, 0.4);
    expect(path).toHaveLength(31);
    expect(path[0]).toBe(2000);
    expect(path[30]).toBeLessThan(1300);
    const day = liquidationDay(path, { eth: 1, debt: 1000 }, 1.5)!;
    expect(day).toBeGreaterThan(0);
    expect(path[day]).toBeLessThan(1500);
    expect(path.slice(0, day).every((p) => p >= 1500)).toBe(true);
    expect(liquidationDay(path, { eth: 10, debt: 5000 }, 1.5)).toBeNull();
  });
});
