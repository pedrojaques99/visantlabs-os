import React, { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play, Square, RotateCcw, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import type { BatchRunnerNodeData, BatchResult } from '@/types/reactFlow';
import { NodeContainer } from './shared/NodeContainer';
import { cn } from '@/lib/utils';

const STATUS_ICON: Record<BatchResult['status'], React.ReactNode> = {
  pending: <Clock size={9} className="text-white/30" />,
  running: <Loader2 size={9} className="text-brand-cyan animate-spin" />,
  done: <CheckCircle2 size={9} className="text-green-400" />,
  error: <XCircle size={9} className="text-red-400" />,
};

export const BatchRunnerNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const nodeData = data as BatchRunnerNodeData;
  const { status = 'idle', results = [] } = nodeData;

  const isRunning = status === 'running';
  const isDone = status === 'done' || status === 'cancelled';

  const total = results.length;
  const done = results.filter((r) => r.status === 'done').length;
  const failed = results.filter((r) => r.status === 'error').length;
  const progress = total > 0 ? Math.round((done + failed) / total * 100) : 0;

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
        style={{ top: '35%', left: -6, width: 10, height: 10, background: '#a78bfa', border: '2px solid #0C0C0C' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="prompt-in"
        style={{ top: '65%', left: -6, width: 10, height: 10, background: '#60a5fa', border: '2px solid #0C0C0C' }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <Play size={12} className="text-brand-cyan shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
          Batch Runner
        </span>
        <span className={cn(
          'ml-auto text-[9px] px-1.5 py-0.5 rounded font-medium',
          status === 'idle' && 'text-white/30 bg-white/5',
          status === 'running' && 'text-brand-cyan bg-brand-cyan/10',
          status === 'done' && 'text-green-400 bg-green-400/10',
          status === 'cancelled' && 'text-orange-400 bg-orange-400/10',
        )}>
          {status}
        </span>
      </div>

      {/* Connection hints */}
      {status === 'idle' && total === 0 && (
        <div className="px-3 py-2 space-y-1">
          <p className="text-[9px] text-white/25">
            <span className="text-purple-400">●</span> Connect a <span className="text-white/40">Data</span> node (rows)
          </p>
          <p className="text-[9px] text-white/25">
            <span className="text-blue-400">●</span> Connect a <span className="text-white/40">Prompt</span> node (template)
          </p>
        </div>
      )}

      {/* Progress */}
      {total > 0 && (
        <div className="px-3 pt-2 pb-1">
          <div className="flex justify-between text-[9px] text-white/40 mb-1">
            <span>{done} done · {failed} failed · {total - done - failed} left</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-cyan transition-all duration-300 rounded-full"
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
              <span className="text-[9px] text-white/40 flex-1 truncate">
                Row {r.rowIndex + 1}
                {r.rowData && Object.values(r.rowData)[0]
                  ? ` — ${String(Object.values(r.rowData)[0]).slice(0, 24)}`
                  : ''}
              </span>
              {r.status === 'done' && r.outputImageUrl && (
                <img
                  src={r.outputImageUrl.startsWith('data:') ? r.outputImageUrl : r.outputImageUrl}
                  alt=""
                  className="w-6 h-6 rounded object-cover border border-white/10"
                />
              )}
              {r.status === 'error' && r.error && (
                <span className="text-[8px] text-red-400/70 truncate max-w-[80px]">{r.error}</span>
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
              'bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan text-[10px] font-medium transition-colors'
            )}
          >
            <Play size={10} />
            Run Batch
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
              className="flex-1 flex items-center justify-center gap-1.5 rounded py-1.5 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan text-[10px] transition-colors"
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

BatchRunnerNode.displayName = 'BatchRunnerNode';
