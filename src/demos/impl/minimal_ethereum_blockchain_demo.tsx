import React, { useState } from 'react';
import EduTooltip from '../../ui/EduTooltip';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
import { NextQuestCard, QuestList, useDemoQuests } from '../quests/DemoQuests';
import {
  MAX_DIFFICULTY,
  MAX_MINING_ATTEMPTS,
  MIN_DIFFICULTY,
  createTx,
  expectedAttempts,
  isBlockValid,
  mine,
  type BlockHeader,
  type Tx
} from './minimal_ethereum/chain';
const T = EduTooltip;
import { Plus, Pickaxe, Link, CheckCircle, AlertCircle, Wallet, ArrowRight, Zap } from 'lucide-react';

/** A mined block: the header it commits to plus the proof-of-work result. */
type ChainBlock = BlockHeader & {
  hash: string;
  nonce: number;
  difficulty: number;
  miner: string;
  /** Hashes computed before the winning nonce was found. */
  attempts: number;
};

type Accounts = Record<string, { balance: number; nonce: number }>;

/** Hashes per chunk before yielding to the browser so the UI stays responsive. */
const MINING_CHUNK = 100_000;

// Genesis is mined for real (difficulty 4) once, with a fixed timestamp (Ethereum's 2015 launch).
const GENESIS: ChainBlock = (() => {
  const header: BlockHeader = { number: 0, timestamp: 1_438_269_973_000, previousHash: '0'.repeat(64), transactions: [] };
  const r = mine(header, 4);
  return { ...header, hash: r.hash, nonce: r.nonce, difficulty: 4, miner: 'Genesis', attempts: r.attempts };
})();

