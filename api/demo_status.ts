import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hasSupabaseEnv, fetchDemoStatusOverrides } from './_supabase_rest';
import { hasUpstashEnv, redis } from './_upstash';

const KEY = 'demo_status_overrides';

function parseHgetallResult(data: any): Record<string, string> {
  const arr = data?.result ?? data;
  if (!Array.isArray(arr)) return {};
  const out: Record<string, string> = {};
  for (let i = 0; i < arr.length; i += 2) {
    const k = String(arr[i]);
    const v = String(arr[i + 1]);
    out[k] = v;
  }
  return out;
}

function debugAuthorized(req: VercelRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const provided = typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'] : '';
  return provided === expected;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const wantsDebug = String(req.query.debug ?? '') === '1' && debugAuthorized(req);

  try {
    // Prefer Supabase when configured (you already use it for analytics).
    if (hasSupabaseEnv()) {
      const overrides = await fetchDemoStatusOverrides();
      res.status(200).json(wantsDebug ? { overrides, backend: 'supabase' } : { overrides });
      return;
    }

    // Fallback: Upstash Redis (optional).
    if (hasUpstashEnv()) {
      const data = await redis(['HGETALL', KEY]);
      const overrides = parseHgetallResult(data);
      res.status(200).json(wantsDebug ? { overrides, backend: 'upstash' } : { overrides });
      return;
    }

    // No backend configured: return empty overrides (do not break the app).
    res.status(200).json(
      wantsDebug
        ? {
            overrides: {},
            backend: 'none',
            note: 'No backend configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (recommended) or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.'
          }
        : { overrides: {} }
    );
  } catch (err: any) {
    // In production we prefer not to take down the UI; return empty overrides.
    if (wantsDebug) {
      res.status(500).json({
        overrides: {},
        backend: hasSupabaseEnv() ? 'supabase' : hasUpstashEnv() ? 'upstash' : 'none',
        error: err?.message ?? String(err)
      });
      return;
    }

    res.status(200).json({ overrides: {} });
  }
}
