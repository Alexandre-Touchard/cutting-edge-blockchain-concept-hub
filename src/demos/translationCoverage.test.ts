// Every string a demo passes to tr('…') must have a French and Spanish translation,
// and every glossary term must be defined in both languages.
import { describe, expect, it } from 'vitest';
import { makeAutoKey } from './useDemoI18n';
import { EN_GLOSSARY } from './glossary';

/** Demos excluded until they are reworked (keep this list short). */
const EXCLUDED = new Set<string>([]);
const LANGS = ['fr', 'es'] as const;

const sources = import.meta.glob<string>(['./impl/**/*.{ts,tsx}', '!./impl/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true
});
const demoFiles = import.meta.glob<Record<string, string>>('../locales/demos/*/*.json', { eager: true, import: 'default' });
const coreFiles = import.meta.glob<{ glossary?: Record<string, string> }>('../locales/*.json', { eager: true, import: 'default' });

/** Which demo a source file belongs to: its useDemoI18n('<id>') / DEMO_ID, or its folder. */
function demoIdOf(file: string, src: string): string | null {
  const direct = /useDemoI18n\(\s*'([^']+)'/.exec(src)?.[1] ?? /const DEMO_ID = '([^']+)'/.exec(src)?.[1];
  if (direct) return direct;
  const folder = file.split('/').slice(-2, -1)[0];
  return (
    {
      arkea_heist: 'arkea-heist',
      wallet_tx: 'wallet-tx-lifecycle',
      evm_vs_svm: 'evm-vs-svm',
      amm: 'amm-demo',
      stablecoin_depeg: 'stablecoin-depeg',
      hashes_merkle: 'hashes-merkle-signatures',
      makerdao_vault: 'makerdao-vault'
    } as Record<string, string>
  )[folder] ?? null;
}

function trLiterals(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\btr\(\s*'((?:[^'\\]|\\.)*)'/g)) out.push(m[1].replace(/\\'/g, "'"));
  return out;
}

const literalsByDemo = new Map<string, Set<string>>();
for (const [file, src] of Object.entries(sources)) {
  const id = demoIdOf(file, src);
  if (!id || EXCLUDED.has(id)) continue;
  const set = literalsByDemo.get(id) ?? new Set<string>();
  for (const s of trLiterals(src)) set.add(s);
  literalsByDemo.set(id, set);
}

describe('demo translations', () => {
  it('finds the demos', () => {
    expect(literalsByDemo.size).toBeGreaterThanOrEqual(14);
  });

  for (const lng of LANGS) {
    it(`every tr() string has a ${lng} translation`, () => {
      // Untranslated count per demo (an empty object means full coverage).
      const missing: Record<string, number> = {};
      for (const [id, literals] of literalsByDemo) {
        const bundle = demoFiles[`../locales/demos/${lng}/${id}.json`] ?? {};
        for (const en of literals) {
          const suffix = makeAutoKey(id, en).split('.auto.')[1];
          if (!(suffix in bundle)) missing[id] = (missing[id] ?? 0) + 1;
        }
      }
      expect(missing).toEqual({});
    });
  }
});

/** Phrases that are legitimately identical in a language (proper nouns, product lists…). */
const ALLOW_IDENTICAL = new Set<string>([
  'Searcher (front-run)',
  'Searcher (back-run)',
  'Stablecoins (USDC/DAI)',
  'EIP-4844 (proto-danksharding) →',
  '{{from}} → {{to}} ({{value}} ETH)',
  'Swap + Permit (tx)',
  '= hash({{left}} ‖ {{right}})'
]);

describe('translation quality', () => {
  it('has no garbled characters (mojibake) in any locale file', () => {
    const MOJIBAKE = /Γ|Ã[\u0080-ÿ]|â€|ÔÇ|Â[ -¿]|�/;
    const bad: string[] = [];
    const check = (file: string, o: unknown, pre = '') => {
      if (typeof o === 'string') {
        if (MOJIBAKE.test(o)) bad.push(`${file}: ${pre}`);
      } else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) check(file, v, pre ? `${pre}.${k}` : k);
    };
    for (const [f, j] of Object.entries(demoFiles)) check(f, j);
    for (const [f, j] of Object.entries(coreFiles)) check(f, j);
    expect(bad).toEqual([]);
  });

  for (const lng of LANGS) {
    it(`doesn’t leave whole phrases as copied English in ${lng}`, () => {
      const copied: string[] = [];
      for (const [id, literals] of literalsByDemo) {
        const bundle = demoFiles[`../locales/demos/${lng}/${id}.json`] ?? {};
        for (const en of literals) {
          const words = en.match(/[A-Za-z]{2,}/g) ?? [];
          if (words.length < 3 || ALLOW_IDENTICAL.has(en)) continue;
          const v = bundle[makeAutoKey(id, en).split('.auto.')[1]];
          if (v !== undefined && v.trim() === en.trim()) copied.push(`${id}: ${en.slice(0, 70)}`);
        }
      }
      expect(copied).toEqual([]);
    });
  }
});

describe('glossary translations', () => {
  for (const lng of LANGS) {
    it(`defines every glossary term in ${lng}`, () => {
      const glossary = coreFiles[`../locales/${lng}.json`]?.glossary ?? {};
      expect(Object.keys(EN_GLOSSARY).filter((term) => !glossary[term])).toEqual([]);
    });
  }
});
