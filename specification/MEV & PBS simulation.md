# MEV & PBS simulation — implementation specification

**Purpose:** Beginner-friendly, interactive education tool covering Maximal Extractable Value and Proposer-Builder Separation. Users should be able to predict which actors profit in any given scenario after completing all modules.

**Target audience:** Developers and DeFi users with basic blockchain literacy (wallets, txs, gas) but no prior MEV knowledge.

---

## 0. Conceptual primer (displayed before first module)

MEV stands for **Maximal Extractable Value** — the profit a block producer (or anyone who can influence transaction ordering) can extract beyond normal block rewards and gas fees. It exists because:

1. Ethereum's public mempool is **transparent** — pending transactions are visible to anyone before inclusion.
2. Block producers control **transaction ordering** — they decide which txs land first, last, or not at all.
3. DeFi protocols are **deterministic** — given a known state, outcomes are perfectly predictable.

These three properties together create an environment where sophisticated actors (searchers, builders) can front-run, back-run, and sandwich ordinary users.

**Key numbers (Ethereum mainnet, 2021–2024):**
- Total MEV extracted: **>$1.38B** (Flashbots dashboard, cumulative)
- Peak daily MEV: **~$30M** (May 2021, during DeFi summer)
- Sandwich attacks as share of MEV: **~30–40%** by volume
- Blocks built via MEV-Boost (PBS): **~90%** of all Ethereum blocks (post-Merge)

---

## 1. Module: sandwich attack

### What it is

A sandwich attack brackets a victim's swap with two searcher transactions — one immediately before (front-run) and one immediately after (back-run) — to capture the price impact the victim's trade creates.

### Mechanics

```
[normal mempool order]
...other txs...
Victim: swap 50 ETH → USDC  (gas: 20 gwei)
...other txs...

[searcher reorders to]
Searcher: buy ETH  (gas: 21 gwei, +1 to guarantee priority)
Victim:   swap 50 ETH → USDC  ← now gets worse price
Searcher: sell ETH  (gas: 19 gwei, can be lower — after victim)
```

**Why it works:** The front-run buy pushes the ETH price up on the AMM. The victim swaps at the inflated price. The back-run sell returns the searcher's position at profit, capturing the price delta.

**Profit formula (simplified):**

```
searcher_profit = victim_size × slippage_tolerance × impact_factor − (2 × gas_cost)
```

Where `impact_factor ≈ 0.85` (accounting for AMM fee and partial fill).

### Real-world example: Ethereum block #13,100,788 (Sept 2021)

- **Victim tx:** Swap 120 ETH → USDC on Uniswap V2, 1% slippage
- **Front-run:** Searcher buys 35 ETH just before; pays 350 gwei priority fee
- **Back-run:** Searcher sells 35 ETH immediately after
- **Victim outcome:** Received ~$3,200/ETH instead of $3,340 — ~$16,800 loss
- **Searcher profit:** ~$14,200 net (after gas)
- **Source:** EigenPhi sandwich attack explorer, tx 0x59d…

### Simulation parameters to expose

| Parameter | Range | Default | Effect on outcome |
|---|---|---|---|
| Victim swap size (ETH) | 1–100 | 10 | Linear effect on opportunity size |
| Slippage tolerance (%) | 0.1–20 | 0.5 | Caps maximum sandwich profit |
| Pool liquidity (ETH) | 100–10,000 | 1,000 | Determines price impact per ETH |
| Gas price (gwei) | 5–200 | 30 | Sets minimum profitable attack size |

### Simulation states to show

1. **Mempool view** — show victim tx visible in the public pool with gas/slippage metadata
2. **Searcher detection** — animate searcher bot scanning and flagging the victim tx as profitable
3. **Bundle construction** — show front-run + victim + back-run assembled as ordered bundle
4. **Block inclusion** — reordered block with colour-coded tx positions
5. **Profit / loss table** — per-actor breakdown with ETH amounts

### Actor outcomes table

| Actor | Outcome | Notes |
|---|---|---|
| Trader (victim) | Loss | Proportional to slippage tolerance × swap size |
| Searcher | Profit | Net of 2× gas costs |
| LP (Uniswap) | Near-neutral | Earns fees on both trades; slightly positive |
| Validator / proposer | Profit | Earns higher priority fees from searcher's front-run |

### Edge cases to simulate

