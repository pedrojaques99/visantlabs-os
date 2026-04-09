import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { InputSection } from './InputSection';
import { useMockup } from './MockupContext';
import type { UploadedImage, DesignType } from '../../types/types';
import { PremiumButton } from '../ui/PremiumButton';
import { Button } from '../ui/button';
import { MicroTitle } from '../ui/MicroTitle';
import { cn } from '@/lib/utils';
import { ArrowRight, Cpu, Scan, X } from 'lucide-react';
import { PremiumGlitchLoader } from '../ui/PremiumGlitchLoader';

interface SidebarSetupSectionProps {
    onImageUpload: (image: UploadedImage) => void;
    onReferenceImagesChange: (images: UploadedImage[]) => void;
    onStartOver: () => void;
    onDesignTypeChange: (type: DesignType) => void;
    onAnalyze: () => void;
    onClose?: () => void;
}

const ANALYSIS_STEPS = [
    'Scanning Design Structure',
    'Identifying Core Objects',
    'Extracting Brand Palette',
    'Mapping Visual Anchors',
    'Optimizing Geometry',
    'Preparing Neural Engine'
];

export const SidebarSetupSection: React.FC<SidebarSetupSectionProps> = ({
    onImageUpload,
    onReferenceImagesChange,
    onStartOver,
    onDesignTypeChange,
    onAnalyze,
    onClose,
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

    return (
        <div
            id="section-setup"
            className="px-4 mx-auto w-full max-w-4xl relative"
        >
            {/* Top Close/Clear Action */}
            <div className="absolute top-0 right-[-20px]">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        onStartOver();
                        if (onClose) onClose();
                    }}
                    className="h-8 w-8 rounded-full text-neutral-500 hover:text-white hover:bg-neutral-800/50 transition-all border border-transparent hover:border-white/10"
                    title="Clear Session"
                >
                    <X size={16} />
                </Button>
            </div>
            <div className="flex-1 py-6">
                {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 animate-in fade-in duration-500">
                        <div className="w-full max-w-sm">
                            <div className="p-4 rounded-xl bg-neutral-900/30 border border-white/5 backdrop-blur-sm">
                                <PremiumGlitchLoader steps={ANALYSIS_STEPS} className="w-full" />
                            </div>
                        </div>
                    </div>
                ) : (
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
                        onScrollToSection={() => { }}
                    />
                )}
            </div>

            {/* Bottom Action Area */}
            {!isAnalyzing && (
                <div className="w-full py-6 border-t border-white/5 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3 w-full">
                        {onClose && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    onStartOver();
                                    onClose();
                                }}
                                className="h-12 px-6 text-neutral-500 hover:text-white hover:bg-white/5 font-mono text-[10px] uppercase tracking-widest border border-transparent hover:border-white/10"
                            >
                                {t('common.cancel') || 'Fechar'}
                            </Button>
                        )}
                        <PremiumButton
                            onClick={onAnalyze}
                            disabled={!canAnalyze}
                            isLoading={isAnalyzing}
                            loadingText="INITIALIZING..."
                            icon={ArrowRight}
                            className="flex-1 h-12 text-[10px] tracking-[0.1em] font-bold"
                        >
                            {t('mockup.continue') || 'CONTINUE SETUP'}
                        </PremiumButton>
                    </div>

                    {!canAnalyze && !isAnalyzing && !hasAnalyzed && !uploadedImage && (
                        <p className="text-center text-neutral-600 text-[10px] font-mono uppercase tracking-widest animate-pulse mt-1">
                            {t('mockup.uploadRequired') || 'Waiting for design input...'}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
