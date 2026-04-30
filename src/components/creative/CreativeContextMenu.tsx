import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy, ClipboardPaste, Files, Lock, Unlock, Eye, EyeOff,
  ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Trash2,
} from 'lucide-react';
import { useCreativeStore } from './store/creativeStore';
import { copyLayersToClipboard, pasteLayersFromClipboard } from './lib/clipboard';
import { toast } from 'sonner';

interface ContextMenuState {
  x: number;
  y: number;
  layerId: string | null; // null = canvas (no layer under cursor)
}

interface Props {
  state: ContextMenuState;
  onClose: () => void;
}

const Item: React.FC<{
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, shortcut, danger, onClick, disabled }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
    disabled={disabled}
    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] font-mono transition-colors ${
      disabled
        ? 'text-neutral-600 cursor-not-allowed'
        : danger
        ? 'text-red-400 hover:bg-red-500/10'
        : 'text-neutral-300 hover:bg-white/5 hover:text-white'
    }`}
  >
    <span className="w-3.5 flex justify-center opacity-70">{icon}</span>
    <span className="flex-1">{label}</span>
    {shortcut && <span className="text-[10px] text-neutral-600">{shortcut}</span>}
  </button>
);

const Separator: React.FC = () => <div className="my-1 h-px bg-white/5" />;

export const CreativeContextMenu: React.FC<Props> = ({ state, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const layers = useCreativeStore((s) => s.layers);
  const selectedLayerIds = useCreativeStore((s) => s.selectedLayerIds);
  const removeLayer = useCreativeStore((s) => s.removeLayer);
  const duplicateLayer = useCreativeStore((s) => s.duplicateLayer);
  const updateLayerMeta = useCreativeStore((s) => s.updateLayerMeta);
  const reorderLayer = useCreativeStore((s) => s.reorderLayer);
  const setSelectedLayerIds = useCreativeStore((s) => s.setSelectedLayerIds);

  // Dismiss on outside click / Escape
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDocDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // If right-click hit a layer that isn't in the current selection, replace selection.
  // If it hit one already selected, keep multi-selection so actions apply to all.
  const targetIds = state.layerId
    ? (selectedLayerIds.includes(state.layerId) ? selectedLayerIds : [state.layerId])
    : selectedLayerIds;
  const targetLayer = state.layerId ? layers.find((l) => l.id === state.layerId) ?? null : null;
  const hasTarget = targetIds.length > 0;

  const wrap = (fn: () => void) => () => { fn(); onClose(); };

  const onCopy = wrap(() => {
    void copyLayersToClipboard(targetIds);
  });

  const onPaste = wrap(() => {
    pasteLayersFromClipboard().then((newIds) => {
      if (newIds.length) setSelectedLayerIds(newIds);
    });
  });

  const onDuplicate = wrap(() => {
    targetIds.forEach((id) => duplicateLayer(id));
    if (targetIds.length) toast.info(`${targetIds.length} duplicadas`);
  });

  const onToggleLock = wrap(() => {
    const allLocked = targetIds.every((id) => layers.find((l) => l.id === id)?.locked);
    targetIds.forEach((id) => updateLayerMeta(id, { locked: !allLocked }));
  });

  const onToggleVisible = wrap(() => {
    const allVisible = targetIds.every((id) => layers.find((l) => l.id === id)?.visible);
    targetIds.forEach((id) => updateLayerMeta(id, { visible: !allVisible }));
  });

  const onBringForward = wrap(() => targetIds.forEach((id) => reorderLayer(id, 'up')));
  const onSendBackward = wrap(() => targetIds.forEach((id) => reorderLayer(id, 'down')));
  const onBringToFront = wrap(() => targetIds.forEach((id) => reorderLayer(id, 'top')));
  const onSendToBack = wrap(() => targetIds.forEach((id) => reorderLayer(id, 'bottom')));

  const onDelete = wrap(() => targetIds.forEach((id) => removeLayer(id)));

  const isLocked = !!targetLayer?.locked;
  const isVisible = targetLayer ? targetLayer.visible : true;

  // Clamp position so menu never overflows viewport
  const W = 220;
  const H = 360;
  const left = Math.min(state.x, window.innerWidth - W - 8);
  const top = Math.min(state.y, window.innerHeight - H - 8);

  return createPortal(
    <div
      ref={ref}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left, top, width: W }}
      className="fixed z-[10000] bg-neutral-950/95 backdrop-blur-xl border border-white/10 rounded-md shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
    >
      <Item icon={<Copy size={11} />} label="Copiar" shortcut="Ctrl+C" onClick={onCopy} disabled={!hasTarget} />
      <Item icon={<ClipboardPaste size={11} />} label="Colar" shortcut="Ctrl+V" onClick={onPaste} />
      <Item icon={<Files size={11} />} label="Duplicar" shortcut="Ctrl+D" onClick={onDuplicate} disabled={!hasTarget} />

      <Separator />

      <Item
        icon={isLocked ? <Unlock size={11} /> : <Lock size={11} />}
        label={isLocked ? 'Destravar' : 'Travar'}
        onClick={onToggleLock}
        disabled={!hasTarget}
      />
      <Item
        icon={isVisible ? <EyeOff size={11} /> : <Eye size={11} />}
        label={isVisible ? 'Ocultar' : 'Mostrar'}
        onClick={onToggleVisible}
        disabled={!hasTarget}
      />

      <Separator />

      <Item icon={<ArrowUp size={11} />} label="Avançar" onClick={onBringForward} disabled={!hasTarget} />
      <Item icon={<ChevronsUp size={11} />} label="Trazer pra frente" onClick={onBringToFront} disabled={!hasTarget} />
      <Item icon={<ArrowDown size={11} />} label="Recuar" onClick={onSendBackward} disabled={!hasTarget} />
      <Item icon={<ChevronsDown size={11} />} label="Mandar pro fundo" onClick={onSendToBack} disabled={!hasTarget} />

      <Separator />

      <Item icon={<Trash2 size={11} />} label="Apagar" shortcut="Del" danger onClick={onDelete} disabled={!hasTarget} />
    </div>,
    document.body
  );
};
