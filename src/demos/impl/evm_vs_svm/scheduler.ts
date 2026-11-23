// Solana-style (SVM) scheduling logic for the EVM vs SVM demo.
// Kept free of React so it can be unit-tested (see scheduler.test.ts).

export type AccountId = 'Alice' | 'Bob' | 'DexPool' | 'FeeVault' | 'Oracle';
export type AccessMode = 'r' | 'w';

export type Tx = {
  id: number;
  label: string;
  computeUnits: number;
  // What the tx really touches at runtime (EVM: implicit)
  actual: Partial<Record<AccountId, AccessMode>>;
  // What the tx declares ahead of time (Solana-style account locks)
  declared: Partial<Record<AccountId, AccessMode>>;
};

export type Wave = {
  txs: Tx[];
  time: number; // max CU in wave
  // Solana-style account locks implied by declarations (W dominates R)
  locks: Partial<Record<AccountId, AccessMode>>;
  // For each locked account, which tx ids contributed to the lock (useful for explanations)
  lockSources: Partial<Record<AccountId, number[]>>;
  slotsUsed: number;
  slotsTotal: number;
};

/** Why a transaction could not join an earlier wave (structured, so the UI can translate it). */
export type ScheduleAttempt =
  | { wave: number; kind: 'full' }
  | { wave: number; kind: 'conflict'; accounts: AccountId[]; withTx: number[] };

export type ScheduleDebug = {
  txId: number;
  placedWave: number;
  attempts: ScheduleAttempt[];
};

export function missingDeclarations(tx: Tx): Array<{ account: AccountId; needed: AccessMode | 'present' }> {
  const missing: Array<{ account: AccountId; needed: AccessMode | 'present' }> = [];

  for (const [acct, mode] of Object.entries(tx.actual) as Array<[AccountId, AccessMode]>) {
    const d = tx.declared[acct];
    if (!d) {
      missing.push({ account: acct, needed: 'present' });
      continue;
    }
    if (mode === 'w' && d !== 'w') {
      missing.push({ account: acct, needed: 'w' });
    }
  }

  return missing;
}

export function declaredCoversActual(tx: Tx): boolean {
  for (const [acct, mode] of Object.entries(tx.actual) as Array<[AccountId, AccessMode]>) {
    const d = tx.declared[acct];
    if (!d) return false;
    // write requires write declaration
    if (mode === 'w' && d !== 'w') return false;
  }
  return true;
}

export function conflicts(a: Partial<Record<AccountId, AccessMode>>, b: Partial<Record<AccountId, AccessMode>>): boolean {
  // RW conflicts (account locks):
  // - read/read does not conflict
  // - any write conflicts if same account is touched
  for (const acct of Object.keys({ ...a, ...b }) as AccountId[]) {
    const am = a[acct];
    const bm = b[acct];
    if (!am || !bm) continue;
    if (am === 'w' || bm === 'w') return true;
  }
  return false;
}

export function mergeLocks(into: Partial<Record<AccountId, AccessMode>>, add: Partial<Record<AccountId, AccessMode>>) {
  for (const [acct, mode] of Object.entries(add) as Array<[AccountId, AccessMode]>) {
    const cur = into[acct];
    // write dominates
    if (!cur) into[acct] = mode;
    else if (cur === 'r' && mode === 'w') into[acct] = 'w';
  }
}

export function mergeLockSources(into: Partial<Record<AccountId, number[]>>, tx: Tx) {
  for (const acct of Object.keys(tx.declared) as AccountId[]) {
    const cur = into[acct] ?? [];
    into[acct] = cur.includes(tx.id) ? cur : [...cur, tx.id];
  }
}

export function computeSchedule(txs: Tx[], threads: number): { waves: Wave[]; debug: ScheduleDebug[] } {
  const waves: Array<{
    txs: Tx[];
    locks: Partial<Record<AccountId, AccessMode>>;
    lockSources: Partial<Record<AccountId, number[]>>;
  }> = [];
  const debug: ScheduleDebug[] = [];

  for (const tx of txs) {
    let placedWave = -1;
    const attempts: ScheduleAttempt[] = [];

    for (let w = 0; w < waves.length; w++) {
      const wave = waves[w];

      if (wave.txs.length >= threads) {
        attempts.push({ wave: w, kind: 'full' });
        continue;
      }

      // If it conflicts with the wave's current locks, it can't be scheduled here.
      const hasConflict = wave.txs.some((wtx) => conflicts(wtx.declared, tx.declared));
      if (hasConflict) {
        // Produce a human explanation: which accounts conflict and with which txs
        const conflictAccounts = new Set<AccountId>();
        const conflictWith: number[] = [];
        for (const wtx of wave.txs) {
          if (!conflicts(wtx.declared, tx.declared)) continue;
          conflictWith.push(wtx.id);
          for (const acct of Object.keys({ ...wtx.declared, ...tx.declared }) as AccountId[]) {
            const am = wtx.declared[acct];
            const bm = tx.declared[acct];
            if (!am || !bm) continue;
            if (am === 'w' || bm === 'w') conflictAccounts.add(acct);
          }
        }
        attempts.push({ wave: w, kind: 'conflict', accounts: Array.from(conflictAccounts), withTx: conflictWith });
        continue;
      }

      // Fits this wave
      wave.txs.push(tx);
      mergeLocks(wave.locks, tx.declared);
      mergeLockSources(wave.lockSources, tx);
      placedWave = w;
      break;
    }

    if (placedWave === -1) {
      // Create a new wave
      const locks: Partial<Record<AccountId, AccessMode>> = {};
      mergeLocks(locks, tx.declared);
      const lockSources: Partial<Record<AccountId, number[]>> = {};
      mergeLockSources(lockSources, tx);
      waves.push({ txs: [tx], locks, lockSources });
      placedWave = waves.length - 1;
    }

    debug.push({ txId: tx.id, placedWave, attempts });
  }

  const finalWaves: Wave[] = waves.map((w) => ({
    txs: w.txs,
    time: Math.max(...w.txs.map((t) => t.computeUnits)),
    locks: w.locks,
    lockSources: w.lockSources,
    slotsUsed: w.txs.length,
    slotsTotal: threads
  }));

  return { waves: finalWaves, debug };
}

