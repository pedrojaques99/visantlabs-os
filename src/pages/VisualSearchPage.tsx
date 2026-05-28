import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Search, ExternalLink, X, Minus, Plus, Filter, Image, Type, Layout, Layers, Compass, type LucideIcon } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SearchBar } from '../components/ui/SearchBar';
import { Button } from '../components/ui/button';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { cn } from '@/lib/utils';
import { visualSearchApi, type VisualSearchResult, type SearchSource, type SearchIntent } from '@/services/visualSearchApi';

// ── Types ──────────────────────────────────────────────────────────────────

type TabId = 'all' | 'photos' | 'logos' | 'typography' | 'layouts';

interface Tab {
  id: TabId;
  label: string;
  icon: LucideIcon;
  sources?: SearchSource[];
}

const TABS: Tab[] = [
  { id: 'all', label: 'All', icon: Compass },
  { id: 'photos', label: 'Photos', icon: Image, sources: ['unsplash', 'pexels'] },
  { id: 'logos', label: 'Logos', icon: Layers, sources: ['svgl', 'clearbit'] },
  { id: 'typography', label: 'Typography', icon: Type, sources: ['unsplash', 'pexels', 'wikimedia'] },
  { id: 'layouts', label: 'Layouts', icon: Layout, sources: ['unsplash', 'pexels'] },
];

const SOURCE_LABELS: Record<SearchSource, string> = {
  unsplash: 'Unsplash',
  pexels: 'Pexels',
  pixabay: 'Pixabay',
  wikimedia: 'Wikimedia',
  clearbit: 'Clearbit',
  svgl: 'Svgl',
};

const INTENT_LABELS: Record<SearchIntent, string> = {
  letter: 'Letter Detection',
  logo: 'Logo Search',
  layout: 'Layout Search',
  typography: 'Typography Search',
  mixed: 'Visual Search',
};

// ── Component ──────────────────────────────────────────────────────────────

export const VisualSearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [results, setResults] = useState<VisualSearchResult[]>([]);
  const [intent, setIntent] = useState<SearchIntent>('mixed');
  const [sourceSummary, setSourceSummary] = useState<{ source: SearchSource; count: number; error?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedResult, setSelectedResult] = useState<VisualSearchResult | null>(null);
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('visualSearchColumns');
    return saved ? parseInt(saved, 10) : 4;
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleColumnsChange = useCallback((delta: number) => {
    setColumns(prev => {
      const next = Math.max(2, Math.min(6, prev + delta));
      localStorage.setItem('visualSearchColumns', String(next));
      return next;
    });
  }, []);

  const performSearch = useCallback(async (searchQuery: string, tab: TabId, pageNum = 1, append = false) => {
    if (searchQuery.trim().length < 2) return;

    if (!append) {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
    }

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setHasSearched(true);
    }

    try {
      const activeTabDef = TABS.find(t => t.id === tab);
      const response = await visualSearchApi.search(searchQuery, {
        sources: activeTabDef?.sources,
        limit: 30,
        page: pageNum,
      });

      if (append) {
        setResults(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newResults = response.results.filter(r => !existingIds.has(r.id));
          return [...prev, ...newResults];
        });
      } else {
        setResults(response.results);
      }
      setIntent(response.intent);
      setSourceSummary(response.sources);
      setHasMore(response.hasMore);
      setPage(pageNum);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[VisualSearch] Error:', err.message);
        if (!append) setResults([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setPage(1);
      setHasMore(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query, activeTab, 1, false);
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, activeTab, performSearch]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore && query.trim().length >= 2) {
          performSearch(query, activeTab, page + 1, true);
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, page, query, activeTab, performSearch]);

  const filteredResults = useMemo(() => {
    if (activeTab === 'all') return results;
    return results.filter(r => {
      switch (activeTab) {
        case 'photos': return r.type === 'photo';
        case 'logos': return r.type === 'logo' || r.type === 'vector';
        case 'typography': return true;
        case 'layouts': return true;
        default: return true;
      }
    });
  }, [results, activeTab]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <PageShell
      pageId="visual-search"
      seoTitle="Visual Search — Visant Labs"
      seoDescription="Search for design inspiration, typography, logos, and layouts"
      title="Visual Search"
      microTitle="Discovery // Visual Search"
      description="Search across Unsplash, Pexels, Wikimedia, and brand logo databases"
      breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Visual Search' }]}
      width="full"
    >
      {/* Search + Tabs */}
      <div className="space-y-4 mb-6">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search letters, logos, layouts, typography..."
          className="!py-2.5 !text-sm !pl-10 !pr-10"
          iconSize={16}
          containerClassName="max-w-2xl"
        />

        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider border transition-all',
                  isActive
                    ? 'bg-white/5 border-white/10 text-neutral-200'
                    : 'border-transparent text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.02]'
                )}
              >
                <Icon size={12} className="shrink-0" />
                {tab.label}
              </button>
            );
          })}

          {hasSearched && !isLoading && (
            <span className="ml-auto text-[10px] font-mono text-neutral-700 uppercase">
              {INTENT_LABELS[intent]} · {filteredResults.length} results
            </span>
          )}
        </div>

        {/* Source badges */}
        {sourceSummary.length > 0 && !isLoading && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {sourceSummary.map(s => (
              <span
                key={s.source}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-mono border',
                  s.count > 0
                    ? 'text-neutral-400 border-neutral-800 bg-neutral-900/50'
                    : 'text-neutral-700 border-neutral-900'
                )}
              >
                {SOURCE_LABELS[s.source]}: {s.count}
                {s.error && ' ⚠'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Results Grid */}
      {isLoading ? (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${isMobile ? 2 : columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <GlassPanel key={i} className="overflow-hidden">
              <div className="aspect-square bg-neutral-900/50 animate-pulse" />
            </GlassPanel>
          ))}
        </div>
      ) : filteredResults.length > 0 ? (
        <>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${isMobile ? 2 : columns}, minmax(0, 1fr))` }}
          >
            {filteredResults.map(result => (
              <ResultCard
                key={result.id}
                result={result}
                onClick={() => setSelectedResult(result)}
              />
            ))}
          </div>

          <div ref={sentinelRef} className="h-1" />

          {isLoadingMore && (
            <div
              className="grid gap-3 mt-3"
              style={{ gridTemplateColumns: `repeat(${isMobile ? 2 : columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columns }).map((_, i) => (
                <GlassPanel key={`loader-${i}`} className="overflow-hidden">
                  <div className="aspect-square bg-neutral-900/50 animate-pulse" />
                </GlassPanel>
              ))}
            </div>
          )}

          {!hasMore && results.length > 0 && (
            <p className="text-center text-[10px] font-mono text-neutral-700 uppercase mt-6 mb-2">
              End of results
            </p>
          )}
        </>
      ) : hasSearched ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
          <Search size={32} className="mb-3 text-neutral-700" />
          <p className="text-sm">No results found for "{query}"</p>
          <p className="text-[11px] text-neutral-700 mt-1">Try different keywords or check available sources</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
          <Search size={32} className="mb-3 text-neutral-700" />
          <p className="text-sm">Search for design inspiration</p>
          <p className="text-[11px] text-neutral-700 mt-1">
            Try: "Logo Minimalista", "Layout Editorial", "Tipografia Vintage"
          </p>
        </div>
      )}

      {/* Column Controls */}
      {filteredResults.length > 0 && !isMobile && (
        <div className="fixed bottom-4 md:bottom-6 left-4 md:left-6 z-30">
          <GlassPanel padding="sm" className="!flex-row items-center gap-1">
            <Button
              variant="ghost"
              onClick={() => handleColumnsChange(-1)}
              disabled={columns <= 2}
              className="p-1.5 text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
            >
              <Minus size={14} />
            </Button>
            <span className="text-xs font-mono text-neutral-400 min-w-[1.5rem] text-center">
              {columns}
            </span>
            <Button
              variant="ghost"
              onClick={() => handleColumnsChange(1)}
              disabled={columns >= 6}
              className="p-1.5 text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
            >
              <Plus size={14} />
            </Button>
          </GlassPanel>
        </div>
      )}

      {/* Detail Modal */}
      {selectedResult && (
        <ResultModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </PageShell>
  );
};

