// Hashes, Merkle Trees & Signatures: the cryptography entry point of the Basics path.
// Spec: specification/hashes-merkle-signatures-spec.md
//
// Six steps share one stepper. Every step stays mounted (hidden when inactive) so the learner's
// edits, keys and signatures survive switching steps. All crypto runs in the browser:
// SHA-256 is synchronous (./hashes_merkle/sha256.ts) so the tree updates on every keystroke;
// signatures use Web Crypto ECDSA P-256.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  GitMerge,
  Globe,
  Hammer,
  HelpCircle,
  KeyRound,
  Layers,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Route,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  StepForward
} from 'lucide-react';
import EduTooltip from '../../ui/EduTooltip';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { define } from '../glossary';
import { NextQuestCard, QuestList, useDemoQuests } from '../quests/DemoQuests';
import { useDemoI18n } from '../useDemoI18n';
import BlockLab from './hashes_merkle/BlockLab';
import HashPlayground from './hashes_merkle/HashPlayground';
import MerkleTreeView, { type NodeState } from './hashes_merkle/MerkleTreeView';
import SignLab from './hashes_merkle/SignLab';
import TxTable from './hashes_merkle/TxTable';
import {
  buildTree,
  changedIds,
  getProof,
  hashLeaf,
  leafData,
  nodeId,
  pathIds,
  proofLength,
  serializeTx,
  verifyProof,
  type MerkleMode,
  type Tx
} from './hashes_merkle/merkle';
import { flipHexChar } from './hashes_merkle/signatures';
import { RootCompare, short, usePrefersReducedMotion } from './hashes_merkle/ui';

const ORIGINAL_TXS: Tx[] = [
  { id: 'h1', from: 'Alice', to: 'Bob', amount: '5' },
  { id: 'h2', from: 'Bob', to: 'Carol', amount: '2' },
  { id: 'h3', from: 'Carol', to: 'Dave', amount: '7' },
  { id: 'h4', from: 'Dave', to: 'Eve', amount: '1' },
  { id: 'h5', from: 'Eve', to: 'Frank', amount: '3' },
  { id: 'h6', from: 'Frank', to: 'Alice', amount: '4' },
  { id: 'h7', from: 'Alice', to: 'Carol', amount: '6' },
  { id: 'h8', from: 'Bob', to: 'Dave', amount: '8' }
];
const PEOPLE = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];
const MAX_TXS = 16;
const BUILD_MS = 900;

/** Which step holds each quest target (so "Show me" can open it). */
const TARGET_STEP: Record<string, number> = {
  'tx-table': 0,
  'preset-hello': 1,
  'build-step': 2,
  'proof-next': 3,
  'tamper-proof': 3,
  'gen-keys': 4,
  'break-sig': 4,
  forge: 5
};

const FURTHER_READING = [
  { label: 'Bitcoin whitepaper, sections 7–8: Merkle trees and simplified payment verification', href: 'https://bitcoin.org/bitcoin.pdf' },
  { label: 'NIST FIPS 180-4: the SHA-256 standard', href: 'https://csrc.nist.gov/pubs/fips/180-4/upd1/final' },
  { label: 'RFC 6962: Certificate Transparency (the “safe” Merkle tree)', href: 'https://www.rfc-editor.org/rfc/rfc6962' },
  { label: 'CVE-2012-2459: Bitcoin’s duplicate-transaction Merkle weakness', href: 'https://nvd.nist.gov/vuln/detail/CVE-2012-2459' },
  { label: 'ethereum.org: Merkle Patricia Trie', href: 'https://ethereum.org/en/developers/docs/data-structures-and-encoding/patricia-merkle-trie/' },
  { label: 'MDN: SubtleCrypto.sign() (the browser API this demo uses)', href: 'https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign' }
];

let nextId = 100;
const newTx = (): Tx => {
  const from = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
  let to = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
  if (to === from) to = PEOPLE[(PEOPLE.indexOf(from) + 1) % PEOPLE.length];
  return { id: `n${nextId++}`, from, to, amount: String(1 + Math.floor(Math.random() * 9)) };
};

