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
import { ArrowRight } from 'lucide-react';

interface SidebarSetupSectionProps {
    onImageUpload: (image: UploadedImage) => void;
    onReferenceImagesChange: (images: UploadedImage[]) => void;
    onStartOver: () => void;
    onDesignTypeChange: (type: DesignType) => void;
    onAnalyze: () => void;
    onClose?: () => void;
}

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
    const isTransparent = designType === 'logo';

    return (
        <div
            id="section-setup"
            className="flex flex-col h-full w-full gap-4 md:gap-6"
        >
            <div className="flex-1 min-h-0 flex flex-col gap-4 md:gap-6">
                <div className="flex flex-col gap-4 md:gap-6 max-w-2xl mx-auto w-full">
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
                </div>
            </div>

            {/* Bottom Action Area - More elegant and proportionate */}
            <div className="w-full pt-6 mt-2 border-t border-white/5 flex flex-col items-center gap-3">
                <div className="flex items-center gap-3 w-full max-w-md">
                    {onClose && (
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="h-12 px-6 text-neutral-500 hover:text-white hover:bg-white/5 font-mono text-xs uppercase"
                        >
                            {t('common.cancel') || 'Fechar'}
                        </Button>
                    )}
                    <PremiumButton
                        onClick={onAnalyze}
                        disabled={!canAnalyze}
                        isLoading={isAnalyzing}
                        loadingText={t('mockup.analyzing') || 'ANALYZING...'}
                        icon={ArrowRight}
                        className="flex-1 h-12 text-sm"
                    >
                        {t('mockup.continue') || 'CONTINUE'}
                    </PremiumButton>
                </div>

                {!canAnalyze && !isAnalyzing && !hasAnalyzed && !uploadedImage ? (
                    <MicroTitle as="p" className="text-center opacity-40 text-[9px] uppercase tracking-widest">
                        {t('mockup.uploadRequired') || 'Upload an image to continue'}
                    </MicroTitle>
                ) : (
                    <div className="h-2" /> 
                )}
            </div>
        </div>
    );
};
