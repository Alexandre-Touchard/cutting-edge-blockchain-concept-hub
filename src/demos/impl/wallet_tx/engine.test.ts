import { describe, expect, it } from 'vitest';
import { broadcast, mineBlock, reorgLastBlock, txFromDraft, type Draft } from './engine';
import { effectiveGasPriceGwei, makeInitialWalletTxState, tipGwei, type WalletTxState } from './model';

let clock = 1_000;

function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    type: 'eth_transfer',
    from: 'Alice',
    to: 'Bob',
    nonce: 0,
    valueEth: 0.1,
    daiAmount: 0,
    gasLimit: 21_000,
    maxFeeGwei: 40,
    maxPriorityGwei: 2,
    ...overrides
  };
}

function send(state: WalletTxState, overrides: Partial<Draft> = {}) {
  return broadcast(state, txFromDraft(draft(overrides), clock++));
}

describe('EIP-1559 fee math', () => {
  it('effective gas price is min(maxFee, baseFee + priority)', () => {
    expect(effectiveGasPriceGwei(18, 40, 2)).toBe(20);
    expect(effectiveGasPriceGwei(18, 19, 2)).toBe(19);
  });

  it('the tip is what is left above the base fee, never negative', () => {
    expect(tipGwei(18, 20)).toBe(2);
    expect(tipGwei(18, 15)).toBe(0);
  });
});

describe('broadcast', () => {
  it('adds a valid transaction to the mempool', () => {
    const { next, result } = send(makeInitialWalletTxState());
    expect(result.status).toBe('mempool');
    expect(next.mempool).toHaveLength(1);
  });

  it('marks a transaction whose maxFee is below the base fee as ignored', () => {
    const { result } = send(makeInitialWalletTxState(), { maxFeeGwei: 10 });
    expect(result.status).toBe('ignored');
  });

  it('drops a nonce that was already used', () => {
    let s = send(makeInitialWalletTxState()).next;
    s = mineBlock(s).next;
    const { result } = send(s, { nonce: 0 });
    expect(result.status).toBe('dropped');
    expect(result.error).toMatch(/nonce too low/);
  });

  it('rejects a same-nonce replacement without a ~10% fee bump', () => {
    const s = send(makeInitialWalletTxState()).next;
    const { result, next } = send(s, { maxFeeGwei: 42, maxPriorityGwei: 2.1 });
    expect(result.status).toBe('dropped');
    expect(result.replacementReport?.needsMaxFeeBump).toBe(true);
    expect(next.mempool).toHaveLength(1);
  });

  it('accepts a same-nonce replacement with a sufficient bump', () => {
    const first = send(makeInitialWalletTxState());
    const { result, next } = send(first.next, { maxFeeGwei: 50, maxPriorityGwei: 3 });
    expect(result.status).toBe('mempool');
    expect(next.mempool.map((t) => t.hash)).toEqual([result.hash]);
    expect(next.history[first.result.hash].status).toBe('replaced');
  });
});

