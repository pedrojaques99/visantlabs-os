import React, { memo, useCallback } from 'react';
import { type NodeProps, Position, NodeResizer, type Node } from '@xyflow/react';
import { Compass, PanelRight, Sparkles, Image as ImageIcon, Check, Wand2, Dices } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { DirectorNodeData, UpscaleNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { LabeledHandle } from './shared/LabeledHandle';
import { useTranslation } from '@/hooks/useTranslation';
import { NodeButton } from './shared/node-button'
import { useNodeResize } from '@/hooks/canvas/useNodeResize';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DirectorNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodeData = data as DirectorNodeData;
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();

  const rawConnected = nodeData.connectedImage;
  const connectedImage = typeof rawConnected === 'string' && rawConnected.trim().length > 0 ? rawConnected.trim() : undefined;
  const isAnalyzing = nodeData.isAnalyzing || false;
  const hasAnalyzed = nodeData.hasAnalyzed || false;
  const isGeneratingPrompt = nodeData.isGeneratingPrompt || false;
  const generatedPrompt = nodeData.generatedPrompt;

  // Count selected tags
  const selectedTagCount = [
    nodeData.selectedBrandingTags?.length || 0,
    nodeData.selectedCategoryTags?.length || 0,
    nodeData.selectedLocationTags?.length || 0,
    nodeData.selectedAngleTags?.length || 0,
    nodeData.selectedLightingTags?.length || 0,
    nodeData.selectedEffectTags?.length || 0,
    nodeData.selectedMaterialTags?.length || 0,
    nodeData.selectedColors?.length || 0,
  ].reduce((a, b) => a + b, 0);

  const handleOpenSidePanel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeData.onOpenSidePanel) {
      nodeData.onOpenSidePanel(id);
    }
  }, [nodeData.onOpenSidePanel, id]);

  const handleGeneratePrompt = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeData.onGeneratePrompt) {
      nodeData.onGeneratePrompt(id);
    }
  }, [nodeData.onGeneratePrompt, id]);

  // Check if we have selections for generate button
  const hasSelections = (nodeData.selectedDesignType !== null && nodeData.selectedDesignType !== undefined) && (
    (nodeData.selectedBrandingTags?.length || 0) > 0 ||
    (nodeData.selectedCategoryTags?.length || 0) > 0 ||
    (nodeData.selectedLocationTags?.length || 0) > 0 ||
    (nodeData.selectedAngleTags?.length || 0) > 0 ||
    (nodeData.selectedLightingTags?.length || 0) > 0 ||
    (nodeData.selectedEffectTags?.length || 0) > 0 ||
    (nodeData.selectedMaterialTags?.length || 0) > 0 ||
    (nodeData.selectedColors?.length || 0) > 0
  );

  // Get status for display
  const getStatusLabel = () => {
    if (isGeneratingPrompt) return t('canvasNodes.directorNode.generatingPrompt') || 'Generating...';
    if (generatedPrompt) return t('canvasNodes.directorNode.promptReady') || 'Prompt Ready';
    if (hasAnalyzed) return `${selectedTagCount} ${t('canvasNodes.directorNode.tagsSelected') || 'tags selected'}`;
    if (isAnalyzing) return t('canvasNodes.directorNode.analyzing') || 'Analyzing...';
    if (connectedImage) return t('canvasNodes.directorNode.readyToAnalyze') || 'Ready to analyze';
    return t('canvasNodes.directorNode.connectImage') || 'Connect an image';
  };

  const getStatusColor = () => {
    if (isGeneratingPrompt) return 'text-amber-400';
    if (generatedPrompt) return 'text-green-400';
    if (hasAnalyzed) return 'node-text-accent';
    if (isAnalyzing) return 'text-amber-400';
    if (connectedImage) return 'node-text-muted';
    return 'node-text-subtle';
  };

  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, 'auto', nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    fitToContent(id, 'auto', 'auto', nodeData.onResize);
  }, [id, nodeData.onResize, fitToContent]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className="min-w-[280px]"
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={280}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          onResize={(_, { width, height }) => {
            handleResize(width, height);
          }}
        />
      )}
      {/* Image Input Handle */}
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="image-input"
        label={t('canvasNodes.directorNode.imageInput') || 'Image'}
        handleType="image"
        style={{ top: '50%' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-700/30 bg-gradient-to-r from-neutral-900/60 to-neutral-900/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-brand-cyan/10 border border-brand-cyan/20 shadow-sm">
            <Compass size={16} className="text-brand-cyan" />
          </div>
          <h3 className="text-xs font-semibold text-neutral-200 font-mono tracking-tight uppercase">
            {t('canvasNodes.directorNode.title') || 'Director'}
          </h3>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-[var(--node-gap)]">
        {/* Connected Image Preview */}
        <div className="">
          {connectedImage ? (
            <div className="relative rounded-md overflow-hidden border border-neutral-700/50 bg-neutral-900/50 shadow-sm">
              <img
                src={
                  connectedImage.startsWith('data:')
                    ? connectedImage
                    : connectedImage.startsWith('http://') || connectedImage.startsWith('https://')
                      ? connectedImage
                      : `data:image/png;base64,${connectedImage}`
                }
                alt="Connected"
                className="w-full h-32 object-cover"
              />
              <div className="absolute top-2 right-2 bg-neutral-950/60 rounded-full p-1 border border-neutral-700/30 shadow-md">
                <Check size={12} className="text-brand-cyan" />
              </div>
            </div>
          ) : (
            <div className="w-full h-24 rounded-md border border-dashed border-neutral-700/50 bg-neutral-900/30 flex flex-col items-center justify-center gap-2 opacity-70">
              <ImageIcon size={16} className="text-neutral-600" />
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                {t('canvasNodes.directorNode.noImage') || 'No image'}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {/* Open Side Panel Button */}
          <NodeButton
            variant="primary"
            size="full"
            onClick={handleOpenSidePanel}
            disabled={!connectedImage}
            className="shadow-sm backdrop-blur-sm nodrag"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <PanelRight size={14} className="mr-2" />
            <span>{t('canvasNodes.directorNode.openDirector') || 'Open Director'}</span>
          </NodeButton>

          {/* Generate Prompt Button (only shown when analyzed and has selections) */}
          {hasAnalyzed && (
            <NodeButton
              variant="primary"
              size="full"
              onClick={handleGeneratePrompt}
              disabled={!hasSelections || isGeneratingPrompt}
              className="shadow-sm backdrop-blur-sm nodrag"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {isGeneratingPrompt ? (
                <>
                  <GlitchLoader size={14} className="mr-2" color="currentColor" />
                  <span>{t('canvasNodes.directorNode.generating') || 'Generating...'}</span>
                </>
              ) : (
                <>
                  <Dices size={14} className="mr-2" />
                  <span>{t('canvasNodes.directorNode.generatePrompt') || 'Generate Prompt'}</span>
                </>
              )}
            </NodeButton>
          )}
        </div>

        {/* Generated Prompt Preview (if exists) */}
        {generatedPrompt && (
          <div className="p-3 rounded-md border border-neutral-700/20 bg-neutral-900/40 backdrop-blur-sm shadow-sm">
            <div className="text-[10px] font-mono text-neutral-500 mb-2 uppercase tracking-widest font-bold">
              {t('canvasNodes.directorNode.generatedPrompt') || 'Generated Prompt'}
            </div>
            <p className="text-xs text-neutral-200 line-clamp-4 leading-relaxed">{generatedPrompt}</p>
          </div>
        )}
      </div>
    </NodeContainer>
  );
}, (prevProps, nextProps) => {
  const prevData = prevProps.data as DirectorNodeData;
  const nextData = nextProps.data as DirectorNodeData;

  // Re-render if important props change
  if (prevData.connectedImage !== nextData.connectedImage ||
    prevData.isAnalyzing !== nextData.isAnalyzing ||
    prevData.hasAnalyzed !== nextData.hasAnalyzed ||
    prevData.isGeneratingPrompt !== nextData.isGeneratingPrompt ||
    prevData.generatedPrompt !== nextData.generatedPrompt ||
    prevData.selectedBrandingTags?.length !== nextData.selectedBrandingTags?.length ||
    prevData.selectedCategoryTags?.length !== nextData.selectedCategoryTags?.length ||
    prevData.onOpenSidePanel !== nextData.onOpenSidePanel ||
    prevData.onGeneratePrompt !== nextData.onGeneratePrompt ||
    prevProps.selected !== nextProps.selected ||
    prevProps.dragging !== nextProps.dragging) {
    return false; // Re-render
  }

  return true; // Skip re-render
});

DirectorNode.displayName = 'DirectorNode';
