# Blockchain Learning Hub

**Interactive demonstrations of cutting-edge blockchain concepts, protocols, and mechanisms.**

👉 **Live:** [blockchain-demo-hub.vercel.app](https://blockchain-demo-hub.vercel.app)

Most blockchain tutorials stop at "what is a hash". This hub focuses on the mechanisms you actually meet in modern protocols — MEV auctions, data availability sampling, fraud-proof dispute games, parallel execution, restaking — and lets you *play* with them instead of reading about them.

Each demo is a hands-on simulation with:

- 🎛️ **Interactive controls**: change parameters and watch the system react
- 🧭 **60-second tour & learning quests**: short guided tasks to check that you understood the mechanism
- 📖 **Glossary tooltips** on every key term
- 🌐 **Real-world applications** and 📚 **further reading**
- 🌍 **Multilingual UI**: English, French, Spanish

## Demos

| Demo | Category | Level |
| --- | --- | --- |
| Minimal Ethereum Blockchain | Consensus | Beginner |
| ERC Standards Playground | DeFi | Beginner |
| Wallet UX & Transaction Lifecycle | Execution | Beginner |
| EVM vs SVM | Execution | Beginner |
| AMM Math & Impermanent Loss | DeFi | Intermediate |
| Stablecoin Depeg Cascade | DeFi | Intermediate |
| Parallel Transaction Executor (Solana vs Block-STM) | Execution | Intermediate |
| MEV & PBS (MEV-Boost) Simulator | Execution | Intermediate |
| Layer 2 Rollup | Scaling | Intermediate |
| State Channels (Payment Channels) | Scaling | Intermediate |
| Fraud Proofs (Arbitrum Dispute Game) | Scaling | Advanced |
| PeerDAS Sampling | Data availability | Advanced |
| EigenLayer Restaking | Security | Advanced |
| Cross-Chain Protocols | Interoperability | Advanced |
| DAG Consensus (Tangle) | Consensus | Advanced |

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, i18next, Lucide icons
- **Backend:** Vercel serverless functions (`api/`) for analytics and demo status
- **Storage (optional):** Supabase or Upstash Redis for analytics

## Getting started

Requirements: Node.js 18+.

```bash
npm install
npm run dev          # http://localhost:5173
```

The demos run entirely in the browser; no backend is needed to explore them.

To run the serverless API locally as well (analytics, admin), use the [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm run dev:vercel
```

Other scripts:

| Command | Description |
| --- | --- |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run the TypeScript compiler without emitting |
| `npm test` | Run the unit tests once ([Vitest](https://vitest.dev)) |
| `npm run test:watch` | Run the unit tests in watch mode |

## Project structure

```
api/                     Vercel serverless functions (analytics, admin, demo status)
src/
  demos/
    impl/                One file per demo (auto-discovered)
    demoRegistry.ts      Demo metadata: title, category, difficulty, takeaways, tags
    glossary.ts          Glossary terms used by tooltips and "Key concepts" chips
  locales/               en / fr / es translations
  pages/                 Hub, demo page, admin, analytics
  ui/                    Shared components (hub grid, tooltips, modals, language switcher)
```

## Adding a new demo

1. **Create the component** in `src/demos/impl/<your_demo>.tsx` with a default export. Files in this folder are discovered automatically; the route becomes `/demo/<id>`.
2. **Register metadata** in `src/demos/demoRegistry.ts`, keyed by the file name in kebab-case: title, description, category, difficulty, thumbnail, concepts, key takeaways, tags.
3. **Make the UI translatable**: get `tr` from `useDemoI18n('<id>')` and wrap every user-facing string in `tr('...')`. Add translations under `demos.<id>` in `src/locales/fr.json` and `es.json`. English is the source text and the fallback.
4. **Back every concept with the glossary**: add new terms to `GlossaryKey` and `EN_GLOSSARY` in `src/demos/glossary.ts`, plus `glossary.<Term>` in the locale files.
5. **Teach, don't just show**: add a 60-second tour, `EduTooltip`s on actions and ambiguous labels, learning quests (`learningQuestsTotal` in the registry), a real-world applications section, and further reading.
6. **Keep simulation logic testable**: put the math/state logic in a plain `.ts` module next to the demo (see `impl/amm/`, `impl/wallet_tx/`, `impl/evm_vs_svm/`) and add a `*.test.ts` file beside it.
7. Run `npm run typecheck`, `npm test` and `npm run build` before opening a PR.

## Deployment & environment variables

The site deploys to Vercel as-is (`vercel.json` handles SPA routing and the `/api` routes). The demos need no configuration. The variables below only enable the optional analytics and admin features:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Analytics storage (preferred) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Analytics storage (fallback if Supabase is not set) |
| `ANALYTICS_SLUG`, `ANALYTICS_USER`, `ANALYTICS_PASS` | Access to the private dashboard at `/a/<slug>/analytics` |
| `ADMIN_TOKEN` | Access to `/admin`, used to change demo status |

Analytics stores only a SHA-256 hash of IP + user agent (for approximate unique-visitor counts), never the raw values.

## Contributing

Issues and pull requests are welcome: new demo ideas, corrections to the simulations' math or explanations, and translations.
