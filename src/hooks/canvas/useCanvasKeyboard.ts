import { useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, ImageNodeData, OutputNodeData } from '@/types/reactFlow';
import type { DrawingStroke } from './useCanvasDrawing';
import { toast } from 'sonner';
import { canvasApi } from '@/services/canvasApi';
import { getImageUrl } from '@/utils/imageUtils';
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
  addUpscaleNode?: (customPosition?: { x: number; y: number }) => string | undefined
) => {
  const logTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lifecycleLogTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastLifecycleLogRef = useRef<string>('');

  // Debounced lifecycle logger
  const debouncedLifecycleLog = (message: string, data?: any) => {
    if (lifecycleLogTimeoutRef.current) {
      clearTimeout(lifecycleLogTimeoutRef.current);
    }

    const logKey = `${message}-${JSON.stringify(data || {})}`;
    lastLifecycleLogRef.current = logKey;

    lifecycleLogTimeoutRef.current = setTimeout(() => {
      if (lastLifecycleLogRef.current === logKey) {
        console.log(message, data || '');
      }
    }, 500);
  };

  useEffect(() => {
    debouncedLifecycleLog('[Keyboard] Setting up keyboard handler', {
      hasHandleUndo: !!handleUndo,
      hasHandleRedo: !!handleRedo
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      // Debug log for all Ctrl/Cmd key presses (debounced)
      if (event.ctrlKey || event.metaKey) {
        if (logTimeoutRef.current) {
          clearTimeout(logTimeoutRef.current);
        }
        logTimeoutRef.current = setTimeout(() => {
          console.log('[Keyboard] Modifier key pressed:', event.key, {
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
            target: (event.target as HTMLElement)?.tagName,
          });
        }, 300);
      }
      // Helper function to check if user is typing in an editable element
      const isEditableElement = (element: HTMLElement | null): boolean => {
        if (!element) return false;

        // Check if element itself is editable
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable) {
          return true;
        }

        // Check if element is inside an editable container
        const parent = element.parentElement;
        if (parent) {
          if (parent.tagName === 'INPUT' || parent.tagName === 'TEXTAREA' || parent.isContentEditable) {
            return true;
          }
          // Check for elements with role="textbox" or similar
          if (parent.getAttribute('role') === 'textbox' || parent.getAttribute('contenteditable') === 'true') {
            return true;
          }
        }

        return false;
      };

      // Process Undo/Redo FIRST with highest priority, before checking editable elements
      // This ensures undo/redo works even if focus is in certain contexts
      const isUndoRedo = (event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z');

      if (isUndoRedo) {
        // Only skip if we're definitely in an input/textarea (not contentEditable for undo/redo)
        const target = event.target as HTMLElement;
        const isInInputOrTextarea = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
          (target.closest('input') !== null) || (target.closest('textarea') !== null);

        if (!isInInputOrTextarea) {
          // Undo: Ctrl+Z (or Cmd+Z on Mac)
          if (!event.shiftKey) {
            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();
            console.log('[Undo] Ctrl+Z pressed, calling handleUndo');
            handleUndo();
            return;
          }

          // Redo: Ctrl+Shift+Z (or Cmd+Shift+Z on Mac)
          if (event.shiftKey) {
            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();
            console.log('[Redo] Ctrl+Shift+Z pressed, calling handleRedo');
            handleRedo();
            return;
          }
        }
      }

      // Don't handle other shortcuts if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (isEditableElement(target)) {
        return;
      }

      // Delete key
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();

          addToHistory(nodes, edges, drawings);

          // Delete images/videos from R2 for all node types before removing them
          // Use Promise.allSettled to handle all deletions without blocking
          // Skip deletion for liked images (preserve them for MyOutputsPage)
          Promise.allSettled(
            selectedNodes.map(async (node) => {
              // Check if the node is liked (should be preserved in R2 for MyOutputsPage)
              const nodeData = node.data as any;
              const isLiked = nodeData.isLiked === true || nodeData.mockup?.isLiked === true;

              // Coletar todas as URLs do R2 que precisam ser deletadas
              const urlsToDelete = collectR2UrlsForDeletion(node, isLiked);

              // Deletar todas as URLs do R2
              if (urlsToDelete.length > 0) {
                await Promise.allSettled(
                  urlsToDelete.map(url => canvasApi.deleteImageFromR2(url))
                ).catch((error) => {
                  // Error already logged in deleteImageFromR2, continue with deletion
                  console.error('Failed to delete files from R2:', error);
                });
              }
            })
          ).catch(() => {
            // Ignore errors, continue with node deletion
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

          toast.success(`Removed ${selectedNodes.length} node${selectedNodes.length > 1 ? 's' : ''}`, { duration: 2000 });
        }
      }

      // Close context menu and deselect nodes on Escape
      if (event.key === 'Escape') {
        setContextMenu(null);

        // Deselect all selected nodes
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          setNodes((nds) =>
            nds.map((node) => ({
              ...node,
              selected: false,
            }))
          );
        }
      }

      // Upload image: U key when ImageNode is selected (only if Ctrl is not pressed)
      if ((event.key === 'u' || event.key === 'U') && !(event.ctrlKey || event.metaKey)) {
        const selectedNodes = nodes.filter(n => n.selected && n.type === 'image');
        if (selectedNodes.length > 0) {
          event.preventDefault();

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
        }
      }

      // Ctrl+A / Cmd+A - Select all nodes
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();

        const allSelected = nodes.every(n => n.selected);

        // Toggle: if all selected, deselect all; otherwise select all
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            selected: !allSelected,
          }))
        );

        return;
      }

      // Ctrl+D / Cmd+D - Duplicate selected nodes
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();

        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0 && onDuplicateNodes) {
          const selectedNodeIds = selectedNodes.map(n => n.id);
          onDuplicateNodes(selectedNodeIds);
        }

        return;
      }

      // Ctrl+K / Cmd+K - Open context menu at center of screen
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();

        if (reactFlowInstance && reactFlowWrapper?.current) {
          const pane = reactFlowWrapper.current.querySelector('.react-flow__pane');
          if (pane) {
            const rect = pane.getBoundingClientRect();
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            setContextMenu({
              x: centerX - rect.left,
              y: centerY - rect.top,
            });
          }
        }

        return;
      }

      // Ctrl+C / Cmd+C - Copy image/video from any node with media
      if ((event.ctrlKey || event.metaKey) && event.key === 'c' && !event.shiftKey) {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          // Check if any selected node has media (image or video)
          const mediaNodes = selectedNodes.filter(n => {
            const media = getMediaFromNodeForCopy(n);
            return media !== null;
          });

          if (mediaNodes.length > 0) {
            event.preventDefault();

            // Copy media from first selected node with media
            const node = mediaNodes[0];
            const media = getMediaFromNodeForCopy(node);

            if (media) {
              (async () => {
                const result = await copyMediaFromNode(node);
                if (result.success) {
                  toast.success(
                    media.isVideo
                      ? 'Video copied to clipboard!'
                      : 'Image copied to clipboard!',
                    { duration: 2000 }
                  );
                } else {
                  toast.error(result.error || 'Failed to copy media to clipboard', { duration: 3000 });
                }
              })();
            }

            return;
          }
          // Otherwise, allow default copy behavior for node data (future paste functionality)
        }
      }

      // Ctrl+Shift+C / Cmd+Shift+C - Copy as PNG from any node with media
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'c' || event.key === 'C')) {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          const mediaNodes = selectedNodes.filter(n => {
            const media = getMediaFromNodeForCopy(n);
            return media !== null;
          });

          if (mediaNodes.length > 0) {
            event.preventDefault();

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

            return;
          }
        }
      }

      // Ctrl+N / Cmd+N - Open context menu at center of screen
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();

        if (reactFlowInstance && reactFlowWrapper?.current) {
          const pane = reactFlowWrapper.current.querySelector('.react-flow__pane');
          if (pane) {
            const rect = pane.getBoundingClientRect();
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            setContextMenu({
              x: centerX - rect.left,
              y: centerY - rect.top,
            });
          }
        }

        return;
      }

      // Ctrl+M / Cmd+M - Create Mockup Node
      if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
        event.preventDefault();

        if (addMockupNode && reactFlowInstance) {
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          addMockupNode({ x: centerX, y: centerY });
        }

        return;
      }

      // Ctrl+P / Cmd+P - Create Prompt Node
      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();

        if (addPromptNode && reactFlowInstance) {
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          addPromptNode({ x: centerX, y: centerY });
        }

        return;
      }

      // Ctrl+U / Cmd+U - Create Upscale Node
      if ((event.ctrlKey || event.metaKey) && event.key === 'u') {
        event.preventDefault();

        if (addUpscaleNode && reactFlowInstance) {
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          addUpscaleNode({ x: centerX, y: centerY });
        }

        return;
      }

      // F - Focus on selected node
      if (event.key === 'f' || event.key === 'F') {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0 && reactFlowInstance && reactFlowWrapper?.current) {
          event.preventDefault();

          const firstSelectedNode = selectedNodes[0];

          // Get node dimensions (width and height from style, with fallback defaults)
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

          // Calculate the exact center of the node
          const nodeCenterX = firstSelectedNode.position.x + nodeWidth / 2;
          const nodeCenterY = firstSelectedNode.position.y + nodeHeight / 2;

          // Get viewport dimensions
          const pane = reactFlowWrapper.current.querySelector('.react-flow__pane');
          if (!pane) return;

          const rect = pane.getBoundingClientRect();
          const viewportWidth = rect.width;
          const viewportHeight = rect.height;

          // Calculate zoom to fit node height at ~75% of viewport height (visually pleasant)
          // Formula: zoom = (viewportHeight * targetRatio) / nodeHeight
          const targetHeightRatio = 0.75; // 75% of viewport height
          const calculatedZoom = (viewportHeight * targetHeightRatio) / nodeHeight;

          // Reduce zoom by 50% for better visual spacing
          const reducedZoom = calculatedZoom * 0.7;

          // Clamp zoom to reasonable bounds (minZoom: 0.01, maxZoom: 100)
          const minZoom = 0.01;
          const maxZoom = 100;
          const finalZoom = Math.max(minZoom, Math.min(maxZoom, reducedZoom));

          // Try to use setCenter with zoom if available
          if (typeof reactFlowInstance.setCenter === 'function') {
            // setCenter may support zoom in options
            try {
              reactFlowInstance.setCenter(nodeCenterX, nodeCenterY, {
                zoom: finalZoom,
                duration: 300
              });
              return;
            } catch (e) {
              // If setCenter doesn't support zoom, fall through to setViewport
            }
          }

          // Use setViewport to set both position and zoom
          if (typeof reactFlowInstance.setViewport === 'function') {
            // Calculate viewport position to center the node
            // The viewport x,y represent the offset of the flow content
            // To center node at (nodeCenterX, nodeCenterY), we need:
            // viewport.x = viewportWidth/2 - nodeCenterX * zoom
            // viewport.y = viewportHeight/2 - nodeCenterY * zoom
            const viewportX = viewportWidth / 2 - nodeCenterX * finalZoom;
            const viewportY = viewportHeight / 2 - nodeCenterY * finalZoom;

            reactFlowInstance.setViewport({
              x: viewportX,
              y: viewportY,
              zoom: finalZoom,
            }, { duration: 300 });

            return;
          }

          // Fallback: try fitView as last resort
          if (typeof reactFlowInstance.fitView === 'function') {
            reactFlowInstance.fitView({
              nodes: [firstSelectedNode.id],
              duration: 300,
              padding: 0.2,
            });
          }

          return;
        }
      }

      // Ctrl+I / Cmd+I - Upload image to ImageNode
      if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
        const selectedNodes = nodes.filter(n => n.selected && n.type === 'image');
        if (selectedNodes.length > 0) {
          event.preventDefault();

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

          return;
        }
      }
    };

    // Register listener in capture phase to ensure priority over other listeners
    debouncedLifecycleLog('[Keyboard] Registering keyboard listener');
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      debouncedLifecycleLog('[Keyboard] Unregistering keyboard listener');
      if (logTimeoutRef.current) {
        clearTimeout(logTimeoutRef.current);
      }
      if (lifecycleLogTimeoutRef.current) {
        clearTimeout(lifecycleLogTimeoutRef.current);
      }
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [nodes, edges, setNodes, setEdges, handleUndo, handleRedo, addToHistory, drawings, setContextMenu, handlersRef, reactFlowInstance, reactFlowWrapper, onDuplicateNodes, addMockupNode, addPromptNode, addUpscaleNode]);
};




