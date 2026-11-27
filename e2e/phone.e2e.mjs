// The ecosystem map on a phone (390×844, real touch events): moving around must not pick nodes.
import { sleep } from './lib/browser.mjs';
import { cardName, expect, nodeCenter, openMap } from './lib/map.mjs';

const phone = (page) => page.viewport(390, 844, { mobile: true, touch: true });

export default [
  {
    name: 'phone: tap pins a card; drag and pinch move the map without picking',
    async run(page) {
      await phone(page);
      await openMap(page);
      await page.tap(await nodeCenter(page, 'solana'));
      await page.waitFor(`document.querySelector('[data-hover-card] .text-sm')?.innerText === 'Solana'`, { what: 'card after a tap' });

      // A drag that starts on a node pans the map and leaves the card alone.
      const before = await nodeCenter(page, 'bitcoin');
      await page.touchDrag(before, -120, 90);
      await sleep(300);
      const after = await nodeCenter(page, 'bitcoin');
      expect(Math.abs(after.x - before.x + 120) < 15 && Math.abs(after.y - before.y - 90) < 15, `The map follows the finger (moved ${Math.round(after.x - before.x)},${Math.round(after.y - before.y)})`);
      expect((await cardName(page)) === 'Solana', `Dragging picks nothing (card: ${await cardName(page)})`);

      // Pinch in the open area above the docked card.
      const a = await nodeCenter(page, 'ethereum');
      const b = await nodeCenter(page, 'solana');
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      await page.pinch({ x: 195, y: 300 }, 60, 160);
      await sleep(300);
      const a2 = await nodeCenter(page, 'ethereum');
      const b2 = await nodeCenter(page, 'solana');
      const d1 = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      expect(d1 > d0 * 1.5, `Pinching zooms in (${Math.round(d0)} → ${Math.round(d1)})`);
      expect((await cardName(page)) === 'Solana', `Pinching picks nothing (card: ${await cardName(page)})`);
    }
  },

  {
    name: 'phone: tapping another node switches the card; × closes it',
    async run(page) {
      await phone(page);
      await openMap(page);
      await page.tap(await nodeCenter(page, 'solana'));
      await page.waitFor(`document.querySelector('[data-hover-card] .text-sm')?.innerText === 'Solana'`);
      const card = await page.eval(`(() => { const r = document.querySelector('[data-hover-card]').getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right }; })()`);
      expect(card.top > 844 * 0.5, `The card is docked at the bottom on a phone (top ${Math.round(card.top)})`);
      // Any other node in the open area above the card.
      const other = await page.eval(`(() => {
        for (const g of document.querySelectorAll('[data-node]')) {
          const id = g.getAttribute('data-node');
          if (id === 'solana' || id.startsWith('cluster:')) continue;
          const r = g.querySelector('circle,rect,path').getBoundingClientRect();
          const x = r.x + r.width / 2, y = r.y + r.height / 2;
          if (x > 40 && x < 350 && y > 140 && y < ${Math.round(card.top) - 30} && document.elementFromPoint(x, y)?.closest('[data-node]') === g)
            return { x, y, name: g.getAttribute('aria-label').split(':')[0] };
        }
        return null;
      })()`);
      expect(other, 'No other node visible above the card');
      await page.tap(other);
      await page.waitFor(`document.querySelector('[data-hover-card] .text-sm')?.innerText === ${JSON.stringify(other.name)}`, { what: `${other.name} card` });
      await page.click('[data-hover-card] button[aria-label="Close"]');
      await page.waitFor(`!document.querySelector('[data-hover-card]')`, { what: 'card closed by ×' });
    }
  }
];
