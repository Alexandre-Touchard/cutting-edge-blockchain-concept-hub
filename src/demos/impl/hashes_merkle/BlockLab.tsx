// Step 5: signed transactions go in the tree, the root goes in the block header. Try to forge one.
import React, { useEffect, useMemo, useState } from 'react';
import { Blocks, PenLine, RotateCcw, ShieldAlert } from 'lucide-react';
import EduTooltip from '../../../ui/EduTooltip';
import { define } from '../../glossary';
import { useDemoI18n } from '../../useDemoI18n';
import MerkleTreeView, { type NodeState } from './MerkleTreeView';
import TxTable from './TxTable';
import { buildTree, changedIds, hashLeaf, leafData, serializeTx, type MerkleMode, type Tx } from './merkle';
import { sha256Hex } from './sha256';
import { cryptoAvailable, generateKeyPair, signMessage, verifyMessage, type KeyPair } from './signatures';
import { RootCompare, StatusBadge, short } from './ui';

const NAMES = ['Alice', 'Bob', 'Carol'] as const;
type Name = (typeof NAMES)[number];
const UNSIGNED: Tx[] = [
  { id: 's1', from: 'Alice', to: 'Bob', amount: '5' },
  { id: 's2', from: 'Bob', to: 'Carol', amount: '2' },
  { id: 's3', from: 'Carol', to: 'Alice', amount: '1' },
  { id: 's4', from: 'Bob', to: 'Alice', amount: '3' }
];
const FORGE_INDEX = 1; // Bob → Carol
const PREV_HASH = sha256Hex('block #41');
const TIMESTAMP = '2026-11-23 10:00 UTC';
const NONCE = 52371;

export type SigStatus = { kind: 'valid' } | { kind: 'invalid' } | { kind: 'wrong-key'; signer: Name } | { kind: 'unknown-sender' } | { kind: 'pending' };

type Props = {
  mode: MerkleMode;
  animate: boolean;
  onForged: () => void;
  announce: (text: string) => void;
  pulse: (key: string) => string;
};

export const blockHash = (root: string) => sha256Hex(`${PREV_HASH}|${root}|${TIMESTAMP}|${NONCE}`);

