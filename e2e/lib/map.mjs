// Helpers shared by the map tests.
import { sleep } from './browser.mjs';

export function expect(cond, message) {
  if (!cond) throw new Error(message);
}

/** Opens /map (with an optional query/hash) and waits until the canvas is drawn. */
export async function openMap(page, suffix = '') {
  await page.goto('/map' + suffix, { waitFor: `document.querySelectorAll('[data-node]').length > 30` });
  await sleep(400); // first layout + label culling
}

export const markerOf = (id) => `[data-node="${id}"] :is(circle,rect,path)`;
export const nodeCenter = (page, id) => page.centerOf(markerOf(id));

/** Name shown on the hover/pinned card, or null when there is no card. */
export const cardName = (page) => page.eval(`document.querySelector('[data-hover-card] .text-sm')?.innerText ?? null`);

export const hasNode = (page, id) => page.exists(`[data-node="${id}"]`);

/** A point of the map canvas with nothing under it (no node, card, panel or button). */
export async function emptyPoint(page) {
  const pt = await page.eval(`(() => {
    const svg = document.querySelector('svg[role="group"]');
    const r = svg.getBoundingClientRect();
    for (let y = r.top + 30; y < r.bottom - 30; y += 23) {
      for (let x = r.left + 30; x < r.right - 30; x += 23) {
        const el = document.elementFromPoint(x, y);
        if (el && svg.contains(el) && !el.closest('[data-node]')) return { x, y };
      }
    }
    return null;
  })()`);
  expect(pt, 'No empty point found on the map');
  return pt;
}

/** Clears the event log, so a test can check what one action tracks. */
export const clearTracked = (page) => {
  page.tracked.length = 0;
};

export async function waitEvent(page, name) {
  await page.until(() => page.events().includes(name), { what: `tracked event "${name}" (got: ${JSON.stringify(page.events())})` });
}
