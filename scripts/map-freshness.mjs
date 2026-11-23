#!/usr/bin/env node
// Ecosystem map freshness check: re-checks every source link and lists nodes that need a review.
//
//   npm run map:freshness                 # full check, Markdown report on stdout
//   npm run map:freshness -- --no-links   # skip the network checks (stale/flagged nodes only)
//   npm run map:freshness -- --months=3   # stricter "last verified" limit (default 6)
//   npm run map:freshness -- --out=report.md
//
// Exit code 1 if a link is broken or a node is stale, so a scheduled CI run shows up as failed.
// Links that refuse automated requests (403/429) are listed for a manual check but don't fail.
// Runs outside the test suite on purpose: tests must not depend on the network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const MONTHS = Number(args.months ?? 6);
const CHECK_LINKS = !args['no-links'];
const CONCURRENCY = 6;
const TIMEOUT_MS = 20_000;
const UA = 'Mozilla/5.0 (compatible; BlockchainLearningHub-freshness/1.0)';

const nodes = JSON.parse(fs.readFileSync(path.join(root, 'src/map/data/nodes.json'), 'utf8'));
const edges = JSON.parse(fs.readFileSync(path.join(root, 'src/map/data/edges.json'), 'utf8'));

async function checkUrl(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'text/html,*/*' } });
      clearTimeout(timer);
      if (res.status < 400) return { status: res.status, kind: 'ok' };
      if (res.status === 403 || res.status === 429) return { status: res.status, kind: 'blocked' };
      if (attempt === 1 || res.status < 500) return { status: res.status, kind: 'broken' };
    } catch (e) {
      clearTimeout(timer);
      if (attempt === 1) return { status: 0, kind: 'broken', error: e.name === 'AbortError' ? 'timeout' : e.message };
    }
  }
  return { status: 0, kind: 'broken' };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

const now = new Date();
const limit = new Date(now);
limit.setMonth(limit.getMonth() - MONTHS);
const stale = nodes.filter((n) => new Date(n.verifiedOn) < limit);
const flaggedNodes = nodes.filter((n) => n.confidence === 'check');
const flaggedEdges = edges.filter((e) => e.confidence === 'check');
const discontinued = nodes.filter((n) => n.status === 'discontinued');

let broken = [];
let blocked = [];
if (CHECK_LINKS) {
  const links = nodes.flatMap((n) => n.sources.map((s) => ({ node: n.id, label: s.label, url: s.url })));
  const results = await mapLimit(links, CONCURRENCY, async (l) => ({ ...l, ...(await checkUrl(l.url)) }));
  broken = results.filter((r) => r.kind === 'broken');
  blocked = results.filter((r) => r.kind === 'blocked');
  process.stderr.write(`Checked ${links.length} links.\n`);
}

const lines = [];
lines.push(`# Ecosystem map freshness report`, '', `${now.toISOString().slice(0, 10)} · ${nodes.length} nodes, ${edges.length} connections`, '');
const section = (title, rows, empty) => {
  lines.push(`## ${title} (${rows.length})`, '');
  lines.push(...(rows.length ? rows : [empty]), '');
};
if (CHECK_LINKS) {
  section('Broken source links', broken.map((b) => `- \`${b.node}\`: [${b.label}](${b.url}) → ${b.status || b.error || 'no response'}`), 'None.');
  section('Links that refuse automated checks (check by hand)', blocked.map((b) => `- \`${b.node}\`: [${b.label}](${b.url}) → ${b.status}`), 'None.');
}
section(`Nodes not verified for more than ${MONTHS} months`, stale.map((n) => `- \`${n.id}\` (${n.name}): last verified ${n.verifiedOn}`), 'None.');
section('Nodes flagged "to check"', flaggedNodes.map((n) => `- \`${n.id}\` (${n.name})`), 'None.');
section('Connections flagged "to check"', flaggedEdges.map((e) => `- \`${e.id}\`: ${e.label}`), 'None.');
section('Discontinued nodes (kept on purpose)', discontinued.map((n) => `- \`${n.id}\` (${n.name})`), 'None.');

const report = lines.join('\n');
if (args.out) fs.writeFileSync(path.resolve(String(args.out)), report);
process.stdout.write(report + '\n');

const failed = broken.length > 0 || stale.length > 0;
process.exit(failed ? 1 : 0);
