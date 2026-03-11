import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { InputSection } from './InputSection';
import { BrandGuidelineSelector } from './BrandGuidelineSelector';
import { useMockup } from './MockupContext';
import type { UploadedImage, DesignType } from '../../types/types';
import { PremiumButton } from '../ui/PremiumButton';
import { GlassPanel } from '../ui/GlassPanel';
import { MicroTitle } from '../ui/MicroTitle';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

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
            className="flex flex-col h-full w-full gap-8"
        >
            <div className="flex-1 min-h-0 flex flex-col gap-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 auto-rows-min">
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
                        onScrollToSection={() => { }}
                    />

                    <div className="flex flex-col gap-4">
                        <MicroTitle className="px-1">
                            {t('mockup.setup') || 'CONFIGURAÇÕES'}
                        </MicroTitle>

                        <GlassPanel className="flex-1 p-4 md:p-6 overflow-y-auto max-h-[400px] lg:max-h-none">
                            {/* Brand Guideline Selection */}
                            <BrandGuidelineSelector />
                        </GlassPanel>
                    </div>
                </div>
            </div>

            {/* Bottom Action Button - Now at the end of the flex column but inside the container */}
            <div className="w-full pt-4 border-t border-white/5 bg-neutral-900/50 backdrop-blur-sm -mx-4 px-4 -mb-4 pb-4 md:-mx-8 md:px-8 md:-mb-8 md:pb-8 sticky bottom-0 z-[60]">
                <PremiumButton
                    onClick={onAnalyze}
                    disabled={!canAnalyze}
                    isLoading={isAnalyzing}
                    loadingText={t('mockup.analyzing') || 'ANALYZING...'}
                    icon={ArrowRight}
                    className="w-full h-14 text-base"
                >
                    {t('mockup.continue') || 'CONTINUE'}
                </PremiumButton>

                {!canAnalyze && !isAnalyzing && !hasAnalyzed && !uploadedImage && (
                    <MicroTitle as="p" className="text-center mt-3 block text-neutral-500 text-[10px]">
                        {t('mockup.uploadRequired') || 'Aproxime-se e envie uma imagem para continuar'}
                    </MicroTitle>
                )}
            </div>
        </div>
    );
};
