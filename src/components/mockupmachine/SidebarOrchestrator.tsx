import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '../../lib/utils';
import type { UploadedImage, DesignType } from '../../types/types';
import { useMockup } from './MockupContext';
import { useSidebarEffects } from '@/hooks/useSidebarEffects';
import { useAnalysisOverlay } from '@/hooks/useAnalysisOverlay';
import { SidebarSetupSection } from './SidebarSetupSection';
import { SidebarGenerationConfig } from './SidebarGenerationConfig';

interface SidebarOrchestratorProps {
  // Layout props
  sidebarWidth: number;
  sidebarRef: React.RefObject<HTMLElement>;
  onSidebarWidthChange: (width: number) => void;
  onCloseMobile?: () => void;
  generateOutputsButtonRef: React.RefObject<HTMLButtonElement>;

  // External Logic / Triggers
  onSurpriseMe: (autoGenerate: boolean) => void;
  onImageUpload: (image: UploadedImage) => void;
  onReferenceImagesChange: (images: UploadedImage[]) => void;
  onStartOver: () => void;
  onDesignTypeChange: (type: DesignType) => void;
  onGenerateClick: () => void;
  onSuggestPrompts: () => void;
  onGenerateSmartPrompt: () => void;
  onSimplify: () => void;
  onRegenerate: () => void;
  onBlankMockup?: () => void;
  onGenerateSuggestion: (suggestion: string) => void;
  onAnalyze: () => void;

  // Specific UI props
  authenticationRequiredMessage: string;
}

