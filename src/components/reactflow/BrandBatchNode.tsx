import React, { memo, useCallback, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Layers, Play, Square, RotateCcw, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { BrandBatchNodeData, BrandBatchItem } from '@/types/reactFlow';
import { NodeContainer } from './shared/NodeContainer';
import { cn } from '@/lib/utils';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Textarea } from '@/components/ui/textarea';
import { ModelSelector, getPreferredImageModel } from '../shared/ModelSelector';
import { DEFAULT_ASPECT_RATIO } from '@/constants/geminiModels';
import type { GeminiModel, SeedreamModel, AspectRatio, Resolution } from '@/types/types';
import { getCreditsRequired } from '@/utils/creditCalculator';

const STATUS_ICON: Record<BrandBatchItem['status'], React.ReactNode> = {
  pending: <Clock size={9} className="text-white/30" />,
  running: <GlitchLoader size={9} />,
  done: <CheckCircle2 size={9} className="text-green-400" />,
  error: <XCircle size={9} className="text-red-400" />,
};

export const BrandBatchNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const nodeData = data as BrandBatchNodeData;
  const { status = 'idle', items = [], connectedImages = [], prompt = '' } = nodeData;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isRunning = status === 'running';
  const isDone = status === 'done' || status === 'cancelled';

  const total = items.length;
  const done = items.filter((r) => r.status === 'done').length;
  const failed = items.filter((r) => r.status === 'error').length;
  const progress = total > 0 ? Math.round((done + failed) / total * 100) : 0;

  const hasBrand = !!(nodeData.connectedLogo || nodeData.connectedIdentity || nodeData.connectedTextDirection);
  const imageCount = connectedImages.filter(Boolean).length;

  const model = (nodeData.model || getPreferredImageModel()) as GeminiModel | SeedreamModel;
  const aspectRatio = (nodeData.aspectRatio || DEFAULT_ASPECT_RATIO) as AspectRatio;
  const resolution = (nodeData.resolution || '1K') as Resolution;
  const credits = imageCount > 0 ? imageCount * getCreditsRequired(model, resolution) : 0;

  const handleRun = useCallback(() => {
    nodeData.onRun?.(id);
  }, [id, nodeData]);

  const handleCancel = useCallback(() => {
    nodeData.onCancel?.(id);
  }, [id, nodeData]);

  const handleReset = useCallback(() => {
    nodeData.onUpdateData?.(id, { status: 'idle', items: [] });
  }, [id, nodeData]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    nodeData.onUpdateData?.(id, { prompt: e.target.value });
  }, [id, nodeData]);

  const handleModelChange = useCallback((m: GeminiModel | SeedreamModel) => {
    nodeData.onUpdateData?.(id, { model: m });
  }, [id, nodeData]);

  return (
    <NodeContainer selected={selected} dragging={dragging} className="min-w-[300px] max-w-[360px]">
      {/* Brand input */}
      <Handle
        type="target"
        position={Position.Left}
        id="brand-in"
        style={{ top: '20%', left: -6, width: 10, height: 10, background: 'var(--color-amber-400)', border: '2px solid var(--color-neutral-950)' }}
      />
      {/* Image inputs */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Handle
          key={`input-${i}`}
          type="target"
          position={Position.Left}
          id={`input-${i}`}
          style={{
            top: `${20 + i * 8}%`,
            left: -6,
            width: 8,
            height: 8,
            background: 'var(--color-violet-400)',
            border: '2px solid var(--color-neutral-950)',
          }}
        />
      ))}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ top: '50%', right: -6, width: 10, height: 10, background: 'var(--color-green-400)', border: '2px solid var(--color-neutral-950)' }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <Layers size={12} className="text-amber-400 shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
          Brand Batch
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {hasBrand && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-amber-400/10 text-amber-400 font-medium">
              BRAND
            </span>
          )}
          <span className={cn(
            'text-[9px] px-1.5 py-0.5 rounded font-medium',
            status === 'idle' && 'text-white/30 bg-white/5',
            status === 'running' && 'text-brand-cyan bg-brand-cyan/10',
            status === 'done' && 'text-green-400 bg-green-400/10',
            status === 'cancelled' && 'text-orange-400 bg-orange-400/10',
          )}>
            {status}
          </span>
        </div>
      </div>

      {/* Connection info */}
      <div className="px-3 py-1.5 space-y-0.5 border-b border-white/5">
        <p className="text-[9px] text-white/30">
          <span className="text-amber-400">●</span>{' '}
          {hasBrand ? <span className="text-white/50">Brand connected</span> : 'Connect BrandCore'}
        </p>
        <p className="text-[9px] text-white/30">
          <span className="text-violet-400">●</span>{' '}
          {imageCount > 0
            ? <span className="text-white/50">{imageCount} image{imageCount > 1 ? 's' : ''} connected</span>
            : 'Connect images (up to 8)'}
        </p>
      </div>

      {/* Prompt */}
      <div className="px-3 py-1.5">
        <Textarea
          value={prompt}
          onChange={handlePromptChange}
          placeholder="Scene prompt — applied to each image with branding..."
          className="min-h-[48px] max-h-[80px] text-[10px] bg-white/5 border-white/10 resize-none"
          disabled={isRunning}
        />
      </div>

      {/* Settings toggle */}
      <button
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className="flex items-center gap-1 px-3 py-1 text-[9px] text-white/30 hover:text-white/50 transition-colors w-full"
      >
        {isSettingsOpen ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
        Model & Settings
      </button>

      {isSettingsOpen && (
        <div className="px-3 pb-2 space-y-1.5">
          <ModelSelector
            selectedModel={model}
            onModelChange={(m) => handleModelChange(m as any)}
            type="image"
            compact
          />
        </div>
      )}

      {/* Credits estimate */}
      {imageCount > 0 && credits > 0 && status === 'idle' && (
        <div className="px-3 py-1 text-[9px] text-white/25">
          ~{credits} credits for {imageCount} generation{imageCount > 1 ? 's' : ''}
        </div>
      )}

      {/* Progress */}
      {total > 0 && (
        <div className="px-3 pt-1 pb-1">
          <div className="flex justify-between text-[9px] text-white/40 mb-1">
            <span>{done} done · {failed} failed · {total - done - failed} left</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results grid */}
      {items.length > 0 && (
        <div className="px-3 py-1 max-h-[160px] overflow-y-auto">
          <div className="grid grid-cols-4 gap-1">
            {items.map((item) => (
              <div key={item.index} className="relative aspect-square rounded overflow-hidden bg-white/5">
                {item.status === 'done' && item.outputImageUrl && (
                  <img
                    src={item.outputImageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
                {item.status === 'running' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <GlitchLoader size={12} />
                  </div>
                )}
                {item.status === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <XCircle size={10} className="text-red-400" />
                  </div>
                )}
                {item.status === 'pending' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Clock size={8} className="text-white/20" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-1.5 px-3 py-2">
        {!isRunning && !isDone && (
          <button
            onClick={handleRun}
            disabled={imageCount === 0}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded py-1.5',
              imageCount > 0
                ? 'bg-amber-400/15 hover:bg-amber-400/25 text-amber-400'
                : 'bg-white/5 text-white/20 cursor-not-allowed',
              'text-[10px] font-medium transition-colors'
            )}
          >
            <Play size={10} />
            Generate All ({imageCount})
          </button>
        )}
        {isRunning && (
          <button
            onClick={handleCancel}
            className="flex-1 flex items-center justify-center gap-1.5 rounded py-1.5 bg-red-400/10 hover:bg-red-400/20 text-red-400 text-[10px] font-medium transition-colors"
          >
            <Square size={10} />
            Cancel
          </button>
        )}
        {isDone && (
          <>
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-1.5 rounded py-1.5 bg-white/5 hover:bg-white/10 text-white/50 text-[10px] transition-colors"
            >
              <RotateCcw size={10} />
              Reset
            </button>
            <button
              onClick={handleRun}
              className="flex-1 flex items-center justify-center gap-1.5 rounded py-1.5 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 text-[10px] transition-colors"
            >
              <Play size={10} />
              Re-run
            </button>
          </>
        )}
      </div>
    </NodeContainer>
  );
});

BrandBatchNode.displayName = 'BrandBatchNode';
