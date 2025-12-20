import { MapPin } from 'lucide-react';
import type { AmbienceNodeData } from '../../types/reactFlow';
import type { AmbiencePresetType } from '../../types/ambiencePresets';
import { getAllAmbiencePresets, getAmbiencePreset } from '../../services/ambiencePresetsService';
import { AmbiencePresetModal } from '../AmbiencePresetModal';
import { createGenericPresetNode } from './shared/GenericPresetNode';

export const AmbienceNode = createGenericPresetNode<AmbiencePresetType, AmbienceNodeData>({
  icon: MapPin,
  title: 'Ambience Preset',
  defaultPresetId: 'studio',

  getAllPresets: getAllAmbiencePresets,
  getPreset: getAmbiencePreset,
  PresetModal: AmbiencePresetModal,

  getSelectedPreset: (data) => data.selectedPreset,
  getConnectedImage: (data) => data.connectedImage,
  getResultImageUrl: (data) => data.resultImageUrl,
  getResultImageBase64: (data) => data.resultImageBase64,
  getIsLoading: (data) => data.isLoading,
  getOnGenerate: (data) => data.onGenerate,
  getOnUpdateData: (data) => data.onUpdateData,

  translationKeys: {
    title: 'canvasNodes.ambienceNode.title',
    selectPreset: 'canvasNodes.ambienceNode.selectAmbience',
    inputImage: 'canvasNodes.ambienceNode.inputImage',
    connectImageNode: 'canvasNodes.ambienceNode.connectImageNode',
    generating: 'canvasNodes.ambienceNode.generating',
    generateButton: 'canvasNodes.ambienceNode.generateAmbience',
    result: 'canvasNodes.ambienceNode.result',
  },

  nodeName: 'AmbienceNode',
});

AmbienceNode.displayName = 'AmbienceNode';
