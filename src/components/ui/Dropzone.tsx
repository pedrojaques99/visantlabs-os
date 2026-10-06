import * as React from 'react';
import { UploadIcon, type LucideIcon } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export interface DropzoneProps {
  /** Receives the picked/dropped files, already filtered by `accept` (and capped to 1 when `multiple` is off). */
  onFiles: (files: File[]) => void;
  /** Same syntax as `<input accept>`: `image/*`, `.svg`, `image/png,image/jpeg`. */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Visible label. Defaults to `t('upload.dropOrClick')`. */
  label?: React.ReactNode;
  /** Secondary line (formats, max size). `md` only. */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** `md` = the empty-state zone (h-48). `sm` = compact "add more" row. */
  size?: 'sm' | 'md';
  /**
   * `false` when a parent already owns drag-and-drop (MiniAppShell / ToolEditorShell
   * with `dragDrop` paint `DropOverlay`): the zone then skips its own drag
   * highlight AND its drop handling, so files aren't processed twice. Click,
   * Enter and Space still open the picker.
   */
  dropTarget?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

/** True when `file` satisfies an `<input accept>` string. Empty accept = anything. */
export function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith('.')) return name.endsWith(rule);
      if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
      return type === rule;
    });
}

/**
 * The one upload zone. A real `<input type="file">` (visually hidden, still
 * focusable) inside a `<label>`: click opens the picker, Tab reaches it,
 * Space and Enter open it. Dragging over tints the border with the focus
 * token, never a loud cyan.
 */
export const Dropzone: React.FC<DropzoneProps> = ({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  label,
  hint,
  icon: Icon = UploadIcon,
  size = 'md',
  dropTarget = true,
  id,
  name,
  className,
}) => {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragDepth = React.useRef(0);
  const [dragging, setDragging] = React.useState(false);

  const emit = React.useCallback(
    (list: FileList | null | undefined) => {
      if (!list || disabled) return;
      const files = Array.from(list).filter((f) => matchesAccept(f, accept));
      const out = multiple ? files : files.slice(0, 1);
      if (out.length) onFiles(out);
    },
    [accept, disabled, multiple, onFiles]
  );

  const dragHandlers =
    dropTarget && !disabled
      ? {
          onDragEnter: (e: React.DragEvent) => {
            e.preventDefault();
            dragDepth.current += 1;
            setDragging(true);
          },
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          },
          onDragLeave: (e: React.DragEvent) => {
            e.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragging(false);
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepth.current = 0;
            setDragging(false);
            emit(e.dataTransfer.files);
          },
        }
      : {};

  const isMd = size === 'md';

  return (
    <label
      htmlFor={id}
      data-dragging={dragging || undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        'flex w-full items-center justify-center border border-dashed border-border text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
        isMd
          ? 'h-48 flex-col gap-2 rounded-xl px-4 text-center text-sm'
          : 'h-9 gap-2 rounded-md px-3 text-xs',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:border-ring hover:text-foreground',
        dragging && 'border-ring bg-muted/40 text-foreground',
        className
      )}
      {...dragHandlers}
    >
      <Icon aria-hidden="true" className={isMd ? 'size-5' : 'size-3.5'} />
      <span>{dragging ? t('upload.releaseToUpload') : (label ?? t('upload.dropOrClick'))}</span>
      {isMd && hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onKeyDown={(e) => {
          // Space opens the picker natively; Enter doesn't in every browser.
          if (e.key === 'Enter') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onChange={(e) => {
          emit(e.target.files);
          // Reset so picking the same file again still fires `change`.
          e.target.value = '';
        }}
      />
    </label>
  );
};
