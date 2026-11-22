// Scenario for the "Follow the Money" (Crédit Mutuel Arkéa heist) demo.
//
// Content rules (enforced by validateScenario, see model.test.ts):
// - confirmed  = stated by the bank (incl. its chairman) or by several independent outlets
// - reported   = one source, or an analyst's attribution
// - unverified = not found in a reputable source; must carry `noPublicSource`
// - money figures live in FIGURES: published amounts only, never estimated by the demo.
// - No wallet addresses, no attribution beyond what the sources state.
//
// Sources were opened and checked on 2026-11-22. Several outlets reprint the same AFP
// dispatch; those count as one source.

import type { Figure, Scenario, Source } from './model';

export const CONTENT_AS_OF = '2026-11-22';
export const TIMELINE_START = '2026-10-27';
export const TIMELINE_END = '2026-11-12';
/** Re-check the facts by this date: the investigation is ongoing. The demo shows a notice after it. */
export const REVIEW_BY = '2026-12-22';

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const S = {
  arkeaRelease: {
    name: 'Crédit Mutuel Arkéa (press release)',
    title: 'Crédit Mutuel Arkéa annonce avoir été victime d’une attaque',
    date: '2026-11-04',
    url: 'https://www.cm-arkea.com/arkea/banque/assurances/pa_38367/fr/credit-mutuel-arkea-annonce-avoir-ete-victime-d-une-attaque'
  },
  arkeaQA: {
    name: 'Crédit Mutuel Arkéa (Q&A)',
    title: 'Informations complémentaires suite à l’attaque dont le Crédit Mutuel Arkéa a été victime',
    date: '2026-11-04',
    url: 'https://www.cm-arkea.com/arkea/banque/assurances/pa_38386/fr/informations-complementaires-suite-a-l-attaque-dont-le-credit-mutuel-arkea-a-ete-victime'
  },
  afpEvening: {
    name: 'AFP (via Boursorama)',
    title: 'Crédit Mutuel Arkéa: cyberattaque pour près de 100 millions d’euros, enquête ouverte',
    date: '2026-11-04',
    url: 'https://www.boursorama.com/actualite-economique/actualites/credit-mutuel-arkea-victime-d-une-cyberattaque-qui-a-permis-des-operations-frauduleuses-7a25b65f08450c07e9ea616dca1bfc71'
  },
  reuters: {
    name: 'Reuters (via Insurance Journal)',
    title: 'French Bank Credit Mutuel Arkea Says €100 Million Missing After Cyberattack',
    date: '2026-11-06',
    url: 'https://www.insurancejournal.com/news/international/2026/11/06/891802.htm'
  },
  franceinfoRecap: {
    name: 'franceinfo',
    title: 'Des millions d’euros volés, une attaque inédite, une enquête ouverte : ce que l’on sait du piratage du Crédit Mutuel Arkéa',
    date: '2026-11-05',
    url: 'https://www.franceinfo.fr/internet/securite-sur-internet/cyberattaques/des-millions-d-euros-voles-une-attaque-inedite-et-une-enquete-ouverte-ce-que-l-on-sait-du-piratage-du-credit-mutuel-arkea_8269124.html'
  },
  afpCarmona: {
    name: 'AFP (via Bourse Fortuneo)',
    title: 'Arkéa : le président décrit une cyberattaque "inédite en termes de sophistication" et de "technicité"',
    date: '2026-11-12',
    url: 'https://bourse.fortuneo.fr/actualites/arkea-le-president-decrit-une-cyberattaque-inedite-en-termes-de-sophistication-et-de-technicite-2800910'
  },
  moneyvox: {
    name: 'MoneyVox (with AFP)',
    title: 'Crédit Mutuel Arkéa : un « braquage d’un genre nouveau », très sophistiqué, raconte le président de la banque',
    date: '2026-11-12',
    url: 'https://www.moneyvox.fr/banque/actualites/111219/credit-mutuel-arkea-un-braquage-un-genre-nouveau-tres-sophistique-raconte-le-president-de-la-banque'
  },
  afpAttack: {
    name: 'AFP (via Bourse Fortuneo)',
    title: 'Crédit Mutuel Arkéa victime d’une cyberattaque ayant permis des opérations frauduleuses',
    date: '2026-11-04',
    url: 'https://bourse.fortuneo.fr/actualites-amp/credit-mutuel-arkea-victime-d-une-cyberattaque-ayant-permis-des-operations-frauduleuses-7483882'
  },
  afpQuestions: {
    name: 'AFP (via Bourse Fortuneo)',
    title: 'Crédit Mutuel Arkéa : les questions en suspens après la cyberattaque',
    date: '2026-11-05',
    url: 'https://bourse.fortuneo.fr/actualites-amp/credit-mutuel-arkea-les-questions-en-suspens-apres-la-cyberattaque-5826233'
  },
  solutionsNum: {
    name: 'Solutions Numériques',
    title: 'Crédit Mutuel Arkéa : les attaquants sont entrés par un prestataire et ont puisé dans la trésorerie du groupe',
    date: '2026-11-05',
    url: 'https://solutions-numeriques.com/credit-mutuel-arkea-les-attaquants-sont-entres-par-un-prestataire-et-ont-puise-dans-la-tresorerie-du-groupe'
  },
  franceinfo: {
    name: 'franceinfo',
    title: 'Le Crédit Mutuel Arkéa victime d’un piratage de plus de 100 millions d’euros sans répercussion pour les clients',
    date: '2026-11-04',
    url: 'https://www.franceinfo.fr/economie/fraude/le-credit-mutuel-arkea-bretagne-victime-d-un-piratage-de-plus-de-100-millions-d-euros-sans-repercussion-pour-les-clients_8267399.html'
  },
  theBlock: {
    name: 'The Block',
    title: 'French bank Crédit Mutuel Arkéa exploited for over $133 million, ZachXBT says',
    date: '2026-11-03',
    url: 'https://theblock.co/news/web3/2026-11-03-french-bank-credit-mutuel-arkea-exploited-zachxbt-432607'
  },
  cointelegraph: {
    name: 'Cointelegraph',
    title: 'ZachXBT identifies French bank as alleged victim of $133M crypto theft',
    date: '2026-11-04',
    url: 'https://cointelegraph.com/news/zachxbt-french-bank-credit-mutuel-arkea-133m-crypto-theft'
  },
  bitcoinCom: {
    name: 'Bitcoin.com News',
    title: 'Credit Mutuel Arkea Cyberattack: $133M Traced to Crypto Exchanges',
    date: '2026-11-04',
    url: 'https://news.bitcoin.com/security/credit-mutuel-arkea-cyberattack-133m-traced-crypto-exchanges/'
  },
  bitquery: {
    name: 'Bitquery',
    title: '$106M Crypto Hack: $126.0M Traced, $37.3M Still on Ethereum',
    date: '2026-11-05',
    url: 'https://bitquery.io/investigations/eu-106m-crypto-theft',
    archiveUrl: 'https://web.archive.org/web/20261106051959/https://www.bitquery.io/investigations/eu-106m-crypto-theft'
  },
  zachxbt: {
    name: 'ZachXBT (Telegram, posts 372–375)',
    title: 'Investigations channel',
    date: '2026-11-04',
    url: 'https://t.me/s/investigations',
    archiveUrl: 'https://web.archive.org/web/20261109112812/https://t.me/investigations/374'
  }
};

