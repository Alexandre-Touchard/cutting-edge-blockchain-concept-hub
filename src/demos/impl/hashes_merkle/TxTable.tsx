// Editable transaction table (From, To, Amount, computed leaf hash). A table on wide screens,
// one card per transaction on phones.
import React from 'react';
import { Trash2 } from 'lucide-react';
import { useDemoI18n } from '../../useDemoI18n';
import type { Tx } from './merkle';
import { short } from './ui';

export type TxTableProps = {
  txs: Tx[];
  leafHashes: string[];
  /** Ids of transactions whose leaf differs from the original. */
  changed?: Set<string>;
  onChange: (index: number, field: 'from' | 'to' | 'amount', value: string) => void;
  onRemove?: (index: number) => void;
  canRemove?: boolean;
  /** Extra column (e.g. signature status). */
  extra?: { header: string; cell: (tx: Tx, index: number) => React.ReactNode };
  selected?: number | null;
};

export default function TxTable({ txs, leafHashes, changed, onChange, onRemove, canRemove, extra, selected }: TxTableProps) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  // Static class names so Tailwind generates them.
  const cols = extra
    ? onRemove
      ? 'md:grid-cols-[2.5rem_1fr_1fr_4rem_5.5rem_minmax(9rem,1.2fr)_2rem]'
      : 'md:grid-cols-[2.5rem_1fr_1fr_4rem_5.5rem_minmax(9rem,1.2fr)]'
    : onRemove
      ? 'md:grid-cols-[2.5rem_1fr_1fr_4rem_5.5rem_2rem]'
      : 'md:grid-cols-[2.5rem_1fr_1fr_4rem_5.5rem]';
  const input = 'w-full min-w-0 rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none';
  return (
    <div role="table" aria-label={tr('Transactions in the block')} className="text-sm">
      <div role="row" className={`hidden gap-2 px-2 pb-1 text-[11px] uppercase tracking-wide text-slate-400 md:grid ${cols}`}>
        <span role="columnheader">#</span>
        <span role="columnheader">{tr('From')}</span>
        <span role="columnheader">{tr('To')}</span>
        <span role="columnheader">{tr('Amount')}</span>
        <span role="columnheader">{tr('Leaf hash')}</span>
        {extra ? <span role="columnheader">{extra.header}</span> : null}
        {onRemove ? <span role="columnheader" className="sr-only">{tr('Remove')}</span> : null}
      </div>
      <div className="space-y-1">
        {txs.map((tx, i) => {
          const isChanged = changed?.has(tx.id);
          return (
            <div
              role="row"
              key={tx.id}
              className={`grid grid-cols-2 items-center gap-2 rounded-lg border px-2 py-1 ${cols} ${
                isChanged ? 'border-red-700/70 bg-red-950/30' : selected === i ? 'border-blue-600 bg-blue-950/30' : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <span role="cell" className="col-span-2 text-xs font-semibold text-slate-400 md:col-span-1">
                {tr('Tx {{i}}', { i: i + 1 })}
              </span>
              <label role="cell" className="block">
                <span className="text-[11px] text-slate-500 md:sr-only">{tr('From')}</span>
                <input className={input} value={tx.from} aria-label={tr('Tx {{i}} sender', { i: i + 1 })} onChange={(e) => onChange(i, 'from', e.target.value)} />
              </label>
              <label role="cell" className="block">
                <span className="text-[11px] text-slate-500 md:sr-only">{tr('To')}</span>
                <input className={input} value={tx.to} aria-label={tr('Tx {{i}} recipient', { i: i + 1 })} onChange={(e) => onChange(i, 'to', e.target.value)} />
              </label>
              <label role="cell" className="block">
                <span className="text-[11px] text-slate-500 md:sr-only">{tr('Amount')}</span>
                <input
                  className={input}
                  value={tx.amount}
                  inputMode="decimal"
                  aria-label={tr('Tx {{i}} amount', { i: i + 1 })}
                  onChange={(e) => onChange(i, 'amount', e.target.value)}
                />
              </label>
              <span role="cell" className={`font-mono text-xs ${isChanged ? 'text-red-300' : 'text-slate-400'}`} title={leafHashes[i]}>
                {isChanged ? '≠ ' : ''}
                {short(leafHashes[i])}
              </span>
              {extra ? (
                <span role="cell" className="col-span-2 md:col-span-1">
                  {extra.cell(tx, i)}
                </span>
              ) : null}
              {onRemove ? (
                <span role="cell" className="text-right">
                  <button
                    type="button"
                    disabled={!canRemove}
                    onClick={() => onRemove(i)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-300 disabled:opacity-30"
                    aria-label={tr('Remove Tx {{i}}', { i: i + 1 })}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
