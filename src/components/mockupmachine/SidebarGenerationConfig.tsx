import React, { useMemo, useState } from 'react';
import { Lock, ChevronDown, ChevronUp, Sliders, Settings2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { CategoriesSection } from './CategoriesSection';
import { RefineSection } from './RefineSection';
import { OutputConfigSection } from './OutputConfigSection';
import { PromptSection } from './PromptSection';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { useMockup } from './MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';
import { SurpriseMeSelectedTagsDisplay } from './SurpriseMeSelectedTagsDisplay';
import { AnalyzedSummaryCard } from './AnalyzedSummaryCard';
import type { UploadedImage } from '@/types/types';
import { SurpriseMeControl } from './SurpriseMeControl';
import { DesignTypeSection } from './DesignTypeSection';
import { Separator } from '@radix-ui/react-separator';

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
    onStartOver: () => void; /* Used for reset all? No, resetAll comes from context */
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
    const [isRefineSectionExpanded, setIsRefineSectionExpanded] = useState(false);

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
        referenceImage,
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
    } = useMockup();

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

            {/* Analysis Summary & Surprise Me Grid */}
            <div className="gap-2">
                <AnalyzedSummaryCard
                    uploadedImage={uploadedImage}
                    referenceImages={referenceImages} /* Pass reference images */
                    selectedBrandingTags={selectedBrandingTags}
                    selectedColors={selectedColors}
                    onStartOver={resetAll}
                    onReplaceImage={onReplaceImage}
                    onReferenceImagesChange={onReferenceImagesChange}
                    designType={designType}
                    onDesignTypeChange={setDesignType}
                />

            {/* CategoriesSection - Mockup Types */}
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
                tagCategories={tagCategories}
                mockupPresets={mockupPresets}
                isSurpriseMeMode={isSurpriseMeMode}
                categoriesPool={surpriseMePool.selectedCategoryTags || []}
                onPoolToggle={(tag) => togglePoolTag('selectedCategoryTags', tag, surpriseMePool, setSurpriseMePool)}
            />

            <Separator className="my-4 bg-neutral-800/30 border-1 border-neutral-800/50" />

            {/* Show refine section and below immediately when design type is selected OR when reference images are present OR uploaded image */}
            <div id="refine-section" className={cn(
                "rounded-2xl border-1 border-neutral-800/50 transition-all duration-200 overflow-hidden animate-fade-in",
                theme === 'dark' ? 'bg-neutral-900/30 border-1 border-neutral-800/50 shadow-md' : 'bg-white/50 border-1 border-neutral-200 shadow-md'
            )}>
                <button
                    onClick={() => setIsRefineSectionExpanded(!isRefineSectionExpanded)}
                    className={cn(
                        "w-full flex justify-between items-center text-left p-3 transition-all duration-200",
                        theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-100/50'
                    )}
                >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Settings2 size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
                        <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                            <span className={cn(
                                "text-[12px] font-mono uppercase tracking-widest",
                                theme === 'dark' ? "text-neutral-300" : "text-neutral-700"
                            )}>
                                {t('mockup.refine')}
                            </span>
                            {!isRefineSectionExpanded && (
                                (selectedLocationTags.length > 0 || 
                                 selectedAngleTags.length > 0 || 
                                 selectedLightingTags.length > 0 || 
                                 selectedEffectTags.length > 0 || 
                                 selectedMaterialTags.length > 0 || 
                                 selectedColors.length > 0) && (
                                    <span className="text-[12px] font-mono truncate max-w-[200px] text-brand-cyan">
                                        {[
                                            selectedLocationTags.length > 0 && `${selectedLocationTags.length} ${t('mockup.location')}`,
                                            selectedAngleTags.length > 0 && `${selectedAngleTags.length} ${t('mockup.cameraAngle')}`,
                                            selectedLightingTags.length > 0 && `${selectedLightingTags.length} ${t('mockup.lightingMood')}`,
                                            selectedEffectTags.length > 0 && `${selectedEffectTags.length} ${t('mockup.visualEffects')}`,
                                            selectedMaterialTags.length > 0 && `${selectedMaterialTags.length} ${t('mockup.material')}`,
                                            selectedColors.length > 0 && `${selectedColors.length} ${t('mockup.colorPalette')}`
                                        ].filter(Boolean).join(' · ')}
                                    </span>
                                )
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {isRefineSectionExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
                    </div>
                </button>

                {isRefineSectionExpanded && (
                    <div className="p-3 pt-0 animate-fade-in">
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
                                generateText,
                                withHuman,
                                enhanceTexture,
                                onGenerateTextChange: setGenerateText,
                                onWithHumanChange: setWithHuman,
                                onEnhanceTextureChange: setEnhanceTexture,
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

            <OutputConfigSection
                mockupCount={mockupCount}
                onMockupCountChange={setMockupCount}
                designType={designType}
                selectedModel={selectedModel}
                resolution={resolution}
                onResolutionChange={setResolution}
                setSelectedModel={setSelectedModel}
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
            />

            {/* PromptSection sempre visível */}
            <PromptSection
                promptPreview={promptPreview}
                onPromptChange={handlePromptChange}
                onPromptUpdate={(value) => {
                    setPromptPreview(value);
                    if (isSmartPromptActive) {
                        setIsSmartPromptActive(false);
                    }
                    setIsPromptManuallyEdited(true);
                }}
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

            {/* Display Selected Tags (Surprise Me Result Visualization) */}
            <SurpriseMeSelectedTagsDisplay />

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

            {/* Spacer on mobile so fixed bar doesn't cover last content */}
            <div className="h-40 flex-shrink-0 lg:hidden" aria-hidden="true" />

            {/* SurpriseMeControl: floating on mobile, sticky on lg+ */}
            <div
                className={cn(
                    'z-30 pt-4 animate-fade-in',
                    'fixed bottom-0 left-0 right-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
                    'lg:relative lg:left-auto lg:right-auto lg:px-0 lg:pb-0 lg:sticky lg:bottom-0'
                )}
                style={{ background: 'linear-gradient(to top, var(--sidebar) 80%, transparent)' }}
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
                    containerClassName="shadow-lg"
                    onGeneratePrompt={onGenerateSmartPrompt}
                    onGenerateOutputs={onGenerateClick}
                    isGenerateDisabled={isGenerateDisabled}
                    isGeneratingOutputs={isGenerating}
                    isPromptReady={isPromptReady}
                />
            </div>
        </div>
        </div>
    );
};
