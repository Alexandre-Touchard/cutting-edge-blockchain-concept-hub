import {
  clamp,
  effectiveGasPriceGwei,
  gweiGasToEth,
  makeTxHash,
  requiredGas,
  tipGwei,
  type Address,
  type Tx,
  type ChainBlock,
  type EOA,
  type ReorgLog,
  type TxStatus,
  type WalletTxSnapshot,
  type WalletTxState
} from './model';

function makeToyPermitSig(owner: 'Alice' | 'Bob', valueDai: number, nonce: number, deadlineBlock: number): string {
  // Not real cryptography; just a deterministic-looking string for UI.
  return `permit(${owner},${valueDai},nonce=${nonce},dl=${deadlineBlock})`;
}


export type Draft = {
  type: Tx['type'];
  from: Tx['from'];
  to: Address;
  nonce: number;
  valueEth: number;
  daiAmount: number;
  gasLimit: number;
  maxFeeGwei: number;
  maxPriorityGwei: number;
};

export type UnsignedTx = Omit<Tx, 'status' | 'firstSeenBlock'>;

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function snapshotOf(state: WalletTxState): WalletTxSnapshot {
  return deepClone({
    baseFeeGwei: state.baseFeeGwei,
    blockNumber: state.blockNumber,
    blockMaxGas: state.blockMaxGas,
    blockTargetGas: state.blockTargetGas,
    lastBlockGasUsed: state.lastBlockGasUsed,
    lastReorg: state.lastReorg,
    permitNonce: state.permitNonce,
    accounts: state.accounts,
    dexAllowance: state.dexAllowance,
    mempool: state.mempool,
    history: state.history,
    blocks: state.blocks
  });
}

export function reorgLastBlock(state: WalletTxState): WalletTxState {
  if (!state.reorgSnapshot) return state;

  const headBlock = state.blocks[0];

  // Restore the pre-block snapshot.
  const restored: WalletTxState = { ...deepClone(state.reorgSnapshot), reorgSnapshot: null };

  const reorgLog: ReorgLog | null = headBlock
    ? { blockNumber: headBlock.number, txHashes: headBlock.txHashes, timestampMs: Date.now() }
    : null;

  restored.lastReorg = reorgLog;

  // More realistic UX: explicitly return the reorged block's txs back to the mempool
  // (clearing inclusion/execution fields) so users see them become pending again.
  if (!headBlock || headBlock.txHashes.length === 0) {
    return restored;
  }

  const pendingReturned: Tx[] = [];

  for (const hash of headBlock.txHashes) {
    const tx = state.history[hash] ?? restored.history[hash];
    if (!tx) continue;

    const ignored = tx.maxFeeGwei < restored.baseFeeGwei;

    const pending: Tx = {
      ...tx,
      status: ignored ? 'ignored' : 'mempool',
      includedBlockNumber: undefined,
      baseFeeGwei: undefined,
      effectiveGasPriceGwei: undefined,
      gasUsed: undefined,
      feePaidEth: undefined,
      burnedEth: undefined,
      tipPaidEth: undefined,
      // Keep existing firstSeenBlock; it reflects when the tx originally entered the mempool.
      error: ignored
        ? 'Ignored: max fee is below current base fee.'
        : 'Reorg: returned to mempool (this demo rewound the last block).'
    };

    restored.history[hash] = pending;
    pendingReturned.push(pending);
  }

  const existing = new Set(restored.mempool.map((t) => t.hash));
  restored.mempool = [...pendingReturned.filter((t) => !existing.has(t.hash)), ...restored.mempool];

  return restored;
}


export function txFromDraft(d: Draft, nowMs: number): UnsignedTx {
  // NOTE: firstSeenBlock is assigned on broadcast, because it depends on the current chain state.

  const seed = `${d.type}:${d.from}:${d.to}:${d.nonce}:${d.valueEth}:${d.daiAmount}:${d.gasLimit}:${d.maxFeeGwei}:${d.maxPriorityGwei}:${nowMs}`;
  return {
    hash: makeTxHash(seed),
    type: d.type,
    from: d.from,
    to: d.to,
    nonce: d.nonce,
    signedAtMs: nowMs,
    broadcastAtMs: nowMs,
    valueEth: d.valueEth,
    daiAmount: d.daiAmount,
    gasLimit: d.gasLimit,
    maxFeeGwei: d.maxFeeGwei,
    maxPriorityGwei: d.maxPriorityGwei,
    createdAtMs: nowMs
  };
}

