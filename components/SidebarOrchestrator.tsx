import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Lock, X, Dices, RefreshCcw, FileText, Settings } from 'lucide-react';
import { InputSection } from './ui/InputSection';
import { DesignTypeSection } from './mockupmachine/DesignTypeSection';
import { QuickActionsBar } from './ui/QuickActionsBar';
import { BrandingSection } from './branding/BrandingSection';
import { CategoriesSection } from './mockupmachine/CategoriesSection';
import { RefineSection } from './mockupmachine/RefineSection';
import { OutputConfigSection } from './mockupmachine/OutputConfigSection';
import { PromptSection } from './mockupmachine/PromptSection';
import { GenerateButton } from './ui/GenerateButton';
import { ModelSelectionSection } from './mockupmachine/ModelSelectionSection';
import { AspectRatioSection } from './mockupmachine/AspectRatioSection';
import { PillButton } from './ui/pill-button';
import { getCreditsRequired } from '../utils/creditCalculator';
import { useTranslation } from '../hooks/useTranslation';
import type { UploadedImage, DesignType, AspectRatio, GeminiModel, Resolution } from '../types';
import type { SubscriptionStatus } from '../services/subscriptionService';

interface SidebarOrchestratorProps {
  // Layout props
  hasGenerated: boolean;
  sidebarWidth: number;
  sidebarRef: React.RefObject<HTMLElement>;
  onSidebarWidthChange: (width: number) => void;
  onCloseMobile?: () => void;

  // Subscription
  subscriptionStatus: SubscriptionStatus | null;

  // Input
  uploadedImage: UploadedImage | null;
  referenceImage: UploadedImage | null;
  referenceImages: UploadedImage[];
  designType: DesignType | null;
  isImagelessMode: boolean;
  onImageUpload: (image: UploadedImage) => void;
  onReferenceImagesChange: (images: UploadedImage[]) => void;
  onStartOver: () => void;
  onDesignTypeChange: (type: DesignType) => void;
  onScrollToSection: (sectionId: string) => void;

  // Model Selection
  selectedModel: GeminiModel | null;
  resolution: Resolution;
  onModelChange: (model: GeminiModel) => void;
  onResolutionChange: (resolution: Resolution) => void;

  // Quick Actions
  onSurpriseMe: (autoGenerate: boolean) => void;
  onOpenSurpriseMeSettings?: () => void;
  isGenerating: boolean;
  isGeneratingPrompt: boolean;

  // Branding
  displayBrandingTags: string[];
  selectedBrandingTags: string[];
  onBrandingTagToggle: (tag: string) => void;
  customBrandingInput: string;
  onCustomBrandingInputChange: (value: string) => void;
  onAddCustomBrandingTag: () => void;
  brandingComplete: boolean;

  // Categories
  suggestedTags: string[];
  displayAvailableCategoryTags: string[];
  displaySuggestedTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  isAnalyzing: boolean;
  isAllCategoriesOpen: boolean;
  onToggleAllCategories: () => void;
  customCategoryInput: string;
  onCustomCategoryInputChange: (value: string) => void;
  onAddCustomCategoryTag: () => void;
  onRandomizeCategories: () => void;
  categoriesComplete: boolean;

  // Advanced Options
  isAdvancedOpen: boolean;
  onToggleAdvanced: () => void;
  selectedLocationTags: string[];
  selectedAngleTags: string[];
  selectedLightingTags: string[];
  selectedEffectTags: string[];
  selectedMaterialTags: string[];
  selectedColors: string[];
  colorInput: string;
  isValidColor: boolean;
  negativePrompt: string;
  additionalPrompt: string;
  onLocationTagToggle: (tag: string) => void;
  onAngleTagToggle: (tag: string) => void;
  onLightingTagToggle: (tag: string) => void;
  onEffectTagToggle: (tag: string) => void;
  onMaterialTagToggle: (tag: string) => void;
  onColorInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddColor: () => void;
  onRemoveColor: (color: string) => void;
  onNegativePromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onAdditionalPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  availableLocationTags: string[];
  availableAngleTags: string[];
  availableLightingTags: string[];
  availableEffectTags: string[];
  availableMaterialTags: string[];
  customLocationInput: string;
  customAngleInput: string;
  customLightingInput: string;
  customEffectInput: string;
  customMaterialInput: string;
  onCustomLocationInputChange: (value: string) => void;
  onCustomAngleInputChange: (value: string) => void;
  onCustomLightingInputChange: (value: string) => void;
  onCustomEffectInputChange: (value: string) => void;
  onCustomMaterialInputChange: (value: string) => void;
  onAddCustomLocationTag: () => void;
  onAddCustomAngleTag: () => void;
  onAddCustomLightingTag: () => void;
  onAddCustomEffectTag: () => void;
  onAddCustomMaterialTag: () => void;

