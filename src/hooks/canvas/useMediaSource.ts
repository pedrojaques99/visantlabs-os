/**
 * useMediaSource
 *
 * Hook para resolver a fonte de mídia (imagem/vídeo) de um node conectado.
 * Centraliza a lógica de traversal do grafo que estava duplicada no OutputNode.
 *
 * Responsabilidades:
 * 1. Encontrar edge conectado ao node
 * 2. Identificar o tipo do node fonte
 * 3. Extrair URL/base64 da mídia (imagem ou vídeo)
 * 4. Retornar estado normalizado { url, isVideo }
 */

import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type {
  FlowNodeData,
  OutputNodeData,
  VideoNodeData,
  VideoInputNodeData,
  MergeNodeData,
  EditNodeData,
  UpscaleNodeData,
  MockupNodeData,
  PromptNodeData
} from '@/types/reactFlow';

export interface MediaSource {
  url: string | null;
  isVideo: boolean;
  sourceNodeId: string | null;
  sourceNodeType: string | null;
}

interface UseMediaSourceParams {
  nodeId: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  /** Se o node já tem um resultado próprio, ele tem prioridade */
  ownResult?: {
    imageUrl?: string | null;
    imageBase64?: string | null;
    videoUrl?: string | null;
    videoBase64?: string | null;
  };
}

/**
 * Extrai mídia de um node fonte baseado no seu tipo
 */
function extractMediaFromNode(
  sourceNode: Node<FlowNodeData>,
  sourceHandle?: string | null
): { url: string | null; isVideo: boolean } {
  const sourceData = sourceNode.data;
  const nodeType = sourceData.type;

  // Helper para formatar base64
  const formatBase64 = (base64: string | undefined, type: 'image' | 'video'): string | null => {
    if (!base64) return null;
    if (base64.startsWith('data:')) return base64;
    return type === 'video'
      ? `data:video/mp4;base64,${base64}`
      : `data:image/png;base64,${base64}`;
  };

  switch (nodeType) {
    case 'prompt': {
      const data = sourceData as PromptNodeData;
      return {
        url: data.resultImageUrl || formatBase64(data.resultImageBase64, 'image'),
        isVideo: false
      };
    }

    case 'mockup': {
      const data = sourceData as MockupNodeData;
      return {
        url: data.resultImageUrl || formatBase64(data.resultImageBase64, 'image'),
        isVideo: false
      };
    }

    case 'merge': {
      const data = sourceData as MergeNodeData;
      return {
        url: data.resultImageUrl || formatBase64(data.resultImageBase64, 'image'),
        isVideo: false
      };
    }

    case 'edit': {
      const data = sourceData as EditNodeData;
      return {
        url: data.resultImageUrl || formatBase64(data.resultImageBase64, 'image'),
        isVideo: false
      };
    }

    case 'upscale': {
      const data = sourceData as UpscaleNodeData;
      return {
        url: data.resultImageUrl || formatBase64(data.resultImageBase64, 'image'),
        isVideo: false
      };
    }

    case 'video': {
      const data = sourceData as VideoNodeData;
      const videoUrl = data.resultVideoUrl || formatBase64(data.resultVideoBase64, 'video');
      return {
        url: videoUrl,
        isVideo: !!videoUrl
      };
    }

    case 'videoInput': {
      const data = sourceData as VideoInputNodeData;
      let videoUrl = data.uploadedVideoUrl || data.uploadedVideo;
      if (videoUrl && typeof videoUrl === 'string' && !videoUrl.startsWith('data:') && !videoUrl.startsWith('http') && !videoUrl.startsWith('blob:')) {
        videoUrl = `data:video/mp4;base64,${videoUrl}`;
      }
      return {
        url: videoUrl || null,
        isVideo: !!videoUrl
      };
    }

    case 'output': {
      const data = sourceData as OutputNodeData;
      // Check video first, then image
      const videoUrl = data.resultVideoUrl || formatBase64(data.resultVideoBase64, 'video');
      if (videoUrl) {
        return { url: videoUrl, isVideo: true };
      }
      return {
        url: data.resultImageUrl || formatBase64(data.resultImageBase64, 'image'),
        isVideo: false
      };
    }

    default:
      return { url: null, isVideo: false };
  }
}

/**
 * Hook que resolve a fonte de mídia para um node.
 *
 * Prioridades:
 * 1. Resultado próprio do node (se existir)
 * 2. Resultado do node conectado via edge
 */
export function useMediaSource({
  nodeId,
  nodes,
  edges,
  ownResult
}: UseMediaSourceParams): MediaSource {
  return useMemo(() => {
    // PRIORITY 1: Own result takes precedence
    if (ownResult) {
      // Check for video first
      if (ownResult.videoUrl || ownResult.videoBase64) {
        const videoUrl = ownResult.videoUrl ||
          (ownResult.videoBase64
            ? (ownResult.videoBase64.startsWith('data:')
              ? ownResult.videoBase64
              : `data:video/mp4;base64,${ownResult.videoBase64}`)
            : null);

        if (videoUrl) {
          return {
            url: videoUrl,
            isVideo: true,
            sourceNodeId: nodeId,
            sourceNodeType: 'self'
          };
        }
      }

      // Check for image
      if (ownResult.imageUrl || ownResult.imageBase64) {
        const imageUrl = ownResult.imageUrl ||
          (ownResult.imageBase64
            ? (ownResult.imageBase64.startsWith('data:')
              ? ownResult.imageBase64
              : `data:image/png;base64,${ownResult.imageBase64}`)
            : null);

        if (imageUrl) {
          return {
            url: imageUrl,
            isVideo: false,
            sourceNodeId: nodeId,
            sourceNodeType: 'self'
          };
        }
      }
    }

    // PRIORITY 2: Connected source node
    const incomingEdge = edges.find(e => e.target === nodeId);
    if (!incomingEdge) {
      return {
        url: null,
        isVideo: false,
        sourceNodeId: null,
        sourceNodeType: null
      };
    }

    const sourceNode = nodes.find(n => n.id === incomingEdge.source);
    if (!sourceNode) {
      return {
        url: null,
        isVideo: false,
        sourceNodeId: null,
        sourceNodeType: null
      };
    }

    const media = extractMediaFromNode(sourceNode, incomingEdge.sourceHandle);

    return {
      url: media.url,
      isVideo: media.isVideo,
      sourceNodeId: sourceNode.id,
      sourceNodeType: (sourceNode.data.type as string) || null
    };
  }, [nodeId, nodes, edges, ownResult]);
}

export default useMediaSource;
