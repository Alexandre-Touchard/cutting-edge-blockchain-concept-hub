// Shared learning-quest kit for demos.
//
// A demo declares its quests (text, tip, completion condition, optional control to point at):
//
//   const q = useDemoQuests('amm-demo', [
//     { id: 'swap', text: tr('Make a swap'), tip: tr('…'), done: swapCount > 0, target: 'swap-btn' },
//     { id: 'il',   text: tr('…'),          tip: tr('…'), done: priceRatio >= 2 },
//   ]);
//   …
//   <QuestList q={q} />                 // goes into the header "Learning quests" widget
//   <NextQuestCard q={q} />             // inline "Next quest" card with a "Show me" button
//   <button data-hint="swap-btn" className={`… ${q.pulse('swap-btn')}`}>Swap</button>
//
// Completion is monotonic (once done, a quest stays done, even after a reset in the demo),
// saved in the browser, and reported to the hub (progress badge) and to analytics.
// `q.markDone(id)` completes a quest from an event handler when it isn't derived from state.
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { CheckCircle2, Circle, ListTodo } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EduTooltip from '../../ui/EduTooltip';
import LearningQuestsPortal from '../../ui/LearningQuestsPortal';
import { usePulseTarget } from '../../ui/attention';
import { usePersistedQuests, useReportQuestProgress } from '../questProgress';

export type QuestDef = {
  /** Stable id (used for saved progress; don't rename once shipped). */
  id: string;
  /** Translated title. */
  text: string;
  /** Translated "how to do it" hint. */
  tip: string;
  /** Completion condition derived from the demo's state (optional if you use markDone). */
  done?: boolean;
  /** data-hint key of the control to point at ("Show me"). */
  target?: string;
};

export type QuestState = QuestDef & { completed: boolean };

export type DemoQuests = {
  quests: QuestState[];
  doneCount: number;
  total: number;
  next: QuestState | null;
  markDone: (id: string) => void;
  /** Scroll to and pulse the control with data-hint="<key>". */
  point: (key: string, scroll?: boolean) => void;
  /** Pulse classes for the control with this data-hint key (empty unless it is being pointed at). */
  pulse: (key: string) => string;
};

/** Ids that just became done and aren't saved yet (pure; exported for tests). */
export function newlyCompleted(defs: QuestDef[], saved: Record<string, boolean>): string[] {
  return defs.filter((d) => d.done && !saved[d.id]).map((d) => d.id);
}

export function useDemoQuests(demoId: string, defs: QuestDef[]): DemoQuests {
  const [saved, setSaved] = usePersistedQuests(demoId, () => Object.fromEntries(defs.map((d) => [d.id, false])) as Record<string, boolean>);

  // Persist completions derived from state (monotonic).
  const doneSignature = defs.map((d) => (d.done ? '1' : '0')).join('');
  useEffect(() => {
    const ids = newlyCompleted(defs, saved);
    if (ids.length) setSaved((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, true])) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneSignature]);

  const markDone = useCallback(
    (id: string) => setSaved((prev) => (prev[id] ? prev : { ...prev, [id]: true })),
    [setSaved]
  );

  const quests = useMemo(() => defs.map((d) => ({ ...d, completed: !!d.done || !!saved[d.id] })), [defs, saved]);
  const doneCount = quests.filter((q) => q.completed).length;
  const next = quests.find((q) => !q.completed) ?? null;
  useReportQuestProgress(demoId, doneCount, defs.length);

  // Point at the first quest's control on arrival; stop pulsing when the quest changes.
  const { point, clear, pulse } = usePulseTarget();
  useEffect(() => {
    if (next?.target) point(next.target, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lastNext = useRef(next?.id);
  useEffect(() => {
    if (lastNext.current !== next?.id) clear();
    lastNext.current = next?.id;
  }, [next?.id, clear]);

  return { quests, doneCount, total: defs.length, next, markDone, point, pulse };
}

/** Quest checklist rendered inside the header "Learning quests" widget. */
export function QuestList({ q }: { q: DemoQuests }) {
  const { t } = useTranslation();
  return (
    <LearningQuestsPortal>
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-100">{t('quests.title', { defaultValue: 'Learning quests' })}</div>
          <div className="text-xs text-slate-400">
            ({q.doneCount}/{q.total})
          </div>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {q.quests.map((quest) => (
            <li key={quest.id} className="flex items-start gap-2">
              {quest.completed ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" aria-label={t('quests.done', { defaultValue: 'Done' })} />
              ) : (
                <Circle size={16} className="mt-0.5 shrink-0 text-slate-500" aria-label={t('quests.todo', { defaultValue: 'To do' })} />
              )}
              <div className={quest.completed ? 'text-slate-400' : 'text-slate-200'}>
                {quest.text}
                <span className="ml-2">
                  <EduTooltip text={quest.tip} />
                </span>
                {!quest.completed && quest.target ? (
                  <button
                    type="button"
                    onClick={() => q.point(quest.target!)}
                    className="ml-2 text-xs text-amber-300 underline hover:text-amber-200"
                  >
                    {t('quests.showMe', { defaultValue: 'Show me' })}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </LearningQuestsPortal>
  );
}

/** Inline "Next quest" card: the first unfinished quest, its hint, and a "Show me" button. */
export function NextQuestCard({ q, className = '' }: { q: DemoQuests; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={`rounded-xl border border-amber-800/60 bg-amber-950/20 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <ListTodo size={16} className="text-amber-300" />
          {q.next
            ? t('quests.next', { defaultValue: 'Next quest ({{n}}/{{total}})', n: q.doneCount + 1, total: q.total })
            : t('quests.allDone', { defaultValue: 'All quests complete!' })}
        </div>
        <div className="flex gap-1" aria-hidden>
          {q.quests.map((quest) => (
            <span key={quest.id} className={`h-1.5 w-4 rounded-full ${quest.completed ? 'bg-emerald-400' : 'bg-slate-700'}`} />
          ))}
        </div>
      </div>
      {q.next ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-slate-100">{q.next.text}</div>
            <div className="text-xs text-slate-400">{q.next.tip}</div>
          </div>
          {q.next.target ? (
            <button
              type="button"
              onClick={() => q.point(q.next!.target!)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500"
            >
              {t('quests.showMe', { defaultValue: 'Show me' })}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-1 text-xs text-slate-300">
          {t('quests.allDoneHint', { defaultValue: 'Nice work. Keep experimenting with the controls to explore other scenarios.' })}
        </div>
      )}
    </div>
  );
}