  // Aspect Ratio
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;

  // Output Config
  mockupCount: number;
  onMockupCountChange: (count: number) => void;
  generateText: boolean;
  onGenerateTextChange: (value: boolean) => void;
  withHuman: boolean;
  onWithHumanChange: (value: boolean) => void;
  enhanceTexture: boolean;
  onEnhanceTextureChange: (value: boolean) => void;

  // Prompt
  promptPreview: string;
  onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  promptSuggestions: string[];
  isSuggestingPrompts: boolean;
  mockups: (string | null)[];
  onSuggestPrompts: () => void;
  onGenerateSmartPrompt: () => void;
  onSimplify: () => void;
  onRegenerate: () => void;
  onSuggestionClick: (suggestion: string) => void;
  isSmartPromptActive: boolean;
  setIsSmartPromptActive: (value: boolean) => void;
  setIsPromptManuallyEdited: (value: boolean) => void;

  // Generate Button
  onGenerateClick: () => void;
  isGenerateDisabled: boolean;
  isPromptReady: boolean;
  generateOutputsButtonRef: React.RefObject<HTMLButtonElement>;

  // Auth
  isAuthenticated: boolean | null;
  authenticationRequiredMessage: string;

  // Reset
  onResetControls: () => void;

  // Suggestion generation
  onGenerateSuggestion?: (suggestion: string) => void;

  // Blank mockup
  onBlankMockup?: () => void;
}

