import React from 'react';
import { createGenericPresetNode } from './GenericPresetNode';
import type { LucideIcon } from 'lucide-react';
import type { NodeProps, Node } from '@xyflow/react';


interface UniversalPresetNodeConfig {
    icon: LucideIcon;
    title: string;
    defaultPresetId: string;
    getAllPresets: () => any[];
    getPreset: (id: any) => any;
    PresetModal: React.ComponentType<any>;
    communityPresetType: string;
    translationKeys: {
        title: string;
        selectPreset: string;
        inputImage: string;
        connectImageNode: string;
        generateButton: string;
        generating: string;
        result: string;
    };
    nodeName: string;
}

export function createUniversalPresetNode<TNodeData extends Record<string, any>>(
    config: UniversalPresetNodeConfig
) {
    return createGenericPresetNode<string, TNodeData>({
        icon: config.icon,
        title: config.title,
        defaultPresetId: config.defaultPresetId,
        getAllPresets: config.getAllPresets,
        getPreset: config.getPreset,
        PresetModal: config.PresetModal,
        getSelectedPreset: (data) => data.selectedPreset,
        getIsLoading: (data) => data.isLoading,
        getResultImageUrl: (data) => data.resultImageUrl,
        getResultImageBase64: (data) => data.resultImageBase64,
        getConnectedImage: (data) => data.connectedImage,
        getOnGenerate: (data) => data.onGenerate,
        getOnUpdateData: (data) => data.onUpdateData,
        translationKeys: config.translationKeys,
        nodeName: config.nodeName,
    });
}
