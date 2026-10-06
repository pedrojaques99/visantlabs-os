import React, { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play, Square, RotateCcw, CheckCircle2, XCircle, Clock } from '@/lib/ui/icons';
import type { BatchRunnerNodeData, BatchResult } from '@/types/reactFlow';
import { NodeContainer } from './shared/NodeContainer';
import { cn } from '@/lib/utils';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Thumb } from '@/components/ui/Thumb';
import { useTranslation } from '@/hooks/useTranslation';

const STATUS_ICON: Record<BatchResult['status'], React.ReactNode> = {
  pending: <Clock size={9} className="text-muted-foreground" />,
  running: <GlitchLoader size={9} />,
  done: <CheckCircle2 size={9} className="text-success" />,
  error: <XCircle size={9} className="text-destructive" />,
};

export const BatchRunnerNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodeData = data as BatchRunnerNodeData;
  const { status = 'idle', results = [] } = nodeData;

  const isRunning = status === 'running';
  const isDone = status === 'done' || status === 'cancelled';

  const total = results.length;
  const done = results.filter((r) => r.status === 'done').length;
  const failed = results.filter((r) => r.status === 'error').length;
  const progress = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;

  const handleRun = useCallback(() => {
    nodeData.onRun?.(id);
  }, [id, nodeData]);

  const handleCancel = useCallback(() => {
    nodeData.onCancel?.(id);
  }, [id, nodeData]);

  const handleReset = useCallback(() => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { status: 'idle', results: [] });
    }
  }, [id, nodeData]);

  return (
    <NodeContainer selected={selected} dragging={dragging} className="min-w-[280px] max-w-[340px]">
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="data-in"
        style={{
          top: '35%',
          left: -6,
          width: 10,
          height: 10,
          background: 'var(--color-neutral-500)',
          border: '2px solid var(--color-neutral-950)',
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="prompt-in"
        style={{
          top: '65%',
          left: -6,
          width: 10,
          height: 10,
          background: 'var(--color-neutral-500)',
          border: '2px solid var(--color-neutral-950)',
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Play size={12} className="text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">
          {t('canvasNodes.batchRunnerNode.title')}
        </span>
        <span
          className={cn(
            'ml-auto text-2xs px-1.5 py-0.5 rounded font-medium',
            status === 'idle' && 'text-muted-foreground bg-muted',
            status === 'running' && 'text-foreground bg-accent',
            status === 'done' && 'text-success bg-success/10',
            status === 'cancelled' && 'text-warning bg-warning/10'
          )}
        >
          {t(`canvasNodes.batchRunnerNode.status.${status}`)}
        </span>
      </div>

      {/* Connection hints */}
      {status === 'idle' && total === 0 && (
        <div className="px-3 py-2 space-y-1">
          <p className="text-2xs text-muted-foreground">
            {t('canvasNodes.batchRunnerNode.connectData')}
          </p>
          <p className="text-2xs text-muted-foreground">
            {t('canvasNodes.batchRunnerNode.connectPrompt')}
          </p>
        </div>
      )}

      {/* Progress */}
      {total > 0 && (
        <div className="px-3 pt-2 pb-1">
          <div className="flex justify-between text-2xs text-muted-foreground mb-1">
            <span>
              {t('canvasNodes.batchRunnerNode.progress', {
                done,
                failed,
                left: total - (done + failed),
              })}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-muted-foreground transition-[width] duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results list (scrollable, max 8 rows visible) */}
      {results.length > 0 && (
        <div className="px-3 py-1 max-h-[140px] overflow-y-auto space-y-0.5">
          {results.map((r) => (
            <div key={r.rowIndex} className="flex items-center gap-2">
              {STATUS_ICON[r.status]}
              <span className="text-2xs text-muted-foreground flex-1 truncate">
                {t('canvasNodes.batchRunnerNode.row', { n: r.rowIndex + 1 })}
                {r.rowData && Object.values(r.rowData)[0] ? (
                  <span className="ml-1.5 text-muted-foreground">
                    {String(Object.values(r.rowData)[0]).slice(0, 24)}
                  </span>
                ) : null}
              </span>
              {r.status === 'done' && r.outputImageUrl && (
                <Thumb
                  src={r.outputImageUrl}
                  alt=""
                  aspectRatio={1}
                  className="w-6 h-6 rounded border-node border-border"
                  fallbackClassName="[&>svg]:w-3 [&>svg]:h-3"
                />
              )}
              {r.status === 'error' && r.error && (
                <span className="text-2xs text-destructive/70 truncate max-w-[80px]">
                  {r.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-1.5 px-3 py-2">
        {!isRunning && !isDone && (
          <button
            onClick={handleRun}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded py-1.5',
              'bg-brand-cyan/15 hover:bg-brand-cyan/25 text-foreground text-2xs font-medium transition-colors'
            )}
          >
            <Play size={10} />
            {t('canvasNodes.batchRunnerNode.run')}
          </button>
        )}
        {isRunning && (
          <button
            onClick={handleCancel}
            className="flex-1 flex items-center justify-center gap-1.5 rounded py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive text-2xs font-medium transition-colors"
          >
            <Square size={10} />
            {t('common.cancel')}
          </button>
        )}
        {isDone && (
          <>
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-1.5 rounded py-1.5 bg-muted hover:bg-accent text-muted-foreground text-2xs transition-colors"
            >
              <RotateCcw size={10} />
              {t('common.reset')}
            </button>
            <button
              onClick={handleRun}
              className="flex-1 flex items-center justify-center gap-1.5 rounded py-1.5 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-foreground text-2xs transition-colors"
            >
              <Play size={10} />
              {t('canvasNodes.batchRunnerNode.rerun')}
            </button>
          </>
        )}
      </div>
    </NodeContainer>
  );
});

BatchRunnerNode.displayName = 'BatchRunnerNode';
