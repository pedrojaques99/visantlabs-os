import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';

interface CanvasContextMenuProps {
    reactFlowWrapper: React.RefObject<HTMLDivElement>;
    reactFlowInstance: any; // Using any to avoid strict type issues with generic instance
    contextMenu: { x: number; y: number; sourceNodeId?: string } | null;
    setContextMenu: (menu: null) => void;
    onConnect: (params: any) => void;
}

export const useCanvasContextMenu = ({
    reactFlowWrapper,
    reactFlowInstance,
    contextMenu,
    setContextMenu,
    onConnect,
}: CanvasContextMenuProps) => {
    /**
     * Generic handler for adding nodes from context menu
     * Calculates position relative to the pane and handles auto-connection
     */
    const handleAddNode = useCallback(
        (
            addNodeFn: (position: { x: number; y: number }, ...args: any[]) => string | undefined,
            options: {
                targetHandle?: string;
                sourceHandle?: string;
                extraArgs?: any[];
            } = {}
        ) => {
            if (!contextMenu || !reactFlowInstance || !reactFlowWrapper.current) return;

            const pane = reactFlowWrapper.current.querySelector('.react-flow__pane');
            if (!pane) return;

            const rect = pane.getBoundingClientRect();
            const position = {
                x: contextMenu.x + rect.left,
                y: contextMenu.y + rect.top,
            };

            // Call the specific add function
            const extraArgs = options.extraArgs || [];
            const newNodeId = addNodeFn(position, ...extraArgs);

            // Auto-connect if there is a source node
            if (newNodeId && contextMenu.sourceNodeId) {
                setTimeout(() => {
                    onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                        sourceHandle: options.sourceHandle,
                        targetHandle: options.targetHandle,
                    });
                }, 100);
            }

            // Close menu
            setContextMenu(null);
        },
        [contextMenu, reactFlowInstance, reactFlowWrapper, setContextMenu, onConnect]
    );

    return {
        handleAddNode,
    };
};
