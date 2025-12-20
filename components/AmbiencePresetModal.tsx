import React from 'react';
import { MapPin } from 'lucide-react';
import type { AmbiencePresetType } from '../types/ambiencePresets';
import { getAllAmbiencePresets } from '../services/ambiencePresetsService';
import { GenericPresetModal } from './shared/GenericPresetModal';

interface AmbiencePresetModalProps {
  isOpen: boolean;
  selectedPresetId: AmbiencePresetType | string;
  onClose: () => void;
  onSelectPreset: (presetId: AmbiencePresetType | string) => void;
  isLoading?: boolean;
}

export const AmbiencePresetModal: React.FC<AmbiencePresetModalProps> = ({
  isOpen,
  selectedPresetId,
  onClose,
  onSelectPreset,
  isLoading = false,
}) => {
  const presets = getAllAmbiencePresets();

  return (
    <GenericPresetModal
      isOpen={isOpen}
      selectedPresetId={selectedPresetId}
      onClose={onClose}
      onSelectPreset={onSelectPreset}
      isLoading={isLoading}
      title="Select Ambience Preset"
      icon={MapPin}
      officialPresets={presets}
      communityPresetType="ambience"
      fallbackIcon={MapPin}
    />
  );
};
