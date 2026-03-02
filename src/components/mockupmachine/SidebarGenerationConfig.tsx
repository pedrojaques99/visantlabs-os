import React, { useEffect, useMemo, useState } from 'react';
import { Lock, ChevronDown, ChevronUp, Settings2, Check } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { CategoriesSection } from './CategoriesSection';
import { RefineSection } from './RefineSection';
import { OutputConfigSection } from './OutputConfigSection';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { useMockup } from './MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';
import { SurpriseMeSelectedTagsDisplay } from './SurpriseMeSelectedTagsDisplay';
import { AnalyzedSummaryCard } from './AnalyzedSummaryCard';
import type { UploadedImage } from '@/types/types';
import { SurpriseMeControl } from './SurpriseMeControl';
import { SkeletonText } from '@/components/ui/SkeletonLoader';

interface SidebarGenerationConfigProps {
    onGenerateClick: () => void;
    onRegenerate: () => void;
    onSurpriseMe: (autoGenerate: boolean) => void; /* Original handler from props */
    handleSurpriseMe: (autoGenerate?: boolean) => void; /* The wrapper function */
    onSuggestPrompts: () => void;
    onGenerateSmartPrompt: () => void;
    onSimplify: () => void;
    onGenerateSuggestion: (suggestion: string) => void;
    generateOutputsButtonRef: React.RefObject<HTMLButtonElement>;
    isDiceAnimating: boolean;
    onStartOver: () => void;
    onReplaceImage?: (image: UploadedImage) => void;
    onReferenceImagesChange: (images: UploadedImage[]) => void;
    authenticationRequiredMessage: string;
}

