// Link previews for individual demos.
//
// Link-preview crawlers (LinkedIn, Slack, X, WhatsApp, Discord…) don't run JavaScript, so they
// only see the generic index.html. vercel.json routes those crawlers (by user agent) from
// /demo/<id> to this function, which returns the demo's own title and description.
// Real visitors never hit it.
//
// Self-contained on purpose (no local imports), like the other API files.
// DEMO_PREVIEWS mirrors src/demos/demoRegistry.ts; a test fails if they drift
// (src/analytics/demoPreview.test.ts).

type VercelRequest = { method?: string; query: Record<string, string | string[] | undefined> };
type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

export const SITE_URL = 'https://blockchain-demo-hub.vercel.app';
export const SITE_NAME = 'Blockchain Learning Hub';
const IMAGE = { url: `${SITE_URL}/og-image.jpg`, width: 1000, height: 315 };

export const DEMO_PREVIEWS: Record<string, { title: string; description: string }> = {
  "amm-demo": { title: "AMM Math & Impermanent Loss", description: "Interactive constant product AMM (x × y = k) with price impact, slippage, and impermanent loss calculations." },
  "parallel-executor": { title: "Parallel Transaction Executor", description: "Compare conservative (Solana) vs optimistic (Aptos Block-STM) parallel execution strategies." },
  "dag-consensus": { title: "DAG Consensus (Tangle)", description: "Interactive DAG visualization showing how transactions reference tips and achieve consensus without traditional blocks." },
  "rollup-simulation": { title: "Layer 2 Rollup", description: "See how L2 transactions are batched and posted to L1 for massive gas savings." },
  "eigenlayer-demo": { title: "EigenLayer Restaking", description: "Reuse ETH stake to secure multiple protocols (AVS) and earn additional rewards." },
  "peerdas-demo": { title: "PeerDAS Sampling", description: "Peer Data Availability Sampling - nodes sample random columns instead of downloading everything." },
  "ethereum-blockchain": { title: "Minimal Ethereum Blockchain", description: "Build a working blockchain from scratch with Proof of Work, accounts, and state transitions." },
  "erc-standards": { title: "ERC Standards Playground", description: "Explore multiple ERC standards on one page. Start with ERC-20, ERC-721, and ERC-1155 with interactive actions, tooltips, and real-world context." },
  "blockchain-interop": { title: "Cross-Chain Protocols", description: "Compare IBC, CCIP, and LayerZero - different trust models for cross-chain messaging." },
  "fraud-proofs-arbitrum": { title: "Fraud Proofs (Optimistic Rollup Arbitrum Dispute Game)", description: "Interactive Arbitrum-style dispute game: challenge an invalid rollup assertion via bisection until L1 verifies a single step." },
  "wallet-tx-lifecycle": { title: "Wallet UX & Transaction lifecycle", description: "Simulate what happens when you click “confirm” in a wallet: nonces, EIP-1559 fees, mempool inclusion, ignored vs pending txs, replacement (speed up / cancel), and common revert reasons." },
  "state-channels": { title: "State Channels (Payment Channels)", description: "Lock deposits on L1, exchange signed updates off-chain, then settle cooperatively or via a dispute window." },
  "mev-pbs": { title: "MEV & PBS (MEV-Boost) simulator", description: "Interactive simulator for MEV (sandwiching, backrun arbitrage), bundles/private transactions, and proposer-builder separation (PBS)." },
  "stablecoin-depeg": { title: "Stablecoin Depeg Cascade", description: "Simulate two depeg cascades: (1) collateralized stablecoin liquidations and liquidity drains, and (2) Terra-style algorithmic reflexive collapse." },
  "evm-vs-svm": { title: "Sequential vs Parallel Execution (EVM vs SVM)", description: "Run the same transactions one by one (Ethereum) and in parallel waves (Solana), and see why declaring accounts upfront enables parallelism, and what still forces transactions to wait." },
  "arkea-heist": { title: "Follow the Money: the Crédit Mutuel Arkéa Heist", description: "Step through a real 2026 bank heist, from a compromised supplier to instant transfers, crypto laundering and Monero, and see how on-chain analysts traced it. Every claim shows its confidence level and sources." },
  "hashes-merkle-signatures": { title: "Hashes, Merkle Trees & Signatures", description: "Change one transaction and watch the change ripple up a Merkle tree to the root. Then play with SHA-256, prove a transaction is in a block with a few hashes, sign and verify messages, and try to forge a signed block." }
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The HTML served to crawlers for /demo/<id> (null if the demo doesn't exist). */
export function demoPreviewHtml(id: string): string | null {
  const demo = DEMO_PREVIEWS[id];
  if (!demo) return null;
  const url = `${SITE_URL}/demo/${encodeURIComponent(id)}`;
  const title = `${demo.title} · ${SITE_NAME}`;
  const meta = [
    ['description', demo.description],
    ['og:type', 'website'],
    ['og:site_name', SITE_NAME],
    ['og:url', url],
    ['og:title', title],
    ['og:description', demo.description],
    ['og:image', IMAGE.url],
    ['og:image:width', String(IMAGE.width)],
    ['og:image:height', String(IMAGE.height)],
    ['twitter:card', 'summary_large_image'],
    ['twitter:title', title],
    ['twitter:description', demo.description],
    ['twitter:image', IMAGE.url]
  ]
    .map(([k, v]) => {
      const attr = k.startsWith('og:') ? 'property' : 'name';
      return `<meta ${attr}="${esc(k)}" content="${esc(v)}" />`;
    })
    .join('\n    ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${esc(title)}</title>
    <link rel="canonical" href="${esc(url)}" />
    ${meta}
  </head>
  <body>
    <h1>${esc(demo.title)}</h1>
    <p>${esc(demo.description)}</p>
    <p><a href="${esc(url)}">Open the interactive demo</a></p>
  </body>
</html>`;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.id;
  const id = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  const html = demoPreviewHtml(id);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
  if (!html) {
    res.status(404).send('<!doctype html><title>Demo not found</title>');
    return;
  }
  res.status(200).send(html);
}
