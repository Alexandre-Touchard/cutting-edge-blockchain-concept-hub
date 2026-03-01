import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

function djb2Hash(input: string): string {
  // Deterministic, compact key for long strings.
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // Force unsigned
  return (hash >>> 0).toString(36);
}

function normalizeKeyFragment(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '_');
}

export function makeAutoKey(demoId: string, english: string) {
  const frag = normalizeKeyFragment(english);
  const h = djb2Hash(english);
  return `demos.${demoId}.auto.${frag}_${h}`;
}

/**
 * Demo translation helper.
 *
 * Usage:
 *   const { tr } = useDemoI18n('amm-demo');
 *   <h1>{tr('Automated Market Maker (AMM) Math')}</h1>
 *
 * This will look up the key `demos.<id>.auto.<slug>_<hash>` and fall back to the
 * provided English string via defaultValue. When we later add French/Spanish JSON
 * entries for those keys, the UI will translate without changing code.
 */
export function useDemoI18n(demoId: string) {
  const { t, i18n } = useTranslation();

  const tr = useMemo(() => {
    return (english: string, opts?: Record<string, unknown>) => {
      const key = makeAutoKey(demoId, english);
      return t(key, { defaultValue: english, ...opts });
    };
  }, [demoId, t, i18n.resolvedLanguage]);

  return { tr };
}
