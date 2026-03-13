import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { trackPageView } from './client';

export function usePageAnalytics() {
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    // Exclude the public analytics dashboard from pageview counts.
    // Rationale: it is an internal/admin view and can distort adoption metrics.
    if (/^\/a\/[^/]+\/analytics$/.test(location.pathname)) return;

    const path = `${location.pathname}${location.search}${location.hash}`;
    const demoId = location.pathname.startsWith('/demo/') ? (params as any).demoId : undefined;
    trackPageView(path, demoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
}