export const SidebarOrchestrator: React.FC<SidebarOrchestratorProps> = ({
  hasGenerated,
  sidebarWidth,
  sidebarRef,
  onSidebarWidthChange,
  onCloseMobile,
  subscriptionStatus,
  uploadedImage,
  referenceImage,
  referenceImages,
  designType,
  isImagelessMode,
  onImageUpload,
  onReferenceImagesChange,
  onStartOver,
  onDesignTypeChange,
  onScrollToSection,
  selectedModel,
  resolution,
  onModelChange,
  onResolutionChange,
  onSurpriseMe,
  onOpenSurpriseMeSettings,
  isGenerating,
  isGeneratingPrompt,
  displayBrandingTags,
  selectedBrandingTags,
  onBrandingTagToggle,
  customBrandingInput,
  onCustomBrandingInputChange,
  onAddCustomBrandingTag,
  brandingComplete,
  suggestedTags,
  displayAvailableCategoryTags,
  displaySuggestedTags,
  selectedTags,
  onTagToggle,
  isAnalyzing,
  isAllCategoriesOpen,
  onToggleAllCategories,
  customCategoryInput,
  onCustomCategoryInputChange,
  onAddCustomCategoryTag,
  onRandomizeCategories,
  categoriesComplete,
  isAdvancedOpen,
  onToggleAdvanced,
  selectedLocationTags,
  selectedAngleTags,
  selectedLightingTags,
  selectedEffectTags,
  selectedMaterialTags,
  selectedColors,
  colorInput,
  isValidColor,
  negativePrompt,
  additionalPrompt,
  onLocationTagToggle,
  onAngleTagToggle,
  onLightingTagToggle,
  onEffectTagToggle,
  onMaterialTagToggle,
  onColorInputChange,
  onAddColor,
  onRemoveColor,
  onNegativePromptChange,
  onAdditionalPromptChange,
  availableLocationTags,
  availableAngleTags,
  availableLightingTags,
  availableEffectTags,
  availableMaterialTags,
  customLocationInput,
  customAngleInput,
  customLightingInput,
  customEffectInput,
  customMaterialInput,
  onCustomLocationInputChange,
  onCustomAngleInputChange,
  onCustomLightingInputChange,
  onCustomEffectInputChange,
  onCustomMaterialInputChange,
  onAddCustomLocationTag,
  onAddCustomAngleTag,
  onAddCustomLightingTag,
  onAddCustomEffectTag,
  onAddCustomMaterialTag,
  aspectRatio,
  onAspectRatioChange,
  mockupCount,
  onMockupCountChange,
  generateText,
  onGenerateTextChange,
  withHuman,
  onWithHumanChange,
  enhanceTexture,
  onEnhanceTextureChange,
  promptPreview,
  onPromptChange,
  promptSuggestions,
  isSuggestingPrompts,
  hasGenerated: hasGeneratedForPrompt,
  mockups,
  onSuggestPrompts,
  onGenerateSmartPrompt,
  onSimplify,
  onRegenerate,
  onSuggestionClick,
  isSmartPromptActive,
  setIsSmartPromptActive,
  setIsPromptManuallyEdited,
  onGenerateClick,
  isGenerateDisabled,
  isPromptReady,
  generateOutputsButtonRef,
  isAuthenticated,
  authenticationRequiredMessage,
  onResetControls,
  onGenerateSuggestion,
  onBlankMockup
}) => {
  const { t } = useTranslation();
  const hasGeneratedForPromptSection = hasGeneratedForPrompt;
  const designTypeSelected = !!designType;
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [hasScrolledToBranding, setHasScrolledToBranding] = useState(false);
  const [hasScrolledToCategories, setHasScrolledToCategories] = useState(false);
  const [hasScrolledToRefine, setHasScrolledToRefine] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [isDiceAnimating, setIsDiceAnimating] = useState(false);

  // Check if reference images are present to determine if sections should be hidden
  const hasReferenceImage = referenceImage !== null || referenceImages.length > 0;
  const shouldCollapseSections = hasReferenceImage && uploadedImage !== null && designType !== 'blank';

  const handleSurpriseMe = () => {
    setIsDiceAnimating(true);
    onSurpriseMe(autoGenerate);

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

  // Check screen size for responsive width
  useEffect(() => {
    const checkScreenSize = () => {
      // Use lg breakpoint (1024px) for large screens where sidebar can be resized
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Setup resizer functionality
  const resizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasGenerated) return;
    if (!resizerRef.current || !sidebarRef.current) return;

    const resizer = resizerRef.current;
    const sidebar = sidebarRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = sidebar.offsetWidth;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const newWidth = startWidth + dx;
        // 30% maior: 380 * 1.3 = 494, 800 * 1.3 = 1040
        const minWidth = 494;
        const maxWidth = 1040;

        if (newWidth >= minWidth && newWidth <= maxWidth) {
          onSidebarWidthChange(newWidth);
        }
      };

      const handleMouseUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    resizer.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizer.removeEventListener('mousedown', handleMouseDown);
    };
  }, [hasGenerated, sidebarRef, onSidebarWidthChange]);

  // Auto-scroll to branding section when design type is selected
  useEffect(() => {
    if (designType && !hasScrolledToBranding && !hasGenerated) {
      setHasScrolledToBranding(true);
      setTimeout(() => {
        const brandingSection = document.getElementById('branding-section');
        const sidebar = document.getElementById('sidebar');
        if (brandingSection && sidebar) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const elementRect = brandingSection.getBoundingClientRect();
          const relativeTop = elementRect.top - sidebarRect.top + sidebar.scrollTop;

          sidebar.scrollTo({
            top: relativeTop - 20,
            behavior: 'smooth'
          });
        }
      }, 200);
    }
  }, [designType, hasScrolledToBranding, hasGenerated]);

  // Auto-scroll to categories section when branding is complete
  useEffect(() => {
    if (brandingComplete && !hasScrolledToCategories && !hasGenerated) {
      setHasScrolledToCategories(true);
      setTimeout(() => {
        const categoriesSection = document.getElementById('categories-section');
        const sidebar = document.getElementById('sidebar');
        if (categoriesSection && sidebar) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const elementRect = categoriesSection.getBoundingClientRect();
          const relativeTop = elementRect.top - sidebarRect.top + sidebar.scrollTop;

          sidebar.scrollTo({
            top: relativeTop - 20,
            behavior: 'smooth'
          });
        }
      }, 200);
    }
  }, [brandingComplete, hasScrolledToCategories, hasGenerated]);

  // Auto-scroll to refine section when categories are complete
  useEffect(() => {
    if (categoriesComplete && !hasScrolledToRefine && !hasGenerated) {
      setHasScrolledToRefine(true);
      setTimeout(() => {
        const refineSection = document.getElementById('refine-section');
        const sidebar = document.getElementById('sidebar');
        if (refineSection && sidebar) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const elementRect = refineSection.getBoundingClientRect();
          const relativeTop = elementRect.top - sidebarRect.top + sidebar.scrollTop;

          sidebar.scrollTo({
            top: relativeTop - 20,
            behavior: 'smooth'
          });
        }
      }, 200);
    }
  }, [categoriesComplete, hasScrolledToRefine, hasGenerated]);

  // Reset scroll states when values are reset
  useEffect(() => {
    if (!designType) {
      setHasScrolledToBranding(false);
    }
    if (!brandingComplete) {
      setHasScrolledToCategories(false);
    }
    if (!categoriesComplete) {
      setHasScrolledToRefine(false);
    }
  }, [designType, brandingComplete, categoriesComplete]);

  // Calculate credits required for main generation
  const creditsRequired = selectedModel && isPromptReady
    ? mockupCount * getCreditsRequired(selectedModel, resolution)
    : undefined;

  // Calculate credits per generation for suggestions (single mockup per suggestion)
  const creditsPerGeneration = selectedModel
    ? getCreditsRequired(selectedModel, resolution)
    : undefined;

  return (
    <>
      <aside
        ref={sidebarRef}
        id="sidebar"
        className={`relative flex-shrink-0 bg-sidebar text-sidebar-foreground p-4 sm:p-6 md:p-8 overflow-y-auto pb-32 md:pb-16 z-10 ${!hasGenerated ? 'rounded-md border border-sidebar-border/5 w-full max-w-5xl lg:max-w-6xl mx-auto' : 'border-r border-sidebar-border/5 w-full lg:w-auto max-w-4xl lg:max-w-5xl h-full'}`}
        style={hasGenerated && isLargeScreen ? { width: `${sidebarWidth}px` } : {}}
      >
        {/* Close button for mobile when hasGenerated */}
        {hasGenerated && onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden absolute top-4 right-4 z-20 p-2 text-muted-foreground hover:text-[#52ddeb] hover:bg-sidebar-accent rounded-md transition-colors"
            aria-label={t('mockup.closeSidebar')}
            title={t('mockup.closeSidebar')}
          >
            <X size={18} />
          </button>
        )}
        <div className="space-y-4 md:space-y-8">
          <div
            className={`group ${(uploadedImage || referenceImage || referenceImages.length > 0) ? 'opacity-70 scale-[0.98] transition-all duration-300' : ''}`}
          >
            <InputSection
              uploadedImage={uploadedImage}
              referenceImage={referenceImage}
              referenceImages={referenceImages}
              designType={designType}
              selectedModel={selectedModel}
              onImageUpload={onImageUpload}
              onReferenceImagesChange={onReferenceImagesChange}
              onStartOver={onStartOver}
              isImagelessMode={isImagelessMode}
            />

            {/* Tip about image format - only show on hover */}
            {!uploadedImage && !referenceImage && referenceImages.length === 0 && !isImagelessMode && (
              <p className="text-[10px] font-mono text-zinc-500/70 text-center px-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-2">
                {t('mockup.imageFormatTip')}
              </p>
            )}
          </div>

          {/* Blank Mockup Button - only show when no image is uploaded */}
          {!uploadedImage && !referenceImage && referenceImages.length === 0 && !isImagelessMode && onBlankMockup && (
            <div className="flex justify-center">
              <PillButton
                onClick={onBlankMockup}
                disabled={isGenerating || isGeneratingPrompt}
                size="sm"
                variant="outlineDark"
                style={{ cursor: 'pointer' }}
              >
                <FileText size={14} />
                <span>{t('welcome.newBlankMockup')}</span>
              </PillButton>
            </div>
          )}

          {(uploadedImage || isImagelessMode || referenceImage) && (
            <div className={selectedModel ? 'opacity-70 scale-[0.98] transition-all duration-300' : ''}>
              <ModelSelectionSection
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                designType={designType}
              />
            </div>
          )}

          {selectedModel && (
            <>
              {/* Hide DesignTypeSection when reference images are present */}
              {!hasReferenceImage && (
                <div className={designTypeSelected ? 'opacity-70 scale-[0.98] transition-all duration-300' : ''}>
                  <DesignTypeSection
                    designType={designType}
                    onDesignTypeChange={onDesignTypeChange}
                    uploadedImage={uploadedImage}
                    isImagelessMode={isImagelessMode}
                    onScrollToSection={onScrollToSection}
                  />
                </div>
              )}

              {selectedModel === 'gemini-3-pro-image-preview' && (
                <AspectRatioSection
                  aspectRatio={aspectRatio}
                  onAspectRatioChange={onAspectRatioChange}
                  selectedModel={selectedModel}
                />
              )}
            </>
          )}

          {/* Show sections when design type is selected OR when reference images are present */}
          {(designTypeSelected || hasReferenceImage) && (
            <div className="space-y-8 animate-fade-in">
              {/* Hide BrandingSection when reference images are present */}
              {!shouldCollapseSections && designTypeSelected && (
                <div className={brandingComplete && categoriesComplete ? 'opacity-70 scale-[0.98] transition-all duration-300' : ''}>
                  <BrandingSection
                    tags={displayBrandingTags}
                    selectedTags={selectedBrandingTags}
                    onTagToggle={onBrandingTagToggle}
                    customInput={customBrandingInput}
                    onCustomInputChange={onCustomBrandingInputChange}
                    onAddCustomTag={onAddCustomBrandingTag}
                    isComplete={brandingComplete}
                  />
                </div>
              )}

              {/* Hide QuickActionsBar when reference images are present */}
              {!shouldCollapseSections && designTypeSelected && (
                <QuickActionsBar
                  onSurpriseMe={handleSurpriseMe}
                  isGenerating={isGenerating}
                  isGeneratingPrompt={isGeneratingPrompt}
                  autoGenerate={autoGenerate}
                  onAutoGenerateChange={setAutoGenerate}
                  onOpenSurpriseMeSettings={onOpenSurpriseMeSettings}
                />
              )}

              {/* Hide CategoriesSection when reference images are present */}
              {!shouldCollapseSections && brandingComplete && designTypeSelected && (
                <div className={categoriesComplete ? 'opacity-70 scale-[0.98] transition-all duration-300' : ''}>
                  <CategoriesSection
                    suggestedTags={suggestedTags}
                    availableTags={displayAvailableCategoryTags}
                    selectedTags={selectedTags}
                    onTagToggle={onTagToggle}
                    isAnalyzing={isAnalyzing}
                    isAllCategoriesOpen={isAllCategoriesOpen}
                    onToggleAllCategories={onToggleAllCategories}
                    customInput={customCategoryInput}
                    onCustomInputChange={onCustomCategoryInputChange}
                    onAddCustomTag={onAddCustomCategoryTag}
                    onRandomize={onRandomizeCategories}
                    isComplete={categoriesComplete}
                    displaySuggestedTags={displaySuggestedTags}
                  />
                </div>
              )}

              {/* Show refine section and below when categoriesComplete OR when reference images are present */}
              {(categoriesComplete || hasReferenceImage) && (
                <div id="refine-section" className="space-y-8 animate-fade-in">
                  {/* Show RefineSection always - including when reference images are present */}
                  <RefineSection
                    isAdvancedOpen={isAdvancedOpen}
                    onToggleAdvanced={onToggleAdvanced}
                    advancedOptionsProps={{
                      selectedLocationTags,
                      selectedAngleTags,
                      selectedLightingTags,
                      selectedEffectTags,
                      selectedMaterialTags,
                      selectedColors,
                      colorInput,
                      isValidColor,
                      negativePrompt,
                      additionalPrompt,
                      onLocationTagToggle,
                      onAngleTagToggle,
                      onLightingTagToggle,
                      onEffectTagToggle,
                      onMaterialTagToggle,
                      onColorInputChange,
                      onAddColor,
                      onRemoveColor,
                      onNegativePromptChange,
                      onAdditionalPromptChange,
                      availableLocationTags,
                      availableAngleTags,
                      availableLightingTags,
                      availableEffectTags,
                      availableMaterialTags,
                      customLocationInput,
                      customAngleInput,
                      customLightingInput,
                      customEffectInput,
                      customMaterialInput,
                      onCustomLocationInputChange,
                      onCustomAngleInputChange,
                      onCustomLightingInputChange,
                      onCustomEffectInputChange,
                      onCustomMaterialInputChange,
                      onAddCustomLocationTag,
                      onAddCustomAngleTag,
                      onAddCustomLightingTag,
                      onAddCustomEffectTag,
                      onAddCustomMaterialTag,
                      designType
                    }}
                  />

                  <OutputConfigSection
                    mockupCount={mockupCount}
                    onMockupCountChange={onMockupCountChange}
                    generateText={generateText}
                    onGenerateTextChange={onGenerateTextChange}
                    withHuman={withHuman}
                    onWithHumanChange={onWithHumanChange}
                    enhanceTexture={enhanceTexture}
                    onEnhanceTextureChange={onEnhanceTextureChange}
                    designType={designType}
                    selectedModel={selectedModel}
                    resolution={resolution}
                    onResolutionChange={onResolutionChange}
                  />

                  {/* Show PromptSection when categoriesComplete OR when reference images are present */}
                  {(categoriesComplete || shouldCollapseSections) && (
                    <PromptSection
                      promptPreview={promptPreview}
                      onPromptChange={onPromptChange}
                      promptSuggestions={promptSuggestions}
                      isGeneratingPrompt={isGeneratingPrompt}
                      isSuggestingPrompts={isSuggestingPrompts}
                      isGenerating={isGenerating}
                      hasGenerated={hasGeneratedForPromptSection}
                      mockups={mockups}
                      onSuggestPrompts={onSuggestPrompts}
                      onGenerateSmartPrompt={onGenerateSmartPrompt}
                      onSimplify={onSimplify}
                      onRegenerate={onRegenerate}
                      onSuggestionClick={onSuggestionClick}
                      isSmartPromptActive={isSmartPromptActive}
                      setIsSmartPromptActive={setIsSmartPromptActive}
                      setIsPromptManuallyEdited={setIsPromptManuallyEdited}
                      creditsPerGeneration={creditsPerGeneration}
                      onGenerateSuggestion={onGenerateSuggestion}
                      isGenerateDisabled={isGenerateDisabled}
                    />
                  )}

                  <div className="flex flex-col gap-2 mt-6">
                    <GenerateButton
                      onClick={onGenerateClick}
                      disabled={isGenerateDisabled || (isPromptReady && isGenerating)}
                      isGeneratingPrompt={isGeneratingPrompt}
                      isGenerating={isGenerating}
                      isPromptReady={isPromptReady}
                      variant="sidebar"
                      buttonRef={generateOutputsButtonRef}
                      creditsRequired={creditsRequired}
                    />
                    <div className={`grid gap-2 ${hasGenerated && mockups.some(m => m !== null) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {/* Show regenerate button only when hasGenerated and mockups have content */}
                      {hasGenerated && mockups.some(m => m !== null) && (
                        <button
                          onClick={onRegenerate}
                          disabled={isGenerating || !promptPreview.trim() || isGenerateDisabled}
                          className="flex items-center justify-center h-[48px] bg-zinc-800/50 hover:bg-[#52ddeb]/10 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-400 hover:text-[#52ddeb] border border-zinc-700/50 hover:border-[#52ddeb]/30 rounded-md transition-all duration-300 shadow-lg hover:shadow-[#52ddeb]/10 transform hover:scale-[1.02] active:scale-100 disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-[#52ddeb]/50 focus:ring-offset-2 focus:ring-offset-[#1A1A1A]"
                          aria-label={t('mockup.regenerate')}
                          title={t('mockup.regenerateTooltip')}
                        >
                          {isGenerating ? <RefreshCcw size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
                        </button>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSurpriseMe}
                          disabled={isGenerating || isGeneratingPrompt}
                          className={`flex-1 flex items-center justify-center h-[48px] bg-zinc-800/50 hover:bg-[#52ddeb]/10 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-400 hover:text-[#52ddeb] border border-zinc-700/50 hover:border-[#52ddeb]/30 rounded-md transition-all duration-300 shadow-lg hover:shadow-[#52ddeb]/10 transform hover:scale-[1.02] active:scale-100 disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-[#52ddeb]/50 focus:ring-offset-2 focus:ring-offset-[#1A1A1A] ${isDiceAnimating ? 'dice-button-clicked' : ''}`}
                          aria-label={t('mockup.surpriseMe')}
                          title={t('mockup.surpriseMeTooltip')}
                        >
                          <Dices size={18} className={isDiceAnimating ? 'dice-icon-animate' : ''} />
                        </button>
                        {onOpenSurpriseMeSettings && (
                          <button
                            onClick={onOpenSurpriseMeSettings}
                            disabled={isGenerating || isGeneratingPrompt}
                            className="flex items-center justify-center h-[48px] w-[48px] bg-zinc-800/50 hover:bg-[#52ddeb]/10 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-400 hover:text-[#52ddeb] border border-zinc-700/50 hover:border-[#52ddeb]/30 rounded-md transition-all duration-300 shadow-lg hover:shadow-[#52ddeb]/10 transform hover:scale-[1.02] active:scale-100 disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-[#52ddeb]/50 focus:ring-offset-2 focus:ring-offset-[#1A1A1A]"
                            aria-label={t('mockup.surpriseMeSettings')}
                            title={t('mockup.surpriseMeSettingsTooltip')}
                          >
                            <Settings size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {(() => {
                    // Only show alert if user is definitely not authenticated
                    // Check both isAuthenticated state and localStorage token
                    const hasToken = typeof window !== 'undefined' && localStorage.getItem('auth_token');
                    const shouldShowAlert = isAuthenticated === false && !hasToken;

                    return shouldShowAlert ? (
                      <div className="mt-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3">
                        <Lock size={16} className="text-red-400 mt-0.5" />
                        <p className="text-xs font-mono text-red-200">
                          {authenticationRequiredMessage}
                        </p>
                      </div>
                    ) : null;
                  })()}

                  <div className="flex justify-center mt-8 mb-4">
                    <button
                      onClick={onResetControls}
                      className="w-auto flex items-center justify-center gap-1.5 text-zinc-500 hover:text-zinc-400 rounded-md py-1.5 px-3 transition-all duration-200 text-[10px] font-mono opacity-60 hover:opacity-100"
                      aria-label={t('mockup.clearAll')}
                    >
                      <RotateCcw size={12} />
                      <span>{t('mockup.clearAll')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
      {/* Resizer - only show on large screens when hasGenerated */}
      {hasGenerated && isLargeScreen && (
        <div
          ref={resizerRef}
          id="sidebar-resizer"
          className="hidden lg:block flex-shrink-0 w-2 cursor-col-resize group"
        >
          <div className="w-px h-full mx-auto bg-sidebar-border group-hover:bg-[#52ddeb]/50 dark:group-hover:bg-[#52ddeb]/50 transition-colors duration-200"></div>
        </div>
      )}
    </>
  );
};

