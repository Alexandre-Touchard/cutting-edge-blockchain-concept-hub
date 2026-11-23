// Curated learning paths shown on the hub ("1 → 2 → 3"). Demo ids are registry ids.
// Titles/descriptions are English defaults; translations live under hub.paths.<id>.* in the locales.

export type LearningPath = {
  id: string;
  title: string;
  description: string;
  demoIds: string[];
};

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'basics',
    title: 'Blockchain basics',
    description: 'Start here: how hashes, signatures, blocks, transactions, wallets and tokens actually work.',
    demoIds: ['hashes-merkle-signatures', 'ethereum-blockchain', 'wallet-tx-lifecycle', 'erc-standards', 'evm-vs-svm']
  },
  {
    id: 'defi',
    title: 'DeFi fundamentals',
    description: 'Exchanges without order books, stablecoins under stress, and who profits from transaction ordering.',
    demoIds: ['amm-demo', 'makerdao-vault', 'stablecoin-depeg', 'mev-pbs']
  },
  {
    id: 'scaling',
    title: 'Scaling Ethereum',
    description: 'Rollups, fraud proofs, data availability sampling and payment channels.',
    demoIds: ['rollup-simulation', 'fraud-proofs-arbitrum', 'peerdas-demo', 'state-channels', 'parallel-executor']
  },
  {
    id: 'security',
    title: 'Security & cross-chain',
    description: 'Bridges, shared security, alternative consensus, and following stolen funds on-chain.',
    demoIds: ['blockchain-interop', 'eigenlayer-demo', 'dag-consensus', 'arkea-heist']
  }
];

/** First demo to open for "Start with the basics". */
export const START_DEMO_ID = LEARNING_PATHS[0].demoIds[0];

/** Demos published within `days` of `now` are "new". */
export function isNewDemo(addedAt: string | undefined, now: Date, days = 60): boolean {
  if (!addedAt) return false;
  const t = Date.parse(addedAt);
  return !Number.isNaN(t) && now.getTime() - t <= days * 24 * 3600 * 1000 && now.getTime() >= t;
}
