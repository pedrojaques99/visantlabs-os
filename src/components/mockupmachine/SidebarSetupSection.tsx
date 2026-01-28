import React, { useState } from 'react';
import { Pencil, FileText, X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { InputSection } from './InputSection';
import { useMockup } from './MockupContext';
import type { UploadedImage, DesignType } from '../../types/types';
import { Button } from '../ui/button';

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
        selectedModel,
        hasAnalyzed,
        instructions,
        setInstructions,
    } = useMockup();

    const [isEditingInstructions, setIsEditingInstructions] = useState(false);

    const handleScrollToSection = (sectionId: string) => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div
            id="section-setup"
            className="transition-all duration-300 space-y-6 max-w-2xl mx-auto"
        >
            <div className="flex flex-col gap-6 items-center">
                {/* Input Media Section */}
                <div className="w-full rounded-xl overflow-hidden border border-white/5 bg-neutral-900/50">
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

                {/* Compact Instructions Button */}
                <div className="w-full flex flex-col items-center gap-3">
                    {!isEditingInstructions ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditingInstructions(true)}
                            className="text-neutral-500 hover:text-brand-cyan gap-2 font-mono text-xs uppercase tracking-wider"
                        >
                            <Pencil size={14} />
                            {instructions ? t('mockup.editInstructions') : t('mockup.addInstructions')}
                        </Button>
                    ) : (
                        <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-neutral-400">
                                    <FileText size={14} />
                                    <span className="text-[10px] uppercase font-mono tracking-widest">{t('mockup.instructions')}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsEditingInstructions(false)}
                                    className="h-6 w-6 text-neutral-500 hover:text-white"
                                >
                                    <X size={14} />
                                </Button>
                            </div>
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder={t('mockup.instructionsPlaceholder')}
                                className="w-full min-h-[100px] p-4 text-sm font-mono bg-neutral-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-brand-cyan/50 resize-none text-white shadow-xl placeholder:text-neutral-700"
                                autoFocus
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

