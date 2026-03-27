import type { DemoMeta } from '../ui/Hub';

export type DemoStatus = NonNullable<DemoMeta['status']>; // 'live' | 'coming_soon'

// We only store explicit overrides. Absence means "use default" (typically live/available).
// For the first admin feature, we only need to override to coming_soon.
export type DemoStatusOverrides = Record<string, DemoStatus>;

export async function fetchDemoStatusOverrides(): Promise<DemoStatusOverrides> {
  const res = await fetch('/api/demo_status', { method: 'GET' });
  if (!res.ok) throw new Error(`Failed to fetch demo status overrides (${res.status})`);
  const data = (await res.json()) as { overrides?: Record<string, string> };
  const overrides: DemoStatusOverrides = {};
  for (const [k, v] of Object.entries(data.overrides ?? {})) {
    if (v === 'coming_soon' || v === 'live') overrides[k] = v;
  }
  return overrides;
}

export function applyDemoStatusOverrides(demos: DemoMeta[], overrides: DemoStatusOverrides): DemoMeta[] {
  if (!overrides || Object.keys(overrides).length === 0) return demos;
  return demos.map((d) => {
    const ov = overrides[d.id];
    // Allow overriding status explicitly.
    return ov ? { ...d, status: ov } : d;
  });
}
