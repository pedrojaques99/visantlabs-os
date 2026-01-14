import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NodeWarningIndicatorProps {
  warning?: string;
  className?: string;
}

/**
 * NodeWarningIndicator - Subtle warning icon displayed on nodes with issues
 * 
 * Shows a small warning triangle that displays the full warning message on hover.
 * Used primarily to indicate oversized content that can't be saved.
 */
export const NodeWarningIndicator: React.FC<NodeWarningIndicatorProps> = ({
  warning,
  className,
}) => {
  if (!warning) return null;

  return (
    <div
      className={cn(
        "absolute top-1 left-1 z-20 group/warning",
        className
      )}
    >
      <div className="relative">
        <div className="p-1 bg-neutral-700/30 hover:bg-neutral-700/40 rounded-md transition-colors cursor-help border border-neutral-600/30">
          <AlertTriangle size={12} className="text-neutral-400" strokeWidth={2} />
        </div>

        {/* Tooltip on hover */}
        <div className="absolute left-0 top-full mt-1 opacity-0 group-hover/warning:opacity-100 transition-opacity duration-200 pointer-events-none group-hover/warning:pointer-events-auto z-50">
          <div className="bg-neutral-900 border border-neutral-600/30 rounded-md shadow-xl p-2 max-w-[280px] min-w-[200px]">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-neutral-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-xs text-neutral-400 leading-relaxed">
                {warning}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

