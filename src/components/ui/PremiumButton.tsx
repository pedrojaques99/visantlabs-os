import React from 'react';
import { cn } from '@/lib/utils';
import { GlitchLoader } from './GlitchLoader';
import { ArrowRight, LucideIcon } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';

export interface PremiumButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  icon?: LucideIcon | null;
}

export const PremiumButton = React.forwardRef<HTMLButtonElement, PremiumButtonProps>(
  (
    { className, children, disabled, isLoading, loadingText, icon: Icon = ArrowRight, ...props },
    ref
  ) => {
    const { t } = useTranslation();
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={cn(
          'w-full flex items-center justify-center gap-3 py-4 px-6 rounded-md font-medium transition-[color,background-color,border-color,transform] duration-200 relative border',
          !isDisabled
            ? 'bg-brand-cyan border-neutral-800 text-black active:scale-[0.99] hover:bg-brand-cyan/90 cursor-pointer'
            : 'bg-neutral-800/60 border-neutral-600/40 text-neutral-500 cursor-not-allowed shadow-none',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <GlitchLoader size={18} />
            <span className="text-sm text-neutral-500">{loadingText ?? t('common.loading')}</span>
          </>
        ) : (
          <>
            <span className="relative z-10 flex items-center gap-2">
              {children}
              {Icon && <Icon size={16} />}
            </span>
          </>
        )}
      </button>
    );
  }
);
PremiumButton.displayName = 'PremiumButton';
