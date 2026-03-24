# Stablecoin Depeg Cascade Simulation

## Overview

This document describes two simulation scenarios for an interactive DeFi
education demo: 1. Collateralized stablecoin cascade 2. Algorithmic
stablecoin cascade (Terra-style)

The simulation demonstrates how shocks propagate through decentralized
finance systems.

------------------------------------------------------------------------

# Scenario 1 --- Collateralized Stablecoin Cascade

Example inspiration: DAI-like systems on Ethereum.

## Initial State

Stablecoin price: \$1.00\
Collateral ratio: 165%\
Liquidity pool depth: \$500M\
Market confidence: High

Core system components: - Collateral vaults - Liquidation engine - AMM
liquidity pools - Arbitrage traders - Lending markets

## Risk Drivers

### Collateral Price Crash

Collateral asset price drops (e.g.Â ETH âˆ’40%).\
Vault collateralization falls and liquidations begin.

### Liquidity Drain

Liquidity providers withdraw funds from pools.\
Lower liquidity increases slippage and weakens peg stability.

### Whale Exit

Large holder sells stablecoins into AMM pools causing imbalance.

### Oracle Failure

Incorrect or delayed price feeds trigger incorrect liquidations.

### Confidence Shock

Rumors, hacks, or regulatory news trigger panic withdrawals.

## Cascade Dynamics

1.  Collateral prices drop\
2.  Liquidations begin\
3.  Collateral sells on market\
4.  Stablecoin selling pressure increases\
5.  Liquidity imbalance grows

Possible outcomes: - Peg recovery - Temporary depeg - System collapse

------------------------------------------------------------------------

# Scenario 2 --- Algorithmic Stablecoin (Terra-style)

Inspired by the TerraUSD / LUNA system.

Peg mechanism:

1 stablecoin can always be redeemed for \$1 worth of LUNA.

## Initial State

Stablecoin price: \$1.00\
LUNA price: \$80\
Stablecoin supply: 18B\
LUNA supply: 350M

Demand is supported by yield incentives.

## Risk Drivers

### Yield Withdrawal

Users remove deposits from yield protocol.

### Whale Sale

Large holder sells stablecoins.

### Redemption Arbitrage

Users burn stablecoin to mint LUNA.

### Reflexive Collapse

LUNA supply increases rapidly causing price collapse.

## Death Spiral

1.  Stablecoin drops below peg\
2.  Users redeem for LUNA\
3.  LUNA supply explodes\
4.  LUNA price collapses\
5.  Stablecoin collapses

Example cascade:

Early stress: \$0.97\
Panic: \$0.80\
Collapse: \$0.30\
Failure: \<\$0.05

------------------------------------------------------------------------

## Educational Goals

Help users visualize: - systemic risk - liquidity crises - peg
instability - reflexive tokenomics - DeFi cascading failures

---

## V2 improvement plan (roadmap)

This section captures a concrete set of improvements to take the demo from a
"plausible teaching sim" to a more mechanistic, explainable simulator.

### A) Make the mechanics explicit (less magic numbers)

- Add a **per-tick breakdown panel**:
  - Collateralized: show liquidation pressure, liquidation sell amount, slippage
    multiplier, panic sell vs arbitrage support, and the final Δprice.
  - Algorithmic: show stable redemption amount, LUNA minted, implied supply
    inflation, backstop strength, and the final Δprice.
- Add an optional **"Show formulas"** toggle for advanced learners.

### B) Separate price vs solvency

- Add a **solvency meter** for collateralized mode:
  - equity = collateral value − debt
  - CR (collateral ratio) displayed alongside equity.
- Add a **backstop capacity meter** for algorithmic mode:
  - a simplified proxy for how credible redemptions are as LUNA price falls.

### C) Parameterize key assumptions (advanced sliders)

Expose a few key parameters as sliders (with sensible presets):

- Collateralized:
  - liquidation threshold (e.g. 150%)
  - arbitrage efficiency
  - liquidation severity / impact
- Algorithmic:
  - redemption intensity / cap
  - LUNA reflexivity multiplier (how supply inflation hits price)
  - AMM depth

### D) Better learning loops

- Add "Why did this happen?" explanations at key regime changes:
  - peg breaks, liquidations start, panic zone, collapse.
