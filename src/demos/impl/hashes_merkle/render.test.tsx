// Render test: the hook (table + tree + roots) is the first thing on screen, every quest target
// exists, and the page is translated.
import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import i18n, { loadDemoTranslations } from '../../../i18n';
import Demo from '../hashes_merkle_signatures';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage(); // fresh quest progress
});

describe('Hashes, Merkle Trees & Signatures renders', () => {
  it('opens on the editable block with its tree, and tags every quest target', async () => {
    await i18n.changeLanguage('en');
    await loadDemoTranslations('hashes-merkle-signatures');
    const html = renderToString(<Demo />);
    expect(html).toContain('Change anything in this block and see what happens.');
    expect(html).toContain('Roots match');
    expect(html).toContain('Next quest (1/8)');
    // 8 transactions → 15 nodes in the hook tree (8 + 4 + 2 + 1)
    expect(html.match(/aria-label="Tx \d+ amount"/g)?.length).toBeGreaterThanOrEqual(8);
    for (const key of ['tx-table', 'preset-hello', 'build-step', 'proof-next', 'tamper-proof', 'gen-keys', 'break-sig'])
      expect(html, key).toContain(`data-hint="${key}"`);
  });

  it('is translated in French', async () => {
    await i18n.changeLanguage('fr');
    await loadDemoTranslations('hashes-merkle-signatures');
    const html = renderToString(<Demo />);
    expect(html).toContain('Prochaine quête (1/8)');
    expect(html).not.toContain('Change anything in this block and see what happens.');
  });
});
