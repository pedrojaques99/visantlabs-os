import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, ImageIcon, Tag } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { mockupApi, type Mockup } from '../services/mockupApi';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { AuthModal } from '../components/AuthModal';
import { useLayout } from '@/hooks/useLayout';
import { toast } from 'sonner';
import { getImageUrl } from '@/utils/imageUtils';
import { useNavigate } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { useTranslation } from '@/hooks/useTranslation';
import { Masonry } from '@/components/ui/Masonry';
import { Input } from '@/components/ui/input';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { useInAppShell } from '@/components/shell/InAppShellContext';
import { useRailSlot } from '@/components/shell/RailSlotContext';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { MediaTile } from '@/components/ui/MediaTile';

export const MyOutputsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedMockup, setSelectedMockup] = useState<Mockup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  // Nuvem de tags escondida por padrão (tags livres do gerador ainda são ruidosas); abre sob demanda.
  const [showTags, setShowTags] = useState(false);
  const inShell = useInAppShell();
  // Tag cloud vai pro rail (L2, SSoT igual /references) via RailSlot.
  const railSlot = useRailSlot()?.railSlot ?? null;
  // A lista segue a marca ativa do BrandSwitcher (null = "Todas as marcas"):
  // nesta rota o switcher FILTRA (contrato do navConfig). Mockups guardam brandGuidelineId.
  const { activeBrandId: brandId, setActiveBrand, allBrands } = useActiveBrand();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { isAuthenticated } = useLayout();
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Ids cujo <img> já decodificou: a partir daí a altura natural manda e a
  // proporção gravada deixa de reservar a caixa (ela é só o placeholder).
  const [loadedIds, setLoadedIds] = useState<Set<string>>(() => new Set());

  // Tags da marca ativa (ou de todas), sem duplicata por caixa e sem nome de
  // marca: o nome da marca já é o filtro do switcher, não uma tag.
  const allTags = useMemo(() => {
    const brandNames = new Set(
      allBrands
        .flatMap((b) => [b.identity?.name, b.name])
        .filter((n): n is string => !!n)
        .map((n) => n.trim().toLowerCase())
    );
    const byKey = new Map<string, string>();
    for (const m of mockups) {
      if (brandId && m.brandGuidelineId !== brandId) continue;
      for (const raw of [...(m.tags || []), ...(m.brandingTags || [])]) {
        const label = String(raw).trim();
        const key = label.toLowerCase();
        if (!key || brandNames.has(key) || byKey.has(key)) continue;
        byKey.set(key, label);
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [mockups, brandId, allBrands]);

  // Busca + tag. A marca entra logo abaixo.
  const searchTagMatches = useMemo(() => {
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

  // Mockups da marca ativa: o grid inteiro. Outras marcas não entram.
  const filteredMockups = useMemo(() => {
    if (!brandId) return searchTagMatches;
    return searchTagMatches.filter((m) => m.brandGuidelineId === brandId);
  }, [searchTagMatches, brandId]);

  // Handler functions
  const handleView = useCallback((mockup: Mockup) => {
    setSelectedMockup(mockup);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!id || !isAuthenticated) {
        return;
      }

      setDeletingId(id);
      try {
        await mockupApi.delete(id);
        setMockups((prev) => prev.filter((m) => m._id !== id));
        setSelectedMockup(null);
        toast.success(t('my.outputs.output_deleted_successfully'), { duration: 2000 });
      } catch (err: any) {
        toast.error(t('my.outputs.failed_to_delete_output'), { duration: 5000 });
      } finally {
        setDeletingId(null);
      }
    },
    [isAuthenticated, t]
  );

  const handleToggleLike = useCallback(
    async (mockup: Mockup) => {
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
          setMockups((prev) => prev.filter((m) => m._id !== mockup._id));
          if (selectedMockup?._id === mockup._id) {
            setSelectedMockup(null);
          }
          toast.success(t('my.outputs.canvas_image_removed'), { duration: 2000 });
        } catch (err: any) {
          toast.error(t('my.outputs.failed_to_remove_canvas_image'), { duration: 5000 });
        } finally {
          setDeletingId(null);
        }
        return;
      }

      // For non-canvas images or when liking, just update like status
      // Update local state immediately for responsive UI
      setMockups((prev) => prev.map((m) => (m._id === mockup._id ? { ...m, isLiked } : m)));

      // Update selected mockup if it's the one being liked
      if (selectedMockup?._id === mockup._id) {
        setSelectedMockup((prev) => (prev ? { ...prev, isLiked } : null));
      }

      // Update in backend
      try {
        await mockupApi.update(mockup._id, { isLiked: isLiked });
        toast.success(
          isLiked ? t('myOutputs.addedToFavorites') : t('myOutputs.removedFromFavorites'),
          { duration: 2000 }
        );
      } catch (error: any) {
        console.error('[Like] Failed to update like status:', error?.message || error);
        // Revert local state on error
        setMockups((prev) =>
          prev.map((m) => (m._id === mockup._id ? { ...m, isLiked: !isLiked } : m))
        );
        if (selectedMockup?._id === mockup._id) {
          setSelectedMockup((prev) => (prev ? { ...prev, isLiked: !isLiked } : null));
        }
        toast.error(t('myOutputs.likeFailed'), { duration: 3000 });
      }
    },
    [isAuthenticated, selectedMockup, t]
  );

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
    setError(false);
    try {
      const data = await mockupApi.getAll();

      if (!Array.isArray(data)) {
        setMockups([]);
        return;
      }

      const validMockups = data
        .filter(
          (mockup) =>
            mockup &&
            typeof mockup === 'object' &&
            (mockup.imageBase64 || mockup.imageUrl) &&
            ((mockup.imageBase64 &&
              typeof mockup.imageBase64 === 'string' &&
              mockup.imageBase64.length > 0) ||
              (mockup.imageUrl &&
                typeof mockup.imageUrl === 'string' &&
                mockup.imageUrl.length > 0))
        )
        .map((mockup) => ({
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
      // Sem sessão pede login; qualquer outra falha (rede, 5xx) é erro com retry.
      if (err?.status === 401) {
        setShowAuthModal(true);
      } else {
        setError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseViewer = () => {
    setSelectedMockup(null);
  };

  const visibleMockups = filteredMockups;

  // Get current index for navigation
  const getCurrentIndex = useCallback(() => {
    if (!selectedMockup || !visibleMockups.length) return 0;
    const index = visibleMockups.findIndex((m) => m._id === selectedMockup._id);
    return index >= 0 ? index : 0;
  }, [selectedMockup, visibleMockups]);

  const currentIndex = useMemo(() => getCurrentIndex(), [getCurrentIndex]);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < visibleMockups.length - 1;

  const handlePreviousMockup = useCallback(() => {
    if (!hasPrevious || !visibleMockups.length) return;
    const newIndex = currentIndex - 1;
    if (newIndex >= 0) {
      setSelectedMockup(visibleMockups[newIndex]);
    }
  }, [hasPrevious, visibleMockups, currentIndex]);

  const handleNextMockup = useCallback(() => {
    if (!hasNext || !visibleMockups.length) return;
    const newIndex = currentIndex + 1;
    if (newIndex < visibleMockups.length) {
      setSelectedMockup(visibleMockups[newIndex]);
    }
  }, [hasNext, visibleMockups, currentIndex]);

  const renderMockupTile = useCallback(
    (mockup: Mockup) => {
      const imageUrl = getImageUrl(mockup)!;
      const key = mockup._id || imageUrl;
      // Reserva a caixa com a proporção gravada até o decode: sem isso o tile
      // mede 0px, o lazy não segura nada e as colunas 2 e 3 viram pilha de linhas.
      const reserved = loadedIds.has(key) ? undefined : mockup.aspectRatio.replace(':', ' / ');
      // Excluir fica no viewer, onde a decisão é tomada olhando a imagem.
      return (
        <MediaTile
          layout="masonry"
          src={imageUrl}
          alt={mockup.prompt || t('myOutputs.imageAlt')}
          aspectRatio={reserved}
          actionLabel={t('apps.open')}
          fallbackLabel={t('common.unavailable')}
          onClick={() => handleView(mockup)}
          onImageLoad={() =>
            setLoadedIds((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
          }
        />
      );
    },

    [handleView, loadedIds, t]
  );

  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-background text-muted-foreground',
          inShell ? 'min-h-full pt-6' : 'min-h-screen pt-12 md:pt-14'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <GlitchLoader size={36} className="mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">
                {t('my.outputs.loading_your_outputs')}
              </p>
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
      <div
        className={cn(
          'bg-background text-muted-foreground relative overflow-hidden',
          inShell ? 'min-h-full' : 'min-h-screen'
        )}
      >
        {/* Busca in-page só (barra fina). A identidade (voltar + "Meus Mockups" + contagem)
            vem do rail drill-in / AppSpine; a tag cloud virou L2 no rail (portal
            abaixo). Sem header próprio — evita o header morto. */}
        {mockups.length > 0 && (
          <div className={cn('relative z-30 pb-4', inShell ? 'pt-4' : 'pt-16 md:pt-20')}>
            <div className="max-w-7xl mx-auto px-4 md:px-6">
              <div className="flex items-center gap-2">
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('myOutputs.searchPlaceholder')}
                    className="h-9 max-w-md border-border bg-input pl-9 text-sm"
                  />
                </div>
                {allTags.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    aria-expanded={showTags}
                    onClick={() => {
                      if (showTags) setFilterTag(null);
                      setShowTags((v) => !v);
                    }}
                  >
                    <Tag className="h-3.5 w-3.5" aria-hidden />
                    {showTags ? t('myOutputs.hideTags') : t('myOutputs.showTags')}
                  </Button>
                )}
              </div>
              {/* Tags = fallback do rail. Sem slot (rail recolhido, mobile ou fora
                  do shell) aparecem sempre; com slot, só abaixo de md (mesma
                  regra da AppsPage). */}
              {showTags && allTags.length > 0 && (
                <div
                  className={cn(
                    '-mx-4 md:-mx-6 mt-3 overflow-x-auto px-4 md:px-6 scrollbar-none',
                    railSlot && 'md:hidden'
                  )}
                >
                  <div className="flex w-max items-center gap-1.5">
                    {allTags.map((tg) => {
                      const active = tg === filterTag;
                      return (
                        <button
                          type="button"
                          key={tg}
                          aria-pressed={active}
                          onClick={() => setFilterTag(active ? null : tg)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                            active
                              ? 'border-border bg-muted text-foreground'
                              : 'border-transparent bg-muted/40 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {tg}
                          {active && <X className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tag cloud → rail (L2, SSoT igual /references) */}
        {railSlot &&
          showTags &&
          allTags.length > 0 &&
          createPortal(
            <div className="px-2 pb-3">
              <p className="px-1 pb-1.5 text-2xs text-muted-foreground">{t('myOutputs.tags')}</p>
              <div className="flex flex-wrap gap-1">
                {filterTag && (
                  <button
                    onClick={() => setFilterTag(null)}
                    className="inline-flex items-center gap-1 rounded-md bg-sidebar-accent text-sidebar-accent-foreground px-1.5 py-0.5 text-2xs"
                  >
                    {filterTag}
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
                {allTags
                  .filter((tg) => tg !== filterTag)
                  .map((tg) => (
                    <button
                      key={tg}
                      onClick={() => setFilterTag(tg)}
                      className="rounded-md px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    >
                      {tg}
                    </button>
                  ))}
              </div>
            </div>,
            railSlot
          )}

        {/* Grid Gallery */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pb-12 md:pb-16">
          {error && mockups.length === 0 ? (
            <ErrorState onRetry={loadMockups} />
          ) : mockups.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title={t('myOutputs.emptyTitle')}
              description={t('myOutputs.emptyDescription')}
              actionLabel={t('myOutputs.emptyAction')}
              onAction={() => navigate('/mockupmachine')}
            />
          ) : filteredMockups.length === 0 ? (
            brandId && !searchQuery && !filterTag ? (
              // Marca ativa sem mockup: vazio honesto, e a saída é soltar a marca.
              <EmptyState
                icon={ImageIcon}
                title={t('myOutputs.noResultsForBrand')}
                description={t('myOutputs.noResultsForBrandDescription')}
                actionLabel={t('myOutputs.showAllBrands')}
                onAction={() => setActiveBrand(null)}
              />
            ) : (
              <EmptyState
                icon={Search}
                title={t('myOutputs.noResultsTitle')}
                description={t('myOutputs.noResultsDescription')}
                actionLabel={t('myOutputs.clearFilters')}
                onAction={() => {
                  setSearchQuery('');
                  setFilterTag(null);
                }}
              />
            )
          ) : (
            // SSoT masonry (mesmo componente da /references): colunas responsivas.
            <Masonry
              items={filteredMockups}
              getKey={(m) => m._id || getImageUrl(m)}
              gap={12}
              renderItem={renderMockupTile}
            />
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
            onDelete={
              isAuthenticated && selectedMockup._id
                ? () => handleDelete(selectedMockup._id)
                : undefined
            }
            isDeleting={deletingId === selectedMockup._id}
            isAuthenticated={isAuthenticated === true}
            onToggleLike={selectedMockup._id ? () => handleToggleLike(selectedMockup) : undefined}
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
            // Só "abrir no editor": zoom/ângulo/re-imagine gravavam no localStorage
            // e navegavam pra "/", onde ninguém lê. Sem consumidor, sem botão.
            showActions={isAuthenticated === true}
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
