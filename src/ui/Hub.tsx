import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from './toast';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../analytics/client';
import LanguageSwitcher from './LanguageSwitcher';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Database,
  GitBranch,
  Github,
  HeartHandshake,
  History,
  Info,
  Layers,
  Lock,
  Play,
  Route,
  Search,
  Share2,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap
} from 'lucide-react';

import ChainBackground from './ChainBackground';
import { usePersistentBoolean } from './usePersistentBoolean';
import { LEARNING_PATHS, START_DEMO_ID, isNewDemo } from '../demos/learningPaths';
import { readQuestSummaries, readRecentDemos, type QuestSummary } from '../demos/questProgress';

export type CategoryId = 'all' | 'consensus' | 'scaling' | 'execution' | 'data' | 'interop' | 'security' | 'defi';

export type DemoMeta = {
  id: string;
  title: string;
  category: Exclude<CategoryId, 'all'>;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  thumbnail: string;
  description: string;
  concepts: string[];
  keyTakeaways: string[];
  tags: string[];
  /** If present, enables the folded Learning Quests UI (icon + count). */
  learningQuestsTotal?: number;
  /** Optional status for displaying disabled "Coming soon" cards. */
  status?: 'live' | 'coming_soon';
  /** Date the demo was published (YYYY-MM-DD); recent ones get a "New" badge. */
  addedAt?: string;
};

const SITE_URL = 'https://blockchain-demo-hub.vercel.app';
const SUPPORT_ADDRESS = '0xb4052F23366aaB355ba67C2c6D2dF465cf067c9A';
const MAX_CONTINUE = 3;
/** localStorage keys for the hub's display preferences. */
const PREF_FILTERS_VISIBLE = 'hub:filters-visible';
const PREF_PATHS_VISIBLE = 'hub:paths-visible';

/** Hides the hero animation behind the text column; it only shows towards the edges. */
const HERO_ANIMATION_MASK: React.CSSProperties = {
  WebkitMaskImage: 'radial-gradient(ellipse 55% 75% at 50% 45%, transparent 0%, transparent 45%, black 90%)',
  maskImage: 'radial-gradient(ellipse 55% 75% at 50% 45%, transparent 0%, transparent 45%, black 90%)'
};

function isImage(thumbnail: string) {
  return /(\.png|\.jpe?g|\.webp|\.svg)(\?.*)?$/i.test(thumbnail);
}

