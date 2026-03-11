# Deploying the custom Analytics (Supabase + Vercel)

This repo includes a small custom analytics system:

- Client-side tracking posts to `POST /api/track`
- A private analytics dashboard at `/a/:slug/analytics` fetches data from `GET /api/stats`
- The stats endpoint is protected by **Basic Auth** + an **unguessable URL slug**

> Note: **The current implementation in this repo uses Upstash Redis** (`UPSTASH_REDIS_REST_URL/TOKEN`) for storage.
>
> If you want analytics to be stored in **Supabase**, you’ll need a small storage-layer swap in the API routes (`api/track.ts` and `api/stats.ts`).
> This document explains (1) how to deploy what’s already here on Vercel, and (2) how to move storage to Supabase.

---

## 0) Prerequisites

- A Vercel account (Free tier is OK)
- A Supabase account
- You can run locally:
  - `npm install`
  - `npm run typecheck`
  - `npm run build`

---

## 1) How the private analytics page works

The analytics dashboard route is:

```
/a/<YOUR_SECRET_SLUG>/analytics
```

### Slug vs secret slug
In this project, the `:slug` part of the URL **is the secret**.

- You do **not** “find” it in Supabase or Vercel.
- You **choose** it (ideally a random string).
- It must match the Vercel env var `ANALYTICS_SLUG`.

To view stats, the dashboard calls:

- `GET /api/stats?days=7|14|30`

The request includes:

- `Authorization: Basic base64(username:password)`
- `x-analytics-slug: <YOUR_SECRET_SLUG>`

So you get 2 layers of protection:

1. The URL is hard to guess (`/a/<slug>/analytics`)
2. The API requires credentials + the slug

### How to generate a good secret slug

**Option A (recommended): generate a random slug locally**

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

This prints something like:

```
c9f1c2b07c3a4b2b9c9e2d4a3f1a8b7d
```

Use that value as:
- `ANALYTICS_SLUG`
- the URL segment in `/a/<slug>/analytics`

**Option B:** generate a random string with a password manager

### Example
If your Vercel domain is:

- `https://myproject.vercel.app`

and your slug is:

- `c9f1c2b07c3a4b2b9c9e2d4a3f1a8b7d`

then your dashboard URL is:

```
https://myproject.vercel.app/a/c9f1c2b07c3a4b2b9c9e2d4a3f1a8b7d/analytics
```

---

## 2) Vercel deployment (site + serverless endpoints)

1) Push your repository to GitHub/GitLab.

2) In Vercel:
- **New Project** → import your repo
- Framework preset: **Vite** (Vercel usually auto-detects)

3) Ensure these build settings:
- Build command: `npm run build`
- Output directory: `dist`

4) Deploy.

### Verify
After deploy:
- Open the site
- Navigate between pages → this generates pageviews
- Open your dashboard URL:
  - `https://<your-domain>/a/<slug>/analytics`

---

## 3) Supabase setup (storage)

### 3.1 Create a Supabase project

- Go to https://supabase.com/
- Create a new project

### 3.2 Create tables

A minimal schema that supports your current UI needs:

#### Table: `analytics_events`

```sql
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),

  -- "pageview" or "event"
  type text not null,

  -- current path (e.g. "/", "/demo/wallet-transaction-lifecycle")
  path text,

  -- optional demo id (e.g. "wallet-transaction-lifecycle")
  demo_id text,

  -- event name (e.g. "demo_view", "demo_start")
  event text,

  -- hashed fingerprint (privacy-friendly unique approximation)
  fp_hash text
);

create index if not exists analytics_events_ts_idx on public.analytics_events (ts);
create index if not exists analytics_events_type_idx on public.analytics_events (type);
create index if not exists analytics_events_path_idx on public.analytics_events (path);
create index if not exists analytics_events_demo_id_idx on public.analytics_events (demo_id);
create index if not exists analytics_events_event_idx on public.analytics_events (event);
```

### 3.3 Security (recommended)

Do **not** write to Supabase directly from the browser.

Instead:
- Browser → `POST /api/track`
- Vercel function writes to Supabase using the **Service Role key** stored in Vercel env vars.

That way, your database key is never exposed to users.

> If you enable RLS, you can keep inserts restricted and only allow the service role to insert.

---

## 4) Required environment variables (Vercel)

In Vercel → Project → Settings → Environment Variables:

### 4.1 Analytics dashboard protection

- `ANALYTICS_USER` — your dashboard username
- `ANALYTICS_PASS` — your dashboard password
- `ANALYTICS_SLUG` — the **secret slug you choose** (a long random string; e.g. 24+ chars)

Example:
- `ANALYTICS_SLUG = 5hB3g8sJk2Pq9zX7mN4vT1rA`

### 4.2 Supabase credentials

- `SUPABASE_URL` — from Supabase project settings
- `SUPABASE_SERVICE_ROLE_KEY` — **keep secret** (server-side only)

---

## 5) Code changes required to use Supabase (storage-layer swap)

The repo currently persists analytics using **Upstash Redis** in:

- `api/track.ts`
- `api/stats.ts`

To move to Supabase:

1) Add the dependency:

```bash
npm install @supabase/supabase-js
```

2) In `api/track.ts`:
- Create a Supabase client using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Replace the Redis counter increments with an `insert` into `analytics_events`
  - `type = 'pageview'` or `'event'`
  - `path`, `demo_id`, `event`
  - `fp_hash` (you can reuse the current SHA-256 of `ip + user-agent`)

3) In `api/stats.ts`:
- Validate Basic Auth + slug as it does today
- Query Supabase for aggregated stats:
  - Daily pageviews: `count(*)` grouped by day where `type='pageview'`
  - Daily uniques: `count(distinct fp_hash)` grouped by day
  - Top paths: `count(*)` grouped by `path` where `type='pageview'`
  - Top demos: `count(*)` grouped by `demo_id` where `type='pageview' and demo_id is not null`
  - Top events: `count(*)` grouped by `event` where `type='event'`

A simple approach is to use SQL views or RPC:

```sql
-- Example: pageviews per day (UTC)
select
  to_char(date_trunc('day', ts at time zone 'utc'), 'YYYY-MM-DD') as day,
  count(*) as pageviews
from public.analytics_events
where type='pageview'
  and ts >= now() - (interval '1 day' * $1)
group by 1
order by 1;
```

> Tip: You can keep your API response format identical to the current `/api/stats` output
> so the React dashboard (`src/pages/AnalyticsPage.tsx`) doesn’t need changes.

---

## 6) Using the dashboard

1) Generate a secret slug (see Section 1).
2) Set it in Vercel env vars as `ANALYTICS_SLUG`.
3) Deploy.
4) Visit:

```
https://<your-domain>/a/<ANALYTICS_SLUG>/analytics
```

5) Enter `ANALYTICS_USER` + `ANALYTICS_PASS`.

---

## 7) Troubleshooting

### Dashboard says Unauthorized
- Ensure `ANALYTICS_USER`, `ANALYTICS_PASS`, `ANALYTICS_SLUG` are set in Vercel env vars
- Ensure you’re visiting the matching URL slug

### No data
- Navigate around the site to generate pageviews
- Open a couple of demos (it tracks `demo_view` and `demo_start`)
- Confirm `POST /api/track` is reachable (Network tab)

### Supabase errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Check Supabase logs
- If using RLS, confirm your policies allow inserts for the service role
