// "Who touches what": transactions (left) → accounts (right). Writes are solid, reads dashed,
// undeclared accesses dotted red; accounts where transactions must wait are outlined in red.
import React, { useState } from 'react';
import type { AccountId, Tx } from './scheduler';
import { accessEdges, hotAccounts, type AccessEdge } from './visuals';

type Tr = (s: string, o?: Record<string, unknown>) => string;

const W = 560;
const ROW = 42;
const TX_X = 70;
const ACC_X = W - 90;

const EDGE_STYLE: Record<AccessEdge['kind'], { stroke: string; width: number; dash?: string }> = {
  w: { stroke: '#34d399', width: 2.5 },
  r: { stroke: '#60a5fa', width: 1.6, dash: '6 4' },
  missing: { stroke: '#f87171', width: 2, dash: '2 4' }
};

export default function AccessDiagram({ txs, accounts, tr }: { txs: Tx[]; accounts: AccountId[]; tr: Tr }) {
  const [hoverTx, setHoverTx] = useState<number | null>(null);
  const [hoverAcc, setHoverAcc] = useState<AccountId | null>(null);

  const edges = accessEdges(txs);
  const hot = new Set(hotAccounts(txs));
  const rows = Math.max(txs.length, accounts.length, 1);
  const H = rows * ROW + 16;
  const yOf = (i: number, n: number) => 8 + ((i + 0.5) * (H - 16)) / n;
  const txY = new Map(txs.map((t, i) => [t.id, yOf(i, txs.length)]));
  const accY = new Map(accounts.map((a, i) => [a, yOf(i, accounts.length)]));

  const active = (e: AccessEdge) =>
    (hoverTx === null && hoverAcc === null) || e.txId === hoverTx || e.account === hoverAcc;

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[440px]"
          role="img"
          aria-label={tr('Diagram of which transactions read and write which accounts')}
        >
          <defs>
            {(['w', 'r', 'missing'] as const).map((k) => (
              <marker key={k} id={`evm-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_STYLE[k].stroke} />
              </marker>
            ))}
          </defs>

          {edges.map((e) => {
            const y1 = txY.get(e.txId)!;
            const y2 = accY.get(e.account);
            if (y2 === undefined) return null;
            const s = EDGE_STYLE[e.kind];
            const x1 = TX_X + 42;
            const x2 = ACC_X - 58;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={`${e.txId}-${e.account}`}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={s.stroke}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                markerEnd={`url(#evm-arrow-${e.kind})`}
                opacity={active(e) ? 0.95 : 0.12}
                style={{ transition: 'opacity 150ms' }}
              />
            );
          })}

          {txs.map((t) => {
            const y = txY.get(t.id)!;
            const dim = hoverTx !== null && hoverTx !== t.id;
            return (
              <g
                key={t.id}
                onMouseEnter={() => setHoverTx(t.id)}
                onMouseLeave={() => setHoverTx(null)}
                onClick={() => document.getElementById(`tx-${t.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                style={{ cursor: 'pointer', opacity: dim ? 0.4 : 1 }}
              >
                <title>{tr(t.label)}</title>
                <rect x={TX_X - 42} y={y - 15} width={84} height={30} rx={8} fill="#1e1b4b" stroke="#a78bfa" />
                <text x={TX_X} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#e9d5ff">
                  TX #{t.id}
                </text>
              </g>
            );
          })}

          {accounts.map((a) => {
            const y = accY.get(a)!;
            const isHot = hot.has(a);
            return (
              <g key={a} onMouseEnter={() => setHoverAcc(a)} onMouseLeave={() => setHoverAcc(null)} style={{ cursor: 'default' }}>
                <rect
                  x={ACC_X - 58}
                  y={y - 15}
                  width={116}
                  height={30}
                  rx={6}
                  fill={isHot ? '#450a0a' : '#0f172a'}
                  stroke={isHot ? '#f87171' : '#475569'}
                  strokeWidth={isHot ? 2 : 1}
                />
                <text x={ACC_X} y={y + 4} textAnchor="middle" fontSize={12} fontFamily="ui-monospace, monospace" fill="#e2e8f0">
                  {a}
                </text>
                {isHot ? (
                  <text x={ACC_X + 64} y={y + 4} fontSize={13} fill="#f87171">
                    ⚠
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <svg width="26" height="8" aria-hidden>
            <line x1="0" y1="4" x2="26" y2="4" stroke="#34d399" strokeWidth="2.5" />
          </svg>
          {tr('writes (exclusive lock)')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="26" height="8" aria-hidden>
            <line x1="0" y1="4" x2="26" y2="4" stroke="#60a5fa" strokeWidth="1.6" strokeDasharray="6 4" />
          </svg>
          {tr('reads (shared lock)')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="26" height="8" aria-hidden>
            <line x1="0" y1="4" x2="26" y2="4" stroke="#f87171" strokeWidth="2" strokeDasharray="2 4" />
          </svg>
          {tr('used but not declared (fails on Solana)')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border-2 border-red-400 bg-red-950" />
          {tr('⚠ conflict: several transactions, at least one writes → they can’t run together')}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{tr('Hover a transaction or an account to highlight its arrows; click a transaction to jump to it.')}</div>
    </div>
  );
}
