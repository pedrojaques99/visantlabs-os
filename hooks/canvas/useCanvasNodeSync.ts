/**
 * useCanvasNodeSync
 * 
 * Hook dedicado para sincronização de nodes com edges
 * Extraído do useEffect gigante do useCanvasNodeHandlers
 */

import { useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, EditNodeData, MockupNodeData, PromptNodeData, AngleNodeData, VideoNodeData, VideoInputNodeData, BrandCoreData, ImageNodeData, OutputNodeData, LogoNodeData, PDFNodeData, StrategyNodeData, ShaderNodeData, UpscaleBicubicNodeData, ColorExtractorNodeData, TextNodeData, ChatNodeData } from '../../types/reactFlow';
import { getImageUrl } from '../../utils/imageUtils';
import { getImageBase64FromNode, getImageUrlFromNode } from './utils/imageSyncUtils';

interface UseCanvasNodeSyncParams {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
}

export const useCanvasNodeSync = ({
  nodes,
  edges,
  setNodes,
}: UseCanvasNodeSyncParams) => {
  const isUpdatingNodesRef = useRef(false);

  useEffect(() => {
    if (isUpdatingNodesRef.current) return;

    setNodes((nds: Node<FlowNodeData>[]) => {
      let hasChanges = false;
      const updatedNodes = nds.map((n: Node<FlowNodeData>) => {
        // Sync EditNode
        if (n.type === 'edit') {
          const editData = n.data as EditNodeData;
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(n => n.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'output';

          if (hasConnectedImage && connectedEdge && sourceNode) {
            const imageBase64 = getImageBase64FromNode(sourceNode);

            if (imageBase64 && (!editData.uploadedImage || editData.uploadedImage.base64 !== imageBase64)) {
              hasChanges = true;
              return {
                ...n,
                data: {
                  ...editData,
                  uploadedImage: {
                    base64: imageBase64,
                    mimeType: 'image/png',
                  },
                } as EditNodeData,
              } as Node<FlowNodeData>;
            }
          }
        }

        // Sync MockupNode
        if (n.type === 'mockup') {
          const mockupData = n.data as MockupNodeData;
          const updates: Partial<MockupNodeData> = {};
          let nodeHasChanges = false;

          const brandCoreEdge = edges.find(e =>
            e.target === n.id &&
            e.source &&
            nds.find(src => src.id === e.source)?.type === 'brandCore'
          );

          if (!brandCoreEdge) {
            if (mockupData.connectedLogo) {
              updates.connectedLogo = undefined;
              nodeHasChanges = true;
            }
            if (mockupData.connectedIdentity) {
              updates.connectedIdentity = undefined;
              nodeHasChanges = true;
            }
            if (mockupData.connectedTextDirection) {
              updates.connectedTextDirection = undefined;
              nodeHasChanges = true;
            }

            const imageEdge = edges.find(e =>
              e.target === n.id &&
              e.source &&
              (nds.find(src => src.id === e.source)?.type === 'image' ||
                nds.find(src => src.id === e.source)?.type === 'output')
            );

            if (imageEdge) {
              const sourceNode = nds.find(src => src.id === imageEdge.source);
              const imageUrl = sourceNode ? getImageUrlFromNode(sourceNode) : undefined;

              if (imageUrl && imageUrl.length > 0 && mockupData.connectedImage !== imageUrl) {
                updates.connectedImage = imageUrl;
                nodeHasChanges = true;
              }
            } else if (mockupData.connectedImage) {
              updates.connectedImage = undefined;
              nodeHasChanges = true;
            }
          }

          if (nodeHasChanges && Object.keys(updates).length > 0) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...mockupData,
                ...updates,
              } as MockupNodeData,
            } as Node<FlowNodeData>;
          }
        }

        // Sync PromptNode
        if (n.type === 'prompt') {
          const promptData = n.data as PromptNodeData;
          const updates: Partial<PromptNodeData> = {};
          let nodeHasChanges = false;

          const brandCoreEdge = edges.find(e =>
            e.target === n.id &&
            e.source &&
            nds.find(src => src.id === e.source)?.type === 'brandCore'
          );

          if (!brandCoreEdge) {
            if (promptData.connectedLogo) {
              updates.connectedLogo = undefined;
              nodeHasChanges = true;
            }
            if (promptData.connectedIdentity) {
              updates.connectedIdentity = undefined;
              nodeHasChanges = true;
            }
            if (promptData.connectedTextDirection) {
              updates.connectedTextDirection = undefined;
              nodeHasChanges = true;
            }
          }

          // Sync text from connected TextNode
          const textEdge = edges.find(e =>
            e.target === n.id &&
            e.targetHandle === 'text-input' &&
            e.source &&
            nds.find(src => src.id === e.source)?.type === 'text'
          );

          if (textEdge) {
            const textNode = nds.find(src => src.id === textEdge.source);
            if (textNode?.type === 'text') {
              const textData = textNode.data as TextNodeData;
              // Sync connectedText for real-time updates
              if (textData.text !== undefined) {
                if (textData.text !== promptData.connectedText) {
                  updates.connectedText = textData.text;
                  nodeHasChanges = true;
                }
                // Also update prompt in real-time when connected
                if (textData.text !== promptData.prompt) {
                  updates.prompt = textData.text;
                  nodeHasChanges = true;
                }
              }
            }
          } else {
            // If text edge was disconnected, clear connectedText but keep prompt
            if (promptData.connectedText !== undefined) {
              updates.connectedText = undefined;
              nodeHasChanges = true;
            }
          }

          if (nodeHasChanges && Object.keys(updates).length > 0) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...promptData,
                ...updates,
              } as PromptNodeData,
            } as Node<FlowNodeData>;
          }
        }

        // Sync AngleNode
        if (n.type === 'angle') {
          const angleData = n.data as AngleNodeData;
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(n => n.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'output';

          if (hasConnectedImage && connectedEdge && sourceNode) {
            const imageUrl = getImageUrlFromNode(sourceNode);

            if (imageUrl && imageUrl.length > 0 && angleData.connectedImage !== imageUrl) {
              hasChanges = true;
              return {
                ...n,
                data: {
                  ...angleData,
                  connectedImage: imageUrl,
                } as AngleNodeData,
              } as Node<FlowNodeData>;
            }
          } else if (!hasConnectedImage && angleData.connectedImage) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...angleData,
                connectedImage: undefined,
              } as AngleNodeData,
            } as Node<FlowNodeData>;
          }
        }

        // Sync VideoNode
        if (n.type === 'video') {
          const videoData = n.data as VideoNodeData;
          const connectedEdge = edges.find(e => e.target === n.id && e.targetHandle === 'input-image');
          const sourceNode = connectedEdge ? nds.find(n => n.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'output';

          if (hasConnectedImage && connectedEdge && sourceNode) {
            const imageUrl = getImageUrlFromNode(sourceNode);

            if (imageUrl && imageUrl.length > 0 && videoData.connectedImage !== imageUrl) {
              hasChanges = true;
              return {
                ...n,
                data: {
                  ...videoData,
                  connectedImage: imageUrl,
                } as VideoNodeData,
              } as Node<FlowNodeData>;
            }
          } else if (!hasConnectedImage && videoData.connectedImage) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...videoData,
                connectedImage: undefined,
              } as VideoNodeData,
            } as Node<FlowNodeData>;
          }
        }

        // Sync ShaderNode
        if (n.type === 'shader') {
          const shaderData = n.data as ShaderNodeData;
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(n => n.id === connectedEdge.source) : null;

          let newConnectedImage: string | undefined = undefined;

          if (sourceNode) {
            // Check for image from ImageNode or OutputNode
            if (sourceNode.type === 'image' || sourceNode.type === 'output') {
              const imageUrl = getImageUrlFromNode(sourceNode);
              if (imageUrl) {
                newConnectedImage = imageUrl;
              }
            }
            // Check for video from VideoInputNode
            else if (sourceNode.type === 'videoInput') {
              const videoInputData = sourceNode.data as VideoInputNodeData;
              newConnectedImage = videoInputData.uploadedVideoUrl || videoInputData.uploadedVideo;
            }
            // Check for video from VideoNode
            else if (sourceNode.type === 'video') {
              const videoData = sourceNode.data as VideoNodeData;
              if (videoData.resultVideoBase64) {
                // Ensure base64 is in data URL format
                newConnectedImage = videoData.resultVideoBase64.startsWith('data:')
                  ? videoData.resultVideoBase64
                  : `data:video/webm;base64,${videoData.resultVideoBase64}`;
              } else if (videoData.resultVideoUrl) {
                newConnectedImage = videoData.resultVideoUrl;
              }
            }
            // Check for video from OutputNode
            else if (sourceNode.type === 'output') {
              const outputData = sourceNode.data as OutputNodeData;
              newConnectedImage = outputData.resultVideoUrl || outputData.resultVideoBase64;
            }
          }

          if (shaderData.connectedImage !== newConnectedImage) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...shaderData,
                connectedImage: newConnectedImage,
              } as ShaderNodeData,
            } as Node<FlowNodeData>;
          }
        }

        // Sync UpscaleBicubicNode
        if (n.type === 'upscaleBicubic') {
          const upscaleBicubicData = n.data as UpscaleBicubicNodeData;
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(n => n.id === connectedEdge.source) : null;

          let newConnectedImage: string | undefined = undefined;

          if (sourceNode) {
            // Check for image from ImageNode or OutputNode
            if (sourceNode.type === 'image' || sourceNode.type === 'output') {
              const imageUrl = getImageUrlFromNode(sourceNode);
              if (imageUrl) {
                newConnectedImage = imageUrl;
              }
            }
            // Check for video from VideoInputNode
            else if (sourceNode.type === 'videoInput') {
              const videoInputData = sourceNode.data as VideoInputNodeData;
              newConnectedImage = videoInputData.uploadedVideoUrl || videoInputData.uploadedVideo;
            }
            // Check for video from VideoNode
            else if (sourceNode.type === 'video') {
              const videoData = sourceNode.data as VideoNodeData;
              newConnectedImage = videoData.resultVideoUrl || videoData.resultVideoBase64;
            }
            // Check for video from OutputNode
            else if (sourceNode.type === 'output') {
              const outputData = sourceNode.data as OutputNodeData;
              newConnectedImage = outputData.resultVideoUrl || outputData.resultVideoBase64;
            }
          }

          if (upscaleBicubicData.connectedImage !== newConnectedImage) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...upscaleBicubicData,
                connectedImage: newConnectedImage,
              } as UpscaleBicubicNodeData,
            } as Node<FlowNodeData>;
          }
        }

        // Sync BrandCore
        if (n.type === 'brandCore') {
          const brandCoreData = n.data as BrandCoreData;
          const connectedEdges = edges.filter(e => e.target === n.id);
          const updates: any = {};

          const logoEdge = connectedEdges.find(e => e.targetHandle === 'image-input');
          if (logoEdge) {
            const logoNode = nds.find(n => n.id === logoEdge.source);
            if (logoNode?.type === 'logo') {
              const logoData = logoNode.data as LogoNodeData;
              if (logoData.logoBase64) {
                const logoBase64 = logoData.logoBase64.startsWith('data:')
                  ? logoData.logoBase64.split(',')[1] || logoData.logoBase64
                  : logoData.logoBase64;
                if (brandCoreData.connectedLogo !== logoBase64) {
                  updates.connectedLogo = logoBase64;
                  hasChanges = true;
                }
              }
            } else if (logoNode?.type === 'image') {
              const imageData = logoNode.data as ImageNodeData;
              if (imageData.mockup?.imageBase64) {
                const logoBase64 = imageData.mockup.imageBase64.startsWith('data:')
                  ? imageData.mockup.imageBase64.split(',')[1] || imageData.mockup.imageBase64
                  : imageData.mockup.imageBase64;
                if (brandCoreData.connectedLogo !== logoBase64) {
                  updates.connectedLogo = logoBase64;
                  hasChanges = true;
                }
              }
            } else if (logoNode?.type === 'output') {
              const outputData = logoNode.data as OutputNodeData;
              if (outputData.resultImageBase64) {
                const imageBase64 = outputData.resultImageBase64.startsWith('data:')
                  ? outputData.resultImageBase64.split(',')[1] || outputData.resultImageBase64
                  : outputData.resultImageBase64;
                if (brandCoreData.connectedLogo !== imageBase64) {
                  updates.connectedLogo = imageBase64;
                  hasChanges = true;
                }
              }
            }
          } else if (brandCoreData.connectedLogo) {
            updates.connectedLogo = undefined;
            hasChanges = true;
          }

          const pdfEdge = connectedEdges.find(e => e.targetHandle === 'pdf-input');
          if (pdfEdge) {
            const pdfNode = nds.find(n => n.id === pdfEdge.source);
            if (pdfNode?.type === 'pdf') {
              const pdfData = pdfNode.data as PDFNodeData;
              if (pdfData.pdfBase64 && brandCoreData.connectedPdf !== pdfData.pdfBase64) {
                updates.connectedPdf = pdfData.pdfBase64;
                hasChanges = true;
              }
            } else if (pdfNode?.type === 'image' || pdfNode?.type === 'output' || pdfNode?.type === 'logo') {
              let imageBase64: string | undefined = undefined;
              if (pdfNode.type === 'image') {
                const imageData = pdfNode.data as ImageNodeData;
                if (imageData.mockup?.imageBase64) {
                  imageBase64 = imageData.mockup.imageBase64.startsWith('data:')
                    ? imageData.mockup.imageBase64.split(',')[1] || imageData.mockup.imageBase64
                    : imageData.mockup.imageBase64;
                }
              } else if (pdfNode.type === 'output') {
                const outputData = pdfNode.data as OutputNodeData;
                if (outputData.resultImageBase64) {
                  imageBase64 = outputData.resultImageBase64.startsWith('data:')
                    ? outputData.resultImageBase64.split(',')[1] || outputData.resultImageBase64
                    : outputData.resultImageBase64;
                }
              } else if (pdfNode.type === 'logo') {
                const logoData = pdfNode.data as LogoNodeData;
                if (logoData.logoBase64) {
                  imageBase64 = logoData.logoBase64.startsWith('data:')
                    ? logoData.logoBase64.split(',')[1] || logoData.logoBase64
                    : logoData.logoBase64;
                }
              }
              if (imageBase64 && brandCoreData.connectedImage !== imageBase64) {
                updates.connectedImage = imageBase64;
                hasChanges = true;
              }
            }
          } else {
            if (brandCoreData.connectedPdf) {
              updates.connectedPdf = undefined;
              hasChanges = true;
            }
            if (brandCoreData.connectedImage) {
              updates.connectedImage = undefined;
              hasChanges = true;
            }
          }

          const strategyEdges = connectedEdges.filter(e => e.targetHandle === 'strategy-input');
          const connectedStrategies: any[] = [];
          strategyEdges.forEach(edge => {
            const strategyNode = nds.find(n => n.id === edge.source);
            if (strategyNode?.type === 'strategy') {
              const strategyData = strategyNode.data as StrategyNodeData;
              if (strategyData.strategyData) {
                connectedStrategies.push({
                  nodeId: strategyNode.id,
                  strategyType: strategyData.strategyType || 'all',
                  data: strategyData.strategyData,
                });
              }
            }
          });

          const strategiesChanged = JSON.stringify(connectedStrategies) !== JSON.stringify(brandCoreData.connectedStrategies || []);
          if (strategiesChanged) {
            updates.connectedStrategies = connectedStrategies;
            hasChanges = true;
          }

          if (hasChanges && Object.keys(updates).length > 0) {
            return {
              ...n,
              data: {
                ...brandCoreData,
                ...updates,
              } as BrandCoreData,
            } as Node<FlowNodeData>;
          }
        }

        // Sync ColorExtractorNode
        if (n.type === 'colorExtractor') {
          const colorExtractorData = n.data as ColorExtractorNodeData;
          const updates: Partial<ColorExtractorNodeData> = {};
          let nodeHasChanges = false;

          const imageEdge = edges.find(e =>
            e.target === n.id &&
            e.targetHandle === 'image-input' &&
            e.source &&
            (nds.find(src => src.id === e.source)?.type === 'image' ||
              nds.find(src => src.id === e.source)?.type === 'output' ||
              nds.find(src => src.id === e.source)?.type === 'logo')
          );

          if (imageEdge) {
            const sourceNode = nds.find(src => src.id === imageEdge.source);
            let imageBase64: string | undefined = undefined;

            if (sourceNode) {
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
            }

            if (imageBase64 && colorExtractorData.connectedImage !== imageBase64) {
              updates.connectedImage = imageBase64;
              nodeHasChanges = true;
            }
          } else {
            if (colorExtractorData.connectedImage) {
              updates.connectedImage = undefined;
              nodeHasChanges = true;
            }
          }

          if (nodeHasChanges && Object.keys(updates).length > 0) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...colorExtractorData,
                ...updates,
              } as ColorExtractorNodeData,
            } as Node<FlowNodeData>;
          }
        }

        // Sync ChatNode
        if (n.type === 'chat') {
          const chatData = n.data as ChatNodeData;
          const updates: Partial<ChatNodeData> = {};
          let nodeHasChanges = false;
          const connectedEdges = edges.filter(e => e.target === n.id);

          // Sync text from TextNode (text-input handle)
          const textEdge = connectedEdges.find(e => e.targetHandle === 'text-input');
          if (textEdge) {
            const textNode = nds.find(src => src.id === textEdge.source);
            if (textNode?.type === 'text') {
              const textData = textNode.data as TextNodeData;
              if (textData.text !== chatData.connectedText) {
                updates.connectedText = textData.text;
                nodeHasChanges = true;
              }
            }
          } else {
            if (chatData.connectedText !== undefined) {
              updates.connectedText = undefined;
              nodeHasChanges = true;
            }
          }

          // Sync strategy from StrategyNode (strategy-input handle)
          const strategyEdge = connectedEdges.find(e => e.targetHandle === 'strategy-input');
          if (strategyEdge) {
            const strategyNode = nds.find(src => src.id === strategyEdge.source);
            if (strategyNode?.type === 'strategy') {
              const strategyNodeData = strategyNode.data as StrategyNodeData;
              const strategyChanged = JSON.stringify(strategyNodeData.strategyData) !== JSON.stringify(chatData.connectedStrategyData);
              if (strategyChanged && strategyNodeData.strategyData) {
                updates.connectedStrategyData = strategyNodeData.strategyData;
                nodeHasChanges = true;
              }
            }
          } else {
            if (chatData.connectedStrategyData !== undefined) {
              updates.connectedStrategyData = undefined;
              nodeHasChanges = true;
            }
          }

          // Sync images from ImageNode/OutputNode/LogoNode (input-1 to input-4 handles)
          const imageHandles = ['input-1', 'input-2', 'input-3', 'input-4'] as const;
          imageHandles.forEach((handleId, index) => {
            const imageEdge = connectedEdges.find(e => e.targetHandle === handleId);
            const fieldName = `connectedImage${index + 1}` as 'connectedImage1' | 'connectedImage2' | 'connectedImage3' | 'connectedImage4';

            if (imageEdge) {
              const sourceNode = nds.find(src => src.id === imageEdge.source);
              let imageBase64: string | undefined = undefined;

              if (sourceNode) {
                if (sourceNode.type === 'image') {
                  const imageData = sourceNode.data as ImageNodeData;
                  imageBase64 = imageData.mockup?.imageBase64;
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
              }

              if (imageBase64 && chatData[fieldName] !== imageBase64) {
                updates[fieldName] = imageBase64;
                nodeHasChanges = true;
              }
            } else {
              if (chatData[fieldName] !== undefined) {
                updates[fieldName] = undefined;
                nodeHasChanges = true;
              }
            }
          });

          if (nodeHasChanges && Object.keys(updates).length > 0) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...chatData,
                ...updates,
              } as ChatNodeData,
            } as Node<FlowNodeData>;
          }
        }

        return n;
      });

      if (!hasChanges) {
        return nds;
      }

      isUpdatingNodesRef.current = true;
      setTimeout(() => {
        isUpdatingNodesRef.current = false;
      }, 0);

      return updatedNodes;
    });
  }, [edges, setNodes]);
};

