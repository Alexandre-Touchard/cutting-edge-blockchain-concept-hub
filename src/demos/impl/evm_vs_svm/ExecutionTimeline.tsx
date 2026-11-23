// Gantt-style picture of the same transactions run sequentially (EVM) and in waves (Solana-style).
// Bars fill in as you step; the two lengths make the speedup visible.
import React from 'react';
import type { Tx, Wave } from './scheduler';
import { evmTimeline, svmTimeline, type GanttBar } from './visuals';

type Status = 'ok' | 'failed' | 'pending';
type Tr = (s: string, o?: Record<string, unknown>) => string;

const IDLE_BG = 'repeating-linear-gradient(135deg, rgba(148,163,184,0.18) 0 4px, transparent 4px 8px)';

export default function ExecutionTimeline({
  txs,
  waves,
  threads,
  evmDone,
  svmDoneWaves,
  svmStatus,
  tr
}: {
  txs: Tx[];
  waves: Wave[];
  threads: number;
  /** Number of EVM transactions already executed. */
  evmDone: number;
  /** Number of Solana-style waves already executed. */
  svmDoneWaves: number;
  /** Outcome per tx id on the Solana side (failed txs are shown in red). */
  svmStatus: Record<number, Status>;
  tr: Tr;
}) {
  const evm = evmTimeline(txs);
  const svm = svmTimeline(waves, threads);
  const scale = Math.max(evm.total, svm.total, 1);
  const pct = (x: number) => `${(x / scale) * 100}%`;
  const speedup = svm.total > 0 ? evm.total / svm.total : 1;

  const bar = (b: GanttBar, status: Status, side: 'evm' | 'svm') => {
    const color =
      status === 'failed'
        ? 'bg-red-600/80 border-red-400 text-white'
        : status === 'ok'
          ? side === 'evm'
            ? 'bg-purple-600 border-purple-300 text-white'
            : 'bg-emerald-600 border-emerald-300 text-white'
          : side === 'evm'
            ? 'bg-purple-950/40 border-purple-700 text-purple-200'
            : 'bg-emerald-950/40 border-emerald-700 text-emerald-200';
    const tx = txs.find((t) => t.id === b.txId);
    return (
      <div
        key={`${side}-${b.txId}`}
        className={`absolute top-0.5 bottom-0.5 rounded border text-[10px] font-semibold flex items-center justify-center overflow-hidden transition-colors duration-300 ${color}`}
        style={{ left: pct(b.start), width: pct(b.width) }}
        title={`#${b.txId}${tx ? ` · ${tr(tx.label)}` : ''} · ${b.width} CU`}
      >
        #{b.txId}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* EVM: one lane */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-semibold text-purple-200">{tr('EVM: one transaction at a time')}</span>
          <span className="font-mono text-slate-400">{evm.total} CU</span>
        </div>
        <div className="relative h-8 rounded bg-slate-900/60 border border-slate-800">
          {evm.bars.map((b, i) => bar(b, i < evmDone ? 'ok' : 'pending', 'evm'))}
        </div>
      </div>

      {/* Solana-style: one lane per thread */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-semibold text-emerald-200">
            {tr('Solana-style: {{n}} threads, transactions grouped in waves', { n: threads })}
          </span>
          <span className="font-mono text-slate-400">{svm.total} CU</span>
        </div>
        <div className="relative">
          {/* wave labels */}
          <div className="relative h-4">
            {svm.waveStarts.map((s, i) => (
              <span key={i} className="absolute text-[10px] text-slate-400" style={{ left: pct(s) }}>
                {tr('Wave')} {i + 1}
              </span>
            ))}
          </div>
          <div className="space-y-1">
            {Array.from({ length: threads }, (_, lane) => (
              <div key={lane} className="relative h-7 rounded bg-slate-900/60 border border-slate-800">
                {svm.idle
                  .filter((s) => s.lane === lane)
                  .map((s) => (
                    <div
                      key={`idle-${s.wave}`}
                      className="absolute top-0.5 bottom-0.5 rounded"
                      style={{ left: pct(s.start), width: pct(s.width), background: IDLE_BG }}
                      title={tr('Idle: waiting for the slowest transaction of the wave')}
                    />
                  ))}
                {svm.bars
                  .filter((b) => b.lane === lane)
                  .map((b) => bar(b, b.wave < svmDoneWaves ? svmStatus[b.txId] ?? 'ok' : 'pending', 'svm'))}
                <span className="absolute -left-0.5 top-1/2 -translate-x-full -translate-y-1/2 pr-1 text-[10px] text-slate-500 hidden sm:block">
                  T{lane + 1}
                </span>
              </div>
            ))}
          </div>
          {/* wave boundaries */}
          {svm.waveStarts.slice(1).map((s, i) => (
            <div key={i} className="pointer-events-none absolute top-4 bottom-0 border-l border-dashed border-slate-500/70" style={{ left: pct(s) }} />
          ))}
        </div>
      </div>

      {/* Comparison */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 text-slate-300">
          <span className="inline-block h-3 w-5 rounded" style={{ background: IDLE_BG }} />
          {tr('idle (waiting for the slowest transaction of the wave)')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-300">
          <span className="inline-block h-3 w-5 rounded bg-red-600/80" />
          {tr('failed (missing declaration)')}
        </span>
        <span className="ml-auto font-semibold text-emerald-300">
          {speedup > 1.001
            ? tr('Same work, {{x}}× less time', { x: speedup.toFixed(2) })
            : tr('No speedup: every transaction has to wait for the previous one')}
        </span>
      </div>
    </div>
  );
}
