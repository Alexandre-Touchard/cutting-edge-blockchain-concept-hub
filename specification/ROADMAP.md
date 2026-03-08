# Blockchain Learning Hub — Product Roadmap Proposal

## Guiding principles
1. **Outcome-driven learning**: every simulation should answer “what can I do with this knowledge?” (trade safely, verify claims, reason about risk).
2. **Progressive difficulty**: “toy → realistic → production constraints”.
3. **Mental models > features**: prioritize concepts that unlock many others (MEV, AMMs, bridges, rollups, accounts).
4. **Interactive assessment**: short challenges inside each demo (predict, commit, verify, debug).
5. **Trust & risk clarity**: always surface “who must be honest” and “what can go wrong”.

---

## Phase 0 (0–2 weeks): Make the current hub “learnable”
**Goal:** increase completion rate and make users feel guided, not dropped into a gallery.

### Deliverables
- **Learning paths** (3 tracks):
  - *DeFi Fundamentals* (AMM → slippage → LP risk → oracles → lending)
  - *Ethereum Scaling* (rollups → DA sampling → fraud proofs → bridges)
  - *Standards & Accounts* (ERCs → approvals → permits → account abstraction)
- **Prerequisites + “You will learn”** block on each simulation.
- **In-demo checkpoints**: 3–5 “mini tasks” per demo (e.g., “cause a reorg”, “make a withdrawal fail”, “detect invalid state transition”).
- **Glossary links everywhere** + “concept highlight” callouts.
- **Telemetry** (even basic): per-demo start, completion, time spent, drop-off step.

### Success metrics
- +20–40% demo completion rate
- Clear top 3 drop-off steps identified

---

## Phase 1 (2–6 weeks): Fill the missing “core primitives” for DeFi + Ethereum UX
These are the concepts most beginners hit immediately and get stuck on.

### 1) AMM Deep Dive (upgrade or add if not already strong)
**Why:** AMMs are the gateway to DEXs; unlocks slippage, LP risk, MEV, oracles.

**Simulation modules**
- Constant product mechanics (price impact curve)
- Fees & LP returns vs impermanent loss (scenario simulator)
- Concentrated liquidity (Uniswap v3 intuition) as an “advanced toggle”
- Sandwich attack visualization (ties into MEV later)

### 2) Wallet UX & Transaction lifecycle
**Why:** “What even happens when I click confirm?” is the most common invisible system.

**Simulation modules**
- Nonce, gas, mempool, EIP-1559 basics
- Reverts and error decoding (teaches debugging intuition)
- Allowances (ERC-20 approve) + risks + safe patterns

### 3) Oracles (Chainlink-style + pitfalls)
**Why:** connects DeFi to real-world; critical for lending/derivatives risk.

**Simulation modules**
- Price feed update cadence / staleness
- Manipulation via low-liquidity markets
- TWAP vs spot
- Oracle failure modes → liquidation cascades

### Success metrics
- Users can correctly answer: “Why did my swap get worse price?” and “Why do approvals matter?” (embedded quiz)

---

## Phase 2 (6–12 weeks): “DeFi systems” that combine primitives into real dApps

### 4) Lending & Liquidations (Aave-style)
**Why:** teaches collateral, health factor, liquidations—central mental model for DeFi risk.

**Simulation modules**
- Collateral deposit/borrow loop
- Interest rate model (simple → kink model)
- Liquidation mechanics + bonus
- Oracle dependency and cascade scenarios

### 5) Stablecoins & peg mechanisms
**Why:** beginners misuse stablecoins as “just dollars”; this clarifies risk.

**Simulation modules**
- Fiat-backed vs crypto-collateralized vs algorithmic (with risk meter)
- Depeg scenario generator (bank run / oracle issue / collateral crash)

### 6) MEV & PBS (beginner-friendly)
**Why:** explains why users get sandwiched, why private mempools exist, ties to rollups too.

**Simulation modules**
- Sandwich / backrun / arbitrage
- Bundles, relays, private tx
- Proposer-builder separation (conceptual)

### Success metrics
- Users can predict which actors profit in a scenario (trader, LP, searcher, validator)

---

## Phase 3 (12–20 weeks): Next-gen standards + “emerging mechanisms” track
This aligns with the “next generation of blockchain standards” pillar.

### 7) Account Abstraction / ERC-4337 (full path)
**Why:** big UX unlock; lots of confusion; ties to permissions and security.

**Simulation modules**
- UserOperation lifecycle
- Bundlers, paymasters, gas sponsorship
- Session keys / spending limits
- Common pitfalls (signature validation, replay)

### 8) Intents (Solvers) & RFQ vs AMM routing
**Why:** where UX is going; ties to MEV, cross-chain, order flow.

**Simulation modules**
- Intent submission → solver competition → execution
- Price improvement vs trust assumptions
- Failure cases (partial fills, stale quotes)

### 9) Restaking / shared security (expand EigenLayer)
**Why:** emerging area; easy to misunderstand risks.

**Simulation modules**
- Slashing conditions and correlated risk
- Operator set, delegation, AVS tradeoffs
- “Yield vs tail risk” visualizer

---

## Phase 4 (20+ weeks): Cross-chain & scaling “trust model lab”
You already have cross-chain trust models; this phase makes it a full interactive laboratory.

### 10) Bridges & interoperability failure modes
**Simulation modules**
- Light-client bridge vs multisig vs optimistic bridge
- Message ordering, replay, finality mismatch
- Real-world incident replays (genericized): “what assumption broke?”

### 11) Rollups: proof systems and DA trade space
**Simulation modules**
- Fraud proofs vs validity proofs (high-level)
- DA layers comparison (Ethereum DA vs alt DA)
- Sequencer decentralization, forced inclusion

### Success metrics
- Users can answer: “What do I have to trust to bridge?” and “What does ‘DA’ change?”

---

## Platform / “meta” roadmap items (add alongside all phases)

### A) Guided “Quests” (retention + structure)
- 30–45 minute missions: “Become a DEX power user”, “Understand rollup security”, etc.
- Each quest: 3–5 demos + final challenge + certificate/share card.

### B) Challenges mode (assessment)
- For each demo: 5 scenario questions
- Provide instant feedback and “explain why” animation

### C) Community & content loop (lightweight)
- “Suggest a simulation” form + voting
- Monthly “Simulation Drop”
- Optional: user-submitted scenarios (moderated)

### D) Accessibility + performance
- Keep simulations smooth on mid-range laptops
- Keyboard-friendly controls and reduced-motion mode

---

## Prioritization suggestion (if you can only do 3 things next)
1. **Learning paths + checkpoints** (improves everything you already built)
2. **AMM deep dive** (highest leverage DeFi concept)
3. **Lending & liquidations** (most impactful “system-level” DeFi mental model)
