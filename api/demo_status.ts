// Demo status overrides API
// Returns { overrides: { [demoId]: 'live' | 'coming_soon' } }
//
// IMPORTANT: This file is intentionally self-contained (no local imports) to avoid
// Vercel "FUNCTION_INVOCATION_FAILED" crashes caused by module-init/import issues.

type DemoStatus = 'live' | 'coming_soon';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: any) => void;
};

function header(req: VercelRequest, name: string): string {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0] ?? '';
  return '';
}

function debugAuthorized(req: VercelRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const provided = header(req, 'x-admin-token');
  return provided === expected;
}

function wantsDebug(req: VercelRequest): boolean {
  const q = req.query['debug'];
  const v = Array.isArray(q) ? q[0] : q;
  return v === '1' && debugAuthorized(req);
}

async function supabaseFetch(path: string) {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

  const controller = new AbortController();
  const timeoutMs = Number(process.env.SUPABASE_HTTP_TIMEOUT_MS ?? '8000');
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(`${url}${path}`, {
    method: 'GET',
    signal: controller.signal,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  }).finally(() => clearTimeout(t));

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase request failed (${res.status}) on ${path}: ${text}`);
  }
  return (await res.json()) as any;
}

async function fetchOverridesFromSupabase(): Promise<Record<string, DemoStatus>> {
  const q = new URLSearchParams({
    select: 'demo_id,status',
    order: 'demo_id.asc',
    limit: '2000'
  });
  const rows = (await supabaseFetch(`/rest/v1/demo_status_overrides?${q.toString()}`)) as Array<{
    demo_id: string;
    status: string;
  }>;

  const out: Record<string, DemoStatus> = {};
  for (const r of rows ?? []) {
    if (r?.demo_id && (r.status === 'live' || r.status === 'coming_soon')) {
      out[String(r.demo_id)] = r.status;
    }
  }
  return out;
}

async function fetchOverridesFromUpstash(): Promise<Record<string, DemoStatus>> {
  const base = (process.env.UPSTASH_REDIS_REST_URL ?? '').replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';
  if (!base || !token) throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');

  const res = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(['HGETALL', 'demo_status_overrides'])
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upstash request failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as any;
  const arr = data?.result ?? data;
  if (!Array.isArray(arr)) return {};

  const out: Record<string, DemoStatus> = {};
  for (let i = 0; i < arr.length; i += 2) {
    const k = String(arr[i]);
    const v = String(arr[i + 1]);
    if (v === 'live' || v === 'coming_soon') out[k] = v;
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const dbg = wantsDebug(req);

  // Prefer Supabase when configured.
  const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    if (hasSupabase) {
      const overrides = await fetchOverridesFromSupabase();
      res.status(200).json(dbg ? { overrides, backend: 'supabase' } : { overrides });
      return;
    }

    if (hasUpstash) {
      const overrides = await fetchOverridesFromUpstash();
      res.status(200).json(dbg ? { overrides, backend: 'upstash' } : { overrides });
      return;
    }

    res.status(200).json(
      dbg
        ? {
            overrides: {},
            backend: 'none',
            note: 'No backend configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (recommended) or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.'
          }
        : { overrides: {} }
    );
  } catch (e: any) {
    if (dbg) {
      res.status(500).json({
        overrides: {},
        backend: hasSupabase ? 'supabase' : hasUpstash ? 'upstash' : 'none',
        error: e?.message ?? String(e)
      });
      return;
    }

    // In prod, do not break the app.
    res.status(200).json({ overrides: {} });
  }
}
