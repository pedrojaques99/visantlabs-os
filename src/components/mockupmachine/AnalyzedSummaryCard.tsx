import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { translateTag } from '@/utils/localeUtils';
import { isSafeUrl } from '@/utils/imageUtils';
import type { UploadedImage } from '@/types/types';

interface AnalyzedSummaryCardProps {
    uploadedImage: UploadedImage | null;
    selectedBrandingTags: string[];
    selectedColors: string[];
    onStartOver: () => void;
}

export const AnalyzedSummaryCard: React.FC<AnalyzedSummaryCardProps> = ({
    uploadedImage,
    selectedBrandingTags,
    selectedColors,
    onStartOver
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();

    return (
        <div className={`w-full overflow-hidden rounded-xl transition-all duration-300 gap-2 group/card ${theme === 'dark'
            ? 'bg-neutral-900/30'
            : 'bg-neutral-50/50'
            }`}>
            <div className="relative p-4 md:p-5 sm:flex-row gap-5 items-start">
                {/* Left: Aspect Video Image */}
                <div className="relative shrink-0 w-full aspect-video rounded-lg overflow-hidden border border-white/5 bg-neutral-900 shadow-inner group">
                    {uploadedImage ? (
                        <img
                            src={uploadedImage.url || (uploadedImage.base64 && isSafeUrl(`data:${uploadedImage.mimeType};base64,${uploadedImage.base64}`) ? `data:${uploadedImage.mimeType};base64,${uploadedImage.base64}` : '')}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            alt="Analyzed Design"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                            <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-widest">Empty</span>
                        </div>
                    )}
                </div>

                {/* Right: Info & Metadata */}
                <div className="w-full min-w-0 pt-2">
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
                    </div>
                </div>
            </div>
        </div>
    );
};
