import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { MockupCard } from './MockupCard';
import type { AspectRatio } from '@/types/types';
import { InteractiveASCIICopy } from '@/components/ui/InteractiveASCIICopy';
import { MicroTitle } from '../ui/MicroTitle';
import { GlassPanel } from '../ui/GlassPanel';

interface MockupDisplayProps {
  mockups: (string | null)[];
  isLoading: boolean[];
  onRedraw: (index: number) => void;
  onView: (index: number) => void;
  onNewAngle: (index: number, angle: string) => void;
  onNewBackground: (index: number) => void;
  onReImagine?: (index: number, reimaginePrompt: string) => void;
  onSave?: (index: number, imageBase64: string) => Promise<void>;
  savedIndices?: Set<number>;
  savedMockupIds?: Map<number, string>;
  onToggleLike?: (index: number) => void;
  onLikeStateChange?: (index: number) => (newIsLiked: boolean) => void;
  likedIndices?: Set<number> | Map<number, boolean>;
  onRemove?: (index: number) => void;
  prompt?: string;
  designType?: string;
  tags?: string[];
  brandingTags?: string[];
  aspectRatio: AspectRatio;
  editButtonsDisabled?: boolean;
  creditsPerOperation?: number;
  /** When true, sidebar is collapsed and main area uses full width; used for responsive layout. */
  isSidebarCollapsed?: boolean;
}

export const MockupDisplay: React.FC<MockupDisplayProps> = React.memo(({
  mockups,
  isLoading,
  onRedraw,
  onView,
  onNewAngle,
  onNewBackground,
  onReImagine,
  onSave,
  savedIndices = new Set(),
  savedMockupIds,
  onToggleLike,
  onLikeStateChange,
  likedIndices = new Set(),
  onRemove,
  prompt,
  designType,
  tags,
  brandingTags,
  aspectRatio,
  editButtonsDisabled = false,
  creditsPerOperation,
  isSidebarCollapsed = false
}) => {
  const { t } = useTranslation();

  // Helper to get isLiked status - supports both Set and Map
  const getIsLiked = (index: number): boolean => {
    if (likedIndices instanceof Map) {
      return likedIndices.get(index) ?? false;
    }
    return (likedIndices as Set<number>).has(index);
  };

  const hasContent = mockups.some(m => m !== null) || isLoading.some(Boolean);
  const isSingleImage = mockups.length === 1;

  if (!hasContent) {
    return (
      <div className="relative flex flex-col items-center justify-center h-full w-full min-w-0 text-center p-6 sm:p-8 md:p-12 animate-fade-in overflow-hidden">

        <GlassPanel padding="lg" className="relative z-10 flex flex-col items-center backdrop-blur-md shadow-2xl">
          <MicroTitle as="h3" className="text-xl md:text-2xl font-bold text-neutral-300 mb-4 drop-shadow-md">
            {t('mockup.awaitingGeneration')}
          </MicroTitle>

          <p className="max-w-md text-neutral-400 text-sm md:text-base font-medium leading-relaxed drop-shadow-md">
            {t('mockup.awaitingGenerationDescription')}
          </p>
        </GlassPanel>
      </div>
    );
  }

  // For single image, we want to contain it within view height if possible
  if (isSingleImage) {
    return (
      <section className="h-full w-full min-w-0 flex items-center justify-center p-3 sm:p-4 overflow-hidden relative">
        <MockupCard
          key={0}
          base64Image={mockups[0]}
          isLoading={isLoading[0] && !mockups[0]}
          isRedrawing={isLoading[0] && !!mockups[0]}
          onRedraw={() => onRedraw(0)}
          onView={() => onView(0)}
          onNewAngle={(angle) => onNewAngle(0, angle)}
          onNewBackground={() => onNewBackground(0)}
          onReImagine={onReImagine ? (reimaginePrompt) => onReImagine(0, reimaginePrompt) : undefined}
          onSave={onSave ? (imageBase64) => onSave(0, imageBase64) : undefined}
          isSaved={savedIndices.has(0)}
          mockupId={savedMockupIds?.get(0)}
          onToggleLike={onToggleLike ? () => onToggleLike(0) : undefined}
          isLiked={getIsLiked(0)}
          onLikeStateChange={savedMockupIds?.get(0) && onLikeStateChange ? onLikeStateChange(0) : undefined}
          onRemove={onRemove ? () => onRemove(0) : undefined}
          prompt={prompt}
          designType={designType}
          tags={tags}
          brandingTags={brandingTags}
          aspectRatio={aspectRatio}
          editButtonsDisabled={editButtonsDisabled}
          creditsPerOperation={creditsPerOperation}
        />
      </section>
    );
  }

  // Multi-image grid: 1–2 cols.
  const getGridClasses = () => {
    const gap = "gap-3 sm:gap-4 md:gap-6";
    const cols = isSidebarCollapsed
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2";
    const maxW = isSidebarCollapsed ? "max-w-[2000px]" : "max-w-[1800px]";
    return `grid w-full mx-auto ${cols} ${gap} ${maxW}`;
  };

  return (
    <section className="h-full w-full min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
      <div className={`${getGridClasses()} p-3 sm:p-4 md:p-5`}>
        {Array.from({ length: mockups.length }).map((_, index) => {
          const mockupId = savedMockupIds?.get(index);
          const isLiked = getIsLiked(index);
          const hasImage = !!mockups[index];
          const isItemLoading = isLoading[index];

          // Hide card if it has no image and is not loading (empty placeholder)
          if (!hasImage && !isItemLoading) {
            return null;
          }

          return (
            <MockupCard
              key={index}
              className="min-w-0 w-full"
              base64Image={mockups[index]}
              isLoading={isItemLoading && !mockups[index]}
              isRedrawing={isItemLoading && !!mockups[index]}
              onRedraw={() => onRedraw(index)}
              onView={() => onView(index)}
              onNewAngle={(angle) => onNewAngle(index, angle)}
              onNewBackground={() => onNewBackground(index)}
              onReImagine={onReImagine ? (reimaginePrompt) => onReImagine(index, reimaginePrompt) : undefined}
              onSave={onSave ? (imageBase64) => onSave(index, imageBase64) : undefined}
              isSaved={savedIndices.has(index)}
              mockupId={mockupId}
              onToggleLike={onToggleLike ? () => onToggleLike(index) : undefined}
              isLiked={isLiked}
              onLikeStateChange={mockupId && onLikeStateChange ? onLikeStateChange(index) : undefined}
              onRemove={onRemove ? () => onRemove(index) : undefined}
              prompt={prompt}
              designType={designType}
              tags={tags}
              brandingTags={brandingTags}
              aspectRatio={aspectRatio}
              editButtonsDisabled={editButtonsDisabled}
              creditsPerOperation={creditsPerOperation}
            />
          );
        })}
      </div>
    </section>
  );
});