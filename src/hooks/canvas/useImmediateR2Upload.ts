/**
 * useImmediateR2Upload
 * 
 * Hook dedicado para upload imediato de imagens/vídeos base64 para R2
 * Monitora nodes e detecta base64 sem URL correspondente, fazendo upload automático
 * 
 * Princípios:
 * - Separação de responsabilidades (lógica isolada)
 * - Performance (evita loops, usa refs)
 * - Robustez (tratamento silencioso de erros)
 */

import { useEffect, useRef } from 'react';
import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import { canvasApi } from '@/services/canvasApi';
import {
  detectNodesNeedingUpload,
  extractBase64,
  type NodeUploadInfo
} from './utils/r2UploadHelpers';

interface UseImmediateR2UploadParams {
  nodes: Node<FlowNodeData>[];
  canvasId: string | undefined;
  isAuthenticated: boolean;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  handlersRef: React.MutableRefObject<any>;
  onStorageLimitError?: (usedMB: string, limitMB: string) => void;
}

/**
 * Hook para upload imediato de base64 para R2
 * Monitora nodes e faz upload automático quando detecta base64 sem URL
 */
export const useImmediateR2Upload = ({
  nodes,
  canvasId,
  isAuthenticated,
  setNodes,
  handlersRef,
  onStorageLimitError,
}: UseImmediateR2UploadParams): void => {
  // Ref para rastrear uploads em progresso (evita duplicatas)
  const uploadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canvasId || !isAuthenticated) {
      uploadingRef.current.clear();
      return;
    }

    const nodesNeedingUpload = detectNodesNeedingUpload(nodes);
    const userUploadRef = handlersRef.current?.userUploadInProgressRef?.current;

    const nodesToUpload = nodesNeedingUpload.filter((info) => {
      if (uploadingRef.current.has(info.nodeId)) return false;
      if (userUploadRef?.has(info.nodeId)) return false;
      return true;
    });

    if (nodesToUpload.length === 0) return;

    (async () => {
      for (const uploadInfo of nodesToUpload) {
        const { nodeId, uploadType } = uploadInfo;
        uploadingRef.current.add(nodeId);
        try {
          await performUpload(uploadInfo, canvasId, setNodes, handlersRef, onStorageLimitError);
        } catch (e) {
          console.warn(`Upload failed for node ${nodeId}, type ${uploadType}:`, e);
        } finally {
          uploadingRef.current.delete(nodeId);
        }
      }
    })();
  }, [nodes, canvasId, isAuthenticated, setNodes, handlersRef]);
};

/**
 * Executa upload baseado no tipo de node
 */
async function performUpload(
  uploadInfo: NodeUploadInfo,
  canvasId: string,
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  handlersRef: React.MutableRefObject<any>,
  onStorageLimitError?: (usedMB: string, limitMB: string) => void
): Promise<void> {
  const { nodeId, uploadType, base64Data, nodeKey } = uploadInfo;

  try {
    switch (uploadType) {
      case 'image-mockup': {
        // ImageNode - usar handler dedicado se disponível
        if (handlersRef.current?.handleUploadImage) {
          await handlersRef.current.handleUploadImage(nodeId, base64Data);
        } else {
          // Fallback para upload direto - preservar tamanho original
          const imageUrl = await canvasApi.uploadImageToR2(base64Data, canvasId, nodeId, { skipCompression: true });
          updateImageNodeMockup(setNodes, nodeId, imageUrl);
        }
        break;
      }

      case 'logo': {
        // LogoNode - usar handler dedicado se disponível
        if (handlersRef.current?.handleLogoNodeUpload) {
          await handlersRef.current.handleLogoNodeUpload(nodeId, base64Data);
        } else {
          // Fallback para upload direto - preservar tamanho original
          const imageUrl = await canvasApi.uploadImageToR2(base64Data, canvasId, nodeId, { skipCompression: true });
          updateLogoNode(setNodes, nodeId, imageUrl);
        }
        break;
      }

      case 'brand-logo': {
        // BrandNode logoBase64 - preservar tamanho original
        const imageUrl = await canvasApi.uploadImageToR2(base64Data, canvasId, `${nodeId}-logo`, { skipCompression: true });
        updateBrandNodeLogo(setNodes, nodeId, imageUrl);
        break;
      }

      case 'pdf': {
        // PDFNode
        const pdfUrl = await canvasApi.uploadPdfToR2(base64Data, canvasId, nodeId);
        updatePDFNode(setNodes, nodeId, pdfUrl);
        break;
      }

      case 'result-image': {
        // Nodes com resultImageBase64 (merge, edit, upscale, mockup, prompt, output, shader, etc.) - preservar tamanho original
        const imageUrl = await canvasApi.uploadImageToR2(base64Data, canvasId, nodeId, { skipCompression: true });
        updateResultImageNode(setNodes, nodeId, imageUrl);
        break;
      }

      case 'edit-uploaded': {
        // EditNode uploadedImage.base64 - preservar tamanho original
        const imageUrl = await canvasApi.uploadImageToR2(base64Data, canvasId, `${nodeId}-uploaded`, { skipCompression: true });
        updateEditNodeUploadedImage(setNodes, nodeId, imageUrl);
        break;
      }

      case 'video-input': {
        // VideoInputNode uploadedVideo
        const videoBase64 = extractBase64(base64Data);
        const videoUrl = await canvasApi.uploadVideoToR2(videoBase64, canvasId, nodeId);
        updateVideoInputNode(setNodes, nodeId, videoUrl, videoBase64);
        break;
      }

      case 'video-result': {
        // VideoNode resultVideoBase64
        const videoBase64 = extractBase64(base64Data);
        const videoUrl = await canvasApi.uploadVideoToR2(videoBase64, canvasId, nodeId);
        updateVideoNode(setNodes, nodeId, videoUrl);
        break;
      }

      case 'output-video': {
        // OutputNode resultVideoBase64 (vídeo)
        const videoBase64 = extractBase64(base64Data);
        const videoUrl = await canvasApi.uploadVideoToR2(videoBase64, canvasId, nodeId);
        updateOutputNodeVideo(setNodes, nodeId, videoUrl);
        break;
      }

      default:
        console.warn(`Unknown upload type: ${uploadType} for node ${nodeId}`);
    }
  } catch (error: any) {
    // Check if it's a storage limit error
    if (error?.isStorageLimitError && onStorageLimitError && error.usedMB && error.limitMB) {
      onStorageLimitError(error.usedMB, error.limitMB);
    }
    // Log erro mas não propagar (mantém base64 como fallback)
    console.warn(`Failed to upload ${uploadType} for node ${nodeId}:`, error);
    throw error; // Re-throw para que o finally no useEffect seja executado
  }
}

