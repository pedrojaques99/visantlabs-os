import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type {
  FlowNodeData,
  BrandBatchNodeData,
  BrandBatchItem,
  ImageNodeData,
  OutputNodeData,
  LogoNodeData,
  BrandCoreData,
  BrandNodeData,
} from '@/types/reactFlow';
import type { BrandGuideline } from '@/lib/figma-types';
import { mockupApi } from '@/services/mockupApi';
import { normalizeImageToBase64, detectMimeType } from '@/services/reactFlowService';
import { validateBase64Image } from '../utils/nodeGenerationUtils';
import { getBrandContextForNode, buildEnhancement } from '../useBrandContext';
import { resolveGenerationContext } from '@/utils/canvas/generationContext';
import { DEFAULT_MODEL, DEFAULT_ASPECT_RATIO } from '@/constants/geminiModels';
import { trackCanvasEvent } from '@/utils/canvasAnalytics';
import { toast } from 'sonner';

interface UseBrandBatchHandlersParams {
  nodesRef: MutableRefObject<Node<FlowNodeData>[]>;
  edgesRef: MutableRefObject<Edge[]>;
  updateNodeData: <T extends FlowNodeData>(
    nodeId: string,
    newData: Partial<T>,
    nodeType?: string
  ) => void;
  linkedGuideline: BrandGuideline | null | undefined;
}

function getConnectedImageUrls(
  batchNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): Array<{ sourceNodeId: string; imageUrl: string }> {
  const results: Array<{ sourceNodeId: string; imageUrl: string }> = [];
  const inEdges = edges.filter(
    (e) => e.target === batchNodeId && e.targetHandle?.startsWith('input-')
  );

  for (const edge of inEdges) {
    const src = nodes.find((n) => n.id === edge.source);
    if (!src) continue;

    let imageUrl: string | undefined;
    if (src.type === 'image') {
      const d = src.data as ImageNodeData;
      imageUrl = d.mockup?.imageBase64 || d.mockup?.imageUrl;
    } else if (src.type === 'output') {
      const d = src.data as OutputNodeData;
      imageUrl = d.resultImageBase64 || d.resultImageUrl;
    } else if (src.type === 'logo') {
      const d = src.data as LogoNodeData;
      imageUrl = d.logoBase64 || d.logoImageUrl;
    }

    if (imageUrl) {
      results.push({ sourceNodeId: src.id, imageUrl });
    }
  }

  return results;
}

