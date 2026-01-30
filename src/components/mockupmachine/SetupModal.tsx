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
      contentClassName="flex flex-col gap-4 bg-neutral-900"
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
