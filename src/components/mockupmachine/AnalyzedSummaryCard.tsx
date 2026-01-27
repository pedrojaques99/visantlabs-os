import React, { useRef } from 'react';
import { RotateCcw, Image as ImageIcon, Plus, X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { translateTag } from '@/utils/localeUtils';
import { isSafeUrl } from '@/utils/imageUtils';
import { fileToBase64 } from '@/utils/fileUtils';
import { cn } from '@/lib/utils';
import type { UploadedImage, DesignType } from '@/types/types';

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
    selectedBrandingTags,
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
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/5 bg-neutral-900 shadow-inner group">
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
                                            className="absolute top-2 right-2 p-2 bg-neutral-950/70 hover:bg-neutral-950/90 backdrop-blur-sm border border-white/10 rounded-md transition-all duration-200 hover:border-brand-cyan/50 group/btn z-20"
                                            title={t('mockup.replaceImage') || 'Replace Image'}
                                            aria-label="Replace Image"
                                        >
                                            <ImageIcon size={16} className="text-neutral-300 group-hover/btn:text-brand-cyan transition-colors" />
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
                                                title={t('common.remove') || 'Remove'}
                                            >
                                                <X size={12} className="text-white" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {/* Add Reference Button */}
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
                                            className="w-12 h-12 rounded-md border border-dashed border-white/30 bg-black/40 backdrop-blur-sm hover:bg-black/60 hover:border-brand-cyan/50 flex items-center justify-center transition-all duration-200 group/add"
                                            title={t('mockup.addReferenceImage') || 'Add Reference'}
                                        >
                                            <Plus size={16} className="text-white/70 group-hover/add:text-brand-cyan" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info & Metadata & Design Type Switcher */}
                <div className="w-full min-w-0">
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {selectedBrandingTags.slice(0, 4).map(tag => (
                                <span key={tag} className="inline-flex items-center px-4 py-1.5 rounded-md bg-neutral-500/10 text-[10px] font-mono text-neutral-200/80 capitalize whitespace-nowrap">
                                    {translateTag(tag)}
                                </span>
                            ))}
                            {selectedBrandingTags.length > 4 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-neutral-500/10 text-[10px] font-mono text-neutral-500">
                                    +{selectedBrandingTags.length - 4}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-end justify-between mt-4">
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
                        {onDesignTypeChange && designType && (
                            <div className="flex items-center bg-neutral-900/50 rounded-md p-0.5 border border-white/5">
                                <button
                                    onClick={() => onDesignTypeChange('logo')}
                                    className={cn(
                                        "px-2 py-1 text-[10px] font-mono rounded transition-colors",
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
                                        "px-2 py-1 text-[10px] font-mono rounded transition-colors",
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
