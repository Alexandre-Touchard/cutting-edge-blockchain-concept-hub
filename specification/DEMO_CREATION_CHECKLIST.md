# Demo creation checklist (Blockchain Learning Hub)

This file captures the requirements/patterns we've converged on for implementing new demos in this repo.

## 1) Demo registration (Hub + modal)

Update `src/demos/demoRegistry.ts` with:

- Stable demo id (used in routes + i18n): e.g. `id: 'state-channels'`
- Title / description (English source of truth)
- Category / difficulty
- `thumbnail`
  - Can be an emoji OR an image URL
  - If using an image, prefer: `thumbnail: new URL('../public/photo/DemoX.png', import.meta.url).href`
- `concepts`: glossary terms shown as "Key concepts" chips in demo page/modal
- `keyTakeaways`: 3 concise bullets (English)
- `tags`: short discoverability strings

### Required translations for modal
Add these to locale JSONs:

- `src/locales/fr.json`:
  - `demos.<id>.title`
  - `demos.<id>.description`
  - `demos.<id>.keyTakeaways.{0,1,2}`
- `src/locales/es.json`: same fields (recommended)

> Tip: The "View details" modal reads `demos.<id>.keyTakeaways.*`. If missing, it falls back to English.

## 2) i18n inside demo implementation (UI copy)

In the demo component:

- Always use `useDemoI18n('<id>')`:

```ts
const { tr } = useDemoI18n('<id>');
```

- Wrap **every user-facing string** in `tr('...')`.
- For dynamic strings, use interpolation:

```ts
tr('Packet #{{id}}', { id })
```

### Key extraction
Use the extractor to generate the auto keys:

```bash
node tmp_rovodev_extract_demo_keys.mjs src/demos/impl/<file>.tsx <id>
```

Then add translations under:

- `src/locales/fr.json` -> `demos.<id>.auto.*`
- `src/locales/es.json` -> `demos.<id>.auto.*` (recommended)

## 3) Tooltips (education-first)

- Add `EduTooltip` for:
  - action buttons ("Post...", "Challenge...", "Commit...", "Execute...") explaining why/what happens
  - ambiguous table headers/labels (e.g. "State index", "Input", "Claimed", "True")
  - key status indicators (e.g. "Mismatch exists") with a short explanation

### Tooltip overflow requirement
`EduTooltip` must not overflow off-screen. (The component now clamps to viewport.)

## 4) Visual explanation requirements

A "great" demo should make the mechanism obvious visually.

Recommended patterns:

- A step/phase indicator ("Phase", "Round", "Range", etc.)
- A visual trace/graph/track that updates as the user interacts
- A final "resolution" panel that explains the decisive step (e.g. one-step proof)
- Event log (most-recent-first) for narration

## 5) Real-World Applications + Further Reading sections

Include sections similar to AMM/PeerDAS/etc.:

- `🌐 Real-World Applications`
  - 3-5 short cards/blocks
  - each block should include a crisp practical takeaway
- `📚 Further Reading`
  - link list (use `LinkWithCopy` or `<a>`)

All text must use `tr('...')`.

## 6) Icons + micro-UX

- Use Lucide icons for:
  - important H2 titles
  - main action buttons
- Ensure important button labels remain on one line:
  - add `inline-flex ... whitespace-nowrap` when needed

## 7) Responsive layout expectations

- Don't let key text wrap awkwardly (e.g. "Range: [0, 16]" should be `whitespace-nowrap`)
- Consider collapsible panels on small screens (timeline, logs)
- Optionally hide entire control panels (setup) to give the visualization more width

## 8) Glossary support (Key concepts)

- Concepts shown on the demo page should be glossary-backed.
- Add missing glossary terms in:
  - `src/demos/glossary.ts` (`GlossaryKey` + `EN_GLOSSARY`)
- Add translations in:
  - `src/locales/fr.json` -> `glossary.<Term>`
  - `src/locales/es.json` -> `glossary.<Term>`

## 9) Learning product features (quests + debug)

The hub is not just a gallery - each demo should help users prove they understood the mechanism.

Recommended additions (especially for complex demos):

### 9.0 60-second tour (beginner onboarding)
- Add a short onboarding box near the top of the demo: "60-second tour".
- It should contain 3–5 steps that a beginner can follow to get value quickly.
- Add 1–2 `EduTooltip`s inside the tour to define key terms (e.g. "wave", "account locks", "nonce").
- Keep wording action-oriented and avoid jargon.

### 9.0b Guided mode (optional but recommended)
- Add an optional "Guided mode" toggle for complex demos.
- When enabled, helper actions (e.g. "Auto-fix", "Load scenario") should:
  - scroll the relevant UI section into view
  - briefly highlight the changed control/state (e.g. ring/glow around the updated chip/row)
- Purpose: make cause/effect obvious for beginners.

### 9.1 In-demo quests / checkpoints
- Add a small in-demo checklist panel (collapsible on small screens).
- Include 3-6 tasks that map directly to the learning objectives (e.g. "make a tx become Ignored", "replace a tx via Speed up", "cause an out-of-gas revert").
- Track completion using deterministic state checks (e.g. a tx reached a certain status, a specific revert reason occurred).
- Add an `EduTooltip` next to each quest explaining exactly how to complete it.

### 9.2 Advanced / Debug panel
- Add an "Advanced" or "Debug" toggle that shows:
  - which checks the simulator performs (e.g. nonce ordering, affordability cap)
  - key formulas used and the computed values for the currently selected item/transaction
- Keep it optional so the main UI stays beginner-friendly.

### 9.3 Tooltip-in-button micro-UX
If a tooltip icon lives inside a clickable control (button/chip), prevent accidental action triggers:
- Wrap the tooltip in an inner element that calls `stopPropagation()` on click/mousedown/pointerdown.

## 10) Final validation before shipping

Run:

```bash
npm run typecheck
npm run build
```

Then spot-check:

- language switching (EN/FR/ES)
- tooltips positioning near screen edges
- "View details" modal shows translated takeaways
- demo thumbnail renders correctly (emoji vs image)
