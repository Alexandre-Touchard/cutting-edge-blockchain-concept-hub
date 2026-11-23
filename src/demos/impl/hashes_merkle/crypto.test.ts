import { describe, expect, it } from 'vitest';
import { bitDiff, bytesToHex, countBits, findNonce, leadingZeros, sha256, sha256Hex, utf8 } from './sha256';
import {
  buildTree,
  buildTreeFromLeaves,
  changedIds,
  getProof,
  hashLeaf,
  hashPair,
  layoutX,
  pathIds,
  proofLength,
  serializeTx,
  verifyProof,
  type MerkleMode,
  type Tx
} from './merkle';
import { flipHexChar, generateKeyPair, signMessage, verifyMessage } from './signatures';

const txs = (n: number): Tx[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, from: ['Alice', 'Bob', 'Carol'][i % 3], to: ['Bob', 'Carol', 'Dave'][i % 3], amount: String(i + 1) }));

describe('SHA-256', () => {
  it('matches the known test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    // two-block message (FIPS 180-2 example)
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
  });

  it('agrees with Web Crypto on many lengths (padding boundaries) and on UTF-8', async () => {
    const inputs = [...Array.from({ length: 130 }, (_, n) => 'x'.repeat(n)), 'Crédit Mutuel Arkéa ✓', '日本語'];
    for (const s of inputs) {
      const ref = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(s))));
      expect(bytesToHex(sha256(utf8(s))), JSON.stringify(s)).toBe(ref);
    }
  });

  it('hello vs Hello changes roughly half of the 256 bits', () => {
    const n = countBits(bitDiff(sha256Hex('hello'), sha256Hex('Hello')));
    expect(n).toBeGreaterThan(90);
    expect(n).toBeLessThan(166);
    expect(countBits(bitDiff(sha256Hex('a'), sha256Hex('a')))).toBe(0);
  });

  it('finds a proof-of-work nonce', () => {
    const r = findNonce('block', 3)!;
    expect(leadingZeros(r.hash)).toBeGreaterThanOrEqual(3);
    expect(sha256Hex(`block${r.nonce}`)).toBe(r.hash);
  });
});

describe('Merkle tree', () => {
  it('builds the textbook structure', () => {
    const t = buildTreeFromLeaves(['aa', 'bb', 'cc', 'dd'].map((s) => sha256Hex(s)), 'simple');
    expect(t.levels.map((l) => l.length)).toEqual([4, 2, 1]);
    const ab = hashPair(sha256Hex('aa'), sha256Hex('bb'), 'simple');
    const cd = hashPair(sha256Hex('cc'), sha256Hex('dd'), 'simple');
    expect(t.root).toBe(hashPair(ab, cd, 'simple'));
    expect(serializeTx({ from: 'Alice', to: 'Bob', amount: '5' })).toBe('Alice|Bob|5');
    expect(buildTree(txs(1), 'simple').root).toBe(sha256Hex('Alice|Bob|1'));
  });

  it('simple mode duplicates the odd node, so [a,b,c] and [a,b,c,c] share a root; safe mode tells them apart', () => {
    const abc = txs(3);
    const abcc = [...abc, { ...abc[2], id: 'copy' }];
    expect(buildTree(abc, 'simple').root).toBe(buildTree(abcc, 'simple').root);
    expect(buildTree(abc, 'safe').root).not.toBe(buildTree(abcc, 'safe').root);
    expect(buildTree(abc, 'simple').root).not.toBe(buildTree(abc, 'safe').root);
    // safe mode promotes the odd node unchanged
    const safe = buildTree(abc, 'safe');
    expect(safe.levels[1][1].promoted).toBe(true);
    expect(safe.levels[1][1].hash).toBe(hashLeaf('Carol|Dave|3', 'safe'));
  });

  it('changing any single transaction changes exactly that leaf and its ancestors', () => {
    for (const mode of ['simple', 'safe'] as MerkleMode[])
      for (let n = 1; n <= 16; n++) {
        const base = buildTree(txs(n), mode);
        for (let i = 0; i < n; i++) {
          const edited = txs(n).map((t, j) => (j === i ? { ...t, amount: t.amount + '0' } : t));
          const changed = changedIds(base, buildTree(edited, mode));
          expect([...changed].sort(), `${mode} n=${n} i=${i}`).toEqual(pathIds(base, i).sort());
        }
      }
  });

  it('proofs verify for every leaf of trees of 1–16, and fail if any sibling is altered', () => {
    for (const mode of ['simple', 'safe'] as MerkleMode[])
      for (let n = 1; n <= 16; n++) {
        const tree = buildTree(txs(n), mode);
        for (let i = 0; i < n; i++) {
          const proof = getProof(tree, i);
          expect(proof.steps.length).toBeLessThanOrEqual(proofLength(n));
          if (mode === 'simple') expect(proof.steps.length).toBe(proofLength(n));
          expect(verifyProof(proof.leafHash, proof.steps, tree.root, mode).ok, `${mode} n=${n} i=${i}`).toBe(true);
          proof.steps.forEach((_, k) => {
            const bad = proof.steps.map((s, j) => (j === k ? { ...s, siblingHash: flipHexChar(s.siblingHash) } : s));
            expect(verifyProof(proof.leafHash, bad, tree.root, mode).ok).toBe(false);
          });
          // a different leaf with the same proof fails too
          expect(verifyProof(sha256Hex('forged'), proof.steps, tree.root, mode).ok).toBe(false);
        }
      }
  });

  it('proof size grows with log2(n)', () => {
    expect(proofLength(1)).toBe(0);
    expect(proofLength(8)).toBe(3);
    expect(proofLength(1000)).toBe(10);
    expect(proofLength(1_000_000)).toBe(20);
  });

  it('centres parents over their children', () => {
    const x = layoutX(buildTree(txs(5), 'simple'));
    expect(x.get('L0-4')).toBe(4);
    expect(x.get('L1-0')).toBe(0.5);
    expect(x.get('L1-2')).toBe(4); // duplicated odd node sits above its only child
  });
});

describe('signatures (ECDSA P-256, Web Crypto)', () => {
  it('round-trips, and fails if the message, signature or key changes', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    expect(alice.publicHex).toMatch(/^04[0-9a-f]{128}$/);
    expect(alice.privateHex).toMatch(/^[0-9a-f]{64}$/);
    const sig = await signMessage(alice.privateKey, 'Alice|Bob|5');
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
    expect(await verifyMessage(alice.publicHex, 'Alice|Bob|5', sig)).toBe(true);
    expect(await verifyMessage(alice.publicHex, 'Alice|Bob|6', sig)).toBe(false);
    expect(await verifyMessage(bob.publicHex, 'Alice|Bob|5', sig)).toBe(false);
    expect(await verifyMessage(alice.publicHex, 'Alice|Bob|5', flipHexChar(sig))).toBe(false);
    expect(await verifyMessage(alice.publicHex, 'Alice|Bob|5', 'not hex')).toBe(false);
    expect(await verifyMessage('04zz', 'Alice|Bob|5', sig)).toBe(false);
  });

  it('flipHexChar changes exactly one character', () => {
    expect(flipHexChar('00ff', 1)).toBe('01ff');
    expect(flipHexChar('00ff', 3)).toBe('00f0');
    expect(flipHexChar('zz', 0)).toBe('0z');
  });
});
