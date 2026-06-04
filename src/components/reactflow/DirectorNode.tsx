import React, { memo, useCallback } from 'react';
import { type NodeProps, Position, NodeResizer } from '@xyflow/react';
import { Compass, PanelRight, Image as ImageIcon, Check, Dices, Zap } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import type { DirectorNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { LabeledHandle } from './shared/LabeledHandle';
import { useTranslation } from '@/hooks/useTranslation';
import { NodeButton } from './shared/node-button';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DirectorNode = memo(
  ({ data, selected, id, dragging }: NodeProps<any>) => {
    const { t } = useTranslation();
    const nodeData = data as DirectorNodeData;
    const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();

    const rawConnected = nodeData.connectedImage;
    const connectedImage =
      typeof rawConnected === 'string' && rawConnected.trim().length > 0
        ? rawConnected.trim()
        : undefined;
    const isAnalyzing = nodeData.isAnalyzing || false;
    const hasAnalyzed = nodeData.hasAnalyzed || false;
    const isGeneratingPrompt = nodeData.isGeneratingPrompt || false;
    const activeGenerations = nodeData.activeGenerations || 0;

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

    const handleOpenSidePanel = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (nodeData.onOpenSidePanel) {
          nodeData.onOpenSidePanel(id);
        }
      },
      [nodeData.onOpenSidePanel, id]
    );

    const handleGeneratePrompt = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (nodeData.onGeneratePrompt) {
          nodeData.onGeneratePrompt(id);
        }
      },
      [nodeData.onGeneratePrompt, id]
    );

    const handleGenerateMockup = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (nodeData.onGenerateMockup) {
          nodeData.onGenerateMockup(id);
        }
      },
      [nodeData.onGenerateMockup, id]
    );

    // Check if we have selections for generate button
    const hasSelections =
      nodeData.selectedDesignType !== null &&
      nodeData.selectedDesignType !== undefined &&
      ((nodeData.selectedBrandingTags?.length || 0) > 0 ||
        (nodeData.selectedCategoryTags?.length || 0) > 0 ||
        (nodeData.selectedLocationTags?.length || 0) > 0 ||
        (nodeData.selectedAngleTags?.length || 0) > 0 ||
        (nodeData.selectedLightingTags?.length || 0) > 0 ||
        (nodeData.selectedEffectTags?.length || 0) > 0 ||
        (nodeData.selectedMaterialTags?.length || 0) > 0 ||
        (nodeData.selectedColors?.length || 0) > 0);

    const handleResize = useCallback(
      (_: any, params: { width: number }) => {
        handleResizeWithDebounce(id, params.width, 'auto', nodeData.onResize);
      },
      [id, nodeData.onResize, handleResizeWithDebounce]
    );

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
            onResize={handleResize}
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

        <NodeHeader
          icon={Compass}
          title={t('canvasNodes.directorNode.title') || 'Director'}
          selected={selected}
        />

        <div className="node-margin flex flex-col gap-[var(--node-gap)]">
          {/* Connected Image Preview */}
          <div className="">
            {connectedImage ? (
              <div className="relative rounded-md overflow-hidden border-node border-neutral-700/50 bg-neutral-900/50 shadow-sm">
                <img
                  src={
                    connectedImage.startsWith('data:')
                      ? connectedImage
                      : connectedImage.startsWith('http://') ||
                        connectedImage.startsWith('https://')
                      ? connectedImage
                      : `data:image/png;base64,${connectedImage}`
                  }
                  alt="Connected"
                  className="w-full h-32 object-cover"
                />
                <div className="absolute top-2 right-2 bg-neutral-950/60 rounded-full p-1 border-node border-neutral-700/30 shadow-md">
                  <Check size={12} className="text-brand-cyan" />
                </div>
              </div>
            ) : (
              <div className="w-full h-24 rounded-md border-node border-dashed border-neutral-700/50 bg-neutral-900/30 flex flex-col items-center justify-center gap-2 opacity-70">
                <ImageIcon size={16} className="text-neutral-600" />
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                  {t('canvasNodes.directorNode.noImage') || 'No image'}
                </span>
              </div>
            )}
          </div>

          {/* Active generations indicator */}
          {activeGenerations > 0 && (
            <div className="p-2.5 rounded-md border-node border-brand-cyan/20 bg-brand-cyan/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-cyan">
                  {activeGenerations} {activeGenerations === 1 ? 'mockup' : 'mockups'}
                </span>
                <span className="text-[9px] font-mono text-neutral-500">
                  {t('canvasNodes.directorNode.generating') || 'generating'}
                </span>
              </div>
              <PremiumGlitchLoader color="var(--brand-cyan)" />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {/* Generate Mockup — always available, fires new prompt each time */}
            <NodeButton
              variant="primary"
              size="full"
              onClick={handleGenerateMockup}
              disabled={!connectedImage || isGeneratingPrompt}
              className="shadow-sm backdrop-blur-sm nodrag"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Zap size={14} className="mr-2" />
              <span>{t('canvasNodes.directorNode.generateMockup') || 'Generate Mockup'}</span>
              {activeGenerations > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-black/30 text-[10px] tabular-nums">
                  +{activeGenerations}
                </span>
              )}
            </NodeButton>

            {/* Open Side Panel — advanced users */}
            <NodeButton
              variant="default"
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
                variant="default"
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
        </div>
      </NodeContainer>
    );
  },
  (prevProps, nextProps) => {
    const prevData = prevProps.data as DirectorNodeData;
    const nextData = nextProps.data as DirectorNodeData;

    if (
      prevData.connectedImage !== nextData.connectedImage ||
      prevData.isAnalyzing !== nextData.isAnalyzing ||
      prevData.hasAnalyzed !== nextData.hasAnalyzed ||
      prevData.isGeneratingPrompt !== nextData.isGeneratingPrompt ||
      prevData.activeGenerations !== nextData.activeGenerations ||
      prevData.selectedBrandingTags?.length !== nextData.selectedBrandingTags?.length ||
      prevData.selectedCategoryTags?.length !== nextData.selectedCategoryTags?.length ||
      prevData.onOpenSidePanel !== nextData.onOpenSidePanel ||
      prevData.onGeneratePrompt !== nextData.onGeneratePrompt ||
      prevProps.selected !== nextProps.selected ||
      prevProps.dragging !== nextProps.dragging
    ) {
      return false; // Re-render
    }

    return true; // Skip re-render
  }
);

DirectorNode.displayName = 'DirectorNode';
