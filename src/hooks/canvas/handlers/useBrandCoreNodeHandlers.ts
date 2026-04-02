import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { BrandCoreData, FlowNodeData } from '@/types/reactFlow';
import type { UploadedImage } from '@/types/types';
import { extractBrandIdentity } from '@/services/brandIdentityService';
import { canvasApi } from '@/services/canvasApi';
import { detectMimeType } from '@/services/reactFlowService';
import { toast } from 'sonner';

interface UseBrandCoreNodeHandlersParams {
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
  canvasId?: string;
  saveImmediately?: () => Promise<void>;
}

export const useBrandCoreNodeHandlers = ({
  nodesRef,
  updateNodeData,
  canvasId,
  saveImmediately,
}: UseBrandCoreNodeHandlersParams) => {

  const handleBrandCoreAnalyze = useCallback(async (
    nodeId: string,
    logoBase64: string,
    identityBase64: string,
    identityType: 'pdf' | 'png' = 'pdf'
  ) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'brandCore') return;

    const brandCoreData = node.data as BrandCoreData;
    updateNodeData<BrandCoreData>(nodeId, { isAnalyzing: true }, 'brandCore');

    try {
      const logoImage: UploadedImage = {
        base64: logoBase64,
        mimeType: detectMimeType(logoBase64) || 'image/png',
      };

      let strategyText: string | undefined;
      if (brandCoreData.connectedStrategies && brandCoreData.connectedStrategies.length > 0) {
        const { consolidateStrategies, consolidateStrategiesToText } = await import('@/services/brandPromptService');
        const consolidated = consolidateStrategies(brandCoreData.connectedStrategies);
        strategyText = consolidateStrategiesToText(consolidated);
      }

      const brandIdentity = await extractBrandIdentity(logoImage, identityBase64, identityType, strategyText);

      updateNodeData<BrandCoreData>(nodeId, { brandIdentity, isAnalyzing: false }, 'brandCore');
      saveImmediately && setTimeout(() => saveImmediately(), 100);
      toast.success('Brand identity analyzed successfully', { duration: 2000 });
    } catch (error: any) {
      console.error('Error analyzing brand identity:', error);
      toast.error(error?.message || 'Failed to analyze brand identity', { duration: 5000 });
      updateNodeData<BrandCoreData>(nodeId, { isAnalyzing: false }, 'brandCore');
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  const handleBrandCoreCancelAnalyze = useCallback((nodeId: string) => {
    updateNodeData<BrandCoreData>(nodeId, { isAnalyzing: false }, 'brandCore');
    toast.info('Analysis cancelled', { duration: 2000 });
  }, [updateNodeData]);

  const handleBrandCoreGenerateVisualPrompts = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'brandCore') return;

    const brandCoreData = node.data as any;
    if (!brandCoreData.brandIdentity) {
      toast.error('Brand identity required. Connect logo and identity first.', { duration: 3000 });
      return;
    }

    updateNodeData<BrandCoreData>(nodeId, { isGeneratingPrompts: true }, 'brandCore');

    try {
      const { generateVisualPrompt, consolidateStrategies, extractVisualStrategyText } = await import('@/services/brandPromptService');

      let visualStrategyText: string | undefined;
      if (brandCoreData.connectedStrategies && brandCoreData.connectedStrategies.length > 0) {
        const consolidated = consolidateStrategies(brandCoreData.connectedStrategies);
        visualStrategyText = extractVisualStrategyText(consolidated);
      }

      const visualPrompts = await generateVisualPrompt(brandCoreData.brandIdentity, { visualStrategyText });

      updateNodeData<BrandCoreData>(nodeId, { visualPrompts, isGeneratingPrompts: false }, 'brandCore');
      saveImmediately && setTimeout(() => saveImmediately(), 100);
    } catch (error: any) {
      console.error('Error generating visual prompts:', error);
      toast.error(error?.message || 'Failed to generate visual prompts', { duration: 5000 });
      updateNodeData<BrandCoreData>(nodeId, { isGeneratingPrompts: false }, 'brandCore');
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  const handleBrandCoreGenerateStrategicPrompts = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'brandCore') return;

    const brandCoreData = node.data as any;
    if (!brandCoreData.connectedStrategies?.length) return;

    try {
      const { consolidateStrategies } = await import('@/services/brandPromptService');
      const consolidated = consolidateStrategies(brandCoreData.connectedStrategies);

      updateNodeData<BrandCoreData>(nodeId, { strategicPrompts: { consolidated } }, 'brandCore');
      saveImmediately && setTimeout(() => saveImmediately(), 100);
    } catch (error: any) {
      console.error('Error consolidating strategies:', error);
      toast.error(error?.message || 'Failed to consolidate strategies', { duration: 5000 });
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  const handleBrandCoreDataUpdate = useCallback((nodeId: string, newData: Partial<BrandCoreData>) => {
    updateNodeData<BrandCoreData>(nodeId, newData, 'brandCore');
  }, [updateNodeData]);

  const handleBrandCoreUploadPdfToR2 = useCallback(async (nodeId: string, pdfBase64: string): Promise<string> => {
    if (!canvasId) throw new Error('Canvas ID is required to upload PDF to R2');

    try {
      const pdfUrl = await canvasApi.uploadPdfToR2(pdfBase64, canvasId, nodeId);
      updateNodeData<BrandCoreData>(nodeId, {
        uploadedIdentityUrl: pdfUrl,
        uploadedIdentity: undefined,
        uploadedIdentityType: 'pdf',
      }, 'brandCore');
      return pdfUrl;
    } catch (error: any) {
      console.error('Error uploading PDF to R2:', error);
      throw error;
    }
  }, [canvasId, updateNodeData]);

  return {
    handleBrandCoreAnalyze,
    handleBrandCoreCancelAnalyze,
    handleBrandCoreGenerateVisualPrompts,
    handleBrandCoreGenerateStrategicPrompts,
    handleBrandCoreDataUpdate,
    handleBrandCoreUploadPdfToR2,
  };
};
