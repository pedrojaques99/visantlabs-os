import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Search, X, Plus, SlidersHorizontal } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { MiniAppCard, MINIAPP_CATEGORY_CONFIG } from '@/components/playground/MiniAppCard';
import { getFeed, type MiniAppSummary } from '@/services/playgroundApi';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { Zap } from 'lucide-react';

type SortKey = 'newest' | 'likes' | 'popular';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'likes', label: 'Most liked' },
  { value: 'popular', label: 'Most viewed' },
];

const CATEGORIES = ['all', ...Object.keys(MINIAPP_CATEGORY_CONFIG)] as const;

export const PlaygroundGalleryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [miniApps, setMiniApps] = useState<MiniAppSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getFeed({
        category: category === 'all' ? undefined : category,
        sort,
        search: search || undefined,
        take: 50,
      });
      setMiniApps(result.miniApps);
      setTotal(result.total);
    } catch {
      setMiniApps([]);
    } finally {
      setIsLoading(false);
    }
  }, [category, sort, search]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const filteredApps = useMemo(() => {
    if (!search.trim()) return miniApps;
    const q = search.toLowerCase();
    return miniApps.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [miniApps, search]);

  return (
    <PageShell pageId="playground-gallery" title="Playground">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-200">Explore MiniApps</h1>
            <p className="text-[11px] text-neutral-500 mt-1">
              {total} apps created by the community
            </p>
          </div>
          <Button variant="brand" size="sm" onClick={() => navigate('/playground')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search miniapps..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-neutral-900/50 border border-neutral-800 rounded-lg text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-brand-cyan/30"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-neutral-500 hover:text-neutral-300" />
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {CATEGORIES.map((cat) => {
              const config: { icon: LucideIcon; color: string; label: string } =
                cat === 'all'
                  ? { icon: SlidersHorizontal, color: 'text-neutral-400', label: 'All' }
                  : MINIAPP_CATEGORY_CONFIG[cat];
              const Icon = config.icon;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all',
                    category === cat
                      ? 'bg-white/10 text-neutral-200 border border-white/20'
                      : 'text-neutral-500 border border-transparent hover:text-neutral-300 hover:border-neutral-800'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-[11px] bg-neutral-900/50 border border-neutral-800 rounded-lg px-2.5 py-2 text-neutral-400 focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-hidden"
              >
                <SkeletonLoader variant="rectangular" height="140px" />
                <div className="p-3 space-y-2">
                  <SkeletonLoader variant="text" width="60%" />
                  <SkeletonLoader variant="text" width="90%" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredApps.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No miniapps yet"
            description={
              search
                ? 'Try a different search term'
                : 'Be the first to create and publish a miniapp!'
            }
            actionLabel="Create MiniApp"
            onAction={() => navigate('/playground')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredApps.map((app) => (
              <MiniAppCard
                key={app.id}
                miniApp={app}
                onClick={() => navigate(`/playground/${app.slug}`)}
              />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
};
