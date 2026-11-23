// Pure PeerDAS model: column custody, data withholding and random sampling.
// No React here, so it can be unit-tested (see sampling.test.ts).

export type Rng = () => number;

/** Small seeded PRNG (mulberry32) so tests are deterministic. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Columns each node is responsible for storing: node i takes `columnsPerNode` consecutive columns (wrapping). */
export function assignCustody(numNodes: number, numColumns: number, columnsPerNode: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < numNodes; i++) {
    const cols: number[] = [];
    for (let j = 0; j < columnsPerNode; j++) cols.push((i * columnsPerNode + j) % numColumns);
    out.push(cols);
  }
  return out;
}

/** `count` distinct random columns the block producer never sends out (sorted). */
export function pickWithheldColumns(numColumns: number, count: number, rng: Rng = Math.random): number[] {
  const all = Array.from({ length: numColumns }, (_, i) => i);
  const n = Math.max(0, Math.min(numColumns, Math.floor(count)));
  // Partial Fisher-Yates shuffle.
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (numColumns - i));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, n).sort((a, b) => a - b);
}

/**
 * For each column, the nodes that actually hold it after publication.
 * A withheld column reaches nobody, so it has no custodian at all.
 */
export function columnCustodians(custody: number[][], numColumns: number, withheld: Iterable<number> = []): number[][] {
  const hidden = new Set(withheld);
  const out: number[][] = Array.from({ length: numColumns }, () => []);
  custody.forEach((cols, nodeId) => {
    for (const c of cols) if (!hidden.has(c)) out[c].push(nodeId);
  });
  return out;
}

/** Min / max / average number of custodians per column (the "Coverage" figure). */
export function coverageStats(custodians: number[][]): { min: number; max: number; avg: number } {
  if (custodians.length === 0) return { min: 0, max: 0, avg: 0 };
  const counts = custodians.map((c) => c.length);
  return {
    min: Math.min(...counts),
    max: Math.max(...counts),
    avg: counts.reduce((a, b) => a + b, 0) / counts.length
  };
}

export type ColumnSample = { columnIndex: number; success: boolean; provider: number | null };
export type NodeSampling = { nodeId: number; sampledColumns: ColumnSample[]; successRate: number; allSuccess: boolean };

/** One node asks peers for `samples` distinct random columns; a sample fails when no peer holds that column. */
export function sampleNode(nodeId: number, custodians: number[][], samples: number, rng: Rng = Math.random): NodeSampling {
  const numColumns = custodians.length;
  const target = Math.max(0, Math.min(samples, numColumns));
  const seen = new Set<number>();
  const sampledColumns: ColumnSample[] = [];
  while (sampledColumns.length < target) {
    const col = Math.floor(rng() * numColumns);
    if (seen.has(col)) continue;
    seen.add(col);
    const holders = custodians[col];
    const success = holders.length > 0;
    sampledColumns.push({
      columnIndex: col,
      success,
      provider: success ? holders[Math.floor(rng() * holders.length)] : null
    });
  }
  const ok = sampledColumns.filter((s) => s.success).length;
  const successRate = target === 0 ? 1 : ok / target;
  return { nodeId, sampledColumns, successRate, allSuccess: ok === target };
}

export type SamplingRound = { results: NodeSampling[]; available: boolean; failedNodes: number };

/** Every node samples; availability is confirmed only if every node got every sample it asked for. */
export function runSampling(custodians: number[][], numNodes: number, samplesPerNode: number, rng: Rng = Math.random): SamplingRound {
  const results: NodeSampling[] = [];
  for (let id = 0; id < numNodes; id++) results.push(sampleNode(id, custodians, samplesPerNode, rng));
  const failedNodes = results.filter((r) => !r.allSuccess).length;
  return { results, available: failedNodes === 0, failedNodes };
}

/**
 * Chance that ONE node, sampling `samples` distinct columns out of `numColumns`,
 * hits at least one of `withheld` missing columns: 1 − C(n−m, s) / C(n, s).
 */
export function detectionProbability(numColumns: number, withheld: number, samples: number): number {
  const n = numColumns;
  const m = Math.max(0, Math.min(withheld, n));
  const s = Math.max(0, Math.min(samples, n));
  if (m === 0 || s === 0) return 0;
  if (s > n - m) return 1;
  let missAll = 1;
  for (let i = 0; i < s; i++) missAll *= (n - m - i) / (n - i);
  return 1 - missAll;
}
