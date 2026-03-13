import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DemoMeta } from './Hub';
import EduTooltip from './EduTooltip';
import { getConceptChip } from './concepts';

export default function DemoDetailsModal({
  demo,
  onClose,
  onStart
}: {
  demo: DemoMeta | null;
  onClose: () => void;
  onStart: (demoId: string) => void;
}) {
  const { t } = useTranslation();
  if (!demo) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('modal.demoDetails')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-4 p-4 sm:p-6 border-b border-slate-800">
          <div className="min-w-0">
            <div className="text-sm text-slate-400">{t('modal.demoDetails')}</div>
            <h2 className="text-2xl font-bold truncate">{demo.title}</h2>
            <p className="text-slate-300 mt-2">{demo.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
            aria-label={t('modal.close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 overflow-auto">
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2">{t('modal.keyConcepts')}</div>
            <ul className="space-y-2">
              {demo.concepts.map((concept) => {
                const chip = getConceptChip(concept, demo.category);
                const def = chip.definition ?? t('common.definitionComingSoon');
                const Icon = chip.Icon;

                return (
                  <li key={concept} className="text-sm text-slate-200 flex items-start gap-2">
                    <span className="mt-0.5 text-slate-300">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0">
                      {concept} <EduTooltip text={def} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2">{t('modal.keyTakeaways')}</div>
            <ul className="space-y-2">
              {demo.keyTakeaways.map((t, i) => (
                <li key={i} className="text-sm text-slate-200">• {t}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-800 flex flex-col md:flex-row gap-3 justify-end bg-slate-900">
          <button
            onClick={onClose}
            className="w-full md:w-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
          >
            {t('modal.cancel')}
          </button>
          <button
            onClick={() => onStart(demo.id)}
            disabled={demo.status === 'coming_soon'}
            className={`w-full md:w-auto px-4 py-2 rounded-lg border font-semibold ${
              demo.status === 'coming_soon'
                ? 'bg-slate-700 border-slate-600 text-slate-200 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 border-blue-500'
            }`}
          >
            {demo.status === 'coming_soon'
              ? t('common.comingSoon', { defaultValue: 'Coming soon' })
              : t('modal.startDemo')}
          </button>
        </div>
      </div>
    </div>
  );
}
