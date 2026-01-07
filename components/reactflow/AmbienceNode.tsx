import { Sunset } from 'lucide-react';
import type { AmbienceNodeData } from '../../types/reactFlow';
import { getAllAmbiencePresets, getAmbiencePreset } from '../../services/ambiencePresetsService';
import { AmbiencePresetModal } from '../AmbiencePresetModal';
import { createUniversalPresetNode } from './shared/UniversalPresetNode';

export const AmbienceNode = createUniversalPresetNode<AmbienceNodeData>({
  icon: Sunset,
  title: 'Ambience',
  defaultPresetId: 'studio',
  getAllPresets: getAllAmbiencePresets,
  getPreset: getAmbiencePreset,
  PresetModal: AmbiencePresetModal,
  communityPresetType: 'ambience',
  translationKeys: {
    title: 'canvasNodes.ambienceNode.title',
    selectPreset: 'canvasNodes.ambienceNode.selectPreset',
    inputImage: 'canvasNodes.ambienceNode.inputImage',
    connectImageNode: 'canvasNodes.ambienceNode.connectImageNode',
    generateButton: 'canvasNodes.ambienceNode.generateButton',
    generating: 'canvasNodes.ambienceNode.generating',
    result: 'canvasNodes.ambienceNode.result',
  },
  nodeName: 'AmbienceNode',
});

AmbienceNode.displayName = 'AmbienceNode';
