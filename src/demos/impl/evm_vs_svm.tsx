">
import EduTooltip from '../../ui/EduTooltip';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
import { Bug, Cpu, Layers, ListChecks, Play, RefreshCw, Shield, StepForward } from 'lucide-react';

type AccountId = 'Alice' | 'Bob' | 'Carol' | 'DexPool' | 'FeeVault' | 'Oracle';
type AccessMode = 'r' | 'w';

type Tx = {
  id: number;
  label: string;
  computeUnits: number;
  actual: Record<AccountId, AccessMode>;
  declared: Partial<Record<AccountId, AccessMode>>;
};

type Outcome =
  | { status: 'pending' }
  | { status: 'ok' }
  | { status: 'failed'; reason: 'MissingAccountDeclaration' };

type LogEntry = {
  at: number;
  scope: 'SYSTEM' | 'EVM' | 'SVM';
  kind: 'info' | 'success' | 'error' | 'phase';
  message: string;
};

const T = EduTooltip;

function nowMs() {
  return Date.now();
}

function declaredCoversActual(tx: Tx) {
  for (const [acct, mode] of Object.entries(tx.actual) as Array<[AccountId, AccessMode]>) {
    const d = tx.declared[acct];
    if (!d) return false;
    if (mode === 'w' && d !== 'w') return false;
  }
  return true;
}

function conflicts(a: Record<AccountId, AccessMode>, b: Record<AccountId, AccessMode>) {
  for (const [acct, modeA] of Object.entries(a) as Array<[AccountId, AccessMode]>) {
    const modeB = b[acct];
    if (!modeB) continue;
    if (modeA === 'w' || modeB === 'w') return true;
  }
  return false;
}

function computeWaves(txs: Tx[], threads: number) {
  const waves: Tx[][] = [];
  for (const tx of txs) {
    let placed = false;
    for (const w of waves) {
      if (w.length >= threads) continue;
      const fits = w.every((t) => !conflicts(t.declared as any, tx.declared as any));
      if (fits) {
        w.push(tx);
        placed = true;
        break;
      }
    }
    if (!placed) waves.push([tx]);
  }
  return waves;
}

function waveTime(wave: Tx[]) {
  return wave.length === 0 ? 0 : Math.max(...wave.map((t) => t.computeUnits));
}

function estEvmTime(txs: Tx[]) {
  return txs.reduce((a, t) => a + t.computeUnits, 0);
}

function estSvmTime(waves: Tx[][]) {
  return waves.reduce((a, w) => a + waveTime(w), 0);
}

