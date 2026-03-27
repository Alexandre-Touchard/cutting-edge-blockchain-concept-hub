import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Hub, { type DemoMeta } from '../ui/Hub';
import DemoDetailsModal from '../ui/DemoDetailsModal';
import { loadDemos } from '../demos/loadDemos';
import { trackEvent } from '../analytics/client';
import {
  applyDemoStatusOverrides,
  fetchDemoStatusOverrides,
  type DemoStatusOverrides
} from '../demos/demoStatusOverrides';

export default function HubPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  // Recompute translated demo metadata whenever the language changes.
  const demos = useMemo(() => loadDemos(), [i18n.resolvedLanguage]);

  const [statusOverrides, setStatusOverrides] = useState<DemoStatusOverrides>({});
  useEffect(() => {
    fetchDemoStatusOverrides().then(setStatusOverrides).catch(() => setStatusOverrides({}));
  }, []);

  const demoMetas = useMemo(
    () => applyDemoStatusOverrides(demos.map((d) => d.meta), statusOverrides),
    [demos, statusOverrides]
  );

  // Store selection by id so the modal content updates immediately on language change.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo<DemoMeta | null>(() => {
    if (!selectedId) return null;

    const found = demoMetas.find((m) => m.id === selectedId) ?? null;
    if (found?.status === 'coming_soon') return null;

    return found;
  }, [selectedId, demoMetas]);

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white">
        <Hub demos={demoMetas} onOpenDemo={(demo) => setSelectedId(demo.id)} />

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
