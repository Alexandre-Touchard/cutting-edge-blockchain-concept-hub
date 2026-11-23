import React, { useState, useEffect, useMemo, useRef } from 'react';
import LinkWithCopy from '../../ui/LinkWithCopy';
import EduTooltip from '../../ui/EduTooltip';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
import { useDemoQuests, QuestList, NextQuestCard } from '../quests/DemoQuests';
import { Plus, Play, RefreshCw, GitBranch, Square } from 'lucide-react';
const T = EduTooltip;

/** Transactions present at start (and after Reset): quests look at the ones the learner adds. */
const INITIAL_DAG_IDS = ['A', 'B', 'C', 'D'];

/** A transaction is confirmed once its cumulative weight (itself + every later tx approving it) reaches this. */
export const CONFIRMATION_THRESHOLD = 3;

const VALIDATORS = [
  'Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry',
  'Ivy', 'Jack', 'Kate', 'Liam', 'Maya', 'Noah', 'Olivia', 'Paul',
  'Quinn', 'Ruby', 'Sam', 'Tina'
];
const TRANSACTION_TYPES = ['Transfer', 'Smart Contract', 'NFT Mint', 'Token Swap', 'Stake', 'Governance Vote'];
const AMOUNTS = [10, 25, 50, 100, 250, 500, 1000];
const AUTO_GENERATE_DELAY_MS = 600;

export type DagNode = {
  id: string;
  x: number;
  y: number;
  parents: string[];
  validator: string;
  timestamp: number;
  // Transaction details
  type?: string;
  amount?: number;
  from?: string;
  to?: string;
  /** Kept as a formatted string (e.g. "0.0010"). */
  fee?: string | number;
  nonce?: number;
};

type Rng = () => number;

const pick = <V,>(items: V[], rng: Rng): V => items[Math.floor(rng() * items.length)];

/** Transaction id for the n-th node: A..Z, then AA, AB, … (ids follow insertion order). */
export function idForIndex(index: number): string {
  let n = index;
  let id = '';
  do {
    id = String.fromCharCode(65 + (n % 26)) + id;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return id;
}

/** Tips = transactions that no other transaction approves yet (in insertion order). */
export function computeTips(nodes: DagNode[]): string[] {
  const approved = new Set(nodes.flatMap((n) => n.parents));
  return nodes.filter((n) => !approved.has(n.id)).map((n) => n.id);
}

/**
 * Cumulative weight of every transaction: its own weight (1) plus the number of distinct
 * transactions that approve it directly or indirectly (its descendants in the DAG).
 */
export function computeCumulativeWeights(nodes: DagNode[]): Map<string, number> {
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    for (const p of n.parents) children.set(p, [...(children.get(p) ?? []), n.id]);
  }
  const weights = new Map<string, number>();
  for (const n of nodes) {
    const seen = new Set<string>();
    const stack = [...(children.get(n.id) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(children.get(id) ?? []));
    }
    weights.set(n.id, 1 + seen.size);
  }
  return weights;
}

/** Up to `max` distinct random tips of the current DAG. */
export function pickRandomTips(nodes: DagNode[], max: number, rng: Rng): string[] {
  const available = computeTips(nodes);
  const chosen: string[] = [];
  while (chosen.length < max && available.length > 0) {
    chosen.push(available.splice(Math.floor(rng() * available.length), 1)[0]);
  }
  return chosen;
}

/** Appends a new transaction approving `parents` (falls back to the first two tips of `nodes`). */
export function appendTransaction(nodes: DagNode[], parents: string[], validator: string, rng: Rng): DagNode[] {
  const existing = parents.filter((id) => nodes.some((n) => n.id === id));
  const parentIds = existing.length > 0 ? existing : computeTips(nodes).slice(0, 2);
  const parentNodes = nodes.filter((n) => parentIds.includes(n.id));
  const avgX = parentNodes.reduce((sum, n) => sum + n.x, 0) / Math.max(1, parentNodes.length);
  const maxY = Math.max(0, ...parentNodes.map((n) => n.y));
  const jitter = (rng() - 0.5) * 100;
  const newNode: DagNode = {
    id: idForIndex(nodes.length),
    x: Math.max(100, Math.min(700, avgX + jitter)),
    y: maxY + 120,
    parents: parentIds,
    validator,
    timestamp: Date.now(),
    type: pick(TRANSACTION_TYPES, rng),
    amount: pick(AMOUNTS, rng),
    from: pick(VALIDATORS, rng),
    to: pick(VALIDATORS, rng),
    fee: (rng() * 0.1).toFixed(4),
    nonce: Math.floor(rng() * 10000)
  };
  return [...nodes, newNode];
}

