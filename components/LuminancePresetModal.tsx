import React from 'react';
import { Sun } from 'lucide-react';
import type { LuminancePresetType } from '../types/luminancePresets';
import { getAllLuminancePresets } from '../services/luminancePresetsService';
import { GenericPresetModal } from './shared/GenericPresetModal';

interface LuminancePresetModalProps {
  isOpen: boolean;
  selectedPresetId: LuminancePresetType | string;
  onClose: () => void;
  onSelectPreset: (presetId: LuminancePresetType | string) => void;
  isLoading?: boolean;
}

export const LuminancePresetModal: React.FC<LuminancePresetModalProps> = ({
  isOpen,
  selectedPresetId,
  onClose,
  onSelectPreset,
  isLoading = false,
}) => {
  const presets = getAllLuminancePresets();

  return (
    <GenericPresetModal
      isOpen={isOpen}
      selectedPresetId={selectedPresetId}
      onClose={onClose}
      onSelectPreset={onSelectPreset}
      isLoading={isLoading}
      title="Select Luminance Preset"
      icon={Sun}
      officialPresets={presets}
      communityPresetType="luminance"
      fallbackIcon={Sun}
    />
  );
};
