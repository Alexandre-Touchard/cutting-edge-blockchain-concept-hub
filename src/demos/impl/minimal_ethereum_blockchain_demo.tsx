import React, { useState } from 'react';
import EduTooltip from '../../ui/EduTooltip';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
const T = EduTooltip;
import { Plus, Pickaxe, Link, CheckCircle, AlertCircle, Wallet, ArrowRight, Zap } from 'lucide-react';

// Simulating the Rust blockchain in JavaScript for the demo
class Transaction {
  constructor(from, to, value, nonce) {
    this.from = from;
    this.to = to;
    this.value = value;
    this.nonce = nonce;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const data = `${this.from}${this.to}${this.value}${this.nonce}`;
    return this.simpleHash(data);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return '0x' + Math.abs(hash).toString(16).padStart(16, '0');
  }
}

class Block {
  constructor(number, transactions, previousHash, difficulty, miner) {
    this.number = number;
    this.timestamp = Date.now();
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.difficulty = difficulty;
    this.miner = miner;
    this.nonce = 0;
    this.hash = '';
  }

  calculateHash() {
    const txData = this.transactions.map(tx => tx.hash).join('');
    const data = `${this.number}${this.timestamp}${txData}${this.previousHash}${this.nonce}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  mine() {
    const target = '0'.repeat(this.difficulty);
    while (!this.hash.startsWith(target)) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
  }
}

const EthereumBlockchainDemo = () => {
  const { tr } = useDemoI18n('ethereum-blockchain');
  const [accounts, setAccounts] = useState({
    'Alice': { balance: 1000, nonce: 0 },
    'Bob': { balance: 1000, nonce: 0 },
    'Charlie': { balance: 1000, nonce: 0 }
  });

  const [chain, setChain] = useState([
    {
      number: 0,
      timestamp: Date.now() - 10000,
      transactions: [],
      previousHash: '0000000000000000',
      hash: '0000' + Math.random().toString(16).substr(2, 60),
      nonce: 12847,
      difficulty: 4,
      miner: 'Genesis'
    }
  ]);

  const [pendingTxs, setPendingTxs] = useState([]);
  const [mining, setMining] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [events, setEvents] = useState([]);
  const [difficulty, setDifficulty] = useState(4);

  // Transaction form state
  const [txFrom, setTxFrom] = useState('Alice');
  const [txTo, setTxTo] = useState('Bob');
  const [txValue, setTxValue] = useState(100);

  const addEvent = (message, type = 'info') => {
    setEvents(prev => [{
      id: Date.now(),
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

    if (accounts[txFrom].balance < txValue) {
      addEvent(`${txFrom} has insufficient balance`, 'error');
      return;
    }

    const tx = new Transaction(txFrom, txTo, txValue, accounts[txFrom].nonce);
    setPendingTxs([...pendingTxs, tx]);
    addEvent(`Transaction added: ${txFrom} → ${txTo} (${txValue} ETH)`, 'success');
  };

  const mineBlock = async () => {
    if (pendingTxs.length === 0) {
      addEvent(tr('No transactions to mine'), 'error');
      return;
    }

    setMining(true);
    addEvent(tr('Mining started...'), 'info');

    // Simulate mining delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const previousBlock = chain[chain.length - 1];
    const block = new Block(
      chain.length,
      [...pendingTxs],
      previousBlock.hash,
      difficulty,
      'Miner' + Math.floor(Math.random() * 10)
    );

    block.mine();

    // Update account balances
    const newAccounts = { ...accounts };
    pendingTxs.forEach(tx => {
      newAccounts[tx.from].balance -= tx.value;
      newAccounts[tx.from].nonce++;
      
      if (!newAccounts[tx.to]) {
        newAccounts[tx.to] = { balance: 0, nonce: 0 };
      }
      newAccounts[tx.to].balance += tx.value;
    });

    setAccounts(newAccounts);
    setChain([...chain, block]);
    setPendingTxs([]);
    setMining(false);
    addEvent(`Block #${block.number} mined with ${block.transactions.length} TXs (nonce: ${block.nonce})`, 'success');
  };

