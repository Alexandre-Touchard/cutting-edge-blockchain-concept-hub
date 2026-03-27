import React, { useEffect, useMemo, useState } from 'react';
import { loadDemos } from '../demos/loadDemos';
import type { DemoMeta } from '../ui/Hub';
import { applyDemoStatusOverrides, fetchDemoStatusOverrides, type DemoStatusOverrides } from '../demos/demoStatusOverrides';

async function adminSetDemoStatus(params: {
  token: string;
  demoId: string;
  status: 'live' | 'coming_soon' | null;
}) {
  const res = await fetch('/api/admin_demo_status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': params.token
    },
    body: JSON.stringify({ demoId: params.demoId, status: params.status })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Admin update failed (${res.status}): ${text}`);
  }
}

async function adminAuth(token: string) {
  const res = await fetch('/api/admin_auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token
    }
  });
  if (!res.ok) return false;
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
  return Boolean(data.ok);
}

export default function AdminPage() {
  const demos = useMemo(() => loadDemos().map((d) => d.meta), []);

  const [token, setToken] = useState(() => localStorage.getItem('admin_token') ?? '');
  const [authed, setAuthed] = useState(false);

  const [overrides, setOverrides] = useState<DemoStatusOverrides>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    if (!authed) return;
    setLoading(true);
    setError(null);
    try {
      const ov = await fetchDemoStatusOverrides();
      setOverrides(ov);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // If we have a stored token, validate it once.
  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    adminAuth(token).then((ok) => {
      if (cancelled) return;
      setAuthed(ok);
      if (!ok) setError('Invalid admin token');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const demosWithOverrides: DemoMeta[] = useMemo(
    () => applyDemoStatusOverrides(demos, overrides),
    [demos, overrides]
  );

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-bold">Admin login</h1>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm text-slate-300 font-semibold">Admin token</div>
            <div className="mt-2 flex gap-2">
              <input
                value={token}
                onChange={(e) => {
                  const v = e.target.value;
                  setToken(v);
                  localStorage.setItem('admin_token', v);
                }}
                placeholder="ADMIN_TOKEN"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
              />
              <button
                type="button"
                disabled={!token}
                onClick={async () => {
                  setError(null);
                  const ok = await adminAuth(token);
                  if (ok) {
                    setAuthed(true);
                    await refresh();
                  } else {
                    setAuthed(false);
                    setError('Invalid admin token');
                  }
                }}
                className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm disabled:opacity-50"
              >
                Login
              </button>
            </div>
            {error ? <div className="mt-2 text-sm text-red-300">{error}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Admin</h1>
          <button
            type="button"
            onClick={refresh}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-300 font-semibold">Authenticated</div>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('admin_token');
                setToken('');
                setAuthed(false);
              }}
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
            >
              Logout
            </button>
          </div>
          {error ? <div className="mt-2 text-sm text-red-300">{error}</div> : null}
        </div>

        <div className="mt-6">
          <div className="text-sm text-slate-400">Toggle a demo from coming soon to available.</div>

          {loading ? (
            <div className="mt-4 text-slate-300">Loading…</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3">
              {demosWithOverrides.map((d) => {
                const isComingSoon = d.status === 'coming_soon';
                return (
                  <div key={d.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-100">{d.title}</div>
                        <div className="text-xs text-slate-400">id: {d.id}</div>
                        <div className="mt-1 text-xs">
                          <span
                            className={
                              isComingSoon
                                ? 'px-2 py-0.5 rounded border border-amber-500/40 bg-amber-950/20 text-amber-200'
                                : 'px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                            }
                          >
                            {isComingSoon ? 'coming_soon' : 'live'}
                          </span>
                          {overrides[d.id] ? (
                            <span className="ml-2 text-slate-400">(overridden)</span>
                          ) : (
                            <span className="ml-2 text-slate-500">(default)</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!token || busyId === d.id}
                          onClick={async () => {
                            setBusyId(d.id);
                            try {
                              await adminSetDemoStatus({
                                token,
                                demoId: d.id,
                                status: isComingSoon ? 'live' : 'coming_soon'
                              });
                              await refresh();
                            } catch (e: any) {
                              setError(e?.message ?? String(e));
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm disabled:opacity-50"
                        >
                          {isComingSoon ? 'Make live' : 'Mark coming soon'}
                        </button>

                        <button
                          type="button"
                          disabled={!token || busyId === d.id || !overrides[d.id]}
                          onClick={async () => {
                            setBusyId(d.id);
                            try {
                              await adminSetDemoStatus({ token, demoId: d.id, status: null });
                              await refresh();
                            } catch (e: any) {
                              setError(e?.message ?? String(e));
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm disabled:opacity-50"
                        >
                          Clear override
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
