// Visual pieces of the MakerDAO demo: health bar, price chart with the liquidation line,
// and the time-slider stress test.
import React, { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EduTooltip from '../../../ui/EduTooltip';
import { useDemoI18n } from '../../useDemoI18n';
import { STRESS_DAYS, liquidationDay, liquidationPrice, ratio, stressPath, type Vault } from './model';

/** $2,000 in English; 2 000 $ in French and Spanish (symbol after the amount). */
export function fmtUsd(n: number, lang?: string) {
  const amount = n.toLocaleString(lang, { maximumFractionDigits: n < 100 ? 2 : 0 });
  return /^(fr|es)/.test(lang ?? '') ? `${amount} $` : `$${amount}`;
}
export const fmtNum = (n: number, lang?: string, digits = 2) => n.toLocaleString(lang, { maximumFractionDigits: digits });
export const fmtPct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '∞');

const MIN_CR = 1;
const MAX_CR = 3;

/** Horizontal bar from 100% to 300%: red below the liquidation ratio, orange up to +30 points, green above. */
export function HealthBar({ cr, lr, pulse = '' }: { cr: number; lr: number; pulse?: string }) {
  const { tr } = useDemoI18n('makerdao-vault');
  const pos = (x: number) => `${((Math.min(Math.max(x, MIN_CR), MAX_CR) - MIN_CR) / (MAX_CR - MIN_CR)) * 100}%`;
  const empty = !Number.isFinite(cr);
  const zone = empty ? 'empty' : cr < lr ? 'red' : cr < lr + 0.3 ? 'orange' : 'green';
  const label = {
    empty: tr('No debt: nothing to liquidate'),
    red: tr('Below the liquidation ratio'),
    orange: tr('Risky'),
    green: tr('Safe')
  }[zone];
  return (
    <div data-hint="health" className={`rounded-lg ${pulse}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{tr('Health')}</span>
        <span className={`font-semibold ${zone === 'red' ? 'text-red-300' : zone === 'orange' ? 'text-amber-300' : 'text-emerald-300'}`}>
          {zone === 'red' ? '✗ ' : zone === 'orange' ? '⚠ ' : '✓ '}
          {label}
        </span>
      </div>
      <div
        className="relative mt-1 h-4 overflow-visible rounded-full"
        role="meter"
        aria-valuemin={100}
        aria-valuemax={300}
        aria-valuenow={empty ? 300 : Math.round(cr * 100)}
        aria-label={tr('Collateral ratio')}
        style={{
          background: `linear-gradient(to right, #7f1d1d 0%, #b91c1c ${pos(lr)}, #b45309 ${pos(lr)}, #d97706 ${pos(lr + 0.3)}, #047857 ${pos(lr + 0.3)}, #059669 100%)`
        }}
      >
        {/* liquidation threshold line */}
        <div className="absolute -top-1 bottom-[-4px] w-0.5 bg-white" style={{ left: pos(lr) }} aria-hidden />
        {/* current ratio marker */}
        {!empty ? (
          <div
            className="absolute top-1/2 h-6 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-slate-950 bg-white shadow transition-all duration-500"
            style={{ left: pos(cr) }}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-slate-400">
        <span className="absolute left-0">100%</span>
        <span className="absolute -translate-x-1/2 font-semibold text-white" style={{ left: pos(lr) }}>
          {tr('Liquidation {{pct}}', { pct: fmtPct(lr) })}
        </span>
        <span className="absolute right-0">300%+</span>
      </div>
    </div>
  );
}

const W = 520;
const H = 170;
const PAD = { l: 52, r: 12, t: 12, b: 22 };

function scale(values: number[]) {
  const lo = Math.min(...values) * 0.9;
  const hi = Math.max(...values) * 1.08;
  return { lo, hi, y: (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b) };
}

/** ETH price history with the vault's liquidation price as a dashed red line. */
export function PriceChart({ history, liqPrice, oraclePrice, pending }: { history: number[]; liqPrice: number; oraclePrice: number; pending: boolean }) {
  const { tr, lang } = useLang();
  const s = scale([...history, ...(liqPrice > 0 ? [liqPrice] : []), oraclePrice]);
  const x = (i: number) => PAD.l + (history.length <= 1 ? 0.5 : i / (history.length - 1)) * (W - PAD.l - PAD.r);
  const pts = history.map((p, i) => `${x(i)},${s.y(p)}`).join(' ');
  const last = history[history.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={tr('ETH price chart. Current price {{p}}, liquidation price {{l}}.', { p: fmtUsd(last, lang), l: liqPrice > 0 ? fmtUsd(liqPrice, lang) : '—' })}>
      {[s.lo, (s.lo + s.hi) / 2, s.hi].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={s.y(v)} y2={s.y(v)} stroke="#1e293b" />
          <text x={PAD.l - 6} y={s.y(v) + 4} textAnchor="end" fontSize={10} fill="#64748b">
            {fmtUsd(v, lang)}
          </text>
        </g>
      ))}
      {liqPrice > 0 ? (
        <g>
          <rect x={PAD.l} y={s.y(liqPrice)} width={W - PAD.l - PAD.r} height={Math.max(0, H - PAD.b - s.y(liqPrice))} fill="#7f1d1d" opacity={0.25} />
          <line x1={PAD.l} x2={W - PAD.r} y1={s.y(liqPrice)} y2={s.y(liqPrice)} stroke="#f87171" strokeWidth={2} strokeDasharray="6 4" />
          <text x={W - PAD.r - 4} y={s.y(liqPrice) - 5} textAnchor="end" fontSize={11} fontWeight={700} fill="#fca5a5">
            {tr('Liquidation price {{p}}', { p: fmtUsd(liqPrice, lang) })}
          </text>
        </g>
      ) : null}
      {pending ? (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={s.y(oraclePrice)} y2={s.y(oraclePrice)} stroke="#a78bfa" strokeDasharray="2 3" />
          <text x={PAD.l + 4} y={s.y(oraclePrice) - 4} fontSize={10} fill="#c4b5fd">
            {tr('Oracle price (1 hour old) {{p}}', { p: fmtUsd(oraclePrice, lang) })}
          </text>
        </g>
      ) : null}
      <polyline points={pts} fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinejoin="round" />
      {history.map((p, i) => (
        <circle key={i} cx={x(i)} cy={s.y(p)} r={i === history.length - 1 ? 4.5 : 2.5} fill={liqPrice > 0 && p < liqPrice ? '#f87171' : '#93c5fd'} />
      ))}
      <text x={x(history.length - 1)} y={H - 6} textAnchor="end" fontSize={10} fill="#94a3b8">
        {tr('now')}
      </text>
    </svg>
  );
}