export function rememberTx(state: WalletTxState, tx: Tx): WalletTxState {
  return { ...state, history: { ...state.history, [tx.hash]: tx } };
}

export function broadcast(state: WalletTxState, tx: UnsignedTx): { next: WalletTxState; result: Tx } {
  const isIgnored = tx.maxFeeGwei < state.baseFeeGwei;
  const candidate: Tx = {
    ...tx,
    firstSeenBlock: state.blockNumber,
    status: isIgnored ? 'ignored' : 'mempool',
    error: isIgnored ? 'Ignored: max fee is below current base fee.' : undefined
  };

  const existing = state.mempool.find(
    (p) => (p.status === 'mempool' || p.status === 'ignored') && p.from === candidate.from && p.nonce === candidate.nonce
  );

  // Preserve firstSeenBlock for replacements so TTL is stable.
  if (existing) {
    candidate.firstSeenBlock = existing.firstSeenBlock;
  }
  if (!existing) {
    let next: WalletTxState = { ...state, mempool: [candidate, ...state.mempool] };
    next = rememberTx(next, candidate);
    return { next, result: candidate };
  }

  const effOld = effectiveGasPriceGwei(state.baseFeeGwei, existing.maxFeeGwei, existing.maxPriorityGwei);
  const effNew = effectiveGasPriceGwei(state.baseFeeGwei, candidate.maxFeeGwei, candidate.maxPriorityGwei);
  const tipOld = tipGwei(state.baseFeeGwei, effOld);
  const tipNew = tipGwei(state.baseFeeGwei, effNew);

  // Replacement rule (closer to geth): require a fee bump (~10%) on both maxFee and maxPriority.
  // (Toy approximation; real clients use per-pool policies.)
  const bumpFactor = 1.1;
  const minBump = 0.0001; // gwei

  const requiredMaxFeeGwei = Math.max(existing.maxFeeGwei * bumpFactor, existing.maxFeeGwei + minBump);
  const requiredMaxPriorityGwei = Math.max(existing.maxPriorityGwei * bumpFactor, existing.maxPriorityGwei + minBump);

  const needsMaxFeeBump = candidate.maxFeeGwei < requiredMaxFeeGwei;
  const needsPriorityBump = candidate.maxPriorityGwei < requiredMaxPriorityGwei;
  const tipImproved = tipNew > tipOld;

  // Additionally: if it doesn't increase *current* tip, miners still won't prefer it.
  if (needsMaxFeeBump || needsPriorityBump || !tipImproved) {
    const dropped: Tx = {
      ...candidate,
      status: 'dropped',
      error: 'Replacement rejected: fee bump requirements not met.',
      replacementReport: {
        replacedTxHash: existing.hash,
        baseFeeGwei: state.baseFeeGwei,

        existingMaxFeeGwei: existing.maxFeeGwei,
        existingMaxPriorityGwei: existing.maxPriorityGwei,
        requiredMaxFeeGwei,
        requiredMaxPriorityGwei,

        newMaxFeeGwei: candidate.maxFeeGwei,
        newMaxPriorityGwei: candidate.maxPriorityGwei,

        existingEffectiveGasPriceGwei: effOld,
        newEffectiveGasPriceGwei: effNew,
        existingTipGwei: tipOld,
        newTipGwei: tipNew,

        needsMaxFeeBump,
        needsPriorityBump,
        tipImproved
      }
    };
    const next = rememberTx(state, dropped);
    return { next, result: dropped };
  }

  const replaced: Tx = { ...existing, status: 'replaced', replacedBy: candidate.hash };

  let next: WalletTxState = {
    ...state,
    mempool: [candidate, ...state.mempool.filter((t) => t.hash !== existing.hash)]
  };
  next = rememberTx(next, replaced);
  next = rememberTx(next, candidate);
  return { next, result: candidate };
}

export type MineResult = { next: WalletTxState; included: Tx[]; dropped: Tx[] };

