import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  ExternalLink,
  X,
  Minus,
  Plus,
  Image,
  Type,
  Layout,
  Layers,
  Compass,
  type LucideIcon,
} from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  visualSearchApi,
  type VisualSearchResult,
  type LetterCrop,
  type SearchSource,
  type SearchIntent,
} from '@/services/visualSearchApi';
import { useNeedsLightBg } from '@/hooks/useNeedsLightBg';

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
  {
    id: 'typography',
    label: 'Typography',
    icon: Type,
    sources: ['unsplash', 'pexels', 'wikimedia'],
  },
  { id: 'layouts', label: 'Layouts', icon: Layout, sources: ['unsplash', 'pexels'] },
];

const TAB_KEYWORDS: { tab: TabId; pattern: RegExp }[] = [
  {
    tab: 'typography',
    pattern:
      /\b(letra|letter|character|glyph|tipografia|typography|font|typeface|lettering|caligrafia|calligraphy|serif|sans.?serif)\b/i,
  },
  { tab: 'logos', pattern: /\b(logo|marca|brand|logotipo|logomarca|emblem|badge|icon)\b/i },
  { tab: 'layouts', pattern: /\b(layout|grid|editorial|diagramação|composição|composition)\b/i },
  {
    tab: 'photos',
    pattern: /\b(photo|foto|photograph|imagem|picture|landscape|retrato|portrait)\b/i,
  },
];

