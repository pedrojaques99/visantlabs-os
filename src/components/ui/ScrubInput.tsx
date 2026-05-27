import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ScrubInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  icon?: React.ReactNode;
  onChange: (value: number) => void;
  className?: string;
}

const ScrubInput = React.memo<ScrubInputProps>(({ label, value, min, max, step = 1, suffix = '', icon, onChange, className }) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const scrubRef = React.useRef<{ startX: number; startValue: number } | null>(null);

  const clamp = React.useCallback((v: number) => {
    const clamped = Math.max(min, Math.min(max, v));
    return parseFloat((Math.round(clamped / step) * step).toFixed(10));
  }, [min, max, step]);

  const display = suffix ? `${value}${suffix}` : String(value);

  const startEdit = React.useCallback(() => {
    setDraft(String(value));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [value]);

  const commitEdit = React.useCallback(() => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(clamp(parsed));
  }, [draft, onChange, clamp]);

  const onScrubDown = React.useCallback((e: React.MouseEvent) => {
    if (editing) return;
    e.preventDefault();
    scrubRef.current = { startX: e.clientX, startValue: value };
    const sensitivity = (max - min) / 300;

    const onMove = (me: MouseEvent) => {
      if (!scrubRef.current) return;
      const dx = me.clientX - scrubRef.current.startX;
      const mult = me.shiftKey ? 0.1 : 1;
      onChange(clamp(scrubRef.current.startValue + dx * sensitivity * mult));
    };

    const onUp = () => {
      if (scrubRef.current && Math.abs(0) < 2) {
        // no-op: click handled by onDoubleClick
      }
      scrubRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [editing, value, min, max, onChange, clamp]);

  const onWheel = React.useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const mult = e.shiftKey ? 0.1 : 1;
    const dir = e.deltaY < 0 ? 1 : -1;
    onChange(clamp(value + dir * step * mult));
  }, [value, step, onChange, clamp]);

  const onKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') setEditing(false);
      return;
    }
    const mult = e.shiftKey ? 0.1 : 1;
    if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + step * mult)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - step * mult)); }
  }, [editing, value, step, onChange, clamp, commitEdit]);

  return (
    <div
      className={cn('group flex items-center h-7 rounded-md border border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 focus-within:border-neutral-600 transition-colors overflow-hidden', className)}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      tabIndex={editing ? -1 : 0}
    >
      {icon && <span className="pl-1.5 text-neutral-600 shrink-0 flex items-center">{icon}</span>}
      <span
        className="px-1.5 text-[10px] font-mono text-neutral-500 uppercase tracking-wider shrink-0 cursor-ew-resize select-none"
        onMouseDown={onScrubDown}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0 flex items-center justify-end pr-1.5">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent text-right text-[11px] font-mono text-white outline-none"
            autoFocus
          />
        ) : (
          <span
            className="text-[11px] font-mono text-neutral-300 cursor-ew-resize select-none tabular-nums"
            onMouseDown={onScrubDown}
            onDoubleClick={startEdit}
          >
            {display}
          </span>
        )}
      </div>
    </div>
  );
});

ScrubInput.displayName = 'ScrubInput';

export { ScrubInput };
