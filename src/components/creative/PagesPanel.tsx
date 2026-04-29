import React, { useEffect, useRef, useState } from 'react';
import { Plus, Copy, Trash2, GripVertical, Pencil } from 'lucide-react';
import { useCreativeStore } from './store/creativeStore';
import { FORMAT_DIMENSIONS } from './lib/formatDimensions';
import type { CreativePage } from './store/creativeTypes';

const THUMB_HEIGHT = 56;

const formatAspect = (format: CreativePage['format']) => {
  const d = FORMAT_DIMENSIONS[format];
  return d.width / d.height;
};

interface ThumbProps {
  page: CreativePage;
  index: number;
  isActive: boolean;
  total: number;
  onActivate: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDragStart: (idx: number) => void;
  onDragEnter: (idx: number) => void;
  onDrop: () => void;
}

const Thumb: React.FC<ThumbProps> = ({
  page, index, isActive, total, onActivate, onRename, onDuplicate, onRemove,
  onDragStart, onDragEnter, onDrop,
}) => {
  const aspect = formatAspect(page.format);
  const width = THUMB_HEIGHT * aspect;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page.name ?? `Página ${index + 1}`);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Keep draft in sync when page name changes externally (rename, reorder).
  useEffect(() => setDraft(page.name ?? `Página ${index + 1}`), [page.name, index]);

  const commit = () => {
    setEditing(false);
    if (draft !== page.name) onRename(draft);
  };

  return (
    <div
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(index);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => onDragEnter(index)}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onClick={() => !isActive && onActivate()}
      className={`group/thumb shrink-0 relative cursor-pointer transition-all duration-200 ${
        isActive ? 'ring-2 ring-brand-cyan ring-offset-2 ring-offset-neutral-950' : 'opacity-60 hover:opacity-100'
      }`}
      style={{ width }}
    >
      {/* Thumbnail body — placeholder canvas. Real render is too heavy at 56px. */}
      <div
        className="rounded-md overflow-hidden border border-white/10 bg-neutral-900 flex items-center justify-center text-[9px] font-mono uppercase tracking-widest text-neutral-600"
        style={{ height: THUMB_HEIGHT }}
      >
        {page.format}
      </div>

      {/* Hover controls */}
      <div className="absolute -top-1 -right-1 z-10 flex items-center gap-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          title="Duplicar (Ctrl+Shift+D)"
          className="w-5 h-5 rounded bg-neutral-900/90 border border-white/10 hover:border-brand-cyan/50 flex items-center justify-center text-neutral-400 hover:text-brand-cyan"
        >
          <Copy size={9} />
        </button>
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Remover"
            className="w-5 h-5 rounded bg-neutral-900/90 border border-white/10 hover:border-red-400/50 flex items-center justify-center text-neutral-400 hover:text-red-400"
          >
            <Trash2 size={9} />
          </button>
        )}
      </div>

      {/* Drag handle (left) */}
      <div className="absolute top-1 left-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity text-neutral-500 pointer-events-none">
        <GripVertical size={10} />
      </div>

      {/* Name + index */}
      <div className="mt-1 flex items-center justify-between gap-1 px-0.5">
        <span className={`text-[9px] font-mono tabular-nums ${isActive ? 'text-brand-cyan' : 'text-neutral-500'}`}>
          {index + 1}
        </span>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(page.name ?? `Página ${index + 1}`);
                setEditing(false);
              }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-neutral-800/60 border border-brand-cyan/40 rounded px-1 text-[10px] text-white outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="flex-1 min-w-0 text-left truncate text-[10px] text-neutral-400 hover:text-white flex items-center gap-1"
            title="Duplo-clique pra renomear"
          >
            <span className="truncate">{page.name ?? `Página ${index + 1}`}</span>
            <Pencil size={8} className="opacity-0 group-hover/thumb:opacity-50 transition-opacity shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Bottom strip listing all pages of the creative. Click to activate,
 * double-click name to rename, drag to reorder, hover to reveal duplicate /
 * remove. Single source of truth: useCreativeStore pages + page actions.
 */
export const PagesPanel: React.FC = () => {
  const pages = useCreativeStore((s) => s.pages);
  const activePageIndex = useCreativeStore((s) => s.activePageIndex);
  const setActivePageIndex = useCreativeStore((s) => s.setActivePageIndex);
  const addPage = useCreativeStore((s) => s.addPage);
  const removePage = useCreativeStore((s) => s.removePage);
  const duplicatePage = useCreativeStore((s) => s.duplicatePage);
  const renamePage = useCreativeStore((s) => s.renamePage);
  const reorderPages = useCreativeStore((s) => s.reorderPages);

  const dragFromRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  if (pages.length === 0) return null;

  const onDragStart = (idx: number) => { dragFromRef.current = idx; };
  const onDragEnter = (idx: number) => { dragOverRef.current = idx; };
  const onDrop = () => {
    const from = dragFromRef.current;
    const to = dragOverRef.current;
    dragFromRef.current = null;
    dragOverRef.current = null;
    if (from === null || to === null || from === to) return;
    reorderPages(from, to);
  };

  return (
    <div className="border-t border-white/[0.04] bg-neutral-950/80 backdrop-blur-xl">
      <div className="flex items-end gap-2 px-4 py-2 overflow-x-auto custom-scrollbar-h">
        {pages.map((page, idx) => (
          <Thumb
            key={page.id}
            page={page}
            index={idx}
            isActive={idx === activePageIndex}
            total={pages.length}
            onActivate={() => setActivePageIndex(idx)}
            onRename={(name) => renamePage(idx, name)}
            onDuplicate={() => duplicatePage(idx)}
            onRemove={() => removePage(idx)}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDrop={onDrop}
          />
        ))}
        <button
          type="button"
          onClick={() => addPage()}
          title="Adicionar página"
          className="shrink-0 w-10 rounded-md border border-dashed border-white/10 hover:border-brand-cyan/40 hover:bg-brand-cyan/5 flex items-center justify-center text-neutral-500 hover:text-brand-cyan transition-colors"
          style={{ height: THUMB_HEIGHT }}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
};