/**
 * Funções auxiliares para atualizar nodes após upload bem-sucedido
 */

function updateImageNodeMockup(
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  nodeId: string,
  imageUrl: string
): void {
  setNodes((nds) =>
    nds.map((n) => {
      if (n.id === nodeId && n.type === 'image') {
        const data = n.data as any;
        return {
          ...n,
          data: {
            ...data,
            mockup: {
              ...data.mockup,
              imageUrl,
              imageBase64: undefined,
            },
          },
        };
      }
      return n;
    })
  );
}

function updateLogoNode(
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  nodeId: string,
  imageUrl: string
): void {
  setNodes((nds) =>
    nds.map((n) => {
      if (n.id === nodeId && n.type === 'logo') {
        const data = n.data as any;
        return {
          ...n,
          data: {
            ...data,
            logoImageUrl: imageUrl,
            logoBase64: undefined,
          },
        };
      }
      return n;
    })
  );
}

function updateBrandNodeLogo(
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  nodeId: string,
  imageUrl: string
): void {
  setNodes((nds) =>
    nds.map((n) => {
      if (n.id === nodeId && n.type === 'brand') {
        const data = n.data as any;
        return {
          ...n,
          data: {
            ...data,
            logoImage: imageUrl,
            logoBase64: undefined,
          },
        };
      }
      return n;
    })
  );
}

function updatePDFNode(
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  nodeId: string,
  pdfUrl: string
): void {
  setNodes((nds) =>
    nds.map((n) => {
      if (n.id === nodeId && n.type === 'pdf') {
        const data = n.data as any;
        return {
          ...n,
          data: {
            ...data,
            pdfUrl,
            pdfBase64: undefined,
          },
        };
      }
      return n;
    })
  );
}

function updateResultImageNode(
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  nodeId: string,
  imageUrl: string
): void {
  setNodes((nds) =>
    nds.map((n) => {
      if (n.id === nodeId) {
        const data = n.data as any;
        // Para shader, manter base64 mas adicionar URL
        if (n.type === 'shader') {
          return {
            ...n,
            data: {
              ...data,
              resultImageUrl: imageUrl,
              // Mantém resultImageBase64 para preview em tempo real
            },
          };
        } else {
          // Para outros nodes, remover base64 após upload
          return {
            ...n,
            data: {
              ...data,
              resultImageUrl: imageUrl,
              resultImageBase64: undefined,
            },
          };
        }
      }
      return n;
    })
  );
}

function updateEditNodeUploadedImage(
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  nodeId: string,
  imageUrl: string
): void {
  setNodes((nds) =>
    nds.map((n) => {
      if (n.id === nodeId && n.type === 'edit') {
        const data = n.data as any;
        return {
          ...n,
          data: {
            ...data,
            uploadedImage: {
              ...data.uploadedImage,
              url: imageUrl,
              base64: undefined,
            },
          },
        };
      }
      return n;
    })
  );
}

function updateVideoInputNode(
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  nodeId: string,
  videoUrl: string,
  videoBase64: string
): void {
  setNodes((nds) =>
    nds.map((n) => {
      if (n.id === nodeId && n.type === 'videoInput') {
        const data = n.data as any;
        return {
          ...n,
          data: {
            ...data,
            uploadedVideoUrl: videoUrl,
            // Mantém base64 como fallback
            uploadedVideo: videoBase64,
          },
        };
      }
      return n;
    })
  );
}

function updateVideoNode(
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  nodeId: string,
  videoUrl: string
): void {
  setNodes((nds) =>
    nds.map((n) => {
      if (n.id === nodeId && n.type === 'video') {
        const data = n.data as any;
        return {
          ...n,
          data: {
            ...data,
            resultVideoUrl: videoUrl,
            resultVideoBase64: undefined,
          },
        };
      }
      return n;
    })
  );
}

function updateOutputNodeVideo(
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  nodeId: string,
  videoUrl: string
): void {
  setNodes((nds) =>
    nds.map((n) => {
      if (n.id === nodeId && n.type === 'output') {
        const data = n.data as any;
        return {
          ...n,
          data: {
            ...data,
            resultVideoUrl: videoUrl,
            resultVideoBase64: undefined,
          },
        };
      }
      return n;
    })
  );
}

