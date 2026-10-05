import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ImageIcon, Minus, Plus } from '@/lib/ui/icons';
import { SearchBar } from '../components/ui/SearchBar';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { mockupApi, type Mockup } from '../services/mockupApi';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { useLayout } from '@/hooks/useLayout';
import { Thumb } from '../components/ui/Thumb';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { getImageUrl, isSafeUrl } from '@/utils/imageUtils';
import { translateTag } from '@/utils/localeUtils';
import { CollapsibleSidebar } from '../components/mockupmachine/CollapsibleSidebar';
import { PageShell } from '../components/ui/PageShell';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

export const MockupsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMockup, setSelectedMockup] = useState<Mockup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const { isAuthenticated } = useLayout();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('mockupsPageColumns');
    return saved ? parseInt(saved, 10) : 4;
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get all unique tags for filtering
  const allTags = useMemo(() => {
    if (!Array.isArray(mockups) || mockups.length === 0) {
      return [];
    }
    try {
      return Array.from(
        new Set(
          mockups.flatMap((m) => [
            ...(Array.isArray(m.tags) ? m.tags : []),
            ...(Array.isArray(m.brandingTags) ? m.brandingTags : []),
          ])
        )
      ).sort();
    } catch {
      return [];
    }
  }, [mockups]);

  // Filter mockups based on search and tag filter
  const filteredMockups = useMemo(() => {
    if (!Array.isArray(mockups) || mockups.length === 0) {
      return [];
    }

    try {
      return mockups.filter((mockup) => {
        if (!mockup || typeof mockup !== 'object') {
          return false;
        }

        const prompt = (mockup.prompt || '').toLowerCase();
        const tags = Array.isArray(mockup.tags)
          ? mockup.tags.map((t) => String(t).toLowerCase())
          : [];
        const brandingTags = Array.isArray(mockup.brandingTags)
          ? mockup.brandingTags.map((t) => String(t).toLowerCase())
          : [];
        const searchLower = searchQuery.toLowerCase();

        const matchesSearch =
          searchQuery === '' ||
          prompt.includes(searchLower) ||
          tags.some((tag) => tag.includes(searchLower)) ||
          brandingTags.some((tag) => tag.includes(searchLower));

        const matchesTag =
          filterTag === null ||
          tags.includes(filterTag.toLowerCase()) ||
          brandingTags.includes(filterTag.toLowerCase());

        return matchesSearch && matchesTag;
      });
    } catch {
      return [];
    }
  }, [mockups, searchQuery, filterTag]);

  // Handler functions
  const handleView = useCallback((mockup: Mockup) => {
    setSelectedMockup(mockup);
  }, []);

  const getCurrentIndex = useCallback(() => {
    if (!selectedMockup || !filteredMockups.length) return 0;
    const index = filteredMockups.findIndex((m) => m._id === selectedMockup._id);
    return index >= 0 ? index : 0;
  }, [selectedMockup, filteredMockups]);

  const currentIndex = useMemo(() => getCurrentIndex(), [getCurrentIndex]);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < filteredMockups.length - 1;

  const handleCloseViewer = () => {
    setSelectedMockup(null);
  };

  const handlePreviousMockup = useCallback(() => {
    if (!hasPrevious || !filteredMockups.length) return;
    const newIndex = currentIndex - 1;
    if (newIndex >= 0) {
      setSelectedMockup(filteredMockups[newIndex]);
    }
  }, [hasPrevious, filteredMockups, currentIndex]);

  const handleNextMockup = useCallback(() => {
    if (!hasNext || !filteredMockups.length) return;
    const newIndex = currentIndex + 1;
    if (newIndex < filteredMockups.length) {
      setSelectedMockup(filteredMockups[newIndex]);
    }
  }, [hasNext, filteredMockups, currentIndex]);

  const handleColumnsChange = useCallback((newColumns: number) => {
    const clamped = Math.max(1, Math.min(6, newColumns));
    setColumns(clamped);
    localStorage.setItem('mockupsPageColumns', clamped.toString());
  }, []);

  const getGridClasses = useCallback(() => {
    return 'grid gap-2 md:gap-3 lg:gap-4';
  }, []);

  const getGridStyle = useCallback(() => {
    // Mobile sempre 1 coluna, a partir de 640px (sm) usa o número exato selecionado pelo usuário
    return {
      gridTemplateColumns: isMobile
        ? 'repeat(1, minmax(0, 1fr))'
        : `repeat(${columns}, minmax(0, 1fr))`,
    };
  }, [columns, isMobile]);

  useEffect(() => {
    loadMockups();
  }, []);

  const loadMockups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await mockupApi.getAllPublic();

      // Validate and normalize data
      if (!Array.isArray(data)) {
        setMockups([]);
        return;
      }

      // Filter out invalid mockups and ensure all required fields exist
      // Prioritize imageUrl (R2) over imageBase64
      // Only show blank mockups on public page
      const validMockups = data
        .filter((mockup) => {
          if (!mockup || typeof mockup !== 'object') return false;

          // Only show blank mockups
          const isBlank = mockup.designType === 'blank';
          if (!isBlank) return false;

          // Check if mockup has a valid imageUrl (R2/SafeURL) or imageBase64
          const hasImageUrl = mockup.imageUrl && isSafeUrl(mockup.imageUrl);

          const hasImageBase64 =
            mockup.imageBase64 &&
            typeof mockup.imageBase64 === 'string' &&
            mockup.imageBase64.length > 0;

          return hasImageUrl || hasImageBase64;
        })
        .map((mockup) => ({
          ...mockup,
          _id: mockup._id || '',
          prompt: mockup.prompt || '',
          designType: mockup.designType || 'blank',
          tags: Array.isArray(mockup.tags) ? mockup.tags : [],
          brandingTags: Array.isArray(mockup.brandingTags) ? mockup.brandingTags : [],
          aspectRatio: mockup.aspectRatio || '16:9',
          createdAt: mockup.createdAt || new Date().toISOString(),
          updatedAt: mockup.updatedAt || new Date().toISOString(),
        }));

      // Sort by date (most recent first)
      const sorted = validMockups.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setMockups(sorted);
    } catch (err: any) {
      setMockups([]);
      // Every failure sets an error — not just 'Failed to fetch'. A 500/parse/
      // timeout must not fall through to the "no mockups yet" empty state, which
      // reads as an empty catalog rather than an outage (silent-empty lie).
      setError(
        err?.message?.includes('Failed to fetch')
          ? t('mockupsPage.cannotConnectServer')
          : t('mockupsPage.loadFailed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Mesma busca inline do /canvas: expande no header e colapsa ao sair vazia.
  const headerActions = (
    <div className="flex items-center flex-shrink-0">
      {showSearch ? (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('mockupsPage.searchPlaceholder')}
          iconSize={14}
          className="h-10 text-sm"
          containerClassName="w-[180px] md:w-[220px]"
          autoFocus
          onBlur={() => {
            if (!searchQuery.trim()) setShowSearch(false);
          }}
        />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSearch(true)}
          className="text-muted-foreground hover:text-foreground"
          title={t('common.search')}
          aria-label={t('common.search')}
        >
          <Search size={20} />
        </Button>
      )}
    </div>
  );

  return (
    <PageShell
      pageId="mockups"
      seoTitle={t('mockups.galeria_da_comunidade')}
      seoDescription={t('mockups.explore_designs_profissionais_e_inspires')}
      title={t('mockups.galeria_da_comunidade')}
      description={t('mockups.explore_designs_profissionais_e_inspires')}
      breadcrumb={[
        { label: t('apps.home'), to: '/' },
        { label: t('community.title'), to: '/community' },
        { label: t('mockups.title') },
      ]}
      actions={headerActions}
    >
      <div className="relative z-10">
        {/* Top Row: Sidebar */}
        <div className="mb-8">
          <CollapsibleSidebar
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={t('mockupsPage.filters')}
            countText={t(
              mockups.length === 1 ? 'mockupsPage.count_one' : 'mockupsPage.count_other',
              { count: mockups.length }
            )}
            allTags={allTags}
            filterTag={filterTag}
            onFilterTagChange={setFilterTag}
            translateTag={translateTag}
          />
        </div>

        {/* Grid Gallery */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pb-12 md:pb-16">
          {/* Floating Column Control */}
          {filteredMockups.length > 0 && !isMobile && (
            <div className="fixed bottom-4 md:bottom-6 left-4 md:left-6 z-30">
              <GlassPanel padding="sm" className="flex-row items-center gap-1">
                <Button
                  variant="action"
                  onClick={() => handleColumnsChange(columns - 1)}
                  disabled={columns <= 1}
                  aria-label={t('common.decreaseColumns')}
                  title={t('common.decreaseColumns')}
                >
                  <Minus size={14} />
                </Button>
                <div className="px-2.5">
                  <span className="text-xs font-mono text-muted-foreground min-w-[1.5rem] text-center">
                    {columns}
                  </span>
                </div>
                <Button
                  variant="action"
                  onClick={() => handleColumnsChange(columns + 1)}
                  disabled={columns >= 6}
                  aria-label={t('common.increaseColumns')}
                  title={t('common.increaseColumns')}
                >
                  <Plus size={14} />
                </Button>
              </GlassPanel>
            </div>
          )}

          {/* A failed load is an error with retry, never the "no mockups yet" empty state. */}
          {/* While loading, never claim "no mockups yet". */}
          {isLoading && mockups.length === 0 ? (
            <div className="flex justify-center py-24">
              <GlitchLoader size={28} />
            </div>
          ) : error ? (
            <ErrorState
              description={error}
              retryLabel={t('mockupsPage.retry')}
              onRetry={() => {
                setError(null);
                loadMockups();
              }}
            />
          ) : filteredMockups.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title={
                mockups.length === 0
                  ? t('mockupsPage.noMockupsYet')
                  : t('mockupsPage.noMatchesFound')
              }
              description={
                mockups.length === 0
                  ? t('mockupsPage.generateBlankMockups')
                  : t('mockupsPage.tryAdjustingSearch')
              }
            />
          ) : (
            <div className={getGridClasses()} style={getGridStyle()}>
              {filteredMockups.map((mockup) => {
                const imageUrl = getImageUrl(mockup);
                if (!imageUrl) return null;

                return (
                  <GlassPanel
                    key={mockup._id}
                    className="relative overflow-hidden hover:border-ring transition-colors"
                  >
                    <button
                      type="button"
                      className="block w-full aspect-square relative overflow-hidden bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => handleView(mockup)}
                      aria-label={mockup.prompt || t('community.mockupAlt')}
                    >
                      <Thumb
                        src={imageUrl}
                        alt={mockup.prompt || t('community.mockupAlt')}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  </GlassPanel>
                );
              })}
            </div>
          )}
        </div>

        {/* Full Screen Viewer */}
        {selectedMockup && getImageUrl(selectedMockup) && (
          <FullScreenViewer
            base64Image={selectedMockup.imageBase64 || undefined}
            imageUrl={selectedMockup.imageUrl || undefined}
            isLoading={false}
            onClose={handleCloseViewer}
            mockup={selectedMockup}
            onOpenInEditor={(imageBase64: string) => {
              navigate(`/editor?image=${encodeURIComponent(imageBase64)}`);
            }}
            isAuthenticated={isAuthenticated === true}
            mockupId={selectedMockup._id}
            onToggleLike={
              selectedMockup._id
                ? async () => {
                    // Fallback handler for when hook is not used
                    try {
                      const newLikedState = !selectedMockup.isLiked;
                      await mockupApi.update(selectedMockup._id, { isLiked: newLikedState });
                      setMockups((prev) =>
                        prev.map((m) =>
                          m._id === selectedMockup._id ? { ...m, isLiked: newLikedState } : m
                        )
                      );
                      setSelectedMockup((prev) =>
                        prev ? { ...prev, isLiked: newLikedState } : null
                      );
                    } catch (error) {
                      console.error('Failed to toggle like:', error);
                    }
                  }
                : undefined
            }
            onLikeStateChange={(newIsLiked) => {
              // Sync state when hook updates it
              if (selectedMockup._id) {
                setMockups((prev) =>
                  prev.map((m) =>
                    m._id === selectedMockup._id ? { ...m, isLiked: newIsLiked } : m
                  )
                );
                setSelectedMockup((prev) => (prev ? { ...prev, isLiked: newIsLiked } : null));
              }
            }}
            isLiked={selectedMockup.isLiked || false}
            onNavigatePrevious={hasPrevious ? handlePreviousMockup : undefined}
            onNavigateNext={hasNext ? handleNextMockup : undefined}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        )}
      </div>
    </PageShell>
  );
};
