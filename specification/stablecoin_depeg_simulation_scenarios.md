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

Collateral asset price drops (e.g. ETH −40%).\
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
