// Small presentational pieces shared by the Arkéa demo views.
import React from 'react';
import type { Confidence, Source } from './model';

export type Tr = (english: string, opts?: Record<string, unknown>) => string;

/**
 * "Click here first" hint, same pattern as the hub's other demos: pulse for a few
 * seconds after mount, stop early as soon as the user interacts.
 * Returns [active, stop].
 */
export function useAttentionHint(durationMs = 10_000): [boolean, () => void] {
  const [active, setActive] = React.useState(true);
  React.useEffect(() => {
    const t = window.setTimeout(() => setActive(false), durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs]);
  const stop = React.useCallback(() => setActive(false), []);
  return [active, stop];
}

/** Classes for a hinted control (pulse is disabled under prefers-reduced-motion). */
export const ATTENTION_CLASSES = 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950 motion-safe:animate-pulse';

export function ConfidenceBadge({ level, tr }: { level: Confidence; tr: Tr }) {
  const cfg: Record<Confidence, { icon: string; label: string; cls: string; tip: string }> = {
    confirmed: {
      icon: '🟢',
      label: tr('Confirmed'),
      cls: 'border-emerald-700 bg-emerald-950/50 text-emerald-200',
      tip: tr('Stated by the bank or by several independent outlets.')
    },
    reported: {
      icon: '🟡',
      label: tr('Reported'),
      cls: 'border-amber-700 bg-amber-950/50 text-amber-200',
      tip: tr('One source, or an analyst’s attribution. Plausible but not independently confirmed.')
    },
    unverified: {
      icon: '🔴',
      label: tr('Unverified'),
      cls: 'border-red-700 bg-red-950/50 text-red-200',
      tip: tr('Circulated in summaries or diagrams but not found in a reputable public source. Treat as a hypothesis.')
    }
  };
  const c = cfg[level];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${c.cls}`}
      title={c.tip}
    >
      <span aria-hidden>{c.icon}</span>
      {c.label}
    </span>
  );
}

export function SourceList({ sources, noPublicSource, tr }: { sources: Source[]; noPublicSource?: string; tr: Tr }) {
  if (sources.length === 0) {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950/30 p-2 text-xs text-red-200">
        <span className="font-semibold">{tr('No public source.')}</span> {noPublicSource ? tr(noPublicSource) : null}
      </div>
    );
  }
  return (
    <ul className="space-y-1.5 text-xs">
      {sources.map((s) => (
        <li key={s.url} className="leading-snug">
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-words text-blue-300 hover:underline">
            {s.name}
            {s.title ? ` — ${s.title}` : ''}
          </a>
          <span className="text-slate-400"> · {s.date}</span>
          {s.archiveUrl ? (
            <>
              <span className="text-slate-400"> · </span>
              <a href={s.archiveUrl} target="_blank" rel="noopener noreferrer" className="text-slate-300 underline hover:text-white">
                {tr('archived copy')}
              </a>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Compact "source names" line, e.g. "Bitquery, Cointelegraph", each linked. */
export function SourceNames({ sources }: { sources: Source[] }) {
  return (
    <>
      {sources.map((s, i) => (
        <React.Fragment key={s.url}>
          {i > 0 ? ', ' : ''}
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">
            {s.name.replace(/\s*\(.*\)$/, '')}
          </a>
        </React.Fragment>
      ))}
    </>
  );
}
