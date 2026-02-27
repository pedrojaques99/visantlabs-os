/**
 * r2UploadUtils
 * 
 * Utilitários compartilhados para upload e gerenciamento de imagens no R2
 */

import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import { canvasApi } from '@/services/canvasApi';

// Mapa para armazenar timeouts de debounce por nodeId
const uploadDebounceMap = new Map<string, NodeJS.Timeout>();
const pendingUploads = new Map<string, {
  base64Image: string;
  nodeId: string;
  canvasId: string;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  updateNodeCallback?: (imageUrl: string) => void;
}>();

export interface UploadOptions {
  skipCompression?: boolean;
}

/**
 * Upload image to R2 and cleanup base64 from node state to save memory
 */
export const uploadImageToR2Auto = async (
  base64Image: string,
  nodeId: string,
  canvasId: string | undefined,
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  updateNodeCallback?: (imageUrl: string) => void,
  options?: UploadOptions
): Promise<string | null> => {
  if (!canvasId || !base64Image) return null;

  try {
    const imageUrl = await canvasApi.uploadImageToR2(base64Image, canvasId, nodeId, options);
    if (updateNodeCallback) {
      updateNodeCallback(imageUrl);
    }
    // After successful upload, remove base64 from node state to save memory
    // This prevents loss of large images (especially 4K) on page reload
    // Use setTimeout to ensure callback updates are applied first
    setTimeout(() => {
      setNodes((nds: Node<FlowNodeData>[]) => {
        return nds.map((n: Node<FlowNodeData>) => {
          if (n.id === nodeId) {
            const nodeData = n.data as any;
            // Remove base64 fields based on node type
            const updatedData: any = { ...nodeData };

            if (n.type === 'upscale' || n.type === 'upscaleBicubic' || n.type === 'merge' || n.type === 'edit' || n.type === 'mockup' || n.type === 'prompt' || n.type === 'texture' || n.type === 'ambience' || n.type === 'angle') {
              // Remove base64 if URL matches (upload was successful)
              if (updatedData.resultImageUrl === imageUrl && updatedData.resultImageBase64) {
                updatedData.resultImageUrl = imageUrl;
                updatedData.resultImageBase64 = undefined;
              }
            } else if (n.type === 'output') {
              if (updatedData.resultImageUrl === imageUrl && updatedData.resultImageBase64) {
                updatedData.resultImageUrl = imageUrl;
                updatedData.resultImageBase64 = undefined;
              }
            } else if (n.type === 'shader') {
              // For shader nodes, NEVER remove base64 - it's needed for real-time preview
              // Keep both base64 and URL, base64 takes priority for display
              if (updatedData.resultImageUrl !== imageUrl) {
                updatedData.resultImageUrl = imageUrl;
                // Keep resultImageBase64 - don't remove it
              }
            } else if (n.type === 'image' && updatedData.mockup) {
              if (updatedData.mockup.imageUrl === imageUrl && updatedData.mockup.imageBase64) {
                updatedData.mockup = {
                  ...updatedData.mockup,
                  imageUrl,
                  imageBase64: undefined,
                };
              }
            }

            return {
              ...n,
              data: updatedData,
            } as Node<FlowNodeData>;
          }
          return n;
        });
      });
    }, 100); // Small delay to ensure callback updates are applied
    return imageUrl;
  } catch (error: any) {
    // Silently fail - keep base64 as fallback
    console.warn(`Failed to upload image to R2 for node ${nodeId}:`, error);
    return null;
  }
};

/**
 * Upload image to R2 with debounce (delayed upload)
 * Useful during active editing to avoid blocking WebGL rendering
 * @param base64Image - Base64 encoded image string
 * @param nodeId - Node ID
 * @param canvasId - Canvas project ID
 * @param setNodes - Function to update nodes
 * @param updateNodeCallback - Optional callback when upload completes
 * @param debounceMs - Debounce delay in milliseconds (default: 4000ms)
 */
export const uploadImageToR2Debounced = (
  base64Image: string,
  nodeId: string,
  canvasId: string | undefined,
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  updateNodeCallback?: (imageUrl: string) => void,
  debounceMs: number = 4000
): void => {
  if (!canvasId || !base64Image) return;

  // Cancel previous upload for this node
  const existingTimeout = uploadDebounceMap.get(nodeId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Store pending upload info
  pendingUploads.set(nodeId, {
    base64Image,
    nodeId,
    canvasId,
    setNodes,
    updateNodeCallback,
  });

  // Schedule upload after debounce period
  const timeout = setTimeout(async () => {
    const pending = pendingUploads.get(nodeId);
    if (!pending) {
      uploadDebounceMap.delete(nodeId);
      return;
    }

    // Remove from pending and map
    pendingUploads.delete(nodeId);
    uploadDebounceMap.delete(nodeId);

    // Perform actual upload
    await uploadImageToR2Auto(
      pending.base64Image,
      pending.nodeId,
      pending.canvasId,
      pending.setNodes,
      pending.updateNodeCallback
    );
  }, debounceMs);

  uploadDebounceMap.set(nodeId, timeout);
};

/**
 * Force immediate upload for a specific node (bypasses debounce)
 * Useful when user explicitly saves or when editing stops
 */
export const flushPendingUpload = async (nodeId: string): Promise<void> => {
  const existingTimeout = uploadDebounceMap.get(nodeId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    uploadDebounceMap.delete(nodeId);
  }

  const pending = pendingUploads.get(nodeId);
  if (pending) {
    pendingUploads.delete(nodeId);
    await uploadImageToR2Auto(
      pending.base64Image,
      pending.nodeId,
      pending.canvasId,
      pending.setNodes,
      pending.updateNodeCallback
    );
  }
};

/**
 * Flush all pending uploads (useful when saving or when editing stops)
 */
export const flushAllPendingUploads = async (): Promise<void> => {
  // Clear all timeouts
  uploadDebounceMap.forEach((timeout) => {
    clearTimeout(timeout);
  });
  uploadDebounceMap.clear();

  // Execute all pending uploads
  const uploadPromises = Array.from(pendingUploads.values()).map((pending) =>
    uploadImageToR2Auto(
      pending.base64Image,
      pending.nodeId,
      pending.canvasId,
      pending.setNodes,
      pending.updateNodeCallback
    )
  );

  pendingUploads.clear();
  await Promise.all(uploadPromises);
};

