// "Click here" hints shared by demos: a pulsing amber ring on a control, for a few seconds.
// Respects prefers-reduced-motion (Tailwind's motion-safe: variant disables the pulse).
import { useCallback, useEffect, useState } from 'react';

/** Classes for a hinted control. */
export const ATTENTION_CLASSES = 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950 motion-safe:animate-pulse';

/**
 * Pulse for a few seconds after mount, stop early as soon as the user interacts.
 * Returns [active, stop].
 */
export function useAttentionHint(durationMs = 10_000): [boolean, () => void] {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setActive(false), durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs]);
  const stop = useCallback(() => setActive(false), []);
  return [active, stop];
}

/**
 * One pulsing target at a time, identified by a key (e.g. "run", "threads").
 * `point(key)` scrolls to the element with data-hint="<key>" and pulses it for `durationMs`.
 */
export function usePulseTarget(durationMs = 8_000) {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const t = window.setTimeout(() => setTarget(null), durationMs);
    return () => window.clearTimeout(t);
  }, [target, durationMs]);

  const point = useCallback((key: string, scroll = true) => {
    setTarget(key);
    if (scroll && typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.querySelector(`[data-hint="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 30);
    }
  }, []);

  const clear = useCallback(() => setTarget(null), []);
  /** Classes to add on the element for `key` (empty unless it is the current target). */
  const pulse = useCallback((key: string) => (target === key ? ATTENTION_CLASSES : ''), [target]);

  return { target, point, clear, pulse };
}
