import React, { useState, useEffect } from 'react';
import { Download, Upload, CheckCircle, XCircle, AlertCircle, Users, Database, Zap, Shield } from 'lucide-react';
import EduTooltip from '../../ui/EduTooltip';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
import { useDemoQuests, QuestList, NextQuestCard } from '../quests/DemoQuests';
import { assignCustody, columnCustodians, coverageStats, detectionProbability, pickWithheldColumns, runSampling } from './peerdas/sampling';

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
  // Columns the block producer refuses to send out (simulated data-withholding attack).
  const [withheldCount, setWithheldCount] = useState(0);

  // Blob data: { id, size } once created, plus { custodians, withheld } once published.
  const [blobData, setBlobData] = useState(null);
  const [blobSubmitted, setBlobSubmitted] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSampling, setIsSampling] = useState(false);

  // Sampling state
  const [samplingResults, setSamplingResults] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [availabilityConfirmed, setAvailabilityConfirmed] = useState(false);

  const [events, setEvents] = useState([]);

  const withheldColumns: number[] = blobData?.withheld ?? [];
  const samplingDone = samplingResults.length > 0 && !isSampling;

  // Learning quests
  const inspectedNode = selectedNode !== null ? nodes.find(n => n.id === selectedNode) : undefined;
  const lastSamplesPerNode = samplingResults.length > 0 ? samplingResults[0].sampledColumns.length : 0;
  const blobStepTarget = blobSubmitted ? 'sample' : blobData ? 'publish' : 'create-blob';
  const q = useDemoQuests('peerdas-demo', [
    {
      id: 'publish',
      text: tr('Create a blob and publish it'),
      tip: tr('Click Create Blob, then Publish to Network: each node takes custody of its own share of the columns.'),
      done: blobSubmitted,
      target: blobData ? 'publish' : 'create-blob'
    },
    {
      id: 'sample',
      text: tr('Confirm availability by sampling'),
      tip: tr('Click Start Sampling: every node fetches random columns from its peers; when all succeed, Availability shows ✓ Confirmed.'),
      done: availabilityConfirmed,
      target: 'sample'
    },
    {
      id: 'inspect-node',
      text: tr('Inspect a node after sampling'),
      tip: tr('Click a node under Network Nodes: it lists the columns it stores and, for each sampled column, the peer that served it.'),
      done: !!inspectedNode && inspectedNode.sampledColumns.length > 0,
      target: 'node-grid'
    },
    {
      id: 'more-samples',
      text: tr('Confirm availability with 24+ samples per node'),
      tip: tr('Drag Samples Per Node to 24 or more, then click Start Sampling again: more random checks per node give more confidence, at the cost of more bandwidth.'),
      done: availabilityConfirmed && lastSamplesPerNode >= 24,
      target: samplingTarget >= 24 ? 'sample' : 'samples-slider'
    },
    {
      id: 'lean-custody',
      text: tr('Confirm availability with 8 columns per node'),
      tip: tr('Click Reset Network, drag Columns Per Node to 8, then Create Blob, Publish to Network and Start Sampling: each node stores only 1/8 of the blob, yet availability is still confirmed.'),
      done: availabilityConfirmed && columnsPerNode === 8,
      target: columnsPerNode !== 8 ? (blobSubmitted ? 'reset-network' : 'columns-slider') : blobStepTarget
    },
    {
      id: 'detect-withholding',
      text: tr('Make sampling detect missing data'),
      tip: tr('Click Reset Network, drag Withheld Columns above 0, then Create Blob, Publish to Network and Start Sampling: nodes that sample a withheld column get no answer, so availability is not confirmed.'),
      done: samplingDone && withheldColumns.length > 0 && !availabilityConfirmed,
      target:
        withheldColumns.length > 0 ? 'sample' : blobSubmitted ? 'reset-network' : withheldCount === 0 ? 'withheld-slider' : blobStepTarget
    }
  ]);

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

  /** Fresh nodes for the current configuration (nothing published, nothing sampled). */
  const initializeNetwork = () => {
    const custody = assignCustody(numNodes, numColumns, columnsPerNode);
    setNodes(custody.map((assignedColumns, i) => ({
      id: i,
      name: `Node ${i}`,
      assignedColumns,
      hasData: {},
      sampledColumns: [],
      samplingSuccess: null
    })));
    setBlobSubmitted(false);
    setAvailabilityConfirmed(false);
    setSamplingResults([]);
    setSelectedNode(prev => (prev !== null && prev < numNodes ? prev : null));
  };

  /** Reset Network: fresh nodes AND no blob, so the next run starts from a clean state. */
  const resetNetwork = () => {
    initializeNetwork();
    setBlobData(null);
  };

  const createBlob = () => {
    // Simulate blob data being split into columns
    const blob = {
      id: `blob_${Date.now()}`,
      size: 128 // KB
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

    // Custody is computed from scratch on every publish (never accumulated across runs).
    const withheld = pickWithheldColumns(numColumns, withheldCount);
    const hidden = new Set(withheld);
    const custodians = columnCustodians(nodes.map(n => n.assignedColumns), numColumns, withheld);
    const updatedNodes = nodes.map(node => {
      const nodeData = {};
      node.assignedColumns.forEach(colIndex => {
        if (!hidden.has(colIndex)) nodeData[colIndex] = true;
      });

      return {
        ...node,
        hasData: nodeData,
        sampledColumns: [],
        samplingSuccess: null
      };
    });

    setBlobData({ ...blobData, custodians, withheld });
    setNodes(updatedNodes);
    setBlobSubmitted(true);
    setIsPublishing(false);

    const totalCustodians = custodians.reduce((sum, col) => sum + col.length, 0);
    addEvent(
      tr('Blob published! {{assignments}} column assignments across {{nodes}} nodes', {
        assignments: totalCustodians,
        nodes: numNodes
      }),
      'success'
    );
    if (withheld.length > 0) {
      addEvent(
        tr('Block producer withheld {{count}} columns: no node received them', { count: withheld.length }),
        'error'
      );
    }
  };

  const performSampling = async () => {
    if (!blobSubmitted || !blobData?.custodians) return;

    setIsSampling(true);
    setAvailabilityConfirmed(false);
    setSamplingResults([]);
    addEvent(tr('Starting random sampling...'), 'info');

    // Each node samples random columns; a sample fails when no peer holds that column.
    const round = runSampling(blobData.custodians, nodes.length, samplingTarget);

    for (const result of round.results) {
      await new Promise(resolve => setTimeout(resolve, 150));

      // Update node state
      setNodes(prev => prev.map(n =>
        n.id === result.nodeId ? { ...n, sampledColumns: result.sampledColumns, samplingSuccess: result.allSuccess } : n
      ));

      addEvent(
        tr('Node {{id}} sampled {{count}} columns - {{pct}}% success', {
          id: result.nodeId,
          count: result.sampledColumns.length,
          pct: (result.successRate * 100).toFixed(0)
        }),
        result.allSuccess ? 'success' : 'error'
      );
    }

    setSamplingResults(round.results);
    setIsSampling(false);

    // Data is available only if every node got every sample it asked for
    setAvailabilityConfirmed(round.available);

    if (round.available) {
      addEvent(tr('✓ Data availability CONFIRMED - All nodes successfully sampled'), 'success');
    } else {
      addEvent(
        tr('⚠ Data availability UNCERTAIN - {{count}} nodes had sampling failures', { count: round.failedNodes }),
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
    if (!blobData?.custodians) return { min: 0, max: 0, avg: '0' };
    const stats = coverageStats(blobData.custodians);
    return { ...stats, avg: stats.avg.toFixed(1) };
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
  const failedNodeCount = samplingResults.filter(r => !r.allSuccess).length;
  // Withheld columns that apply to the published blob (or to the next publish)
  const effectiveWithheld = blobSubmitted ? withheldColumns.length : withheldCount;
  const detectPct = (detectionProbability(numColumns, effectiveWithheld, samplingTarget) * 100).toFixed(1);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{tr('PeerDAS: Peer Data Availability Sampling')}</h1>
          <p className="text-slate-300">
            {tr('Ethereum\'s scalable data availability layer - nodes sample random columns instead of downloading everything')}
          </p>
          <NextQuestCard q={q} className="mt-4" />
          <QuestList q={q} />
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
            <div className="text-lg font-bold">{tr('{{avg}}x avg', { avg: coverage.avg })}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              {availabilityConfirmed ? (
                <CheckCircle size={20} className="text-emerald-400" />
              ) : samplingDone ? (
                <XCircle size={20} className="text-red-400" />
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
                  : samplingDone
                    ? <span className="text-red-400">{tr('✗ Not confirmed')}</span>
                    : tr('N/A')}
            </div>
            {samplingDone && !availabilityConfirmed && (
              <div className="text-xs text-slate-400 mt-1">
                {tr('{{pct}}% of nodes passed', { pct: samplingSuccessRate })}
              </div>
            )}
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
                    disabled={blobSubmitted || isPublishing}
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
                    disabled={blobSubmitted || isPublishing}
                    data-hint="columns-slider"
                    className={`w-full ${q.pulse('columns-slider')}`}
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
                    data-hint="samples-slider"
                    className={`w-full ${q.pulse('samples-slider')}`}
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    {tr('Withheld Columns')}: {blobSubmitted ? withheldColumns.length : withheldCount}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={numColumns}
                    value={blobSubmitted ? withheldColumns.length : withheldCount}
                    onChange={(e) => setWithheldCount(parseInt(e.target.value))}
                    disabled={blobSubmitted || isPublishing}
                    data-hint="withheld-slider"
                    className={`w-full ${q.pulse('withheld-slider')}`}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {tr('Columns a dishonest block producer never sends out, so no node can serve them.')}
                  </p>
                  {effectiveWithheld > 0 && (
                    <p className="text-xs text-red-300 mt-1">
                      {tr('Chance that one node catches it with {{samples}} samples: {{pct}}%', {
                        samples: samplingTarget,
                        pct: detectPct
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Blob Actions */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">{tr('Blob Operations')}</h2>
              
              <div className="space-y-3">
                <button
                  onClick={createBlob}
                  disabled={!!blobData}
                  data-hint="create-blob"
                  className={`w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded font-semibold flex items-center justify-center gap-2 ${q.pulse('create-blob')}`}
                >
                  <Database size={18} />
                  {tr('Create Blob ({{count}} columns)', { count: numColumns })}
                </button>

                <button
                  onClick={publishBlob}
                  disabled={!blobData || blobSubmitted || isPublishing}
                  data-hint="publish"
                  className={`w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold flex items-center justify-center gap-2 ${q.pulse('publish')}`}
                >
                  <Upload size={18} />
                  {isPublishing ? tr('Publishing...') : tr('Publish to Network')}
                </button>

                <button
                  onClick={performSampling}
                  disabled={!blobSubmitted || isSampling}
                  data-hint="sample"
                  className={`w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold flex items-center justify-center gap-2 ${q.pulse('sample')}`}
                >
                  <Zap size={18} />
                  {isSampling ? tr('Sampling...') : tr('Start Sampling')}
                </button>

                <button
                  onClick={resetNetwork}
                  disabled={isPublishing || isSampling}
                  data-hint="reset-network"
                  className={`w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded font-semibold ${q.pulse('reset-network')}`}
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
                    {blobSubmitted && withheldColumns.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">{tr('Withheld Columns')}:</span>
                        <span className="font-semibold text-red-300">{withheldColumns.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {samplingDone && withheldColumns.length > 0 && (
                <div
                  className={`mt-4 p-3 rounded text-xs border ${
                    availabilityConfirmed ? 'bg-yellow-900 bg-opacity-20 border-yellow-700' : 'bg-red-900 bg-opacity-30 border-red-700'
                  }`}
                >
                  {availabilityConfirmed ? (
                    <p className="text-yellow-200">
                      {tr('This time no node happened to sample one of the {{count}} withheld columns: sampling is probabilistic. Withhold more columns or raise Samples Per Node and try again.', { count: withheldColumns.length })}
                    </p>
                  ) : (
                    <>
                      <div className="font-semibold text-red-300 mb-1">{tr('Withholding detected')}</div>
                      <p className="text-slate-200 mb-2">
                        {tr('{{failed}} of {{total}} nodes asked for a withheld column and no peer could serve it, so availability is NOT confirmed. This is exactly what sampling is for: a block producer that hides part of the data gets caught by random checks, without anyone downloading the whole blob.', { failed: failedNodeCount, total: samplingResults.length })}
                      </p>
                      <p className="text-slate-400">
                        {tr('In real PeerDAS, erasure coding lets the network rebuild a blob from any half of its columns, so an attacker must hide more than half of them; random samples then hit a missing column almost every time.')}
                      </p>
                    </>
                  )}
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
              
              <div data-hint="node-grid" className={`grid grid-cols-4 gap-2 max-h-[700px] overflow-y-auto rounded-lg ${q.pulse('node-grid')}`}>
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
            {inspectedNode ? (
              <div className="bg-slate-800 rounded-lg p-4 border-2 border-yellow-500">
                <h2 className="text-xl font-semibold mb-4">{tr('Node {{id}} Details', { id: inspectedNode.id })}</h2>

                {(() => {
                  const node = inspectedNode;
                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm text-slate-400 mb-2">{tr('Custodied Columns ({{count}})', { count: node.assignedColumns.length })}:</div>
                        <div className="flex flex-wrap gap-1">
                          {node.assignedColumns.map(col => {
                            const missing = blobSubmitted && withheldColumns.includes(col);
                            return (
                              <div
                                key={col}
                                title={missing ? tr('Withheld: this node never received it') : undefined}
                                className={`px-2 py-1 rounded text-xs font-mono ${
                                  missing ? 'bg-red-900 text-red-300 line-through' : 'bg-blue-900 text-blue-300'
                                }`}
                              >
                                {col}
                              </div>
                            );
                          })}
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
                                {sample.success ? (
                                  <span className="text-slate-400">
                                    {tr('from Node {{id}}', { id: sample.provider })}
                                  </span>
                                ) : (
                                  <span className="text-red-300">{tr('no peer has it')}</span>
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
                      {tr('With {{samplingTarget}} samples from {{numColumns}} columns, there\'s >99.9% confidence the entire blob is retrievable if all nodes succeed.', { samplingTarget, numColumns })}
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

          {/* Real-World Applications (full width) */}
          <div className="lg:col-span-3 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
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
                <a className="text-blue-300 hover:text-blue-200 underline" href="https://ethereum.org/en/roadmap/danksharding/" target="_blank" rel="noopener noreferrer">
                  {tr('Ethereum roadmap: Danksharding →')}
                </a>
              </li>
              <li>
                <a className="text-blue-300 hover:text-blue-200 underline" href="https://notes.ethereum.org/@vbuterin/proto_danksharding_faq" target="_blank" rel="noopener noreferrer">
                  {tr('Vitalik: Proto-danksharding FAQ →')}
                </a>
              </li>
              <li>
                <a className="text-blue-300 hover:text-blue-200 underline" href="https://eips.ethereum.org/EIPS/eip-4844" target="_blank" rel="noopener noreferrer">
                  {tr('EIP-4844 (proto-danksharding) →')}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeerDASDemo;