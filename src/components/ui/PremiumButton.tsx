import React from 'react';
import { cn } from '@/lib/utils';
import { GlitchLoader } from './GlitchLoader';
import { ArrowRight, LucideIcon } from 'lucide-react';

export interface PremiumButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  icon?: LucideIcon | null;
}

export const PremiumButton = React.forwardRef<HTMLButtonElement, PremiumButtonProps>(
  ({ className, children, disabled, isLoading, loadingText = 'LOADING...', icon: Icon = ArrowRight, ...props }, ref) => {
    
    const isDisabled = disabled || isLoading;
    
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={cn(
            "w-full flex items-center justify-center gap-3 py-4 px-6 rounded-md font-mono text-base font-bold transition-all duration-500 group overflow-hidden relative border",
            !isDisabled
                ? "bg-brand-cyan border-brand-cyan/50 text-black shadow-[0_10px_40px_rgba(var(--brand-cyan-rgb),0.2)] hover:scale-[1.01] active:scale-[0.99] hover:bg-brand-cyan/90 cursor-pointer"
                : "bg-neutral-800/60 border-neutral-600/40 text-neutral-500 cursor-not-allowed shadow-none",
            className
        )}
        {...props}
      >
        {isLoading ? (
            <>
                {/* Loader uses a visible color when button is active but loading, but since isLoading makes it disabled, we use neutral text */}
                <GlitchLoader size={18} color="#737373" />
                <span className="animate-pulse tracking-widest text-sm text-neutral-500">{loadingText}</span>
            </>
        ) : (
            <>
                <span className="relative z-10 flex items-center gap-2 tracking-widest">
                    {children}
                    {Icon && <Icon size={18} className="transition-transform duration-300 group-hover:translate-x-1" />}
                </span>
                {!isDisabled && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                )}
            </>
        )}
      </button>
    )
  }
)
PremiumButton.displayName = "PremiumButton"
