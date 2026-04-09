import React, { useRef } from 'react';
import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { isSafeUrl } from '@/utils/imageUtils';
import { fileToBase64 } from '@/utils/fileUtils';
import { cn } from '@/lib/utils';
import type { UploadedImage } from '@/types/types';
import { useMockup } from './MockupContext';
import { SkeletonText } from '@/components/ui/SkeletonLoader';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AnalyzedSummaryCardProps {
    uploadedImage: UploadedImage | null;
    referenceImages?: UploadedImage[];
    selectedBrandingTags: string[];
    onStartOver: () => void;
    onReplaceImage?: (image: UploadedImage) => void;
    onReferenceImagesChange?: (images: UploadedImage[]) => void;
    isGenerating?: boolean;
    detectedLanguage?: string | null;
    detectedText?: string | null;
}

export const AnalyzedSummaryCard: React.FC<AnalyzedSummaryCardProps> = ({
    uploadedImage,
    referenceImages = [],
    selectedBrandingTags: _selectedBrandingTags,
    onStartOver: _onStartOver,
    onReferenceImagesChange,
    isGenerating = false,
    detectedLanguage,
    detectedText: _detectedText,
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const { isAnalyzing } = useMockup();
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
                    <div className="relative w-full h-[200px] rounded-md overflow-hidden bg-neutral-900 shadow-inner group">
                        {uploadedImage ? (
                            <>
                                <img
                                    src={uploadedImage.url || (uploadedImage.base64 && isSafeUrl(`data:${uploadedImage.mimeType};base64,${uploadedImage.base64}`) ? `data:${uploadedImage.mimeType};base64,${uploadedImage.base64}` : '')}
                                    className={cn(
                                        "w-full h-full object-contain p-4 transition-all duration-700",
                                        isAnalyzing ? "brightness-50 grayscale-[0.5] scale-95" : "brightness-100 grayscale-0 scale-100"
                                    )}
                                    alt="Analyzed Design"
                                />

                                {/* Scanning Beam Effect */}
                                {isAnalyzing && (
                                    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-cyan/10 to-transparent animate-scanline h-20 w-full" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-brand-cyan/30">
                                                <span className="text-[10px] font-mono text-brand-cyan tracking-widest uppercase">
                                                    Analyzing Structure...
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {onReplaceImage && (
                                    <>
                                        <Input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        <Button variant="ghost" onClick={() => fileInputRef.current?.click()}
                                            className="absolute top-2 right-2 p-2 bg-neutral-950/70 hover:bg-neutral-950/90 backdrop-blur-sm border border-white/10 rounded-md transition-all duration-200 hover:border-brand-cyan/50 group/btn z-20 opacity-60 group-hover:opacity-100"
                                            title={t('mockup.replaceImage') || 'Replace image'}
                                            aria-label="Replace image"
                                        >
                                            <ArrowLeftRight size={16} className="text-neutral-300 group-hover/btn:text-brand-cyan transition-colors" />
                                        </Button>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                                <SkeletonText loading={isGenerating}>
                                    <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-widest">Empty</span>
                                </SkeletonText>
                            </div>
                        )}
                        
                        {/* Detected Language Badge */}
                        {detectedLanguage && !isAnalyzing && (
                            <div className="absolute top-2 left-2 z-20 pointer-events-none">
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-950/80 backdrop-blur-md rounded border border-brand-cyan/30 shadow-lg animate-fade-in">
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
                                    <span className="text-[9px] font-mono text-brand-cyan/90 uppercase tracking-widest">
                                        {detectedLanguage}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Reference Images Overlay (Inside the same div) */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-start gap-2 z-10 pointer-events-none">
                            <div className="flex gap-2 pointer-events-auto">
                                {referenceImages.map((img, i) => (
                                    <div key={i} className="relative w-12 h-12 rounded-md overflow-hidden border border-white/20 bg-neutral-800 shadow-lg group/ref">
                                        <img
                                            src={img.url || (img.base64 ? `data:${img.mimeType || 'image/png'};base64,${img.base64}` : '')}
                                            className="w-full h-full object-contain p-1 opacity-90 group-hover/ref:opacity-300 transition-opacity"
                                            alt={`Ref ${i}`}
                                        />
                                        {onReferenceImagesChange && (
                                            <Button variant="ghost" onClick={() => handleRemoveReference(i)}
                                                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-60 group-hover/ref:opacity-100 transition-all duration-200"
                                                title={t('mockup.removeImage') || 'Remove image'}
                                            >
                                                <X size={12} className="text-white" />
                                            </Button>
                                        )}
                                    </div>
                                ))}

                                {/* Add Reference Button - slightly larger, still subtle */}
                                {onReferenceImagesChange && referenceImages.length < 3 && (
                                    <>
                                        <Input
                                            ref={referenceInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            onChange={handleReferenceSelect}
                                            className="hidden"
                                        />
                                        <Button variant="ghost" onClick={() => referenceInputRef.current?.click()}
                                            className="w-12 h-12 rounded-md border border-dashed border-white/20 bg-black/30 backdrop-blur-sm hover:bg-black/50 hover:border-brand-cyan/40 flex items-center justify-center transition-all duration-200 group/add opacity-70 hover:opacity-100"
                                            title={t('mockup.addReferenceImage') || 'Add Reference'}
                                        >
                                            <Plus size={14} className="text-white/60 group-hover/add:text-brand-cyan" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
