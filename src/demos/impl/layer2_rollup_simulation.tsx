import React, { useEffect, useRef, useState } from 'react';
import EduTooltip from '../../ui/EduTooltip';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
import { NextQuestCard, QuestList, useDemoQuests } from '../quests/DemoQuests';
const T = EduTooltip;
import { Plus, Upload, CheckCircle, Clock, Layers, ArrowUp, Shield, Zap } from 'lucide-react';

type TxStatus = 'pending' | 'batched' | 'finalized';
type TxType = 'Transfer' | 'Swap' | 'NFT Mint' | 'Stake' | 'Unstake';

type L2Tx = {
  id: number;
  type: TxType;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  status: TxStatus;
  l2Block: number;
  batchId?: number;
};

type L1Batch = {
  id: number;
  transactions: L2Tx[];
  merkleRoot: string;
  timestamp: number;
  l1BlockNumber: number;
  status: 'submitted' | 'confirmed';
  txCount: number;
  stateRoot: string;
};

const transactionTypes: TxType[] = ['Transfer', 'Swap', 'NFT Mint', 'Stake', 'Unstake'];
const users = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry'];

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const RollupSimulation = () => {
  const { tr } = useDemoI18n('rollup-simulation');
  const [l2Transactions, setL2Transactions] = useState<L2Tx[]>([]);
  const [l1Batches, setL1Batches] = useState<L1Batch[]>([]);
  const [batchSize, setBatchSize] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);

  // Delayed callbacks (setTimeout, code after an await) must not read state from their
  // closure: it is a stale snapshot from the render that created them. The transaction list
  // therefore lives in a ref (source of truth, mirrored into state for rendering) and ids
  // come from counters in refs.
  const txsRef = useRef<L2Tx[]>([]);
  const nextTxIdRef = useRef(1);
  const nextBatchIdRef = useRef(1);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updateTxs = (fn: (prev: L2Tx[]) => L2Tx[]) => {
    txsRef.current = fn(txsRef.current);
    setL2Transactions(txsRef.current);
  };
  const pendingNow = () => txsRef.current.filter(tx => tx.status === 'pending');

  const [stats, setStats] = useState({
    totalL2Txs: 0,
    totalBatches: 0,
    avgTxsPerBatch: 0,
    gassSaved: 0,
    l2GasCost: 0.001, // ETH per L2 tx
    l1GasCost: 0.1,   // ETH per L1 tx
    batchPostCost: 0.5 // ETH per batch posted to L1
  });

  const txTypeLabel = (type: TxType) => {
    switch (type) {
      case 'Transfer': return tr('Transfer');
      case 'Swap': return tr('Swap');
      case 'NFT Mint': return tr('NFT Mint');
      case 'Stake': return tr('Stake');
      case 'Unstake': return tr('Unstake');
      default: return type;
    }
  };

  const txStatusLabel = (status: TxStatus) => {
    switch (status) {
      case 'pending': return tr('PENDING');
      case 'batched': return tr('BATCHED');
      case 'finalized': return tr('FINALIZED');
      default: return status;
    }
  };

  // Add a new L2 transaction
  const addL2Transaction = () => {
    if (!mountedRef.current) return;
    const id = nextTxIdRef.current++;
    const newTx: L2Tx = {
      id,
      type: transactionTypes[Math.floor(Math.random() * transactionTypes.length)],
      from: users[Math.floor(Math.random() * users.length)],
      to: users[Math.floor(Math.random() * users.length)],
      amount: (Math.random() * 100).toFixed(2),
      timestamp: Date.now(),
      status: 'pending',
      l2Block: Math.floor(id / 3) + 1
    };

    updateTxs(prev => [...prev, newTx]);
    setStats(prev => ({
      ...prev,
      totalL2Txs: prev.totalL2Txs + 1
    }));
  };

  // Add multiple transactions, staggered so they visibly stream in
  const addMultipleTxs = (count: number) => {
    for (let i = 0; i < count; i++) {
      setTimeout(addL2Transaction, i * 100);
    }
  };

  // Calculate merkle root (simplified - just hash of tx IDs)
  const calculateMerkleRoot = (txs: L2Tx[]) => {
    const ids = txs.map(tx => tx.id).join(',');
    // Simple hash simulation
    let hash = 0;
    for (let i = 0; i < ids.length; i++) {
      hash = ((hash << 5) - hash) + ids.charCodeAt(i);
      hash = hash & hash;
    }
    return '0x' + Math.abs(hash).toString(16).padStart(16, '0');
  };

  /** Post up to `size` pending transactions as one L1 batch. Returns how many were batched. */
  const postBatch = async (size: number) => {
    // Simulate batch processing
    await delay(1500);
    if (!mountedRef.current) return 0;

    // Read the CURRENT pool (not the one captured when the button was clicked),
    // and only pending transactions: already-batched ones must not be posted twice.
    const txsToProcess = pendingNow().slice(0, size);
    if (txsToProcess.length === 0) return 0;
    const ids = new Set(txsToProcess.map(tx => tx.id));

    const batchId = nextBatchIdRef.current++;
    const batch: L1Batch = {
      id: batchId,
      transactions: txsToProcess,
      merkleRoot: calculateMerkleRoot(txsToProcess),
      timestamp: Date.now(),
      l1BlockNumber: 18500000 + batchId - 1,
      status: 'submitted',
      txCount: txsToProcess.length,
      stateRoot: '0x' + Math.random().toString(16).substr(2, 16)
    };

    // Mark transactions as batched
    updateTxs(prev => prev.map(tx => (ids.has(tx.id) ? { ...tx, status: 'batched', batchId } : tx)));
    setL1Batches(prev => [...prev, batch]);

    // Simulate L1 confirmation
    setTimeout(() => {
      if (!mountedRef.current) return;
      setL1Batches(prev => prev.map(b =>
        b.id === batchId ? { ...b, status: 'confirmed' } : b
      ));
      updateTxs(prev => prev.map(tx =>
        tx.batchId === batchId ? { ...tx, status: 'finalized' } : tx
      ));
    }, 2000);

    // Update stats
    setStats(prev => ({
      ...prev,
      totalBatches: prev.totalBatches + 1,
      avgTxsPerBatch: ((prev.avgTxsPerBatch * prev.totalBatches) + txsToProcess.length) / (prev.totalBatches + 1),
      gassSaved: prev.gassSaved + (txsToProcess.length * prev.l1GasCost) - prev.batchPostCost
    }));

    return txsToProcess.length;
  };

  // Create one batch and submit it to L1
  const submitBatch = async () => {
    if (isProcessing || pendingNow().length === 0) return;
    setIsProcessing(true);
    await postBatch(batchSize);
    if (mountedRef.current) setIsProcessing(false);
  };

  // Auto-submit full batches until fewer than `batchSize` transactions are pending
  const autoSubmitBatches = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    while (mountedRef.current && pendingNow().length >= batchSize) {
      const posted = await postBatch(batchSize);
      if (posted === 0) break;
      if (pendingNow().length >= batchSize) await delay(1000);
    }

    if (mountedRef.current) setIsProcessing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-600';
      case 'batched': return 'bg-blue-600';
      case 'finalized': return 'bg-emerald-600';
      default: return 'bg-slate-600';
    }
  };

  const getBatchStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'bg-blue-600';
      case 'confirmed': return 'bg-emerald-600';
      default: return 'bg-slate-600';
    }
  };

  const pendingTxs = l2Transactions.filter(tx => tx.status === 'pending');
  const batchedTxs = l2Transactions.filter(tx => tx.status === 'batched');
  const finalizedTxs = l2Transactions.filter(tx => tx.status === 'finalized');

  const q = useDemoQuests('rollup-simulation', [
    {
      id: 'queue-txs',
      text: tr('Queue 5 transactions on L2'),
      tip: tr('Click Add Transaction (or Add 10 TXs) until 5 transactions show in the L2 Transaction Pool.'),
      done: l2Transactions.length >= 5,
      target: 'add-tx'
    },
    {
      id: 'post-batch',
      text: tr('Post your first batch to L1'),
      tip: tr('Click Submit Batch to L1: pending transactions become one batch on Layer 1.'),
      done: l1Batches.length > 0,
      target: 'submit-batch'
    },
    {
      id: 'inspect-batch',
      text: tr('Open a batch to see its Merkle root'),
      tip: tr('Click a batch card under Layer 1 - Settlement Layer to show its Merkle root and state root.'),
      done: selectedBatch !== null,
      target: 'batch-card'
    },
    {
      id: 'small-batch',
      text: tr('Post a batch of fewer than 5 transactions'),
      tip: tr('Set Batch Size to 3 and click Submit Batch to L1 (add transactions first if none are pending): posting costs 0.5 ETH, more than 3 transactions save, so Gas Saved drops.'),
      done: l1Batches.some((b) => b.txCount < 5),
      target: 'batch-size'
    },
    {
      id: 'big-batch',
      text: tr('Post a batch of 10 or more transactions'),
      tip: tr('Set Batch Size to 10 or more, click Add 10 TXs so at least 10 transactions are pending, then click Submit Batch to L1.'),
      done: l1Batches.some((b) => b.txCount >= 10),
      target: 'batch-size'
    }
  ]);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
  <T term={tr('Layer 2 Rollup')} text={define('Layer 2 Rollup')} />
  {' '}{tr('Simulation')}
