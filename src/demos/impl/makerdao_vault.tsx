// Minting DAI: MakerDAO vaults and liquidations.
// Spec: specification/MakerDAO_simulation_scenario.md (with Liquidations 2.0 accuracy fixes:
// only the ETH needed for debt + penalty is sold, the rest is returned; crashes can leave bad debt).
// State lives in a pure reducer (./makerdao_vault/model.ts) so every rule is unit-tested.
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Clock,
  Coins,
  Flame,
  Globe,
  Landmark,
  Lightbulb,
  ListOrdered,
  ScrollText,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
  Vault as VaultIcon,
  Wallet as WalletIcon,
  Zap
} from 'lucide-react';
import EduTooltip from '../../ui/EduTooltip';
import LinkWithCopy from '../../ui/LinkWithCopy';
import { define } from '../glossary';
import { NextQuestCard, QuestList, useDemoQuests } from '../quests/DemoQuests';
import { useDemoI18n } from '../useDemoI18n';
import { HealthBar, PriceChart, StressTest, fmtNum, fmtPct, fmtUsd, useLang } from './makerdao_vault/charts';
import {
  checkAction,
  collateralValue,
  initialState,
  liquidationPrice,
  maxMint,
  maxWithdraw,
  ratio,
  reducer,
  type LogEntry,
  type MarketEvent,
  type RefusalReason,
  type ScenarioId,
  type VaultActionKind
} from './makerdao_vault/model';

const FURTHER_READING = [
  { label: 'Maker docs: Liquidation 2.0 module (Dog and Clipper)', href: 'https://docs.makerdao.com/smart-contract-modules/dog-and-clipper-detailed-documentation' },
  { label: 'Maker docs: Oracle Security Module (the one-hour price delay)', href: 'https://docs.makerdao.com/smart-contract-modules/oracle-module/oracle-security-module-osm-detailed-documentation' },
  { label: 'The Maker Protocol whitepaper', href: 'https://makerdao.com/en/whitepaper/' },
  { label: 'Glassnode: what really happened to MakerDAO on Black Thursday', href: 'https://insights.glassnode.com/what-really-happened-to-makerdao/' },
  { label: 'Sky (formerly MakerDAO): the protocol today', href: 'https://sky.money/' }
];

const SCENARIOS: ScenarioId[] = ['base', 'safe', 'aggressive', 'crash', 'reaction'];


type Flow = { key: number; dir: 'in' | 'out'; text: string; tone: 'eth' | 'dai' };

