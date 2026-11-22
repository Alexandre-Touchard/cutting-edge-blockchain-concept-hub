// Smoke test: the demo renders without crashing in English and French,
// and the French auto-keys in fr.json match the strings used in the code.
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import i18n from '../../../i18n';
import Demo from '../arkea_heist_tracing';

describe('Arkéa demo renders', () => {
  for (const lng of ['en', 'fr']) {
    it(`renders in ${lng}`, async () => {
      await i18n.changeLanguage(lng);
      const html = renderToString(<Demo />);
      expect(html.length).toBeGreaterThan(10_000);
      if (lng === 'en') {
        expect(html).toContain('Follow the Money');
        expect(html).toContain('Known figures so far');
        expect(html).toContain('About this demo');
        // Before phase 4 the dispersal view is announced, not hidden.
        expect(html).toContain('How the funds were scattered');
        expect(html).toContain('Jump to phase 4');
      } else {
        expect(html).toContain('Suivre l’argent');
        expect(html).toContain('Compromission du prestataire');
        expect(html).toContain('Montants connus à ce stade');
        expect(html).toContain('À propos de cette démo');
      }
      // First-time hint on Play (same pulse pattern as the other demos).
      expect(html).toMatch(/ring-amber-400[^"]*motion-safe:animate-pulse/);
      // Phase titles in the diagram open a phase overview.
      expect((html.match(/aria-label="Phase \d/g) ?? []).length).toBe(6);
      // Every message is keyboard-reachable.
      expect((html.match(/role="button" tabindex="0"/g) ?? []).length).toBeGreaterThanOrEqual(27);
    });
  }
});

describe('Dispersal view renders', () => {
  it('draws the documented fan-out with 17 interactive wallets and its controls', async () => {
    const { default: DispersalView } = await import('./DispersalView');
    await i18n.changeLanguage('en');
    const tr = (s: string, o?: Record<string, unknown>) => String(i18n.t(s, { defaultValue: s, ...o }));
    const html = renderToString(<DispersalView tr={tr} lang="en" reducedMotion onCluster={() => {}} />);
    expect(html).toContain('Replay the dispersal');
    expect(html).toMatch(/ring-amber-400[^"]*motion-safe:animate-pulse/);
    expect(html).toContain('Freeze request after');
    expect((html.match(/aria-label="Receiving wallet \d+ of 17/g) ?? []).length).toBe(17);
    // 26 + 40 schematic hop nodes + 526 final addresses
    expect((html.match(/class="arkea-node"/g) ?? []).length).toBe(26 + 40 + 526);
  });
});