export const SidebarOrchestrator: React.FC<SidebarOrchestratorProps> = ({
  sidebarWidth,
  sidebarRef,
  onSidebarWidthChange,
  onCloseMobile,
  onSurpriseMe,
  onImageUpload,
  onReferenceImagesChange,
  onStartOver,
  onDesignTypeChange,
  onGenerateClick,
  onSuggestPrompts,
  onGenerateSmartPrompt,
  onSimplify,
  onRegenerate,
  onBlankMockup,
  onGenerateSuggestion,
  onAnalyze,
  generateOutputsButtonRef,
  authenticationRequiredMessage
}) => {
  const { t } = useTranslation();
  const {
    hasAnalyzed,
    hasGenerated,
    designType,
    selectedBrandingTags,
    selectedTags,
    isSurpriseMeMode,
    surpriseMePool,
    setSelectedTags,
    setSelectedLocationTags,
    setSelectedAngleTags,
    setSelectedLightingTags,
    setSelectedEffectTags,
    setSelectedMaterialTags,
    isGeneratingPrompt,
    // Overlay control is now handled by useAnalysisOverlay hook
  } = useMockup();

  const [isDiceAnimating, setIsDiceAnimating] = useState(false);

  // Use analysis overlay hook
  const { showTemporaryOverlay } = useAnalysisOverlay();

  // Use extracted effects hook
  const { isLargeScreen, resizerRef } = useSidebarEffects({
    sidebarRef,
    onSidebarWidthChange,
    hasAnalyzed,
    hasGenerated,
    designType,
    brandingComplete: selectedBrandingTags.length > 0,
    categoriesComplete: selectedTags.length > 0
  });

  const handleSurpriseMe = (autoGenerate: boolean = true) => {
    setIsDiceAnimating(true);

    // Show "fake" analysis overlay for 1 second
    showTemporaryOverlay(300);

    // If pool mode is active, use the pool for randomization
    if (isSurpriseMeMode && Object.values(surpriseMePool).some(arr => arr.length > 0)) {
      // Helper to pick one random tag from an array
      const pickRandom = (tags: string[]): string | null => {
        if (tags.length === 0) return null;
        return tags[Math.floor(Math.random() * tags.length)];
      };

      // Randomize from pool - set one tag from each pool section
      if (surpriseMePool.selectedCategoryTags?.length > 0) {
        const tag = pickRandom(surpriseMePool.selectedCategoryTags);
        if (tag) setSelectedTags([tag]);
      }
      if (surpriseMePool.selectedLocationTags?.length > 0) {
        const tag = pickRandom(surpriseMePool.selectedLocationTags);
        if (tag) setSelectedLocationTags([tag]);
      }
      if (surpriseMePool.selectedAngleTags?.length > 0) {
        const tag = pickRandom(surpriseMePool.selectedAngleTags);
        if (tag) setSelectedAngleTags([tag]);
      }
      if (surpriseMePool.selectedLightingTags?.length > 0) {
        const tag = pickRandom(surpriseMePool.selectedLightingTags);
        if (tag) setSelectedLightingTags([tag]);
      }
      if (surpriseMePool.selectedEffectTags?.length > 0) {
        const tag = pickRandom(surpriseMePool.selectedEffectTags);
        if (tag) setSelectedEffectTags([tag]);
      }
      if (surpriseMePool.selectedMaterialTags?.length > 0) {
        const tag = pickRandom(surpriseMePool.selectedMaterialTags);
        if (tag) setSelectedMaterialTags([tag]);
      }

      // Still call onSurpriseMe for auto-generation if enabled, but without full randomization
      if (autoGenerate) {
        onSurpriseMe(autoGenerate);
      }
    } else {
      // Normal behavior - call the external handler
      onSurpriseMe(autoGenerate);
    }

    // Scroll to Generate button
    setTimeout(() => {
      const sidebar = document.getElementById('sidebar');
      const generateButton = generateOutputsButtonRef.current;
      if (sidebar && generateButton) {
        const sidebarRect = sidebar.getBoundingClientRect();
        const buttonRect = generateButton.getBoundingClientRect();
        const relativeTop = buttonRect.top - sidebarRect.top + sidebar.scrollTop;

        sidebar.scrollTo({
          top: relativeTop - 20,
          behavior: 'smooth'
        });
      }
    }, 200);

    // Reset animation after it completes
    setTimeout(() => {
      setIsDiceAnimating(false);
    }, 800);
  };

  // Reset animation when prompt generation starts
  useEffect(() => {
    if (isGeneratingPrompt) {
      setIsDiceAnimating(false);
    }
  }, [isGeneratingPrompt]);

  return (
    <>
      <aside
        ref={sidebarRef}
        id="sidebar"
        className={cn(
          "relative flex-shrink-0 bg-sidebar text-sidebar-foreground overflow-y-auto overflow-x-hidden overscroll-contain min-h-0 z-10 transition-all duration-500",
          "max-h-[calc(100dvh-6rem)] sm:max-h-[calc(100dvh-7rem)] lg:max-h-full",
          "p-3 sm:p-4 md:p-6 lg:p-8 pb-24 sm:pb-28 md:pb-32",
          "w-full", // Base width
          !hasAnalyzed ? [
            "rounded-md border",
            isSurpriseMeMode
              ? "border-brand-cyan/40 border-dashed shadow-[0_0_25px_rgba(0,210,255,0.08)] animate-pulse-subtle"
              : "border-sidebar-border/5",
            "max-w-screen-2xl mx-auto", // Full width for Step 1
            "min-w-0"
          ] : [
            "max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl", // Sidebar panel state for Step 2
            "h-full px-4 lg:px-6 py-10",
            isSurpriseMeMode
              ? "border-l border-brand-cyan/70 border-dashed shadow-[-10px_0_30px_rgba(0,210,255,0.05)]"
              : "border-r border-sidebar-border/10",
            "lg:w-auto"
          ]
        )}
        style={hasAnalyzed && isLargeScreen ? { width: `${sidebarWidth}px` } : {}}
      >
        {/* Pool Mode Status Badge */}
        {isSurpriseMeMode && (
          <div className="absolute top-6 right-8 flex items-center gap-2 px-2 py-1 rounded bg-brand-cyan/10 border border-brand-cyan/20 animate-fade-in z-20">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-brand-cyan tracking-[0.2em] uppercase">
              {t('mockup.surpriseMeMode')} Active
            </span>
          </div>
        )}
        <div className="space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">
          {!hasAnalyzed ? (
            <SidebarSetupSection
              onImageUpload={onImageUpload}
              onReferenceImagesChange={onReferenceImagesChange}
              onStartOver={onStartOver}
              onDesignTypeChange={onDesignTypeChange}
              onAnalyze={onAnalyze}
            />
          ) : (
            <SidebarGenerationConfig
              onGenerateClick={onGenerateClick}
              onRegenerate={onRegenerate}
              onSurpriseMe={onSurpriseMe}
              handleSurpriseMe={handleSurpriseMe}
              onSuggestPrompts={onSuggestPrompts}
              onGenerateSmartPrompt={onGenerateSmartPrompt}
              onSimplify={onSimplify}
              onGenerateSuggestion={onGenerateSuggestion}
              generateOutputsButtonRef={generateOutputsButtonRef}
              isDiceAnimating={isDiceAnimating}
              onStartOver={onStartOver}
              authenticationRequiredMessage={authenticationRequiredMessage}
            />
          )}
        </div>
      </aside>

      {/* Resizer - only show on large screens when hasGenerated */}
      {isLargeScreen && (
        <div
          ref={resizerRef}
          id="sidebar-resizer"
          className="hidden lg:block w-2 cursor-col-resize group"
        >
          <div className="w-px h-full mx-auto bg-sidebar-border group-hover:bg-brand-cyan/50 dark:group-hover:bg-brand-cyan/50 transition-colors duration-200"></div>
        </div>
      )}
    </>
  );
};
