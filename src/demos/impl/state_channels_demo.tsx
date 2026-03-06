import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BadgeCheck,
  Ban,
  Clock,
  HandCoins,
  Layers,
  Link,
  RotateCcw,
  Send,
  ShieldCheck,
  ShieldX,
  Timer,
  Wallet
} from 'lucide-react';
import { useDemoI18n } from '../useDemoI18n';
import EduTooltip from '../../ui/EduTooltip';

type Side = 'alice' | 'bob';

type ChannelStatus =
  | 'not-open'
  | 'open'
  | 'updating'
  | 'closing-cooperative'
  | 'closing-disputed'
  | 'closed';

type SignedState = {
  nonce: number;
  aliceBalance: number;
  bobBalance: number;
  // "signatures" are simulated booleans to keep demo simple.
  signedByAlice: boolean;
  signedByBob: boolean;
};

type TimelineLane = 'old' | 'new';

type TimelineMark = {
  t: number; // elapsed blocks since dispute start
  lane: TimelineLane;
  kind: 'accepted' | 'rejected' | 'invalid' | 'info';
  action: 'submit' | 'finalized';
  nonce?: number;
};

type Event = {
  ts: number;
  kind: 'info' | 'success' | 'error';
  msg: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatEth(x: number) {
  return `${x.toFixed(3)} ETH`;
}

export default function StateChannelsDemo() {
  const { tr } = useDemoI18n('state-channels');

  // Setup
  const [depositAlice, setDepositAlice] = useState(1.0);
  const [depositBob, setDepositBob] = useState(1.0);

  const [status, setStatus] = useState<ChannelStatus>('not-open');
  const [events, setEvents] = useState<Event[]>([]);

  const [latest, setLatest] = useState<SignedState | null>(null);
  const [pending, setPending] = useState<SignedState | null>(null);

  // Dispute model
  const [challengePeriodBlocks, setChallengePeriodBlocks] = useState(20);
  const [blocksRemaining, setBlocksRemaining] = useState<number | null>(null);
  const [onChainSubmitted, setOnChainSubmitted] = useState<SignedState | null>(null);
  const [cheatOldState, setCheatOldState] = useState<SignedState | null>(null);
  const [timelineMarks, setTimelineMarks] = useState<TimelineMark[]>([]);
  const [lastL1Result, setLastL1Result] = useState<{
    kind: 'accepted' | 'rejected' | 'invalid';
    msg: string;
  } | null>(null);

  const totalDeposits = useMemo(() => depositAlice + depositBob, [depositAlice, depositBob]);

  const pushEvent = (kind: Event['kind'], msg: string) =>
    setEvents((prev) => [{ ts: Date.now(), kind, msg }, ...prev].slice(0, 14));

  const resetAll = () => {
    setStatus('not-open');
    setEvents([]);
    setLatest(null);
    setPending(null);
    setBlocksRemaining(null);
    setOnChainSubmitted(null);
    setCheatOldState(null);
    setTimelineMarks([]);
    setLastL1Result(null);
    pushEvent('info', tr('Reset demo state.'));
  };

  const openChannel = () => {
    const a = clamp(depositAlice, 0, 100);
    const b = clamp(depositBob, 0, 100);

    const initial: SignedState = {
      nonce: 0,
      aliceBalance: a,
      bobBalance: b,
      signedByAlice: true,
      signedByBob: true
    };

    // Cheater attempts to later submit this old (but validly signed) state.
    setCheatOldState(initial);

    setLatest(initial);
    setPending(null);
    setOnChainSubmitted(null);
    setBlocksRemaining(null);
    setStatus('open');

    pushEvent('success', tr('✅ Channel opened (deposits locked on-chain).'));
    pushEvent('info', tr('Initial state nonce={{n}}: Alice={{a}}, Bob={{b}}', { n: 0, a, b }));
  };

  const proposeUpdate = (from: Side, amount: number) => {
    if (!latest) return;
    if (status !== 'open') return;

    const amt = clamp(amount, 0, 1000);
    if (amt <= 0) {
      pushEvent('error', tr('Amount must be > 0'));
      return;
    }

    const next: SignedState = {
      nonce: latest.nonce + 1,
      aliceBalance: latest.aliceBalance,
      bobBalance: latest.bobBalance,
      signedByAlice: false,
      signedByBob: false
    };

    if (from === 'alice') {
      if (latest.aliceBalance < amt) {
        pushEvent('error', tr('Alice has insufficient balance.'));
        return;
      }
      next.aliceBalance = Number((latest.aliceBalance - amt).toFixed(6));
      next.bobBalance = Number((latest.bobBalance + amt).toFixed(6));
    } else {
      if (latest.bobBalance < amt) {
        pushEvent('error', tr('Bob has insufficient balance.'));
        return;
      }
      next.bobBalance = Number((latest.bobBalance - amt).toFixed(6));
      next.aliceBalance = Number((latest.aliceBalance + amt).toFixed(6));
    }

    setPending(next);
    setStatus('updating');
    pushEvent('info', tr('✍️ Proposed update nonce={{n}} (off-chain)', { n: next.nonce }));
  };

  const signPending = (who: Side) => {
    if (!pending) return;
    const next = { ...pending };
    if (who === 'alice') next.signedByAlice = true;
    else next.signedByBob = true;
    setPending(next);

    pushEvent('info', tr('{{who}} signed the update.', { who: who === 'alice' ? tr('Alice') : tr('Bob') }));

    if (next.signedByAlice && next.signedByBob) {
      setLatest(next);
      setPending(null);
      setStatus('open');
      pushEvent('success', tr('✅ Update finalized off-chain. New nonce={{n}}', { n: next.nonce }));
    }
  };

  const cooperativeClose = () => {
    if (!latest) return;
    if (status !== 'open') return;

    setStatus('closing-cooperative');
    pushEvent('info', tr('🤝 Cooperative close: both parties submit the latest signed state on-chain.'));

    setStatus('closed');
    pushEvent('success', tr('✅ Channel closed. Funds unlocked to final balances.'));
  };

  const startDisputeClose = () => {
    if (!latest) return;
    if (status !== 'open' && status !== 'updating') return;

    setStatus('closing-disputed');
    setBlocksRemaining(challengePeriodBlocks);
    setOnChainSubmitted(latest);
    setTimelineMarks([
      {
        t: 0,
        lane: 'new',
        kind: 'info',
        action: 'submit',
        nonce: latest.nonce
      }
    ]);
    pushEvent('error', tr('⚠️ Dispute close started. Latest state submitted to L1.'));
    pushEvent('info', tr('Challenge period: {{n}} blocks', { n: challengePeriodBlocks }));
  };

  const submitStateToL1 = (which: 'latest' | 'pending' | 'old') => {
    if (status !== 'closing-disputed') return;
    if (blocksRemaining === null) return;

    const s = which === 'pending' ? pending : which === 'old' ? cheatOldState : latest;
    if (!s) {
      setLastL1Result({ kind: 'invalid', msg: tr('No state available to submit.') });
      pushEvent('error', tr('No state available to submit.'));
      return;
    }

    if (which === 'old') {
      pushEvent(
        'error',
        tr('⚠️ Cheat attempt: submitting an older (but signed) state nonce={{n}} to steal funds.', { n: s.nonce })
      );
    }
    if (!(s.signedByAlice && s.signedByBob)) {
      setLastL1Result({
        kind: 'invalid',
        msg: tr('Invalid: missing signatures (must be signed by both parties).')
      });
      const elapsed = challengePeriodBlocks - blocksRemaining;
      const lane: TimelineLane = which === 'old' ? 'old' : 'new';
      setTimelineMarks((prev) => [
        ...prev,
        { t: elapsed, lane, kind: 'invalid', action: 'submit', nonce: s.nonce }
      ]);
      pushEvent('error', tr('State must be signed by both parties to be valid on-chain.'));
      return;
    }

    const elapsed = challengePeriodBlocks - blocksRemaining;
    const lane: TimelineLane = which === 'old' ? 'old' : 'new';

    if (!onChainSubmitted || s.nonce > onChainSubmitted.nonce) {
      setOnChainSubmitted(s);
      setLastL1Result({
        kind: 'accepted',
        msg: tr('Accepted: newer nonce wins (nonce={{n}}).', { n: s.nonce })
      });
      setTimelineMarks((prev) => [
        ...prev,
        { t: elapsed, lane, kind: 'accepted', action: 'submit', nonce: s.nonce }
      ]);
      pushEvent('success', tr('✅ Submitted newer state to L1 (nonce={{n}}).', { n: s.nonce }));
    } else {
      setLastL1Result({
        kind: 'rejected',
        msg: tr('Rejected: submitted nonce={{n}} is not newer than on-chain best.', { n: s.nonce })
      });
      setTimelineMarks((prev) => [
        ...prev,
        { t: elapsed, lane, kind: 'rejected', action: 'submit', nonce: s.nonce }
      ]);
      pushEvent('info', tr('Submitted state nonce={{n}}, but it is not newer than the current on-chain best.', { n: s.nonce }));
    }
  };

  const mineBlock = () => {
    if (status !== 'closing-disputed') return;
    if (blocksRemaining === null) return;
    const next = blocksRemaining - 1;
    setBlocksRemaining(next);
    if (next <= 0) {
      setStatus('closed');
      setTimelineMarks((prev) => [...prev, { t: challengePeriodBlocks, lane: 'new', kind: 'info', action: 'finalized' }]);
      pushEvent('success', tr('⛏️ Challenge period ended. Channel closed with nonce={{n}}.', { n: onChainSubmitted?.nonce ?? 0 }));
      pushEvent(
        'success',
        tr('Final balances: Alice={{a}}, Bob={{b}}', {
          a: onChainSubmitted?.aliceBalance ?? 0,
          b: onChainSubmitted?.bobBalance ?? 0
        })
      );
    }
  };

  const balances = latest ?? { aliceBalance: 0, bobBalance: 0, nonce: 0, signedByAlice: false, signedByBob: false };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{tr('State Channels (Payment Channels)')}</h1>
          <p className="text-slate-300">
            {tr(
              'Simulate a two-party off-chain channel: lock deposits on L1, exchange signed updates off-chain, and close cooperatively or via a dispute game.'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Setup / controls */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Layers size={18} className="text-blue-300" />
              {tr('Channel Setup')}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-slate-400 mb-1">{tr('Alice deposit (ETH)')}</div>
                  <input
                    type="number"
                    step="0.1"
                    value={depositAlice}
                    onChange={(e) => setDepositAlice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                    disabled={status !== 'not-open'}
                  />
                </label>
                <label className="block">
                  <div className="text-sm text-slate-400 mb-1">{tr('Bob deposit (ETH)')}</div>
                  <input
                    type="number"
                    step="0.1"
                    value={depositBob}
                    onChange={(e) => setDepositBob(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                    disabled={status !== 'not-open'}
                  />
                </label>
              </div>

              <label className="block">
                <div className="text-sm text-slate-400 mb-1 flex items-center gap-2">
                  {tr('Challenge period (blocks)')}
                  <EduTooltip
                    text={tr(
                      'In a dispute close, there is a timeout window where either party can submit a newer valid state. After it ends, the best on-chain state is finalized.'
                    )}
                  />
                </div>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={challengePeriodBlocks}
                  onChange={(e) => setChallengePeriodBlocks(Number(e.target.value))}
                  className="w-full"
                  disabled={status !== 'not-open'}
                />
                <div className="text-sm mt-1">{challengePeriodBlocks}</div>
              </label>

              <div className="flex flex-wrap gap-2 pt-2">
                <EduTooltip
                  text={tr(
                    'Automatically runs a full story: open a channel, create a few updates, start a dispute, submit an old state (cheat), submit the newer state, then mine blocks until finalization.'
                  )}
                >
                  <button
                    onClick={() => {
                      resetAll();
                      openChannel();
                      // create a few updates quickly (auto-signed)
                      setTimeout(() => {
                        proposeUpdate('alice', 0.1);
                        setTimeout(() => {
                          signPending('alice');
                          signPending('bob');
                          setTimeout(() => {
                            proposeUpdate('bob', 0.1);
                            setTimeout(() => {
                              signPending('alice');
                              signPending('bob');
                              setTimeout(() => {
                                startDisputeClose();
                                setTimeout(() => {
                                  submitStateToL1('old');
                                  setTimeout(() => {
                                    submitStateToL1('latest');
                                    // mine blocks until done
                                    const mine = () => {
                                      setTimeout(() => {
                                        mineBlock();
                                        if ((blocksRemaining ?? 1) > 1) mine();
                                      }, 80);
                                    };
                                    mine();
                                  }, 200);
                                }, 200);
                              }, 200);
                            }, 200);
                          }, 200);
                        }, 200);
                      }, 200);
                    }}
                    disabled={status !== 'not-open'}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Send size={16} /> {tr('Auto-run cheat scenario')}
                  </button>
                </EduTooltip>
                <button
                  onClick={resetAll}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-2"
                >
                  <RotateCcw size={16} /> {tr('Reset')}
                </button>

                <EduTooltip text={tr('Lock deposits on L1 and create the channel with an initial signed state (nonce=0).')}>
                  <button
                    onClick={openChannel}
                    disabled={status !== 'not-open'}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 flex items-center gap-2"
                  >
                    <Wallet size={16} /> {tr('Open channel')}
                  </button>
                </EduTooltip>

                <EduTooltip text={tr('Close immediately by submitting the latest mutually signed state (fast path).')}>
                  <button
                    onClick={cooperativeClose}
                    disabled={status !== 'open'}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 flex items-center gap-2"
                  >
                    <BadgeCheck size={16} /> {tr('Cooperative close')}
                  </button>
                </EduTooltip>

                <EduTooltip
                  text={tr(
                    'Start a dispute close: one party submits a state on-chain, then the other can challenge by submitting a newer valid state before the timeout ends.'
                  )}
                >
                  <button
                    onClick={startDisputeClose}
                    disabled={status !== 'open' && status !== 'updating'}
                    className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 flex items-center gap-2"
                  >
                    <Timer size={16} /> {tr('Dispute close')}
                  </button>
                </EduTooltip>
              </div>
            </div>
          </div>

          {/* Channel + updates */}
          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Link size={18} className="text-blue-300" />
                  {tr('Channel State')}
                </h2>
                <p className="text-sm text-slate-400">
                  {tr('Balances are updated off-chain by exchanging signed states. Only deposits + final settlement touch L1.')}
                </p>
              </div>
              <div className="text-right text-sm whitespace-nowrap">
                <div>
                  {tr('Status')}: <span className="font-mono">{status}</span>
                </div>
                <div className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span>
                    {tr('Latest nonce')}: <span className="font-mono">{latest?.nonce ?? '-'}</span>
                  </span>
                  <EduTooltip
                    text={tr(
                      'Nonce is a version counter for channel states. Each signed update increments the nonce. During disputes, the highest valid nonce wins.'
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-2">{tr('Balances')}</div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="text-slate-400">{tr('Alice')}</div>
                    <div className="font-mono text-emerald-200">{formatEth(balances.aliceBalance)}</div>
                  </div>
                  <ArrowLeftRight className="text-slate-500" />
                  <div className="text-sm text-right">
                    <div className="text-slate-400">{tr('Bob')}</div>
                    <div className="font-mono text-emerald-200">{formatEth(balances.bobBalance)}</div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-400">
                  {tr('Total locked')}: <span className="font-mono">{formatEth(totalDeposits)}</span>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                  {tr('Latest signed state')}
                  <EduTooltip
                    text={tr(
                      'The latest state signed by both parties is the one that should be settled on-chain. Higher nonce = newer state.'
                    )}
                  />
                </div>

                {latest ? (
                  <div className="space-y-2 font-mono text-sm">
                    <div>{tr('nonce')}: {latest.nonce}</div>
                    <div>{tr('Alice')}: {latest.aliceBalance.toFixed(3)}</div>
                    <div>{tr('Bob')}: {latest.bobBalance.toFixed(3)}</div>
                    <div className="text-xs text-slate-400">
                      {tr('Signatures')}: {latest.signedByAlice ? 'A' : '-'} {latest.signedByBob ? 'B' : '-'}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">{tr('No channel yet. Open a channel to begin.')}</div>
                )}
              </div>
            </div>

            {/* Off-chain update flow */}
            <div className="mt-4 bg-slate-950/40 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold text-blue-300 flex items-center gap-2">
                  <Send size={16} /> {tr('Off-chain updates')}
                </h3>
                <div className="text-xs text-slate-400">
                  {tr('Updates require both signatures to become the new latest state.')}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <EduTooltip text={tr('Propose a new off-chain state update where Alice sends ETH to Bob.')}>
                  <button
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap"
                    disabled={!latest || status !== 'open'}
                    onClick={() => proposeUpdate('alice', 0.1)}
                  >
                    <HandCoins size={16} /> {tr('Alice → Bob (0.1)')}
                  </button>
                </EduTooltip>

                <EduTooltip text={tr('Propose a new off-chain state update where Bob sends ETH to Alice.')}>
                  <button
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap"
                    disabled={!latest || status !== 'open'}
                    onClick={() => proposeUpdate('bob', 0.1)}
                  >
                    <HandCoins size={16} /> {tr('Bob → Alice (0.1)')}
                  </button>
                </EduTooltip>
              </div>

              {pending && (
                <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                  <div className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                    {tr('Pending state')}
                    <EduTooltip text={tr('This proposed state is not final until both parties sign it.')} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="font-mono text-sm">
                      <div>{tr('nonce')}: {pending.nonce}</div>
                      <div>{tr('Alice')}: {pending.aliceBalance.toFixed(3)}</div>
                      <div>{tr('Bob')}: {pending.bobBalance.toFixed(3)}</div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-start">
                      <EduTooltip text={tr('Alice signs the pending state update.')}>
                        <button
                          onClick={() => signPending('alice')}
                          disabled={pending.signedByAlice}
                          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap"
                        >
                          <ShieldCheck size={16} /> {tr('Sign as Alice')}
                        </button>
                      </EduTooltip>

                      <EduTooltip text={tr('Bob signs the pending state update.')}>
                        <button
                          onClick={() => signPending('bob')}
                          disabled={pending.signedByBob}
                          className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap"
                        >
                          <ShieldCheck size={16} /> {tr('Sign as Bob')}
                        </button>
                      </EduTooltip>

                      <div className="text-xs text-slate-400 w-full">
                        {tr('Signatures')}: {pending.signedByAlice ? 'A' : '-'} {pending.signedByBob ? 'B' : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Channel lifecycle */}
            <div className="mt-4 bg-slate-950/40 border border-slate-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-300 mb-2 flex items-center gap-2">
                <Layers size={16} /> {tr('Channel lifecycle')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                  <div className="font-semibold mb-1 inline-flex items-center gap-2">
                    <Wallet size={14} className="text-emerald-300" />
                    {tr('1) Open')}
                  </div>
                  <div className="text-xs text-slate-300">
                    {tr('Lock deposits on L1 and create state nonce=0 signed by both parties.')}
                  </div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                  <div className="font-semibold mb-1 inline-flex items-center gap-2">
                    <ArrowLeftRight size={14} className="text-blue-300" />
                    {tr('2) Update')}
                  </div>
                  <div className="text-xs text-slate-300">
                    {tr('Exchange signed states off-chain (nonce increments). No gas for each update.')}
                  </div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                  <div className="font-semibold mb-1 inline-flex items-center gap-2">
                    <BadgeCheck size={14} className="text-emerald-300" />
                    {tr('3) Close')}
                  </div>
                  <div className="text-xs text-slate-300">{tr('Settle with the latest signed state on L1.')}</div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                  <div className="font-semibold mb-1 inline-flex items-center gap-2">
                    <Timer size={14} className="text-rose-300" />
                    {tr('4) Dispute')}
                  </div>
                  <div className="text-xs text-slate-300">
                    {tr('If someone cheats with an old state, submit a newer signed state before the timeout ends.')}
                  </div>
                </div>
              </div>
            </div>

            {/* Dispute close */}
            <div className="mt-4 bg-slate-950/40 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold text-blue-300 flex items-center gap-2">
                  <Clock size={16} /> {tr('Dispute close (L1)')}
                </h3>
                <div className="text-xs text-slate-400">
                  {status === 'closing-disputed' ? (
                    <span className="font-mono">{blocksRemaining}</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-300" />
                      {tr('Not in dispute')}
                    </span>
                  )}
                </div>
              </div>

              {/* Challenge window progress */}
              {status === 'closing-disputed' && blocksRemaining !== null && (
                <div className="mt-3 bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>{tr('Challenge window progress')}</span>
                    <span className="font-mono">
                      {tr('Blocks remaining')}: {blocksRemaining} / {challengePeriodBlocks}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-gradient-to-r from-yellow-400 to-emerald-400 transition-all duration-300"
                      style={{
                        width: `${
                          ((challengePeriodBlocks - blocksRemaining) / challengePeriodBlocks) * 100
                        }%`
                      }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    {tr(
                      'During this window, either party can submit a newer signed state. When it reaches 0, the best on-chain state is finalized.'
                    )}
                  </div>

                  {/* 2-lane timeline */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(
                      [
                        { lane: 'old' as const, label: tr('Old state submissions') },
                        { lane: 'new' as const, label: tr('Newer state submissions') }
                      ]
                    ).map(({ lane, label }) => (
                      <div key={lane} className="bg-slate-950/40 border border-slate-800 rounded-lg p-2">
                        <div className="text-[11px] text-slate-400 mb-2">{label}</div>
                        <div className="relative h-6 bg-slate-800 rounded">
                          {/* finalized marker */}
                          <div
                            className="absolute top-0 bottom-0 w-[2px] bg-emerald-400/50"
                            style={{ left: '100%' }}
                            title={tr('Finalized')}
                          />

                          {timelineMarks
                            .filter((m) => m.lane === lane && m.action === 'submit')
                            .map((m, i) => {
                              const pct = (m.t / challengePeriodBlocks) * 100;
                              const color =
                                m.kind === 'accepted'
                                  ? 'bg-emerald-400'
                                  : m.kind === 'rejected'
                                    ? 'bg-yellow-400'
                                    : 'bg-rose-400';
                              return (
                                <div
                                  key={`${lane}-${m.t}-${i}`}
                                  className={`absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ${color} ring-2 ring-slate-900`}
                                  style={{ left: `${pct}%` }}
                                  title={tr('nonce={{n}} ({{kind}})', { n: m.nonce ?? 0, kind: m.kind })}
                                />
                              );
                            })}
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <EduTooltip text={tr('Submit the latest mutually signed state to L1 as the current best.')}
                >
                  <button
                    disabled={status !== 'closing-disputed'}
                    onClick={() => submitStateToL1('latest')}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Send size={16} /> {tr('Submit latest state')}
                  </button>
                </EduTooltip>

                <EduTooltip text={tr('Try to submit the pending state (only works if it is fully signed).')}>
                  <button
                    disabled={status !== 'closing-disputed'}
                    onClick={() => submitStateToL1('pending')}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Send size={16} /> {tr('Submit pending state')}
                  </button>
                </EduTooltip>

                <EduTooltip
                  text={tr(
                    'Demonstrates a classic channel attack: submitting a previously signed old state. The counterparty must respond with a newer signed state before the timeout.'
                  )}
                >
                  <button
                    disabled={status !== 'closing-disputed'}
                    onClick={() => submitStateToL1('old')}
                    className="px-3 py-2 rounded-lg bg-rose-800 hover:bg-rose-700 border border-rose-700 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <ShieldX size={16} /> {tr('Submit old state (cheat)')}
                  </button>
                </EduTooltip>

                <EduTooltip text={tr('Advance time by one block. When the counter hits 0, the on-chain best state is finalized.')}
                >
                  <button
                    disabled={status !== 'closing-disputed'}
                    onClick={mineBlock}
                    className="px-3 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Clock size={16} /> {tr('Mine block')}
                  </button>
                </EduTooltip>
              </div>

              {/* Timeline legend */}
              {status === 'closing-disputed' && blocksRemaining !== null && (
                <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">{tr('Legend')}:</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> {tr('Accepted')}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-400" /> {tr('Rejected')}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400" /> {tr('Invalid')}
                  </span>
                </div>
              )}

              {lastL1Result && (
                <div
                  className={`mt-3 rounded-lg border p-3 text-xs ${
                    lastL1Result.kind === 'accepted'
                      ? 'border-emerald-800 bg-emerald-900/20 text-emerald-200'
                      : lastL1Result.kind === 'rejected'
                        ? 'border-yellow-800 bg-yellow-900/20 text-yellow-200'
                        : 'border-rose-800 bg-rose-900/20 text-rose-200'
                  }`}
                >
                  <div className="font-semibold mb-1">{tr('Last L1 submission')}</div>
                  <div className="font-mono">{lastL1Result.msg}</div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">{tr('On-chain best state')}</div>
                  {onChainSubmitted ? (
                    <div className="font-mono text-xs">
                      <div>{tr('nonce')}: {onChainSubmitted.nonce}</div>
                      <div>{tr('Alice')}: {onChainSubmitted.aliceBalance.toFixed(3)}</div>
                      <div>{tr('Bob')}: {onChainSubmitted.bobBalance.toFixed(3)}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">{tr('Nothing submitted yet.')}</div>
                  )}
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">{tr('Validity rules')}</div>
                  <ul className="text-xs text-slate-300 space-y-1">
                    <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5" />{tr('State must be signed by both parties')}</li>
                    <li className="flex gap-2"><ArrowLeftRight size={14} className="mt-0.5" />{tr('Newer nonce wins')}</li>
                    <li className="flex gap-2"><Ban size={14} className="mt-0.5" />{tr('Old states can be challenged by newer ones during the window')}</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Event log */}
            <div className="mt-4 bg-slate-950/40 border border-slate-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-300 mb-2">{tr('Event log')}</h3>
              {events.length === 0 ? (
                <div className="text-sm text-slate-500">{tr('No events yet.')}</div>
              ) : (
                <div className="space-y-2">
                  {events.map((e) => (
                    <div
                      key={e.ts}
                      className={`text-sm font-mono ${
                        e.kind === 'success'
                          ? 'text-emerald-300'
                          : e.kind === 'error'
                            ? 'text-rose-300'
                            : 'text-slate-200'
                      }`}
                    >
                      {e.msg}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* What is it? */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-blue-300">{tr('What is a state channel?')}</h3>
                <p className="text-sm text-slate-300">
                  {tr(
                    'A state channel is a 2-party protocol where funds are locked on-chain once, then participants exchange signed messages off-chain to update balances or application state. Only the final agreed state needs to be settled on-chain.'
                  )}
                </p>
                <div className="mt-3 text-xs text-slate-400">
                  {tr('Good for')}: {tr('many repeated interactions between the same parties (payments, games, trading).')}
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-blue-300">{tr('When are channels useful?')}</h3>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>{tr('Instant UX: most interactions finalize off-chain in milliseconds.')}</li>
                  <li>{tr('Low fees: only open/close touch L1, so costs are amortized.')}</li>
                  <li>{tr('Privacy: off-chain updates are not broadcast to the whole network.')}</li>
                  <li>{tr('Security: L1 acts as a court of final appeal during disputes.')}</li>
                </ul>
                <div className="mt-3 text-xs text-slate-400">
                  {tr('Limitations')}: {tr('requires parties to be online to respond during disputes; liquidity is locked until close.')}
                </div>
              </div>
            </div>

            {/* Real-world + Further reading */}
            <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
              <h2 className="text-2xl font-bold mb-4 text-blue-300 flex items-center gap-2">
                <Layers size={20} />
                {tr('Real-World Applications')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="font-semibold text-emerald-300 mb-2">{tr('Lightning Network')}</div>
                  <p className="text-slate-300 text-sm">
                    {tr('Bitcoin payment channels route payments off-chain with HTLCs, using on-chain settlement only for open/close or disputes.')}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-purple-300 mb-2">{tr('Raiden / Ethereum channels')}</div>
                  <p className="text-slate-300 text-sm">
                    {tr('Ethereum-style channels enable instant micro-payments and gaming moves with final settlement on-chain.')}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-pink-300 mb-2">{tr('Gaming & micropayments')}</div>
                  <p className="text-slate-300 text-sm">
                    {tr('Off-chain state updates are ideal for high-frequency interactions: games, tipping, streaming payments.')}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-yellow-300 mb-2">{tr('Why it matters')}</div>
                  <p className="text-slate-300 text-sm">
                    {tr('Channels reduce L1 load by keeping most updates off-chain, while preserving security via dispute resolution.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-4 text-blue-300 flex items-center gap-2">
                <Link size={20} />
                {tr('Further Reading')}
              </h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    className="text-blue-300 hover:text-blue-200 underline"
                    href="https://lightning.network/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tr('Lightning Network overview →')}
                  </a>
                </li>
                <li>
                  <a
                    className="text-blue-300 hover:text-blue-200 underline"
                    href="https://ethereum.org/en/developers/docs/scaling/state-channels/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tr('Ethereum.org: State channels →')}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
