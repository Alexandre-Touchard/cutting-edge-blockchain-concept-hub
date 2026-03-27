import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { applyDemoStatusOverrides, fetchDemoStatusOverrides, type DemoStatusOverrides } from '../demos/demoStatusOverrides';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, ListTodo, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { loadDemos } from '../demos/loadDemos';
import EduTooltip from '../ui/EduTooltip';
import { getConceptChip } from '../ui/concepts';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import { trackEvent } from '../analytics/client';

export default function DemoPage() {
  const { t, i18n } = useTranslation();
  const { demoId } = useParams();
  const location = useLocation();
  const previewEnabled = useMemo(() => {
    const p = new URLSearchParams(location.search);
    return p.get('preview') === '1';
  }, [location.search]);
  // Recompute translated demo metadata whenever the language changes.
  const demos = useMemo(() => loadDemos(), [i18n.resolvedLanguage]);

  const [statusOverrides, setStatusOverrides] = useState<DemoStatusOverrides>({});
  useEffect(() => {
    fetchDemoStatusOverrides().then(setStatusOverrides).catch(() => setStatusOverrides({}));
  }, []);

  const demosWithOverrides = useMemo(
    () =>
      demos.map((d) => ({
        ...d,
        meta: applyDemoStatusOverrides([d.meta], statusOverrides)[0]!
      })),
    [demos, statusOverrides]
  );

  const demo = demosWithOverrides.find((d) => d.meta.id === demoId);

  const [questsFolded, setQuestsFolded] = useState(true);
  const [questsBlink, setQuestsBlink] = useState(false);

  const questsTotal = demo?.meta.learningQuestsTotal ?? 0;

  // Blink folded Learning Quests indicator for 10s after page load (per demo)
  useEffect(() => {
    if (!demo?.meta) return;
    setQuestsFolded(true);
    setQuestsBlink(true);
    const t = window.setTimeout(() => setQuestsBlink(false), 10_000);
    return () => window.clearTimeout(t);
  }, [demo?.meta?.id]);

  useEffect(() => {
    if (demoId) trackEvent('demo_view', { demoId, path: `/demo/${demoId}` });
  }, [demoId]);

  // IMPORTANT: keep hook order stable across renders.
  // demo availability can change after fetching status overrides (coming_soon -> live),
  // so we must not introduce new hooks only after early returns.
  const DemoComponent = useMemo(
    () =>
      React.lazy(async (): Promise<{ default: React.ComponentType<any> }> => {
        if (!demo) return { default: () => null };
        const mod = await demo.load();
        return { default: mod.default as React.ComponentType<any> };
      }),
    [demo?.sourcePath]
  );

  if (!demo) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300">
            <ArrowLeft size={16} /> {t('nav.backToHub')}
          </Link>
          <h1 className="text-2xl font-bold mt-6">{t('nav.demoNotFound')}</h1>
          <p className="text-slate-400 mt-2">{t('nav.unknownDemoId', { id: demoId })}</p>
        </div>
      </div>
    );
  }

  if (demo.meta.status === 'coming_soon' && !previewEnabled) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300">
            <ArrowLeft size={16} /> {t('nav.backToHub')}
          </Link>
          <h1 className="text-2xl font-bold mt-6">{demo.meta.title}</h1>
          <p className="text-slate-300 mt-2">{t('common.comingSoon', { defaultValue: 'Coming soon' })}</p>
          <p className="text-slate-400 mt-3">{demo.meta.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors whitespace-nowrap"
            >
              <ArrowLeft size={16} />
              {t('nav.backToHub')}
            </Link>
            <LanguageSwitcher className="hidden md:inline-flex" />

            {/* Desktop: learning quests widget next to language switcher */}
            <button
              type="button"
              onClick={() => {
                setQuestsFolded((v) => !v);
                setQuestsBlink(false);
              }}
              aria-expanded={!questsFolded}
              className={`hidden md:inline-flex items-center gap-2 px-2 py-1 rounded-lg border text-xs text-slate-200 transition-colors ${
                questsBlink
                  ? 'border-amber-500 bg-amber-900/20 motion-safe:animate-pulse'
                  : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
              }`}
              title={t('learning_quests_2at4ec', { defaultValue: 'Learning quests' })}
            >
              <ListTodo size={14} className={questsBlink ? 'text-amber-300' : 'text-slate-200'} />
              <span className="font-semibold">{questsTotal}</span>
              <span className="text-slate-400">{questsFolded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</span>
            </button>
          </div>

          <div className="min-w-0 text-right flex items-center gap-3">
            <div className="min-w-0 text-right">
              <div className="text-sm text-slate-400 whitespace-nowrap hidden sm:block">{t('nav.nowViewing')}</div>
              <div className="font-semibold truncate">{demo.meta.title}</div>
            </div>
            <LanguageSwitcher className="md:hidden" />

            {/* Mobile: learning quests widget next to language switcher */}
            <button
              type="button"
              onClick={() => {
                setQuestsFolded((v) => !v);
                setQuestsBlink(false);
              }}
              aria-expanded={!questsFolded}
              className={`md:hidden inline-flex items-center gap-2 px-2 py-1 rounded-lg border text-xs text-slate-200 transition-colors ${
                questsBlink
                  ? 'border-amber-500 bg-amber-900/20 motion-safe:animate-pulse'
                  : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
              }`}
              title={t('learning_quests_2at4ec', { defaultValue: 'Learning quests' })}
            >
              <ListTodo size={14} className={questsBlink ? 'text-amber-300' : 'text-slate-200'} />
              <span className="font-semibold">{questsTotal}</span>
              <span className="text-slate-400">{questsFolded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</span>
            </button>
          </div>
        </div>

        {/* Learning Quests dropdown content (portal target). Kept mounted so demos can portal into it. */}
        <div
          className={`absolute right-4 sm:right-6 top-full mt-2 w-[92vw] max-w-[520px] rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl z-50 ${
            questsFolded ? 'hidden' : ''
          }`}
          role="dialog"
          aria-label={t('learning_quests_2at4ec', { defaultValue: 'Learning quests' })}
        >
          <div className="flex items-center justify-end gap-3 mb-2">
            <button
              type="button"
              onClick={() => setQuestsFolded(true)}
              className="p-1 rounded-md hover:bg-slate-800 border border-slate-800"
              aria-label={t('modal.close', { defaultValue: 'Close' })}
            >
              <X size={14} />
            </button>
          </div>
          {questsTotal === 0 ? (
            <div className="text-sm text-slate-400">{t('common.comingSoon', { defaultValue: 'Coming soon' })}</div>
          ) : null}
          <div id="learning-quests-portal" className="mt-3 max-h-[70vh] overflow-auto pr-1" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 relative overflow-hidden">
          {/* Big demo icon on the right (does not change card size) */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-35 z-10 pointer-events-none select-none drop-shadow">
            {/(\.png|\.jpe?g|\.webp|\.svg)(\?.*)?$/i.test(demo.meta.thumbnail) ? (
              <img src={demo.meta.thumbnail} alt="" className="h-16 w-16 object-contain" />
            ) : (
              <span aria-hidden className="text-6xl leading-none">{demo.meta.thumbnail}</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 relative z-20 mb-2">
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-2">
              <span>{t('modal.keyConcepts')}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pr-20 relative z-20">
            {demo.meta.concepts.map((concept) => {
              const chip = getConceptChip(concept, demo.meta.category);
              const Icon = chip.Icon;
              const def = chip.definition ?? t('common.definitionComingSoon');
              return (
                <span
                  key={concept}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs sm:text-sm text-slate-200 max-w-[46vw] sm:max-w-none"
                >
                  <Icon size={14} className="text-slate-300" />
                  <span className="leading-snug line-clamp-2">{concept}</span>
                  <EduTooltip text={def} />
                </span>
              );
            })}
          </div>
        </div>

        <Suspense
          fallback={
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-200">
              <div className="text-sm text-slate-400">{t('common.loading', { defaultValue: 'Loading demo…' })}</div>
              <div className="mt-2 font-semibold">{demo.meta.title}</div>
            </div>
          }
        >
          <DemoComponent />
        </Suspense>
      </div>
    </div>
  );
}
