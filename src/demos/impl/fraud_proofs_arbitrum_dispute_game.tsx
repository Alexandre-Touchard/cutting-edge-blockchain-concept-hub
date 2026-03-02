import React, { useMemo, useState } from 'react';
import {
  Play,
  RotateCcw,
  FastForward,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Workflow,
  Globe,
  BookOpen,
  Swords,
  Split,
  Gavel
} from 'lucide-react';
import { useDemoI18n } from '../useDemoI18n';
import EduTooltip from '../../ui/EduTooltip';
import { define } from '../glossary';

type Phase =
  | 'setup'
  | 'asserted'
  | 'challenged'
  | 'bisection'
  | 'one-step-proof'
  | 'resolved';

type Event = {
  ts: number;
  kind: 'info' | 'success' | 'error';
  msg: string;
};

type Trace = {
  steps: number;
  inputs: number[]; // length = steps
  trueStates: number[]; // length = steps + 1
  claimedStates: number[]; // length = steps + 1
  bugStep: number | null; // first incorrect transition step
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function transition(prev: number, input: number) {
  // Simple deterministic transition (stands in for a VM step / tx execution).
  return (prev * 31 + input) % 100000;
}

function buildTrace(opts: { steps: number; seed: number; malicious: boolean }): Trace {
  const rng = mulberry32(opts.seed);
  const inputs = Array.from({ length: opts.steps }, () => 1 + Math.floor(rng() * 997));

  const trueStates = [1000];
  for (let i = 0; i < opts.steps; i++) {
    trueStates.push(transition(trueStates[i], inputs[i]));
  }

  const claimedStates = [...trueStates];
  let bugStep: number | null = null;

  if (opts.malicious && opts.steps >= 4) {
    bugStep = 1 + Math.floor(rng() * (opts.steps - 2));
    // Introduce a wrong state at bugStep+1, then keep applying transition from the wrong state
    // so the claim remains internally consistent.
    claimedStates[bugStep + 1] = (claimedStates[bugStep] + 1337) % 100000;
    for (let i = bugStep + 1; i < opts.steps; i++) {
      claimedStates[i + 1] = transition(claimedStates[i], inputs[i]);
    }
  }

  return { steps: opts.steps, inputs, trueStates, claimedStates, bugStep };
}

function firstMismatchIndex(trace: Trace): number | null {
  for (let i = 0; i <= trace.steps; i++) {
    if (trace.trueStates[i] !== trace.claimedStates[i]) return i;
  }
  return null;
}

function rangeContainsMismatch(trace: Trace, lo: number, hi: number): boolean {
  // mismatch can be at a state index. For a step range [lo,hi], the relevant state indices are [lo..hi].
  for (let i = lo; i <= hi; i++) {
    if (trace.trueStates[i] !== trace.claimedStates[i]) return true;
  }
  return false;
}

export const demoMeta = {
  id: 'fraud-proofs-arbitrum',
  title: 'Fraud Proofs (Optimistic Rollup Arbitrum Dispute Game)',
  category: 'scaling',
  difficulty: 'Advanced'
} as const;

const T = ({ term }: { term: Parameters<typeof define>[0] }) => (
  <EduTooltip term={term} text={define(term)} />
);

export default function FraudProofsArbitrumDisputeGame() {
  const { tr } = useDemoI18n('fraud-proofs-arbitrum');

  const [steps, setSteps] = useState(16);
  const [seed, setSeed] = useState(42);
  const [malicious, setMalicious] = useState(true);

  const trace = useMemo(() => buildTrace({ steps, seed, malicious }), [steps, seed, malicious]);

  const [phase, setPhase] = useState<Phase>('setup');
  const [events, setEvents] = useState<Event[]>([]);

  const [bondProposer, setBondProposer] = useState(1.0);
  const [bondChallenger, setBondChallenger] = useState(1.0);

  // disputed state index interval [lo, hi]
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(steps);

  const mismatchAt = useMemo(() => firstMismatchIndex(trace), [trace]);

  const pushEvent = (kind: Event['kind'], msg: string) =>
    setEvents((prev) => [{ ts: Date.now(), kind, msg }, ...prev].slice(0, 12));

  const resetAll = () => {
    setPhase('setup');
    setEvents([]);
    setLo(0);
    setHi(steps);
    pushEvent('info', tr('Reset demo state.'));
  };

  const postAssertion = () => {
    setPhase('asserted');
    setLo(0);
    setHi(steps);
    pushEvent(
      'info',
      tr('📌 Proposer posts an assertion: state[0] → state[{{n}}].', { n: steps })
    );
    pushEvent('info', tr('Proposer bond locked: {{bond}} ETH', { bond: bondProposer }));
  };

  const challenge = () => {
    setPhase('challenged');
    pushEvent('info', tr('⚔️ Challenger disputes the assertion and posts a bond.'));
    pushEvent('info', tr('Challenger bond locked: {{bond}} ETH', { bond: bondChallenger }));

    setPhase('bisection');
    pushEvent('info', tr('Entering interactive bisection (binary search) to find the first disputed step.'));
  };

  const commitMidpoint = () => {
    if (hi - lo <= 1) {
      setPhase('one-step-proof');
      pushEvent('info', tr('Dispute range is 1 step - ready for one-step proof on L1.'));
      return;
    }
    const mid = Math.floor((lo + hi) / 2);
    const claimedMid = trace.claimedStates[mid];
    pushEvent('info', tr('Proposer commits midpoint state[{{mid}}] = {{value}}', { mid, value: claimedMid }));

    // Challenger chooses half where mismatch lies.
    const leftHasMismatch = rangeContainsMismatch(trace, lo, mid);
    const rightHasMismatch = rangeContainsMismatch(trace, mid, hi);

    // In a valid dispute there should be a mismatch in exactly one half.
    const choose: 'left' | 'right' = leftHasMismatch && !rightHasMismatch ? 'left' : 'right';

    if (choose === 'left') {
      setHi(mid);
      pushEvent('info', tr('Challenger selects LEFT half: [{{lo}}, {{hi}}]', { lo, hi: mid }));
    } else {
      setLo(mid);
      pushEvent('info', tr('Challenger selects RIGHT half: [{{lo}}, {{hi}}]', { lo: mid, hi }));
    }

    if (mid - lo <= 1 || hi - mid <= 1) {
      // Might become a 1-step range after this update; check next render.
    }
  };

  const resolveOneStepProof = () => {
    if (hi - lo !== 1) {
      pushEvent('error', tr('One-step proof can only run when hi = lo + 1.'));
      return;
    }
    // Final disputed step is lo
    const stepIdx = lo;
    const trueNext = trace.trueStates[stepIdx + 1];
    const claimedNext = trace.claimedStates[stepIdx + 1];

    pushEvent('info', tr('🔎 L1 verifies a single step: state[{{i}}] → state[{{j}}]', { i: stepIdx, j: stepIdx + 1 }));

    if (trueNext !== claimedNext) {
      // Proposer is wrong
      pushEvent('success', tr('✅ Fraud proven! Proposer loses bond; challenger wins.'));
      setPhase('resolved');
    } else {
      pushEvent('error', tr('❌ No fraud: challenger was wrong and loses their bond.'));
      setPhase('resolved');
    }
  };

  const autoplayToResolution = () => {
    if (phase === 'setup') postAssertion();
    if (phase === 'asserted') challenge();
    if (phase === 'challenged') {
      // will move to bisection inside challenge()
    }

    // Run bisection until one step.
    let aLo = lo;
    let aHi = hi;

    // If we are not yet in bisection state due to setState async, just push an event.
    pushEvent('info', tr('⏩ Auto-playing bisection rounds...'));

    // Compute using current trace synchronously.
    while (aHi - aLo > 1) {
      const mid = Math.floor((aLo + aHi) / 2);
      const leftHasMismatch = rangeContainsMismatch(trace, aLo, mid);
      const rightHasMismatch = rangeContainsMismatch(trace, mid, aHi);
      const choose: 'left' | 'right' = leftHasMismatch && !rightHasMismatch ? 'left' : 'right';
      if (choose === 'left') aHi = mid;
      else aLo = mid;
    }

    setPhase('one-step-proof');
    setLo(aLo);
    setHi(aHi);
    pushEvent('info', tr('Reached one-step proof range: [{{lo}}, {{hi}}]', { lo: aLo, hi: aHi }));
  };

  const statusPill = useMemo(() => {
    const ok = mismatchAt === null;
    if (ok) {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/30 border border-emerald-700 text-emerald-200 text-sm">
          <ShieldCheck size={16} />
          {tr('Honest assertion (no mismatch)')}
        </span>
      );
    }
    return (
      <EduTooltip
        text={tr(
          'A mismatch means the proposer\'s claimed state diverges from the true execution trace. Bisection narrows down where the first mismatch occurs, then L1 verifies a single step.'
        )}
      >
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-900/30 border border-rose-700 text-rose-200 text-sm">
          <ShieldAlert size={16} />
          {tr('Mismatch exists (fraud) at state index {{idx}}', { idx: mismatchAt })}
        </span>
      </EduTooltip>
    );
  }, [mismatchAt, tr]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {tr('Fraud Proofs')} <span className="text-slate-400">-</span> {tr('Arbitrum-Style Dispute Game')}
          </h1>
          <p className="text-slate-300">
            {tr(
              'Simulate an interactive fraud proof: a proposer posts an assertion, a challenger disputes, and both bisect the execution trace until L1 verifies a single step.'
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">{statusPill}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Settings size={18} className="text-blue-300" />
              {tr('Setup')}
            </h2>

            <div className="space-y-4">
              <label className="block">
                <div className="text-sm text-slate-400 mb-1 flex items-center gap-2">
                  {tr('Trace Steps')}
                  <EduTooltip
                    text={tr(
                      'How many execution steps are in the simulated trace. More steps means more bisection rounds to isolate a single disputed step.'
                    )}
                  />
                </div>
                <input
                  type="range"
                  min={8}
                  max={64}
                  step={8}
                  value={steps}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSteps(v);
                    setHi(v);
                    setLo(0);
                    setPhase('setup');
                  }}
                  className="w-full"
                />
                <div className="text-sm mt-1">{steps}</div>
              </label>

              <label className="block">
                <div className="text-sm text-slate-400 mb-1">{tr('Random Seed')}</div>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => {
                    setSeed(Number(e.target.value));
                    setPhase('setup');
                    setLo(0);
                    setHi(steps);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                />
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={malicious}
                  onChange={(e) => {
                    setMalicious(e.target.checked);
                    setPhase('setup');
                    setLo(0);
                    setHi(steps);
                  }}
                />
                <span className="text-sm">{tr('Malicious proposer (inject a wrong step)')}</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-slate-400 mb-1">{tr('Proposer bond (ETH)')}</div>
                  <input
                    type="number"
                    step="0.1"
                    value={bondProposer}
                    onChange={(e) => setBondProposer(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                  />
                </label>
                <label className="block">
                  <div className="text-sm text-slate-400 mb-1">{tr('Challenger bond (ETH)')}</div>
                  <input
                    type="number"
                    step="0.1"
                    value={bondChallenger}
                    onChange={(e) => setBondChallenger(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={resetAll}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-2"
                >
                  <RotateCcw size={16} /> {tr('Reset')}
                </button>

                <EduTooltip
                  text={tr(
                    'Post an assertion (claim) about the final state after executing the rollup batch. This locks the proposer bond and starts the dispute window.'
                  )}
                >
                  <button
                    onClick={postAssertion}
                    disabled={phase !== 'setup'}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 flex items-center gap-2"
                  >
                    <Play size={16} /> {tr('Post Assertion')}
                  </button>
                </EduTooltip>

                <EduTooltip
                  text={tr(
                    'Challenge the assertion by posting a challenger bond. This starts the interactive dispute game (bisection).' 
                  )}
                >
                  <button
                    onClick={challenge}
                    disabled={phase !== 'asserted'}
                    className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 flex items-center gap-2"
                  >
                    <Swords size={16} /> {tr('Challenge')}
                  </button>
                </EduTooltip>

                <EduTooltip
                  text={tr(
                    'Commit a midpoint state for the currently disputed interval. The challenger then picks the half-range where the mismatch lies (binary search).' 
                  )}
                >
                  <button
                    onClick={commitMidpoint}
                    disabled={phase !== 'bisection'}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 flex items-center gap-2"
                  >
                    <Split size={16} /> {tr('Commit midpoint + bisect')}
                  </button>
                </EduTooltip>

                <EduTooltip
                  text={tr(
                    'Automatically run the bisection rounds to reach a 1-step dispute interval (hi = lo + 1), ready for the final on-chain check.'
                  )}
                >
                  <button
                    onClick={autoplayToResolution}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-2"
                  >
                    <FastForward size={16} /> {tr('Auto-play to one-step proof')}
                  </button>
                </EduTooltip>

                <EduTooltip
                  text={tr(
                    'Execute the one-step proof on L1: verify the single disputed transition. The winner receives the loser\'s bond.'
                  )}
                >
                  <button
                    onClick={resolveOneStepProof}
                    disabled={phase !== 'one-step-proof'}
                    className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Gavel size={16} /> {tr('Execute one-step proof')}
                  </button>
                </EduTooltip>
              </div>
            </div>
          </div>

          {/* Visualization */}
          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Workflow size={18} className="text-blue-300" />
                  {tr('Dispute Trace')}
                </h2>
                <p className="text-sm text-slate-400">
                  {tr(
                    'The dispute range [lo..hi] refers to state indices. When it shrinks to a single transition (hi = lo + 1), L1 can verify that one step to decide the winner.'
                  )}
                </p>
              </div>
              <div className="text-right text-sm">
                <div>
                  {tr('Phase')}: <span className="font-mono text-slate-200">{phase}</span>
                </div>
                <div className="whitespace-nowrap inline-flex items-center gap-2">
                  <span>{tr('Dispute steps')}:</span>
                  <span className="font-mono">[{lo}, {hi}]</span>
                  <EduTooltip
                    text={tr(
                      'This is the current disputed interval. Bisection keeps shrinking it until only one transition remains (hi = lo + 1) for the one-step proof.'
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                  {tr('Assertion')}
                  <EduTooltip
                    text={tr(
                      'An assertion is a claim about the rollup state after executing a batch (e.g., a state root). It is optimistic: it is accepted unless successfully challenged within the dispute window.'
                    )}
                  />
                </div>
                <div className="font-mono text-sm">
                  state[0] = {trace.trueStates[0]}<br />
                  {tr('Claimed')}: state[{steps}] = {trace.claimedStates[steps]}
                  <br />
                  {tr('True')}: state[{steps}] = {trace.trueStates[steps]}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {trace.bugStep === null
                    ? tr('No injected bug (honest).')
                    : tr('Injected incorrect transition at step {{step}} (first wrong state is index {{idx}}).', {
                        step: trace.bugStep,
                        idx: trace.bugStep + 1
                      })}
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-2">{tr('Timeline')}</div>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: steps + 1 }).map((_, idx) => {
                    const inRange = idx >= lo && idx <= hi;
                    const mismatch = trace.trueStates[idx] !== trace.claimedStates[idx];
                    const cls = inRange
                      ? mismatch
                        ? 'bg-rose-500'
                        : 'bg-emerald-500'
                      : mismatch
                        ? 'bg-rose-900/60'
                        : 'bg-slate-700';
                    return (
                      <div
                        key={idx}
                        title={`state[${idx}]`}
                        className={`h-3 w-3 rounded-sm ${cls}`}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {tr('Green = states match, Red = mismatch. Highlighted = currently disputed interval.')}
                </div>
              </div>
            </div>

            <div className="mt-4 bg-slate-950/40 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-slate-400">{tr('Latest events')}</div>
                <div className="text-xs text-slate-500">{tr('Most recent first')}</div>
              </div>
              <div className="space-y-2">
                {events.length === 0 ? (
                  <div className="text-sm text-slate-500">{tr('No events yet. Start by posting an assertion.')}</div>
                ) : (
                  events.map((e) => (
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
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-blue-300">{tr('How the Arbitrum-style dispute game works')}</h3>
                <ol className="list-decimal ml-5 text-sm text-slate-300 space-y-1">
                  <li>{tr('A proposer posts a claim about the final state (with a bond).')}</li>
                  <li>{tr('A challenger disputes and posts their bond.')}</li>
                  <li>{tr('They repeatedly bisect the execution trace to isolate the first disputed step.')}</li>
                  <li>{tr('Ethereum (L1) verifies a single step on-chain to resolve the dispute.')}</li>
                </ol>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-blue-300">{tr('Why bisection matters')}</h3>
                <p className="text-sm text-slate-300">
                  {tr(
                    'Instead of re-executing the whole batch on L1, bisection narrows the disagreement to one step. This keeps verification cheap while still catching invalid state transitions.'
                  )}
                </p>
              </div>
            </div>

            {/* Real-World Applications */}
            <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
              <h2 className="text-2xl font-bold mb-4 text-blue-300 flex items-center gap-2">
                <Globe size={20} />
                {tr('Real-World Applications')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="font-semibold text-emerald-300 mb-2">{tr('Arbitrum Nitro')}</div>
                  <p className="text-slate-300 mb-2">
                    {tr(
                      'Arbitrum uses an interactive dispute game to keep L1 verification costs low: only a single step is checked on-chain at the end.'
                    )}
                  </p>
                  <div className="bg-slate-900 rounded p-2 font-mono text-xs text-emerald-400">
                    {tr('bisection rounds → one-step proof on L1')}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-purple-300 mb-2">{tr('Optimistic rollup withdrawals')}</div>
                  <p className="text-slate-300 mb-2">
                    {tr(
                      'Withdrawals are delayed by a challenge period. If an invalid assertion is posted, challengers can dispute before funds finalize.'
                    )}
                  </p>
                  <div className="bg-slate-900 rounded p-2 font-mono text-xs text-emerald-400">
                    {tr('fast L2 UX + delayed L1 finality')}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-pink-300 mb-2">{tr('Security & monitoring')}</div>
                  <p className="text-slate-300 mb-2">
                    {tr(
                      'Rollup safety depends on at least one honest challenger. In practice, teams run monitoring + challenger infrastructure to react quickly.'
                    )}
                  </p>
                  <div className="bg-slate-900 rounded p-2 font-mono text-xs text-emerald-400">
                    {tr('watch assertions → challenge if invalid')}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-yellow-300 mb-2">{tr('Why it matters for scaling')}</div>
                  <p className="text-slate-300 mb-2">
                    {tr(
                      'Fraud proofs let rollups inherit Ethereum security without re-executing everything on L1. Most transactions happen off-chain; L1 is the court of final appeal.'
                    )}
                  </p>
                  <div className="bg-slate-900 rounded p-2 font-mono text-xs text-emerald-400">
                    {tr('execute off-chain, verify on-chain')}
                  </div>
                </div>
              </div>
            </div>

            {/* Further Reading */}
            <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-4 text-blue-300 flex items-center gap-2">
                <BookOpen size={20} />
                {tr('Further Reading')}
              </h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    className="text-blue-300 hover:text-blue-200 underline"
                    href="https://docs.arbitrum.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tr('Arbitrum documentation →')}
                  </a>
                </li>
                <li>
                  <a
                    className="text-blue-300 hover:text-blue-200 underline"
                    href="https://research.arbitrum.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tr('Arbitrum research →')}
                  </a>
                </li>
                <li>
                  <a
                    className="text-blue-300 hover:text-blue-200 underline"
                    href="https://ethereum.org/en/layer-2/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tr('Ethereum.org: Layer 2 overview →')}
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
