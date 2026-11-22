// "Known figures" tracker: only amounts that a source has published, revealed step by step.
import React from 'react';
import { Wallet } from 'lucide-react';
import EduTooltip from '../../../ui/EduTooltip';
import type { Figure } from './model';
import { ConfidenceBadge, SourceNames, type Tr } from './ui';

export default function KnownFigures({
  figures,
  scaleMaxUsd,
  tr,
  reducedMotion
}: {
  /** Figures known at the current step. */
  figures: Figure[];
  /** Amount drawn as a full-width bar (the largest figure in the scenario). */
  scaleMaxUsd: number;
  tr: Tr;
  reducedMotion: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <Wallet size={16} className="text-cyan-300" />
        {tr('Known figures so far')}
        <EduTooltip
          text={tr(
            'Only amounts published by a source, shown from the step where they became known. Bars share one scale, so you can compare them. Where an amount has not been published, the tracker says so instead of guessing.'
          )}
        />
      </div>

      {figures.length === 0 ? (
        <p className="text-xs text-slate-400">
          {tr(
            'No figure is public yet at this step. Bank transfers are not visible on-chain: the first traceable amounts appear when stablecoins leave the exchanges.'
          )}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {figures.map((f) => {
            const pct = f.amountUsd === null ? null : Math.max(f.amountUsd > 0 ? 0.8 : 0, (f.amountUsd / scaleMaxUsd) * 100);
            return (
              <li key={f.id} className="text-xs">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-slate-200">{tr(f.label)}</span>
                  <span className={`ml-auto font-mono font-semibold ${f.amountUsd === null ? 'text-slate-400' : 'text-slate-100'}`}>
                    {tr(f.display)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  {pct === null ? (
                    <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#334155_0_4px,transparent_4px_8px)]" title={tr('Not public')} />
                  ) : (
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: `${pct}%`, transition: reducedMotion ? 'none' : 'width 400ms ease' }}
                    />
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                  <ConfidenceBadge level={f.confidence} tr={tr} />
                  <span>
                    {tr('Source')}: <SourceNames sources={f.sources} />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-slate-400">
        {tr('Figures come from different sources and dates, so they do not add up to a total. Hatched bar = amount not public.')}
      </p>
    </div>
  );
}
