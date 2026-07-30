import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';

export type GenActionVariant = 'primary' | 'surprise' | 'ghost';

interface GenerationActionButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  variant?: GenActionVariant;
  /** `md` (default, dialogs) or `lg` (prominent bottom-bar CTA, mockup machine). */
  size?: 'md' | 'lg';
  /** Credit cost, rendered as a subtle numeric suffix (no emoji). */
  credits?: number;
  loading?: boolean;
  disabled?: boolean;
  /** Highlight ring — e.g. surprise-me mode active. */
  active?: boolean;
  title?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * The app's signature generation CTA — a cyan pill ("Gerar" / "Surpreenda-me").
 * Single source of truth so the mockup machine and the brand mockup dialog share
 * one button instead of each re-styling their own.
 *
 * - `primary`   → solid brand-cyan (the main generate action)
 * - `surprise`  → solid brand-cyan (visually paired with primary)
 * - `ghost`     → low-contrast surface (secondary / back / retry)
 */
export const GenerationActionButton: React.FC<GenerationActionButtonProps> = ({
  onClick,
  icon,
  label,
  variant = 'primary',
  size = 'md',
  credits,
  loading = false,
  disabled = false,
  active = false,
  title,
  className,
  'aria-label': ariaLabel,
}) => {
  const cyan = variant === 'primary' || variant === 'surprise';
  const lg = size === 'lg';
  return (
    <Button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'relative flex items-center justify-center rounded-xl border font-bold transition-all duration-300',
        'focus:outline-none focus:ring-2 focus:ring-brand-cyan/50',
        lg ? 'h-12 md:h-14' : 'h-11',
        label ? 'px-4 gap-2 md:px-5' : lg ? 'w-12 p-0 md:w-14' : 'w-11 p-0',
        cyan
          ? 'bg-brand-cyan border-brand-cyan/50 text-black shadow-lg hover:bg-brand-cyan/90 hover:scale-[1.02] active:scale-[0.98]'
          : 'bg-white/[0.03] border-neutral-800 text-neutral-300 hover:bg-white/[0.06] hover:text-white',
        active && 'ring-2 ring-brand-cyan ring-offset-2 ring-offset-neutral-950',
        (disabled || loading) && 'opacity-40 cursor-not-allowed hover:scale-100',
        className
      )}
    >
      <span className="flex shrink-0 items-center justify-center">
        {loading ? <GlitchLoader size={16} color={cyan ? 'black' : 'white'} /> : icon}
      </span>
      {label && (
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase leading-none tracking-[0.1em]">
          {label}
          {credits != null && credits > 0 && (
            <span className="text-[11px] font-semibold opacity-70">· {credits}</span>
          )}
        </span>
      )}
    </Button>
  );
};
