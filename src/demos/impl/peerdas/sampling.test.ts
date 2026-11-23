import { describe, expect, it } from 'vitest';
import {
  assignCustody,
  columnCustodians,
  coverageStats,
  detectionProbability,
  pickWithheldColumns,
  runSampling,
  sampleNode,
  seededRng
} from './sampling';

// The demo's default network: 20 nodes, 64 columns, 16 columns per node, 16 samples per node.
const NODES = 20;
const COLUMNS = 64;
const custody = assignCustody(NODES, COLUMNS, 16);

describe('custody', () => {
  it('stores every column on at least one node', () => {
    const holders = columnCustodians(custody, COLUMNS);
    expect(holders.every((h) => h.length > 0)).toBe(true);
    expect(coverageStats(holders)).toEqual({ min: 5, max: 5, avg: 5 });
  });

  it('gives withheld columns no custodian at all', () => {
    const holders = columnCustodians(custody, COLUMNS, [3, 40]);
    expect(holders[3]).toEqual([]);
    expect(holders[40]).toEqual([]);
    expect(coverageStats(holders).min).toBe(0);
  });

  it('picks distinct withheld columns within range', () => {
    const w = pickWithheldColumns(COLUMNS, 10, seededRng(1));
    expect(new Set(w).size).toBe(10);
    expect(w.every((c) => c >= 0 && c < COLUMNS)).toBe(true);
    expect(pickWithheldColumns(COLUMNS, 999, seededRng(1))).toHaveLength(COLUMNS);
  });
});

describe('sampling', () => {
  it('confirms availability when every column is served', () => {
    const holders = columnCustodians(custody, COLUMNS);
    for (let seed = 1; seed <= 20; seed++) {
      const round = runSampling(holders, NODES, 16, seededRng(seed));
      expect(round.available).toBe(true);
      expect(round.failedNodes).toBe(0);
      expect(round.results.every((r) => r.sampledColumns.length === 16 && r.successRate === 1)).toBe(true);
    }
  });

  it('does not confirm availability when enough columns are withheld', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seededRng(seed);
      const holders = columnCustodians(custody, COLUMNS, pickWithheldColumns(COLUMNS, 33, rng));
      const round = runSampling(holders, NODES, 16, rng);
      expect(round.available).toBe(false);
      expect(round.failedNodes).toBeGreaterThan(0);
    }
  });

  it('fails every node when everything is withheld', () => {
    const holders = columnCustodians(custody, COLUMNS, Array.from({ length: COLUMNS }, (_, i) => i));
    const round = runSampling(holders, NODES, 8, seededRng(7));
    expect(round.failedNodes).toBe(NODES);
    expect(round.results.every((r) => r.successRate === 0)).toBe(true);
  });

  it('never samples the same column twice and reports who served each sample', () => {
    const holders = columnCustodians(custody, COLUMNS);
    const r = sampleNode(0, holders, 32, seededRng(3));
    expect(new Set(r.sampledColumns.map((s) => s.columnIndex)).size).toBe(32);
    for (const s of r.sampledColumns) expect(holders[s.columnIndex]).toContain(s.provider);
  });
});

describe('more samples per node catch withholding more often', () => {
  it('raises the exact per-node detection probability', () => {
    const p8 = detectionProbability(COLUMNS, 4, 8);
    const p16 = detectionProbability(COLUMNS, 4, 16);
    const p24 = detectionProbability(COLUMNS, 4, 24);
    expect(p8).toBeGreaterThan(0);
    expect(p16).toBeGreaterThan(p8);
    expect(p24).toBeGreaterThan(p16);
    expect(detectionProbability(COLUMNS, 0, 16)).toBe(0);
    expect(detectionProbability(COLUMNS, 1, 1)).toBeCloseTo(1 / 64, 10);
    expect(detectionProbability(COLUMNS, 60, 8)).toBe(1); // only 4 columns left to sample from
  });

  it('matches in simulation: nodes sampling 24 columns detect more often than nodes sampling 8', () => {
    const rng = seededRng(42);
    const holders = columnCustodians(custody, COLUMNS, pickWithheldColumns(COLUMNS, 4, rng));
    const detectRate = (samples: number) => {
      let detected = 0;
      const trials = 2000;
      for (let i = 0; i < trials; i++) if (!sampleNode(0, holders, samples, rng).allSuccess) detected++;
      return detected / trials;
    };
    const low = detectRate(8);
    const high = detectRate(24);
    expect(high).toBeGreaterThan(low);
    expect(low).toBeCloseTo(detectionProbability(COLUMNS, 4, 8), 1);
    expect(high).toBeCloseTo(detectionProbability(COLUMNS, 4, 24), 1);
  });
});
