import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SupportedLang } from '../i18n';

type LangOption = {
  lang: SupportedLang;
  label: string;
};

function FlagUS({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 48"
      role="img"
      aria-hidden
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="48" fill="#b22234" />
      {/* white stripes */}
      <g fill="#fff">
        <rect y="4" width="64" height="4" />
        <rect y="12" width="64" height="4" />
        <rect y="20" width="64" height="4" />
        <rect y="28" width="64" height="4" />
        <rect y="36" width="64" height="4" />
        <rect y="44" width="64" height="4" />
      </g>
      {/* canton */}
      <rect width="28" height="20" fill="#3c3b6e" />
      {/* simplified stars */}
      <g fill="#fff" opacity="0.9">
        {Array.from({ length: 6 }).map((_, r) =>
          Array.from({ length: 8 }).map((__, c) => (
            <circle key={`${r}-${c}`} cx={2 + c * 3.2} cy={2 + r * 3.0} r={0.55} />
          ))
        )}
      </g>
    </svg>
  );
}

function FlagFR({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 3 2"
      role="img"
      aria-hidden
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="1" height="2" x="0" y="0" fill="#0055a4" />
      <rect width="1" height="2" x="1" y="0" fill="#fff" />
      <rect width="1" height="2" x="2" y="0" fill="#ef4135" />
    </svg>
  );
}

function FlagES({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 3 2"
      role="img"
      aria-hidden
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="3" height="2" fill="#aa151b" />
      <rect width="3" height="1" y="0.5" fill="#f1bf00" />
    </svg>
  );
}

function FlagIcon({ lang }: { lang: SupportedLang }) {
  const cls = 'h-4 w-6 rounded-sm ring-1 ring-white/10';
  if (lang === 'en') return <FlagUS className={cls} />;
  if (lang === 'fr') return <FlagFR className={cls} />;
  return <FlagES className={cls} />;
}

export default function LanguageSwitcher({
  className = ''
}: {
  className?: string;
}) {
  const { i18n, t } = useTranslation();

  const options: LangOption[] = useMemo(
    () => [
      { lang: 'en', label: t('lang.en') },
      { lang: 'fr', label: t('lang.fr') },
      { lang: 'es', label: t('lang.es') }
    ],
    [t]
  );

  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'en') as SupportedLang;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <span className="sr-only">{t('lang.label')}</span>
      {options.map((opt) => {
        const active = opt.lang === current;
        return (
          <button
            key={opt.lang}
            type="button"
            onClick={() => i18n.changeLanguage(opt.lang)}
            className={
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ' +
              (active
                ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                : 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700')
            }
            aria-pressed={active}
          >
            <span aria-hidden className="leading-none">
              <FlagIcon lang={opt.lang} />
            </span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
