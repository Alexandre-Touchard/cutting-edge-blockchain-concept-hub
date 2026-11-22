// Phase 4 side view: the dispersal pattern documented by Bitquery (default),
// compared with a generic peeling chain (a common technique NOT confirmed in this case).
import React, { useEffect, useMemo, useState } from 'react';
import { GitBranch, Pause, RotateCcw } from 'lucide-react';
import EduTooltip from '../../../ui/EduTooltip';
import { define } from '../../glossary';
import { buildFanOutTree, buildPeelingChain, collapsePeelingChain, descendantsOf, fanOutStageAt, type PeelExit } from './model';
import { ATTENTION_CLASSES, ConfidenceBadge, SourceNames, useAttentionHint, type Tr } from './ui';
import { SOURCES } from './data';

type Tab = 'fanout' | 'peeling';

export default function DispersalView({
  tr,
  lang,
  reducedMotion,
  onCluster
}: {
  tr: Tr;
  lang: string;
  reducedMotion: boolean;
  /** Called when the user clusters addresses (learning quest). */
  onCluster: () => void;
}) {
  const [tab, setTab] = useState<Tab>('fanout');
  const [clustered, setClustered] = useState(false);

  const toggleCluster = (on: boolean) => {
    setClustered(on);
    if (on) onCluster();
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => {
        setTab(id);
        setClustered(false);
      }}
      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${
        tab === id ? 'bg-slate-700 text-white' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-100">
        <GitBranch size={16} className="text-purple-300" />
        {tr('How the funds were scattered')}
        <div className="ml-auto flex gap-1.5" role="tablist">
          {tabBtn('fanout', tr('What was documented'))}
          {tabBtn('peeling', tr('Compare: peeling chain'))}
        </div>
      </div>

      <label className="mb-3 inline-flex cursor-pointer items-center gap-2 text-xs text-slate-200">
        <input type="checkbox" checked={clustered} onChange={(e) => toggleCluster(e.target.checked)} />
        {tr('Cluster addresses like an analyst')}
      </label>

      {tab === 'fanout' ? (
        <FanOut tr={tr} lang={lang} reducedMotion={reducedMotion} clustered={clustered} />
      ) : (
        <Peeling tr={tr} lang={lang} reducedMotion={reducedMotion} clustered={clustered} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documented fan-out (interactive)
// ---------------------------------------------------------------------------

const MAX_MINUTES = 30;
const PLAY_END = 15;

function FanOut({ tr, lang, reducedMotion, clustered }: { tr: Tr; lang: string; reducedMotion: boolean; clustered: boolean }) {
  const tree = useMemo(() => buildFanOutTree(), []);
  const W = 640;
  const H = 268;
  const TOP = 34;
  const BOTTOM = 226;
  const colX = [44, 150, 252];
  const gridX0 = 350;
  const cols = 26;
  const cell = 10.2;

  const pos = useMemo(() => {
    const levels = tree.sizes.slice(0, 3).map((n, l) =>
      Array.from({ length: n }, (_, i) => ({ x: colX[l], y: TOP + (n === 1 ? 0 : (i * (BOTTOM - TOP)) / (n - 1)) }))
    );
    const rows = Math.ceil(tree.sizes[3] / cols);
    const gy0 = TOP + (BOTTOM - TOP - (rows - 1) * cell) / 2;
    const final = Array.from({ length: tree.sizes[3] }, (_, i) => ({ x: gridX0 + (i % cols) * cell, y: gy0 + Math.floor(i / cols) * cell }));
    return [...levels, final];
  }, [tree]);
  const cluster = { x: gridX0 + ((cols - 1) * cell) / 2, y: (TOP + BOTTOM) / 2 };

  const [minutes, setMinutes] = useState(PLAY_END);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  // Point first-time users at Replay when the view first appears.
  const [hintReplay, stopHintReplay] = useAttentionHint();
  const stage = clustered ? 3 : fanOutStageAt(minutes);
  const active = hovered ?? pinned;
  const desc = useMemo(() => (active === null ? null : descendantsOf(tree, active)), [tree, active]);

  // Replay: advance the clock one minute at a time up to full spread.
  useEffect(() => {
    if (!playing) return;
    if (minutes >= PLAY_END) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setMinutes((m) => Math.min(PLAY_END, m + 1)), reducedMotion ? 0 : 300);
    return () => window.clearTimeout(t);
  }, [playing, minutes, reducedMotion]);

  const replay = () => {
    stopHintReplay();
    setMinutes(0);
    setPlaying(true);
  };

  const stageText = [
    tr('Still in the 17 receiving wallets. A freeze request now would only need to cover 17 addresses.'),
    tr('First hop: the funds are leaving the receiving wallets for intermediate ones.'),
    tr('Second hop: some funds may already sit at their final addresses (Bitquery saw 2–3 hops).'),
    tr('Spread across 526 addresses and moving on to instant exchanges, bridges and Monero. A freeze now has to chase hundreds of addresses.')
  ][stage];

  const inActive = (level: number, i: number) => !desc || desc[level].has(i);
  const levelLabel = [tr('17 wallets'), tr('Hop 1'), tr('Hop 2'), tr('{{n}} addresses', { n: tree.sizes[3].toLocaleString(lang) })];
  const labelX = [colX[0], colX[1], colX[2], cluster.x];

  return (
    <div>
      <style>{`
        .arkea-flow { stroke-dasharray: 3 5; animation: arkea-flow 0.7s linear infinite; }
        @keyframes arkea-flow { to { stroke-dashoffset: -16; } }
        .arkea-node { transition: transform 700ms ease, opacity 300ms ease; }
        @media (prefers-reduced-motion: reduce) { .arkea-flow { animation: none; stroke-dasharray: none; } .arkea-node { transition: none; } }
      `}</style>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <ConfidenceBadge level="reported" tr={tr} />
        <span>
          {tr('Counts and timing from')} <SourceNames sources={[SOURCES.bitquery]} />.{' '}
          {tr('Intermediate wallets and branches are schematic: their number was not published.')}
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label={tr('17 wallets fanning out through 2–3 hops to 526 addresses')}
        >
          {/* Clock */}
          <text x={W - 8} y={16} textAnchor="end" fontSize={12} fontWeight={700} fill={clustered ? '#94a3b8' : '#f8fafc'}>
            {clustered ? tr('Clustered view') : tr('T + {{m}} min (median pace)', { m: minutes })}
          </text>

          {/* Edges */}
          {[1, 2, 3].map((l) =>
            tree.parent[l].map((p, i) => {
              const a = pos[l - 1][p];
              const b = pos[l][i];
              const lit = inActive(l, i);
              const visible = !clustered && stage >= l;
              const flowing = visible && playing && stage === l;
              const mx = (a.x + b.x) / 2;
              return (
                <path
                  key={`e${l}-${i}`}
                  d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
                  fill="none"
                  stroke={desc && lit ? '#f0abfc' : '#a78bfa'}
                  strokeWidth={desc && lit ? 1.2 : 0.8}
                  strokeOpacity={!visible ? 0 : desc ? (lit ? 0.9 : 0.04) : l === 3 ? 0.1 : 0.35}
                  className={flowing && !reducedMotion ? 'arkea-flow' : undefined}
                  style={{ transition: reducedMotion ? 'none' : 'stroke-opacity 300ms' }}
                />
              );
            })
          )}

          {/* Intermediate and final nodes (they converge when clustered) */}
          {[1, 2, 3].map((l) =>
            pos[l].map((p, i) => {
              const reached = clustered || stage >= l;
              const lit = inActive(l, i);
              const dx = clustered ? cluster.x - p.x : 0;
              const dy = clustered ? cluster.y - p.y : 0;
              return (
                <circle
                  key={`n${l}-${i}`}
                  className="arkea-node"
                  cx={p.x}
                  cy={p.y}
                  r={l === 3 ? 2.4 : 2.8}
                  fill={desc && lit ? '#f0abfc' : '#a78bfa'}
                  style={{
                    transform: `translate(${dx}px, ${dy}px)`,
                    opacity: clustered ? 0.35 : !reached ? 0.12 : desc && !lit ? 0.18 : 1
                  }}
                />
              );
            })
          )}

          {/* Cluster */}
          <g style={{ opacity: clustered ? 1 : 0, transition: reducedMotion ? 'none' : 'opacity 500ms 300ms' }} aria-hidden={!clustered}>
            <circle cx={cluster.x} cy={cluster.y} r={62} fill="#7c3aed" fillOpacity={0.22} stroke="#c084fc" strokeWidth={2} />
            <foreignObject x={cluster.x - 56} y={cluster.y - 38} width={112} height={76}>
              <div className="flex h-full flex-col items-center justify-center text-center text-[11px] leading-tight text-purple-100">
                <span className="font-semibold">{tr('One investigation cluster')}</span>
                <span>{tr('{{n}} addresses', { n: tree.sizes[3].toLocaleString(lang) })}</span>
              </div>
            </foreignObject>
          </g>

          {/* Receiving wallets: interactive */}
          {pos[0].map((p, i) => {
            const lit = active === i;
            return (
              <g
                key={`s${i}`}
                className="arkea-focusable cursor-pointer"
                role="button"
                tabIndex={0}
                aria-pressed={pinned === i}
                aria-label={tr('Receiving wallet {{i}} of 17: highlight its branches', { i: i + 1 })}
                onMouseEnter={() => {
                  setHovered(i);
                  stopHintReplay();
                }}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                onClick={() => setPinned((v) => (v === i ? null : i))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPinned((v) => (v === i ? null : i));
                  }
                }}
              >
                <circle cx={p.x} cy={p.y} r={7} fill="transparent" />
                <circle
                  className="arkea-ring"
                  cx={p.x}
                  cy={p.y}
                  r={lit || pinned === i ? 6 : 4.5}
                  fill={lit || pinned === i ? '#f0abfc' : '#22d3ee'}
                  stroke={pinned === i ? '#f8fafc' : 'transparent'}
                  strokeWidth={1.5}
                  style={{ opacity: desc && !lit ? 0.35 : 1 }}
                />
              </g>
            );
          })}

          {/* Level labels */}
          {levelLabel.map((t, l) => (
            <text
              key={`l${l}`}
              x={labelX[l]}
              y={H - 10}
              textAnchor="middle"
              fontSize={11}
              fill={clustered && l > 0 && l < 3 ? '#475569' : stage >= l || clustered ? '#e2e8f0' : '#64748b'}
              fontWeight={stage === l && !clustered ? 700 : 400}
            >
              {t}
            </text>
          ))}
        </svg>
      </div>

      {/* Controls */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={replay}
          disabled={clustered}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold hover:bg-purple-600 disabled:opacity-40 ${
            hintReplay && !clustered ? ATTENTION_CLASSES : ''
          }`}
        >
          {playing ? <Pause size={14} /> : <RotateCcw size={14} />}
          {tr('Replay the dispersal')}
        </button>
        <label className="flex min-w-[240px] flex-1 items-center gap-2 text-xs text-slate-200">
          <span className="whitespace-nowrap">{tr('Freeze request after')}</span>
          <input
            type="range"
            min={0}
            max={MAX_MINUTES}
            value={minutes}
            disabled={clustered}
            onChange={(e) => {
              setPlaying(false);
              stopHintReplay();
              setMinutes(Number(e.target.value));
            }}
            className="flex-1 accent-purple-500"
            aria-valuetext={tr('{{m}} minutes', { m: minutes })}
          />
          <span className="w-14 text-right font-mono">{tr('{{m}} min', { m: minutes })}</span>
        </label>
      </div>

      <p className="mt-2 rounded-lg border border-purple-900 bg-purple-950/30 p-2.5 text-xs text-purple-100" aria-live="polite">
        {clustered
          ? tr(
              'Analysts group addresses that receive funds from the same source and pass them on within minutes. The 526 addresses become one cluster to watch: if any of it reaches an exchange, investigators know whom to ask for a freeze.'
            )
          : stageText}
      </p>
      {desc && !clustered ? (
        <p className="mt-1.5 text-xs text-slate-300">
          {tr('Wallet {{i}} of 17: its branches are highlighted. The drawing is schematic; how the real funds split per wallet was not published.', {
            i: (active ?? 0) + 1
          })}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-400">{tr('Tip: hover, focus or click one of the 17 wallets to follow its branches.')}</p>
      )}
      <p className="mt-2 text-[11px] text-slate-400">
        {tr(
          'Timing uses the median Bitquery observed (about 5 minutes per hop); real transfers were faster or slower. For scale: the bank discovered the fraud on Tuesday morning, about two days after the transfers began.'
        )}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <ConfidenceBadge level="reported" tr={tr} />
        <span>
          {tr('Exits named by ZachXBT: instant exchanges (WellWallet, Kyrrex), cross-chain bridges, and Wagyu to Monero.')}{' '}
          <SourceNames sources={[SOURCES.zachxbt]} />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic peeling chain (comparison)
// ---------------------------------------------------------------------------

function Peeling({ tr, lang, reducedMotion, clustered }: { tr: Tr; lang: string; reducedMotion: boolean; clustered: boolean }) {
  const hops = useMemo(() => buildPeelingChain(10_000, 50, 4), []);
  const totals = useMemo(() => collapsePeelingChain(hops), [hops]);
  const exitLabel: Record<PeelExit, string> = {
    cex: tr('Exchange deposits'),
    bridge: tr('Bridge / instant swap'),
    xmr: tr('Monero (XMR)')
  };
  const exitColor: Record<PeelExit, string> = { cex: '#fbbf24', bridge: '#f59e0b', xmr: '#f97316' };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <ConfidenceBadge level="unverified" tr={tr} />
        <span>
          {tr('A common laundering technique, shown for comparison. No source says it was used in this case.')}{' '}
          <EduTooltip term={tr('What is a peeling chain?')} text={define('Peeling Chain')} />
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-400">{tr('Generic example with round numbers: 10,000 ETH, 50 ETH per peel.')}</p>

      {!clustered ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-start gap-2 text-[11px]">
            <div className="rounded-lg border-2 border-blue-500 bg-blue-950/50 p-2 text-center">
              <div className="font-semibold text-blue-200">{tr('Source wallet')}</div>
              <div className="font-mono text-slate-200">10,000 ETH</div>
            </div>
            {hops.map((h, i) => (
              <div key={h.changeLabel} className="flex items-start gap-2">
                <div className="pt-3 text-slate-400" aria-hidden>
                  →
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="rounded-lg border-2 border-orange-500 bg-orange-950/40 p-2 text-center"
                    style={reducedMotion ? undefined : { animation: `arkea-fade 300ms ${i * 120}ms both` }}
                  >
                    <div className="font-semibold text-orange-200">
                      {tr('Change')} {h.changeLabel}
                    </div>
                    <div className="font-mono text-slate-200">{h.remainder.toLocaleString(lang)} ETH</div>
                  </div>
                  <div className="text-slate-400" aria-hidden>
                    ↓ {h.peel} ETH
                  </div>
                  <div className="rounded-lg border-2 border-dashed p-1.5 text-center" style={{ borderColor: exitColor[h.exit] }}>
                    <div className="text-slate-200">{tr('Throwaway wallet')}</div>
                    <div style={{ color: exitColor[h.exit] }}>→ {exitLabel[h.exit]}</div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <div className="pt-3 text-slate-400" aria-hidden>
                →
              </div>
              <div className="rounded-lg border-2 border-dashed border-orange-500/60 p-2 text-center text-slate-400">
                {tr('…repeats, thousands of addresses')}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <div className="rounded-lg border-2 border-purple-500 bg-purple-950/40 p-2 text-center">
            <div className="font-semibold text-purple-200">{tr('One cluster')}</div>
            <div className="text-slate-300">{tr('Source + {{n}} change addresses', { n: hops.length })}</div>
          </div>
          <div className="text-slate-400" aria-hidden>
            →
          </div>
          <div className="space-y-1">
            {(Object.keys(totals) as PeelExit[]).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: exitColor[k] }} />
                <span className="text-slate-200">{exitLabel[k]}</span>
                <span className="font-mono text-slate-400">{totals[k]} ETH</span>
              </div>
            ))}
          </div>
          <p className="basis-full text-xs text-slate-400">
            {tr(
              'Change addresses are treated as the same owner, because each one only exists to carry the remainder forward. The tree of thousands of transactions becomes one wallet with a few exits, and investigators know which exchanges to ask for a freeze.'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