export default function HashesMerkleSignaturesDemo() {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const reducedMotion = usePrefersReducedMotion();
  const animate = !reducedMotion;
  const [step, setStep] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [mode, setMode] = useState<MerkleMode>('simple');
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((text: string) => setAnnouncement(text), []);
  const [stepDone, setStepDone] = useState<boolean[]>([false, false, false, false, false, false]);
  const finishStep = useCallback((i: number) => setStepDone((d) => (d[i] ? d : d.map((v, j) => (j === i ? true : v)))), []);

  // ---- Step 0: the hook -------------------------------------------------------------------
  const [hookTxs, setHookTxs] = useState<Tx[]>(ORIGINAL_TXS);
  const [tampered, setTampered] = useState(false);
  const [fixedByHand, setFixedByHand] = useState(false);
  const originalTree = useMemo(() => buildTree(ORIGINAL_TXS, mode), [mode]);
  const hookTree = useMemo(() => buildTree(hookTxs, mode), [hookTxs, mode]);
  const hookChanged = useMemo(() => changedIds(originalTree, hookTree), [originalTree, hookTree]);
  const hookLeaves = useMemo(() => hookTxs.map((t) => hashLeaf(leafData(t), mode)), [hookTxs, mode]);
  const hookChangedTx = new Set(hookTxs.filter((t, i) => originalTree.levels[0][i].hash !== hookLeaves[i]).map((t) => t.id));
  const totalNodes = hookTree.levels.flat().length;

  const editHook = (i: number, field: 'from' | 'to' | 'amount', value: string) => {
    const next = hookTxs.map((t, j) => (j === i ? { ...t, [field]: value } : t));
    setHookTxs(next);
    const changed = changedIds(originalTree, buildTree(next, mode)).size;
    if (changed > 0) {
      setTampered(true);
      setFixedByHand(false);
      finishStep(0);
      announce(tr('Root changed. {{n}} of {{total}} nodes changed.', { n: changed, total: totalNodes }));
    } else {
      if (tampered) setFixedByHand(true);
      announce(tr('The root matches the original again.'));
    }
  };
  const resetHook = () => {
    setHookTxs(ORIGINAL_TXS);
    setTampered(false);
    setFixedByHand(false);
    announce(tr('Block restored. The root matches the original.'));
  };

  // ---- Step 2: build --------------------------------------------------------------------------
  const [buildTxs, setBuildTxs] = useState<Tx[]>(() => ORIGINAL_TXS.map((t) => ({ ...t, id: `b${t.id}` })));
  const buildTreeState = useMemo(() => buildTree(buildTxs, mode), [buildTxs, mode]);
  const depth = buildTreeState.levels.length;
  const [revealed, setRevealed] = useState(1);
  const shownLevels = Math.min(revealed, depth);
  const [autoBuild, setAutoBuild] = useState(false);

  const stepBuild = useCallback(() => {
    setRevealed((r) => Math.min(r + 1, depth));
  }, [depth]);

  useEffect(() => {
    if (!autoBuild) return;
    if (shownLevels >= depth) {
      setAutoBuild(false);
      return;
    }
    const t = window.setTimeout(stepBuild, BUILD_MS);
    return () => window.clearTimeout(t);
  }, [autoBuild, shownLevels, depth, stepBuild]);

  const [builtByHand, setBuiltByHand] = useState(false);
  useEffect(() => {
    if (builtByHand && shownLevels >= depth) {
      finishStep(2);
      announce(tr('The tree is complete: one root for {{n}} transactions.', { n: buildTxs.length }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builtByHand, shownLevels, depth]);

  const buildCallout = (() => {
    const n = buildTxs.length;
    if (shownLevels <= 1)
      return n === 1
        ? tr('With a single transaction, its leaf hash is already the root.')
        : tr('Level 0: each transaction is hashed on its own (the leaves). Next, neighbours are paired and hashed together.');
    const level = shownLevels - 1;
    const row = buildTreeState.levels[level];
    const pairs = row
      .slice(0, 4)
      .map((nd) =>
        nd.promoted
          ? tr('{{id}} = {{child}} (moved up)', { id: nd.id, child: nodeId(level - 1, nd.children[0]) })
          : nd.duplicated
            ? tr('{{id}} = hash({{child}} ‖ {{child}}) (copied)', { id: nd.id, child: nodeId(level - 1, nd.children[0]) })
            : `${nd.id} = hash(${nodeId(level - 1, nd.children[0])} ‖ ${nodeId(level - 1, nd.children[1])})`
      )
      .join(' · ');
    return (
      (shownLevels >= depth ? tr('One node left: the root. It commits to all {{n}} transactions.', { n }) + ' ' : '') +
      pairs +
      (row.length > 4 ? ' · …' : '')
    );
  })();

  const addBuildTx = () => setBuildTxs((t) => (t.length >= MAX_TXS ? t : [...t, newTx()]));
  const removeBuildTx = (i: number) => setBuildTxs((t) => (t.length <= 1 ? t : t.filter((_, j) => j !== i)));
  const editBuild = (i: number, field: 'from' | 'to' | 'amount', value: string) =>
    setBuildTxs((t) => t.map((x, j) => (j === i ? { ...x, [field]: value } : x)));

  // ---- Step 3: proof --------------------------------------------------------------------------
  const [selected, setSelected] = useState(2);
  const sel = Math.min(selected, buildTxs.length - 1);
  const [proofTampered, setProofTampered] = useState(false);
  const [vStep, setVStep] = useState(0);
  const proof = useMemo(() => getProof(buildTreeState, sel), [buildTreeState, sel]);
  const proofSteps = useMemo(
    () => (proofTampered && proof.steps.length ? proof.steps.map((s, j) => (j === 0 ? { ...s, siblingHash: flipHexChar(s.siblingHash, 3) } : s)) : proof.steps),
    [proof, proofTampered]
  );
  const trace = useMemo(() => verifyProof(proof.leafHash, proofSteps, buildTreeState.root, mode), [proof, proofSteps, buildTreeState.root, mode]);
  const finalStep = proofSteps.length + 1;
  const verificationDone = vStep >= finalStep;

  // A new leaf or a new tree restarts the checks. (Tampering is handled by its button: it re-runs
  // the whole verification at once so the failure is visible immediately.)
  useEffect(() => {
    setVStep(0);
  }, [sel, buildTxs, mode]);

  useEffect(() => {
    if (!verificationDone) return;
    announce(trace.ok ? tr('Proof verified: the transaction is in the block.') : tr('Proof failed: the recomputed root doesn’t match.'));
    if (trace.ok && !proofTampered) {
      q.markDone('proof');
      finishStep(3);
    }
    if (!trace.ok && proofTampered) q.markDone('tamper-proof');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationDone, proofTampered]);

  const proofStates = useMemo(() => {
    const m = new Map<string, NodeState>();
    const path = pathIds(buildTreeState, sel);
    path.forEach((id) => m.set(id, 'proof'));
    proofSteps.forEach((s) => {
      if (!s.duplicated) m.set(s.siblingId, 'sibling');
    });
    // Colour the path as the learner steps through: green where the recomputed hash matches the
    // tree, red where it doesn't (a tampered proof). A level is reached once the checks below it are done.
    if (vStep >= 1) m.set(path[0], 'verified');
    let current = proof.leafHash;
    for (let level = 1; level < path.length; level++) {
      const needed = proofSteps.filter((s) => s.level < level).length;
      if (vStep < Math.max(1, needed)) break;
      const stepIdx = proofSteps.findIndex((s) => s.level === level - 1);
      if (stepIdx >= 0) current = trace.steps[stepIdx].result;
      const actual = buildTreeState.levels[level][sel >> level].hash;
      m.set(path[level], current === actual ? 'verified' : 'changed');
    }
    return m;
  }, [buildTreeState, sel, proofSteps, proof.leafHash, vStep, trace]);

  // ---- Quests --------------------------------------------------------------------------------
  const q = useDemoQuests(
    'hashes-merkle-signatures',
    [
      {
        id: 'tamper',
        text: tr('Change a transaction and watch the root change'),
        tip: tr('In step 0, edit any From, To or Amount cell. Only that leaf, the nodes above it and the root turn red.'),
        done: hookChanged.size > 0,
        target: 'tx-table'
      },
      {
        id: 'avalanche',
        text: tr('Compare the fingerprints of “hello” and “Hello”'),
        tip: tr('In step 1, click “hello” vs “Hello”: one capital letter flips about half of the 256 bits.'),
        target: 'preset-hello'
      },
      {
        id: 'build',
        text: tr('Build a Merkle tree level by level up to the root'),
        tip: tr('In step 2, click “Build next level” (or Auto-build) until only the root is left.'),
        target: 'build-step'
      },
      {
        id: 'proof',
        text: tr('Verify a Merkle proof step by step'),
        tip: tr('In step 3, pick a transaction, then click “Next check” until the recomputed root is compared with the real one.'),
        target: 'proof-next'
      },
      {
        id: 'tamper-proof',
        text: tr('Tamper with a proof and watch it fail'),
        tip: tr('In step 3, click “Tamper with a sibling hash”: the proof is checked again with the altered hash, and the recomputed root no longer matches.'),
        target: 'tamper-proof'
      },
      {
        id: 'sign',
        text: tr('Sign a message and verify the signature'),
        tip: tr('In step 4, generate a key pair, sign the message, then click Verify.'),
        target: 'gen-keys'
      },
      {
        id: 'break-sig',
        text: tr('Make a signature check fail'),
        tip: tr('In step 4, after signing, use one of the “Try to break it” buttons: change the message, the key or the signature.'),
        target: 'break-sig'
      },
      {
        id: 'forge',
        text: tr('Forge a payment in a signed block'),
        tip: tr('In step 5, change Bob’s payment and try re-signing it: the signature check and the block header both catch it.'),
        target: 'forge'
      }
    ],
    { onPoint: (target) => TARGET_STEP[target] !== undefined && setStep(TARGET_STEP[target]) }
  );

  const markDone = q.markDone;
  const onAvalanche = useCallback(() => {
    markDone('avalanche');
    finishStep(1);
  }, [markDone, finishStep]);
  const onVerified = useCallback(() => {
    markDone('sign');
    finishStep(4);
  }, [markDone, finishStep]);
  const onFailureShown = useCallback(() => markDone('break-sig'), [markDone]);
  const onForged = useCallback(() => {
    markDone('forge');
    finishStep(5);
  }, [markDone, finishStep]);

  useEffect(() => {
    if (builtByHand && shownLevels >= depth) markDone('build');
  }, [builtByHand, shownLevels, depth, markDone]);

  // ---- Steps ----------------------------------------------------------------------------------
  const STEPS = [
    { title: tr('Tamper with a block'), icon: ShieldAlert, goal: tr('Change anything in this block and see what happens.') },
    { title: tr('Hash playground'), icon: Fingerprint, goal: tr('Type anything and watch its fingerprint. Then compare two almost identical inputs.') },
    { title: tr('Build a Merkle tree'), icon: GitMerge, goal: tr('Hashes are paired and hashed again, level by level, until a single root remains.') },
    { title: tr('Prove membership'), icon: Search, goal: tr('Prove that one transaction is in the block with just a few hashes.') },
    { title: tr('Sign it'), icon: KeyRound, goal: tr('Only the holder of the private key can sign; anyone can verify.') },
    { title: tr('Put it together'), icon: Layers, goal: tr('Signatures protect each transaction; the root in the block header protects the whole list.') }
  ];

  const goTo = (i: number) => {
    setStep(i);
    if (typeof document !== 'undefined') document.getElementById('hm-step-top')?.scrollIntoView({ behavior: animate ? 'smooth' : 'auto', block: 'start' });
  };

  const proofCount = proofLength(buildTxs.length);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 text-slate-100 md:p-6">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <QuestList q={q} />

      {/* Title + one sentence: no jargon before the hook */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{tr('Hashes, Merkle Trees & Signatures')}</h1>
          <p className="mt-1 text-sm text-slate-300">{tr('Three small tools make a blockchain tamper-evident. Learn them by breaking things.')}</p>
        </div>
        <button
          type="button"
          onClick={() => setAdvanced((a) => !a)}
          aria-pressed={advanced}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs ${
            advanced ? 'border-purple-500 bg-purple-500/20 text-purple-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <SlidersHorizontal size={14} />
          {advanced ? tr('Advanced: on') : tr('Advanced')}
        </button>
      </header>

      {advanced ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-purple-800/60 bg-purple-950/20 p-3 text-xs">
          <span className="font-semibold text-purple-200">{tr('Tree rule')}</span>
          {(['simple', 'safe'] as MerkleMode[]).map((m) => (
            <label key={m} className="inline-flex items-center gap-1.5">
              <input type="radio" name="hm-mode" checked={mode === m} onChange={() => setMode(m)} />
              {m === 'simple' ? tr('Simple (Bitcoin-style: duplicate the odd node)') : tr('Safe (RFC 6962: prefixes, promote the odd node)')}
            </label>
          ))}
          <span className="text-slate-400">{tr('See step 2 for why it matters.')}</span>
        </div>
      ) : null}

      {/* Stepper */}
      <nav id="hm-step-top" aria-label={tr('Steps')} className="scroll-mt-20">
        <ol className="flex gap-2 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            return (
              <li key={i} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={active ? 'step' : undefined}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold ${
                    active ? 'border-blue-500 bg-blue-500/20 text-blue-100' : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="text-slate-400">{i}</span>
                  <Icon size={14} />
                  {s.title}
                  {stepDone[i] ? <CheckCircle2 size={14} className="text-emerald-400" aria-label={tr('done')} /> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <NextQuestCard q={q} />

      <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-blue-300">{tr('Step {{i}} of 5', { i: step })}</div>
        <div className="text-base font-semibold text-slate-100">{STEPS[step].goal}</div>
      </div>

      {/* ===== Step 0: hook ===== */}
      <section hidden={step !== 0} className="space-y-4">
        {/* Table and tree side by side on wide screens, so the ripple is visible while typing */}
        <div className="grid gap-4 xl:grid-cols-[25rem_minmax(0,1fr)] xl:items-start">
          <div data-hint="tx-table" className={`rounded-xl ${q.pulse('tx-table')}`}>
            <TxTable txs={hookTxs} leafHashes={hookLeaves} changed={hookChangedTx} onChange={editHook} />
          </div>
          <MerkleTreeView tree={hookTree} states={new Map([...hookChanged].map((id) => [id, 'changed' as NodeState]))} animate={animate} ariaLabel={tr('Merkle tree of the block')} />
        </div>
        <RootCompare original={originalTree.root} current={hookTree.root} originalLabel={tr('Original root (sealed in the block)')} currentLabel={tr('Root of the current data')} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={resetHook}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800"
          >
            <RotateCcw size={14} />
            {tr('Reset')}
          </button>
          {hookChanged.size > 0 ? (
            <span className="text-xs text-amber-200">{tr('Challenge: put the original value back by hand and make the roots match again.')}</span>
          ) : null}
          {fixedByHand && hookChanged.size === 0 ? (
            <span className="text-xs font-semibold text-emerald-300">{tr('✓ Fixed! Only the exact original data gives the original root.')}</span>
          ) : null}
        </div>
        {hookChanged.size > 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
            <p>
              {tr('{{n}} of {{total}} nodes changed: the leaf you edited, the nodes on its path and the root. The other {{same}} stayed exactly the same.', {
                n: hookChanged.size,
                total: totalNodes,
                same: totalNodes - hookChanged.size
              })}
            </p>
            <p className="mt-2">
              {tr('Each box is a fingerprint (a hash) of what is below it. The top one, the')}{' '}
              <EduTooltip term={tr('root')} text={define('Merkle Root')} />
              {tr(', is a tamper-evident seal over all eight transactions: change anything and the seal breaks.')}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            {tr('Tip: try changing an amount from 5 to 6, or a single letter of a name.')}
          </p>
        )}
      </section>

      {/* ===== Step 1: hash playground ===== */}
      <section hidden={step !== 1}>
        <HashPlayground onAvalanche={onAvalanche} announce={announce} pulse={q.pulse} />
      </section>

      {/* ===== Step 2: build ===== */}
      <section hidden={step !== 2} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-hint="build-step"
            onClick={() => {
              setBuiltByHand(true);
              stepBuild();
            }}
            disabled={shownLevels >= depth}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500 disabled:opacity-40 ${q.pulse('build-step')}`}
          >
            <StepForward size={14} />
            {tr('Build next level')}
          </button>
          <button
            type="button"
            onClick={() => {
              setBuiltByHand(true);
              if (shownLevels >= depth) setRevealed(1);
              setAutoBuild((a) => !a);
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800"
          >
            {autoBuild ? <Pause size={14} /> : <Play size={14} />}
            {autoBuild ? tr('Pause') : tr('Auto-build')}
          </button>
          <button
            type="button"
            onClick={() => {
              setAutoBuild(false);
              setRevealed(1);
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800"
          >
            <RotateCcw size={14} />
            {tr('Start over')}
          </button>
          <span className="text-xs text-slate-400">
            {tr('Level {{a}} of {{b}}', { a: shownLevels - 1, b: depth - 1 })} · {tr('{{n}} transactions', { n: buildTxs.length })}
          </span>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 font-mono text-xs text-amber-100" aria-live="polite">
          {buildCallout}
        </div>
        <MerkleTreeView tree={buildTreeState} revealedLevels={shownLevels} animate={animate} ariaLabel={tr('Merkle tree being built')} />
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-200">
              {tr('Transactions')} <EduTooltip term={tr('(leaves)')} text={define('Merkle Leaf')} />
            </span>
            <button
              type="button"
              onClick={addBuildTx}
              disabled={buildTxs.length >= MAX_TXS}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800 disabled:opacity-40"
            >
              <Plus size={14} />
              {tr('Add a transaction')}
            </button>
          </div>
          <TxTable
            txs={buildTxs}
            leafHashes={buildTreeState.levels[0].map((n) => n.hash)}
            onChange={editBuild}
            onRemove={removeBuildTx}
            canRemove={buildTxs.length > 1}
          />
          <p className="mt-2 text-xs text-slate-400">
            {tr('Try an odd number of transactions: the last node of a level has no partner.')}{' '}
            {mode === 'simple'
              ? tr('In Simple mode it is paired with a copy of itself (×2).')
              : tr('In Safe mode it moves up unchanged.')}
          </p>
        </div>
        {advanced ? <DuplicatesPanel txs={buildTxs} /> : null}
      </section>

      {/* ===== Step 3: proof ===== */}
      <section hidden={step !== 3} className="space-y-4">
        <p className="text-sm text-slate-300">
          {tr('A light wallet doesn’t download every transaction. To check that one is in the block, it asks for the')}{' '}
          <EduTooltip term={tr('sibling hashes')} text={define('Sibling Hash')} /> {tr('on the way up and recomputes the root itself.')}{' '}
          <EduTooltip text={define('Merkle Proof')} />
        </p>
        <div data-hint="proof-leaf">
          <MerkleTreeView
            tree={buildTreeState}
            states={proofStates}
            selectedLeaf={sel}
            onLeafClick={(i) => setSelected(i)}
            animate={false}
            ariaLabel={tr('Merkle tree: click a leaf to prove it')}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">
                {tr('Proving Tx {{i}}: {{tx}}', { i: sel + 1, tx: serializeTx(buildTxs[sel]) })}
              </span>
              <span className="text-xs text-slate-400">{tr('{{n}} hashes needed', { n: proofSteps.length })}</span>
            </div>
            <ol className="mt-3 space-y-1.5 font-mono text-xs">
              <li className="text-blue-200">
                {tr('Start: leaf hash = {{h}}…', { h: short(proof.leafHash, 12) })}
              </li>
              {proofSteps.map((s, j) =>
                j < vStep ? (
                  <li key={j} className="text-slate-200">
                    {s.side === 'left'
                      ? tr('Check {{k}}: hash(sibling {{s}}… ‖ current {{c}}…) = {{r}}…', {
                          k: j + 1,
                          s: short(s.siblingHash, 6),
                          c: short(trace.steps[j].right, 6),
                          r: short(trace.steps[j].result, 8)
                        })
                      : tr('Check {{k}}: hash(current {{c}}… ‖ sibling {{s}}…) = {{r}}…', {
                          k: j + 1,
                          s: short(s.siblingHash, 6),
                          c: short(trace.steps[j].left, 6),
                          r: short(trace.steps[j].result, 8)
                        })}
                    {s.duplicated ? <span className="text-amber-300"> {tr('(no partner: paired with itself)')}</span> : null}
                    {proofTampered && j === 0 ? <span className="text-red-300"> {tr('(tampered sibling)')}</span> : null}
                  </li>
                ) : (
                  <li key={j} className="text-slate-500">
                    {tr('Check {{k}}: sibling on the {{side}}', { k: j + 1, side: s.side === 'left' ? tr('left') : tr('right') })}
                  </li>
                )
              )}
              {verificationDone ? (
                <li className={`font-sans text-sm font-semibold ${trace.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                  {trace.ok
                    ? tr('✓ {{c}}… equals the block’s root: Tx {{i}} is in the block.', { c: short(trace.computedRoot, 8), i: sel + 1 })
                    : tr('✗ {{c}}… is not the block’s root ({{r}}…): the proof is rejected.', { c: short(trace.computedRoot, 8), r: short(buildTreeState.root, 8) })}
                </li>
              ) : null}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                data-hint="proof-next"
                onClick={() => setVStep((v) => Math.min(v + 1, finalStep))}
                disabled={verificationDone}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500 disabled:opacity-40 ${q.pulse('proof-next')}`}
              >
                <StepForward size={14} />
                {vStep >= proofSteps.length ? tr('Compare with the root') : tr('Next check')}
              </button>
              <button
                type="button"
                onClick={() => setVStep(finalStep)}
                disabled={verificationDone}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800 disabled:opacity-40"
              >
                {tr('Verify all')}
              </button>
              <button type="button" onClick={() => setVStep(0)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800">
                {tr('Restart')}
              </button>
              <button
                type="button"
                data-hint="tamper-proof"
                onClick={() => {
                  if (proofTampered) {
                    setProofTampered(false);
                    setVStep(0);
                  } else {
                    setProofTampered(true);
                    setVStep(finalStep); // check the altered proof right away
                  }
                }}
                disabled={proof.steps.length === 0}
                className={`rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40 ${
                  proofTampered ? 'border-emerald-700 text-emerald-200 hover:bg-emerald-950/40' : 'border-red-800 text-red-200 hover:bg-red-950/40'
                } ${q.pulse('tamper-proof')}`}
              >
                {proofTampered ? tr('Restore the proof') : tr('Tamper with a sibling hash')}
              </button>
            </div>
          </div>
          <ProofSizeChart current={buildTxs.length} currentHashes={proofCount} />
        </div>
      </section>

      {/* ===== Step 4: sign ===== */}
      <section hidden={step !== 4}>
        <SignLab onVerified={onVerified} onFailureShown={onFailureShown} announce={announce} pulse={q.pulse} />
        {advanced ? (
          <p className="mt-3 rounded-lg border border-purple-800/60 bg-purple-950/20 p-3 text-xs text-purple-100">
            {tr('This demo signs with ECDSA on the P-256 curve, built into every browser. Bitcoin and Ethereum use ECDSA on another curve, secp256k1 (and Bitcoin also uses Schnorr signatures). Same idea, different curve.')}
          </p>
        ) : null}
      </section>

      {/* ===== Step 5: together ===== */}
      <section hidden={step !== 5}>
        <BlockLab mode={mode} animate={animate} onForged={onForged} announce={announce} pulse={q.pulse} />
      </section>

      {/* Step navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goTo(Math.max(0, step - 1))}
          disabled={step === 0}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800 disabled:opacity-30"
        >
          ← {tr('Previous')}
        </button>
        {step < 5 ? (
          <button
            type="button"
            onClick={() => goTo(step + 1)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${
              stepDone[step] ? 'bg-emerald-600 hover:bg-emerald-500' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {stepDone[step] ? tr('Next: {{title}}', { title: STEPS[step + 1].title }) : tr('Skip to: {{title}}', { title: STEPS[step + 1].title })}
            <ChevronRight size={16} />
          </button>
        ) : (
          <a href="#hm-quiz" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">
            {tr('Check yourself')}
            <ChevronRight size={16} />
          </a>
        )}
      </div>

      <Quiz />
      <WhatsNext />
      <RealWorld />

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BookOpen size={18} className="text-blue-300" />
          {tr('📚 Further Reading')}
        </h2>
        <ul className="mt-2 space-y-1.5">
          {FURTHER_READING.map((l) => (
            <li key={l.href}>
              <LinkWithCopy href={l.href} label={tr(l.label)} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          {tr('This is an educational model: real systems add many more safeguards. Keys exist only in this page’s memory and disappear when you leave.')}
        </p>
      </section>
    </div>
  );
}

/** Advanced: why duplicating the odd node is risky (two different lists, one root). */
function DuplicatesPanel({ txs }: { txs: Tx[] }) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const m = txs.length % 2 === 1 ? txs.length : Math.max(1, txs.length - 1);
  const a = txs.slice(0, m);
  const b = [...a, { ...a[a.length - 1], id: 'dup' }];
  const rows = (['simple', 'safe'] as MerkleMode[]).map((mode) => {
    const ra = buildTree(a, mode).root;
    const rb = buildTree(b, mode).root;
    return { mode, ra, rb, same: ra === rb };
  });
  return (
    <div className="rounded-xl border border-purple-800/60 bg-purple-950/20 p-4 text-sm">
      <h3 className="flex items-center gap-2 font-semibold text-purple-100">
        <HelpCircle size={16} />
        {tr('Advanced: why duplicates are risky')}
      </h3>
      {m < 3 ? (
        <p className="mt-1 text-xs text-amber-200">{tr('Add at least three transactions to see this.')}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-300">
            {tr('List A has {{m}} transactions. List B is the same list with the last transaction repeated. They are different blocks, yet:', { m })}
          </p>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1">{tr('Rule')}</th>
                <th>{tr('Root of A')}</th>
                <th>{tr('Root of B')}</th>
                <th />
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <tr key={r.mode} className="border-t border-slate-800">
                  <td className="py-1 font-sans">{r.mode === 'simple' ? tr('Simple') : tr('Safe')}</td>
                  <td>{short(r.ra, 10)}…</td>
                  <td>{short(r.rb, 10)}…</td>
                  <td className={`font-sans ${r.same ? 'text-red-300' : 'text-emerald-300'}`}>{r.same ? tr('⚠ same root') : tr('✓ different')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
        <li>{tr('In Simple mode, copying the odd node makes both lists hash to the same root. Bitcoin had a real bug from this (CVE-2012-2459): nodes could be tricked into rejecting a valid block.')}</li>
        <li>{tr('Safe mode (RFC 6962) prefixes leaves with 0x00 and parents with 0x01, and moves the odd node up unchanged, so the two lists get different roots.')}</li>
        <li>{tr('Bitcoin also hashes twice (double SHA-256). Ethereum stores its state in a different structure, a Merkle Patricia trie (out of scope here).')}</li>
      </ul>
    </div>
  );
}

/** Proof size: log₂(n) hashes vs n. */
function ProofSizeChart({ current, currentHashes }: { current: number; currentHashes: number }) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const rows = [
    { n: current, label: tr('this tree ({{n}})', { n: current }) },
    { n: 1000, label: '1,000' },
    { n: 1_000_000, label: '1,000,000' },
    { n: 1_000_000_000, label: '1,000,000,000' }
  ];
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Route size={16} className="text-blue-300" />
        {tr('Proof size')} <EduTooltip text={define('Light Clients')} />
      </h3>
      <p className="mt-1 text-xs text-slate-400">{tr('Hashes needed to prove one transaction (32 bytes each):')}</p>
      <ul className="mt-2 space-y-2 text-xs">
        {rows.map((r) => {
          const h = r.n === current ? currentHashes : proofLength(r.n);
          return (
            <li key={r.label}>
              <div className="flex justify-between">
                <span className="text-slate-300">{r.label}</span>
                <span className="font-semibold text-blue-200">{tr('{{h}} hashes', { h })}</span>
              </div>
              <div className="mt-0.5 h-2 rounded bg-slate-800">
                <div className="h-2 rounded bg-blue-500" style={{ width: `${Math.max(3, (h / 30) * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-300">
        {tr('Doubling the number of transactions adds just one hash. That is why phone wallets (light clients) can check payments without downloading whole blocks.')}
      </p>
    </div>
  );
}

function Quiz() {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const QUESTIONS = [
    {
      q: tr('You change one transaction in a block of 1,000. What happens to the Merkle root?'),
      options: [tr('Nothing, only that leaf changes'), tr('It changes completely'), tr('Only its last character changes')],
      answer: 1,
      why: tr('The change moves up through every parent to the root, and each new hash looks completely different.')
    },
    {
      q: tr('What is the size of the SHA-256 hash of a 10 GB file?'),
      options: [tr('256 bits (64 hex characters)'), tr('About 10 GB'), tr('It depends on the file')],
      answer: 0,
      why: tr('Whatever the input, the fingerprint is always 256 bits.')
    },
    {
      q: tr('Can you recover a text from its hash?'),
      options: [tr('Yes, with the right key'), tr('Yes, by running the hash backwards'), tr('No, you can only guess inputs and compare')],
      answer: 2,
      why: tr('Hashing is not encryption: there is no key and no way back.')
    },
    {
      q: tr('About how many hashes prove that one transaction is in a block of 1,000,000?'),
      options: [tr('About 20'), tr('About 1,000'), tr('1,000,000')],
      answer: 0,
      why: tr('A proof needs one sibling per level: log₂(1,000,000) ≈ 20.')
    },
    {
      q: tr('What does a valid signature prove?'),
      options: [tr('The signer’s real name'), tr('That the holder of the private key approved exactly this message'), tr('That the message is true')],
      answer: 1,
      why: tr('It ties the message to a key, not to a person, and says nothing about whether the content is true.')
    }
  ];
  const [picked, setPicked] = useState<(number | null)[]>(QUESTIONS.map(() => null));
  const score = picked.filter((p, i) => p === QUESTIONS[i].answer).length;
  const answered = picked.filter((p) => p !== null).length;
  return (
    <section id="hm-quiz" className="scroll-mt-20 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <HelpCircle size={18} className="text-amber-300" />
          {tr('Check yourself')}
        </h2>
        {answered > 0 ? <span className="text-sm text-slate-300">{tr('Score: {{s}}/{{n}}', { s: score, n: QUESTIONS.length })}</span> : null}
      </div>
      <ol className="mt-3 space-y-4">
        {QUESTIONS.map((qq, i) => (
          <li key={i}>
            <div className="text-sm font-semibold text-slate-200">
              {i + 1}. {qq.q}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label={qq.q}>
              {qq.options.map((o, k) => {
                const chosen = picked[i] === k;
                const right = k === qq.answer;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => setPicked((p) => p.map((v, j) => (j === i ? k : v)))}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      chosen ? (right ? 'border-emerald-600 bg-emerald-950/50 text-emerald-100' : 'border-red-600 bg-red-950/50 text-red-100') : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {chosen ? (right ? '✓ ' : '✗ ') : ''}
                    {o}
                  </button>
                );
              })}
            </div>
            {picked[i] !== null ? (
              <p className={`mt-1 text-xs ${picked[i] === qq.answer ? 'text-emerald-300' : 'text-amber-200'}`} aria-live="polite">
                {picked[i] === qq.answer ? tr('Correct.') : tr('Not quite.')} {qq.why}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function WhatsNext() {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const cards = [
    { id: 'ethereum-blockchain', icon: Hammer, title: tr('Minimal Ethereum Blockchain'), text: tr('Chain blocks together with their hashes and mine them with proof of work.') },
    { id: 'wallet-tx-lifecycle', icon: KeyRound, title: tr('Wallet & transaction lifecycle'), text: tr('See what your wallet signs when you click “confirm”, and what happens next.') },
    { id: 'rollup-simulation', icon: Layers, title: tr('Layer 2 Rollup'), text: tr('Rollups post state roots to Ethereum: one hash that commits to thousands of balances.') },
    { id: 'state-channels', icon: GitMerge, title: tr('State Channels'), text: tr('Two parties exchange signed balance updates off-chain and settle the latest one.') }
  ];
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <ChevronRight size={18} className="text-emerald-300" />
        {tr('What’s next')}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <a key={c.id} href={`/demo/${c.id}`} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 hover:border-emerald-600">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Icon size={16} className="text-emerald-300" />
                {c.title}
              </div>
              <p className="mt-1 text-xs text-slate-400">{c.text}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function RealWorld() {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const items = [
    { title: tr('Bitcoin block headers'), text: tr('Every Bitcoin block header holds the Merkle root of its transactions; light wallets check payments with Merkle proofs.') },
    { title: tr('Ethereum'), text: tr('Ethereum hashes with Keccak-256 and keeps its state, transactions and receipts in Merkle Patricia tries whose roots go in each block header.') },
    { title: tr('Wallets'), text: tr('Your wallet’s address comes from your public key, and every transaction you send carries a signature made with your private key.') },
    { title: tr('Certificate Transparency'), text: tr('Browsers require HTTPS certificates to be recorded in public Merkle-tree logs (RFC 6962), so wrongly issued certificates can be spotted.') },
    { title: tr('Git and airdrops'), text: tr('Git names every commit by a hash of its content. Token airdrops publish one Merkle root and let each recipient claim with a proof.') }
  ];
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Globe size={18} className="text-blue-300" />
        {tr('🌐 Real-World Applications')}
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-sm font-semibold text-slate-100">{it.title}</div>
            <p className="mt-1 text-xs text-slate-300">{it.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
