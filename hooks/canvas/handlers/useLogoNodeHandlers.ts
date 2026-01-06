/**
 * useLogoNodeHandlers
 * 
 * Handlers para gerenciar operações de node de logo
 */

import { useCallback } from 'react';
import type { LogoNodeData, FlowNodeData } from '../../../types/reactFlow';
import { canvasApi } from '../../../services/canvasApi';
import { createNodeDataUpdateHandler } from '../utils/nodeDataUpdateUtils';

interface UseLogoNodeHandlersParams {
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
  canvasId?: string;
}

export const useLogoNodeHandlers = ({
  updateNodeData,
  canvasId,
}: UseLogoNodeHandlersParams) => {
  const handleLogoNodeUpload = useCallback(async (nodeId: string, imageBase64: string) => {
    // Update node immediately with base64 for preview
    updateNodeData<LogoNodeData>(nodeId, { 
      logoBase64: imageBase64, 
      logoImageUrl: `data:image/png;base64,${imageBase64}` 
    }, 'logo');

    // Upload to R2 in the background (non-blocking)
    if (canvasId) {
      try {
        const imageUrl = await canvasApi.uploadImageToR2(imageBase64, canvasId, nodeId);
        // Update node with R2 URL and remove base64 to reduce payload size
        updateNodeData<LogoNodeData>(nodeId, {
          logoImageUrl: imageUrl,
          logoBase64: undefined, // Remove base64 after successful upload
        }, 'logo');
      } catch (error: any) {
        // If R2 upload fails, keep base64 - don't show error to user
        console.error('Failed to upload logo to R2:', error);
      }
    }
  }, [updateNodeData, canvasId]);

  const handleLogoNodeDataUpdate = createNodeDataUpdateHandler<LogoNodeData>(updateNodeData, 'logo');

  return {
    handleLogoNodeUpload,
    handleLogoNodeDataUpdate,
  };
};