export default function MakerDaoVaultDemo() {
  const { tr } = useDemoI18n('makerdao-vault');
  const { lang } = useLang();
  const [s, dispatch] = useReducer(reducer, undefined, initialState);
  const [ethAmount, setEthAmount] = useState('0.5');
  const [daiAmount, setDaiAmount] = useState('200');
  const [advanced, setAdvanced] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flash, setFlash] = useState(false);
  const [stressDone, setStressDone] = useState(false);
  const flowKey = useRef(0);

  const { vault, wallet, oraclePrice, marketPrice, params } = s;
  const cr = ratio(vault, oraclePrice);
  const lp = liquidationPrice(vault, params.lr);
  const pending = Math.abs(oraclePrice - marketPrice) > 1e-9;
  const mintMax = maxMint(vault, oraclePrice, params.lr);
  const withdrawMax = maxWithdraw(vault, oraclePrice, params.lr);
  const usd = (n: number) => fmtUsd(n, lang);
  const num = (n: number, d = 2) => fmtNum(n, lang, d);

  // Flash the vault red on a new liquidation.
  // (Any other change, e.g. loading a scenario, ends the flash at once; the cleanup would
  // otherwise cancel the timer and leave it red.)
  const lastLiq = useRef(s.lastLiquidation);
  useEffect(() => {
    const isNew = !!s.lastLiquidation && s.lastLiquidation !== lastLiq.current;
    lastLiq.current = s.lastLiquidation;
    if (!isNew) {
      setFlash(false);
      return;
    }
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 2400);
    return () => window.clearTimeout(t);
  }, [s.lastLiquidation]);

  const act = (kind: VaultActionKind, raw: string) => {
    const amount = Number(raw.replace(',', '.'));
    if (!checkAction(s, kind, amount)) {
      const eth = kind === 'deposit' || kind === 'withdraw';
      const shown = kind === 'repay' ? Math.min(amount, vault.debt) : amount;
      setFlow({
        key: ++flowKey.current,
        dir: kind === 'deposit' || kind === 'repay' ? 'in' : 'out',
        text: `${kind === 'deposit' || kind === 'mint' ? '+' : '−'}${num(shown, eth ? 4 : 2)} ${eth ? 'ETH' : 'DAI'}`,
        tone: eth ? 'eth' : 'dai'
      });
    }
    dispatch({ type: kind, amount });
  };

  const loadScenario = useCallback((id: ScenarioId) => dispatch({ type: 'scenario', id }), []);

  // ---- Quests --------------------------------------------------------------------------------
  const q = useDemoQuests(
    'makerdao-vault',
    [
      {
        id: 'mint',
        text: tr('Mint DAI and watch your ratio drop'),
        tip: tr('Click “Mint DAI”: new DAI appears in your wallet, your collateral ratio falls and your liquidation price rises.'),
        done: s.progress.minted,
        target: 'mint-btn'
      },
      {
        id: 'limit',
        text: tr('Try to mint more than the 150% limit allows'),
        tip: tr('Type a DAI amount above the “max” shown under the field and click “Mint DAI”: the protocol refuses.'),
        done: s.progress.refused,
        target: 'dai-amount'
      },
      {
        id: 'survive',
        text: tr('Survive a 30% ETH drop'),
        tip: tr('Load “Safe user” (or add ETH or repay DAI first), then click “ETH −30%”.'),
        done: s.progress.survivedDrop,
        target: 'scenario-safe'
      },
      {
        id: 'liquidated',
        text: tr('Get liquidated and see what you lose'),
        tip: tr('Click “Flash crash −50%” with an open vault, then read the liquidation breakdown.'),
        done: s.progress.liquidated,
        target: 'event-flash'
      },
      {
        id: 'stress',
        text: tr('Find the day your vault would be liquidated'),
        tip: tr('In the time slider, drag the day forward until the price crosses your liquidation price.'),
        done: stressDone,
        target: 'stress-slider'
      },
      {
        id: 'rescue',
        text: tr('Save a vault before the oracle updates'),
        tip: tr('Load “User reaction”: the oracle will report a lower price in one hour. Add ETH or repay DAI, then click “Let one hour pass”.'),
        done: s.progress.rescued,
        target: 'scenario-reaction'
      },
      {
        id: 'crash',
        text: tr('Watch a market crash liquidate other vaults'),
        tip: tr('Load “Market crash” and click “Flash crash −50%”: see which of the other vaults go under, and the bad debt left behind.'),
        done: s.progress.crashSeen,
        target: 'scenario-crash'
      }
    ]
  );

  const scenarioLabel: Record<ScenarioId, string> = {
    base: tr('Starting vault'),
    safe: tr('Safe user'),
    aggressive: tr('Aggressive user'),
    crash: tr('Market crash'),
    reaction: tr('User reaction')
  };
  const scenarioIntro: Record<ScenarioId, string> = {
    base: tr('You locked 1 ETH (worth $2,000) and minted 1,000 DAI: a 200% collateral ratio. Below 150%, the vault gets liquidated.'),
    safe: tr('Low debt, big buffer: 10 ETH backing 5,000 DAI (400%). This vault can take two 30% drops in a row.'),
    aggressive: tr('High debt: 1 ETH backing 1,250 DAI (160%). A dip of just 6% reaches the liquidation price.'),
    crash: tr('Your vault plus eight others, from 160% to 420%. Hit “Flash crash −50%” and watch the whole system.'),
    reaction: tr('ETH just fell to $1,500, but the protocol’s oracle reports prices with a one-hour delay. At $1,500 your vault would be at 136%: act before the hour passes!')
  };

  const refusalText = (reason: RefusalReason, action: VaultActionKind) =>
    ({
      amount: tr('Enter an amount greater than zero.'),
      'wallet-eth': tr('You don’t have that much ETH in your wallet.'),
      'wallet-dai': tr('You don’t have enough DAI in your wallet to repay that.'),
      'vault-eth': tr('The vault doesn’t hold that much ETH.'),
      unsafe:
        action === 'mint'
          ? tr('Refused: minting that much would push your ratio below {{lr}}. The protocol never lets you open an unsafe position. Max right now: {{max}} DAI.', {
              lr: fmtPct(params.lr),
              max: num(Math.floor(mintMax * 100) / 100)
            })
          : tr('Refused: withdrawing that much would push your ratio below {{lr}}. Max right now: {{max}} ETH.', {
              lr: fmtPct(params.lr),
              max: num(Math.floor(withdrawMax * 10000) / 10000, 4)
            }),
      'no-debt': tr('This vault has no debt to repay.')
    })[reason];

  const logText = (e: LogEntry): string => {
    switch (e.kind) {
      case 'deposit':
        return tr('Deposited {{n}} ETH into the vault', { n: num(e.amount, 4) });
      case 'withdraw':
        return tr('Withdrew {{n}} ETH from the vault', { n: num(e.amount, 4) });
      case 'mint':
        return tr('Minted {{n}} new DAI', { n: num(e.amount) });
      case 'repay':
        return tr('Repaid (burned) {{n}} DAI', { n: num(e.amount) });
      case 'market':
        return e.pending
          ? tr('Market: ETH {{from}} → {{to}} (the oracle will report it in one hour)', { from: usd(e.from), to: usd(e.to) })
          : tr('Market: ETH {{from}} → {{to}}', { from: usd(e.from), to: usd(e.to) });
      case 'oracle':
        return tr('One hour later: the oracle now reports {{to}} (was {{from}})', { from: usd(e.from), to: usd(e.to) });
      case 'liquidation':
        return tr('Your vault was liquidated: {{sold}} ETH sold, {{back}} ETH returned to you', { sold: num(e.result.soldEth, 4), back: num(e.result.returnedEth, 4) });
      case 'others':
        return e.badDebt > 0
          ? tr('{{n}} other vaults liquidated, leaving {{bad}} DAI of bad debt', { n: e.count, bad: num(e.badDebt, 0) })
          : tr('{{n}} other vaults liquidated', { n: e.count });
      case 'refused':
        return tr('Refused: {{why}}', { why: refusalText(e.reason, e.action) });
      case 'scenario':
        return tr('Scenario loaded: {{name}}', { name: scenarioLabel[e.scenario] });
    }
  };

  const eventButton = (ev: MarketEvent, label: string, Icon: typeof TrendingDown, cls: string) => (
    <button
      type="button"
      data-hint={`event-${ev}`}
      onClick={() => dispatch({ type: 'market', event: ev })}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${cls} ${q.pulse(`event-${ev}`)}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  const liq = s.lastLiquidation;
  const othersLiquidated = s.others.filter((o) => o.liquidation);
  const othersBadDebt = othersLiquidated.reduce((t, o) => t + o.liquidation!.badDebt, 0);
  const ch = s.lastChange;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 text-slate-100 md:p-6">
      <style>{`@keyframes mkIn{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:calc(100% - 5.5rem);opacity:0}}@keyframes mkOut{0%{left:calc(100% - 5.5rem);opacity:0}15%{opacity:1}85%{opacity:1}100%{left:0;opacity:0}}`}</style>
      <div aria-live="polite" className="sr-only">
        {s.log[0] ? logText(s.log[0]) : ''}
      </div>
      <QuestList q={q} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{tr('Minting DAI: MakerDAO Vaults & Liquidations')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">
            {tr('Lock ETH in a vault, mint DAI against it, then let the market move. Watch your collateral ratio, your liquidation price, and what a liquidation really costs.')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdvanced((a) => !a)}
          aria-pressed={advanced}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs ${
            advanced ? 'border-purple-500 bg-purple-500/20 text-purple-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <SlidersHorizontal size={14} />
          {advanced ? tr('Advanced: on') : tr('Advanced')}
        </button>
      </header>

      {/* Scenarios */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">{tr('Scenario:')}</span>
        {SCENARIOS.map((id) => (
          <button
            key={id}
            type="button"
            data-hint={`scenario-${id}`}
            onClick={() => loadScenario(id)}
            aria-pressed={s.scenario === id}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
              s.scenario === id ? 'border-blue-500 bg-blue-500/20 text-blue-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            } ${q.pulse(`scenario-${id}`)}`}
          >
            {scenarioLabel[id]}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 px-4 py-3 text-sm text-slate-200">{scenarioIntro[s.scenario]}</div>

      <NextQuestCard q={q} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ===== Wallet + vault ===== */}
        <section className={`rounded-xl border p-4 transition-colors ${flash ? 'border-red-500 bg-red-950/40 motion-safe:animate-pulse' : 'border-slate-800 bg-slate-900/40'}`}>
          <div className="grid grid-cols-[1fr_4.5rem_1fr] items-stretch gap-2 sm:grid-cols-[1fr_7rem_1fr]">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <WalletIcon size={14} className="text-blue-300" />
                {tr('Your wallet')}
              </div>
              <div className="mt-2 font-mono text-sm">
                <div>{num(wallet.eth, 4)} ETH</div>
                <div className="text-amber-200">{num(wallet.dai)} DAI</div>
              </div>
            </div>
            {/* flow lane */}
            <div className="relative overflow-hidden" aria-hidden>
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-700" />
              {flow ? (
                <span
                  key={flow.key}
                  className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    flow.tone === 'eth' ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950'
                  }`}
                  style={{ animation: `${flow.dir === 'in' ? 'mkIn' : 'mkOut'} 1100ms ease-in-out forwards`, width: '5.5rem', textAlign: 'center' }}
                >
                  {flow.text}
                </span>
              ) : null}
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3" data-hint="vault">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <VaultIcon size={14} className="text-emerald-300" />
                {tr('Your vault')}
                <EduTooltip text={define('Vault (CDP)')} />
              </div>
              <div className="mt-2 font-mono text-sm">
                <div>
                  {num(vault.eth, 4)} ETH <span className="text-xs text-slate-500">({usd(collateralValue(vault, oraclePrice))})</span>
                </div>
                <div className="text-amber-200">
                  {tr('Debt: {{n}} DAI', { n: num(vault.debt) })}
                </div>
              </div>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <Stat
              label={
                <>
                  {tr('Collateral ratio')} <EduTooltip text={define('Collateral Ratio')} />
                </>
              }
              value={fmtPct(cr)}
              tone={!Number.isFinite(cr) ? 'slate' : cr < params.lr ? 'red' : cr < params.lr + 0.3 ? 'amber' : 'green'}
            />
            <Stat
              label={
                <>
                  {tr('Liquidation price')} <EduTooltip text={define('Liquidation Price')} />
                </>
              }
              value={lp > 0 ? usd(lp) : '—'}
              tone="red"
            />
            <Stat label={tr('Can still mint')} value={`${num(Math.floor(mintMax * 100) / 100)} DAI`} tone="slate" />
          </dl>

          <div className="mt-3">
            <HealthBar cr={cr} lr={params.lr} pulse={q.pulse('health')} />
          </div>

          {/* Actions */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <label className="text-xs text-slate-400" htmlFor="mk-eth">
                {tr('ETH amount')}
              </label>
              <input
                id="mk-eth"
                inputMode="decimal"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-sm"
              />
              <div className="mt-1 text-[11px] text-slate-500">{tr('Max withdraw now: {{n}} ETH', { n: num(Math.floor(withdrawMax * 10000) / 10000, 4) })}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" data-hint="deposit-btn" onClick={() => act('deposit', ethAmount)} className={`inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-500 ${q.pulse('deposit-btn')}`}>
                  <ArrowDownToLine size={14} />
                  {tr('Deposit ETH')}
                </button>
                <button type="button" onClick={() => act('withdraw', ethAmount)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs hover:bg-slate-800">
                  <ArrowUpFromLine size={14} />
                  {tr('Withdraw ETH')}
                </button>
              </div>
            </div>
            <div data-hint="dai-amount" className={`rounded-lg border border-slate-800 bg-slate-950/40 p-3 ${q.pulse('dai-amount')}`}>
              <label className="text-xs text-slate-400" htmlFor="mk-dai">
                {tr('DAI amount')}
              </label>
              <input
                id="mk-dai"
                inputMode="decimal"
                value={daiAmount}
                onChange={(e) => setDaiAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-sm"
              />
              <div className="mt-1 text-[11px] text-slate-500">{tr('Max mint now: {{n}} DAI', { n: num(Math.floor(mintMax * 100) / 100) })}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-hint="mint-btn"
                  onClick={() => act('mint', daiAmount)}
                  className={`inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 ${q.pulse('mint-btn')}`}
                >
                  <Coins size={14} />
                  {tr('Mint DAI')}
                  <span onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                    <EduTooltip text={tr('You are minting new DAI: it didn’t exist before. It is still a debt: repaying burns it, and you only get your ETH back once the debt is repaid.')} />
                  </span>
                </button>
                <button type="button" onClick={() => act('repay', daiAmount)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs hover:bg-slate-800">
                  <Flame size={14} />
                  {tr('Repay DAI')}
                </button>
              </div>
            </div>
          </div>

          {s.refusal ? (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-800 bg-amber-950/40 p-2 text-xs text-amber-100">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {refusalText(s.refusal.reason, s.refusal.action)}
            </div>
          ) : null}
          {ch ? (
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-xs text-slate-300" data-testid="cause-effect">
              <span className="font-semibold text-slate-100">{logText({ id: 0, kind: ch.action, amount: ch.amount })}</span>
              {' → '}
              {tr('ratio {{a}} → {{b}}', { a: fmtPct(ch.before.ratio), b: fmtPct(ch.after.ratio) })}
              {' · '}
              {tr('liquidation price {{a}} → {{b}}', { a: ch.before.liqPrice > 0 ? usd(ch.before.liqPrice) : '—', b: ch.after.liqPrice > 0 ? usd(ch.after.liqPrice) : '—' })}
              {ch.after.liqPrice > ch.before.liqPrice ? (
                <span className="text-amber-200"> · {tr('closer to the current price ({{p}})', { p: usd(oraclePrice) })}</span>
              ) : ch.after.liqPrice < ch.before.liqPrice ? (
                <span className="text-emerald-300"> · {tr('further from the current price ({{p}})', { p: usd(oraclePrice) })}</span>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ===== Market ===== */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-xs text-slate-400">{tr('ETH market price')}</div>
              <div className="text-2xl font-bold">{usd(marketPrice)}</div>
            </div>
            {params.osm ? (
              <div className="text-right text-xs">
                <div className="text-purple-300">
                  {tr('Oracle price used by the protocol')} <EduTooltip text={define('Oracle Security Module')} />
                </div>
                <div className="font-mono text-base text-purple-100">{usd(oraclePrice)}</div>
              </div>
            ) : null}
          </div>
          {pending ? (
            <div className="mt-3 rounded-lg border border-purple-700 bg-purple-950/30 p-3 text-xs text-purple-100">
              <div className="flex items-center gap-1.5 font-semibold">
                <Clock size={14} />
                {tr('In one hour the oracle will report {{p}}.', { p: usd(marketPrice) })}
              </div>
              <div className="mt-1">
                {vault.debt > 0
                  ? tr('At that price your ratio will be {{r}} (liquidation below {{lr}}).', { r: fmtPct(ratio(vault, marketPrice)), lr: fmtPct(params.lr) })
                  : tr('Your vault has no debt, so it can’t be liquidated.')}
              </div>
              <button
                type="button"
                data-hint="advance"
                onClick={() => dispatch({ type: 'advanceOracle' })}
                className={`mt-2 inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold hover:bg-purple-500 ${q.pulse('advance')}`}
              >
                <Clock size={14} />
                {tr('Let one hour pass')}
              </button>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {eventButton('drop', tr('ETH −30%'), TrendingDown, 'bg-orange-700 hover:bg-orange-600')}
            {eventButton('pump', tr('ETH +30%'), TrendingUp, 'bg-emerald-700 hover:bg-emerald-600')}
            {eventButton('flash', tr('Flash crash −50%'), Zap, 'bg-red-700 hover:bg-red-600')}
          </div>
          <div className="mt-3">
            <PriceChart history={s.history} liqPrice={lp} oraclePrice={oraclePrice} pending={pending} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {tr('The dashed red line is your liquidation price. If the ETH price falls below it, your vault is liquidated.')}{' '}
            <EduTooltip text={tr('Your risk depends on the collateral ratio: how much your ETH is worth compared with the DAI you owe. Minting more or withdrawing ETH lowers it; repaying or adding ETH raises it.')} />
          </p>
        </section>
      </div>

      {/* Liquidation breakdown */}
      {liq ? (
        <section className="rounded-xl border border-red-800 bg-red-950/20 p-4" data-testid="liquidation">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-red-100">
            <AlertTriangle size={18} className="text-red-300" />
            {tr('Your vault was liquidated')}
            <EduTooltip text={tr('Liquidation sells your ETH automatically. Anyone can trigger it once your ratio is below the limit; an auction sells just enough ETH to repay the debt plus a penalty.')} />
          </h2>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Step n={1} title={tr('Debt + penalty')} text={tr('{{debt}} DAI + {{pct}} penalty = {{owed}} DAI to raise', { debt: num(liq.debt), pct: fmtPct(params.penalty), owed: num(liq.owed) })} />
            <Step n={2} title={tr('ETH sold at auction')} text={tr('{{sold}} ETH sold at {{price}}', { sold: num(liq.soldEth, 4), price: usd(liq.salePrice) })} />
            <Step n={3} title={tr('Debt repaid')} text={liq.badDebt > 0 ? tr('Only {{p}} DAI raised: the debt is not fully covered', { p: num(liq.proceeds) }) : tr('{{d}} DAI burned, vault closed', { d: num(liq.debt) })} />
            <Step n={4} title={tr('Back to you')} text={tr('{{eth}} ETH returned to your wallet. You keep the DAI you minted.', { eth: num(liq.returnedEth, 4) })} />
          </ol>
          <p className="mt-3 text-sm text-red-100">
            {liq.badDebt > 0
              ? tr('You lost all the ETH in the vault, but it was worth less than your debt. You keep the DAI you minted, so the loss lands on the protocol instead.')
              : tr('What it cost you: about {{loss}} worth of ETH more than repaying the debt yourself would have.', { loss: usd(liq.ownerLoss) })}
          </p>
          {liq.badDebt > 0 ? (
            <p className="mt-2 rounded-lg border border-red-700 bg-red-950/40 p-2 text-xs text-red-100">
              {tr('Bad debt: {{n}} DAI. The price fell so far that selling all the ETH didn’t repay the debt. Maker covers this from its surplus buffer, then by minting and selling new MKR.', { n: num(liq.badDebt) })}{' '}
              <EduTooltip text={define('Bad Debt')} />
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Other vaults */}
      {s.showOthers ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users size={18} className="text-blue-300" />
            {tr('Other vaults in the system')}
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {s.others.map((o) => {
              const orig = o.liquidation;
              const r0 = orig ? (orig.eth * oraclePrice) / orig.debt : ratio(o, oraclePrice);
              return (
                <div key={o.id} className={`rounded-lg border p-2 text-xs ${orig ? 'border-red-700 bg-red-950/30' : r0 < params.lr + 0.3 ? 'border-amber-700 bg-amber-950/20' : 'border-slate-800 bg-slate-950/50'}`}>
                  <div className="flex justify-between font-semibold">
                    <span>{o.name}</span>
                    <span>{orig ? tr('✗ liquidated') : fmtPct(r0)}</span>
                  </div>
                  <div className="mt-1 text-slate-400">
                    {orig
                      ? orig.badDebt > 0
                        ? tr('bad debt {{n}} DAI', { n: num(orig.badDebt, 0) })
                        : tr('{{n}} ETH returned', { n: num(orig.returnedEth, 3) })
                      : tr('{{eth}} ETH · {{debt}} DAI', { eth: num(o.eth), debt: num(o.debt, 0) })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-slate-300">
            {othersLiquidated.length === 0
              ? tr('No other vault has been liquidated yet.')
              : tr('{{n}} of 8 vaults liquidated. Total bad debt: {{bad}} DAI.', { n: othersLiquidated.length, bad: num(othersBadDebt, 0) })}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {tr('A sudden crash jumps straight past many liquidation prices. Vaults that were barely safe end up worth less than their debt, and the shortfall becomes the whole system’s problem.')}
          </p>
        </section>
      ) : null}

      <StressTest vault={vault} lr={params.lr} price={oraclePrice} onReachLiquidation={() => setStressDone(true)} pulse={q.pulse} />

      {/* Advanced */}
      {advanced ? (
        <section className="rounded-xl border border-purple-800/60 bg-purple-950/20 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-purple-100">
            <SlidersHorizontal size={18} />
            {tr('Advanced: risk parameters and market stress')}
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Range label={tr('Liquidation ratio: {{v}}', { v: fmtPct(params.lr) })} min={130} max={175} step={5} value={Math.round(params.lr * 100)} onChange={(v) => dispatch({ type: 'params', patch: { lr: v / 100 } })} hint={tr('Set by governance for each vault type (e.g. 150% for the classic ETH-A).')} />
            <Range label={tr('Liquidation penalty: {{v}}', { v: fmtPct(params.penalty) })} min={0} max={20} step={1} value={Math.round(params.penalty * 100)} onChange={(v) => dispatch({ type: 'params', patch: { penalty: v / 100 } })} hint={tr('Added to your debt when you are liquidated (13% was the long-standing ETH-A value).')} />
            <Range label={tr('Auction discount (congestion): {{v}}', { v: fmtPct(params.discount) })} min={0} max={50} step={5} value={Math.round(params.discount * 100)} onChange={(v) => dispatch({ type: 'params', patch: { discount: v / 100 } })} hint={tr('In a congested market, liquidators buy the ETH below its price, so more ETH is sold for the same debt.')} />
            <label className="flex items-start gap-2 text-xs text-slate-200">
              <input type="checkbox" checked={params.osm} onChange={(e) => dispatch({ type: 'params', patch: { osm: e.target.checked } })} className="mt-0.5" />
              <span>
                {tr('Oracle delay (one hour)')}
                <span className="block text-slate-400">{tr('Maker’s Oracle Security Module feeds prices one hour late, which gives vault owners (and governance) time to react.')}</span>
              </span>
            </label>
          </div>
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-300">
            <div>
              {tr('collateral value')} = {num(vault.eth, 4)} ETH × {usd(oraclePrice)} = {usd(collateralValue(vault, oraclePrice))}
            </div>
            <div>
              {tr('collateral ratio')} = {usd(collateralValue(vault, oraclePrice))} / {num(vault.debt)} DAI = {fmtPct(cr)}
            </div>
            <div>
              {tr('liquidation price')} = {num(vault.debt)} × {fmtPct(params.lr)} / {num(vault.eth, 4)} ETH = {lp > 0 ? usd(lp) : '—'}
            </div>
            <div>
              {tr('max mint')} = {usd(collateralValue(vault, oraclePrice))} / {fmtPct(params.lr)} − {num(vault.debt)} = {num(mintMax)} DAI
            </div>
            <div>
              {tr('ETH sold if liquidated')} = {tr('debt')} × (1 + {fmtPct(params.penalty)}) / ({tr('price')} × (1 − {fmtPct(params.discount)}))
            </div>
          </div>
        </section>
      ) : null}

      {/* Event log */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ScrollText size={18} className="text-slate-300" />
          {tr('Event log')}
        </h2>
        <ol className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
          {s.log.map((e) => (
            <li key={e.id} className={e.kind === 'liquidation' || e.kind === 'others' ? 'text-red-300' : e.kind === 'refused' ? 'text-amber-200' : 'text-slate-300'}>
              {logText(e)}
            </li>
          ))}
        </ol>
      </section>

      {/* Key ideas */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Lightbulb size={18} className="text-amber-300" />
          {tr('Key ideas')}
        </h2>
        <ul className="mt-2 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <li className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="font-semibold text-slate-100">{tr('You mint new DAI')}</div>
            {tr('DAI is created when you mint it and destroyed when you repay. Every DAI in circulation is backed by more than one dollar of collateral locked in a vault.')}
          </li>
          <li className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="font-semibold text-slate-100">{tr('Your risk is one number')}</div>
            {tr('The collateral ratio. Its mirror image is the liquidation price: the ETH price at which the ratio hits the limit. Keep a buffer well above it.')}
          </li>
          <li className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="font-semibold text-slate-100">{tr('Liquidation is automatic, and costly')}</div>
            {tr('Nobody asks before selling your ETH. You keep your DAI, but lose the penalty, and more if the auction sells below the market.')}
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          {tr('Simplified model: real vaults also charge a stability fee (interest) on the debt, require a minimum debt, and auction collateral gradually. Parameters change by governance vote.')}
        </p>
      </section>

      {/* Real world */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Globe size={18} className="text-blue-300" />
          {tr('🌐 Real-World Applications')}
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Zap, title: tr('Black Thursday (12 March 2020)'), text: tr('ETH lost around 40% in a day. Congested Ethereum blocks stalled the auctions; some vaults’ ETH sold for 0 DAI, leaving the system several million dollars short. Maker minted and sold MKR to cover it.') },
            { icon: ListOrdered, title: tr('Liquidations 2.0 (2021)'), text: tr('Maker replaced its slow auctions with Dutch auctions: the price starts high and falls until a buyer takes it. Collateral left over after the debt and penalty goes back to the vault owner.') },
            { icon: Clock, title: tr('Oracle Security Module'), text: tr('Prices reach the protocol one hour late, so a manipulated or wrong price can be stopped before it triggers liquidations, and owners can top up their vaults.') },
            { icon: Landmark, title: tr('Sky (2024)'), text: tr('MakerDAO rebranded as Sky in 2024. DAI can be upgraded one-to-one to USDS, and the same vault mechanics still back it.') },
            { icon: Coins, title: tr('Same idea elsewhere'), text: tr('Liquity, Aave and Compound also lend against crypto collateral with a liquidation threshold. Health factors and liquidation bonuses are this demo’s ratio and penalty under other names.') }
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Icon size={16} className="text-blue-300" />
                  {c.title}
                </div>
                <p className="mt-1 text-xs text-slate-300">{c.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BookOpen size={18} className="text-blue-300" />
          {tr('📚 Further Reading')}
        </h2>
        <ul className="mt-2 space-y-1.5">
          {FURTHER_READING.map((l) => (
            <li key={l.href}>
              <LinkWithCopy href={l.href} label={tr(l.label)} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          {tr('Next:')}{' '}
          <a href="/demo/stablecoin-depeg" className="text-blue-300 underline hover:text-blue-200">
            {tr('see what happens to a stablecoin when liquidations cascade (Stablecoin Depeg demo) →')}
          </a>
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: React.ReactNode; value: string; tone: 'red' | 'amber' | 'green' | 'slate' }) {
  const color = { red: 'text-red-300', amber: 'text-amber-300', green: 'text-emerald-300', slate: 'text-slate-100' }[tone];
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`mt-0.5 font-mono text-base font-semibold ${color}`}>{value}</dd>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="rounded-lg border border-red-900 bg-slate-950/60 p-3">
      <div className="text-xs font-semibold text-red-200">
        {n}. {title}
      </div>
      <div className="mt-1 text-xs text-slate-200">{text}</div>
    </li>
  );
}

function Range({ label, min, max, step, value, onChange, hint }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <label className="text-xs text-slate-200">
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="mt-1 w-full accent-purple-500" />
      <span className="block text-slate-400">{hint}</span>
    </label>
  );
}
