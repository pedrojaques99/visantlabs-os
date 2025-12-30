import { useCallback, useRef } from 'react';
import type { Node, Edge, Connection } from '@xyflow/react';
import { addEdge } from '@xyflow/react';
import type { FlowNodeData, ImageNodeData, EditNodeData, OutputNodeData, LogoNodeData, TextNodeData, PromptNodeData } from '../../types/reactFlow';
import type { UploadedImage } from '../../types';
import { cleanEdges, getMediaFromNodeForCopy } from '../../utils/canvas/canvasNodeUtils';
import { toast } from 'sonner';
import type { ReactFlowInstance } from '../../types/reactflow-instance';

// Tipos de node que são considerados "flow nodes" (node que processam imagens)
const FLOW_NODE_TYPES = ['mockup', 'merge', 'edit', 'upscale', 'prompt', 'angle'] as const;

interface NodeCreationFunctions {
  addPromptNode?: (pos?: { x: number; y: number }, data?: any) => string | undefined;
  addTextNode?: (pos?: { x: number; y: number }, text?: string, isFlowPosition?: boolean) => string | undefined;
  addStrategyNode?: (pos?: { x: number; y: number }) => string | undefined;
  addImageNode?: (pos?: { x: number; y: number }) => string | undefined;
}

export const useCanvasEvents = (
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  reactFlowWrapper: React.RefObject<HTMLDivElement>,
  setContextMenu: (menu: { x: number; y: number; sourceNodeId?: string } | null) => void,
  setEdgeContextMenu: (menu: { x: number; y: number; edgeId: string } | null) => void,
  setImageContextMenu: (menu: { x: number; y: number; nodeId: string } | null) => void,
  setNodeContextMenu: (menu: { x: number; y: number; nodeId: string } | null) => void,
  addToHistory: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void,
  reactFlowInstance: ReactFlowInstance | null,
  nodeCreators?: NodeCreationFunctions
) => {
  const connectionStartRef = useRef<{ nodeId: string; sourceHandle: string | null; handleType: string | null; x: number; y: number } | null>(null);
  const connectionCreatedRef = useRef<boolean>(false);

  // Helper function to determine handle type based on node type and handle ID
  const getHandleType = (nodeType: string | undefined, handleId: string | null | undefined, isSource: boolean): string | null => {
    if (!nodeType || !handleId) return null;

    // Source handles (outputs)
    if (isSource) {
      if (nodeType === 'image' || nodeType === 'output' || nodeType === 'logo') {
        return 'image';
      }
      if (nodeType === 'text') {
        return 'text';
      }
      if (nodeType === 'strategy') {
        return 'strategy';
      }
      return 'generic';
    }

    // Target handles (inputs)
    if (handleId === 'text-input') {
      return 'text';
    }
    if (handleId === 'strategy-input') {
      return 'strategy';
    }
    if (handleId?.startsWith('input-') || handleId === 'logo-input' || handleId === 'identity-input') {
      return 'image';
    }

    // Default based on node type for generic handles
    if (nodeType === 'image' || nodeType === 'output' || nodeType === 'logo') {
      return 'image';
    }
    if (nodeType === 'text') {
      return 'text';
    }

    return 'generic';
  };

  // Handle edge connections
  const onConnect = useCallback((params: Connection) => {
    // Mark that a connection was created
    connectionCreatedRef.current = true;

    // Validate connection params
    if (!params.source || !params.target) {
      console.warn('Invalid connection params:', params);
      return;
    }

    // Get source and target nodes
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);

    // Validate handle type compatibility
    if (sourceNode && targetNode) {
      const sourceHandle = params.sourceHandle === null || params.sourceHandle === 'null' ? undefined : params.sourceHandle;
      const targetHandle = params.targetHandle === null || params.targetHandle === 'null' ? undefined : params.targetHandle;

      const sourceHandleType = getHandleType(sourceNode.type, sourceHandle, true);
      const targetHandleType = getHandleType(targetNode.type, targetHandle, false);

      // Determine handle types even when handles are not specified (fallback to node type)
      const effectiveSourceType = sourceHandleType ||
        (sourceNode.type === 'image' || sourceNode.type === 'output' || sourceNode.type === 'logo' ? 'image' :
          sourceNode.type === 'text' ? 'text' : null);
      const effectiveTargetType = targetHandleType ||
        (targetHandle === 'text-input' ? 'text' :
          targetHandle?.startsWith('input-') || targetHandle === 'logo-input' || targetHandle === 'identity-input' ? 'image' :
            targetNode.type === 'image' || targetNode.type === 'output' || targetNode.type === 'logo' ? 'image' :
              targetNode.type === 'text' ? 'text' : null);

      // Explicitly prevent image handles from connecting to text handles
      if (effectiveSourceType === 'image' && effectiveTargetType === 'text') {
        toast.error('Não é possível conectar um handle de imagem a um handle de texto', { duration: 3000 });
        return;
      }

      // Block text → image connections (for consistency)
      if (effectiveSourceType === 'text' && effectiveTargetType === 'image') {
        toast.error('Não é possível conectar um handle de texto a um handle de imagem', { duration: 3000 });
        return;
      }

      // If both handles have types, they must match (except generic which accepts all)
      if (sourceHandleType && targetHandleType) {
        if (sourceHandleType !== 'generic' && targetHandleType !== 'generic') {
          if (sourceHandleType !== targetHandleType) {
            toast.error(
              `Cannot connect ${sourceHandleType} handle to ${targetHandleType} handle. Types must match.`,
              { duration: 3000 }
            );
            return;
          }
        }
      }
    }

    // Prevent connecting two flow nodes of the same type
    if (sourceNode && targetNode) {
      const sourceType = sourceNode.type;
      const targetType = targetNode.type;

      if (
        sourceType &&
        targetType &&
        sourceType === targetType &&
        (FLOW_NODE_TYPES as readonly string[]).includes(sourceType)
      ) {
        toast.error('Não é possível conectar dois node de fluxo do mesmo tipo', { duration: 3000 });
        return;
      }
    }

    // For BrandNode, validate connections
    if (targetNode?.type === 'brand') {
      const targetHandle = params.targetHandle;

      // Validate logo-input handle
      if (targetHandle === 'logo-input') {
        if (sourceNode && !['image', 'logo', 'output'].includes(sourceNode.type || '')) {
          toast.error('Logo input only accepts Image, Logo, or Output nodes', { duration: 3000 });
          return;
        }
      }

      // Validate identity-input handle
      if (targetHandle === 'identity-input') {
        if (sourceNode && !['pdf', 'image', 'output'].includes(sourceNode.type || '')) {
          toast.error('Identity input only accepts PDF, Image, or Output nodes', { duration: 3000 });
          return;
        }
      }
    }

    // For PromptNode, detect which handle to use based on existing connections
    let targetHandle = params.targetHandle;

    if (targetNode?.type === 'prompt') {
      // Clean targetHandle first
      if (targetHandle === null || targetHandle === 'null' || targetHandle === '') {
        targetHandle = undefined;
      }

      // If connecting a TextNode, use text-input handle
      if (sourceNode?.type === 'text') {
        targetHandle = 'text-input';
      } else {
        // For image nodes, determine max handles based on model
        const promptData = targetNode.data as any;
        const model = promptData?.model || 'gemini-2.5-flash-image';
        const maxHandles = model === 'gemini-3-pro-image-preview' ? 4 : 2;

        // If targetHandle is not explicitly set, assign based on existing connections
        if (!targetHandle) {
          const existingEdges = edges.filter(e => e.target === params.target && e.targetHandle !== 'text-input');
          const availableHandles = ['input-1', 'input-2', 'input-3', 'input-4'].slice(0, maxHandles);

          // Find first available handle
          for (const handle of availableHandles) {
            const hasHandle = existingEdges.some(e => e.targetHandle === handle);
            if (!hasHandle) {
              targetHandle = handle as 'input-1' | 'input-2' | 'input-3' | 'input-4';
              break;
            }
          }

          // If all handles are taken, replace the one that's not from the same source
          if (!targetHandle) {
            const existingFromSameSource = existingEdges.find(e => e.source === params.source);
            if (existingFromSameSource) {
              targetHandle = existingFromSameSource.targetHandle as 'input-1' | 'input-2' | 'input-3' | 'input-4';
            } else {
              // Replace input-1 by default
              targetHandle = 'input-1';
            }
          }
        } else {
          // Validate that the target handle is within the allowed range for the model
          // Skip validation for text-input handle
          if (targetHandle !== 'text-input') {
            const handleIndex = parseInt(targetHandle.replace('input-', ''));
            if (handleIndex > maxHandles) {
              // Find first available handle if specified handle is out of range
              const existingEdges = edges.filter(e => e.target === params.target && e.targetHandle !== 'text-input');
              const availableHandles = ['input-1', 'input-2', 'input-3', 'input-4'].slice(0, maxHandles);
              for (const handle of availableHandles) {
                const hasHandle = existingEdges.some(e => e.targetHandle === handle);
                if (!hasHandle) {
                  targetHandle = handle as 'input-1' | 'input-2' | 'input-3' | 'input-4';
                  break;
                }
              }
              if (!targetHandle) {
                targetHandle = 'input-1';
              }
            }
          }
        }
      }
    }

    // Clean sourceHandle and targetHandle: ensure they are undefined or valid strings, not null or "null"
    const cleanedParams: Connection = {
      ...params,
      sourceHandle: params.sourceHandle === null || params.sourceHandle === 'null' || params.sourceHandle === ''
        ? undefined
        : params.sourceHandle,
      targetHandle: targetHandle === null || targetHandle === 'null' || targetHandle === ''
        ? undefined
        : targetHandle,
    };

    addToHistory(nodes, edges);

    setEdges((eds) => {
      const newEdges = addEdge(cleanedParams, eds);
      // Clean edges immediately after addEdge to prevent null handle warnings
      const cleanedEdges = cleanEdges(newEdges);

      // If connecting ImageNode or OutputNode to EditNode, automatically set the image as uploadedImage
      const sourceNode = nodes.find(n => n.id === cleanedParams.source);
      const targetNode = nodes.find(n => n.id === cleanedParams.target);

      if ((sourceNode?.type === 'image' || sourceNode?.type === 'output') && targetNode?.type === 'edit') {
        let imageBase64: string | undefined = undefined;

        if (sourceNode.type === 'image') {
          const imageData = sourceNode.data as ImageNodeData;
          imageBase64 = imageData.mockup?.imageBase64;
        } else if (sourceNode.type === 'output') {
          const outputData = sourceNode.data as OutputNodeData;
          if (outputData.resultImageBase64) {
            // Extract base64 from data URL if needed
            imageBase64 = outputData.resultImageBase64.startsWith('data:')
              ? outputData.resultImageBase64.split(',')[1] || outputData.resultImageBase64
              : outputData.resultImageBase64;
          }
        }

        if (imageBase64) {
          const uploadedImage: UploadedImage = {
            base64: imageBase64,
            mimeType: 'image/png',
          };

          setNodes((nds: Node<FlowNodeData>[]) =>
            nds.map((n: Node<FlowNodeData>) =>
              n.id === cleanedParams.target && n.type === 'edit'
                ? {
                  ...n,
                  data: {
                    ...(n.data as EditNodeData),
                    uploadedImage: uploadedImage,
                  } as EditNodeData,
                } as Node<FlowNodeData>
                : n
            )
          );
        }
      }

      // If connecting TextNode to PromptNode, automatically set the text as prompt
      if (sourceNode?.type === 'text' && targetNode?.type === 'prompt' && cleanedParams.targetHandle === 'text-input') {
        const textData = sourceNode.data as TextNodeData;
        const promptData = targetNode.data as PromptNodeData;

        if (textData.text && textData.text !== promptData.prompt) {
          setNodes((nds: Node<FlowNodeData>[]) =>
            nds.map((n: Node<FlowNodeData>) =>
              n.id === cleanedParams.target && n.type === 'prompt'
                ? {
                  ...n,
                  data: {
                    ...(n.data as PromptNodeData),
                    prompt: textData.text,
                  } as PromptNodeData,
                } as Node<FlowNodeData>
                : n
            )
          );
        }
      }

      // Handle connections to BrandCore
      if (targetNode?.type === 'brandCore') {
        const targetHandle = cleanedParams.targetHandle;
        const brandCoreData = targetNode.data as any;
        const updates: any = {};

        // Image connection (for logo) - accepts LogoNode, ImageNode or OutputNode
        if (targetHandle === 'image-input') {
          if (sourceNode?.type === 'logo') {
            const logoData = sourceNode.data as LogoNodeData;
            if (logoData.logoBase64) {
              // Remove prefixo data: se presente
              const logoBase64 = logoData.logoBase64.startsWith('data:')
                ? logoData.logoBase64.split(',')[1] || logoData.logoBase64
                : logoData.logoBase64;
              updates.connectedLogo = logoBase64;
            }
          } else if (sourceNode?.type === 'image') {
            const imageData = sourceNode.data as ImageNodeData;
            if (imageData.mockup?.imageBase64) {
              // Remove prefixo data: se presente
              const logoBase64 = imageData.mockup.imageBase64.startsWith('data:')
                ? imageData.mockup.imageBase64.split(',')[1] || imageData.mockup.imageBase64
                : imageData.mockup.imageBase64;
              updates.connectedLogo = logoBase64;
            }
          } else if (sourceNode?.type === 'output') {
            const outputData = sourceNode.data as OutputNodeData;
            if (outputData.resultImageBase64) {
              const imageBase64 = outputData.resultImageBase64.startsWith('data:')
                ? outputData.resultImageBase64.split(',')[1] || outputData.resultImageBase64
                : outputData.resultImageBase64;
              updates.connectedLogo = imageBase64;
            }
          }
        }

        // PDF connection
        if (sourceNode?.type === 'pdf' && targetHandle === 'pdf-input') {
          const pdfData = sourceNode.data as any;
          if (pdfData.pdfBase64) {
            updates.connectedPdf = pdfData.pdfBase64;
          }
        }

        // Image connection (for identity guide PNG) - também pode usar pdf-input para PNG
        if ((sourceNode?.type === 'image' || sourceNode?.type === 'output' || sourceNode?.type === 'logo') && targetHandle === 'pdf-input') {
          let imageBase64: string | undefined = undefined;
          if (sourceNode.type === 'image') {
            const imageData = sourceNode.data as ImageNodeData;
            imageBase64 = imageData.mockup?.imageBase64;
            if (imageBase64) {
              imageBase64 = imageBase64.startsWith('data:')
                ? imageBase64.split(',')[1] || imageBase64
                : imageBase64;
            }
          } else if (sourceNode.type === 'output') {
            const outputData = sourceNode.data as OutputNodeData;
            if (outputData.resultImageBase64) {
              imageBase64 = outputData.resultImageBase64.startsWith('data:')
                ? outputData.resultImageBase64.split(',')[1] || outputData.resultImageBase64
                : outputData.resultImageBase64;
            }
          } else if (sourceNode.type === 'logo') {
            const logoData = sourceNode.data as LogoNodeData;
            if (logoData.logoBase64) {
              imageBase64 = logoData.logoBase64.startsWith('data:')
                ? logoData.logoBase64.split(',')[1] || logoData.logoBase64
                : logoData.logoBase64;
            }
          }
          if (imageBase64) {
            updates.connectedImage = imageBase64;
          }
        }

        // Strategy connection
        if (sourceNode?.type === 'strategy' && targetHandle === 'strategy-input') {
          const strategyData = sourceNode.data as any;
          const existingStrategies = brandCoreData.connectedStrategies || [];
          const strategyExists = existingStrategies.some((s: any) => s.nodeId === sourceNode.id);

          if (!strategyExists && strategyData.strategyData) {
            updates.connectedStrategies = [
              ...existingStrategies,
              {
                nodeId: sourceNode.id,
                strategyType: strategyData.strategyType || 'all',
                data: strategyData.strategyData,
              },
            ];
          }
        }

        // Update BrandCore if there are changes
        if (Object.keys(updates).length > 0) {
          setNodes((nds: Node<FlowNodeData>[]) =>
            nds.map((n: Node<FlowNodeData>) =>
              n.id === cleanedParams.target && n.type === 'brandCore'
                ? {
                  ...n,
                  data: {
                    ...brandCoreData,
                    ...updates,
                  },
                } as Node<FlowNodeData>
                : n
            )
          );
        }
      }

      // Color Extractor connection
      if ((sourceNode?.type === 'image' || sourceNode?.type === 'output' || sourceNode?.type === 'logo') && targetNode?.type === 'colorExtractor' && cleanedParams.targetHandle === 'image-input') {
        let imageBase64: string | undefined = undefined;
        if (sourceNode.type === 'image') {
          const imageData = sourceNode.data as ImageNodeData;
          imageBase64 = imageData.mockup?.imageBase64;
          if (imageBase64) {
            imageBase64 = imageBase64.startsWith('data:')
              ? imageBase64.split(',')[1] || imageBase64
              : imageBase64;
          }
        } else if (sourceNode.type === 'output') {
          const outputData = sourceNode.data as OutputNodeData;
          if (outputData.resultImageBase64) {
            imageBase64 = outputData.resultImageBase64.startsWith('data:')
              ? outputData.resultImageBase64.split(',')[1] || outputData.resultImageBase64
              : outputData.resultImageBase64;
          }
        } else if (sourceNode.type === 'logo') {
          const logoData = sourceNode.data as LogoNodeData;
          if (logoData.logoBase64) {
            imageBase64 = logoData.logoBase64.startsWith('data:')
              ? logoData.logoBase64.split(',')[1] || logoData.logoBase64
              : logoData.logoBase64;
          }
        }
        if (imageBase64) {
          const colorExtractorData = targetNode.data as any;
          setNodes((nds: Node<FlowNodeData>[]) =>
            nds.map((n: Node<FlowNodeData>) =>
              n.id === cleanedParams.target && n.type === 'colorExtractor'
                ? {
                  ...n,
                  data: {
                    ...colorExtractorData,
                    connectedImage: imageBase64,
                  },
                } as Node<FlowNodeData>
                : n
            )
          );
        }
      }

      // Handle connections FROM BrandCore (smart output handle)
      if (sourceNode?.type === 'brandCore' && cleanedParams.sourceHandle === 'prompt-output') {
        const brandCoreData = sourceNode.data as any;

        // Detect target node type and pass appropriate data
        if (targetNode?.type === 'prompt') {
          // For Prompt Nodes: pass images (logo, identity), text direction, and brandIdentity
          setNodes((nds: Node<FlowNodeData>[]) =>
            nds.map((n: Node<FlowNodeData>) =>
              n.id === cleanedParams.target && n.type === 'prompt'
                ? {
                  ...n,
                  data: {
                    ...(n.data as any),
                    // Pass logo and identity images from BrandCore
                    connectedLogo: brandCoreData.connectedLogo || brandCoreData.uploadedLogo,
                    connectedIdentity: brandCoreData.connectedPdf || brandCoreData.connectedImage || brandCoreData.uploadedIdentityUrl || brandCoreData.uploadedIdentity,
                    // Pass text direction from visual prompts (compositionPrompt or stylePrompt)
                    connectedTextDirection: brandCoreData.visualPrompts?.compositionPrompt || brandCoreData.visualPrompts?.stylePrompt,
                    // Also pass brandIdentity for backward compatibility
                    connectedBrandIdentity: brandCoreData.brandIdentity,
                  },
                } as Node<FlowNodeData>
                : n
            )
          );
        } else if (targetNode?.type === 'strategy') {
          // For Strategy Nodes: pass strategic prompts (consolidated strategies)
          if (brandCoreData.strategicPrompts?.consolidated) {
            setNodes((nds: Node<FlowNodeData>[]) =>
              nds.map((n: Node<FlowNodeData>) =>
                n.id === cleanedParams.target && n.type === 'strategy'
                  ? {
                    ...n,
                    data: {
                      ...(n.data as any),
                      // Pass consolidated strategic data to strategy node
                      connectedStrategicData: brandCoreData.strategicPrompts.consolidated,
                    },
                  } as Node<FlowNodeData>
                  : n
              )
            );
          }
        } else if (targetNode?.type === 'mockup') {
          // For Mockup Nodes: pass images (logo, identity), text direction (mockupPrompt), and strategy data
          setNodes((nds: Node<FlowNodeData>[]) =>
            nds.map((n: Node<FlowNodeData>) =>
              n.id === cleanedParams.target && n.type === 'mockup'
                ? {
                  ...n,
                  data: {
                    ...(n.data as any),
                    // Pass logo and identity images from BrandCore
                    connectedLogo: brandCoreData.connectedLogo || brandCoreData.uploadedLogo,
                    connectedIdentity: brandCoreData.connectedPdf || brandCoreData.connectedImage || brandCoreData.uploadedIdentityUrl || brandCoreData.uploadedIdentity,
                    // Pass text direction from visual prompts
                    connectedTextDirection: brandCoreData.visualPrompts?.mockupPrompt,
                    // Pass strategy data if available
                    connectedStrategyData: brandCoreData.strategicPrompts?.consolidated,
                  },
                } as Node<FlowNodeData>
                : n
            )
          );
        } else if (targetNode?.type === 'chat') {
          // For Chat Nodes: pass strategy data if available
          if (brandCoreData.strategicPrompts?.consolidated) {
            setNodes((nds: Node<FlowNodeData>[]) =>
              nds.map((n: Node<FlowNodeData>) =>
                n.id === cleanedParams.target && n.type === 'chat'
                  ? {
                    ...n,
                    data: {
                      ...(n.data as any),
                      connectedStrategyData: brandCoreData.strategicPrompts.consolidated,
                    },
                  } as Node<FlowNodeData>
                  : n
              )
            );
          }
        }
        // For other node types, we can extend this logic as needed
      }

      setTimeout(() => {
        addToHistory(nodes, cleanedEdges);
      }, 0);
      return cleanedEdges;
    });
  }, [nodes, edges, setEdges, setNodes, addToHistory]);

  // Handle node drag end - add to history when drag completes
  const onNodeDragStop = useCallback(() => {
    // Add current state to history after drag completes
    // This allows undo to restore node positions
    addToHistory(nodes, edges);
  }, [nodes, edges, addToHistory]);

  // Handle context menu (right-click)
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
    if (!pane) return;

    const rect = pane.getBoundingClientRect();
    setContextMenu({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }, [reactFlowWrapper, setContextMenu]);

  // Handle node context menu (right-click on node)
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node<FlowNodeData>) => {
    event.preventDefault();
    event.stopPropagation();

    // Show image context menu for any node that has media (image or video)
    const hasMedia = getMediaFromNodeForCopy(node) !== null;
    if (hasMedia) {
      // Use clientX/clientY directly for position: fixed
      setImageContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    } else {
      // Show generic node context menu for other node types
      setNodeContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    }
  }, [setImageContextMenu, setNodeContextMenu]);

  // Handle edge click
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    event.stopPropagation();

    // If Ctrl is pressed, remove the edge directly
    if (event.ctrlKey || event.metaKey) {
      addToHistory(nodes, edges);

      const newEdges = edges.filter(e => e.id !== edge.id);
      setEdges(newEdges);

      setTimeout(() => {
        addToHistory(nodes, newEdges);
      }, 0);

      setEdgeContextMenu(null);
      toast.success('Connection removed', { duration: 2000 });
      return;
    }

    // Otherwise, show context menu (for left click)
    // Use clientX/clientY directly for position: fixed
    setEdgeContextMenu({
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
    });
  }, [setEdgeContextMenu, nodes, edges, setEdges, addToHistory]);

  // Handle edge context menu (right-click)
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    event.stopPropagation();

    // Use clientX/clientY directly for position: fixed
    setEdgeContextMenu({
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
    });
  }, [setEdgeContextMenu]);

  // Handle remove edge
  const handleRemoveEdge = useCallback((edgeId: string) => {
    addToHistory(nodes, edges);

    const newEdges = edges.filter(e => e.id !== edgeId);
    setEdges(newEdges);

    setTimeout(() => {
      addToHistory(nodes, newEdges);
    }, 0);

    setEdgeContextMenu(null);
    toast.success('Connection removed', { duration: 2000 });
  }, [nodes, edges, setEdges, addToHistory, setEdgeContextMenu]);

  // Handle connection start (when dragging from handle)
  const onConnectStart = useCallback((event: MouseEvent | TouchEvent, { nodeId, handleId }: { nodeId: string | null; handleId?: string | null }) => {
    if (nodeId) {
      const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
      if (pane) {
        const rect = pane.getBoundingClientRect();
        const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
        const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;
        
        // Find source node to determine handle type
        const sourceNode = nodes.find(n => n.id === nodeId);
        let handleType: string | null = null;
        
        if (sourceNode) {
          // Try to get handle type from DOM element
          const handleElement = document.elementFromPoint(clientX, clientY)?.closest('.react-flow__handle');
          const domHandleType = handleElement?.getAttribute('data-handle-type');
          
          if (domHandleType) {
            handleType = domHandleType;
          } else if (handleId) {
            // Fallback to getHandleType function if handleId is available
            handleType = getHandleType(sourceNode.type, handleId, true);
          }
          
          // If still no handleType, determine from node type
          if (!handleType) {
            if (sourceNode.type === 'image' || sourceNode.type === 'output' || sourceNode.type === 'logo') {
              handleType = 'image';
            } else if (sourceNode.type === 'text') {
              handleType = 'text';
            } else if (sourceNode.type === 'strategy') {
              handleType = 'strategy';
            } else {
              handleType = 'generic';
            }
          }
        }
        
        connectionStartRef.current = {
          nodeId,
          sourceHandle: handleId || null,
          handleType,
          x: clientX - rect.left,
          y: clientY - rect.top,
        };
      }
    }
  }, [reactFlowWrapper, nodes]);

  // Helper function to find nearest target handle in a node
  const findNearestTargetHandle = useCallback((
    targetNode: Node<FlowNodeData>,
    dropPosition: { x: number; y: number },
    reactFlowInstance: ReactFlowInstance
  ): { handleId: string | undefined; distance: number } | null => {
    if (!reactFlowInstance) return null;

    // Get node element from DOM
    const nodeElement = document.querySelector(`[data-id="${targetNode.id}"]`) as HTMLElement;
    if (!nodeElement) return null;

    const nodeRect = nodeElement.getBoundingClientRect();
    const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
    if (!pane) return null;

    const paneRect = pane.getBoundingClientRect();

    // Convert drop position to flow coordinates
    const flowPosition = reactFlowInstance.screenToFlowPosition({
      x: dropPosition.x - paneRect.left,
      y: dropPosition.y - paneRect.top,
    });

    // Find all target handles in this node
    const targetHandles = nodeElement.querySelectorAll('.react-flow__handle-target');
    let nearestHandle: { handleId: string | undefined; distance: number } | null = null;
    let minDistance = Infinity;

    targetHandles.forEach((handle) => {
      const handleRect = handle.getBoundingClientRect();
      const handleCenterX = handleRect.left + handleRect.width / 2;
      const handleCenterY = handleRect.top + handleRect.height / 2;

      // Convert handle position to flow coordinates
      const handleFlowPos = reactFlowInstance.screenToFlowPosition({
        x: handleCenterX - paneRect.left,
        y: handleCenterY - paneRect.top,
      });

      // Calculate distance
      const dx = flowPosition.x - handleFlowPos.x;
      const dy = flowPosition.y - handleFlowPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        // ReactFlow uses 'data-handleid' or 'id' attribute for handle identification
        const handleId = handle.getAttribute('data-handleid') ||
          handle.getAttribute('id') ||
          undefined;
        minDistance = distance;
        nearestHandle = { handleId, distance };
      }
    });

    return nearestHandle;
  }, [reactFlowWrapper]);

  // Handle connection end (when dropping on canvas or another handle)
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const connectionStart = connectionStartRef.current;
    const wasConnectionCreated = connectionCreatedRef.current;

    // Reset refs
    connectionStartRef.current = null;
    connectionCreatedRef.current = false;

    // If a connection was already created (by ReactFlow), don't do anything
    if (wasConnectionCreated) {
      return;
    }

    if (!connectionStart || !reactFlowInstance) return;

    const sourceNode = nodes.find(n => n.id === connectionStart.nodeId);
    if (!sourceNode) return;

    const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
    if (!pane) return;

    const rect = pane.getBoundingClientRect();
    const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
    const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;

    // Check if dropped directly on a target handle (ReactFlow handles this automatically)
    const targetHandle = document.elementFromPoint(clientX, clientY)?.closest('.react-flow__handle-target');

    // Check if dropped on a node (anywhere in the node area)
    const targetNodeElement = document.elementFromPoint(clientX, clientY)?.closest('.react-flow__node');

    if (targetNodeElement && !targetHandle) {
      // Dropped on a node but not directly on handle - find nearest handle
      const targetNodeId = targetNodeElement.getAttribute('data-id');
      if (targetNodeId) {
        const targetNode = nodes.find(n => n.id === targetNodeId);
        if (targetNode && targetNode.id !== sourceNode.id) {
          // Find nearest target handle
          const nearestHandle = findNearestTargetHandle(
            targetNode,
            { x: clientX, y: clientY },
            reactFlowInstance
          );

          if (nearestHandle && nearestHandle.distance < 200) { // Max distance threshold
            // Create connection to nearest handle
            const connection: Connection = {
              source: sourceNode.id,
              target: targetNode.id,
              sourceHandle: undefined,
              targetHandle: nearestHandle.handleId,
            };

            // Use the existing onConnect logic
            onConnect(connection);
            return;
          }
        }
      }
    }

    // If dropped on empty canvas, create node based on handle type
    if (!targetNodeElement && !targetHandle && nodeCreators) {
      const handleType = connectionStart.handleType;
      
      // Determine node type to create based on handle type
      let nodeTypeToCreate: 'prompt' | 'text' | 'strategy' | 'image' | null = null;
      let createNodeFn: ((pos?: { x: number; y: number }, data?: any) => string | undefined) | undefined;
      
      if (handleType === 'image') {
        nodeTypeToCreate = 'image';
        createNodeFn = nodeCreators.addImageNode;
      } else if (handleType === 'generic') {
        nodeTypeToCreate = 'prompt';
        createNodeFn = nodeCreators.addPromptNode;
      } else if (handleType === 'text') {
        nodeTypeToCreate = 'text';
        createNodeFn = nodeCreators.addTextNode;
      } else if (handleType === 'strategy') {
        nodeTypeToCreate = 'strategy';
        createNodeFn = nodeCreators.addStrategyNode;
      }
      
      if (nodeTypeToCreate && createNodeFn) {
        const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
        if (pane && reactFlowInstance) {
          const paneRect = pane.getBoundingClientRect();
          
          // For text node, pass flow coordinates with isFlowPosition flag
          // For prompt and strategy, pass screen coordinates (they convert internally)
          let newNodeId: string | undefined;
          
          if (nodeTypeToCreate === 'text') {
            const flowPosition = reactFlowInstance.screenToFlowPosition({
              x: clientX - paneRect.left,
              y: clientY - paneRect.top,
            });
            newNodeId = createNodeFn(flowPosition, undefined, true);
          } else {
            // Prompt and strategy expect screen coordinates
            newNodeId = createNodeFn({
              x: clientX,
              y: clientY,
            });
          }
          
          if (newNodeId) {
            // Connect the new node to the source node after a short delay
            // Use a longer delay to ensure the node is fully rendered
            setTimeout(() => {
              // Determine correct sourceHandle - only use if it's actually a source handle
              // Don't use target handles (like "input-1") as sourceHandle
              let sourceHandle: string | undefined = undefined;
              if (connectionStart.sourceHandle) {
                // Check if sourceHandle is actually a source handle (not a target handle like "input-1")
                const sourceNode = nodes.find(n => n.id === connectionStart.nodeId);
                if (sourceNode) {
                  // If sourceHandle starts with "input-" or is a known target handle, ignore it
                  if (!connectionStart.sourceHandle.startsWith('input-') && 
                      connectionStart.sourceHandle !== 'text-input' && 
                      connectionStart.sourceHandle !== 'strategy-input' &&
                      connectionStart.sourceHandle !== 'logo-input' &&
                      connectionStart.sourceHandle !== 'identity-input') {
                    sourceHandle = connectionStart.sourceHandle;
                  }
                }
              }
              
              // Determine target handle based on node type and handle type
              let targetHandle: string | undefined = undefined;
              if (nodeTypeToCreate === 'prompt') {
                // PromptNode accepts image inputs
                if (handleType === 'image' || handleType === 'generic') {
                  targetHandle = 'input-1';
                } else if (handleType === 'text') {
                  targetHandle = 'text-input';
                }
              } else if (nodeTypeToCreate === 'image') {
                // ImageNode has a default target handle via NodeHandles (no specific ID, so undefined uses default)
                // Connect if source handle type is image
                if (handleType === 'image' || handleType === 'generic') {
                  targetHandle = undefined; // Use default target handle
                }
              } else if (nodeTypeToCreate === 'text') {
                // TextNode doesn't accept input connections
                targetHandle = undefined;
              } else if (nodeTypeToCreate === 'strategy') {
                // StrategyNode doesn't accept input connections
                targetHandle = undefined;
              }
              
              // Create connection if we have a valid target (targetHandle can be undefined for default handles)
              // Only skip if nodeType explicitly doesn't accept connections
              if (nodeTypeToCreate !== 'text' && nodeTypeToCreate !== 'strategy') {
                const connection: Connection = {
                  source: connectionStart.nodeId,
                  target: newNodeId!,
                  sourceHandle: sourceHandle,
                  targetHandle: targetHandle,
                };
                
                onConnect(connection);
              }
            }, 150);
            
            return;
          }
        }
      }
    }
    
    // If connection was started from an ImageNode or OutputNode and dropped on empty canvas
    if ((sourceNode.type === 'image' || sourceNode.type === 'output') && !targetNodeElement) {
      // Dropped on empty canvas - open context menu with source node info
      setContextMenu({
        x: clientX - rect.left,
        y: clientY - rect.top,
        sourceNodeId: connectionStart.nodeId,
      });
    }
  }, [nodes, reactFlowWrapper, setContextMenu, reactFlowInstance, findNearestTargetHandle, onConnect, nodeCreators]);

  return {
    onConnect,
    onConnectStart,
    onConnectEnd,
    onNodeDragStop,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeClick,
    onEdgeContextMenu,
    handleRemoveEdge,
  };
};



