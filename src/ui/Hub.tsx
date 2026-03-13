import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from './toast';
import { useTranslation } from 'react-i18next';
import EduTooltip from './EduTooltip';
import { trackEvent } from '../analytics/client';
import { getConceptChip } from './concepts';
import LanguageSwitcher from './LanguageSwitcher';
import {
  ChevronRight,
  Copy,
  Database,
  GitBranch,
  Github,
  HeartHandshake,
  Layers,
  Wallet,
  Lock,
  Search,
  Share2,
  Shield,
  TrendingUp,
  Users,
  X,
  Zap
} from 'lucide-react';

const homepageBackgroundUrl = new URL('../public/photo/Homepage_background.jpg', import.meta.url).href;

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
  /** Optional status for displaying disabled "Coming soon" cards. */
  status?: 'live' | 'coming_soon';
};

export default function Hub({
  demos,
  onOpenDemo
}: {
  demos: DemoMeta[];
  onOpenDemo: (demo: DemoMeta) => void;
}) {
  const SUPPORT_ADDRESS = '0xb4052F23366aaB355ba67C2c6D2dF465cf067c9A';
  const [showDonate, setShowDonate] = useState(false);

  const copyDonateAddress = async () => {
    trackEvent('donations_copy_address', { path: typeof window !== 'undefined' ? window.location.pathname : '/' });
    try {
      await navigator.clipboard.writeText(SUPPORT_ADDRESS);
      toast('Address copied');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = SUPPORT_ADDRESS;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Address copied');
    }
  };

  const shareSite = async () => {
    const url = 'https://blockchain-demo-hub.vercel.app';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Blockchain Learning Hub', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch {
      // ignore
    }
  };

  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredThumbnailDemoId, setHoveredThumbnailDemoId] = useState<string | null>(null);
  const [areFiltersVisible, setAreFiltersVisible] = useState(true);

  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [activeSuggestIndex, setActiveSuggestIndex] = useState(0);
  const [hasInteractedWithSuggest, setHasInteractedWithSuggest] = useState(false);

  const categories = useMemo(
    () =>
      ({
        all: { name: 'All Demos', icon: Layers, colorKey: 'blue' },
        consensus: { name: 'Consensus & Validation', icon: Shield, colorKey: 'emerald' },
        scaling: { name: 'Layer 2 & Scaling', icon: Zap, colorKey: 'purple' },
        execution: { name: 'Execution & Performance', icon: TrendingUp, colorKey: 'yellow' },
        data: { name: 'Data Availability', icon: Database, colorKey: 'cyan' },
        interop: { name: 'Cross-Chain & Bridges', icon: GitBranch, colorKey: 'pink' },
        security: { name: 'Security & Cryptography', icon: Lock, colorKey: 'red' },
        defi: { name: 'DeFi Mechanisms', icon: Users, colorKey: 'green' }
      }) as const,
    []
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
      .replace(/[\u0300-\u036f]/g, '')
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Upper Hero (header + filters) */}
        <div className="relative rounded-2xl">
          {/* Background (clipped to rounded corners) */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-45"
              style={{ backgroundImage: `url(${homepageBackgroundUrl})` }}
            />
            <div className="absolute inset-0 bg-slate-950/70" />
          </div>

          {/* Content (lets dropdown overflow) */}
          <div className="relative z-10">
            {/* Header */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Right: language (stays top-right on small screens) */}
            <div className="order-1 md:order-3 self-end md:self-auto shrink-0 flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAreFiltersVisible((v) => !v)}
                  className="md:hidden px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold whitespace-nowrap"
                >
                  {areFiltersVisible ? t('hub.hideFilters') : t('hub.showFilters')}
                </button>
                <LanguageSwitcher />
              </div>

              {areFiltersVisible && (
                <div className="hidden md:flex items-center justify-end gap-2 whitespace-nowrap">
                  <div className="px-4 py-2 bg-slate-800 rounded-full text-sm inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="text-slate-400">{t('app.totalDemos')}</span>
                    <span className="font-bold text-blue-400">{liveDemos.length}</span>
                  </div>
                  <div className="px-4 py-2 bg-slate-800 rounded-full text-sm inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="text-slate-400">{t('app.categories')}</span>
                    <span className="font-bold text-purple-400">{Object.keys(categories).length - 1}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Center: title */}
            <div className="order-2 md:order-2 flex-1 min-w-0 text-center">
              <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t('app.title')}
              </h1>
              <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto">
                {t('app.subtitle')}
              </p>
            </div>

            {/* Left: button (md+) */}
            <div className="order-3 md:order-1 hidden md:block shrink-0 pt-1">
              <button
                type="button"
                onClick={() => setAreFiltersVisible((v) => !v)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold"
              >
                {areFiltersVisible ? t('hub.hideFilters') : t('hub.showFilters')}
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        {areFiltersVisible && (
          <div className="mb-5 sm:mb-8">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-3 sm:mb-6">
            <div ref={searchWrapRef} className="flex-1 md:flex-none md:w-[820px] relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                size={20}
              />
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
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
              />

              {isSuggestOpen && suggestions.length > 0 && (
                <div className="absolute z-50 mt-2 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
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
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 hover:bg-slate-800 ${
                        idx === activeSuggestIndex ? 'bg-slate-800' : ''
                      }`}
                    >
                      <span className="text-sm text-slate-200 truncate">{s.value}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${
                          s.type === 'demo'
                            ? 'border-blue-600 text-blue-300'
                            : 'border-emerald-600 text-emerald-300'
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
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs text-slate-400">{t('hub.filterByCategory', { defaultValue: 'Filter by category' })}</div>
            <button
              type="button"
              onClick={() => setShowAllCategories((v) => !v)}
              className="md:hidden text-xs px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 whitespace-nowrap"
            >
              {showAllCategories ? t('common.less', { defaultValue: 'Less' }) : t('common.more', { defaultValue: 'More' })}
            </button>
          </div>

          {/* Mobile: compact categories (toggle More/Less) */}
          <div className="flex flex-wrap gap-2 sm:gap-3 md:hidden">
            {(Object.entries(categories) as Array<[string, (typeof categories)[keyof typeof categories]]>)
              .filter(([key]) => {
                if (showAllCategories) return true;
                // On small screens, show a compact set by default.
                return ['all', 'execution', 'defi', 'scaling', 'security'].includes(key);
              })
              .map(([key, category]) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key as CategoryId)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    isSelected
                      ? colorStyles[category.colorKey].selected
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-xs sm:text-sm font-semibold leading-snug line-clamp-2 max-w-[36vw] sm:max-w-none">
                    {category.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isSelected ? colorStyles[category.colorKey].countSelected : 'bg-slate-700'
                    }`}
                  >
                    {liveDemos.filter((d) => key === 'all' || d.category === key).length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Desktop: show all categories */}
          <div className="hidden md:flex flex-wrap gap-2 sm:gap-3">
            {(Object.entries(categories) as Array<[string, (typeof categories)[keyof typeof categories]]>).map(([key, category]) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key as CategoryId)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    isSelected
                      ? colorStyles[category.colorKey].selected
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-xs sm:text-sm font-semibold leading-snug line-clamp-2 max-w-[36vw] sm:max-w-none">
                    {category.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isSelected ? colorStyles[category.colorKey].countSelected : 'bg-slate-700'
                    }`}
                  >
                    {liveDemos.filter((d) => key === 'all' || d.category === key).length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 text-sm text-slate-400">
          {searchTerm
            ? t('hub.showingCountWithQuery', {
                filtered: filteredDemos.length,
                total: demos.length,
                query: searchTerm
              })
            : t('hub.showingCount', {
                filtered: filteredDemos.length,
                total: demos.length
              })}
        </div>

        {/* Demos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDemos.map((demo) => {
            const categoryColorKey = getCategoryColorKey(demo.category);
            const categoryStyle = colorStyles[categoryColorKey];
            const isComingSoon = demo.status === 'coming_soon';

            return (
              <div
                key={demo.id}
                onClick={isComingSoon ? undefined : () => onOpenDemo(demo)}
                onKeyDown={
                  isComingSoon
                    ? undefined
                    : (e) => {
                        if (e.key === 'Enter' || e.key === ' ') onOpenDemo(demo);
                      }
                }
                role={isComingSoon ? undefined : 'button'}
                tabIndex={isComingSoon ? -1 : 0}
                aria-disabled={isComingSoon ? true : undefined}
                className={`group relative bg-slate-800 rounded-xl border-2 border-slate-700 transition-all duration-300 overflow-hidden transform focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isComingSoon ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:border-blue-500 hover:scale-105'
                }`}
              >
                {/* Thumbnail */}
                <div
                  onMouseEnter={() => setHoveredThumbnailDemoId(demo.id)}
                  onMouseLeave={() => setHoveredThumbnailDemoId(null)}
                  className={`h-32 bg-gradient-to-br ${categoryStyle.thumb} flex items-center justify-center relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black opacity-50"></div>
                  <div className="relative z-10 group-hover:scale-110 transition-transform">
                    {/(\.png|\.jpe?g|\.webp|\.svg)(\?.*)?$/i.test(demo.thumbnail) ? (
                      <img
                        src={demo.thumbnail}
                        alt=""
                        className="h-20 w-20 object-contain drop-shadow"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-6xl">{demo.thumbnail}</div>
                    )}
                  </div>
                  <div
                    className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-bold ${
                      demo.status === 'coming_soon' ? 'bg-slate-700 text-slate-200' : getDifficultyColor(demo.difficulty)
                    }`}
                  >
                    {demo.status === 'coming_soon' ? t('common.comingSoon', { defaultValue: 'Coming soon' }) : demo.difficulty}
                  </div>

                  {/* Key Takeaways (thumbnail hover) */}
                  {hoveredThumbnailDemoId === demo.id && demo.keyTakeaways.length > 0 && (
                    <div className="absolute left-0 right-0 bottom-0 z-20 bg-slate-950/95 p-4 border-t-2 border-blue-500">
                      <div className="text-xs font-semibold text-blue-400 mb-2">{t('hub.keyTakeaways')}:</div>
                      <ul className="space-y-1">
                        {demo.keyTakeaways.slice(0, 3).map((takeaway, idx) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            <span className="line-clamp-2">{takeaway}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3
                    className={`text-xl font-bold mb-2 transition-colors ${
                      isComingSoon ? 'text-slate-200' : 'group-hover:text-blue-400'
                    }`}
                  >
                    {demo.title}
                  </h3>

                  <p className="text-sm text-slate-400 mb-4 line-clamp-2">{demo.description}</p>

                  {/* Concepts */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-slate-500 mb-2">{t('hub.keyConcepts')}:</div>
                    <div className="flex flex-wrap gap-1">
                      {demo.concepts.slice(0, 3).map((concept) => {
                        const chip = getConceptChip(concept, demo.category);
                        const Icon = chip.Icon;
                        const def = chip.definition ?? t('common.definitionComingSoon');

                        return (
                          <span
                            key={concept}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-slate-700 rounded text-slate-300"
                          >
                            <Icon size={12} className="text-slate-300" />
                            <span>{concept}</span>
                            <EduTooltip text={def} />
                          </span>
                        );
                      })}
                      {demo.concepts.length > 3 && (
                        <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">
                          +{demo.concepts.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {demo.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-xs px-2 py-1 rounded-full border ${categoryStyle.tag}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* View Button */}
                  {demo.status === 'coming_soon' ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 bg-slate-700 rounded-lg font-semibold flex items-center justify-center gap-2 text-slate-200 cursor-not-allowed"
                    >
                      {t('common.comingSoon', { defaultValue: 'Coming soon' })}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDemo(demo);
                      }}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      {t('hub.viewDetails')}
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>

        {/* No Results */}
        {filteredDemos.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold mb-2">{t('hub.noDemosFound')}</h3>
            <p className="text-slate-400">{t('hub.tryAdjustingSearch')}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <span className="text-slate-400">Created by</span>
                <span className="font-semibold text-white">Alexandre Touchard</span>
              </div>
              <a
                href="https://www.linkedin.com/in/alexandre-touchard-577b3baa/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm font-semibold"
              >
                <span className="font-bold">in</span>
                Connect on LinkedIn
              </a>
            </div>

            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                <HeartHandshake size={18} className="text-emerald-300" />
                <div className="font-semibold text-white">Support Blockchain Learning Hub</div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    trackEvent('donations_open', { path: typeof window !== 'undefined' ? window.location.pathname : '/' });
                    setShowDonate(true);
                  }}
                  className="inline-flex items-center justify-center md:justify-start gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm text-slate-200"
                >
                  <Wallet size={16} className="text-slate-300" />
                  Crypto donations (ETH / USDC)
                </button>

                <a
                  href="https://github.com/Alexandre-Touchard/cutting-edge-blockchain-concept-hub"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center md:justify-start gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm text-slate-200"
                >
                  <Github size={16} className="text-slate-300" />
                  Star the project on GitHub
                </a>

                <button
                  type="button"
                  onClick={shareSite}
                  className="inline-flex items-center justify-center md:justify-start gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm text-slate-200"
                >
                  <Share2 size={16} className="text-slate-300" />
                  Share the site
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-6 text-center md:text-left">© 2026 Alexandre Touchard. Interactive blockchain education demos.</p>

          {showDonate && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70" onClick={() => setShowDonate(false)} />
              <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold">Crypto donations (ETH / USDC)</div>
                    <div className="text-sm text-slate-400 mt-1">Ethereum address</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDonate(false)}
                    className="p-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                  <div className="font-mono text-sm break-all text-slate-200">{SUPPORT_ADDRESS}</div>
                  <button
                    type="button"
                    onClick={copyDonateAddress}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold"
                  >
                    <Copy size={16} />
                    Copy address
                  </button>
                  <div className="text-xs text-slate-400 mt-3">
                    Send ETH or USDC on Ethereum mainnet to support the project.
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
