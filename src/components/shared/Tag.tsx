import React from 'react';
import { cn } from '@/lib/utils';
import { X, Shuffle } from '@/lib/ui/icons';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

export interface TagProps extends React.PropsWithChildren {
  label?: string;
  selected?: boolean;
  suggested?: boolean;
  inPool?: boolean; // For Surprise Me Mode - show dashed border
  removable?: boolean;
  onToggle?: React.MouseEventHandler<HTMLDivElement>;
  onRemove?: () => void;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  loading?: boolean;
}

export const Tag: React.FC<TagProps> = ({
  label,
  children,
  selected = false,
  suggested = false,
  inPool = false,
  removable = false,
  onToggle,
  onRemove,
  className,
  disabled = false,
  size = 'md',
  loading = false,
}) => {
  const { t } = useTranslation();
  const sizeStyles = size === 'sm' ? 'h-6 px-2 py-1 text-2xs' : 'h-7 px-3 py-1.5 text-xs';
  const baseStyles = cn(
    'font-medium rounded-full transition-colors duration-200 border inline-flex items-center gap-1.5 select-none box-border whitespace-nowrap',
    sizeStyles,
    !disabled && (onToggle || removable) ? 'cursor-pointer' : 'cursor-default'
  );

  // Pool: neutro tracejado. Selecionado: cyan (estado selecionado é o único uso de cyan aqui).
  const themeStyles = selected
    ? cn('bg-brand-cyan/20 text-foreground', inPool ? 'border-brand-cyan' : 'border-brand-cyan/40')
    : inPool
      ? 'bg-muted/40 text-muted-foreground border-border border-dashed'
      : suggested
        ? 'bg-muted text-foreground border-ring hover:border-border-hover'
        : 'bg-muted/50 text-muted-foreground border-border hover:border-border-hover hover:text-foreground';

  const disabledStyles = disabled ? 'opacity-100 cursor-not-allowed' : '';

  return (
    <div
      onClick={!disabled ? onToggle : undefined}
      role={onToggle ? 'button' : undefined}
      tabIndex={onToggle && !disabled ? 0 : undefined}
      aria-pressed={onToggle ? selected : undefined}
      onKeyDown={
        onToggle && !disabled
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      className={cn(
        baseStyles,
        themeStyles,
        disabledStyles,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {inPool && <Shuffle size={10} className="mr-0.5 opacity-70" />}
      {children}
      {loading ? (
        <SkeletonLoader variant="text" width="60px" height="0.75rem" className="rounded" />
      ) : label ? (
        <span>{label}</span>
      ) : null}
      {removable && onRemove && (
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded-full p-0.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('common.remove')}
        >
          <X size={12} />
        </Button>
      )}
    </div>
  );
};