// ── Result Card ────────────────────────────────────────────────────────────

const ResultCard: React.FC<{
  result: VisualSearchResult;
  onClick: () => void;
}> = ({ result, onClick }) => (
  <GlassPanel className="group relative overflow-hidden hover:border-white/10 cursor-pointer" onClick={onClick}>
    <div className="aspect-square relative overflow-hidden bg-neutral-900/50">
      <img
        src={result.thumbnailUrl}
        alt={result.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-neutral-950/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
        <p className="text-[11px] text-neutral-200 line-clamp-2 leading-relaxed">{result.title}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[9px] font-mono text-neutral-500 uppercase px-1.5 py-0.5 bg-neutral-900/60 rounded">
            {result.source}
          </span>
          <span className="text-[9px] font-mono text-neutral-600 uppercase">
            {result.type}
          </span>
        </div>
      </div>
    </div>
  </GlassPanel>
);

// ── Detail Modal ───────────────────────────────────────────────────────────

const ResultModal: React.FC<{
  result: VisualSearchResult;
  onClose: () => void;
}> = ({ result, onClose }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <GlassPanel intensity="strong" padding="md" className="space-y-4">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300 transition-colors z-10"
          >
            <X size={18} />
          </button>

          {/* Image */}
          <div className="rounded-lg overflow-hidden bg-neutral-900/50">
            <img
              src={result.imageUrl}
              alt={result.title}
              className="w-full max-h-[60vh] object-contain"
            />
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <h3 className="text-sm text-neutral-200 font-medium">{result.title}</h3>

            {result.description && (
              <p className="text-[11px] text-neutral-500 leading-relaxed">{result.description}</p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-neutral-500 uppercase px-2 py-0.5 bg-neutral-900/60 border border-neutral-800 rounded">
                {SOURCE_LABELS[result.source]}
              </span>
              <span className="text-[10px] font-mono text-neutral-600 uppercase px-2 py-0.5 bg-neutral-900/30 border border-neutral-900 rounded">
                {result.type}
              </span>
              <span className="text-[10px] font-mono text-neutral-700">
                {result.dimensions.width} × {result.dimensions.height}
              </span>
            </div>

            {/* Attribution */}
            {result.attribution && (
              <div className="text-[10px] text-neutral-600 font-mono space-y-0.5">
                <p>
                  Photo by{' '}
                  {result.attribution.authorUrl ? (
                    <a
                      href={result.attribution.authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-400 hover:text-neutral-200 underline underline-offset-2"
                    >
                      {result.attribution.author}
                    </a>
                  ) : (
                    <span className="text-neutral-400">{result.attribution.author}</span>
                  )}
                </p>
                <p className="text-neutral-700">{result.attribution.license}</p>
              </div>
            )}

            {/* Tags */}
            {result.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {result.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[9px] font-mono text-neutral-600 px-1.5 py-0.5 bg-neutral-900/50 border border-neutral-900 rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Open original */}
            <a
              href={result.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <ExternalLink size={12} />
              Open original
            </a>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
};
