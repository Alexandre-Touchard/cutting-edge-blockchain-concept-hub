import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, timingSafeEqual } from 'crypto';

// Constant-time string comparison. Hashing first gives equal-length buffers,
// so neither the content nor the length of the secret leaks through timing.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Header only: query-string tokens end up in logs and browser history.
function getProvidedToken(req: VercelRequest) {
  const header = req.headers['x-admin-token'];
  return typeof header === 'string' ? header.trim() : '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const expected = process.env.ADMIN_TOKEN ?? '';
  if (!expected) {
    console.error('admin_auth: ADMIN_TOKEN env var is not set');
    res.status(503).json({ ok: false, error: 'Admin is not configured' });
    return;
  }

  const provided = getProvidedToken(req);
  if (!provided || !safeEqual(provided, expected)) {
    res.status(401).json({ ok: false });
    return;
  }

  res.status(200).json({ ok: true });
}
