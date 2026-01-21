import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { SidebarSetupSection } from './SidebarSetupSection';
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

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && canClose) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
            return () => {
                document.removeEventListener('keydown', handleEscape);
                document.body.style.overflow = '';
            };
        }
    }, [isOpen, onClose, canClose]);

    if (!isOpen) return null;

    return (
        <div
            id="setup-modal"
            tabIndex={-1}
            className="fixed inset-0 bg-neutral-950 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
            onClick={canClose ? onClose : undefined}
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-modal-title"
        >
            <div
                className="relative max-w-5xl w-full h-[90%] bg-neutral-900 backdrop-blur-xl border border-neutral-800/50 rounded-md shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-800/50 flex-shrink-0">
                    <h2 id="setup-modal-title" className="text-sm font-mono text-neutral-300 uppercase">
                        {t('mockup.setup') || 'Setup'}
                    </h2>
                    {canClose && (
                        <button
                            onClick={onClose}
                            className="p-2 text-neutral-500 hover:text-white transition-colors"
                            title="Close (Esc)"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                    <SidebarSetupSection
                        onImageUpload={onImageUpload}
                        onReferenceImagesChange={onReferenceImagesChange}
                        onStartOver={onStartOver}
                        onDesignTypeChange={onDesignTypeChange}
                        onAnalyze={onAnalyze}
                    />
                </div>
            </div>
        </div>
    );
};
