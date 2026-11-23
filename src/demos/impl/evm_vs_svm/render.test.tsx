// Render test: diagrams, guided quests and their pulse targets are present (EN + FR).
import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import i18n, { loadDemoTranslations } from '../../../i18n';
import Demo from '../evm_vs_svm';

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

describe('EVM vs SVM renders', () => {
  it('shows both diagrams and the first quest, with every quest target tagged', async () => {
    await i18n.changeLanguage('en');
    await loadDemoTranslations('evm-vs-svm');
    const html = renderToString(<Demo />);
    expect(html).toContain('Who runs when');
    expect(html).toContain('Who touches what');
    expect(html).toContain('EVM: one transaction at a time');
    expect(html).toContain('Next quest (1/8)');
    expect(html).toContain('Fix TX #2 by declaring FeeVault as write');
    // TX #2's undeclared FeeVault write is drawn as a "missing" (dotted red) arrow
    expect(html).toContain('stroke-dasharray="2 4"');
    for (const key of ['autofix', 'run', 'locks', 'threads', 'add-tx', 'preset-oracle', 'preset-independent', 'preset-ordering', 'swap'])
      expect(html, key).toContain(`data-hint="${key}"`);
  });

  it('is translated in French', async () => {
    await i18n.changeLanguage('fr');
    await loadDemoTranslations('evm-vs-svm');
    const html = renderToString(<Demo />);
    expect(html).toContain('Qui s’exécute quand');
    expect(html).toContain('Prochaine quête (1/8)');
  });
});
