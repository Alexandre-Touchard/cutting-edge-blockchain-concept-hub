// Side panels of the ecosystem map: node details, list view (accessible fallback) and legend.
import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Play, X } from 'lucide-react';
import type { DemoMeta } from '../ui/Hub';
import type { MapData } from './data';
import { otherEnd } from './data';
import { Chip, NodeShape } from './MapCanvas';
import type { EdgeType, MapNode } from './types';
import { EDGE_TYPES } from './types';
import { EDGE_STYLE, edgeTypeName, kindName, layerName, monthYear, type Tr } from './vocab';

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

export function DetailPanel({
  node,
  data,
  demos,
  tr,
  lang,
  onNavigate,
  onClose
}: {
  node: MapNode;
  data: MapData;
  demos: Map<string, DemoMeta>;
  tr: Tr;
  lang?: string;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const cat = data.categoryById.get(node.category)!;
  const edges = data.edgesOf.get(node.id) ?? [];
  const byType = EDGE_TYPES.map((t) => ({ t, list: edges.filter((e) => e.type === t) })).filter((g) => g.list.length);
  return (
    <aside
      aria-label={tr('Details: {{name}}', { name: node.name })}
      className="absolute inset-x-0 bottom-0 z-20 max-h-[62vh] overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-950 p-4 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white">{node.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1">
            <Chip>{kindName(node.kind, tr)}</Chip>
            <Chip>{layerName(node, tr)}</Chip>
            <Chip color={cat.color}>{tr(cat.name)}</Chip>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label={tr('Close details')}>
          <X size={18} />
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{tr('Last verified: {{date}}', { date: monthYear(node.verifiedOn, lang) })}</p>

      <Section title={tr('In one line')}>
        <p className="text-sm text-slate-200">{node.summary}</p>
      </Section>

      {node.detail ? (
        <>
          <Section title={tr('What it is')}>
            <p className="text-sm text-slate-300">{node.detail.whatItIs}</p>
          </Section>
          <Section title={tr('How it works')}>
            <p className="text-sm text-slate-300">{node.detail.howItWorks}</p>
          </Section>
        </>
      ) : null}

      <Section title={tr('How it connects ({{n}})', { n: edges.length })}>
        <div className="space-y-3">
          {byType.map(({ t, list }) => (
            <div key={t}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: EDGE_STYLE[t].color }}>
                <EdgeSwatch type={t} />
                {edgeTypeName(t, tr)}
              </div>
              <ul className="mt-1 space-y-1">
                {list.map((e) => {
                  const other = data.nodeById.get(otherEnd(e, node.id))!;
                  return (
                    <li key={e.id} className="text-sm leading-snug">
                      <button type="button" onClick={() => onNavigate(other.id)} className="font-semibold text-blue-300 hover:underline">
                        {other.name}
                      </button>
                      <span className="text-slate-500"> · {data.nodeById.get(e.from)!.name} → {data.nodeById.get(e.to)!.name}</span>
                      <div className="text-slate-300">{e.label}</div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {node.goodToKnow.length ? (
        <Section title={tr('Good to know')}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {node.goodToKnow.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {node.demos.length ? (
        <Section title={tr('Related demos')}>
          <div className="space-y-2">
            {node.demos.map((id) => {
              const d = demos.get(id);
              if (!d) return null;
              const soon = d.status === 'coming_soon';
              const body = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <Play size={13} className={soon ? 'text-slate-500' : 'text-amber-300'} />
                      {d.title}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${soon ? 'bg-slate-800 text-slate-400' : 'bg-emerald-900/60 text-emerald-200'}`}>
                      {soon ? tr('Coming soon') : tr('Live')}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{d.description}</p>
                </>
              );
              return soon ? (
                <div key={id} aria-disabled className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 opacity-60">
                  {body}
                </div>
              ) : (
                <a key={id} href={`/demo/${id}`} className="block rounded-lg border border-slate-700 bg-slate-900 p-2 hover:border-amber-500/70">
                  {body}
                </a>
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section title={tr('Sources')}>
        <ul className="space-y-1 text-sm">
          {node.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-300 hover:underline">
                {s.label}
                <ExternalLink size={12} />
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

function EdgeSwatch({ type }: { type: EdgeType }) {
  const st = EDGE_STYLE[type];
  return (
    <svg width="22" height="8" aria-hidden>
      <line x1="1" y1="4" x2="21" y2="4" stroke={st.color} strokeWidth="2" strokeDasharray={st.dash} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------

type SortKey = 'name' | 'layer' | 'category' | 'connections' | 'demos';

export function ListView({ data, nodes, tr, onSelect, selectedId }: { data: MapData; nodes: MapNode[]; tr: Tr; onSelect: (id: string) => void; selectedId: string | null }) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'layer', asc: true });
  const rows = useMemo(() => {
    const val = (n: MapNode): string | number =>
      sort.key === 'name'
        ? n.name.toLowerCase()
        : sort.key === 'layer'
          ? n.layer * 10 + (n.subBand === 'app-tool' ? 1 : 0)
          : sort.key === 'category'
            ? data.categoryById.get(n.category)!.name
            : sort.key === 'connections'
              ? data.edgesOf.get(n.id)!.length
              : n.demos.length;
    return [...nodes].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name);
      return sort.asc ? c : -c;
    });
  }, [nodes, sort, data]);

  const head = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.asc ? 'ascending' : 'descending') : 'none'} className="px-3 py-2 text-left">
      <button type="button" onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))} className="inline-flex items-center gap-1 hover:text-white">
        {label}
        {sort.key === key ? sort.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}
      </button>
    </th>
  );

  return (
    <div className="h-full overflow-auto p-4">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">{tr('All nodes of the ecosystem map')}</caption>
        <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {head('name', tr('Name'))}
            {head('layer', tr('Layer'))}
            {head('category', tr('Category'))}
            {head('connections', tr('Connections'))}
            {head('demos', tr('Demos'))}
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => {
            const cat = data.categoryById.get(n.category)!;
            return (
              <tr key={n.id} className={`border-t border-slate-800 ${selectedId === n.id ? 'bg-blue-950/40' : 'hover:bg-slate-900'}`}>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onSelect(n.id)} className="inline-flex items-center gap-2 font-semibold text-blue-200 hover:underline">
                    <svg width="16" height="16" viewBox="-10 -10 20 20" aria-hidden>
                      <NodeShape kind={n.kind} x={0} y={0} r={7} fill={cat.color} />
                    </svg>
                    {n.name}
                  </button>
                  <div className="text-xs text-slate-400">{n.summary}</div>
                </td>
                <td className="px-3 py-2 text-slate-300">{layerName(n, tr)}</td>
                <td className="px-3 py-2 text-slate-300">{tr(cat.name)}</td>
                <td className="px-3 py-2 text-slate-300">{data.edgesOf.get(n.id)!.length}</td>
                <td className="px-3 py-2 text-slate-300">{n.demos.length ? `▶ ${n.demos.length}` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

export function Legend({ data, tr, onClose }: { data: MapData; tr: Tr; onClose: () => void }) {
  return (
    <div className="absolute left-3 top-3 z-20 max-h-[calc(100%-1.5rem)] w-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-xs text-slate-300 shadow-2xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{tr('Legend')}</span>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800" aria-label={tr('Close legend')}>
          <X size={14} />
        </button>
      </div>
      <h4 className="mt-2 font-semibold text-slate-200">{tr('Rings')}</h4>
      <ul className="mt-1 space-y-0.5">
        <li>{tr('Centre: Layer 1 chains, with their own consensus (including app-chains)')}</li>
        <li>{tr('Inner rim: Layer 2 networks that settle on a Layer 1')}</li>
        <li>{tr('Outer rim: Layer 3 chains (inside), then applications, tools and infrastructure')}</li>
      </ul>
      <p className="mt-1 text-slate-500">{tr('“Layer 3” has no single agreed definition.')}</p>
      <h4 className="mt-3 font-semibold text-slate-200">{tr('Shapes')}</h4>
      <div className="mt-1 flex flex-wrap gap-3">
        {(['chain', 'app', 'tool'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="-10 -10 20 20" aria-hidden>
              <NodeShape kind={k} x={0} y={0} r={7} fill="#94a3b8" />
            </svg>
            {kindName(k, tr)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="text-amber-300">▶</span>
          {tr('has a demo')}
        </span>
      </div>
      <h4 className="mt-3 font-semibold text-slate-200">{tr('Colours (categories)')}</h4>
      <ul className="mt-1 grid grid-cols-1 gap-0.5">
        {data.categories.map((c) => (
          <li key={c.id} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
            {tr(c.name)}
          </li>
        ))}
      </ul>
      <h4 className="mt-3 font-semibold text-slate-200">{tr('Connections')}</h4>
      <ul className="mt-1 space-y-0.5">
        {EDGE_TYPES.map((t) => (
          <li key={t} className="inline-flex w-full items-center gap-1.5">
            <EdgeSwatch type={t} />
            {edgeTypeName(t, tr)}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-slate-500">
        {tr('Sizes are uniform on purpose: no prices, market caps or rankings. Inclusion is not an endorsement.')}
      </p>
    </div>
  );
}