function StopPropagation({ children }: { children: React.ReactNode }) {
  return (
    <span
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </span>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${className}`}>{children}</span>;
}

function QuestItem({ done, title, tooltip }: { done: boolean; title: string; tooltip: string }) {
  return (
    <div className=\"flex items-start justify-between gap-3\">
      <div className=\"min-w-0 text-sm\">
        <span className={done ? 'text-emerald-300 font-semibold' : 'text-slate-200 font-semibold'}>
          {done ? '✓ ' : '• '}
          {title}
        </span>
      </div>
      <span className=\"shrink-0\">
        <T text={tooltip} />
      </span>
    </div>
  );
}

function OutcomePill({ out }: { out?: Outcome }) {
  if (!out || out.status === 'pending') return <span className=\"text-xs text-slate-400\">pending</span>;
  if (out.status === 'ok') return <span className=\"text-xs text-emerald-300\">ok</span>;
  return <span className=\"text-xs text-red-300\">failed</span>;
}

const ALL_ACCOUNTS: AccountId[] = ['Alice', 'Bob', 'Carol', 'DexPool', 'FeeVault', 'Oracle'];

function accessToString(access: Partial<Record<AccountId, AccessMode>>) {
  const items = Object.entries(access).map(([a, m]) => `${a}:${m}`);
  return items.length ? items.join(', ') : '(none)';
}

function defaultTxs(): Tx[] {
  return [
    {
      id: 1,
      label: 'Transfer (Alice → Bob)',
      computeUnits: 30,
      actual: { Alice: 'w', Bob: 'w' },
      declared: { Alice: 'w', Bob: 'w' }
    },
    {
      id: 2,
      label: 'Swap (Bob ↔ Pool) [broken declaration]',
      computeUnits: 90,
      actual: { Bob: 'w', DexPool: 'w', FeeVault: 'w' },
      // Missing FeeVault => SVM preflight failure until user fixes it.
      declared: { Bob: 'w', DexPool: 'w' }
    },
    {
      id: 3,
      label: 'Oracle read (read-only)',
      computeUnits: 20,
      actual: { Oracle: 'r' },
      declared: { Oracle: 'r' }
    },
    {
      id: 4,
      label: 'Oracle read (read-only #2)',
      computeUnits: 20,
      actual: { Oracle: 'r' },
      declared: { Oracle: 'r' }
    },
    {
      id: 5,
      label: 'Oracle update (write)',
      computeUnits: 60,
      actual: { Oracle: 'w' },
      declared: { Oracle: 'w' }
    }
  ];
}

export default function EvmVsSvmDemo() {
  const { tr } = useDemoI18n('evm-vs-svm');

  const [threads, setThreads] = useState(3);
  const [txs, setTxs] = useState<Tx[]>(() => defaultTxs());

  const waves = useMemo(() => computeWaves(txs, threads), [txs, threads]);

  const [evmIndex, setEvmIndex] = useState(0);
  const [svmWaveIndex, setSvmWaveIndex] = useState(0);

  const [evmTime, setEvmTime] = useState(0);
  const [svmTime, setSvmTime] = useState(0);

  const [evmOutcomes, setEvmOutcomes] = useState<Record<number, Outcome>>({});
  const [svmOutcomes, setSvmOutcomes] = useState<Record<number, Outcome>>({});

  const [showDebug, setShowDebug] = useState(false);

  const [log, setLog] = useState<LogEntry[]>(() => [
    {
      at: nowMs(),
      scope: 'SYSTEM',
      kind: 'info',
      message: tr('Tip: Run SVM first. TX #2 is missing FeeVault in its declared accounts and will fail.')
    }
  ]);

  const concepts = useMemo(
    () => [
      { term: 'Account Model' as const, def: define('Account Model') },
      { term: 'Transaction Ordering' as const, def: define('Transaction Ordering') },
      { term: 'Parallel Execution' as const, def: define('Parallel Execution') },
      { term: 'Conflict Detection' as const, def: define('Conflict Detection') }
    ],
    []
  );

  const evmEst = useMemo(() => estEvmTime(txs), [txs]);
  const svmEst = useMemo(() => estSvmTime(waves), [waves]);
  const speedup = useMemo(() => (svmEst === 0 ? 1 : evmEst / svmEst), [evmEst, svmEst]);

  const quests = useMemo(() => {
    const sawFail = log.some((e) => e.scope === 'SVM' && e.kind === 'error' && e.message.includes('Missing account declaration'));
    const fixed = txs.every((t) => declaredCoversActual(t));
    const ranBoth = evmIndex >= txs.length && svmWaveIndex >= waves.length;
    const gotSpeed = speedup >= 1.2 && waves.length > 1;
    return { sawFail, fixed, ranBoth, gotSpeed };
  }, [log, txs, evmIndex, svmWaveIndex, speedup, waves.length]);

  function pushLog(entry: Omit<LogEntry, 'at'>) {
    setLog((prev) => [{ ...entry, at: nowMs() }, ...prev].slice(0, 80));
  }

  function resetRuntime() {
    setEvmIndex(0);
    setSvmWaveIndex(0);
    setEvmTime(0);
    setSvmTime(0);
    setEvmOutcomes({});
    setSvmOutcomes({});
  }

  function resetAll() {
    setThreads(3);
    setTxs(defaultTxs());
    resetRuntime();
    setLog([{ at: nowMs(), scope: 'SYSTEM', kind: 'info', message: tr('Reset state.') }]);
  }

  function reorderTx(id: number, dir: -1 | 1) {
    setTxs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const nidx = idx + dir;
      if (idx < 0 || nidx < 0 || nidx >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[nidx];
      next[nidx] = tmp;
      return next;
    });

    resetRuntime();
    pushLog({ scope: 'SYSTEM', kind: 'info', message: tr('Reordered transactions. EVM is order-dependent.') });
  }

  function toggleDeclared(txId: number, acct: AccountId) {
    setTxs((prev) =>
      prev.map((t) => {
        if (t.id !== txId) return t;
        const declared = { ...t.declared };
        if (declared[acct]) delete declared[acct];
        else declared[acct] = t.actual[acct] ?? 'r';
        return { ...t, declared };
      })
    );

    resetRuntime();
    pushLog({ scope: 'SYSTEM', kind: 'info', message: tr('Updated declared accounts (affects SVM scheduling + validity).') });
  }

  function evmStep() {
    const tx = txs[evmIndex];
    if (!tx) return;

    setEvmOutcomes((prev) => ({ ...prev, [tx.id]: { status: 'ok' } }));
    setEvmIndex((v) => v + 1);
    setEvmTime((v) => v + tx.computeUnits);
    pushLog({ scope: 'EVM', kind: 'success', message: tr('TX #{{id}} executed (sequential).', { id: tx.id }) });
  }

  function svmStep() {
    const wave = waves[svmWaveIndex];
    if (!wave) return;

    pushLog({
      scope: 'SVM',
      kind: 'phase',
      message: tr('Executing wave {{idx}} / {{total}} (max {{cu}} CU)', {
        idx: svmWaveIndex + 1,
        total: waves.length,
        cu: waveTime(wave)
      })
    });

    setSvmOutcomes((prev) => {
      const next = { ...prev };
      for (const tx of wave) {
        if (!declaredCoversActual(tx)) {
          const missing = Object.keys(tx.actual).filter((a) => !(tx.declared as any)[a]);
          const msg = tr('Missing account declaration: {{missing}}', { missing: missing.join(', ') });
          next[tx.id] = { status: 'failed', reason: 'MissingAccountDeclaration', summary: msg };
          pushLog({ scope: 'SVM', kind: 'error', message: tr('TX #{{id}} failed: {{msg}}', { id: tx.id, msg }) });
        } else {
          next[tx.id] = { status: 'ok' };
          pushLog({ scope: 'SVM', kind: 'success', message: tr('TX #{{id}} executed (parallel wave).', { id: tx.id }) });
        }
      }
      return next;
    });

    setSvmWaveIndex((v) => v + 1);
    setSvmTime((v) => v + waveTime(wave));
  }

  function runAll(which: 'evm' | 'svm') {
    if (which === 'evm') {
      const outcomes: Record<number, Outcome> = {};
      let time = 0;
      for (let i = evmIndex; i < txs.length; i++) {
        const tx = txs[i];
        time += tx.computeUnits;
        outcomes[tx.id] = { status: 'ok' };
      }
      setEvmOutcomes((prev) => ({ ...prev, ...outcomes }));
      setEvmTime((v) => v + time);
      setEvmIndex(txs.length);
      pushLog({ scope: 'EVM', kind: 'info', message: tr('Ran EVM to completion.') });
      return;
    }

    const outcomes: Record<number, Outcome> = {};
    let time = 0;
    for (let w = svmWaveIndex; w < waves.length; w++) {
      const wave = waves[w];
      time += waveTime(wave);
      for (const tx of wave) {
        if (!declaredCoversActual(tx)) {
          const missing = Object.keys(tx.actual).filter((a) => !(tx.declared as any)[a]);
          outcomes[tx.id] = { status: 'failed', reason: 'MissingAccountDeclaration', summary: missing.join(', ') };
        } else {
          outcomes[tx.id] = { status: 'ok' };
        }
      }
    }
    setSvmOutcomes((prev) => ({ ...prev, ...outcomes }));
    setSvmTime((v) => v + time);
    setSvmWaveIndex(waves.length);
    pushLog({ scope: 'SVM', kind: 'info', message: tr('Ran SVM to completion.') });
  }

  return (
    <div className='w-full max-w-7xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg'>
      <div className='mb-6'>
        <div className='flex flex-col md:flex-row md:items-start md:justify-between gap-4'>
          <div className='min-w-0'>
            <h1 className='text-3xl font-bold flex items-center gap-3'>
              <Cpu className='text-blue-300' />
              {tr('EVM vs SVM: Sequential vs Parallel Execution')}
            </h1>
            <p className='text-slate-300 mt-2'>
              {tr('Interactively compare an EVM-style block (single ordered lane) with an SVM-style block (declared accounts + parallel waves).')}
            </p>

            <div className='mt-3 flex flex-wrap gap-2'>
              {concepts.map((c) => (
                <span
                  key={c.term}
                  className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-sm text-slate-200'
                >
                  <span>{c.term}</span>
                  <StopPropagation>
                    <T text={c.def} />
                  </StopPropagation>
                </span>
              ))}
            </div>

            <div className='mt-4 flex flex-wrap items-center gap-2'>
              <Badge className='border-purple-700 bg-purple-900/30 text-purple-100'>
                {tr('EVM estimated')}: <span className='font-bold ml-1'>{evmEst} CU</span>
              </Badge>
              <Badge className='border-emerald-700 bg-emerald-900/30 text-emerald-100'>
                {tr('SVM estimated')}: <span className='font-bold ml-1'>{svmEst} CU</span>
              </Badge>
              <Badge className='border-slate-700 bg-slate-800 text-slate-200'>
                {tr('Speedup')}: <span className='font-bold ml-1 text-emerald-300'>{speedup.toFixed(2)}×</span>
              </Badge>
              <Badge className='border-slate-700 bg-slate-800 text-slate-200'>
                {tr('EVM ran')}: <span className='font-bold ml-1'>{evmTime} CU</span>
              </Badge>
              <Badge className='border-slate-700 bg-slate-800 text-slate-200'>
                {tr('SVM ran')}: <span className='font-bold ml-1'>{svmTime} CU</span>
              </Badge>
            </div>
          </div>

          <div className='shrink-0 flex items-center gap-2'>
            <button
              type='button'
              onClick={() => setShowDebug((v) => !v)}
              className='inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700'
            >
              <Bug size={16} />
              <span className='whitespace-nowrap'>{showDebug ? tr('Hide debug') : tr('Show debug')}</span>
            </button>

            <button
              type='button'
              onClick={resetAll}
              className='inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700'
            >
              <RefreshCw size={16} />
              <span className='whitespace-nowrap'>{tr('Reset')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Left: settings + quests */}
        <div className='space-y-6'>
          <div className='bg-slate-900/60 border border-slate-700 rounded-xl p-4'>
            <h2 className='text-lg font-semibold flex items-center gap-2'>
              <Layers size={18} className='text-blue-300' />
              {tr('Scheduler settings')}
            </h2>

            <div className='mt-3 text-sm text-slate-300 flex items-center gap-2'>
              <span className='font-semibold'>{tr('SVM threads')}</span>
              <T text={tr('How many transactions can run at the same time, after conflict checks.')} />
            </div>

            <div className='mt-2 flex items-center gap-3'>
              <input
                type='range'
                min={1}
                max={4}
                value={threads}
                onChange={(e) => setThreads(parseInt(e.target.value, 10))}
                className='w-full'
              />
              <span className='px-2 py-1 rounded bg-slate-800 border border-slate-700 text-sm whitespace-nowrap'>{threads}</span>
            </div>

            {showDebug && (
              <div className='mt-4 text-xs text-slate-400 space-y-1'>
                <div>{tr('Waves are packed greedily using declared read/write conflicts.')}</div>
                <div>{tr('Wave time = max computeUnits in wave. Total time = sum(wave times).')}</div>
              </div>
            )}
          </div>

          <div className='bg-slate-900/60 border border-slate-700 rounded-xl p-4'>
            <h2 className='text-lg font-semibold flex items-center gap-2'>
              <Shield size={18} className='text-emerald-300' />
              {tr('Quests')}
              <T text={tr('Small challenges to prove you understood the difference.')} />
            </h2>

            <div className='mt-3 space-y-3'>
              <QuestItem
                done={quests.sawFail}
                title={tr('Cause an SVM failure (missing declared account)')}
                tooltip={tr('Run SVM with the default TX #2; it is missing FeeVault so it fails preflight.')}
              />
              <QuestItem
                done={quests.fixed}
                title={tr('Fix the missing declaration for TX #2')}
                tooltip={tr('Toggle FeeVault for TX #2 in the TX list. Then run SVM again.')}
              />
              <QuestItem
                done={quests.gotSpeed}
                title={tr('Make SVM schedule faster than EVM (speedup ≥ 1.2×)')}
                tooltip={tr('Increase threads; multiple disjoint reads can be packed into the same wave.')}
              />
              <QuestItem
                done={quests.ranBoth}
                title={tr('Run EVM and SVM to completion')}
                tooltip={tr('Use Run all on both sides.')}
              />
            </div>
          </div>
        </div>

        {/* Middle: transactions */}
        <div className='bg-slate-900/60 border border-slate-700 rounded-xl p-4'>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <ListChecks size={18} className='text-blue-300' />
            {tr('Transactions & declared accounts')}
          </h2>

          <div className='mt-3 space-y-3'>
            {txs.map((tx, idx) => {
              const missing = !declaredCoversActual(tx);
              return (
                <div key={tx.id} className='rounded-xl border border-slate-700 bg-slate-800/40 p-3'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='font-semibold'>#{tx.id}</span>
                        <span className='text-slate-200'>{tr(tx.label)}</span>
                        <Badge className='border-slate-700 bg-slate-900/40 text-slate-200'>{tx.computeUnits} CU</Badge>
                        {missing ? (
                          <Badge className='border-red-700 bg-red-900/20 text-red-200'>{tr('Declaration missing')}</Badge>
                        ) : (
                          <Badge className='border-emerald-700 bg-emerald-900/20 text-emerald-200'>{tr('Declaration ok')}</Badge>
                        )}
                      </div>

                      <div className='mt-2 text-xs text-slate-300 space-y-1'>
                        <div>
                          <span className='text-slate-400'>{tr('Actual')}:</span> {accessToString(tx.actual)}
                        </div>
                        <div>
                          <span className='text-slate-400'>{tr('Declared')}:</span> {accessToString(tx.declared)}
                        </div>
                      </div>

                      <div className='mt-3'>
                        <div className='text-xs text-slate-400 flex items-center gap-2'>
                          {tr('Toggle declared accounts')}
                          <T text={tr('SVM requires declaring every account you touch. This enables parallel scheduling.')} />
                        </div>
                        <div className='mt-2 flex flex-wrap gap-2'>
                          {ALL_ACCOUNTS.map((a) => {
                            const on = Boolean(tx.declared[a]);
                            return (
                              <button
                                key={a}
                                type='button'
                                onClick={() => toggleDeclared(tx.id, a)}
                                className={`px-2 py-1 rounded-lg border text-xs ${
                                  on
                                    ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200'
                                    : 'border-slate-700 bg-slate-900/20 text-slate-300'
                                }`}
                              >
                                {a}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className='shrink-0 flex flex-col items-end gap-2'>
                      <div className='flex items-center gap-1'>
                        <button
                          type='button'
                          onClick={() => reorderTx(tx.id, -1)}
                          disabled={idx === 0}
                          className='p-2 rounded-lg border border-slate-700 bg-slate-900/30 disabled:opacity-40'
                          aria-label={tr('Move up')}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type='button'
                          onClick={() => reorderTx(tx.id, 1)}
                          disabled={idx === txs.length - 1}
                          className='p-2 rounded-lg border border-slate-700 bg-slate-900/30 disabled:opacity-40'
                          aria-label={tr('Move down')}
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                      <div className='text-xs text-slate-400'>EVM: <OutcomePill out={evmOutcomes[tx.id]} /></div>
                      <div className='text-xs text-slate-400'>SVM: <OutcomePill out={svmOutcomes[tx.id]} /></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className='mt-4'>
            <h3 className='text-sm font-semibold text-slate-200'>{tr('SVM waves (from declared accounts)')}</h3>
            <div className='mt-2 space-y-2'>
              {waves.map((wave, i) => (
                <div key={i} className='rounded-lg border border-slate-700 bg-slate-800/30 p-2 text-sm'>
                  <div className='flex items-center justify-between'>
                    <span className='text-slate-200'>
                      {tr('Wave')} {i + 1}
                    </span>
                    <span className='text-xs text-slate-400'>max {waveTime(wave)} CU</span>
                  </div>
                  <div className='mt-1 text-xs text-slate-300'>
                    {wave.map((t) => `#${t.id}`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: execution + log */}
        <div className='space-y-6'>
          <div className='bg-slate-900/60 border border-s