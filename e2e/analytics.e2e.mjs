// The private analytics page shows the map section from /api/stats (stubbed here).
import { expect } from './lib/map.mjs';

const top = (pairs) => pairs.map(([key, count]) => ({ key, count }));
const STATS = {
  ok: true,
  rangeDays: 14,
  totals: { pageviews: 500, sumDailyUniques: 120 },
  series: [{ day: '2026-11-27', pageviews: 500, uniques: 120 }],
  topPaths: top([['/map', 80]]),
  topDemos: top([['amm-demo', 40]]),
  topEvents: top([['map:node:ethereum', 31]]),
  learning: [],
  map: {
    views: 80,
    detailsOpened: 120,
    topNodes: top([['ethereum', 31], ['solana', 20]]),
    groupOpens: 14,
    topGroups: top([['eth-l2s', 9]]),
    tours: [
      { id: 'stablecoin', started: 10, done: 4 },
      { id: 'base-swap', started: 5, done: 0 }
    ],
    toDemo: 12,
    topToDemos: top([['makerdao-vault', 7]]),
    fromDemo: 6,
    topFromDemos: top([['amm-demo', 6]])
  }
};

const setInput = (page, selector, value) =>
  page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);

export default [
  {
    name: 'analytics: the ecosystem map section shows views, tours and map ↔ demo clicks',
    async run(page) {
      page.apiStubs['/api/stats'] = STATS;
      await page.goto('/a/e2e-slug/analytics', { waitFor: `!!document.querySelector('input[type="password"]')` });
      await setInput(page, 'input[placeholder="Username"]', 'user');
      await setInput(page, 'input[type="password"]', 'pass');
      await page.click('button', 'View stats');
      await page.waitFor(`document.body.innerText.includes('Ecosystem map')`, { what: 'the map section' });
      const text = await page.text();
      for (const s of ['Map views', 'Node details opened', '1.5 per view', 'Map → demo', '15% of views', 'Demo → map', 'Guided tours', 'stablecoin', '40%', 'Demos opened from the map', 'makerdao-vault', 'Most opened groups', 'eth-l2s'])
        expect(text.includes(s), `Missing "${s}" on the analytics page`);
      expect(page.pageviews().length === 0, 'The analytics page itself is not counted');
    }
  }
];
