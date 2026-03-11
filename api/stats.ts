import { parseRedisHgetall, parseRedisInt, redisPipeline } from './_upstash';

export const config = { runtime: 'nodejs' };

function json(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function unauthorized(res: any) {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'Basic realm="Analytics"');
  json(res, 401, { ok: false, error: 'Unauthorized' });
}

function getBasicAuth(req: any): { user: string; pass: string } | null {
  const h = String(req.headers['authorization'] ?? '');
  if (!h.startsWith('Basic ')) return null;
  const b64 = h.slice('Basic '.length).trim();
  let decoded = '';
  try {
    decoded = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return null;
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) return null;
  return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function shiftDays(date: Date, deltaDays: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d;
}

function mergeCounts(target: Record<string, number>, add: Record<string, number>) {
  for (const [k, v] of Object.entries(add)) {
    target[k] = (target[k] ?? 0) + v;
  }
}

function topN(map: Record<string, number>, n: number) {
  return Object.entries(map)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export default async function handler(req: any, res: any) {
  try {
    // Auth: Basic + secret slug header
    const expectedUser = process.env.ANALYTICS_USER ?? '';
    const expectedPass = process.env.ANALYTICS_PASS ?? '';
    const expectedSlug = process.env.ANALYTICS_SLUG ?? '';

    const auth = getBasicAuth(req);
    const slug = String(req.headers['x-analytics-slug'] ?? '');

    if (!auth || auth.user !== expectedUser || auth.pass !== expectedPass) {
      unauthorized(res);
      return;
    }
    if (expectedSlug && slug !== expectedSlug) {
      unauthorized(res);
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days') ?? '14') || 14));

    const today = new Date();
    const dayList: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      dayList.push(dayKey(shiftDays(today, -i)));
    }

    // Pipeline day series counts
    const seriesCmds: Array<Array<string | number>> = [];
    for (const day of dayList) {
      seriesCmds.push(['GET', `analytics:pv:day:${day}`]);
      seriesCmds.push(['SCARD', `analytics:uv:day:${day}`]);
    }

    const results: any[] = await redisPipeline(seriesCmds);

    const series: Array<{ day: string; pageviews: number; uniques: number }> = [];
    let idx = 0;
    for (const day of dayList) {
      const pvItem = results[idx++];
      const uvItem = results[idx++];
      const pvRaw = pvItem?.result ?? pvItem;
      const uvRaw = uvItem?.result ?? uvItem;
      series.push({ day, pageviews: parseRedisInt(pvRaw), uniques: parseRedisInt(uvRaw) });
    }

    // Aggregate top paths/demos/events over the range
    const topPathsAgg: Record<string, number> = {};
    const topDemosAgg: Record<string, number> = {};
    const topEventsAgg: Record<string, number> = {};

    // Fetch per-day hashes (bounded: max 30 days -> 90 HGETALL calls)
    const hashCmds: Array<Array<string | number>> = [];
    for (const day of dayList) {
      hashCmds.push(['HGETALL', `analytics:path:day:${day}`]);
      hashCmds.push(['HGETALL', `analytics:demo:day:${day}`]);
      hashCmds.push(['HGETALL', `analytics:event:day:${day}`]);
    }

    const hashResults: any[] = await redisPipeline(hashCmds);
    let hIdx = 0;
    for (const day of dayList) {
      const pathItem = hashResults[hIdx++];
      const demoItem = hashResults[hIdx++];
      const eventItem = hashResults[hIdx++];

      const pathRes = pathItem?.result ?? pathItem;
      const demoRes = demoItem?.result ?? demoItem;
      const eventRes = eventItem?.result ?? eventItem;

      mergeCounts(topPathsAgg, parseRedisHgetall(pathRes));
      mergeCounts(topDemosAgg, parseRedisHgetall(demoRes));
      mergeCounts(topEventsAgg, parseRedisHgetall(eventRes));
    }

    const totals = series.reduce(
      (acc, d) => {
        acc.pageviews += d.pageviews;
        // uniques are not additive across days; keep as "sum of daily uniques" (useful, not exact)
        acc.sumDailyUniques += d.uniques;
        return acc;
      },
      { pageviews: 0, sumDailyUniques: 0 }
    );

    json(res, 200, {
      ok: true,
      rangeDays: days,
      totals,
      series,
      topPaths: topN(topPathsAgg, 15),
      topDemos: topN(topDemosAgg, 15),
      topEvents: topN(topEventsAgg, 15)
    });
  } catch (e: any) {
    json(res, 500, { ok: false, error: e?.message ?? 'Internal error' });
  }
}
