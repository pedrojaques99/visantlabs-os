import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { InputSection } from './InputSection';
import { useMockup } from './MockupContext';
import type { UploadedImage, DesignType } from '../../types/types';
import { GlitchLoader } from '../ui/GlitchLoader';
import { cn } from '@/lib/utils';
import { ArrowRight, Check } from 'lucide-react';

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
        referenceImages,
        designType,
        selectedModel,
        hasAnalyzed,
        isAnalyzing,
    } = useMockup();

    const canAnalyze = uploadedImage && !hasAnalyzed;
    const isTransparent = designType === 'logo';

    return (
        <div
            id="section-setup"
            className="transition-all duration-300 w-full flex flex-col min-h-full relative pb-24"
        >
            <div className="flex flex-col gap-4 w-full">
                {/* Upload Section */}
                <InputSection
                    uploadedImage={uploadedImage}
                    referenceImages={referenceImages}
                    designType={designType}
                    selectedModel={selectedModel}
                    onImageUpload={onImageUpload}
                    onReferenceImagesChange={onReferenceImagesChange}
                    onStartOver={onStartOver}
                    hasAnalyzed={hasAnalyzed}
                    onDesignTypeChange={onDesignTypeChange}
                    onScrollToSection={() => {}}
                />

                {/* Transparent Background Checkbox */}
                {uploadedImage && (
                    <div
                        className={cn(
                            "flex items-center gap-3 cursor-pointer group px-2 py-3 rounded-lg transition-colors",
                            theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-100/50'
                        )}
                        onClick={() => onDesignTypeChange(isTransparent ? 'layout' : 'logo')}
                        role="checkbox"
                        aria-checked={isTransparent}
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            onDesignTypeChange(isTransparent ? 'layout' : 'logo');
                        }}
                    >
                        <div className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0",
                            isTransparent
                                ? "bg-brand-cyan border-brand-cyan"
                                : theme === 'dark'
                                    ? "bg-neutral-800 border-neutral-600 group-hover:border-neutral-500"
                                    : "bg-white border-neutral-300 group-hover:border-neutral-400"
                        )}>
                            {isTransparent && <Check size={14} className="text-black" strokeWidth={3} />}
                        </div>
                        <span className={cn(
                            "text-sm font-mono transition-colors select-none",
                            theme === 'dark' ? "text-neutral-300 group-hover:text-neutral-200" : "text-neutral-600 group-hover:text-neutral-800"
                        )}>
                            {t('mockup.transparentBackground') || 'Transparent background'}
                        </span>
                    </div>
                )}
            </div>

            {/* Bottom Action Button */}
            <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-neutral-950 via-neutral-950/90 to-transparent z-40 lg:absolute lg:mt-8 lg:relative lg:bg-transparent lg:p-0">
                <button
                    onClick={onAnalyze}
                    disabled={!canAnalyze || isAnalyzing}
                    aria-label={isAnalyzing ? t('mockup.analyzing') : t('mockup.continue')}
                    aria-busy={isAnalyzing}
                    className={cn(
                        "w-full flex items-center justify-center gap-3 py-4 px-6 rounded-md font-mono text-base font-bold transition-all duration-500 group overflow-hidden relative border",
                        canAnalyze && !isAnalyzing
                            ? "bg-brand-cyan border-brand-cyan/50 text-black shadow-[0_10px_40px_rgba(var(--brand-cyan-rgb),0.2)] hover:scale-[1.01] active:scale-[0.99] hover:bg-brand-cyan/90"
                            : "bg-neutral-800/60 border-neutral-600/40 text-neutral-500 cursor-not-allowed shadow-none"
                    )}
                >
                    {isAnalyzing ? (
                        <>
                            <GlitchLoader size={18} color="black" />
                            <span className="animate-pulse tracking-widest text-sm">{t('mockup.analyzing') || 'ANALYZING...'}</span>
                        </>
                    ) : (
                        <>
                            <span className="relative z-10 flex items-center gap-2 tracking-widest">
                                {t('mockup.continue') || 'CONTINUE'}
                                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                            </span>
                            {canAnalyze && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                            )}
                        </>
                    )}
                </button>

                {!canAnalyze && !isAnalyzing && !hasAnalyzed && (
                    <p className="text-center mt-3 text-[10px] font-mono text-neutral-500 uppercase tracking-[0.2em]">
                        {!uploadedImage
                            ? (t('mockup.uploadRequired') || 'Upload required')
                            : null
                        }
                    </p>
                )}
            </div>
        </div>
    );
};
