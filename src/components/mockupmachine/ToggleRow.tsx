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
  // One switch per row: with a label the whole row is the control and the
  // track is purely visual (two nested role="switch" read twice and tab twice).
  const switchProps = {
    onClick,
    role: 'switch' as const,
    tabIndex: 0,
    'aria-checked': checked,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onClick();
    },
  };

  const track = (
    <div
      className={cn(
        'w-8 h-4 rounded-full border transition-colors duration-300 relative cursor-pointer shrink-0',
        checked
          ? 'bg-brand-cyan/20 border-brand-cyan/40'
          : dark
            ? 'bg-neutral-900 border-neutral-800'
            : 'bg-neutral-100 border-neutral-300'
      )}
      {...(label ? {} : switchProps)}
    >
      <div
        className={cn(
          'absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-[background-color,transform] duration-300',
          checked ? 'translate-x-4 bg-brand-cyan' : 'bg-neutral-600'
        )}
      />
    </div>
  );

  const content = label ? (
    <div
      className="flex items-center gap-3 cursor-pointer group rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      {...switchProps}
    >
      {track}
      <span
        className={cn(
          'text-xs transition-colors',
          checked
            ? 'text-foreground'
            : dark
              ? 'text-neutral-500 group-hover:text-neutral-400'
              : 'text-neutral-500 group-hover:text-neutral-700'
        )}
      >
        {label}
      </span>
    </div>
  ) : (
    track
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