function makeInitialNodes(): DagNode[] {
  const now = Date.now();
  const fee = () => (Math.random() * 0.1).toFixed(4);
  const nonce = () => Math.floor(Math.random() * 10000);
  return [
    {
      id: 'A', x: 400, y: 100, parents: [], validator: 'Alice', timestamp: now - 5000,
      type: 'Genesis', amount: 0, from: 'System', to: 'Network', fee: 0, nonce: 0
    },
    {
      id: 'B', x: 250, y: 200, parents: ['A'], validator: 'Bob', timestamp: now - 4500,
      type: TRANSACTION_TYPES[0], amount: AMOUNTS[3], from: VALIDATORS[1], to: VALIDATORS[2], fee: fee(), nonce: nonce()
    },
    {
      id: 'C', x: 400, y: 200, parents: ['A'], validator: 'Charlie', timestamp: now - 4300,
      type: TRANSACTION_TYPES[4], amount: AMOUNTS[5], from: VALIDATORS[2], to: 'Validator Pool', fee: fee(), nonce: nonce()
    },
    {
      id: 'D', x: 550, y: 200, parents: ['A'], validator: 'Dave', timestamp: now - 4000,
      type: TRANSACTION_TYPES[1], amount: AMOUNTS[4], from: VALIDATORS[3], to: VALIDATORS[0], fee: fee(), nonce: nonce()
    }
  ];
}

