import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '../../lib/utils';
import { Dices, RotateCcw, Pickaxe, Loader2 } from '@/lib/ui/icons';
import { Thumb } from '../ui/Thumb';
import type { UploadedImage, DesignType } from '../../types/types';
import { useMockup } from './MockupContext';
import { useSidebarEffects } from '@/hooks/useSidebarEffects';
import { SidebarSetupSection } from './SidebarSetupSection';
import { SidebarGenerationConfig } from './SidebarGenerationConfig';
import { EssentialSidebar } from './EssentialSidebar';

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
  onGenerateSmartPrompt: (generateOutputs?: boolean) => Promise<void>;
  onSimplify: () => void;
  onRegenerate: () => void;
  onGenerateSuggestion: (suggestion: string) => void;
  onAnalyze: () => void;

  // Specific UI props
  authenticationRequiredMessage: string;
  isPromptReady: boolean;
  isCollapsed?: boolean;
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
  authenticationRequiredMessage,
  isPromptReady,
  isCollapsed = false,
}) => {
  const { t } = useTranslation();

  const {
    uploadedImage,
    hasAnalyzed,
    hasGenerated,
    designType,
    selectedBrandGuideline,
    selectedBrandingTags,
    selectedTags,
    isSurpriseMeMode,
    isGeneratingPrompt,
    isLoading,
  } = useMockup();

  const [mode, setMode] = React.useState<'essential' | 'expert'>('essential');

  // Use extracted effects hook
  const { isLargeScreen, resizerRef } = useSidebarEffects({
    sidebarRef,
    onSidebarWidthChange,
    hasAnalyzed,
    hasGenerated,
    designType,
    brandingComplete: selectedBrandingTags.length > 0,
    categoriesComplete: selectedTags.length > 0,
  });

  const isOutputsLoading = isLoading.some((v) => v);

  // --- Compact Sidebar (Essentialist / Intelligent) ---
  if (isCollapsed && hasAnalyzed) {
    return (
      <aside
        id="sidebar-compact"
        className={cn(
          'relative flex-shrink-0 bg-sidebar border-r border-sidebar-border',
          'h-full w-16 hidden lg:flex flex-col items-center py-8 gap-8 animate-in slide-in-from-left duration-300'
        )}
      >
        {/* Thumb Reference */}
        <Thumb
          src={uploadedImage?.url || uploadedImage?.base64 || undefined}
          alt={t('mockup.uploadedDesignAlt')}
          fallbackIcon={Pickaxe}
          className="w-11 h-11 rounded-xl object-cover border border-border"
        />

        <div className="flex-1 flex flex-col items-center gap-7">
          {/* Surprise Me Icon */}
          <button
            onClick={() => onSurpriseMe(true)}
            disabled={isGeneratingPrompt || isOutputsLoading}
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSurpriseMeMode
                ? 'bg-brand-cyan/10 border-brand-cyan/40 text-foreground'
                : 'text-neutral-500 hover:text-foreground border-transparent hover:bg-muted'
            )}
            title={t('mockup.surpriseMe')}
            aria-label={t('mockup.surpriseMe')}
          >
            <Dices size={20} className={cn(isGeneratingPrompt && 'animate-spin')} />
          </button>

          {/* Generate Icon (Core Action) */}
          <button
            onClick={onGenerateClick}
            disabled={isOutputsLoading}
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isOutputsLoading
                ? 'bg-neutral-800 text-neutral-600 border border-neutral-800'
                : isPromptReady
                  ? 'bg-brand-cyan text-black hover:bg-brand-cyan/90'
                  : 'bg-neutral-900 text-neutral-500 hover:text-foreground border border-neutral-800 hover:bg-neutral-800'
            )}
            title={t('mockup.generateOutputs')}
            aria-label={t('mockup.generateOutputs')}
          >
            {isOutputsLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Pickaxe size={22} />
            )}
          </button>

          {/* Start Over Button */}
          <button
            onClick={onStartOver}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-500 hover:text-destructive hover:bg-destructive/5 border border-transparent hover:border-destructive/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={t('mockup.startOver')}
            aria-label={t('mockup.startOver')}
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      <aside
        ref={sidebarRef}
        id="sidebar"
        className={cn(
          'relative flex-shrink-0 bg-sidebar text-sidebar-foreground overflow-y-auto overflow-x-hidden overscroll-contain min-h-0 z-10 transition-[color,background-color,border-color,box-shadow] duration-300 custom-scrollbar',
          'max-h-auto',
          'p-3 sm:p-4 md:p-6 lg:p-8',
          'w-full', // Base width
          !hasAnalyzed
            ? [
                'rounded-md',
                isSurpriseMeMode ? 'border border-dashed border-border' : 'border-none shadow-none',
                'max-w-4xl mx-auto', // Full width for Step 1
                'min-w-0',
              ]
            : [
                'max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl', // Sidebar panel state for Step 2
                'h-full px-4 lg:px-6 py-10',
                isSurpriseMeMode ? 'border-l border-dashed border-border' : '',
                'lg:w-auto',
              ]
        )}
        style={{
          paddingBottom: '20px',
          scrollbarGutter: 'stable',
          ...(hasAnalyzed && isLargeScreen ? { width: `${sidebarWidth}px` } : {}),
        }}
      >
        <div className="space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">
          {!hasAnalyzed ? (
            <div className="h-auto justify-center animate-fade-in">
              <SidebarSetupSection
                onImageUpload={onImageUpload}
                onReferenceImagesChange={onReferenceImagesChange}
                onStartOver={onStartOver}
                onDesignTypeChange={onDesignTypeChange}
                onAnalyze={onAnalyze}
                onClose={onCloseMobile}
              />
            </div>
          ) : mode === 'essential' ? (
            <EssentialSidebar
              onSwitchToExpert={() => setMode('expert')}
              isSurpriseMeActive={isSurpriseMeMode}
            />
          ) : (
            <SidebarGenerationConfig
              onGenerateClick={onGenerateClick}
              onRegenerate={onRegenerate}
              onSurpriseMe={onSurpriseMe}
              handleSurpriseMe={onSurpriseMe}
              onSuggestPrompts={onSuggestPrompts}
              onGenerateSmartPrompt={onGenerateSmartPrompt}
              onSimplify={onSimplify}
              onGenerateSuggestion={onGenerateSuggestion}
              generateOutputsButtonRef={generateOutputsButtonRef}
              onStartOver={onStartOver}
              onReplaceImage={onReplaceImage}
              onReferenceImagesChange={onReferenceImagesChange}
              authenticationRequiredMessage={authenticationRequiredMessage}
              isPromptReady={isPromptReady}
              sidebarWidth={sidebarWidth}
              onSwitchToEssential={() => setMode('essential')}
            />
          )}
        </div>
      </aside>

      {/* Resizer - only show on large screens when hasAnalyzed */}
      {isLargeScreen && hasAnalyzed && (
        <div
          ref={resizerRef}
          id="sidebar-resizer"
          className="hidden lg:block w-2 cursor-col-resize group"
        >
          <div className="w-px h-auto mx-auto bg-sidebar-border group-hover:bg-ring transition-colors duration-200"></div>
        </div>
      )}
    </>
  );
};
