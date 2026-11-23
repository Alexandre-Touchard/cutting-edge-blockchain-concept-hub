// Merkle trees, proofs and the transaction format used by the demo. Pure functions, no React.
//
// Simple mode (Bitcoin-style): leaf = SHA-256(data), parent = SHA-256(left ‖ right), and the
// last node of an odd level is paired with itself (duplicated).
// Safe mode (RFC 6962 / Certificate Transparency): leaf = SHA-256(0x00 ‖ data),
// parent = SHA-256(0x01 ‖ left ‖ right), and an odd last node is promoted unchanged.
import { bytesToHex, concatBytes, hexToBytes, sha256, utf8 } from './sha256';

export type MerkleMode = 'simple' | 'safe';

export type Tx = { id: string; from: string; to: string; amount: string; sig?: string };

/** The one serialisation used everywhere (shown in the UI). */
export function serializeTx(tx: Pick<Tx, 'from' | 'to' | 'amount'>): string {
  return `${tx.from}|${tx.to}|${tx.amount}`;
}

/** Data hashed into a leaf: the transaction, plus its signature when it has one. */
export function leafData(tx: Tx): string {
  return tx.sig !== undefined ? `${serializeTx(tx)}|${tx.sig}` : serializeTx(tx);
}

export function hashLeaf(data: string, mode: MerkleMode): string {
  const bytes = utf8(data);
  return bytesToHex(sha256(mode === 'safe' ? concatBytes(new Uint8Array([0]), bytes) : bytes));
}

/** Parent hash of two child hashes (hex). Invalid hex (a tampered proof) hashes its text instead. */
export function hashPair(leftHex: string, rightHex: string, mode: MerkleMode): string {
  const b = (h: string) => {
    try {
      return hexToBytes(h);
    } catch {
      return utf8(h);
    }
  };
  const parts = mode === 'safe' ? [new Uint8Array([1]), b(leftHex), b(rightHex)] : [b(leftHex), b(rightHex)];
  return bytesToHex(sha256(concatBytes(...parts)));
}

export type TreeNode = {
  id: string; // "L<level>-<index>"
  level: number; // 0 = leaves
  index: number;
  hash: string;
  /** Child indices on level - 1 (empty for leaves). */
  children: number[];
  /** Simple mode: odd last node paired with a copy of itself. */
  duplicated?: boolean;
  /** Safe mode: odd last node moved up unchanged. */
  promoted?: boolean;
};

export type MerkleTree = { mode: MerkleMode; levels: TreeNode[][]; root: string };

export const nodeId = (level: number, index: number) => `L${level}-${index}`;

export function buildTreeFromLeaves(leafHashes: string[], mode: MerkleMode): MerkleTree {
  if (leafHashes.length === 0) return { mode, levels: [], root: '' };
  const levels: TreeNode[][] = [leafHashes.map((hash, index) => ({ id: nodeId(0, index), level: 0, index, hash, children: [] }))];
  while (levels[levels.length - 1].length > 1) {
    const below = levels[levels.length - 1];
    const level = levels.length;
    const row: TreeNode[] = [];
    for (let i = 0; i < below.length; i += 2) {
      const index = i / 2;
      const left = below[i];
      const right = below[i + 1];
      if (right) row.push({ id: nodeId(level, index), level, index, hash: hashPair(left.hash, right.hash, mode), children: [i, i + 1] });
      else if (mode === 'simple')
        row.push({ id: nodeId(level, index), level, index, hash: hashPair(left.hash, left.hash, mode), children: [i], duplicated: true });
      else row.push({ id: nodeId(level, index), level, index, hash: left.hash, children: [i], promoted: true });
    }
    levels.push(row);
  }
  return { mode, levels, root: levels[levels.length - 1][0].hash };
}

export function buildTree(txs: Tx[], mode: MerkleMode): MerkleTree {
  return buildTreeFromLeaves(
    txs.map((tx) => hashLeaf(leafData(tx), mode)),
    mode
  );
}

/** Ids of the leaf and every node above it, leaf first. */
export function pathIds(tree: MerkleTree, leafIndex: number): string[] {
  const ids: string[] = [];
  let idx = leafIndex;
  for (let level = 0; level < tree.levels.length; level++) {
    ids.push(nodeId(level, idx));
    idx = idx >> 1;
  }
  return ids;
}

/** Nodes whose hash differs from the baseline (or that the baseline doesn't have). */
export function changedIds(baseline: MerkleTree, current: MerkleTree): Set<string> {
  const before = new Map(baseline.levels.flat().map((n) => [n.id, n.hash]));
  return new Set(
    current.levels
      .flat()
      .filter((n) => before.get(n.id) !== n.hash)
      .map((n) => n.id)
  );
}

export type ProofStep = {
  level: number;
  siblingHash: string;
  /** Where the sibling goes when hashing: hash(sibling ‖ current) for 'left'. */
  side: 'left' | 'right';
  /** Id of the sibling node in the tree (the node itself when it was duplicated). */
  siblingId: string;
  duplicated?: boolean;
};

export type Proof = { leafIndex: number; leafHash: string; steps: ProofStep[] };

export function getProof(tree: MerkleTree, leafIndex: number): Proof {
  const steps: ProofStep[] = [];
  let idx = leafIndex;
  for (let level = 0; level < tree.levels.length - 1; level++) {
    const row = tree.levels[level];
    const sib = idx ^ 1;
    if (sib < row.length) {
      steps.push({ level, siblingHash: row[sib].hash, side: idx % 2 === 1 ? 'left' : 'right', siblingId: row[sib].id });
    } else if (tree.mode === 'simple') {
      steps.push({ level, siblingHash: row[idx].hash, side: 'right', siblingId: row[idx].id, duplicated: true });
    } // safe mode: promoted unchanged, nothing to combine at this level
    idx = idx >> 1;
  }
  return { leafIndex, leafHash: tree.levels[0][leafIndex].hash, steps };
}

export type VerifyTrace = { steps: { left: string; right: string; result: string }[]; computedRoot: string; ok: boolean };

/** Recompute the root from a leaf hash and its proof, step by step. */
export function verifyProof(leafHash: string, steps: ProofStep[], root: string, mode: MerkleMode): VerifyTrace {
  let current = leafHash;
  const trace: VerifyTrace['steps'] = [];
  for (const s of steps) {
    const [left, right] = s.side === 'left' ? [s.siblingHash, current] : [current, s.siblingHash];
    current = hashPair(left, right, mode);
    trace.push({ left, right, result: current });
  }
  return { steps: trace, computedRoot: current, ok: current === root };
}

/** Hashes in a proof for n leaves (a full binary tree): ⌈log₂ n⌉. */
export function proofLength(n: number): number {
  return n <= 1 ? 0 : Math.ceil(Math.log2(n));
}

/** Horizontal position (in leaf slots) of every node: leaves 0…n-1, parents centred over children. */
export function layoutX(tree: MerkleTree): Map<string, number> {
  const x = new Map<string, number>();
  tree.levels.forEach((row, level) =>
    row.forEach((n) => {
      if (level === 0) x.set(n.id, n.index);
      else {
        const xs = n.children.map((c) => x.get(nodeId(level - 1, c))!);
        x.set(n.id, xs.reduce((a, b) => a + b, 0) / xs.length);
      }
    })
  );
  return x;
}
