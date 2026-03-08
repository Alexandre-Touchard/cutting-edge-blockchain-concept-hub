import React, { useMemo, useState } from 'react';
import {
  Copy,
  Flame,
  Gauge,
  Info,
  Pickaxe,
  Send,
  Shuffle,
  TimerReset,
  User,
  UserRound,
  Wallet,
  Wrench,
  Zap,
  XCircle
} from 'lucide-react';
import EduTooltip from '../../../ui/EduTooltip';
import { define } from '../../glossary';
import { useDemoI18n } from '../../useDemoI18n';
import { makeInitialWalletTxState, type Address, type Tx, type TxType, effectiveGasPriceGwei, gweiGasToEth, requiredGas, tipGwei } from './model';
import { broadcast, mineBlock, reorgLastBlock, txFromDraft, type Draft } from './engine';

function nonceGapInfo(state: ReturnType<typeof makeInitialWalletTxState>, tx: Tx): { blocked: boolean; waitingForNonce?: number } {
  // For externally-owned accounts in this demo, the next expected nonce is the account nonce.
  const expected = state.accounts[tx.from].nonce;
  if (tx.status !== 'mempool' && tx.status !== 'ignored') return { blocked: false };
  if (tx.nonce > expected) return { blocked: true, waitingForNonce: expected };
  return { blocked: false };
}

function fmtEth(n: number) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1) return n.toFixed(4);
  if (Math.abs(n) >= 0.01) return n.toFixed(6);
  return n.toExponential(3);
}

