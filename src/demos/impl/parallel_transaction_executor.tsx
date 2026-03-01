import React, { useState } from 'react';
import EduTooltip from '../../ui/EduTooltip';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
const T = EduTooltip;
import { Play, Plus, Trash2, RefreshCw, Zap, AlertTriangle } from 'lucide-react';

const ParallelExecutor = () => {
  const { tr } = useDemoI18n('parallel-executor');
  const [accounts, setAccounts] = useState({
    'Alice': 100,
    'Bob': 100,
    'Charlie': 100,
    'Dave': 100
  });
  
  const [transactions, setTransactions] = useState([
    { id: 1, from: 'Alice', to: 'Bob', amount: 10 },
    { id: 2, from: 'Charlie', to: 'Dave', amount: 15 },
    { id: 3, from: 'Bob', to: 'Charlie', amount: 5 },
    { id: 4, from: 'Alice', to: 'Charlie', amount: 20 }
  ]);
  
  const [executionLog, setExecutionLog] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [nextId, setNextId] = useState(5);
  const [executionMode, setExecutionMode] = useState('conservative'); // 'conservative' or 'optimistic'
  const [stats, setStats] = useState({ reExecutions: 0, totalTime: 0 });
  const [benchmarkResults, setBenchmarkResults] = useState(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Conservative: Analyze which transactions can run in parallel
  const analyzeConflicts = (txs) => {
    const groups = [];
    const processed = new Set();
    
    for (let i = 0; i < txs.length; i++) {
      if (processed.has(i)) continue;
      
      const group = [i];
      const touchedAccounts = new Set([txs[i].from, txs[i].to]);
      processed.add(i);
      
      for (let j = i + 1; j < txs.length; j++) {
        if (processed.has(j)) continue;
        
        const tx = txs[j];
        if (!touchedAccounts.has(tx.from) && !touchedAccounts.has(tx.to)) {
          group.push(j);
          touchedAccounts.add(tx.from);
          touchedAccounts.add(tx.to);
          processed.add(j);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  };

  // Optimistic: Execute all in parallel, detect conflicts, re-execute
  const executeOptimistic = async () => {
    setIsExecuting(true);
    setExecutionLog([]);
    let log = [];
    let reExecutionCount = 0;
    const startTime = Date.now();
    
    log.push({
      type: 'phase',
      phase: 'optimistic',
      message: '🚀 Phase 1: Optimistic Parallel Execution'
    });
    setExecutionLog([...log]);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 1: Optimistically execute ALL transactions in parallel
    const initialState = { ...accounts };
    const txResults = [];
    
    for (const tx of transactions) {
      const readState = { ...initialState };
      const fromBalance = readState[tx.from];
      const toBalance = readState[tx.to];
      
      // Simulate execution
      if (fromBalance >= tx.amount) {
        txResults.push({
          tx,
          success: true,
          readFrom: fromBalance,
          readTo: toBalance,
          newFrom: fromBalance - tx.amount,
          newTo: toBalance + tx.amount,
          readSet: [tx.from, tx.to],
          writeSet: [tx.from, tx.to]
        });
      } else {
        txResults.push({
          tx,
          success: false,
          reason: 'Insufficient balance'
        });
      }
    }

    log.push({
      type: 'optimistic_batch',
      count: transactions.length
    });
    setExecutionLog([...log]);
    await new Promise(resolve => setTimeout(resolve, 800));

    // Step 2: Validate - detect conflicts
    log.push({
      type: 'phase',
      phase: 'validation',
      message: '🔍 Phase 2: Conflict Detection'
    });
    setExecutionLog([...log]);
    await new Promise(resolve => setTimeout(resolve, 500));

    const conflicts = [];
    const actualState = { ...initialState };
    
    for (let i = 0; i < txResults.length; i++) {
      const result = txResults[i];
      if (!result.success) continue;
      
      // Check if read values are still valid
      const currentFrom = actualState[result.tx.from];
      const currentTo = actualState[result.tx.to];
      
      if (currentFrom !== result.readFrom || currentTo !== result.readTo) {
        conflicts.push(i);
        log.push({
          type: 'conflict',
          tx: result.tx,
          expected: { from: result.readFrom, to: result.readTo },
          actual: { from: currentFrom, to: currentTo }
        });
      } else {
        // No conflict, commit the changes
        actualState[result.tx.from] = result.newFrom;
        actualState[result.tx.to] = result.newTo;
        log.push({
          type: 'validated',
          tx: result.tx,
          fromBalance: result.newFrom,
          toBalance: result.newTo
        });
      }
    }
    
    setExecutionLog([...log]);
    await new Promise(resolve => setTimeout(resolve, 800));

    // Step 3: Re-execute conflicting transactions
    if (conflicts.length > 0) {
      log.push({
        type: 'phase',
        phase: 'reexecution',
        message: `⚠️ Phase 3: Re-executing ${conflicts.length} Conflicted Transaction(s)`
      });
      setExecutionLog([...log]);
      await new Promise(resolve => setTimeout(resolve, 500));

      for (const idx of conflicts) {
        const result = txResults[idx];
        const tx = result.tx;
        reExecutionCount++;
        
        // Re-execute with current state
        if (actualState[tx.from] >= tx.amount) {
          actualState[tx.from] -= tx.amount;
          actualState[tx.to] += tx.amount;
          
          log.push({
            type: 'reexecuted',
            tx: tx,
            fromBalance: actualState[tx.from],
            toBalance: actualState[tx.to]
          });
        } else {
          log.push({
            type: 'error',
            tx: tx,
            reason: 'Insufficient balance after re-execution'
          });
        }
        
        setExecutionLog([...log]);
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }

    const endTime = Date.now();
    log.push({
      type: 'complete',
      reExecutions: reExecutionCount,
      time: endTime - startTime
    });
    
    setAccounts(actualState);
    setExecutionLog([...log]);
    setStats({ reExecutions: reExecutionCount, totalTime: endTime - startTime });
    setIsExecuting(false);
  };

  // Conservative: Pre-analyze and execute in groups
  const executeConservative = async () => {
    setIsExecuting(true);
    setExecutionLog([]);
    const startTime = Date.now();
    
    const groups = analyzeConflicts(transactions);
    let log = [];
    let currentAccounts = { ...accounts };
    
    log.push({
      type: 'phase',
      phase: 'analysis',
      message: `📊 Phase 1: Analyzed ${groups.length} Parallel Group(s)`
    });
    setExecutionLog([...log]);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
      const group = groups[groupIdx];
      const groupTxs = group.map(idx => transactions[idx]);
      
      log.push({
        type: 'group',
        group: groupIdx + 1,
        count: group.length,
        parallel: group.length > 1
      });
      setExecutionLog([...log]);
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      for (const tx of groupTxs) {
        if (currentAccounts[tx.from] >= tx.amount) {
          currentAccounts[tx.from] -= tx.amount;
          currentAccounts[tx.to] += tx.amount;
          
          log.push({
            type: 'success',
            tx: tx,
            fromBalance: currentAccounts[tx.from],
            toBalance: currentAccounts[tx.to]
          });
        } else {
          log.push({
            type: 'error',
            tx: tx,
            reason: 'Insufficient balance'
          });
        }
      }
      
      setExecutionLog([...log]);
      setAccounts({ ...currentAccounts });
    }
    
    const endTime = Date.now();
    log.push({
      type: 'complete',
      reExecutions: 0,
      time: endTime - startTime
    });
    setExecutionLog([...log]);
    setStats({ reExecutions: 0, totalTime: endTime - startTime });
    setIsExecuting(false);
  };

  const executeTransactions = () => {
    if (executionMode === 'optimistic') {
      executeOptimistic();
    } else {
      executeConservative();
    }
  };

  const addTransaction = () => {
    const accountNames = Object.keys(accounts);
    const from = accountNames[Math.floor(Math.random() * accountNames.length)];
    let to = accountNames[Math.floor(Math.random() * accountNames.length)];
    while (to === from) {
      to = accountNames[Math.floor(Math.random() * accountNames.length)];
    }
    
    setTransactions([...transactions, {
      id: nextId,
      from,
      to,
      amount: Math.floor(Math.random() * 20) + 5
    }]);
    setNextId(nextId + 1);
  };

  const removeTransaction = (id) => {
    setTransactions(transactions.filter(tx => tx.id !== id));
  };

  const reset = () => {
    setAccounts({
      'Alice': 100,
      'Bob': 100,
      'Charlie': 100,
      'Dave': 100
    });
    setExecutionLog([]);
    setStats({ reExecutions: 0, totalTime: 0 });
    setBenchmarkResults(null);
  };

  const updateTransaction = (id, field, value) => {
    setTransactions(transactions.map(tx => 
      tx.id === id ? { ...tx, [field]: value } : tx
    ));
  };

  const conflictGroups = analyzeConflicts(transactions);

  // Analyze conflict rate and recommend strategy
  const analyzeConflictRate = () => {
    if (transactions.length === 0) return null;
    
    // Build dependency graph
    const accountAccess = new Map();
    transactions.forEach((tx, idx) => {
      [tx.from, tx.to].forEach(account => {
        if (!accountAccess.has(account)) {
          accountAccess.set(account, []);
        }
        accountAccess.get(account).push(idx);
      });
    });
    
    // Count potential conflicts (transactions touching same accounts)
    let conflictPairs = 0;
    let totalPairs = 0;
    
    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        totalPairs++;
        const tx1 = transactions[i];
        const tx2 = transactions[j];
        
        // Check if they share any account
        if (tx1.from === tx2.from || tx1.from === tx2.to || 
            tx1.to === tx2.from || tx1.to === tx2.to) {
          conflictPairs++;
        }
      }
    }
    
    const conflictRate = totalPairs > 0 ? (conflictPairs / totalPairs) * 100 : 0;
    const parallelEfficiency = conflictGroups.length > 0 ? 
      (transactions.length / conflictGroups.length) : 1;
    
    // Recommendation logic
    let recommendation = '';
    let reasoning = '';
    
    if (conflictRate < 20) {
      recommendation = 'optimistic';
      reasoning = 'Low conflict rate - optimistic execution will have minimal re-executions and maximize parallelism.';
    } else if (conflictRate > 50) {
      recommendation = 'conservative';
      reasoning = 'High conflict rate - conservative pre-analysis avoids wasteful re-executions.';
    } else {
      recommendation = parallelEfficiency > 2 ? 'optimistic' : 'conservative';
      reasoning = 'Moderate conflict rate - recommendation based on parallel efficiency. ';
      reasoning += parallelEfficiency > 2 
        ? 'Good parallelism potential favors optimistic.'
        : 'Limited parallelism suggests conservative approach.';
    }
    
    return {
      conflictRate: conflictRate.toFixed(1),
      parallelEfficiency: parallelEfficiency.toFixed(1),
      recommendation,
      reasoning,
      totalPairs,
      conflictPairs
    };
  };

  const analysis = analyzeConflictRate();

  // Benchmark both strategies
  const runBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkResults(null);
    
    const initialAccounts = { ...accounts };
    const results = {
      conservative: { time: 0, reExecutions: 0, success: true },
      optimistic: { time: 0, reExecutions: 0, success: true }
    };

    // Run Conservative
    const conservativeStart = performance.now();
    const groups = analyzeConflicts(transactions);
    let conservativeAccounts = { ...initialAccounts };
    
    for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
      const group = groups[groupIdx];
      const groupTxs = group.map(idx => transactions[idx]);
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate execution time
      
      for (const tx of groupTxs) {
        if (conservativeAccounts[tx.from] >= tx.amount) {
          conservativeAccounts[tx.from] -= tx.amount;
          conservativeAccounts[tx.to] += tx.amount;
        }
      }
    }
    
    const conservativeEnd = performance.now();
    results.conservative.time = Math.round(conservativeEnd - conservativeStart);

    // Small delay between runs
    await new Promise(resolve => setTimeout(resolve, 300));

    // Run Optimistic
    const optimisticStart = performance.now();
    const txResults = [];
    
    // Phase 1: Optimistic execution
    for (const tx of transactions) {
      const readState = { ...initialAccounts };
      const fromBalance = readState[tx.from];
      const toBalance = readState[tx.to];
      
      if (fromBalance >= tx.amount) {
        txResults.push({
          tx,
          success: true,
          readFrom: fromBalance,
          readTo: toBalance,
          newFrom: fromBalance - tx.amount,
          newTo: toBalance + tx.amount
        });
      } else {
        txResults.push({ tx, success: false });
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate parallel execution
    
    // Phase 2: Validation
    const conflicts = [];
    const actualState = { ...initialAccounts };
    
    for (let i = 0; i < txResults.length; i++) {
      const result = txResults[i];
      if (!result.success) continue;
      
      const currentFrom = actualState[result.tx.from];
      const currentTo = actualState[result.tx.to];
      
      if (currentFrom !== result.readFrom || currentTo !== result.readTo) {
        conflicts.push(i);
      } else {
        actualState[result.tx.from] = result.newFrom;
        actualState[result.tx.to] = result.newTo;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate validation time
    
    // Phase 3: Re-execute conflicts
    if (conflicts.length > 0) {
      for (const idx of conflicts) {
        const result = txResults[idx];
        const tx = result.tx;
        
        if (actualState[tx.from] >= tx.amount) {
          actualState[tx.from] -= tx.amount;
          actualState[tx.to] += tx.amount;
        }
        
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate re-execution
      }
    }
    
    const optimisticEnd = performance.now();
    results.optimistic.time = Math.round(optimisticEnd - optimisticStart);
    results.optimistic.reExecutions = conflicts.length;

    // Determine winner
    const winner = results.conservative.time < results.optimistic.time ? 'conservative' : 'optimistic';
    const timeDiff = Math.abs(results.conservative.time - results.optimistic.time);
    const percentDiff = ((timeDiff / Math.max(results.conservative.time, results.optimistic.time)) * 100).toFixed(1);

    setBenchmarkResults({
      ...results,
      winner,
      timeDiff,
      percentDiff
    });
    
    setIsBenchmarking(false);
    
    // Reset accounts to initial state
    setAccounts(initialAccounts);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
  <T term="Parallel Execution" text={define('Parallel Execution')} />
  Executor
</h1>
        <p className="text-slate-300">
          {tr('Compare Conservative (Solana-style) vs Optimistic (Aptos Block-STM) parallel execution strategies')}
        </p>
      </div>

      {/* Execution Mode Selector */}
      <div className="mb-6 bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold mb-3">{tr('Execution Strategy')}</h2>
        
        {/* Conflict Rate Analyzer */}
        {analysis && transactions.length > 0 && (
          <div className="mb-4 p-4 bg-slate-900 rounded-lg border-2 border-blue-600">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-blue-300 mb-1">{tr('Conflict Rate Analysis')}</h3>
                <p className="text-sm text-slate-400">{tr('Based on current transaction queue')}</p>
              </div>
              <div className={`px-3 py-1 rounded text-sm font-semibold ${
                analysis.recommendation === 'optimistic' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-emerald-600 text-white'
              }`}>
                {tr('Recommended')}: {analysis.recommendation === 'optimistic' ? tr('Optimistic') : tr('Conservative')}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="bg-slate-800 rounded p-3">
                <div className="text-xs text-slate-400 mb-1">
  <T term="Conflict Rate" text={define('Conflict Rate')} />
</div>
                <div className={`text-2xl font-bold ${
                  parseFloat(analysis.conflictRate) < 20 ? 'text-emerald-400' :
                  parseFloat(analysis.conflictRate) > 50 ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {analysis.conflictRate}%
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {analysis.conflictPairs} of {analysis.totalPairs} pairs
                </div>
              </div>
              
              <div className="bg-slate-800 rounded p-3">
                <div className="text-xs text-slate-400 mb-1">{tr('Parallel Groups')}</div>
                <div className="text-2xl font-bold text-blue-400">
                  {conflictGroups.length}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {transactions.length} transactions
                </div>
              </div>
              
              <div className="bg-slate-800 rounded p-3">
                <div className="text-xs text-slate-400 mb-1">{tr('Parallel Efficiency')}</div>
                <div className={`text-2xl font-bold ${
                  parseFloat(analysis.parallelEfficiency) > 2 ? 'text-emerald-400' : 'text-yellow-400'
                }`}>
                  {analysis.parallelEfficiency}x
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  speedup potential
                </div>
              </div>
            </div>
            
            <div className="bg-blue-900 bg-opacity-20 rounded p-3 border border-blue-700">
              <div className="text-sm text-blue-200">
                <span className="font-semibold">{tr('Why')} {analysis.recommendation}?</span> {analysis.reasoning}
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setExecutionMode('conservative')}
            disabled={isExecuting}
            className={`p-4 rounded-lg border-2 transition-all ${
              executionMode === 'conservative'
                ? 'border-emerald-500 bg-emerald-900 bg-opacity-30'
                : 'border-slate-600 bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={20} className="text-emerald-400" />
              <span className="font-semibold">{tr('Conservative (Solana-style)')}</span>
            </div>
            <p className="text-sm text-slate-300">
              Pre-analyze dependencies, schedule non-conflicting transactions in parallel groups. 
              {tr('No wasted work, but requires upfront analysis.')}
            </p>
          </button>
          
          <button
            onClick={() => setExecutionMode('optimistic')}
            disabled={isExecuting}
            className={`p-4 rounded-lg border-2 transition-all ${
              executionMode === 'optimistic'
                ? 'border-purple-500 bg-purple-900 bg-opacity-30'
                : 'border-slate-600 bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap size={20} className="text-purple-400" />
              <span className="font-semibold">{tr('Optimistic (Aptos Block-STM)')}</span>
            </div>
            <p className="text-sm text-slate-300">
              {tr("Execute everything in parallel speculatively, detect conflicts, re-execute only what's needed.")}
              {tr('Max parallelism upfront, some wasted work on conflicts.')}
            </p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel */}
        <div className="space-y-6">
          {/* Account Balances */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">{tr('Account Balances')}</h2>
              <button
                onClick={reset}
                className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
              >
                <RefreshCw size={14} />
                {tr('Reset')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(accounts).map(([name, balance]) => (
                <div key={name} className="bg-slate-700 rounded p-3">
                  <div className="text-sm text-slate-400">{name}</div>
                  <div className="text-2xl font-bold text-emerald-400">{balance}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction Queue */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">{tr('Transaction Queue')}</h2>
              <button
                onClick={addTransaction}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                <Plus size={14} />
                Add Random
              </button>
            </div>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {transactions.map((tx, idx) => {
                const groupIdx = conflictGroups.findIndex(g => g.includes(idx));
                const groupColors = ['bg-purple-900', 'bg-blue-900', 'bg-green-900', 'bg-yellow-900', 'bg-red-900'];
                
                return (
                  <div
                    key={tx.id}
                    className={`${groupColors[groupIdx % groupColors.length]} bg-opacity-30 rounded p-3 border border-slate-600`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-slate-400">
                        TX #{tx.id}
                        {executionMode === 'conservative' && ` • Group ${groupIdx + 1}`}
                      </span>
                      <button
                        onClick={() => removeTransaction(tx.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <select
                        value={tx.from}
                        onChange={(e) => updateTransaction(tx.id, 'from', e.target.value)}
                        className="bg-slate-700 rounded px-2 py-1 text-xs"
                        disabled={isExecuting}
                      >
                        {Object.keys(accounts).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <span>→</span>
                      <select
                        value={tx.to}
                        onChange={(e) => updateTransaction(tx.id, 'to', e.target.value)}
                        className="bg-slate-700 rounded px-2 py-1 text-xs"
                        disabled={isExecuting}
                      >
                        {Object.keys(accounts).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={tx.amount}
                        onChange={(e) => updateTransaction(tx.id, 'amount', parseInt(e.target.value) || 0)}
                        className="bg-slate-700 rounded px-2 py-1 w-16 text-xs"
                        disabled={isExecuting}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={executeTransactions}
              disabled={isExecuting || transactions.length === 0 || isBenchmarking}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold"
            >
              <Play size={18} />
              {isExecuting
                ? tr('Executing...')
                : `${tr('Execute')} (${executionMode === 'optimistic' ? tr('Optimistic') : tr('Conservative')})`}
            </button>
            
            <button
              onClick={runBenchmark}
              disabled={isExecuting || transactions.length === 0 || isBenchmarking}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold text-sm"
            >
              <Zap size={16} />
              {isBenchmarking ? 'Running Benchmark...' : 'Benchmark Both Strategies'}
            </button>
          </div>

          {/* Analysis Panel */}
          {executionMode === 'conservative' && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-3">{tr('Conservative Analysis')}</h2>
              <div className="space-y-3">
                {conflictGroups.map((group, idx) => (
                  <div key={idx} className="bg-slate-700 rounded p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">Group {idx + 1}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        group.length > 1 ? 'bg-emerald-600' : 'bg-slate-600'
                      }`}>
                        {group.length > 1 ? `${group.length} Parallel` : 'Sequential'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300">
                      TXs: {group.map(i => `#${transactions[i].id}`).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-600 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">{tr('Parallel Groups')}:</span>
                  <span className="font-semibold">{conflictGroups.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Speedup:</span>
                  <span className="font-semibold text-emerald-400">
                    {transactions.length > 0 
                      ? `${(transactions.length / conflictGroups.length).toFixed(1)}x`
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Execution Log */}
        <div className="space-y-6">
          {/* Benchmark Results */}
          {benchmarkResults && (
            <div className="bg-slate-800 rounded-lg p-4 border-2 border-yellow-600">
              <h2 className="text-xl font-semibold mb-3 text-yellow-300">Benchmark Results</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className={`p-4 rounded-lg border-2 ${
                  benchmarkResults.winner === 'conservative' 
                    ? 'border-emerald-500 bg-emerald-900 bg-opacity-30' 
                    : 'border-slate-600 bg-slate-700'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-emerald-300">Conservative</span>
                    {benchmarkResults.winner === 'conservative' && (
                      <span className="text-xs bg-emerald-600 px-2 py-1 rounded">WINNER</span>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {benchmarkResults.conservative.time}ms
                  </div>
                  <div className="text-sm text-slate-300">
                    {conflictGroups.length} sequential groups
                  </div>
                  <div className="text-sm text-slate-400">
                    0 re-executions
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg border-2 ${
                  benchmarkResults.winner === 'optimistic' 
                    ? 'border-purple-500 bg-purple-900 bg-opacity-30' 
                    : 'border-slate-600 bg-slate-700'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-purple-300">Optimistic</span>
                    {benchmarkResults.winner === 'optimistic' && (
                      <span className="text-xs bg-purple-600 px-2 py-1 rounded">WINNER</span>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {benchmarkResults.optimistic.time}ms
                  </div>
                  <div className="text-sm text-slate-300">
                    Full parallelism
                  </div>
                  <div className={`text-sm ${
                    benchmarkResults.optimistic.reExecutions > 0 ? 'text-orange-400' : 'text-slate-400'
                  }`}>
                    {benchmarkResults.optimistic.reExecutions} re-execution{benchmarkResults.optimistic.reExecutions !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-900 rounded p-3 border border-slate-700">
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Performance difference:</span>
                    <span className="font-semibold text-yellow-400">
                      {benchmarkResults.percentDiff}% ({benchmarkResults.timeDiff}ms)
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    {benchmarkResults.winner === 'conservative' 
                      ? tr('✓ Conservative won - conflicts made re-executions costly')
                      : tr('✓ Optimistic won - low conflicts meant full parallelism paid off')
                    }
                  </div>
                  {analysis && (
                    <div className={`text-xs mt-2 ${
                      analysis.recommendation === benchmarkResults.winner 
                        ? 'text-emerald-400' 
                        : 'text-orange-400'
                    }`}>
                      {analysis.recommendation === benchmarkResults.winner 
                        ? '✓ Analyzer prediction was correct!'
                        : `⚠️ Analyzer predicted ${analysis.recommendation}, but ${benchmarkResults.winner} performed better`
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h2 className="text-xl font-semibold mb-3">Execution Log</h2>
            
            {/* Stats */}
            {stats.totalTime > 0 && (
              <div className="mb-4 p-3 bg-slate-700 rounded">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-400">Execution Time</div>
                    <div className="text-lg font-semibold text-blue-400">{stats.totalTime}ms</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Re-executions</div>
                    <div className={`text-lg font-semibold ${stats.reExecutions > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                      {stats.reExecutions}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {executionLog.length === 0 ? (
                <div className="text-slate-400 text-sm text-center py-8">
                  {tr('No executions yet. Select a strategy and click "Execute".')}
                </div>
              ) : (
                executionLog.map((entry, idx) => (
                  <div key={idx}>
                    {entry.type === 'phase' && (
                      <div className="font-bold py-2 px-3 rounded bg-blue-900 bg-opacity-30 text-blue-300 border border-blue-700">
                        {entry.message}
                      </div>
                    )}
                    {entry.type === 'optimistic_batch' && (
                      <div className="bg-purple-900 bg-opacity-20 rounded px-3 py-2 text-sm border border-purple-700">
                        <div className="text-purple-300">⚡ {tr('Executed all {{count}} transactions in parallel (speculative)', { count: entry.count })}</div>
                      </div>
                    )}
                    {entry.type === 'group' && (
                      <div className={`font-semibold py-2 px-3 rounded ${
                        entry.parallel ? 'bg-emerald-900 bg-opacity-30 text-emerald-300' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {entry.parallel ? '⚡ ' : '→ '}
                        Group {entry.group} ({entry.count} TX{entry.count > 1 ? 's' : ''} 
                        {entry.parallel ? ' in parallel' : ''})
                      </div>
                    )}
                    {entry.type === 'success' && (
                      <div className="bg-slate-700 rounded px-3 py-2 text-sm ml-4">
                        <div className="text-emerald-400">✓ TX #{entry.tx.id} Success</div>
                        <div className="text-slate-300 text-xs mt-1">
                          {entry.tx.from} ({entry.fromBalance}) → {entry.tx.to} ({entry.toBalance}) 
                          <span className="text-yellow-400 ml-1">[{entry.tx.amount}]</span>
                        </div>
                      </div>
                    )}
                    {entry.type === 'validated' && (
                      <div className="bg-emerald-900 bg-opacity-20 rounded px-3 py-2 text-sm ml-4 border border-emerald-700">
                        <div className="text-emerald-400">✓ TX #{entry.tx.id} Validated (no conflict)</div>
                        <div className="text-slate-300 text-xs mt-1">
                          {entry.tx.from} ({entry.fromBalance}) → {entry.tx.to} ({entry.toBalance}) 
                          <span className="text-yellow-400 ml-1">[{entry.tx.amount}]</span>
                        </div>
                      </div>
                    )}
                    {entry.type === 'conflict' && (
                      <div className="bg-orange-900 bg-opacity-30 rounded px-3 py-2 text-sm ml-4 border border-orange-600">
                        <div className="text-orange-400">⚠️ TX #{entry.tx.id} Conflict Detected</div>
                        <div className="text-slate-300 text-xs mt-1">
                          Expected {entry.tx.from}: {entry.expected.from}, Got: {entry.actual.from}
                        </div>
                      </div>
                    )}
                    {entry.type === 'reexecuted' && (
                      <div className="bg-purple-900 bg-opacity-20 rounded px-3 py-2 text-sm ml-4 border border-purple-700">
                        <div className="text-purple-400">🔄 TX #{entry.tx.id} Re-executed</div>
                        <div className="text-slate-300 text-xs mt-1">
                          {entry.tx.from} ({entry.fromBalance}) → {entry.tx.to} ({entry.toBalance}) 
                          <span className="text-yellow-400 ml-1">[{entry.tx.amount}]</span>
                        </div>
                      </div>
                    )}
                    {entry.type === 'error' && (
                      <div className="bg-red-900 bg-opacity-30 rounded px-3 py-2 text-sm ml-4">
                        <div className="text-red-400">✗ TX #{entry.tx.id} Failed</div>
                        <div className="text-slate-300 text-xs mt-1">{entry.reason}</div>
                      </div>
                    )}
                    {entry.type === 'complete' && (
                      <div className="font-semibold py-3 px-3 rounded bg-slate-700 text-slate-200 border-2 border-slate-600">
                        ✅ Execution Complete
                        {entry.reExecutions > 0 && (
                          <span className="text-orange-400 ml-2">
                            ({entry.reExecutions} re-execution{entry.reExecutions > 1 ? 's' : ''})
                          </span>
                        )}
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
            <h3 className="font-semibold text-lg mb-3 text-emerald-400">{tr('Who Uses Parallel Execution')}</h3>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-700 rounded p-3">
                <div className="font-bold text-blue-300">Solana</div>
                <p className="text-xs text-slate-300 mb-2">{tr('Uses a conservative model where transactions declare account access so the runtime can schedule non-conflicting transactions in parallel.')}</p>
                <a href="https://solana.com/docs" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 hover:text-blue-200 underline">Solana docs →</a>
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="font-bold text-purple-300">Aptos / Sui-style research</div>
                <p className="text-xs text-slate-300 mb-2">{tr('Optimistic approaches (like Block-STM) execute in parallel and re-run conflicting transactions to maximize throughput.')}</p>
                <div className="flex gap-3">
                  <a href="https://aptos.dev/" target="_blank" rel="noopener noreferrer" className="text-xs text-purple-300 hover:text-purple-200 underline">Aptos docs →</a>
                  <a href="https://docs.sui.io/" target="_blank" rel="noopener noreferrer" className="text-xs text-purple-300 hover:text-purple-200 underline">Sui docs →</a>
                </div>
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="font-bold text-pink-300">{tr('Execution clients in general')}</div>
                <p className="text-xs text-slate-300">{tr('Many runtimes explore parallelism to scale smart contract execution beyond single-threaded EVM execution.')}</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-3 text-yellow-400">{tr('Production Use Cases')}</h3>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-700 rounded p-3">
                <div className="font-semibold text-blue-300 mb-1">🧾 {tr('High-Volume Token Transfers')}</div>
                <p className="text-xs text-slate-300">{tr('Payments, airdrops, and market making can process many independent transfers in parallel.')}</p>
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="font-semibold text-purple-300 mb-1">🧠 {tr('On-Chain Orderbooks / Games')}</div>
                <p className="text-xs text-slate-300">{tr('Parallelism helps when state can be sharded across accounts/objects so many actions do not conflict.')}</p>
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="font-semibold text-emerald-300 mb-1">📈 {tr('Better Block Utilization')}</div>
                <p className="text-xs text-slate-300">{tr('Block producers can pack more transactions per block when the runtime can safely execute non-overlapping state changes concurrently.')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Further Reading */}
      <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-2xl font-bold mb-4 text-blue-300">📚 {tr('Further Reading')}</h2>
        <ul className="space-y-2 text-sm">
          <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://solana.com/docs" target="_blank" rel="noopener noreferrer">Solana runtime & accounts docs →</a></li>
          <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://aptos.dev/" target="_blank" rel="noopener noreferrer">Aptos documentation (Block-STM lineage) →</a></li>
          <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://docs.sui.io/" target="_blank" rel="noopener noreferrer">Sui documentation →</a></li>
        </ul>
      </div>

      {/* Explanation */}
      <div className="mt-6 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-300">{tr('Strategy Comparison')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
          <div>
            <div className="font-semibold text-emerald-400 mb-1">{tr('Conservative (Solana)')}</div>
            <ul className="space-y-1">
              <li>• {tr('Pre-analyzes dependencies before execution')}</li>
              <li>• {tr('No wasted computation')}</li>
              <li>• {tr('Requires developers to declare account access')}</li>
              <li>• {tr('Groups may have sequential bottlenecks')}</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-purple-400 mb-1">{tr('Optimistic (Aptos Block-STM)')}</div>
            <ul className="space-y-1">
              <li>• {tr('Maximum parallelism from the start')}</li>
              <li>• {tr('Auto-detects conflicts after execution')}</li>
              <li>• {tr('Some transactions may re-execute')}</li>
              <li>• {tr('Better for workloads with few conflicts')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParallelExecutor;