import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '../../lib/utils';
import { Dices, Gem, RotateCcw, Scan, Pickaxe } from 'lucide-react';
import type { UploadedImage, DesignType } from '../../types/types';
import { useMockup } from './MockupContext';
import { useSidebarEffects } from '@/hooks/useSidebarEffects';
import { SidebarSetupSection } from './SidebarSetupSection';
import { SidebarGenerationConfig } from './SidebarGenerationConfig';
import { EssentialSidebar } from './EssentialSidebar';
import { MicroTitle } from '../ui/MicroTitle';

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
  const [showBrandConfig, setShowBrandConfig] = React.useState(false);

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
    categoriesComplete: selectedTags.length > 0
  });

  const isOutputsLoading = isLoading.some(v => v);

  // --- Compact Sidebar (Essentialist / Intelligent) ---
  if (isCollapsed && hasAnalyzed) {
    return (
      <aside
        id="sidebar-compact"
        className={cn(
          "relative flex-shrink-0 bg-neutral-950/80 backdrop-blur-3xl border-r border-white/5",
          "h-full w-16 hidden lg:flex flex-col items-center py-8 gap-8 animate-in slide-in-from-left duration-300",
          isSurpriseMeMode && "border-brand-cyan/20 ring-1 ring-brand-cyan/5"
        )}
      >
        {/* Thumb Reference */}
        <div className="group relative w-11 h-11 rounded-2xl overflow-hidden border border-white/10 hover:border-brand-cyan/40 transition-all cursor-pointer shadow-lg shadow-black/20">
          {uploadedImage?.url ? (
            <img src={uploadedImage.url} alt="Ref" className="w-full h-full object-cover" />
          ) : uploadedImage?.base64 ? (
            <img src={uploadedImage.base64} alt="Ref" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center">
              <Pickaxe size={14} className="text-neutral-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Scan size={14} className="text-white" />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-7">
          {/* Surprise Me Icon */}
          <button
            onClick={() => onSurpriseMe(true)}
            disabled={isGeneratingPrompt || isOutputsLoading}
            className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center transition-all group relative",
              isSurpriseMeMode
                ? "bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan shadow-[0_0_15px_rgba(var(--brand-cyan-rgb),0.1)]"
                : "text-neutral-500 hover:text-white border border-transparent hover:bg-white/5"
            )}
            title="Surprise Me"
          >
            <Dices size={20} className={cn("transition-transform", isGeneratingPrompt && "animate-spin")} />
          </button>

          {/* Generate Icon (Core Action) */}
          <button
            onClick={onGenerateClick}
            disabled={isOutputsLoading}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative group overflow-visible",
              isOutputsLoading
                ? "bg-neutral-800 text-neutral-600 border border-white/5"
                : isPromptReady
                  ? "bg-brand-cyan text-black hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(var(--brand-cyan-rgb),0.25)] ring-2 ring-brand-cyan/20 ring-offset-2 ring-offset-black"
                  : "bg-neutral-900 text-neutral-500 hover:text-white border border-white/5 hover:bg-neutral-800"
            )}
            title="Generate Outputs"
          >
            {isOutputsLoading ? (
              <div className="w-2 h-2 rounded-full bg-brand-cyan animate-ping" />
            ) : (
              <Pickaxe size={22} className={cn(isPromptReady ? "fill-current" : "")} />
            )}

            {/* Visual state indicator */}
            {isPromptReady && !isOutputsLoading && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-cyan rounded-full border-2 border-black animate-pulse shadow-[0_0_10px_rgba(var(--brand-cyan-rgb),0.5)]" />
            )}
          </button>

          {/* Start Over Button */}
          <button
            onClick={onStartOver}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-700 hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/20 transition-all outline-none"
            title="Start Over"
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
          "relative flex-shrink-0 bg-sidebar text-sidebar-foreground overflow-y-auto overflow-x-hidden overscroll-contain min-h-0 z-10 transition-all duration-300 custom-scrollbar",
          "max-h-auto",
          "p-3 sm:p-4 md:p-6 lg:p-8",
          "w-full", // Base width
          !hasAnalyzed ? [
            "rounded-md",
            isSurpriseMeMode
              ? "border border-brand-cyan/40 border-dashed shadow-[0_0_25px_rgba(0,210,255,0.08)] animate-pool-border-glow"
              : "border-none shadow-none",
            "max-w-4xl mx-auto", // Full width for Step 1
            "min-w-0"
          ] : [
            "max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl", // Sidebar panel state for Step 2
            "h-full px-4 lg:px-6 py-10",
            isSurpriseMeMode
              ? "border-l border-brand-cyan/70 border-dashed shadow-[-10px_0_30px_rgba(0,210,255,0.05)]"
              : "",
            "lg:w-auto"
          ]
        )}
        style={{
          paddingBottom: '20px',
          scrollbarGutter: 'stable',
          ...(hasAnalyzed && isLargeScreen ? { width: `${sidebarWidth}px` } : {})
        }}
      >
        {hasAnalyzed && (
          <div className="sticky top-0 z-[11] pb-6 bg-transparent flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-brand-cyan shadow-[0_0_10px_rgba(var(--brand-cyan-rgb),0.5)] animate-pulse" />
            </div>

            <button
              onClick={() => setShowBrandConfig(!showBrandConfig)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 group relative",
                showBrandConfig
                  ? "bg-brand-cyan/20 border-brand-cyan/50 text-brand-cyan shadow-[0_0_15px_rgba(var(--brand-cyan-rgb),0.15)]"
                  : "bg-neutral-900/50 border-white/5 text-neutral-600 hover:text-neutral-400 hover:border-white/10",
                selectedBrandGuideline && !showBrandConfig && "border-brand-cyan/20 text-neutral-400"
              )}
            >
              <Gem size={14} className={cn("transition-transform group-hover:scale-110", (showBrandConfig || selectedBrandGuideline) && "fill-current text-brand-cyan")} />
              <span className="text-[10px] font-bold font-mono tracking-widest uppercase">MARCA</span>
              {selectedBrandGuideline && !showBrandConfig && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-brand-cyan rounded-full shadow-[0_0_10px_rgba(var(--brand-cyan-rgb),0.6)]" />
              )}
            </button>
          </div>
        )}

        <div className="space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">
          {!hasAnalyzed ? (
            <div className="h-auto justify-center animate-fade-in">
              <SidebarSetupSection
                onImageUpload={onImageUpload}
                onReferenceImagesChange={onReferenceImagesChange}
                onStartOver={onStartOver}
                onDesignTypeChange={onDesignTypeChange}
                onAnalyze={onAnalyze}
              />
            </div>
          ) : (
            mode === 'essential' ? (
              <EssentialSidebar
                onSurpriseMe={onSurpriseMe}
                onGenerateSmartPrompt={onGenerateSmartPrompt}
                onGenerateOutputs={onGenerateClick}
                onSwitchToExpert={() => setMode('expert')}
                isGeneratingPrompt={isGeneratingPrompt}
                isGeneratingOutputs={isOutputsLoading}
                isDiceAnimating={false}
                isSurpriseMeActive={isSurpriseMeMode}
                authenticationRequiredMessage={authenticationRequiredMessage}
                generateOutputsButtonRef={generateOutputsButtonRef}
                showBrandConfig={showBrandConfig}
                isPromptReady={isPromptReady}
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
            )
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
          <div className="w-px h-auto mx-auto bg-sidebar-border group-hover:bg-brand-cyan/50 dark:group-hover:bg-brand-cyan/50 transition-colors duration-200"></div>
        </div>
      )}
    </>
  );
};