- **Slippage = 0.1%:** sandwich becomes unprofitable (gas exceeds capture) → searcher passes
- **Tiny swap (<0.5 ETH):** opportunity below gas floor → no attack
- **Flashbots Protect toggle:** if victim uses private RPC, searcher never sees the tx

---

## 2. Module: arbitrage & backrun

### What it is

**Arbitrage** exploits price discrepancies between two or more DEXes for the same asset pair. Unlike sandwiching, it is generally considered "good MEV" — it restores price efficiency for subsequent traders.

**Backrunning** places a transaction *immediately after* a large trade to capture the price movement without harming the original trader.

### Mechanics

```
State: ETH = $1,800 on Uniswap, ETH = $1,850 on Curve

Arb bot:
  1. Buy 20 ETH on Uniswap at $1,800  ($36,000 out)
  2. Sell 20 ETH on Curve at $1,850   ($37,000 in)
  Net: +$1,000 − gas ≈ +$980

After arb:
  Uniswap price rises (pool drained of cheap ETH)
  Curve price falls (pool oversupplied with ETH)
  Prices converge → next trader gets fair price
```

### Real-world example 1: Uniswap V3 / Curve arb, Nov 2022

During the FTX collapse, ETH prices diverged by up to **$40** between Uniswap and Curve within single blocks as panic selling hit different venues at different speeds.

- **Opportunity:** $1,142 on Uniswap V3, $1,182 on Curve 3pool
- **Arb size:** 500 ETH
- **Gross profit:** $20,000
- **Gas cost:** ~0.8 ETH (~$912)
- **Net profit:** ~$19,088 in a single atomic tx
- **Block time:** landed within 2 blocks of divergence opening

### Real-world example 2: Backrun on Uniswap V3 large swap

A whale swaps 1,000 WETH for USDC, moving the pool price significantly. A searcher backruns by:
- Buying WETH on a secondary DEX at the now-depressed price
- Relying on the whale's tx to create the opportunity without harming them

This is **pure extraction from price impact** — the victim loses nothing extra.

### Simulation parameters

| Parameter | Range | Default |
|---|---|---|
| DEX A price (USD) | 1,600–2,200 | 1,820 |
| DEX B price (USD) | locked or free | 1,820 |
| Arb trade size (ETH) | 1–200 | 10 |
| Gas cost (gwei) | 10–150 | 30 |
| AMM fee (%) | 0.01–1.0 | 0.3 |

### Profitability threshold display

Show a live "minimum gap to be profitable" indicator:

```
min_gap = (2 × gas_cost_ETH × ETH_price + AMM_fees) / arb_size_ETH
```

If `current_gap < min_gap` → show "no opportunity" state with explanation.

### Actor outcomes table

| Actor | Arb scenario | Backrun scenario |
|---|---|---|
| Arb / backrun bot | Profit | Profit |
| LPs on cheaper DEX | Loss (impermanent loss) | Near-neutral |
| LPs on pricier DEX | Near-neutral | Near-neutral |
| Next trader | Benefit (tighter spread) | Neutral |
| Proposer | Profit (priority fees) | Profit |

---

## 3. Module: bundles & private transactions

### What it is

