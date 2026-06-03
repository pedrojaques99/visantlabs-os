/**
 * useTextureFilterNodeHandlers
 *
 * Handles texture-filter node processing: composites a texture overlay onto a connected image.
 * Pure Canvas2D — no WebGL/GLSL. Uses the headless renderer extracted from TextureFilterCanvas.
 */

import { useCallback } from 'react';
import type { TextureFilterNodeData, FlowNodeData } from '@/types/reactFlow';
import type { Node } from '@xyflow/react';
import { useNodeDataUpdateHandler } from '@/hooks/canvas/utils/nodeDataUpdateUtils';
import {
  renderTextureFilter,
  loadImage,
  TEXTURE_FILTER_RENDER_DEFAULTS,
  type TextureFilterRenderSettings,
} from '@/utils/textureFilter/renderTextureFilter';
import { canvasApi } from '@/services/canvasApi';

interface UseTextureFilterNodeHandlersParams {
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  updateNodeData: <T extends FlowNodeData>(
    nodeId: string,
    newData: Partial<T>,
    nodeType?: string
  ) => void;
  updateNodeLoadingState: <T extends FlowNodeData>(
    nodeId: string,
    isLoading: boolean,
    nodeType?: string
  ) => void;
  canvasId?: string;
  setNodes: (
    nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])
  ) => void;
}

export const useTextureFilterNodeHandlers = ({
  nodesRef,
  updateNodeData,
  updateNodeLoadingState,
  canvasId,
}: UseTextureFilterNodeHandlersParams) => {
  const handleTextureFilterApply = useCallback(
    async (nodeId: string, imageInput: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node || node.type !== 'textureFilter') return;

      const d = node.data as TextureFilterNodeData;
      const inputSrc = imageInput || d.connectedImage || '';
      if (!inputSrc) return;

      const textureSrc = d.textureSrc || '/textures/visant-grid.svg';

      updateNodeLoadingState<TextureFilterNodeData>(nodeId, true, 'textureFilter');

      try {
        const [inputImg, textureImg] = await Promise.all([
          loadImage(inputSrc),
          loadImage(textureSrc),
        ]);

        const settings: TextureFilterRenderSettings = {
          opacity: d.opacity ?? TEXTURE_FILTER_RENDER_DEFAULTS.opacity,
          scale: d.scale ?? TEXTURE_FILTER_RENDER_DEFAULTS.scale,
          blendMode: d.blendMode ?? TEXTURE_FILTER_RENDER_DEFAULTS.blendMode,
          textureColor: d.textureColor ?? TEXTURE_FILTER_RENDER_DEFAULTS.textureColor,
          useOriginalColor: d.useOriginalColor ?? TEXTURE_FILTER_RENDER_DEFAULTS.useOriginalColor,
          rotation: d.rotation ?? TEXTURE_FILTER_RENDER_DEFAULTS.rotation,
          offsetX: d.offsetX ?? TEXTURE_FILTER_RENDER_DEFAULTS.offsetX,
          offsetY: d.offsetY ?? TEXTURE_FILTER_RENDER_DEFAULTS.offsetY,
          tileMode: d.tileMode ?? TEXTURE_FILTER_RENDER_DEFAULTS.tileMode,
          tileGapX: d.tileGapX ?? TEXTURE_FILTER_RENDER_DEFAULTS.tileGapX,
          tileGapY: d.tileGapY ?? TEXTURE_FILTER_RENDER_DEFAULTS.tileGapY,
          maskMode: d.maskMode ?? TEXTURE_FILTER_RENDER_DEFAULTS.maskMode,
          maskInvert: d.maskInvert ?? TEXTURE_FILTER_RENDER_DEFAULTS.maskInvert,
        };

        const resultCanvas = renderTextureFilter(inputImg, textureImg, settings);
        const resultBase64 = resultCanvas.toDataURL('image/png');

        // Upload to R2 if we have a canvasId
        let resultImageUrl: string | undefined;
        if (canvasId) {
          try {
            const blob = await new Promise<Blob>((res) =>
              resultCanvas.toBlob((b) => res(b!), 'image/png')
            );
            const file = new File([blob], 'texture-filter-result.png', { type: 'image/png' });
            resultImageUrl = await canvasApi.uploadImageToR2Direct(file, canvasId);
          } catch {
            // R2 upload failed — fall back to base64 only
          }
        }

        updateNodeData<TextureFilterNodeData>(
          nodeId,
          {
            resultImageBase64: resultBase64,
            resultImageUrl,
            imageWidth: resultCanvas.width,
            imageHeight: resultCanvas.height,
            isLoading: false,
          },
          'textureFilter'
        );
      } catch (error) {
        console.error('[TextureFilterNode] Render failed:', error);
        updateNodeLoadingState<TextureFilterNodeData>(nodeId, false, 'textureFilter');
      }
    },
    [nodesRef, updateNodeData, updateNodeLoadingState, canvasId]
  );

  const handleTextureFilterNodeDataUpdate = useNodeDataUpdateHandler<TextureFilterNodeData>(
    updateNodeData,
    'textureFilter'
  );

  return { handleTextureFilterApply, handleTextureFilterNodeDataUpdate };
};
