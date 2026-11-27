// Ecosystem-map analytics: event names sent by /map (and the demo pages' "See it on the map" link)
// and the summary computed by /api/stats. Shared by both sides (no imports) so the format can't drift.
//
// Events (ids are in the names because the Upstash backend only counts event names):
//   map:node:<nodeId>         a node's details were opened (Details, Enter, search, a connection, a tour step)
//   map:group:<groupId>       a group bubble was expanded
//   map:tour:<tourId>:start   a guided tour was started
//   map:tour:<tourId>:done    a guided tour reached its last screen
//   map:demo:<demoId>         map → demo: a demo link was followed from a node
//   map:from-demo:<demoId>    demo → map: "See it on the map" was clicked on a demo page
// Older deployments sent `map:demo` / `map:from-demo` without the id: counted in the totals only.

export const mapEvent = {
  node: (id: string) => `map:node:${id}`,
  group: (id: string) => `map:group:${id}`,
  tourStart: (id: string) => `map:tour:${id}:start`,
  tourDone: (id: string) => `map:tour:${id}:done`,
  toDemo: (demoId: string) => `map:demo:${demoId}`,
  fromDemo: (demoId: string) => `map:from-demo:${demoId}`
};

export type Count = { key: string; count: number };
export type TourRow = { id: string; started: number; done: number };

export type MapStats = {
  /** Pageviews of /map (any filters or deep link). */
  views: number;
  detailsOpened: number;
  topNodes: Count[];
  groupOpens: number;
  topGroups: Count[];
  tours: TourRow[];
  /** Map → demo clicks. */
  toDemo: number;
  topToDemos: Count[];
  /** Demo → map clicks. */
  fromDemo: number;
  topFromDemos: Count[];
};

const NODE_RE = /^map:node:(.+)$/;
const GROUP_RE = /^map:group:(.+)$/;
const TOUR_RE = /^map:tour:(.+):(start|done)$/;
const TO_DEMO_RE = /^map:demo(?::(.+))?$/;
const FROM_DEMO_RE = /^map:from-demo(?::(.+))?$/;
/** The /map page itself, with or without query and hash (not /mapping, /map/x…). */
const MAP_PATH_RE = /^\/map(?:[?#]|$)/;

function top(counts: Map<string, number>, n: number): Count[] {
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, n);
}

/** Summary of the map's use over the range, from the event counts and the page paths. */
export function mapStats(events: Record<string, number>, paths: Record<string, number>, topSize = 10): MapStats {
  const nodes = new Map<string, number>();
  const groups = new Map<string, number>();
  const tours = new Map<string, TourRow>();
  const toDemos = new Map<string, number>();
  const fromDemos = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  let toDemo = 0;
  let fromDemo = 0;

  for (const [name, count] of Object.entries(events)) {
    if (!name.startsWith('map:')) continue;
    let m: RegExpExecArray | null;
    if ((m = TOUR_RE.exec(name))) {
      const row = tours.get(m[1]) ?? { id: m[1], started: 0, done: 0 };
      if (m[2] === 'start') row.started += count;
      else row.done += count;
      tours.set(m[1], row);
    } else if ((m = FROM_DEMO_RE.exec(name))) {
      fromDemo += count;
      if (m[1]) add(fromDemos, m[1], count);
    } else if ((m = TO_DEMO_RE.exec(name))) {
      toDemo += count;
      if (m[1]) add(toDemos, m[1], count);
    } else if ((m = NODE_RE.exec(name))) add(nodes, m[1], count);
    else if ((m = GROUP_RE.exec(name))) add(groups, m[1], count);
  }

  let views = 0;
  for (const [path, count] of Object.entries(paths)) if (MAP_PATH_RE.test(path)) views += count;
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

  return {
    views,
    detailsOpened: sum(nodes),
    topNodes: top(nodes, topSize),
    groupOpens: sum(groups),
    topGroups: top(groups, topSize),
    tours: [...tours.values()].sort((a, b) => b.started - a.started || a.id.localeCompare(b.id)),
    toDemo,
    topToDemos: top(toDemos, topSize),
    fromDemo,
    topFromDemos: top(fromDemos, topSize)
  };
}
