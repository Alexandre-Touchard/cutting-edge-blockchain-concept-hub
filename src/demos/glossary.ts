import i18n from '../i18n';
import { glossaryKey } from './i18nKeys';

// NOTE: This file provides the glossary in a language-aware way.
// English strings live here as a fallback, while French/Spanish can be provided
// via i18n resources under `glossary.<term>`.

export type GlossaryKey =
  // Hub/demo details concepts (from demoRegistry)
  | 'Constant Product'
  | 'Slippage'
  | 'Liquidity Provision'
  | 'Transaction Ordering'
  | 'Conflict Detection'
  | 'Block-STM'
  | 'Directed Acyclic Graph'
  | 'Tip Selection'
  | 'Cumulative Weight'
  | 'Confirmation'
  | 'Rollups'
  | 'Batching'
  | 'State Roots'
  | 'Data Compression'
  | 'Gas Economics'
  | 'Shared Security'
  | 'AVS'
  | 'Economic Security'
  | 'Slashing'
  | 'Data Availability'
  | 'Random Sampling'
  | 'Erasure Coding'
  | 'Column Distribution'
  | 'Proof of Work'
  | 'Account Model'
  | 'Mining'
  | 'State Machine'
  | 'Transaction Pool'
  | 'Light Clients'
  | 'Oracle Networks'
  | 'Cross-Chain Messaging'
  | 'Trust Models'
  // ERC standards
  | 'ERC Standards'
  | 'ERC-20'
  | 'ERC-721'
  | 'ERC-1155'
  | 'Approval'
  | 'Allowance'
  | 'Fungible Token'
  | 'Non-Fungible Token'
  | 'Multi-Token'
  | 'Token ID'
  | 'transfer'
  | 'approve'
  | 'transferFrom'
  | 'ownerOf'
  | 'mint'
  | 'burn'
  | 'safeTransferFrom'
  | 'Total Supply'
  | 'Partition'
  | 'transferByPartition'
  | 'Operator'
  | 'authorizeOperator'
  | 'send'
  | 'operatorSend'
  | 'Composable NFT'
  | 'ERC1820Registry'
  | 'IERC1155Receiver'
  | 'onERC721Received'
  | 'TransferSingle'
  | 'TransferBatch'
  | 'ApprovalForAll'
  | 'URI'
  | 'ERC-4626'
  | 'deposit'
  | 'withdraw'
  | 'redeem'
  | 'shares'
  | 'assets'
  | 'ERC-223'
  | 'tokenFallback'
  | 'ERC-827'
  | 'transferAndCall'
  | 'approveAndCall'

  // Other glossary terms used throughout demos
  | 'Layer 2 Rollup'
  | 'Gas Saved'
  | 'Merkle Root'
  | 'State Root'
  | 'DAG Consensus'
  | 'Current Tips'
  | 'Weight'
  | 'Restaking'
  | 'Active AVS'
  | 'Interoperability'
  | 'IBC'
  | 'Difficulty'
  | 'Nonce'
  | 'Parallel Execution'
  | 'Conflict Rate'
  // AMM
  | 'Pool TVL'
  | 'Price'
  | 'Impermanent Loss'
  | 'LP Tokens'
  | 'Pool Reserves'
  | 'Constant Product (k)'
  | 'Trading Fee'
  | 'Price Impact'
  | 'Fee'
  | 'Rate'
  | 'Liquidity & IL'
  | 'Add Liquidity'
  | 'Pool Share'
  | 'Impermanent Loss Calculator'
  | 'Initial Price'
  | 'Current Price'
  | 'Price Change'
  | 'IL Formula'
  // PeerDAS
  | 'Network Nodes'
  | 'Columns/Node'
  | 'Samples/Node'
  | 'Coverage'
  | 'Availability'
  ;

