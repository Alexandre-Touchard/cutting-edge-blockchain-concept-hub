// How visitors reach the map: from the hub, and from a demo page.
import { expect, openMap, waitEvent } from './lib/map.mjs';

export default [
  {
    name: 'hub: the hero button opens the map',
    async run(page) {
      await page.goto('/', { waitFor: `[...document.querySelectorAll('a')].some((a) => /Explore the ecosystem map/i.test(a.innerText))` });
      await page.click('a', 'Explore the ecosystem map');
      await page.waitFor(`location.pathname === '/map' && document.querySelectorAll('[data-node]').length > 30`, { timeout: 10000, what: 'the map' });
    }
  },

  {
    name: 'demo → map: "See it on the map" highlights the demo’s nodes (tracked)',
    async run(page) {
      const link = 'a[href="/map?demoId=makerdao-vault"]';
      await page.goto('/demo/makerdao-vault', { waitFor: `!!document.querySelector('${link}')` });
      await page.click(link);
      await page.waitFor(`location.pathname === '/map' && document.querySelectorAll('[data-node]').length > 30`, { timeout: 10000, what: 'the map' });
      await waitEvent(page, 'map:from-demo:makerdao-vault');
      expect((await page.text()).includes('Showing the nodes linked to the demo'), 'The demo banner is shown');
      const shown = await page.eval(`[...document.querySelectorAll('[data-node]')].filter((g) => Number(g.getAttribute('opacity')) > 0.3).length`);
      const all = await page.eval(`document.querySelectorAll('[data-node]').length`);
      expect(shown >= 1 && shown < all / 4, `Only the demo's nodes stand out (${shown} of ${all})`);
      expect(await page.exists('a[href="/demo/makerdao-vault"]'), 'The banner links back to the demo');
    }
  },

  {
    name: 'map: the deep link #node= opens that node',
    async run(page) {
      await openMap(page, '#node=arbitrum');
      await page.waitFor(`!!document.querySelector('[aria-label^="Details: Arbitrum"]')`, { what: 'Arbitrum details' });
      expect(await page.exists('[data-node="arbitrum"]'), 'The group holding the node is opened');
    }
  }
];
