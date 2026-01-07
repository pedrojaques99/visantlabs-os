import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, ImageIcon, Trash2, Minus, Plus } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { mockupApi, type Mockup } from '../services/mockupApi';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { AuthModal } from '../components/AuthModal';
import { useLayout } from '../hooks/useLayout';
import { toast } from 'sonner';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { getImageUrl } from '../utils/imageUtils';
import { useNavigate, Link } from 'react-router-dom';
import { CollapsibleSidebar } from '../components/mockupmachine/CollapsibleSidebar';
import { SEO } from '../components/SEO';
import { useTranslation } from '../hooks/useTranslation';
import {
  BreadcrumbWithBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/BreadcrumbWithBack";

export const MyOutputsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMockup, setSelectedMockup] = useState<Mockup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const { isAuthenticated, subscriptionStatus } = useLayout();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('myOutputsColumns');
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

  const handleDelete = useCallback(async (id: string) => {
    if (!id || !isAuthenticated) {
      return;
    }

    setDeletingId(id);
    try {
      await mockupApi.delete(id);
      setMockups(prev => prev.filter(m => m._id !== id));
      setSelectedMockup(null);
      toast.success('Output deleted successfully', { duration: 2000 });
    } catch (err: any) {
      toast.error('Failed to delete output', { duration: 5000 });
    } finally {
      setDeletingId(null);
    }
  }, [isAuthenticated]);

  const handleToggleLike = useCallback(async (mockup: Mockup) => {
    if (!mockup._id || !isAuthenticated) {
      return;
    }

    const currentLikedState = mockup.isLiked === true;
    const newLikedState = !currentLikedState;
    const isLiked = Boolean(newLikedState);

    // Check if this is a canvas image (has imageUrl with /canvas/ in path)
    const imageUrl = getImageUrl(mockup);
    const isCanvasImage = imageUrl && imageUrl.includes('/canvas/');

    // If disliking a canvas image, delete it instead of just toggling like status
    if (!isLiked && isCanvasImage) {
      setDeletingId(mockup._id);
      try {
        await mockupApi.delete(mockup._id);
        setMockups(prev => prev.filter(m => m._id !== mockup._id));
        if (selectedMockup?._id === mockup._id) {
          setSelectedMockup(null);
        }
        toast.success('Canvas image removed', { duration: 2000 });
      } catch (err: any) {
        toast.error('Failed to remove canvas image', { duration: 5000 });
      } finally {
        setDeletingId(null);
      }
      return;
    }

    // For non-canvas images or when liking, just update like status
    // Update local state immediately for responsive UI
    setMockups(prev => prev.map(m =>
      m._id === mockup._id ? { ...m, isLiked } : m
    ));

    // Update selected mockup if it's the one being liked
    if (selectedMockup?._id === mockup._id) {
      setSelectedMockup(prev => prev ? { ...prev, isLiked } : null);
    }

    // Update in backend
    try {
      console.log(`[Like] Updating like status for mockup ${mockup._id}: isLiked=${isLiked}`);
      await mockupApi.update(mockup._id, { isLiked: isLiked });
      console.log(`[Like] Successfully updated like status for mockup ${mockup._id}`);
      toast.success(isLiked ? 'Added to favorites' : 'Removed from favorites', { duration: 2000 });
    } catch (error: any) {
      console.error('[Like] Failed to update like status:', {
        mockupId: mockup._id,
        isLiked,
        error: error?.message || error,
      });
      // Revert local state on error
      setMockups(prev => prev.map(m =>
        m._id === mockup._id ? { ...m, isLiked: !isLiked } : m
      ));
      if (selectedMockup?._id === mockup._id) {
        setSelectedMockup(prev => prev ? { ...prev, isLiked: !isLiked } : null);
      }
      toast.error('Failed to update like status. Please try again.', { duration: 3000 });
    }
  }, [isAuthenticated, selectedMockup]);

  useEffect(() => {
    loadMockups();
  }, []);

  // Show auth modal if not authenticated
  useEffect(() => {
    if (isAuthenticated === false) {
      setShowAuthModal(true);
    }
  }, [isAuthenticated]);

  const loadMockups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await mockupApi.getAll();

      if (!Array.isArray(data)) {
        setMockups([]);
        return;
      }

      const validMockups = data
        .filter(mockup =>
          mockup &&
          typeof mockup === 'object' &&
          (mockup.imageBase64 || mockup.imageUrl) &&
          ((mockup.imageBase64 && typeof mockup.imageBase64 === 'string' && mockup.imageBase64.length > 0) ||
            (mockup.imageUrl && typeof mockup.imageUrl === 'string' && mockup.imageUrl.length > 0))
        )
        .map(mockup => ({
          ...mockup,
          _id: mockup._id || '',
          prompt: mockup.prompt || '',
          designType: mockup.designType || 'blank',
          tags: Array.isArray(mockup.tags) ? mockup.tags : [],
          brandingTags: Array.isArray(mockup.brandingTags) ? mockup.brandingTags : [],
          aspectRatio: mockup.aspectRatio || '16:9',
          isLiked: mockup.isLiked === true, // Explicitly handle isLiked, default to false
          createdAt: mockup.createdAt || new Date().toISOString(),
          updatedAt: mockup.updatedAt || new Date().toISOString(),
        }));

      const sorted = validMockups.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setMockups(sorted);
    } catch (err: any) {
      setMockups([]);
      if (err?.message?.includes('Failed to fetch') || err?.status === 401) {
        setError('Please sign in to view your outputs.');
        setShowAuthModal(true);
      } else {
        setError('Failed to load your outputs. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseViewer = () => {
    setSelectedMockup(null);
  };

  // Get current index for navigation
  const getCurrentIndex = useCallback(() => {
    if (!selectedMockup || !filteredMockups.length) return 0;
    const index = filteredMockups.findIndex(m => m._id === selectedMockup._id);
    return index >= 0 ? index : 0;
  }, [selectedMockup, filteredMockups]);

  const currentIndex = useMemo(() => getCurrentIndex(), [getCurrentIndex]);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < filteredMockups.length - 1;

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
    // Default to 1 credit for edit operations (assuming HD model)
    return 1;
  }, []);

  // Check if edit operations should be disabled
  const isEditOperationDisabled = useMemo(() => {
    if (isAuthenticated !== true) return true;
    if (!subscriptionStatus) return true;
    const totalCredits = subscriptionStatus.totalCredits || 0;
    return totalCredits < creditsNeededForEdit;
  }, [isAuthenticated, subscriptionStatus, creditsNeededForEdit]);

  const handleColumnsChange = useCallback((newColumns: number) => {
    const clamped = Math.max(1, Math.min(6, newColumns));
    setColumns(clamped);
    localStorage.setItem('myOutputsColumns', clamped.toString());
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <GlitchLoader size={36} className="mx-auto mb-4" />
              <p className="text-zinc-400 font-mono text-sm">Loading your outputs...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t('myOutputs.seoTitle')}
        description={t('myOutputs.seoDescription')}
        noindex={true}
      />
      <div className="min-h-screen bg-[#121212] text-zinc-300 relative overflow-hidden">
        {/* Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <GridDotsBackground />
        </div>

        {/* Header with Controls and Sidebar */}
        <div className="relative z-30 pt-16 md:pt-20 pb-6">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            {/* Breadcrumb with Back Button */}
            <div className="mb-4">
              <BreadcrumbWithBack to="/">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/">Home</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{t('myOutputs.seoTitle')}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </BreadcrumbWithBack>
            </div>
            {/* Top Row: Sidebar, and Search */}
            <div className="flex items-center justify-between gap-4 mb-4">
              {/* Collapsible Sidebar - Flex grow to take available space */}
              <div className="flex-1 min-w-0">
                <CollapsibleSidebar
                  isCollapsed={isSidebarCollapsed}
                  onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  title={t('myOutputs.seoTitle')}
                  count={mockups.length}
                  countLabel={mockups.length === 1 ? 'output' : 'outputs'}
                  allTags={allTags}
                  filterTag={filterTag}
                  onFilterTagChange={setFilterTag}
                  showSearch={showSearch}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onToggleSearch={() => setShowSearch(!showSearch)}
                  showBackButton={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Grid Gallery */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pb-12 md:pb-16">
          {/* Floating Column Control */}
          {filteredMockups.length > 0 && !isMobile && (
            <div className="fixed bottom-4 md:bottom-6 left-4 md:left-6 z-30">
              <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md border border-zinc-800/60 rounded-md p-1.5 shadow-lg">
                <button
                  onClick={() => handleColumnsChange(columns - 1)}
                  disabled={columns <= 1}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-zinc-800/30"
                  aria-label="Decrease columns"
                >
                  <Minus size={14} />
                </button>
                <div className="px-2.5">
                  <span className="text-xs font-mono text-zinc-400 min-w-[1.5rem] text-center">
                    {columns}
                  </span>
                </div>
                <button
                  onClick={() => handleColumnsChange(columns + 1)}
                  disabled={columns >= 6}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-zinc-800/30"
                  aria-label="Increase columns"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}
          {filteredMockups.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <ImageIcon size={64} className="text-zinc-700 mb-4" strokeWidth={1} />
              <h2 className="text-xl font-semibold font-mono uppercase text-zinc-500 mb-2">
                {mockups.length === 0 ? 'NO OUTPUTS YET' : 'NO MATCHES FOUND'}
              </h2>
              <p className="text-sm text-zinc-600 font-mono mb-4">
                {mockups.length === 0
                  ? 'Generate mockups to see them here.'
                  : 'Try adjusting your search or filter.'}
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
                    className="group relative bg-black/30 backdrop-blur-sm border border-zinc-800/60 rounded-md overflow-hidden hover:border-[#brand-cyan]/50 transition-all duration-300"
                  >
                    {/* Image */}
                    <div
                      className="aspect-square relative overflow-hidden bg-zinc-900/50 cursor-pointer"
                      onClick={() => handleView(mockup)}
                    >
                      <img
                        src={imageUrl}
                        alt={mockup.prompt || 'Output'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAuthenticated && mockup._id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(mockup._id);
                            }}
                            disabled={deletingId === mockup._id}
                            className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-sm border border-red-500/30 rounded text-xs font-mono text-red-400 hover:text-red-300 hover:border-red-400/50 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer z-10"
                            aria-label="Delete output"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
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
            onOpenInEditor={(imageBase64: string) => {
              navigate(`/editor?image=${encodeURIComponent(imageBase64)}`);
            }}
            mockup={selectedMockup}
            mockupId={selectedMockup._id}
            onDelete={isAuthenticated && selectedMockup._id ? () => handleDelete(selectedMockup._id) : undefined}
            isDeleting={deletingId === selectedMockup._id}
            isAuthenticated={isAuthenticated === true}
            onToggleLike={selectedMockup._id ? () => handleToggleLike(selectedMockup) : undefined}
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
            onSuccess={async () => {
              setShowAuthModal(false);
              await loadMockups();
            }}
            isSignUp={false}
          />
        )}
      </div>
    </>
  );
};
