import { describe, expect, it } from 'vitest';
import { nextScenarioAction, type ScenarioAction } from './state_channels_demo';

type S = Parameters<typeof nextScenarioAction>[0];
type SignedState = NonNullable<S['latest']>;

/**
 * Minimal re-implementation of the demo's handlers (open / propose / sign / dispute / submit / mine),
 * driven by nextScenarioAction exactly like the auto-run effect: one move per tick on fresh state.
 */
function runScenario(depositAlice: number, depositBob: number, challengePeriod: number) {
  let s: S = { status: 'not-open', latest: null, pending: null, cheatSubmitted: false, blocksRemaining: null };
  let old: SignedState | null = null;
  let onChain: SignedState | null = null;
  let cheatResult: 'accepted' | 'rejected' | null = null;
  const actions: ScenarioAction[] = [];
  const pay = (from: 'alice' | 'bob') => {
    const l = s.latest!;
    const d = from === 'alice' ? -0.1 : 0.1;
    s = { ...s, status: 'updating', pending: { ...l, nonce: l.nonce + 1, aliceBalance: l.aliceBalance + d, bobBalance: l.bobBalance - d, signedByAlice: false, signedByBob: false } };
  };
  for (let tick = 0; tick < 500; tick++) {
    const a = nextScenarioAction(s);
    actions.push(a);
    if (a === 'done') break;
    switch (a) {
      case 'open':
        old = { nonce: 0, aliceBalance: depositAlice, bobBalance: depositBob, signedByAlice: true, signedByBob: true };
        s = { ...s, status: 'open', latest: old };
        break;
      case 'pay-alice': pay('alice'); break;
      case 'pay-bob': pay('bob'); break;
      case 'sign-alice': s = { ...s, pending: { ...s.pending!, signedByAlice: true } }; break;
      case 'sign-bob': s = { ...s, status: 'open', latest: { ...s.pending!, signedByBob: true }, pending: null }; break;
      case 'dispute':
        onChain = s.latest;
        s = { ...s, status: 'closing-disputed', blocksRemaining: challengePeriod };
        break;
      case 'cheat':
        cheatResult = old!.nonce > onChain!.nonce ? 'accepted' : 'rejected';
        s = { ...s, cheatSubmitted: true };
        break;
      case 'mine': {
        const left = s.blocksRemaining! - 1;
        s = { ...s, blocksRemaining: left, status: left <= 0 ? 'closed' : s.status };
        break;
      }
    }
  }
  return { actions, s, onChain, cheatResult };
}

describe('state channel auto-run scenario', () => {
  it('runs open → 2 signed payments → dispute → rejected cheat → mining → closed', () => {
    const r = runScenario(1, 1, 20);
    expect(r.actions.slice(0, 8)).toEqual([
      'open',
      'pay-alice', 'sign-alice', 'sign-bob',
      'pay-alice', 'sign-alice', 'sign-bob',
      'dispute'
    ]);
    expect(r.actions[8]).toBe('cheat');
    expect(r.actions.filter((a) => a === 'mine')).toHaveLength(20);
    expect(r.actions[r.actions.length - 1]).toBe('done');
    expect(r.s.status).toBe('closed');
    expect(r.cheatResult).toBe('rejected');
    expect(r.onChain?.nonce).toBe(2);
  });

  it('still terminates when Alice cannot pay (Bob pays) or nobody can', () => {
    const bobPays = runScenario(0, 1, 5);
    expect(bobPays.actions).toContain('pay-bob');
    expect(bobPays.s.status).toBe('closed');

    const nobody = runScenario(0, 0, 5);
    expect(nobody.actions.slice(0, 3)).toEqual(['open', 'dispute', 'cheat']);
    expect(nobody.cheatResult).toBe('rejected');
    expect(nobody.s.status).toBe('closed');
  });
});
