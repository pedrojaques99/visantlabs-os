import { useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import type { DrawingStroke } from './useCanvasDrawing';
import { toast } from 'sonner';
import { collectR2UrlsForDeletion } from './utils/r2UploadHelpers';
import { copyMediaFromNode, getMediaFromNodeForCopy, copyMediaAsPngFromNode } from '@/utils/canvas/canvasNodeUtils';

export const useCanvasKeyboard = (
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  setNodes: (nodes: Node<FlowNodeData>[] | ((nodes: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  setEdges: (edges: Edge[]) => void,
  setContextMenu: (menu: { x: number; y: number; sourceNodeId?: string } | null) => void,
  handleUndo: () => void,
  handleRedo: () => void,
  addToHistory: (nodes: Node<FlowNodeData>[], edges: Edge[], drawings?: DrawingStroke[]) => void,
  handlersRef: React.MutableRefObject<any>,
  drawings?: DrawingStroke[],
  reactFlowInstance?: any,
  reactFlowWrapper?: React.RefObject<HTMLDivElement>,
  onDuplicateNodes?: (nodeIds: string[]) => void,
  addMockupNode?: (customPosition?: { x: number; y: number }) => string | undefined,
  addPromptNode?: (customPosition?: { x: number; y: number }) => string | undefined,
  addUpscaleNode?: (customPosition?: { x: number; y: number }) => string | undefined,
  deleteSelectedDrawings?: () => void,
  selectedDrawingIds?: Set<string>,
  setSelectedDrawingIds?: (ids: Set<string>) => void
) => {
  // Keep refs for latest values to avoid stale closures in hotkeys
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;
  const selectedDrawingIdsRef = useRef(selectedDrawingIds);
  selectedDrawingIdsRef.current = selectedDrawingIds;

  const openNodeFileUpload = async (selectedNodes: Node<FlowNodeData>[]) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        const { fileToBase64 } = await import('@/utils/fileUtils');
        const imageData = await fileToBase64(file);

        selectedNodes.forEach(node => {
          handlersRef.current.handleUploadImage(node.id, imageData.base64);
        });
      } catch (error) {
        console.error('Failed to process uploaded image:', error);
        toast.error('Failed to upload image', { duration: 3000 });
      }

      document.body.removeChild(input);
    };

    document.body.appendChild(input);
    input.click();
  };

  // Undo: Ctrl+Z / Cmd+Z
  useHotkeys('ctrl+z,meta+z', () => {
    handleUndo();
  }, { preventDefault: true, enableOnFormTags: false });

  // Redo: Ctrl+Shift+Z / Cmd+Shift+Z
  useHotkeys('ctrl+shift+z,meta+shift+z', () => {
    handleRedo();
  }, { preventDefault: true, enableOnFormTags: false });

  // Delete / Backspace
  useHotkeys(['delete', 'backspace'], () => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const drawings = drawingsRef.current;
    const selectedDrawingIds = selectedDrawingIdsRef.current;

    const selectedNodes = nodes.filter(n => n.selected);
    const hasSelectedDrawings = selectedDrawingIds && selectedDrawingIds.size > 0;

    if (selectedNodes.length > 0 || hasSelectedDrawings) {
      addToHistory(nodes, edges, drawings);

      if (deleteSelectedDrawings) {
        deleteSelectedDrawings();
      }

      if (selectedNodes.length > 0) {
        const hasR2Assets = selectedNodes.some((node) => {
          const nodeData = node.data as any;
          const isLiked = nodeData.isLiked === true || nodeData.mockup?.isLiked === true;
          return collectR2UrlsForDeletion(node, isLiked).length > 0;
        });

        const nodeIdsToRemove = new Set(selectedNodes.map(n => n.id));
        const newNodes = nodes.filter(n => !nodeIdsToRemove.has(n.id));
        const newEdges = edges.filter(e =>
          !nodeIdsToRemove.has(e.source) && !nodeIdsToRemove.has(e.target)
        );

        setNodes(newNodes);
        setEdges(newEdges);

        setTimeout(() => {
          addToHistory(newNodes, newEdges, drawings);
        }, 0);

        if (hasR2Assets) {
          toast.warning(
            `Removed ${selectedNodes.length} node${selectedNodes.length > 1 ? 's' : ''} — images will be permanently lost on save. Undo with Ctrl+Z to recover.`,
            { duration: 5000 }
          );
        } else {
          toast.success(`Removed ${selectedNodes.length} node${selectedNodes.length > 1 ? 's' : ''}`, { duration: 2000 });
        }
      }
    }
  }, { enableOnFormTags: false });

  // Escape — close context menu and deselect nodes
  useHotkeys('escape', () => {
    setContextMenu(null);

    const nodes = nodesRef.current;
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length > 0) {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          selected: false,
        }))
      );
    }
  }, { enableOnFormTags: false });

  // Ctrl+A / Cmd+A — select all nodes and drawings
  useHotkeys('ctrl+a,meta+a', () => {
    const nodes = nodesRef.current;
    const drawings = drawingsRef.current;
    const selectedDrawingIds = selectedDrawingIdsRef.current;

    const allNodesSelected = nodes.length > 0 && nodes.every(n => n.selected);
    const allDrawingsSelected = drawings && drawings.length > 0
      ? drawings.every(d => selectedDrawingIds?.has(d.id))
      : true;

    const shouldDeselect = allNodesSelected && (drawings && drawings.length > 0 ? allDrawingsSelected : true);

    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: !shouldDeselect,
      }))
    );

    if (drawings && setSelectedDrawingIds) {
      if (shouldDeselect) {
        setSelectedDrawingIds(new Set());
      } else {
        setSelectedDrawingIds(new Set(drawings.map(d => d.id)));
      }
    }
  }, { preventDefault: true, enableOnFormTags: false });

  // Ctrl+D / Cmd+D — duplicate selected nodes
  useHotkeys('ctrl+d,meta+d', () => {
    const nodes = nodesRef.current;
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length > 0 && onDuplicateNodes) {
      onDuplicateNodes(selectedNodes.map(n => n.id));
    }
  }, { preventDefault: true, enableOnFormTags: false });

  // Ctrl+K / Cmd+K — open context menu at center of screen
  useHotkeys('ctrl+k,meta+k', () => {
    if (reactFlowInstance && reactFlowWrapper?.current) {
      const pane = reactFlowWrapper.current.querySelector('.react-flow__pane');
      if (pane) {
        const rect = pane.getBoundingClientRect();
        setContextMenu({
          x: window.innerWidth / 2 - rect.left,
          y: window.innerHeight / 2 - rect.top,
        });
      }
    }
  }, { preventDefault: true, enableOnFormTags: false });

  // Ctrl+N / Cmd+N — open context menu at center of screen (same as K)
  useHotkeys('ctrl+n,meta+n', () => {
    if (reactFlowInstance && reactFlowWrapper?.current) {
      const pane = reactFlowWrapper.current.querySelector('.react-flow__pane');
      if (pane) {
        const rect = pane.getBoundingClientRect();
        setContextMenu({
          x: window.innerWidth / 2 - rect.left,
          y: window.innerHeight / 2 - rect.top,
        });
      }
    }
  }, { preventDefault: true, enableOnFormTags: false });

  // Ctrl+C / Cmd+C — copy media from selected node
  useHotkeys('ctrl+c,meta+c', () => {
    const nodes = nodesRef.current;
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length > 0) {
      const mediaNodes = selectedNodes.filter(n => getMediaFromNodeForCopy(n) !== null);
      if (mediaNodes.length > 0) {
        const node = mediaNodes[0];
        const media = getMediaFromNodeForCopy(node);
        if (media) {
          (async () => {
            const result = await copyMediaFromNode(node);
            if (result.success) {
              toast.success(
                media.isVideo ? 'Video copied to clipboard!' : 'Image copied to clipboard!',
                { duration: 2000 }
              );
            } else {
              toast.error(result.error || 'Failed to copy media to clipboard', { duration: 3000 });
            }
          })();
        }
      }
    }
  }, { enableOnFormTags: false });

  // Ctrl+Shift+C / Cmd+Shift+C — copy as PNG
  useHotkeys('ctrl+shift+c,meta+shift+c', () => {
    const nodes = nodesRef.current;
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length > 0) {
      const mediaNodes = selectedNodes.filter(n => getMediaFromNodeForCopy(n) !== null);
      if (mediaNodes.length > 0) {
        const node = mediaNodes[0];
        const media = getMediaFromNodeForCopy(node);
        if (media) {
          (async () => {
            const result = await copyMediaAsPngFromNode(node);
            if (result.success) {
              toast.success('Image copied to clipboard as PNG!', { duration: 2000 });
            } else {
              toast.error(result.error || 'Failed to copy image as PNG to clipboard', { duration: 3000 });
            }
          })();
        }
      }
    }
  }, { preventDefault: true, enableOnFormTags: false });

  // Ctrl+M / Cmd+M — create Mockup Node
  useHotkeys('ctrl+m,meta+m', () => {
    if (addMockupNode && reactFlowInstance) {
      addMockupNode({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, { preventDefault: true, enableOnFormTags: false });

  // Ctrl+P / Cmd+P — create Prompt Node
  useHotkeys('ctrl+p,meta+p', () => {
    if (addPromptNode && reactFlowInstance) {
      addPromptNode({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, { preventDefault: true, enableOnFormTags: false });

  // Ctrl+U / Cmd+U — create Upscale Node
  useHotkeys('ctrl+u,meta+u', () => {
    if (addUpscaleNode && reactFlowInstance) {
      addUpscaleNode({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, { preventDefault: true, enableOnFormTags: false });

  // U — upload image to selected ImageNode (no modifier)
  useHotkeys('u', () => {
    const nodes = nodesRef.current;
    const selectedNodes = nodes.filter(n => n.selected && n.type === 'image');
    if (selectedNodes.length > 0) {
      openNodeFileUpload(selectedNodes);
    }
  }, { enableOnFormTags: false });

  // Ctrl+I / Cmd+I — upload image to selected ImageNode
  useHotkeys('ctrl+i,meta+i', () => {
    const nodes = nodesRef.current;
    const selectedNodes = nodes.filter(n => n.selected && n.type === 'image');
    if (selectedNodes.length > 0) {
      openNodeFileUpload(selectedNodes);
    }
  }, { enableOnFormTags: false });

  // F — focus on selected node
  useHotkeys('f', () => {
    const nodes = nodesRef.current;
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length > 0 && reactFlowInstance && reactFlowWrapper?.current) {
      const firstSelectedNode = selectedNodes[0];

      const nodeWidth = typeof firstSelectedNode.style?.width === 'number'
        ? firstSelectedNode.style.width
        : (typeof firstSelectedNode.style?.width === 'string'
          ? parseFloat(firstSelectedNode.style.width) || 150
          : 150);
      const nodeHeight = typeof firstSelectedNode.style?.height === 'number'
        ? firstSelectedNode.style.height
        : (typeof firstSelectedNode.style?.height === 'string'
          ? parseFloat(firstSelectedNode.style.height) || 100
          : 100);

      const nodeCenterX = firstSelectedNode.position.x + nodeWidth / 2;
      const nodeCenterY = firstSelectedNode.position.y + nodeHeight / 2;

      const pane = reactFlowWrapper.current.querySelector('.react-flow__pane');
      if (!pane) return;

      const rect = pane.getBoundingClientRect();
      const viewportHeight = rect.height;

      const calculatedZoom = (viewportHeight * 0.75) / nodeHeight;
      const reducedZoom = calculatedZoom * 0.7;
      const finalZoom = Math.max(0.01, Math.min(100, reducedZoom));

      if (typeof reactFlowInstance.setCenter === 'function') {
        try {
          reactFlowInstance.setCenter(nodeCenterX, nodeCenterY, { zoom: finalZoom, duration: 300 });
          return;
        } catch (e) { /* fall through */ }
      }

      if (typeof reactFlowInstance.setViewport === 'function') {
        const viewportWidth = rect.width;
        reactFlowInstance.setViewport({
          x: viewportWidth / 2 - nodeCenterX * finalZoom,
          y: viewportHeight / 2 - nodeCenterY * finalZoom,
          zoom: finalZoom,
        }, { duration: 300 });
        return;
      }

      if (typeof reactFlowInstance.fitView === 'function') {
        reactFlowInstance.fitView({ nodes: [firstSelectedNode.id], duration: 300, padding: 0.2 });
      }
    }
  }, { preventDefault: true, enableOnFormTags: false });
};
