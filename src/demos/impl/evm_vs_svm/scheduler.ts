// Solana-style (SVM) scheduling logic for the EVM vs SVM demo.
// Kept free of React so it can be unit-tested (see scheduler.test.ts).

export type AccountId = 'Alice' | 'Bob' | 'DexPool' | 'FeeVault' | 'Oracle';
export type AccessMode = 'r' | 'w';

export type Tx = {
  id: number;
  label: string;
  computeUnits: number;
  // What the tx really touches at runtime (EVM: implicit)
  actual: Record<AccountId, AccessMode>;
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

export type ScheduleDebug = {
  txId: number;
  placedWave: number;
  attempts: Array<{ wave: number; reason: string }>;
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
    const attempts: Array<{ wave: number; reason: string }> = [];

    for (let w = 0; w < waves.length; w++) {
      const wave = waves[w];

      if (wave.txs.length >= threads) {
        attempts.push({ wave: w, reason: 'Wave full (thread limit)' });
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
        attempts.push({
          wave: w,
          reason: `Conflicts on ${Array.from(conflictAccounts).join(', ')} (with TX ${conflictWith.join(', ')})`
        });
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
