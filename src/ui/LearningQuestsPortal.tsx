import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders its children into the DemoPage "Learning quests" dropdown.
 *
 * The dropdown provides a fixed DOM mount point (#learning-quests-portal).
 * Demos can render their quest content here so it appears inside the folded widget.
 */
export default function LearningQuestsPortal({
  children
}: {
  children: React.ReactNode;
}) {
  const [host, setHost] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setHost(document.getElementById('learning-quests-portal'));
  }, []);

  if (!host) return null;
  return createPortal(children, host);
}
