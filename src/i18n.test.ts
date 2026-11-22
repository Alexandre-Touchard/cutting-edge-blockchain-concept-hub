// Translation loading: shared strings per language, demo strings per demo, both on demand.
import { describe, expect, it } from 'vitest';
import i18n, { i18nReady, loadDemoTranslations } from './i18n';

type Json = Record<string, unknown>;
const coreFiles = import.meta.glob<Json>('./locales/*.json', { eager: true, import: 'default' });
const demoFiles = import.meta.glob<Record<string, string>>('./locales/demos/*/*.json', { eager: true, import: 'default' });

function demoFile(lng: string, demoId: string) {
  return demoFiles[`./locales/demos/${lng}/${demoId}.json`];
}

describe('locale files layout', () => {
  it('keeps demo strings out of the shared files', () => {
    for (const [file, core] of Object.entries(coreFiles)) {
      for (const [id, d] of Object.entries((core.demos ?? {}) as Record<string, Json>)) expect(d.auto, `${file} → ${id}`).toBeUndefined();
    }
  });

  it('stores each demo file as a flat map of auto keys', () => {
    for (const [file, json] of Object.entries(demoFiles)) {
      for (const [k, v] of Object.entries(json)) {
        expect(k, file).toMatch(/^[a-z0-9_]*_[0-9a-z]+$/);
        expect(typeof v, `${file}: ${k}`).toBe('string');
      }
    }
  });
});

describe('lazy loading', () => {
  it('loads a language’s shared strings on switch', async () => {
    await i18nReady;
    await i18n.changeLanguage('fr');
    expect(i18n.t('hub.start')).toBe('Lancer');
    await i18n.changeLanguage('es');
    expect(i18n.t('hub.start')).toBe('Empezar');
  });

  it('loads a demo’s strings on demand and keeps them across language switches', async () => {
    const demoId = 'stablecoin-depeg'; // has French and Spanish
    const [suffix, frText] = Object.entries(demoFile('fr', demoId))[0];
    const key = `demos.${demoId}.auto.${suffix}`;

    await i18n.changeLanguage('fr');
    expect(i18n.exists(key)).toBe(false); // not loaded until the demo is opened
    await loadDemoTranslations(demoId);
    expect(i18n.t(key)).toBe(frText);

    // Spanish shared file already loaded by the previous test: the demo strings are added on the fly.
    await i18n.changeLanguage('es');
    await loadDemoTranslations(demoId);
    expect(i18n.t(key)).toBe(demoFile('es', demoId)[suffix]);
  });
});
