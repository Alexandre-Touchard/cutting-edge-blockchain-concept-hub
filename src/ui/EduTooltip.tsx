import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

export type EduTooltipProps = {
  /** Tooltip content. Kept as `text` to be drop-in compatible with existing demos. */
  text: React.ReactNode;
  /**
   * Optional label/term to render. If provided, we render both the term (underlined) and the info icon.
   * If you pass `children`, `term` is ignored.
   */
  term?: React.ReactNode;
  /**
   * Optional custom trigger content. If provided, we will also render an info icon by default (mode C).
   */
  children?: React.ReactNode;
  /** Show the info icon trigger (in addition to children/term). Default: true */
  showIcon?: boolean;
  /** Tooltip max width preset. */
  widthClassName?: string;
};

/**
 * Educational tooltip used across demos.
 *
 * Trigger behavior (user preference: C):
 * - If `children`/`term` is present => both term text and info icon trigger the tooltip.
 * - If no `children`/`term` => the info icon alone triggers the tooltip.
 */
export default function EduTooltip({
  text,
  children,
  term,
  showIcon = true,
  widthClassName = 'w-80 md:w-96',
}: EduTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const trigger = children ?? term;

  const iconRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);

  const [coords, setCoords] = useState<{
    side: 'top' | 'bottom';
    left: number;
    top: number;
    arrowLeft: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const iconEl = iconRef.current;
    const tipEl = tooltipRef.current;
    if (!iconEl || !tipEl) return;

    const rect = iconEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Measure tooltip
    const tipRect = tipEl.getBoundingClientRect();
    const tipW = tipRect.width;
    const tipH = tipRect.height;

    const margin = 8;
    const iconCenterX = rect.left + rect.width / 2;

    // Prefer above; flip below if not enough space.
    const preferTop = rect.top >= tipH + 16;
    const side: 'top' | 'bottom' = preferTop ? 'top' : 'bottom';

    const unclampedLeft = iconCenterX - tipW / 2;
    const left = Math.max(margin, Math.min(unclampedLeft, vw - tipW - margin));

    const top =
      side === 'top'
        ? Math.max(margin, rect.top - tipH - 8)
        : Math.min(vh - tipH - margin, rect.bottom + 8);

    // Arrow X inside tooltip (clamp so it doesn't touch edges)
    const arrowLeft = Math.max(12, Math.min(iconCenterX - left, tipW - 12));

    setCoords({ side, left, top, arrowLeft });
  }, [open, text, widthClassName]);

  const arrowSideClass =
    coords?.side === 'top'
      ? 'top-full -mt-1 border-t-blue-500'
      : 'bottom-full -mb-1 border-b-blue-500';

  return (
    <span className="relative inline-flex items-center gap-1 align-middle">
      {trigger ? <span className="inline">{trigger}</span> : null}

      {showIcon ? (
        <span
          ref={iconRef}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-describedby={open ? tooltipId : undefined}
          tabIndex={0}
          className="cursor-help"
        >
          <Info size={14} className="text-blue-400 inline" />
        </span>
      ) : null}

      {open ? (
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          style={{
            maxWidth: 'calc(100vw - 1rem)',
            maxHeight: 'calc(100vh - 1rem)',
            position: 'fixed',
            left: coords?.left ?? 8,
            top: coords?.top ?? 8
          }}
          className={`z-50 ${widthClassName} bg-slate-950 border border-blue-500 rounded-lg p-3 text-xs text-slate-200 shadow-xl whitespace-normal overflow-auto`}
        >
          {text}
          <span
            className={`absolute ${arrowSideClass} border-4 border-transparent`}
            style={{ left: coords?.arrowLeft ?? 16, transform: 'translateX(-50%)' }}
          />
        </span>
      ) : null}
    </span>
  );
}
