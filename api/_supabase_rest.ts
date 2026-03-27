// Minimal Supabase PostgREST client for Vercel Serverless Functions.
// Uses the Service Role key server-side (never expose it to the browser).

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function hasSupabaseEnv(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function supabaseUrl(): string {
  return mustGetEnv('SUPABASE_URL').replace(/\/+$/, '');
}

function serviceRoleKey(): string {
  return mustGetEnv('SUPABASE_SERVICE_ROLE_KEY');
}

export type SupabaseEventRow = {
  ts: string;
  type: 'pageview' | 'event';
  path: string | null;
  demo_id: string | null;
  event: string | null;
  fp_hash: string | null;
};

async function sbFetch(path: string, init: RequestInit) {
  const key = serviceRoleKey();

  // Avoid Vercel function hard timeouts when Supabase is misconfigured or unreachable.
  const controller = new AbortController();
  const timeoutMs = Number(process.env.SUPABASE_HTTP_TIMEOUT_MS ?? '8000');
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(`${supabaseUrl()}${path}`, {
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

  // Some requests use Prefer: return=minimal
  if (res.status === 204) return null;

  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await res.json()) as any;
  return await res.text();
}

export async function insertAnalyticsEvent(row: {
  type: 'pageview' | 'event';
  path?: string;
  demo_id?: string;
  event?: string;
  fp_hash?: string;
}) {
  const body = {
    type: row.type,
    path: row.path ?? null,
    demo_id: row.demo_id ?? null,
    event: row.event ?? null,
    fp_hash: row.fp_hash ?? null
  };

  await sbFetch('/rest/v1/analytics_events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(body)
  });
}

export type DemoStatusOverrideRow = {
  demo_id: string;
  status: 'live' | 'coming_soon';
  updated_at: string;
};

export async function fetchDemoStatusOverrides(): Promise<Record<string, 'live' | 'coming_soon'>> {
  const q = new URLSearchParams({
    select: 'demo_id,status',
    order: 'demo_id.asc',
    limit: '2000'
  });
  const data = (await sbFetch(`/rest/v1/demo_status_overrides?${q.toString()}`, {
    method: 'GET'
  })) as Array<{ demo_id: string; status: string }>;

  const out: Record<string, 'live' | 'coming_soon'> = {};
  for (const row of data ?? []) {
    if (row?.demo_id && (row.status === 'live' || row.status === 'coming_soon')) {
      out[String(row.demo_id)] = row.status;
    }
  }
  return out;
}

export async function upsertDemoStatusOverride(demoId: string, status: 'live' | 'coming_soon') {
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

export async function deleteDemoStatusOverride(demoId: string) {
  await sbFetch(`/rest/v1/demo_status_overrides?demo_id=eq.${encodeURIComponent(demoId)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal'
    }
  });
}

export async function fetchAnalyticsEventsRange(params: {
  startIso: string;
  endIso: string;
  limit?: number;
  offset?: number;
}): Promise<SupabaseEventRow[]> {
  const limit = params.limit ?? 1000;
  const offset = params.offset ?? 0;

  const q = new URLSearchParams({
    select: 'ts,type,path,demo_id,event,fp_hash',
    order: 'ts.asc',
    limit: String(limit),
    offset: String(offset),
    ts: `gte.${params.startIso}`
  });
  // PostgREST doesn't support multiple `ts` params with URLSearchParams easily; append manually.
  const base = `/rest/v1/analytics_events?${q.toString()}&ts=lt.${encodeURIComponent(params.endIso)}`;

  const data = await sbFetch(base, { method: 'GET' });
  return (data ?? []) as SupabaseEventRow[];
}
