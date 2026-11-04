import * as React from 'react';
import { NodeSlider } from '@/components/ui/NodeSlider';

export interface ScrubInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: string;
  onChange: (value: number) => void;
  className?: string;
}

/** A number with a range is the same control as a slider: one row, no box of its own. */
const ScrubInput = React.memo<ScrubInputProps>(
  ({ label, value, min, max, step = 1, suffix = '', hint, onChange, className }) => {
    const decimals = (String(step).split('.')[1] ?? '').length;
    return (
      <NodeSlider
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        hint={hint}
        className={className}
        onChange={onChange}
        formatValue={(v) => `${v.toFixed(decimals)}${suffix}`}
      />
    );
  }
);

ScrubInput.displayName = 'ScrubInput';

export { ScrubInput };
