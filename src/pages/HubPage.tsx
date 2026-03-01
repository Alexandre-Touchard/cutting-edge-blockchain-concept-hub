import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Hub, { type DemoMeta } from '../ui/Hub';
import DemoDetailsModal from '../ui/DemoDetailsModal';
import { loadDemos } from '../demos/loadDemos';

export default function HubPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  // Recompute translated demo metadata whenever the language changes.
  const demos = useMemo(() => loadDemos(), [i18n.resolvedLanguage]);

  // Store selection by id so the modal content updates immediately on language change.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo<DemoMeta | null>(
    () => (selectedId ? demos.map((d) => d.meta).find((m) => m.id === selectedId) ?? null : null),
    [selectedId, demos]
  );

  return (
    <>
      <Hub demos={demos.map((d) => d.meta)} onOpenDemo={(demo) => setSelectedId(demo.id)} />

      <DemoDetailsModal
        demo={selected}
        onClose={() => setSelectedId(null)}
        onStart={(demoId) => navigate(`/demo/${demoId}`)}
      />
    </>
  );
}
