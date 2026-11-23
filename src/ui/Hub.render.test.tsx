// Smoke test for the hub layout: hero, curated sections, cards, coming-soon teaser, translated footer.
import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import i18n from '../i18n';
import Hub, { type DemoMeta } from './Hub';
import { loadDemos } from '../demos/loadDemos';
import { LEARNING_PATHS } from '../demos/learningPaths';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

function render(demos: DemoMeta[]) {
  return renderToString(<Hub demos={demos} onOpenDemo={() => {}} onStartDemo={() => {}} />);
}

describe('Hub', () => {
  let demos: DemoMeta[];

  beforeEach(async () => {
    (globalThis as any).localStorage = new MemoryStorage();
    await i18n.changeLanguage('en');
    demos = loadDemos().map((d) => d.meta);
  });

  it('shows the pitch, the calls to action and the selling points', () => {
    const live = demos.filter((d) => d.status !== 'coming_soon').length;
    const html = render(demos);
    expect(html).toContain(`${live} hands-on simulations`);
    expect(html).toContain('Start with the basics');
    expect(html).toContain('href="/map"');
    expect(html).toContain('Explore the ecosystem map');
    expect(html).not.toContain('New: ');
    expect(html).toContain('free, no sign-up');
    expect(html).toContain('learning quests');
  });

  it('keeps the pitch short enough for one line on desktop, in every language', async () => {
    // ~105 characters is what fits at text-base on a 1024 px screen and text-lg from 1280 px.
    const live = demos.filter((d) => d.status !== 'coming_soon').length;
    for (const lng of ['en', 'fr', 'es']) {
      await i18n.changeLanguage(lng);
      const pitch = i18n.t('hub.pitch', { count: live });
      expect(pitch.length, `${lng}: "${pitch}"`).toBeLessThanOrEqual(105);
      expect(render(demos)).toMatch(/<p class="[^"]*lg:whitespace-nowrap[^"]*">/);
    }
  });

  it('keeps the title on one line on large screens, in every language', async () => {
    for (const lng of ['en', 'fr', 'es']) {
      await i18n.changeLanguage(lng);
      expect(render(demos)).toMatch(/<h1 class="[^"]*lg:whitespace-nowrap[^"]*">/);
    }
  });

  it('shows every learning path', () => {
    const html = render(demos);
    expect(html).toContain('Learning paths');
    for (const p of LEARNING_PATHS) expect(html).toContain(p.title.replace('&', '&amp;'));
  });

  it('keeps coming-soon demos out of the main grid, in a teaser row', () => {
    const soon = demos.filter((d) => d.status === 'coming_soon');
    const html = render(demos);
    expect(html).toContain('Coming soon');
    // Each card in the grid is a role="button" with "<title>: Start"; coming-soon ones must not be.
    for (const d of soon) expect(html).not.toContain(`aria-label="${d.title}: Start"`);
  });

  it('shows saved progress on cards and a "Continue" row', () => {
    const live = demos.find((d) => d.learningQuestsTotal && d.status !== 'coming_soon')!;
    localStorage.setItem('quest-progress', JSON.stringify({ [live.id]: { done: 2, total: 5, best: 2, updatedAt: 1 } }));
    localStorage.setItem('recent-demos', JSON.stringify([{ id: live.id, at: 1 }]));
    const html = render(demos);
    expect(html).toContain('Continue where you left off');
    expect(html).toContain('2/5 quests');
  });

  it('applies the saved display preferences (filters, learning paths)', () => {
    expect(render(demos)).toContain('Hide learning paths');
    localStorage.setItem('hub:paths-visible', 'false');
    localStorage.setItem('hub:filters-visible', 'false');
    const html = render(demos);
    expect(html).toContain('Show learning paths');
    expect(html).toContain('Show filters');
    expect(html).not.toContain('Not sure where to start?');
    expect(html).not.toContain('type="text"'); // search box hidden with the filters
  });

  it('translates the footer', async () => {
    await i18n.changeLanguage('fr');
    const html = render(demos);
    expect(html).toContain('Partager le site');
    expect(html).toContain('Parcours d’apprentissage');
    expect(html).not.toContain('Share the site');
  });
});
