// The ecosystem map on a desktop screen (mouse and keyboard).
import { sleep } from './lib/browser.mjs';
import { cardName, clearTracked, emptyPoint, expect, hasNode, nodeCenter, openMap, waitEvent } from './lib/map.mjs';

export default [
  {
    name: 'map: loads with groups collapsed and no overlapping labels',
    async run(page) {
      await openMap(page);
      expect(await hasNode(page, 'cluster:eth-l2s'), 'The Ethereum L2 group should be a bubble');
      expect(!(await hasNode(page, 'arbitrum')), 'Group members should be hidden until the group is opened');
      const overlaps = await page.eval(`(() => {
        const boxes = [...document.querySelectorAll('svg[role="group"] text')]
          .filter((t) => t.textContent.trim() && getComputedStyle(t).visibility !== 'hidden' && Number(getComputedStyle(t).opacity) > 0)
          .map((t) => ({ text: t.textContent.trim(), r: t.getBoundingClientRect() }))
          .filter((b) => b.r.width > 0);
        const out = [];
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i].r, b = boxes[j].r;
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 2 && h > 2) out.push(boxes[i].text + ' / ' + boxes[j].text);
          }
        return { count: boxes.length, out };
      })()`);
      expect(overlaps.count > 30, `Expected many labels, got ${overlaps.count}`);
      expect(overlaps.out.length === 0, 'Overlapping labels: ' + overlaps.out.slice(0, 8).join(', '));
    }
  },

  {
    name: 'map: hover shows a card, a click pins it until a click elsewhere',
    async run(page) {
      await openMap(page);
      const solana = await nodeCenter(page, 'solana');
      await page.mouseMove(solana);
      await page.waitFor(`document.querySelector('[data-hover-card] .text-sm')?.innerText === 'Solana'`, { what: 'hover card' });
      await page.mouseClick(solana);
      const empty = await emptyPoint(page);
      await page.mouseMove(empty);
      await sleep(400);
      expect((await cardName(page)) === 'Solana', `A pinned card stays when the mouse leaves (card: ${await cardName(page)})`);
      // Another node replaces it.
      await page.mouseClick(await nodeCenter(page, 'bitcoin'));
      await page.waitFor(`document.querySelector('[data-hover-card] .text-sm')?.innerText === 'Bitcoin'`, { what: 'Bitcoin card' });
      await page.mouseClick(empty);
      await page.waitFor(`!document.querySelector('[data-hover-card]')`, { what: 'card closed by a click on empty space' });
    }
  },

  {
    name: 'map: Esc closes the pinned card',
    async run(page) {
      await openMap(page);
      await page.mouseClick(await nodeCenter(page, 'solana'));
      await page.waitFor(`document.querySelector('[data-hover-card] .text-sm')?.innerText === 'Solana'`);
      await page.key('Escape');
      await page.waitFor(`!document.querySelector('[data-hover-card]')`, { what: 'card closed by Esc' });
    }
  },

  {
    name: 'map: details panel (tracked), then a demo link opens the demo (tracked)',
    async run(page) {
      await openMap(page);
      await page.mouseClick(await nodeCenter(page, 'ethereum'));
      await page.waitFor(`!!document.querySelector('[data-hover-card]')`);
      await page.click('[data-hover-card] button', 'Details');
      await page.waitFor(`!!document.querySelector('[aria-label^="Details: Ethereum"]')`, { what: 'details panel' });
      await waitEvent(page, 'map:node:ethereum');
      expect((await page.eval('location.hash')) === '#node=ethereum', 'The open node is in the URL hash');
      // Opening a node changes the URL, but it is still one visit to the map.
      const views = page.pageviews().filter((p) => p.startsWith('/map'));
      expect(views.length === 1, `One pageview per map visit, got ${JSON.stringify(views)}`);
      // Any live demo (coming-soon demos have no link).
      const href = await page.eval(`document.querySelector('[aria-label^="Details: Ethereum"] a[href^="/demo/"]')?.getAttribute('href') ?? null`);
      expect(href, 'Ethereum links to at least one live demo');
      clearTracked(page);
      await page.click(`[aria-label^="Details: Ethereum"] a[href="${href}"]`);
      await page.waitFor(`location.pathname === '${href}'`, { timeout: 10000, what: 'the demo page' });
      await waitEvent(page, 'map:demo:' + href.slice('/demo/'.length));
    }
  },

  {
    name: 'map: clicking a group bubble expands it in place (tracked)',
    async run(page) {
      await openMap(page);
      await page.mouseClick(await nodeCenter(page, 'cluster:eth-l2s'));
      await page.waitFor(`!!document.querySelector('[data-node="arbitrum"]')`, { what: 'group members' });
      expect(!(await hasNode(page, 'cluster:eth-l2s')), 'The bubble is replaced by its members');
      expect((await page.eval('location.search')).includes('open=eth-l2s'), 'The open group is in the URL');
      await waitEvent(page, 'map:group:eth-l2s');
    }
  },

  {
    name: 'map: a guided tour runs from start to finish (tracked)',
    async run(page) {
      await openMap(page);
      await page.click('button', 'Guided tours');
      await page.click('button', 'Where does a stablecoin come from?');
      await page.waitFor(`!!document.querySelector('[aria-label^="Guided tour"]')`, { what: 'tour panel' });
      await waitEvent(page, 'map:tour:stablecoin:start');
      for (let i = 0; i < 5; i++) {
        const label = await page.eval(`[...document.querySelectorAll('[aria-label^="Guided tour"] button')].map((b) => b.innerText).find((t) => /Next|Finish/.test(t))`);
        expect(label, `Step ${i + 1}: no Next/Finish button`);
        await page.click('[aria-label^="Guided tour"] button', label.replace(/\s*→$/, ''));
        await sleep(150);
      }
      await page.waitFor(`document.querySelector('[aria-label^="Guided tour"]')?.innerText.includes('Go deeper with a hands-on demo')`, { what: 'tour ending' });
      await waitEvent(page, 'map:tour:stablecoin:done');
      expect(await page.exists('[aria-label^="Guided tour"] a[href="/demo/makerdao-vault"]'), 'The ending links to the MakerDAO demo');
      await page.click('[aria-label^="Guided tour"] button', 'Close the tour');
      await page.waitFor(`!location.search.includes('tour=')`, { what: 'tour closed' });
    }
  },

  {
    name: 'map: keyboard — Enter on a node opens details, ? toggles the help',
    async run(page) {
      await openMap(page);
      await page.eval(`document.querySelector('[data-node="ethereum"]').focus(); true`);
      await page.key('Enter');
      await page.waitFor(`!!document.querySelector('[aria-label^="Details: Ethereum"]')`, { what: 'details panel from Enter' });
      await page.eval(`document.activeElement?.blur(); true`);
      await page.key('?');
      await page.waitFor(`!!document.querySelector('[role="dialog"][aria-label="Keyboard shortcuts"]')`, { what: 'shortcuts help' });
      await page.key('Escape');
      await page.waitFor(`!document.querySelector('[role="dialog"][aria-label="Keyboard shortcuts"]')`, { what: 'help closed by Esc' });
    }
  },

  {
    name: 'map: Reset the map clears filters, groups, tour and selection',
    async run(page) {
      await openMap(page, '?vm=evm&open=all&tour=stablecoin&step=1#node=solana');
      expect(!(await hasNode(page, 'cluster:eth-l2s')), 'open=all expands every group');
      await page.click('button[aria-label="Reset the map"]');
      await page.waitFor(`location.search + location.hash === ''`, { what: 'a clean URL' });
      await page.waitFor(`!!document.querySelector('[data-node="cluster:eth-l2s"]')`, { what: 'groups collapsed again' });
    }
  }
];
