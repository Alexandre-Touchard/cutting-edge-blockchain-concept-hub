# Terra (UST/LUNA) Depeg Scenario Spec (Teaching Simulation)

This document specifies the **Terra-style algorithmic stablecoin** scenario (UST ↔ LUNA) for `stablecoin_depeg_simulation.tsx`.

> Goal: improve realism while staying a **teaching simulation** (simple, explainable, stable defaults, visible feedback loops).

---

## 1) Entities and intuition

- **UST**: algorithmic stablecoin targeting **$1**.
- **LUNA**: reflexive backstop asset; mint/burn mechanism attempts to defend UST.
- **Anchor-like demand**: yield-driven demand for UST; when yields fade or withdrawals spike, UST sell pressure rises.
- **Swap throttles / capacity constraints**: when too many redemptions happen, the mechanism becomes capacity-bound, leading to **failed arbitrage** and rising panic.
- **LFG-style reserves**: discretionary reserve deployment can support UST temporarily, but depletion reduces credibility.

---

## 2) State variables (Algorithmic scenario)

> Names are suggestions; keep them consistent across UI, mechanics breakdown, and tooltips.

### Core market state
- `t` (tick)
- `ustPrice` (stable price, 0..~1.1)
- `lunaPrice` (backstop price)
- `ustSupply`
- `lunaSupply`

### Market depth (split)
- `ustDepth` (UST/USDC depth proxy)
- `lunaDepth` (LUNA/USD depth proxy)

### Demand + confidence
- `confidence` (0..1)
- `yieldSupport` (0..1)

### Anchor module
- `anchorTVL`
- `anchorYieldRate`
- `yieldReserve`
- `withdrawalRate` (fraction of TVL per tick)

### Redemption / swap constraints
- `mintCapPerTick` (max UST that can be swapped/burned per tick)
- `unfilledRedemption` (pressure from attempted-but-unexecuted redemptions; **not** a guaranteed FIFO queue)

### Reserves (LFG-like)
- `reserveUSD` (or `reserveBTCUsd`)
- `reserveDeployRateCapPerTick`
- `reservePolicy: 'auto' | 'manual'`
- `reserveEnabled` (optional)

### Drift / regimes
- `baselineDriftOn` (toggle): gradual confidence/yield erosion per tick

---

## 3) Per-tick mechanics (high-level)

Each tick should be explainable in a **mechanics breakdown** panel and the "Why did this happen?" overlay.

### 3.1 Demand & sell-flow decomposition
Compute explicit UST sell flow components:
- `sellWhaleUST`
- `sellAnchorOutflowUST` (from `withdrawalRate`)
- `sellFromLowSentimentUST` (function of `confidence` + `yieldSupport`)
- `sellFromUnfilledRedemptionUST` (pressure when arb fails)

`ustSellFlow = sum(components)`

### 3.2 UST price formation
UST price moves via depth-based impact:
- larger sell flow + lower `ustDepth` ⇒ larger negative `ΔustPrice`

### 3.3 Redemption requested vs executed (capacity-bound)
Compute redemption demand when UST < peg, but cap execution:
- `redemptionRequested` (function of peg deviation and confidence)
- `redemptionExecuted = min(redemptionRequested, mintCapPerTick)`
- `unfilledRedemption += (redemptionRequested - redemptionExecuted)`

**Important realism choice**: `unfilledRedemption` is modeled as **failed arbitrage pressure**, not as a queue that later clears automatically.

`unfilledRedemption` should:
- increase panic sell / sell pressure
- reduce confidence
- decay slowly only when peg is restored (demand for redemption collapses)

### 3.4 LUNA minting and reflexive LUNA price impact
When redemptions execute:
- UST burned reduces `ustSupply`
- LUNA minted increases `lunaSupply`

LUNA price impact should depend on:
- inflation (`ΔlunaSupply / lunaSupply`)
- `lunaDepth` (market impact)
- confidence (flight-to-safety / reflexivity)

### 3.5 Reserves support (LFG-like)
Reserve buys can add support to UST when below peg:
- In `auto` policy: deploy when `ustPrice < threshold` (e.g. 0.99) up to `reserveDeployRateCapPerTick`
- In `manual` policy: only deploy when user clicks an intervention button

Reserve depletion should lower confidence / credibility.

### 3.6 Confidence update
Confidence decays with:
- |peg deviation|
- LUNA collapse speed
- unfilled redemptions
- reserve depletion

Confidence improves modestly when peg is near 1 and volatility is low.

---

## 4) Regime ladder (narrative beats)

Use these thresholds to add chart markers + "why" explanations.

- **Early stress**: `ustPrice < 0.97`
- **Run begins**: `ustPrice < 0.80`
- **Cascade**: `ustPrice < 0.30`
- **Failure**: `ustPrice < 0.05`

Additional regime markers:
- **Mint cap binding**: `redemptionRequested > redemptionExecuted` for N ticks
- **Reserves deployed** and **Reserves depleted**
- **Unfilled redemptions rising** (accelerant)

---

## 5) User actions

### 5.1 Shocks (algorithmic mode only)
Each shock must:
- update state
- add a chart marker
- flash impacted KPIs for 3 seconds

Suggested shocks:
1) **Yield withdrawal**: reduces `yieldSupport` / increases withdrawals
2) **Anchor bank run**: increases `withdrawalRate` sharply for N ticks
3) **Whale sale**: increases `sellWhaleUST`
4) **Mint cap tightened**: decreases `mintCapPerTick` (swap throttles)
5) **Reserve confidence loss**: reduces reserve effectiveness / credibility
6) **Shockwave**: multi-factor shock (confidence drop + depth reduction + selling)
7) **Baseline drift (toggle)**: gradual erosion per tick (explicitly user-controlled)

### 5.2 Interventions
Interventions should support both **manual and auto reserve policy**.

Suggested interventions:
1) **Toggle reserve policy: Auto/Manual** (explicit UI control)
2) **Deploy reserves now** (manual buy support)
3) **Increase mint cap** (relieve throttling)
4) **Restore yield incentives** (boost yieldSupport / reduce withdrawals)

---

## 6) UI requirements

- Chart legend in algorithmic mode labels stable as **"UST stablecoin price"**.
- Mechanics breakdown must show (at minimum):
  - sell-flow components
  - redemption requested/executed/unfilled
  - LUNA minted + inflation
  - depth values (UST and LUNA)
  - reserves deployed and remaining
- Add a clearly visible badge when toggles are ON:
  - Baseline drift ON
  - Reserve policy (Auto vs Manual)
- Provide a chart window toggle: **Full history** vs **Last 30s**.

---

## 7) Acceptance criteria (practical)

### Stability
- With no shocks and toggles OFF:
  - UST stays ~1.00
  - LUNA does not decay

### Distinct shocks
- Yield withdrawal alone causes mild drift below peg.
- Anchor bank run produces pronounced sell pressure and peg stress.
- Tight mint cap produces visible **unfilled redemptions** and confidence loss.
- Reserves can temporarily stabilize, but depletion worsens credibility.

### Cascade
A scripted scenario should reproduce the qualitative ladder:
- Yield withdrawal → bank run → whale sale → mint cap binding → reserve deployment → reserve depletion → death spiral.

---

## 8) Notes / non-goals

- This is not a faithful market simulator.
- The goal is **directional correctness** and explainability:
  - users can see *which mechanism* caused the next regime.
  - users can measure the effect of each action via KPIs and breakdown.
