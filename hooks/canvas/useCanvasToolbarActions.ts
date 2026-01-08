import { useCallback } from 'react';
import type { Node, Connection } from '@xyflow/react';
import type { ReactFlowInstance } from '../../types/reactflow-instance';

interface UseCanvasToolbarActionsProps {
    nodes: Node[];
    onConnect: ((connection: Connection) => void) | undefined;
    reactFlowInstance: ReactFlowInstance | null;
    creators: {
        addMergeNode: (pos?: { x: number; y: number }) => string | undefined;
        addPromptNode: (pos?: { x: number; y: number }, data?: any) => string | undefined;
        addEditNode: (pos?: { x: number; y: number }) => string | undefined;
        addUpscaleNode: (pos?: { x: number; y: number }) => string | undefined;
        addMockupNode: (pos?: { x: number; y: number }) => string | undefined;
        addAngleNode: (pos?: { x: number; y: number }) => string | undefined;
        addTextureNode: (pos?: { x: number; y: number }) => string | undefined;
        addAmbienceNode: (pos?: { x: number; y: number }) => string | undefined;
        addLuminanceNode: (pos?: { x: number; y: number }) => string | undefined;
        addShaderNode: (pos?: { x: number; y: number }) => string | undefined;
        addBrandKitNodes: (pos?: { x: number; y: number }) => string[];
        addLogoNode: (pos?: { x: number; y: number }) => void;
        addPDFNode: (pos?: { x: number; y: number }) => void;
        addStrategyNode: (pos?: { x: number; y: number }) => string | undefined;
        addBrandCoreNode: (pos?: { x: number; y: number }) => void;
        addChatNode: (pos?: { x: number; y: number }) => void;
        addColorExtractorNode: (pos?: { x: number; y: number }) => void;
    };
}

export const useCanvasToolbarActions = ({
    nodes,
    onConnect,
    reactFlowInstance,
    creators,
}: UseCanvasToolbarActionsProps) => {
    const getCenterPos = useCallback(() => ({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
    }), []);

    const handleNodeAction = useCallback((
        createFn: () => string | string[] | undefined | void
    ) => {
        if (!reactFlowInstance) return;

        const result = createFn();
        if (!result) return;

        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length > 0 && onConnect) {
            setTimeout(() => {
                const sourceId = selectedNodes[0].id;
                const targetIds = Array.isArray(result) ? result : [result];

                targetIds.forEach((targetId) => {
                    onConnect({
                        source: sourceId,
                        target: targetId,
                    } as any);
                });
            }, 100);
        }
    }, [nodes, onConnect, reactFlowInstance]);

    const handleSimpleAction = useCallback((
        createFn: () => void
    ) => {
        if (!reactFlowInstance) return;
        createFn();
    }, [reactFlowInstance]);

    return {
        onAddMerge: () => handleNodeAction(() => creators.addMergeNode(getCenterPos())),
        onAddEdit: () => handleNodeAction(() => creators.addEditNode(getCenterPos())),
        onAddUpscale: () => handleNodeAction(() => creators.addUpscaleNode(getCenterPos())),
        onAddMockup: () => handleNodeAction(() => creators.addMockupNode(getCenterPos())),
        onAddAngle: () => handleNodeAction(() => creators.addAngleNode(getCenterPos())),
        onAddTexture: () => handleNodeAction(() => creators.addTextureNode(getCenterPos())),
        onAddAmbience: () => handleNodeAction(() => creators.addAmbienceNode(getCenterPos())),
        onAddLuminance: () => handleNodeAction(() => creators.addLuminanceNode(getCenterPos())),
        onAddBrandKit: () => handleNodeAction(() => creators.addBrandKitNodes(getCenterPos())),
        onAddShader: () => handleNodeAction(() => creators.addShaderNode(getCenterPos())),
        onAddPrompt: () => handleNodeAction(() => creators.addPromptNode(getCenterPos())),

        // Actions that do NOT auto-connect
        onAddLogo: () => handleSimpleAction(() => creators.addLogoNode(getCenterPos())),
        onAddPDF: () => handleSimpleAction(() => creators.addPDFNode(getCenterPos())),
        onAddStrategy: () => handleSimpleAction(() => { creators.addStrategyNode(getCenterPos()); }),
        onAddBrandCore: () => handleSimpleAction(() => creators.addBrandCoreNode(getCenterPos())),
        onAddChat: () => handleSimpleAction(() => creators.addChatNode(getCenterPos())),
        onAddColorExtractor: () => handleSimpleAction(() => creators.addColorExtractorNode(getCenterPos())),
    };
};
