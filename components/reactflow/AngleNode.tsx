import { Camera } from 'lucide-react';
import type { AngleNodeData } from '../../types/reactFlow';
import type { AnglePresetType } from '../../types/anglePresets';
import { getAllAnglePresets, getAnglePreset } from '../../services/anglePresetsService';
import { AnglePresetModal } from '../AnglePresetModal';
import { createGenericPresetNode } from './shared/GenericPresetNode';

export const AngleNode = createGenericPresetNode<AnglePresetType, AngleNodeData>({
  icon: Camera,
  title: 'Camera Angle',
  defaultPresetId: 'eye-level',

  getAllPresets: getAllAnglePresets,
  getPreset: getAnglePreset,
  PresetModal: AnglePresetModal,

  getSelectedPreset: (data) => data.selectedAngle,
  getConnectedImage: (data) => data.connectedImage,
  getResultImageUrl: (data) => data.resultImageUrl,
  getResultImageBase64: (data) => data.resultImageBase64,
  getIsLoading: (data) => data.isLoading,
  getOnGenerate: (data) => data.onGenerate,
  getOnUpdateData: (data) => data.onUpdateData,

  translationKeys: {
    title: 'canvasNodes.angleNode.title',
    selectPreset: 'canvasNodes.angleNode.selectAngle',
    inputImage: 'canvasNodes.angleNode.inputImage',
    connectImageNode: 'canvasNodes.angleNode.connectImageNode',
    generating: 'canvasNodes.angleNode.generating',
    generateButton: 'canvasNodes.angleNode.generateAngle',
    result: 'canvasNodes.angleNode.result',
  },

  nodeName: 'AngleNode',
});

AngleNode.displayName = 'AngleNode';
