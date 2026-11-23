import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Gavel,
  ChevronDown,
  ChevronRight,
  Square
} from 'lucide-react';
import { useDemoI18n } from '../useDemoI18n';
import EduTooltip from '../../ui/EduTooltip';
import { define } from '../glossary';
import { useDemoQuests, QuestList, NextQuestCard } from '../quests/DemoQuests';

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

export function buildTrace(opts: { steps: number; seed: number; malicious: boolean }): Trace {
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

export function firstMismatchIndex(trace: Trace): number | null {
  for (let i = 0; i <= trace.steps; i++) {
    if (trace.trueStates[i] !== trace.claimedStates[i]) return i;
  }
  return null;
}

/**
 * One bisection round. Invariant: both parties agree on state[lo] and disagree on state[hi].
 * The challenger checks the proposer's midpoint: if it agrees, the first wrong step is in the right
 * half, otherwise in the left half. This converges on the first incorrect transition (a wrong claim
 * stays wrong after the bug, so "which half contains a mismatch" would always say "right").
 * With an honest proposer every midpoint agrees, so the game ends on the last step and the
 * challenger loses.
 */
export function bisectStep(trace: Trace, lo: number, hi: number): { mid: number; lo: number; hi: number; side: 'left' | 'right' } {
  const mid = Math.floor((lo + hi) / 2);
  const midAgrees = trace.trueStates[mid] === trace.claimedStates[mid];
  return midAgrees ? { mid, lo: mid, hi, side: 'right' } : { mid, lo, hi: mid, side: 'left' };
}

export type AutoPlayAction = 'post' | 'challenge' | 'bisect' | 'prove' | 'done';

/** What auto-play does next, given the current (fresh) game state. Every action changes phase, lo or hi. */
export function autoPlayAction(phase: Phase, lo: number, hi: number): AutoPlayAction {
  switch (phase) {
    case 'setup':
      return 'post';
    case 'asserted':
      return 'challenge';
    case 'challenged':
    case 'bisection':
      return hi > lo ? 'bisect' : 'done';
    case 'one-step-proof':
      return hi - lo === 1 ? 'prove' : 'done';
    default:
      return 'done';
  }
}

/** Delay between two auto-play moves, so each phase is visible. */
const AUTO_PLAY_STEP_MS = 900;

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

  const [isSetupVisible, setIsSetupVisible] = useState(true);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);

  // disputed state index interval [lo, hi]
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(steps);

  const mismatchAt = useMemo(() => firstMismatchIndex(trace), [trace]);

  const q = useDemoQuests('fraud-proofs-arbitrum', [
    {
      id: 'post-fraud',
      text: tr('Post a fraudulent assertion'),
      tip: tr('Keep Malicious proposer ticked and click Post Assertion: the claimed final state differs from the true one.'),
      done: phase !== 'setup' && mismatchAt !== null,
      target: 'post-assertion'
    },
    {
      id: 'challenge',
      text: tr('Challenge the assertion'),
      tip: tr('Click Challenge to lock the challenger bond and open the interactive bisection game.'),
      done: phase === 'bisection',
      target: 'challenge'
    },
    {
      id: 'bisect',
      text: tr('Bisect by hand down to a single step'),
      tip: tr('Click Commit midpoint + bisect repeatedly (no auto-play): each round halves [lo, hi] until hi = lo + 1.'),
      done: phase === 'bisection' && hi - lo === 1 && !autoPlaying,
      target: 'bisect'
    },
    {
      id: 'prove-fraud',
      text: tr('Win the dispute with a one-step proof'),
      tip: tr('Click Commit midpoint + bisect once more to reach the one-step phase, then Execute one-step proof: L1 checks one transition and the proposer loses its bond.'),
      done: phase === 'resolved' && trace.trueStates[lo + 1] !== trace.claimedStates[lo + 1],
      target: 'one-step'
    },
    {
      id: 'honest-loses',
      text: tr('Challenge an honest proposer and lose'),
      tip: tr('Untick Malicious proposer, then post, challenge, bisect and Execute one-step proof (or just click Auto-play full dispute): this time the challenger loses its bond.'),
      done: phase === 'resolved' && mismatchAt === null,
      target: 'malicious'
    }
  ]);

  // Unique, increasing ids for the event list (several events can share the same millisecond).
  const eventSeq = useRef(0);
  const pushEvent = (kind: Event['kind'], msg: string) => {
    const ts = ++eventSeq.current;
    setEvents((prev) => [{ ts, kind, msg }, ...prev].slice(0, 12));
  };

  const resetAll = () => {
    setAutoPlaying(false);
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
    // Challenger chooses the half where the mismatch lies.
    const next = bisectStep(trace, lo, hi);
    pushEvent('info', tr('Proposer commits midpoint state[{{mid}}] = {{value}}', { mid: next.mid, value: trace.claimedStates[next.mid] }));
    setLo(next.lo);
    setHi(next.hi);
    if (next.side === 'left') {
      pushEvent('info', tr('Challenger selects LEFT half: [{{lo}}, {{hi}}]', { lo: next.lo, hi: next.hi }));
    } else {
      pushEvent('info', tr('Challenger selects RIGHT half: [{{lo}}, {{hi}}]', { lo: next.lo, hi: next.hi }));
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

  // Auto-play: one move per tick. The timer always calls the latest render's runner, so each move
  // sees the current phase / interval (no stale closure), and the effect re-arms after every move.
  const runAutoMove = () => {
    const action = autoPlayAction(phase, lo, hi);
    if (action === 'post') postAssertion();
    else if (action === 'challenge') challenge();
    else if (action === 'bisect') commitMidpoint();
    else if (action === 'prove') resolveOneStepProof();
    else setAutoPlaying(false);
  };
  const autoMoveRef = useRef(runAutoMove);
  autoMoveRef.current = runAutoMove;

  useEffect(() => {
    if (!autoPlaying) return;
    if (autoPlayAction(phase, lo, hi) === 'done') {
      setAutoPlaying(false);
      return;
    }
    const id = window.setTimeout(() => autoMoveRef.current(), AUTO_PLAY_STEP_MS);
    return () => window.clearTimeout(id);
  }, [autoPlaying, phase, lo, hi]);

  const stopAutoPlay = () => setAutoPlaying(false);

  /** Settings changed: back to setup (and stop auto-play, the game it was playing is gone). */
  const restartGame = (nextSteps: number) => {
    setAutoPlaying(false);
    setPhase('setup');
    setLo(0);
    setHi(nextSteps);
  };

  const toggleAutoPlay = () => {
    if (autoPlaying) {
      stopAutoPlay();
      pushEvent('info', tr('Auto-play stopped.'));
      return;
    }
    if (phase === 'resolved') {
      // Replay the whole game from the start.
      setPhase('setup');
      setLo(0);
      setHi(steps);
    }
    pushEvent('info', tr('⏩ Auto-playing the dispute game step by step…'));
    setAutoPlaying(true);
  };

  const phaseLabel: Record<Phase, string> = {
    setup: tr('Setup'),
    asserted: tr('Asserted'),
    challenged: tr('Challenged'),
    bisection: tr('Bisection'),
    'one-step-proof': tr('One-step proof'),
    resolved: tr('Resolved')
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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div>{statusPill}</div>

            <button
              type="button"
              onClick={() => setIsSetupVisible((v) => !v)}
              className="ml-auto text-sm text-slate-300 hover:text-white inline-flex items-center gap-1 whitespace-nowrap"
            >
              {isSetupVisible ? (
                <>
                  <ChevronDown size={16} /> {tr('Hide setup')}
                </>
              ) : (
                <>
                  <ChevronRight size={16} /> {tr('Show setup')}
                </>
              )}
            </button>
          </div>
          <NextQuestCard q={q} className="mt-4" />
          <QuestList q={q} />
        </div>

        <div className={`grid grid-cols-1 gap-6 ${isSetupVisible ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
          {/* Controls */}
          {isSetupVisible && (
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
                    restartGame(v);
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
                    restartGame(steps);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
                />
              </label>

              <label data-hint="malicious" className={`flex items-center gap-2 ${q.pulse('malicious')}`}>
                <input
                  type="checkbox"
                  checked={malicious}
                  onChange={(e) => {
                    setMalicious(e.target.checked);
                    restartGame(steps);
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
                    disabled={phase !== 'setup' || autoPlaying}
                    data-hint="post-assertion"
                    className={`px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 flex items-center gap-2 ${q.pulse('post-assertion')}`}
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
                    disabled={phase !== 'asserted' || autoPlaying}
                    data-hint="challenge"
                    className={`px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 flex items-center gap-2 ${q.pulse('challenge')}`}
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
                    disabled={phase !== 'bisection' || autoPlaying}
                    data-hint="bisect"
                    className={`px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 flex items-center gap-2 ${q.pulse('bisect')}`}
                  >
                    <Split size={16} /> {tr('Commit midpoint + bisect')}
                  </button>
                </EduTooltip>

                <EduTooltip
                  text={tr(
                    'Automatically play the whole game, one move at a time: post the assertion, challenge it, bisect until hi = lo + 1, then execute the one-step proof on L1.'
                  )}
                >
                  <button
                    onClick={toggleAutoPlay}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-2"
                  >
                    {autoPlaying ? (
                      <>
                        <Square size={16} /> {tr('Stop auto-play')}
                      </>
                    ) : (
                      <>
                        <FastForward size={16} /> {tr('Auto-play full dispute')}
                      </>
                    )}
                  </button>
                </EduTooltip>

                <EduTooltip
                  text={tr(
                    'Execute the one-step proof on L1: verify the single disputed transition. The winner receives the loser\'s bond.'
                  )}
                >
                  <button
                    onClick={resolveOneStepProof}
                    disabled={phase !== 'one-step-proof' || autoPlaying}
                    data-hint="one-step"
                    className={`px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 inline-flex items-center gap-2 whitespace-nowrap ${q.pulse('one-step')}`}
                  >
                    <Gavel size={16} /> {tr('Execute one-step proof')}
                  </button>
                </EduTooltip>
              </div>
            </div>
          </div>
          )}

          {/* Visualization */}
          <div
            className={`${isSetupVisible ? 'lg:col-span-2' : ''} bg-slate-900/50 border border-slate-800 rounded-xl p-5`}
          >
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

                {/* Bisection Track */}
                <div className="mt-3 bg-slate-950/40 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="inline-flex items-center gap-2">
                      {tr('Bisection Track')}
                      <EduTooltip
                        text={tr(
                          'This bar visualizes the current disputed interval [lo..hi] over the execution trace. Each bisection round shrinks the highlighted segment until only one step remains for the one-step proof.'
                        )}
                      />
                    </span>
                    <span className="font-mono">0 → {steps}</span>
                  </div>

                  <div className="relative h-3 rounded-full bg-slate-800 overflow-hidden">
                    {/* disputed interval */}
                    <div
                      className="absolute top-0 h-3 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                      style={{
                        left: `${(lo / steps) * 100}%`,
                        width: `${((hi - lo) / steps) * 100}%`
                      }}
                    />

                    {/* midpoint marker */}
                    {hi - lo > 1 && (
                      <div
                        className="absolute top-[-6px] w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-yellow-300 transition-all duration-300"
                        style={{ left: `${(Math.floor((lo + hi) / 2) / steps) * 100}%` }}
                        title={tr('Midpoint')}
                      />
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-300">lo={lo}</span>
                    <span className="font-mono text-slate-300">hi={hi}</span>
                  </div>

                  {hi - lo === 1 && (
                    <div className="mt-2 text-xs text-emerald-300">
                      {tr('Ready for one-step proof (hi = lo + 1).')}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right text-sm">
                <div>
                  {tr('Phase')}: <span className="font-mono text-slate-200">{phaseLabel[phase]}</span>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4 md:col-span-2">
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

                {/* Detailed state table */}
                <div className="mt-4">
                  <div className="text-sm text-slate-400 mb-2">{tr('Claimed vs True (per state index)')}</div>

                  <div className="max-h-64 overflow-auto rounded-lg border border-slate-800">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-950 z-10">
                        <tr className="text-slate-400">
                          <th className="text-left py-2 px-3">
                            <span className="inline-flex items-center gap-2">
                              {tr('State index')}
                              <EduTooltip
                                text={tr(
                                  'State index i refers to the state *after* i steps of execution. The transition from index i to i+1 is one execution step (and uses input[i]).'
                                )}
                              />
                            </span>
                          </th>
                          <th className="text-left py-2 px-3">
                            <span className="inline-flex items-center gap-2">
                              {tr('Input')}
                              <EduTooltip
                                text={tr(
                                  'The per-step input used to compute the next state for the transition i → i+1. (The last state has no input.)'
                                )}
                              />
                            </span>
                          </th>
                          <th className="text-left py-2 px-3">
                            <span className="inline-flex items-center gap-2">
                              {tr('Claimed')}
                              <EduTooltip
                                text={tr(
                                  'The proposer\'s claimed state value at this index. This is what the assertion commits to.'
                                )}
                              />
                            </span>
                          </th>
                          <th className="text-left py-2 px-3">
                            <span className="inline-flex items-center gap-2">
                              {tr('True')}
                              <EduTooltip
                                text={tr(
                                  'The true state value produced by the honest execution trace (ground truth in this simulation).'
                                )}
                              />
                            </span>
                          </th>
                          <th className="text-left py-2 px-3">
                            <span className="inline-flex items-center gap-2">
                              {tr('Match')}
                              <EduTooltip
                                text={tr(
                                  'Whether the claimed and true states are equal at this index. A mismatch indicates fraud somewhere in the disputed interval.'
                                )}
                              />
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: steps + 1 }).map((_, idx) => {
                          const claimed = trace.claimedStates[idx];
                          const truth = trace.trueStates[idx];
                          const match = claimed === truth;
                          const inRange = idx >= lo && idx <= hi;

                          return (
                            <tr
                              key={idx}
                              className={`${
                                inRange ? 'bg-slate-900/40' : ''
                              } border-t border-slate-800`}
                            >
                              <td className="py-2 px-3 font-mono text-slate-200">{idx}</td>
                              <td
                                className={`py-2 px-3 font-mono ${
                                  inRange ? 'text-slate-200' : 'text-slate-500'
                                }`}
                              >
                                {idx < steps ? trace.inputs[idx] : '-'}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-200">{claimed}</td>
                              <td className="py-2 px-3 font-mono text-slate-200">{truth}</td>
                              <td className="py-2 px-3">
                                {match ? (
                                  <span className="text-emerald-300">{tr('✓')}</span>
                                ) : (
                                  <span className="text-rose-300">{tr('✗')}</span>
                                )}
                                {inRange && (
                                  <span className="ml-2 text-[10px] text-slate-400">
                                    {tr('in dispute')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-400">
                    {tr('Highlighted rows are inside the current disputed interval [lo..hi].')}
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="text-sm text-slate-400">{tr('Timeline')}</div>
                  <button
                    type="button"
                    onClick={() => setIsTimelineOpen((v) => !v)}
                    className="md:hidden text-sm text-slate-300 hover:text-white inline-flex items-center gap-1"
                  >
                    {isTimelineOpen ? (
                      <>
                        <ChevronDown size={16} /> {tr('Hide')}
                      </>
                    ) : (
                      <>
                        <ChevronRight size={16} /> {tr('Show')}
                      </>
                    )}
                  </button>
                </div>

                <div className={`${isTimelineOpen ? 'block' : 'hidden'} md:block`}>
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
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {tr('Green = states match, Red = mismatch. Highlighted = currently disputed interval.')}
                  </div>
                </div>
              </div>
            </div>

            {/* One-step proof details */}
            {hi - lo === 1 && (
              <div className="mt-4 bg-slate-950/40 border border-emerald-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-slate-400">{tr('One-step proof')}</div>
                    <div className="text-lg font-semibold text-emerald-200">
                      {tr('Verify transition {{i}} → {{j}} on L1', { i: lo, j: lo + 1 })}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {tr(
                        'At this point, L1 only needs to check a single transition. If claimed and true results differ, the assertion is fraudulent.'
                      )}
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-400">
                    <div>
                      {tr('Input')}: <span className="font-mono">{trace.inputs[lo] ?? '-'} </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">{tr('Prev state')}</div>
                    <div className="font-mono text-sm">{trace.trueStates[lo]}</div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">{tr('Claimed next')}</div>
                    <div className="font-mono text-sm">{trace.claimedStates[lo + 1]}</div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">{tr('True next')}</div>
                    <div className="font-mono text-sm">{trace.trueStates[lo + 1]}</div>
                  </div>
                </div>

                <div className="mt-3 text-sm">
                  {trace.trueStates[lo + 1] === trace.claimedStates[lo + 1] ? (
                    <span className="text-emerald-300">{tr('No mismatch at this step — challenger loses if executed now.')}</span>
                  ) : (
                    <span className="text-rose-300">{tr('Mismatch at this step — fraud proof will succeed.')}</span>
                  )}
                </div>
              </div>
            )}

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

            <div
              className={`mt-6 grid grid-cols-1 ${isSetupVisible ? '' : 'lg:grid-cols-2'} gap-4`}
            >
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

              <div className={`grid grid-cols-1 ${isSetupVisible ? '' : 'lg:grid-cols-2'} gap-6`}>
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
  );
}
