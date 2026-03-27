import type { VercelRequest, VercelResponse } from '@vercel/node';
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
    const data = await redis(['HGETALL', KEY]);
    res.status(200).json({ overrides: parseHgetallResult(data) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Failed to fetch demo status overrides' });
  }
}
