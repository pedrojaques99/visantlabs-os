import React, { memo, useState, useCallback } from 'react';
import { Position, type NodeProps } from '@xyflow/react';
import { Play, Zap, BookmarkPlus, type LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeButton } from './shared/node-button';
import { LabeledHandle } from './shared/LabeledHandle';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { MultiOutputPanel } from './custom-node/MultiOutputPanel';
import { TransformPanel } from './custom-node/TransformPanel';
import { PipelinePanel } from './custom-node/PipelinePanel';
import { MultiInputPanel } from './custom-node/MultiInputPanel';
import type { CustomNodeData } from '@/types/reactFlow';
import type { MultiOutputConfig, TransformConfig, PipelineConfig, MultiInputConfig } from '@/types/customNode';
import { nodeBuilderApi } from '@/services/nodeBuilderApi';
import { toast } from 'sonner';

// Top offset (px) for each input handle count
const HANDLE_TOPS: Record<number, number[]> = {
  1: [80],
  2: [70, 130],
  3: [60, 110, 160],
  4: [55, 95, 135, 175],
};

export const CustomNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const nodeData = data as CustomNodeData;
  const { definition } = nodeData;
  const cfg = definition.behaviorConfig;
  const isLoading = nodeData.isLoading ?? false;
  const executionLog = nodeData.executionLog ?? [];

  const IconComponent: LucideIcon =
    ((Icons as Record<string, unknown>)[definition.iconName] as LucideIcon) ?? Zap;

  // ── Local state (user edits; synced back via onUpdateData) ──────────────
  const [localPrompts, setLocalPrompts] = useState<string[]>(
    nodeData.prompts ??
    (cfg.renderCategory === 'multi-output' ? (cfg as MultiOutputConfig).prompts : [])
  );
  const [localDescription, setLocalDescription] = useState<string>(
    nodeData.shaderDescription ??
    (cfg.renderCategory === 'transform' ? (cfg as TransformConfig).userDescription :
     cfg.renderCategory === 'multi-input' ? (cfg as MultiInputConfig).userDescription : '')
  );

  const handlePromptChange = useCallback((index: number, value: string) => {
    setLocalPrompts(prev => {
      const next = [...prev];
      next[index] = value;
      nodeData.onUpdateData?.(id, { prompts: next });
      return next;
    });
  }, [id, nodeData]);

  const handleDescriptionChange = useCallback((value: string) => {
    setLocalDescription(value);
    nodeData.onUpdateData?.(id, { shaderDescription: value });
  }, [id, nodeData]);

  const handleExecute = useCallback(() => {
    nodeData.onExecute?.(id);
  }, [id, nodeData]);

  const handleSave = useCallback(async () => {
    try {
      await nodeBuilderApi.save(definition);
      nodeData.onUpdateData?.(id, { definition: { ...definition, savedToDb: true } });
      toast.success(`"${definition.name}" saved to library`);
    } catch {
      toast.error('Failed to save node');
    }
  }, [id, nodeData, definition]);

  // ── Input handles ─────────────────────────────────────────────────────────
  const inputHandleCount: number = (() => {
    if (cfg.renderCategory === 'multi-input') return (cfg as MultiInputConfig).inputCount;
    if (cfg.renderCategory === 'transform') return 1;
    if (cfg.renderCategory === 'multi-output' && (cfg as MultiOutputConfig).acceptsImage) return 1;
    return 0;
  })();
  const handleTops = HANDLE_TOPS[inputHandleCount] ?? [];

  return (
    <NodeContainer selected={selected} dragging={dragging} className="min-w-[360px]">
      <NodeHeader icon={IconComponent} title={definition.name} selected={selected} />

      {handleTops.map((top, i) => (
        <LabeledHandle
          key={i}
          type="target"
          position={Position.Left}
          id={`input-${i}`}
          label={inputHandleCount === 1 ? 'Image' : `Image ${i + 1}`}
          handleType="image"
          style={{ top: `${top}px` }}
        />
      ))}

      <div className="node-margin">
        {cfg.renderCategory === 'multi-output' && (
          <MultiOutputPanel
            config={cfg as MultiOutputConfig}
            prompts={localPrompts}
            onChange={handlePromptChange}
            disabled={isLoading}
          />
        )}
        {cfg.renderCategory === 'transform' && (
          <TransformPanel
            config={cfg as TransformConfig}
            description={localDescription}
            onChange={handleDescriptionChange}
            disabled={isLoading}
          />
        )}
        {cfg.renderCategory === 'pipeline' && (
          <PipelinePanel
            config={cfg as PipelineConfig}
            log={executionLog}
            isLoading={isLoading}
          />
        )}
        {cfg.renderCategory === 'multi-input' && (
          <MultiInputPanel
            config={cfg as MultiInputConfig}
            description={localDescription}
            onChange={handleDescriptionChange}
            disabled={isLoading}
          />
        )}
      </div>

      <NodeButton
        variant="primary"
        size="full"
        onClick={handleExecute}
        disabled={isLoading}
        className="node-interactive"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <GlitchLoader size={14} color="brand-cyan" />
            <span className="animate-pulse">Running...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Play size={14} />
            <span className="font-semibold">Run</span>
          </div>
        )}
      </NodeButton>

      {!definition.savedToDb && (
        <NodeButton
          variant="ghost"
          size="xs"
          onClick={handleSave}
          className="nodrag nopan w-full text-neutral-600 hover:text-brand-cyan"
        >
          <BookmarkPlus size={12} />
          Save to library
        </NodeButton>
      )}

      <LabeledHandle
        type="source"
        position={Position.Right}
        id="output"
        label="Output"
        handleType="image"
        style={{ top: '50%' }}
      />
    </NodeContainer>
  );
});

CustomNode.displayName = 'CustomNode';
