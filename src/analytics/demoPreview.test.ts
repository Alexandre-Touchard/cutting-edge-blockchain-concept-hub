// Per-demo link previews: the crawler route in vercel.json and the HTML from api/demo_preview.ts.
import { describe, expect, it } from 'vitest';
import vercel from '../../vercel.json';
import { DEMO_PREVIEWS, demoPreviewHtml } from '../../api/demo_preview';
import { demoMetaRegistry } from '../demos/demoRegistry';

type Route = { src?: string; dest?: string; has?: Array<{ type: string; key: string; value: string }> };
const routes = (vercel as { routes: Route[] }).routes;
const previewRoute = routes.find((r) => r.dest?.startsWith('/api/demo_preview'))!;
const uaRegex = new RegExp(previewRoute.has![0].value);
const pathRegex = new RegExp(previewRoute.src!);

describe('crawler route', () => {
  it('sends link-preview crawlers to the preview function', () => {
    for (const ua of [
      'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'Twitterbot/1.0',
      'WhatsApp/2.23.20.0',
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
    ])
      expect(uaRegex.test(ua), ua).toBe(true);
  });

  it('leaves browsers and search engines on the normal app', () => {
    for (const ua of [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    ])
      expect(uaRegex.test(ua), ua).toBe(false);
  });

  it('only applies to demo pages, before the SPA fallback', () => {
    expect(pathRegex.test('/demo/amm-demo')).toBe(true);
    expect(pathRegex.test('/demo/amm-demo/')).toBe(true);
    expect(pathRegex.test('/')).toBe(false);
    expect(pathRegex.test('/admin')).toBe(false);
    const idx = routes.indexOf(previewRoute);
    expect(idx).toBeGreaterThan(routes.findIndex((r) => r.dest === '/api/$1'));
    expect(idx).toBeLessThan(routes.findIndex((r) => r.dest === '/index.html'));
  });
});

describe('preview HTML', () => {
  it('stays in sync with the demo registry (title and description)', () => {
    const registry = Object.fromEntries(
      Object.values(demoMetaRegistry).map((m) => [m.id!, { title: m.title!, description: m.description!.replace(/\s+/g, ' ').trim() }])
    );
    expect(DEMO_PREVIEWS).toEqual(registry);
  });

  it('returns the demo’s own title, description and canonical URL', () => {
    const html = demoPreviewHtml('arkea-heist')!;
    expect(html).toContain('<meta property="og:title" content="Follow the Money: the Crédit Mutuel Arkéa Heist · Blockchain Learning Hub" />');
    expect(html).toContain('<link rel="canonical" href="https://blockchain-demo-hub.vercel.app/demo/arkea-heist" />');
    expect(html).toContain('og:image');
  });

  it('escapes HTML and rejects unknown demos', () => {
    expect(demoPreviewHtml('amm-demo')).toContain('AMM Math &amp; Impermanent Loss');
    expect(demoPreviewHtml('nope')).toBeNull();
    expect(demoPreviewHtml('<script>')).toBeNull();
  });
});
