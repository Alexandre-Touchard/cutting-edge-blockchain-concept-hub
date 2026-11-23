import { describe, expect, it } from 'vitest';
import { computeSchedule, defaultTxs, oracleHeavyTxs, type Tx } from './scheduler';
import { accessEdges, evmTimeline, hotAccounts, svmTimeline } from './visuals';

function tx(id: number, declared: Tx['declared'], cu = 10, actual: Tx['actual'] = declared): Tx {
  return { id, label: `tx${id}`, computeUnits: cu, actual, declared };
}

describe('evmTimeline', () => {
  it('lays transactions end to end on one lane', () => {
    const { bars, total } = evmTimeline([tx(1, {}, 60), tx(2, {}, 15), tx(3, {}, 25)]);
    expect(bars.map((b) => [b.start, b.width, b.lane])).toEqual([
      [0, 60, 0],
      [60, 15, 0],
      [75, 25, 0]
    ]);
    expect(total).toBe(100);
  });
});

describe('svmTimeline', () => {
  it('puts each wave after the previous one, one transaction per lane, and marks idle time', () => {
    const txs = [tx(1, { DexPool: 'w' }, 60), tx(2, { DexPool: 'w' }, 60), tx(3, { Oracle: 'r' }, 15)];
    const { waves } = computeSchedule(txs, 2);
    const t = svmTimeline(waves, 2);
    // wave 1: #1 (60) + #3 (15) → lane 1 idles 45; wave 2: #2 alone → lane 1 idles the whole wave
    expect(t.waveStarts).toEqual([0, 60]);
    expect(t.bars.map((b) => [b.txId, b.lane, b.start])).toEqual([
      [1, 0, 0],
      [3, 1, 0],
      [2, 0, 60]
    ]);
    expect(t.idle).toEqual([
      { lane: 1, start: 15, width: 45, wave: 0 },
      { lane: 1, start: 60, width: 60, wave: 1 }
    ]);
    expect(t.total).toBe(120);
  });

  it('matches the scheduler’s total time and is never longer than sequential', () => {
    for (const threads of [1, 2, 3, 4]) {
      const { waves } = computeSchedule(oracleHeavyTxs(), threads);
      const t = svmTimeline(waves, threads);
      expect(t.total).toBe(waves.reduce((a, w) => a + w.time, 0));
      expect(t.total).toBeLessThanOrEqual(evmTimeline(oracleHeavyTxs()).total);
    }
  });

  it('fills every lane of every wave exactly (bars + idle = wave time)', () => {
    const { waves } = computeSchedule(defaultTxs(), 3);
    const t = svmTimeline(waves, 3);
    waves.forEach((w, wi) => {
      for (let lane = 0; lane < 3; lane++) {
        const busy = t.bars.filter((b) => b.wave === wi && b.lane === lane).reduce((a, b) => a + b.width, 0);
        const free = t.idle.filter((s) => s.wave === wi && s.lane === lane).reduce((a, s) => a + s.width, 0);
        expect(busy + free).toBe(w.time);
      }
    });
  });
});

describe('access diagram', () => {
  it('draws declared reads and writes, and flags undeclared accesses', () => {
    const edges = accessEdges(defaultTxs());
    const tx2 = edges.filter((e) => e.txId === 2);
    expect(tx2).toEqual(
      expect.arrayContaining([
        { txId: 2, account: 'Bob', kind: 'w', mode: 'w' },
        { txId: 2, account: 'DexPool', kind: 'w', mode: 'w' },
        { txId: 2, account: 'FeeVault', kind: 'missing', mode: 'w' }
      ])
    );
  });

  it('flags a write declared as read-only', () => {
    expect(accessEdges([tx(1, { Oracle: 'r' }, 10, { Oracle: 'w' })])).toEqual([
      { txId: 1, account: 'Oracle', kind: 'missing', mode: 'w' }
    ]);
  });

  it('marks accounts several transactions use with at least one write', () => {
    expect(hotAccounts([tx(1, { DexPool: 'w', Oracle: 'r' }), tx(2, { DexPool: 'w', Oracle: 'r' }), tx(3, { Alice: 'w' })])).toEqual([
      'DexPool'
    ]);
  });
});