/** Same frame for image and emoji thumbnails, so cards look consistent. */
function Thumb({ demo, size }: { demo: DemoMeta; size: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-16 w-16 rounded-2xl' : 'h-10 w-10 rounded-xl';
  return (
    <div className={`${box} flex shrink-0 items-center justify-center bg-slate-950/60 ring-1 ring-white/10 shadow-inner`}>
      {isImage(demo.thumbnail) ? (
        <img src={demo.thumbnail} alt="" className="h-full w-full object-contain p-1.5" loading="lazy" />
      ) : (
        <span className={size === 'lg' ? 'text-4xl' : 'text-2xl'} aria-hidden>
          {demo.thumbnail}
        </span>
      )}
    </div>
  );
}

export default function Hub({
  demos,
  onOpenDemo,
  onStartDemo
}: {
  demos: DemoMeta[];
  /** Opens the details modal. */
  onOpenDemo: (demo: DemoMeta) => void;
  /** Opens the demo itself. */
  onStartDemo: (demoId: string) => void;
}) {
  const { t } = useTranslation();
  const [showDonate, setShowDonate] = useState(false);

  const copyDonateAddress = async () => {
    trackEvent('donations_copy_address', { path: typeof window !== 'undefined' ? window.location.pathname : '/' });
    try {
      await navigator.clipboard.writeText(SUPPORT_ADDRESS);
      toast(t('hub.footer.addressCopied', { defaultValue: 'Address copied' }));
    } catch {
      const ta = document.createElement('textarea');
      ta.value = SUPPORT_ADDRESS;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast(t('hub.footer.addressCopied', { defaultValue: 'Address copied' }));
    }
  };

  const shareSite = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: t('app.title'), url: SITE_URL });
      } else {
        await navigator.clipboard.writeText(SITE_URL);
        toast(t('hub.footer.linkCopied', { defaultValue: 'Link copied' }));
      }
    } catch {
      // ignore
    }
  };

  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Display preferences, remembered in this browser.
  const [areFiltersVisible, , toggleFilters] = usePersistentBoolean(PREF_FILTERS_VISIBLE, true);
  const [arePathsVisible, , togglePaths] = usePersistentBoolean(PREF_PATHS_VISIBLE, true);

  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [activeSuggestIndex, setActiveSuggestIndex] = useState(0);
  const [hasInteractedWithSuggest, setHasInteractedWithSuggest] = useState(false);

  // Learning progress saved in this browser (see demos/questProgress.ts).
  const [progress] = useState<Record<string, QuestSummary>>(() => readQuestSummaries());
  const [recent] = useState(() => readRecentDemos());
  const now = useMemo(() => new Date(), []);

  const categories = useMemo(
    () =>
      ({
        all: { name: t('hub.categories.all', { defaultValue: 'All Demos' }), icon: Layers, colorKey: 'blue' },
        consensus: { name: t('hub.categories.consensus', { defaultValue: 'Consensus & Validation' }), icon: Shield, colorKey: 'emerald' },
        scaling: { name: t('hub.categories.scaling', { defaultValue: 'Layer 2 & Scaling' }), icon: Zap, colorKey: 'purple' },
        execution: { name: t('hub.categories.execution', { defaultValue: 'Execution & Performance' }), icon: TrendingUp, colorKey: 'yellow' },
        data: { name: t('hub.categories.data', { defaultValue: 'Data Availability' }), icon: Database, colorKey: 'cyan' },
        interop: { name: t('hub.categories.interop', { defaultValue: 'Cross-Chain & Bridges' }), icon: GitBranch, colorKey: 'pink' },
        security: { name: t('hub.categories.security', { defaultValue: 'Security & Cryptography' }), icon: Lock, colorKey: 'red' },
        defi: { name: t('hub.categories.defi', { defaultValue: 'DeFi Mechanisms' }), icon: Users, colorKey: 'green' }
      }) as const,
    [t]
  );

  const colorStyles = useMemo(
    () =>
      ({
        blue: {
          selected: 'border-blue-500 bg-blue-500/20 text-blue-300',
          countSelected: 'bg-blue-600',
          thumb: 'from-blue-900 to-slate-900',
          tag: 'bg-blue-900/30 text-blue-300 border-blue-700'
        },
        emerald: {
          selected: 'border-emerald-500 bg-emerald-500/20 text-emerald-300',
          countSelected: 'bg-emerald-600',
          thumb: 'from-emerald-900 to-slate-900',
          tag: 'bg-emerald-900/30 text-emerald-300 border-emerald-700'
        },
        purple: {
          selected: 'border-purple-500 bg-purple-500/20 text-purple-300',
          countSelected: 'bg-purple-600',
          thumb: 'from-purple-900 to-slate-900',
          tag: 'bg-purple-900/30 text-purple-300 border-purple-700'
        },
        yellow: {
          selected: 'border-yellow-500 bg-yellow-500/20 text-yellow-300',
          countSelected: 'bg-yellow-600',
          thumb: 'from-yellow-900 to-slate-900',
          tag: 'bg-yellow-900/30 text-yellow-300 border-yellow-700'
        },
        cyan: {
          selected: 'border-cyan-500 bg-cyan-500/20 text-cyan-300',
          countSelected: 'bg-cyan-600',
          thumb: 'from-cyan-900 to-slate-900',
          tag: 'bg-cyan-900/30 text-cyan-300 border-cyan-700'
        },
        pink: {
          selected: 'border-pink-500 bg-pink-500/20 text-pink-300',
          countSelected: 'bg-pink-600',
          thumb: 'from-pink-900 to-slate-900',
          tag: 'bg-pink-900/30 text-pink-300 border-pink-700'
        },
        red: {
          selected: 'border-red-500 bg-red-500/20 text-red-300',
          countSelected: 'bg-red-600',
          thumb: 'from-red-900 to-slate-900',
          tag: 'bg-red-900/30 text-red-300 border-red-700'
        },
        green: {
          selected: 'border-green-500 bg-green-500/20 text-green-300',
          countSelected: 'bg-green-600',
          thumb: 'from-green-900 to-slate-900',
          tag: 'bg-green-900/30 text-green-300 border-green-700'
        }
      }) as const,
    []
  );

  function normalizeForSearch(s: string): string {
    // Lowercase + strip diacritics + remove non-alphanumerics for forgiving matching.
    return s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const normalizedQueryCompact = normalizeForSearch(searchTerm.trim());

  const suggestions = useMemo(() => {
    if (!normalizedQuery)
      return [] as Array<{ type: 'demo' | 'concept' | 'tag'; value: string; demoId?: string }>;

    const items: Array<{ type: 'demo' | 'concept' | 'tag'; value: string; demoId?: string; score: number }> = [];

    for (const d of demos) {
      const title = d.title;
      const titleLc = title.toLowerCase();
      if (titleLc.includes(normalizedQuery)) {
        const score = titleLc.startsWith(normalizedQuery) ? 100 : 60;
        items.push({ type: 'demo', value: title, demoId: d.id, score });
      }

      for (const c of d.concepts) {
        const cLc = c.toLowerCase();
        const cCompact = normalizeForSearch(c);
        if (cLc.includes(normalizedQuery) || (normalizedQueryCompact && cCompact.includes(normalizedQueryCompact))) {
          const score = cLc.startsWith(normalizedQuery) || cCompact.startsWith(normalizedQueryCompact) ? 80 : 50;
          items.push({ type: 'concept', value: c, demoId: d.id, score });
        }
      }

      for (const tag of d.tags) {
        const tLc = tag.toLowerCase();
        const tCompact = normalizeForSearch(tag);
        if (tLc.includes(normalizedQuery) || (normalizedQueryCompact && tCompact.includes(normalizedQueryCompact))) {
          const score = tLc.startsWith(normalizedQuery) || tCompact.startsWith(normalizedQueryCompact) ? 70 : 45;
          items.push({ type: 'tag', value: tag, demoId: d.id, score });
        }
      }
    }

    // Deduplicate by type+value and keep best score.
    const best = new Map<string, (typeof items)[number]>();
    for (const it of items) {
      const key = `${it.type}:${it.value}`;
      const prev = best.get(key);
      if (!prev || it.score > prev.score) best.set(key, it);
    }

    return Array.from(best.values())
      .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
      .slice(0, 8)
      .map(({ score: _score, ...rest }) => rest);
  }, [demos, normalizedQuery]);

  useEffect(() => {
    setActiveSuggestIndex(0);
    setHasInteractedWithSuggest(false);
  }, [normalizedQuery]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = searchWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setIsSuggestOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const liveDemos = demos.filter((d) => d.status !== 'coming_soon');
  const demoById = useMemo(() => new Map(demos.map((d) => [d.id, d])), [demos]);
  const totalQuests = liveDemos.reduce((sum, d) => sum + (d.learningQuestsTotal ?? 0), 0);

  const filteredDemos = demos.filter((demo) => {
    const matchesCategory = selectedCategory === 'all' || demo.category === selectedCategory;
    const q = normalizedQuery;
    const qCompact = normalizedQueryCompact;

    const matchesSearch =
      !q ||
      demo.title.toLowerCase().includes(q) ||
      demo.description.toLowerCase().includes(q) ||
      demo.concepts.some((c) => c.toLowerCase().includes(q)) ||
      demo.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      (qCompact.length > 0 &&
        (normalizeForSearch(demo.title).includes(qCompact) ||
          normalizeForSearch(demo.description).includes(qCompact) ||
          demo.concepts.some((c) => normalizeForSearch(c).includes(qCompact)) ||
          demo.tags.some((tag) => normalizeForSearch(tag).includes(qCompact))));
    return matchesCategory && matchesSearch;
  });

  // Live demos in the grid (new ones first); coming-soon ones in a teaser row at the end.
  const filteredLive = filteredDemos
    .filter((d) => d.status !== 'coming_soon')
    .sort((a, b) => Number(isNewDemo(b.addedAt, now)) - Number(isNewDemo(a.addedAt, now)));
  const filteredComingSoon = filteredDemos.filter((d) => d.status === 'coming_soon');

  const isBrowsing = !normalizedQuery && selectedCategory === 'all';
  const spotlight = useMemo(
    () =>
      liveDemos
        .filter((d) => isNewDemo(d.addedAt, now))
        .sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''))[0],
    [liveDemos, now]
  );
  const continueDemos = recent
    .map((v) => demoById.get(v.id))
    .filter((d): d is DemoMeta => !!d && d.status !== 'coming_soon')
    .slice(0, MAX_CONTINUE);

  const getDifficultyColor = (difficulty: DemoMeta['difficulty']) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-600';
      case 'Intermediate':
        return 'bg-yellow-600';
      case 'Advanced':
        return 'bg-red-600';
      default:
        return 'bg-slate-600';
    }
  };

  const getCategoryColorKey = (category: DemoMeta['category']) => {
    return categories[category]?.colorKey ?? 'blue';
  };

  /** "✓ 3/5 quests" once started, "5 quests" otherwise; nothing for demos without quests. */
  const progressBadge = (demo: DemoMeta) => {
    const p = progress[demo.id];
    if (p && p.best > 0) {
      const complete = p.best >= p.total;
      return (
        <span
          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            complete ? 'border-emerald-600 bg-emerald-900/40 text-emerald-200' : 'border-amber-600 bg-amber-900/30 text-amber-200'
          }`}
        >
          <CheckCircle2 size={12} />
          {t('hub.questsProgress', { defaultValue: '{{done}}/{{total}} quests', done: p.best, total: p.total })}
        </span>
      );
    }
    if (demo.learningQuestsTotal) {
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-600 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300">
          📋 {t('hub.questsCount', { defaultValue: '{{count}} quests', count: demo.learningQuestsTotal })}
        </span>
      );
    }
    return null;
  };

  const newBadge = (
    <span className="inline-flex items-center gap-1 rounded-full bg-pink-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
      <Sparkles size={11} />
      {t('hub.new', { defaultValue: 'New' })}
    </span>
  );

  /** Compact tile used in "Continue" and learning paths. */
  const tile = (demo: DemoMeta, step?: number) => {
    const isComingSoon = demo.status === 'coming_soon';
    return (
      <button
        key={demo.id}
        type="button"
        disabled={isComingSoon}
        onClick={() => onStartDemo(demo.id)}
        className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
          isComingSoon
            ? 'cursor-not-allowed border-slate-800 bg-slate-900/40 opacity-60'
            : 'border-slate-700 bg-slate-800/70 hover:border-blue-500 hover:bg-slate-800'
        }`}
      >
        {step !== undefined ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">
            {step}
          </span>
        ) : null}
        <Thumb demo={demo} size="sm" />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold leading-snug ${isComingSoon ? 'text-slate-300' : 'text-slate-100 group-hover:text-blue-300'}`}>
            {demo.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {isComingSoon ? (
              <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">
                {t('common.comingSoon', { defaultValue: 'Coming soon' })}
              </span>
            ) : (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getDifficultyColor(demo.difficulty)}`}>{demo.difficulty}</span>
            )}
            {!isComingSoon ? progressBadge(demo) : null}
          </span>
        </span>
      </button>
    );
  };

  const sectionTitle = (icon: React.ReactNode, title: string, subtitle?: string) => (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100 sm:text-2xl">
        {icon}
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
    </div>
  );

  const categoryButtons = (keys: Array<keyof typeof categories>) =>
    keys.map((key) => {
      const category = categories[key];
      const Icon = category.icon;
      const isSelected = selectedCategory === key;
      return (
        <button
          key={key}
          onClick={() => setSelectedCategory(key as CategoryId)}
          aria-pressed={isSelected}
          className={`px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
            isSelected ? colorStyles[category.colorKey].selected : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-400'
          }`}
        >
          <Icon size={14} />
          <span className="text-xs font-semibold leading-snug line-clamp-2 max-w-[36vw] sm:max-w-none">{category.name}</span>
          <span className={`text-[11px] px-1.5 rounded-full ${isSelected ? colorStyles[category.colorKey].countSelected : 'bg-slate-700'}`}>
            {liveDemos.filter((d) => key === 'all' || d.category === key).length}
          </span>
        </button>
      );
    });

  const allCategoryKeys = Object.keys(categories) as Array<keyof typeof categories>;
  const compactCategoryKeys = allCategoryKeys.filter((k) => showAllCategories || ['all', 'execution', 'defi', 'scaling', 'security'].includes(k));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* ------------------------------------------------------------------ */}
        {/* Hero                                                               */}
        {/* ------------------------------------------------------------------ */}
        <div className="relative rounded-2xl">
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl">
            {/* Readability: the chains are masked out behind the text (centre) and dimmed overall,
                so they frame the hero instead of moving behind the words. */}
            <div className="absolute inset-0 opacity-60" style={HERO_ANIMATION_MASK}>
              <ChainBackground className="absolute inset-0 h-full w-full" />
            </div>
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 75% 70% at 50% 42%, rgba(2,6,23,0.94) 0%, rgba(2,6,23,0.8) 55%, rgba(2,6,23,0.55) 100%)'
              }}
            />
          </div>

          <div className="relative z-10 px-2 pb-5 pt-2 sm:px-6 sm:pt-4">
            {/* Toolbar row (kept separate: the 3-flag language switcher is too wide to share the title's row). */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFilters}
                  aria-pressed={!areFiltersVisible}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs sm:text-sm font-semibold whitespace-nowrap"
                >
                  {areFiltersVisible ? t('hub.hideFilters') : t('hub.showFilters')}
                </button>
                <button
                  type="button"
                  onClick={togglePaths}
                  aria-pressed={!arePathsVisible}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs sm:text-sm font-semibold whitespace-nowrap"
                >
                  {arePathsVisible
                    ? t('hub.hidePaths', { defaultValue: 'Hide learning paths' })
                    : t('hub.showPaths', { defaultValue: 'Show learning paths' })}
                </button>
              </div>
              <LanguageSwitcher />
            </div>

            {/* Pitch + calls to action */}
            <div className="mx-auto mt-3 max-w-5xl text-center">
              {/* Wider column + slightly smaller on lg so FR/ES titles (33–35 chars) stay on one line. */}
              <h1 className="mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text pb-1 text-3xl font-bold leading-tight text-transparent md:text-4xl lg:whitespace-nowrap lg:text-[2.75rem]">
                {t('app.title')}
              </h1>
              {/* One line from lg up (text-base on lg, text-lg on xl); wraps on tablets/phones. Keep translations ≤ 105 chars. */}
              <p className="mx-auto text-base text-slate-100 lg:whitespace-nowrap xl:text-lg">
                {t('hub.pitch', {
                  defaultValue: 'Learn how blockchains really work by playing with them: {{count}} hands-on simulations, free, no sign-up.',
                  count: liveDemos.length
                })}
              </p>

              <div className="mt-4 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onStartDemo(START_DEMO_ID)}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-5 py-2.5 text-base font-semibold shadow-lg shadow-blue-900/40 hover:bg-blue-500"
                >
                  <Play size={18} />
                  {t('hub.ctaStart', { defaultValue: 'Start with the basics' })}
                  <ArrowRight size={18} />
                </button>
                {spotlight ? (
                  <button
                    type="button"
                    onClick={() => onStartDemo(spotlight.id)}
                    className="inline-flex max-w-full items-center gap-2 rounded-xl border border-pink-500/60 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-pink-100 hover:border-pink-400 hover:bg-slate-900"
                  >
                    <Sparkles size={16} className="shrink-0 text-pink-300" />
                    <span className="truncate">{t('hub.ctaNew', { defaultValue: 'New: {{title}}', title: spotlight.title })}</span>
                    <ArrowRight size={16} className="shrink-0" />
                  </button>
                ) : null}
              </div>

              {/* Selling points: one muted line (demo count and "free" are already in the pitch). */}
              <p className="mt-3 text-xs text-slate-300 sm:text-sm">
                {t('hub.stats.quests', { defaultValue: '{{count}} learning quests', count: totalQuests })}
                <span className="mx-2" aria-hidden>
                  ·
                </span>
                {t('hub.stats.languages', { defaultValue: 'English · Français · Español' })}
              </p>
            </div>

            {/* Filters */}
            {areFiltersVisible && (
              <div className="mt-5">
                <div className="mb-3 flex justify-center">
                  <div ref={searchWrapRef} className="relative w-full max-w-3xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 transform text-slate-400" size={20} />
                    <input
                      type="text"
                      placeholder={t('app.searchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsSuggestOpen(true);
                      }}
                      onFocus={() => {
                        if (suggestions.length > 0) setIsSuggestOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (!isSuggestOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                          if (suggestions.length > 0) setIsSuggestOpen(true);
                          return;
                        }

                        if (!isSuggestOpen) return;

                        if (e.key === 'Escape') {
                          setIsSuggestOpen(false);
                          return;
                        }

                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHasInteractedWithSuggest(true);
                          setActiveSuggestIndex((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
                          return;
                        }

                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHasInteractedWithSuggest(true);
                          setActiveSuggestIndex((i) => Math.max(i - 1, 0));
                          return;
                        }

                        if (e.key === 'Enter') {
                          // Let Enter perform a normal search by default.
                          // Only accept an autocomplete suggestion if the user explicitly interacted with the list.
                          if (hasInteractedWithSuggest) {
                            const picked = suggestions[activeSuggestIndex];
                            if (picked) {
                              e.preventDefault();
                              setSearchTerm(picked.value);
                              setIsSuggestOpen(false);
                            }
                          } else {
                            setIsSuggestOpen(false);
                          }
                        }
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-blue-500 focus:outline-none"
                    />

                    {isSuggestOpen && suggestions.length > 0 && (
                      <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                        {suggestions.map((s, idx) => (
                          <button
                            key={`${s.type}:${s.value}`}
                            type="button"
                            onMouseEnter={() => {
                              setHasInteractedWithSuggest(true);
                              setActiveSuggestIndex(idx);
                            }}
                            onMouseDown={(e) => {
                              // Prevent input blur before we set value.
                              e.preventDefault();
                              setSearchTerm(s.value);
                              setIsSuggestOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-800 ${
                              idx === activeSuggestIndex ? 'bg-slate-800' : ''
                            }`}
                          >
                            <span className="truncate text-sm text-slate-200">{s.value}</span>
                            <span
                              className={`rounded border px-2 py-0.5 text-xs ${
                                s.type === 'demo' ? 'border-blue-600 text-blue-300' : 'border-emerald-600 text-emerald-300'
                              }`}
                            >
                              {s.type}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Category Filters */}
                {/* Label + More/Less only on phones; on md+ the chips speak for themselves. */}
                <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
                  <div className="text-xs text-slate-400">{t('hub.filterByCategory', { defaultValue: 'Filter by category' })}</div>
                  <button
                    type="button"
                    onClick={() => setShowAllCategories((v) => !v)}
                    className="md:hidden text-xs px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 whitespace-nowrap"
                  >
                    {showAllCategories ? t('common.less', { defaultValue: 'Less' }) : t('common.more', { defaultValue: 'More' })}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 md:hidden">{categoryButtons(compactCategoryKeys)}</div>
                <div className="hidden md:flex flex-wrap justify-center gap-2" role="group" aria-label={t('hub.filterByCategory', { defaultValue: 'Filter by category' })}>
                  {categoryButtons(allCategoryKeys)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Curated sections (only when browsing, not when searching/filtering) */}
        {/* ------------------------------------------------------------------ */}
        {isBrowsing ? (
          <>
            {continueDemos.length > 0 ? (
              <section className="mt-10">
                {sectionTitle(
                  <History className="text-amber-300" />,
                  t('hub.continueTitle', { defaultValue: 'Continue where you left off' }),
                  t('hub.progressNote', { defaultValue: 'Your progress is saved in this browser only.' })
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{continueDemos.map((d) => tile(d))}</div>
              </section>
            ) : null}

            {spotlight ? (
              <section className="mt-10">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onStartDemo(spotlight.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onStartDemo(spotlight.id);
                    }
                  }}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-pink-500/40 bg-gradient-to-r from-pink-950/60 via-purple-950/50 to-slate-900 p-5 transition-colors hover:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Thumb demo={spotlight} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {newBadge}
                        <span className={`rounded px-2 py-0.5 text-xs font-bold ${getDifficultyColor(spotlight.difficulty)}`}>{spotlight.difficulty}</span>
                      </div>
                      <h2 className="text-xl font-bold text-white group-hover:text-pink-200 sm:text-2xl">{spotlight.title}</h2>
                      <p className="mt-1 text-sm text-slate-300 sm:text-base">{spotlight.description}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-pink-600 px-4 py-2 font-semibold group-hover:bg-pink-500">
                        <Play size={16} />
                        {t('hub.start', { defaultValue: 'Start' })}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDemo(spotlight);
                        }}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm hover:bg-slate-800"
                      >
                        <Info size={15} />
                        {t('hub.details', { defaultValue: 'Details' })}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {arePathsVisible ? (
            <section className="mt-10">
              {sectionTitle(
                <Route className="text-blue-300" />,
                t('hub.pathsTitle', { defaultValue: 'Learning paths' }),
                t('hub.pathsSubtitle', { defaultValue: 'Not sure where to start? Follow a path, one demo after another.' })
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {LEARNING_PATHS.map((path) => {
                  const pathDemos = path.demoIds.map((id) => demoById.get(id)).filter((d): d is DemoMeta => !!d);
                  return (
                    <div key={path.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                      <h3 className="font-bold text-slate-100">{t(`hub.paths.${path.id}.title`, { defaultValue: path.title })}</h3>
                      <p className="mb-3 text-sm text-slate-400">{t(`hub.paths.${path.id}.description`, { defaultValue: path.description })}</p>
                      <div className="space-y-2">{pathDemos.map((d, i) => tile(d, i + 1))}</div>
                    </div>
                  );
                })}
              </div>
            </section>
            ) : null}

            <div className="mt-12">{sectionTitle(<Layers className="text-purple-300" />, t('hub.allDemos', { defaultValue: 'All demos' }))}</div>
          </>
        ) : (
          <div className="mt-8" />
        )}

        {/* Results Count */}
        {!isBrowsing ? (
          <div className="mb-6 text-sm text-slate-400">
            {searchTerm
              ? t('hub.showingCountWithQuery', { filtered: filteredDemos.length, total: demos.length, query: searchTerm })
              : t('hub.showingCount', { filtered: filteredDemos.length, total: demos.length })}
          </div>
        ) : null}

        {/* ------------------------------------------------------------------ */}
        {/* Demo grid (live demos)                                             */}
        {/* ------------------------------------------------------------------ */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredLive.map((demo) => {
            const categoryStyle = colorStyles[getCategoryColorKey(demo.category)];
            const fresh = isNewDemo(demo.addedAt, now);
            return (
              <div
                key={demo.id}
                onClick={() => onStartDemo(demo.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onStartDemo(demo.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`${demo.title}: ${t('hub.start', { defaultValue: 'Start' })}`}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 border-slate-700 bg-slate-800 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-950/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {/* Thumbnail */}
                <div className={`relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br ${categoryStyle.thumb}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black opacity-40" />
                  <div className="relative z-10 transition-transform group-hover:scale-110">
                    <Thumb demo={demo} size="lg" />
                  </div>
                  {fresh ? <div className="absolute left-3 top-3 z-10">{newBadge}</div> : null}
                  <div className={`absolute right-3 top-3 z-10 rounded px-2 py-1 text-xs font-bold ${getDifficultyColor(demo.difficulty)}`}>
                    {demo.difficulty}
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="mb-2 text-lg font-bold leading-snug transition-colors group-hover:text-blue-400">{demo.title}</h3>
                  <p className="mb-4 line-clamp-2 text-sm text-slate-400">{demo.description}</p>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {demo.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className={`rounded-full border px-2 py-0.5 text-xs ${categoryStyle.tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center gap-2">
                    {progressBadge(demo)}
                    <div className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDemo(demo);
                        }}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                      >
                        <Info size={15} />
                        {t('hub.details', { defaultValue: 'Details' })}
                      </button>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold group-hover:bg-blue-500">
                        <Play size={15} />
                        {t('hub.start', { defaultValue: 'Start' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coming soon teaser */}
        {filteredComingSoon.length > 0 ? (
          <section className="mt-10">
            {sectionTitle(
              <Sparkles className="text-slate-400" />,
              t('hub.comingSoonTitle', { defaultValue: 'Coming soon' }),
              t('hub.comingSoonSubtitle', { defaultValue: 'In the works. Star the project on GitHub to hear when they go live.' })
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredComingSoon.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-3" aria-disabled>
                  <Thumb demo={d} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-200">{d.title}</div>
                    <div className="line-clamp-1 text-xs text-slate-400">{d.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* No Results */}
        {filteredDemos.length === 0 && (
          <div className="py-20 text-center">
            <div className="mb-4 text-6xl">🔍</div>
            <h3 className="mb-2 text-2xl font-bold">{t('hub.noDemosFound')}</h3>
            <p className="text-slate-400">{t('hub.tryAdjustingSearch')}</p>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Footer                                                             */}
        {/* ------------------------------------------------------------------ */}
        <div className="mt-12 border-t border-slate-800 pt-6">
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
            <div className="text-center md:text-left">
              <div className="mb-2 flex items-center justify-center gap-3 md:justify-start">
                <span className="text-slate-400">{t('hub.footer.createdBy', { defaultValue: 'Created by' })}</span>
                <span className="font-semibold text-white">Alexandre Touchard</span>
              </div>
              <a
                href="https://www.linkedin.com/in/alexandre-touchard-577b3baa/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold transition-colors hover:bg-blue-700"
              >
                <span className="font-bold">in</span>
                {t('hub.footer.linkedin', { defaultValue: 'Connect on LinkedIn' })}
              </a>
            </div>

            <div className="text-center md:text-left">
              <div className="mb-3 flex items-center justify-center gap-2 md:justify-start">
                <HeartHandshake size={18} className="text-emerald-300" />
                <div className="font-semibold text-white">{t('hub.footer.support', { defaultValue: 'Support Blockchain Learning Hub' })}</div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    trackEvent('donations_open', { path: typeof window !== 'undefined' ? window.location.pathname : '/' });
                    setShowDonate(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 md:justify-start"
                >
                  <Wallet size={16} className="text-slate-300" />
                  {t('hub.footer.donations', { defaultValue: 'Crypto donations (ETH / USDC)' })}
                </button>

                <a
                  href="https://github.com/Alexandre-Touchard/cutting-edge-blockchain-concept-hub"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 md:justify-start"
                >
                  <Github size={16} className="text-slate-300" />
                  {t('hub.footer.star', { defaultValue: 'Star the project on GitHub' })}
                </a>

                <button
                  type="button"
                  onClick={shareSite}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 md:justify-start"
                >
                  <Share2 size={16} className="text-slate-300" />
                  {t('hub.footer.share', { defaultValue: 'Share the site' })}
                </button>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500 md:text-left">
            {t('hub.footer.copyright', {
              defaultValue: '© {{year}} Alexandre Touchard. Interactive blockchain education demos.',
              year: new Date().getFullYear()
            })}
          </p>

          {showDonate && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70" onClick={() => setShowDonate(false)} />
              <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold">{t('hub.footer.donations', { defaultValue: 'Crypto donations (ETH / USDC)' })}</div>
                    <div className="mt-1 text-sm text-slate-400">{t('hub.footer.ethAddress', { defaultValue: 'Ethereum address' })}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDonate(false)}
                    className="rounded-lg border border-slate-700 bg-slate-900 p-2 hover:bg-slate-800"
                    aria-label={t('hub.footer.close', { defaultValue: 'Close' })}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                  <div className="break-all font-mono text-sm text-slate-200">{SUPPORT_ADDRESS}</div>
                  <button
                    type="button"
                    onClick={copyDonateAddress}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-700"
                  >
                    <Copy size={16} />
                    {t('hub.footer.copyAddress', { defaultValue: 'Copy address' })}
                  </button>
                  <div className="mt-3 text-xs text-slate-400">
                    {t('hub.footer.donateHint', { defaultValue: 'Send ETH or USDC on Ethereum mainnet to support the project.' })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
