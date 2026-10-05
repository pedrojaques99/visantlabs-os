import React from 'react';
import { ThumbsUp, Wrench, Clock } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';

export type ValidationState = 'pending' | 'approved' | 'needs_work';

interface ComponentPreviewCardProps {
  id: string;
  title: string;
  subtitle?: string;
  state: ValidationState;
  onApprove: (id: string) => void;
  onNeedsWork: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}

const STATE_CONFIG = {
  pending: { icon: Clock, labelKey: 'brandReview.state.pending', color: 'text-muted-foreground' },
  approved: { icon: ThumbsUp, labelKey: 'brandReview.state.approved', color: 'text-success' },
  needs_work: { icon: Wrench, labelKey: 'brandReview.state.needsWork', color: 'text-warning' },
};

export const ComponentPreviewCard: React.FC<ComponentPreviewCardProps> = ({
  id,
  title,
  subtitle,
  state,
  onApprove,
  onNeedsWork,
  children,
  className,
}) => {
  const { t } = useTranslation();
  const cfg = STATE_CONFIG[state];
  const StateIcon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn('rounded-2xl border border-border bg-muted/20 overflow-hidden', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{title}</p>
            <div className="flex items-center gap-1 text-2xs text-muted-foreground">
              <StateIcon size={10} className={cfg.color} />
              {t(cfg.labelKey)}
            </div>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Visual Preview */}
      <div className="p-4 bg-background/40 min-h-[80px]">{children}</div>

      {/* Approval Buttons */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
        <button
          onClick={() => onApprove(id)}
          disabled={state === 'approved'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
            state === 'approved'
              ? 'border-border text-muted-foreground cursor-default'
              : 'border-border text-foreground hover:border-ring'
          )}
        >
          <ThumbsUp size={12} />
          {t('brandReview.approve')}
        </button>
        <button
          onClick={() => onNeedsWork(id)}
          disabled={state === 'approved'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
            state === 'approved'
              ? 'border-border text-muted-foreground cursor-default'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-ring'
          )}
        >
          <Wrench size={12} />
          {t('brandReview.needsWork')}
        </button>
      </div>
    </motion.div>
  );
};
