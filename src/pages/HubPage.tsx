import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Hub, { type DemoMeta } from '../ui/Hub';
import DemoDetailsModal from '../ui/DemoDetailsModal';
import { loadDemos } from '../demos/loadDemos';
import { trackEvent } from '../analytics/client';

const evmVsSvmComingSoonThumb = new URL('../public/photo/Demo13.png', import.meta.url).href;

export default function HubPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  // Recompute translated demo metadata whenever the language changes.
  const demos = useMemo(() => {
    const loaded = loadDemos();

    // Append a disabled "Coming soon" card.
    return [
      ...loaded,
      {
        meta: {
          id: 'evm-vs-svm',
          title: 'EVM vs SVM',
          category: 'execution',
          difficulty: 'Beginner',
          thumbnail: evmVsSvmComingSoonThumb,
          description: 'Coming soon: a visual simulation comparing sequential (EVM-style) execution vs parallel (SVM-style) execution.',
          concepts: ['Sequential Execution', 'Parallel Execution', 'Conflicts', 'Throughput'],
          keyTakeaways: ['Understand why parallel execution can increase throughput and where conflicts reduce it'],
          tags: ['Coming soon'],
          status: 'coming_soon'
        } satisfies DemoMeta,
        load: async () => ({ default: () => null }),
        sourcePath: 'evm-vs-svm-coming-soon'
      }
    ];
  }, [i18n.resolvedLanguage]);

  // Store selection by id so the modal content updates immediately on language change.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo<DemoMeta | null>(() => {
    if (!selectedId) return null;

    // Do not open modal for coming-soon card.
    if (selectedId === 'evm-vs-svm') return null;

    return demos.map((d) => d.meta).find((m) => m.id === selectedId) ?? null;
  }, [selectedId, demos]);

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white">
        <Hub demos={demos.map((d) => d.meta)} onOpenDemo={(demo) => setSelectedId(demo.id)} />

      </div>

      <DemoDetailsModal
        demo={selected}
        onClose={() => setSelectedId(null)}
        onStart={(demoId) => {
          trackEvent('demo_start', { demoId, path: '/' });
          navigate(`/demo/${demoId}`);
        }}
      />
    </>
  );
}
