# Upstash + Vercel Analytics Setup (and how to test)

This repo includes a custom analytics system backed by **Upstash Redis** (HTTP/REST) and deployed on **Vercel**.

- Tracking endpoint: `POST /api/track`
- Stats endpoint: `GET /api/stats?days=7|14|30`
- Private dashboard: `/a/:slug/analytics`

---

## 1) How Upstash works in this project

### What Upstash is
Upstash is a hosted Redis database that can be accessed via:
- normal Redis protocol (not used here), or
- **REST (HTTP) API** (used here)

### What we store
The project stores small aggregated metrics (not raw logs):

- **Total pageviews**
  - key: `analytics:pv:total`
- **Daily pageviews**
  - key: `analytics:pv:day:YYYY-MM-DD`
- **Top pages (per day)**
  - hash: `analytics:path:day:YYYY-MM-DD` (field = path, value = count)
- **Top demos (per day)**
  - hash: `analytics:demo:day:YYYY-MM-DD` (field = demoId, value = count)
- **Top events (per day)**
  - hash: `analytics:event:day:YYYY-MM-DD` (field = eventName, value = count)
- **Approx unique visitors/day**
  - set: `analytics:uv:day:YYYY-MM-DD` (member = SHA-256 hash of IP + user-agent)

Daily keys expire automatically after ~90 days.

---

## 2) Create the Upstash database and get env vars

### Step A — Create a Redis database
1. Go to: https://console.upstash.com/
2. Create / select a project
3. Go to **Redis** → **Create Database**
4. Choose a region close to your Vercel region (optional)
5. Create the database

### Step B — Find the REST URL and REST token
In the Upstash Console:

1. Open your Redis database
2. Go to the **REST API** section (sometimes shown on the main database page)

You’ll find:

- `UPSTASH_REDIS_REST_URL`
  - Looks like: `https://xxxxxx.upstash.io`
  - This is the base URL used by the REST API.

- `UPSTASH_REDIS_REST_TOKEN`
  - Looks like a long secret token
  - Used as a Bearer token:
    - `Authorization: Bearer <token>`

> If you don’t see “REST API” immediately, check tabs like **Details**, **REST API**, or **Connect**.

---

## 3) Set environment variables in Vercel

In Vercel:

1. Go to https://vercel.com/
2. Open your **Project**
3. Go to **Settings** → **Environment Variables**
4. Add these variables (Production + Preview recommended):

### A) Upstash variables (required)

- `UPSTASH_REDIS_REST_URL`
  - **Where to find it:** Upstash Console → your Redis DB → REST API section

- `UPSTASH_REDIS_REST_TOKEN`
  - **Where to find it:** Upstash Console → your Redis DB → REST API section

### B) Dashboard protection variables (required)

- `ANALYTICS_USER`
  - **Value:** choose it yourself (ex: `admin`)

- `ANALYTICS_PASS`
  - **Value:** choose it yourself (use a strong password)

- `ANALYTICS_SLUG`
  - **Value:** choose it yourself (a long random string)
  - Example: `c9f1c2b07c3a4b2b9c9e2d4a3f1a8b7d`
  - This slug is used in the URL: `/a/<slug>/analytics`

> After adding env vars, redeploy (or trigger a new deployment) so the functions get the new env.

---

## 4) Where each env var is used in the code

- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - used by: `api/_upstash.ts` (HTTP calls)
  - transitively used by: `api/track.ts`, `api/stats.ts`

- `ANALYTICS_USER`, `ANALYTICS_PASS`, `ANALYTICS_SLUG`
  - used by: `api/stats.ts` to protect the stats endpoint
  - the dashboard page (`src/pages/AnalyticsPage.tsx`) sends:
    - Basic Auth header
    - `x-analytics-slug` header

---

## 5) How to test (recommended: on Vercel)

### Step 1 — Deploy
After setting env vars, trigger a redeploy (or push a commit).

### Step 2 — Generate some traffic
Open your website and do a few actions:

- Visit the homepage `/`
- Open a demo page `/demo/<demoId>`
- Click **Start** from the demo modal

This triggers `POST /api/track` calls in the background.

### Step 3 — Open the dashboard
Go to:

```
https://<your-domain>/a/<ANALYTICS_SLUG>/analytics
```

Enter `ANALYTICS_USER` and `ANALYTICS_PASS` and click **View stats**.

You should see:
- pageviews totals
- daily trend
- top pages
- top demos
- top events (`demo_view`, `demo_start`, …)

---

## 6) Debugging / troubleshooting

### A) Dashboard says “Unauthorized”
Most common causes:
- `ANALYTICS_USER` / `ANALYTICS_PASS` mismatch
- You visited the wrong slug (`/a/<slug>/analytics` must match `ANALYTICS_SLUG`)
- Env vars were added but you didn’t redeploy

### B) Dashboard loads but shows no data
- You haven’t generated traffic yet
- Check in the browser Network tab that `/api/track` requests are returning `200`

### C) `/api/track` returns 500
Usually means Upstash env vars are missing or incorrect.
Confirm in Vercel env vars:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

---

## 7) Inspecting raw data in Upstash (keys + values)

### A) Using the Upstash Console (Data Browser)

1. Open https://console.upstash.com/
2. Select your **Redis** database
3. Open the **Data Browser** (or similar section for browsing keys)

Useful commands/queries to run:

- List some analytics keys:
  - `KEYS analytics:*`

- Read today’s pageviews counter:
  - `GET analytics:pv:day:YYYY-MM-DD`

- See top pages today:
  - `HGETALL analytics:path:day:YYYY-MM-DD`

- See top demos today:
  - `HGETALL analytics:demo:day:YYYY-MM-DD`

- See events today:
  - `HGETALL analytics:event:day:YYYY-MM-DD`

- Approx daily unique count:
  - `SCARD analytics:uv:day:YYYY-MM-DD`

> Tip: the day format is **UTC** `YYYY-MM-DD`.

### B) Using Upstash REST directly (curl)

Upstash REST expects a JSON array containing the Redis command.

**REST URL**: `${UPSTASH_REDIS_REST_URL}`

**Auth**:

```
Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}
```

Examples:

```bash
# Total pageviews
curl -s "${UPSTASH_REDIS_REST_URL}" \
  -H "Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '["GET","analytics:pv:total"]'

# Top pages for a given day
curl -s "${UPSTASH_REDIS_REST_URL}" \
  -H "Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '["HGETALL","analytics:path:day:2026-03-11"]'

# Daily uniques (approx)
curl -s "${UPSTASH_REDIS_REST_URL}" \
  -H "Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '["SCARD","analytics:uv:day:2026-03-11"]'
```

---

## 8) Optional: simple manual endpoint tests

### Test `POST /api/track`
Use the browser console on your deployed site:

```js
fetch('/api/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'event', event: 'manual_test', path: window.location.pathname })
}).then(r => r.json()).then(console.log)
```

### Test `GET /api/stats`
You can’t easily call this without Basic Auth + slug, but the dashboard page does it for you.

---

## 9) Notes on privacy

- Unique visitors are **approximate** and use a hash of IP + user-agent.
- You can remove unique tracking if you want stricter privacy (remove the `SADD analytics:uv...` part in `api/track.ts`).
