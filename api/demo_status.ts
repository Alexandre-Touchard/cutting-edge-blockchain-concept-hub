import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hasSupabaseEnv, fetchDemoStatusOverrides } from './_supabase_rest';
import { redis } from './_upstash';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Prefer Supabase when configured (you already use it for analytics).
    if (hasSupabaseEnv()) {
      const overrides = await fetchDemoStatusOverrides();
      res.status(200).json({ overrides });
      return;
    }

    // Fallback: Upstash Redis (optional).
    const data = await redis(['HGETALL', KEY]);
    res.status(200).json({ overrides: parseHgetallResult(data) });
  } catch (err: any) {
    res.status(500).json({
      error:
        err?.message ??
        'Failed to fetch demo status overrides. Configure SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.'
    });
  }
}
