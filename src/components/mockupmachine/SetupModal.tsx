import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Modal } from '@/components/ui/Modal';
import { SidebarSetupSection } from './SidebarSetupSection';
import { useMockup } from './MockupContext';
import type { UploadedImage, DesignType } from '../../types/types';

interface SetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImageUpload: (image: UploadedImage) => void;
    onReferenceImagesChange: (images: UploadedImage[]) => void;
    onStartOver: () => void;
    onDesignTypeChange: (type: DesignType) => void;
    onAnalyze: () => void;
    canClose?: boolean;
}

export const SetupModal: React.FC<SetupModalProps> = ({
    isOpen,
    onClose,
    onImageUpload,
    onReferenceImagesChange,
    onStartOver,
    onDesignTypeChange,
    onAnalyze,
    canClose = true,
}) => {
    const { t } = useTranslation();
    const { uploadedImage, hasAnalyzed, isAnalyzing } = useMockup();

    const canAnalyze = uploadedImage && !hasAnalyzed;

    const analyzeButton = canAnalyze ? (
        <button
            onClick={() => {
                if (import.meta.env.DEV) console.log('[dev] analyze: modal header button click');
                onAnalyze();
            }}
            disabled={isAnalyzing}
            className={`
            relative overflow-hidden group
            px-4 py-1.5 rounded-md 
            bg-brand-cyan 
            text-neutral-900 font-medium text-xs tracking-wide
            hover:bg-brand-cyan/90
            transition-all duration-200
            flex items-center gap-2
            opacity-100 animate-fade-in`}
        >
            {isAnalyzing ? (
                <span className="animate-pulse">{t('mockup.analyzing')}...</span>
            ) : (
                <span>{t('mockup.analyzeProject')}</span>
            )}
        </button>
    ) : null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={canClose ? onClose : () => { }}
            title={t('mockup.setup') || 'Setup'}
            size="xl"
            showCloseButton={canClose}
            closeOnBackdropClick={canClose}
            closeOnEscape={canClose}
            id="setup-modal"
            contentClassName="h-[90%] max-h-[90vh] bg-neutral-900"
            headerAction={analyzeButton}
        >
            <SidebarSetupSection
                onImageUpload={onImageUpload}
                onReferenceImagesChange={onReferenceImagesChange}
                onStartOver={onStartOver}
                onDesignTypeChange={onDesignTypeChange}
                onAnalyze={onAnalyze}
            />
        </Modal>
    );
};