const EthereumBlockchainDemo = () => {
  const { tr } = useDemoI18n('ethereum-blockchain');
  const [accounts, setAccounts] = useState<Accounts>({
    'Alice': { balance: 1000, nonce: 0 },
    'Bob': { balance: 1000, nonce: 0 },
    'Charlie': { balance: 1000, nonce: 0 }
  });

  const [chain, setChain] = useState<ChainBlock[]>([GENESIS]);

  const [pendingTxs, setPendingTxs] = useState<Tx[]>([]);
  const [mining, setMining] = useState(false);
  const [miningAttempts, setMiningAttempts] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [events, setEvents] = useState<{ id: number; message: string; type: string; time: string }[]>([]);
  const [difficulty, setDifficulty] = useState(4);

  // Transaction form state
  const [txFrom, setTxFrom] = useState('Alice');
  const [txTo, setTxTo] = useState('Bob');
  const [txValue, setTxValue] = useState(100);

  const addEvent = (message: string, type = 'info') => {
    setEvents(prev => [{
      id: Date.now() + Math.random(),
      message,
      type,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 8));
  };

  const addTransaction = () => {
    if (txFrom === txTo) {
      addEvent(tr('Cannot send to yourself'), 'error');
      return;
    }

    // Pending transfers from the same sender already spend part of the balance and use up nonces.
    const senderPending = pendingTxs.filter(tx => tx.from === txFrom);
    const available = accounts[txFrom].balance - senderPending.reduce((sum, tx) => sum + tx.value, 0);
    if (available < txValue) {
      q.markDone('overspend');
      addEvent(tr('{{name}} has insufficient balance', { name: txFrom }), 'error');
      return;
    }

    const tx = createTx(txFrom, txTo, txValue, accounts[txFrom].nonce + senderPending.length);
    setPendingTxs(prev => [...prev, tx]);
    addEvent(tr('Transaction added: {{from}} → {{to}} ({{value}} ETH)', { from: txFrom, to: txTo, value: txValue }), 'success');
  };

  const mineBlock = async () => {
    if (mining) return;
    const txs = pendingTxs;
    if (txs.length === 0) {
      addEvent(tr('No transactions to mine'), 'error');
      return;
    }

    setMining(true);
    setMiningAttempts(0);
    addEvent(tr('Mining started...'), 'info');

    const previousBlock = chain[chain.length - 1];
    const header: BlockHeader = {
      number: previousBlock.number + 1,
      timestamp: Date.now(),
      previousHash: previousBlock.hash,
      transactions: [...txs]
    };

    // Real proof of work: try nonces in chunks, yielding between chunks so the page can repaint.
    let total = 0;
    let startNonce = 0;
    let result = mine(header, difficulty, { startNonce, maxAttempts: MINING_CHUNK });
    total += result.attempts;
    while (!result.found && total < MAX_MINING_ATTEMPTS) {
      setMiningAttempts(total);
      await new Promise(resolve => setTimeout(resolve, 0));
      startNonce = result.nonce;
      result = mine(header, difficulty, { startNonce, maxAttempts: Math.min(MINING_CHUNK, MAX_MINING_ATTEMPTS - total) });
      total += result.attempts;
    }
    setMiningAttempts(total);

    if (!result.found) {
      setMining(false);
      addEvent(tr('Gave up after {{attempts}} attempts without finding a valid nonce', { attempts: total.toLocaleString() }), 'error');
      return;
    }

    const block: ChainBlock = {
      ...header,
      hash: result.hash,
      nonce: result.nonce,
      difficulty,
      miner: 'Miner' + Math.floor(Math.random() * 10),
      attempts: total
    };

    // Execute the transactions: update balances and sender nonces (copy, don't mutate state).
    setAccounts(prev => {
      const next: Accounts = {};
      for (const [name, acc] of Object.entries(prev)) next[name] = { ...acc };
      txs.forEach(tx => {
        next[tx.from].balance -= tx.value;
        next[tx.from].nonce++;
        if (!next[tx.to]) next[tx.to] = { balance: 0, nonce: 0 };
        next[tx.to].balance += tx.value;
      });
      return next;
    });
    setChain(prev => [...prev, block]);
    setPendingTxs(prev => prev.filter(tx => !txs.includes(tx)));
    setMining(false);
    addEvent(
      tr('Block #{{number}} mined with {{txs}} TXs after {{attempts}} attempts (nonce: {{nonce}})', {
        number: block.number,
        txs: block.transactions.length,
        attempts: total.toLocaleString(),
        nonce: block.nonce
      }),
      'success'
    );
  };

  const validateChain = () => {
    for (let i = 0; i < chain.length; i++) {
      const current = chain[i];
      if (i > 0 && current.previousHash !== chain[i - 1].hash) {
        addEvent(tr('Chain validation failed: broken link'), 'error');
        return false;
      }
      if (!isBlockValid(current)) {
        addEvent(tr('Chain validation failed: block #{{number}} has an invalid hash', { number: current.number }), 'error');
        return false;
      }
    }
    addEvent(tr('Chain is valid!'), 'success');
    return true;
  };

  const q = useDemoQuests('ethereum-blockchain', [
    {
      id: 'add-tx',
      text: tr('Add a transaction to the pool'),
      tip: tr('Pick From, To and an amount, then click Add to Pool: it waits in the Transaction Pool.'),
      done: pendingTxs.length > 0 || chain.length > 1,
      target: 'add-to-pool'
    },
    {
      id: 'mine',
      text: tr('Mine a block and watch balances change'),
      tip: tr('Click Mine Block: the pending transactions execute, and balances and nonces update in Accounts.'),
      done: chain.length > 1,
      target: 'mine-block'
    },
    {
      id: 'inspect-block',
      text: tr('Open a mined block to see its transactions'),
      tip: tr('Click the newest block in the Blockchain column to list its transactions.'),
      done: selectedBlock !== null && selectedBlock > 0,
      target: 'latest-block'
    },
    {
      id: 'overspend',
      text: tr('Get a transfer rejected for insufficient balance'),
      tip: tr('Set Amount (ETH) above the sender’s balance and click Add to Pool: the Event Log shows the error.'),
      target: 'tx-amount'
    },
    {
      id: 'nonce-2',
      text: tr('Raise an account’s nonce to 2'),
      tip: tr('Mine a second transfer from the same sender (e.g. Alice): its Nonce in Accounts goes up by one per mined transaction.'),
      done: Object.values(accounts).some((a) => a.nonce >= 2),
      target: 'add-to-pool'
    }
  ]);

  const getEventColor = (type) => {
    switch (type) {
      case 'success': return 'border-l-emerald-500 bg-emerald-900 bg-opacity-20';
      case 'error': return 'border-l-red-500 bg-red-900 bg-opacity-20';
      default: return 'border-l-blue-500 bg-blue-900 bg-opacity-20';
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">⛓️ {tr('Minimal Ethereum Blockchain')}</h1>
          <p className="text-slate-300">
            {tr('Built with Rust concepts - Proof of Work, Account Model, Transaction Pool')}
          </p>
          <NextQuestCard q={q} className="mt-4" />
          <QuestList q={q} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Link size={20} className="text-blue-400" />
              <span className="text-sm text-slate-400">{tr('Chain Length')}</span>
            </div>
            <div className="text-2xl font-bold">{chain.length}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={20} className="text-yellow-400" />
              <span className="text-sm text-slate-400">{tr('Pending TXs')}</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">{pendingTxs.length}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Pickaxe size={20} className="text-purple-400" />
              <span className="text-sm text-slate-400">
  <T term={tr('Difficulty')} text={define('Difficulty')} />
</span>
            </div>
            <div className="text-2xl font-bold">{difficulty}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={20} className="text-emerald-400" />
              <span className="text-sm text-slate-400">{tr('Total ETH')}</span>
            </div>
            <div className="text-2xl font-bold">
              {Object.values(accounts).reduce((sum, acc) => sum + acc.balance, 0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Accounts & Transactions */}
          <div className="space-y-6">
            {/* Accounts */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Wallet className="text-emerald-400" />
                {tr('Accounts')}
              </h2>
              <div className="space-y-2">
                {Object.entries(accounts).map(([name, account]) => (
                  <div key={name} className="bg-slate-700 rounded p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold">{name}</span>
                      <span className="text-sm text-slate-400">{tr('Nonce')}: {account.nonce}</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {account.balance} ETH
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Transaction */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Plus className="text-blue-400" />
                {tr('New Transaction')}
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">{tr('From')}</label>
                  <select
                    value={txFrom}
                    onChange={(e) => setTxFrom(e.target.value)}
                    className="w-full bg-slate-700 rounded px-3 py-2"
                  >
                    {Object.keys(accounts).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-400 block mb-1">{tr('To')}</label>
                  <select
                    value={txTo}
                    onChange={(e) => setTxTo(e.target.value)}
                    className="w-full bg-slate-700 rounded px-3 py-2"
                  >
                    {Object.keys(accounts).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-400 block mb-1">{tr('Amount (ETH)')}</label>
                  <input
                    type="number"
                    value={txValue}
                    onChange={(e) => setTxValue(parseInt(e.target.value) || 0)}
                    data-hint="tx-amount"
                    className={`w-full bg-slate-700 rounded px-3 py-2 ${q.pulse('tx-amount')}`}
                    min="1"
                  />
                </div>

                <button
                  onClick={addTransaction}
                  disabled={mining}
                  data-hint="add-to-pool"
                  className={`w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded font-semibold flex items-center justify-center gap-2 ${q.pulse('add-to-pool')}`}
                >
                  <Plus size={18} />
                  {tr('Add to Pool')}
                </button>
              </div>
            </div>

            {/* Mining Controls */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Pickaxe className="text-purple-400" />
                {tr('Mining')}
              </h2>

              <div className="mb-4">
                <label className="text-sm text-slate-400 block mb-2">
                  {tr('Difficulty')}: {difficulty} ({tr('leading zeros')})
                </label>
                <input
                  type="range"
                  min={MIN_DIFFICULTY}
                  max={MAX_DIFFICULTY}
                  value={difficulty}
                  onChange={(e) => setDifficulty(parseInt(e.target.value))}
                  disabled={mining}
                  aria-label={tr('Difficulty')}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>{tr('Easy')}</span>
                  <span>{tr('Hard')}</span>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {tr('About {{attempts}} hashes expected (16^{{difficulty}})', {
                    attempts: expectedAttempts(difficulty).toLocaleString(),
                    difficulty
                  })}
                </div>
              </div>

              <button
                onClick={mineBlock}
                disabled={mining || pendingTxs.length === 0}
                data-hint="mine-block"
                className={`w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold flex items-center justify-center gap-2 ${q.pulse('mine-block')}`}
              >
                <Pickaxe size={18} />
                {mining ? tr('Mining...') : tr('Mine Block')}
              </button>
              {mining && (
                <div className="mt-2 text-xs text-purple-300 text-center" aria-live="polite">
                  {tr('{{attempts}} nonces tried so far', { attempts: miningAttempts.toLocaleString() })}
                </div>
              )}

              <button
                onClick={validateChain}
                disabled={mining}
                className="w-full mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 rounded font-semibold flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                {tr('Validate Chain')}
              </button>
            </div>

            {/* Event Log */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">{tr('Event Log')}</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.length === 0 ? (
                  <div className="text-center text-slate-400 py-4 text-sm">
                    {tr('No events yet')}
                  </div>
                ) : (
                  events.map(event => (
                    <div key={event.id} className={`p-2 rounded border-l-4 ${getEventColor(event.type)}`}>
                      <div className="text-sm">{event.message}</div>
                      <div className="text-xs text-slate-400">{event.time}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Middle - Pending Transactions */}
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Zap className="text-yellow-400" />
                {tr('Transaction Pool')} ({pendingTxs.length})
              </h2>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {pendingTxs.length === 0 ? (
                  <div className="text-center text-slate-400 py-8 text-sm">
                    {tr('No pending transactions')}
                  </div>
                ) : (
                  pendingTxs.map((tx, idx) => (
                    <div key={idx} className="bg-slate-700 rounded p-3 border-l-4 border-yellow-500">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">TX #{idx + 1}</span>
                        <span className="text-xs font-mono text-slate-500">
                          {tx.hash.substr(0, 10)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">{tx.from}</span>
                        <ArrowRight size={16} className="text-slate-400" />
                        <span className="font-semibold">{tx.to}</span>
                        <span className="ml-auto text-emerald-400 font-bold">{tx.value} ETH</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {tr('Nonce')}: {tx.nonce}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right - Blockchain */}
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Link className="text-blue-400" />
                {tr('Blockchain')} ({chain.length} {tr('blocks')})
              </h2>

              <div className="space-y-3 max-h-[800px] overflow-y-auto">
                {[...chain].reverse().map((block, idx) => (
                  <div key={block.number}>
                    <div
                      onClick={() => setSelectedBlock(selectedBlock === block.number ? null : block.number)}
                      data-hint={idx === 0 ? 'latest-block' : undefined}
                      className={`bg-slate-700 rounded-lg p-3 cursor-pointer border-2 transition-all ${
                        selectedBlock === block.number ? 'border-blue-500' : 'border-slate-600'
                      } ${idx === 0 ? q.pulse('latest-block') : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-lg">{tr('Block #{{number}}', { number: block.number })}</div>
                          <div className="text-xs text-slate-400">{block.miner}</div>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-semibold ${
                          block.number === 0 ? 'bg-purple-600' : 'bg-emerald-600'
                        }`}>
                          {block.number === 0 ? tr('GENESIS') : tr('MINED')}
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">{tr('Transactions')}:</span>
                          <span className="font-semibold">{block.transactions.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">{tr('Difficulty')}:</span>
                          <span className="font-mono">{block.difficulty}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">
  <T term={tr('Nonce')} text={define('Nonce')} />
  :
</span>
                          <span className="font-mono">{block.nonce}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">{tr('Attempts')}:</span>
                          <span className="font-mono">{block.attempts.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">{tr('Hash')}:</span>
                          <div className="font-mono text-blue-400 break-all text-xs mt-1">
                            <span className="text-emerald-300">{block.hash.slice(0, block.difficulty)}</span>
                            {block.hash.slice(block.difficulty)}
                          </div>
                        </div>
                      </div>

                      {selectedBlock === block.number && block.transactions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-600 space-y-2">
                          <div className="text-xs font-semibold text-slate-300">{tr('Transactions')}:</div>
                          {block.transactions.map((tx, txIdx) => (
                            <div key={txIdx} className="bg-slate-600 rounded p-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{tx.from}</span>
                                <ArrowRight size={12} />
                                <span className="font-semibold">{tx.to}</span>
                                <span className="ml-auto text-emerald-400">{tx.value} ETH</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {idx < chain.length - 1 && (
                      <div className="flex justify-center py-2">
                        <div className="w-0.5 h-6 bg-slate-600"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Real-World Applications */}
        <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">🌐 {tr('Real-World Applications')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-emerald-400">{tr('How This Maps to Ethereum')}</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-blue-300">{tr('Blocks & State Transitions')}</div>
                  <p className="text-xs text-slate-300 mb-2">{tr('Ethereum clients execute transactions to update state, then commit to results via block headers and roots.')}</p>
                  <a href="https://ethereum.org/en/developers/docs/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 hover:text-blue-200 underline">{tr('Ethereum dev docs →')}</a>
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-purple-300">{tr('Consensus & Finality')}</div>
                  <p className="text-xs text-slate-300">{tr('Modern Ethereum uses Proof of Stake and finality gadgets; this demo shows the core chain/transaction ideas in a minimal way.')}</p>
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-pink-300">{tr('Mempool & Fees')}</div>
                  <p className="text-xs text-slate-300">{tr('Real networks have fee markets, MEV, and propagation delays; the mempool concept is the same.')}</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3 text-yellow-400">{tr('Practical Uses of a Minimal Chain')}</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-blue-300 mb-1">🎓 {tr('Education & Prototyping')}</div>
                  <p className="text-xs text-slate-300">{tr('Teach cryptographic linking, block validation, and mining/consensus basics without production complexity.')}</p>
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-purple-300 mb-1">🧪 {tr('Testnets / Private Chains')}</div>
                  <p className="text-xs text-slate-300">{tr('Organizations build private ledgers or testnets to simulate transaction flows and smart contract interactions.')}</p>
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-semibold text-emerald-300 mb-1">🔎 {tr('Client Understanding')}</div>
                  <p className="text-xs text-slate-300">{tr('Helps new engineers reason about client architecture: networking → mempool → execution → block import.')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Further Reading */}
        <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">📚 {tr('Further Reading')}</h2>
          <ul className="space-y-2 text-sm">
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://ethereum.org/en/developers/docs/" target="_blank" rel="noopener noreferrer">{tr('Ethereum developer documentation →')}</a></li>
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://ethereum.org/en/developers/docs/consensus-mechanisms/pow/" target="_blank" rel="noopener noreferrer">{tr('Proof of Work basics →')}</a></li>
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://bitcoin.org/bitcoin.pdf" target="_blank" rel="noopener noreferrer">{tr('Bitcoin whitepaper (foundations) →')}</a></li>
          </ul>
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-blue-300">{tr('How It Works')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-300">
            <div>
              <div className="font-semibold text-blue-400 mb-1">1. {tr('Add Transactions')}</div>
              <p className="text-xs">{tr('Create transfers between accounts. Transactions go to the pending pool and check sender balance.')}</p>
            </div>
            <div>
              <div className="font-semibold text-blue-400 mb-1">2. {tr('Mine Blocks')}</div>
              <p className="text-xs">{tr('Mining finds a nonce that creates a hash with the required leading zeros (Proof of Work). Higher difficulty = more zeros needed.')}</p>
            </div>
            <div>
              <div className="font-semibold text-blue-400 mb-1">3. {tr('Update State')}</div>
              <p className="text-xs">{tr('Once mined, transactions execute and update account balances. Each block links to the previous one via hash.')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EthereumBlockchainDemo;