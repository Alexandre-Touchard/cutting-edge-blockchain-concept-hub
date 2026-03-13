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