  const validateChain = () => {
    for (let i = 1; i < chain.length; i++) {
      const current = chain[i];
      const previous = chain[i - 1];
      
      if (current.previousHash !== previous.hash) {
        addEvent(tr('Chain validation failed: broken link'), 'error');
        return false;
      }
    }
    addEvent(tr('Chain is valid!'), 'success');
    return true;
  };

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
  <T term="Difficulty" text={define('Difficulty')} />
</span>
            </div>
            <div className="text-2xl font-bold">{difficulty}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={20} className="text-emerald-400" />
              <span className="text-sm text-slate-400">Total ETH</span>
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
                      <span className="text-sm text-slate-400">Nonce: {account.nonce}</span>
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
                    className="w-full bg-slate-700 rounded px-3 py-2"
                    min="1"
                  />
                </div>

                <button
                  onClick={addTransaction}
                  disabled={mining}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded font-semibold flex items-center justify-center gap-2"
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
                  min="1"
                  max="6"
                  value={difficulty}
                  onChange={(e) => setDifficulty(parseInt(e.target.value))}
                  disabled={mining}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>{tr('Easy')}</span>
                  <span>{tr('Hard')}</span>
                </div>
              </div>

              <button
                onClick={mineBlock}
                disabled={mining || pendingTxs.length === 0}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold flex items-center justify-center gap-2"
              >
                <Pickaxe size={18} />
                {mining ? tr('Mining...') : tr('Mine Block')}
              </button>

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
                        Nonce: {tx.nonce}
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
                      className={`bg-slate-700 rounded-lg p-3 cursor-pointer border-2 transition-all ${
                        selectedBlock === block.number ? 'border-blue-500' : 'border-slate-600'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-lg">Block #{block.number}</div>
                          <div className="text-xs text-slate-400">{block.miner}</div>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-semibold ${
                          block.number === 0 ? 'bg-purple-600' : 'bg-emerald-600'
                        }`}>
                          {block.number === 0 ? 'GENESIS' : 'MINED'}
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Transactions:</span>
                          <span className="font-semibold">{block.transactions.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">
  <T term="Nonce" text={define('Nonce')} />
  :
</span>
                          <span className="font-mono">{block.nonce}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Hash:</span>
                          <div className="font-mono text-blue-400 break-all text-xs mt-1">
                            {block.hash}
                          </div>
                        </div>
                      </div>

                      {selectedBlock === block.number && block.transactions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-600 space-y-2">
                          <div className="text-xs font-semibold text-slate-300">Transactions:</div>
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
                  <div className="font-bold text-blue-300">Blocks & State Transitions</div>
                  <p className="text-xs text-slate-300 mb-2">Ethereum clients execute transactions to update state, then commit to results via block headers and roots.</p>
                  <a href="https://ethereum.org/en/developers/docs/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 hover:text-blue-200 underline">Ethereum dev docs →</a>
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-purple-300">Consensus & Finality</div>
                  <p className="text-xs text-slate-300">Modern Ethereum uses Proof of Stake and finality gadgets; this demo shows the core chain/transaction ideas in a minimal way.</p>
                </div>
                <div className="bg-slate-700 rounded p-3">
                  <div className="font-bold text-pink-300">Mempool & Fees</div>
                  <p className="text-xs text-slate-300">Real networks have fee markets, MEV, and propagation delays; the mempool concept is the same.</p>
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
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://ethereum.org/en/developers/docs/" target="_blank" rel="noopener noreferrer">Ethereum developer documentation →</a></li>
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://ethereum.org/en/developers/docs/consensus-mechanisms/pow/" target="_blank" rel="noopener noreferrer">Proof of Work basics →</a></li>
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://bitcoin.org/bitcoin.pdf" target="_blank" rel="noopener noreferrer">Bitcoin whitepaper (foundations) →</a></li>
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