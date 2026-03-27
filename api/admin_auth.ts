import type { VercelRequest, VercelResponse } from '@vercel/node';

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
      res.status(401).json({ ok: false });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Failed to validate admin token' });
  }
}
