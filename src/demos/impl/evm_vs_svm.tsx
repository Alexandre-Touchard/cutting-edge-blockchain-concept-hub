import React, { useMemo, useState } from 'react';
import EduTooltip from '../../ui/EduTooltip';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
import {
  ArrowDown,
  ArrowUp,
  Bug,
  Cpu,
  Layers,
  Plus,
  RefreshCw,
  ScrollText,
  Shield,
  Trash2
} from 'lucide-react';

type AccountId = 'Alice' | 'Bob' | 'DexPool' | 'FeeVault' | 'Oracle';
type AccessMode = 'r' | 'w';

type Tx = {
  id: number;
  label: string;
  computeUnits: number;
  // What the tx really touches at runtime (EVM: implicit)
  actual: Record<AccountId, AccessMode>;
  // What the tx *declares* ahead of time (SVM-style)
  declared: Partial<Record<AccountId, AccessMode>>;
};

type Outcome =
  | { status: 'pending' }
  | { status: 'ok'; summary: string }
  | { status: 'failed'; reason: 'MissingAccountDeclaration'; summary: string };

type Wave = {
  txs: Tx[];
  time: number; // max CU in wave
};

type LogEntry = {
  at: number;
  scope: 'SYSTEM' | 'EVM' | 'SVM';
  kind: 'info' | 'success' | 'error' | 'phase';
  message: string;
};

function declaredCoversActual(tx: Tx): boolean {
  for (const [acct, mode] of Object.entries(tx.actual) as Array<[AccountId, AccessMode]>) {
    const d = tx.declared[acct];
    if (!d) return false;
    // write requires write declaration
    if (mode === 'w' && d !== 'w') return false;
  }
  return true;
}

function conflicts(a: Partial<Record<AccountId, AccessMode>>, b: Partial<Record<AccountId, AccessMode>>): boolean {
  // RW conflicts:
  // - read/read does not conflict
  // - any write conflicts if same account is touched
  for (const acct of Object.keys({ ...a, ...b }) as AccountId[]) {
    const am = a[acct];
    const bm = b[acct];
    if (!am || !bm) continue;
    if (am === 'w' || bm === 'w') return true;
  }
  return false;
}

function computeWaves(txs: Tx[], threads: number): Wave[] {
  const waves: Tx[][] = [];
  for (const tx of txs) {
    let placed = false;

    for (const wave of waves) {
      if (wave.length >= threads) continue;
      const fits = wave.every((wtx) => !conflicts(wtx.declared, tx.declared));
      if (fits) {
        wave.push(tx);
        placed = true;
        break;
      }
    }

    if (!placed) waves.push([tx]);
  }

  return waves.map((w) => ({ txs: w, time: Math.max(...w.map((t) => t.computeUnits)) }));
}

function defaultTxs(): Tx[] {
  // TX #2 intentionally has a missing declared account (FeeVault) to show why SVM requires declarations.
  return [
    {
      id: 1,
      label: 'Alice swaps (writes DexPool) + fee vault write',
      computeUnits: 60,
      actual: { Alice: 'w', DexPool: 'w', FeeVault: 'w' },
      declared: { Alice: 'w', DexPool: 'w', FeeVault: 'w' }
    },
    {
      id: 2,
      label: 'Bob swaps (writes DexPool) + fee vault write',
      computeUnits: 60,
      actual: { Bob: 'w', DexPool: 'w', FeeVault: 'w' },
      // Missing FeeVault declaration on purpose:
      declared: { Bob: 'w', DexPool: 'w' }
    },
    {
      id: 3,
      label: 'Oracle read (read-only)',
      computeUnits: 15,
      actual: { Oracle: 'r' },
      declared: { Oracle: 'r' }
    },
    {
      id: 4,
      label: 'Oracle read (read-only)',
      computeUnits: 15,
      actual: { Oracle: 'r' },
      declared: { Oracle: 'r' }
    }
  ];
}

