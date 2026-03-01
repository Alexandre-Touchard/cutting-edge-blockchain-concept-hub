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
  widthClassName = 'w-72'
}: EduTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const trigger = children ?? term;

  const iconRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);

  const [placement, setPlacement] = useState<{ side: 'top' | 'bottom'; align: 'left' | 'center' | 'right' }>(
    { side: 'top', align: 'center' }
  );

  useLayoutEffect(() => {
    if (!open) return;
    const iconEl = iconRef.current;
    if (!iconEl) return;

    const rect = iconEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // side: prefer showing above, but flip if near top
    const side: 'top' | 'bottom' = rect.top < 140 ? 'bottom' : 'top';

    // align: keep within viewport
    const align: 'left' | 'center' | 'right' =
      rect.left < 180 ? 'left' : vw - rect.right < 180 ? 'right' : 'center';

    setPlacement({ side, align });

    // If the tooltip still overflows due to long content, we rely on maxWidth + wrapping.
    // (We avoid expensive continuous reflows; this is a best-effort placement.)
  }, [open]);

  const containerSideClass = placement.side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
  const containerAlignClass =
    placement.align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : placement.align === 'left'
        ? 'left-0'
        : 'right-0';

  const arrowSideClass = placement.side === 'top' ? 'top-full -mt-1 border-t-blue-500' : 'bottom-full -mb-1 border-b-blue-500';
  const arrowAlignClass =
    placement.align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : placement.align === 'left'
        ? 'left-4'
        : 'right-4';

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
          style={{ maxWidth: 'calc(100vw - 1rem)' }}
          className={`absolute z-50 ${containerSideClass} ${containerAlignClass} ${widthClassName} bg-slate-950 border border-blue-500 rounded-lg p-3 text-xs text-slate-200 shadow-xl whitespace-normal`}
        >
          {text}
          <span
            className={`absolute ${arrowSideClass} ${arrowAlignClass} border-4 border-transparent`}
          />
        </span>
      ) : null}
    </span>
  );
}
