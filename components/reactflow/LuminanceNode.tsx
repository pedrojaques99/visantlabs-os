import { Sun } from 'lucide-react';
import type { LuminanceNodeData } from '../../types/reactFlow';
import { getAllLuminancePresets, getLuminancePreset } from '../../services/luminancePresetsService';
import { LuminancePresetModal } from '../LuminancePresetModal';
import { createUniversalPresetNode } from './shared/UniversalPresetNode';

export const LuminanceNode = createUniversalPresetNode<LuminanceNodeData>({
  icon: Sun,
  title: 'Luminance',
  defaultPresetId: 'natural-light',
  getAllPresets: getAllLuminancePresets,
  getPreset: getLuminancePreset,
  PresetModal: LuminancePresetModal,
  communityPresetType: 'luminance',
  translationKeys: {
    title: 'canvasNodes.luminanceNode.title',
    selectPreset: 'canvasNodes.luminanceNode.selectPreset',
    inputImage: 'canvasNodes.luminanceNode.inputImage',
    connectImageNode: 'canvasNodes.luminanceNode.connectImageNode',
    generateButton: 'canvasNodes.luminanceNode.generateButton',
    generating: 'canvasNodes.luminanceNode.generating',
    result: 'canvasNodes.luminanceNode.result',
  },
  nodeName: 'LuminanceNode',
});

LuminanceNode.displayName = 'LuminanceNode';