export const SOURCES: Record<keyof typeof S, Source> = S;

// ---------------------------------------------------------------------------
// Known figures: published amounts only (the tracker never estimates)
// ---------------------------------------------------------------------------

export const FIGURES: Figure[] = [
  { id: 'usdcOut', label: 'USDC withdrawn from exchanges', amountUsd: 126.04e6, display: '$126.0M', confidence: 'reported', sources: [S.bitquery] },
  { id: 'toEth', label: 'Swapped to ETH (27,553 ETH)', amountUsd: 62.98e6, display: '$63.0M', confidence: 'reported', sources: [S.bitquery, S.cointelegraph] },
  { id: 'lifi', label: 'Bridged through LI.FI, the largest route', amountUsd: 36.09e6, display: '$36.1M', confidence: 'reported', sources: [S.bitquery] },
  { id: 'zach106', label: 'Total taken, first estimate (ZachXBT)', amountUsd: 106e6, display: '$106M+', confidence: 'reported', sources: [S.zachxbt, S.theBlock] },
  { id: 'zach133', label: 'Total taken, updated estimate (ZachXBT)', amountUsd: 133e6, display: '$133M+', confidence: 'reported', sources: [S.zachxbt, S.theBlock], supersedes: 'zach106' },
  { id: 'usdtFrozen', label: 'Frozen by Tether (USDT)', amountUsd: 1.14e6, display: '$1.14M', confidence: 'reported', sources: [S.bitquery] },
  { id: 'usdcFrozen', label: 'Frozen by Circle (USDC)', amountUsd: 0, display: '$0', confidence: 'reported', sources: [S.bitquery] },
  { id: 'couldFreeze', label: 'Laundered but could have been frozen (ZachXBT’s allegation)', amountUsd: 30e6, display: '$30M+', confidence: 'reported', sources: [S.zachxbt, S.theBlock] },
  { id: 'blocked', label: 'Blocked or recovered by banks and platforms', amountUsd: null, display: 'Not public', confidence: 'confirmed', sources: [S.arkeaQA, S.afpEvening, S.afpCarmona] },
  { id: 'onEth', label: 'Still on Ethereum (5 Nov, 08:47 UTC)', amountUsd: 37.26e6, display: '$37.3M', confidence: 'reported', sources: [S.bitquery] },
  { id: 'offEth', label: 'Moved off Ethereum (5 Nov)', amountUsd: 95.8e6, display: '≈ $95.8M', confidence: 'reported', sources: [S.bitquery] },
  { id: 'xmr', label: 'Converted to Monero', amountUsd: null, display: 'Not public', confidence: 'reported', sources: [S.zachxbt] },
  { id: 'bankLoss', label: 'Loss, per the bank', amountUsd: null, display: 'About €100M', confidence: 'confirmed', sources: [S.afpCarmona, S.afpEvening, S.reuters] }
];

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export const SCENARIO: Scenario = {
  figures: FIGURES,

  actors: [
    { id: 'attacker', label: 'Attackers', role: 'threat' },
    { id: 'provider', label: 'Service provider', role: 'third_party' },
    { id: 'bank', label: 'Crédit Mutuel Arkéa', role: 'victim' },
    { id: 'inter', label: 'Banks, exchanges & issuers', role: 'platform' },
    { id: 'dex', label: 'DEX / bridges / swaps', role: 'platform' },
    { id: 'analyst', label: 'ZachXBT & analytics', role: 'investigator' },
    { id: 'public', label: 'Authorities & media', role: 'public' }
  ],

  phases: [
    { id: 1, title: 'Provider compromise', summary: 'A service provider is breached; the bank cuts the link on 27 Oct.' },
    { id: 2, title: 'Fraudulent transfers', summary: 'From 1 Nov, fake IBANs trigger instant payments out of the bank’s own account.' },
    { id: 3, title: 'Conversion', summary: 'Stablecoins withdrawn from exchanges are swapped to ETH within hours.' },
    { id: 4, title: 'Dispersal', summary: 'Funds are split across hundreds of addresses, instant exchanges and bridges.' },
    { id: 5, title: 'Detection & partial freeze', summary: 'On-chain investigators raise the alarm; some funds are blocked.' },
    { id: 6, title: 'Anonymisation & disclosure', summary: 'Part of the value goes to Monero; the bank is named and confirms.' }
  ],

  steps: [
    // ---------------- Phase 1 ----------------
    {
      id: 1,
      phase: 1,
      type: 'message',
      from: 'attacker',
      to: 'provider',
      label: 'Break into a service provider’s platform',
      style: 'solid',
      confidence: 'confirmed',
      explanation:
        'The bank says the attackers “went through the platform of one of our service providers”. The way in was a supplier, not the bank’s own systems.',
      whyItMatters: 'A bank’s attack surface includes every supplier connected to it. This is the third-party risk that DORA asks EU banks to manage.',
      sources: [S.arkeaQA, S.solutionsNum, S.afpQuestions],
    },
    {
      id: 2,
      phase: 1,
      type: 'note',
      from: 'attacker',
      to: 'provider',
      label: 'What we don’t know yet: who the provider is, and how it was breached',
      short: 'Unknown: which provider, and how',
      style: 'dashed',
      confidence: 'unverified',
      explanation:
        'The provider has not been named and the bank has not disclosed the mechanism. Summaries claiming that stolen provider credentials were used are not backed by any source we found.',
      whyItMatters: 'In a live incident, separating what is known from what is assumed avoids spreading a wrong story about who is at fault.',
      sources: [],
      noPublicSource: 'The provider’s identity and the compromise mechanism have not been made public.',
    },
    {
      id: 3,
      phase: 1,
      type: 'message',
      from: 'bank',
      to: 'provider',
      label: '27 Oct: signs of compromise spotted, link to the provider cut',
      short: '27 Oct: provider compromise spotted, link cut',
      style: 'solid',
      timestamp: '2026-10-27',
      confidence: 'confirmed',
      explanation:
        'According to the bank’s chairman, on 27 October the bank saw signs that the provider’s information system had been compromised, and immediately cut the connection between the two systems.',
      whyItMatters: 'Cutting a compromised supplier is the textbook reflex, but it only helps if nothing was taken before the cut.',
      sources: [S.afpCarmona, S.moneyvox],
    },
    {
      id: 4,
      phase: 1,
      type: 'note',
      from: 'provider',
      to: 'bank',
      label: 'Elements had already been taken from the provider, unseen at the time',
      short: 'Elements already taken, unseen at the time',
      style: 'dashed',
      timestamp: '2026-10-27',
      confidence: 'confirmed',
      explanation:
        'The chairman explained that nothing indicated at that point that elements had been extracted from the provider. Five days later, the fraudulent transfers began.',
      whyItMatters: 'The gap between the breach and the theft is a detection window. Threat intelligence about a supplier should trigger a review of what it could have leaked.',
      sources: [S.afpCarmona, S.moneyvox],
    },

    // ---------------- Phase 2 ----------------
    {
      id: 5,
      phase: 2,
      type: 'message',
      from: 'attacker',
      to: 'bank',
      label: 'Fake Fortuneo IBANs trigger instant-payment orders',
      short: 'Fake Fortuneo IBANs trigger instant payments',
      style: 'solid',
      timestamp: '2026-11-01',
      confidence: 'confirmed',
      explanation:
        'Starting on Sunday 1 November, fake IBANs of Fortuneo (the group’s online bank) were generated and used to trigger payment orders from Crédit Mutuel Arkéa’s own account, through instant payment systems. The bank stresses that Fortuneo itself was not the entry point.',
      whyItMatters: 'Instant payments settle in seconds and, as the chairman noted, carry fewer controls than classic transfers. A weekend start buys time before staff notice.',
      sources: [S.arkeaQA, S.afpCarmona, S.moneyvox],
    },
    {
      id: 6,
      phase: 2,
      type: 'message',
      from: 'bank',
      to: 'inter',
      label: 'Money leaves the group’s own account for accounts opened by the fraudsters',
      short: 'Own account → fraudsters’ accounts at EU banks',
      style: 'solid',
      timestamp: '2026-11-01',
      confidence: 'confirmed',
      explanation:
        'The transfers went to real bank accounts at other European banks, opened by the fraudsters. The bank stresses that its own account was used, not customer accounts, and that clients bear no financial consequence.',
      whyItMatters: 'Hitting the bank’s treasury rather than customers avoids the per-customer alerts and complaints that usually surface fraud quickly.',
      sources: [S.arkeaQA, S.afpCarmona, S.solutionsNum, S.afpAttack],
    },
    {
      id: 7,
      phase: 2,
      type: 'message',
      from: 'inter',
      to: 'inter',
      label: 'Fiat reaches crypto exchanges (Kraken, Crypto.com, OKX)',
      short: 'Fiat reaches Kraken, Crypto.com, OKX',
      style: 'dashed',
      timestamp: '2026-11-01',
      confidence: 'reported',
      explanation:
        'The bank transfers themselves are not visible on-chain. What is visible is stablecoins leaving Kraken, Crypto.com and OKX shortly afterwards, so the hop from bank accounts to exchange accounts is inferred.',
      whyItMatters: 'Exchanges are the bridge between the banking system and the blockchain, and the last place where identity checks and freezes are easy.',
      sources: [S.bitquery, S.bitcoinCom],
    },
    {
      id: 8,
      phase: 2,
      type: 'message',
      from: 'inter',
      to: 'attacker',
      label: 'USDC withdrawn to fresh wallets: about $126M in 28 hours',
      short: '≈ $126M USDC withdrawn to fresh wallets',
      reveals: ['usdcOut'],
      style: 'solid',
      timestamp: '2026-11-01T12:25:00Z',
      confidence: 'reported',
      explanation:
        'Bitquery traced about $126M in USDC withdrawn on Ethereum over roughly 28 hours on 1–2 November, to 17 wallets, about 95% of it from Kraken. The first withdrawal was at 12:25 UTC on Sunday 1 November, and $73.2M left in the 3 hours to 23:00 UTC.',
      whyItMatters: 'Withdrawing to fresh wallets, at high speed, is the moment funds leave the reach of exchange compliance teams.',
      sources: [S.bitquery, S.bitcoinCom],
      evidence: {
        asset: 'USDC',
        amount: '≈ $126.0M',
        chain: 'Ethereum',
        note: 'Bitquery’s first figure, reported on 4 Nov, was $108.8M; its page was later revised to $126.04M.'
      },
    },
    {
      id: 9,
      phase: 2,
      type: 'message',
      from: 'bank',
      to: 'bank',
      label: '3 Nov morning: scale discovered, external access and payment link cut',
      short: '3 Nov: fraud discovered, all access cut',
      style: 'solid',
      timestamp: '2026-11-03',
      confidence: 'confirmed',
      explanation:
        'On Tuesday morning the bank discovered the scale of the attack and cut all external access to its information system, as well as its link to the payment system.',
      whyItMatters: 'The transfers began on Sunday and were discovered on Tuesday morning. By then, on-chain, most of the money had already moved.',
      sources: [S.afpCarmona, S.moneyvox],
    },

    // ---------------- Phase 3 ----------------
    {
      id: 10,
      phase: 3,
      type: 'message',
      from: 'attacker',
      to: 'dex',
      label: 'Stablecoins swapped for ETH: 27,553 ETH ($63M) in about 4 hours',
      short: 'Stablecoins → 27,553 ETH ($63M) in ~4 h',
      reveals: ['toEth'],
      style: 'solid',
      timestamp: '2026-11-01T23:44:00Z',
      confidence: 'reported',
      explanation:
        'A fresh wallet sold USDC and USDT through UniswapX and bought 27,553 ETH (about $63M) between 23:44 UTC on Sunday and 04:02 UTC on Monday. ZachXBT described the attackers as “aggressively swapping USDC for ETH”.',
      whyItMatters: 'USDC and USDT can be frozen by their issuers; ETH cannot. Converting fast is a classic laundering signal.',
      sources: [S.bitquery, S.cointelegraph, S.zachxbt],
      evidence: { asset: 'USDC/USDT → ETH', amount: '27,553 ETH (≈ $63M)', chain: 'Ethereum', note: 'Swaps routed through UniswapX.' },
    },

    // ---------------- Phase 4 ----------------
    {
      id: 11,
      phase: 4,
      type: 'message',
      from: 'attacker',
      to: 'attacker',
      label: 'Split through 2–3 hops into 526 addresses',
      style: 'solid',
      timestamp: '2026-11-02',
      confidence: 'reported',
      explanation:
        'Bitquery describes funds moving on a median of about 5 minutes after arriving, through 2–3 intermediate wallets, ending up spread across 526 addresses.',
      whyItMatters: 'Fan-out multiplies the addresses investigators must follow, and fast hops leave little time to ask for a freeze.',
      sources: [S.bitquery],
    },
    {
      id: 12,
      phase: 4,
      type: 'message',
      from: 'attacker',
      to: 'dex',
      label: 'Instant exchanges (WellWallet, Kyrrex) and cross-chain bridges',
      short: 'Instant exchanges and cross-chain bridges',
      reveals: ['lifi'],
      style: 'solid',
      timestamp: '2026-11-02',
      confidence: 'reported',
      explanation:
        'According to ZachXBT, the attackers transferred funds to instant exchanges such as WellWallet and Kyrrex and bridged across multiple chains. Bitquery found the largest outbound route was LI.FI, a cross-chain aggregator, with about $36.1M.',
      whyItMatters: 'Each bridge or swap service breaks the trail on one chain and restarts it on another, so tracing needs cross-chain tooling.',
      sources: [S.zachxbt, S.theBlock, S.bitquery],
    },
    {
      id: 13,
      phase: 4,
      type: 'note',
      from: 'attacker',
      to: 'dex',
      label: 'A “peeling chain”? Plausible, but not named by any source',
      short: '“Peeling chain”? Not named by any source',
      style: 'dashed',
      confidence: 'unverified',
      explanation:
        'Diagrams of this case often show a peeling chain: small amounts peeled off at each hop while the remainder moves to a new address. Bitquery and ZachXBT describe splitting and onward transfers, but neither uses the term.',
      whyItMatters: 'Naming a technique is an analytical claim. The comparison tab in the dispersal view explains the pattern without asserting it was used here.',
      sources: [],
      noPublicSource: 'No source we checked describes the movements as a peeling chain.',
    },
    {
      id: 14,
      phase: 4,
      type: 'message',
      from: 'attacker',
      to: 'inter',
      label: 'Possible OTC trades, invisible on-chain',
      style: 'dashed',
      confidence: 'reported',
      explanation: 'ZachXBT said he suspects the amount stolen is larger once over-the-counter (OTC) activity is taken into account.',
      whyItMatters: 'OTC desks settle off-chain, so on-chain totals are a floor, not the full picture.',
      sources: [S.zachxbt, S.theBlock],
    },

    // ---------------- Phase 5 ----------------
    {
      id: 15,
      phase: 5,
      type: 'message',
      from: 'analyst',
      to: 'public',
      label: '2 Nov: ZachXBT flags a $106M+ theft from an “EU entity”',
      short: '2 Nov: ZachXBT flags a $106M+ theft',
      reveals: ['zach106'],
      style: 'solid',
      timestamp: '2026-11-02',
      confidence: 'confirmed',
      explanation:
        'Before any announcement by the victim, ZachXBT posted that an EU entity had lost over $106M the day before, without naming it.',
      whyItMatters: 'Public blockchains let independent investigators detect a theft before the victim discloses it.',
      sources: [S.zachxbt, S.theBlock],
    },
    {
      id: 16,
      phase: 5,
      type: 'message',
      from: 'inter',
      to: 'attacker',
      label: 'Tether freezes 1.14M USDT; Circle freezes none',
      reveals: ['usdtFrozen', 'usdcFrozen'],
      style: 'solid',
      timestamp: '2026-11-02T23:10:00Z',
      confidence: 'reported',
      explanation:
        'Bitquery reports that Tether froze 1.14M USDT at 23:10 UTC on 2 November, while 0.54M USDT stayed unfrozen. Circle had frozen none of the 1.71M USDC still held.',
      whyItMatters: 'Issuer freezes only catch what is still in stablecoins. By then, most of the value had been swapped to ETH.',
      sources: [S.bitquery],
      evidence: { asset: 'USDT', amount: '1.14M frozen', chain: 'Ethereum' },
    },
    {
      id: 17,
      phase: 5,
      type: 'message',
      from: 'analyst',
      to: 'public',
      label: 'Update: $27M more, $133M+ in total, “NOT Lazarus”',
      short: 'Update: $133M+ in total, “NOT Lazarus”',
      reveals: ['zach133'],
      style: 'solid',
      timestamp: '2026-11-03',
      confidence: 'reported',
      explanation:
        'ZachXBT added another $27M+ to his estimate, for $133M+ in total, and said he has a “high degree of confidence” that North Korea’s Lazarus Group is not behind it.',
      whyItMatters: 'Ruling out a known state actor changes who investigates and how likely recovery is. It is still one analyst’s attribution.',
      sources: [S.zachxbt, S.theBlock],
    },
    {
      id: 18,
      phase: 5,
      type: 'message',
      from: 'analyst',
      to: 'public',
      label: '“$30M+ laundered that could have been frozen”',
      reveals: ['couldFreeze'],
      style: 'solid',
      timestamp: '2026-11-03',
      confidence: 'reported',
      explanation:
        'ZachXBT argued that the lack of a proper incident disclosure let $30M+ be laundered that EU law enforcement could have frozen. This is his allegation; nobody has said $30M was actually frozen.',
      whyItMatters: 'Fast, public disclosure helps exchanges and issuers act. Silence protects reputation but can cost recoverable funds.',
      sources: [S.zachxbt, S.theBlock, S.bitcoinCom],
    },
    {
      id: 19,
      phase: 5,
      type: 'message',
      from: 'inter',
      to: 'attacker',
      label: 'Kraken and Crypto.com restrict accounts and block funds',
      short: 'Kraken, Crypto.com restrict accounts',
      style: 'solid',
      confidence: 'reported',
      explanation:
        'Cointelegraph reports that Kraken and Crypto.com restricted accounts or blocked funds. OKX was reported to be reviewing the case; no OKX freeze is confirmed, and no amounts have been published.',
      whyItMatters: 'Exchanges are where identities and freezes meet. The faster they are alerted, the more they can hold back.',
      sources: [S.cointelegraph],
    },
    {
      id: 20,
      phase: 5,
      type: 'message',
      from: 'inter',
      to: 'bank',
      label: 'Some banks and platforms hold transfers; part of the funds blocked',
      short: 'Part of the funds blocked',
      reveals: ['blocked'],
      style: 'solid',
      timestamp: '2026-11-04',
      confidence: 'confirmed',
      explanation:
        'The bank says part of the funds could be blocked. Its chairman added that some banks and crypto platforms delayed operations and froze part of the funds, some has been recovered, and talks continue on the rest.',
      whyItMatters: 'Recovery depends on cooperation between banks, exchanges and issuers across borders, within hours.',
      sources: [S.arkeaQA, S.afpEvening, S.franceinfo, S.afpCarmona],
    },
    {
      id: 21,
      phase: 5,
      type: 'note',
      from: 'analyst',
      to: 'public',
      label: 'Bitquery snapshot (5 Nov): $37.3M still on Ethereum',
      short: '5 Nov: $37.3M still on Ethereum',
      reveals: ['onEth', 'offEth'],
      style: 'solid',
      timestamp: '2026-11-05T08:47:00Z',
      confidence: 'reported',
      explanation:
        'As of 08:47 UTC on 5 November, Bitquery counted $37.26M still held on Ethereum: 8,926 ETH, 12.27M DAI, 1.71M USDC and 1.68M USDT. About $95.8M had already left Ethereum.',
      whyItMatters: 'Analytics firms publish live snapshots so that exchanges can watch for these funds arriving.',
      sources: [S.bitquery],
      evidence: { asset: 'ETH, DAI, USDC, USDT', amount: '≈ $37.26M', chain: 'Ethereum' },
    },

    // ---------------- Phase 6 ----------------
    {
      id: 22,
      phase: 6,
      type: 'message',
      from: 'attacker',
      to: 'dex',
      label: 'Converted to Monero (XMR) via Wagyu',
      reveals: ['xmr'],
      style: 'solid',
      confidence: 'reported',
      explanation: 'ZachXBT reports funds being converted to XMR through the Wagyu swap service.',
      whyItMatters: 'Monero hides amounts, senders and receivers. Once funds are in XMR, on-chain tracing effectively ends.',
      sources: [S.zachxbt, S.theBlock],
    },
    {
      id: 23,
      phase: 6,
      type: 'message',
      from: 'analyst',
      to: 'public',
      label: '4 Nov: ZachXBT names Crédit Mutuel Arkéa as the alleged victim',
      short: '4 Nov: ZachXBT names the alleged victim',
      style: 'solid',
      timestamp: '2026-11-04',
      confidence: 'confirmed',
      explanation:
        'ZachXBT named the victim as “allegedly Credit Mutuel Arkea, a French bank with $235B in assets”. Depending on the time zone, outlets date this to the evening of 3 November (US) or 4 November.',
      whyItMatters: 'The victim was identified by an independent investigator before the bank spoke publicly.',
      sources: [S.zachxbt, S.theBlock, S.cointelegraph],
    },
    {
      id: 24,
      phase: 6,
      type: 'message',
      from: 'bank',
      to: 'public',
      label: 'Bank confirms a “sophisticated attack from outside”',
      short: 'Bank confirms an external attack',
      style: 'solid',
      timestamp: '2026-11-04',
      confidence: 'confirmed',
      explanation:
        'The bank confirmed a sophisticated external attack that went through a service provider’s platform, used the bank’s own account rather than customer accounts, and involved no internal human error. Clients bear no financial consequence; judicial and police authorities are involved and supervisors have been informed.',
      whyItMatters: 'A clear statement of scope (whose money, which systems) limits panic and lets partners act.',
      sources: [S.arkeaRelease, S.arkeaQA, S.reuters, S.afpAttack, S.solutionsNum, S.afpQuestions],
    },
    {
      id: 25,
      phase: 6,
      type: 'note',
      from: 'bank',
      to: 'public',
      label: 'How much? About €100M (bank) vs €118M / $133M+ (press, ZachXBT)',
      short: 'How much? ~€100M vs €118M / $133M+',
      reveals: ['bankLoss'],
      style: 'solid',
      timestamp: '2026-11-04',
      confidence: 'confirmed',
      explanation:
        'The bank speaks of about a hundred million euros (roughly 1% of its equity) and gives no final total while recovery continues. Le Télégramme and ZachXBT put it at €118M / $133M+; the bank only validated “the order of magnitude”. Early reports varied, from “several tens of millions” to more than €100M.',
      whyItMatters: 'Early loss figures differ by source and change as funds are recovered. Always state which figure comes from whom.',
      sources: [S.arkeaQA, S.reuters, S.franceinfoRecap, S.afpCarmona, S.afpAttack, S.solutionsNum, S.theBlock],
    },
    {
      id: 26,
      phase: 6,
      type: 'message',
      from: 'bank',
      to: 'public',
      label: 'Complaint filed: Paris prosecutor opens an investigation',
      short: 'Paris prosecutor opens an investigation',
      style: 'solid',
      timestamp: '2026-11-04',
      confidence: 'confirmed',
      explanation:
        'The Paris prosecutor’s office opened an investigation into an attack on an automated data processing system by an organised gang, entrusted to the anti-cybercrime office (OFAC). The complaint reached the prosecutor’s cybercrime section on the morning of 4 November.',
      whyItMatters: 'Law enforcement can ask exchanges and issuers for freezes and data that private investigators cannot obtain.',
      sources: [S.franceinfoRecap, S.afpEvening, S.reuters, S.franceinfo],
    },
    {
      id: 27,
      phase: 6,
      type: 'message',
      from: 'bank',
      to: 'public',
      label: '12 Nov: chairman describes an attack “unprecedented in sophistication”',
      short: '12 Nov: “unprecedented sophistication”',
      style: 'solid',
      timestamp: '2026-11-12',
      confidence: 'confirmed',
      explanation:
        'In an interview with AFP, chairman Julien Carmona called it a new kind of heist, unprecedented in sophistication and technicality, and “very probably helped by advanced artificial intelligence”.',
      whyItMatters: 'The full chain (supplier breach, instant payments, crypto laundering) is what makes it new. Each link was known; combining them at speed was not.',
      sources: [S.afpCarmona, S.moneyvox],
    }
  ]
};
