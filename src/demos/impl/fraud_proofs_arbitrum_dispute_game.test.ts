import { describe, expect, it } from 'vitest';
import { autoPlayAction, bisectStep, buildTrace, firstMismatchIndex } from './fraud_proofs_arbitrum_dispute_game';

type Phase = Parameters<typeof autoPlayAction>[0];

/** Plays the game the way auto-play does (one action per tick, each tick seeing the fresh state). */
function autoPlay(opts: { steps: number; seed: number; malicious: boolean }) {
  const trace = buildTrace(opts);
  let phase: Phase = 'setup';
  let lo = 0;
  let hi = opts.steps;
  const actions: string[] = [];
  let fraudProven: boolean | null = null;
  for (let tick = 0; tick < 100; tick++) {
    const action = autoPlayAction(phase, lo, hi);
    actions.push(action);
    if (action === 'done') break;
    if (action === 'post') {
      phase = 'asserted';
      lo = 0;
      hi = opts.steps;
    } else if (action === 'challenge') {
      phase = 'bisection';
    } else if (action === 'bisect') {
      // commitMidpoint(): one round, or move to the one-step phase once hi = lo + 1.
      if (hi - lo <= 1) phase = 'one-step-proof';
      else ({ lo, hi } = bisectStep(trace, lo, hi));
    } else if (action === 'prove') {
      fraudProven = trace.trueStates[lo + 1] !== trace.claimedStates[lo + 1];
      phase = 'resolved';
    }
  }
  return { trace, phase, lo, hi, actions, fraudProven };
}

describe('fraud proof auto-play', () => {
  for (const steps of [8, 16, 64]) {
    for (const seed of [1, 42, 7]) {
      it(`goes through every phase and proves the fraud (steps=${steps}, seed=${seed})`, () => {
        const r = autoPlay({ steps, seed, malicious: true });
        expect(r.actions.slice(0, 2)).toEqual(['post', 'challenge']);
        expect(r.actions.filter((a) => a === 'bisect').length).toBe(Math.ceil(Math.log2(steps)) + 1);
        expect(r.actions.slice(-2)).toEqual(['prove', 'done']);
        expect(r.phase).toBe('resolved');
        expect(r.hi - r.lo).toBe(1);
        expect(r.lo + 1).toBe(firstMismatchIndex(r.trace));
        expect(r.fraudProven).toBe(true);
      });
    }
  }

  it('lets the honest proposer win', () => {
    const r = autoPlay({ steps: 16, seed: 42, malicious: false });
    expect(r.phase).toBe('resolved');
    expect(r.fraudProven).toBe(false);
  });

  it('stops on inconsistent states instead of looping', () => {
    expect(autoPlayAction('one-step-proof', 3, 5)).toBe('done');
    expect(autoPlayAction('bisection', 4, 4)).toBe('done');
    expect(autoPlayAction('resolved', 3, 4)).toBe('done');
  });
});