</h1>
          <p className="text-slate-300">
            {tr('Watch how transactions are batched on L2 and submitted to L1 for security and cost savings')}
          </p>
          <NextQuestCard q={q} className="mt-4" />
          <QuestList q={q} />
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Layers size={20} className="text-blue-400" />
              <span className="text-sm text-slate-400">{tr('L2 Transactions')}</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalL2Txs}</div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Upload size={20} className="text-emerald-400" />
              <span className="text-sm text-slate-400">{tr('Batches Posted')}</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalBatches}</div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={20} className="text-yellow-400" />
              <span className="text-sm text-slate-400">{tr('Avg TXs/Batch')}</span>
            </div>
            <div className="text-2xl font-bold">{stats.avgTxsPerBatch.toFixed(1)}</div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUp size={20} className="text-purple-400" />
              <span className="text-sm text-slate-400">
  <T term={tr('Gas Saved')} text={define('Gas Saved')} />
</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">{stats.gassSaved.toFixed(3)} ETH</div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={20} className="text-red-400" />
              <span className="text-sm text-slate-400">{tr('Pending TXs')}</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">{pendingTxs.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Layer 2 */}
          <div className="lg:col-span-2 space-y-6">
            {/* L2 Controls */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Layers className="text-blue-400" />
                {tr('Layer 2 - Execution Layer')}
              </h2>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={addL2Transaction}
                  disabled={isProcessing}
                  data-hint="add-tx"
                  className={`flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded font-semibold ${q.pulse('add-tx')}`}
                >
                  <Plus size={18} />
                  {tr('Add Transaction')}
                </button>
                
                <button
                  onClick={() => addMultipleTxs(10)}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 rounded font-semibold"
                >
                  <Zap size={18} />
                  {tr('Add 10 TXs')}
                </button>
              </div>

              <div className="mb-4">
                <label className="text-sm text-slate-400 mb-2 block">
                  {tr('Batch Size')}: {batchSize} {tr('transactions')}
                </label>
                <input
                  type="range"
                  min="3"
                  max="20"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value))}
                  data-hint="batch-size"
                  className={`w-full ${q.pulse('batch-size')}`}
                  disabled={isProcessing}
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>3</span>
                  <span>20</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={submitBatch}
                  disabled={isProcessing || pendingTxs.length === 0}
                  data-hint="submit-batch"
                  className={`flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold ${q.pulse('submit-batch')}`}
                >
                  <Upload size={18} />
                  {isProcessing ? tr('Processing...') : tr('Submit Batch to L1')}
                </button>
                
                <button
                  onClick={autoSubmitBatches}
                  disabled={isProcessing || pendingTxs.length < batchSize}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold"
                >
                  <Zap size={18} />
                  {tr('Auto-Submit All')}
                </button>
              </div>
            </div>

            {/* L2 Transaction Pool */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold mb-3">{tr('L2 Transaction Pool')}</h3>
              
              <div className="flex gap-2 mb-3 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                  <span>{tr('Pending')} ({pendingTxs.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  <span>{tr('Batched')} ({batchedTxs.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                  <span>{tr('Finalized')} ({finalizedTxs.length})</span>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {l2Transactions.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    {tr('No transactions yet. Add some to get started!')}
                  </div>
                ) : (
                  [...l2Transactions].reverse().map(tx => (
                    <div
                      key={tx.id}
                      className="bg-slate-700 rounded p-3 border-l-4"
                      style={{ borderColor: tx.status === 'pending' ? '#ca8a04' : tx.status === 'batched' ? '#2563eb' : '#059669' }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-semibold">TX #{tx.id}</span>
                          <span className={`ml-2 text-xs px-2 py-1 rounded ${getStatusColor(tx.status)}`}>
                            {txStatusLabel(tx.status)}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {tr('L2 Block #{{number}}', { number: tx.l2Block })}
                        </span>
                      </div>
                      <div className="text-sm text-slate-300">
                        <div className="flex justify-between">
                          <span>{txTypeLabel(tx.type)}</span>
                          <span className="text-emerald-400">{tx.amount} ETH</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {tx.from} → {tx.to}
                        </div>
                        {tx.batchId && (
                          <div className="text-xs text-blue-400 mt-1">
                            {tr('Batch #{{id}}', { id: tx.batchId })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Layer 1 */}
          <div className="space-y-6">
            {/* L1 Batches */}
            <div className="bg-slate-800 rounded-lg p-4 border-2 border-emerald-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="text-emerald-400" />
                {tr('Layer 1 - Settlement Layer')}
              </h2>
              
              <div className="text-sm text-slate-300 mb-4 p-3 bg-slate-700 rounded">
                <p className="mb-2">{tr('L1 provides security and data availability for L2 batches.')}</p>
                <p className="text-xs text-slate-400">
                  {tr('Each batch contains a merkle root of L2 transactions and state updates.')}
                </p>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {l1Batches.length === 0 ? (
                  <div className="text-center text-slate-400 py-8 text-sm">
                    {tr('No batches submitted yet')}
                  </div>
                ) : (
                  [...l1Batches].reverse().map((batch, idx) => (
                    <div
                      key={batch.id}
                      onClick={() => setSelectedBatch(batch.id === selectedBatch ? null : batch.id)}
                      data-hint={idx === 0 ? 'batch-card' : undefined}
                      className={`bg-slate-700 rounded p-3 border-2 cursor-pointer transition-all ${
                        selectedBatch === batch.id ? 'border-blue-500' : 'border-slate-600'
                      } ${idx === 0 ? q.pulse('batch-card') : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-semibold">{tr('Batch #{{id}}', { id: batch.id })}</span>
                          <span className={`ml-2 text-xs px-2 py-1 rounded ${getBatchStatusColor(batch.status)}`}>
                            {batch.status === 'submitted' ? (
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {tr('PENDING')}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <CheckCircle size={12} />
                                {tr('CONFIRMED')}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span>{tr('Transactions')}:</span>
                          <span className="font-semibold">{batch.txCount}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>{tr('L1 Block')}:</span>
                          <span className="font-mono text-xs">{batch.l1BlockNumber}</span>
                        </div>
                      </div>

                      {selectedBatch === batch.id && (
                        <div className="mt-3 pt-3 border-t border-slate-600 space-y-2 text-xs">
                          <div>
                            <div className="text-slate-400 mb-1">
  <T term={tr('Merkle Root')} text={define('Merkle Root')} />
  :
</div>
                            <div className="font-mono text-blue-400 break-all">{batch.merkleRoot}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 mb-1">
  <T term={tr('State Root')} text={define('State Root')} />
  :
</div>
                            <div className="font-mono text-purple-400 break-all">{batch.stateRoot}</div>
                          </div>
                          <div className="text-slate-400">
                            {tr('Submitted: {{time}}', { time: new Date(batch.timestamp).toLocaleTimeString() })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Real-World Applications */}
        <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">🌐 {tr('Real-World Applications')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-emerald-400">{tr('Popular Rollups')}</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-blue-300">Optimism / Base</div>
                  <p className="text-xs text-slate-300 mb-2">{tr('Optimistic rollups used for general-purpose apps (DeFi, NFTs). Post transaction data to L1 and use fraud proofs for security.')}</p>
                  <LinkWithCopy href="https://docs.optimism.io/" label={<>{tr('{{name}} docs →', { name: 'Optimism' })}</>} className="text-xs text-blue-300 hover:text-blue-200 underline" />
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-purple-300">Arbitrum</div>
                  <p className="text-xs text-slate-300 mb-2">{tr('High-throughput optimistic rollup with advanced fraud proof system, widely used for DeFi and gaming.')}</p>
                  <LinkWithCopy href="https://docs.arbitrum.io/" label={<>{tr('{{name}} docs →', { name: 'Arbitrum' })}</>} className="text-xs text-purple-300 hover:text-purple-200 underline" />
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-pink-300">zkSync / Starknet</div>
                  <p className="text-xs text-slate-300 mb-2">{tr('ZK rollups use validity proofs to prove correct execution, enabling fast finality with strong guarantees.')}</p>
                  <div className="flex gap-3">
                    <LinkWithCopy href="https://docs.zksync.io/" label={<>{tr('{{name}} docs →', { name: 'zkSync' })}</>} className="text-xs text-pink-300 hover:text-pink-200 underline" />
                    <LinkWithCopy href="https://docs.starknet.io/" label={<>{tr('{{name}} docs →', { name: 'Starknet' })}</>} className="text-xs text-pink-300 hover:text-pink-200 underline" />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-yellow-400">{tr('Production Use Cases')}</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-blue-300 mb-1">🧾 {tr('Cheaper DeFi Trading')}</div>
                  <p className="text-xs text-slate-300">{tr('AMMs, perps, and lending become usable for smaller trades thanks to lower fees and faster confirmations.')}</p>
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-purple-300 mb-1">🎮 {tr('Games & Social')}</div>
                  <p className="text-xs text-slate-300">{tr('High-frequency interactions (mints, micro-transfers) become practical without L1 gas spikes.')}</p>
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-emerald-300 mb-1">🏢 {tr('Enterprise Settlement')}</div>
                  <p className="text-xs text-slate-300">{tr('Batch many transactions and settle periodically to L1 for auditability and security.')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Further Reading */}
        <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">📚 {tr('Further Reading')}</h2>
          <ul className="space-y-2 text-sm">
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://ethereum.org/en/developers/docs/scaling/layer-2-rollups/" target="_blank" rel="noopener noreferrer">{tr('Ethereum.org: Rollups overview →')}</a></li>
            <li><LinkWithCopy href="https://l2beat.com/" label={<>{tr('L2BEAT: Rollup risk & stats →')}</>} className="text-blue-300 hover:text-blue-200 underline" /></li>
            <li><LinkWithCopy href="https://docs.optimism.io/" label={<>{tr('{{name}} docs →', { name: 'Optimism' })}</>} className="text-blue-300 hover:text-blue-200 underline" /></li>
            <li><LinkWithCopy href="https://docs.arbitrum.io/" label={<>{tr('{{name}} docs →', { name: 'Arbitrum' })}</>} className="text-blue-300 hover:text-blue-200 underline" /></li>
          </ul>
        </div>

        {/* Bottom Explanation */}
        <div className="mt-6 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-blue-300">{tr('How Rollups Work')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-300">
            <div>
              <div className="font-semibold text-blue-400 mb-1">1. {tr('Execute on L2')}</div>
              <p>{tr('Transactions execute quickly and cheaply on Layer 2. Users get instant feedback with minimal gas costs (~{{cost}} ETH per TX).', { cost: stats.l2GasCost })}</p>
            </div>
            <div>
              <div className="font-semibold text-blue-400 mb-1">2. {tr('Batch Transactions')}</div>
              <p>{tr('Multiple L2 transactions are bundled into a single batch. A merkle root proves all transactions are included.')}</p>
            </div>
            <div>
              <div className="font-semibold text-blue-400 mb-1">3. {tr('Submit to L1')}</div>
              <p>{tr('Batches are posted to Ethereum L1 for security and data availability. One L1 TX secures {{batchSize}} L2 transactions, saving ~{{saved}} ETH per TX.', { batchSize, saved: ((batchSize * stats.l1GasCost - stats.batchPostCost) / batchSize).toFixed(3) })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RollupSimulation;