A **bundle** is a set of transactions submitted together to a block builder, with the guarantee that:
- All txs land in the specified order, or **none** do (atomicity)
- The bundle is **invisible** to the public mempool until included in a block
- The searcher specifies a **minimum block number** (can't land in a stale block)

**Private transaction** (e.g. via Flashbots Protect RPC) is the single-tx version — your swap never appears in the public mempool, making sandwiching impossible.

### Bundle anatomy

```json
{
  "jsonrpc": "2.0",
  "method": "eth_sendBundle",
  "params": [{
    "txs": [
      "0x<signed_front_run_tx>",
      "0x<victim_tx_or_target_state_tx>",
      "0x<signed_back_run_tx>"
    ],
    "blockNumber": "0xE9A5C0",
    "minTimestamp": 0,
    "maxTimestamp": 1700000000,
    "revertingTxHashes": []
  }]
}
```

Key fields to explain in the UI:
- `txs`: ordered array — position is guaranteed
- `blockNumber`: target block (hex) — bundle expires if not included by this block
- `revertingTxHashes`: txs allowed to revert without invalidating the whole bundle

### Real-world example: Flashbots searcher bundle (2022)

A classic 3-tx searcher sandwich bundle submitted to Flashbots relay:

| Position | Tx | Gas tip | Purpose |
|---|---|---|---|
| #1 | Searcher buy (WETH→DAI) | 120 gwei | Front-run: move price |
| #2 | Victim swap (DAI→WETH) | 30 gwei | Target tx (included as-is) |
| #3 | Searcher sell (DAI→WETH) | 18 gwei | Back-run: capture spread |

Searcher paid builder **0.032 ETH** as coinbase transfer. Net profit: **0.11 ETH** after payment and gas.

### MEV-Protect comparison: public vs private

| Property | Public mempool | Flashbots Protect | Other private RPCs |
|---|---|---|---|
| Visible before inclusion | Yes | No | No |
| Sandwich risk | High | None | None |
| Front-run risk | High | None | Low |
| Inclusion speed | Immediate (next block) | +1–3 blocks | Varies |
| Cost | Standard gas | Standard gas | Standard gas |
| Reverts if sandwiched | No | Yes (not included) | Varies |

### Simulation states

1. **Bundle builder UI** — drag-and-drop tx ordering, add/remove txs
2. **Relay submission** — show bundle travelling to relay (sealed envelope metaphor)
3. **Builder selection** — show which builder picks the bundle based on profitability
4. **Block comparison** — side-by-side: same tx in public mempool (sandwiched) vs private bundle (clean)

### Real-world private tx tools to reference in UI

| Tool | Type | Notes |
|---|---|---|
| Flashbots Protect | Private RPC | flashbots.net/protect |
| MEV Blocker | Private RPC | mevblocker.io — rebates MEV to user |
| Cowswap | Intent-based | Batches orders, internal solver |
| 1inch Fusion | Intent-based | Resolver auction, no mempool exposure |

---

## 4. Module: proposer-builder separation (PBS)

### Why PBS exists

Before PBS, validators (proposers) built their own blocks. This gave them direct MEV access — they could reorder txs for profit, or accept bribes to include specific txs. This created:
- **Centralisation pressure** — sophisticated validators captured more MEV → staked more → grew larger
- **Trust problem** — proposers could peek at bundles before committing
- **Validator extractable value** — a systemic unfairness

PBS separates these roles:

```
[Old model]
Validator → builds block → proposes block → earns MEV directly

[PBS model with MEV-Boost]
Searchers  →  Builders  →  Relay  →  Proposer (validator)
(bundles)    (block)      (sealed)   (signs header blindly)
```

### The four actors in detail

**Searcher**
- Monitors mempool and on-chain state for MEV opportunities
- Writes and signs tx bundles with embedded bids
- Competes with other searchers for same opportunities
- Example: a bot scanning all Uniswap pools every block for arb

**Builder**
- Receives bundles from many searchers simultaneously
- Constructs the most profitable valid block (ordering NP-hard → heuristics used)
- Bids to the relay: `builder_bid = total_MEV_captured − desired_profit_margin`
- Dominant builders (2024): beaverbuild, Titan Builder, rsync-builder (~75% market share combined)

**Relay**
- Receives sealed block + bid from builders
- Verifies block validity without revealing contents to proposer
- Presents only the **block header + bid** to proposer for signing
- Acts as escrow: payment released only after proposer signs
- Dominant relays: Flashbots, BloXroute, Agnostic Gnosis, Ultra Sound

**Proposer (validator)**
- Runs MEV-Boost software alongside their validator
- Receives headers from relay; picks highest bid
- Signs header **without seeing transaction contents**
- Guaranteed income: the bid amount, regardless of actual MEV extracted

### MEV-Boost flow (step by step)

```
1. Block N-1 finalised
2. Proposer is selected for block N (known 1 epoch ahead)
3. Builders receive mempool txs + pending bundles
4. Builders construct candidate blocks, submit to relays with bids
5. Relays verify blocks, forward best bid/header to proposer
6. Proposer selects winning header (highest bid)
7. Proposer signs header → relay releases full block to network
8. Network validates and finalises block N
9. Proposer receives bid payment (via coinbase transfer)
```

Timeline: steps 3–8 occur within a **single 12-second slot**.

### Real-world example: record MEV block (April 2023)

- **Block:** #17,049,173
- **Builder:** beaverbuild
- **Proposer payment:** **584 ETH** (~$1.07M at the time)
- **Source of MEV:** Sandwich attacks during a large PEPE memecoin launch
- **Context:** Hundreds of bots competing to sandwich retail buyers flooding Uniswap

This single block earned more than many validators earn in a year of normal operation.

### PBS auction simulation parameters

| Parameter | Range | Default |
|---|---|---|
| Number of builders | 2–5 | 3 |
| MEV opportunity size (ETH) | 0.01–5 | 0.5 |
| Builder margin target (%) | 5–40 | 20 |
| Gas base fee (gwei) | 5–50 | 15 |

### Auction outcome logic

```
builder_bid = mev_opportunity × (1 − margin_pct)
winner = argmax(builder_bids)
proposer_earn = winner_bid
builder_earn = mev_opportunity − winner_bid − gas_costs
```

### Actor outcomes table

| Actor | Always earns | Earns if wins auction | Risk |
|---|---|---|---|
| Searcher | Bundle profit (if included) | — | Bundle not included → 0 |
| Builder (winner) | — | MEV − bid − gas | Overbid → loss |
| Builder (loser) | 0 | — | Lost computation time |
| Proposer | Winner's bid | — | None (guaranteed) |
| Relay | 0 (non-profit) | — | Trust risk |

---

## 5. Module: profit quiz — scenario bank

Extend beyond the current 5 scenarios. Recommended additions:

### Scenario 6: JIT (Just-In-Time) liquidity

> A searcher detects a large incoming swap on Uniswap V3. They add $10M of liquidity to the concentrated range in the same block, *just before* the swap executes, then remove it in the same block after.

**Actors:** JIT provider, Existing LPs, Swapper, Block builder  
**Profits:** JIT provider ✓, Existing LPs ✗ (fees captured by JIT), Swapper ✓ (better price), Builder ✓

**Explain:** JIT liquidity steals fees from passive LPs by concentrating capital exactly when a large trade occurs, then withdrawing immediately. The swapper actually benefits (lower slippage). Considered grey-area MEV.

### Scenario 7: Oracle manipulation

> A searcher borrows $50M in a flash loan, uses it to temporarily manipulate a Chainlink-dependent price oracle on a small DEX, triggers a profitable liquidation on a lending protocol, then repays the flash loan — all in one tx.

**Actors:** Searcher (attacker), Liquidated borrower, Lending protocol, Flash loan provider  
**Profits:** Searcher ✓, Borrower ✗, Protocol ✗ (bad debt risk), Flash loan provider ✓ (fee)

**Explain:** Oracle manipulation is one of the most damaging MEV forms — it's often indistinguishable from an attack. The Mango Markets exploit ($117M, Oct 2022) used this pattern.

### Scenario 8: NFT mint sniping

> A popular NFT collection opens public mint at block N. Searchers submit hundreds of txs with high gas to mint rare IDs, identified by simulating the RNG function before the block is mined.

**Actors:** Searchers, Retail minters, NFT protocol, Validators  
**Profits:** Lucky searchers ✓, Retail minters ✗ (outcompeted), Protocol ✓ (mint fees), Validators ✓ (high gas)

**Explain:** Predictable on-chain randomness (block hash-based RNG) is exploitable. Projects now use VRF (Verifiable Random Function) or commit-reveal schemes to prevent this.

### Scenario 9: Cross-domain MEV (L1 ↔ L2)

> A large swap on Arbitrum moves the ETH price. An arb bot detects this via an L2 node and places a tx on Ethereum mainnet before the L2 price is reflected there, exploiting the bridge latency.

**Actors:** Cross-domain arb bot, Arbitrum LPs, Ethereum LPs, Both sets of validators  
**Profits:** Arb bot ✓, Arbitrum LPs ✗ (IL), Ethereum LPs near-neutral, Both validators ✓

**Explain:** Cross-domain MEV is an emerging frontier — it requires operating nodes on multiple chains simultaneously and reacting within seconds. This ties directly to PBS on rollups (based sequencing).

### Scenario 10: MEV redistribution via MEV blocker

> A user submits a swap via MEV Blocker RPC. A searcher identifies a backrun opportunity but must share 90% of the profit with the user as a rebate.

**Actors:** User, Backrun searcher, MEV Blocker protocol, Block builder  
**Profits:** User ✓ (rebate), Searcher ✓ (10% of profit), Protocol ✓ (sustainability fee), Builder ✓

**Explain:** MEV Blocker and CoW Protocol represent "MEV internalisation" — instead of eliminating MEV, they redirect it back to the user who generated the opportunity. This is the current frontier of user protection.

---

## 6. Additional simulation modules (future roadmap)

### 6a. MEV timeline explorer

Show a visual timeline of real blocks with MEV overlaid:
- Source data: Flashbots MEV-Explore API (`https://mev.metablock.dev/v1`)
- Display: block number, MEV type (sandwich/arb/liquidation), ETH extracted, searcher address
- Interaction: click any block to see the full tx sequence

### 6b. Liquidation cascade simulator

User sets:
- Collateral ratio of a position
- ETH price drop percentage
- Number of liquidatable positions

Show cascade: first liquidation drops price further → triggers next → searcher races to capture each.

**Real example to reference:** March 12, 2020 ("Black Thursday") — ETH dropped 50% in hours. MakerDAO liquidations were so large that some auctions cleared at $0 (no competing bids), creating $4M in bad debt.

### 6c. Builder market concentration

Interactive chart showing:
- Builder market share over time (2022–present)
- Source: `https://mevboost.pics` data
- Key insight: top 3 builders control ~75% of blocks — centralisation risk

### 6d. PBS on rollups (based sequencing)

Conceptual diagram of:
- Current L2 sequencer model (centralised, no MEV-Boost)
- Based sequencing proposal (L1 validators sequence L2 blocks)
- Trade-offs: decentralisation vs latency vs MEV extraction

**Reference:** EIP-3074, based rollup proposals by Justin Drake (Ethereum Foundation)

---

## 7. Data sources & APIs for live integration

| Data type | Source | Endpoint / notes |
|---|---|---|
| Live mempool txs | Flashbots MEV-Share | `https://mev-share.flashbots.net` (SSE stream) |
| Historical MEV blocks | EigenPhi | `https://eigenphi.io/mev/ethereum` |
| Builder market share | mevboost.pics | Public dashboard, no API key |
| Searcher bundles | Flashbots Explore | `https://blocks.flashbots.net` |
| Gas price oracle | Blocknative | `https://api.blocknative.com/gasprices/blockprices` |
| Sandwich detection | EigenPhi API | Paid tier, per-tx classification |
| Block builder bids | Ultrasound relay | `https://relay.ultrasound.money/relay/v1/data/bidtraces` |

---

## 8. Glossary (in-app tooltip targets)

| Term | One-line definition |
|---|---|
| MEV | Profit extractable by controlling tx ordering in a block |
| Sandwich attack | Bracketing a victim tx with front-run + back-run to capture price impact |
| Front-running | Inserting your tx before a known pending tx to profit from its outcome |
| Back-running | Inserting your tx immediately after a target tx to capture its price effect |
| Searcher | Bot operator who finds and executes MEV strategies |
| Builder | Entity that assembles optimally profitable blocks from submitted txs and bundles |
| Proposer | Validator selected to propose the next block; signs builder's block in PBS |
| Relay | Trusted intermediary in PBS that seals the block until proposer commits |
| Bundle | Ordered group of txs submitted atomically to a builder |
| Mempool | The public waiting room for unconfirmed transactions |
| Slippage tolerance | Maximum acceptable price deviation; larger = more sandwich risk |
| Impermanent loss | LP loss from price divergence vs holding assets outside the pool |
| Flash loan | Uncollateralised loan borrowed and repaid within a single transaction |
| JIT liquidity | Liquidity added and removed within the same block to capture swap fees |
| MEV-Boost | Software run by validators to access PBS and receive builder bids |
| Based sequencing | Proposal to use L1 validators as L2 sequencers, extending PBS to rollups |

---

## 9. Success metrics (acceptance criteria)

After completing all modules, a user should be able to:

- [ ] Identify whether a given tx sequence constitutes a sandwich, arb, backrun, or liquidation
- [ ] Predict profit/loss sign (positive / negative / neutral) for each actor in any scenario
- [ ] Explain why a tx with 0.1% slippage is safer than one with 10% slippage
- [ ] Describe what a relay does and why the proposer signs the header without seeing txs
- [ ] Know at least two tools that reduce their personal MEV exposure as a trader
- [ ] Achieve ≥ 80% accuracy on the profit quiz after completing all simulation modules

**Measurement:** Track quiz score progression across sessions. Target: median user achieves ≥ 4/5 correct on first attempt after completing sandwich + PBS modules.