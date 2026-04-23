import React, { useEffect, useMemo, useState } from 'react';
import { Lock, ChevronDown, ChevronUp, Settings2, Check, ChevronLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { CategoriesSection } from './CategoriesSection';
import { KeywordsSection } from './KeywordsSection';
import { RefineSection } from './RefineSection';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { useMockup } from './MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';
import { SurpriseMeSelectedTagsDisplay } from './SurpriseMeSelectedTagsDisplay';
import { AnalyzedSummaryCard } from './AnalyzedSummaryCard';
import type { UploadedImage } from '@/types/types';
import { SurpriseMeControl } from './SurpriseMeControl';
import { BrandGuidelineSelector } from './BrandGuidelineSelector';
import { SkeletonText } from '@/components/ui/SkeletonLoader';
import { PresetsControl } from './PresetsControl';
import { PromptSection } from './PromptSection';
import { MicroTitle } from '../ui/MicroTitle';
import { Switch } from '@/components/ui/switch';
import { SeedControl } from '@/components/reactflow/shared/SeedControl';

interface SidebarGenerationConfigProps {
    onGenerateClick: () => void;
    onRegenerate: () => void;
    onSurpriseMe: (autoGenerate: boolean) => void; /* Original handler from props */
    handleSurpriseMe: (autoGenerate?: boolean) => void; /* The wrapper function */
    onSuggestPrompts: () => void;
    onGenerateSmartPrompt: (generateOutputs?: boolean) => Promise<void>;
    onSimplify: () => void;
    onGenerateSuggestion: (suggestion: string) => void;
    generateOutputsButtonRef: React.RefObject<HTMLButtonElement>;
    onStartOver: () => void;
    onReplaceImage?: (image: UploadedImage) => void;
    onReferenceImagesChange: (images: UploadedImage[]) => void;
    authenticationRequiredMessage: string;
    isPromptReady: boolean;
    sidebarWidth?: number;
    onSwitchToEssential: () => void;
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
    onReplaceImage,
    onReferenceImagesChange,
    authenticationRequiredMessage,
    isPromptReady,
    sidebarWidth = 400,
    onSwitchToEssential,
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
        seed,
        setSeed,
        seedLocked,
        setSeedLocked,
        detectedLanguage,
        detectedText,
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
        // isPromptReady is derived - no need to set it manually
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
        <div className="animate-fade-in justify-center pt-2" >
            {/* 0. Top Navigation / Switch back */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={onSwitchToEssential}
                    className="flex items-center gap-1 group text-[10px] font-mono text-neutral-600 hover:text-brand-cyan transition-colors uppercase tracking-widest"
                >
                    <ChevronLeft size={10} className="group-hover:-translate-x-0.5 transition-transform" />
                    {t('mockup.switchToEssential') || 'ESSENTIAL'}
                </button>

                <BrandGuidelineSelector variant="minimal" />
            </div>

            {/* Design Type + Color swatches - moved above card */}
            <div className="flex items-center justify-between mt-4">
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

                <div
                    role="button"
                    onClick={() => setDesignType(designType === 'logo' ? 'layout' : 'logo')}
                    className={cn(
                        "px-2 h-7 rounded-md transition-all flex items-center gap-1.5 border cursor-pointer select-none",
                        designType === 'logo'
                            ? "bg-brand-cyan/10 border-brand-cyan/20 text-brand-cyan"
                            : "bg-white/5 border-white/10 text-neutral-500 hover:text-neutral-400 hover:bg-white/10"
                    )}
                    title={t('mockup.transparentBackground') || 'Isolar Logotipo'}
                >
                    <Switch
                        checked={designType === 'logo'}
                        onCheckedChange={() => setDesignType(designType === 'logo' ? 'layout' : 'logo')}
                        className="scale-[0.5] origin-left pointer-events-none"
                    />
                    <span className="font-bold text-[10px] uppercase tracking-tighter whitespace-nowrap opacity-80">
                        {t('mockup.transparentBackground') || 'ISOLAR LOGO'}
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">

                {/* 1. AnalyzedSummaryCard (compact) */}
                <div className="animate-fade-in-up stagger-1">
                    <AnalyzedSummaryCard
                        uploadedImage={uploadedImage}
                        isGenerating={isSidebarGenerating}
                        referenceImages={referenceImages}
                        selectedBrandingTags={selectedBrandingTags}
                        onStartOver={resetAll}
                        onReplaceImage={onReplaceImage}
                        onReferenceImagesChange={onReferenceImagesChange}
                        detectedLanguage={detectedLanguage}
                        detectedText={detectedText}
                    />
                </div>

                {/* 2. SurpriseMeSelectedTagsDisplay - ONLY visible in Normal Mode */}
                {!isSurpriseMeMode && (
                    <div className="animate-fade-in-up stagger-2 relative z-[60]">
                        <SurpriseMeSelectedTagsDisplay
                            onRerollAll={() => handleSurpriseMe(false)}
                            isGenerating={isSidebarGenerating}
                            sidebarWidth={sidebarWidth}
                        />
                    </div>
                )}

                {/* 2.5 Presets Control */}
                <div className="animate-fade-in-up stagger-3 relative z-10">
                    <PresetsControl />
                </div>

                {/* CategoriesSection - ONLY visible in Pool Mode */}
                {isSurpriseMeMode && (
                    <div className="animate-fade-in-up stagger-2">
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
                    </div>
                )}

                {/* RefineSection - Only visible in Pool Mode */}
                {isSurpriseMeMode && (
                    <div className="animate-fade-in-up stagger-3">
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

                {/* 3. Prompt Section */}
                <div className="animate-fade-in-up stagger-4">
                    {/* Seed Control — lives right above prompt so users associate it with generation */}
                    <SeedControl
                        seed={seed}
                        seedLocked={seedLocked}
                        onSeedChange={setSeed}
                        onSeedLockedChange={setSeedLocked}
                        disabled={isGenerating}
                        className="mb-3"
                    />
                    <PromptSection
                        promptPreview={promptPreview}
                        isSidebarGenerating={isSidebarGenerating}
                        onPromptChange={handlePromptChange}
                        onPromptUpdate={(value) => {
                            setPromptPreview(value);
                            if (isSmartPromptActive) setIsSmartPromptActive(false);
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
                        isPromptReady={isPromptReady}
                    />
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

                {/* 4. Generation Toolbar (Moved to sidebar) */}
                <div className="mt-6 pt-6 border-t border-white/5 animate-fade-in-up stagger-5">
                    <SurpriseMeControl
                        onSurpriseMe={handleSurpriseMe}
                        isGeneratingPrompt={isGeneratingPrompt}
                        isDiceAnimating={false}
                        isSurpriseMeMode={isSurpriseMeMode}
                        setIsSurpriseMeMode={setIsSurpriseMeMode}
                        autoGenerate={autoGenerate}
                        setAutoGenerate={setAutoGenerate}
                        selectedModel={selectedModel}
                        setSelectedModel={setSelectedModel}
                        imageProvider={imageProvider}
                        setImageProvider={setImageProvider}
                        mockupCount={mockupCount}
                        setMockupCount={setMockupCount}
                        resolution={resolution}
                        setResolution={setResolution}
                        aspectRatio={aspectRatio}
                        setAspectRatio={setAspectRatio}
                        uploadedImage={uploadedImage}
                        onGeneratePrompt={() => onGenerateSmartPrompt(autoGenerate)}
                        onGenerateOutputs={onGenerateClick}
                        isGenerateDisabled={isGenerateDisabled}
                        isGeneratingOutputs={isGenerating}
                        isPromptReady={isPromptReady}
                        variant="inline"
                    />
                </div>

                {/* Spacer so fixed toolbar doesn't cover content (no longer fixed, but keeps padding) */}
                <div className="h-10 flex-shrink-0" aria-hidden="true" />
            </div>
        </div>
    );
};
