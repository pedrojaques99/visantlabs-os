import React, { useRef, useState, useEffect, useMemo } from 'react';
import { RotateCcw, Lock, X, Dices, RefreshCcw, FileText, Settings, Wand2, ScanEye } from 'lucide-react';
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
import { Button } from './ui/button';
import { getCreditsRequired } from '../utils/creditCalculator';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import type { UploadedImage, DesignType, AspectRatio, GeminiModel, Resolution } from '../types';
import type { SubscriptionStatus } from '../services/subscriptionService';
import { useMockup } from './mockupmachine/MockupContext';
import { useMockupTags } from '../hooks/useMockupTags';
import { useLayout } from '../hooks/useLayout';
import {
  AVAILABLE_BRANDING_TAGS,
  AVAILABLE_TAGS,
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS
} from '../utils/mockupConstants';

interface SidebarOrchestratorProps {
  // Layout props
  sidebarWidth: number;
  sidebarRef: React.RefObject<HTMLElement>;
  onSidebarWidthChange: (width: number) => void;
  onCloseMobile?: () => void;
  generateOutputsButtonRef: React.RefObject<HTMLButtonElement>;

  // External Logic / Triggers
  onSurpriseMe: (autoGenerate: boolean) => void;
  onOpenSurpriseMeSettings?: () => void;
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
  onAnalyze: () => void; // New prop

  // Specific UI props
  authenticationRequiredMessage: string;
}

