import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '../../lib/utils';
import type { UploadedImage, DesignType } from '../../types/types';
import { useMockup } from './MockupContext';
import { useSidebarEffects } from '@/hooks/useSidebarEffects';
import { useAnalysisOverlay } from '@/hooks/useAnalysisOverlay';
import { SetupModal } from './SetupModal';
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
  onReplaceImage?: (image: UploadedImage) => void;
  onReferenceImagesChange: (images: UploadedImage[]) => void;
  onStartOver: () => void;
  onDesignTypeChange: (type: DesignType) => void;
  onGenerateClick: () => void;
  onSuggestPrompts: () => void;
  onGenerateSmartPrompt: () => void;
  onSimplify: () => void;
  onRegenerate: () => void;
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
  onReplaceImage,
  onReferenceImagesChange,
  onStartOver,
  onDesignTypeChange,
  onGenerateClick,
  onSuggestPrompts,
  onGenerateSmartPrompt,
  onSimplify,
  onRegenerate,
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
    isGeneratingPrompt,
  } = useMockup();

  const [isDiceAnimating, setIsDiceAnimating] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(!hasAnalyzed);

  // Use analysis overlay hook
  const { showTemporaryOverlay } = useAnalysisOverlay();

  // Open setup modal when not analyzed (e.g., on reset/start over)
  useEffect(() => {
    if (!hasAnalyzed) {
      setIsSetupModalOpen(true);
    }
  }, [hasAnalyzed]);

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

    // Show "fake" analysis overlay briefly
    showTemporaryOverlay(300);

    // All Pool Mode logic is now handled in MockupMachinePage.handleSurpriseMe
    // Just call the external handler which will use the Context pool when Pool Mode is active
    onSurpriseMe(autoGenerate);

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
          "relative flex-shrink-0 bg-sidebar text-sidebar-foreground overflow-y-auto overflow-x-hidden overscroll-contain min-h-0 z-10 transition-all duration-300",
          "max-h-[calc(100dvh-6rem)] sm:max-h-[calc(100dvh-7rem)] lg:max-h-full",
          "p-3 sm:p-4 md:p-6 lg:p-8",
          "w-full", // Base width
          !hasAnalyzed ? [
            "rounded-md",
            isSurpriseMeMode
              ? "border border-brand-cyan/40 border-dashed shadow-[0_0_25px_rgba(0,210,255,0.08)] animate-pool-border-glow"
              : "border-none shadow-none",
            "max-w-screen-2xl mx-auto", // Full width for Step 1
            "min-w-0"
          ] : [
            "max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl", // Sidebar panel state for Step 2
            "h-full px-4 lg:px-6 py-10",
            isSurpriseMeMode
              ? "border-l border-brand-cyan/70 border-dashed shadow-[-10px_0_30px_rgba(0,210,255,0.05)]"
              : "", // Removed border-r border-sidebar-border/10
            "lg:w-auto"
          ]
        )}
        style={{
          paddingBottom: '50px',
          ...(hasAnalyzed && isLargeScreen ? { width: `${sidebarWidth}px` } : {})
        }}
      >
        <div className="space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">
          {hasAnalyzed && (
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
              onReplaceImage={onReplaceImage}
              onReferenceImagesChange={onReferenceImagesChange}
              authenticationRequiredMessage={authenticationRequiredMessage}
            />
          )}
        </div>
      </aside>

      {/* Resizer - only show on large screens when hasAnalyzed (sidebar is in resizable panel state) */}
      {isLargeScreen && hasAnalyzed && (
        <div
          ref={resizerRef}
          id="sidebar-resizer"
          className="hidden lg:block w-2 cursor-col-resize group"
        >
          <div className="w-px h-full mx-auto bg-sidebar-border group-hover:bg-brand-cyan/50 dark:group-hover:bg-brand-cyan/50 transition-colors duration-200"></div>
        </div>
      )}

      {/* Setup Modal */}
      <SetupModal
        isOpen={isSetupModalOpen}
        canClose={true}
        onClose={() => {
          if (!hasAnalyzed) {
            onStartOver();
          }
          setIsSetupModalOpen(false);
        }}
        onImageUpload={onImageUpload}
        onReferenceImagesChange={onReferenceImagesChange}
        onStartOver={onStartOver}
        onDesignTypeChange={onDesignTypeChange}
        onAnalyze={() => {
          // Start analysis (this will show the overlay via handleAnalyze)
          onAnalyze();
          // Close setup modal immediately to go to next step
          setIsSetupModalOpen(false);
        }}
      />
    </>
  );
};
