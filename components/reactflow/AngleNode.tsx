import { Camera } from 'lucide-react';
import type { AngleNodeData } from '../../types/reactFlow';
import { getAllAnglePresets, getAnglePreset } from '../../services/anglePresetsService';
import { AnglePresetModal } from '../AnglePresetModal';
import { createUniversalPresetNode } from './shared/UniversalPresetNode';

export const AngleNode = createUniversalPresetNode<AngleNodeData>({
  icon: Camera,
  title: 'Angle',
  defaultPresetId: 'eye-level',

  getAllPresets: getAllAnglePresets,
  getPreset: getAnglePreset,
  PresetModal: AnglePresetModal,
  communityPresetType: 'angle',

  translationKeys: {
    title: 'canvasNodes.angleNode.title',
    selectPreset: 'canvasNodes.angleNode.selectPreset',
    inputImage: 'canvasNodes.angleNode.inputImage',
    connectImageNode: 'canvasNodes.angleNode.connectImageNode',
    generateButton: 'canvasNodes.angleNode.generateButton',
    generating: 'canvasNodes.angleNode.generating',
    result: 'canvasNodes.angleNode.result',
  },

  nodeName: 'AngleNode',
});

AngleNode.displayName = 'AngleNode';
