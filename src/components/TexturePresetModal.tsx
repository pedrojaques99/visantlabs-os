import React from 'react';
import { Layers } from 'lucide-react';
import type { TexturePresetType } from '../types/texturePresets';
import { getAllTexturePresets } from '../services/texturePresetsService';
import { GenericPresetModal } from './shared/GenericPresetModal';

interface TexturePresetModalProps {
  isOpen: boolean;
  selectedPresetId: TexturePresetType | string;
  onClose: () => void;
  onSelectPreset: (presetId: TexturePresetType | string) => void;
  isLoading?: boolean;
}

export const TexturePresetModal: React.FC<TexturePresetModalProps> = ({
  isOpen,
  selectedPresetId,
  onClose,
  onSelectPreset,
  isLoading = false,
}) => {
  const presets = getAllTexturePresets();

  return (
    <GenericPresetModal
      isOpen={isOpen}
      selectedPresetId={selectedPresetId}
      onClose={onClose}
      onSelectPreset={onSelectPreset}
      isLoading={isLoading}
      title="Select Texture Preset"
      icon={Layers}
      officialPresets={presets}
      communityPresetType="texture"
      fallbackIcon={Layers}
    />
  );
};