const DAGConsensus = () => {
  const { tr } = useDemoI18n('dag-consensus');
  const [nodes, setNodes] = useState<DagNode[]>(makeInitialNodes);

  const [selectedParents, setSelectedParents] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const validators = VALIDATORS;
  const [selectedValidator, setSelectedValidator] = useState('Eve');
  const [numToGenerate, setNumToGenerate] = useState(10);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Everything below is derived from the current DAG, so it can never be stale.
  const nextId = idForIndex(nodes.length);
  const tips = useMemo(() => computeTips(nodes), [nodes]);
  const weights = useMemo(() => computeCumulativeWeights(nodes), [nodes]);
  const calculateWeight = (nodeId: string) => weights.get(nodeId) ?? 0;
  const isConfirmed = (nodeId: string) => calculateWeight(nodeId) >= CONFIRMATION_THRESHOLD;
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;

  // Auto-generation run currently allowed to write to the DAG (null = none). Reset/unmount clear it.
  const activeRunRef = useRef<number | null>(null);
  const runCounterRef = useRef(0);
  useEffect(() => () => {
    activeRunRef.current = null;
  }, []);

  const txTypeLabel = (type?: string) => {
    switch (type) {
      case 'Genesis': return tr('Genesis');
      case 'Transfer': return tr('Transfer');
      case 'Smart Contract': return tr('Smart Contract');
      case 'NFT Mint': return tr('NFT Mint');
      case 'Token Swap': return tr('Token Swap');
      case 'Stake': return tr('Stake');
      case 'Governance Vote': return tr('Governance Vote');
      default: return type ?? '-';
    }
  };

  const partyLabel = (party?: string) => {
    switch (party) {
      case 'System': return tr('System');
      case 'Network': return tr('Network');
      case 'Validator Pool': return tr('Validator Pool');
      default: return party ?? '-';
    }
  };

  const addTransaction = () => {
    if (isAnimating) return;
    const parents = selectedParents;
    const validator = selectedValidator;
    setNodes((prev) => appendTransaction(prev, parents, validator, Math.random));
    setSelectedParents([]);
  };

  const handleNodeClick = (nodeId: string, event?: React.MouseEvent) => {
    if (isAnimating) return;

    // Check if this is a selection action (shift key) or info view
    if (event?.shiftKey) {
      // Shift-click for parent selection
      if (selectedParents.includes(nodeId)) {
        setSelectedParents(selectedParents.filter(id => id !== nodeId));
      } else if (selectedParents.length < 2) {
        setSelectedParents([...selectedParents, nodeId]);
      } else {
        setSelectedParents([nodeId]);
      }
    } else {
      // Regular click for viewing details
      setSelectedNodeId(nodeId);
    }
  };

  const stopAutoGenerate = () => {
    activeRunRef.current = null;
    setIsAnimating(false);
  };

  const reset = () => {
    stopAutoGenerate();
    setNodes(makeInitialNodes());
    setSelectedParents([]);
    setSelectedNodeId(null);
    setGeneratedCount(0);
  };

  const autoGenerate = async () => {
    if (activeRunRef.current !== null) return; // already running (e.g. double click)
    const runId = ++runCounterRef.current;
    activeRunRef.current = runId;
    const total = numToGenerate;
    setIsAnimating(true);
    setGeneratedCount(0);
    setSelectedParents([]);

    for (let i = 0; i < total; i++) {
      await new Promise((resolve) => setTimeout(resolve, AUTO_GENERATE_DELAY_MS));
      if (activeRunRef.current !== runId) return; // stopped, reset or unmounted

      const validator = pick(VALIDATORS, Math.random);
      setSelectedValidator(validator);
      // Functional update: each transaction picks its parents among the tips of the *current* DAG.
      setNodes((prev) => {
        const numParents = Math.random() > 0.5 ? 2 : 1;
        return appendTransaction(prev, pickRandomTips(prev, numParents, Math.random), validator, Math.random);
      });
      setGeneratedCount(i + 1);
    }

    if (activeRunRef.current === runId) stopAutoGenerate();
  };

  // Get color for validator
  const getValidatorColor = (validator?: string) => {
    const colors: Record<string, string> = {
      'Alice': '#ef4444', 'Bob': '#3b82f6', 'Charlie': '#10b981', 'Dave': '#f59e0b', 'Eve': '#8b5cf6',
      'Frank': '#ec4899', 'Grace': '#14b8a6', 'Henry': '#f97316', 'Ivy': '#06b6d4', 'Jack': '#84cc16',
      'Kate': '#a855f7', 'Liam': '#22c55e', 'Maya': '#eab308', 'Noah': '#6366f1', 'Olivia': '#f43f5e',
      'Paul': '#059669', 'Quinn': '#d946ef', 'Ruby': '#dc2626', 'Sam': '#0ea5e9', 'Tina': '#65a30d'
    };
    return colors[validator] || '#6b7280';
  };

  // Learning quests
  const addedCount = nodes.filter(n => !INITIAL_DAG_IDS.includes(n.id)).length;
  const q = useDemoQuests('dag-consensus', [
    {
      id: 'inspect-tx',
      text: tr('Open the details of a transaction'),
      tip: tr('Click any node in the graph, or a tip under Current Tips, to open its Transaction Details: parents, weight and status.'),
      done: selectedNode !== null,
      target: 'tips'
    },
    {
      id: 'pick-parents',
      text: tr('Select two tips as parents'),
      tip: tr('Shift+Click two tips under Current Tips: they turn yellow and appear under Selected Parents (2/2).'),
      done: selectedParents.length === 2,
      target: 'tips'
    },
    {
      id: 'add-two-parents',
      text: tr('Add a transaction approving your two tips'),
      tip: tr('With two parents selected, click Add Transaction: the new node points to both parents, and they are no longer tips.'),
      target: 'add-tx'
    },
    {
      id: 'merge-tips',
      text: tr('Merge every branch into a single tip'),
      tip: tr('Keep clicking Add Transaction (it picks two tips for you) until Current Tips shows just one: one transaction now approves the whole DAG.'),
      done: addedCount > 0 && tips.length === 1,
      target: 'add-tx'
    },
    {
      id: 'confirm-own',
      text: tr('Inspect one of your transactions once confirmed'),
      tip: tr('Keep adding transactions until one you added is approved (directly or indirectly) by at least two later ones, then click its green ✓ node: its details show ✓ CONFIRMED, with a weight of 3 or more.'),
      done: !!selectedNode && !INITIAL_DAG_IDS.includes(selectedNode.id) && isConfirmed(selectedNode.id),
      target: 'dag-graph'
    }
  ]);

  const maxY = Math.max(...nodes.map(n => n.y), 300);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          <T term="DAG Consensus" text={define('DAG Consensus')} />
          {tr('Interactive Demo')}
        </h1>
        <p className="text-slate-300">
          {tr(
            'Directed Acyclic Graph consensus - transactions reference previous ones, forming a web instead of a chain'
          )}
        </p>
        <NextQuestCard q={q} className="mt-4" />
        <QuestList q={q} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-1 space-y-4">
          {/* Tips Info */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch size={18} className="text-emerald-400" />
              <h2 className="text-lg font-semibold">
  <T term="Current Tips" text={define('Current Tips')} />
</h2>
            </div>
            <div data-hint="tips" className={`flex flex-wrap gap-2 rounded ${q.pulse('tips')}`}>
              {tips.length > 0 ? (
                tips.map(tipId => {
                  const node = nodes.find(n => n.id === tipId);
                  return (
                    <button
                      key={tipId}
                      onClick={(e) => handleNodeClick(tipId, e)}
                      className="px-3 py-1 rounded text-sm font-semibold transition-all hover:scale-105"
                      style={{ 
                        backgroundColor: selectedParents.includes(tipId) ? '#fbbf24' : getValidatorColor(node?.validator) + '40',
                        border: `2px solid ${selectedParents.includes(tipId) ? '#fbbf24' : getValidatorColor(node?.validator)}`
                      }}
                    >
                      {tipId}
                    </button>
                  );
                })
              ) : (
                <div className="text-slate-400 text-sm">{tr('No tips available')}</div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {tr('Click tips to view details • Shift+Click to select as parents')}
            </p>
          </div>

          {/* Add Transaction */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h2 className="text-lg font-semibold mb-3">{tr('Add Transaction')}</h2>
            
            <div className="mb-3">
              <label className="text-sm text-slate-400 mb-2 block">{tr('Validator')}</label>
              <select
                value={selectedValidator}
                onChange={(e) => setSelectedValidator(e.target.value)}
                className="w-full bg-slate-700 rounded px-3 py-2 text-sm"
                disabled={isAnimating}
              >
                {validators.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="text-sm text-slate-400 mb-2 block">
                {tr('Selected Parents')} ({selectedParents.length}/2)
              </label>
              <div className="min-h-[60px] bg-slate-700 rounded p-2 flex flex-wrap gap-2">
                {selectedParents.length > 0 ? (
                  selectedParents.map(id => {
                    const node = nodes.find(n => n.id === id);
                    return (
                      <button
                        key={id}
                        onClick={(e) => handleNodeClick(id, e)}
                        className="px-3 py-1 rounded text-sm font-semibold bg-yellow-600 hover:bg-yellow-700"
                      >
                        {id} ✕
                      </button>
                    );
                  })
                ) : (
                  <div className="text-slate-500 text-xs py-2">{tr('Shift+Click nodes in DAG to select')}</div>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                if (!isAnimating && selectedParents.length === 2) q.markDone('add-two-parents');
                addTransaction();
              }}
              disabled={isAnimating}
              data-hint="add-tx"
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold transition-all ${q.pulse('add-tx')}`}
            >
              <Plus size={18} />
              {tr('Add Transaction {{id}}', { id: nextId })}
            </button>
            
            {selectedParents.length === 0 && (
              <p className="text-xs text-blue-400 mt-2">{tr('Will auto-select tips if none chosen')}</p>
            )}

            <div className="mt-3 mb-2">
              <label className="text-sm text-slate-400 mb-2 block">
                {tr('Auto-Generate Amount')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={numToGenerate}
                  onChange={(e) => setNumToGenerate(parseInt(e.target.value))}
                  className="flex-1"
                  disabled={isAnimating}
                />
                <span className="text-lg font-bold text-emerald-400 w-12 text-center">
                  {numToGenerate}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>5</span>
                <span>100</span>
              </div>
            </div>

            <button
              onClick={isAnimating ? stopAutoGenerate : autoGenerate}
              className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded font-semibold transition-all ${
                isAnimating ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isAnimating ? <Square size={16} /> : <Play size={18} />}
              {isAnimating
                ? tr('Stop generating ({{done}}/{{total}})', { done: generatedCount, total: numToGenerate })
                : tr('Auto-Generate {{count}} TXs', { count: numToGenerate })}
            </button>

            <button
              onClick={reset}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-all"
            >
              <RefreshCw size={16} />
              {tr('Reset')}
            </button>
          </div>

          {/* Stats */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h2 className="text-lg font-semibold mb-3">{tr('Statistics')}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">{tr('Total Transactions')}:</span>
                <span className="font-semibold">{nodes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{tr('Confirmed')}:</span>
                <span className="font-semibold text-emerald-400">
                  {nodes.filter(n => isConfirmed(n.id)).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{tr('Pending')}:</span>
                <span className="font-semibold text-yellow-400">
                  {nodes.filter(n => !isConfirmed(n.id)).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{tr('Current Tips')}:</span>
                <span className="font-semibold text-blue-400">{tips.length}</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h2 className="text-lg font-semibold mb-3">{tr('Legend')}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-600 border-2 border-emerald-400"></div>
                <span>{tr('Confirmed')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-slate-700 border-2 border-slate-500"></div>
                <span>{tr('Unconfirmed')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-600 border-2 border-yellow-400"></div>
                <span>{tr('Selected Parent')}</span>
              </div>
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-blue-400" />
                <span>{tr('Tip')}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-400">
              <p>💡 {tr('Click node = View details')}</p>
              <p>💡 {tr('Shift+Click = Select parent')}</p>
            </div>
          </div>

          {/* Transaction Details Panel */}
          {selectedNode && (
            <div className="bg-slate-800 rounded-lg p-4 border-2 border-blue-600">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-blue-300">{tr('Transaction Details')}</h2>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-slate-400 hover:text-white text-xl"
                  aria-label={tr('Close')}
                  title={tr('Close')}
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="bg-slate-700 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400">{tr('Transaction ID')}</span>
                    <span className="font-bold text-xl" style={{ color: getValidatorColor(selectedNode.validator) }}>
                      {selectedNode.id}
                    </span>
                  </div>
                  <div className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    isConfirmed(selectedNode.id) ? 'bg-emerald-600' : 'bg-yellow-600'
                  }`}>
                    {isConfirmed(selectedNode.id) ? tr('✓ CONFIRMED') : tr('⏳ PENDING')}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">{tr('Type')}</div>
                    <div className="font-semibold">{txTypeLabel(selectedNode.type)}</div>
                  </div>
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">{tr('Amount')}</div>
                    <div className="font-semibold text-emerald-400">{selectedNode.amount}</div>
                  </div>
                </div>

                <div className="bg-slate-700 rounded p-2">
                  <div className="text-xs text-slate-400 mb-1">{tr('From → To')}</div>
                  <div className="font-semibold">
                    <span style={{ color: getValidatorColor(selectedNode.from) }}>{partyLabel(selectedNode.from)}</span>
                    <span className="mx-2">→</span>
                    <span style={{ color: getValidatorColor(selectedNode.to) }}>{partyLabel(selectedNode.to)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">{tr('Validator')}</div>
                    <div className="font-semibold" style={{ color: getValidatorColor(selectedNode.validator) }}>
                      {selectedNode.validator}
                    </div>
                  </div>
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">{tr('Fee')}</div>
                    <div className="font-semibold">{selectedNode.fee}</div>
                  </div>
                </div>

                <div className="bg-slate-700 rounded p-2">
                  <div className="text-xs text-slate-400 mb-1">{tr('Parent References')}</div>
                  <div className="flex gap-2">
                    {selectedNode.parents.length > 0 ? (
                      selectedNode.parents.map(parentId => {
                        const parent = nodes.find(n => n.id === parentId);
                        return (
                          <button
                            key={parentId}
                            onClick={() => setSelectedNodeId(parentId)}
                            className="px-2 py-1 rounded text-sm font-semibold hover:scale-105 transition-all"
                            style={{ 
                              backgroundColor: getValidatorColor(parent?.validator) + '40',
                              border: `2px solid ${getValidatorColor(parent?.validator)}`
                            }}
                          >
                            {parentId}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-slate-400 text-xs">{tr('Genesis (no parents)')}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">
  <T term="Weight" text={define('Weight')} />
</div>
                    <div className="font-semibold text-blue-400">{calculateWeight(selectedNode.id)}</div>
                  </div>
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">{tr('Nonce')}</div>
                    <div className="font-semibold">{selectedNode.nonce}</div>
                  </div>
                </div>

                <div className="bg-slate-700 rounded p-2">
                  <div className="text-xs text-slate-400">{tr('Timestamp')}</div>
                  <div className="font-mono text-xs">
                    {new Date(selectedNode.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - DAG Visualization */}
        <div className="lg:col-span-3">
          <div data-hint="dag-graph" className={`bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-auto ${q.pulse('dag-graph')}`}>
            <svg width="800" height={maxY + 150} style={{ minHeight: '600px' }}>
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#475569" />
                </marker>
                <marker
                  id="arrowhead-selected"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#fbbf24" />
                </marker>
              </defs>

              {/* Draw edges */}
              {nodes.map(node => 
                node.parents.map(parentId => {
                  const fromNode = nodes.find(n => n.id === parentId);
                  const toNode = node;
                  if (!fromNode) return null;

                  const isSelected = selectedParents.includes(parentId);
                  
                  return (
                    <line
                      key={`${parentId}-${node.id}`}
                      x1={fromNode.x}
                      y1={fromNode.y + 25}
                      x2={toNode.x}
                      y2={toNode.y - 25}
                      stroke={isSelected ? '#fbbf24' : '#475569'}
                      strokeWidth={isSelected ? 3 : 2}
                      markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                      opacity={0.6}
                    />
                  );
                })
              )}

              {/* Draw nodes */}
              {nodes.map(node => {
                const weight = calculateWeight(node.id);
                const confirmed = weight >= CONFIRMATION_THRESHOLD;
                const isSelected = selectedParents.includes(node.id);
                const isTip = tips.includes(node.id);
                const validatorColor = getValidatorColor(node.validator);

                return (
                  <g 
                    key={node.id}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => handleNodeClick(node.id, e)}
                  >
                    {/* Node circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={25}
                      fill={confirmed ? '#10b981' : '#1e293b'}
                      stroke={isSelected ? '#fbbf24' : (confirmed ? '#34d399' : '#475569')}
                      strokeWidth={isSelected ? 4 : 3}
                      className="transition-all"
                      style={{ 
                        filter: isSelected ? 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.5))' : 'none'
                      }}
                    />
                    
                    {/* Tip indicator */}
                    {isTip && (
                      <circle
                        cx={node.x + 20}
                        cy={node.y - 20}
                        r={8}
                        fill="#3b82f6"
                        stroke="#60a5fa"
                        strokeWidth={2}
                      />
                    )}
                    
                    {/* Confirmation checkmark or ID */}
                    <text
                      x={node.x}
                      y={node.y + 6}
                      textAnchor="middle"
                      fill="white"
                      fontSize={confirmed ? "20" : "16"}
                      fontWeight="bold"
                      style={{ pointerEvents: 'none' }}
                    >
                      {confirmed ? '✓' : node.id}
                    </text>
                    
                    {/* Validator name */}
                    <text
                      x={node.x}
                      y={node.y + 45}
                      textAnchor="middle"
                      fill={validatorColor}
                      fontSize="12"
                      fontWeight="600"
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.validator}
                    </text>
                    
                    {/* Weight */}
                    <text
                      x={node.x}
                      y={node.y - 35}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="11"
                      style={{ pointerEvents: 'none' }}
                    >
                      {tr('Weight: {{weight}}', { weight })}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Real-World Applications */}
      <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
        <h2 className="text-2xl font-bold mb-4 text-blue-300">🌐 {tr('Real-World Applications')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-3 text-emerald-400">{tr('Where DAGs Show Up')}</h3>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-700 rounded p-3">
                <div className="font-bold text-blue-300">IOTA (Tangle)</div>
                <p className="text-xs text-slate-300 mb-2">{tr('DAG-based ledger designed for IoT-style micro-transactions and high throughput without traditional blocks.')}</p>
                <LinkWithCopy
                  href="https://wiki.iota.org/"
                  label={<>{tr('IOTA docs →')}</>}
                  className="text-xs text-blue-300 hover:text-blue-200 underline"
                />
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="font-bold text-purple-300">{tr('Avalanche (DAG family)')}</div>
                <p className="text-xs text-slate-300 mb-2">{tr('Consensus inspired by repeated random sampling; includes DAG-like structures in parts of its design.')}</p>
                <LinkWithCopy
                  href="https://docs.avax.network/"
                  label={<>{tr('Avalanche docs →')}</>}
                  className="text-xs text-purple-300 hover:text-purple-200 underline"
                />
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="font-bold text-pink-300">{tr('Mempool / Block DAG research')}</div>
                <p className="text-xs text-slate-300 mb-2">{tr('Many projects explore DAGs for parallel transaction ordering and faster confirmations.')}</p>
                <LinkWithCopy
                  href="https://eprint.iacr.org/"
                  label={<>{tr('Cryptography ePrint (papers) →')}</>}
                  className="text-xs text-pink-300 hover:text-pink-200 underline"
                />
              </div>
            </div>
          </div>
          <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-3 text-yellow-400">{tr('Production Use Cases')}</h3>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-700 rounded p-3">
                <div className="font-semibold text-blue-300 mb-1">⚡ {tr('High-Throughput Payments')}</div>
                <p className="text-xs text-slate-300">{tr('When many users create transactions simultaneously, DAGs can confirm in parallel instead of queuing behind a single block leader.')}</p>
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="font-semibold text-purple-300 mb-1">🤖 {tr('IoT & Micro-Transactions')}</div>
                <p className="text-xs text-slate-300">{tr('Device-to-device payments or data exchange benefit from low fees and parallel confirmations.')}</p>
              </div>
              <div className="bg-slate-700 rounded p-3">
                <div className="font-semibold text-emerald-300 mb-1">📈 {tr('Data & Event Ordering')}</div>
                <p className="text-xs text-slate-300">{tr('DAG-style structures also appear in distributed systems for causal ordering and conflict resolution.')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Further Reading */}
      <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-2xl font-bold mb-4 text-blue-300">📚 {tr('Further Reading')}</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <LinkWithCopy
              href="https://wiki.iota.org/"
              label={<>{tr('IOTA documentation →')}</>}
              className="text-blue-300 hover:text-blue-200 underline"
            />
          </li>
          <li>
            <LinkWithCopy
              href="https://docs.avax.network/"
              label={<>{tr('Avalanche documentation →')}</>}
              className="text-blue-300 hover:text-blue-200 underline"
            />
          </li>
          <li>
            <LinkWithCopy
              href="https://eprint.iacr.org/"
              label={<>{tr('IACR ePrint (research papers) →')}</>}
              className="text-blue-300 hover:text-blue-200 underline"
            />
          </li>
        </ul>
      </div>

      {/* Bottom Info */}
      <div className="mt-6 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-300">{tr('How DAG Consensus Works')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-300">
          <div>
            <div className="font-semibold text-blue-400 mb-1">{tr('1. Reference Parents')}</div>
            <p>{tr('Each transaction references 1-2 previous transactions (usually tips). This creates a web structure instead of a single chain.')}</p>
          </div>
          <div>
            <div className="font-semibold text-blue-400 mb-1">{tr('2. Cumulative Weight')}</div>
            <p>{tr('Weight increases as more transactions reference it (directly or indirectly). Higher weight = more consensus.')}</p>
          </div>
          <div>
            <div className="font-semibold text-blue-400 mb-1">{tr('3. Confirmation')}</div>
            <p>{tr('Once a transaction reaches a cumulative weight of 3 (itself plus at least 2 transactions approving it directly or indirectly), it is considered confirmed.')}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          💡 {tr('Try: Click tips to select parents, then add your transaction. Watch weight propagate and confirmations happen!')}
        </p>
      </div>
    </div>
  );
};

export default DAGConsensus;