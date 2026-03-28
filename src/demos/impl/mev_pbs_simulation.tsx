import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Blocks,
  ChevronRight,
  Circle,
  Gauge,
  HelpCircle,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingDown
} from 'lucide-react';
import EduTooltip from '../../ui/EduTooltip';
import LearningQuestsPortal from '../../ui/LearningQuestsPortal';
import { define } from '../glossary';
import { useDemoI18n } from '../useDemoI18n';

const Tooltip = EduTooltip;

type ModuleId = 'primer' | 'sandwich' | 'arbitrage' | 'bundles' | 'pbs' | 'advanced';

type EventType = 'info' | 'success' | 'warn' | 'error';

type SimEvent = {
  id: number;
  t: number;
  type: EventType;
  msg: string;
};

function nowId() {
  return Date.now() + Math.floor(Math.random() * 1_000_000);
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function fmt(x: number, d = 2) {
  if (!Number.isFinite(x)) return '—';
  return x.toFixed(d);
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-slate-300">{icon}</div>
      <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
    </div>
  );
}

function Pill({
  children,
  tone = 'slate'
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'blue';
}) {
  const cls =
    tone === 'emerald'
      ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
      : tone === 'amber'
        ? 'border-amber-500/30 bg-amber-950/20 text-amber-200'
        : tone === 'rose'
          ? 'border-rose-500/30 bg-rose-950/20 text-rose-200'
          : tone === 'blue'
            ? 'border-blue-500/30 bg-blue-950/20 text-blue-200'
            : 'border-slate-700 bg-slate-900/40 text-slate-200';
  return <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${cls}`}>{children}</span>;
}

function QuestRow({ done, text, tip }: { done: boolean; text: string; tip: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={done ? 'text-emerald-300' : 'text-slate-500'}>{done ? '✓' : '•'}</span>
      <div className="text-slate-200">
        {text}
        <span className="ml-2">
          <Tooltip text={tip} />
        </span>
      </div>
    </div>
  );
}

type PbsBuilder = {
  id: string;
  marginPct: number;
  bidEth: number;
  builderEarnEth: number;
  valid: boolean;
};

type PbsStep = 1 | 2 | 3 | 4 | 5;

function PbsModule({
  tr,
  addEvent,
  onQuest
}: {
  tr: (k: string, vars?: Record<string, any>) => string;
  addEvent: (type: 'info' | 'success' | 'warn' | 'error', msg: string) => void;
  onQuest: () => void;
}) {
  const [step, setStep] = useState<PbsStep>(1);

  const [params, setParams] = useState(() => ({
    builderCount: 3,
    mevOpportunityEth: 0.5,
    baseFeeGwei: 15,
    defaultMarginPct: 20,

    // Realism toggles
    relayRejectPct: 5, // chance the relay rejects a builder submission
    payloadFailPct: 3 // chance the winning builder fails to reveal payload
  }));

  const builders = useMemo(() => {
    const n = clamp(params.builderCount, 2, 5);
    const out: PbsBuilder[] = [];
    for (let i = 0; i < n; i++) {
      const margin = clamp(params.defaultMarginPct + (i - 1) * 7, 5, 40);
      const bid = params.mevOpportunityEth * (1 - margin / 100);

      // Relay filtering: some submissions are invalid / censored / fail simulation.
      const reject = Math.random() < clamp(params.relayRejectPct / 100, 0, 1);

      // Simple gas model: builders pay gas for included MEV txs.
      const gasUsed = 400_000;
      const gasEth = gasUsed * clamp(params.baseFeeGwei, 0, 200) * 1e-9;

      const builderEarnEth = params.mevOpportunityEth - bid - gasEth;
      out.push({
        id: `Builder ${i + 1}`,
        marginPct: margin,
        bidEth: Math.max(0, bid),
        builderEarnEth,
        valid: !reject
      });
    }
    return out;
  }, [params.baseFeeGwei, params.builderCount, params.defaultMarginPct, params.mevOpportunityEth]);

  const winner = useMemo(() => {
    const sorted = [...builders]
      .filter((b) => b.valid)
      .sort((a, b) => b.bidEth - a.bidEth);
    return sorted[0] ?? null;
  }, [builders]);

  const proposerEarnEth = winner?.bidEth ?? 0;

  function stepOnce() {
    setStep((s) => {
      const next: PbsStep = s === 5 ? 1 : ((s + 1) as PbsStep);
      return next;
    });

    const name: Record<PbsStep, string> = {
      1: tr('1) Builders build blocks from mempool + bundles'),
      2: tr('2) Builders send sealed header + bid to relay'),
      3: tr('3) Relay verifies and forwards best bids'),
      4: tr('4) Proposer selects highest bid and signs header'),
      5: tr('5) Payload revealed, block propagates, payments settle')
    };

    addEvent('info', tr('PBS step: {{s}}', { s: name[step] }));

    if (step === 4 && winner) {
      addEvent(
        'success',
        tr('Winner selected: {{b}} bids {{bid}} ETH → proposer earns {{earn}} ETH.', {
          b: winner.id,
          bid: winner.bidEth.toFixed(3),
          earn: proposerEarnEth.toFixed(3)
        })
      );
      onQuest();

      // Simulate payload reveal failure.
      const fail = Math.random() < clamp(params.payloadFailPct / 100, 0, 1);
      if (fail) {
        addEvent(
          'error',
          tr('Payload not revealed: winning builder failed to deliver. The slot may be missed and the proposer loses revenue.')
        );
      } else {
        addEvent('info', tr('Payload revealed: block propagates to the network.'));
      }
    }
  }

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-100">{tr('Parameters')}</div>
          <Tooltip text={tr('Bids are computed as: bid = MEV × (1 − margin%). Proposer picks highest bid.')} />
        </div>

        <div className="mt-3 space-y-3 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-300">{tr('Builders')}</span>
            <input
              type="number"
              min={2}
              max={5}
              value={params.builderCount}
              onChange={(e) => setParams((p) => ({ ...p, builderCount: clamp(Number(e.target.value), 2, 5) }))}
              className="w-24 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-300">{tr('MEV opportunity (ETH)')}</span>
            <input
              type="number"
              step={0.05}
              value={params.mevOpportunityEth}
              onChange={(e) =>
                setParams((p) => ({ ...p, mevOpportunityEth: clamp(Number(e.target.value), 0.01, 5) }))
              }
              className="w-24 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-300">{tr('Builder margin target (%)')}</span>
            <input
              type="number"
              step={1}
              value={params.defaultMarginPct}
              onChange={(e) =>
                setParams((p) => ({ ...p, defaultMarginPct: clamp(Number(e.target.value), 5, 40) }))
              }
              className="w-24 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-300">{tr('Base fee (gwei)')}</span>
            <input
              type="number"
              step={1}
              value={params.baseFeeGwei}
              onChange={(e) => setParams((p) => ({ ...p, baseFeeGwei: clamp(Number(e.target.value), 0, 50) }))}
              className="w-24 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-300">{tr('Relay reject (%)')}</span>
            <input
              type="number"
              step={1}
              value={params.relayRejectPct}
              onChange={(e) => setParams((p) => ({ ...p, relayRejectPct: clamp(Number(e.target.value), 0, 80) }))}
              className="w-24 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-300">{tr('Payload fail (%)')}</span>
            <input
              type="number"
              step={1}
              value={params.payloadFailPct}
              onChange={(e) => setParams((p) => ({ ...p, payloadFailPct: clamp(Number(e.target.value), 0, 80) }))}
              className="w-24 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">{tr('Flow')} {step}/5</div>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {([1, 2, 3, 4, 5] as const).map((p) => (
              <div
                key={p}
                className={`h-2 rounded ${step === p ? 'bg-blue-400' : step > p ? 'bg-blue-400/40' : 'bg-slate-700'}`}
              />
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={stepOnce}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/50 bg-blue-950/40 hover:bg-blue-900 text-sm"
            >
              <ChevronRight size={16} /> {tr('Step')}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                addEvent('info', tr('PBS flow reset.'));
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
            >
              <RefreshCw size={16} /> {tr('Reset')}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-100">{tr('Bids & outcome')}</div>
          <Tooltip text={tr('Proposer picks the highest bid without seeing tx contents (blinded header).')} />
        </div>

        <div className="mt-3 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left font-semibold py-1">{tr('Builder')}</th>
                <th className="text-right font-semibold py-1">{tr('Margin')}</th>
                <th className="text-right font-semibold py-1">{tr('Bid (ETH)')}</th>
                <th className="text-right font-semibold py-1">{tr('Builder earn (ETH)')}</th>
              </tr>
            </thead>
            <tbody>
              {builders
                .slice()
                .sort((a, b) => b.bidEth - a.bidEth)
                .map((b) => {
                  const isWin = winner?.id === b.id;
                  return (
                    <tr key={b.id} className={isWin ? 'bg-emerald-950/20' : ''}>
                      <td className={`py-1 ${isWin ? 'text-emerald-200 font-semibold' : 'text-slate-200'}`}>{b.id}</td>
                      <td className="py-1 text-right text-slate-200">{b.marginPct}%</td>
                      <td className="py-1 text-right text-slate-100 font-mono">{b.bidEth.toFixed(3)}</td>
                      <td className={`py-1 text-right font-mono ${b.builderEarnEth >= 0 ? 'text-slate-100' : 'text-rose-200'}`}>{b.builderEarnEth.toFixed(3)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-slate-300">{tr('Proposer earns')}</div>
            <div className="text-right font-mono text-slate-100">{proposerEarnEth.toFixed(3)} ETH</div>
            <div className="text-slate-300">{tr('Winner')}</div>
            <div className="text-right font-mono text-slate-100">{winner ? winner.id : '—'}</div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
          <div className="text-xs text-slate-400 mb-2">{tr('Flow (visual)')}</div>
          <div className="grid grid-cols-4 gap-2 text-[11px]">
            <div className={`rounded-lg border p-2 ${step === 1 ? 'border-blue-500/50 bg-blue-950/20' : 'border-slate-700 bg-slate-950/30'}`}>
              <div className="font-semibold text-slate-100">{tr('Builders')}</div>
              <div className="text-slate-300">{tr('Build candidate blocks')}</div>
            </div>
            <div className={`rounded-lg border p-2 ${step === 2 || step === 3 ? 'border-blue-500/50 bg-blue-950/20' : 'border-slate-700 bg-slate-950/30'}`}>
              <div className="font-semibold text-slate-100">{tr('Relay')}</div>
              <div className="text-slate-300">{tr('Verify & forward bids')}</div>
            </div>
            <div className={`rounded-lg border p-2 ${step === 4 ? 'border-blue-500/50 bg-blue-950/20' : 'border-slate-700 bg-slate-950/30'}`}>
              <div className="font-semibold text-slate-100">{tr('Proposer')}</div>
              <div className="text-slate-300">{tr('Pick highest bid')}</div>
            </div>
            <div className={`rounded-lg border p-2 ${step === 5 ? 'border-blue-500/50 bg-blue-950/20' : 'border-slate-700 bg-slate-950/30'}`}>
              <div className="font-semibold text-slate-100">{tr('Network')}</div>
              <div className="text-slate-300">{tr('Payload reveal & finalize')}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-300">
            {tr('Builders send sealed envelopes (headers) with bids → relay → proposer picks the richest envelope without opening it → payload revealed.')}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function MevPbsSimulation() {
  const { tr } = useDemoI18n('mev-pbs');

  const [module, setModule] = useState<ModuleId>('primer');
  const [tStep, setTStep] = useState(0);
  const [events, setEvents] = useState<SimEvent[]>([]);

  const [quest, setQuest] = useState(() => ({
    sawSandwichProfit: false,
    sawVictimRevert: false,
    sawArbProfit: false,
    avoidedSandwichWithPrivate: false,
    sawPbsWinner: false,
  }));

  function addEvent(type: EventType, msg: string) {
    setEvents((prev) => [{ id: nowId(), t: tStep, type, msg }, ...prev].slice(0, 60));
  }

  function resetAll() {
    setTStep(0);
    setEvents([]);
    setQuest({
      sawSandwichProfit: false,
      sawVictimRevert: false,
      sawArbProfit: false,
      avoidedSandwichWithPrivate: false,
      sawPbsWinner: false,
      // quiz omitted for now
    });
    addEvent('info', tr('Reset. Choose a module and step through scenarios.'));
  }

  const questsDone = Object.values(quest).filter(Boolean).length;

  const questsUi = (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-100">{tr('Learning quests')}</div>
        <div className="text-xs text-slate-400">({questsDone}/5)</div>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <QuestRow
          done={quest.sawSandwichProfit}
          text={tr('Make a sandwich profitable')}
          tip={tr('In Sandwich, run a public mempool scenario where the searcher earns positive profit.')}
        />
        <QuestRow
          done={quest.sawVictimRevert}
          text={tr('Trigger a victim revert (tight slippage)')}
          tip={tr('Lower slippage tolerance enough that the victim transaction reverts.')}
        />
        <QuestRow
          done={quest.sawArbProfit}
          text={tr('Complete a profitable backrun arbitrage')}
          tip={tr('In Arbitrage, run a scenario where the searcher profits restoring prices between pools.')}
        />
        <QuestRow
          done={quest.avoidedSandwichWithPrivate}
          text={tr('Avoid a sandwich using a private transaction')}
          tip={tr('In Bundles, compare public vs private: the private path should not be sandwiched.')}
        />
        <QuestRow
          done={quest.sawPbsWinner}
          text={tr('Run a PBS auction and pick a winning builder')}
          tip={tr('In PBS, step once to see bids and which builder wins proposer selection.')}
        />
      </div>
    </div>
  );

  // -----------------------------
  // Module 2: Backrun arbitrage (simplified, spec-aligned)
  // -----------------------------
  type ArbPhase = 1 | 2 | 3 | 4;

  type ArbComputation = {
    priceRef: number;
    priceA0: number;
    priceA1: number;
    priceA2: number;
    victimImpact01: number;
    searcherSizeEth: number;
    grossProfitEth: number;
    feeCostEth: number;
    gasCostEth: number;
    netProfitEth: number;
    ordering: Array<{
      who: 'Victim (Venue A)' | 'Searcher buy (Venue A)' | 'Searcher sell (Venue B)';
      detail: string;
    }>;
  };

  const [arb, setArb] = useState(() => ({
    phase: 1 as ArbPhase,

    // Parameters
    priceRef: 2000,
    venueBPrice: 2000,
    venueALiquidityEth: 800,
    victimSellEth: 8,
    maxSearcherEth: 20,
    aggressiveness: 1.0,
    gasPriceGwei: 30,

    last: {
      priceRef: 2000,
      priceA0: 2000,
      priceA1: 2000,
      priceA2: 2000,
      victimImpact01: 0,
      searcherSizeEth: 0,
      grossProfitEth: 0,
      feeCostEth: 0,
      gasCostEth: 0,
      netProfitEth: 0,
      ordering: [] as ArbComputation['ordering']
    }
  }));

  function computeArb(s: typeof arb): ArbComputation {
    const feeBps = 30;
    const priceRef = clamp(s.priceRef, 200, 20_000);
    const priceB = clamp(s.venueBPrice, 200, 20_000);

    const liqEth = Math.max(50, s.venueALiquidityEth);
    const victimSellEth = clamp(s.victimSellEth, 0, 200);

    // Simplified impact: selling ETH pushes ETH/USD down by victimSell/liquidity.
    const victimImpact01 = clamp(victimSellEth / (liqEth * 8), 0, 0.35);

    const priceA0 = priceRef;
    const priceA1 = clamp(priceA0 * (1 - victimImpact01), 50, 50_000);

    // Gap: venue A cheaper than venue B => buy on A, sell on B.
    const gap = Math.max(0, priceB - priceA1);
    const gap01 = clamp(gap / priceB, 0, 1);

    const desiredSizeEth = liqEth * gap01 * 0.8 * clamp(s.aggressiveness, 0.2, 2.0);
    const searcherSizeEth = clamp(desiredSizeEth, 0, s.maxSearcherEth);

    // Gross profit in ETH: (sell at B - buy at A) in USD, divided by B price.
    const grossProfitEth = (searcherSizeEth * gap) / priceB;

    const feeCostEth = 2 * (feeBps / 10_000) * searcherSizeEth;

    const gasUsed = 220_000;
    const gasCostEth = gasUsed * clamp(s.gasPriceGwei, 0, 5_000) * 1e-9;

    const netProfitEth = grossProfitEth - feeCostEth - gasCostEth;

    // Price restoration: searcher trades push venue A back toward venue B.
    const restore01 = clamp(searcherSizeEth / (liqEth * 0.9), 0, 1);
    const priceA2 = clamp(priceA1 + (priceB - priceA1) * restore01, 50, 50_000);

    const ordering: ArbComputation['ordering'] = [
      { who: 'Victim (Venue A)', detail: `sell ${fmt(victimSellEth, 2)} ETH` }
    ];
    if (searcherSizeEth > 1e-9) {
      ordering.push({ who: 'Searcher buy (Venue A)', detail: `buy ${fmt(searcherSizeEth, 2)} ETH` });
      ordering.push({ who: 'Searcher sell (Venue B)', detail: `sell ${fmt(searcherSizeEth, 2)} ETH` });
    }

    return {
      priceRef,
      priceA0,
      priceA1,
      priceA2,
      victimImpact01,
      searcherSizeEth,
      grossProfitEth,
      feeCostEth,
      gasCostEth,
      netProfitEth,
      ordering
    };
  }

  function runArbOnce() {
    const comp = computeArb(arb);
    setTStep((t) => t + 1);

    setArb((s) => {
      const nextPhase: ArbPhase = s.phase === 4 ? 1 : ((s.phase + 1) as ArbPhase);
      return { ...s, phase: nextPhase, last: comp };
    });

    const phaseName: Record<ArbPhase, string> = {
      1: tr('1) Victim moves price on Venue A'),
      2: tr('2) Price discrepancy appears'),
      3: tr('3) Searcher backruns to arbitrage'),
      4: tr('4) Outcomes')
    };

    addEvent('info', tr('Arbitrage phase: {{p}}', { p: phaseName[arb.phase] }));
    addEvent('info', tr('Venue A price: ${{p}} → ${{p2}} (Venue B: ${{b}})', { p: fmt(comp.priceA0, 0), p2: fmt(comp.priceA1, 0), b: fmt(arb.venueBPrice, 0) }));

    if (comp.searcherSizeEth <= 1e-9) {
      addEvent('warn', tr('No arb: gap too small or max size too low.'));
      return;
    }

    addEvent(
      comp.netProfitEth > 0 ? 'success' : 'warn',
      tr('Searcher net profit: {{p}} ETH (gross {{g}}, fees {{f}}, gas {{gas}}).', {
        p: fmt(comp.netProfitEth, 4),
        g: fmt(comp.grossProfitEth, 4),
        f: fmt(comp.feeCostEth, 4),
        gas: fmt(comp.gasCostEth, 4)
      })
    );

    if (comp.netProfitEth > 0) {
      setQuest((q) => ({ ...q, sawArbProfit: true }));
      addEvent('success', tr('Quest progress: profitable backrun achieved.'));
    }
  }

  // -----------------------------
  // Module 1: Sandwich attack (spec-driven)
  // -----------------------------
  type SandwichPhase = 1 | 2 | 3 | 4 | 5;
  type SandwichTxKind = 'sell_eth' | 'buy_eth';
  type SandwichTxWho = 'Searcher (front-run)' | 'Other mempool tx' | 'Victim' | 'Searcher (back-run)';

  type SandwichComputation = {
    priceBefore: number; // USDC/ETH
    victimOutNoAttack: number; // USDC
    victimMinOut: number; // USDC
    victimOutActual: number; // USDC
    victimReverted: boolean;

    searcherWillAttack: boolean;
    searcherGrossProfitEth: number;
    searcherNetProfitEth: number;

    lpFeesEth: number;
    validatorTipEth: number;

    ordering: Array<{ who: SandwichTxWho; kind: SandwichTxKind }>;
  };

  type SandwichState = {
    victimSwapEth: number;
    slippageTolPct: number;
    poolLiquidityEth: number;
    gasPriceGwei: number;
    otherMempoolSellEth: number;
    publicMempool: boolean;
    phase: SandwichPhase;
    last: {
      priceBefore: number;
      victimOutNoAttack: number;
      victimMinOut: number;
      victimOutActual: number;
      victimReverted: boolean;
      searcherProfitEth: number;
      lpFeesEth: number;
      validatorTipEth: number;
      searcherWillAttack: boolean;
      ordering: Array<{ who: SandwichTxWho; kind: SandwichTxKind }>;
    };
  };

  const [sandwich, setSandwich] = useState<SandwichState>(() => ({
    victimSwapEth: 10,
    slippageTolPct: 0.5,
    poolLiquidityEth: 1_000,
    gasPriceGwei: 30,
    otherMempoolSellEth: 0,
    publicMempool: true,
    phase: 1,
    last: {
      priceBefore: 2000,
      victimOutNoAttack: 0,
      victimMinOut: 0,
      victimOutActual: 0,
      victimReverted: false,
      searcherProfitEth: 0,
      lpFeesEth: 0,
      validatorTipEth: 0,
      searcherWillAttack: false,
      ordering: []
    }
  }));

  function ammOut(amountIn: number, reserveIn: number, reserveOut: number, feeBps: number) {
    const feeMul = 1 - feeBps / 10_000;
    const xIn = amountIn * feeMul;
    return (xIn * reserveOut) / (reserveIn + xIn);
  }

  function computeSandwich(s: SandwichState): SandwichComputation {
    const feeBps = 30;
    const ethPriceUsd = 2000;

    const victimInEth = clamp(s.victimSwapEth, 0, 10_000);
    const slippageTol01 = clamp(s.slippageTolPct / 100, 0, 0.5);
    const reserveEth0 = Math.max(50, s.poolLiquidityEth);
    const reserveUsdc0 = reserveEth0 * ethPriceUsd;

    // Approx gas model
    const gasUsed = 150_000;
    const gasCostEthPerTx = gasUsed * clamp(s.gasPriceGwei, 0, 5_000) * 1e-9;

    const priceBefore = reserveUsdc0 / reserveEth0;

    // Quote at submission time (no attack, no other tx)
    const victimOutNoAttack = ammOut(victimInEth, reserveEth0, reserveUsdc0, feeBps);
    const victimMinOut = victimOutNoAttack * (1 - slippageTol01);

    const otherSellEth = clamp(s.otherMempoolSellEth, 0, 100);

    const ordering: SandwichComputation['ordering'] = [];

    if (!s.publicMempool) {
      const otherOut = otherSellEth > 0 ? ammOut(otherSellEth, reserveEth0, reserveUsdc0, feeBps) : 0;
      const reserveEth1 = reserveEth0 + otherSellEth;
      const reserveUsdc1 = reserveUsdc0 - otherOut;

      const victimOutActual = ammOut(victimInEth, reserveEth1, reserveUsdc1, feeBps);
      const victimReverted = victimOutActual < victimMinOut;

      if (otherSellEth > 0) ordering.push({ who: 'Other mempool tx', kind: 'sell_eth' });
      ordering.push({ who: 'Victim', kind: 'sell_eth' });

      return {
        priceBefore,
        victimOutNoAttack,
        victimMinOut,
        victimOutActual,
        victimReverted,
        searcherWillAttack: false,
        searcherGrossProfitEth: 0,
        searcherNetProfitEth: 0,
        lpFeesEth: (feeBps / 10_000) * (otherSellEth + victimInEth),
        validatorTipEth: 0,
        ordering
      };
    }

    // Searcher sizing heuristic.
    const frontInEth = victimInEth * 0.35;

    // Front-run sell ETH -> get USDC
    const frontOutUsdc = ammOut(frontInEth, reserveEth0, reserveUsdc0, feeBps);
    const reserveEthF = reserveEth0 + frontInEth;
    const reserveUsdcF = reserveUsdc0 - frontOutUsdc;

    // Optional other tx
    const otherOutUsdc = otherSellEth > 0 ? ammOut(otherSellEth, reserveEthF, reserveUsdcF, feeBps) : 0;
    const reserveEthFO = reserveEthF + otherSellEth;
    const reserveUsdcFO = reserveUsdcF - otherOutUsdc;

    // Victim executes after being front-run (+ other tx)
    const victimOutActual = ammOut(victimInEth, reserveEthFO, reserveUsdcFO, feeBps);
    const victimReverted = victimOutActual < victimMinOut;

    const reserveEthAfterVictim = reserveEthFO + (victimReverted ? 0 : victimInEth);
    const reserveUsdcAfterVictim = reserveUsdcFO - (victimReverted ? 0 : victimOutActual);

    // Back-run buy back ETH using the USDC from front-run
    const backOutEth = ammOut(frontOutUsdc, reserveUsdcAfterVictim, reserveEthAfterVictim, feeBps);

    const searcherGrossProfitEth = backOutEth - frontInEth;
    const searcherNetProfitEth = searcherGrossProfitEth - 2 * gasCostEthPerTx;

    const searcherWillAttack = searcherNetProfitEth > 0;

    const lpFeesEth =
      (feeBps / 10_000) * (frontInEth + otherSellEth + (victimReverted ? 0 : victimInEth)) +
      ((feeBps / 10_000) * frontOutUsdc) / ethPriceUsd;

    const validatorTipEth = 2 * gasCostEthPerTx * 0.3;

    ordering.push({ who: 'Searcher (front-run)', kind: 'sell_eth' });
    if (otherSellEth > 0) ordering.push({ who: 'Other mempool tx', kind: 'sell_eth' });
    ordering.push({ who: 'Victim', kind: 'sell_eth' });
    ordering.push({ who: 'Searcher (back-run)', kind: 'buy_eth' });

    return {
      priceBefore,
      victimOutNoAttack,
      victimMinOut,
      victimOutActual,
      victimReverted,
      searcherWillAttack,
      searcherGrossProfitEth,
      searcherNetProfitEth,
      lpFeesEth,
      validatorTipEth,
      ordering
    };
  }

  function runSandwichOnce() {
    const comp = computeSandwich(sandwich);

    setTStep((t) => t + 1);
    setSandwich((s) => {
      const nextPhase = (s.phase === 5 ? 1 : ((s.phase + 1) as SandwichPhase));
      return {
        ...s,
        phase: nextPhase,
        last: {
          priceBefore: comp.priceBefore,
          victimOutNoAttack: comp.victimOutNoAttack,
          victimMinOut: comp.victimMinOut,
          victimOutActual: comp.victimOutActual,
          victimReverted: comp.victimReverted,
          searcherProfitEth: comp.searcherNetProfitEth,
          lpFeesEth: comp.lpFeesEth,
          validatorTipEth: comp.validatorTipEth,
          searcherWillAttack: comp.searcherWillAttack,
          ordering: comp.ordering
        }
      };
    });

    // Phase narration (spec style)
    const phaseName: Record<SandwichPhase, string> = {
      1: tr('1) Mempool: victim broadcasts'),
      2: tr('2) Searcher: detects MEV'),
      3: tr('3) Searcher: builds bundle'),
      4: tr('4) Block: ordering selected'),
      5: tr('5) Outcomes: who profits')
    };

    addEvent('info', tr('Sandwich phase: {{p}}', { p: phaseName[sandwich.phase] }));

    if (!sandwich.publicMempool) {
      addEvent('success', tr('Private submission: searchers can’t see the tx in the public mempool.'));
      setQuest((q) => ({ ...q, avoidedSandwichWithPrivate: true }));
    } else {
      addEvent('info', tr('Public mempool: victim swap is visible before inclusion.'));
    }

    if (comp.victimReverted) {
      addEvent('warn', tr('Victim reverted: output {{out}} < minOut {{min}}.', { out: fmt(comp.victimOutActual, 0), min: fmt(comp.victimMinOut, 0) }));
      setQuest((q) => ({ ...q, sawVictimRevert: true }));
    }

    if (comp.searcherWillAttack) {
      addEvent('info', tr('Searcher detected a profitable sandwich and built a bundle.'));
      addEvent(comp.searcherNetProfitEth > 0 ? 'success' : 'warn', tr('Searcher net profit: {{p}} ETH.', { p: fmt(comp.searcherNetProfitEth, 4) }));
      if (comp.searcherNetProfitEth > 0) setQuest((q) => ({ ...q, sawSandwichProfit: true }));
    } else if (sandwich.publicMempool) {
      addEvent('info', tr('Not profitable: searcher passes (gas / liquidity / slippage constraints).'));
    }
  }

  const tabs: Array<{ id: ModuleId; label: string; icon: React.ReactNode }> = useMemo(
    () => [
      { id: 'primer', label: tr('Primer'), icon: <HelpCircle size={16} /> },
      {
        id: 'sandwich',
        label: tr('Sandwich'),
        icon: <img src={new URL('../../public/icons/sandwich.png', import.meta.url).href} className="h-4 w-4" />
      },
      {
        id: 'arbitrage',
        label: tr('Arbitrage'),
        icon: <img src={new URL('../../public/icons/arbitrage.png', import.meta.url).href} className="h-4 w-4" />
      },
      {
        id: 'bundles',
        label: tr('Bundles'),
        icon: <img src={new URL('../../public/icons/bundle.png', import.meta.url).href} className="h-4 w-4" />
      },
      { id: 'pbs', label: tr('PBS'), icon: <Blocks size={16} /> },
      { id: 'advanced', label: tr('Advanced'), icon: <Shield size={16} /> }
    ],
    [tr]
  );

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white p-6">
      <LearningQuestsPortal>{questsUi}</LearningQuestsPortal>

      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">{tr('MEV & PBS Simulation')}</h1>
            <p className="mt-2 text-slate-300 max-w-3xl">
              {tr(
                'Explore MEV strategies (sandwiching, backrun arbitrage), then see how bundles, private transactions, and PBS (MEV-Boost) change who can extract value.'
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm whitespace-nowrap"
          >
            <RefreshCw size={16} /> {tr('Reset')}
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setModule(t.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm whitespace-nowrap ${
                module === t.id
                  ? 'border-blue-500/60 bg-blue-950/40 text-blue-100'
                  : 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {module === 'primer' ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                <SectionTitle icon={<Sparkles size={18} />} title={tr('Conceptual primer')} />
                <div className="mt-2 text-xs text-slate-400">
                  <span className="mr-2">MEV: <span className="text-slate-300">{define('MEV')}</span></span>
                  <span className="mr-2">PBS: <span className="text-slate-300">{define('PBS')}</span></span>
                </div>
                <div className="mt-4 text-slate-300 space-y-3 text-sm leading-6">
                  <p>
                    {tr(
                      'MEV (Maximal Extractable Value) is extra profit someone can extract by changing transaction ordering inside a block (beyond normal fees and rewards).'
                    )}
                  </p>
                  <p>
                    {tr(
                      'PBS (Proposer-Builder Separation) changes who builds blocks: builders compete to create the most valuable block, then the proposer picks the highest bid without seeing the full contents.'
                    )}
                  </p>
                </div>
              </div>
            ) : null}

            {module === 'sandwich' ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                <SectionTitle icon={<TrendingDown size={18} />} title={tr('Module 1 — Sandwich attack')} />

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-100">{tr('Parameters')}</div>
                      <Tooltip
                        text={tr(
                          'A sandwich is a 3-tx pattern: front-run (buy), victim swap, back-run (sell). It works because the victim’s trade moves the AMM price.'
                        )}
                      />
                    </div>

                    <div className="mt-3 space-y-3 text-sm">
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Victim swap size (ETH)')}</span>
                        <input
                          type="number"
                          value={sandwich.victimSwapEth}
                          onChange={(e) =>
                            setSandwich((s) => ({ ...s, victimSwapEth: clamp(Number(e.target.value), 0.1, 200) }))
                          }
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Slippage tolerance (%)')}</span>
                        <input
                          type="number"
                          step="0.1"
                          value={sandwich.slippageTolPct}
                          onChange={(e) =>
                            setSandwich((s) => ({ ...s, slippageTolPct: clamp(Number(e.target.value), 0.05, 20) }))
                          }
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Pool liquidity (ETH)')}</span>
                        <input
                          type="number"
                          step="50"
                          value={sandwich.poolLiquidityEth}
                          onChange={(e) =>
                            setSandwich((s) => ({ ...s, poolLiquidityEth: clamp(Number(e.target.value), 100, 20_000) }))
                          }
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Gas price (gwei)')}</span>
                        <input
                          type="number"
                          step="1"
                          value={sandwich.gasPriceGwei}
                          onChange={(e) =>
                            setSandwich((s) => ({ ...s, gasPriceGwei: clamp(Number(e.target.value), 0, 2000) }))
                          }
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Other mempool sell (ETH)')}</span>
                        <input
                          type="number"
                          step="1"
                          value={sandwich.otherMempoolSellEth}
                          onChange={(e) =>
                            setSandwich((s) => ({ ...s, otherMempoolSellEth: clamp(Number(e.target.value), 0, 100) }))
                          }
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Submission')}</span>
                        <button
                          type="button"
                          onClick={() => setSandwich((s) => ({ ...s, publicMempool: !s.publicMempool }))}
                          className={`px-2 py-1 rounded border text-xs ${
                            sandwich.publicMempool
                              ? 'border-rose-500/40 bg-rose-950/20 text-rose-200'
                              : 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                          }`}
                        >
                          {sandwich.publicMempool ? tr('Public mempool') : tr('Private bundle')}
                        </button>
                      </label>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={runSandwichOnce}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/50 bg-blue-950/40 hover:bg-blue-900 text-sm"
                      >
                        <ChevronRight size={16} /> {tr('Step')}
                      </button>
                      <div className="text-xs text-slate-400 self-center">t={tStep}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-100">{tr('Block ordering')}</div>
                      <Tooltip text={tr('In public mempool, searchers can inject txs around the victim. In private flow, the victim is hidden until inclusion.')} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(sandwich.last.ordering.length ? sandwich.last.ordering : computeSandwich(sandwich).ordering).map((tx, idx) => (
                        <div
                          key={idx}
                          className={`px-3 py-2 rounded-lg border text-xs ${
                            tx.who.startsWith('Searcher')
                              ? 'border-amber-500/40 bg-amber-950/20 text-amber-200'
                              : tx.who === 'Victim'
                                ? 'border-rose-500/40 bg-rose-950/20 text-rose-200'
                                : 'border-slate-700 bg-slate-950/30 text-slate-200'
                          }`}
                        >
                          <div className="font-semibold">{tx.who}</div>
                          <div className="text-[11px] text-slate-300/80">
                            {tx.kind === 'sell_eth' ? tr('sell ETH → buy USDC') : tr('sell USDC → buy ETH')}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                      <div className="text-xs text-slate-400 mb-2">{tr('Outcomes (last run)')}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-slate-300">{tr('Victim received')}</div>
                        <div className="font-mono text-right text-slate-100">
                          {sandwich.last.victimReverted ? tr('REVERT') : `${fmt(sandwich.last.victimOutActual, 0)} USDC`}
                        </div>
                        <div className="text-slate-300">{tr('Victim minOut')}</div>
                        <div className="font-mono text-right text-slate-100">{fmt(sandwich.last.victimMinOut, 0)} USDC</div>
                        <div className="text-slate-300">{tr('Searcher net')}</div>
                        <div className={`font-mono text-right ${sandwich.last.searcherProfitEth >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
                          {fmt(sandwich.last.searcherProfitEth, 4)} ETH
                        </div>
                        <div className="text-slate-300">{tr('LP fees (proxy)')}</div>
                        <div className="font-mono text-right text-slate-100">{fmt(sandwich.last.lpFeesEth, 4)} ETH</div>
                        <div className="text-slate-300">{tr('Validator tip (proxy)')}</div>
                        <div className="font-mono text-right text-slate-100">{fmt(sandwich.last.validatorTipEth, 4)} ETH</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {module === 'arbitrage' ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                <SectionTitle icon={<ArrowLeftRight size={18} />} title={tr('Module 2 — Backrun arbitrage')} />

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-100">{tr('Parameters')}</div>
                      <Tooltip text={tr('A backrun arbitrage captures a temporary price discrepancy after a victim trade.')} />
                    </div>

                    <div className="mt-3 space-y-3 text-sm">
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Reference price ($/ETH)')}</span>
                        <input
                          type="number"
                          value={arb.priceRef}
                          onChange={(e) => setArb((s) => ({ ...s, priceRef: clamp(Number(e.target.value), 200, 20_000) }))}
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Venue B price ($/ETH)')}</span>
                        <input
                          type="number"
                          value={arb.venueBPrice}
                          onChange={(e) => setArb((s) => ({ ...s, venueBPrice: clamp(Number(e.target.value), 200, 20_000) }))}
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Venue A liquidity (ETH)')}</span>
                        <input
                          type="number"
                          step="50"
                          value={arb.venueALiquidityEth}
                          onChange={(e) =>
                            setArb((s) => ({ ...s, venueALiquidityEth: clamp(Number(e.target.value), 50, 20_000) }))
                          }
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Victim sells (ETH)')}</span>
                        <input
                          type="number"
                          step="0.5"
                          value={arb.victimSellEth}
                          onChange={(e) => setArb((s) => ({ ...s, victimSellEth: clamp(Number(e.target.value), 0, 200) }))}
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Max searcher size (ETH)')}</span>
                        <input
                          type="number"
                          step="1"
                          value={arb.maxSearcherEth}
                          onChange={(e) => setArb((s) => ({ ...s, maxSearcherEth: clamp(Number(e.target.value), 0, 200) }))}
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-slate-300">{tr('Gas price (gwei)')}</span>
                        <input
                          type="number"
                          step="1"
                          value={arb.gasPriceGwei}
                          onChange={(e) => setArb((s) => ({ ...s, gasPriceGwei: clamp(Number(e.target.value), 0, 2000) }))}
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono"
                        />
                      </label>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-400">{tr('Phase')} {arb.phase}/4</div>
                        <div className="text-[11px] text-slate-500">t={tStep}</div>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-1">
                        {([1, 2, 3, 4] as const).map((p) => (
                          <div
                            key={p}
                            className={`h-2 rounded ${
                              arb.phase === p
                                ? 'bg-blue-400'
                                : arb.phase > p
                                  ? 'bg-blue-400/40'
                                  : 'bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={runArbOnce}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/50 bg-blue-950/40 hover:bg-blue-900 text-sm"
                        >
                          <ChevronRight size={16} /> {tr('Step')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setArb((s) => ({ ...s, phase: 1, last: { ...s.last, ordering: [] } }));
                            addEvent('info', tr('Arbitrage phase reset.'));
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
                        >
                          <RefreshCw size={16} /> {tr('Reset phase')}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-100">{tr('Ordering & outcomes')}</div>
                      <Tooltip text={tr('Backrun: the searcher’s trade is placed immediately after the victim to capture the transient price discrepancy.')} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(arb.last.ordering.length ? arb.last.ordering : computeArb(arb).ordering).map((tx, idx) => (
                        <div
                          key={idx}
                          className={`px-3 py-2 rounded-lg border text-xs ${
                            tx.who.startsWith('Searcher')
                              ? 'border-amber-500/40 bg-amber-950/20 text-amber-200'
                              : 'border-rose-500/40 bg-rose-950/20 text-rose-200'
                          }`}
                        >
                          <div className="font-semibold">{tx.who}</div>
                          <div className="text-[11px] text-slate-300/80">{tx.detail}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                      <div className="text-xs text-slate-400 mb-2">{tr('Outcomes (last run)')}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-slate-300">{tr('Venue A price')}</div>
                        <div className="font-mono text-right text-slate-100">${fmt(arb.last.priceA1, 0)}</div>
                        <div className="text-slate-300">{tr('Venue A after arb')}</div>
                        <div className="font-mono text-right text-slate-100">${fmt(arb.last.priceA2, 0)}</div>
                        <div className="text-slate-300">{tr('Searcher size')}</div>
                        <div className="font-mono text-right text-slate-100">{fmt(arb.last.searcherSizeEth, 2)} ETH</div>
                        <div className="text-slate-300">{tr('Gross profit')}</div>
                        <div className="font-mono text-right text-slate-100">{fmt(arb.last.grossProfitEth, 4)} ETH</div>
                        <div className="text-slate-300">{tr('Fees (proxy)')}</div>
                        <div className="font-mono text-right text-slate-100">{fmt(arb.last.feeCostEth, 4)} ETH</div>
                        <div className="text-slate-300">{tr('Gas cost')}</div>
                        <div className="font-mono text-right text-slate-100">{fmt(arb.last.gasCostEth, 4)} ETH</div>
                        <div className="text-slate-300">{tr('Net profit')}</div>
                        <div className={`font-mono text-right ${arb.last.netProfitEth >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{fmt(arb.last.netProfitEth, 4)} ETH</div>
                      </div>

                      <div className="mt-3 text-[11px] text-slate-300">
                        {tr('Profitability threshold: arb must beat fees + gas. Try increasing the venue price gap or reducing gas price.')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : module === 'bundles' ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                <SectionTitle icon={<Lock size={18} />} title={tr('Module 3 — Bundles & private transactions')} />

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-100">{tr('What is a bundle?')}</div>
                      <Tooltip text={tr('A bundle is an ordered list of txs sent privately to builders. It is atomic: all txs land in order, or none do.')} />
                    </div>

                    <div className="mt-3 text-sm text-slate-300 space-y-2 leading-6">
                      <p>{tr('Bundles are invisible to the public mempool until included in a block.')}</p>
                      <p>{tr('This prevents other bots from reacting to your transaction before inclusion (e.g., sandwiching).')}</p>
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-200">{tr('Bundle anatomy (eth_sendBundle)')}</div>
                        <button
                          type="button"
                          onClick={() => {
                            const txt = JSON.stringify(
                              {
                                jsonrpc: '2.0',
                                method: 'eth_sendBundle',
                                params: [
                                  {
                                    txs: ['0x<signed_tx_1>', '0x<signed_tx_2>', '0x<signed_tx_3>'],
                                    blockNumber: '0xE9A5C0',
                                    minTimestamp: 0,
                                    maxTimestamp: 1700000000,
                                    revertingTxHashes: []
                                  }
                                ]
                              },
                              null,
                              2
                            );
                            navigator.clipboard.writeText(txt).then(
                              () => addEvent('success', tr('Copied bundle JSON to clipboard.')),
                              () => addEvent('warn', tr('Copy failed (clipboard permission).'))
                            );
                          }}
                          className="px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                        >
                          {tr('Copy')}
                        </button>
                      </div>
                      <pre className="mt-2 text-[11px] leading-4 text-slate-200 overflow-auto">
{`{
  "jsonrpc": "2.0",
  "method": "eth_sendBundle",
  "params": [{
    "txs": [
      "0x<signed_tx_1>",
      "0x<signed_tx_2>",
      "0x<signed_tx_3>"
    ],
    "blockNumber": "0xE9A5C0",
    "minTimestamp": 0,
    "maxTimestamp": 1700000000,
    "revertingTxHashes": []
  }]
}`}
                      </pre>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-100">{tr('Public vs private (MEV-Protect)')}</div>
                      <Tooltip text={tr('Private transactions are the single-tx version: your swap never appears in the public mempool, making sandwiching impossible.')} />
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-rose-500/30 bg-rose-950/10 p-3">
                        <div className="text-xs font-semibold text-rose-200">{tr('Public mempool')}</div>
                        <div className="mt-2 text-xs text-slate-300">{tr('Tx is visible → searchers can front-run/back-run.')}</div>
                        <div className="mt-2 text-xs text-slate-300">{tr('Sandwich risk: HIGH')}</div>
                      </div>
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-3">
                        <div className="text-xs font-semibold text-emerald-200">{tr('Private tx / bundle')}</div>
                        <div className="mt-2 text-xs text-slate-300">{tr('Invisible until inclusion → no reactive sandwiching.')}</div>
                        <div className="mt-2 text-xs text-slate-300">{tr('Sandwich risk: LOW')}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-xs text-slate-400 mb-2">{tr('Bundle atomicity (failure example)')}</div>
                      <div className="text-xs text-slate-300 leading-5">
                        {tr('If any tx inside a bundle reverts and you did not allow it, the entire bundle is dropped (all-or-nothing).')}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            addEvent('warn', tr('Bundle dropped: tx #2 reverted. No txs from the bundle were included.'));
                          }}
                          className="px-2.5 py-2 rounded-lg border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/20 text-rose-200"
                        >
                          {tr('Simulate revert inside bundle')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addEvent('info', tr('Bundle succeeds: all txs included in order (atomic).'));
                          }}
                          className="px-2.5 py-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/20 text-emerald-200"
                        >
                          {tr('Simulate successful bundle')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-xs text-slate-400 mb-2">{tr('Try it (reuses Sandwich params)')}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSandwich((s) => ({ ...s, publicMempool: true, phase: 1 }));
                            addEvent('info', tr('Set Sandwich submission to public mempool.'));
                          }}
                          className="px-2.5 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
                        >
                          {tr('Set public')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSandwich((s) => ({ ...s, publicMempool: false, phase: 1 }));
                            setQuest((q) => ({ ...q, avoidedSandwichWithPrivate: true }));
                            addEvent('success', tr('Set Sandwich submission to private bundle (no sandwich).'));
                          }}
                          className="px-2.5 py-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/20 text-emerald-200"
                        >
                          {tr('Set private')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            runSandwichOnce();
                            if (!sandwich.publicMempool) setQuest((q) => ({ ...q, avoidedSandwichWithPrivate: true }));
                          }}
                          className="px-2.5 py-2 rounded-lg border border-blue-500/40 bg-blue-950/30 hover:bg-blue-900/30 text-blue-200"
                        >
                          {tr('Run 1 sandwich step')}
                        </button>
                      </div>
                      <div className="mt-3 text-xs text-slate-300">
                        {tr('If you run the same swap privately, the searcher cannot observe it in the mempool, so the ordering becomes just: victim (and maybe unrelated txs).')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : module === 'pbs' ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                <SectionTitle icon={<Blocks size={18} />} title={tr('Module 4 — PBS (MEV-Boost) auction')} />

                <div className="mt-3 text-sm text-slate-300 leading-6">
                  {tr(
                    'Builders compete to produce the most valuable block. They send a sealed header + bid to a relay. The proposer picks the highest bid and signs blindly. Then the payload is revealed.'
                  )}
                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-xs text-slate-300">
                    <div className="font-semibold text-slate-100 mb-1">{tr('Why PBS exists')}</div>
                    <ul className="list-disc list-inside space-y-1">
                      <li>{tr('Reduces validator complexity: proposers don\'t need to run sophisticated MEV infrastructure.')}</li>
                      <li>{tr('Turns MEV into a transparent auction: builders bid for the right to build the block.')}</li>
                      <li>{tr('Proposer picks based on bid without seeing full contents (blinded header).')}</li>
                    </ul>
                    <div className="mt-2 text-slate-400">
                      {tr('Actors: Builder → Relay → Proposer → Network.')} {define('Builder')} / {define('Relay')} / {define('Proposer')}
                    </div>
                  </div>
                </div>

                {/* PBS state */}
                <PbsModule
                  tr={tr}
                  addEvent={addEvent}
                  onQuest={() => setQuest((q) => ({ ...q, sawPbsWinner: true }))}
                />
              </div>
            ) : module !== 'primer' && module !== 'sandwich' && module !== 'arbitrage' && module !== 'bundles' ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                <SectionTitle icon={<Circle size={18} />} title={tr('More scenarios coming soon')} />
                <div className="mt-3 text-sm text-slate-300">
                  {tr('This demo intentionally focuses on the four core modules. More scenarios can be added later (e.g., cross-domain MEV, liquidation MEV, multi-relay dynamics).')}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
              <h2 className="text-2xl font-bold mb-4 text-blue-300">🌐 {tr('Real-World Applications')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                  <div className="font-semibold text-emerald-200">{tr('MEV-Protection for traders')}</div>
                  <div className="mt-1 text-slate-300">
                    {tr('Private RPCs can reduce sandwich risk for swaps by hiding your order from the public mempool.')}
                  </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                  <div className="font-semibold text-amber-200">{tr('Searchers & competition')}</div>
                  <div className="mt-1 text-slate-300">{tr('In practice, multiple bots compete, pushing profits down and gas bids up.')}</div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                  <div className="font-semibold text-blue-200">{tr('PBS & validator incentives')}</div>
                  <div className="mt-1 text-slate-300">
                    {tr('PBS auctions turn MEV into predictable bids paid to validators, but raise centralization questions.')}
                  </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                  <div className="font-semibold text-rose-200">{tr('Protocol design')}</div>
                  <div className="mt-1 text-slate-300">
                    {tr('Ordering rules, auctions, and privacy choices reshape who captures value in blockspace markets.')}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
              <h2 className="text-2xl font-bold mb-4 text-blue-300">📚 {tr('Further Reading')}</h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    className="text-blue-300 hover:text-blue-200 underline"
                    href="https://flashbots.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tr('Flashbots →')}
                  </a>
                </li>
                <li>
                  <a
                    className="text-blue-300 hover:text-blue-200 underline"
                    href="https://docs.flashbots.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tr('Flashbots docs (bundles, MEV-Boost) →')}
                  </a>
                </li>
                <li>
                  <a
                    className="text-blue-300 hover:text-blue-200 underline"
                    href="https://ethereum.org/en/roadmap/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tr('Ethereum roadmap (PBS context) →')}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
              <SectionTitle icon={<Shield size={18} />} title={tr('Event log')} />
              <div className="mt-3 space-y-2">
                {events.length === 0 ? (
                  <div className="text-sm text-slate-400">{tr('No events yet. Use Step in a module.')}</div>
                ) : (
                  events.map((e) => (
                    <div key={e.id} className="text-sm">
                      <div className="text-[11px] text-slate-500">t={e.t}</div>
                      <div
                        className={
                          e.type === 'success'
                            ? 'text-emerald-200'
                            : e.type === 'warn'
                              ? 'text-amber-200'
                              : e.type === 'error'
                                ? 'text-rose-200'
                                : 'text-slate-200'
                        }
                      >
                        {e.msg}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
