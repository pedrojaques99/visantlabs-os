import React from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export type ItemStatus = 'queued' | 'processing' | 'done' | 'error';

export function StatusBadge({ status }: { status: ItemStatus }) {
  switch (status) {
    case 'queued':
      return <span className="text-[10px] font-mono text-neutral-600 uppercase">Queued</span>;
    case 'processing':
      return (
        <span className="flex items-center gap-1 text-[10px] font-mono text-brand-cyan uppercase">
          <Loader2 size={8} className="animate-spin" /> Processing
        </span>
      );
    case 'done':
      return (
        <span className="flex items-center gap-1 text-[10px] font-mono text-success uppercase">
          <CheckCircle2 size={8} /> Done
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1 text-[10px] font-mono text-destructive uppercase">
          <AlertCircle size={8} /> Error
        </span>
      );
  }
}