- Add optimization quests (optional):
  - "Recover peg with minimal interventions"
  - "Keep stable above .97 for 10 steps"


------------------------------------------------------------------------

# Appendix — Terra (UST/LUNA) Detailed Spec

# Terra (UST/LUNA) Depeg Scenario Spec (Teaching Simulation)

This document specifies the **Terra-style algorithmic stablecoin** scenario (UST â†” LUNA) for `stablecoin_depeg_simulation.tsx`.

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
- larger sell flow + lower `ustDepth` â‡’ larger negative `Î”ustPrice`

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
- inflation (`Î”lunaSupply / lunaSupply`)
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
- Yield withdrawal â†’ bank run â†’ whale sale â†’ mint cap binding â†’ reserve deployment â†’ reserve depletion â†’ death spiral.

---

## 8) Notes / non-goals

- This is not a faithful market simulator.
- The goal is **directional correctness** and explainability:
  - users can see *which mechanism* caused the next regime.
  - users can measure the effect of each action via KPIs and breakdown.


------------------------------------------------------------------------

## Terra realism upgrade — implementation TODO list

> This TODO list is derived from `stablecoin_depeg_terra_scenario.md`. It is intended to be implemented inside `src/demos/impl/stablecoin_depeg_simulation.tsx` (algorithmic scenario), while keeping the demo explainable.

### Phase 0 — Spec + acceptance criteria
- [ ] Ensure `stablecoin_depeg_terra_scenario.md` stays up to date with the intended timeline beats.
- [ ] Add scripted acceptance runs (manual checklist or lightweight tests): baseline stable, then cascade ladder.

### Phase 1 — Refactor algorithmic tick into explicit subsystems
- [ ] Refactor algorithmic tick into named sub-steps (demand/sentiment, sell flows, redemption request/executed, minting, reserves support, confidence update).
- [ ] Store per-tick breakdown values in state so the Mechanics Breakdown can display the same numbers used by the engine.

### Phase 2 — Anchor module (demand side)
- [ ] Add Anchor state: `anchorTVL`, `anchorYieldRate`, `yieldReserve`, `withdrawalRate`.
- [ ] Convert Anchor withdrawals into an explicit `sellAnchorOutflowUST` term that contributes to UST sell flow.
- [ ] Add shock: **Anchor bank run** (withdrawalRate spike for N ticks).
- [ ] Add intervention: **Subsidize yield** (temporary yieldSupport bump, drains yieldReserve).

### Phase 3 — Mint cap + unfilled redemptions (capacity-bound swaps)
- [ ] Add `mintCapPerTick`.
- [ ] Add `unfilledRedemption` (failed arb pressure, not guaranteed FIFO execution).
- [ ] Tick logic: compute `redemptionRequested`, `redemptionExecuted`, update `unfilledRedemption`.
- [ ] Make `unfilledRedemption` feed into sell pressure and confidence decay.
- [ ] Add shock: **Mint cap tightened**.
- [ ] Add intervention: **Increase mint cap**.

### Phase 4 — LFG-style reserves with Auto/Manual policy toggle
- [ ] Add reserve state: `reserveUSD`, `reserveDeployRateCapPerTick`, `reservePolicy ('auto'|'manual')`.
- [ ] Auto policy tick behavior: deploy when UST < threshold (e.g. 0.99) within caps.
- [ ] Intervention button: **Toggle reserve policy Auto/Manual**.
- [ ] Intervention button: **Deploy reserves now** (manual).
- [ ] Add regime marker + explanation when reserves are depleted.

### Phase 5 — Split market depth (UST vs LUNA)
- [ ] Replace single `ammDepth` with `ustDepth` and `lunaDepth`.
- [ ] Apply depth-based impact separately for UST sells and LUNA inflation/sells.

### Phase 6 — Regime ladder + narrative instrumentation
- [ ] Implement regime markers: UST < 0.97 / 0.80 / 0.30 / 0.05.
- [ ] Add additional markers: mint cap binding, unfilled redemptions rising, reserves deployed/depleted.
- [ ] Ensure “Why did this happen?” references the correct subsystem inputs.

### Phase 7 — Calibration + guardrails
- [ ] Calibrate defaults so no-shock baseline is stable, and each shock is visually distinct.
- [ ] Guardrails: prevent negative supplies, NaNs/infinities; cap history growth; keep UI responsive.