export const SidebarGenerationConfig: React.FC<SidebarGenerationConfigProps> = ({
    onGenerateClick,
    onRegenerate,
    handleSurpriseMe,
    onSuggestPrompts,
    onGenerateSmartPrompt,
    onSimplify,
    onGenerateSuggestion,
    generateOutputsButtonRef,
    isDiceAnimating,
    onReplaceImage,
    onReferenceImagesChange,
    authenticationRequiredMessage,
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();

    const {
        selectedModel,
        setSelectedModel,
        designType,
        setDesignType,
        mockupCount,
        setMockupCount,
        generateText,
        setGenerateText,
        withHuman,
        setWithHuman,
        enhanceTexture,
        setEnhanceTexture,
        removeText,
        setRemoveText,
        resolution,
        setResolution,
        promptPreview,
        setPromptPreview,
        isSmartPromptActive,
        setIsSmartPromptActive,
        setIsPromptManuallyEdited,
        isPromptReady,
        setIsPromptReady,
        isGeneratingPrompt,
        isLoading,
        hasGenerated,
        mockups,
        resetAll,
        uploadedImage,
        selectedBrandingTags,
        referenceImages,
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
        setColorInput,
        isValidColor,
        setIsValidColor,
        setSelectedColors,
        suggestedTags,
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
        customBrandingInput,
        setCustomBrandingInput,
        customLocationInput,
        customAngleInput,
        customLightingInput,
        customEffectInput,
        customMaterialInput,
        setCustomLocationInput,
        setCustomAngleInput,
        setCustomLightingInput,
        setCustomEffectInput,
        setCustomMaterialInput,
        isSurpriseMeMode,
        setIsSurpriseMeMode,
        surpriseMePool,
        setSurpriseMePool,
        promptSuggestions,
        isSuggestingPrompts,
        aspectRatio,
        setAspectRatio,
        imageProvider,
        setImageProvider,
    } = useMockup();

    const [isAdvancedOptionsOpen, setIsAdvancedOptionsOpen] = useState(isSurpriseMeMode);

    // Open advanced options automatically when entering pool mode
    useEffect(() => {
        if (isSurpriseMeMode) {
            setIsAdvancedOptionsOpen(true);
        }
    }, [isSurpriseMeMode]);

    const {
        handleBrandingTagToggle,
        handleAddCustomBrandingTag,
        availableBrandingTags,
        handleTagToggle,
        handleAddCustomCategoryTag,
        handleRandomizeCategories,
        handleLocationTagToggle,
        handleAngleTagToggle,
        handleLightingTagToggle,
        handleEffectTagToggle,
        handleMaterialTagToggle,
        handleAddCustomLocationTag,
        handleAddCustomAngleTag,
        handleAddCustomLightingTag,
        handleAddCustomEffectTag,
        handleAddCustomMaterialTag,
        availableMockupTags,
        availableLocationTags,
        availableAngleTags,
        availableLightingTags,
        availableEffectTags,
        availableMaterialTags,
        tagCategories,
        mockupPresets,
        togglePoolTag,
    } = useMockupTags();

    // Helper values
    const designTypeSelected = !!designType;
    const categoriesComplete = selectedTags.length > 0;
    const isGenerating = isLoading.some(l => l);
    const isSidebarGenerating = isGeneratingPrompt || isGenerating;
    const isGenerateDisabled = !selectedModel || isGenerating || isGeneratingPrompt || !designTypeSelected;

    const displayAvailableCategoryTags = useMemo(() => [...new Set([...availableMockupTags, ...selectedTags])], [availableMockupTags, selectedTags]);
    const displayLocationTags = useMemo(() => [...new Set([...availableLocationTags, ...selectedLocationTags])], [availableLocationTags, selectedLocationTags]);
    const displayAngleTags = useMemo(() => [...new Set([...availableAngleTags, ...selectedAngleTags])], [availableAngleTags, selectedAngleTags]);
    const displayLightingTags = useMemo(() => [...new Set([...availableLightingTags, ...selectedLightingTags])], [availableLightingTags, selectedLightingTags]);
    const displayEffectTags = useMemo(() => [...new Set([...availableEffectTags, ...selectedEffectTags])], [availableEffectTags, selectedEffectTags]);
    const displayMaterialTags = useMemo(() => [...new Set([...availableMaterialTags, ...selectedMaterialTags])], [availableMaterialTags, selectedMaterialTags]);
    const displaySuggestedTags = useMemo(() => [...new Set([...suggestedTags, ...selectedTags])], [suggestedTags, selectedTags]);

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

    // Credits per generation for suggestions (single mockup por sugestão)
    const creditsPerGeneration = selectedModel
        ? getCreditsRequired(selectedModel, resolution)
        : undefined;

    const [autoGenerate, setAutoGenerate] = React.useState(true);

    return (
        <div className="animate-fade-in justify-center" >
            {/* Color swatches + Transparent background toggle - moved above card */}
            <div className="flex items-end justify-between mt-4 gap-3">
                <div className="flex -space-x-1.5 transition-all duration-300">
                    {selectedColors.map((color, i) => (
                        <div
                            key={i}
                            className="w-3 h-3 rounded-full border border-white/10 ring-2 ring-neutral-900/50 relative"
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                </div>
                {designType && (
                    <div
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => setDesignType(designType === 'logo' ? 'layout' : 'logo')}
                        role="checkbox"
                        aria-checked={designType === 'logo'}
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            setDesignType(designType === 'logo' ? 'layout' : 'logo');
                        }}
                    >
                        <div className={cn(
                            "w-4 h-4 rounded flex items-center justify-center border-2 transition-all duration-200 flex-shrink-0",
                            designType === 'logo'
                                ? "bg-brand-cyan border-brand-cyan"
                                : theme === 'dark'
                                    ? "bg-neutral-800 border-neutral-600 group-hover:border-neutral-500"
                                    : "bg-white border-neutral-300 group-hover:border-neutral-400"
                        )}>
                            {designType === 'logo' && <Check size={10} className="text-black" strokeWidth={3} />}
                        </div>
                        <SkeletonText loading={isSidebarGenerating} className="min-w-[120px]">
                            <span className={cn(
                                "text-[11px] font-mono transition-colors select-none",
                                theme === 'dark' ? "text-neutral-400 group-hover:text-neutral-300" : "text-neutral-600 group-hover:text-neutral-800"
                            )}>
                                {t('mockup.transparentBackground') || 'Transparent background'}
                            </span>
                        </SkeletonText>
                    </div>
                )}
            </div>

            <div className="gap-2">

                {/* 1. AnalyzedSummaryCard (compact) */}
                <AnalyzedSummaryCard
                    uploadedImage={uploadedImage}
                    isGenerating={isSidebarGenerating}
                    referenceImages={referenceImages}
                    selectedBrandingTags={selectedBrandingTags}
                    onStartOver={resetAll}
                    onReplaceImage={onReplaceImage}
                    onReferenceImagesChange={onReferenceImagesChange}
                />

                {/* 2. SurpriseMeSelectedTagsDisplay - ALWAYS visible */}
                <SurpriseMeSelectedTagsDisplay onRerollAll={() => handleSurpriseMe(false)} isGenerating={isSidebarGenerating} />

                {/* 3. (Action toolbar is fixed at bottom — see below) */}

                {/* 4. OutputConfigSection - ALWAYS visible */}
                <OutputConfigSection
                    mockupCount={mockupCount}
                    onMockupCountChange={setMockupCount}
                    designType={designType}
                    selectedModel={selectedModel}
                    isGenerating={isSidebarGenerating}
                    resolution={resolution}
                    onResolutionChange={setResolution}
                    setSelectedModel={setSelectedModel}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={setAspectRatio}
                    imageProvider={imageProvider}
                    setImageProvider={setImageProvider}
                />

                {/* 5. Advanced Options - Collapsible */}
                <div className={cn(
                    "rounded-md border transition-all duration-200 overflow-hidden mt-2",
                    theme === 'dark' ? 'bg-neutral-900/30 border-neutral-800/50 shadow-md' : 'bg-white/50 border-neutral-200 shadow-md'
                )}>
                    <button
                        onClick={() => setIsAdvancedOptionsOpen(!isAdvancedOptionsOpen)}
                        className={cn(
                            "w-full flex justify-between items-center text-left p-3 transition-all duration-200",
                            theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-100/50'
                        )}
                    >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Settings2 size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
                            <SkeletonText loading={isSidebarGenerating} className="min-w-[100px]">
                                <span className={cn(
                                    "text-[12px] font-mono uppercase tracking-widest",
                                    theme === 'dark' ? "text-neutral-300" : "text-neutral-700"
                                )}>
                                    {t('mockup.advancedOptions') || 'Advanced Options'}
                                </span>
                            </SkeletonText>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {isAdvancedOptionsOpen ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
                        </div>
                    </button>

                    {isAdvancedOptionsOpen && (
                        <div className="p-3 pt-0 animate-fade-in space-y-4">
                            {/* CategoriesSection */}
                            <CategoriesSection
                                suggestedTags={suggestedTags}
                                availableTags={displayAvailableCategoryTags}
                                selectedTags={selectedTags}
                                isGenerating={isSidebarGenerating}
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
                                tagCategories={tagCategories}
                                mockupPresets={mockupPresets}
                                isSurpriseMeMode={isSurpriseMeMode}
                                categoriesPool={surpriseMePool.selectedCategoryTags || []}
                                onPoolToggle={(tag) => togglePoolTag('selectedCategoryTags', tag, surpriseMePool, setSurpriseMePool)}
                            />

                            {/* RefineSection */}
                            <RefineSection
                                isAdvancedOpen={isAdvancedOpen}
                                onToggleAdvanced={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                isGenerating={isSidebarGenerating}
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
                                    generateText,
                                    withHuman,
                                    enhanceTexture,
                                    removeText,
                                    onGenerateTextChange: setGenerateText,
                                    onWithHumanChange: setWithHuman,
                                    onEnhanceTextureChange: setEnhanceTexture,
                                    onRemoveTextChange: setRemoveText,
                                    suggestedLocationTags,
                                    suggestedAngleTags,
                                    suggestedLightingTags,
                                    suggestedEffectTags,
                                    suggestedMaterialTags,
                                    suggestedColors: suggestedColorsFromAnalysis,
                                    // Surprise Me Mode props
                                    isSurpriseMeMode,
                                    locationPool: surpriseMePool.selectedLocationTags || [],
                                    anglePool: surpriseMePool.selectedAngleTags || [],
                                    lightingPool: surpriseMePool.selectedLightingTags || [],
                                    effectPool: surpriseMePool.selectedEffectTags || [],
                                    materialPool: surpriseMePool.selectedMaterialTags || [],
                                    onLocationPoolToggle: (tag) => togglePoolTag('selectedLocationTags', tag, surpriseMePool, setSurpriseMePool),
                                    onAnglePoolToggle: (tag) => togglePoolTag('selectedAngleTags', tag, surpriseMePool, setSurpriseMePool),
                                    onLightingPoolToggle: (tag) => togglePoolTag('selectedLightingTags', tag, surpriseMePool, setSurpriseMePool),
                                    onEffectPoolToggle: (tag) => togglePoolTag('selectedEffectTags', tag, surpriseMePool, setSurpriseMePool),
                                    onMaterialPoolToggle: (tag) => togglePoolTag('selectedMaterialTags', tag, surpriseMePool, setSurpriseMePool)
                                }}
                            />

                        </div>
                    )}
                </div>

                {/* 6. Auth alert (conditional) */}
                {(() => {
                    const hasToken = typeof window !== 'undefined' && localStorage.getItem('auth_token');
                    const shouldShowAlert = !hasToken && authenticationRequiredMessage;

                    return shouldShowAlert ? (
                        <div className="mt-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3">
                            <Lock size={16} className="text-red-400 mt-0.5" />
                            <p className="text-xs font-mono text-red-200">
                                {authenticationRequiredMessage}
                            </p>
                        </div>
                    ) : null;
                })()}

                {/* Spacer so fixed toolbar doesn't cover content */}
                <div className="h-40 flex-shrink-0" aria-hidden="true" />
            </div>

            {/* Fixed Bottom Toolbar — Surprise Me + Generate */}
            <div
                className={cn(
                    'z-30 animate-fade-in',
                    'fixed bottom-0 left-0 right-0 px-4 pb-[50px]',
                    'lg:sticky lg:bottom-0 lg:left-auto lg:right-auto lg:px-0',
                    'flex items-center justify-center',
                    theme === 'dark'
                        ? 'bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-transparent'
                        : 'bg-gradient-to-t from-white via-white/95 to-transparent'
                )}
            >
                <SurpriseMeControl
                    onSurpriseMe={handleSurpriseMe}
                    isGeneratingPrompt={isGeneratingPrompt}
                    isDiceAnimating={isDiceAnimating}
                    isSurpriseMeMode={isSurpriseMeMode}
                    setIsSurpriseMeMode={setIsSurpriseMeMode}
                    autoGenerate={autoGenerate}
                    setAutoGenerate={setAutoGenerate}
                    selectedModel={selectedModel}
                    mockupCount={mockupCount}
                    resolution={resolution}
                    showBackground={true}
                    containerClassName="shadow-lg !pb-0 rounded-b-none"
                    onGeneratePrompt={onGenerateSmartPrompt}
                    onGenerateOutputs={onGenerateClick}
                    isGenerateDisabled={isGenerateDisabled}
                    isGeneratingOutputs={isGenerating}
                    isPromptReady={isPromptReady}
                    setSelectedModel={setSelectedModel}
                    imageProvider={imageProvider}
                    setImageProvider={setImageProvider}
                    uploadedImage={uploadedImage}
                    promptSectionProps={{
                        promptPreview,
                        isSidebarGenerating,
                        onPromptChange: handlePromptChange,
                        onPromptUpdate: (value) => {
                            setPromptPreview(value);
                            if (isSmartPromptActive) setIsSmartPromptActive(false);
                            setIsPromptManuallyEdited(true);
                        },
                        promptSuggestions,
                        isGeneratingPrompt,
                        isSuggestingPrompts: isSuggestingPrompts,
                        isGenerating: isGenerating,
                        hasGenerated,
                        mockups,
                        onSuggestPrompts,
                        onGenerateSmartPrompt,
                        onSimplify,
                        onRegenerate,
                        onSuggestionClick: handleSuggestionClick,
                        isSmartPromptActive,
                        setIsSmartPromptActive,
                        setIsPromptManuallyEdited,
                        creditsPerGeneration,
                        onGenerateSuggestion,
                        isGenerateDisabled,
                    }}
                />
            </div>
        </div>
    );
};
