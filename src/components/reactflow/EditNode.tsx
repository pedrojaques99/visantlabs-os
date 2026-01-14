import React, { memo } from 'react';
import { type NodeProps, type Node } from '@xyflow/react';
import type { EditNodeData } from '@/types/reactFlow';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { Wrench } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export const EditNode: React.FC<NodeProps<Node<EditNodeData>>> = memo(({ data, selected, id, dragging }) => {
  const { t } = useTranslation();

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="p-5 min-w-[320px]"
    >
      <NodeHeader icon={Wrench} title={t('canvasNodes.editNode.title') || 'Edit Node'} />

      <div className="text-xs text-neutral-500 font-mono mt-4">
        {t('canvasNodes.editNode.comingSoon') || 'Edit Node functionality coming soon...'}
      </div>
    </NodeContainer>
  );
});

EditNode.displayName = 'EditNode';

