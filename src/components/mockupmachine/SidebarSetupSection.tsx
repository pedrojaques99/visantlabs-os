import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { InputSection } from './InputSection';
import { useMockup } from './MockupContext';
import type { UploadedImage, DesignType } from '../../types/types';

interface SidebarSetupSectionProps {
    onImageUpload: (image: UploadedImage) => void;
    onReferenceImagesChange: (images: UploadedImage[]) => void;
    onStartOver: () => void;
    onDesignTypeChange: (type: DesignType) => void;
}

export const SidebarSetupSection: React.FC<SidebarSetupSectionProps> = ({
    onImageUpload,
    onReferenceImagesChange,
    onStartOver,
    onDesignTypeChange,
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
    } = useMockup();

    const handleScrollToSection = (sectionId: string) => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div
            id="section-setup"
            className="transition-all duration-300 w-full"
        >
            <div className="flex flex-col gap-6 items-start">
                <div className="w-full">
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
                        onDesignTypeChange={onDesignTypeChange}
                        onScrollToSection={handleScrollToSection}
                    />
                </div>

            </div>
        </div>
    );
};

