import React, { memo, useCallback } from 'react';
import { type NodeProps, Position, useReactFlow } from '@xyflow/react';
import { Compass, PanelRight, Sparkles, Image as ImageIcon, Check, Wand2 } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { DirectorNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { LabeledHandle } from './shared/LabeledHandle';
import { useTranslation } from '@/hooks/useTranslation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DirectorNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const nodeData = data as DirectorNodeData;

  const connectedImage = nodeData.connectedImage;
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

  const handleDelete = useCallback(() => {
    if (nodeData.onDelete) {
      nodeData.onDelete(id);
    } else {
      setNodes((nodes) => nodes.filter((node) => node.id !== id));
    }
  }, [nodeData.onDelete, id, setNodes]);

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
    if (hasAnalyzed) return 'text-brand-cyan';
    if (isAnalyzing) return 'text-amber-400';
    if (connectedImage) return 'node-text-muted';
    return 'node-text-subtle';
  };

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="p-5 min-w-[280px] max-w-[320px]"
    >
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
      <NodeHeader icon={Compass} title={t('canvasNodes.directorNode.title') || 'Director'} />

      {/* Connected Image Preview */}
      <div className="mt-4 mb-3">
        {connectedImage ? (
          <div className="relative rounded-lg overflow-hidden border border-neutral-700/50 bg-neutral-900/50">
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
            <div className="absolute top-2 right-2 bg-neutral-950/60 rounded-full p-1">
              <Check size={12} className="text-green-400" />
            </div>
          </div>
        ) : (
          <div className="w-full h-32 rounded-lg border border-dashed border-neutral-700/50 bg-neutral-900/30 flex flex-col items-center justify-center gap-2">
            <ImageIcon size={24} className="text-neutral-600" />
            <span className="text-[10px] font-mono text-neutral-500">
              {t('canvasNodes.directorNode.noImage') || 'No image connected'}
            </span>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-4">
        {(isAnalyzing || isGeneratingPrompt) ? (
          <GlitchLoader size={14} color="currentColor" className={getStatusColor()} />
        ) : hasAnalyzed ? (
          <Sparkles size={14} className={getStatusColor()} />
        ) : (
          <div className={cn('w-2 h-2 rounded-full', connectedImage ? 'bg-neutral-500' : 'bg-neutral-700')} />
        )}
        <span className={cn('text-xs font-mono', getStatusColor())}>
          {getStatusLabel()}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Open Side Panel Button */}
        <button
          onClick={handleOpenSidePanel}
          disabled={!connectedImage}
          className={cn(
            'w-full px-3 py-2.5 rounded-lg border transition-all duration-200',
            'flex items-center justify-center gap-2',
            'text-xs font-mono uppercase tracking-wide',
            connectedImage
              ? 'bg-brand-cyan/10 border-[brand-cyan]/30 text-brand-cyan hover:bg-brand-cyan/20 hover:border-[brand-cyan]/50'
              : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-500 cursor-not-allowed',
            'node-interactive'
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <PanelRight size={14} />
          <span>{t('canvasNodes.directorNode.openDirector') || 'Open Director'}</span>
        </button>

        {/* Generate Prompt Button (only shown when analyzed and has selections) */}
        {hasAnalyzed && (
          <button
            onClick={handleGeneratePrompt}
            disabled={!hasSelections || isGeneratingPrompt}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border transition-all duration-200',
              'flex items-center justify-center gap-2',
              'text-xs font-mono uppercase tracking-wide font-semibold',
              (!hasSelections || isGeneratingPrompt)
                ? 'bg-neutral-800/50 border-neutral-700/50 text-neutral-500 cursor-not-allowed'
                : 'bg-brand-cyan text-black border-brand-cyan hover:bg-brand-cyan/90',
              'node-interactive'
            )}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isGeneratingPrompt ? (
              <>
                <GlitchLoader size={14} color="currentColor" />
                <span>{t('canvasNodes.directorNode.generating') || 'Generating...'}</span>
              </>
            ) : (
              <>
                <Wand2 size={14} />
                <span>{t('canvasNodes.directorNode.generatePrompt') || 'Generate Prompt'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Generated Prompt Preview (if exists) */}
      {generatedPrompt && (
        <div className="mt-3 p-2 rounded-lg border border-green-500/30 bg-green-500/5">
          <div className="text-[10px] font-mono text-green-400 mb-1">
            {t('canvasNodes.directorNode.generatedPrompt') || 'Generated Prompt'}
          </div>
          <p className="text-xs node-text-primary line-clamp-3">{generatedPrompt}</p>
        </div>
      )}
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
      prevProps.selected !== nextProps.selected ||
      prevProps.dragging !== nextProps.dragging) {
    return false; // Re-render
  }

  return true; // Skip re-render
});

DirectorNode.displayName = 'DirectorNode';
