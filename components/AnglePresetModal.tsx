import React from 'react';
import { Camera } from 'lucide-react';
import type { AnglePresetType } from '../types/anglePresets';
import { getAllAnglePresets } from '../services/anglePresetsService';
import { GenericPresetModal } from './shared/GenericPresetModal';

interface AnglePresetModalProps {
  isOpen: boolean;
  selectedAngleId: AnglePresetType | string;
  onClose: () => void;
  onSelectAngle: (angleId: AnglePresetType | string) => void;
  isLoading?: boolean;
}

export const AnglePresetModal: React.FC<AnglePresetModalProps> = ({
  isOpen,
  selectedAngleId,
  onClose,
  onSelectAngle,
  isLoading = false,
}) => {
  const angles = getAllAnglePresets();

  return (
    <GenericPresetModal
      isOpen={isOpen}
      selectedPresetId={selectedAngleId}
      onClose={onClose}
      onSelectPreset={onSelectAngle}
      isLoading={isLoading}
      title="Select Camera Angle"
      icon={Camera}
      officialPresets={angles}
      communityPresetType="angle"
      fallbackIcon={Camera}
    />
  );
};
