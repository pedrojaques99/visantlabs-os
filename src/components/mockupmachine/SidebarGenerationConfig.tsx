import React, { useMemo } from 'react';
import { RotateCcw, Dices, RefreshCcw, Lock, Shuffle } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { CategoriesSection } from './CategoriesSection';
import { RefineSection } from './RefineSection';
import { OutputConfigSection } from './OutputConfigSection';
import { PromptSection } from './PromptSection';
import { GenerateButton } from '../ui/GenerateButton';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { useMockup } from './MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';
import { SurpriseMeSelectedTagsDisplay } from './SurpriseMeSelectedTagsDisplay';
import { AnalyzedSummaryCard } from './AnalyzedSummaryCard';

interface SidebarGenerationConfigProps {
    onGenerateClick: () => void;
    onRegenerate: () => void;
    onSurpriseMe: (autoGenerate: boolean) => void; /* Original handler from props, but wait, we need the "handleSurpriseMe" wrapper which does scrolling */
    handleSurpriseMe: (autoGenerate?: boolean) => void; /* The wrapper function */
    onSuggestPrompts: () => void;
    onGenerateSmartPrompt: () => void;
    onSimplify: () => void;
    onGenerateSuggestion: (suggestion: string) => void;
    generateOutputsButtonRef: React.RefObject<HTMLButtonElement>;
    isDiceAnimating: boolean;
    onStartOver: () => void; /* Used for reset all? No, resetAll comes from context */
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
    authenticationRequiredMessage,
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();