export function useLang() {
  const { tr } = useDemoI18n('makerdao-vault');
  const { i18n } = useTranslation();
  return { tr, lang: i18n.resolvedLanguage };
}

/** "Time slider": a gradual 30-day decline applied to the current vault (what-if, nothing changes). */
export function StressTest({ vault, lr, price, onReachLiquidation, pulse }: { vault: Vault; lr: number; price: number; onReachLiquidation: () => void; pulse: (k: string) => string }) {
  const { tr, lang } = useLang();
  const [decline, setDecline] = useState(40);
  const [day, setDay] = useState(0);
  const path = useMemo(() => stressPath(price, decline / 100), [price, decline]);
  const liqDay = liquidationDay(path, vault, lr);
  const lp = liquidationPrice(vault, lr);
  const p = path[day];
  const cr = ratio(vault, p);
  const liquidatedNow = liqDay !== null && day >= liqDay;

  const s = scale([...path, ...(lp > 0 ? [lp] : [])]);
  const x = (d: number) => PAD.l + (d / STRESS_DAYS) * (W - PAD.l - PAD.r);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <CalendarClock size={18} className="text-blue-300" />
        {tr('Time slider: a slow decline')}
        <EduTooltip text={tr('A what-if on your current vault: nothing changes in the simulation. Drag the day to see when the price crosses your liquidation price.')} />
      </h2>
      <div className="mt-3 grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-3">
          <label className="block text-xs text-slate-300">
            {tr('ETH falls by {{n}}% over 30 days', { n: decline })}
            <input type="range" min={10} max={80} step={5} value={decline} onChange={(e) => setDecline(+e.target.value)} className="mt-1 w-full accent-blue-500" />
          </label>
          <label data-hint="stress-slider" className={`block rounded-lg text-xs text-slate-300 ${pulse('stress-slider')}`}>
            {tr('Day {{d}} of 30', { d: day })}
            <input
              type="range"
              min={0}
              max={STRESS_DAYS}
              value={day}
              onChange={(e) => {
                const d = +e.target.value;
                setDay(d);
                if (liqDay !== null && d >= liqDay) onReachLiquidation();
              }}
              className="mt-1 w-full accent-amber-500"
            />
            </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-300">{tr('ETH: {{p}}', { p: fmtUsd(p, lang) })}</span>
            <span className="text-slate-300">{tr('Ratio: {{r}}', { r: fmtPct(cr) })}</span>
            <span className={liquidatedNow ? 'font-semibold text-red-300' : 'text-emerald-300'}>
              {vault.debt <= 0
                ? tr('No debt: this vault can’t be liquidated.')
                : liquidatedNow
                  ? tr('✗ Liquidated on day {{d}}, when ETH fell below {{lp}}.', { d: liqDay, lp: fmtUsd(lp, lang) })
                  : liqDay !== null
                    ? tr('Still safe. Liquidation comes on day {{d}} if nothing changes.', { d: liqDay })
                    : tr('✓ This vault survives the whole decline.')}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {tr('Change your vault (repay DAI or add ETH) and watch the red line move down and the liquidation day move later, or disappear.')}
          </p>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={tr('Projected ETH price over 30 days')}>
          {lp > 0 ? <line x1={PAD.l} x2={W - PAD.r} y1={s.y(lp)} y2={s.y(lp)} stroke="#f87171" strokeWidth={2} strokeDasharray="6 4" /> : null}
          {[s.lo, s.hi].map((v) => (
            <text key={v} x={PAD.l - 6} y={s.y(v) + 4} textAnchor="end" fontSize={10} fill="#64748b">
              {fmtUsd(v, lang)}
            </text>
          ))}
          <polyline points={path.map((v, d) => `${x(d)},${s.y(v)}`).join(' ')} fill="none" stroke="#475569" strokeWidth={2} />
          <polyline points={path.slice(0, day + 1).map((v, d) => `${x(d)},${s.y(v)}`).join(' ')} fill="none" stroke={liquidatedNow ? '#f87171' : '#60a5fa'} strokeWidth={2.5} />
          {liqDay !== null ? (
            <g>
              <circle cx={x(liqDay)} cy={s.y(path[liqDay])} r={6} fill="none" stroke="#f87171" strokeWidth={2} />
              <text x={x(liqDay)} y={s.y(path[liqDay]) + 18} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fca5a5">
                {tr('liquidation, day {{d}}', { d: liqDay })}
              </text>
            </g>
          ) : null}
          <line x1={x(day)} x2={x(day)} y1={PAD.t} y2={H - PAD.b} stroke="#fbbf24" strokeWidth={1.5} />
          <text x={PAD.l} y={H - 6} fontSize={10} fill="#94a3b8">
            {tr('day 0')}
          </text>
          <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize={10} fill="#94a3b8">
            {tr('day 30')}
          </text>
        </svg>
      </div>
    </section>
  );
}