export function mineBlock(state: WalletTxState): MineResult {
  const baseFee = state.baseFeeGwei;
  const blockMaxGas = state.blockMaxGas;
  const targetGas = state.blockTargetGas;

  // We know the next block number deterministically.
  const newBlockNumber = state.blockNumber + 1;

  const beforeMineSnapshot = snapshotOf(state);
  const nextAccounts = JSON.parse(JSON.stringify(state.accounts)) as WalletTxState['accounts'];
  const nextAllowance = JSON.parse(JSON.stringify(state.dexAllowance)) as WalletTxState['dexAllowance'];
  let nextPermitNonce = { ...state.permitNonce };

  const expectedNonce = {
    Alice: nextAccounts.Alice.nonce,
    Bob: nextAccounts.Bob.nonce,
    Charlie: nextAccounts.Charlie.nonce,
    Dave: nextAccounts.Dave.nonce
  } as Record<EOA, number>;

  const candidates = state.mempool
    // Only mine txs that are currently viable at this base fee.
    .filter((t) => t.status === 'mempool' && t.maxFeeGwei >= baseFee)
    .map((t) => {
      const eff = effectiveGasPriceGwei(baseFee, t.maxFeeGwei, t.maxPriorityGwei);
      const tip = tipGwei(baseFee, eff);
      return { t, eff, tip };
    })
    .sort((a, b) => b.tip - a.tip || a.t.createdAtMs - b.t.createdAtMs);

  const included: Tx[] = [];
  const dropped: Tx[] = [];
  let blockGasUsed = 0;

  for (const c of candidates) {
    if (included.length >= 6) break;
    if (blockGasUsed >= blockMaxGas) break;
    const t = c.t;
    if (t.nonce !== expectedNonce[t.from]) continue;

    const needed = requiredGas(t.type);
    const outOfGas = t.gasLimit < needed;
    const gasUsed = outOfGas ? t.gasLimit : needed;

    // If the block is already close to full, skip this tx.
    if (blockGasUsed + gasUsed > blockMaxGas) continue;

    const feePaidEth = gweiGasToEth(c.eff, gasUsed);
    const burnedEth = gweiGasToEth(baseFee, gasUsed);
    const tipPaidEth = gweiGasToEth(c.tip, gasUsed);

    const sender = nextAccounts[t.from];
    const value = t.type === 'eth_transfer' ? t.valueEth : 0;

    // Dev-accurate precheck (EIP-1559): must be able to cover (value + gasLimit * maxFee).
    const upfrontMaxCostEth = value + gweiGasToEth(t.maxFeeGwei, t.gasLimit);

    if (sender.eth < upfrontMaxCostEth) {
      const invalid: Tx = {
        ...t,
        status: 'dropped',
        error: 'Dropped: insufficient ETH to cover value + (gasLimit × maxFee).'
      };
      dropped.push(invalid);
      continue;
    }


    // Fees are paid regardless of revert
    sender.eth -= feePaidEth;
    nextAccounts.Miner.eth += tipPaidEth;

    let status: TxStatus = 'executed_success';
    let error: string | undefined;

    if (outOfGas) {
      status = 'executed_revert';
      error = 'Out of gas: gas limit too low; execution reverted and full gas limit was charged.';
    } else if (t.type === 'eth_transfer') {
      if (sender.eth < value) {
        status = 'executed_revert';
        error = 'Reverted: insufficient ETH balance to transfer value.';
      } else {
        sender.eth -= value;
        nextAccounts[t.to].eth += value;
      }
    } else if (t.type === 'erc20_approve') {
      // Use Infinity to represent unlimited allowance.
      nextAllowance[t.from] = t.daiAmount;
    } else if (t.type === 'dex_swap' || t.type === 'dex_swap_permit') {
      const need = t.daiAmount;
      const hasBalance = nextAccounts[t.from].dai;

      // If this is swap+permit, validate and apply permit first (toy EIP-2612).
      let stagedPermit: { owner: EOA; valueDai: number } | null = null;

      if (t.type === 'dex_swap_permit') {
        const sig = t.permitSig;
        if (!sig) {
          status = 'executed_revert';
          error = 'Reverted: missing permit signature.';
        } else if (sig.owner !== t.from || sig.spender !== 'DEX') {
          status = 'executed_revert';
          error = 'Reverted: invalid permit (owner/spender mismatch).';
        } else if (sig.deadlineBlock < newBlockNumber) {
          status = 'executed_revert';
          error = 'Reverted: permit expired (deadline passed).';
        } else if (sig.nonce !== nextPermitNonce[t.from]) { /* ok */
          status = 'executed_revert';
          error = `Reverted: invalid permit nonce (have ${nextPermitNonce[t.from]}, got ${sig.nonce}).`;
        } else if (sig.valueDai < need) {
          status = 'executed_revert';
          error = `Reverted: permit value too low (permit ${sig.valueDai} DAI, need ${need} DAI).`;
        } else if (sig.sig !== makeToyPermitSig(sig.owner, sig.valueDai, sig.nonce, sig.deadlineBlock)) {
          status = 'executed_revert';
          error = 'Reverted: permit signature invalid (toy check).';
        } else {
          // Stage permit effects (atomicity): only commit if the swap succeeds.
          // Real permit happens inside the token contract call and reverts with the tx.
          stagedPermit = { owner: t.from, valueDai: sig.valueDai };
        }
      }

      // For swap+permit, simulate the permit by staging an allowance increase.
      const allowBefore = nextAllowance[t.from];
      const allowAfterPermit = stagedPermit
        ? Math.max(allowBefore, stagedPermit.valueDai)
        : allowBefore;

      const hasAllowance = allowAfterPermit === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : allowAfterPermit;

      if (status === 'executed_success') {
        if (hasAllowance !== Number.POSITIVE_INFINITY && hasAllowance < need) {
          status = 'executed_revert';
          error = `Reverted: ERC-20 insufficient allowance (have ${allowAfterPermit.toFixed(2)} DAI, need ${need.toFixed(2)} DAI).`;
        } else if (hasBalance < need) {
          status = 'executed_revert';
          error = `Reverted: ERC-20 insufficient token balance (have ${hasBalance.toFixed(2)} DAI, need ${need.toFixed(2)} DAI).`;
        } else {
          // Commit staged permit effects now that we know the tx succeeds.
          if (stagedPermit) {
            nextAllowance[t.from] = allowAfterPermit;
            nextPermitNonce = { ...nextPermitNonce, [t.from]: nextPermitNonce[t.from] + 1 };
          }

          if (hasAllowance !== Number.POSITIVE_INFINITY) nextAllowance[t.from] -= need;
          nextAccounts[t.from].dai -= need;
          nextAccounts.Bob.dai += need; // toy output
        }
      }
    }

    expectedNonce[t.from] += 1;
    nextAccounts[t.from].nonce = expectedNonce[t.from];

    const executed: Tx = {
      ...t,
      status,
      includedBlockNumber: newBlockNumber,
      baseFeeGwei: baseFee,
      effectiveGasPriceGwei: c.eff,
      gasUsed,
      feePaidEth,
      burnedEth,
      tipPaidEth,
      error
    };

    included.push(executed);
    blockGasUsed += gasUsed;
  }

  // Update state
  const newBlock: ChainBlock = {
    number: newBlockNumber,
    baseFeeGwei: baseFee,
    gasUsed: blockGasUsed,
    txHashes: included.map((t) => t.hash),
    timestampMs: Date.now()
  };
  const ttlBlocks = 20;

  // Keep pending txs that haven't been included/dropped, and evict very old ones.
  const evicted: Tx[] = [];
  const kept = state.mempool.filter((t) => {
    if (t.status !== 'mempool' && t.status !== 'ignored') return false;
    if (included.some((x) => x.hash === t.hash)) return false;
    if (dropped.some((x) => x.hash === t.hash)) return false;

    const age = newBlockNumber - t.firstSeenBlock;
    if (age > ttlBlocks) {
      evicted.push({ ...t, status: 'dropped', error: 'Dropped: tx evicted from mempool (TTL expired in this simulator).' });
      return false;
    }

    return true;
  });

  // Update ignored/mempool status based on new base fee.
  const updatedKept = kept.map((t) => {
    if (t.maxFeeGwei < baseFee) return { ...t, status: 'ignored' as const, error: 'Ignored: max fee is below current base fee.' };
    if (t.status === 'ignored') return { ...t, status: 'mempool' as const, error: undefined };
    return t;
  });

  let next: WalletTxState = {
    ...state,
    permitNonce: nextPermitNonce,
    accounts: nextAccounts,
    dexAllowance: nextAllowance,
    blockNumber: newBlockNumber,
    blocks: [newBlock, ...state.blocks].slice(0, 50),
    reorgSnapshot: beforeMineSnapshot,
    lastReorg: null,
    mempool: updatedKept
  };

  for (const t of evicted) next = rememberTx(next, t);


  // Save included/dropped into history
  for (const t of included) next = rememberTx(next, t);
  for (const t of dropped) next = rememberTx(next, t);

  // EIP-1559 base fee update (formula-accurate):
  // baseFeeNext = baseFee + baseFee * (gasUsed - targetGas) / targetGas / 8
  // The /8 caps per-block change to ~12.5%.
  const gasDelta = blockGasUsed - targetGas;
  const rawDelta = (baseFee * gasDelta) / targetGas / 8;
  const maxAbsDelta = baseFee / 8;
  const delta = clamp(rawDelta, -maxAbsDelta, maxAbsDelta);

  next = {
    ...next,
    lastBlockGasUsed: blockGasUsed,
    baseFeeGwei: clamp(baseFee + delta, 1, 200)
  };

  return { next, included, dropped };
}

