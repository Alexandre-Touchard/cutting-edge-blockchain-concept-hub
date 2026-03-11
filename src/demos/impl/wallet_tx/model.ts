export const EOA_ADDRESSES = ['Alice', 'Bob', 'Charlie', 'Dave'] as const;
export type EOA = (typeof EOA_ADDRESSES)[number];

export type Address = EOA | 'DEX' | 'Miner';
export type TxType = 'eth_transfer' | 'erc20_approve' | 'dex_swap' | 'dex_swap_permit';
export type TxStatus =
  | 'mempool'
  | 'ignored'
  | 'executed_success'
  | 'executed_revert'
  | 'dropped'
  | 'replaced';

export type Account = { eth: number; dai: number; nonce: number };

export type PermitSig = {
  owner: EOA;
  spender: 'DEX';
  valueDai: number;
  nonce: number;
  /** Block number (in this simulator) after which the permit is invalid. */
  deadlineBlock: number;
  /** Toy signature string (for display only). */
  sig: string;
};

export type ReplacementReport = {
  replacedTxHash: string;
  baseFeeGwei: number;

  existingMaxFeeGwei: number;
  existingMaxPriorityGwei: number;
  requiredMaxFeeGwei: number;
  requiredMaxPriorityGwei: number;

  newMaxFeeGwei: number;
  newMaxPriorityGwei: number;

  existingEffectiveGasPriceGwei: number;
  newEffectiveGasPriceGwei: number;
  existingTipGwei: number;
  newTipGwei: number;

  needsMaxFeeBump: boolean;
  needsPriorityBump: boolean;
  tipImproved: boolean;
};

export type Tx = {
  hash: string;
  type: TxType;
  from: EOA;
  to: Address;
  nonce: number;

  /** Wallet created a signature for this tx (toy: same moment as broadcast in the UI). */
  signedAtMs?: number;

  /** Wallet submitted the tx to a node for propagation. */
  broadcastAtMs?: number;

  /** First block number when the tx was first seen in the mempool (toy TTL logic). */
  firstSeenBlock: number;

  /** If included, the block number that included this tx. */
  includedBlockNumber?: number;

  /** Optional EIP-2612-style permit signature attached to this tx (toy). */
  permitSig?: PermitSig;

  valueEth: number;
  daiAmount: number;

  gasLimit: number;
  maxFeeGwei: number;
  maxPriorityGwei: number;

  createdAtMs: number;
  status: TxStatus;

  // Execution summary (when included)
  baseFeeGwei?: number;
  effectiveGasPriceGwei?: number;
  gasUsed?: number;
  feePaidEth?: number;
  burnedEth?: number;
  tipPaidEth?: number;
  error?: string;
  replacedBy?: string;

  /** If this tx was dropped because a replacement attempt was rejected, details are provided here. */
  replacementReport?: ReplacementReport;
};

export type ChainBlock = {
  number: number;
  baseFeeGwei: number;
  gasUsed: number;
  txHashes: string[];
  timestampMs: number;
};

export type ReorgLog = {
  blockNumber: number;
  txHashes: string[];
  timestampMs: number;
};

export type WalletTxSnapshot = {
  baseFeeGwei: number;
  blockNumber: number;
  blockMaxGas: number;
  blockTargetGas: number;
  lastBlockGasUsed: number;
  lastReorg: ReorgLog | null;
  permitNonce: Record<EOA, number>;
  accounts: Record<Address, Account>;
  dexAllowance: Record<EOA, number>;
  mempool: Tx[];
  history: Record<string, Tx>;
  blocks: ChainBlock[];
};

export type WalletTxState = {
  /** Current base fee (gwei) used for EIP-1559 effective gas price calculations. */
  baseFeeGwei: number;

  /** Latest mined block number in this simulator. */
  blockNumber: number;

  /** EIP-1559 gas accounting (toy but formula-accurate). */
  blockMaxGas: number;
  blockTargetGas: number;
  lastBlockGasUsed: number;

  /** Recent blocks (head at index 0). */
  blocks: ChainBlock[];

  /** Snapshot of the state before the last mined block (allows a 1-block reorg). */
  reorgSnapshot: WalletTxSnapshot | null;

  /** Last reorg event (for a UI trace panel). */
  lastReorg: ReorgLog | null;

  /** Toy ERC-20 permit nonces (like EIP-2612 nonces(owner)). */
  permitNonce: Record<EOA, number>;

  accounts: Record<Address, Account>;
  dexAllowance: Record<EOA, number>;
  mempool: Tx[];
  history: Record<string, Tx>;
};

export function makeInitialWalletTxState(): WalletTxState {
  const blockMaxGas = 30_000_000;
  const blockTargetGas = blockMaxGas / 2;

  return {
    baseFeeGwei: 18,
    blockNumber: 0,
    blockMaxGas,
    blockTargetGas,
    lastBlockGasUsed: 0,
    blocks: [],
    reorgSnapshot: null,
    lastReorg: null,
    permitNonce: { Alice: 0, Bob: 0, Charlie: 0, Dave: 0 },
    accounts: {
      Alice: { eth: 1.2, dai: 1000, nonce: 0 },
      Bob: { eth: 0.4, dai: 50, nonce: 0 },
      Charlie: { eth: 0.8, dai: 200, nonce: 0 },
      Dave: { eth: 0.7, dai: 120, nonce: 0 },
      DEX: { eth: 0, dai: 10_000, nonce: 0 },
      Miner: { eth: 0, dai: 0, nonce: 0 }
    },
    dexAllowance: { Alice: 0, Bob: 0, Charlie: 0, Dave: 0 },
    mempool: [],
    history: {}
  };
}

export function requiredGas(type: TxType): number {
  switch (type) {
    case 'eth_transfer':
      return 21_000;
    case 'erc20_approve':
      return 45_000;
    case 'dex_swap':
      return 85_000;
    case 'dex_swap_permit':
      return 105_000;
  }
}

export function effectiveGasPriceGwei(baseFee: number, maxFee: number, maxPriority: number): number {
  // EIP-1559: effective = min(maxFee, baseFee + maxPriority)
  return Math.min(maxFee, baseFee + maxPriority);
}

export function tipGwei(baseFee: number, effective: number): number {
  return Math.max(0, effective - baseFee);
}

export function gweiGasToEth(gwei: number, gas: number): number {
  return (gwei * gas) / 1e9;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function makeTxHash(seed: string): string {
  return '0x' + djb2(seed).padStart(10, '0');
}

export function rememberTx(state: WalletTxState, tx: Tx): WalletTxState {
  return { ...state, history: { ...state.history, [tx.hash]: tx } };
}