export const SidebarOrchestrator: React.FC<SidebarOrchestratorProps> = ({
  sidebarWidth,
  sidebarRef,
  onSidebarWidthChange,
  onCloseMobile,
  onSurpriseMe,
  onOpenSurpriseMeSettings,
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
  const { subscriptionStatus, isAuthenticated } = useLayout();

  const {
    uploadedImage,
    referenceImage,
    referenceImages,
    designType,
    isImagelessMode,
    selectedModel,
    resolution,
    setSelectedModel,
    setResolution,
    selectedBrandingTags,
    customBrandingInput,
    setCustomBrandingInput,
    suggestedTags,
    selectedTags,
    isAnalyzing,
    isAllCategoriesOpen,
    setIsAllCategoriesOpen,
    customCategoryInput,
    setCustomCategoryInput,
    isAdvancedOpen,
    setIsAdvancedOpen,
    selectedLocationTags,
    selectedAngleTags,
    selectedLightingTags,
    selectedEffectTags,
    selectedMaterialTags,
    selectedColors,
    colorInput,
    isValidColor,
    suggestedBrandingTags,
    suggestedLocationTags,
    suggestedAngleTags,
    suggestedLightingTags,
    suggestedEffectTags,
    suggestedMaterialTags,
    suggestedColors: suggestedColorsFromAnalysis,
    negativePrompt,
    setNegativePrompt,
    additionalPrompt,
    setAdditionalPrompt,
    aspectRatio,
    setAspectRatio,
    mockupCount,
    setMockupCount,
    generateText,
    setGenerateText,
    withHuman,
    setWithHuman,
    enhanceTexture,
    setEnhanceTexture,
    promptPreview,
    setPromptPreview,
    promptSuggestions,
    isSuggestingPrompts,
    mockups,
    isSmartPromptActive,
    setIsSmartPromptActive,
    setIsPromptManuallyEdited,
    hasGenerated,
    resetAll,
    setColorInput,
    setIsValidColor,
    setSelectedColors,
    setCustomLocationInput,
    setCustomAngleInput,
    setCustomLightingInput,
    setCustomEffectInput,
    setCustomMaterialInput,
    customLocationInput,
    customAngleInput,
    customLightingInput,
    customEffectInput,
    customMaterialInput,
    isPromptReady,
    setIsPromptReady,
    isGeneratingPrompt,
    isLoading,
    hasAnalyzed
  } = useMockup();

  const {
    handleTagToggle,
    handleBrandingTagToggle,
    handleLocationTagToggle,
    handleAngleTagToggle,
    handleLightingTagToggle,
    handleEffectTagToggle,
    handleMaterialTagToggle,
    handleAddCustomBrandingTag,
    handleAddCustomCategoryTag,
    handleRandomizeCategories,
    handleAddCustomLocationTag,
    handleAddCustomAngleTag,
    handleAddCustomLightingTag,
    handleAddCustomEffectTag,
    handleAddCustomMaterialTag,
    scrollToSection
  } = useMockupTags();

  // Helper values
  const designTypeSelected = !!designType;
  const brandingComplete = selectedBrandingTags.length > 0;
  const categoriesComplete = selectedTags.length > 0;
  const hasReferenceImage = !!referenceImage || referenceImages.length > 0;

  const displayBrandingTags = useMemo(() => [...new Set([...AVAILABLE_BRANDING_TAGS, ...selectedBrandingTags])], [selectedBrandingTags]);
  const displaySuggestedTags = useMemo(() => [...new Set([...suggestedTags, ...selectedTags])], [suggestedTags, selectedTags]);
  const displayAvailableCategoryTags = useMemo(() => [...new Set([...AVAILABLE_TAGS, ...selectedTags])], [selectedTags]);
  const displayLocationTags = useMemo(() => [...new Set([...AVAILABLE_LOCATION_TAGS, ...selectedLocationTags])], [selectedLocationTags]);
  const displayAngleTags = useMemo(() => [...new Set([...AVAILABLE_ANGLE_TAGS, ...selectedAngleTags])], [selectedAngleTags]);
  const displayLightingTags = useMemo(() => [...new Set([...AVAILABLE_LIGHTING_TAGS, ...selectedLightingTags])], [selectedLightingTags]);
  const displayEffectTags = useMemo(() => [...new Set([...AVAILABLE_EFFECT_TAGS, ...selectedEffectTags])], [selectedEffectTags]);
  const displayMaterialTags = useMemo(() => [...new Set([...AVAILABLE_MATERIAL_TAGS, ...selectedMaterialTags])], [selectedMaterialTags]);

  const shouldCollapseSections = hasReferenceImage && uploadedImage !== null && designType !== 'blank';

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value.trim();
    setColorInput(newColor);
    setIsValidColor(/^#([0-9A-F]{3}){1,2}$/i.test(newColor));
  };

  const handleAddColor = () => {
    const sanitizedColor = colorInput.trim().toUpperCase();
    if (isValidColor && !selectedColors.includes(sanitizedColor) && selectedColors.length < 5) {
      setSelectedColors([...selectedColors, sanitizedColor]);
      setColorInput('');
      setIsValidColor(false);
    }
  };

  const handleRemoveColor = (colorToRemove: string) => {
    setSelectedColors(selectedColors.filter(color => color !== colorToRemove));
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setPromptPreview(newValue);
    if (isSmartPromptActive) {
      setIsSmartPromptActive(false);
    }
    setIsPromptManuallyEdited(true);
    if (newValue.trim().length > 0 && isPromptReady) {
      setIsPromptReady(true);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPromptPreview(suggestion);
    if (isSmartPromptActive) setIsSmartPromptActive(false);
    setIsPromptManuallyEdited(false);
  };

  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [hasScrolledToBranding, setHasScrolledToBranding] = useState(false);
  const [hasScrolledToCategories, setHasScrolledToCategories] = useState(false);
  const [hasScrolledToRefine, setHasScrolledToRefine] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [isDiceAnimating, setIsDiceAnimating] = useState(false);

  const isGenerating = isLoading.some(l => l);
  const isGenerateDisabled = !selectedModel || isGenerating || isGeneratingPrompt || !designTypeSelected;

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
        className={`relative flex-shrink-0 bg-sidebar text-sidebar-foreground overflow-y-auto z-10 ${!hasGenerated
          ? 'p-3 sm:p-4 md:p-6 lg:p-8 pb-24 sm:pb-28 md:pb-32 rounded-md border border-sidebar-border/5 w-full max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto'
          : 'p-3 sm:p-4 md:p-6 lg:p-8 pb-24 sm:pb-28 md:pb-32 lg:pb-16 border-r border-sidebar-border/5 w-full lg:w-auto max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl h-full'
          }`}
        style={hasGenerated && isLargeScreen ? { width: `${sidebarWidth}px` } : {}}
      >
        {/* Close button - always visible on all screen sizes */}
        {onCloseMobile && (
          <Button
            onClick={onCloseMobile}
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-20 text-muted-foreground hover:text-brand-cyan hover:bg-sidebar-accent"
            aria-label={t('mockup.closeSidebar')}
            title={t('mockup.closeSidebar')}
          >
            <X size={18} />
          </Button>
        )}
        <div className="space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">
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


          {selectedModel && (
            <>
              {selectedModel === 'gemini-3-pro-image-preview' && (
                <AspectRatioSection
                  aspectRatio={aspectRatio}
                  onAspectRatioChange={setAspectRatio}
                  selectedModel={selectedModel}
                />
              )}
            </>
          )}

          {/* Show sections when design type is selected OR when reference images are present OR when image is uploaded */}
          {(designTypeSelected || hasReferenceImage || (uploadedImage && !isImagelessMode)) && (
            <div className="space-y-8 animate-fade-in">
              {/* Hide BrandingSection when reference images are present */}
              {/* Show branding when design type is selected OR when we have an uploaded image (pre-analysis) */}
              {(designTypeSelected || (uploadedImage && !isImagelessMode)) && (
                <BrandingSection
                  tags={displayBrandingTags}
                  selectedTags={selectedBrandingTags}
                  suggestedTags={suggestedBrandingTags}
                  onTagToggle={handleBrandingTagToggle}
                  customInput={customBrandingInput}
                  onCustomInputChange={setCustomBrandingInput}
                  onAddCustomTag={handleAddCustomBrandingTag}
                  isComplete={brandingComplete}
                />
              )}

              {/* Analyze Button - Show only when uploaded image exists and not yet analyzed */}
              {uploadedImage && !hasAnalyzed && !isImagelessMode && (
                <div className="flex justify-center py-4 animate-fade-in">
                  <Button
                    onClick={onAnalyze}
                    disabled={isAnalyzing}
                    className="bg-brand-cyan text-black hover:bg-brand-cyan/90 font-semibold px-8 py-6 rounded-xl shadow-lg hover:shadow-brand-cyan/20 transition-all active:scale-95"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCcw className="mr-2 h-5 w-5 animate-spin" />
                        {t('common.analyzing')}
                      </>
                    ) : (
                      <>
                        <ScanEye className="mr-2 h-5 w-5" />
                        {t('mockup.analyzeImage')}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Show QuickActionsBar when design type is selected OR has uploaded image, AND analyzed */}
              {(designTypeSelected || (uploadedImage && !isImagelessMode)) && hasAnalyzed && (
                <QuickActionsBar
                  onSurpriseMe={handleSurpriseMe}
                  isGenerating={isGenerating}
                  isGeneratingPrompt={isGeneratingPrompt}
                  autoGenerate={autoGenerate}
                  onAutoGenerateChange={setAutoGenerate}
                  onOpenSurpriseMeSettings={onOpenSurpriseMeSettings}
                />
              )}

              {/* Show CategoriesSection when design type is selected OR has uploaded image */}
              {(designTypeSelected || (uploadedImage && !isImagelessMode)) && (
                <CategoriesSection
                  suggestedTags={suggestedTags}
                  availableTags={displayAvailableCategoryTags}
                  selectedTags={selectedTags}
                  onTagToggle={handleTagToggle}
                  isAnalyzing={isAnalyzing}
                  isAllCategoriesOpen={isAllCategoriesOpen}
                  onToggleAllCategories={() => setIsAllCategoriesOpen(!isAllCategoriesOpen)}
                  customInput={customCategoryInput}
                  onCustomInputChange={setCustomCategoryInput}
                  onAddCustomTag={handleAddCustomCategoryTag}
                  onRandomize={handleRandomizeCategories}
                  isComplete={categoriesComplete}
                  displaySuggestedTags={displaySuggestedTags}
                />
              )}

              {/* Show refine section and below immediately when design type is selected OR when reference images are present OR uploaded image */}
              {(designTypeSelected || hasReferenceImage || (uploadedImage && !isImagelessMode)) && (
                <div id="refine-section" className="space-y-8 animate-fade-in">
                  {/* Show RefineSection always - including when reference images are present */}
                  <RefineSection
                    isAdvancedOpen={isAdvancedOpen}
                    onToggleAdvanced={() => setIsAdvancedOpen(!isAdvancedOpen)}
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
                      onLocationTagToggle: handleLocationTagToggle,
                      onAngleTagToggle: handleAngleTagToggle,
                      onLightingTagToggle: handleLightingTagToggle,
                      onEffectTagToggle: handleEffectTagToggle,
                      onMaterialTagToggle: handleMaterialTagToggle,
                      onColorInputChange: handleColorInputChange,
                      onAddColor: handleAddColor,
                      onRemoveColor: handleRemoveColor,
                      onNegativePromptChange: (e) => setNegativePrompt(e.target.value),
                      onAdditionalPromptChange: (e) => setAdditionalPrompt(e.target.value),
                      availableLocationTags: displayLocationTags,
                      availableAngleTags: displayAngleTags,
                      availableLightingTags: displayLightingTags,
                      availableEffectTags: displayEffectTags,
                      availableMaterialTags: displayMaterialTags,
                      customLocationInput,
                      customAngleInput,
                      customLightingInput,
                      customEffectInput,
                      customMaterialInput,
                      onCustomLocationInputChange: setCustomLocationInput,
                      onCustomAngleInputChange: setCustomAngleInput,
                      onCustomLightingInputChange: setCustomLightingInput,
                      onCustomEffectInputChange: setCustomEffectInput,
                      onCustomMaterialInputChange: setCustomMaterialInput,
                      onAddCustomLocationTag: handleAddCustomLocationTag,
                      onAddCustomAngleTag: handleAddCustomAngleTag,
                      onAddCustomLightingTag: handleAddCustomLightingTag,
                      onAddCustomEffectTag: handleAddCustomEffectTag,
                      onAddCustomMaterialTag: handleAddCustomMaterialTag,
                      designType,
                      suggestedLocationTags,
                      suggestedAngleTags,
                      suggestedLightingTags,
                      suggestedEffectTags,
                      suggestedMaterialTags,
                      suggestedColors: suggestedColorsFromAnalysis
                    }}
                  />

                  {/* Model Selection - after advanced controls, before output config */}
                  {(uploadedImage || isImagelessMode || referenceImage) && (
                    <div className="mt-8">
                      <ModelSelectionSection
                        selectedModel={selectedModel}
                        onModelChange={setSelectedModel}
                        designType={designType}
                      />
                    </div>
                  )}

                  <OutputConfigSection
                    mockupCount={mockupCount}
                    onMockupCountChange={setMockupCount}
                    generateText={generateText}
                    onGenerateTextChange={setGenerateText}
                    withHuman={withHuman}
                    onWithHumanChange={setWithHuman}
                    enhanceTexture={enhanceTexture}
                    onEnhanceTextureChange={setEnhanceTexture}
                    designType={designType}
                    selectedModel={selectedModel}
                    resolution={resolution}
                    onResolutionChange={setResolution}
                  />

                  {/* Show PromptSection always */}
                  <PromptSection
                    promptPreview={promptPreview}
                    onPromptChange={handlePromptChange}
                    promptSuggestions={promptSuggestions}
                    isGeneratingPrompt={isGeneratingPrompt}
                    isSuggestingPrompts={isSuggestingPrompts}
                    isGenerating={isGenerating}
                    hasGenerated={hasGenerated}
                    mockups={mockups}
                    onSuggestPrompts={onSuggestPrompts}
                    onGenerateSmartPrompt={onGenerateSmartPrompt}
                    onSimplify={onSimplify}
                    onRegenerate={onRegenerate}
                    onSuggestionClick={handleSuggestionClick}
                    isSmartPromptActive={isSmartPromptActive}
                    setIsSmartPromptActive={setIsSmartPromptActive}
                    setIsPromptManuallyEdited={setIsPromptManuallyEdited}
                    creditsPerGeneration={creditsPerGeneration}
                    onGenerateSuggestion={onGenerateSuggestion}
                    isGenerateDisabled={isGenerateDisabled}
                  />

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
                        <Button
                          onClick={onRegenerate}
                          disabled={isGenerating || !promptPreview.trim() || isGenerateDisabled}
                          variant="sidebarAction"
                          size="sidebar"
                          className="justify-center"
                          aria-label={t('mockup.regenerate')}
                          title={t('mockup.regenerateTooltip')}
                        >
                          {isGenerating ? <RefreshCcw size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
                        </Button>
                      )}
                      {hasAnalyzed && (
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={handleSurpriseMe}
                            disabled={isGenerating || isGeneratingPrompt}
                            variant="sidebarAction"
                            size="sidebar"
                            className={cn("flex-1 justify-center", isDiceAnimating && 'dice-button-clicked')}
                            aria-label={t('mockup.surpriseMe')}
                            title={t('mockup.surpriseMeTooltip')}
                          >
                            <Dices size={18} className={isDiceAnimating ? 'dice-icon-animate' : ''} />
                          </Button>
                          {onOpenSurpriseMeSettings && (
                            <Button
                              onClick={onOpenSurpriseMeSettings}
                              disabled={isGenerating || isGeneratingPrompt}
                              variant="sidebarAction"
                              size="sidebar"
                              className="w-[48px] justify-center"
                              aria-label={t('mockup.surpriseMeSettings')}
                              title={t('mockup.surpriseMeSettingsTooltip')}
                            >
                              <Settings size={18} />
                            </Button>
                          )}
                        </div>
                      )}
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
                    <Button
                      onClick={resetAll}
                      variant="ghost"
                      size="sm"
                      className="w-auto gap-1.5 text-zinc-500 hover:text-zinc-400 text-[10px] font-mono opacity-60 hover:opacity-100"
                      aria-label={t('mockup.clearAll')}
                    >
                      <RotateCcw size={12} />
                      <span>{t('mockup.clearAll')}</span>
                    </Button>
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
          <div className="w-px h-full mx-auto bg-sidebar-border group-hover:bg-brand-cyan/50 dark:group-hover:bg-brand-cyan/50 transition-colors duration-200"></div>
        </div>
      )}
    </>
  );
};

