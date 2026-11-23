import type { DemoMeta } from '../ui/Hub';

/**
 * Optional curated metadata for demos.
 *
 * Key: inferred id from filename in `src/demos/impl` (see `filenameToId()` in loadDemos.ts).
 * Value: any DemoMeta fields you want to override/enrich.
 */
const demo13Thumb = new URL('../public/photo/Demo13.png', import.meta.url).href;

export const demoMetaRegistry: Record<string, Partial<DemoMeta>> = {
  'hashes-merkle-signatures': {
    id: 'hashes-merkle-signatures',
    title: 'Hashes, Merkle Trees & Signatures',
    category: 'security',
    difficulty: 'Beginner',
    thumbnail: '🔐',
    description:
      'Change one transaction and watch the change ripple up a Merkle tree to the root. Then play with SHA-256, prove a transaction is in a block with a few hashes, sign and verify messages, and try to forge a signed block.',
    concepts: ['Hash Function', 'Avalanche Effect', 'Merkle Tree', 'Merkle Root', 'Merkle Proof', 'Digital Signature', 'Public Key', 'Private Key'],
    keyTakeaways: [
      'A hash is a fixed-size fingerprint: the same input always gives the same hash, and a one-character change gives a completely different one.',
      'A Merkle root commits to every transaction below it, and a proof of just log₂(n) hashes shows that one transaction is in the block.',
      'A signature proves that the holder of a private key approved exactly this message; anyone can check it with the public key.'
    ],
    tags: ['SHA-256', 'Merkle tree', 'ECDSA', 'Cryptography'],
    learningQuestsTotal: 8,
    addedAt: '2026-11-23'
  },
  'automated-market-maker-demo': {
    id: 'amm-demo',
    learningQuestsTotal: 5,
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
    learningQuestsTotal: 5,
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
    learningQuestsTotal: 5,
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
    learningQuestsTotal: 5,
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
    learningQuestsTotal: 5,
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
    learningQuestsTotal: 6,
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
    learningQuestsTotal: 5,
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
    learningQuestsTotal: 5,
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
    learningQuestsTotal: 4,
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
  },

  'fraud-proofs-arbitrum-dispute-game': {
    id: 'fraud-proofs-arbitrum',
    learningQuestsTotal: 5,
    title: 'Fraud Proofs (Optimistic Rollup Arbitrum Dispute Game)',
    category: 'scaling',
    difficulty: 'Advanced',
    thumbnail: '⚖️',
    description:
      'Interactive Arbitrum-style dispute game: challenge an invalid rollup assertion via bisection until L1 verifies a single step.',
    concepts: ['Rollups', 'Fraud Proofs', 'Bisection', 'Challenge Period', 'Bond'],
    keyTakeaways: [
      'A proposer posts an assertion and a bond; a challenger can dispute within a window',
      'Interactive bisection narrows the disagreement to a single disputed step',
      'L1 verification of one step keeps disputes cheap while preserving security'
    ],
    tags: ['Arbitrum', 'Optimistic Rollups', 'Fraud Proofs', 'Dispute Game']
  },

  'wallet-transaction-lifecycle': {
    id: 'wallet-tx-lifecycle',
    title: 'Wallet UX & Transaction lifecycle',
    category: 'execution',
    difficulty: 'Beginner',
    thumbnail: '👛',
    description:
      'Simulate what happens when you click “confirm” in a wallet: nonces, EIP-1559 fees, mempool inclusion, ignored vs pending txs, replacement (speed up / cancel), and common revert reasons.',
    concepts: ['Nonce', 'Gas Economics', 'Transaction Pool', 'Approval', 'Allowance'],
    learningQuestsTotal: 5,
    keyTakeaways: [
      'Your nonce enforces per-account ordering; a gap blocks later txs from being mined',
      'With EIP-1559, you set max fee + priority fee; effective gas price is min(maxFee, baseFee + priorityFee)',
      'Wallets check affordability using the cap: value + gasLimit × maxFee (not today’s effective price)',
      'If base fee rises above max fee, the tx is ignored until base fee drops (or you replace it)',
      'Speed up / cancel replaces the pending tx (same nonce) and typically requires a fee bump (≈10%)'
    ],
    tags: ['Wallets', 'EIP-1559', 'Mempool', 'Gas', 'Nonce']
  },

  'state-channels-demo': {
    id: 'state-channels',
    learningQuestsTotal: 5,
    title: 'State Channels (Payment Channels)',
    category: 'scaling',
    difficulty: 'Intermediate',
    thumbnail: new URL('../public/photo/Demo11.png', import.meta.url).href,
    description:
      'Lock deposits on L1, exchange signed updates off-chain, then settle cooperatively or via a dispute window.',
    concepts: ['State Channels', 'Challenge Period', 'Nonce', 'Signatures'],
    keyTakeaways: [
      'Most interactions happen off-chain; only open/close touch L1',
      'The newest signed state (highest nonce) wins during disputes',
      'Channels enable instant micro-payments and high-frequency app interactions'
    ],
    tags: ['Lightning', 'Raiden', 'Micropayments', 'Scaling']
  },
  'mev-pbs-simulation': {
    id: 'mev-pbs',
    title: 'MEV & PBS (MEV-Boost) simulator',
    description:
      'Interactive simulator for MEV (sandwiching, backrun arbitrage), bundles/private transactions, and proposer-builder separation (PBS).',
    thumbnail: new URL('../public/photo/MEV_boost.png', import.meta.url).href,
    category: 'execution',
    difficulty: 'Intermediate',
    status: 'coming_soon',
    tags: ['MEV', 'PBS', 'Mempool', 'Bundles', 'MEV-Boost'],
    concepts: ['Ordering', 'Mempool'],
    keyTakeaways: [
      'MEV comes from transaction ordering power, not just “high gas”.',
      'Private bundles can reduce your sandwich exposure by hiding intent from the public mempool.',
      'PBS turns MEV into a block-building auction: builders bid, proposers pick the highest bid.'
    ],
    learningQuestsTotal: 5
  },

  'stablecoin-depeg-simulation': {
    id: 'stablecoin-depeg',
    title: 'Stablecoin Depeg Cascade',
    category: 'defi',
    difficulty: 'Intermediate',
    thumbnail: new URL('../public/photo/Demo14.png', import.meta.url).href,
    description:
      'Simulate two depeg cascades: (1) collateralized stablecoin liquidations and liquidity drains, and (2) Terra-style algorithmic reflexive collapse.',
    concepts: ['Stablecoin', 'Depeg', 'Liquidity', 'Slippage', 'Price Impact', 'Oracle Networks', 'Liquidation', 'Reflexivity'],
    learningQuestsTotal: 16,
    keyTakeaways: [
      'Low liquidity amplifies price moves: the same sell pressure causes more slippage and faster depegs',
      'Collateral crashes can trigger liquidations that sell collateral into markets, worsening the cascade',
      'Algorithmic pegs can fail reflexively: redemptions mint supply, collapsing the backstop token and the stablecoin'
    ],
    tags: ['Stablecoins', 'Depeg', 'Systemic risk', 'Cascades'],
    status: 'coming_soon'
  },

  'evm-vs-svm': {
    id: 'evm-vs-svm',
    title: 'Sequential vs Parallel Execution (EVM vs SVM)',
    thumbnail: demo13Thumb,
    description:
      'Run the same transactions one by one (Ethereum) and in parallel waves (Solana), and see why declaring accounts upfront enables parallelism, and what still forces transactions to wait.',
    category: 'execution',
    difficulty: 'Beginner',
    tags: ['Ethereum', 'Solana', 'Sealevel', 'Parallel execution'],
    concepts: ['Sequential execution', 'Parallel scheduling', 'Account locks', 'Read/write conflicts'],
    learningQuestsTotal: 8,
    keyTakeaways: [
      'Ethereum runs transactions one by one because they don’t declare the state they touch; Solana transactions declare their accounts, so non-conflicting ones run in parallel.',
      'Two transactions conflict only if they touch the same account and at least one writes; reads can be shared.',
      'Parallelism doesn’t remove ordering: hot accounts still serialise transactions, and order still creates MEV.'
    ],
    status: 'coming_soon'
  },
  'arkea-heist-tracing': {
    id: 'arkea-heist',
    title: 'Follow the Money: the Crédit Mutuel Arkéa Heist',
    description:
      'Step through a real 2026 bank heist, from a compromised supplier to instant transfers, crypto laundering and Monero, and see how on-chain analysts traced it. Every claim shows its confidence level and sources.',
    thumbnail: '🕵️',
    category: 'security',
    difficulty: 'Beginner',
    tags: ['Forensics', 'On-chain analytics', 'Stablecoins', 'Monero', 'Incident response'],
    concepts: ['On-chain Analytics', 'Peeling Chain', 'Stablecoin Freeze', 'Instant Exchange', 'Cross-Chain Bridge', 'Monero', 'Instant Payment', 'Third-Party Risk'],
    keyTakeaways: [
      'Stolen money was turned into crypto within hours to outrun freezes by banks, exchanges and stablecoin issuers.',
      'Public blockchains let independent analysts detect and trace a theft before the victim announces it, until funds reach privacy coins like Monero.',
      'In a live incident, separate what is confirmed, reported and unverified, and always cite who said what.'
    ],
    learningQuestsTotal: 5,
    addedAt: '2026-11-22'
  },
};
