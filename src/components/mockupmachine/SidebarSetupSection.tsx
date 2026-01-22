import React, { useMemo } from 'react';
import { Pencil } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { InputSection } from './InputSection';
import { BrandingSection } from '../branding/BrandingSection';
import { ColorPalettePreview } from './ColorPalettePreview';
import { DesignTypeSection } from './DesignTypeSection';
import { useMockup } from './MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';
import { sectionTitleClass } from '@/lib/utils';
import type { UploadedImage, DesignType } from '../../types/types';

interface SidebarSetupSectionProps {
    onImageUpload: (image: UploadedImage) => void;
    onReferenceImagesChange: (images: UploadedImage[]) => void;
    onStartOver: () => void;
    onDesignTypeChange: (type: DesignType) => void;
    onAnalyze: () => void;
}

export const SidebarSetupSection: React.FC<SidebarSetupSectionProps> = ({
    onImageUpload,
    onReferenceImagesChange,
    onStartOver,
    onDesignTypeChange,
    onAnalyze,
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();

    const {
        uploadedImage,
        referenceImage,
        referenceImages,
        designType,
        isImagelessMode,
        selectedModel,
        selectedBrandingTags,
        customBrandingInput,
        setCustomBrandingInput,
        hasAnalyzed,
        isAnalyzing,
        selectedColors,
        setSelectedColors,
        suggestedBrandingTags,
        suggestedColors: suggestedColorsFromAnalysis,
        instructions,
        setInstructions,
    } = useMockup();

    const {
        handleBrandingTagToggle,
        handleAddCustomBrandingTag,
        availableBrandingTags,
    } = useMockupTags();

    const [isEditingInstructions, setIsEditingInstructions] = React.useState(false);

    // Helper values
    const designTypeSelected = !!designType;
    const brandingComplete = selectedBrandingTags.length > 0;

    const displayBrandingTags = useMemo(() =>
        [...new Set([...availableBrandingTags, ...selectedBrandingTags])],
        [availableBrandingTags, selectedBrandingTags]
    );

    const handleScrollToSection = (sectionId: string) => {
        // Scroll to section within the modal
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div
            id="section-setup"
            className="transition-all duration-300 space-y-6 sm:space-y-8"
        >
            {/* Design Type Selection - Always visible */}
            <div className={`p-4 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-black/10 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
                <DesignTypeSection
                    designType={designType}
                    onDesignTypeChange={onDesignTypeChange}
                    uploadedImage={uploadedImage}
                    isImagelessMode={isImagelessMode}
                    onScrollToSection={handleScrollToSection}
                />
            </div>

            {/* Active Grid View - 2 Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                {/* COLUMN 1: Input Media */}
                <div className="space-y-4">
                    <div className="rounded-xl overflow-hidden">
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
                            hasAnalyzed={hasAnalyzed}
                            className="w-full"
                        />
                    </div>
                </div>

                {/* COLUMN 2: Configuration Sections */}
                <div className="space-y-6">
                    {/* Branding Section */}
                    {(designTypeSelected || (uploadedImage && !isImagelessMode)) && (
                        <div className={`p-4 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-black/10 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
                            <BrandingSection
                                tags={displayBrandingTags}
                                selectedTags={selectedBrandingTags}
                                suggestedTags={suggestedBrandingTags}
                                onTagToggle={handleBrandingTagToggle}
                                customInput={customBrandingInput}
                                onCustomInputChange={setCustomBrandingInput}
                                onAddCustomTag={handleAddCustomBrandingTag}
                                isComplete={brandingComplete}
                                hasAnalyzed={hasAnalyzed}
                            />
                        </div>
                    )}

                    {/* Color Palette Preview */}
                    {uploadedImage && !isImagelessMode && (suggestedColorsFromAnalysis.length > 0 || selectedColors.length > 0) && (
                        <div className={`p-4 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
                            <ColorPalettePreview
                                suggestedColors={suggestedColorsFromAnalysis}
                                selectedColors={selectedColors}
                                onColorToggle={(color) => {
                                    if (!selectedColors.includes(color)) {
                                        setSelectedColors([...selectedColors, color]);
                                    }
                                }}
                                onAddColor={(color) => {
                                    if (!selectedColors.includes(color) && selectedColors.length < 5) {
                                        setSelectedColors([...selectedColors, color]);
                                    }
                                }}
                                onRemoveColor={(color) => {
                                    setSelectedColors(selectedColors.filter(c => c !== color));
                                }}
                                disabled={hasAnalyzed}
                                maxColors={5}
                            />
                        </div>
                    )}

                    {/* Instructions Section - Grouped with Branding aspects */}
                    <div className={`p-4 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-black/10 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className={sectionTitleClass(theme === 'dark')}>
                                {t('mockup.instructions')}
                            </span>
                            <button
                                onClick={() => setIsEditingInstructions(!isEditingInstructions)}
                                className="p-1 hover:bg-white/5 rounded-md transition-colors text-neutral-500 hover:text-white"
                            >
                                <Pencil size={12} />
                            </button>
                        </div>

                        {isEditingInstructions ? (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    placeholder={t('mockup.instructionsPlaceholder')}
                                    className="w-full min-h-[100px] p-3 text-sm font-mono bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-brand-cyan/50 resize-none text-white scrollbar-thin"
                                    autoFocus
                                />
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setIsEditingInstructions(false)}
                                        className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 bg-brand-cyan text-black rounded-md hover:bg-brand-cyan/80 transition-all font-bold"
                                    >
                                        {t('common.done')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => setIsEditingInstructions(true)}
                                className="cursor-pointer group"
                            >
                                <p className={`text-sm leading-relaxed transition-colors ${instructions ? 'text-neutral-300' : 'text-neutral-500 italic'}`}>
                                    {instructions || t('mockup.noInstructions')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Manual Analyze Button */}
            {uploadedImage && !hasAnalyzed && !isImagelessMode && (
                <div className="flex justify-center pt-4 animate-fade-in">
                    <button
                        onClick={() => {
                          if (import.meta.env.DEV) console.log('[dev] analyze: button click');
                          onAnalyze();
                        }}
                        disabled={isAnalyzing}
                        className={`
                        relative overflow-hidden group
                        px-8 py-3 rounded-md 
                        bg-brand-cyan 
                        text-neutral-900 font-medium text-sm tracking-wide
                        hover:scale-[1.02]
                        active:scale-[0.98]
                        transition-all duration-300
                        flex items-center gap-2
                        w-full lg:w-auto justify-center`}
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <span className="relative">{t('mockup.analyzeImage')}</span>
                    </button>
                </div>
            )}
        </div>
    );
};
