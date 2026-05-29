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
  hint?: string;
  onChange: (value: number) => void;
  className?: string;
}

const ScrubInput = React.memo<ScrubInputProps>(({ label, value, min, max, step = 1, suffix = '', icon, hint, onChange, className }) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const scrubRef = React.useRef<{ startX: number; startValue: number } | null>(null);
  const activeListenersRef = React.useRef<{ onMove: (e: MouseEvent) => void; onUp: () => void } | null>(null);

  const clamp = React.useCallback((v: number) => {
    const clamped = Math.max(min, Math.min(max, v));
    return parseFloat((Math.round(clamped / step) * step).toFixed(10));
  }, [min, max, step]);

  const decimals = React.useMemo(() => {
    const s = String(step);
    const dot = s.indexOf('.');
    return dot === -1 ? 0 : s.length - dot - 1;
  }, [step]);

  const display = suffix ? `${value.toFixed(decimals)}${suffix}` : value.toFixed(decimals);

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
      scrubRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      activeListenersRef.current = null;
    };

    activeListenersRef.current = { onMove, onUp };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [editing, value, min, max, onChange, clamp]);

  React.useEffect(() => {
    return () => {
      if (activeListenersRef.current) {
        document.removeEventListener('mousemove', activeListenersRef.current.onMove);
        document.removeEventListener('mouseup', activeListenersRef.current.onUp);
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

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
      className={cn(
        'group flex flex-col gap-1 rounded-md border border-neutral-800 bg-neutral-900/60',
        'hover:border-neutral-700 focus-within:border-neutral-600 transition-colors',
        'px-2 py-1.5',
        className,
      )}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      tabIndex={editing ? -1 : 0}
      title={hint}
    >
      <span
        className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest cursor-ew-resize select-none truncate leading-none"
        onMouseDown={onScrubDown}
      >
        {icon && <span className="inline-flex mr-1 align-middle text-neutral-600">{icon}</span>}
        {label}
      </span>
      <div className="flex items-center min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent text-[12px] font-mono text-white outline-none tabular-nums"
            autoFocus
          />
        ) : (
          <span
            className="text-[12px] font-mono text-neutral-200 cursor-ew-resize select-none tabular-nums leading-none"
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
