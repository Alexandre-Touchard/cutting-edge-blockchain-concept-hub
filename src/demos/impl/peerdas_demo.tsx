import React, { useState, useEffect } from 'react';
import { Download, Upload, CheckCircle, XCircle, AlertCircle, Users, Database, Zap, Shield } from 'lucide-react';
import EduTooltip from '../../ui/EduTooltip';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';

// Backwards-compatible alias so we don't have to rewrite all usages.
const Tooltip = EduTooltip;

const PeerDASDemo = () => {
  const { tr } = useDemoI18n('peerdas-demo');
  // Network configuration
  const [nodes, setNodes] = useState([]);
  const [numNodes, setNumNodes] = useState(20);
  const [numColumns, setNumColumns] = useState(64);
  const [columnsPerNode, setColumnsPerNode] = useState(16);
  const [samplingTarget, setSamplingTarget] = useState(16);
  
  // Blob data
  const [blobData, setBlobData] = useState(null);
  const [blobSubmitted, setBlobSubmitted] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSampling, setIsSampling] = useState(false);
  
  // Sampling state
  const [samplingResults, setSamplingResults] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [availabilityConfirmed, setAvailabilityConfirmed] = useState(false);
  
  const [events, setEvents] = useState([]);

  // Initialize network
  useEffect(() => {
    initializeNetwork();
  }, [numNodes, numColumns, columnsPerNode]);

  const addEvent = (message, type = 'info') => {
    setEvents(prev => [{
      id: Date.now() + Math.random(),
      message,
      type,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 12));
  };

  const initializeNetwork = () => {
    const newNodes = [];
    for (let i = 0; i < numNodes; i++) {
      // Each node is assigned a subset of columns to custody
      const assignedColumns = [];
      for (let j = 0; j < columnsPerNode; j++) {
        const columnIndex = (i * columnsPerNode + j) % numColumns;
        assignedColumns.push(columnIndex);
      }
      
      newNodes.push({
        id: i,
        name: `Node ${i}`,
        assignedColumns,
        hasData: {},
        sampledColumns: [],
        samplingSuccess: null
      });
    }
    setNodes(newNodes);
    setBlobSubmitted(false);
    setAvailabilityConfirmed(false);
    setSamplingResults([]);
  };

  const createBlob = () => {
    // Simulate blob data being split into columns
    const blob = {
      id: `blob_${Date.now()}`,
      size: 128, // KB
      columns: Array(numColumns).fill(null).map((_, i) => ({
        index: i,
        data: `col_${i}_data`,
        custody: []
      }))
    };
    
    setBlobData(blob);
    addEvent(tr('Blob created: {{columns}} columns, {{size}}KB', { columns: numColumns, size: blob.size }), 'success');
  };

  const publishBlob = async () => {
    if (!blobData) return;
    
    setIsPublishing(true);
    addEvent(tr('Publishing blob to network...'), 'info');
    
    // Simulate column distribution
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const updatedNodes = nodes.map(node => {
      const nodeData = {};
      node.assignedColumns.forEach(colIndex => {
        nodeData[colIndex] = true;
        blobData.columns[colIndex].custody.push(node.id);
      });
      
      return {
        ...node,
        hasData: nodeData
      };
    });
    
    setNodes(updatedNodes);
    setBlobSubmitted(true);
    setIsPublishing(false);
    
    const totalCustodians = blobData.columns.reduce((sum, col) => sum + col.custody.length, 0);
    addEvent(
      tr('Blob published! {{assignments}} column assignments across {{nodes}} nodes', {
        assignments: totalCustodians,
        nodes: numNodes
      }),
      'success'
    );
  };

  const performSampling = async () => {
    if (!blobSubmitted) return;
    
    setIsSampling(true);
    setAvailabilityConfirmed(false);
    setSamplingResults([]);
    addEvent(tr('Starting random sampling...'), 'info');
    
    // Each node samples random columns
    const results = [];
    
    for (let i = 0; i < nodes.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const node = nodes[i];
      const sampledColumns = [];
      const alreadySampled = new Set();
      
      // Sample random columns (avoid duplicates)
      while (sampledColumns.length < samplingTarget) {
        const randomCol = Math.floor(Math.random() * numColumns);
        if (!alreadySampled.has(randomCol)) {
          alreadySampled.add(randomCol);
          
          // Find a node that has this column
          const custodians = blobData.columns[randomCol].custody;
          const success = custodians.length > 0;
          const provider = success ? custodians[Math.floor(Math.random() * custodians.length)] : null;
          
          sampledColumns.push({
            columnIndex: randomCol,
            success,
            provider
          });
        }
      }
      
      const successRate = sampledColumns.filter(s => s.success).length / sampledColumns.length;
      
      results.push({
        nodeId: node.id,
        sampledColumns,
        successRate,
        allSuccess: successRate === 1.0
      });
      
      // Update node state
      setNodes(prev => prev.map(n => 
        n.id === node.id ? { ...n, sampledColumns, samplingSuccess: successRate === 1.0 } : n
      ));
      
      addEvent(
        tr('Node {{id}} sampled {{count}} columns - {{pct}}% success', {
          id: node.id,
          count: samplingTarget,
          pct: (successRate * 100).toFixed(0)
        }),
        successRate === 1.0 ? 'success' : 'error'
      );
    }
    
    setSamplingResults(results);
    setIsSampling(false);
    
    // Check if data is available (all nodes succeeded)
    const allNodesSucceeded = results.every(r => r.allSuccess);
    setAvailabilityConfirmed(allNodesSucceeded);
    
    if (allNodesSucceeded) {
      addEvent(tr('✓ Data availability CONFIRMED - All nodes successfully sampled'), 'success');
    } else {
      const failedNodes = results.filter(r => !r.allSuccess).length;
      addEvent(
        tr('⚠ Data availability UNCERTAIN - {{count}} nodes had sampling failures', { count: failedNodes }),
        'error'
      );
    }
  };

  const getNodeColor = (node) => {
    if (!blobSubmitted) return 'bg-slate-700';
    if (node.samplingSuccess === true) return 'bg-emerald-700';
    if (node.samplingSuccess === false) return 'bg-red-700';
    return 'bg-blue-700';
  };

  const getNodeBorderColor = (node) => {
    if (selectedNode === node.id) return 'border-yellow-500';
    if (!blobSubmitted) return 'border-slate-600';
    if (node.samplingSuccess === true) return 'border-emerald-500';
    if (node.samplingSuccess === false) return 'border-red-500';
    return 'border-blue-500';
  };

  const getCoverageStats = () => {
    if (!blobData) return { min: 0, max: 0, avg: 0 };
    
    const custodyCounts = blobData.columns.map(col => col.custody.length);
    return {
      min: Math.min(...custodyCounts),
      max: Math.max(...custodyCounts),
      avg: (custodyCounts.reduce((a, b) => a + b, 0) / custodyCounts.length).toFixed(1)
    };
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'success': return 'border-l-emerald-500 bg-emerald-900 bg-opacity-20';
      case 'error': return 'border-l-red-500 bg-red-900 bg-opacity-20';
      default: return 'border-l-blue-500 bg-blue-900 bg-opacity-20';
    }
  };

  const coverage = getCoverageStats();
  const samplingSuccessRate = samplingResults.length > 0 
    ? (samplingResults.filter(r => r.allSuccess).length / samplingResults.length * 100).toFixed(0)
    : 0;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{tr('PeerDAS: Peer Data Availability Sampling')}</h1>
          <p className="text-slate-300">
            {tr("Ethereum's scalable data availability layer - nodes sample random columns instead of downloading everything")}
          </p>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-blue-400" />
              <span className="text-sm text-slate-400">
                {tr('Network Nodes')}
                <Tooltip text={define('Network Nodes')} />
              </span>
            </div>
            <div className="text-2xl font-bold">{numNodes}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Database size={20} className="text-purple-400" />
              <span className="text-sm text-slate-400">
                {tr('Columns/Node')}
                <Tooltip text={define('Columns/Node')} />
              </span>
            </div>
            <div className="text-2xl font-bold">{columnsPerNode}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={20} className="text-yellow-400" />
              <span className="text-sm text-slate-400">
                {tr('Samples/Node')}
                <Tooltip text={define('Samples/Node')} />
              </span>
            </div>
            <div className="text-2xl font-bold">{samplingTarget}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={20} className="text-emerald-400" />
              <span className="text-sm text-slate-400">
                {tr('Coverage')}
                <Tooltip text={define('Coverage')} />
              </span>
            </div>
            <div className="text-lg font-bold">{coverage.avg}x avg</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              {availabilityConfirmed ? (
                <CheckCircle size={20} className="text-emerald-400" />
              ) : (
                <AlertCircle size={20} className="text-yellow-400" />
              )}
              <span className="text-sm text-slate-400">
                {tr('Availability')}
                <Tooltip text={define('Availability')} />
              </span>
            </div>
            <div className="text-lg font-bold">
              {availabilityConfirmed
                  ? tr('✓ Confirmed')
                  : samplingResults.length > 0
                    ? `${samplingSuccessRate}%`
                    : tr('N/A')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            {/* Network Config */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">{tr('Network Configuration')}</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    {tr('Number of Nodes')}: {numNodes}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={numNodes}
                    onChange={(e) => setNumNodes(parseInt(e.target.value))}
                    disabled={blobSubmitted}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    {tr('Columns Per Node')}: {columnsPerNode}
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="32"
                    value={columnsPerNode}
                    onChange={(e) => setColumnsPerNode(parseInt(e.target.value))}
                    disabled={blobSubmitted}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    {tr('Samples Per Node')}: {samplingTarget}
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="32"
                    value={samplingTarget}
                    onChange={(e) => setSamplingTarget(parseInt(e.target.value))}
                    disabled={isSampling}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Blob Actions */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">{tr('Blob Operations')}</h2>
              
              <div className="space-y-3">
                <button
                  onClick={createBlob}
                  disabled={blobData && !blobSubmitted}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded font-semibold flex items-center justify-center gap-2"
                >
                  <Database size={18} />
                  {tr('Create Blob ({{count}} columns)', { count: numColumns })}
                </button>

                <button
                  onClick={publishBlob}
                  disabled={!blobData || blobSubmitted || isPublishing}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  {isPublishing ? tr('Publishing...') : tr('Publish to Network')}
                </button>

                <button
                  onClick={performSampling}
                  disabled={!blobSubmitted || isSampling}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold flex items-center justify-center gap-2"
                >
                  <Zap size={18} />
                  {isSampling ? tr('Sampling...') : tr('Start Sampling')}
                </button>

                <button
                  onClick={initializeNetwork}
                  className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-semibold"
                >
                  {tr('Reset Network')}
                </button>
              </div>

              {blobData && (
                <div className="mt-4 p-3 bg-slate-700 rounded text-sm">
                  <div className="font-semibold mb-2">{tr('Blob Info')}:</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{tr('Total Columns')}:</span>
                      <span className="font-semibold">{numColumns}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{tr('Size')}:</span>
                      <span className="font-semibold">{blobData.size} KB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{tr('Redundancy')}:</span>
                      <span className="font-semibold">{coverage.avg}x</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Event Log */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">{tr('Event Log')}</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {events.length === 0 ? (
                  <div className="text-center text-slate-400 py-4 text-sm">
                    {tr('No events yet')}
                  </div>
                ) : (
                  events.map(event => (
                    <div key={event.id} className={`p-2 rounded border-l-4 ${getEventColor(event.type)}`}>
                      <div className="text-xs">{event.message}</div>
                      <div className="text-xs text-slate-500 mt-1">{event.time}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Middle Column - Node Network */}
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">{tr('Network Nodes')}</h2>
              
              <div className="grid grid-cols-4 gap-2 max-h-[700px] overflow-y-auto">
                {nodes.map(node => (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                    className={`${getNodeColor(node)} ${getNodeBorderColor(node)} border-2 rounded-lg p-2 cursor-pointer transition-all hover:scale-105`}
                  >
                    <div className="text-xs font-semibold text-center">{node.id}</div>
                    {node.samplingSuccess !== null && (
                      <div className="text-center mt-1">
                        {node.samplingSuccess ? (
                          <CheckCircle size={14} className="inline text-emerald-300" />
                        ) : (
                          <XCircle size={14} className="inline text-red-300" />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-slate-700 border-2 border-slate-600 rounded"></div>
                  <span>{tr('Not sampled yet')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-700 border-2 border-blue-500 rounded"></div>
                  <span>{tr('Has blob data')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-emerald-700 border-2 border-emerald-500 rounded"></div>
                  <span>{tr('Sampling success')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-700 border-2 border-red-500 rounded"></div>
                  <span>{tr('Sampling failed')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Node Details */}
          <div className="space-y-6">
            {selectedNode !== null ? (
              <div className="bg-slate-800 rounded-lg p-4 border-2 border-yellow-500">
                <h2 className="text-xl font-semibold mb-4">{tr('Node {{id}} Details', { id: selectedNode })}</h2>
                
                {(() => {
                  const node = nodes.find(n => n.id === selectedNode);
                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm text-slate-400 mb-2">{tr('Custodied Columns ({{count}})', { count: node.assignedColumns.length })}:</div>
                        <div className="flex flex-wrap gap-1">
                          {node.assignedColumns.map(col => (
                            <div key={col} className="px-2 py-1 bg-blue-900 text-blue-300 rounded text-xs font-mono">
                              {col}
                            </div>
                          ))}
                        </div>
                      </div>

                      {node.sampledColumns.length > 0 && (
                        <div>
                          <div className="text-sm text-slate-400 mb-2">
                            {tr('Sampled Columns ({{count}})', { count: node.sampledColumns.length })}:
                          </div>
                          <div className="space-y-1 max-h-96 overflow-y-auto">
                            {node.sampledColumns.map((sample, idx) => (
                              <div
                                key={idx}
                                className={`p-2 rounded flex items-center justify-between text-xs ${
                                  sample.success ? 'bg-emerald-900 bg-opacity-30' : 'bg-red-900 bg-opacity-30'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {sample.success ? (
                                    <CheckCircle size={14} className="text-emerald-400" />
                                  ) : (
                                    <XCircle size={14} className="text-red-400" />
                                  )}
                                  <span className="font-mono">{tr('Column {{index}}', { index: sample.columnIndex })}</span>
                                </div>
                                {sample.success && (
                                  <span className="text-slate-400">
                                    {tr('from Node {{id}}', { id: sample.provider })}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
              {/* Real-World Applications */}
              <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
                <h2 className="text-2xl font-bold mb-4 text-blue-300">🌐 {tr('Real-World Applications')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-emerald-400">{tr('Where Data Sampling Matters')}</h3>
                    <div className="space-y-3 text-sm">
                      <div className="bg-slate-700 rounded p-3">
                        <div className="font-bold text-blue-300">{tr('Ethereum Danksharding (Roadmap)')}</div>
                        <p className="text-xs text-slate-300 mb-2">{tr('PeerDAS-style sampling helps clients verify that blob data is available without downloading everything.')}</p>
                        <a href="https://ethereum.org/en/roadmap/danksharding/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 hover:text-blue-200 underline">{tr('Ethereum roadmap →')}</a>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <div className="font-bold text-purple-300">{tr('Rollup Data Availability')}</div>
                        <p className="text-xs text-slate-300">{tr('Rollups depend on DA to let anyone reconstruct state. Sampling makes DA scalable to many validators/nodes.')}</p>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <div className="font-bold text-pink-300">{tr('Light Clients')}</div>
                        <p className="text-xs text-slate-300">{tr('Light nodes can participate in DA checks, increasing decentralization while keeping bandwidth low.')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800 bg-opacity-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-yellow-400">{tr('Production Use Cases')}</h3>
                    <div className="space-y-3 text-sm">
                      <div className="bg-slate-700 rounded p-3">
                        <div className="font-semibold text-blue-300 mb-1">📦 {tr('Large Batch Posting')}</div>
                        <p className="text-xs text-slate-300">{tr('More blob capacity means rollups can post more transactions, reducing fees for end users.')}</p>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <div className="font-semibold text-purple-300 mb-1">🌍 {tr('Decentralized Verification')}</div>
                        <p className="text-xs text-slate-300">{tr('Sampling lets many nodes independently verify availability, reducing reliance on a small set of powerful nodes.')}</p>
                      </div>
                      <div className="bg-slate-700 rounded p-3">
                        <div className="font-semibold text-emerald-300 mb-1">🧱 {tr('Fault Tolerance')}</div>
                        <p className="text-xs text-slate-300">{tr('Redundant column distribution means the network can tolerate node outages while still recovering the full blob.')}</p>
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
                    <a
                      className="text-blue-300 hover:text-blue-200 underline"
                      href="https://ethereum.org/en/roadmap/danksharding/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {tr('Ethereum roadmap: Danksharding →')}
                    </a>
                  </li>
                  <li>
                    <a
                      className="text-blue-300 hover:text-blue-200 underline"
                      href="https://notes.ethereum.org/@vbuterin/proto_danksharding_faq"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {tr('Vitalik: Proto-danksharding FAQ →')}
                    </a>
                  </li>
                  <li>
                    <a
                      className="text-blue-300 hover:text-blue-200 underline"
                      href="https://eips.ethereum.org/EIPS/eip-4844"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {tr('EIP-4844 (proto-danksharding) →')}
                    </a>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h2 className="text-xl font-semibold mb-4">{tr('How PeerDAS Works')}</h2>
                
                <div className="space-y-4 text-sm text-slate-300">
                  <div>
                    <div className="font-semibold text-blue-400 mb-2">{tr('1. Data Sharding')}</div>
                    <p className="text-xs">
                      {tr('Blob data is split into {{numColumns}} columns. Each node only stores a subset ({{columnsPerNode}} columns) instead of the entire blob.', { numColumns, columnsPerNode })}
                    </p>
                  </div>

                  <div>
                    <div className="font-semibold text-blue-400 mb-2">{tr('2. Random Distribution')}</div>
                    <p className="text-xs">
                      {tr('Columns are distributed across the network with redundancy (average {{coverage}}x coverage). Multiple nodes hold each column for reliability.', { coverage: coverage.avg })}
                    </p>
                  </div>

                  <div>
                    <div className="font-semibold text-blue-400 mb-2">{tr('3. Sampling')}</div>
                    <p className="text-xs">
                      {tr('Instead of downloading everything, nodes sample {{samplingTarget}} random columns. If all samples succeed, data is statistically available.', { samplingTarget })}
                    </p>
                  </div>

                  <div>
                    <div className="font-semibold text-blue-400 mb-2">{tr('4. Availability Proof')}</div>
                    <p className="text-xs">
                      {tr("With {{samplingTarget}} samples from {{numColumns}} columns, there's >99.9% confidence the entire blob is retrievable if all nodes succeed.", { samplingTarget, numColumns })}
                    </p>
                  </div>

                  <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded p-3">
                    <div className="text-xs font-semibold text-blue-300 mb-1">{tr('Key Benefits')}:</div>
                    <ul className="text-xs space-y-1 text-slate-300">
                      <li>
                        {tr('• Nodes store only {{pct}}% of data', {
                          pct: ((columnsPerNode / numColumns) * 100).toFixed(0)
                        })}
                      </li>
                      <li>
                        {tr('• Network bandwidth reduced {{factor}}x vs full download', {
                          factor: Math.floor(numColumns / samplingTarget)
                        })}
                      </li>
                      <li>{tr('• Scales to hundreds of nodes efficiently')}</li>
                      <li>{tr('• Maintains strong availability guarantees')}</li>
                    </ul>
                  </div>
                </div>
              </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeerDASDemo;