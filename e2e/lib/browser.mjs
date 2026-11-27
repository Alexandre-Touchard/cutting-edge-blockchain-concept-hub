// Minimal headless-Chrome driver over the DevTools protocol (no dependency: Node's WebSocket + fetch).
// One Chrome per run; each test gets a fresh incognito-like browser context and a page in it.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates =
    process.platform === 'win32'
      ? [
          `${process.env['PROGRAMFILES']}/Google/Chrome/Application/chrome.exe`,
          `${process.env['PROGRAMFILES(X86)']}/Google/Chrome/Application/chrome.exe`,
          `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
          `${process.env['PROGRAMFILES(X86)']}/Microsoft/Edge/Application/msedge.exe`
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
        : [];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  if (process.platform !== 'win32') {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      try {
        return execFileSync('which', [name], { encoding: 'utf8' }).trim();
      } catch {}
    }
  }
  throw new Error('Chrome not found: install Google Chrome or set CHROME_PATH.');
}

/** A DevTools-protocol connection to one target (browser or page). */
class Connection {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = () => rej(new Error('DevTools connection failed: ' + this.wsUrl));
    });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) p.rej(new Error(`${p.method}: ${m.error.message}`));
        else p.res(m.result);
      } else if (m.method) for (const fn of this.listeners.get(m.method) ?? []) fn(m.params);
    };
    return this;
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej, method }));
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

export async function launchBrowser() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-e2e-'));
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`, '--no-first-run', '--no-default-browser-check', '--lang=en-US', 'about:blank'];
  // GitHub's Ubuntu runners restrict the user namespaces Chrome's sandbox needs.
  if (process.env.CI && process.platform === 'linux') args.unshift('--no-sandbox');
  const proc = spawn(findChrome(), args, { stdio: 'ignore' });
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    if (fs.existsSync(portFile)) port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) || undefined;
  }
  if (!port) throw new Error('Chrome did not start (no DevToolsActivePort).');
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const browser = await new Connection(version.webSocketDebuggerUrl).open();

  return {
    async newPage(baseUrl) {
      const { browserContextId } = await browser.send('Target.createBrowserContext');
      const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId });
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const target = list.find((t) => t.id === targetId);
      const conn = await new Connection(target.webSocketDebuggerUrl).open();
      const page = new Page(conn, baseUrl);
      await page.init();
      page.dispose = async () => {
        conn.close();
        await browser.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
      };
      return page;
    },
    async close() {
      await browser.send('Browser.close').catch(() => {});
      browser.close();
      await sleep(300);
      proc.kill();
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {}
    }
  };
}

/** One page: navigation, evaluation, mouse/keyboard/touch input, and what the app sent to the API. */
export class Page {
  constructor(conn, baseUrl) {
    this.conn = conn;
    this.baseUrl = baseUrl;
    this.errors = [];
    /** Analytics payloads posted to /api/track (pageviews and events), in order. */
    this.tracked = [];
    /** JSON answers for API paths, e.g. { '/api/stats': {...} } (anything else under /api is a 404). */
    this.apiStubs = {};
  }

  async init() {
    const c = this.conn;
    c.on('Runtime.exceptionThrown', (p) => this.errors.push('exception: ' + (p.exceptionDetails.exception?.description ?? p.exceptionDetails.text)));
    c.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') this.errors.push('console.error: ' + p.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
    });
    // The static preview server has no API: answer it here, and record what the app tracks.
    c.on('Fetch.requestPaused', async (p) => {
      const url = new URL(p.request.url);
      const reply = (status, body) =>
        c.send('Fetch.fulfillRequest', {
          requestId: p.requestId,
          responseCode: status,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(JSON.stringify(body)).toString('base64')
        });
      try {
        if (url.pathname === '/api/track') {
          const body =
            p.request.postData ?? (p.request.postDataEntries ?? []).map((e) => Buffer.from(e.bytes ?? '', 'base64').toString('utf8')).join('');
          try {
            this.tracked.push(JSON.parse(body || 'null'));
          } catch {}
          await reply(200, { ok: true });
        } else if (this.apiStubs[url.pathname]) await reply(200, this.apiStubs[url.pathname]);
        else if (url.pathname === '/api/demo_status') await reply(200, { ok: true, overrides: {} });
        else await reply(404, { ok: false, error: 'Not available in e2e' });
      } catch {}
    });
    await c.send('Runtime.enable');
    await c.send('Page.enable');
    await c.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
    await this.viewport(1440, 900);
  }

  /** Event names tracked so far (pageviews excluded). */
  events() {
    return this.tracked.filter((t) => t?.type === 'event').map((t) => t.event);
  }
  pageviews() {
    return this.tracked.filter((t) => t?.type === 'pageview').map((t) => t.path);
  }

  async viewport(width, height, { mobile = false, touch = false } = {}) {
    this.size = { width, height };
    await this.conn.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
    await this.conn.send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
  }

  async goto(pathAndQuery, { waitFor } = {}) {
    await this.conn.send('Page.navigate', { url: this.baseUrl + pathAndQuery });
    await this.waitFor(`document.readyState === 'complete'`, { timeout: 15000, what: 'page load' });
    if (waitFor) await this.waitFor(waitFor, { timeout: 15000 });
  }

  async eval(expr) {
    const r = await this.conn.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expr.slice(0, 100)} → ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }

  /** Waits until `expr` is truthy in the page, and returns its value. */
  async waitFor(expr, { timeout = 5000, what } = {}) {
    const end = Date.now() + timeout;
    let last;
    for (;;) {
      try {
        last = await this.eval(expr);
        if (last) return last;
      } catch (e) {
        last = e.message;
      }
      if (Date.now() > end) throw new Error(`Timed out waiting for ${what ?? expr}${last ? ` (last: ${String(last).slice(0, 200)})` : ''}`);
      await sleep(100);
    }
  }

  /** Waits until the Node-side `fn()` is truthy (e.g. a tracked event arrived). */
  async until(fn, { timeout = 3000, what = 'condition' } = {}) {
    const end = Date.now() + timeout;
    while (!fn()) {
      if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
      await sleep(50);
    }
  }

  async text(selector = 'body') {
    return this.eval(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? null`);
  }
  async exists(selector) {
    return this.eval(`!!document.querySelector(${JSON.stringify(selector)})`);
  }

  /** DOM click on the first element matching `selector` (and, optionally, containing `text`). */
  async click(selector, text) {
    const ok = await this.eval(`(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const el = ${text === undefined ? 'els[0]' : `els.find((e) => e.innerText.toLowerCase().includes(${JSON.stringify(String(text).toLowerCase())}))`};
      if (!el) return false;
      el.click();
      return true;
    })()`);
    if (!ok) throw new Error(`Nothing to click: ${selector}${text !== undefined ? ` containing "${text}"` : ''}`);
  }

  /** Viewport centre of an element (by selector), e.g. a map node's marker. */
  async centerOf(selector) {
    const pt = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    if (!pt) throw new Error('Not found: ' + selector);
    return pt;
  }

  // ---- mouse ----
  async mouseMove(pt) {
    await this.conn.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
  }
  async mouseClick(pt) {
    await this.mouseMove(pt);
    await sleep(30);
    await this.conn.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    await this.conn.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
  }

  // ---- keyboard ----
  async key(key) {
    const codes = { Escape: 27, Enter: 13, Tab: 9, ArrowRight: 39, ArrowLeft: 37 };
    const base = { key, windowsVirtualKeyCode: codes[key] ?? key.toUpperCase().charCodeAt(0) };
    const text = key.length === 1 ? { text: key } : {};
    await this.conn.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...text });
    await this.conn.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }

  // ---- touch ----
  async tap(pt) {
    await this.conn.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] });
    await sleep(60);
    await this.conn.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  async touchDrag(from, dx, dy, steps = 8) {
    await this.conn.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
    for (let i = 1; i <= steps; i++) {
      await this.conn.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps, id: 1 }] });
      await sleep(16);
    }
    await this.conn.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  /** Two fingers moving apart (spread > 0) or together around `mid`. */
  async pinch(mid, startGap, spread, steps = 8) {
    const pts = (g) => [
      { x: mid.x - g / 2, y: mid.y, id: 1 },
      { x: mid.x + g / 2, y: mid.y, id: 2 }
    ];
    await this.conn.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(startGap) });
    for (let i = 1; i <= steps; i++) {
      await this.conn.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(startGap + (spread * i) / steps) });
      await sleep(16);
    }
    await this.conn.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  async screenshot(file) {
    const { data } = await this.conn.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  }
}
