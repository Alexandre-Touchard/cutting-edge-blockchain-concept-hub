import React, { useState } from 'react';
import EduTooltip from '../../ui/EduTooltip';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
const T = EduTooltip;
import { Plus, Upload, CheckCircle, Clock, Layers, ArrowUp, Shield, Zap } from 'lucide-react';

const RollupSimulation = () => {
  const { tr } = useDemoI18n('rollup-simulation');
  const [l2Transactions, setL2Transactions] = useState([]);
  const [l1Batches, setL1Batches] = useState([]);
  const [nextTxId, setNextTxId] = useState(1);
  const [batchSize, setBatchSize] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  
  const [stats, setStats] = useState({
    totalL2Txs: 0,
    totalBatches: 0,
    avgTxsPerBatch: 0,
    gassSaved: 0,
    l2GasCost: 0.001, // ETH per L2 tx
    l1GasCost: 0.1,   // ETH per L1 tx
    batchPostCost: 0.5 // ETH per batch posted to L1
  });

  const transactionTypes = ['Transfer', 'Swap', 'NFT Mint', 'Stake', 'Unstake'];
  const users = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry'];

  // Add a new L2 transaction
  const addL2Transaction = () => {
    const newTx = {
      id: nextTxId,
      type: transactionTypes[Math.floor(Math.random() * transactionTypes.length)],
      from: users[Math.floor(Math.random() * users.length)],
      to: users[Math.floor(Math.random() * users.length)],
      amount: (Math.random() * 100).toFixed(2),
      timestamp: Date.now(),
      status: 'pending',
      l2Block: Math.floor(nextTxId / 3) + 1
    };

    setL2Transactions([...l2Transactions, newTx]);
    setNextTxId(nextTxId + 1);
    setStats(prev => ({
      ...prev,
      totalL2Txs: prev.totalL2Txs + 1
    }));
  };

  // Add multiple transactions
  const addMultipleTxs = (count) => {
    for (let i = 0; i < count; i++) {
      setTimeout(() => addL2Transaction(), i * 100);
    }
  };

  // Calculate merkle root (simplified - just hash of tx IDs)
  const calculateMerkleRoot = (txs) => {
    const ids = txs.map(tx => tx.id).join(',');
    // Simple hash simulation
    let hash = 0;
    for (let i = 0; i < ids.length; i++) {
      hash = ((hash << 5) - hash) + ids.charCodeAt(i);
      hash = hash & hash;
    }
    return '0x' + Math.abs(hash).toString(16).padStart(16, '0');
  };

  // Create a batch and submit to L1
  const submitBatch = async () => {
    if (l2Transactions.length === 0) return;
    
    setIsProcessing(true);
    
    // Take transactions to batch
    const txsToProcess = l2Transactions.slice(0, batchSize);
    const remainingTxs = l2Transactions.slice(batchSize);
    
    // Simulate batch processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create batch
    const batch = {
      id: l1Batches.length + 1,
      transactions: txsToProcess,
      merkleRoot: calculateMerkleRoot(txsToProcess),
      timestamp: Date.now(),
      l1BlockNumber: 18500000 + l1Batches.length,
      status: 'submitted',
      txCount: txsToProcess.length,
      stateRoot: '0x' + Math.random().toString(16).substr(2, 16)
    };
    
    // Mark transactions as batched
    const updatedTxs = txsToProcess.map(tx => ({
      ...tx,
      status: 'batched',
      batchId: batch.id
    }));
    
    setL2Transactions([...updatedTxs, ...remainingTxs]);
    setL1Batches([...l1Batches, batch]);
    
    // Simulate L1 confirmation
    setTimeout(() => {
      setL1Batches(prev => prev.map(b => 
        b.id === batch.id ? { ...b, status: 'confirmed' } : b
      ));
      
      setL2Transactions(prev => prev.map(tx =>
        tx.batchId === batch.id ? { ...tx, status: 'finalized' } : tx
      ));
    }, 2000);
    
    // Update stats
    const savedGas = (txsToProcess.length * stats.l1GasCost) - stats.batchPostCost;
    setStats(prev => ({
      ...prev,
      totalBatches: prev.totalBatches + 1,
      avgTxsPerBatch: ((prev.avgTxsPerBatch * prev.totalBatches) + txsToProcess.length) / (prev.totalBatches + 1),
      gassSaved: prev.gassSaved + savedGas
    }));
    
    setIsProcessing(false);
  };

  // Auto-submit batches
  const autoSubmitBatches = async () => {
    setIsProcessing(true);
    
    while (l2Transactions.filter(tx => tx.status === 'pending').length >= batchSize) {
      await submitBatch();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setIsProcessing(false);
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

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
  <T term="Layer 2 Rollup" text={define('Layer 2 Rollup')} />
  Simulation
</h1>
          <p className="text-slate-300">
            {tr('Watch how transactions are batched on L2 and submitted to L1 for security and cost savings')}
          </p>
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
  <T term="Gas Saved" text={define('Gas Saved')} />
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
                Layer 2 - Execution Layer
              </h2>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={addL2Transaction}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded font-semibold"
                >
                  <Plus size={18} />
                  Add Transaction
                </button>
                
                <button
                  onClick={() => addMultipleTxs(10)}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 rounded font-semibold"
                >
                  <Zap size={18} />
                  Add 10 TXs
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
                  className="w-full"
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
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold"
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
                  Auto-Submit All
                </button>
              </div>
            </div>

            {/* L2 Transaction Pool */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold mb-3">{tr('L2 Transaction Pool')}</h3>
              
              <div className="flex gap-2 mb-3 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                  <span>Pending ({pendingTxs.length})</span>
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
                            {tx.status.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          L2 Block #{tx.l2Block}
                        </span>
                      </div>
                      <div className="text-sm text-slate-300">
                        <div className="flex justify-between">
                          <span>{tx.type}</span>
                          <span className="text-emerald-400">{tx.amount} ETH</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {tx.from} → {tx.to}
                        </div>
                        {tx.batchId && (
                          <div className="text-xs text-blue-400 mt-1">
                            Batch #{tx.batchId}
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
                  [...l1Batches].reverse().map(batch => (
                    <div
                      key={batch.id}
                      onClick={() => setSelectedBatch(batch.id === selectedBatch ? null : batch.id)}
                      className={`bg-slate-700 rounded p-3 border-2 cursor-pointer transition-all ${
                        selectedBatch === batch.id ? 'border-blue-500' : 'border-slate-600'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-semibold">Batch #{batch.id}</span>
                          <span className={`ml-2 text-xs px-2 py-1 rounded ${getBatchStatusColor(batch.status)}`}>
                            {batch.status === 'submitted' ? (
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                PENDING
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <CheckCircle size={12} />
                                CONFIRMED
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span>Transactions:</span>
                          <span className="font-semibold">{batch.txCount}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>L1 Block:</span>
                          <span className="font-mono text-xs">{batch.l1BlockNumber}</span>
                        </div>
                      </div>

                      {selectedBatch === batch.id && (
                        <div className="mt-3 pt-3 border-t border-slate-600 space-y-2 text-xs">
                          <div>
                            <div className="text-slate-400 mb-1">
  <T term="Merkle Root" text={define('Merkle Root')} />
  :
</div>
                            <div className="font-mono text-blue-400 break-all">{batch.merkleRoot}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 mb-1">
  <T term="State Root" text={define('State Root')} />
  :
</div>
                            <div className="font-mono text-purple-400 break-all">{batch.stateRoot}</div>
                          </div>
                          <div className="text-slate-400">
                            Submitted: {new Date(batch.timestamp).toLocaleTimeString()}
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
                  <LinkWithCopy href="https://docs.optimism.io/" label={<>Optimism docs →</>} className="text-xs text-blue-300 hover:text-blue-200 underline" />
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-purple-300">Arbitrum</div>
                  <p className="text-xs text-slate-300 mb-2">{tr('High-throughput optimistic rollup with advanced fraud proof system, widely used for DeFi and gaming.')}</p>
                  <LinkWithCopy href="https://docs.arbitrum.io/" label={<>Arbitrum docs →</>} className="text-xs text-purple-300 hover:text-purple-200 underline" />
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-pink-300">zkSync / Starknet</div>
                  <p className="text-xs text-slate-300 mb-2">{tr('ZK rollups use validity proofs to prove correct execution, enabling fast finality with strong guarantees.')}</p>
                  <div className="flex gap-3">
                    <LinkWithCopy href="https://docs.zksync.io/" label={<>zkSync docs →</>} className="text-xs text-pink-300 hover:text-pink-200 underline" />
                    <LinkWithCopy href="https://docs.starknet.io/" label={<>Starknet docs →</>} className="text-xs text-pink-300 hover:text-pink-200 underline" />
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
                  <div className="font-semibold text-emerald-300 mb-1">🏢 Enterprise Settlement</div>
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
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://ethereum.org/en/developers/docs/scaling/layer-2-rollups/" target="_blank" rel="noopener noreferrer">Ethereum.org: Rollups overview →</a></li>
            <li><LinkWithCopy href="https://l2beat.com/" label={<>L2BEAT: Rollup risk & stats →</>} className="text-blue-300 hover:text-blue-200 underline" /></li>
            <li><LinkWithCopy href="https://docs.optimism.io/" label={<>Optimism docs →</>} className="text-blue-300 hover:text-blue-200 underline" /></li>
            <li><LinkWithCopy href="https://docs.arbitrum.io/" label={<>Arbitrum docs →</>} className="text-blue-300 hover:text-blue-200 underline" /></li>
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