import { describe, expect, it } from 'vitest';
import {
  createTx,
  hash256,
  hashBlock,
  isBlockValid,
  meetsDifficulty,
  mine,
  type BlockHeader
} from './chain';

const header = (overrides: Partial<BlockHeader> = {}): BlockHeader => ({
  number: 1,
  timestamp: 1_700_000_000_000,
  previousHash: '0'.repeat(64),
  transactions: [createTx('Alice', 'Bob', 100, 0)],
  ...overrides
});

describe('hash256', () => {
  it('is deterministic and 64 lowercase hex chars', () => {
    const h = hash256('hello');
    expect(h).toBe(hash256('hello'));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hash256('hello!')).not.toBe(h);
  });

  it('has no leading-zero bias (first hex digit is ~uniform)', () => {
    const zeros = Array.from({ length: 4000 }, (_, i) => hash256(`sample-${i}`)).filter((h) => h[0] === '0').length;
    // Expected 4000 / 16 = 250.
    expect(zeros).toBeGreaterThan(170);
    expect(zeros).toBeLessThan(330);
  });
});

describe('mine', () => {
  it('finds a hash that meets the target and matches hashBlock', () => {
    for (const difficulty of [1, 2, 3, 4]) {
      const h = header({ number: difficulty });
      const r = mine(h, difficulty);
      expect(r.found).toBe(true);
      expect(meetsDifficulty(r.hash, difficulty)).toBe(true);
      expect(r.hash).toBe(hashBlock(h, r.nonce));
      expect(r.attempts).toBe(r.nonce + 1);
      expect(isBlockValid({ ...h, nonce: r.nonce, hash: r.hash, difficulty })).toBe(true);
    }
  });

  it('needs more attempts on average at higher difficulty', () => {
    const avg = (difficulty: number) => {
      let total = 0;
      for (let i = 0; i < 30; i++) total += mine(header({ number: i }), difficulty).attempts;
      return total / 30;
    };
    const easy = avg(1);
    const hard = avg(3);
    expect(hard).toBeGreaterThan(easy * 20);
    // Expected 16 and 4096 attempts respectively.
    expect(easy).toBeLessThan(64);
    expect(hard).toBeGreaterThan(1000);
  });

  it('stops after maxAttempts when nothing is found', () => {
    const r = mine(header(), 8, { maxAttempts: 50 });
    expect(r.found).toBe(false);
    expect(r.attempts).toBe(50);
    expect(r.nonce).toBe(50);
  });

  it('changing a transaction changes the hash and invalidates the block', () => {
    const h = header();
    const r = mine(h, 3);
    const tampered = { ...h, transactions: [createTx('Alice', 'Bob', 101, 0)] };
    expect(hashBlock(tampered, r.nonce)).not.toBe(r.hash);
    expect(isBlockValid({ ...tampered, nonce: r.nonce, hash: r.hash, difficulty: 3 })).toBe(false);
  });
});
