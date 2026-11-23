// Small presentational pieces shared by the steps of the Hashes, Merkle Trees & Signatures demo.
import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useDemoI18n } from '../../useDemoI18n';
import { bitDiff, countBits } from './sha256';

export const DEMO_ID = 'hashes-merkle-signatures';
export type Tr = (english: string, opts?: Record<string, unknown>) => string;

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export const short = (hex: string, n = 8) => (hex ? hex.slice(0, n) : '…');

export function CopyButton({ value, className = '' }: { value: string; className?: string }) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      className={`inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 ${className}`}
      aria-label={tr('Copy')}
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? tr('Copied') : tr('Copy')}
    </button>
  );
}

/** Two hex strings, with the characters of `value` that differ from `other` highlighted. */
export function HexDiff({ value, other, className = '' }: { value: string; other?: string; className?: string }) {
  return (
    <code className={`block break-all font-mono text-xs leading-relaxed ${className}`}>
      {other === undefined
        ? value
        : value.split('').map((c, i) => (
            <span key={i} className={c !== other[i] ? 'rounded-sm bg-red-500/30 text-red-200' : 'text-slate-400'}>
              {c}
            </span>
          ))}
    </code>
  );
}

/** "N of 256 bits differ (x%)" */
export function BitsChanged({ a, b }: { a: string; b: string }) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const n = countBits(bitDiff(a, b));
  return (
    <span className="whitespace-nowrap text-xs text-slate-300">
      {tr('Bits changed: {{n}} of 256 ({{pct}}%)', { n, pct: Math.round((n / 256) * 100) })}
    </span>
  );
}

/** 16×16 grid of the 256 output bits: red squares are bits that differ. */
export function BitGrid({ a, b }: { a: string; b: string }) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const diff = bitDiff(a, b);
  const n = countBits(diff);
  return (
    <figure className="inline-block">
      <svg
        viewBox="0 0 160 160"
        className="h-40 w-40"
        role="img"
        aria-label={tr('{{n}} of the 256 bits differ', { n })}
      >
        {diff.map((d, i) => (
          <rect key={i} x={(i % 16) * 10 + 0.5} y={Math.floor(i / 16) * 10 + 0.5} width={9} height={9} rx={1.5} fill={d ? '#f87171' : '#1e293b'} />
        ))}
      </svg>
      <figcaption className="mt-1 text-center text-[11px] text-slate-400">
        {tr('Red = bit differs')} · {n}/256
      </figcaption>
    </figure>
  );
}

export function StatusBadge({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${
        ok ? 'border-emerald-700 bg-emerald-950/50 text-emerald-200' : 'border-red-700 bg-red-950/50 text-red-200'
      }`}
    >
      <span aria-hidden>{ok ? '✓' : '✗'}</span>
      {ok ? okText : badText}
    </span>
  );
}

/** Original vs current root side by side, with differing characters and changed bits. */
export function RootCompare({ original, current, originalLabel, currentLabel }: { original: string; current: string; originalLabel: string; currentLabel: string }) {
  const { tr } = useDemoI18n('hashes-merkle-signatures');
  const same = original === current;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3" data-testid="root-compare">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge ok={same} okText={tr('Roots match')} badText={tr('Roots differ')} />
        {!same ? <BitsChanged a={original} b={current} /> : null}
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">{originalLabel}</div>
          <HexDiff value={original} className="text-slate-300" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">{currentLabel}</div>
          <HexDiff value={current} other={same ? undefined : original} className={same ? 'text-emerald-200' : ''} />
        </div>
      </div>
    </div>
  );
}