export function useBrandBatchHandlers({
  nodesRef,
  edgesRef,
  updateNodeData,
  linkedGuideline,
}: UseBrandBatchHandlersParams) {
  const cancelRef = useRef(false);

  const handleBrandBatchRun = useCallback(
    async (batchNodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === batchNodeId);
      if (!node) return;

      const nodeData = node.data as BrandBatchNodeData;
      const images = getConnectedImageUrls(batchNodeId, nodesRef.current, edgesRef.current);

      if (!images.length) {
        toast.error('Connect at least one image to the Brand Batch node.');
        return;
      }

      const prompt = nodeData.prompt || 'Apply my branding to this image';
      const selectedModel = nodeData.model || DEFAULT_MODEL;
      const { provider, resolution, aspectRatio } = resolveGenerationContext(selectedModel as any, {
        resolution: nodeData.resolution as any,
        aspectRatio: (nodeData.aspectRatio || DEFAULT_ASPECT_RATIO) as any,
      });

      const initialItems: BrandBatchItem[] = images.map((img, i) => ({
        index: i,
        sourceNodeId: img.sourceNodeId,
        imageUrl: img.imageUrl,
        status: 'pending',
      }));

      cancelRef.current = false;

      trackCanvasEvent('generation_started', 'brandBatch', undefined, {
        images: images.length,
        model: selectedModel,
        provider,
      });

      updateNodeData<BrandBatchNodeData>(
        batchNodeId,
        {
          status: 'running',
          items: initialItems,
        },
        'brandBatch'
      );

      const items = [...initialItems];

      const { source: brandSource, tokens: brandTokens } = getBrandContextForNode(
        batchNodeId,
        nodesRef.current,
        edgesRef.current,
        linkedGuideline
      );

      let enhancedPrompt = prompt;
      if (brandSource === 'edge' && brandTokens) {
        enhancedPrompt = buildEnhancement(prompt, brandTokens);
      }

      const CONCURRENCY = 3;

      const runItem = async (i: number) => {
        if (cancelRef.current) {
          items[i] = { ...items[i], status: 'error', error: 'Cancelled' };
          updateNodeData<BrandBatchNodeData>(batchNodeId, { items: [...items] }, 'brandBatch');
          return;
        }

        items[i] = { ...items[i], status: 'running' };
        updateNodeData<BrandBatchNodeData>(batchNodeId, { items: [...items] }, 'brandBatch');

        try {
          const imageBase64 = await normalizeImageToBase64(images[i].imageUrl);
          if (!validateBase64Image(imageBase64)) {
            throw new Error('Invalid image data');
          }

          const srcMime = detectMimeType(images[i].imageUrl);
          let isSvg = srcMime === 'image/svg+xml' || images[i].imageUrl.includes('.svg');
          if (!isSvg) {
            try {
              isSvg = atob(imageBase64.slice(0, 60)).includes('<svg');
            } catch {}
          }
          if (isSvg) {
            throw new Error('SVG not supported by AI — use PNG/JPG');
          }

          const mimeType = srcMime === 'image/svg+xml' ? 'image/png' : srcMime;

          let referenceImages: Array<{ base64: string; mimeType: string }> | undefined;
          if (nodeData.connectedLogo) {
            const logoMime = detectMimeType(nodeData.connectedLogo);
            let logoIsSvg = logoMime === 'image/svg+xml';
            if (!logoIsSvg) {
              const logoB64 = await normalizeImageToBase64(nodeData.connectedLogo);
              try {
                logoIsSvg = atob(logoB64.slice(0, 60)).includes('<svg');
              } catch {}
              if (!logoIsSvg) {
                referenceImages = [{ base64: logoB64, mimeType: logoMime }];
              }
            }
          }

          const result = await mockupApi.generate({
            promptText: enhancedPrompt,
            baseImage: { base64: imageBase64, mimeType },
            referenceImages,
            model: selectedModel as any,
            resolution: resolution as any,
            aspectRatio: aspectRatio as any,
            imagesCount: 1,
            feature: 'canvas',
            provider,
            brandGuidelineId: brandSource === 'guideline' ? linkedGuideline?.id : undefined,
            uniqueId: `brand-batch-${batchNodeId}-${i}`,
          });

          const outputUrl = result.imageUrl || result.imageBase64 || '';
          items[i] = { ...items[i], status: 'done', outputImageUrl: outputUrl };
        } catch (err: any) {
          items[i] = { ...items[i], status: 'error', error: err?.message || 'Generation failed' };
        }

        updateNodeData<BrandBatchNodeData>(batchNodeId, { items: [...items] }, 'brandBatch');
      };

      const queue = images.map((_, i) => i);
      const workers = Array.from({ length: Math.min(CONCURRENCY, images.length) }, async () => {
        while (queue.length > 0) {
          const i = queue.shift();
          if (i === undefined) break;
          await runItem(i);
        }
      });
      await Promise.allSettled(workers);

      const hadCancel = cancelRef.current;
      updateNodeData<BrandBatchNodeData>(
        batchNodeId,
        {
          status: hadCancel ? 'cancelled' : 'done',
          items: [...items],
        },
        'brandBatch'
      );

      const doneCount = items.filter((r) => r.status === 'done').length;
      const failedCount = items.filter((r) => r.status === 'error').length;

      trackCanvasEvent(
        hadCancel ? 'generation_failed' : 'generation_completed',
        'brandBatch',
        undefined,
        {
          images: images.length,
          done: doneCount,
          failed: failedCount,
        }
      );

      if (!hadCancel) {
        toast.success(`Brand Batch complete — ${doneCount} generated, ${failedCount} failed.`);
      } else {
        toast.info(`Brand Batch cancelled — ${doneCount} generated before cancel.`);
      }
    },
    [nodesRef, edgesRef, updateNodeData, linkedGuideline]
  );

  const handleBrandBatchCancel = useCallback(
    (batchNodeId: string) => {
      cancelRef.current = true;
      updateNodeData<BrandBatchNodeData>(batchNodeId, { status: 'cancelled' }, 'brandBatch');
      toast.info('Cancelling batch after current item…');
    },
    [updateNodeData]
  );

  const handleBrandBatchNodeDataUpdate = useCallback(
    (nodeId: string, newData: Partial<BrandBatchNodeData>) => {
      updateNodeData<BrandBatchNodeData>(nodeId, newData, 'brandBatch');
    },
    [updateNodeData]
  );

  return { handleBrandBatchRun, handleBrandBatchCancel, handleBrandBatchNodeDataUpdate };
}