describe('mineBlock', () => {
  it('executes a transfer: moves value, burns the base fee, pays the tip, bumps the nonce', () => {
    const s0 = makeInitialWalletTxState();
    const s1 = send(s0).next;
    const { next, included } = mineBlock(s1);

    expect(included).toHaveLength(1);
    const tx = included[0];
    expect(tx.status).toBe('executed_success');
    expect(tx.gasUsed).toBe(21_000);
    expect(tx.burnedEth).toBeCloseTo((18 * 21_000) / 1e9, 12);
    expect(tx.tipPaidEth).toBeCloseTo((2 * 21_000) / 1e9, 12);

    expect(next.accounts.Alice.nonce).toBe(1);
    expect(next.accounts.Alice.eth).toBeCloseTo(1.2 - 0.1 - (20 * 21_000) / 1e9, 12);
    expect(next.accounts.Bob.eth).toBeCloseTo(0.4 + 0.1, 12);
    expect(next.accounts.Miner.eth).toBeCloseTo(tx.tipPaidEth!, 12);
    expect(next.mempool).toHaveLength(0);
  });

  it('orders transactions by tip, highest first', () => {
    let s = send(makeInitialWalletTxState(), { from: 'Alice', maxPriorityGwei: 1 }).next;
    s = send(s, { from: 'Charlie', maxPriorityGwei: 5 }).next;
    const { included } = mineBlock(s);
    expect(included.map((t) => t.from)).toEqual(['Charlie', 'Alice']);
  });

  it('skips a transaction with a nonce gap until the gap is filled', () => {
    let s = send(makeInitialWalletTxState(), { nonce: 1 }).next;
    const r1 = mineBlock(s);
    expect(r1.included).toHaveLength(0);
    expect(r1.next.mempool).toHaveLength(1);

    s = send(r1.next, { nonce: 0 }).next;
    const r2 = mineBlock(s);
    // Like geth: once the gap is filled, both nonces are mined in the same block, in order.
    expect(r2.included.map((t) => t.nonce)).toEqual([0, 1]);
    expect(r2.next.accounts.Alice.nonce).toBe(2);
    expect(r2.next.mempool).toHaveLength(0);
  });

  it('includes a sender’s chain of nonces even when a later one pays a higher tip', () => {
    let s = send(makeInitialWalletTxState(), { nonce: 1, maxPriorityGwei: 10 }).next;
    s = send(s, { nonce: 0, maxPriorityGwei: 1 }).next;
    s = send(s, { from: 'Charlie', maxPriorityGwei: 5 }).next;
    const { included } = mineBlock(s);
    expect(included.map((t) => `${t.from}#${t.nonce}`)).toEqual(['Charlie#0', 'Alice#0', 'Alice#1']);
  });

  it('does not include a tx whose earlier nonce was dropped', () => {
    // Bob cannot afford nonce 0, so nonce 1 must stay pending (nonce gap).
    let s = send(makeInitialWalletTxState(), { from: 'Bob', valueEth: 0.4 }).next;
    s = send(s, { from: 'Bob', nonce: 1, valueEth: 0.01 }).next;
    const { included, dropped, next } = mineBlock(s);
    expect(included).toHaveLength(0);
    expect(dropped.map((t) => t.nonce)).toEqual([0]);
    expect(next.mempool.map((t) => t.nonce)).toEqual([1]);
  });

  it('reverts on out of gas and still charges the full gas limit', () => {
    const s = send(makeInitialWalletTxState(), { gasLimit: 20_000 }).next;
    const { included, next } = mineBlock(s);
    expect(included[0].status).toBe('executed_revert');
    expect(included[0].gasUsed).toBe(20_000);
    expect(next.accounts.Bob.eth).toBeCloseTo(0.4, 12);
    expect(next.accounts.Alice.nonce).toBe(1);
  });

  it('drops a transaction that cannot cover value + gasLimit × maxFee', () => {
    const s = send(makeInitialWalletTxState(), { from: 'Bob', valueEth: 0.4 }).next;
    const { included, dropped } = mineBlock(s);
    expect(included).toHaveLength(0);
    expect(dropped[0].error).toMatch(/insufficient ETH/);
  });

  it('reverts a DEX swap without an ERC-20 allowance', () => {
    const s = send(makeInitialWalletTxState(), { type: 'dex_swap', to: 'DEX', valueEth: 0, daiAmount: 10, gasLimit: 85_000 }).next;
    const { included } = mineBlock(s);
    expect(included[0].status).toBe('executed_revert');
    expect(included[0].error).toMatch(/insufficient allowance/);
  });

  it('a swap succeeds after an approve and spends the allowance', () => {
    let s = send(makeInitialWalletTxState(), { type: 'erc20_approve', to: 'DEX', valueEth: 0, daiAmount: 100, gasLimit: 45_000 }).next;
    s = send(s, { nonce: 1, type: 'dex_swap', to: 'DEX', valueEth: 0, daiAmount: 30, gasLimit: 85_000 }).next;
    const { included, next } = mineBlock(s);
    expect(included.map((t) => t.status)).toEqual(['executed_success', 'executed_success']);
    expect(next.dexAllowance.Alice).toBe(70);
    expect(next.accounts.Alice.dai).toBe(970);
  });

  it('lowers the base fee by 12.5% after an empty block', () => {
    const { next } = mineBlock(makeInitialWalletTxState());
    expect(next.baseFeeGwei).toBeCloseTo(18 * 0.875, 10);
  });

  it('raises the base fee by at most 12.5% after a full block', () => {
    const s = { ...makeInitialWalletTxState(), blockMaxGas: 42_000, blockTargetGas: 21_000 };
    const s1 = send(send(s, { from: 'Alice' }).next, { from: 'Charlie' }).next;
    const { next, included } = mineBlock(s1);
    expect(included).toHaveLength(2);
    expect(next.baseFeeGwei).toBeCloseTo(18 * 1.125, 10);
  });
});

describe('reorgLastBlock', () => {
  it('restores balances and returns the block’s transactions to the mempool', () => {
    const s0 = makeInitialWalletTxState();
    const mined = mineBlock(send(s0).next).next;
    const reorged = reorgLastBlock(mined);

    expect(reorged.blockNumber).toBe(0);
    expect(reorged.accounts.Alice).toEqual(s0.accounts.Alice);
    expect(reorged.mempool).toHaveLength(1);
    expect(reorged.mempool[0].status).toBe('mempool');
    expect(reorged.mempool[0].includedBlockNumber).toBeUndefined();
  });

  it('does nothing when there is no block to rewind', () => {
    const s = makeInitialWalletTxState();
    expect(reorgLastBlock(s)).toBe(s);
  });
});
