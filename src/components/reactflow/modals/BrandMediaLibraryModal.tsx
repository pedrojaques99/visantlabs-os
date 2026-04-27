/**
 * BrandMediaLibraryModal — thin wrapper around BrandMediaLibraryPanel for modal context.
 * All content logic lives in BrandMediaLibraryPanel.
 */
import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { BrandMediaLibraryPanel } from '@/components/canvas/BrandMediaLibraryPanel';

interface BrandMediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset?: (url: string, type: 'image' | 'logo' | 'color') => void;
  onAddToBoard?: (url: string, type: 'image' | 'logo') => void;
  guidelineId?: string | null;
}

export const BrandMediaLibraryModal: React.FC<BrandMediaLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectAsset,
  onAddToBoard,
  guidelineId,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Brand Media Library" size="xl" contentClassName="bg-neutral-950/98">
    <div className="h-[600px]">
      <BrandMediaLibraryPanel
        guidelineId={guidelineId}
        onSelectAsset={onSelectAsset}
        onAddToBoard={onAddToBoard}
      />
    </div>
  </Modal>
);
