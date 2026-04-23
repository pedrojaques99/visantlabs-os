import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useCanvasHeader, useLinkedGuidelineId } from '@/components/canvas/CanvasHeaderContext';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import type { BrandGuideline } from '@/lib/figma-types';
import { BrandMediaLibraryModal } from '@/components/reactflow/modals/BrandMediaLibraryModal';

type LibraryTab = 'logos' | 'media' | 'colors' | 'all';

interface OpenLibraryOptions {
  tab?: LibraryTab;
  onSelectAsset?: (url: string, type: 'image' | 'logo' | 'color') => void;
  onAddToBoard?: (url: string, type: 'image' | 'logo') => void;
}

interface BrandKitContextValue {
  /** Currently active brand guideline ID */
  activeBrandId: string | null;
  /** Full guideline object (from cache) */
  activeGuideline: BrandGuideline | null;
  /** Shortcut accessors */
  logos: NonNullable<BrandGuideline['logos']>;
  colors: NonNullable<BrandGuideline['colors']>;
  media: NonNullable<BrandGuideline['media']>;
  /** All user's guidelines */
  allGuidelines: BrandGuideline[];
  /** Open the global Brand Media Library modal */
  openLibrary: (opts?: OpenLibraryOptions) => void;
  /** Close the modal */
  closeLibrary: () => void;
  /** Whether the library modal is open */
  isLibraryOpen: boolean;
}

const BrandKitContext = createContext<BrandKitContextValue | null>(null);

export const ActiveBrandKitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const linkedGuidelineId = useLinkedGuidelineId();
  const { data: allGuidelines = [] } = useBrandGuidelines();

  // Modal state
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryCallbacks, setLibraryCallbacks] = useState<{
    onSelectAsset?: OpenLibraryOptions['onSelectAsset'];
    onAddToBoard?: OpenLibraryOptions['onAddToBoard'];
  }>({});

  // Resolve active guideline from cache
  const activeGuideline = useMemo(() => {
    if (!linkedGuidelineId) return null;
    return allGuidelines.find(g => g.id === linkedGuidelineId) ?? null;
  }, [linkedGuidelineId, allGuidelines]);

  const openLibrary = useCallback((opts?: OpenLibraryOptions) => {
    setLibraryCallbacks({
      onSelectAsset: opts?.onSelectAsset,
      onAddToBoard: opts?.onAddToBoard,
    });
    setIsLibraryOpen(true);
  }, []);

  const closeLibrary = useCallback(() => {
    setIsLibraryOpen(false);
    setLibraryCallbacks({});
  }, []);

  const value = useMemo<BrandKitContextValue>(() => ({
    activeBrandId: linkedGuidelineId,
    activeGuideline,
    logos: activeGuideline?.logos ?? [],
    colors: activeGuideline?.colors ?? [],
    media: activeGuideline?.media ?? [],
    allGuidelines,
    openLibrary,
    closeLibrary,
    isLibraryOpen,
  }), [linkedGuidelineId, activeGuideline, allGuidelines, openLibrary, closeLibrary, isLibraryOpen]);

  return (
    <BrandKitContext.Provider value={value}>
      {children}
      <BrandMediaLibraryModal
        isOpen={isLibraryOpen}
        onClose={closeLibrary}
        onSelectAsset={libraryCallbacks.onSelectAsset}
        onAddToBoard={libraryCallbacks.onAddToBoard}
        guidelineId={linkedGuidelineId}
      />
    </BrandKitContext.Provider>
  );
};

export function useBrandKit(): BrandKitContextValue {
  const ctx = useContext(BrandKitContext);
  if (!ctx) {
    throw new Error('useBrandKit must be used within ActiveBrandKitProvider');
  }
  return ctx;
}

/**
 * Safe version that returns null outside provider (for components that may render outside app tree)
 */
export function useBrandKitSafe(): BrandKitContextValue | null {
  return useContext(BrandKitContext);
}
