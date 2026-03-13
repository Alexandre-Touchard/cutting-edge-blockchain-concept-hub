import React, { Suspense, useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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

  const demo = demos.find((d) => d.meta.id === demoId);

  useEffect(() => {
    if (demoId) trackEvent('demo_view', { demoId, path: `/demo/${demoId}` });
  }, [demoId]);

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

  const DemoComponent = useMemo(
    () =>
      React.lazy(async () => {
        const mod = await demo.load();
        return { default: mod.default };
      }),
    [demo.sourcePath]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
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
          </div>

          <div className="min-w-0 text-right flex items-center gap-3">
            <div className="min-w-0 text-right">
              <div className="text-sm text-slate-400 whitespace-nowrap hidden sm:block">{t('nav.nowViewing')}</div>
              <div className="font-semibold truncate">{demo.meta.title}</div>
            </div>
            <LanguageSwitcher className="md:hidden" />
          </div>
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

          <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-2 relative z-20">
            <span>{t('modal.keyConcepts')}</span>
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
