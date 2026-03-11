export type AnalyticsTrackPayload =
  | {
      type: 'pageview';
      path: string;
      demoId?: string;
    }
  | {
      type: 'event';
      event: string;
      path?: string;
      demoId?: string;
    };

let lastPv: { path: string; at: number } | null = null;

function post(payload: AnalyticsTrackPayload) {
  const body = JSON.stringify(payload);

  // Prefer sendBeacon for non-blocking unload-safe analytics.
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      (navigator as any).sendBeacon('/api/track', blob);
      return;
    } catch {
      // fall back to fetch
    }
  }

  // Keepalive allows the request to complete during navigation (supported by modern browsers).
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {
    // ignore
  });
}

export function trackPageView(path: string, demoId?: string) {
  // Dedupe (helps in React StrictMode/dev and accidental double navigations)
  const now = Date.now();
  if (lastPv && lastPv.path === path && now - lastPv.at < 1000) return;
  lastPv = { path, at: now };

  post({ type: 'pageview', path, demoId });
}

export function trackEvent(event: string, props?: { path?: string; demoId?: string }) {
  post({ type: 'event', event, ...props });
}