function fmtGwei(n: number) {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

function shortHash(h: string) {
  return h.length <= 14 ? h : `${h.slice(0, 8)}…${h.slice(-4)}`;
}

export const demoMeta = {
  id: 'wallet-tx-lifecycle',
  title: 'Wallet UX & Transaction lifecycle',
  category: 'execution',
  difficulty: 'Beginner'
} as const;

export default function WalletTransactionLifecycleImpl() {
  const { tr } = useDemoI18n(demoMeta.id);

  const nonceTooltip = define('Nonce');
  const stateContextTooltip = tr(
    'In this demo: DAI is a toy ERC-20 balance, DEX is a toy contract that requires allowance for swaps, and Miner represents the block producer who earns tips (priority fees).'
  );
  const gasTooltip = define('Gas Economics');
  const mempoolTooltip = define('Transaction Pool');
  const approvalTooltip = define('Approval');
  const allowanceTooltip = define('Allowance');

  const [state, setState] = useState(makeInitialWalletTxState());
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [selectedBlockNumber, setSelectedBlockNumber] = useState<number | null>(null);

  // Draft
  const [draftType, _setDraftType] = useState<TxType>('eth_transfer');

  function setDraftType(t: TxType) {
    _setDraftType(t);

    // Helpful defaults when switching to permit flow.
    if (t === 'dex_swap_permit') {
      if (permitValueDai === 0) setPermitValueDai(Math.max(1, draftDaiAmount));
      if (!permitSigText) setPermitSigText(null);
    }
  }
  const [draftFrom, setDraftFrom] = useState<'Alice' | 'Bob'>('Alice');
  const [draftTo, setDraftTo] = useState<Address>('Bob');
  const [draftValueEth, setDraftValueEth] = useState(0.05);
  const [draftDaiAmount, setDraftDaiAmount] = useState(50);
  const [infiniteApproval, setInfiniteApproval] = useState(false);
  const [permitValueDai, setPermitValueDai] = useState(0);
  const [permitDeadlineBlocks, setPermitDeadlineBlocks] = useState(5);
  const [permitSigText, setPermitSigText] = useState<string | null>(null);
  const [manualNonce, setManualNonce] = useState(false);
  const [draftNonce, setDraftNonce] = useState(0);
  const [gasLimit, setGasLimit] = useState(60_000);
  const [maxFee, setMaxFee] = useState(25);
  const [maxPriority, setMaxPriority] = useState(1.5);

  const resolvedNonce = manualNonce ? draftNonce : state.accounts[draftFrom].nonce;
  const neededGas = requiredGas(draftType);

  const permitNonce = state.permitNonce[draftFrom];
  const effectiveGwei = effectiveGasPriceGwei(state.baseFeeGwei, maxFee, maxPriority);
  const tip = tipGwei(state.baseFeeGwei, effectiveGwei);

  const feeIfSuccessEth = gweiGasToEth(effectiveGwei, neededGas);
  // Worst-case wallet affordability uses maxFee * gasLimit (EIP-1559 cap), not the current effective price.
  const feeWorstEth = gweiGasToEth(maxFee, gasLimit);

  const sender = state.accounts[draftFrom];
  const maxCostEth = (draftType === 'eth_transfer' ? draftValueEth : 0) + feeWorstEth;

  const warnMaxFeeTooLow = maxFee < state.baseFeeGwei;
  const warnOutOfGas = gasLimit < neededGas;
  const warnCannotAfford = sender.eth < maxCostEth;

  const selectedTx = useMemo(() => {
    if (!selectedHash) return null;
    return state.history[selectedHash] ?? state.mempool.find((t) => t.hash === selectedHash) ?? null;
  }, [selectedHash, state.history, state.mempool]);

  const warnings = [
    warnMaxFeeTooLow ? tr('Max fee is below base fee: nodes ignore this tx until base fee drops.') : null,
    warnOutOfGas ? tr('Gas limit is too low: this will revert (out of gas).') : null,
    warnCannotAfford ? tr('Sender likely cannot afford value + worst-case fee.') : null
  ].filter(Boolean) as string[];

  function statusPill(status: Tx['status']) {
    switch (status) {
      case 'mempool':
        return 'border-blue-600 text-blue-300 bg-blue-600/15';
      case 'executed_success':
        return 'border-emerald-600 text-emerald-300 bg-emerald-600/15';
      case 'executed_revert':
        return 'border-amber-600 text-amber-300 bg-amber-600/15';
      case 'dropped':
        return 'border-red-600 text-red-300 bg-red-600/15';
      case 'ignored':
        return 'border-slate-500 text-slate-300 bg-slate-800/40';
      case 'replaced':
        return 'border-slate-600 text-slate-300 bg-slate-700/30';
      default:
        return 'border-slate-600 text-slate-300 bg-slate-700/30';
    }
  }

  function signPermit() {
    // Toy permit signature for UI. Real EIP-2612 is an EIP-712 signature.
    const deadline = state.blockNumber + Math.max(1, permitDeadlineBlocks);
    const sig = `permit(${draftFrom},${permitValueDai},nonce=${permitNonce},dl=${deadline})`;
    setPermitSigText(sig);
  }

  function doBroadcast() {
    const draft: Draft = {
      type: draftType,
      from: draftFrom,
      to: draftType === 'eth_transfer' ? draftTo : 'DEX',
      nonce: resolvedNonce,
      valueEth: draftType === 'eth_transfer' ? draftValueEth : 0,
      daiAmount:
        draftType === 'erc20_approve'
          ? infiniteApproval
            ? Number.POSITIVE_INFINITY
            : draftDaiAmount
          : draftType === 'dex_swap' || draftType === 'dex_swap_permit'
            ? draftDaiAmount
            : 0,
      gasLimit,
      maxFeeGwei: maxFee,
      maxPriorityGwei: maxPriority
    };

    let txBase = txFromDraft(draft, Date.now());

    if (draftType === 'dex_swap_permit') {
      const deadline = state.blockNumber + Math.max(1, permitDeadlineBlocks);
      const sig = permitSigText ?? `permit(${draftFrom},${permitValueDai},nonce=${permitNonce},dl=${deadline})`;

      txBase = {
        ...txBase,
        permitSig: {
          owner: draftFrom,
          spender: 'DEX',
          valueDai: permitValueDai,
          nonce: permitNonce,
          deadlineBlock: deadline,
          sig
        }
      };
    }

    const { next, result } = broadcast(state, txBase);
    setState(next);
    setSelectedHash(result.hash);
  }

  function doMine() {
    const { next, included } = mineBlock(state);
    setState(next);
    if (included[0]) setSelectedHash(included[0].hash);
  }

  function doMineConfirmations() {
    // Mine an empty block to advance confirmations / finality.
    const { next } = mineBlock({ ...state, mempool: [] });
    setState(next);
  }

  function doReorg() {
    const next = reorgLastBlock(state);
    setState(next);
  }

  function loadNonceGapScenario() {
    // Create: a stuck nonce 0 tx (ignored due to maxFee < baseFee), then a nonce 1 tx.
    const from: 'Alice' | 'Bob' = 'Alice';

    const stuck0: Draft = {
      type: 'eth_transfer',
      from,
      to: 'Bob',
      nonce: state.accounts[from].nonce,
      valueEth: 0.01,
      daiAmount: 0,
      gasLimit: 21_000,
      maxFeeGwei: Math.max(0, state.baseFeeGwei - 1), // ensures ignored
      maxPriorityGwei: 0.1
    };

    const later1: Draft = {
      type: 'eth_transfer',
      from,
      to: 'Bob',
      nonce: state.accounts[from].nonce + 1,
      valueEth: 0.02,
      daiAmount: 0,
      gasLimit: 21_000,
      maxFeeGwei: state.baseFeeGwei + 10,
      maxPriorityGwei: 2
    };

    const t0 = txFromDraft(stuck0, Date.now());
    const { next: s1, result: r0 } = broadcast(state, t0);

    const t1 = txFromDraft(later1, Date.now() + 1);
    const { next: s2, result: r1 } = broadcast(s1, t1);

    setState(s2);
    setSelectedHash(r1.hash);
  }

  function doReset() {
    setState(makeInitialWalletTxState());
    setSelectedHash(null);
    setDraftType('eth_transfer');
    setDraftFrom('Alice');
    setDraftTo('Bob');
    setDraftValueEth(0.05);
    setDraftDaiAmount(50);
    setInfiniteApproval(false);
    setPermitValueDai(0);
    setPermitDeadlineBlocks(5);
    setPermitSigText(null);
    setManualNonce(false);
    setDraftNonce(0);
    setGasLimit(60_000);
    setMaxFee(25);
    setMaxPriority(1.5);
  }

  function speedUp(tx: Tx) {
    setDraftType(tx.type);
    setDraftFrom(tx.from);
    setDraftTo(tx.to);
    setDraftValueEth(tx.valueEth);
    setDraftDaiAmount(tx.daiAmount);
    setManualNonce(true);
    setDraftNonce(tx.nonce);
    setGasLimit(tx.gasLimit);
    setMaxFee(tx.maxFeeGwei + 5);
    setMaxPriority(tx.maxPriorityGwei + 1);
    setSelectedHash(tx.hash);
  }

  function cancelTx(tx: Tx) {
    setDraftType('eth_transfer');
    setDraftFrom(tx.from);
    setDraftTo(tx.from);
    setDraftValueEth(0);
    setManualNonce(true);
    setDraftNonce(tx.nonce);
    setGasLimit(21_000);
    setMaxFee(tx.maxFeeGwei + 8);
    setMaxPriority(tx.maxPriorityGwei + 1);
    setSelectedHash(tx.hash);
  }

  async function copyHash(hash: string) {
    try {
      await navigator.clipboard.writeText(hash);
    } catch {
      // ignore
    }
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
              <Wallet className="text-blue-300" /> {tr('Wallet UX & Transaction lifecycle')}
            </h1>
            <p className="text-slate-300">
              {tr('Nonces + EIP-1559 fees + mempool inclusion, with speed-up/cancel and common revert reasons.')}
            </p>
          </div>
          <button
            type="button"
            onClick={doReset}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
          >
            <TimerReset size={16} /> {tr('Reset')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Flame size={16} className="text-orange-400" />
              <span>{tr('Base fee (EIP-1559)')}</span>
              <EduTooltip text={gasTooltip} />
              <EduTooltip
                widthClassName="w-96"
                text={tr(
                  'EIP-1559 was activated on Ethereum in the London upgrade (August 2021). It introduced a burned base fee to make fees more predictable, reduce overpaying, and align incentives by separating the base fee (burned) from the tip (paid to validators).'
                )}
              />
            </div>
            <div className="text-2xl font-bold">{fmtGwei(state.baseFeeGwei)} gwei</div>
            <input
              type="range"
              min={1}
              max={100}
              value={state.baseFeeGwei}
              onChange={(e) => setState((s) => ({ ...s, baseFeeGwei: Number(e.target.value) }))}
              className="w-full mt-3"
            />
            <div className="text-xs text-slate-400 mt-2">{tr('If base fee rises above your max fee, miners ignore your tx.')}</div>
          </div>

          <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Gauge size={16} className="text-purple-400" />
              <span>{tr('Latest block')}</span>
            </div>
            <div className="text-2xl font-bold">#{state.blockNumber}</div>

            {(() => {
              const prevBaseFee = state.blocks[0]?.baseFeeGwei;
              if (prevBaseFee == null) return null;
              const delta = state.baseFeeGwei - prevBaseFee;
              const dir = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
              const color = delta > 0 ? 'text-amber-300' : delta < 0 ? 'text-emerald-300' : 'text-slate-300';
              return (
                <div className={`mt-1 text-xs ${color}`}>
                  {tr('Base fee change')}: {dir} {delta >= 0 ? '+' : ''}{fmtGwei(delta)} gwei {tr('since last block')}
                </div>
              );
            })()}

            <div className="mt-3 rounded-lg bg-slate-900 border border-slate-700 p-3">
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                <span>{tr('Block gas meter (EIP-1559)')}</span>
                <EduTooltip
                  text={tr(
                    'If blocks use more gas than the target, base fee goes up next block. If they use less, base fee goes down.'
                  )}
                />
              </div>
              {(() => {
                const usedPct = Math.min(100, (state.lastBlockGasUsed / state.blockMaxGas) * 100);
                const targetPct = (state.blockTargetGas / state.blockMaxGas) * 100;
                return (
                  <>
                    <div className="relative h-2 w-full bg-slate-800 rounded overflow-hidden">
                      <div className="h-2 bg-emerald-500 rounded" style={{ width: `${usedPct}%` }} />
                      {/* Target marker */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-yellow-300/80"
                        style={{ left: `${targetPct}%` }}
                        title={tr('Target')}
                      />
                      {/* Max marker (right edge) */}
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-slate-300/40" title={tr('Max')} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-slate-400">
                      <span>{tr('Used')}: {Math.round(state.lastBlockGasUsed).toLocaleString()}</span>
                      <span>{tr('Target')}: {Math.round(state.blockTargetGas).toLocaleString()}</span>
                      <span>{tr('Max')}: {Math.round(state.blockMaxGas).toLocaleString()}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={doMine}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 border border-blue-500 font-semibold"
              >
                <Send size={16} /> {tr('Mine block')}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={doMineConfirmations}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm"
                >
                  {tr('Mine empty block')}
                </button>
                <button
                  type="button"
                  onClick={doReorg}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm"
                  disabled={!state.reorgSnapshot}
                >
                  {tr('Trigger reorg')}
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-2">{tr('Miner sorts by tip and respects sequential nonces.')}</div>
            <div className="text-xs text-slate-400 mt-2">
              {tr('base fee updates each block using a formula based on (gasUsed − targetGas). The change is capped to ~12.5% per block.')}
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Info size={16} className="text-emerald-400" />
              <span>{tr('Mempool')}</span>
              <EduTooltip text={mempoolTooltip} />
            </div>
            <div className="text-2xl font-bold">{state.mempool.length}</div>
            <div className="text-xs text-slate-400 mt-2">{tr('Pending txs waiting to be included.')}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* State */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Info size={18} className="text-slate-300" /> {tr('State')}
              </h2>
              <EduTooltip widthClassName="w-96" text={stateContextTooltip} />
            </div>
            <div className="space-y-3">
              {(['Alice', 'Bob', 'DEX', 'Miner'] as Address[]).map((a) => (
                <div key={a} className="rounded-lg bg-slate-900 border border-slate-700 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold flex items-center gap-2">
                      {a === 'Alice' ? (
                        <UserRound size={16} className="text-pink-300" />
                      ) : a === 'Bob' ? (
                        <User size={16} className="text-blue-300" />
                      ) : a === 'DEX' ? (
                        <Shuffle size={16} className="text-purple-300" />
                      ) : (
                        <Pickaxe size={16} className="text-amber-300" />
                      )}
                      {a}
                    </div>
                    <div className="text-xs text-slate-400">
                      {tr('nonce')}: <span className="text-slate-200 font-semibold">{state.accounts[a].nonce}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div>
                      <span className="text-slate-400">ETH:</span> <span className="font-semibold">{fmtEth(state.accounts[a].eth)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">DAI:</span> <span className="font-semibold">{state.accounts[a].dai.toFixed(2)}</span>
                    </div>
                  </div>
                  {(a === 'Alice' || a === 'Bob') && (
                    <div className="mt-2 text-xs text-slate-400 space-y-1">
                      <div>
                        {tr('DEX allowance')}: <span className="text-slate-200 font-semibold">{Number.isFinite(state.dexAllowance[a]) ? state.dexAllowance[a].toFixed(2) : '∞'} DAI</span>{' '}
                        <EduTooltip text={allowanceTooltip} />
                      </div>
                      <div>
                        {tr('Permit nonce')}: <span className="text-slate-200 font-semibold">{state.permitNonce[a]}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Builder */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Wrench size={18} className="text-emerald-300" /> {tr('Build a transaction')}
            </h2>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">{tr('Type')}</div>
                <select
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value as TxType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                >
                  <option value="eth_transfer">💸 {tr('ETH transfer')}</option>
                  <option value="erc20_approve">🧾 {tr('ERC-20 approve (spender = DEX)')}</option>
                  <option value="dex_swap">🔁 {tr('DEX swap (requires allowance)')}</option>
                  <option value="dex_swap_permit">🪪 {tr('Swap + Permit (EIP-2612, 1 tx)')}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">{tr('From')}</div>
                  <select
                    value={draftFrom}
                    onChange={(e) => setDraftFrom(e.target.value as 'Alice' | 'Bob')}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                  >
                    <option value="Alice">Alice</option>
                    <option value="Bob">Bob</option>
                  </select>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1">{tr('To')}</div>
                  <select
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value as Address)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                    disabled={draftType !== 'eth_transfer'}
                  >
                    <option value="Bob">Bob</option>
                    <option value="Alice">Alice</option>
                    <option value="DEX">DEX</option>
                    <option value="Miner">Miner</option>
                  </select>
                </div>
              </div>

              {draftType === 'eth_transfer' && (
                <div>
                  <div className="text-xs text-slate-400 mb-1">{tr('ETH value')}</div>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={draftValueEth}
                    onChange={(e) => setDraftValueEth(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                  />
                </div>
              )}

              {(draftType === 'erc20_approve' || draftType === 'dex_swap' || draftType === 'dex_swap_permit') && (
                <div>
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                    <span>{draftType === 'erc20_approve' ? tr('Approve amount (DAI)') : tr('Swap input (DAI)')}</span>
                    <EduTooltip text={draftType === 'erc20_approve' ? approvalTooltip : allowanceTooltip} />
                  </div>

                  {draftType === 'erc20_approve' ? (
                    <div className="mb-2 rounded border border-amber-700 bg-amber-900/20 p-3 text-xs text-amber-100">
                      <div className="font-semibold">{tr('Approval risk')}</div>
                      <div className="mt-1 text-slate-200">
                        {tr('Approving an infinite allowance lets the DEX spend your tokens later without another signature. This is convenient but increases risk if the spender is compromised.')}
                      </div>
                    </div>
                  ) : draftType === 'dex_swap_permit' ? (
                    <div className="mb-2 rounded border border-blue-700 bg-blue-900/20 p-3 text-xs text-blue-100">
                      <div className="font-semibold">{tr('Swap + Permit (1 tx)')}</div>
                      <div className="mt-1 text-slate-200">
                        {tr('Permit is an off-chain signature (EIP-2612) that grants allowance. By attaching it to the swap tx, you can swap in 1 on-chain tx instead of approve + swap (2 txs).')}
                      </div>
                    </div>
                  ) : null}

                  {(draftType === 'dex_swap' || draftType === 'dex_swap_permit') && (
                    <div className="mb-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-200">
                      <div className="font-semibold">{tr('2-tx vs 1-tx comparison')}</div>
                      {(() => {
                        const gasApprove = requiredGas('erc20_approve');
                        const gasSwap = requiredGas('dex_swap');
                        const gasSwapPermit = requiredGas('dex_swap_permit');

                        const effectiveGwei = effectiveGasPriceGwei(state.baseFeeGwei, maxFee, maxPriority);

                        const classicLikely = gweiGasToEth(effectiveGwei, gasApprove + gasSwap);
                        const classicWorst = gweiGasToEth(maxFee, gasApprove + gasSwap);

                        const permitLikely = gweiGasToEth(effectiveGwei, gasSwapPermit);
                        const permitWorst = gweiGasToEth(maxFee, gasSwapPermit);

                        const pct = classicLikely > 0 ? ((classicLikely - permitLikely) / classicLikely) * 100 : 0;

                        return (
                          <div className="mt-2 rounded border border-slate-700 bg-slate-950/20 p-3 text-[11px] text-slate-200">
                            <div className="font-semibold">{tr('Estimated cost (toy)')}</div>
                            <div className="mt-1 text-slate-400">
                              {tr('Likely uses the current effective gas price; worst-case uses max fee (cap).')}
                            </div>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div className="rounded border border-slate-700 bg-slate-900/30 p-2">
                                <div className="font-semibold">{tr('Classic flow')}</div>
                                <div className="text-slate-300">{tr('likely')}: {fmtEth(classicLikely)} ETH</div>
                                <div className="text-slate-500">{tr('worst-case')}: {fmtEth(classicWorst)} ETH</div>
                              </div>
                              <div className="rounded border border-blue-700 bg-blue-900/10 p-2">
                                <div className="font-semibold">{tr('Permit flow')}</div>
                                <div className="text-slate-300">{tr('likely')}: {fmtEth(permitLikely)} ETH</div>
                                <div className="text-slate-500">{tr('worst-case')}: {fmtEth(permitWorst)} ETH</div>
                              </div>
                            </div>
                            <div className="mt-2 text-slate-300">
                              {tr('Rough savings')}: <span className="font-semibold">{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded border border-slate-700 bg-slate-950/30 p-3">
                          <div className="text-slate-200 font-semibold">{tr('Classic flow (2 on-chain txs)')}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="px-2 py-1 rounded-full border border-slate-700 bg-slate-900/30">{tr('Approve (tx)')}</span>
                            <span className="text-slate-500">→</span>
                            <span className="px-2 py-1 rounded-full border border-slate-700 bg-slate-900/30">{tr('Swap (tx)')}</span>
                          </div>
                          <div className="mt-2 text-slate-400">
                            {tr('You pay gas twice and wait for approval inclusion before swapping.')}
                          </div>
                        </div>

                        <div className="rounded border border-blue-700 bg-blue-900/10 p-3">
                          <div className="text-blue-100 font-semibold">{tr('Permit flow (1 on-chain tx)')}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="px-2 py-1 rounded-full border border-slate-700 bg-slate-900/30">{tr('Permit signature (off-chain)')}</span>
                            <span className="text-slate-500">→</span>
                            <span className="px-2 py-1 rounded-full border border-blue-700 bg-blue-900/20">{tr('Swap + Permit (tx)')}</span>
                          </div>
                          <div className="mt-2 text-slate-300">
                            {tr('You sign once off-chain, then pay gas once on-chain for the combined swap.')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {draftType === 'dex_swap_permit' ? (
                    <div className="mb-2 rounded border border-slate-700 bg-slate-900/50 p-3 text-xs text-slate-200">
                      <div className="font-semibold">{tr('Permit signature (toy)')}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[11px] text-slate-400">{tr('Permit value (DAI)')}</div>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={permitValueDai}
                            onChange={(e) => setPermitValueDai(Number(e.target.value))}
                            className="w-full px-2 py-2 rounded bg-slate-800 border border-slate-700"
                          />
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">{tr('Deadline (blocks)')}</div>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={permitDeadlineBlocks}
                            onChange={(e) => setPermitDeadlineBlocks(Number(e.target.value))}
                            className="w-full px-2 py-2 rounded bg-slate-800 border border-slate-700"
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-[11px] text-slate-400">
                          {tr('Permit nonce')}: <span className="text-slate-200 font-semibold">{permitNonce}</span>
                        </div>
                        <button
                          type="button"
                          onClick={signPermit}
                          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold"
                        >
                          {tr('Sign permit (off-chain)')}
                        </button>
                      </div>
                      {permitSigText ? (
                        <div className="mt-2 text-[11px] text-slate-300 break-words">
                          {tr('Signature')}: <span className="text-slate-100">{permitSigText}</span>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-slate-400">
                          {tr('No permit signed yet. The demo will auto-generate one if you broadcast without signing.')}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-xs text-slate-300 inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={infiniteApproval}
                        onChange={(e) => setInfiniteApproval(e.target.checked)}
                        disabled={draftType !== 'erc20_approve'}
                      />
                      {tr('Infinite approval')}
                    </label>

                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draftDaiAmount}
                      onChange={(e) => setDraftDaiAmount(Number(e.target.value))}
                      className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                      disabled={draftType === 'erc20_approve' && infiniteApproval}
                    />

                    {draftType === 'erc20_approve' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInfiniteApproval(false);
                          setDraftDaiAmount(0);
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs"
                      >
                        {tr('Revoke (approve 0)')}
                      </button>
                    ) : null}
                  </div>

                  {draftType === 'erc20_approve' && infiniteApproval ? (
                    <div className="mt-2 text-xs text-slate-400">{tr('This will set allowance to ∞ in the simulator.')}</div>
                  ) : null}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">{tr('Gas limit')}</div>
                  <input
                    type="number"
                    min={21_000}
                    step={1000}
                    value={gasLimit}
                    onChange={(e) => setGasLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                    <span>{tr('Nonce')}</span>
                    <EduTooltip text={nonceTooltip} />
                  </div>
                  <div className="flex gap-2 flex-wrap items-center min-w-0">
                    <label className="flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap shrink-0">
                      <input type="checkbox" checked={manualNonce} onChange={(e) => setManualNonce(e.target.checked)} />
                      {tr('Manual')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={manualNonce ? draftNonce : state.accounts[draftFrom].nonce}
                      disabled={!manualNonce}
                      onChange={(e) => setDraftNonce(Number(e.target.value))}
                      className="flex-1 min-w-[10rem] px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">{tr('Max fee (gwei)')}</div>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={maxFee}
                    onChange={(e) => setMaxFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">{tr('Priority fee (gwei)')}</div>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={maxPriority}
                    onChange={(e) => setMaxPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{tr('Fee preview')}</div>
                  <div className="text-xs text-slate-400">{tr('EIP-1559')} / {tr('worst-case')}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-slate-400">{tr('Effective gas price')}</div>
                    <div className="font-semibold">{fmtGwei(effectiveGwei)} gwei</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{tr('Tip')}</div>
                    <div className="font-semibold">{fmtGwei(tip)} gwei</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{tr('Fee if success')}</div>
                    <div className="font-semibold">{fmtEth(feeIfSuccessEth)} ETH</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{tr('Fee worst-case')}</div>
                    <div className="font-semibold">{fmtEth(feeWorstEth)} ETH</div>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-2">{tr('Required gas')}: {neededGas.toLocaleString()}</div>
              </div>

              {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-700 bg-amber-900/20 p-3 text-sm">
                  <div className="font-semibold flex items-center gap-2">
                    <XCircle size={16} className="text-amber-300" /> {tr('Warnings')}
                  </div>
                  <ul className="list-disc pl-5 mt-2 text-slate-200">
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={doBroadcast}
                className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 font-semibold"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <Zap size={16} /> {tr('Sign & broadcast')}
                </span>
                <span
                  className="ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <EduTooltip
                    widthClassName="w-96"
                    text={tr(
                      'Creates and signs a transaction, then broadcasts it to the network (mempool). If another pending tx already uses the same nonce, this becomes a replacement attempt (speed up/cancel mechanics).'
                    )}
                  />
                </span>
              </button>

              <button
                type="button"
                onClick={loadNonceGapScenario}
                className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold"
              >
                <span className="min-w-0 truncate">{tr('Load nonce gap scenario')}</span>
                <span
                  className="ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <EduTooltip
                    widthClassName="w-96"
                    text={tr(
                      'Loads a preset scenario where nonce 0 is stuck/ignored and nonce 1 is blocked. This demonstrates that Ethereum enforces per-account nonce ordering: later nonces cannot be mined until earlier ones are resolved.'
                    )}
                  />
                </span>
              </button>
            </div>
          </div>

          {/* Mempool / Selected */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Shuffle size={18} className="text-blue-300" /> {tr('Mempool & execution')}
            </h2>

            {/* Reorg trace */}
            {state.lastReorg ? (
              <div className="mb-4 rounded-lg bg-slate-900 border border-slate-700 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{tr('Reorg trace')}</div>
                  <div className="text-xs text-slate-400">
                    {tr('Reorged block')} #{state.lastReorg.blockNumber}
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-300">
                  {tr('These txs were removed from the last block and returned to the mempool:')}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {state.lastReorg.txHashes.slice(0, 8).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setSelectedHash(h)}
                      className="text-[11px] px-2 py-1 rounded-full border border-slate-700 bg-slate-950/30 hover:bg-slate-800"
                    >
                      {shortHash(h)}
                    </button>
                  ))}
                  {state.lastReorg.txHashes.length > 8 ? (
                    <span className="text-[11px] text-slate-400">+{state.lastReorg.txHashes.length - 8}</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Recent blocks */}
            <div className="mb-4 rounded-lg bg-slate-900 border border-slate-700 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{tr('Recent blocks')}</div>
                <div className="text-xs text-slate-400">{tr('Click a block to inspect txs')}</div>
              </div>

              {state.blocks.length === 0 ? (
                <div className="text-sm text-slate-400 mt-2">{tr('No blocks yet. Mine a block to see it here.')}</div>
              ) : (
                <div className="mt-2 space-y-2 relative">
                  {/* Chain connector */}
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-700" />

                  {state.blocks.slice(0, 6).map((b, idx) => {
                    const open = selectedBlockNumber === b.number;
                    return (
                      <div
                        key={b.number}
                        className={`rounded-lg border pl-6 relative ${
                          open ? 'border-blue-500 bg-slate-900/70' : 'border-slate-700 bg-slate-900/40'
                        }`}
                      >
                        {open ? (
                          <div className="absolute left-4 top-0 bottom-0 w-px bg-blue-500/70" />
                        ) : null}
                        <div
                          className={`absolute left-[0.875rem] top-3 h-2 w-2 rounded-full border ${
                            open ? 'bg-blue-400 border-blue-200' : 'bg-slate-500 border-slate-300'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedBlockNumber((cur) => (cur === b.number ? null : b.number))}
                          className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded-lg"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">{tr('Block')} #{b.number}</div>
                            <div className="text-xs text-slate-400">
                              {b.txHashes.length} {tr('txs')} · {tr('base fee')} {fmtGwei(b.baseFeeGwei)} gwei
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {tr('gasUsed')}: {Math.round(b.gasUsed).toLocaleString()}
                          </div>

                          {(() => {
                            const prev = state.blocks.find((x) => x.number === b.number - 1);
                            if (!prev) return null;

                            const actualDelta = b.baseFeeGwei - prev.baseFeeGwei;
                            const aboveTarget = b.gasUsed > state.blockTargetGas;
                            const dir = actualDelta > 0 ? tr('up') : actualDelta < 0 ? tr('down') : tr('flat');

                            // Expected delta from formula (using previous base fee, and this block's gasUsed vs target).
                            const gasDelta = b.gasUsed - state.blockTargetGas;
                            const raw = (prev.baseFeeGwei * gasDelta) / state.blockTargetGas / 8;
                            const cap = prev.baseFeeGwei / 8;
                            const expectedDelta = Math.max(-cap, Math.min(cap, raw));
                            const expectedNext = prev.baseFeeGwei + expectedDelta;

                            return (
                              <div className="mt-2 text-[11px] text-slate-400">
                                <span className="font-semibold text-slate-300">{tr('Block view')}:</span>{' '}
                                {tr('base fee moved')} <span className="font-semibold">{dir}</span>{' '}
                                ({actualDelta >= 0 ? '+' : ''}{fmtGwei(actualDelta)} gwei) — {aboveTarget ? tr('gasUsed > target') : tr('gasUsed < target')}

                                <div className="mt-1 text-[11px] text-slate-500">
                                  {tr('Expected')} Δ {expectedDelta >= 0 ? '+' : ''}{fmtGwei(expectedDelta)} gwei → {tr('expected next base fee')} {fmtGwei(expectedNext)} gwei
                                </div>

                                <EduTooltip
                                  widthClassName="w-96"
                                  text={
                                    `${tr('EIP-1559 base fee update (step by step)')}\n\n` +
                                    `${tr('Inputs')}:\n` +
                                    `- ${tr('baseFeePrev')}: ${fmtGwei(prev.baseFeeGwei)} gwei\n` +
                                    `- ${tr('gasUsed')}: ${Math.round(b.gasUsed).toLocaleString()}\n` +
                                    `- ${tr('targetGas')}: ${Math.round(state.blockTargetGas).toLocaleString()}\n\n` +
                                    `${tr('Formula')}: baseFeeNext = baseFeePrev + clamp(baseFeePrev*(gasUsed-targetGas)/targetGas/8, ±baseFeePrev/8)\n\n` +
                                    `${tr('Compute')}:\n` +
                                    `- ${tr('gasDelta')}: ${Math.round(gasDelta).toLocaleString()}\n` +
                                    `- ${tr('rawDelta')}: ${fmtGwei(raw)} gwei\n` +
                                    `- ${tr('cap')}: ±${fmtGwei(cap)} gwei\n` +
                                    `- ${tr('expectedDelta')}: ${expectedDelta >= 0 ? '+' : ''}${fmtGwei(expectedDelta)} gwei\n` +
                                    `- ${tr('expectedNextBaseFee')}: ${fmtGwei(expectedNext)} gwei\n\n` +
                                    `${tr('Note')}: ${tr('This demo uses floating-point math; real clients use integer math with rounding.')}`
                                  }
                                />
                              </div>
                            );
                          })()}
                        </button>

                        {open && (
                          <div className="px-3 pb-3">
                            {b.txHashes.length === 0 ? (
                              <div className="text-sm text-slate-400">{tr('Empty block')}</div>
                            ) : (
                              <div className="space-y-2">
                                {b.txHashes.map((h) => {
                                  const tx = state.history[h];
                                  return (
                                    <button
                                      key={h}
                                      type="button"
                                      onClick={() => {
                                        setSelectedHash(h);
                                      }}
                                      className="w-full text-left rounded-lg border border-slate-700 bg-slate-950/30 p-2 hover:bg-slate-800"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="text-xs text-slate-200 font-semibold">{shortHash(h)}</div>
                                          {tx ? (
                                            <div className="text-[11px] text-slate-400 mt-1">
                                              <span className="font-semibold text-slate-300">{tx.type}</span> · {tx.from} → {tx.to} · {tr('nonce')} {tx.nonce}
                                            </div>
                                          ) : (
                                            <div className="text-[11px] text-slate-500 mt-1">{tr('Unknown tx')}</div>
                                          )}

                                          {tx ? (
                                            <div className="text-[11px] text-slate-500 mt-1">
                                              {tx.type === 'eth_transfer'
                                                ? `${tr('value')}: ${fmtEth(tx.valueEth)} ETH`
                                                : `${tr('amount')}: ${tx.daiAmount} DAI`}
                                              {tx.feePaidEth != null ? ` · ${tr('fee')}: ${fmtEth(tx.feePaidEth)} ETH` : ''}
                                            </div>
                                          ) : null}

                                          {tx?.status === 'executed_revert' && tx.error ? (
                                            <div className="text-[11px] text-amber-300 mt-1">{tr('revert')}: {tx.error}</div>
                                          ) : null}
                                          {tx?.status === 'executed_success' ? (
                                            <div className="text-[11px] text-emerald-300 mt-1">{tr('success')}</div>
                                          ) : null}
                                          {tx?.status === 'ignored' && tx.error ? (
                                            <div className="text-[11px] text-slate-300 mt-1">{tr('ignored')}: {tx.error}</div>
                                          ) : null}
                                        </div>

                                        {tx ? (
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusPill(tx.status)}`}>{tx.status}</span>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {state.mempool.length === 0 && (
                <div className="text-sm text-slate-400">{tr('No pending transactions. Build one and broadcast it.')}</div>
              )}
              {state.mempool.map((tx) => {
                const gap = nonceGapInfo(state, tx);
                return (
                <button
                  key={tx.hash}
                  type="button"
                  onClick={() => setSelectedHash(tx.hash)}
                  className={`w-full text-left rounded-lg border p-3 hover:bg-slate-800 ${selectedHash === tx.hash ? 'border-blue-500 bg-slate-900' : 'border-slate-700 bg-slate-900/50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{labelTx(tx)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusPill(tx.status)}`}>{tx.status}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {shortHash(tx.hash)} · {tr('nonce')} {tx.nonce} · {tr('tip')} {fmtGwei(tipGwei(state.baseFeeGwei, effectiveGasPriceGwei(state.baseFeeGwei, tx.maxFeeGwei, tx.maxPriorityGwei)))} gwei
                  </div>

                  {gap.blocked ? (
                    <div className="mt-1 text-xs text-amber-300">
                      {tr('Blocked by nonce gap')} — {tr('waiting for nonce')} {gap.waitingForNonce}
                    </div>
                  ) : null}
                </button>
              );
              })}
            </div>

            {selectedTx && (
              <div className="mt-4 rounded-lg bg-slate-900 border border-slate-700 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{tr('Selected tx')}</div>
                  <button
                    type="button"
                    onClick={() => copyHash(selectedTx.hash)}
                    className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 inline-flex items-center gap-2"
                  >
                    <Copy size={14} /> {tr('Copy hash')}
                  </button>
                </div>
                <div className="text-xs text-slate-400 mt-1">{selectedTx.hash}</div>

                {(() => {
                  const included = selectedTx.includedBlockNumber != null;
                  const confirmations = included ? Math.max(0, state.blockNumber - selectedTx.includedBlockNumber! + 1) : 0;
                  const finalized = included && confirmations >= 12;

                  const steps: { label: string; active: boolean; done: boolean }[] = [
                    {
                      label: tr('Signed'),
                      active: !included && (selectedTx.status === 'mempool' || selectedTx.status === 'ignored'),
                      done: Boolean(selectedTx.signedAtMs)
                    },
                    {
                      label: tr('Broadcasted'),
                      active: !included && (selectedTx.status === 'mempool' || selectedTx.status === 'ignored'),
                      done: Boolean(selectedTx.broadcastAtMs)
                    },
                    {
                      label: selectedTx.status === 'ignored' ? tr('Ignored') : tr('Pending'),
                      active: !included && (selectedTx.status === 'mempool' || selectedTx.status === 'ignored'),
                      done: included
                    },
                    {
                      label: tr('Included'),
                      active: included && !finalized,
                      done: included
                    },
                    {
                      label: tr('Finalized'),
                      active: finalized,
                      done: finalized
                    }
                  ];

                  return (
                    <div className="mt-3">
                      <div className="text-xs text-slate-400 mb-2">{tr('Tx lifecycle timeline')}</div>
                      <div className="flex flex-wrap gap-2">
                        {steps.map((s) => (
                          <span
                            key={s.label}
                            className={`text-xs px-2 py-1 rounded-full border ${
                              s.done
                                ? 'border-emerald-700 bg-emerald-900/20 text-emerald-200'
                                : s.active
                                  ? 'border-blue-700 bg-blue-900/20 text-blue-200'
                                  : 'border-slate-700 bg-slate-800/30 text-slate-300'
                            }`}
                          >
                            {s.label}
                          </span>
                        ))}
                      </div>

                      {included && (
                        <div className="mt-2 text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                          <span>
                            {tr('Confirmations')}: <span className="font-semibold">{confirmations}</span>
                          </span>
                          <EduTooltip
                            text={tr(
                              'Confirmations are the number of blocks built on top of the block that included your tx. More confirmations generally means lower reorg risk. On Ethereum L1, finality is probabilistic (risk decreases with confirmations). On many L2s, user-facing finality can be fast, but ultimate finality depends on the L1 settlement/finality.'
                            )}
                            widthClassName="w-96"
                          />
                          {finalized ? (
                            <span className="text-emerald-300">({tr('finalized in this demo')})</span>
                          ) : (
                            <span className="text-slate-400">({tr('finalizes at 12 confirmations')})</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {selectedTx.type === 'dex_swap_permit' && selectedTx.permitSig ? (
                  <div className="mt-3 rounded border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-200">
                    <div className="font-semibold">{tr('Permit attached')}</div>
                    <div className="mt-1 text-slate-300">
                      {tr('owner')}: {selectedTx.permitSig.owner} · {tr('spender')}: {selectedTx.permitSig.spender}
                    </div>
                    <div className="mt-1 text-slate-300">
                      {tr('value')}: {selectedTx.permitSig.valueDai} DAI · {tr('nonce')}: {selectedTx.permitSig.nonce} · {tr('deadline')}: {tr('block')} {selectedTx.permitSig.deadlineBlock}
                    </div>
                    <div className="mt-1 text-slate-500 break-words">{tr('sig')}: {selectedTx.permitSig.sig}</div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">{tr('From')}</div>
                    <div className="font-semibold">{selectedTx.from}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{tr('To')}</div>
                    <div className="font-semibold">{selectedTx.to}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{tr('Nonce')}</div>
                    <div className="font-semibold">{selectedTx.nonce}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{tr('Gas limit')}</div>
                    <div className="font-semibold">{selectedTx.gasLimit.toLocaleString()}</div>
                  </div>
                </div>

                {(selectedTx.status === 'mempool' || selectedTx.status === 'ignored') && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => speedUp(selectedTx)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm"
                    >
                      <Zap size={16} /> {tr('Speed up')}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelTx(selectedTx)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm"
                    >
                      <XCircle size={16} /> {tr('Cancel')}
                    </button>
                  </div>
                )}

                {(() => {
                  const gap = nonceGapInfo(state, selectedTx);
                  if (!gap.blocked) return null;
                  return (
                    <div className="mt-3 rounded border border-amber-700 bg-amber-900/20 p-3 text-sm text-amber-200">
                      <div className="font-semibold">{tr('Blocked by nonce gap')}</div>
                      <div className="mt-1 text-xs text-slate-200">
                        {tr('This transaction cannot be mined yet because an earlier nonce is missing. You must get nonce')} {gap.waitingForNonce}{' '}
                        {tr('mined, replaced, or cancelled first.')}
                      </div>
                    </div>
                  );
                })()}

                {selectedTx.status === 'ignored' && (
                  <div className="mt-3 rounded border border-slate-700 bg-slate-800/40 p-3 text-sm text-slate-200">
                    {tr('This tx is currently ignored because max fee is below the current base fee. Increase max fee or wait for base fee to drop.')}
                  </div>
                )}

                {selectedTx.status === 'dropped' && selectedTx.replacementReport ? (
                  <div className="mt-3 rounded border border-amber-700 bg-amber-900/20 p-3 text-sm text-amber-100">
                    <div className="font-semibold">{tr('Replacement rejected')}</div>
                    <div className="mt-2 text-xs text-slate-200">
                      {tr('This tx tried to replace a pending tx with the same nonce, but did not meet the replacement policy.')}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                      <div className="rounded bg-slate-950/30 border border-slate-700 p-2">
                        <div className="font-semibold text-slate-200">{tr('Required max fee')}</div>
                        <div className="text-slate-300">
                          ≥ {fmtGwei(selectedTx.replacementReport.requiredMaxFeeGwei)} gwei ({tr('you set')} {fmtGwei(selectedTx.replacementReport.newMaxFeeGwei)} gwei)
                        </div>
                      </div>
                      <div className="rounded bg-slate-950/30 border border-slate-700 p-2">
                        <div className="font-semibold text-slate-200">{tr('Required priority fee')}</div>
                        <div className="text-slate-300">
                          ≥ {fmtGwei(selectedTx.replacementReport.requiredMaxPriorityGwei)} gwei ({tr('you set')} {fmtGwei(selectedTx.replacementReport.newMaxPriorityGwei)} gwei)
                        </div>
                      </div>
                      <div className="rounded bg-slate-950/30 border border-slate-700 p-2">
                        <div className="font-semibold text-slate-200">{tr('Tip must improve')}</div>
                        <div className="text-slate-300">
                          {tr('old tip')} {fmtGwei(selectedTx.replacementReport.existingTipGwei)} gwei → {tr('new tip')} {fmtGwei(selectedTx.replacementReport.newTipGwei)} gwei
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-200">
                      <div className="font-semibold">{tr('How to fix')}</div>
                      <ul className="list-disc pl-5 mt-1 text-slate-200">
                        <li>{tr('Increase max fee and priority fee by ~10% (or more), then broadcast again with the same nonce.')}</li>
                        <li>{tr('Alternatively, use the Speed up button on the original pending tx.')}</li>
                      </ul>
                    </div>
                  </div>
                ) : null}

                {selectedTx.error && (
                  <div
                    className={`mt-3 rounded border p-3 text-sm ${
                      selectedTx.status === 'executed_revert' || selectedTx.status === 'dropped'
                        ? 'border-red-800 bg-red-900/20 text-red-200'
                        : 'border-slate-700 bg-slate-800/40 text-slate-200'
                    }`}
                  >
                    {selectedTx.error}
                  </div>
                )}

                {(selectedTx.status === 'executed_success' || selectedTx.status === 'executed_revert') && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">{tr('Included base fee')}</div>
                      <div className="font-semibold">{fmtGwei(selectedTx.baseFeeGwei ?? NaN)} gwei</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{tr('Max fee (cap)')}</div>
                      <div className="font-semibold">{fmtGwei(selectedTx.maxFeeGwei)} gwei</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{tr('Priority fee (max)')}</div>
                      <div className="font-semibold">{fmtGwei(selectedTx.maxPriorityGwei)} gwei</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{tr('Effective gas price')}</div>
                      <div className="font-semibold">{fmtGwei(selectedTx.effectiveGasPriceGwei ?? NaN)} gwei</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">{tr('Gas used')}</div>
                      <div className="font-semibold">{selectedTx.gasUsed?.toLocaleString() ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{tr('Total fee paid')}</div>
                      <div className="font-semibold">{fmtEth(selectedTx.feePaidEth ?? NaN)} ETH</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">{tr('ETH burned')}</div>
                      <div className="font-semibold">{fmtEth(selectedTx.burnedEth ?? NaN)} ETH</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{tr('Tip to validator')}</div>
                      <div className="font-semibold">{fmtEth(selectedTx.tipPaidEth ?? NaN)} ETH</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Real-World Applications */}
        <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">🌐 {tr('Real-World Applications')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-emerald-400">{tr('Where you see this in production')}</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-blue-300">{tr('Wallets')}</div>
                  <p className="text-xs text-slate-300">
                    {tr('MetaMask, Rabby, Coinbase Wallet, and others all expose the same core lifecycle: sign → broadcast → pending (mempool) → included → success/revert.')}
                  </p>
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-purple-300">{tr('Ethereum execution clients')}</div>
                  <p className="text-xs text-slate-300">
                    {tr('Geth, Nethermind, Erigon, and Besu maintain a mempool and enforce nonce ordering. They also implement replacement policies (fee bump rules).')}
                  </p>
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-pink-300">{tr('Rollups and L2s')}</div>
                  <p className="text-xs text-slate-300">
                    {tr('Most rollups keep an L2 mempool with the same user-facing ideas: pending txs, nonces, fees, and occasional reverts.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-yellow-400">{tr('Common real user scenarios')}</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-blue-300 mb-1">⚡ {tr('Stuck transaction')}</div>
                  <p className="text-xs text-slate-300">
                    <strong>{tr('Cause')}:</strong> {tr('Base fee spikes above your max fee, so the tx is ignored.')}
                    <br />
                    <strong>{tr('Fix')}:</strong> {tr('Speed up by replacing it with the same nonce and higher fees (or wait).')}
                  </p>
                </div>

                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-purple-300 mb-1">🧾 {tr('Approval before swap')}</div>
                  <p className="text-xs text-slate-300">
                    <strong>{tr('Cause')}:</strong> {tr('ERC-20 swaps often revert without allowance.')}
                    <br />
                    <strong>{tr('Fix')}:</strong> {tr('Send an approve tx, wait for it to be included, then retry the swap.')}
                  </p>
                </div>

                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-emerald-300 mb-1">⛽ {tr('Reverted but still paid gas')}</div>
                  <p className="text-xs text-slate-300">
                    <strong>{tr('Cause')}:</strong> {tr('Out-of-gas or a contract revert.')}
                    <br />
                    <strong>{tr('What to learn')}:</strong> {tr('Inclusion and success are different: gas is paid when included, even on revert.')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-400 flex items-start gap-2">
          <Info size={14} className="mt-0.5" />
          <div>
            {tr('This is a simplified simulator: no signatures, no reorgs, and a toy DEX swap model. Mempool TTL is simulated.')}
          </div>
        </div>
      </div>
    </div>
  );

  function labelTx(tx: Tx) {
    switch (tx.type) {
      case 'eth_transfer':
        return `${tx.from} → ${tx.to} (${fmtEth(tx.valueEth)} ETH)`;
      case 'erc20_approve':
        return `${tx.from} approve DEX (${tx.daiAmount} DAI)`;
      case 'dex_swap':
        return `${tx.from} swap (${tx.daiAmount} DAI)`;
    }
  }
}