function sumCu(txs: Tx[]) {
  return txs.reduce((a, t) => a + t.computeUnits, 0);
}

function OutcomePill({ out }: { out: Outcome | undefined }) {
  if (!out || out.status === 'pending') return <span className="text-xs text-slate-400">pending</span>;
  if (out.status === 'ok') return <span className="text-xs text-emerald-300">ok</span>;
  return <span className="text-xs text-red-300">failed</span>;
}

export default function EvmVsSvmDemo() {
  const { tr } = useDemoI18n('evm-vs-svm');

  const concepts = useMemo(
    () => [
      define('EVM (sequential execution)', tr('Executes transactions in a strict order. State access is implicit.')),
      define('SVM-style (parallel scheduling)', tr('Transactions can run in parallel when they declare non-conflicting state access.')),
      define('Account declarations', tr('A tx declares which accounts it will read/write. Missing declarations can cause failure.')),
      define('Conflicts', tr('Two txs conflict if they touch the same account and at least one writes.'))
    ],
    [tr]
  );

  const [threads, setThreads] = useState(2);
  const [txs, setTxs] = useState<Tx[]>(() => defaultTxs());

  const evmTime = useMemo(() => sumCu(txs), [txs]);
  const waves = useMemo(() => computeWaves(txs, threads), [txs, threads]);
  const svmTime = useMemo(() => waves.reduce((a, w) => a + w.time, 0), [waves]);
  const speedup = useMemo(() => (svmTime > 0 ? evmTime / svmTime : 1), [evmTime, svmTime]);

  const [evmOut, setEvmOut] = useState<Record<number, Outcome>>({});
  const [svmOut, setSvmOut] = useState<Record<number, Outcome>>({});

  const [evmIndex, setEvmIndex] = useState(0);
  const [svmWaveIndex, setSvmWaveIndex] = useState(0);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [nextId, setNextId] = useState(() => Math.max(...defaultTxs().map((t) => t.id)) + 1);

  function appendLog(scope: LogEntry['scope'], kind: LogEntry['kind'], message: string) {
    setLogs((prev) => {
      const next = [...prev, { at: Date.now(), scope, kind, message }];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  }

  function resetExecution(keepLogs = false) {
    setEvmOut({});
    setSvmOut({});
    setEvmIndex(0);
    setSvmWaveIndex(0);
    if (!keepLogs) setLogs([]);
  }

  const quests = useMemo(() => {
    const fixedMissing = txs.every((t) => declaredCoversActual(t));
    const ranEvmToEnd = evmIndex >= txs.length;
    const ranSvmToEnd = svmWaveIndex >= waves.length;

    return {
      fixedMissing,
      gotSpeedup: fixedMissing && speedup >= 1.2,
      ranBoth: ranEvmToEnd && ranSvmToEnd
    };
  }, [txs, speedup, evmIndex, svmWaveIndex, waves.length]);

  function onTxListChanged(reason: string) {
    resetExecution(true);
    appendLog('SYSTEM', 'info', reason);
  }

  function toggleDeclared(txId: number, acct: AccountId, mode: AccessMode) {
    setTxs((prev) => {
      const next = prev.map((t) => {
        if (t.id !== txId) return t;
        const cur = t.declared[acct];
        const nt: Tx = {
          ...t,
          declared: { ...t.declared }
        };
        if (!cur) nt.declared[acct] = mode;
        else if (cur === 'r' && mode === 'w') nt.declared[acct] = 'w';
        else delete nt.declared[acct];
        return nt;
      });
      return next;
    });
    onTxListChanged(tr('Updated declarations'));
  }

  function moveTx(id: number, dir: -1 | 1) {
    setTxs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const nidx = idx + dir;
      if (nidx < 0 || nidx >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[nidx];
      next[nidx] = tmp;
      return next;
    });
    onTxListChanged(tr('Reordered transactions'));
  }

  function removeTx(id: number) {
    setTxs((prev) => prev.filter((t) => t.id !== id));
    onTxListChanged(tr('Removed a transaction'));
  }

  function addTxPreset() {
    const id = nextId;
    setNextId((v) => v + 1);
    const newTx: Tx = {
      id,
      label: 'Oracle write (conflicts with oracle reads)',
      computeUnits: 30,
      actual: { Oracle: 'w' },
      declared: { Oracle: 'w' }
    };
    setTxs((prev) => [...prev, newTx]);
    onTxListChanged(tr('Added a transaction'));
  }

  function runEvmStep() {
    if (evmIndex >= txs.length) return;
    const t = txs[evmIndex];

    appendLog('EVM', 'phase', `${tr('Execute TX')} #${t.id}`);
    setEvmOut((prev) => ({ ...prev, [t.id]: { status: 'ok', summary: tr('Executed') } }));
    appendLog('EVM', 'success', `${tr('OK')} — #${t.id}: ${tr(t.label)}`);

    setEvmIndex((v) => v + 1);
  }

  function runSvmStep() {
    if (svmWaveIndex >= waves.length) return;
    const wave = waves[svmWaveIndex];

    appendLog('SVM', 'phase', `${tr('Execute wave')} ${svmWaveIndex + 1}/${waves.length} (${wave.txs.length} txs)`);

    const patch: Record<number, Outcome> = {};
    for (const t of wave.txs) {
      if (!declaredCoversActual(t)) {
        patch[t.id] = {
          status: 'failed',
          reason: 'MissingAccountDeclaration',
          summary: tr('Missing declaration for at least one actual account')
        };
        appendLog('SVM', 'error', `${tr('FAILED')} — #${t.id}: ${tr('Missing declaration')}`);
      } else {
        patch[t.id] = { status: 'ok', summary: tr('Executed') };
        appendLog('SVM', 'success', `${tr('OK')} — #${t.id}: ${tr(t.label)}`);
      }
    }

    setSvmOut((prev) => ({ ...prev, ...patch }));
    setSvmWaveIndex((v) => v + 1);
  }

  function runEvmAll() {
    appendLog('EVM', 'phase', tr('Run all (EVM)'));

    const out: Record<number, Outcome> = {};
    for (const t of txs) {
      out[t.id] = { status: 'ok', summary: tr('Executed') };
    }
    setEvmOut(out);
    setEvmIndex(txs.length);

    appendLog('EVM', 'success', tr('EVM completed'));
  }

  function runSvmAll() {
    appendLog('SVM', 'phase', tr('Run all (SVM)'));

    const out: Record<number, Outcome> = {};
    for (const t of txs) {
      if (!declaredCoversActual(t)) {
        out[t.id] = {
          status: 'failed',
          reason: 'MissingAccountDeclaration',
          summary: tr('Missing declaration for at least one actual account')
        };
      } else {
        out[t.id] = { status: 'ok', summary: tr('Executed') };
      }
    }
    setSvmOut(out);
    setSvmWaveIndex(waves.length);

    const hasFail = Object.values(out).some((o) => o.status === 'failed');
    appendLog('SVM', hasFail ? 'error' : 'success', hasFail ? tr('SVM completed with failures') : tr('SVM completed'));
  }

  function reset() {
    setTxs(defaultTxs());
    setThreads(2);
    setNextId(Math.max(...defaultTxs().map((t) => t.id)) + 1);
    resetExecution(false);
    appendLog('SYSTEM', 'info', tr('Reset simulation'));
  }

  const allAccounts: AccountId[] = ['Alice', 'Bob', 'DexPool', 'FeeVault', 'Oracle'];

  return (
    <div className="w-full max-w-7xl mx-auto p-6 text-white">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <Cpu className="text-blue-300" />
              {tr('EVM vs SVM: Sequential vs Parallel execution')}
            </h1>
            <p className="text-slate-300 mt-2 max-w-3xl">
              {tr(
                'This simulation compares a sequential EVM-style pipeline with an SVM-style scheduler that can run non-conflicting transactions in parallel when accounts are declared upfront.'
              )}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {concepts.map((c) => (
                <span
                  key={c.term}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-sm text-slate-200"
                >
                  <span>{c.term}</span>
                  <span>
                    <EduTooltip widthClassName="w-96" text={c.def} />
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
            >
              <Bug size={16} />
              {showDebug ? tr('Hide debug') : tr('Show debug')}
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
            >
              <RefreshCw size={16} />
              {tr('Reset')}
            </button>
            <LinkWithCopy text="EVM vs SVM demo" copyText={typeof window !== 'undefined' ? window.location.href : ''} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Controls */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers size={18} className="text-blue-300" />
              {tr('Parallel threads')}
            </div>
            <div className="mt-2 text-sm text-slate-300">
              {tr('SVM can schedule up to N non-conflicting txs in parallel (per wave).')}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={4}
                value={threads}
                onChange={(e) => setThreads(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-sm">{threads}</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="px-2 py-1 rounded border border-purple-700 bg-purple-900/20 text-purple-100">
                {tr('EVM time')}: <span className="font-bold">{evmTime}</span> CU
              </span>
              <span className="px-2 py-1 rounded border border-emerald-700 bg-emerald-900/20 text-emerald-100">
                {tr('SVM time')}: <span className="font-bold">{svmTime}</span> CU
              </span>
              <span className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200">
                {tr('Speedup')}: <span className="font-bold text-emerald-300">{speedup.toFixed(2)}×</span>
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs font-semibold text-slate-400">{tr('EVM (sequential)')}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {tr('Index')}: {evmIndex}/{txs.length}
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={runEvmStep}
                    disabled={evmIndex >= txs.length}
                    className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-sm font-semibold"
                  >
                    {tr('Step')}
                  </button>
                  <button
                    type="button"
                    onClick={runEvmAll}
                    className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold"
                  >
                    {tr('Run all')}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs font-semibold text-slate-400">{tr('SVM-style (waves)')}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {tr('Wave')}: {svmWaveIndex}/{waves.length}
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={runSvmStep}
                    disabled={svmWaveIndex >= waves.length}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-sm font-semibold"
                  >
                    {tr('Step')}
                  </button>
                  <button
                    type="button"
                    onClick={runSvmAll}
                    className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold"
                  >
                    {tr('Run all')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quests */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Shield size={18} className="text-emerald-300" />
              {tr('Learning quests')}
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <QuestRow done={quests.fixedMissing} text={tr('Fix TX #2 by declaring FeeVault as write')} />
              <QuestRow done={quests.gotSpeedup} text={tr('Reach speedup ≥ 1.2× (increase threads + reduce conflicts)')} />
              <QuestRow done={quests.ranBoth} text={tr('Run both EVM and SVM to completion')} />
            </div>
          </div>

          {/* Waves */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-slate-200">{tr('SVM waves (from declarations)')}</div>
            <div className="mt-3 space-y-2">
              {waves.map((w, idx) => (
                <div key={idx} className="rounded-lg border border-slate-700 bg-slate-900/30 p-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-200">
                      {tr('Wave')} {idx + 1}
                    </span>
                    <span className="text-xs text-slate-400">{tr('time')}: {w.time} CU</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-300">{w.txs.map((t) => `#${t.id}`).join(', ')}</div>
                </div>
              ))}
            </div>

            {showDebug && (
              <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
                <div>{tr('Debug')}:</div>
                <div>{tr('Conflicts are computed from declared read/write sets.')}</div>
                <div>{tr('A wave can contain up to N txs (threads) if none conflict.')}</div>
              </div>
            )}
          </div>

          {/* Log */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ScrollText size={18} className="text-blue-300" />
              {tr('Execution log')}
            </div>
            <div className="mt-3 max-h-56 overflow-auto space-y-1 text-xs">
              {logs.length === 0 ? (
                <div className="text-slate-500">{tr('No logs yet. Run EVM or SVM to see what happens.')}</div>
              ) : (
                logs
                  .slice()
                  .reverse()
                  .map((l, i) => (
                    <div
                      key={`${l.at}-${i}`}
                      className={`font-mono ${
                        l.kind === 'error'
                          ? 'text-red-300'
                          : l.kind === 'success'
                            ? 'text-emerald-300'
                            : l.kind === 'phase'
                              ? 'text-blue-200'
                              : 'text-slate-300'
                      }`}
                    >
                      [{l.scope}] {l.message}
                    </div>
                  ))
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-xs px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
              >
                {tr('Clear')}
              </button>
            </div>
          </div>
        </div>

        {/* TX list */}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-200">{tr('Transactions & declared accounts')}</div>
            <button
              type="button"
              onClick={addTxPreset}
              className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
            >
              <Plus size={14} />
              {tr('Add tx')}
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {txs.map((tx, idx) => {
              const missing = !declaredCoversActual(tx);
              return (
                <div key={tx.id} className="rounded-xl border border-slate-700 bg-slate-900/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">#{tx.id}</span>
                        <span className="text-slate-200">{tr(tx.label)}</span>
                        <span className="text-xs px-2 py-1 rounded border border-slate-700 bg-slate-950/40 text-slate-200">
                          {tx.computeUnits} CU
                        </span>
                        {missing ? (
                          <span className="text-xs px-2 py-1 rounded border border-red-700 bg-red-900/20 text-red-200">
                            {tr('Declaration missing')}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded border border-emerald-700 bg-emerald-900/20 text-emerald-200">
                            {tr('Declaration ok')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {tr('EVM')}: <OutcomePill out={evmOut[tx.id]} /> &nbsp;|&nbsp; {tr('SVM')}: <OutcomePill out={svmOut[tx.id]} />
                      </div>

                      <div className="mt-2 text-xs text-slate-300">
                        {tr('Actual access')}: {Object.entries(tx.actual).map(([a, m]) => `${a}:${m}`).join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveTx(tx.id, -1)}
                      disabled={idx === 0}
                      className="p-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                      aria-label={tr('Move up')}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTx(tx.id, 1)}
                      disabled={idx === txs.length - 1}
                      className="p-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                      aria-label={tr('Move down')}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTx(tx.id)}
                      className="p-2 rounded-lg border border-red-800 bg-red-950/30 hover:bg-red-900/20"
                      aria-label={tr('Remove')}
                    >
                      <Trash2 size={16} className="text-red-300" />
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-slate-400 mb-2">{tr('Declared accounts (toggle)')}</div>
                    <div className="flex flex-wrap gap-2">
                      {allAccounts.map((a) => {
                        const cur = tx.declared[a];
                        const label = cur ? `${a}:${cur}` : `${a}:—`;
                        const cls =
                          cur === 'w'
                            ? 'border-emerald-700 bg-emerald-900/20 text-emerald-100'
                            : cur === 'r'
                              ? 'border-blue-700 bg-blue-900/20 text-blue-100'
                              : 'border-slate-700 bg-slate-950/30 text-slate-200';

                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => toggleDeclared(tx.id, a, 'w')}
                            className={`text-xs px-2 py-1 rounded border ${cls}`}
                            title={tr('Click to toggle (none → write → none)')}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      {tr('Simplified toggle: click sets WRITE, click again clears. (Read vs write matters for conflicts.)')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          {tr('Note: This is a teaching simulation, not an exact implementation of Ethereum or Solana internals.')}
        </div>
      </div>
    </div>
  );
}

function QuestRow({ done, text }: { done: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={done ? 'text-emerald-300' : 'text-slate-500'}>{done ? '✓' : '•'}</span>
      <div className={done ? 'text-emerald-100' : 'text-slate-200'}>{text}</div>
    </div>
  );
}
