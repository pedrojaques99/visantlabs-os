import React, { useMemo, useState } from 'react';
import { Pencil, ChevronDown, ChevronUp, Palette, Target, FileText, type LucideIcon, Plus } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { InputSection } from './InputSection';
import { BrandingSection } from '../branding/BrandingSection';
import { ColorPalettePreview } from './ColorPalettePreview';
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

const CollapsibleSection = ({
    title,
    icon: Icon,
    children,
    defaultExpanded = false,
    theme,
    headerAction
}: {
    title: string,
    icon: LucideIcon,
    children: React.ReactNode,
    defaultExpanded?: boolean,
    theme: string,
    headerAction?: React.ReactNode
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${theme === 'dark' ? 'bg-neutral-950/10 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
            <div
                className={`w-full flex items-center justify-between p-4 transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-100/50'}`}
            >
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex-1 flex items-center gap-2 text-left"
                >
                    <Icon size={16} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
                    <span className={sectionTitleClass(theme === 'dark')}>{title}</span>
                </button>
                <div className="flex items-center gap-2">
                    {headerAction}
                    <button onClick={() => setIsExpanded(!isExpanded)}>
                        {isExpanded ?
                            <ChevronUp size={16} className="text-neutral-500" /> :
                            <ChevronDown size={16} className="text-neutral-500" />
                        }
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

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

    const [isEditingCustomBranding, setIsEditingCustomBranding] = React.useState(false);

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
                            hasAnalyzed={hasAnalyzed}
                            className="w-full"
                            onDesignTypeChange={onDesignTypeChange}
                            onScrollToSection={handleScrollToSection}
                        />
                    </div>
                </div>

                {/* COLUMN 2: Configuration Sections */}
                <div className="space-y-4">
                    {/* Branding Section */}
                    {uploadedImage && hasAnalyzed && (
                        <CollapsibleSection
                            title={t('mockup.identity')}
                            icon={Target}
                            theme={theme}
                            defaultExpanded={false}
                            headerAction={
                                <div className="flex items-center">
                                    <button
                                        onClick={() => setIsEditingCustomBranding(true)}
                                        className="p-1 hover:bg-white/10 rounded-md transition-colors text-neutral-500 hover:text-brand-cyan"
                                        title={t('mockup.customTagLabel')}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            }
                        >
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
                                hideTitle={true}
                                isEditingCustom={isEditingCustomBranding}
                                onSetIsEditingCustom={setIsEditingCustomBranding}
                            />
                        </CollapsibleSection>
                    )}

                    {/* Color Palette Preview */}
                    {uploadedImage && (suggestedColorsFromAnalysis.length > 0 || selectedColors.length > 0) && (
                        <CollapsibleSection
                            title={t('mockup.colorPalette')}
                            icon={Palette}
                            theme={theme}
                            defaultExpanded={false}
                        >
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
                                hideTitle={true}
                            />
                        </CollapsibleSection>
                    )}

                    {/* Instructions Section - Grouped with Branding aspects */}
                    <CollapsibleSection
                        title={t('mockup.instructions')}
                        icon={FileText}
                        theme={theme}
                        defaultExpanded={false}
                    >
                        <div className="space-y-3 pt-2">
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder={t('mockup.instructionsPlaceholder')}
                                className="w-full min-h-[100px] p-3 text-sm font-mono bg-neutral-950/70 border border-white/10 rounded-lg focus:outline-none focus:border-brand-cyan/50 resize-none text-white scrollbar-thin"
                                autoFocus
                            />
                        </div>
                    </CollapsibleSection>
                </div>
            </div>
            {/* Manual Analyze Button moved to Modal Header, removed from here */}
        </div>
    );
};
