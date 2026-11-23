// Pure hashing + proof-of-work logic for the Minimal Ethereum demo.
//
// The hash is NOT cryptographic: it is 8 rounds of a seeded FNV-1a pass, each
// finished with the MurmurHash3 fmix32 avalanche step, concatenated into 64 hex
// characters. That is enough for the output to look uniformly random, so the
// share of hashes starting with d zeros is ~1/16^d and difficulty really matters.

/** Easiest / hardest difficulty the UI offers (leading hex zeros). */
export const MIN_DIFFICULTY = 1;
/** 16^5 ≈ 1M expected attempts: still well under a second with the fast path below. */
export const MAX_DIFFICULTY = 5;
/** Give up after this many attempts (≈16× the expected work at MAX_DIFFICULTY). */
export const MAX_MINING_ATTEMPTS = 16 * 16 ** MAX_DIFFICULTY;

const FNV_PRIME = 0x01000193;
const SEEDS = [
  0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35,
  0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5
];

function fnv1a(state: number, str: string): number {
  let h = state;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function finish(state: number, round: number): number {
  return fmix32(state ^ Math.imul(round + 1, 0x9e3779b9));
}

function toHex(words: number[]): string {
  return words.map((w) => w.toString(16).padStart(8, '0')).join('');
}

/** 64 hex chars (256 bits), deterministic, uniformly distributed-looking. */
export function hash256(data: string): string {
  return toHex(SEEDS.map((seed, i) => finish(fnv1a(seed, data), i)));
}

/** True when `hash` starts with `difficulty` hex zeros. */
export function meetsDifficulty(hash: string, difficulty: number): boolean {
  return hash.startsWith('0'.repeat(Math.max(0, difficulty)));
}

/** Expected number of hashes to find a valid nonce: 16^difficulty. */
export function expectedAttempts(difficulty: number): number {
  return 16 ** difficulty;
}

export type Tx = {
  from: string;
  to: string;
  value: number;
  nonce: number;
  hash: string;
};

export function createTx(from: string, to: string, value: number, nonce: number): Tx {
  return { from, to, value, nonce, hash: '0x' + hash256(`tx|${from}|${to}|${value}|${nonce}`) };
}

/** Everything the block hash commits to, except the PoW nonce. */
export type BlockHeader = {
  number: number;
  timestamp: number;
  previousHash: string;
  transactions: Tx[];
};

export function headerPrefix(header: BlockHeader): string {
  const txData = header.transactions.map((tx) => tx.hash).join(',');
  return `block|${header.number}|${header.timestamp}|${header.previousHash}|${txData}|`;
}

export function hashBlock(header: BlockHeader, nonce: number): string {
  return hash256(headerPrefix(header) + nonce);
}

export type MineResult = {
  found: boolean;
  /** Winning nonce when found, otherwise the next nonce to try. */
  nonce: number;
  hash: string;
  attempts: number;
};

/**
 * Try nonces startNonce, startNonce+1, … until the block hash starts with
 * `difficulty` zeros or `maxAttempts` hashes were computed.
 *
 * Fast path: FNV-1a is streaming, so the header prefix is absorbed once; and for
 * difficulty ≤ 8 only the first 32-bit word decides the leading zeros, so the
 * other 7 rounds are only computed for the winning nonce. Results are identical
 * to calling hashBlock() for every nonce.
 */
export function mine(
  header: BlockHeader,
  difficulty: number,
  { startNonce = 0, maxAttempts = MAX_MINING_ATTEMPTS }: { startNonce?: number; maxAttempts?: number } = {}
): MineResult {
  const prefix = headerPrefix(header);
  const firstState = fnv1a(SEEDS[0], prefix);
  const fast = difficulty >= 0 && difficulty <= 8;
  const limit = fast ? 2 ** (32 - 4 * difficulty) : 0;

  let nonce = startNonce;
  for (let attempts = 1; attempts <= maxAttempts; attempts++, nonce++) {
    if (fast) {
      const word0 = finish(fnv1a(firstState, String(nonce)), 0);
      if (word0 >= limit) continue;
    }
    const hash = hash256(prefix + nonce);
    if (meetsDifficulty(hash, difficulty)) return { found: true, nonce, hash, attempts };
  }
  return { found: false, nonce, hash: '', attempts: maxAttempts };
}

/** Recompute a stored block's hash and check it against its own difficulty. */
export function isBlockValid(block: BlockHeader & { nonce: number; hash: string; difficulty: number }): boolean {
  const hash = hashBlock(block, block.nonce);
  return hash === block.hash && meetsDifficulty(hash, block.difficulty);
}
