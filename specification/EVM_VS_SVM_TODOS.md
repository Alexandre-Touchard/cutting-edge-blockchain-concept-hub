# EVM vs SVM demo — TODOs (realism + beginner-friendly)

This file tracks improvement tasks for the `EVM vs SVM` demo (`src/demos/impl/evm_vs_svm.tsx`).

Goal: restore the richer experience (step-by-step execution + logs + quests) and extend it to be both **more accurate for developers** and **more approachable for beginners**.

> Repo scan note: no existing `TODO`/`FIXME`/`HACK` markers were found in `src/**` at the time this list was created.

---

## A) Restore feature parity with the richer version (UX depth)

1. **Bring back step-by-step execution controls**
   - Separate controls for:
     - EVM: `Step`, `Run all`, `Reset`
     - SVM: `Step wave`, `Run all waves`, `Reset`
   - Show current cursor/index for each side.

2. **Add an execution log panel**
   - Timestamped entries:
     - SYSTEM (scenario changes)
     - EVM (tx executed)
     - SVM (wave scheduled, tx executed)
   - Allow clearing log.

3. **Add a “debug” view**
   - Show:
     - declared access sets
     - computed conflicts
     - computed waves and their durations
   - Hide by default for beginners.

4. **Add quests/checklist with visual completion**
   - Example quest set:
     - Fix missing declaration for TX #2
     - Achieve speedup ≥ 1.2×
     - Run both EVM and SVM to completion

5. **Improve TX editor controls**
   - Allow reorder tx list (move up/down)
   - Allow add/remove txs
   - Provide presets: “mostly independent”, “high conflict”, “oracle-heavy”, etc.

---

## B) Make it more realistic / developer-accurate

1. **Clarify what SVM means in the demo**
   - Rename internally/UI to: “Solana-style parallel scheduler (account locks)”, not “SVM” as a generic.
   - Add tooltip explaining:
     - Solana runtime uses account read/write locks
     - Transactions must declare accounts; missing accounts can fail

2. **Model read/write locks and conflict rules precisely**
   - Conflict matrix:
     - R/R: no conflict
     - R/W: conflict
     - W/W: conflict

3. **Separate scheduling from execution**
   - Scheduling step:
     - build waves based on declared access and `threads`
   - Execution step:
     - if declared set is missing required accounts → fail
     - otherwise apply state changes

4. **Model compute budget / CU more explicitly**
   - Add “compute units” explanation:
     - wave time = max(CU) of txs in wave
   - Add “threads” explanation:
     - a wave can include up to N non-conflicting txs

5. **Add a minimal “account lock timeline” visualization**
   - For each wave:
     - list locked accounts (R/W)
     - show why another tx couldn’t fit (conflict)

6. **Optional: add “optimistic parallelism” example**
   - Explain that EVM mainnet is sequential, but some L2/alt clients do speculative/parallel execution internally.
   - Emphasize: that’s an implementation optimization, not part of the EVM consensus rules.

---

## C) Make it beginner-friendly

1. **Add a 60-second guided intro**
   - A short “What you are about to see” box:
     - EVM: one-by-one
     - Solana-style: can do multiple at once if they don’t touch same stuff

2. **Show “why” labels instead of just numbers**
   - For each tx:
     - “Conflicts with TX #1 because both write DexPool”
     - “Can run in parallel with oracle reads (read-only)”

3. **Use less jargon, with tooltips**
   - Terms:
     - account
     - state
     - read/write
     - conflict
     - wave

4. **Add an explicit “fix hint” for the missing declaration quest**
   - Inline hint near TX #2:
     - “Add FeeVault as WRITE in declared accounts”

5. **Improve empty-state and error-state messaging**
   - When SVM fails:
     - show exactly which missing accounts caused failure

---

## D) Integration / polish

1. **Add demo registry metadata**
   - Add entry in `src/demos/demoRegistry.ts` for `evm-vs-svm`:
     - title
     - description
     - thumbnail image
     - key takeaways
     - tags

2. **Add translations**
   - Ensure `useDemoI18n('evm-vs-svm')` strings are exported for later translation.

3. **Add basic QA checks**
   - Ensure build passes (`npm run build`)
   - Ensure the demo loads on `/demo/evm-vs-svm`

---

## E) Nice-to-have extensions

1. **Add “Account-based parallelism vs object-based parallelism” note**
   - Compare:
     - Solana account locks
     - Move/Aptos resource access (static analysis)

2. **Add MEV / ordering implications section**
   - Explain that sequential execution makes ordering a big deal
   - Parallelism doesn’t remove ordering; it changes what can be concurrent

3. **Add a “real world constraints” section**
   - mention:
     - network propagation
     - block producers
     - fee markets
     - deterministic replay requirements
