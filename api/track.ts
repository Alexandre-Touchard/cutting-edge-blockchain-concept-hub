import { createHash } from 'crypto';
import { redisPipeline } from './_upstash';

export const config = { runtime: 'nodejs' };

function dayKey(d: Date): string {
  // YYYY-MM-DD in UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function getClientIp(req: any): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress ?? '';
}

function fingerprint(req: any): string {
  // Privacy note: we only keep a hashed fingerprint for approximate unique counts.
  const ip = getClientIp(req);
  const ua = String(req.headers['user-agent'] ?? '');
  const raw = `${ip}|${ua}`;
  return createHash('sha256').update(raw).digest('hex');
}

function json(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const now = new Date();
    const day = dayKey(now);

    const type = String(body?.type ?? 'event');
    const path = typeof body?.path === 'string' ? body.path.slice(0, 200) : '';
    const demoId = typeof body?.demoId === 'string' ? body.demoId.slice(0, 100) : '';
    const event = typeof body?.event === 'string' ? body.event.slice(0, 100) : '';

    // TTL to keep analytics small and inexpensive (90 days)
    const ttlSeconds = 90 * 24 * 60 * 60;

    const cmds: Array<Array<string | number>> = [];

    // Total counters
    if (type === 'pageview') {
      cmds.push(['INCR', 'analytics:pv:total']);
      cmds.push(['INCR', `analytics:pv:day:${day}`]);
      cmds.push(['EXPIRE', `analytics:pv:day:${day}`, ttlSeconds]);

      if (path) {
        cmds.push(['HINCRBY', `analytics:path:day:${day}`, path, 1]);
        cmds.push(['EXPIRE', `analytics:path:day:${day}`, ttlSeconds]);
      }
      if (demoId) {
        cmds.push(['HINCRBY', `analytics:demo:day:${day}`, demoId, 1]);
        cmds.push(['EXPIRE', `analytics:demo:day:${day}`, ttlSeconds]);
      }
    } else {
      const e = event || 'event';
      cmds.push(['HINCRBY', `analytics:event:day:${day}`, e, 1]);
      cmds.push(['EXPIRE', `analytics:event:day:${day}`, ttlSeconds]);
    }

    // Approximate unique visitors/day
    const fp = fingerprint(req);
    cmds.push(['SADD', `analytics:uv:day:${day}`, fp]);
    cmds.push(['EXPIRE', `analytics:uv:day:${day}`, ttlSeconds]);

    await redisPipeline(cmds);

    json(res, 200, { ok: true });
  } catch (e: any) {
    json(res, 500, { ok: false, error: e?.message ?? 'Internal error' });
  }
}
