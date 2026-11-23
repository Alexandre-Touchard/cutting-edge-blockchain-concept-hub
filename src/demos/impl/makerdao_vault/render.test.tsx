// Render test: the starting vault, the health bar and every quest target are on screen, in EN and FR.
import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import i18n, { loadDemoTranslations } from '../../../i18n';
import Demo from '../makerdao_vault';

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
  (globalThis as any).localStorage = new MemoryStorage();
});

describe('MakerDAO vault renders', () => {
  it('shows the 200% starting vault, its $1,500 liquidation price, and every quest target', async () => {
    await i18n.changeLanguage('en');
    await loadDemoTranslations('makerdao-vault');
    const html = renderToString(<Demo />);
    expect(html).toContain('200%');
    expect(html).toContain('$1,500');
    expect(html).toContain('Next quest (1/7)');
    expect(html).toContain('role="meter"');
    for (const key of ['mint-btn', 'dai-amount', 'scenario-safe', 'event-flash', 'stress-slider', 'scenario-reaction', 'scenario-crash'])
      expect(html, key).toContain(`data-hint="${key}"`);
  });

  it('is translated in French', async () => {
    await i18n.changeLanguage('fr');
    await loadDemoTranslations('makerdao-vault');
    const html = renderToString(<Demo />);
    expect(html).toContain('Prochaine quête (1/7)');
    expect(html).not.toContain('Lock ETH in a vault, mint DAI against it');
  });
});
