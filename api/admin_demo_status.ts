import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis } from './_upstash';

const KEY = 'demo_status_overrides';

function mustGetAdminToken() {
  const token = process.env.ADMIN_TOKEN;
  if (!token) throw new Error('Missing ADMIN_TOKEN env var');
  return token;
}

function getProvidedToken(req: VercelRequest) {
  const header = req.headers['x-admin-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const q = req.query.token;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const expected = mustGetAdminToken();
    const provided = getProvidedToken(req);
    if (!provided || provided !== expected) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
      demoId?: string;
      status?: 'live' | 'coming_soon' | null;
    };

    const demoId = (body?.demoId ?? '').trim();
    if (!demoId) {
      res.status(400).json({ error: 'demoId is required' });
      return;
    }

    const status = body?.status ?? null;
    if (status !== null && status !== 'live' && status !== 'coming_soon') {
      res.status(400).json({ error: 'status must be live, coming_soon, or null' });
      return;
    }

    if (status === null) {
      await redis(['HDEL', KEY, demoId]);
    } else {
      await redis(['HSET', KEY, demoId, status]);
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Failed to update demo status' });
  }
}
