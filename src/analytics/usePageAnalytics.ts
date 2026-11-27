import { useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { trackPageView } from './client';

/** Pages whose URL changes as you use them (selection in the hash, filters in the query): one pageview per visit. */
const ONE_VIEW_PER_VISIT = new Set(['/map']);

/** Whether moving from `prevPathname` to `pathname` counts as a new pageview. */
export function isNewPageView(prevPathname: string | null, pathname: string): boolean {
  return !(prevPathname === pathname && ONE_VIEW_PER_VISIT.has(pathname));
}

export function usePageAnalytics() {
  const location = useLocation();
  const params = useParams();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathname.current;
    prevPathname.current = location.pathname;
    // Exclude the public analytics dashboard from pageview counts.
    // Rationale: it is an internal/admin view and can distort adoption metrics.
    if (/^\/a\/[^/]+\/analytics$/.test(location.pathname)) return;
    // Selecting a node or changing a filter on the map is not a new pageview (map events count those).
    if (!isNewPageView(prev, location.pathname)) return;

    const path = `${location.pathname}${location.search}${location.hash}`;
    const demoId = location.pathname.startsWith('/demo/') ? (params as any).demoId : undefined;
    trackPageView(path, demoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
}
