import React from 'react';
import { X, Trash2, Copy as CopyIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface NodeContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  x,
  y,
  onClose,
  onDuplicate,
  onDelete,
}) => {
  const { t } = useTranslation();
  return (
    <div
      data-context-menu
      className="fixed z-50 bg-neutral-950/70 backdrop-blur-xl border border-neutral-800/50 rounded-2xl shadow-2xl min-w-[180px] max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2.5 border-b border-neutral-800/30 flex items-center justify-between sticky top-0 bg-neutral-950/70 backdrop-blur-xl z-10 rounded-t-2xl">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">{t('canvasNodes.nodeContextMenu.title')}</span>
        <button
          onClick={onClose}
          className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 rounded transition-colors duration-150 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-2">
        <button
          onClick={() => {
            onDuplicate();
            onClose();
          }}
          className="w-full px-3 py-2.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
        >
          <CopyIcon size={16} className="text-neutral-400" />
          <span className="font-medium text-[11px] tracking-wide">{t('canvasNodes.nodeContextMenu.duplicate')}</span>
        </button>

        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-3 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
        >
          <Trash2 size={16} className="text-red-400" />
          <span className="font-medium text-[11px] tracking-wide">{t('canvasNodes.nodeContextMenu.delete')}</span>
        </button>
      </div>
    </div>
  );
};