export default function BlockLab({ mode, animate, onForged, announce, pulse }: Props) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const [keys, setKeys] = useState<Record<Name, KeyPair> | null>(null);
  const [sealed, setSealed] = useState<Tx[] | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [status, setStatus] = useState<SigStatus[]>([]);
  const available = cryptoAvailable();

  // Create the three demo identities and sign the original transactions.
  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(NAMES.map(() => generateKeyPair()));
      const k = Object.fromEntries(NAMES.map((n, i) => [n, pairs[i]])) as Record<Name, KeyPair>;
      const signedTxs = await Promise.all(UNSIGNED.map(async (tx) => ({ ...tx, sig: await signMessage(k[tx.from as Name].privateKey, serializeTx(tx)) })));
      if (cancelled) return;
      setKeys(k);
      setSealed(signedTxs);
      setTxs(signedTxs);
    })();
    return () => {
      cancelled = true;
    };
  }, [available]);

  // Check every signature against the sender's public key.
  useEffect(() => {
    if (!keys) return;
    let cancelled = false;
    setStatus(txs.map(() => ({ kind: 'pending' })));
    (async () => {
      const out = await Promise.all(
        txs.map(async (tx): Promise<SigStatus> => {
          const sender = keys[tx.from as Name];
          if (!sender) return { kind: 'unknown-sender' };
          if (await verifyMessage(sender.publicHex, serializeTx(tx), tx.sig ?? '')) return { kind: 'valid' };
          for (const n of NAMES) if (n !== tx.from && (await verifyMessage(keys[n].publicHex, serializeTx(tx), tx.sig ?? ''))) return { kind: 'wrong-key', signer: n };
          return { kind: 'invalid' };
        })
      );
      if (!cancelled) setStatus(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [txs, keys]);

  const sealedTree = useMemo(() => (sealed ? buildTree(sealed, mode) : null), [sealed, mode]);
  const tree = useMemo(() => buildTree(txs, mode), [txs, mode]);
  const changed = useMemo(() => (sealedTree ? changedIds(sealedTree, tree) : new Set<string>()), [sealedTree, tree]);
  const rootOk = !!sealedTree && sealedTree.root === tree.root;
  const badSigs = status.filter((s) => s.kind !== 'valid' && s.kind !== 'pending').length;

  useEffect(() => {
    if (sealedTree && !rootOk) onForged();
  }, [sealedTree, rootOk, onForged]);

  useEffect(() => {
    if (sealedTree) announce(rootOk ? tr('The block’s Merkle root matches its transactions.') : tr('The block’s Merkle root no longer matches its transactions.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootOk]);

  if (!available) {
    return (
      <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-100">
        {tr('Your browser only allows the Web Crypto API on secure pages (https or localhost), so signatures are unavailable here.')}
      </div>
    );
  }
  if (!keys || !sealedTree) return <div className="p-4 text-sm text-slate-400">{tr('Generating keys for Alice, Bob and Carol…')}</div>;

  const states = new Map<string, NodeState>([...changed].map((id) => [id, 'changed' as NodeState]));
  const leafHashes = txs.map((tx) => hashLeaf(leafData(tx), mode));
  const changedTx = new Set(txs.filter((tx, i) => sealedTree.levels[0][i]?.hash !== leafHashes[i]).map((tx) => tx.id));

  const edit = (i: number, field: 'from' | 'to' | 'amount', value: string) => setTxs((prev) => prev.map((t, j) => (j === i ? { ...t, [field]: value } : t)));
  const forge = () => edit(FORGE_INDEX, 'amount', '200');
  const resign = async (signer: Name) => {
    const tx = txs[FORGE_INDEX];
    const sig = await signMessage(keys[signer].privateKey, serializeTx(tx));
    setTxs((prev) => prev.map((t, j) => (j === FORGE_INDEX ? { ...t, sig } : t)));
  };

  const statusCell = (s: SigStatus | undefined) => {
    if (!s || s.kind === 'pending') return <span className="text-xs text-slate-500">…</span>;
    if (s.kind === 'valid') return <StatusBadge ok okText={tr('Signed by sender')} badText="" />;
    const text =
      s.kind === 'wrong-key'
        ? tr('Signed by {{signer}}, not the sender', { signer: s.signer })
        : s.kind === 'unknown-sender'
          ? tr('Unknown sender')
          : tr('Doesn’t match the signature');
    return <StatusBadge ok={false} okText="" badText={text} />;
  };

  const forged = txs[FORGE_INDEX];
  const forgedStatus = status[FORGE_INDEX];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300">
        {tr('Each sender signs their transaction. The leaf is now hash(transaction ‖ signature), the root goes into the block header, and the block’s own hash covers the header.')}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-3">
          <TxTable
            txs={txs}
            leafHashes={leafHashes}
            changed={changedTx}
            onChange={edit}
            extra={{ header: tr('Signature check'), cell: (_tx, i) => statusCell(status[i]) }}
          />
          <MerkleTreeView tree={tree} states={states} animate={animate} ariaLabel={tr('Merkle tree of the signed transactions')} />
        </div>

        {/* Block header */}
        <div className="space-y-3">
          <div className={`rounded-xl border p-3 ${rootOk ? 'border-emerald-800 bg-emerald-950/20' : 'border-red-800 bg-red-950/20'}`} data-hint="block-header">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Blocks size={16} className="text-blue-300" />
              {tr('Block #42 header')}
            </h3>
            <dl className="mt-2 space-y-1.5 text-xs">
              <Row label={tr('Previous block hash')} value={short(PREV_HASH, 16) + '…'} />
              <Row label={tr('Merkle root (sealed)')} value={short(sealedTree.root, 16) + '…'} strong />
              <Row label={tr('Timestamp')} value={TIMESTAMP} />
              <Row
                label={
                  <>
                    {tr('Nonce')} <EduTooltip text={define('Nonce')} />
                  </>
                }
                value={String(NONCE)}
              />
            </dl>
            <div className="mt-3 border-t border-slate-800 pt-2 text-xs">
              <div className="text-slate-400">{tr('Root recomputed from the transactions')}</div>
              <code className={`font-mono ${rootOk ? 'text-emerald-200' : 'text-red-200'}`}>{short(tree.root, 16)}…</code>
              <div className="mt-2">
                <StatusBadge ok={rootOk} okText={tr('Header matches the transactions')} badText={tr('Header no longer matches')} />
              </div>
              {!rootOk ? (
                <p className="mt-2 text-red-200">
                  {tr('To hide the edit, the forger would have to change the root in the header, which changes this block’s hash ({{a}}… → {{b}}…), which breaks the “previous hash” stored in the next block, and so on to the tip of the chain.', {
                    a: short(blockHash(sealedTree.root)),
                    b: short(blockHash(tree.root))
                  })}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Forgery lab */}
      <div className="rounded-xl border border-red-900/70 bg-red-950/10 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-red-100">
          <ShieldAlert size={16} className="text-red-300" />
          {tr('Forgery lab: you are the attacker (you hold Alice’s key)')}
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            data-hint="forge"
            onClick={forge}
            className={`rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold hover:bg-red-600 ${pulse('forge')}`}
          >
            {tr('1. Change Bob’s payment to 200')}
          </button>
          <button
            type="button"
            onClick={() => void resign('Alice')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-800 px-3 py-1.5 text-xs text-red-100 hover:bg-red-950/50"
          >
            <PenLine size={14} />
            {tr('2. Re-sign it with Alice’s key')}
          </button>
          <button
            type="button"
            onClick={() => void resign('Bob')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            <PenLine size={14} />
            {tr('3. What if Bob himself re-signs?')}
          </button>
          <button
            type="button"
            onClick={() => setTxs(sealed!)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            <RotateCcw size={14} />
            {tr('Restore the block')}
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-slate-300">
          <li>
            {tr('Bob’s transaction:')} <code className="font-mono">{serializeTx(forged)}</code> · {statusCell(forgedStatus)}
          </li>
          {forgedStatus?.kind === 'invalid' ? <li>{tr('The amount changed after Bob signed, so his signature no longer fits.')}</li> : null}
          {forgedStatus?.kind === 'wrong-key' ? (
            <li>{tr('The signature is valid, but for Alice’s key. The network checks it against the sender’s public key (Bob’s), so the forgery is rejected.')}</li>
          ) : null}
          {forgedStatus?.kind === 'valid' && !rootOk ? (
            <li>{tr('Bob can re-sign his own transaction, but the block was already sealed: its root no longer matches, so the change is still detected.')}</li>
          ) : null}
          <li className="text-slate-400">
            {badSigs === 0 && rootOk
              ? tr('All signatures are valid and the header matches: this block is intact.')
              : tr('Two independent checks: signatures protect each transaction, the Merkle root protects the list as a whole.')}
          </li>
        </ul>
        <RootCompareInline sealed={sealedTree.root} current={tree.root} />
      </div>
    </div>
  );
}

function RootCompareInline({ sealed, current }: { sealed: string; current: string }) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  return (
    <div className="mt-3">
      <RootCompare original={sealed} current={current} originalLabel={tr('Sealed root')} currentLabel={tr('Recomputed root')} />
    </div>
  );
}

function Row({ label, value, strong }: { label: React.ReactNode; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`font-mono ${strong ? 'font-semibold text-blue-200' : 'text-slate-300'}`}>{value}</dd>
    </div>
  );
}
