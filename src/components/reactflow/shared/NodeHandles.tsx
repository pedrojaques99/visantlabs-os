import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { HandleType } from './LabeledHandle';

interface NodeHandlesProps {
  handleType?: HandleType;
}

export const NodeHandles = ({ handleType = 'image' }: NodeHandlesProps) => {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className={cn('node-handle', `handle-${handleType}`)}
        data-handle-type={handleType}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={cn('node-handle', `handle-${handleType}`)}
        data-handle-type={handleType}
      />
    </>
  );
};
