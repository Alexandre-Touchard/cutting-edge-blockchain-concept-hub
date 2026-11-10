// Admin endpoint to set demo status overrides.
// Protected via ADMIN_TOKEN (x-admin-token header).
//
// Self-contained to avoid Vercel FUNCTION_INVOCATION_FAILED due to module-import issues.

import { createHash, timingSafeEqual } from 'crypto';

type DemoStatus = 'live' | 'coming_soon';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: any) => void;
};

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

async function sbFetch(path: string, init: RequestInit) {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

  const controller = new AbortController();
  const timeoutMs = Number(process.env.SUPABASE_HTTP_TIMEOUT_MS ?? '8000');
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(`${url}${path}`, {
    ...init,
    signal: controller.signal,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.headers ?? {})
    }
  }).finally(() => clearTimeout(t));

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase request failed (${res.status}) on ${path}: ${text}`);
  }

  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await res.json()) as any;
  return await res.text();
}

async function upsertOverride(demoId: string, status: DemoStatus) {
  const q = new URLSearchParams({ on_conflict: 'demo_id' });
  await sbFetch(`/rest/v1/demo_status_overrides?${q.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=merge-duplicates'
    },
    body: JSON.stringify({ demo_id: demoId, status })
  });
}

async function deleteOverride(demoId: string) {
  await sbFetch(`/rest/v1/demo_status_overrides?demo_id=eq.${encodeURIComponent(demoId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
}

async function upstash(cmd: Array<string | number>) {
  const base = (process.env.UPSTASH_REDIS_REST_URL ?? '').replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';
  if (!base || !token) throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');

  const res = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cmd)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upstash request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as any;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const expected = process.env.ADMIN_TOKEN ?? '';
  if (!expected) {
    console.error('admin_demo_status: ADMIN_TOKEN env var is not set');
    res.status(503).json({ error: 'Admin is not configured' });
    return;
  }

  const provided = getProvidedToken(req);
  if (!provided || !safeEqual(provided, expected)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Past this point the caller is an authenticated admin, so detailed errors are OK.
  try {

    const wantsDebug = String(req.query.debug ?? '') === '1';

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
      demoId?: string;
      status?: DemoStatus | null;
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

    const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

    if (hasSupabase) {
      if (status === null) await deleteOverride(demoId);
      else await upsertOverride(demoId, status);
      res.status(200).json(wantsDebug ? { ok: true, backend: 'supabase' } : { ok: true });
      return;
    }

    if (hasUpstash) {
      if (status === null) await upstash(['HDEL', 'demo_status_overrides', demoId]);
      else await upstash(['HSET', 'demo_status_overrides', demoId, status]);
      res.status(200).json(wantsDebug ? { ok: true, backend: 'upstash' } : { ok: true });
      return;
    }

    res.status(500).json({
      error:
        'No backend configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (recommended) or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Failed to update demo status' });
  }
}
