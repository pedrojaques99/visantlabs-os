import React, { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { Plus, Trash2, Braces } from 'lucide-react';
import type { VariablesNodeData } from '@/types/reactFlow';
import { NodeContainer } from './shared/NodeContainer';
import { NodeButton } from './shared/node-button';
import { cn } from '@/lib/utils';

export const VariablesNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { setNodes } = useReactFlow();
  const nodeData = data as VariablesNodeData;
  const variables = nodeData.variables ?? [];

  const update = useCallback(
    (newVars: Array<{ key: string; value: string }>) => {
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(id, { variables: newVars });
      }
    },
    [id, nodeData]
  );

  const handleKeyChange = useCallback(
    (idx: number, key: string) => {
      const next = variables.map((v, i) => (i === idx ? { ...v, key } : v));
      update(next);
    },
    [variables, update]
  );

  const handleValueChange = useCallback(
    (idx: number, value: string) => {
      const next = variables.map((v, i) => (i === idx ? { ...v, value } : v));
      update(next);
    },
    [variables, update]
  );

  const handleAdd = useCallback(() => {
    update([...variables, { key: '', value: '' }]);
  }, [variables, update]);

  const handleRemove = useCallback(
    (idx: number) => {
      update(variables.filter((_, i) => i !== idx));
    },
    [variables, update]
  );

  return (
    <NodeContainer selected={selected} dragging={dragging} className="min-w-[260px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <Braces size={13} className="text-brand-cyan" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
          Variables
        </span>
      </div>

      {/* Variable rows */}
      <div className="flex flex-col gap-1 px-3 py-2">
        {variables.length === 0 && (
          <p className="text-[10px] text-white/30 text-center py-2">
            No variables yet — click + to add
          </p>
        )}
        {variables.map((v, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <input
              className={cn(
                'flex-1 min-w-0 bg-white/5 border border-white/10 rounded px-2 py-1',
                'text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50'
              )}
              placeholder="name"
              value={v.key}
              onChange={(e) => handleKeyChange(idx, e.target.value)}
            />
            <span className="text-white/30 text-[11px] shrink-0">=</span>
            <input
              className={cn(
                'flex-[2] min-w-0 bg-white/5 border border-white/10 rounded px-2 py-1',
                'text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50'
              )}
              placeholder="value"
              value={v.value}
              onChange={(e) => handleValueChange(idx, e.target.value)}
            />
            <button
              onClick={() => handleRemove(idx)}
              className="shrink-0 text-white/30 hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Add row */}
      <div className="px-3 pb-2">
        <NodeButton onClick={handleAdd} className="w-full gap-1 text-[10px]">
          <Plus size={11} />
          Add variable
        </NodeButton>
      </div>

      {/* Hint */}
      <div className="px-3 pb-2">
        <p className="text-[9px] text-white/25 leading-tight">
          Use <span className="text-brand-cyan/60 font-mono">{`{{name}}`}</span> in any prompt to insert a value
        </p>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="variables-out"
        style={{ top: '50%', right: -6, width: 10, height: 10, background: '#00f5c4', border: '2px solid #0C0C0C' }}
      />
    </NodeContainer>
  );
});

VariablesNode.displayName = 'VariablesNode';
