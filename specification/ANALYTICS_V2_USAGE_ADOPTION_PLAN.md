# Analytics V2 – Usage & Adoption Tracking Plan

## Purpose
Current analytics focus on traffic (pageviews, daily uniques). This plan upgrades tracking so we can measure **usage and adoption**:

- **Activation:** do users start demos?
- **Engagement:** do they interact meaningfully?
- **Completion:** do they reach learning outcomes?
- **Retention:** do they come back (D1/D7/D30)?
- **Attribution:** what sources/lang/devices drive adoption?

This plan is designed to be privacy-friendly and work with the existing `/api/track` + `/api/stats` setup.

---

## Key concepts

### Anonymous user + session
To support retention and funnels without requiring login:

- `anonId`: random UUID stored in `localStorage` (long-lived).
- `sessionId`: random UUID stored in `sessionStorage` (new per tab session) or regenerated after inactivity (e.g., 30 min).

These replace/augment the current `fp_hash` (sha256 of ip+ua) which is not stable enough for retention.

### Event taxonomy (standardized)
Use consistent event names across demos so we can compare engagement.

**Discovery**
- `hub_view_details` – user opens demo details modal
- `hub_search` – query updated
- `hub_filter_change` – tag/category filter updated

**Activation**
- `demo_start` – user starts demo (enters interactive state)

**Engagement**
- `demo_interaction` – with `properties.action`:
  - `step`, `run_5`, `run_10`, `reset`
  - demo-specific actions: e.g. `apply_shock`, `apply_intervention`, `toggle_advanced`, `toggle_formulas`
- `demo_quest_completed` – with `properties.questId`

**Exit / time-on-demo**
- `demo_exit` – fired on route change/unload/visibilitychange with:
  - `properties.durationMs`
  - `properties.interactionsCount`

**Sharing**
- `share_copy_link`

---

## Recommended payload schema
Send on every `/api/track` request:

```json
{
  "event": "demo_interaction",
  "ts": 1710000000000,
  "path": "/demo/stablecoin-depeg",
  "demoId": "stablecoin-depeg",
  "anonId": "uuid",
  "sessionId": "uuid",
  "lang": "en",
  "referrer": "https://...",
  "viewport": "mobile|desktop",
  "appVersion": "gitSha-or-semver",
  "properties": {
    "action": "step",
    "questId": "basics.depeg"
  }
}
```

Notes:
- `properties` should be small and JSON-serializable.
- Avoid collecting PII.

---

## Adoption metrics to compute

### Per-demo funnel
For a given time window:

- **Views**: `demo_view` (or pageview of `/demo/:id`)
- **Starts**: `demo_start`
- **Engaged sessions**: sessions with `demo_interaction >= N` or `durationMs >= T`
- **Completions**: `demo_completed` or >= X quests completed

### Engagement depth
- interactions per session (p50/p90)
- time on demo (avg/median)
- top actions (`demo_interaction.action`)

### Retention
Using `anonId`:
- D1/D7/D30 returning users
- returning sessions per user

### Segmentation
Break down funnels by:
- language
- device class (mobile/desktop)
- referrer/source
- appVersion (before/after releases)

---

## Storage/aggregation options

### Option A (recommended long-term): Supabase raw events
Store each event row with `anonId/sessionId/demoId/event/properties`. Query for funnels, retention cohorts, and distributions.

Pros:
- flexible queries
- easier retention/funnel analysis

Cons:
- more storage
- requires SQL/indexing

### Option B: Upstash/Redis aggregates
Store counters and approximations:

- `INCR analytics:events:{event}:{day}`
- `INCR analytics:demo:{demoId}:{event}:{day}`
- `PFADD analytics:uv:{day} {anonId}` (HyperLogLog uniques)

Pros:
- fast, cheap
- simple dashboards

Cons:
- limited retention and cohort queries

Hybrid is also viable: store raw events for 7–30 days, keep aggregates forever.

---

## Dashboard upgrades (AnalyticsPage)
Add:
- Per-demo funnel (views → starts → engaged → completed)
- Avg/median time on demo
- Returning users (D1/D7)
- Top actions per demo

---

## Implementation steps (suggested)
1. **Client identity:** add `anonId` + `sessionId` generators.
2. **Client tracking:** emit `demo_start`, `demo_interaction`, `demo_exit` (duration + interaction count).
3. **Server track endpoint:** accept/store new fields.
4. **Stats endpoint:** compute funnels + engagement metrics.
5. **Analytics page UI:** display funnels/retention + segments.

---

## Privacy & compliance
- No names/emails.
- Avoid raw IP storage. If IP is needed for rate limits, keep it transient and don’t persist.
- Document what is collected and why.
- Provide an opt-out toggle if desired.
