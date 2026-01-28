import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Plus, X, ChevronDown, ChevronUp, FileText, Palette } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { translateTag } from '@/utils/localeUtils';
import { isSafeUrl } from '@/utils/imageUtils';
import { fileToBase64 } from '@/utils/fileUtils';
import { cn } from '@/lib/utils';
import type { UploadedImage, DesignType } from '@/types/types';
import { useMockup } from './MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';
import { BrandingSection } from '../branding/BrandingSection';

interface AnalyzedSummaryCardProps {
    uploadedImage: UploadedImage | null;
    referenceImages?: UploadedImage[];
    selectedBrandingTags: string[];
    selectedColors: string[];
    onStartOver: () => void;
    onReplaceImage?: (image: UploadedImage) => void;
    onReferenceImagesChange?: (images: UploadedImage[]) => void;
    designType?: DesignType | null;
    onDesignTypeChange?: (type: DesignType) => void;
}

export const AnalyzedSummaryCard: React.FC<AnalyzedSummaryCardProps> = ({
    uploadedImage,
    referenceImages = [],
    selectedBrandingTags: _selectedBrandingTags,
    selectedColors,
    onStartOver,
    onReplaceImage,
    onReferenceImagesChange,
    designType,
    onDesignTypeChange
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const referenceInputRef = useRef<HTMLInputElement>(null);
    const [isEditingCustomBranding, setIsEditingCustomBranding] = useState(false);
    const [isInstructionsExpanded, setIsInstructionsExpanded] = useState(false);
    const [isInstructionsTextareaVisible, setIsInstructionsTextareaVisible] = useState(false);

    const {
        selectedBrandingTags: ctxSelectedBrandingTags,
        suggestedBrandingTags,
        customBrandingInput,
        setCustomBrandingInput,
        instructions,
        setInstructions,
    } = useMockup();

    const {
        handleBrandingTagToggle,
        handleAddCustomBrandingTag,
        availableBrandingTags,
    } = useMockupTags();

    const displayBrandingTags = useMemo(
        () => [...new Set([...availableBrandingTags, ...ctxSelectedBrandingTags])],
        [availableBrandingTags, ctxSelectedBrandingTags]
    );

    // Allow other components to focus/open identity in this card
    useEffect(() => {
        const handler = () => setIsEditingCustomBranding(true);
        if (typeof window === 'undefined') return;
        window.addEventListener('mockup:openIdentity', handler as EventListener);
        return () => window.removeEventListener('mockup:openIdentity', handler as EventListener);
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onReplaceImage) return;

        try {
            const uploadedImage = await fileToBase64(file);
            if (uploadedImage.base64 && uploadedImage.mimeType) {
                onReplaceImage(uploadedImage);
            } else {
                console.error('Invalid image data from fileToBase64');
            }
        } catch (error) {
            console.error('Error processing image:', error);
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleReferenceSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onReferenceImagesChange) return;

        try {
            const newImage = await fileToBase64(file);
            if (newImage.base64 && newImage.mimeType) {
                const updatedImages = [...referenceImages, newImage].slice(0, 3);
                onReferenceImagesChange(updatedImages);
            }
        } catch (error) {
            console.error('Error processing reference image:', error);
        }

        if (referenceInputRef.current) {
            referenceInputRef.current.value = '';
        }
    };

    const handleRemoveReference = (index: number) => {
        if (!onReferenceImagesChange) return;
        const updatedImages = referenceImages.filter((_, i) => i !== index);
        onReferenceImagesChange(updatedImages);
    };

    return (
        <div className={`w-full overflow-hidden rounded-xl transition-all duration-300 gap-2 group/card ${theme === 'dark'
            ? 'bg-neutral-900/30'
            : 'bg-neutral-50/50'
            }`}>
            <div className="relative p-4 md:p-5 flex flex-col gap-4">
                {/* Media Container - Full Width */}
                <div className="w-full shrink-0">
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-neutral-900 shadow-inner group">
                        {uploadedImage ? (
                            <>
                                <img
                                    src={uploadedImage.url || (uploadedImage.base64 && isSafeUrl(`data:${uploadedImage.mimeType};base64,${uploadedImage.base64}`) ? `data:${uploadedImage.mimeType};base64,${uploadedImage.base64}` : '')}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    alt="Analyzed Design"
                                />
                                {onReplaceImage && (
                                    <>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="absolute top-2 right-2 p-2 bg-neutral-950/70 hover:bg-neutral-950/90 backdrop-blur-sm border border-white/10 rounded-md transition-all duration-200 hover:border-brand-cyan/50 group/btn z-20 opacity-0 group-hover:opacity-100"
                                            title={t('mockup.replaceImage') || 'Replace image'}
                                            aria-label="Replace image"
                                        >
                                            <ArrowLeftRight size={16} className="text-neutral-300 group-hover/btn:text-brand-cyan transition-colors" />
                                        </button>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                                <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-widest">Empty</span>
                            </div>
                        )}

                        {/* Reference Images Overlay (Inside the same div) */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-start gap-2 z-10 pointer-events-none">
                            <div className="flex gap-2 pointer-events-auto">
                                {referenceImages.map((img, i) => (
                                    <div key={i} className="relative w-12 h-12 rounded-md overflow-hidden border border-white/20 bg-neutral-900 shadow-lg group/ref">
                                        <img
                                            src={img.url || (img.base64 ? `data:${img.mimeType || 'image/png'};base64,${img.base64}` : '')}
                                            className="w-full h-full object-cover opacity-90 group-hover/ref:opacity-100 transition-opacity"
                                            alt={`Ref ${i}`}
                                        />
                                        {onReferenceImagesChange && (
                                            <button
                                                onClick={() => handleRemoveReference(i)}
                                                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/ref:opacity-100 transition-all duration-200"
                                                title={t('mockup.removeImage') || 'Remove image'}
                                            >
                                                <X size={12} className="text-white" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {/* Add Reference Button - slightly larger, still subtle */}
                                {onReferenceImagesChange && referenceImages.length < 3 && (
                                    <>
                                        <input
                                            ref={referenceInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            onChange={handleReferenceSelect}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => referenceInputRef.current?.click()}
                                            className="w-12 h-12 rounded-md border border-dashed border-white/20 bg-black/30 backdrop-blur-sm hover:bg-black/50 hover:border-brand-cyan/40 flex items-center justify-center transition-all duration-200 group/add opacity-70 hover:opacity-100"
                                            title={t('mockup.addReferenceImage') || 'Add Reference'}
                                        >
                                            <Plus size={14} className="text-white/60 group-hover/add:text-brand-cyan" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info & Metadata & Design Type Switcher */}
                <div className="w-full min-w-0 flex flex-col items-center justify-center">
                    <div className="space-y-3 w-full">
                        {/* Instructions + Identity (combined panel) */}
                        <div className={cn(
                            "w-full rounded-xl border transition-all duration-200 overflow-hidden",
                            theme === 'dark'
                                ? "bg-neutral-900/30 border-white/5"
                                : "bg-white/50 border-neutral-200"
                        )}>
                            <button
                                onClick={() => setIsInstructionsExpanded(!isInstructionsExpanded)}
                                className={cn(
                                    "w-full flex justify-between items-center text-left p-3 transition-all duration-200",
                                    theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-100/50'
                                )}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <FileText size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
                                    <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                                        <span className={cn(
                                            "text-[10px] font-mono uppercase tracking-widest",
                                            theme === 'dark' ? "text-neutral-500" : "text-neutral-600"
                                        )}>
                                            {t('mockup.instructions')} / {t('mockup.identity')}
                                        </span>
                                        {!isInstructionsExpanded && (instructions || ctxSelectedBrandingTags.length > 0) && (
                                            <span className="text-[10px] font-mono truncate max-w-[200px]">
                                                {instructions && (
                                                    <span className="text-brand-cyan">{instructions.substring(0, 30)}{instructions.length > 30 ? '...' : ''}</span>
                                                )}
                                                {instructions && ctxSelectedBrandingTags.length > 0 && <span className="text-neutral-500"> · </span>}
                                                {ctxSelectedBrandingTags.length > 0 && (
                                                    <span className="text-neutral-500">
                                                        {ctxSelectedBrandingTags.length} {t('mockup.identity')}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {isInstructionsExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
                                </div>
                            </button>

                            {isInstructionsExpanded && (
                                <div className="p-3 pt-2 animate-fade-in space-y-3">
                                    {/* Instructions */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className={cn(
                                                "text-[10px] uppercase font-mono tracking-widest",
                                                theme === 'dark' ? "text-neutral-400" : "text-neutral-600"
                                            )}>
                                                {t('mockup.instructions')}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setIsInstructionsTextareaVisible(!isInstructionsTextareaVisible)}
                                                className={cn(
                                                    "p-1 rounded-md transition-colors",
                                                    theme === 'dark'
                                                        ? "hover:bg-white/10 text-neutral-500 hover:text-brand-cyan"
                                                        : "hover:bg-neutral-100 text-neutral-500 hover:text-brand-cyan"
                                                )}
                                                title={isInstructionsTextareaVisible ? t('mockup.collapse') || 'Collapse' : t('mockup.expand') || 'Expand'}
                                                aria-label={isInstructionsTextareaVisible ? t('mockup.collapse') || 'Collapse' : t('mockup.expand') || 'Expand'}
                                            >
                                                {isInstructionsTextareaVisible ? <X size={12} /> : <Plus size={12} />}
                                            </button>
                                        </div>
                                        {isInstructionsTextareaVisible && (
                                            <textarea
                                                value={instructions}
                                                onChange={(e) => setInstructions(e.target.value)}
                                                placeholder={t('mockup.instructionsPlaceholder')}
                                                className={cn(
                                                    "w-full min-h-[80px] p-3 text-sm font-mono rounded-lg focus:outline-none resize-none shadow-inner animate-fade-in",
                                                    theme === 'dark'
                                                        ? "bg-black/10 border border-white/10 text-white placeholder:text-neutral-700 focus:border-brand-cyan/50"
                                                        : "bg-white border border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-cyan/50"
                                                )}
                                            />
                                        )}
                                    </div>

                                    {/* Branding tags */}
                                    <div 
                                        className={cn(
                                            "space-y-2 cursor-pointer rounded-md transition-colors",
                                            theme === 'dark'
                                        )}
                                        onClick={() => setIsEditingCustomBranding(true)}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <Palette size={12} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
                                                <span className={cn(
                                                    "text-[10px] uppercase font-mono tracking-widest",
                                                    theme === 'dark' ? "text-neutral-400" : "text-neutral-600"
                                                )}>
                                                    {t('mockup.identity')}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsEditingCustomBranding(true);
                                                }}
                                                className={cn(
                                                    "p-1 rounded-md transition-colors",
                                                    theme === 'dark'
                                                        ? "hover:bg-white/10 text-neutral-500 hover:text-brand-cyan"
                                                        : "hover:bg-neutral-100 text-neutral-500 hover:text-brand-cyan"
                                                )}
                                                title={t('mockup.customTagLabel')}
                                                aria-label={t('mockup.customTagLabel')}
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <BrandingSection
                                                tags={displayBrandingTags}
                                                selectedTags={ctxSelectedBrandingTags}
                                                suggestedTags={suggestedBrandingTags}
                                                onTagToggle={handleBrandingTagToggle}
                                                customInput={customBrandingInput}
                                                onCustomInputChange={setCustomBrandingInput}
                                                onAddCustomTag={handleAddCustomBrandingTag}
                                                isComplete={ctxSelectedBrandingTags.length > 0}
                                                hideTitle={true}
                                                isEditingCustom={isEditingCustomBranding}
                                                onSetIsEditingCustom={setIsEditingCustomBranding}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

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

                        {/* Design Type Switcher - Subtle */}
                        {onDesignTypeChange && (
                            <div className="flex items-center rounded-md p-0.5 border border-neutral-700/50">
                                <button
                                    onClick={() => onDesignTypeChange('logo')}
                                    className={cn(
                                        "px-3 py-1.5 text-[11px] font-mono rounded transition-colors",
                                        designType === 'logo'
                                            ? "bg-brand-cyan text-black font-semibold"
                                            : "text-neutral-500 hover:text-neutral-300"
                                    )}
                                    title={t('mockup.itsALogo')}
                                >
                                    {t('mockup.typeLogo') || 'LOGO'}
                                </button>
                                <button
                                    onClick={() => onDesignTypeChange('layout')}
                                    className={cn(
                                        "px-3 py-1.5 text-[11px] font-mono rounded transition-colors",
                                        designType === 'layout'
                                            ? "bg-brand-cyan text-black font-semibold"
                                            : "text-neutral-500 hover:text-neutral-300"
                                    )}
                                    title={t('mockup.itsALayout')}
                                >
                                    {t('mockup.typeLayout') || 'LAYOUT'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
