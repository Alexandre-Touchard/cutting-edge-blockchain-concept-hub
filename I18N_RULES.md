# Internationalization (i18n) rules for this project

This document describes the conventions and rules used to internationalize this application.

## 1) Supported languages

- `en` (English) is the source / default language.
- `fr` (French) is currently being added.
- `es` (Spanish) is planned for later.

## 2) Language selection & persistence

- The language selector is rendered in the top-right of the Hub and Demo pages.
- Language choice is persisted in `localStorage` under the key `lang`.

## 3) Core UI strings

- Use `react-i18next`’s `useTranslation()` hook in React components.
- Replace hard-coded UI strings with `t('...')` keys stored in locale JSON files.

## 4) Demo internal strings (large interactive demos)

### 4.1 Translation helper

For demo implementations, use the demo helper:

- `src/demos/useDemoI18n.ts`

Pattern:

```ts
const { tr } = useDemoI18n('<demoId>');

<h1>{tr('English string')}</h1>
```

This helper:

- Generates a stable auto-key for each English string (hash-based).
- Uses the provided English string as `defaultValue`.
- Allows translations to be added later without changing code.

### 4.2 Do not compute translated strings once at load time

Avoid “baking” translations into data structures that are computed once.

Specifically:

- If demo metadata is computed via `loadDemos()`, it must be recomputed when the language changes.
- Hub/Demo pages should re-run memoized `loadDemos()` when `i18n.resolvedLanguage` changes.

## 5) Demo metadata translation

Demo metadata (title/description/key takeaways/tags) is translated by overlaying i18n keys over the English defaults.

The system should:

- Keep English values as fallbacks.
- Use i18n keys such as `demos.<demoId>.title`, `demos.<demoId>.description`, etc.

## 6) Glossary translation

Glossary definitions are language-aware:

- English definitions live as the fallback.
- Overrides can be supplied in locale JSON under `glossary.<term>`.

## 7) Technical terminology & code identifiers

### 7.1 Code identifiers

- Do **not** translate code identifiers, function names, calldata, or anything inside `<code>...</code>` blocks.
  - Examples: `safeTransferFrom`, `tokenFallback`, `UserOperation`, `EntryPoint`, `validateUserOp`, calldata strings.

### 7.2 Technical terms in prose (global “first mention” rule)

For technical terms used in prose/UI text (outside `<code>`), we follow this rule:

- Translate the term into French.
- On the **first mention globally across the ERC Standards page**, include the English/spec term in parentheses.
- On subsequent mentions, use **French-only**.

Example:

- First mention: `Regroupeur (Bundler)`
- Later: `Regroupeur`

This is intended to keep the UI readable while preserving the canonical ecosystem vocabulary.

> Note: This “first mention globally” rule applies to the ERC Standards page content. If we extend it to other pages/demos, we should implement it consistently.

### 7.3 “revert/reverted” translation

- Translate “revert/reverted” consistently as **“échoué”** in user-facing messages.
- Keep the underlying reason/code identifiers in English when they are code.

## 8) Shared component prop safety

Some shared ERC Standards helper components (e.g. `ImplementationSection`) are used with multiple prop shapes.

Rules:

- Components must not assume a prop exists unless it is enforced by types and all call sites comply.
- Components must not call `.map()` on possibly-undefined props.
- When translation helpers (`tr`) are used in a helper component, either:
  - require it and ensure all call sites pass it, or
  - make it optional and use a local fallback (`useDemoI18n('erc-standards')`).

## 9) Translation workflow (recommended)

1. Wrap user-facing strings with `tr('English...')` (or `t('...')` for core UI).
2. Extract auto-keys (if needed) and add French translations to `src/locales/fr.json`.
3. Validate:
   - `npm run typecheck`
   - `npm run build`
4. Spot-check language switching without reloading.

## 10) Locale file expectations

- Locale JSON files must be strict JSON (no trailing commas, no comments).
- Prefer consistent punctuation and spacing.
- Keep translations literal unless explicitly requested otherwise.
