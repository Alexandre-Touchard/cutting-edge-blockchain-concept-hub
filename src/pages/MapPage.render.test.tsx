// Render test for /map: items and groups, deep links (groups open automatically), filters,
// tours, the "linked to a demo" highlight, and the English-only notice for French users.
import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import MapPage, { passesFilters, readFilters } from './MapPage';
import { MAP_DATA, TOURS } from '../map/data';
import { buildView } from '../map/view';

const render = (url: string) =>
  renderToString(
    <MemoryRouter initialEntries={[url]}>
      <MapPage />
    </MemoryRouter>
  );
const items = (html: string) => html.match(/data-node="/g)?.length ?? 0;
const dimmed = (html: string) => html.match(/data-node="[^"]+"[^>]*opacity="0.15"/g)?.length ?? 0;

beforeEach(async () => {
  (globalThis as any).fetch = () => Promise.reject(new Error('offline')); // no status overrides in tests
  await i18n.changeLanguage('en');
});

describe('ecosystem map page', () => {
  it('starts with groups collapsed into bubbles', () => {
    const html = render('/map');
    expect(items(html)).toBe(buildView(MAP_DATA, new Set()).items.length);
    expect(html).toContain('data-node="cluster:eth-l2s"');
    expect(html).toContain('Ethereum Layer 2s: group of 11');
    expect(html).not.toContain('English only');
  });

  it('expands every group with ?open=all', () => {
    expect(items(render('/map?open=all'))).toBe(100);
  });

  it('opens the detail panel from the URL hash and expands the node’s group', () => {
    const html = render('/map#node=arbitrum');
    const node = MAP_DATA.nodeById.get('arbitrum')!;
    expect(html).toContain('data-node="arbitrum"');
    expect(html).toContain('Details: Arbitrum One');
    expect(html).toContain('Optimistic rollup');
    expect(html).toContain('Part of the group: Ethereum Layer 2s');
    expect(html).toContain('href="/demo/fraud-proofs-arbitrum"');
    expect(html).toContain(node.sources[0].url);
  });

  it('filters by execution environment, consensus and rollup type (a group stays lit if a member matches)', () => {
    const f = readFilters('?vm=move');
    expect(MAP_DATA.nodes.filter((n) => passesFilters(n, f, null)).map((n) => n.id).sort()).toEqual(['aptos', 'iota', 'sui']);
    expect(MAP_DATA.nodes.filter((n) => passesFilters(n, readFilters('?consensus=pow'), null)).map((n) => n.id)).toEqual(
      expect.arrayContaining(['bitcoin', 'monero', 'zcash'])
    );
    const zk = MAP_DATA.nodes.filter((n) => passesFilters(n, readFilters('?rollup=zk'), null)).map((n) => n.id);
    expect(zk).toEqual(expect.arrayContaining(['starknet', 'scroll']));
    expect(zk).not.toContain('arbitrum');
    const html = render('/map?rollup=zk');
    expect(html).not.toMatch(/data-node="cluster:eth-l2s"[^>]*opacity="0.15"/); // the L2 group holds ZK rollups
    expect(dimmed(html)).toBeGreaterThan(40);
  });

  it('highlights the nodes linked to a demo ("See it on the map")', () => {
    const html = render('/map?demoId=amm-demo');
    expect(html).toContain('Showing the nodes linked to the demo');
    expect(html).toContain('href="/demo/amm-demo"');
  });

  it('runs a guided tour: step text, its node’s group opened, and the ending with demos', () => {
    const tour = TOURS.find((t) => t.id === 'stablecoin')!;
    const first = render('/map?tour=stablecoin&step=0');
    expect(first).toContain(tour.title);
    expect(first).toContain('Step 1 of');
    expect(first).toContain('data-node="usdc"'); // stablecoins group opened for the step
    const end = render(`/map?tour=stablecoin&step=${tour.steps.length}`);
    expect(end).toContain('Go deeper with a hands-on demo');
    expect(end).toContain(`href="/demo/${tour.demos[0]}"`);
  });

  it('shows the English-only notice in French', async () => {
    await i18n.changeLanguage('fr');
    expect(render('/map')).toContain('Cette carte n’est disponible qu’en anglais pour le moment.');
  });
});
