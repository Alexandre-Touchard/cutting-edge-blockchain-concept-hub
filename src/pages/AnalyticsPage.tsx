import React, { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';

type StatsResponse =
  | { ok: false; error: string }
  | {
      ok: true;
      rangeDays: number;
      totals: { pageviews: number; sumDailyUniques: number };
      series: Array<{ day: string; pageviews: number; uniques: number }>;
      topPaths: Array<{ key: string; count: number }>;
      topDemos: Array<{ key: string; count: number }>;
      topEvents: Array<{ key: string; count: number }>;
    };

function basicAuthHeader(user: string, pass: string): string {
  // btoa expects latin1; this keeps it simple for typical credentials.
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

export default function AnalyticsPage() {
  const { slug } = useParams();
  const analyticsSlug = slug ?? '';

  const [days, setDays] = useState<number>(14);

  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsResponse | null>(null);

  const storage = useMemo(() => (remember ? localStorage : sessionStorage), [remember]);

  // Load saved credentials (if any)
  React.useEffect(() => {
    try {
      const savedUser = localStorage.getItem('analytics_user') ?? '';
      const savedPass = localStorage.getItem('analytics_pass') ?? '';
      if (savedUser && savedPass) {
        setUser(savedUser);
        setPass(savedPass);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats?days=${encodeURIComponent(String(days))}`, {
        headers: {
          Authorization: basicAuthHeader(user, pass),
          'x-analytics-slug': analyticsSlug
        }
      });
      const payload = (await res.json()) as StatsResponse;
      setData(payload);
      if (payload.ok === false) setError(payload.error);

      if (payload.ok === true) {
        try {
          // Save only if user opted in
          storage.setItem('analytics_user', user);
          storage.setItem('analytics_pass', pass);
        } catch {
          // ignore
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch stats');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [analyticsSlug, days, pass, storage, user]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </Link>
            <div className="font-semibold">Analytics</div>
          </div>

          <button
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-lg font-semibold">Login</div>
          <div className="text-sm text-slate-400 mt-1">
            This page is protected by a password and a secret URL slug.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Username"
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-slate-500"
            />
            <input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Password"
              type="password"
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-slate-500"
            />
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember
              </label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="ml-auto px-3 py-2 rounded-lg bg-slate-950 border border-slate-700"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={fetchStats}
              disabled={loading || !user || !pass || !analyticsSlug}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              View stats
            </button>
            {!analyticsSlug ? (
              <span className="text-sm text-amber-300">Missing URL slug</span>
            ) : (
              <span className="text-xs text-slate-500">slug: {analyticsSlug.slice(0, 4)}…</span>
            )}
            {loading && <span className="text-sm text-slate-400">Loading…</span>}
            {error && <span className="text-sm text-red-300">{error}</span>}
          </div>
        </div>

        {(() => {
          const okData = data && data.ok === true ? data : null;
          if (!okData) return null;
          return (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="text-sm text-slate-400">Pageviews (range)</div>
                <div className="text-3xl font-bold mt-2">{okData.totals.pageviews.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="text-sm text-slate-400">Daily uniques (sum)</div>
                <div className="text-3xl font-bold mt-2">{okData.totals.sumDailyUniques.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-2">
                  Note: this is the sum of unique visitors per day, not de-duplicated across days.
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-lg font-semibold">Daily trend</div>
              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400">
                    <tr className="text-left">
                      <th className="py-2 pr-4">Day (UTC)</th>
                      <th className="py-2 pr-4">Pageviews</th>
                      <th className="py-2 pr-4">Uniques</th>
                    </tr>
                  </thead>
                  <tbody>
                    {okData.series.map((d) => (
                      <tr key={d.day} className="border-t border-slate-800">
                        <td className="py-2 pr-4 font-mono text-slate-300">{d.day}</td>
                        <td className="py-2 pr-4">{d.pageviews.toLocaleString()}</td>
                        <td className="py-2 pr-4">{d.uniques.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TopList title="Top pages" items={okData.topPaths} />
              <TopList title="Top demos" items={okData.topDemos.map((x) => ({ ...x, key: `/demo/${x.key}` }))} />
              <TopList title="Top events" items={okData.topEvents} />
            </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function TopList({ title, items }: { title: string; items: Array<{ key: string; count: number }> }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="text-sm text-slate-500">No data yet</div>
        ) : (
          items.map((it) => (
            <div key={it.key} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-200 truncate" title={it.key}>
                  {it.key}
                </div>
              </div>
              <div className="text-sm font-mono text-slate-300">{it.count.toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
