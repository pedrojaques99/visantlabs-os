import React, { useCallback, memo } from 'react';
import { type NodeProps, type Node, NodeResizer } from '@xyflow/react';
import type { EditNodeData } from '@/types/reactFlow';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { Wrench } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';

export const EditNode: React.FC<NodeProps<Node<EditNodeData>>> = memo(({ data, selected, id, dragging }) => {
  const { t } = useTranslation();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();

  const handleResize = useCallback((_: any, params: { width: number; height: number }) => {
    handleResizeWithDebounce(id, params.width, 'auto', data.onResize as any);
  }, [id, data.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    fitToContent(id, 'auto', 'auto', data.onResize);
  }, [id, data.onResize, fitToContent]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className="min-w-[320px]"
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={320}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          onResize={handleResize}
        />
      )}
      <NodeHeader icon={Wrench} title={t('canvasNodes.editNode.title') || 'Edit Node'} selected={selected} />

      <div className="text-xs text-neutral-500 font-mono mt-4">
        {t('canvasNodes.editNode.comingSoon') || 'Edit Node functionality coming soon...'}
      </div>
    </NodeContainer>
  );
});

EditNode.displayName = 'EditNode';

