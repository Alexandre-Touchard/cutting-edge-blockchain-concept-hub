import React, { useState } from 'react';
import EduTooltip from '../../ui/EduTooltip';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';
const T = EduTooltip;
import { Send, CheckCircle, Clock, AlertTriangle, Shield, Zap, Lock, Eye } from 'lucide-react';

const BlockchainInteropDemo = () => {
  const { tr } = useDemoI18n('blockchain-interop');
  const [selectedProtocol, setSelectedProtocol] = useState('ibc');
  const [sourceChain, setSourceChain] = useState('cosmos');
  const [destChain, setDestChain] = useState('osmosis');
  const [messageType, setMessageType] = useState('token_transfer');
  const [amount, setAmount] = useState(100);
  
  const [packets, setPackets] = useState([]);
  const [nextPacketId, setNextPacketId] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [events, setEvents] = useState([]);
  
  const [lightClients, setLightClients] = useState({
    cosmos: { osmosis: { height: 1000, verified: true }, ethereum: { height: 500, verified: true } },
    osmosis: { cosmos: { height: 1000, verified: true } },
    ethereum: { cosmos: { height: 500, verified: true }, polygon: { height: 2000, verified: true } },
    polygon: { ethereum: { height: 2000, verified: true } }
  });

  const protocols = {
    ibc: {
      name: tr('IBC (Inter-Blockchain Communication)'),
      chains: ['cosmos', 'osmosis'],
      trustModel: tr('Light Client Verification'),
      security: tr('Very High'),
      speed: tr('Fast (6-20s)'),
      cost: tr('Low'),
      description: tr('Trustless protocol using light clients to verify state proofs'),
      color: 'blue'
    },
    ccip: {
      name: tr('CCIP (Chainlink Cross-Chain)'),
      chains: ['ethereum', 'polygon'],
      trustModel: tr('Decentralized Oracle Network'),
      security: tr('High'),
      speed: tr('Medium (1-5min)'),
      cost: tr('Medium'),
      description: tr('Oracle-based messaging with cryptoeconomic security'),
      color: 'purple'
    },
    layerzero: {
      name: tr('LayerZero'),
      chains: ['ethereum', 'polygon'],
      trustModel: tr('Oracle + Relayer'),
      security: tr('Medium-High'),
      speed: tr('Fast (20-60s)'),
      cost: tr('Low-Medium'),
      description: tr('Ultra-light nodes with independent oracle and relayer'),
      color: 'green'
    }
  };

  const chains = {
    cosmos: { name: 'Cosmos Hub', color: 'bg-indigo-600', height: 1000 },
    osmosis: { name: 'Osmosis', color: 'bg-purple-600', height: 1000 },
    ethereum: { name: 'Ethereum', color: 'bg-blue-600', height: 2000 },
    polygon: { name: 'Polygon', color: 'bg-violet-600', height: 2000 }
  };

  const messageTypes = {
    token_transfer: { name: tr('Token Transfer'), icon: '💰' },
    contract_call: { name: tr('Contract Call'), icon: '📜' },
    nft_transfer: { name: tr('NFT Transfer'), icon: '🖼️' },
    data_message: { name: tr('Data Message'), icon: '📨' }
  };

  const addEvent = (message, type = 'info') => {
    setEvents(prev => [{
      id: Date.now() + Math.random(),
      message,
      type,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 15));
  };

  const sendMessage = async () => {
    if (sourceChain === destChain) {
      addEvent(tr('Source and destination must be different'), 'error');
      return;
    }

    setIsProcessing(true);
    const protocol = protocols[selectedProtocol];
    
    // Step 1: Create packet
    const packet = {
      id: nextPacketId,
      protocol: selectedProtocol,
      source: sourceChain,
      destination: destChain,
      type: messageType,
      amount,
      status: 'pending',
      steps: [],
      timestamp: Date.now()
    };

    setPackets(prev => [packet, ...prev]);
    setNextPacketId(nextPacketId + 1);
    
    addEvent(
      tr('📤 Packet #{{id}} created on {{chain}}', {
        id: packet.id,
        chain: chains[sourceChain].name
      }),
      'info'
    );
    await new Promise(resolve => setTimeout(resolve, 800));

    // Step 2: Protocol-specific processing
    if (selectedProtocol === 'ibc') {
      await processIBC(packet);
    } else if (selectedProtocol === 'ccip') {
      await processCCIP(packet);
    } else if (selectedProtocol === 'layerzero') {
      await processLayerZero(packet);
    }

    setIsProcessing(false);
  };

  const processIBC = async (packet) => {
    // Step 1: Commit on source chain
    updatePacket(packet.id, {
      status: 'committed',
      steps: [...packet.steps, tr('Source chain commitment')]
    });
    addEvent(tr('✓ Packet committed on {{chain}}', { chain: chains[packet.source].name }), 'success');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Light client verification
    updatePacket(packet.id, {
      steps: [...packet.steps, tr('Source chain commitment'), tr('Light client verification')]
    });
    addEvent(tr('🔍 Light client verifying state proof...'), 'info');
    await new Promise(resolve => setTimeout(resolve, 1200));

    const hasLightClient = lightClients[packet.destination]?.[packet.source]?.verified;
    if (!hasLightClient) {
      updatePacket(packet.id, {
        status: 'failed',
        steps: [
          ...packet.steps,
          tr('Source chain commitment'),
          tr('Light client verification'),
          tr('Verification failed')
        ]
      });
      addEvent(tr('❌ No verified light client on {{chain}}', { chain: chains[packet.destination].name }), 'error');
      return;
    }

    updatePacket(packet.id, {
      steps: [...packet.steps, tr('Source chain commitment'), tr('Light client verification'), tr('Proof verified')]
    });
    addEvent(tr('✓ State proof verified by light client'), 'success');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Execute on destination
    updatePacket(packet.id, {
      status: 'relaying',
      steps: [
        ...packet.steps,
        tr('Source chain commitment'),
        tr('Light client verification'),
        tr('Proof verified'),
        tr('Relaying to destination')
      ]
    });
    addEvent(tr('📡 Relayer submitting packet to {{chain}}', { chain: chains[packet.destination].name }), 'info');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Acknowledgment
    updatePacket(packet.id, {
      status: 'completed',
      steps: [
        ...packet.steps,
        tr('Source chain commitment'),
        tr('Light client verification'),
        tr('Proof verified'),
        tr('Relaying to destination'),
        tr('Executed on destination'),
        tr('Acknowledgment sent')
      ]
    });
    addEvent(
      tr('✅ Packet #{{id}} executed on {{chain}}', {
        id: packet.id,
        chain: chains[packet.destination].name
      }),
      'success'
    );
    await new Promise(resolve => setTimeout(resolve, 800));
    addEvent(tr('🔙 Acknowledgment received on {{chain}}', { chain: chains[packet.source].name }), 'success');
  };

  const processCCIP = async (packet) => {
    // Step 1: Source chain emission
    updatePacket(packet.id, { status: 'committed', steps: [...packet.steps, tr('Message emitted')] });
    addEvent(tr('✓ Message emitted on {{chain}}', { chain: chains[packet.source].name }), 'success');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: DON observation
    updatePacket(packet.id, {
      status: 'observing',
      steps: [...packet.steps, tr('Message emitted'), tr('DON observing')]
    });
    addEvent(tr('👁️ Decentralized Oracle Network observing...'), 'info');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 3: Consensus
    updatePacket(packet.id, { steps: [...packet.steps, tr('Message emitted'), tr('DON observing'), tr('Oracles reaching consensus')] });
    addEvent(tr('🤝 Oracle consensus achieved (12/15 nodes)'), 'success');
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Step 4: Risk Management
    updatePacket(packet.id, { steps: [...packet.steps, tr('Message emitted'), tr('DON observing'), tr('Oracles reaching consensus'), tr('Risk analysis')] });
    addEvent(tr('🛡️ Risk Management Network validating...'), 'info');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 5: Execution
    updatePacket(packet.id, {
      status: 'relaying',
      steps: [
        ...packet.steps,
        tr('Message emitted'),
        tr('DON observing'),
        tr('Oracles reaching consensus'),
        tr('Risk analysis'),
        tr('Approved for execution')
      ]
    });
    addEvent(tr('✓ Risk checks passed'), 'success');
    await new Promise(resolve => setTimeout(resolve, 800));

    updatePacket(packet.id, {
      status: 'completed',
      steps: [
        ...packet.steps,
        tr('Message emitted'),
        tr('DON observing'),
        tr('Oracles reaching consensus'),
        tr('Risk analysis'),
        tr('Approved for execution'),
        tr('Executed on destination')
      ]
    });
    addEvent(tr('✅ Message executed on {{chain}}', { chain: chains[packet.destination].name }), 'success');
  };

  const processLayerZero = async (packet) => {
    // Step 1: User application calls
    updatePacket(packet.id, { status: 'committed', steps: [...packet.steps, tr('User app initiated')] });
    addEvent(tr('✓ Application initiated on {{chain}}', { chain: chains[packet.source].name }), 'success');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Oracle observation
    updatePacket(packet.id, { steps: [...packet.steps, tr('User app initiated'), tr('Oracle observing')] });
    addEvent(tr('👁️ Oracle monitoring block headers...'), 'info');
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Step 3: Relayer fetches proof
    updatePacket(packet.id, { steps: [...packet.steps, tr('User app initiated'), tr('Oracle observing'), tr('Relayer fetching proof')] });
    addEvent(tr('📡 Relayer fetching transaction proof'), 'info');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Submit to destination
    updatePacket(packet.id, { status: 'relaying', steps: [...packet.steps, tr('User app initiated'), tr('Oracle observing'), tr('Relayer fetching proof'), tr('Submitting to destination')] });
    addEvent(tr('📤 Oracle and Relayer submitting independently'), 'info');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 5: Verification and execution
    updatePacket(packet.id, { steps: [...packet.steps, tr('User app initiated'), tr('Oracle observing'), tr('Relayer fetching proof'), tr('Submitting to destination'), tr('Validating on destination')] });
    addEvent(tr('🔍 Destination chain validating Oracle vs Relayer data'), 'info');
    await new Promise(resolve => setTimeout(resolve, 1000));

    updatePacket(packet.id, { status: 'completed', steps: [...packet.steps, tr('User app initiated'), tr('Oracle observing'), tr('Relayer fetching proof'), tr('Submitting to destination'), tr('Validating on destination'), tr('Executed')] });
    addEvent(tr('✅ Message executed on {{chain}}', { chain: chains[packet.destination].name }), 'success');
  };

  const updatePacket = (id, updates) => {
    setPackets(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-600';
      case 'committed': return 'bg-blue-600';
      case 'observing': return 'bg-purple-600';
      case 'relaying': return 'bg-indigo-600';
      case 'completed': return 'bg-emerald-600';
      case 'failed': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'success': return 'border-l-emerald-500 bg-emerald-900 bg-opacity-20';
      case 'error': return 'border-l-red-500 bg-red-900 bg-opacity-20';
      default: return 'border-l-blue-500 bg-blue-900 bg-opacity-20';
    }
  };

  const currentProtocol = protocols[selectedProtocol];
  const availableChains = currentProtocol.chains;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">🌉 {tr('Blockchain Interoperability Protocols')}</h1>
<p className="text-slate-300 text-sm">
  <T term="Interoperability" text={define('Interoperability')} />
</p>
          <p className="text-slate-300">
            {tr('Compare IBC, CCIP, and LayerZero - different approaches to cross-chain messaging')}
          </p>
        </div>

        {/* Protocol Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Object.entries(protocols).map(([key, protocol]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedProtocol(key);
                setSourceChain(protocol.chains[0]);
                setDestChain(protocol.chains[1]);
              }}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedProtocol === key
                  ? `border-${protocol.color}-500 bg-${protocol.color}-900 bg-opacity-30`
                  : 'border-slate-600 bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <div className="font-semibold text-lg mb-2">{protocol.name}</div>
              <div className="text-sm text-slate-300 mb-3">{protocol.description}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-700 rounded p-2">
                  <div className="text-slate-400">{tr('Trust Model')}</div>
                  <div className="font-semibold">{protocol.trustModel}</div>
                </div>
                <div className="bg-slate-700 rounded p-2">
                  <div className="text-slate-400">{tr('Security')}</div>
                  <div className="font-semibold">{protocol.security}</div>
                </div>
                <div className="bg-slate-700 rounded p-2">
                  <div className="text-slate-400">{tr('Speed')}</div>
                  <div className="font-semibold">{protocol.speed}</div>
                </div>
                <div className="bg-slate-700 rounded p-2">
                  <div className="text-slate-400">{tr('Cost')}</div>
                  <div className="font-semibold">{protocol.cost}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Message Builder */}
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Send className="text-blue-400" />
                {tr('Create Message')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">{tr('Source Chain')}</label>
                  <select
                    value={sourceChain}
                    onChange={(e) => setSourceChain(e.target.value)}
                    disabled={isProcessing}
                    className="w-full bg-slate-700 rounded px-3 py-2"
                  >
                    {availableChains.map(chain => (
                      <option key={chain} value={chain}>{chains[chain].name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-2 block">{tr('Destination Chain')}</label>
                  <select
                    value={destChain}
                    onChange={(e) => setDestChain(e.target.value)}
                    disabled={isProcessing}
                    className="w-full bg-slate-700 rounded px-3 py-2"
                  >
                    {availableChains.map(chain => (
                      <option key={chain} value={chain}>{chains[chain].name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-2 block">{tr('Message Type')}</label>
                  <select
                    value={messageType}
                    onChange={(e) => setMessageType(e.target.value)}
                    disabled={isProcessing}
                    className="w-full bg-slate-700 rounded px-3 py-2"
                  >
                    {Object.entries(messageTypes).map(([key, type]) => (
                      <option key={key} value={key}>
                        {type.icon} {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-2 block">{tr('Amount / Value')}</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                    disabled={isProcessing}
                    className="w-full bg-slate-700 rounded px-3 py-2"
                    min="1"
                  />
                </div>

                <button
                  onClick={sendMessage}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-semibold flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  {isProcessing ? tr('Processing...') : tr('Send Cross-Chain Message')}
                </button>
              </div>
            </div>

            {/* Protocol Details */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="text-purple-400" />
                {currentProtocol.name}
              </h2>

              <div className="space-y-3 text-sm">
                {selectedProtocol === 'ibc' && (
                  <>
                    <div className="bg-slate-700 rounded p-3">
                      <div className="font-semibold text-blue-400 mb-2">
                        <T term="IBC" text={define('IBC')} />
                        {tr('Works')}
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300">
                        <li>{tr('• Light clients verify chain state')}</li>
                        <li>{tr('• Cryptographic proofs ensure validity')}</li>
                        <li>{tr('• No external validators needed')}</li>
                        <li>{tr('• Trustless & fully decentralized')}</li>
                        <li>{tr('• Acknowledgments confirm delivery')}</li>
                      </ul>
                    </div>
                    <div className="bg-emerald-900 bg-opacity-20 border border-emerald-700 rounded p-2 text-xs">
                      <strong>{tr('Trust Model')}:</strong> {tr('Trustless - relies on cryptographic proofs and light client verification')}
                    </div>
                  </>
                )}

                {selectedProtocol === 'ccip' && (
                  <>
                    <div className="bg-slate-700 rounded p-3">
                      <div className="font-semibold text-purple-400 mb-2">{tr('How CCIP Works')}</div>
                      <ul className="space-y-1 text-xs text-slate-300">
                        <li>{tr('• Decentralized Oracle Network observes')}</li>
                        <li>{tr('• Multiple independent oracles verify')}</li>
                        <li>{tr('• Risk Management Network validates')}</li>
                        <li>{tr('• Cryptoeconomic security guarantees')}</li>
                        <li>{tr('• Built-in rate limiting & monitoring')}</li>
                      </ul>
                    </div>
                    <div className="bg-purple-900 bg-opacity-20 border border-purple-700 rounded p-2 text-xs">
                      <strong>{tr('Trust Model')}:</strong> {tr('Decentralized oracle consensus with economic incentives and penalties')}
                    </div>
                  </>
                )}

                {selectedProtocol === 'layerzero' && (
                  <>
                    <div className="bg-slate-700 rounded p-3">
                      <div className="font-semibold text-green-400 mb-2">{tr('How LayerZero Works')}</div>
                      <ul className="space-y-1 text-xs text-slate-300">
                        <li>{tr('• Ultra-light nodes on each chain')}</li>
                        <li>{tr('• Independent Oracle + Relayer system')}</li>
                        <li>{tr('• Oracle monitors block headers')}</li>
                        <li>{tr('• Relayer fetches transaction proofs')}</li>
                        <li>{tr('• Destination validates both match')}</li>
                      </ul>
                    </div>
                    <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded p-2 text-xs">
                      <strong>{tr('Trust Model')}:</strong> {tr('Oracle and Relayer must independently agree (configurable trust assumptions)')}
                    </div>
                  </>
                )}
              </div>
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

          {/* Middle - Packet Flow */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Zap className="text-emerald-400" />
                {tr('Message Packets')} ({packets.length})
              </h2>

              <div className="space-y-3 max-h-[800px] overflow-y-auto">
                {packets.length === 0 ? (
                  <div className="text-center text-slate-400 py-12 text-sm">
                    {tr('No packets sent yet. Create a cross-chain message to begin.')}
                  </div>
                ) : (
                  packets.map(packet => (
                    <div
                      key={packet.id}
                      className="bg-slate-700 rounded-lg p-4 border-l-4"
                      style={{ borderColor: packet.status === 'completed' ? '#10b981' : packet.status === 'failed' ? '#ef4444' : '#3b82f6' }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-lg">{tr('Packet #{{id}}', { id: packet.id })}</div>
                          <div className="text-xs text-slate-400">
                            {protocols[packet.protocol].name}
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded text-xs font-semibold ${getStatusColor(packet.status)}`}>
                          {packet.status.toUpperCase()}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                        <div className="bg-slate-600 rounded p-2">
                          <div className="text-xs text-slate-400">{tr('From')}</div>
                          <div className="font-semibold">{chains[packet.source].name}</div>
                        </div>
                        <div className="bg-slate-600 rounded p-2">
                          <div className="text-xs text-slate-400">{tr('To')}</div>
                          <div className="font-semibold">{chains[packet.destination].name}</div>
                        </div>
                        <div className="bg-slate-600 rounded p-2">
                          <div className="text-xs text-slate-400">{tr('Type')}</div>
                          <div className="font-semibold">
                            {messageTypes[packet.type].icon} {messageTypes[packet.type].name}
                          </div>
                        </div>
                        <div className="bg-slate-600 rounded p-2">
                          <div className="text-xs text-slate-400">{tr('Amount')}</div>
                          <div className="font-semibold text-emerald-400">{packet.amount}</div>
                        </div>
                      </div>

                      {packet.steps.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-600">
                          <div className="text-xs font-semibold text-slate-300 mb-2">{tr('Processing Steps')}:</div>
                          <div className="space-y-2">
                            {packet.steps.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs">
                                {idx < packet.steps.length - 1 || packet.status === 'completed' ? (
                                  <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                ) : packet.status === 'failed' ? (
                                  <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                                ) : (
                                  <Clock size={14} className="text-blue-400 mt-0.5 flex-shrink-0 animate-pulse" />
                                )}
                                <span className="text-slate-300">{step}</span>
                              </div>
                            ))}
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

        {/* Comparison Table */}
        <div className="mt-6 bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">{tr('Protocol Comparison')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400">{tr('Feature')}</th>
                  <th className="text-left py-2 px-3">IBC</th>
                  <th className="text-left py-2 px-3">CCIP</th>
                  <th className="text-left py-2 px-3">LayerZero</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-3 text-slate-400">{tr('Trust Model')}</td>
                  <td className="py-2 px-3">Light Client (Trustless)</td>
                  <td className="py-2 px-3">Oracle Consensus</td>
                  <td className="py-2 px-3">Oracle + Relayer</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-3 text-slate-400">{tr('Security Level')}</td>
                  <td className="py-2 px-3 text-emerald-400">Very High ⭐⭐⭐⭐⭐</td>
                  <td className="py-2 px-3 text-blue-400">High ⭐⭐⭐⭐</td>
                  <td className="py-2 px-3 text-yellow-400">Medium-High ⭐⭐⭐</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-3 text-slate-400">{tr('Speed')}</td>
                  <td className="py-2 px-3">6-20 seconds</td>
                  <td className="py-2 px-3">1-5 minutes</td>
                  <td className="py-2 px-3">20-60 seconds</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-3 text-slate-400">{tr('Cost')}</td>
                  <td className="py-2 px-3 text-emerald-400">Low</td>
                  <td className="py-2 px-3 text-yellow-400">Medium</td>
                  <td className="py-2 px-3 text-blue-400">Low-Medium</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-3 text-slate-400">{tr('Verification')}</td>
                  <td className="py-2 px-3">Cryptographic Proofs</td>
                  <td className="py-2 px-3">Oracle Consensus (DON)</td>
                  <td className="py-2 px-3">Independent Oracle & Relayer</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-400">{tr('Setup Complexity')}</td>
                  <td className="py-2 px-3">High (Light clients)</td>
                  <td className="py-2 px-3">Low (Managed service)</td>
                  <td className="py-2 px-3">Medium (Configure Oracle/Relayer)</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 px-3 text-slate-400">{tr('Censorship Resistance')}</td>
                  <td className="py-2 px-3 text-emerald-400">Very High</td>
                  <td className="py-2 px-3 text-blue-400">High</td>
                  <td className="py-2 px-3 text-yellow-400">Medium</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-400">{tr('Best For')}</td>
                  <td className="py-2 px-3">Cosmos ecosystem, max security</td>
                  <td className="py-2 px-3">Enterprise, multi-chain apps</td>
                  <td className="py-2 px-3">Cost-sensitive, custom configs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Further Reading */}
        <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">📚 {tr('Further Reading')}</h2>
          <ul className="space-y-2 text-sm">
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://ibcprotocol.dev/" target="_blank" rel="noopener noreferrer">{tr('IBC protocol docs →')}</a></li>
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://docs.chain.link/ccip" target="_blank" rel="noopener noreferrer">{tr('Chainlink CCIP docs →')}</a></li>
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://layerzero.gitbook.io/docs/" target="_blank" rel="noopener noreferrer">{tr('LayerZero docs →')}</a></li>
            <li><a className="text-blue-300 hover:text-blue-200 underline" href="https://rekt.news/" target="_blank" rel="noopener noreferrer">{tr('Bridge incident archive (rekt.news) →')}</a></li>
          </ul>
        </div>

        {/* Security Deep Dive */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-blue-300 flex items-center gap-2">
              <Shield size={18} />
              {tr('IBC Security Model')}
            </h3>
            <div className="space-y-2 text-sm text-slate-300">
              <p className="text-xs">
                <strong>{tr('Attack Vector')}:</strong>{' '}
                {tr('Must compromise source chain consensus OR forge cryptographic proofs (computationally infeasible)')}
              </p>
              <p className="text-xs">
                <strong>{tr('Trust Assumptions')}:</strong> {tr('Zero - only relies on cryptographic security')}
              </p>
              <p className="text-xs">
                <strong>{tr('Failure Mode')}:</strong>{' '}
                {tr('If light client falls behind, messages are delayed until sync completes')}
              </p>
              <div className="mt-3 pt-3 border-t border-blue-700">
                <div className="text-xs font-semibold text-blue-400 mb-1">{tr('Light Client Status')}:</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Cosmos → Osmosis:</span>
                    <span className="text-emerald-400">{tr('✓ Synced (Block {{height}})', { height: lightClients.cosmos.osmosis.height })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Osmosis → Cosmos:</span>
                    <span className="text-emerald-400">{tr('✓ Synced (Block {{height}})', { height: lightClients.osmosis.cosmos.height })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-900 bg-opacity-20 border border-purple-700 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-purple-300 flex items-center gap-2">
              <Shield size={18} />
              {tr('CCIP Security Model')}
            </h3>
            <div className="space-y-2 text-sm text-slate-300">
              <p className="text-xs">
                <strong>{tr('Attack Vector')}:</strong>{' '}
                {tr('Must compromise majority of DON (Decentralized Oracle Network) nodes simultaneously')}
              </p>
              <p className="text-xs">
                <strong>{tr('Trust Assumptions')}:</strong>{' '}
                {tr('Honest majority of oracles + Risk Management Network validation')}
              </p>
              <p className="text-xs">
                <strong>{tr('Failure Mode')}:</strong>{' '}
                {tr('Rate limiting activates on suspicious activity; manual intervention may be required')}
              </p>
              <div className="mt-3 pt-3 border-t border-purple-700">
                <div className="text-xs font-semibold text-purple-400 mb-1">{tr('Network Status')}:</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Active Oracle Nodes:</span>
                    <span className="text-emerald-400">15/15</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Consensus Threshold:</span>
                    <span className="text-blue-400">10/15 (66%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Risk Management:</span>
                    <span className="text-emerald-400">✓ Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-green-300 flex items-center gap-2">
              <Shield size={18} />
              {tr('LayerZero Security Model')}
            </h3>
            <div className="space-y-2 text-sm text-slate-300">
              <p className="text-xs">
                <strong>{tr('Attack Vector')}:</strong>{' '}
                {tr('Must compromise BOTH Oracle and Relayer (assumed to be independent entities)')}
              </p>
              <p className="text-xs">
                <strong>{tr('Trust Assumptions')}:</strong> {tr('Oracle and Relayer do not collude')}
              </p>
              <p className="text-xs">
                <strong>{tr('Failure Mode')}:</strong> {tr('If Oracle and Relayer provide conflicting data, transaction fails')}
              </p>
              <div className="mt-3 pt-3 border-t border-green-700">
                <div className="text-xs font-semibold text-green-400 mb-1">{tr('Component Status')}:</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Oracle (Chainlink):</span>
                    <span className="text-emerald-400">✓ Online</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Relayer:</span>
                    <span className="text-emerald-400">✓ Online</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Independence:</span>
                    <span className="text-yellow-400">{tr('⚠ User-configurable')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-World Applications */}
        <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
          <h2 className="text-2xl font-bold mb-4 text-blue-300">🌐 {tr('Real-World Applications')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-blue-400 mb-2">Cosmos IBC</h3>
              <p className="text-xs text-slate-300 mb-3">
                {tr('Trust-minimized cross-chain transfers and messaging inside the Cosmos ecosystem.')}
              </p>
              <ul className="space-y-1 text-xs text-slate-300 mb-3">
                <li>{tr('• Osmosis DEX trading Cosmos tokens')}</li>
                <li>{tr('• Stride liquid staking across chains')}</li>
                <li>{tr('• Interchain accounts, queries, and governance')}</li>
              </ul>
              <a
                href="https://ibcprotocol.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-300 hover:text-blue-200 underline"
              >
                {tr('Official docs →')}
              </a>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-purple-400 mb-2">Chainlink CCIP</h3>
              <p className="text-xs text-slate-300 mb-3">
                {tr('Cross-chain messaging with oracle consensus and additional risk management.')}
              </p>
              <ul className="space-y-1 text-xs text-slate-300 mb-3">
                <li>{tr('• Cross-chain DeFi orchestration (liquidity, lending)')}</li>
                <li>{tr('• Multi-chain apps with standardized messaging')}</li>
                <li>{tr('• Enterprise / compliance-friendly deployments')}</li>
              </ul>
              <a
                href="https://docs.chain.link/ccip"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-300 hover:text-purple-200 underline"
              >
                {tr('Official docs →')}
              </a>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-green-400 mb-2">LayerZero</h3>
              <p className="text-xs text-slate-300 mb-3">
                {tr('Omnichain messaging where the security model depends on independent Oracle + Relayer.')}
              </p>
              <ul className="space-y-1 text-xs text-slate-300 mb-3">
                <li>{tr('• Omnichain NFTs & tokens')}</li>
                <li>{tr('• Stargate cross-chain swaps')}</li>
                <li>{tr('• Multi-chain governance and app coordination')}</li>
              </ul>
              <a
                href="https://layerzero.gitbook.io/docs/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-300 hover:text-green-200 underline"
              >
                {tr('Official docs →')}
              </a>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold text-yellow-400 mb-2">{tr('Bridge Risk in Practice')}</h3>
              <p className="text-xs text-slate-300 mb-3">
                {tr('Many hacks historically targeted bridges. Choosing a trust model is a product decision: security vs speed vs cost.')}
              </p>
              <ul className="space-y-1 text-xs text-slate-300 mb-3">
                <li>{tr('• Prefer light-client / proof-based verification when possible')}</li>
                <li>{tr('• Add monitoring, rate limits, and circuit breakers')}</li>
                <li>{tr('• Consider smaller transfer limits for higher-risk routes')}</li>
              </ul>
              <a
                href="https://rekt.news/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-yellow-300 hover:text-yellow-200 underline"
              >
                {tr('Bridge incident archive →')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockchainInteropDemo;