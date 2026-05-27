import React from 'react';
import { LucideIcon } from 'lucide-react';
import { MicroTitle } from './MicroTitle';
import { Button } from './button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Icon className="w-10 h-10 text-neutral-600 mb-4" strokeWidth={1.5} />
      <MicroTitle className="mb-2">{title}</MicroTitle>
      {description && (
        <p className="text-sm text-neutral-500 font-mono max-w-sm mb-6">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
