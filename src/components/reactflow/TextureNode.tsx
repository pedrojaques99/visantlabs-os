import { Layers } from 'lucide-react';
import type { TextureNodeData } from '@/types/reactFlow';
import { getAllTexturePresets, getTexturePreset } from '@/services/texturePresetsService';
import { TexturePresetModal } from '../TexturePresetModal';
import { createUniversalPresetNode } from './shared/UniversalPresetNode';

export const TextureNode = createUniversalPresetNode<TextureNodeData>({
  icon: Layers,
  title: 'Texture',
  defaultPresetId: 'wood-grain',

  getAllPresets: getAllTexturePresets,
  getPreset: getTexturePreset,
  PresetModal: TexturePresetModal,
  communityPresetType: 'texture',

  translationKeys: {
    title: 'canvasNodes.textureNode.title',
    selectPreset: 'canvasNodes.textureNode.selectPreset',
    inputImage: 'canvasNodes.textureNode.inputImage',
    connectImageNode: 'canvasNodes.textureNode.connectImageNode',
    generateButton: 'canvasNodes.textureNode.generateButton',
    generating: 'canvasNodes.textureNode.generating',
    result: 'canvasNodes.textureNode.result',
  },

  nodeName: 'TextureNode',
});

TextureNode.displayName = 'TextureNode';
