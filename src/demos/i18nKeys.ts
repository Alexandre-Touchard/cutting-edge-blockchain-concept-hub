// Centralized helpers for i18n keys used by demos/glossary.

export function demoKey(demoId: string, field: string) {
  return `demos.${demoId}.${field}`;
}

export function glossaryKey(term: string) {
  // Keep keys stable even for terms with spaces/punctuation.
  // We just rely on JSON key quoting; i18next supports dots as nesting separators,
  // so we avoid dots in term keys.
  return `glossary.${term}`;
}
