import React, { useEffect, useMemo, useRef, useState } from 'react';
import EduTooltip from '../../ui/EduTooltip';
import LearningQuestsPortal from '../../ui/LearningQuestsPortal';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { useDemoI18n } from '../useDemoI18n';
import {
  ArrowDown,
  ArrowUp,
  Bug,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  ListTodo,
  Plus,
  RefreshCw,
  ScrollText,
  Shield,
  Trash2
} from 'lucide-react';
import {
  computeSchedule,
  conflictPairs,
  conflictingAccounts,
  conflicts,
  declaredCoversActual,
  defaultTxs,
  missingDeclarations,
  oracleHeavyTxs,
  sharedReads,
  sumCu,
  writtenAccounts,
  type AccessMode,
  type AccountId,
  type ScheduleAttempt,
  type ScheduleDebug,
  type Tx,
  type Wave
} from './evm_vs_svm/scheduler';
import { usePersistedQuests, useReportQuestProgress } from '../questProgress';
import { usePulseTarget } from '../../ui/attention';
import ExecutionTimeline from './evm_vs_svm/ExecutionTimeline';
import AccessDiagram from './evm_vs_svm/AccessDiagram';


/** Sources for the "Further Reading" section (all checked on 2026-11-23). Group titles are translated. */
const FURTHER_READING: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: 'Solana: declared accounts and Sealevel',
    links: [
      {
        label: 'Solana Foundation — Sealevel: Parallel Processing Thousands of Smart Contracts (2019)',
        href: 'https://solana.com/news/sealevel---parallel-processing-thousands-of-smart-contracts'
      },
      { label: 'Solana docs — Transaction Structure', href: 'https://solana.com/docs/core/transactions/transaction-structure' },
      { label: 'Solana docs — Account Modification Rules', href: 'https://solana.com/docs/core/accounts/modification-rules' }
    ]
  },
  {
    title: 'Ethereum: sequential execution',
    links: [
      { label: 'ethereum.org — Ethereum Virtual Machine (EVM)', href: 'https://ethereum.org/en/developers/docs/evm/' },
      { label: 'EIP-2930 — Optional access lists', href: 'https://eips.ethereum.org/EIPS/eip-2930' }
    ]
  },
  {
    title: 'Other parallelism models',
    links: [
      {
        label: 'Block-STM: Scaling Blockchain Execution by Turning Ordering Curse to a Performance Blessing (arXiv, 2022)',
        href: 'https://arxiv.org/abs/2203.06871'
      },
      { label: 'Sui docs — Object Model', href: 'https://docs.sui.io/concepts/object-model' },
      { label: 'Monad docs — Parallel Execution', href: 'https://docs.monad.xyz/monad-arch/execution/parallel-execution' }
    ]
  }
];

