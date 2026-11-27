// Browser tests (map, phone gestures, hub/demo links, analytics page): serves the production build (dist/) with `vite preview`, drives headless Chrome
// over the DevTools protocol, and fails on any broken check or browser console error.
//
//   npm run e2e                 build, then run every test
//   node e2e/run.mjs            run against the existing dist/ (CI does this after its build step)
//   node e2e/run.mjs phone      only tests whose name contains "phone" (several words: one phrase)
//
// Needs Google Chrome (or set CHROME_PATH). Screenshots of failed tests go to e2e/output/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { launchBrowser } from './lib/browser.mjs';
import mapTests from './map.e2e.mjs';
import phoneTests from './phone.e2e.mjs';
import linkTests from './links.e2e.mjs';
import analyticsTests from './analytics.e2e.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'e2e', 'output');
const filter = process.argv.slice(2).join(' ').toLowerCase();
const tests = [...mapTests, ...phoneTests, ...linkTests, ...analyticsTests].filter((t) => !filter || t.name.toLowerCase().includes(filter));

if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('No build found: run `npm run build` first (or `npm run e2e`, which builds).');
  process.exit(1);
}
if (tests.length === 0) {
  console.error(`No test matches "${filter}".`);
  process.exit(1);
}

const server = await preview({ root, logLevel: 'warn', preview: { port: 4319, strictPort: false, open: false } });
const baseUrl = (server.resolvedUrls?.local[0] ?? 'http://localhost:4319/').replace(/\/$/, '');
const browser = await launchBrowser();
fs.rmSync(outDir, { recursive: true, force: true });

let failed = 0;
const started = Date.now();
for (const t of tests) {
  const page = await browser.newPage(baseUrl);
  const t0 = Date.now();
  let error = null;
  try {
    await t.run(page);
    if (page.errors.length) error = new Error('Browser errors:\n    ' + page.errors.join('\n    '));
  } catch (e) {
    error = e;
  }
  const ms = `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  if (error) {
    failed++;
    const shot = path.join(outDir, t.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png');
    await page.screenshot(shot).catch(() => {});
    console.log(`  ✗ ${t.name} (${ms})\n    ${String(error.message ?? error).split('\n').join('\n    ')}\n    screenshot: ${path.relative(root, shot)}`);
  } else console.log(`  ✓ ${t.name} (${ms})`);
  await page.dispose();
}

await browser.close();
await new Promise((r) => server.httpServer.close(r));
const total = `${tests.length - failed}/${tests.length} passed in ${((Date.now() - started) / 1000).toFixed(0)}s`;
console.log(failed ? `\n${failed} failed, ${total}` : `\n${total}`);
process.exit(failed ? 1 : 0);
