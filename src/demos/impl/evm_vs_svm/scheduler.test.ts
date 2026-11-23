import { describe, expect, it } from 'vitest';
import {
  computeSchedule,
  conflictPairs,
  conflictingAccounts,
  conflicts,
  declaredCoversActual,
  defaultTxs,
  missingDeclarations,
  oracleHeavyTxs,
  sharedReads,
  writtenAccounts,
  type Tx
} from './scheduler';

function tx(id: number, declared: Tx['declared'], computeUnits = 10): Tx {
  return { id, label: `tx${id}`, computeUnits, actual: declared as Tx['actual'], declared };
}

describe('conflicts', () => {
  it('read/read on the same account does not conflict', () => {
    expect(conflicts({ Oracle: 'r' }, { Oracle: 'r' })).toBe(false);
  });

  it('write/read and write/write on the same account conflict', () => {
    expect(conflicts({ DexPool: 'w' }, { DexPool: 'r' })).toBe(true);
    expect(conflicts({ DexPool: 'r' }, { DexPool: 'w' })).toBe(true);
    expect(conflicts({ DexPool: 'w' }, { DexPool: 'w' })).toBe(true);
  });

  it('disjoint accounts never conflict', () => {
    expect(conflicts({ Alice: 'w' }, { Bob: 'w' })).toBe(false);
  });
});

describe('declarations', () => {
  it('flags an account that is touched but not declared', () => {
    const t = { ...tx(1, { Bob: 'w' }), actual: { Bob: 'w', FeeVault: 'w' } } as Tx;
    expect(missingDeclarations(t)).toEqual([{ account: 'FeeVault', needed: 'present' }]);
    expect(declaredCoversActual(t)).toBe(false);
  });

  it('flags a write declared only as read', () => {
    const t = { ...tx(1, { DexPool: 'r' }), actual: { DexPool: 'w' } } as Tx;
    expect(missingDeclarations(t)).toEqual([{ account: 'DexPool', needed: 'w' }]);
  });

  it('accepts a read covered by a write declaration', () => {
    const t = { ...tx(1, { Oracle: 'w' }), actual: { Oracle: 'r' } } as Tx;
    expect(declaredCoversActual(t)).toBe(true);
  });

  it('the default scenario has exactly one bad declaration (TX 2 misses FeeVault)', () => {
    const bad = defaultTxs().filter((t) => !declaredCoversActual(t));
    expect(bad.map((t) => t.id)).toEqual([2]);
  });
});

describe('computeSchedule', () => {
  it('runs non-conflicting transactions in the same wave', () => {
    const { waves } = computeSchedule([tx(1, { Alice: 'w' }), tx(2, { Bob: 'w' }), tx(3, { Oracle: 'r' })], 4);
    expect(waves).toHaveLength(1);
  });

  it('pushes a conflicting transaction to a later wave', () => {
    const { waves, debug } = computeSchedule([tx(1, { DexPool: 'w' }), tx(2, { DexPool: 'w' })], 4);
    expect(waves.map((w) => w.txs.map((t) => t.id))).toEqual([[1], [2]]);
    expect(debug[1].attempts[0]).toEqual({ wave: 0, kind: 'conflict', accounts: ['DexPool'], withTx: [1] });
  });

  it('never puts more transactions in a wave than there are threads', () => {
    const txs = [1, 2, 3, 4, 5].map((i) => tx(i, { Oracle: 'r' }));
    const { waves } = computeSchedule(txs, 2);
    expect(waves.map((w) => w.txs.length)).toEqual([2, 2, 1]);
    for (const w of waves) expect(w.slotsUsed).toBeLessThanOrEqual(w.slotsTotal);
  });

  it('never places two conflicting transactions in the same wave', () => {
    const txs = [
      tx(1, { Alice: 'w', DexPool: 'w' }),
      tx(2, { Bob: 'w', DexPool: 'w' }),
      tx(3, { Oracle: 'r', DexPool: 'r' }),
      tx(4, { Oracle: 'w' }),
      tx(5, { Alice: 'r' })
    ];
    const { waves } = computeSchedule(txs, 8);
    for (const w of waves)
      for (const a of w.txs) for (const b of w.txs) if (a !== b) expect(conflicts(a.declared, b.declared)).toBe(false);
    expect(waves.flatMap((w) => w.txs).length).toBe(txs.length);
  });

  it('wave time is the slowest transaction in the wave', () => {
    const { waves } = computeSchedule([tx(1, { Alice: 'w' }, 60), tx(2, { Bob: 'w' }, 15)], 4);
    expect(waves[0].time).toBe(60);
  });

  it('merges locks with write taking precedence over read', () => {
    const { waves } = computeSchedule([tx(1, { Alice: 'r' }), tx(2, { Bob: 'w' })], 4);
    expect(waves[0].locks).toEqual({ Alice: 'r', Bob: 'w' });
    expect(waves[0].lockSources).toEqual({ Alice: [1], Bob: [2] });
  });
});

describe('explanations', () => {
  it('reports a full wave as a structured reason', () => {
    const { debug } = computeSchedule([tx(1, { Alice: 'w' }), tx(2, { Bob: 'w' })], 1);
    expect(debug[1].attempts).toEqual([{ wave: 0, kind: 'full' }]);
  });

  it('lists conflicting accounts and shared reads', () => {
    expect(conflictingAccounts({ DexPool: 'w', Oracle: 'r' }, { DexPool: 'r', Oracle: 'r' })).toEqual(['DexPool']);
    expect(sharedReads({ DexPool: 'w', Oracle: 'r' }, { DexPool: 'r', Oracle: 'r' })).toEqual(['Oracle']);
  });

  it('lists every conflicting pair with lock modes', () => {
    const pairs = conflictPairs([tx(1, { DexPool: 'w' }), tx(2, { DexPool: 'r' }), tx(3, { Oracle: 'r' }), tx(4, { Oracle: 'r' })]);
    expect(pairs).toEqual([{ a: 1, b: 2, accounts: [{ account: 'DexPool', modes: 'W/R' }] }]);
  });

  it('reports the accounts a transaction writes', () => {
    expect(writtenAccounts(defaultTxs()[0])).toEqual(['Alice', 'DexPool', 'FeeVault']);
    expect(writtenAccounts(tx(9, { Oracle: 'r' }))).toEqual([]);
  });
});

describe('oracle-heavy preset', () => {
  it('packs the reads together and isolates the write', () => {
    const { waves } = computeSchedule(oracleHeavyTxs(), 4);
    // reads 1-3 share a read lock; the write (4) needs its own wave; read 5 joins the first wave
    expect(waves.map((w) => w.txs.map((t) => t.id))).toEqual([[1, 2, 3, 5], [4]]);
    expect(waves[1].locks).toEqual({ Oracle: 'w' });
  });
});
