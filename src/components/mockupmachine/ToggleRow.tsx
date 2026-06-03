import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';

interface ToggleRowProps {
  checked: boolean;
  onClick: () => void;
  label?: string;
  dark: boolean;
  tooltip?: string;
}

export const ToggleRow: React.FC<ToggleRowProps> = ({ checked, onClick, label, dark, tooltip }) => {
  const toggle = (
    <div
      className={cn(
        'w-8 h-4 rounded-full border transition-all duration-300 relative cursor-pointer',
        checked
          ? 'bg-brand-cyan/20 border-brand-cyan/40'
          : dark
          ? 'bg-neutral-900 border-neutral-800'
          : 'bg-neutral-100 border-neutral-300'
      )}
      onClick={onClick}
      role="switch"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onClick();
      }}
      aria-checked={checked}
    >
      <div
        className={cn(
          'absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-all duration-300',
          checked ? 'translate-x-4 bg-brand-cyan' : 'bg-neutral-600'
        )}
      />
    </div>
  );

  const content = label ? (
    <div
      className="flex items-center gap-3 cursor-pointer group"
      onClick={onClick}
      role="switch"
      tabIndex={0}
      aria-checked={checked}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {toggle}
      <span
        className={cn(
          'text-[10px] uppercase tracking-widest font-mono transition-colors',
          checked
            ? 'text-brand-cyan'
            : dark
            ? 'text-neutral-500 group-hover:text-neutral-400'
            : 'text-neutral-500 group-hover:text-neutral-700'
        )}
      >
        {label}
      </span>
    </div>
  ) : (
    toggle
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} position="top">
        {content}
      </Tooltip>
    );
  }

  return content;
};
