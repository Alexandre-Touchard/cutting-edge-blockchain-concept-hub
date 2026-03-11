// Minimal Upstash Redis REST client for Vercel Serverless Functions.
// Uses Node.js built-in fetch (Node 18+).

type UpstashCommand = Array<string | number>;

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function upstashBaseUrl(): string {
  // e.g. https://us1-something.upstash.io
  return mustGetEnv('UPSTASH_REDIS_REST_URL').replace(/\/+$/, '');
}

function upstashToken(): string {
  return mustGetEnv('UPSTASH_REDIS_REST_TOKEN');
}

async function upstashFetch(path: string, body: unknown) {
  const res = await fetch(`${upstashBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${upstashToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upstash request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as any;
}

export async function redis(cmd: UpstashCommand) {
  // Upstash REST: POST / with a single command array
  return upstashFetch('', cmd);
}

export async function redisPipeline(cmds: UpstashCommand[]) {
  // Upstash REST pipeline: POST /pipeline with list of command arrays
  const data = await upstashFetch('/pipeline', cmds);

  // Depending on Upstash client/version, pipeline responses can be either:
  // - an array: [{ result, error }, ...]
  // - or an object: { result: [{ result, error }, ...] }
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).result)) return (data as any).result;
  return [];
}

export function parseRedisInt(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  return 0;
}

export function parseRedisHgetall(v: unknown): Record<string, number> {
  // Redis HGETALL returns an array: [field1, value1, field2, value2, ...]
  if (!Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (let i = 0; i < v.length; i += 2) {
    const k = String(v[i]);
    const val = v[i + 1];
    out[k] = parseRedisInt(val);
  }
  return out;
}
