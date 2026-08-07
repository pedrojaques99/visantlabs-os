import React from 'react';
import { AlertTriangle, RefreshCw, type LucideIcon } from '@/lib/ui/icons';
import { MicroTitle } from './MicroTitle';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  /** Headline — what failed. Defaults to a generic load-failure title. */
  title?: string;
  /** Reassurance + next step. Keep it honest: the data is safe, retry. */
  description?: string;
  /** Retry handler — usually the query's `refetch` or the page's loader. */
  onRetry?: () => void;
  retryLabel?: string;
  icon?: LucideIcon;
  className?: string;
}

/**
 * The SSoT for "the fetch failed" — an error state that is visibly DISTINCT
 * from an empty state (spine 3/9). Never let a failed load render `EmptyState`;
 * a user with real data must not be told "create your first…". Mirror the
 * correct three-way branch: `error ? <ErrorState/> : empty ? <EmptyState/> : list`.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  description = 'Your work is safe. Try loading again.',
  onRetry,
  retryLabel = 'Try again',
  icon: Icon = AlertTriangle,
  className,
}) => {
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}
    >
      <Icon className="w-10 h-10 text-destructive/70 mb-4" strokeWidth={1.5} />
      <MicroTitle className="mb-2 text-foreground">{title}</MicroTitle>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>}
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
};
