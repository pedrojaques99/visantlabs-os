import React from 'react';
import { ThumbsUp, Wrench, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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
  pending: { icon: Clock, label: 'Pending', color: 'text-neutral-500', bg: 'bg-neutral-800/50 border-white/5' },
  approved: { icon: ThumbsUp, label: 'Approved', color: 'text-brand-cyan', bg: 'bg-brand-cyan/5 border-brand-cyan/20' },
  needs_work: { icon: Wrench, label: 'Needs work', color: 'text-amber-400', bg: 'bg-amber-400/5 border-amber-400/20' },
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
  const cfg = STATE_CONFIG[state];
  const StateIcon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        'rounded-2xl border overflow-hidden transition-all duration-300',
        state === 'approved' ? 'border-brand-cyan/20 bg-brand-cyan/[0.02]' : 'border-white/[0.06] bg-white/[0.01]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold text-white truncate">{title}</p>
            <div className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-md border', cfg.bg)}>
              <StateIcon size={9} className={cfg.color} />
              <span className={cn('text-[9px] font-mono uppercase tracking-widest', cfg.color)}>{cfg.label}</span>
            </div>
          </div>
          {subtitle && <p className="text-[10px] text-neutral-600 font-mono mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Visual Preview */}
      <div className="p-4 bg-neutral-950/40 min-h-[80px]">
        {children}
      </div>

      {/* Approval Buttons */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.04]">
        <button
          onClick={() => onApprove(id)}
          disabled={state === 'approved'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all',
            state === 'approved'
              ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan cursor-default'
              : 'border-green-500/20 bg-green-500/5 text-green-400 hover:bg-green-500/15 hover:border-green-500/40'
          )}
        >
          <ThumbsUp size={10} />
          Looks good
        </button>
        <button
          onClick={() => onNeedsWork(id)}
          disabled={state === 'approved'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all',
            state === 'approved'
              ? 'border-white/5 text-neutral-700 cursor-default'
              : 'border-rose-400/20 bg-rose-400/5 text-rose-400 hover:bg-rose-400/15 hover:border-rose-400/40'
          )}
        >
          <Wrench size={10} />
          Needs work...
        </button>
      </div>
    </motion.div>
  );
};
