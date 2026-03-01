import type { DemoMeta } from '../ui/Hub';

/**
 * Optional curated metadata for demos.
 *
 * Key: inferred id from filename in `src/demos/impl` (see `filenameToId()` in loadDemos.ts).
 * Value: any DemoMeta fields you want to override/enrich.
 */
export const demoMetaRegistry: Record<string, Partial<DemoMeta>> = {
  'automated-market-maker-demo': {
    id: 'amm-demo',
    title: 'AMM Math & Impermanent Loss',
    category: 'defi',
    difficulty: 'Intermediate',
    thumbnail: new URL('../public/photo/Demo1.png', import.meta.url).href,
    description:
      'Interactive constant product AMM (x × y = k) with price impact, slippage, and impermanent loss calculations.',
    concepts: ['Constant Product', 'Price Impact', 'Slippage', 'Impermanent Loss', 'Liquidity Provision'],
    keyTakeaways: [
      'x × y = k formula enables automated market making without order books',
      'Price impact increases with trade size relative to pool reserves',
      'Impermanent loss occurs when price ratios change - at 2x price change IL is -5.7%'
    ],
    tags: ['Uniswap', 'DeFi', 'AMM', 'Liquidity']
  },
  'parallel-transaction-executor': {
    id: 'parallel-executor',
    title: 'Parallel Transaction Executor',
    category: 'execution',
    difficulty: 'Intermediate',
    thumbnail: new URL('../public/photo/Demo8.jpg', import.meta.url).href,
    description: 'Compare conservative (Solana) vs optimistic (Aptos Block-STM) parallel execution strategies.',
    concepts: ['Parallel Execution', 'Transaction Ordering', 'Conflict Detection', 'Block-STM'],
    keyTakeaways: [
      'Conservative scheduling avoids wasted work by analyzing dependencies upfront',
      'Optimistic execution maximizes parallelism but may re-execute conflicting transactions',
      'Trade-offs between predictability and throughput'
    ],
    tags: ['Solana', 'Aptos', 'Performance', 'Parallelization']
  },
  'dag-consensus': {
    id: 'dag-consensus',
    title: 'DAG Consensus (Tangle)',
    category: 'consensus',
    difficulty: 'Advanced',
    thumbnail: new URL('../public/photo/Demo3.png', import.meta.url).href,
    description:
      'Interactive DAG visualization showing how transactions reference tips and achieve consensus without traditional blocks.',
    concepts: ['Directed Acyclic Graph', 'Tip Selection', 'Cumulative Weight', 'Confirmation'],
    keyTakeaways: [
      "No miners needed - users confirm others' transactions",
      'Parallel transaction processing enables high throughput',
      'Weight accumulation provides probabilistic finality'
    ],
    tags: ['IOTA', 'DAG', 'Feeless', 'Tangle']
  },
  'layer2-rollup-simulation': {
    id: 'rollup-simulation',
    title: 'Layer 2 Rollup',
    category: 'scaling',
    difficulty: 'Intermediate',
    thumbnail: new URL('../public/photo/Demo6.png', import.meta.url).href,
    description: 'See how L2 transactions are batched and posted to L1 for massive gas savings.',
    concepts: ['Rollups', 'Batching', 'State Roots', 'Data Compression', 'Gas Economics'],
    keyTakeaways: [
      'Bundle hundreds of transactions into a single L1 transaction',
      'Users get instant L2 confirmation with eventual L1 security',
      '10-100x cost reduction compared to direct L1 posting'
    ],
    tags: ['Optimism', 'Arbitrum', 'ZK-Rollups', 'Scaling']
  },
  'eigenlayer-demo': {
    id: 'eigenlayer-demo',
    title: 'EigenLayer Restaking',
    category: 'security',
    difficulty: 'Advanced',
    thumbnail: new URL('../public/photo/Demo4.png', import.meta.url).href,
    description: 'Reuse ETH stake to secure multiple protocols (AVS) and earn additional rewards.',
    concepts: ['Restaking', 'Shared Security', 'AVS', 'Economic Security', 'Slashing'],
    keyTakeaways: [
      'Capital efficiency - one stake secures multiple services',
      'Earn base staking rewards + additional AVS yields',
      'Higher rewards come with compounded slashing risks'
    ],
    tags: ['EigenLayer', 'Staking', 'Shared Security', 'Ethereum']
  },
  'peerdas-demo': {
    id: 'peerdas-demo',
    title: 'PeerDAS Sampling',
    category: 'data',
    difficulty: 'Advanced',
    thumbnail: new URL('../public/photo/Demo9.png', import.meta.url).href,
    description: 'Peer Data Availability Sampling - nodes sample random columns instead of downloading everything.',
    concepts: ['Data Availability', 'Random Sampling', 'Erasure Coding', 'Column Distribution'],
    keyTakeaways: [
      'Nodes store only ~25% of data instead of 100%',
      'Random sampling proves data availability with high confidence',
      "Critical for scaling Ethereum's data layer for rollups"
    ],
    tags: ['Ethereum', 'Danksharding', 'Data Availability', 'Sampling']
  },
  'minimal-ethereum-blockchain-demo': {
    id: 'ethereum-blockchain',
    title: 'Minimal Ethereum Blockchain',
    category: 'consensus',
    difficulty: 'Beginner',
    thumbnail: '⛓️',
    description: 'Build a working blockchain from scratch with Proof of Work, accounts, and state transitions.',
    concepts: ['Proof of Work', 'Account Model', 'Mining', 'State Machine', 'Transaction Pool'],
    keyTakeaways: [
      'Blocks link via cryptographic hashes forming an immutable chain',
      'Mining adjusts difficulty to find valid block hashes',
      'Account-based model tracks balances and nonces'
    ],
    tags: ['Blockchain Basics', 'PoW', 'Mining', 'Fundamentals']
  },
  'erc-standards-showcase': {
    id: 'erc-standards',
    title: 'ERC Standards Playground',
    category: 'defi',
    difficulty: 'Beginner',
    thumbnail: '🧾',
    description:
      'Explore multiple ERC standards on one page. Start with ERC-20, ERC-721, and ERC-1155 with interactive actions, tooltips, and real-world context.',
    concepts: ['ERC Standards', 'ERC-20', 'ERC-721', 'ERC-1155', 'Approval'],
    keyTakeaways: [
      'ERC standards define interoperable interfaces so wallets, dApps, and exchanges can support assets consistently',
      'ERC-20 is fungible, ERC-721 is non-fungible, and ERC-1155 is multi-token (fungible + NFTs) in one contract',
      'Approvals/allowances are a core UX + security surface across standards'
    ],
    tags: ['Tokens', 'NFTs', 'Standards', 'EVM']
  },

  'blockchain-interoperability': {
    id: 'blockchain-interop',
    title: 'Cross-Chain Protocols',
    category: 'interop',
    difficulty: 'Advanced',
    thumbnail: '🌉',
    description: 'Compare IBC, CCIP, and LayerZero - different trust models for cross-chain messaging.',
    concepts: ['Light Clients', 'Oracle Networks', 'Cross-Chain Messaging', 'Trust Models'],
    keyTakeaways: [
      'IBC uses light clients for trustless verification',
      'CCIP relies on decentralized oracle consensus',
      'LayerZero requires independent Oracle + Relayer agreement'
    ],
    tags: ['IBC', 'Chainlink', 'LayerZero', 'Bridges']
  }
};