    const {
        selectedModel,
        setSelectedModel,
        designType,
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
        isImagelessMode,
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
    const brandingComplete = selectedBrandingTags.length > 0;
    const categoriesComplete = selectedTags.length > 0;
    const hasReferenceImage = !!referenceImage || referenceImages.length > 0;
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

    // Calculate credits required for main generation
    const creditsRequired = selectedModel && isPromptReady
        ? mockupCount * getCreditsRequired(selectedModel, resolution)
        : undefined;

    // Calculate credits per generation for suggestions (single mockup per suggestion)
    const creditsPerGeneration = selectedModel
        ? getCreditsRequired(selectedModel, resolution)
        : undefined;

    const [autoGenerate, setAutoGenerate] = React.useState(true);

    // Authentication Alert Logic
    const isAuthenticated = useMemo(() => {
        return true;
    }, []);

    return (
        <div className="animate-fade-in justify-center" >

            {/* Analysis Summary & Surprise Me Grid */}
            <div className="gap-2">
                <AnalyzedSummaryCard
                    uploadedImage={uploadedImage}
                    selectedBrandingTags={selectedBrandingTags}
                    selectedColors={selectedColors}
                    onStartOver={resetAll}
                />

                {/* Unified Surprise Me Container */}
                <div className={`h-full rounded-xl p-4 md:p-5 transition-all duration-200 flex items-start justify-center ${theme === 'dark' ? 'bg-neutral-900/80' : 'bg-neutral-50/50'}`}>
                    <div className="flex flex-col sm:flex-row gap-5 items-start px-8 py-5 rounded-lg justify-center">
                        {/* Main Surprise Me Button */}
                        <button
                            onClick={() => handleSurpriseMe(autoGenerate)}
                            disabled={isGenerating || isGeneratingPrompt}
                            className={cn(
                                "relative w-16 h-16 flex items-center justify-center rounded-lg border transition-all duration-300 group overflow-hidden shadow-lg flex-shrink-0",
                                isSurpriseMeMode
                                    ? "bg-brand-cyan/20 border-brand-cyan/50 text-brand-cyan hover:bg-brand-cyan/30 shadow-brand-cyan/20"
                                    : theme === 'dark'
                                        ? "bg-neutral-800/80 border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white shadow-black/30"
                                        : "bg-white border-neutral-300 hover:border-neutral-400 text-neutral-700 hover:text-neutral-900 shadow-neutral-200/50",
                                isDiceAnimating && "dice-button-clicked",
                                (isGenerating || isGeneratingPrompt) && "opacity-50 cursor-not-allowed"
                            )}
                            title={isSurpriseMeMode ? t('mockup.surpriseMeModeActiveTooltip') : t('mockup.surpriseMeTooltip')}
                        >
                            <div className={cn("transition-transform duration-700 ease-out", isDiceAnimating && "rotate-[360deg]")}>
                                {isGeneratingPrompt ? <RefreshCcw size={24} className="animate-spin" /> : <Dices size={28} />}
                            </div>
                        </button>

                        {/* Toggles Column */}
                        <div className="flex flex-col gap-3 min-w-[140px] mt-3">
                            {/* Auto Generate Toggle */}
                            <div
                                className={`group flex items-center gap-3 cursor-pointer transition-all duration-200 ${autoGenerate ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                                onClick={() => setAutoGenerate(!autoGenerate)}
                                title={t('mockup.autoGenerateTooltip')}
                            >
                                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-200 ${autoGenerate
                                    ? 'bg-brand-cyan border-brand-cyan'
                                    : theme === 'dark'
                                        ? 'bg-neutral-800 border-neutral-600 group-hover:border-neutral-500'
                                        : 'bg-white border-neutral-300 group-hover:border-neutral-400'
                                    }`}>
                                    {autoGenerate && (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <span className={`text-[10px] uppercase tracking-widest font-mono select-none ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    {t('mockup.autoGenerate')}
                                </span>
                            </div>

                            {/* Pool Mode Toggle */}
                            <div
                                className={`group flex items-center gap-3 cursor-pointer transition-all duration-200 ${isSurpriseMeMode ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                                onClick={() => setIsSurpriseMeMode(!isSurpriseMeMode)}
                                title={isSurpriseMeMode ? t('mockup.surpriseMeModeDisableTooltip') : t('mockup.surpriseMeModeEnableTooltip')}
                            >
                                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-200 ${isSurpriseMeMode
                                    ? 'bg-brand-cyan border-brand-cyan'
                                    : theme === 'dark'
                                        ? 'bg-neutral-800 border-neutral-600 group-hover:border-neutral-500'
                                        : 'bg-white border-neutral-300 group-hover:border-neutral-400'
                                    }`}>
                                    {isSurpriseMeMode && (
                                        <Shuffle size={10} className="text-black" />
                                    )}
                                </div>
                                <span className={`text-[10px] uppercase tracking-widest font-mono select-none ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    {t('mockup.surpriseMeMode')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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

            {/* Show refine section and below immediately when design type is selected OR when reference images are present OR uploaded image */}
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

            {/* Display Selected Tags (Surprise Me Result Visualization) */}
            <SurpriseMeSelectedTagsDisplay />



            <div className="flex flex-col gap-2 mt-6">
                {/* Generate Button - Only show if prompt is ready OR user has valid setup (Generate Prompt) */}
                {(isPromptReady || designTypeSelected || brandingComplete || categoriesComplete || hasReferenceImage || (uploadedImage && !isImagelessMode)) && (
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
                )}
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
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => handleSurpriseMe(autoGenerate)}
                            disabled={isGeneratingPrompt}
                            variant="sidebarAction"
                            size="sidebar"
                            className={cn("flex-1 justify-center", isDiceAnimating && 'dice-button-clicked', isSurpriseMeMode && 'bg-brand-cyan/20 border-brand-cyan/50')}
                            aria-label={t('mockup.surpriseMe')}
                            title={t('mockup.surpriseMeTooltip')}
                        >
                            <Dices size={18} className={isDiceAnimating ? 'dice-icon-animate' : ''} />
                        </Button>
                    </div>
                </div>
            </div>

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


            <div className="flex justify-center mt-8 mb-4">
                <Button
                    onClick={resetAll}
                    variant="ghost"
                    size="sm"
                    className="w-auto gap-1.5 text-neutral-500 hover:text-neutral-400 text-[10px] font-mono opacity-60 hover:opacity-100"
                    aria-label={t('mockup.clearAll')}
                >
                    <RotateCcw size={12} />
                    <span>{t('mockup.clearAll')}</span>
                </Button>
            </div>
        </div>
    );
};
