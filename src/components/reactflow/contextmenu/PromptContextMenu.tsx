import React from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Copy as CopyIcon, Save } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface PromptContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onSavePrompt: () => void;
}

export const PromptContextMenu: React.FC<PromptContextMenuProps> = ({
    x,
    y,
    onClose,
    onDuplicate,
    onDelete,
    onSavePrompt,
}) => {
    const { t } = useTranslation();

    // Close on click outside is handled by the backdrop overlay usually, or checking clicks
    // Since this is a portal, we might need an overlay or global click listener
    // But existing implementation relied on the node container? No, it was fixed position.
    // Let's add an overlay to handle closing

    return createPortal(
        <>
            <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={onClose}
                onContextMenu={(e) => { e.preventDefault(); onClose(); }}
            />
            <div
                data-context-menu
                className="fixed z-50 bg-neutral-950/90 backdrop-blur-sm border border-neutral-700/30 rounded-md shadow-xl py-2 min-w-[180px] max-h-[80vh] overflow-y-auto"
                style={{
                    left: `${x}px`,
                    top: `${y}px`,
                }}
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="px-2 py-1.5 border-b border-neutral-700/30 flex items-center justify-between sticky top-0 bg-neutral-950/90 backdrop-blur-sm z-10">
                    <span className="text-xs font-mono text-neutral-400 uppercase">Prompt Actions</span>
                    <button
                        onClick={onClose}
                        className="p-0.5 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                    >
                        <X size={12} />
                    </button>
                </div>

                <button
                    onClick={() => {
                        onSavePrompt();
                        onClose();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-brand-cyan hover:bg-brand-cyan/10 transition-colors flex items-center gap-2 font-mono cursor-pointer"
                >
                    <Save size={14} />
                    {t('canvasNodes.nodeContextMenu.savePrompt')}
                </button>

                <div className="h-px bg-neutral-700/30 my-1" />

                <button
                    onClick={() => {
                        onDuplicate();
                        onClose();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-800/50 hover:text-brand-cyan transition-colors flex items-center gap-2 font-mono cursor-pointer"
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
        </>,
        document.body
    );
};
