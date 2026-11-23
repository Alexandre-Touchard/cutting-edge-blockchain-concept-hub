// SVG Merkle tree: leaves at the bottom, root at the top. Node states use colour AND a symbol:
// changed (red, ≠), proof path (blue, ↑), sibling needed (amber, +), verified (green, ✓).
import React, { useMemo, useState } from 'react';
import { useDemoI18n } from '../../useDemoI18n';
import { layoutX, nodeId, type MerkleTree, type TreeNode } from './merkle';
import { CopyButton, short } from './ui';

export type NodeState = 'normal' | 'changed' | 'proof' | 'sibling' | 'verified';

const SLOT = 80;
const BOX_W = 72;
const BOX_H = 26;
const LEVEL_H = 62;
const PAD_TOP = 26;
const PAD_BOTTOM = 30;

const STYLE: Record<NodeState, { fill: string; stroke: string; text: string; icon: string }> = {
  normal: { fill: '#0f172a', stroke: '#475569', text: '#cbd5e1', icon: '' },
  changed: { fill: '#450a0a', stroke: '#f87171', text: '#fecaca', icon: '≠ ' },
  proof: { fill: '#172554', stroke: '#60a5fa', text: '#bfdbfe', icon: '↑ ' },
  sibling: { fill: '#451a03', stroke: '#fbbf24', text: '#fde68a', icon: '+ ' },
  verified: { fill: '#052e16', stroke: '#34d399', text: '#a7f3d0', icon: '✓ ' }
};

export type MerkleTreeViewProps = {
  tree: MerkleTree;
  /** Per-node state (default normal). */
  states?: Map<string, NodeState>;
  /** Levels shown (from the leaves). Hidden levels are drawn as "?" placeholders. */
  revealedLevels?: number;
  /** Leaf captions (e.g. "Tx 1"). */
  leafLabels?: string[];
  onLeafClick?: (index: number) => void;
  selectedLeaf?: number | null;
  /** Per-level ripple when hashes change (off with reduced motion). */
  animate?: boolean;
  ariaLabel: string;
};

