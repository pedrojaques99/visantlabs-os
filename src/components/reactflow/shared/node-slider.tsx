import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NodeSliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  hint?: string;
}

const NodeSlider = React.forwardRef<HTMLInputElement, NodeSliderProps>(
  (
    {
      label,
      value,
      min,
      max,
      step = 0.01,
      onChange,
      formatValue,
      hint,
      className,
      onMouseDown,
      ...props
    },
    ref
  ) => {
    const percentage = ((value - min) / (max - min)) * 100;
    const scrubRef = React.useRef<{ startX: number; startValue: number } | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (onMouseDown) onMouseDown(e);
    };

    const clamp = (v: number) => {
      const clamped = Math.max(min, Math.min(max, v));
      return parseFloat((Math.round(clamped / step) * step).toFixed(10));
    };

    const handleScrubDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      scrubRef.current = { startX: clientX, startValue: value };
      const sensitivity = (max - min) / 400;

      const onMove = (me: MouseEvent | TouchEvent) => {
        if (!scrubRef.current) return;
        const x = 'touches' in me ? me.touches[0].clientX : (me as MouseEvent).clientX;
        const dx = x - scrubRef.current.startX;
        const mult = 'shiftKey' in me && me.shiftKey ? 0.1 : 1;
        onChange(clamp(scrubRef.current.startValue + dx * sensitivity * mult));
      };

      const onUp = () => {
        scrubRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    };

    const displayValue = formatValue ? formatValue(value) : value.toFixed(2);

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono text-neutral-400" title={hint}>
            {label}
          </label>
          <span
            className="text-xs font-mono text-neutral-500 cursor-ew-resize select-none hover:text-neutral-300 transition-colors"
            onMouseDown={handleScrubDown}
            onTouchStart={handleScrubDown}
            title="Drag to adjust"
          >
            {displayValue}
          </span>
        </div>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          className={cn(
            'w-full h-1.5 bg-neutral-800 rounded-md appearance-none cursor-pointer',
            'transition-all duration-150',
            className
          )}
          style={{
            background: `linear-gradient(to right, #a3a3a3 0%, #a3a3a3 ${percentage}%, #3f3f46 ${percentage}%, #3f3f46 100%)`,
          }}
          {...props}
        />
      </div>
    );
  }
);
NodeSlider.displayName = 'NodeSlider';

export { NodeSlider };