function MissingDeclBox({ out, tr }: { out: Outcome | undefined; tr: (s: string) => string }) {
  if (!out || out.status !== 'failed' || out.reason !== 'MissingAccountDeclaration') return null;
  const missing = out.missing ?? [];
  if (missing.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-red-800 bg-red-950/20 p-3">
      <div className="text-xs font-semibold text-red-200">{tr('Missing declarations')}</div>
      <ul className="mt-2 text-xs text-red-100 list-disc pl-5 space-y-1">
        {missing.map((m) => (
          <li key={`${m.account}-${m.needed}`}
            className="font-mono"
          >
            {m.account}
            {m.needed === 'w' ? ':w' : ''}
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[11px] text-red-200/80">
        {tr(
          'Declared accounts are Solana’s account locks (READ/WRITE). A transaction that uses an account it didn’t declare, or writes one it declared read-only, fails at runtime.'
        )}
      </div>
      <div className="mt-1 text-[11px] text-red-200/80">
        {tr('A failed transaction is not rejected: it is still included in the block and still pays its fee. Only its state changes are discarded.')}
      </div>
    </div>
  );
}


type Outcome =
  | { status: 'pending' }
  | { status: 'ok'; summary: string }
  | {
      status: 'failed';
      reason: 'MissingAccountDeclaration';
      summary: string;
      missing?: Array<{ account: AccountId; needed: AccessMode | 'present' }>;
    };


type LogEntry = {
  at: number;
  scope: 'SYSTEM' | 'EVM' | 'SOLANA';
  kind: 'info' | 'success' | 'error' | 'phase';
  message: string;
};


function OutcomePill({ out, tr }: { out: Outcome | undefined; tr: (s: string) => string }) {
  if (!out || out.status === 'pending') return <span className="text-xs text-slate-400">{tr('pending')}</span>;
  if (out.status === 'ok') return <span className="text-xs text-emerald-300">{tr('ok')}</span>;
  return <span className="text-xs text-red-300">{tr('failed')}</span>;
}

export default function EvmVsSvmDemo() {
  const { tr } = useDemoI18n('evm-vs-svm');

  const concepts = useMemo(
    () => [
      {
        term: tr('EVM (sequential execution)'),
        def: tr(
          'Ethereum executes transactions one after another, in block order. Transactions don’t declare the state they touch, so a node can’t tell upfront which ones conflict. Optional access lists (EIP-2930) exist, but they aren’t enforced: a transaction can still touch state outside its list.'
        )
      },
      {
        term: tr('Solana-style (parallel scheduling)'),
        def: tr(
          'Every Solana transaction lists the accounts it reads and writes. The runtime (Sealevel) takes read/write locks on them and runs transactions whose locks don’t conflict at the same time.'
        )
      },
      {
        term: tr('Account declarations'),
        def: tr('A tx declares which accounts it will read/write. Missing declarations can cause failure.')
      },
      {
        term: tr('Conflicts'),
        def: tr('Two txs conflict if they touch the same account and at least one writes.')
      },
      {
        term: tr('Account'),
        def: tr('A piece of on-chain data with its own address: a user’s balance, a liquidity pool, an oracle price. On Solana, the unit that gets locked.')
      },
      {
        term: tr('State'),
        def: tr('The current content of all accounts. Executing a transaction reads some of it and changes some of it (its writes).')
      },
      {
        term: tr('Wave'),
        def: tr('In this demo, a group of transactions whose locks don’t conflict, run at the same time. A wave holds at most as many transactions as there are threads.')
      }
    ],
    [tr]
  );

  const [threads, setThreads] = useState(2);
  const [txs, setTxs] = useState<Tx[]>(() => defaultTxs());

  const evmTime = useMemo(() => sumCu(txs), [txs]);
  const schedule = useMemo(() => computeSchedule(txs, threads), [txs, threads]);
  const waves = schedule.waves;
  const svmTime = useMemo(() => waves.reduce((a, w) => a + w.time, 0), [waves]);
  const speedup = useMemo(() => (svmTime > 0 ? evmTime / svmTime : 1), [evmTime, svmTime]);

  const [evmOut, setEvmOut] = useState<Record<number, Outcome>>({});
  const [svmOut, setSvmOut] = useState<Record<number, Outcome>>({});

  const [evmIndex, setEvmIndex] = useState(0);
  const [svmWaveIndex, setSvmWaveIndex] = useState(0);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [guidedMode, setGuidedMode] = useState(true);
  const [guidedHighlight, setGuidedHighlight] = useState<null | { txId: number; account: AccountId }>(null);
  const [sectionHighlight, setSectionHighlight] = useState<null | 'waves' | 'timeline'>(null);

  const [showQuests, setShowQuests] = useState(true);
  const [questsBlink, setQuestsBlink] = useState(true);

  // Fold quests by default; blink the folded header for 10s.
  useEffect(() => {
    setShowQuests(true);
    setQuestsBlink(true);
    const t = window.setTimeout(() => setQuestsBlink(false), 10_000);
    return () => window.clearTimeout(t);
  }, []);

  const [questFlags, setQuestFlags] = usePersistedQuests('evm-vs-svm', () => ({
    loadedOrderingPreset: false,
    swappedOrder: false,
    viewedLocks: false,
    loadedDisjointPreset: false
  }));

  function markQuestFlag<K extends keyof typeof questFlags>(k: K) {
    setQuestFlags((prev) => ({ ...prev, [k]: true }));
  }

  const conflictList = useMemo(() => conflictPairs(txs), [txs]);

  const scheduleDebugByTxId = useMemo(() => {
    const m = new Map<number, ScheduleDebug>();
    for (const d of schedule.debug) m.set(d.txId, d);
    return m;
  }, [schedule.debug]);
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

  /** Rewinds one side only (the transaction list and the other side are untouched). */
  function resetEvm() {
    setEvmOut({});
    setEvmIndex(0);
    appendLog('EVM', 'info', tr('Reset EVM execution'));
  }

  function resetSvm() {
    setSvmOut({});
    setSvmWaveIndex(0);
    appendLog('SOLANA', 'info', tr('Reset Solana-style execution'));
  }

  /** Translated reason why a transaction could not join an earlier wave. */
  function attemptText(a: ScheduleAttempt): string {
    return a.kind === 'full'
      ? tr('Wave {{n}} was full (thread limit).', { n: a.wave + 1 })
      : tr('Wave {{n}}: conflicts with {{txs}} on {{accounts}}.', {
          n: a.wave + 1,
          txs: a.withTx.map((id) => `TX #${id}`).join(', '),
          accounts: a.accounts.join(', ')
        });
  }

  /** Plain-language explanation of where a transaction was scheduled and why (TODO C2). */
  function whyThisWave(tx: Tx): string {
    const dbg = scheduleDebugByTxId.get(tx.id);
    if (!dbg) return tr('No scheduling info');
    const wave = waves[dbg.placedWave];
    const parts: string[] = [];

    if (dbg.attempts.length > 0) {
      parts.push(attemptText(dbg.attempts[dbg.attempts.length - 1]));
    } else {
      const others = (wave?.txs ?? []).filter((t) => t.id !== tx.id);
      const list = others.map((t) => `TX #${t.id}`).join(', ');
      if (others.length === 0) {
        parts.push(tr('Runs alone in wave {{n}}.', { n: dbg.placedWave + 1 }));
      } else {
        const shared = Array.from(new Set(others.flatMap((o) => sharedReads(tx.declared, o.declared))));
        parts.push(
          shared.length > 0
            ? tr('Runs alongside {{txs}}: they only share read locks on {{accounts}} (read/read is fine).', {
                txs: list,
                accounts: shared.join(', ')
              })
            : tr('Runs alongside {{txs}}: no shared account is written.', { txs: list })
        );
      }
    }

    // Scheduled before a conflicting transaction that was listed earlier: the leader reordered them.
    const idx = txs.findIndex((t) => t.id === tx.id);
    const overtaken = txs
      .slice(0, idx)
      .filter(
        (e) =>
          (scheduleDebugByTxId.get(e.id)?.placedWave ?? 0) > dbg.placedWave &&
          conflictingAccounts(e.declared, tx.declared).length > 0
      );
    if (overtaken.length > 0) {
      parts.push(
        tr(
          'Note: it runs before {{txs}}, listed earlier, although they conflict. A Solana leader may reorder like this, so this transaction sees the state from before them.',
          { txs: overtaken.map((t) => `TX #${t.id}`).join(', ') }
        )
      );
    }
    return parts.join(' ');
  }

  /** "writes Alice, DexPool" or "read-only: no state change" (what a successful tx changes). */
  function stateChangeText(t: Tx): string {
    const w = writtenAccounts(t);
    return w.length > 0 ? `${tr('writes')} ${w.join(', ')}` : tr('read-only: no state change');
  }

  const quests = useMemo(() => {
    const fixedMissing = txs.every((t) => declaredCoversActual(t));
    const ranEvmToEnd = evmIndex >= txs.length;
    const ranSolanaToEnd = svmWaveIndex >= waves.length;

    // Concepts:
    // - Read/read can be parallel: if 2+ txs declare Oracle:r and no one writes Oracle in that wave.
    const oracleReadTxIds = txs.filter((t) => t.declared.Oracle === 'r').map((t) => t.id);
    const hasOracleReadParallel = waves.some((w) => {
      const inWave = w.txs.map((t) => t.id).filter((id) => oracleReadTxIds.includes(id));
      return inWave.length >= 2 && w.locks.Oracle === 'r';
    });

    // - Write blocks reads: if any tx declares Oracle:w, the lock should be W in the wave containing it.
    const hasOracleWrite = txs.some((t) => t.declared.Oracle === 'w');
    const oracleWriteCreatesWLock = !hasOracleWrite
      ? false
      : waves.some((w) => w.locks.Oracle === 'w' && w.txs.some((t) => t.declared.Oracle === 'w'));

    // - Thread limit: when disjoint preset is loaded and threads >= 3, we should fit in 1 wave.
    const threadLimitConcept = questFlags.loadedDisjointPreset && threads >= 3 && waves.length <= 1;

    // - Ordering: user loaded ordering preset AND swapped order at least once.
    const orderingExplored = questFlags.loadedOrderingPreset && questFlags.swappedOrder;

    // - Locks viewed: user scrolled to lock timeline.
    const locksViewed = questFlags.viewedLocks;

    return {
      fixedMissing,
      gotSpeedup: fixedMissing && speedup >= 1.2,
      ranBoth: ranEvmToEnd && ranSolanaToEnd,
      hasOracleReadParallel,
      oracleWriteCreatesWLock,
      threadLimitConcept,
      orderingExplored,
      locksViewed
    };
  }, [txs, evmIndex, svmWaveIndex, waves, speedup, threads, questFlags]);
  useReportQuestProgress('evm-vs-svm', Object.values(quests).filter(Boolean).length, 8);

  // Guided quests: the next unfinished quest, with a hint and the control to click (pulses on "Show me").
  const questSteps: Array<{ key: keyof typeof quests; text: string; hint: string; target: string }> = [
    {
      key: 'fixedMissing',
      text: tr('Fix TX #2 by declaring FeeVault as write'),
      hint: tr('Click Auto-fix on TX #2, or set FeeVault to write (W) in its declared accounts.'),
      target: 'autofix'
    },
    {
      key: 'ranBoth',
      text: tr('Run both EVM and Solana-style to completion'),
      hint: tr('Press Run all on both sides, then compare the two timelines below.'),
      target: 'run'
    },
    {
      key: 'locksViewed',
      text: tr('Open the lock timeline (Show locks)'),
      hint: tr('Open the lock timeline to see which accounts each wave locks.'),
      target: 'locks'
    },
    {
      key: 'gotSpeedup',
      text: tr('Reach speedup ≥ 1.2× (increase threads + reduce conflicts)'),
      hint: quests.fixedMissing ? tr('Move the threads slider up and watch the Solana-style timeline shrink.') : tr('Fix TX #2 first: a failing transaction does not count.'),
      target: quests.fixedMissing ? 'threads' : 'autofix'
    },
    {
      key: 'hasOracleReadParallel',
      text: tr('Make two Oracle READ txs run in the same wave (R/R)'),
      hint: tr('Load the Oracle-heavy preset: oracle reads share a read lock, so they fit in the same wave.'),
      target: 'preset-oracle'
    },
    {
      key: 'oracleWriteCreatesWLock',
      text: tr('Add an Oracle WRITE and observe it creates a W lock (blocks reads)'),
      hint: tr('Click Add tx: it adds an oracle write, which takes an exclusive (W) lock.'),
      target: 'add-tx'
    },
    {
      key: 'threadLimitConcept',
      text: tr('Increase threads so a disjoint preset fits in 1 wave'),
      hint: questFlags.loadedDisjointPreset ? tr('Now set threads to 3 or more.') : tr('Load the Mostly independent preset first.'),
      target: questFlags.loadedDisjointPreset ? 'threads' : 'preset-independent'
    },
    {
      key: 'orderingExplored',
      text: tr('Load ordering preset and swap TX1 ↔ TX2'),
      hint: questFlags.loadedOrderingPreset
        ? tr('Now swap TX1 ↔ TX2 in the “Ordering still matters” section.')
        : tr('Load the High conflict (same pool) preset first.'),
      target: questFlags.loadedOrderingPreset ? 'swap' : 'preset-ordering'
    }
  ];
  const questsDoneCount = questSteps.filter((q) => quests[q.key]).length;
  const nextQuest = questSteps.find((q) => !quests[q.key]) ?? null;
  const { point, clear: clearPulse, pulse } = usePulseTarget();

  // Point at the first quest's control on arrival (no scroll), and stop pulsing once a quest is done.
  useEffect(() => {
    if (nextQuest) point(nextQuest.target, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lastQuestKey = useRef(nextQuest?.key);
  useEffect(() => {
    if (lastQuestKey.current !== nextQuest?.key) clearPulse();
    lastQuestKey.current = nextQuest?.key;
  }, [nextQuest?.key, clearPulse]);

  function onTxListChanged(reason: string) {
    resetExecution(true);
    appendLog('SYSTEM', 'info', reason);
  }

  function cycleDeclared(txId: number, acct: AccountId) {
    setTxs((prev) => {
      const next = prev.map((t) => {
        if (t.id !== txId) return t;
        const cur = t.declared[acct];
        const nt: Tx = { ...t, declared: { ...t.declared } };

        // Cycle: none -> read -> write -> none
        if (!cur) nt.declared[acct] = 'r';
        else if (cur === 'r') nt.declared[acct] = 'w';
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

  function autoFixTx2() {
    setTxs((prev) =>
      prev.map((t) => {
        if (t.id !== 2) return t;
        return {
          ...t,
          declared: {
            ...t.declared,
            FeeVault: 'w'
          }
        };
      })
    );

    onTxListChanged(tr('Auto-fixed TX #2 (FeeVault:w)'));

    if (guidedMode) {
      setGuidedHighlight({ txId: 2, account: 'FeeVault' });
      // Clear highlight after a short time
      window.setTimeout(() => setGuidedHighlight(null), 1800);
      // Scroll to TX #2
      window.setTimeout(() => {
        const el = document.getElementById('tx-2');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }

  /** Opens the debug view (where the lock timeline lives) and scrolls to the timeline. */
  function showLocks() {
    setShowDebug(true);
    window.setTimeout(() => highlightSection('timeline'), 60);
  }

  function highlightSection(id: 'waves' | 'timeline') {
    if (id === 'timeline') markQuestFlag('viewedLocks');
    setSectionHighlight(id);
    window.setTimeout(() => setSectionHighlight(null), 1600);
    window.setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function loadPresetSolanaConflicts() {
    // A minimal hands-on preset:
    // - two swaps writing DexPool (conflict)
    // - two transfers writing different accounts (parallel)
    const preset: Tx[] = [
      {
        id: 1,
        label: 'Alice swap (writes DexPool)',
        computeUnits: 60,
        actual: { Alice: 'w', DexPool: 'w' },
        declared: { Alice: 'w', DexPool: 'w' }
      },
      {
        id: 2,
        label: 'Bob swap (writes DexPool)',
        computeUnits: 60,
        actual: { Bob: 'w', DexPool: 'w' },
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
        label: 'Alice transfer (writes Alice only)',
        computeUnits: 10,
        actual: { Alice: 'w' },
        declared: { Alice: 'w' }
      },
      {
        id: 5,
        label: 'Bob transfer (writes Bob only)',
        computeUnits: 10,
        actual: { Bob: 'w' },
        declared: { Bob: 'w' }
      }
    ];

    setTxs(preset);
    setNextId(6);
    onTxListChanged(tr('Loaded preset: Solana-style conflicts vs parallel transfers'));

    if (guidedMode) highlightSection('waves');
  }

  function loadPresetDisjointAccounts() {
    markQuestFlag('loadedDisjointPreset');

    const preset: Tx[] = [
      {
        id: 1,
        label: 'Alice transfer (writes Alice only)',
        computeUnits: 10,
        actual: { Alice: 'w' },
        declared: { Alice: 'w' }
      },
      {
        id: 2,
        label: 'Bob transfer (writes Bob only)',
        computeUnits: 10,
        actual: { Bob: 'w' },
        declared: { Bob: 'w' }
      },
      {
        id: 3,
        label: 'Oracle read',
        computeUnits: 10,
        actual: { Oracle: 'r' },
        declared: { Oracle: 'r' }
      }
    ];

    setTxs(preset);
    setNextId(4);
    onTxListChanged(tr('Loaded preset: disjoint accounts (max parallelism)'));

    if (guidedMode) highlightSection('waves');
  }

  function loadPresetMevOrdering() {
    markQuestFlag('loadedOrderingPreset');

    // Two swaps on the same pool + a read-only oracle tx.
    // Swaps conflict on DexPool:w, so ordering is relevant.
    const preset: Tx[] = [
      {
        id: 1,
        label: 'Alice swap (writes DexPool) — goes first',
        computeUnits: 60,
        actual: { Alice: 'w', DexPool: 'w' },
        declared: { Alice: 'w', DexPool: 'w' }
      },
      {
        id: 2,
        label: 'Bob swap (writes DexPool) — goes second',
        computeUnits: 60,
        actual: { Bob: 'w', DexPool: 'w' },
        declared: { Bob: 'w', DexPool: 'w' }
      },
      {
        id: 3,
        label: 'Oracle read (read-only)',
        computeUnits: 15,
        actual: { Oracle: 'r' },
        declared: { Oracle: 'r' }
      }
    ];

    setTxs(preset);
    setNextId(4);
    onTxListChanged(tr('Loaded preset: ordering matters (two swaps on same pool)'));

    if (guidedMode) highlightSection('waves');
  }

  function loadPresetOracleHeavy() {
    const preset = oracleHeavyTxs();
    setTxs(preset);
    setNextId(preset.length + 1);
    onTxListChanged(tr('Loaded preset: oracle-heavy (many reads, one write)'));
    if (guidedMode) highlightSection('waves');
  }

  function loadPresetDefault() {
    setTxs(defaultTxs());
    setNextId(Math.max(...defaultTxs().map((t) => t.id)) + 1);
    onTxListChanged(tr('Loaded preset: default (TX #2 has a missing declaration)'));
  }

  function swapOrderOfFirstTwoTxs() {
    markQuestFlag('swappedOrder');

    setTxs((prev) => {
      if (prev.length < 2) return prev;
      const next = [...prev];
      const a = next[0];
      const b = next[1];
      next[0] = { ...b, id: a.id, label: b.label.replace('goes second', 'goes first') };
      next[1] = { ...a, id: b.id, label: a.label.replace('goes first', 'goes second') };
      return next;
    });
    onTxListChanged(tr('Swapped the order of the first two transactions'));

    if (guidedMode) highlightSection('waves');
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
    appendLog('EVM', 'success', `${tr('OK')} — #${t.id}: ${tr(t.label)} (${stateChangeText(t)})`);

    setEvmIndex((v) => v + 1);
  }

  function runSvmStep() {
    if (svmWaveIndex >= waves.length) return;
    const wave = waves[svmWaveIndex];

    appendLog('SOLANA', 'phase', `${tr('Execute wave')} ${svmWaveIndex + 1}/${waves.length} (${wave.txs.length} txs)`);

    const patch: Record<number, Outcome> = {};
    for (const t of wave.txs) {
      if (!declaredCoversActual(t)) {
        const missing = missingDeclarations(t);
        const failed: Extract<Outcome, { status: 'failed' }> = {
          status: 'failed',
          reason: 'MissingAccountDeclaration',
          summary:
            missing.length > 0
              ? `${tr('Missing declarations')}: ${missing.map((m) => `${m.account}${m.needed === 'w' ? ':w' : ''}`).join(', ')}`
              : tr('Missing declaration for at least one actual account'),
          missing
        };
        patch[t.id] = failed;
        appendLog('SOLANA', 'error', `${tr('FAILED')} — #${t.id}: ${failed.summary}`);
      } else {
        patch[t.id] = { status: 'ok', summary: tr('Executed') };
        appendLog('SOLANA', 'success', `${tr('OK')} — #${t.id}: ${tr(t.label)} (${stateChangeText(t)})`);
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
    appendLog('SOLANA', 'phase', tr('Run all (Solana-style)'));

    const out: Record<number, Outcome> = {};
    for (const t of txs) {
      if (!declaredCoversActual(t)) {
        const missing = missingDeclarations(t);
        out[t.id] = {
          status: 'failed',
          reason: 'MissingAccountDeclaration',
          summary:
            missing.length > 0
              ? `${tr('Missing declarations')}: ${missing.map((m) => `${m.account}${m.needed === 'w' ? ':w' : ''}`).join(', ')}`
              : tr('Missing declaration for at least one actual account'),
          missing
        };
      } else {
        out[t.id] = { status: 'ok', summary: tr('Executed') };
      }
    }
    setSvmOut(out);
    setSvmWaveIndex(waves.length);

    const hasFail = Object.values(out).some((o) => o.status === 'failed');
    appendLog(
      'SOLANA',
      hasFail ? 'error' : 'success',
      hasFail ? tr('Solana-style completed with failures') : tr('Solana-style completed')
    );
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
              {tr('Sequential vs parallel execution: Ethereum (EVM) vs Solana (SVM)')}
            </h1>
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 max-w-3xl">
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                {tr('60-second tour')}
                <EduTooltip
                  widthClassName="w-[520px]"
                  text={tr('A quick guided path to understand the key idea: EVM executes sequentially, while Solana-style schedulers can run non-conflicting transactions in parallel using account locks (read/write).')}
                />
              </div>
              <ol className="mt-2 text-sm text-slate-300 space-y-2 list-decimal pl-5">
                <li>
                  {tr('Click')} <span className="font-semibold text-purple-200">{tr('Step')}</span> {tr('on EVM to execute transactions one-by-one.')}
                  <span className="ml-2">
                    <EduTooltip widthClassName="w-96" text={tr('Sequential execution: transactions run in a strict order, one after another.')} />
                  </span>
                </li>
                <li>
                  {tr('Click')} <span className="font-semibold text-emerald-200">{tr('Step wave')}</span> {tr('on Solana-style to execute a whole wave in parallel.')}
                  <span className="ml-2">
                    <EduTooltip widthClassName="w-96" text={tr('A wave is a batch of transactions that can run concurrently because their declared account locks do not conflict.')} />
                  </span>
                </li>
                <li>
                  {tr('Fix TX #2 by adding')} <span className="font-mono text-slate-200">FeeVault:w</span> {tr('in declared accounts, then run again.')}
                  <button
                    type="button"
                    onClick={autoFixTx2}
                    className={`ml-2 inline-flex items-center px-2 py-1 rounded border border-amber-700 bg-amber-900/20 text-amber-100 text-xs hover:bg-amber-900/30 ${pulse('autofix')}`}
                  >
                    {tr('Auto-fix')}
                  </button>
                </li>
                <li>
                  {tr('Increase threads to see speedup, but notice conflicts still force serialization.')}
                </li>
              </ol>
            </div>

            <p className="text-slate-300 mt-3 max-w-3xl">
              {tr(
                'Why does Ethereum execute transactions one by one while Solana runs many at once? Not because of the virtual machine: Ethereum transactions don’t say which state they will touch, so nodes can’t know in advance which ones conflict. Solana transactions declare their accounts upfront, so its runtime (Sealevel) can lock them and run non-conflicting transactions in parallel.'
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

            {/* Next quest (guided path through the 8 quests) */}
            <div className="mt-4 max-w-3xl rounded-xl border border-amber-800/60 bg-amber-950/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                  <ListTodo size={16} className="text-amber-300" />
                  {nextQuest
                    ? tr('Next quest ({{n}}/{{total}})', { n: questsDoneCount + 1, total: questSteps.length })
                    : tr('All quests complete!')}
                </div>
                <div className="flex gap-1" aria-hidden>
                  {questSteps.map((q) => (
                    <span key={q.key} className={`h-1.5 w-4 rounded-full ${quests[q.key] ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                  ))}
                </div>
              </div>
              {nextQuest ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100">{nextQuest.text}</div>
                    <div className="text-xs text-slate-400">{nextQuest.hint}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => point(nextQuest.target)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500"
                  >
                    {tr('Show me')}
                  </button>
                </div>
              ) : (
                <div className="mt-1 text-xs text-slate-300">
                  {tr('You’ve explored declarations, conflicts, threads and ordering. Try your own transactions with the presets and the declaration toggles.')}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={guidedMode}
                onChange={(e) => setGuidedMode(e.target.checked)}
              />
              {tr('Guided mode')}
              <EduTooltip
                widthClassName="w-80"
                text={tr('When enabled, helper actions (like Auto-fix) will highlight what changed and scroll you to the relevant transaction.')}
              />
            </label>

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
            {/* Was passing text/copyText, which LinkWithCopy doesn't accept: the link rendered empty. */}
            <LinkWithCopy label={tr('EVM vs Solana-style demo')} href={typeof window !== 'undefined' ? window.location.href : ''} />
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
              {tr('Solana-style can schedule up to N non-conflicting txs in parallel (per wave).')}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={4}
                value={threads}
                onChange={(e) => setThreads(parseInt(e.target.value, 10))}
                data-hint="threads"
                aria-label={tr('Parallel threads')}
                className={`w-full rounded ${pulse('threads')}`}
              />
              <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-sm">{threads}</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="px-2 py-1 rounded border border-purple-700 bg-purple-900/20 text-purple-100">
                {tr('EVM time')}: <span className="font-bold">{evmTime}</span> CU
              </span>
              <span className="px-2 py-1 rounded border border-emerald-700 bg-emerald-900/20 text-emerald-100">
                {tr('Solana-style time')}: <span className="font-bold">{svmTime}</span> CU
              </span>
              <EduTooltip
                widthClassName="w-80"
                text={tr(
                  'EVM time = the sum of every transaction’s compute units (CU), since they run one after another. Solana-style time = for each wave, the CU of its slowest transaction (the others finish earlier and wait), added up over all waves. More threads = more transactions per wave, as long as they don’t conflict.'
                )}
              />
              <span className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200">
                {tr('Speedup')}: <span className="font-bold text-emerald-300">{speedup.toFixed(2)}×</span>
              </span>
              <EduTooltip
                widthClassName="w-80"
                text={tr(
                  'Both sides use the same compute units (CU) per transaction, so the speedup only reflects scheduling: which transactions can run at the same time. Real chains also differ in VM speed, hardware and block limits.'
                )}
              />
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
                    data-hint="run"
                    className={`px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold ${pulse('run')}`}
                  >
                    {tr('Run all')}
                  </button>
                  <button
                    type="button"
                    onClick={resetEvm}
                    disabled={evmIndex === 0}
                    className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-sm"
                    aria-label={tr('Reset EVM execution')}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs font-semibold text-slate-400">{tr('Solana-style (waves)')}</div>
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
                    {tr('Step wave')}
                  </button>
                  <button
                    type="button"
                    onClick={runSvmAll}
                    className={`px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold ${pulse('run')}`}
                  >
                    {tr('Run all waves')}
                  </button>
                  <button
                    type="button"
                    onClick={resetSvm}
                    disabled={svmWaveIndex === 0}
                    className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-sm"
                    aria-label={tr('Reset Solana-style execution')}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quests (moved into header widget dropdown via portal) */}
          <LearningQuestsPortal>
            <div className="p-0">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3"
              onClick={() => {
                setShowQuests((v) => !v);
                setQuestsBlink(false);
              }}
              aria-expanded={showQuests}
            >
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <ListTodo size={18} className={questsBlink ? 'text-amber-300' : 'text-emerald-300'} />
                {tr('Learning quests')}
                <span className="text-xs text-slate-400">
                  ({Object.values(quests).filter(Boolean).length}/8)
                </span>
              </div>
              <div className={`text-slate-400 ${!showQuests && questsBlink ? 'motion-safe:animate-pulse' : ''}`}>
                {showQuests ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {showQuests ? (
              <div className="mt-3 space-y-4 text-sm">
                <div>
                  <div className="text-xs text-slate-400 mb-2">{tr('Basics')}</div>
                  <div className="space-y-2">
                    <QuestRow done={quests.fixedMissing} text={tr('Fix TX #2 by declaring FeeVault as write')} />
                    <QuestRow done={quests.ranBoth} text={tr('Run both EVM and Solana-style to completion')} />
                    <QuestRow done={quests.locksViewed} text={tr('Open the lock timeline (Show locks)')} />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-2">{tr('Parallelism & conflicts')}</div>
                  <div className="space-y-2">
                    <QuestRow done={quests.gotSpeedup} text={tr('Reach speedup ≥ 1.2× (increase threads + reduce conflicts)')} />
                    <QuestRow done={quests.hasOracleReadParallel} text={tr('Make two Oracle READ txs run in the same wave (R/R)')} />
                    <QuestRow done={quests.oracleWriteCreatesWLock} text={tr('Add an Oracle WRITE and observe it creates a W lock (blocks reads)')} />
                    <QuestRow done={quests.threadLimitConcept} text={tr('Increase threads so a disjoint preset fits in 1 wave')} />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-2">{tr('Ordering (MEV)')}</div>
                  <div className="space-y-2">
                    <QuestRow done={quests.orderingExplored} text={tr('Load ordering preset and swap TX1 ↔ TX2')} />
                  </div>
                </div>
              </div>
            ) : null}
            </div>
          </LearningQuestsPortal>

          {/* Waves */}
          <div
            id="waves"
            className={`rounded-xl border bg-slate-950/40 p-4 transition-shadow ${
              sectionHighlight === 'waves' ? 'border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]' : 'border-slate-800'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-200">{tr('Solana-style waves (from declarations)')}</div>
              <button
                type="button"
                onClick={showLocks}
                data-hint="locks"
                className={`text-xs px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 ${pulse('locks')}`}
              >
                {tr('Show lock timeline')}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {waves.map((w, idx) => (
                <div key={idx} className="rounded-lg border border-slate-700 bg-slate-900/30 p-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-200">
                      {tr('Wave')} {idx + 1}
                    </span>
                    <span className="text-xs text-slate-400">
                      {tr('time')}: {w.time} CU • {w.slotsUsed}/{w.slotsTotal} {tr('slots')}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-300">{w.txs.map((t) => `#${t.id}`).join(', ')}</div>

                  <div className="mt-2 text-[11px] text-slate-400">
                    {tr('Account locks')}: {
                      Object.keys(w.locks).length === 0
                        ? tr('none')
                        : (Object.entries(w.locks) as Array<[string, any]>).map(([a, m]) => `${a}:${m}`).join(', ')
                    }
                  </div>

                  {showDebug && (
                    <div className="mt-2 text-[11px] text-slate-500">
                      {tr('Why these txs are grouped')}: {tr('no declared conflicts inside this wave')}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {showDebug && (
              <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-3">
                <div className="font-semibold text-slate-300">{tr('Debug')}</div>
                <div>{tr('Conflicts are computed from declared read/write sets (account locks).')}</div>
                <div>{tr('A wave can contain up to N txs (threads) if none conflict.')}</div>
                <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-2 text-amber-100/90">
                  {tr(
                    'Simplification: here waves run in lockstep (a wave waits for its slowest transaction before the next one starts) and transactions are packed in list order. Real Solana schedulers start a transaction as soon as its account locks are free and prioritise by fee, so the speedup shown here is a lower bound.'
                  )}
                </div>

                {/* Conflict rules (matrix) */}
                <div>
                  <div className="font-semibold text-slate-300 mb-1">{tr('Conflict rules (same account)')}</div>
                  <table className="text-[11px] border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-slate-800 px-2 py-1" />
                        <th className="border border-slate-800 px-2 py-1 text-blue-200">{tr('READ')}</th>
                        <th className="border border-slate-800 px-2 py-1 text-emerald-200">{tr('WRITE')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['r', 'w'] as const).map((rowMode) => (
                        <tr key={rowMode}>
                          <th className={`border border-slate-800 px-2 py-1 ${rowMode === 'r' ? 'text-blue-200' : 'text-emerald-200'}`}>
                            {rowMode === 'r' ? tr('READ') : tr('WRITE')}
                          </th>
                          {(['r', 'w'] as const).map((colMode) => {
                            const clash = rowMode === 'w' || colMode === 'w';
                            return (
                              <td key={colMode} className={`border border-slate-800 px-2 py-1 ${clash ? 'text-red-300' : 'text-emerald-300'}`}>
                                {clash ? tr('conflict: one waits') : tr('no conflict: shared')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Computed conflicts between transactions */}
                <div>
                  <div className="font-semibold text-slate-300 mb-1">{tr('Computed conflicts (from declarations)')}</div>
                  {conflictList.length === 0 ? (
                    <div className="text-emerald-300">{tr('No two transactions conflict: everything can run in parallel.')}</div>
                  ) : (
                    <ul className="space-y-0.5 font-mono text-[11px] text-slate-300">
                      {conflictList.map((p) => (
                        <li key={`${p.a}-${p.b}`}>
                          TX #{p.a} ↔ TX #{p.b}: {p.accounts.map((c) => `${c.account} (${c.modes})`).join(', ')}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Account lock timeline (accounts × waves) */}
                <div className="mt-2">
                  <div id="timeline" className={`text-slate-300 font-semibold mb-2 ${sectionHighlight === 'timeline' ? 'text-amber-200' : ''}`}>{tr('Account lock timeline')}</div>
                  <div className="overflow-auto">
                    <div
                      className="grid"
                      style={{
                        gridTemplateColumns: `minmax(120px, 160px) repeat(${Math.max(1, waves.length)}, minmax(90px, 1fr))`
                      }}
                    >
                      <div className="text-[11px] text-slate-500 py-1 pr-2">{tr('Account')}</div>
                      {waves.map((_, wIdx) => (
                        <div key={wIdx} className="text-[11px] text-slate-500 py-1 px-2">
                          {tr('Wave')} {wIdx + 1}
                        </div>
                      ))}

                      {allAccounts.map((acct) => (
                        <React.Fragment key={acct}>
                          <div className="text-[11px] text-slate-300 py-1 pr-2 font-mono">{acct}</div>
                          {waves.map((w, wIdx) => {
                            const mode = w.locks[acct];
                            const src = w.lockSources[acct] ?? [];
                            const cls =
                              mode === 'w'
                                ? 'bg-emerald-900/30 border-emerald-700 text-emerald-100'
                                : mode === 'r'
                                  ? 'bg-blue-900/25 border-blue-700 text-blue-100'
                                  : 'bg-slate-950/30 border-slate-800 text-slate-500';

                            return (
                              <div key={`${acct}-${wIdx}`} className="py-1 px-2">
                                <div className={`rounded border px-2 py-1 text-[11px] ${cls}`}>
                                  {mode ? (mode === 'w' ? tr('W') : tr('R')) : tr('—')}
                                  {mode && src.length > 0 ? (
                                    <span className="ml-2 text-[10px] opacity-80">TX {src.join(', ')}</span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-500">
                    {tr('Legend')}: <span className="text-blue-200">R</span>={tr('read lock')}, <span className="text-emerald-200">W</span>={tr('write lock')}
                  </div>
                </div>
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
                <div className="text-slate-500">{tr('No logs yet. Run EVM or Solana-style to see what happens.')}</div>
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
                      <span className="text-slate-500">
                        {new Date(l.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>{' '}
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

        {/* Visual overview: timeline + access diagram */}
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-slate-200">{tr('Who runs when')}</div>
            <div className="mt-1 text-xs text-slate-400">
              {tr('The same transactions, run one by one (top) and in parallel waves (bottom). Step through either side to watch the bars fill in.')}
            </div>
            <div className="mt-3 sm:pl-6">
              <ExecutionTimeline
                txs={txs}
                waves={waves}
                threads={threads}
                evmDone={evmIndex}
                svmDoneWaves={svmWaveIndex}
                svmStatus={Object.fromEntries(
                  Object.entries(svmOut).map(([id, o]) => [id, o.status === 'failed' ? 'failed' : 'ok'])
                )}
                tr={tr}
              />
            </div>
          </div>
          <div className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-slate-200">{tr('Who touches what')}</div>
            <div className="mt-1 text-xs text-slate-400">
              {tr('Each arrow is an account a transaction reads or writes. Transactions that write the same account can’t run in the same wave.')}
            </div>
            <div className="mt-3">
              <AccessDiagram txs={txs} accounts={allAccounts} tr={tr} />
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
              data-hint="add-tx"
              className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 ${pulse('add-tx')}`}
            >
              <Plus size={14} />
              {tr('Add tx')}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">{tr('Presets')}:</span>
            {[
              { label: tr('Default (missing declaration)'), onClick: loadPresetDefault, hint: '' },
              { label: tr('Mostly independent'), onClick: loadPresetDisjointAccounts, hint: 'preset-independent' },
              { label: tr('High conflict (same pool)'), onClick: loadPresetMevOrdering, hint: 'preset-ordering' },
              { label: tr('Mixed: swaps + transfers'), onClick: loadPresetSolanaConflicts, hint: '' },
              { label: tr('Oracle-heavy (many reads, one write)'), onClick: loadPresetOracleHeavy, hint: 'preset-oracle' }
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={p.onClick}
                data-hint={p.hint || undefined}
                className={`px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 ${p.hint ? pulse(p.hint) : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {txs.map((tx, idx) => {
              const missing = !declaredCoversActual(tx);
              return (
                <div
                  id={`tx-${tx.id}`}
                  key={tx.id}
                  className={`rounded-xl border bg-slate-900/30 p-3 transition-shadow ${
                    guidedHighlight?.txId === tx.id ? 'border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]' : 'border-slate-700'
                  }`}
                >
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
                        {tr('EVM')}: <OutcomePill out={evmOut[tx.id]} tr={tr} /> &nbsp;|&nbsp; {tr('Solana-style')}: <OutcomePill out={svmOut[tx.id]} tr={tr} />
                      </div>

                      <MissingDeclBox out={svmOut[tx.id]} tr={tr} />

                      {tx.id === 2 && missing ? (
                        <div className="mt-2 text-xs text-amber-300">
                          {tr('Hint')}: {tr('Declare')} <span className="font-mono">FeeVault:w</span> {tr('to fix TX #2.')}
                      <button
                        type="button"
                        onClick={autoFixTx2}
                        data-hint="autofix"
                        className={`ml-2 inline-flex items-center px-2 py-1 rounded border border-amber-700 bg-amber-900/20 text-amber-100 text-[11px] hover:bg-amber-900/30 ${pulse('autofix')}`}
                      >
                        {tr('Auto-fix')}
                      </button>
                        </div>
                      ) : null}

                      <div className="mt-2 text-xs text-slate-300">
                        {tr('Actual access')}: {Object.entries(tx.actual).map(([a, m]) => `${a}:${m}`).join(', ')}
                      </div>

                      <div className="mt-2 text-xs text-slate-400">
                        {tr('Why this wave')}: {whyThisWave(tx)}
                      </div>

                      <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                        <span>
                          {tr('Scheduled wave')}: {((scheduleDebugByTxId.get(tx.id)?.placedWave ?? 0) + 1).toString()}
                        </span>
                        <EduTooltip
                          widthClassName="w-[520px]"
                          text={(() => {
                            const dbg = scheduleDebugByTxId.get(tx.id);
                            if (!dbg) return tr('No scheduling debug available.');
                            if (dbg.attempts.length === 0) return tr('Placed in the first wave.');
                            const lines = dbg.attempts.map(attemptText);
                            return `${tr('Why not earlier waves?')}\n` + lines.join('\n');
                          })()}
                        />
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
                        const clsBase =
                          cur === 'w'
                            ? 'border-emerald-700 bg-emerald-900/20 text-emerald-100'
                            : cur === 'r'
                              ? 'border-blue-700 bg-blue-900/20 text-blue-100'
                              : 'border-slate-700 bg-slate-950/30 text-slate-200';

                        const cls =
                          guidedHighlight?.txId === tx.id && guidedHighlight.account === a
                            ? `${clsBase} ring-2 ring-amber-400`
                            : clsBase;

                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => cycleDeclared(tx.id, a)}
                            className={`text-xs px-2 py-1 rounded border ${cls}`}
                            title={tr('Click to cycle (none → read → write → none)')}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      {tr('Click chips to cycle NONE → READ → WRITE → NONE. Conflicts happen when two txs touch the same account and at least one writes.')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Extension: MEV & ordering */}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold text-slate-200">{tr('Ordering still matters (MEV)')}</div>
          <div className="mt-2 text-sm text-slate-300">
            {tr('Parallel execution changes what can run at the same time, but it does not remove ordering. Block builders/validators still choose an order for transactions, and that order can create value (MEV).')}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="font-semibold text-slate-200">{tr('Example: two swaps on the same pool')}</div>
              <div className="mt-2 text-sm text-slate-300">
                {tr('If two swaps both write the same pool state (DexPool:w), they conflict and must be serialized. The one that goes first can change the price for the next one.')}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {tr('This is one reason ordering is valuable: different ordering can lead to different outcomes and opportunities (MEV).')}
              </div>
              <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">{tr('Hot accounts')}:</span>{' '}
                {tr(
                  'when many transactions write the same popular account (a busy pool, an oracle), they all serialise on it, whatever the number of threads. Solana also caps how much compute can write to a single account per block, so contention on hot accounts, not thread count, is often the real bottleneck.'
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={loadPresetMevOrdering}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold"
                >
                  {tr('Load ordering preset')}
                </button>
                <button
                  type="button"
                  onClick={swapOrderOfFirstTwoTxs}
                  data-hint="swap"
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs ${pulse('swap')}`}
                >
                  {tr('Swap order (TX1 ↔ TX2)')}
                </button>
                <button
                  type="button"
                  onClick={showLocks}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs"
                >
                  {tr('Show locks')}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="font-semibold text-slate-200">{tr('Example: independent txs can be parallel')}</div>
              <div className="mt-2 text-sm text-slate-300">
                {tr('If transactions touch disjoint state (no shared write locks), they can run in the same wave. But a final block still commits an order for replay and determinism.')}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {tr('Takeaway: parallelism increases throughput when possible; MEV/ordering concerns remain for conflicting state.')}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={loadPresetDisjointAccounts}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold"
                >
                  {tr('Load parallel preset')}
                </button>
                <button
                  type="button"
                  onClick={() => highlightSection('waves')}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs"
                >
                  {tr('Show waves')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Extension: real-world constraints */}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold text-slate-200">{tr('Real-world constraints')}</div>
          <div className="mt-2 text-sm text-slate-300">
            {tr('This demo focuses on execution and conflicts, but real blockchains also have system constraints that shape performance and UX:')}
          </div>

          <ul className="mt-3 text-sm text-slate-300 list-disc pl-5 space-y-1">
            <li>
              <span className="font-semibold text-slate-200">{tr('Network propagation')}:</span> {tr('nodes see transactions at different times; mempools are not perfectly synchronized.')}
            </li>
            <li>
              <span className="font-semibold text-slate-200">{tr('Block producers / builders')}:</span> {tr('a proposer decides what to include and in what order (sometimes via builder markets).')}
            </li>
            <li>
              <span className="font-semibold text-slate-200">{tr('Fee markets')}:</span> {tr('fees influence inclusion and ordering (EIP-1559 base fee + tips, priority fees, etc.).')}
            </li>
            <li>
              <span className="font-semibold text-slate-200">{tr('Deterministic replay')}:</span> {tr('finalized blocks must be replayable by every node, so concurrency still needs a deterministic outcome.')}
            </li>
            <li>
              <span className="font-semibold text-slate-200">{tr('Hot accounts')}:</span> {tr('popular accounts (pools, oracles) serialise every transaction that writes them; Solana limits compute per writable account per block.')}
            </li>
          </ul>

          <div className="mt-3 text-[11px] text-slate-500">
            {tr('Takeaway: parallel scheduling is one lever. Real-world performance depends on networking, fee markets, and block production rules too.')}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadPresetMevOrdering}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold"
            >
              {tr('Load high-conflict mempool')}
            </button>
            <button
              type="button"
              onClick={loadPresetDisjointAccounts}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold"
            >
              {tr('Load disjoint mempool')}
            </button>
            <button
              type="button"
              onClick={() => highlightSection('waves')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs"
            >
              {tr('Show waves')}
            </button>
            <button
              type="button"
              onClick={showLocks}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs"
            >
              {tr('Show locks')}
            </button>
          </div>
        </div>

        {/* Extension: parallelism models */}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold text-slate-200">{tr('Parallelism models (beyond this demo)')}</div>
          <div className="mt-2 text-sm text-slate-300">
            {tr('Different ecosystems unlock parallel execution in different ways. Three common models:')}
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="font-semibold text-slate-200">{tr('Solana-style: account locks')}</div>
              <ul className="mt-2 text-sm text-slate-300 list-disc pl-5 space-y-1">
                <li>{tr('A transaction declares which accounts it will read/write.')}</li>
                <li>{tr('The runtime takes read/write locks; conflicts (same account + a write) must be serialized.')}</li>
                <li>{tr('Great for parallelism when transactions touch disjoint sets of accounts.')}</li>
              </ul>

              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs font-semibold text-slate-300">{tr('Concrete example')}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {tr('Two swaps that both write the same pool account (DexPool:w) conflict, so they cannot run in the same wave. But two transfers that write different user accounts can run in parallel.')}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadPresetSolanaConflicts}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold"
                  >
                    {tr('Load hands-on preset')}
                  </button>
                  <button
                    type="button"
                    onClick={loadPresetDisjointAccounts}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold"
                  >
                    {tr('Load disjoint accounts preset')}
                  </button>
                  <button
                    type="button"
                    onClick={showLocks}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs"
                  >
                    {tr('Show locks')}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="font-semibold text-slate-200">{tr('Sui-style: declared objects')}</div>
              <ul className="mt-2 text-sm text-slate-300 list-disc pl-5 space-y-1">
                <li>{tr('State is a set of objects, and each transaction lists the objects it uses as inputs.')}</li>
                <li>{tr('Like Solana, conflicts are known before execution, but at the level of individual objects rather than accounts.')}</li>
                <li>{tr('Transactions that only use objects owned by their sender don’t conflict with anyone else; shared objects (like a pool) still have to be ordered.')}</li>
              </ul>

              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs font-semibold text-slate-300">{tr('Concrete example')}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {tr('If TX A spends a coin object owned by Alice and TX B spends one owned by Bob, they run in parallel. Two swaps on the same shared pool object must be ordered.')}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadPresetDisjointAccounts}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold"
                  >
                    {tr('Load object-style analogue')}
                  </button>
                  <button
                    type="button"
                    onClick={showLocks}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs"
                  >
                    {tr('Show locks')}
                  </button>
                </div>

                <div className="mt-2 text-[11px] text-slate-500">
                  {tr('Analogy: this demo uses separate accounts to stand in for separate objects.')}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="font-semibold text-slate-200">{tr('Optimistic: Aptos (Block-STM) and parallel EVMs')}</div>
              <ul className="mt-2 text-sm text-slate-300 list-disc pl-5 space-y-1">
                <li>{tr('Transactions declare nothing. The runtime executes them in parallel anyway, recording what each one actually read and wrote.')}</li>
                <li>{tr('When a transaction read something an earlier one (in block order) changed, it is re-executed. The final result is identical to running the block sequentially.')}</li>
                <li>
                  {tr('This is how Aptos runs Move transactions (Block-STM), and how parallel EVM implementations such as Monad and Sei run unmodified Ethereum contracts in parallel.')}
                </li>
              </ul>

              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-xs font-semibold text-slate-300">{tr('Why it matters here')}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {tr('Sequential execution is a property of how Ethereum orders and validates transactions, not of the EVM itself. The trade-off: no declarations needed, but conflicting transactions waste work on re-execution.')}
                </div>
                <div className="mt-3">
                  <a
                    href="/demo/parallel-executor"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-blue-200"
                  >
                    {tr('See optimistic execution in the Parallel Transaction Executor demo →')}
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-500">
            {tr('This demo only simulates the declared-locks model; the other two are described for comparison.')}
          </div>
        </div>

        {/* Further Reading (links checked 2026-11-23) */}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">📚 {tr('Further Reading')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {FURTHER_READING.map((group) => (
              <div key={group.title}>
                <div className="mb-1 text-sm font-semibold text-slate-200">{tr(group.title)}</div>
                <div className="space-y-1.5">
                  {group.links.map((l) => (
                    <LinkWithCopy key={l.href} href={l.href} label={l.label} />
                  ))}
                </div>
              </div>
            ))}
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
