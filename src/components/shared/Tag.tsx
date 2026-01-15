import React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export interface TagProps extends React.PropsWithChildren {
    label?: string;
    selected?: boolean;
    suggested?: boolean;
    removable?: boolean;
    onToggle?: () => void;
    onRemove?: () => void;
    className?: string;
    disabled?: boolean;
}

export const Tag: React.FC<TagProps> = ({
    label,
    children,
    selected = false,
    suggested = false,
    removable = false,
    onToggle,
    onRemove,
    className,
    disabled = false,
}) => {
    const { theme } = useTheme();

    const baseStyles = "h-7 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 border cursor-pointer inline-flex items-center gap-1.5 select-none box-border whitespace-nowrap";

    const themeStyles = theme === 'dark'
        ? selected
            ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40 shadow-sm shadow-brand-cyan/10'
            : suggested
                ? 'bg-neutral-800/80 text-neutral-300 border-brand-cyan/40 hover:border-brand-cyan/70 hover:text-white animate-pulse-subtle'
                : 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
        : selected
            ? 'bg-brand-cyan/20 text-neutral-800 border-brand-cyan/40 shadow-sm shadow-brand-cyan/10'
            : suggested
                ? 'bg-brand-cyan/10 text-neutral-800 border-brand-cyan/40 shadow-sm shadow-brand-cyan/5 animate-pulse-subtle'
                : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-400 hover:text-neutral-900';

    const disabledStyles = disabled ? "opacity-40 cursor-not-allowed" : "";

    return (
        <div
            onClick={!disabled ? onToggle : undefined}
            className={cn(baseStyles, themeStyles, disabledStyles, className)}
        >
            {children}
            {label && <span>{label}</span>}
            {removable && onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className={cn(
                        "rounded-full p-0.5 hover:bg-black/10 transition-colors",
                        theme === 'dark' ? "text-neutral-500 hover:text-white" : "text-neutral-600 hover:text-neutral-900"
                    )}
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
};