export function defaultTxs(): Tx[] {
  // TX #2 intentionally has a missing declared account (FeeVault) to show why SVM requires declarations.
  return [
    {
      id: 1,
      label: 'Alice swaps (writes DexPool) + fee vault write',
      computeUnits: 60,
      actual: { Alice: 'w', DexPool: 'w', FeeVault: 'w' },
      declared: { Alice: 'w', DexPool: 'w', FeeVault: 'w' }
    },
    {
      id: 2,
      label: 'Bob swaps (writes DexPool) + fee vault write',
      computeUnits: 60,
      actual: { Bob: 'w', DexPool: 'w', FeeVault: 'w' },
      // Missing FeeVault declaration on purpose:
      declared: { Bob: 'w', DexPool: 'w' }
    },
    {
      id: 3,
      label: 'Oracle read (read-only)',
      computeUnits: 15,
      actual: { Oracle: 'r' },
      declared: { Oracle: 'r' }
    },
    {
      id: 4,
      label: 'Oracle read (read-only)',
      computeUnits: 15,
      actual: { Oracle: 'r' },
      declared: { Oracle: 'r' }
    }
  ];
}

export function sumCu(txs: Tx[]) {
  return txs.reduce((a, t) => a + t.computeUnits, 0);
}

/** Accounts on which two access sets conflict (same account, at least one write). */
export function conflictingAccounts(a: Partial<Record<AccountId, AccessMode>>, b: Partial<Record<AccountId, AccessMode>>): AccountId[] {
  return (Object.keys({ ...a, ...b }) as AccountId[]).filter((acct) => {
    const am = a[acct];
    const bm = b[acct];
    return !!am && !!bm && (am === 'w' || bm === 'w');
  });
}

/** Accounts both sets only read: shared read locks, which never conflict. */
export function sharedReads(a: Partial<Record<AccountId, AccessMode>>, b: Partial<Record<AccountId, AccessMode>>): AccountId[] {
  return (Object.keys(a) as AccountId[]).filter((acct) => a[acct] === 'r' && b[acct] === 'r');
}

export type ConflictPair = { a: number; b: number; accounts: Array<{ account: AccountId; modes: string }> };

/** Every pair of transactions whose declarations conflict, with the accounts and lock modes (e.g. "W/W"). */
export function conflictPairs(txs: Tx[]): ConflictPair[] {
  const out: ConflictPair[] = [];
  for (let i = 0; i < txs.length; i++) {
    for (let j = i + 1; j < txs.length; j++) {
      const accts = conflictingAccounts(txs[i].declared, txs[j].declared);
      if (accts.length === 0) continue;
      out.push({
        a: txs[i].id,
        b: txs[j].id,
        accounts: accts.map((account) => ({
          account,
          modes: `${txs[i].declared[account]!.toUpperCase()}/${txs[j].declared[account]!.toUpperCase()}`
        }))
      });
    }
  }
  return out;
}

/** Accounts a transaction actually writes: its state changes when it succeeds. */
export function writtenAccounts(tx: Tx): AccountId[] {
  return (Object.entries(tx.actual) as Array<[AccountId, AccessMode]>).filter(([, m]) => m === 'w').map(([a]) => a);
}

/** Preset: many transactions read the oracle, one updates it (read locks are shared; the write is exclusive). */
export function oracleHeavyTxs(): Tx[] {
  return [
    { id: 1, label: 'Oracle read', computeUnits: 15, actual: { Oracle: 'r' }, declared: { Oracle: 'r' } },
    { id: 2, label: 'Oracle read', computeUnits: 15, actual: { Oracle: 'r' }, declared: { Oracle: 'r' } },
    { id: 3, label: 'Oracle read', computeUnits: 15, actual: { Oracle: 'r' }, declared: { Oracle: 'r' } },
    { id: 4, label: 'Oracle write (conflicts with oracle reads)', computeUnits: 30, actual: { Oracle: 'w' }, declared: { Oracle: 'w' } },
    { id: 5, label: 'Oracle read', computeUnits: 15, actual: { Oracle: 'r' }, declared: { Oracle: 'r' } }
  ];
}