function suggestTab(q: string): TabId | null {
  const trimmed = q.trim();
  if (trimmed.length < 2) return null;
  for (const { tab, pattern } of TAB_KEYWORDS) {
    if (pattern.test(trimmed)) return tab;
  }
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────

export const VisualSearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [userPickedTab, setUserPickedTab] = useState(false);
  const [results, setResults] = useState<VisualSearchResult[]>([]);
  const [intent, setIntent] = useState<SearchIntent>('mixed');
  const [sourceSummary, setSourceSummary] = useState<
    { source: SearchSource; count: number; error?: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedResult, setSelectedResult] = useState<VisualSearchResult | null>(null);
  const [letterCrops, setLetterCrops] = useState<LetterCrop[]>([]);
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('visualSearchColumns');
    return saved ? parseInt(saved, 10) : 4;
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleColumnsChange = useCallback((delta: number) => {
    setColumns((prev) => {
      const next = Math.max(2, Math.min(6, prev + delta));
      localStorage.setItem('visualSearchColumns', String(next));
      return next;
    });
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string, tab: TabId, pageNum = 1, append = false) => {
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
        const activeTabDef = TABS.find((t) => t.id === tab);
        const response = await visualSearchApi.search(searchQuery, {
          sources: activeTabDef?.sources,
          limit: 30,
          page: pageNum,
        });

        if (append) {
          setResults((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const newResults = response.results.filter((r) => !existingIds.has(r.id));
            return [...prev, ...newResults];
          });
        } else {
          setResults(response.results);
          setLetterCrops(response.letterCrops || []);
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
    },
    []
  );

  useEffect(() => {
    if (!userPickedTab) {
      const suggested = suggestTab(query);
      if (suggested && suggested !== activeTab) setActiveTab(suggested);
      else if (!suggested && activeTab !== 'all') setActiveTab('all');
    }
  }, [query, userPickedTab]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setPage(1);
      setHasMore(false);
      setUserPickedTab(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query, activeTab, 1, false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeTab, performSearch]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoading &&
          !isLoadingMore &&
          query.trim().length >= 2
        ) {
          performSearch(query, activeTab, page + 1, true);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, page, query, activeTab, performSearch]);

  const filteredResults = useMemo(() => {
    if (activeTab === 'all') return results;
    return results.filter((r) => {
      switch (activeTab) {
        case 'photos':
          return r.type === 'photo';
        case 'logos':
          return r.type === 'logo' || r.type === 'vector';
        case 'typography':
          return true;
        case 'layouts':
          return true;
        default:
          return true;
      }
    });
  }, [results, activeTab]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const showEmptyState = !hasSearched && !query;
  const searchBarRef = useRef<HTMLInputElement>(null);
  const prevEmpty = useRef(showEmptyState);

  useEffect(() => {
    if (prevEmpty.current !== showEmptyState) {
      prevEmpty.current = showEmptyState;
      requestAnimationFrame(() => searchBarRef.current?.focus());
    }
  }, [showEmptyState]);

  const tabBar = (
    <div className="flex items-center gap-1.5 mt-2.5">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setUserPickedTab(true);
            }}
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

      {hasSearched && !isLoading && filteredResults.length > 0 && (
        <span className="ml-auto text-[10px] font-mono text-neutral-700">
          {filteredResults.length} results
        </span>
      )}
    </div>
  );

  return (
    <PageShell
      pageId="visual-search"
      seoTitle="Visual Search — Visant Labs"
      seoDescription="Search for design inspiration, typography, logos, and layouts"
      title="Visual Search"
      width="full"
      hideHeader
    >
      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Visual Search</h2>
          <p className="text-sm text-neutral-600 mb-8">Logos, letters, layouts, typography</p>
          <SearchBar
            ref={searchBarRef}
            value={query}
            onChange={setQuery}
            size="lg"
            placeholder="Search..."
            containerClassName="max-w-xl w-full"
            className="bg-white/[0.03] border-white/5 focus:border-white/10"
            autoFocus
          />
          <div className="mt-4">{tabBar}</div>
        </div>
      ) : (
        <>
          {/* Sticky search bar + tabs — below the fixed h-10/md:h-14 header */}
          <div className="sticky top-10 md:top-14 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-2 pb-3 bg-neutral-950/90 backdrop-blur-md border-b border-white/5">
            <SearchBar
              ref={searchBarRef}
              value={query}
              onChange={setQuery}
              size="md"
              placeholder="Search..."
              containerClassName="max-w-2xl"
              className="bg-white/[0.03] border-white/5 focus:border-white/10"
            />
            {tabBar}
          </div>

          {/* Letter Crops */}
          {letterCrops.length > 0 && !isLoading && (
            <div className="mt-4 mb-6">
              <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider mb-3">
                Isolated · {letterCrops.length} crops
              </p>
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${
                    isMobile ? 3 : Math.min(columns + 2, 8)
                  }, minmax(0, 1fr))`,
                }}
              >
                {letterCrops.map((crop) => (
                  <CropCard key={crop.id} crop={crop} />
                ))}
              </div>
            </div>
          )}

          {/* Results Grid */}
          <div className="mt-4">
            {isLoading ? (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${isMobile ? 2 : columns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg bg-neutral-900/50 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredResults.length > 0 ? (
              <>
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${isMobile ? 2 : columns}, minmax(0, 1fr))`,
                  }}
                >
                  {filteredResults.map((result) => (
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
                    style={{
                      gridTemplateColumns: `repeat(${isMobile ? 2 : columns}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: columns }).map((_, i) => (
                      <div
                        key={`loader-${i}`}
                        className="aspect-square rounded-lg bg-neutral-900/50 animate-pulse"
                      />
                    ))}
                  </div>
                )}
              </>
            ) : hasSearched ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
                <Search size={24} className="mb-3 text-neutral-700" />
                <p className="text-sm">No results for "{query}"</p>
              </div>
            ) : null}
          </div>

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
            <ResultModal result={selectedResult} onClose={() => setSelectedResult(null)} />
          )}
        </>
      )}
    </PageShell>
  );
};

// ── Crop Card ─────────────────────────────────────────────────────────────

const CropCard: React.FC<{ crop: LetterCrop }> = ({ crop }) => {
  const needsLightBg = useNeedsLightBg(crop.thumbnailUrl);

  return (
    <a
      href={crop.cropUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden rounded-lg border border-white/[0.04] hover:border-white/10 transition-all"
    >
      <div
        className={cn(
          'aspect-square relative overflow-hidden flex items-center justify-center p-2',
          needsLightBg ? 'bg-white' : 'bg-neutral-900/50'
        )}
      >
        <img
          src={crop.thumbnailUrl}
          alt={`${crop.letter} — ${crop.style || 'letter'}`}
          className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      {crop.style && (
        <div className="absolute bottom-0 inset-x-0 bg-neutral-950/80 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[9px] font-mono text-neutral-400 uppercase">{crop.style}</span>
        </div>
      )}
    </a>
  );
};

// ── Result Card ────────────────────────────────────────────────────────────

const ResultCard: React.FC<{
  result: VisualSearchResult;
  onClick: () => void;
}> = ({ result, onClick }) => {
  const isVector = result.type === 'vector' || result.type === 'logo';
  const needsLightBg = useNeedsLightBg(result.thumbnailUrl);

  return (
    <div
      className="group relative overflow-hidden rounded-lg border border-white/[0.04] hover:border-white/10 cursor-pointer transition-all"
      onClick={onClick}
    >
      <div
        className={cn(
          'aspect-square relative overflow-hidden',
          isVector && needsLightBg ? 'bg-white' : 'bg-neutral-900/50'
        )}
      >
        <img
          src={result.thumbnailUrl}
          alt={result.title}
          className={cn(
            'w-full h-full group-hover:scale-105 transition-transform duration-300',
            isVector ? 'object-contain p-3' : 'object-cover'
          )}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />

        <div className="absolute inset-0 bg-neutral-950/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
          <p className="text-[11px] text-neutral-200 line-clamp-2 leading-relaxed">
            {result.title}
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Detail Modal ───────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<SearchSource, string> = {
  unsplash: 'Unsplash',
  pexels: 'Pexels',
  pixabay: 'Pixabay',
  wikimedia: 'Wikimedia',
  clearbit: 'Clearbit',
  svgl: 'Svgl',
  google: 'Google',
};

const ResultModal: React.FC<{
  result: VisualSearchResult;
  onClose: () => void;
}> = ({ result, onClose }) => {
  const isVector = result.type === 'vector' || result.type === 'logo';
  const needsLightBg = useNeedsLightBg(result.imageUrl);

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
        onClick={(e) => e.stopPropagation()}
      >
        <GlassPanel intensity="strong" padding="md" className="space-y-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300 transition-colors z-10"
          >
            <X size={18} />
          </button>

          <div
            className={cn(
              'rounded-lg overflow-hidden',
              isVector && needsLightBg ? 'bg-white' : 'bg-neutral-900/50'
            )}
          >
            <img
              src={result.imageUrl}
              alt={result.title}
              className={cn(
                'w-full max-h-[60vh]',
                isVector ? 'object-contain p-6' : 'object-contain'
              )}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm text-neutral-200 font-medium">{result.title}</h3>

            {result.attribution && (
              <p className="text-[11px] text-neutral-600">
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
                {' · '}
                <span className="text-neutral-700">{SOURCE_LABELS[result.source]}</span>
              </p>
            )}

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