export const EN_GLOSSARY: Record<GlossaryKey, string> = {
  // Hub/demo details concepts
  'Constant Product':
    'A pricing rule used by many AMMs: keep the product of reserves constant (x × y = k), which implies a curve where price changes as reserves change.',
  Slippage:
    'The difference between the expected price (spot price) and the actual execution price of a trade. Slippage increases when liquidity is low or trades are large.',
  'Liquidity Provision':
    'Depositing assets into a pool (e.g., an AMM) so that traders can swap against it. Liquidity providers earn fees and take on price risk (e.g., impermanent loss).',
  'Transaction Ordering':
    'The rule/process that decides which transactions execute first. Ordering impacts fairness, MEV, and the final state.',
  'Conflict Detection':
    'Determining whether two transactions touch overlapping state (read/write sets). Conflicts limit how much execution can be parallelized.',
  'Block-STM':
    'An optimistic parallel execution technique: run transactions in parallel, detect conflicts, and re-execute the ones that conflict until a consistent result is reached.',
  'Directed Acyclic Graph':
    'A graph with directed edges and no cycles. In DAG-ledgers, transactions reference previous ones, forming a partial order instead of a single chain of blocks.',
  'Tip Selection':
    'A strategy to pick which unconfirmed DAG transactions (“tips”) a new transaction should reference as parents.',
  'Cumulative Weight':
    'A measure of how much confirmation a DAG transaction has accumulated, often based on how many later transactions reference it directly or indirectly.',
  Confirmation:
    'The process by which the network gains confidence that a transaction is final/accepted (probabilistically in many DAG systems).',
  Rollups:
    'Layer-2 systems that execute transactions off L1 and post compressed data plus commitments (state roots and/or proofs) to L1 to inherit its security.',
  Batching:
    'Combining many L2 transactions into a single “batch” that is posted to L1. Batching amortizes fixed costs and reduces per-tx fees.',
  'State Roots':
    'Hashes that commit to the entire state after executing a batch. They allow verification of state transitions without downloading the full state.',
  'Data Compression':
    'Techniques that reduce how much data must be posted to L1 (e.g., signature aggregation, calldata compression), lowering costs.',
  'Gas Economics':
    'How gas costs influence system design: what data is expensive on L1, why batching helps, and the tradeoffs between cost and security.',
  'Shared Security':
    'A model where multiple protocols/services reuse the same validator set or economic stake for security, rather than bootstrapping security from scratch.',
  AVS:
    'Actively Validated Service: an external service secured by restaked validators (e.g., oracles, data availability, bridges).',
  'Economic Security':
    'Security derived from economic incentives/penalties (e.g., slashing). Attacks are deterred because misbehavior is costly.',
  Slashing:
    'A penalty mechanism that destroys or confiscates stake when validators misbehave (double-signing, invalid attestations, etc.).',
  'Data Availability':
    'The guarantee that the data needed to verify a block/batch is accessible. Without DA, you cannot verify execution even if you have a state commitment.',
  'Random Sampling':
    'Checking a random subset of data to infer, with high probability, that the full dataset is available (used in data-availability sampling).',
  'Erasure Coding':
    'A redundancy technique that splits data into pieces so the original can be reconstructed from a subset. Enables sampling-based DA guarantees.',
  'Column Distribution':
    'How encoded data is organized (e.g., into columns) and distributed across peers so that no single node must store everything.',
  'Proof of Work':
    'A consensus mechanism where miners repeatedly hash with a nonce to find a value below a target (difficulty). It makes block production costly to fake.',
  'Account Model':
    'A state model where balances and nonces are stored per account (like Ethereum). Transactions mutate account state directly (vs UTXO model).',
  Mining:
    'The process of producing new blocks (e.g., by solving PoW) and collecting rewards/fees.',
  'State Machine':
    'A system where transactions are inputs that deterministically transition the global state to a new state.',
  'Transaction Pool':
    'The set of pending transactions waiting to be included in a block (often called the mempool).',
  'Light Clients':
    'Clients that verify chain correctness using only headers and cryptographic proofs, without downloading full blocks/state.',
  'Oracle Networks':
    'Decentralized networks that fetch/verify off-chain data and deliver it on-chain with security assumptions (e.g., quorum, staking, slashing).',
  'Cross-Chain Messaging':
    'Sending authenticated messages between blockchains (not necessarily tokens). The core question is how the destination chain verifies the source event.',
  'Trust Models':
    'The assumptions required for security (e.g., light-client verification vs multisig vs oracle/relayer). Different interoperability protocols trade off trust, cost, and complexity.',

  // ERC standards
  'ERC Standards':
    'Ethereum Request for Comments (ERC) standards define common interfaces (function signatures + events) so wallets, dApps, and tooling can integrate assets consistently.',
  'ERC-20':
    'The standard interface for fungible tokens. Defines functions like balanceOf, transfer, approve, allowance, and transferFrom.',
  'ERC-721':
    'The standard interface for NFTs (non-fungible tokens). Each tokenId is unique and has a single owner, with per-token approvals.',
  'ERC-1155':
    'A multi-token standard supporting many token IDs (fungible and NFT-like) within a single contract, with batch operations and safe transfers.',
  Approval:
    'A permission granted to another address/contract to move your tokens (ERC-20 allowance, or ERC-721 operator/token approval). This is powerful and should be used carefully.',
  Allowance:
    'In ERC-20, allowance(owner, spender) is the remaining amount the spender is permitted to transfer from the owner using transferFrom.',
  'Fungible Token':
    'A token where each unit is interchangeable with any other unit (like dollars). Balances are numbers, not unique IDs.',
  'Non-Fungible Token':
    'A token where each unit is unique (identified by a tokenId). Ownership is tracked per tokenId rather than as a single balance.',
  'Multi-Token':
    'A token standard that can represent multiple assets (token IDs) within one contract, where each ID can have its own supply and fungibility.',
  'Token ID':
    'An identifier for a specific NFT (ERC-721) or a specific asset class (ERC-1155).',
  transfer:
    'ERC-20: move tokens from msg.sender to a recipient. Fails if balance is insufficient.',
  approve:
    'Set an allowance or approval so another address can move tokens on your behalf. In ERC-20 this sets allowance; in ERC-721 it can approve a tokenId or an operator.',
  transferFrom:
    'ERC-20: move tokens from an owner to a recipient using an allowance previously set via approve.',
  ownerOf:
    'ERC-721: returns the current owner address of a given tokenId.',
  mint:
    'Create new tokens (increasing supply) and assign them to an address. Minting rules depend on the contract.',
  burn:
    'Destroy tokens (reducing supply) from an address. Burning rules depend on the contract.',
  safeTransferFrom:
    'ERC-721/ERC-1155: transfer with an additional safety check when the recipient is a contract (it must implement the receiver interface).',
  'Total Supply':
    'The number of tokens that exist. In ERC-20 it is typically the sum of all balances.',
  Partition:
    'In security-token standards (e.g., ERC-1400), a partition is a labeled bucket of balances that can have distinct rules (lockups, KYC requirements, transfer restrictions).',
  transferByPartition:
    'An ERC-1400-style transfer method that moves tokens within a specific partition. Including the partition in the call lets the contract apply partition-specific compliance rules.',
  Operator:
    'In ERC-777, an operator is an address authorized to send tokens on behalf of a token holder (a different permission model than ERC-20 allowances).',
  authorizeOperator:
    'ERC-777 method to authorize an operator to act on behalf of the token holder. Operators can then call operatorSend/operatorBurn.',
  send:
    'ERC-777 method that transfers tokens and triggers hooks (tokensToSend/tokensReceived) when applicable.',
  operatorSend:
    'ERC-777 method allowing an authorized operator to send tokens from a holder to a recipient, with hooks triggered when registered.',
  'Composable NFT':
    'An NFT that can own other assets (child NFTs or fungible tokens), enabling nested ownership and bundled transfers. ERC-998 explores patterns for this.',
  ERC1820Registry:
    'A registry contract (ERC-1820) that maps addresses to interface implementers. ERC-777 uses it to discover hook implementers for tokensToSend/tokensReceived.',
  IERC1155Receiver:
    'The interface a contract must implement to safely receive ERC-1155 tokens. It defines onERC1155Received and onERC1155BatchReceived.',
  onERC721Received:
    'The ERC-721 receiver callback. safeTransferFrom calls this on contract recipients; if not implemented (or returns the wrong value) the transfer reverts to avoid locking NFTs.',
  TransferSingle:
    'ERC-1155 event emitted for a single-token-id transfer: operator, from, to, id, value.',
  TransferBatch:
    'ERC-1155 event emitted for a batch transfer over multiple token IDs and amounts.',
  ApprovalForAll:
    'Event used by ERC-721 and ERC-1155 to signal an operator approval toggle for all assets owned by an address.',
  URI:
    'ERC-1155 metadata event indicating the URI template for a token ID (often includes {id} substitution).',

  'ERC-4626':
    'A standard interface for tokenized vaults. Users deposit an underlying asset and receive vault shares; shares can later be redeemed for assets using standardized conversion functions.',
  deposit:
    'An ERC-4626 action where a user provides assets to the vault and receives shares. Implementations typically use convertToShares/previewDeposit to quote amounts.',
  withdraw:
    'An ERC-4626 action where a user receives a target amount of assets and the vault burns the required shares. previewWithdraw can be used to quote required shares.',
  redeem:
    'An ERC-4626 action where a user burns a specified number of shares and receives assets. previewRedeem can be used to quote assets out.',
  shares:
    'In ERC-4626, shares represent proportional ownership of the vault. Their value changes as the vault earns yield or incurs losses.',
  assets:
    'In ERC-4626, assets are the underlying tokens held by the vault (e.g., USDC, DAI). Users deposit assets and receive shares.',

  'ERC-223':
    'A token transfer standard intended to prevent tokens being accidentally sent to contracts that cannot handle them, by requiring a receiver callback when transferring to contracts.',
  tokenFallback:
    'The ERC-223 receiver callback concept: when transferring tokens to a contract, the token contract calls tokenFallback on the recipient so it can accept/reject and handle incoming tokens.',

  'ERC-827':
    'An ERC-20 extension that allows transfers/approvals to include extra call data, enabling a token transfer to trigger a function call in the same transaction. Powerful but higher risk.',
  transferAndCall:
    'An ERC-827-style pattern where a transfer also performs a call on a target contract (using provided data). This couples token movement with arbitrary execution.',
  approveAndCall:
    'An ERC-827-style pattern where an approval is granted and then a call is executed, often used to reduce multi-transaction UX for DeFi interactions.',

  'Layer 2 Rollup':
    'A Layer 2 rollup executes transactions on an L2 and posts compressed data plus a state commitment to L1. Users inherit L1 security while reducing fees.',
  'Gas Saved':
    'Gas saved is the difference between submitting all transactions individually on L1 vs batching them into a single rollup batch on L1.',
  'Merkle Root':
    'A Merkle root is a single hash that commits to a list of items (e.g., transactions). It enables efficient proofs of inclusion.',
  'State Root':
    "A state root is a hash that commits to the system's state (e.g., balances) after executing a batch. Posting it to L1 lets users verify claimed state transitions.",
  'DAG Consensus':
    'DAG-based consensus represents transactions as a Directed Acyclic Graph. New transactions reference parents, and confirmation accumulates via references rather than fixed blocks.',
  'Current Tips':
    'Tips are transactions at the frontier of the DAG that have not yet been referenced (or have low confirmation). New transactions often choose tips as parents.',
  Weight:
    'Cumulative weight approximates how confirmed a transaction is. It increases as later transactions reference it directly or indirectly.',
  Restaking:
    'Restaking reuses an existing ETH stake to secure additional services (AVSs). It can earn extra rewards but adds additional slashing risk.',
  'Active AVS':
    'An AVS (Actively Validated Service) is an external protocol/service that validators can opt into securing via EigenLayer (e.g., oracles, bridges, data availability).',
  Interoperability:
    'Interoperability lets blockchains exchange messages (and sometimes assets) across chains. Protocols differ mainly by their trust/verification model.',
  IBC:
    'IBC (Inter-Blockchain Communication) is a Cosmos standard for trust-minimized cross-chain messaging using on-chain light clients and proof verification.',
  Difficulty:
    'Difficulty controls how hard mining is. Higher difficulty means the block hash must have more leading zeros, requiring more trial-and-error.',
  Nonce:
    'A nonce is a number miners vary to find a block hash that satisfies the difficulty target.',
  'Parallel Execution':
    'Parallel execution runs non-conflicting transactions at the same time to increase throughput. Conflicts happen when transactions touch overlapping state (read/write sets).',
  'Conflict Rate':
    'The fraction of transactions that conflict (touch overlapping state). High conflict rates reduce the benefit of parallel execution, especially for optimistic strategies.',

  // AMM
  'Pool TVL':
    'Total Value Locked (TVL) is the total dollar value of all tokens currently deposited in this liquidity pool.',
  Price:
    'The current exchange rate between tokens, determined by the ratio of reserves (Token B / Token A).',
  'Impermanent Loss':
    'The temporary loss compared to simply holding tokens, caused by price divergence. It becomes permanent only if you withdraw while the price ratio is unfavorable.',
  'LP Tokens':
    "Liquidity Provider (LP) tokens represent your share of the pool. They can be redeemed for your portion of the pool's reserves plus accumulated fees.",
  'Pool Reserves':
    'The amounts of each token currently held by the pool. These reserves determine price and are used in the constant product formula x × y = k.',
  'Constant Product (k)':
    'The invariant k = x × y must remain constant during swaps (before fees). As one reserve increases, the other must decrease proportionally.',
  'Trading Fee':
    'The percentage fee charged on each swap. Fees are added to reserves and paid to liquidity providers (e.g., 0.3% on Uniswap V2).',
  'Price Impact':
    'How much a trade moves the price. Larger trades relative to pool size cause higher price impact. Roughly: (execution price − spot price) / spot price.',
  Fee:
    'The trading fee deducted from your input amount. This fee goes to liquidity providers as compensation for providing liquidity.',
  Rate:
    "The effective exchange rate for this specific trade, including fees and price impact (can differ from the spot price).",
  'Liquidity & IL':
    'Liquidity provision means depositing tokens to earn trading fees. Impermanent loss (IL) is the opportunity cost vs simply holding the tokens.',
  'Add Liquidity':
    'Deposit both tokens proportionally to the current pool ratio. In constant-product AMMs you typically must add liquidity in the same ratio as reserves.',
  'Pool Share':
    'The percentage of the pool you own. Your share determines how much you can withdraw and what portion of fees you earn.',
  'Impermanent Loss Calculator':
    'Compute potential IL by comparing the value of your LP position vs just holding the tokens at the new price.',
  'Initial Price':
    'The price ratio when you first provided liquidity. It is the baseline for calculating impermanent loss.',
  'Current Price':
    "The pool's current exchange rate based on the reserve ratio. It updates with every swap.",
  'Price Change':
    'Percentage change from the initial price. Larger price movements generally increase impermanent loss.',
  'IL Formula':
    'IL formula: 2×√(price_ratio) / (1 + price_ratio) − 1. Example: at 2× price change, IL ≈ −5.7%; at 5×, IL ≈ −25.5%. Fees can offset IL over time.',

  // PeerDAS
  'Network Nodes':
    'Number of nodes participating. Each node stores a subset of data columns and participates in sampling to verify availability.',
  'Columns/Node':
    "How many data columns each node stores. With 64 total columns, 16 columns/node means each node stores 25% of the data.",
  'Samples/Node':
    'How many random columns each node samples to verify availability. More samples increases confidence but uses more bandwidth.',
  Coverage:
    'Average redundancy factor: how many nodes store each column. Higher coverage improves fault tolerance if nodes go offline.',
  Availability:
    'Confirmed when nodes can retrieve their assigned samples. This statistically implies the whole blob is available with very high confidence.'
};

export function define(term: GlossaryKey): string {
  const fallback = EN_GLOSSARY[term];
  return i18n.t(glossaryKey(term), { defaultValue: fallback });
}

/** Non-throwing lookup for UI surfaces that may contain concepts not yet in the glossary. */
export function defineMaybe(term: string): string | undefined {
  // Best-effort lookup: if term is in the English glossary, allow i18n override.
  const fallback = (EN_GLOSSARY as Record<string, string>)[term];
  if (fallback) return i18n.t(glossaryKey(term), { defaultValue: fallback });
  return undefined;
}