export default function MerkleTreeView({
  tree,
  states,
  revealedLevels,
  leafLabels,
  onLeafClick,
  selectedLeaf,
  animate = true,
  ariaLabel
}: MerkleTreeViewProps) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const [inspect, setInspect] = useState<string | null>(null);
  const x = useMemo(() => layoutX(tree), [tree]);
  const depth = tree.levels.length;
  const leaves = tree.levels[0]?.length ?? 0;
  const width = Math.max(leaves, 1) * SLOT;
  const height = PAD_TOP + (depth - 1) * LEVEL_H + BOX_H + PAD_BOTTOM;
  const shown = revealedLevels ?? depth;
  const cx = (n: TreeNode) => (x.get(n.id) ?? 0) * SLOT + SLOT / 2;
  const cy = (level: number) => PAD_TOP + (depth - 1 - level) * LEVEL_H;
  const inspected = inspect ? tree.levels.flat().find((n) => n.id === inspect) : undefined;

  const label = (n: TreeNode) =>
    n.level === depth - 1 ? tr('Root') : n.level === 0 ? tr('Leaf {{i}}', { i: n.index + 1 }) : tr('Node {{id}}', { id: n.id });

  if (!depth) return null;
  return (
    <div>
      <style>{`@keyframes hmFlash{0%{opacity:.25;transform:scale(1.18)}60%{opacity:1}100%{opacity:1;transform:scale(1)}}`}</style>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={ariaLabel} className="mx-auto block">
          {/* edges */}
          {tree.levels.slice(1).map((row) =>
            row.map((n) =>
              n.children.map((c) => {
                const child = tree.levels[n.level - 1][c];
                const hidden = n.level >= shown;
                return (
                  <line
                    key={`${n.id}-${c}`}
                    x1={cx(n)}
                    y1={cy(n.level) + BOX_H}
                    x2={cx(child)}
                    y2={cy(child.level)}
                    stroke={hidden ? '#1e293b' : '#475569'}
                    strokeWidth={1.5}
                    strokeDasharray={n.promoted || n.duplicated ? '4 4' : undefined}
                  />
                );
              })
            )
          )}
          {/* nodes */}
          {tree.levels.map((row, level) =>
            row.map((n) => {
              const hidden = level >= shown;
              const st = STYLE[states?.get(n.id) ?? 'normal'];
              const selected = level === 0 && selectedLeaf === n.index;
              const clickable = !hidden;
              const activate = () => {
                if (!clickable) return;
                setInspect(n.id);
                if (level === 0) onLeafClick?.(n.index);
              };
              return (
                <g
                  key={`${n.id}:${hidden ? 'h' : n.hash}`}
                  role="button"
                  tabIndex={clickable ? 0 : -1}
                  aria-label={hidden ? tr('{{name}}: not computed yet', { name: label(n) }) : `${label(n)}: ${n.hash}`}
                  onClick={activate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      activate();
                    }
                  }}
                  className={clickable ? 'cursor-pointer outline-none [&:focus-visible>rect]:stroke-white' : ''}
                  style={
                    animate && !hidden
                      ? { animation: `hmFlash 450ms ease-out ${level * 150}ms both`, transformBox: 'fill-box', transformOrigin: 'center' }
                      : undefined
                  }
                >
                  <title>{hidden ? '?' : `${label(n)}\n${n.hash}`}</title>
                  <rect
                    x={cx(n) - BOX_W / 2}
                    y={cy(level)}
                    width={BOX_W}
                    height={BOX_H}
                    rx={6}
                    fill={hidden ? '#020617' : st.fill}
                    stroke={selected ? '#ffffff' : hidden ? '#334155' : st.stroke}
                    strokeWidth={selected ? 2.5 : 1.5}
                    strokeDasharray={hidden ? '3 3' : undefined}
                    style={{ transition: 'fill 200ms, stroke 200ms', transitionDelay: animate ? `${level * 150}ms` : '0ms' }}
                  />
                  <text
                    x={cx(n)}
                    y={cy(level) + BOX_H / 2 + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily="ui-monospace, monospace"
                    fill={hidden ? '#475569' : st.text}
                  >
                    {hidden ? '?' : `${st.icon}${short(n.hash)}`}
                  </text>
                  {level === depth - 1 && depth > 1 ? (
                    <text x={cx(n)} y={cy(level) - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill="#e2e8f0">
                      {tr('Root')}
                    </text>
                  ) : null}
                  {n.duplicated && !hidden ? (
                    <text x={cx(n) + BOX_W / 2 + 2} y={cy(level) + BOX_H + 12} fontSize={9} fill="#fbbf24">
                      {tr('×2 (copied)')}
                    </text>
                  ) : null}
                  {n.promoted && !hidden ? (
                    <text x={cx(n) + BOX_W / 2 + 2} y={cy(level) + BOX_H + 12} fontSize={9} fill="#94a3b8">
                      {tr('moved up')}
                    </text>
                  ) : null}
                  {level === 0 ? (
                    <text x={cx(n)} y={cy(0) + BOX_H + 16} textAnchor="middle" fontSize={10} fill={selected ? '#ffffff' : '#94a3b8'}>
                      {leafLabels?.[n.index] ?? tr('Tx {{i}}', { i: n.index + 1 })}
                    </text>
                  ) : null}
                </g>
              );
            })
          )}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <Legend color={STYLE.changed.stroke} icon="≠" text={tr('changed')} />
        <Legend color={STYLE.proof.stroke} icon="↑" text={tr('proof path')} />
        <Legend color={STYLE.sibling.stroke} icon="+" text={tr('sibling needed')} />
        <Legend color={STYLE.verified.stroke} icon="✓" text={tr('verified')} />
        <span>{tr('Click or focus a node to see its full hash.')}</span>
      </div>
      {inspected ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
          <span className="font-semibold text-slate-200">{label(inspected)}</span>
          <code className="min-w-0 flex-1 break-all font-mono text-slate-300">{inspected.hash}</code>
          <CopyButton value={inspected.hash} />
          {inspected.level > 0 ? (
            <span className="w-full text-slate-400">
              {inspected.promoted
                ? tr('= {{child}}, moved up unchanged (no partner on this level)', { child: nodeId(inspected.level - 1, inspected.children[0]) })
                : inspected.duplicated
                  ? tr('= hash({{child}} ‖ {{child}}): the last node had no partner, so it was paired with a copy of itself', {
                      child: nodeId(inspected.level - 1, inspected.children[0])
                    })
                  : tr('= hash({{left}} ‖ {{right}})', {
                      left: nodeId(inspected.level - 1, inspected.children[0]),
                      right: nodeId(inspected.level - 1, inspected.children[1])
                    })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Legend({ color, icon, text }: { color: string; icon: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded border text-[10px]" style={{ borderColor: color, color }} aria-hidden>
        {icon}
      </span>
      {text}
    </span>
  );
}
