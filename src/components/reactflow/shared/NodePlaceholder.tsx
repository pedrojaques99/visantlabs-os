import React from 'react';
import { Maximize2 } from '@/lib/ui/icons';
import { GeneratingImageCard } from '@/components/ui/GeneratingImageCard';

interface NodePlaceholderProps {
  isLoading?: boolean;
  uploadButton?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  emptySubmessage?: string;
  /** kept for API compatibility; the unified loader owns its own timer */
  elapsedTime?: number;
}

export const NodePlaceholder: React.FC<NodePlaceholderProps> = ({
  isLoading = false,
  uploadButton,
  emptyIcon = <Maximize2 size={32} className="text-neutral-600" />,
  emptyMessage = 'No output',
  emptySubmessage = 'Connect a node to see result',
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 p-5 text-neutral-500 min-h-[75px] relative"
      style={{ width: '100%', minWidth: isLoading ? '200px' : '150px' }}
    >
      {isLoading ? (
        <GeneratingImageCard isLoading variant="inline" />
      ) : (
        <>
          {uploadButton || (
            <>
              {emptyIcon}
              <span className="text-xs font-mono text-neutral-500 text-center">{emptyMessage}</span>
              {emptySubmessage && (
                <span className="text-xs font-mono text-neutral-600 text-center">
                  {emptySubmessage}
                </span>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
