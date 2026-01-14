import React from 'react';
import { X, Trash2 } from 'lucide-react';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onRemove: () => void;
}

export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  x,
  y,
  onClose,
  onRemove,
}) => {
  return (
    <div
      data-context-menu
      className="fixed z-50 bg-black/90 backdrop-blur-sm border border-neutral-700/30 rounded-md shadow-xl py-2 min-w-[180px] max-h-[80vh] overflow-y-auto"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1.5 border-b border-neutral-700/30 flex items-center justify-between sticky top-0 bg-black/90 backdrop-blur-sm z-10">
        <span className="text-xs font-mono text-neutral-400 uppercase">Connection</span>
        <button
          onClick={onClose}
          className="p-0.5 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      <button
        onClick={() => {
          onRemove();
          onClose();
        }}
        className="w-full px-3 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-800/50 hover:text-red-400 transition-colors flex items-center gap-2 font-mono cursor-pointer"
      >
        <Trash2 size={14} />
        Remove Connection
      </button>
    </div>
  );
};













