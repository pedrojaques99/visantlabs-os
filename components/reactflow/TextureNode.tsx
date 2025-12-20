import { Layers } from 'lucide-react';
import type { TextureNodeData } from '../../types/reactFlow';
import type { TexturePresetType } from '../../types/texturePresets';
import { getAllTexturePresets, getTexturePreset } from '../../services/texturePresetsService';
import { TexturePresetModal } from '../TexturePresetModal';
import { createGenericPresetNode } from './shared/GenericPresetNode';

export const TextureNode = createGenericPresetNode<TexturePresetType, TextureNodeData>({
  icon: Layers,
  title: 'Texture Preset',
  defaultPresetId: 'wood-grain',

  getAllPresets: getAllTexturePresets,
  getPreset: getTexturePreset,
  PresetModal: TexturePresetModal,

  getSelectedPreset: (data) => data.selectedPreset,
  getConnectedImage: (data) => data.connectedImage,
  getResultImageUrl: (data) => data.resultImageUrl,
  getResultImageBase64: (data) => data.resultImageBase64,
  getIsLoading: (data) => data.isLoading,
  getOnGenerate: (data) => data.onGenerate,
  getOnUpdateData: (data) => data.onUpdateData,

  translationKeys: {
    title: 'canvasNodes.textureNode.title',
    selectPreset: 'canvasNodes.textureNode.selectTexture',
    inputImage: 'canvasNodes.textureNode.inputImage',
    connectImageNode: 'canvasNodes.textureNode.connectImageNode',
    generating: 'canvasNodes.textureNode.generating',
    generateButton: 'canvasNodes.textureNode.generateTexture',
    result: 'canvasNodes.textureNode.result',
  },

  nodeName: 'TextureNode',
});

TextureNode.displayName = 'TextureNode';
