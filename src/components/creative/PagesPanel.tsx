import React, { useEffect, useRef, useState } from 'react';
import { Plus, Copy, Trash2, GripVertical, Pencil } from '@/lib/ui/icons';
import { useCreativeStore } from './store/creativeStore';
import { useTranslation } from '@/hooks/useTranslation';
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
  page,
  index,
  isActive,
  total,
  onActivate,
  onRename,
  onDuplicate,
  onRemove,
  onDragStart,
  onDragEnter,
  onDrop,
}) => {
  const { t } = useTranslation();
  const defaultName = t('creative.pages.defaultName', { n: index + 1 });
  const aspect = formatAspect(page.format);
  const width = THUMB_HEIGHT * aspect;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page.name ?? defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Keep draft in sync when page name changes externally (rename, reorder).
  useEffect(() => setDraft(page.name ?? defaultName), [page.name, defaultName]);

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
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onClick={() => !isActive && onActivate()}
      className={`group/thumb shrink-0 relative cursor-pointer transition-[color,background-color,border-color,opacity] duration-200 ${
        isActive
          ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
          : 'opacity-60 hover:opacity-100'
      }`}
      style={{ width }}
    >
      {/* Thumbnail body — placeholder canvas. Real render is too heavy at 56px. */}
      <div
        className="rounded-md overflow-hidden border border-border bg-muted flex items-center justify-center text-2xs font-mono tabular-nums text-muted-foreground"
        style={{ height: THUMB_HEIGHT }}
      >
        {page.format}
      </div>

      {/* Hover controls — default visible where there's no hover (touch), reveal
          on hover-capable pointers, and always on keyboard focus (Remove has no
          other entry point, so it must not be hover-only). */}
      <div className="absolute -top-1 -right-1 z-10 flex items-center gap-0.5 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/thumb:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title={t('creative.pages.duplicate')}
          aria-label={t('creative.pages.duplicate')}
          className="w-5 h-5 rounded bg-card border border-border hover:border-border-hover flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <Copy size={9} />
        </button>
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title={t('creative.pages.remove')}
            aria-label={t('creative.pages.remove')}
            className="w-5 h-5 rounded bg-card border border-border hover:border-destructive/50 flex items-center justify-center text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={9} />
          </button>
        )}
      </div>

      {/* Drag handle (left) */}
      <div className="absolute top-1 left-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity text-muted-foreground pointer-events-none">
        <GripVertical size={10} />
      </div>

      {/* Name + index */}
      <div className="mt-1 flex items-center justify-between gap-1 px-0.5">
        <span
          className={`text-2xs font-mono tabular-nums ${
            isActive ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
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
                setDraft(page.name ?? defaultName);
                setEditing(false);
              }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={t('creative.pages.rename')}
            className="flex-1 min-w-0 bg-muted border border-ring rounded px-1 text-2xs text-foreground outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="flex-1 min-w-0 text-left truncate text-2xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            title={t('creative.pages.doubleClickRename')}
          >
            <span className="truncate">{page.name ?? defaultName}</span>
            <Pencil
              size={8}
              className="opacity-0 group-hover/thumb:opacity-50 transition-opacity shrink-0"
            />
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
  const { t } = useTranslation();
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

  const onDragStart = (idx: number) => {
    dragFromRef.current = idx;
  };
  const onDragEnter = (idx: number) => {
    dragOverRef.current = idx;
  };
  const onDrop = () => {
    const from = dragFromRef.current;
    const to = dragOverRef.current;
    dragFromRef.current = null;
    dragOverRef.current = null;
    if (from === null || to === null || from === to) return;
    reorderPages(from, to);
  };

  return (
    <div className="border-t border-border bg-background">
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
          title={t('creative.pages.add')}
          aria-label={t('creative.pages.add')}
          className="shrink-0 w-10 rounded-md border border-dashed border-border hover:border-border-hover hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          style={{ height: THUMB_HEIGHT }}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
};
