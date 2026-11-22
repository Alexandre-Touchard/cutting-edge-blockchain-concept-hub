// Smoke test: every demo in the hub renders without crashing, in English and French,
// with its translations loaded the same way DemoPage does.
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import i18n, { loadDemoTranslations } from '../i18n';
import { loadDemos } from './loadDemos';

const demos = loadDemos();

describe('every demo renders', () => {
  it('finds all the demos', () => {
    expect(demos.length).toBeGreaterThanOrEqual(16);
  });

  for (const demo of demos) {
    for (const lng of ['en', 'fr'] as const) {
      it(`${demo.meta.id} (${lng})`, async () => {
        await i18n.changeLanguage(lng);
        const [mod] = await Promise.all([demo.load(), loadDemoTranslations(demo.meta.id)]);
        const Demo = mod.default;
        let html = '';
        expect(() => {
          html = renderToString(<Demo />);
        }).not.toThrow();
        expect(html.length, `${demo.meta.id} rendered almost nothing`).toBeGreaterThan(1_000);
      });
    }
  }
});
