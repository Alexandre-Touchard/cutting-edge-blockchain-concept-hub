# Wallet UX & Transaction Lifecycle Demo — TODO (Completeness Roadmap)

This checklist compiles the improvement items previously described to make the demo more realistic (dev-accurate) while staying beginner-friendly.

---

## A) Make the lifecycle more real (still beginner-friendly)

### A1) Add more transaction states + a timeline UI
- [ ] Add explicit tx states users recognize:
  - [ ] `signed` (wallet created signature)
  - [ ] `broadcasted` (sent to node)
  - [ ] `pending` / `mempool`
  - [ ] `included` (block number)
  - [ ] `finalized` (after N confirmations)
- [ ] Add a timeline component per tx (step-by-step highlight)
- [ ] Add “what can go wrong at this step” short explanations

### A2) Add confirmations + (toy) reorg simulation
- [ ] Track confirmations per included tx
- [ ] Add “Trigger reorg” control:
  - [ ] rewind last block
  - [ ] return txs to mempool when appropriate
  - [ ] re-mine to show non-finality

---

## B) Improve gas / EIP-1559 accuracy (deeper than basics)

### B1) Show effective gas price vs max fee clearly everywhere
- [ ] In selected tx details, always show:
  - [ ] base fee
  - [ ] priority fee (tip)
  - [ ] effective gas price
  - [ ] max fee (cap)
- [ ] Display computed breakdown:
  - [ ] ETH burned
  - [ ] tip paid to validator
  - [ ] total paid

### B2) Display block gas target/max and fee response intuitively
- [ ] Visual markers on gas bar:
  - [ ] target line
  - [ ] max line
- [ ] Optional: show base fee delta (+/−) from last block

---

## C) Add the missing “why did my tx fail / get stuck?” cases

### C1) Nonce gap / blocked queue visualization
- [ ] Create a “nonce gap” scenario:
  - [ ] nonce 0 pending/ignored
  - [ ] nonce 1+ blocked from being mined
- [ ] UI indicator: “Blocked by nonce gap”
- [ ] Explain: “you can’t skip a nonce”

### C2) Underpriced replacement rejection: explain precisely
- [ ] When replacement rejected, show:
  - [ ] required bump thresholds
  - [ ] which requirement failed (maxFee bump, priority bump, tip increase)
- [ ] Add a mini hint: “how to fix” (raise priority, raise max, etc.)

---

## D) Add real wallet/dApp behaviors (DeFi UX realism)

### D1) More realistic allowance workflows + security notes
- [ ] Support:
  - [ ] “approve 0” (revoke)
  - [ ] “infinite approval” toggle
- [ ] Add approval risk callout:
  - [ ] infinite approval = larger attack surface
- [ ] Better swap revert reasons:
  - [ ] allowance too low
  - [ ] balance too low

### D2) Add Permit (EIP-2612) path (optional, modern UX)
- [ ] Add toy “permit signature” step:
  - [ ] permit + swap in 1 tx path
- [ ] Contrast “approve + swap” (2 tx) vs “permit + swap” (1 tx)

---

## E) Add mempool realism / fee competition

### E1) Add background traffic (other users) to show fee competition
- [ ] Generate a few “other user” mempool txs with different tips
- [ ] Show how miner selection changes with tips

### E2) Make TTL / eviction behavior more visible
- [ ] Show tx age (blocks since first seen)
- [ ] Show clear eviction reason when dropped
- [ ] Optional advanced toggle: “multiple nodes have slightly different mempools”

---

## F) Turn the simulator into a learning product

### F1) Guided quests / checklist inside the demo
- [ ] Quest 1: Create an ignored tx (maxFee < baseFee)
- [ ] Quest 2: Speed it up (meet bump rule)
- [ ] Quest 3: Create out-of-gas revert
- [ ] Quest 4: Fix by raising gas limit
- [ ] Quest 5: Swap reverts (no allowance) → approve → retry swap

### F2) Debug panel (advanced toggle)
- [ ] Show “checks performed” (affordability cap, nonce ordering, replacement policy)
- [ ] Show formulas used (EIP-1559, fee cap, tip calculation)
- [ ] Optional: show “execution trace” (toy)

---

## G) Content / docs polish

### G1) Further reading
- [ ] Add links:
  - [ ] EIP-1559 explainer (ethereum.org)
  - [ ] “Why pending txs get stuck”
  - [ ] ERC-20 allowance pitfalls / approval security

### G2) Localization
- [ ] Ensure new UI strings have FR/ES auto-key translations (where needed)
- [ ] Ensure curated demo metadata is updated consistently across locales

---

## Suggested implementation order (best ROI)
1. [ ] Nonce gap visualization + “blocked by nonce” indicator
2. [ ] Guided quests (turns it into a structured lesson)
3. [ ] Reorg + confirmations (finality intuition)
4. [ ] Permit (EIP-2612) path (modern DeFi UX)
