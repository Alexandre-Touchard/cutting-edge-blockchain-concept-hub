// Layout for the EVM vs SVM diagrams (no React, unit-tested in visuals.test.ts):
// - execution timeline (Gantt): when each transaction runs, on which lane
// - access diagram: which transaction reads/writes which account, and where they conflict
import type { AccessMode, AccountId, Tx, Wave } from './scheduler';

export type GanttBar = { txId: number; lane: number; start: number; width: number; wave: number };
export type IdleSpan = { lane: number; start: number; width: number; wave: number };

/** EVM: one lane, transactions end to end in list order. */
export function evmTimeline(txs: Tx[]): { bars: GanttBar[]; total: number } {
  let t = 0;
  const bars = txs.map((tx, i) => {
    const bar = { txId: tx.id, lane: 0, start: t, width: tx.computeUnits, wave: i };
    t += tx.computeUnits;
    return bar;
  });
  return { bars, total: t };
}

/**
 * Solana-style: one lane per thread. Each wave starts when the previous one ends (lockstep);
 * its transactions take one lane each, and lanes that finish early (or stay empty) are idle.
 */
export function svmTimeline(
  waves: Wave[],
  threads: number
): { bars: GanttBar[]; idle: IdleSpan[]; waveStarts: number[]; total: number } {
  const bars: GanttBar[] = [];
  const idle: IdleSpan[] = [];
  const waveStarts: number[] = [];
  let t = 0;
  waves.forEach((w, wi) => {
    waveStarts.push(t);
    for (let lane = 0; lane < threads; lane++) {
      const tx = w.txs[lane];
      if (tx) {
        bars.push({ txId: tx.id, lane, start: t, width: tx.computeUnits, wave: wi });
        if (tx.computeUnits < w.time) idle.push({ lane, start: t + tx.computeUnits, width: w.time - tx.computeUnits, wave: wi });
      } else {
        idle.push({ lane, start: t, width: w.time, wave: wi });
      }
    }
    t += w.time;
  });
  return { bars, idle, waveStarts, total: t };
}

export type EdgeKind = 'r' | 'w' | 'missing';
export type AccessEdge = { txId: number; account: AccountId; kind: EdgeKind; mode: AccessMode };

/**
 * Edges of the access diagram. Declared reads/writes are edges; an access the transaction
 * performs without declaring it (or declares read-only but writes) is a "missing" edge.
 */
export function accessEdges(txs: Tx[]): AccessEdge[] {
  const out: AccessEdge[] = [];
  for (const tx of txs) {
    const accounts = new Set([...Object.keys(tx.declared), ...Object.keys(tx.actual)] as AccountId[]);
    for (const account of accounts) {
      const declared = tx.declared[account];
      const actual = tx.actual[account];
      if (actual && (!declared || (actual === 'w' && declared !== 'w'))) {
        out.push({ txId: tx.id, account, kind: 'missing', mode: actual });
      } else if (declared) {
        out.push({ txId: tx.id, account, kind: declared, mode: declared });
      }
    }
  }
  return out;
}

/** Accounts declared by 2+ transactions with at least one write: where transactions must wait. */
export function hotAccounts(txs: Tx[]): AccountId[] {
  const users = new Map<AccountId, { count: number; writes: number }>();
  for (const tx of txs) {
    for (const [account, mode] of Object.entries(tx.declared) as Array<[AccountId, AccessMode]>) {
      const u = users.get(account) ?? { count: 0, writes: 0 };
      u.count += 1;
      if (mode === 'w') u.writes += 1;
      users.set(account, u);
    }
  }
  return [...users.entries()].filter(([, u]) => u.count >= 2 && u.writes >= 1).map(([a]) => a);
}
