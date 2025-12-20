import { Sun } from 'lucide-react';
import type { LuminanceNodeData } from '../../types/reactFlow';
import type { LuminancePresetType } from '../../types/luminancePresets';
import { getAllLuminancePresets, getLuminancePreset } from '../../services/luminancePresetsService';
import { LuminancePresetModal } from '../LuminancePresetModal';
import { createGenericPresetNode } from './shared/GenericPresetNode';

export const LuminanceNode = createGenericPresetNode<LuminancePresetType, LuminanceNodeData>({
  icon: Sun,
  title: 'Luminance Preset',
  defaultPresetId: 'natural-light',

  getAllPresets: getAllLuminancePresets,
  getPreset: getLuminancePreset,
  PresetModal: LuminancePresetModal,

  getSelectedPreset: (data) => data.selectedPreset,
  getConnectedImage: (data) => data.connectedImage,
  getResultImageUrl: (data) => data.resultImageUrl,
  getResultImageBase64: (data) => data.resultImageBase64,
  getIsLoading: (data) => data.isLoading,
  getOnGenerate: (data) => data.onGenerate,
  getOnUpdateData: (data) => data.onUpdateData,

  translationKeys: {
    title: 'canvasNodes.luminanceNode.title',
    selectPreset: 'canvasNodes.luminanceNode.selectLuminance',
    inputImage: 'canvasNodes.luminanceNode.inputImage',
    connectImageNode: 'canvasNodes.luminanceNode.connectImageNode',
    generating: 'canvasNodes.luminanceNode.generating',
    generateButton: 'canvasNodes.luminanceNode.generateLuminance',
    result: 'canvasNodes.luminanceNode.result',
  },

  nodeName: 'LuminanceNode',
});

LuminanceNode.displayName = 'LuminanceNode';
