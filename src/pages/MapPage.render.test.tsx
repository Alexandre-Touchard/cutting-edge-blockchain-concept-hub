// Render test for /map: every node is drawn and focusable, deep links open the detail panel,
// filters dim non-matching nodes, and French users see the English-only notice.
import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import MapPage from './MapPage';
import { MAP_DATA } from '../map/data';

const render = (url: string) =>
  renderToString(
    <MemoryRouter initialEntries={[url]}>
      <MapPage />
    </MemoryRouter>
  );

beforeEach(async () => {
  (globalThis as any).fetch = () => Promise.reject(new Error('offline')); // no status overrides in tests
  await i18n.changeLanguage('en');
});

describe('ecosystem map page', () => {
  it('draws all 50 nodes as focusable buttons, with the sector names', () => {
    const html = render('/map');
    expect(html.match(/data-node="/g)?.length).toBe(50);
    expect(html).toContain('Blockchain Ecosystem Map');
    expect(html).toContain('Ethereum ecosystem');
    expect(html).toContain('aria-label="Arbitrum One: Layer 2, Ethereum ecosystem.');
    expect(html).not.toContain('English only');
  });

  it('opens the detail panel from the URL hash, with connections, demos and sources', () => {
    const html = render('/map#node=arbitrum');
    const node = MAP_DATA.nodeById.get('arbitrum')!;
    expect(html).toContain('Details: Arbitrum One');
    expect(html).toContain('How it connects');
    expect(html).toContain('href="/demo/fraud-proofs-arbitrum"');
    expect(html).toContain(node.sources[0].url);
  });

  it('dims nodes that don’t match the filters from the query string', () => {
    const html = render('/map?layer=2');
    const dimmed = html.match(/data-node="[^"]+"[^>]*opacity="0.15"/g)?.length ?? 0;
    expect(dimmed).toBe(50 - 8);
  });

  it('shows the English-only notice in French', async () => {
    await i18n.changeLanguage('fr');
    const html = render('/map');
    expect(html).toContain('Cette carte n’est disponible qu’en anglais pour le moment.');
  });
});
