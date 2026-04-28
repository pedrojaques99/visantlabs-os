import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useCanvasHeader, useLinkedGuidelineId } from '@/components/canvas/CanvasHeaderContext';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import type { BrandGuideline } from '@/lib/figma-types';

type LibraryTab = 'logos' | 'media' | 'colors' | 'all';

interface OpenLibraryOptions {
  tab?: LibraryTab;
  onSelectAsset?: (url: string, type: 'image' | 'logo' | 'color') => void;
  onAddToBoard?: (url: string, type: 'image' | 'logo') => void;
}

interface BrandKitContextValue {
  activeBrandId: string | null;
  activeGuideline: BrandGuideline | null;
  logos: NonNullable<BrandGuideline['logos']>;
  colors: NonNullable<BrandGuideline['colors']>;
  media: NonNullable<BrandGuideline['media']>;
  allGuidelines: BrandGuideline[];
  /** Opens the Brand Media Library in the side panel */
  openLibrary: (opts?: OpenLibraryOptions) => void;
  closeLibrary: () => void;
  isLibraryOpen: boolean;
  /** Callbacks stored when openLibrary is called with custom handlers */
  libraryCallbacks: {
    onSelectAsset?: OpenLibraryOptions['onSelectAsset'];
    onAddToBoard?: OpenLibraryOptions['onAddToBoard'];
  };
}

const BrandKitContext = createContext<BrandKitContextValue | null>(null);

export const ActiveBrandKitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const linkedGuidelineId = useLinkedGuidelineId();
  const canvasHeader = useCanvasHeader();
  const { data: allGuidelines = [] } = useBrandGuidelines();

  const [libraryCallbacks, setLibraryCallbacks] = useState<{
    onSelectAsset?: OpenLibraryOptions['onSelectAsset'];
    onAddToBoard?: OpenLibraryOptions['onAddToBoard'];
  }>({});

  const activeGuideline = useMemo(() => {
    if (!linkedGuidelineId) return null;
    return allGuidelines.find(g => g.id === linkedGuidelineId) ?? null;
  }, [linkedGuidelineId, allGuidelines]);

  const isLibraryOpen = canvasHeader.activeSidePanel === 'brand-media';

  const openLibrary = useCallback((opts?: OpenLibraryOptions) => {
    setLibraryCallbacks({
      onSelectAsset: opts?.onSelectAsset,
      onAddToBoard: opts?.onAddToBoard,
    });
    canvasHeader.setActiveSidePanel('brand-media');
  }, [canvasHeader]);

  const closeLibrary = useCallback(() => {
    canvasHeader.setActiveSidePanel(null);
    setLibraryCallbacks({});
  }, [canvasHeader]);

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
    libraryCallbacks,
  }), [linkedGuidelineId, activeGuideline, allGuidelines, openLibrary, closeLibrary, isLibraryOpen, libraryCallbacks]);

  return (
    <BrandKitContext.Provider value={value}>
      {children}
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
