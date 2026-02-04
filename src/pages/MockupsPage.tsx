import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ImageIcon, Minus, Plus } from 'lucide-react';
import { SearchBar } from '../components/ui/SearchBar';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { mockupApi, type Mockup } from '../services/mockupApi';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { AuthModal } from '../components/AuthModal';
import { useLayout } from '@/hooks/useLayout';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { getImageUrl, isSafeUrl } from '@/utils/imageUtils';
import { translateTag } from '@/utils/localeUtils';
import { CollapsibleSidebar } from '../components/mockupmachine/CollapsibleSidebar';
import { SEO } from '../components/SEO';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";

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
  const { isAuthenticated, subscriptionStatus } = useLayout();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
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
          mockups.flatMap(m => [
            ...(Array.isArray(m.tags) ? m.tags : []),
            ...(Array.isArray(m.brandingTags) ? m.brandingTags : [])
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
      return mockups.filter(mockup => {
        if (!mockup || typeof mockup !== 'object') {
          return false;
        }

        const prompt = (mockup.prompt || '').toLowerCase();
        const tags = Array.isArray(mockup.tags) ? mockup.tags.map(t => String(t).toLowerCase()) : [];
        const brandingTags = Array.isArray(mockup.brandingTags) ? mockup.brandingTags.map(t => String(t).toLowerCase()) : [];
        const searchLower = searchQuery.toLowerCase();

        const matchesSearch = searchQuery === '' ||
          prompt.includes(searchLower) ||
          tags.some(tag => tag.includes(searchLower)) ||
          brandingTags.some(tag => tag.includes(searchLower));

        const matchesTag = filterTag === null ||
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

  const handleNavigateMockup = useCallback((mockup: Mockup) => {
    setSelectedMockup(mockup);
  }, []);

  const getCurrentIndex = useCallback(() => {
    if (!selectedMockup || !filteredMockups.length) return 0;
    const index = filteredMockups.findIndex(m => m._id === selectedMockup._id);
    return index >= 0 ? index : 0;
  }, [selectedMockup, filteredMockups]);

  const currentIndex = useMemo(() => getCurrentIndex(), [getCurrentIndex]);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < filteredMockups.length - 1;

  const handleImportToCanvas = useCallback((mockup: Mockup) => {
    // Store mockup in localStorage for CanvasPage to pick up
    try {
      localStorage.setItem('import-mockup', JSON.stringify(mockup));
      navigate('/canvas');
    } catch (error) {
      console.error('Failed to store mockup for import:', error);
    }
  }, [navigate]);

  const handleEdit = useCallback((mockup: Mockup) => {
    const imageUrl = getImageUrl(mockup);
    if (imageUrl && mockup.imageBase64) {
      navigate(`/editor?image=${encodeURIComponent(mockup.imageBase64)}`);
    }
  }, [navigate]);

  // Handler to navigate to MockupMachinePage with image for editing
  const handleNavigateToMockupMachine = useCallback(async (mockup: Mockup, operation?: 'zoom-in' | 'zoom-out' | 'new-angle' | 'new-background' | 're-imagine', operationData?: string) => {
    try {
      // Store mockup data in localStorage for MockupMachinePage to pick up
      const mockupData = {
        imageBase64: mockup.imageBase64,
        imageUrl: mockup.imageUrl,
        prompt: mockup.prompt,
        designType: mockup.designType,
        tags: mockup.tags,
        brandingTags: mockup.brandingTags,
        aspectRatio: mockup.aspectRatio,
        operation,
        operationData, // For angle name or re-imagine prompt
      };
      localStorage.setItem('edit-mockup', JSON.stringify(mockupData));
      navigate('/');
    } catch (error) {
      console.error('Failed to store mockup for editing:', error);
    }
  }, [navigate]);

  // Calculate credits needed (default to 1 credit for edit operations)
  const creditsNeededForEdit = useMemo(() => {
    // Default to 1 credit for community mockups (assuming HD model)
    return 1;
  }, []);

  // Check if edit operations should be disabled
  const isEditOperationDisabled = useMemo(() => {
    if (isAuthenticated !== true) return true;
    if (!subscriptionStatus) return true;
    const totalCredits = subscriptionStatus.totalCredits || 0;
    return totalCredits < creditsNeededForEdit;
  }, [isAuthenticated, subscriptionStatus, creditsNeededForEdit]);

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
      gridTemplateColumns: isMobile ? 'repeat(1, minmax(0, 1fr))' : `repeat(${columns}, minmax(0, 1fr))`,
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
        .filter(mockup => {
          if (!mockup || typeof mockup !== 'object') return false;

          // Only show blank mockups
          const isBlank = mockup.designType === 'blank';
          if (!isBlank) return false;

          // Check if mockup has a valid imageUrl (R2/SafeURL) or imageBase64
          const hasImageUrl = mockup.imageUrl && isSafeUrl(mockup.imageUrl);

          const hasImageBase64 = mockup.imageBase64 &&
            typeof mockup.imageBase64 === 'string' &&
            mockup.imageBase64.length > 0;

          return hasImageUrl || hasImageBase64;
        })
        .map(mockup => ({
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
      if (err?.message?.includes('Failed to fetch')) {
        setError(t('mockupsPage.cannotConnectServer'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-12 md:pt-14">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <GlitchLoader size={36} className="mx-auto mb-4" />
              <p className="text-neutral-400 font-mono text-sm">{t('mockupsPage.loadingMockups')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error message if connection failed, but still show page
  const showErrorBanner = error && error.includes('Cannot connect to server');

  return (
    <>
      <SEO
        title="Mockups da Comunidade"
        description="Explore mockups criados pela comunidade. Descubra designs profissionais e inspire-se para seus próprios projetos."
        keywords="mockups comunidade, galeria mockups, designs compartilhados, inspiração design"
      />
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 relative overflow-hidden">
        {/* Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <GridDotsBackground />
        </div>

        {/* Error Banner */}
        {showErrorBanner && (
          <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 flex items-center justify-between backdrop-blur-sm">
              <p className="text-red-400 font-mono text-xs flex-1">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  loadMockups();
                }}
                className="ml-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-mono text-xs rounded transition-colors"
              >
                {t('mockupsPage.retry')}
              </button>
            </div>
          </div>
        )}

        {/* Header with Controls and Sidebar */}
        <div className="relative z-30 pt-16 md:pt-20 pb-6">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            {/* Breadcrumb */}
            <div className="mb-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/">Home</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/community">Community</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Mockups</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            {/* Top Row: Sidebar, and Search */}
            <div className="flex items-center justify-between gap-4 mb-4">
              {/* Collapsible Sidebar - Flex grow to take available space */}
              <div className="flex-1 min-w-0">
                <CollapsibleSidebar
                  isCollapsed={isSidebarCollapsed}
                  onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  title="Community Mockups"
                  count={mockups.length}
                  countLabel={mockups.length === 1 ? 'mockup' : 'mockups'}
                  allTags={allTags}
                  filterTag={filterTag}
                  onFilterTagChange={setFilterTag}
                  translateTag={translateTag}
                />
              </div>

              {/* Search Button */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="p-2 text-neutral-500 hover:text-brand-cyan transition-colors rounded-md hover:bg-neutral-950/20"
                  title={t('mockupsPage.search')}
                >
                  <Search size={20} />
                </button>
                {showSearch && (
                  <div className="absolute top-12 right-0 bg-neutral-950/90 backdrop-blur-sm border border-neutral-700/30 rounded-md p-2 min-w-[240px] shadow-lg animate-[fadeInScale_0.2s_ease-out] z-50">
                    <SearchBar
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder={t('mockupsPage.searchPlaceholder')}
                      iconSize={14}
                      className="bg-transparent border-neutral-700/30 text-sm font-mono"
                      containerClassName="w-full"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Grid Gallery */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pb-12 md:pb-16">
          {/* Floating Column Control */}
          {filteredMockups.length > 0 && !isMobile && (
            <div className="fixed bottom-4 md:bottom-6 left-4 md:left-6 z-30">
              <div className="flex items-center gap-1 bg-neutral-950/50 backdrop-blur-md border border-neutral-800/60 rounded-md p-1.5 shadow-lg">
                <button
                  onClick={() => handleColumnsChange(columns - 1)}
                  disabled={columns <= 1}
                  className="p-1.5 text-neutral-500 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-neutral-800/30"
                  aria-label="Decrease columns"
                >
                  <Minus size={14} />
                </button>
                <div className="px-2.5">
                  <span className="text-xs font-mono text-neutral-400 min-w-[1.5rem] text-center">
                    {columns}
                  </span>
                </div>
                <button
                  onClick={() => handleColumnsChange(columns + 1)}
                  disabled={columns >= 6}
                  className="p-1.5 text-neutral-500 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-neutral-800/30"
                  aria-label="Increase columns"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredMockups.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center py-16">
              <ImageIcon size={64} className="text-neutral-700 mb-6" strokeWidth={1} />
              <h2 className="text-xl font-semibold font-mono uppercase text-neutral-500 mb-3">
                {mockups.length === 0 ? t('mockupsPage.noMockupsYet') : t('mockupsPage.noMatchesFound')}
              </h2>
              <p className="text-sm text-neutral-600 font-mono max-w-md">
                {mockups.length === 0
                  ? t('mockupsPage.generateBlankMockups')
                  : t('mockupsPage.tryAdjustingSearch')}
              </p>
            </div>
          ) : (
            <div className={getGridClasses()} style={getGridStyle()}>
              {filteredMockups.map((mockup) => {
                const imageUrl = getImageUrl(mockup);
                if (!imageUrl) return null;

                return (
                  <div
                    key={mockup._id}
                    className="group relative bg-neutral-950/30 backdrop-blur-sm border border-neutral-800/60 rounded-md overflow-hidden hover:border-[brand-cyan]/50 transition-all duration-300"
                  >
                    {/* Image */}
                    <div
                      className="aspect-square relative overflow-hidden bg-neutral-900/50 cursor-pointer"
                      onClick={() => handleView(mockup)}
                    >
                      <img
                        src={imageUrl}
                        alt={mockup.prompt || 'Mockup'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  </div>
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
            onToggleLike={selectedMockup._id ? async () => {
              // Fallback handler for when hook is not used
              try {
                const newLikedState = !selectedMockup.isLiked;
                await mockupApi.update(selectedMockup._id, { isLiked: newLikedState });
                setMockups(prev => prev.map(m =>
                  m._id === selectedMockup._id ? { ...m, isLiked: newLikedState } : m
                ));
                setSelectedMockup(prev => prev ? { ...prev, isLiked: newLikedState } : null);
              } catch (error) {
                console.error('Failed to toggle like:', error);
              }
            } : undefined}
            onLikeStateChange={(newIsLiked) => {
              // Sync state when hook updates it
              if (selectedMockup._id) {
                setMockups(prev => prev.map(m =>
                  m._id === selectedMockup._id ? { ...m, isLiked: newIsLiked } : m
                ));
                setSelectedMockup(prev => prev ? { ...prev, isLiked: newIsLiked } : null);
              }
            }}
            isLiked={selectedMockup.isLiked || false}
            onZoomIn={() => handleNavigateToMockupMachine(selectedMockup, 'zoom-in')}
            onZoomOut={() => handleNavigateToMockupMachine(selectedMockup, 'zoom-out')}
            onNewAngle={(angle) => handleNavigateToMockupMachine(selectedMockup, 'new-angle', angle)}
            onNewBackground={() => handleNavigateToMockupMachine(selectedMockup, 'new-background')}
            onReImagine={(reimaginePrompt) => handleNavigateToMockupMachine(selectedMockup, 're-imagine', reimaginePrompt)}
            editButtonsDisabled={isEditOperationDisabled}
            creditsPerOperation={creditsNeededForEdit}
            onNavigatePrevious={hasPrevious ? handlePreviousMockup : undefined}
            onNavigateNext={hasNext ? handleNextMockup : undefined}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        )}

        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setShowAuthModal(false);
              // Authentication state will be updated automatically by Layout context
            }}
            isSignUp={isSignUp}
            setIsSignUp={setIsSignUp}
          />
        )}
      </div>
    </>
  );
};
