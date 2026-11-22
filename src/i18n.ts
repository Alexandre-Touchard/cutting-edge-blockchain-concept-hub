import i18n, { type BackendModule, type ReadCallback } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Only English (the fallback) is bundled. Other languages, and every demo's own strings,
// are separate chunks loaded on demand:
//   src/locales/<lng>.json               shared UI (hub, glossary, demo titles/descriptions)
//   src/locales/demos/<lng>/<demoId>.json  one demo's strings (keys: demos.<demoId>.auto.*)
import en from './locales/en.json';

export const SUPPORTED_LANGS = ['en', 'fr', 'es'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

type Json = Record<string, unknown>;

const coreLoaders = import.meta.glob<Json>(['./locales/*.json', '!./locales/en.json'], { import: 'default' });
const demoLoaders = import.meta.glob<Json>('./locales/demos/*/*.json', { import: 'default' });

/** Demos whose strings have been requested; reloaded for each new language. */
const activeDemoIds = new Set<string>();
/** "<lng>:<demoId>" pairs already merged into the resources. */
const loadedDemoBundles = new Set<string>();

function baseLang(lng: string): string {
  return lng.split('-')[0];
}

async function loadDemoBundle(lng: string, demoId: string): Promise<Json | null> {
  const loader = demoLoaders[`./locales/demos/${baseLang(lng)}/${demoId}.json`];
  return loader ? loader() : null;
}

/** Merges a demo's strings into the language's resources under demos.<id>.auto. */
function addDemoBundle(lng: string, demoId: string, auto: Json) {
  loadedDemoBundles.add(`${lng}:${demoId}`);
  i18n.addResourceBundle(lng, 'translation', { demos: { [demoId]: { auto } } }, true, true);
}

// Backend: when i18next needs a language, load its shared file plus the strings of any demo
// already open, so switching language mid-demo doesn't flash English.
const lazyBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language: string, _namespace: string, callback: ReadCallback) {
    const lng = baseLang(language);
    const coreLoader = coreLoaders[`./locales/${lng}.json`];
    const core: Promise<Json> = lng === 'en' ? Promise.resolve(en as Json) : coreLoader ? coreLoader() : Promise.resolve({});
    Promise.all([core, ...[...activeDemoIds].map((id) => loadDemoBundle(lng, id).then((auto) => [id, auto] as const))])
      .then(([coreJson, ...demos]) => {
        const resources: Json = structuredClone(coreJson);
        const demosNode = ((resources.demos as Json | undefined) ?? (resources.demos = {})) as Record<string, Json>;
        for (const [id, auto] of demos as Array<readonly [string, Json | null]>) {
          if (auto) {
            demosNode[id] = { ...(demosNode[id] ?? {}), auto };
            loadedDemoBundles.add(`${lng}:${id}`);
          }
        }
        callback(null, resources);
      })
      .catch((err) => callback(err, null));
  }
};

/** Resolves when the detected language's shared strings are loaded (await before first render). */
export const i18nReady = i18n
  .use(lazyBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // English ships in the main bundle; other languages go through the backend.
    resources: { en: { translation: en } },
    partialBundledLanguages: true,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGS],
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false
    },
    react: {
      // Re-render when demo strings are added after a language switch.
      bindI18nStore: 'added',
      useSuspense: false
    },
    detection: {
      // User asked: remember choice.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'lang'
    }
  });

/**
 * Loads a demo's strings for the current language (and English, the fallback).
 * Call before rendering the demo; later language switches pick it up automatically.
 */
export async function loadDemoTranslations(demoId: string): Promise<void> {
  activeDemoIds.add(demoId);
  await i18nReady;
  const langs = Array.from(new Set([baseLang(i18n.resolvedLanguage ?? i18n.language ?? 'en'), 'en']));
  await Promise.all(
    langs.map(async (lng) => {
      if (loadedDemoBundles.has(`${lng}:${demoId}`)) return;
      const auto = await loadDemoBundle(lng, demoId);
      if (auto) addDemoBundle(lng, demoId, auto);
    })
  );
}

// A language loaded before a demo was opened won't contain that demo's strings: add them on switch.
i18n.on('languageChanged', (lng) => {
  const base = baseLang(lng);
  for (const id of activeDemoIds) {
    if (loadedDemoBundles.has(`${base}:${id}`)) continue;
    void loadDemoBundle(base, id).then((auto) => {
      if (auto) addDemoBundle(base, id, auto);
    });
  }
});

export default i18n;
