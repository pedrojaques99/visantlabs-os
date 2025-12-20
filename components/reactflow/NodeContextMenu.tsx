import React from 'react';
import { X, Trash2, Copy as CopyIcon } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

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
      className="fixed z-50 bg-black/90 backdrop-blur-sm border border-zinc-700/30 rounded-md shadow-xl py-2 min-w-[180px] max-h-[80vh] overflow-y-auto"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1.5 border-b border-zinc-700/30 flex items-center justify-between sticky top-0 bg-black/90 backdrop-blur-sm z-10">
        <span className="text-xs font-mono text-zinc-400 uppercase">{t('canvasNodes.nodeContextMenu.title')}</span>
        <button
          onClick={onClose}
          className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>
      
      <button
        onClick={() => {
          onDuplicate();
          onClose();
        }}
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-[#52ddeb] transition-colors flex items-center gap-2 font-mono cursor-pointer"
      >
        <CopyIcon size={14} />
        {t('canvasNodes.nodeContextMenu.duplicate')}
      </button>
      
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 font-mono cursor-pointer"
      >
        <Trash2 size={14} />
        {t('canvasNodes.nodeContextMenu.delete')}
      </button>
    </div>
  );
};
