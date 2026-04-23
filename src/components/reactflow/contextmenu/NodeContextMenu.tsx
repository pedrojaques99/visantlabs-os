import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { X, Trash2, Copy as CopyIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';

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
    <DropdownMenu.Root open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DropdownMenu.Trigger
        style={{ position: 'fixed', left: x, top: y, width: 0, height: 0, border: 'none', background: 'transparent', padding: 0 }}
        aria-hidden
      />
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          data-context-menu
          className="fixed z-50 bg-neutral-950/70 backdrop-blur-xl border-node border-neutral-800/50 rounded-md shadow-2xl min-w-[200px] flex flex-col overflow-hidden transition-all duration-200 ease-out"
          sideOffset={0}
          onInteractOutside={() => onClose()}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2.5 border-b border-neutral-800/30 flex items-center justify-between sticky top-0 bg-neutral-950/70 backdrop-blur-xl z-10 rounded-t-2xl">
            <span className="text-xs font-semibold text-neutral-300 uppercase">{t('canvasNodes.nodeContextMenu.title')}</span>
            <Button variant="ghost"
              onClick={onClose}
              className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 rounded transition-colors duration-150 cursor-pointer"
            >
              <X size={16} />
            </Button>
          </div>

          <div className="p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent flex-1">
            <DropdownMenu.Item
              onSelect={() => { onDuplicate(); onClose(); }}
              className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <CopyIcon size={16} className="text-neutral-400 flex-shrink-0" />
              <span className="font-medium text-[11px] tracking-wide flex-1 text-left">{t('canvasNodes.nodeContextMenu.duplicate')}</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => { onDelete(); onClose(); }}
              className="w-full px-2 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <Trash2 size={16} className="text-red-400 flex-shrink-0" />
              <span className="font-medium text-[11px] tracking-wide flex-1 text-left">{t('common.delete')}</span>
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
