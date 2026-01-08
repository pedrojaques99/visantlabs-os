import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '../../types/reactFlow';

export const STANDARD_PRESET_TYPES = ['mockup', 'angle', 'texture', 'ambience', 'luminance'];

/**
 * Checks if a preset type or category should be handled by a MockupNode
 */
export const isMockupCompatible = (presetType?: string, category?: string) => {
    return STANDARD_PRESET_TYPES.includes(presetType || '') ||
        STANDARD_PRESET_TYPES.includes(category || '');
};

/**
 * Updates compatible nodes with preset data
 * @returns true if any nodes were updated
 */
export const applyPresetDataToNodes = (
    nodes: Node<FlowNodeData>[],
    preset: { id: string; prompt?: string; category?: string; presetType?: string },
    updateNodeData: (id: string, data: any) => void,
    targetNodeId?: string
) => {
    const selectedNodes = nodes.filter(n => n.selected);
    const isTargetSelected = targetNodeId ? selectedNodes.some(n => n.id === targetNodeId) : false;

    const presetType = preset.presetType || preset.category || '';
    const isStandard = isMockupCompatible(presetType);

    // If we have a specific target node (e.g. from MockupNode modal) and it's NOT selected,
    // we ONLY update that target node.
    if (targetNodeId && !isTargetSelected) {
        updateNodeData(targetNodeId, {
            selectedPreset: preset.id,
            customPrompt: '' // Reset custom prompt as per MockupNode requirement
        });
        return true;
    }

    // Find compatible selected nodes
    const compatibleNodes = selectedNodes.filter(node => {
        // MockupNodes accept any standard preset (mockup, angle, texture, ambience, luminance)
        if (node.type === 'mockup' && isStandard) return true;
        // PromptNodes accept any preset (just for the prompt)
        if (node.type === 'prompt') return true;
        return false;
    });

    if (compatibleNodes.length > 0) {
        compatibleNodes.forEach(node => {
            if (node.type === 'mockup') {
                updateNodeData(node.id, {
                    selectedPreset: preset.id,
                    customPrompt: ''
                });
            } else if (node.type === 'prompt') {
                updateNodeData(node.id, {
                    prompt: preset.prompt || ''
                });
            }
        });
        return true;
    }

    return false;
};
