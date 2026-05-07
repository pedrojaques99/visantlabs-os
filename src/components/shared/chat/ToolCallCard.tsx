import React, { useState } from 'react';
import { Loader2, CircleCheck, CircleX, ChevronDown } from 'lucide-react';
import { formatDuration } from '@/utils/time';
import type { ToolCallRecord } from '@shared/types/chat';

interface ToolCallCardProps {
  tc: ToolCallRecord;
}

export function ToolCallCard({ tc }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const duration = formatDuration(tc.startedAt, tc.endedAt);
  const statusColor = tc.status === 'running' ? 'text-brand-cyan' : tc.status === 'done' ? 'text-green-500' : 'text-destructive';
  const friendlyName = tc.name.replace(/_/g, ' ');

  return (
    <div className="rounded border border-border/40 bg-background/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] hover:bg-muted/30 transition-colors"
      >
        {tc.status === 'running' && <Loader2 size={10} className="animate-spin shrink-0 text-brand-cyan" />}
        {tc.status === 'done' && <CircleCheck size={10} className="text-green-500 shrink-0" />}
        {tc.status === 'error' && <CircleX size={10} className="text-destructive shrink-0" />}
        <span className={`font-mono ${statusColor}`}>{friendlyName}</span>
        {duration && <span className="text-muted-foreground/50 ml-auto font-mono">{duration}</span>}
        <ChevronDown size={8} className={`shrink-0 text-muted-foreground/40 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-2 pb-1.5 text-[9px] text-muted-foreground/70 border-t border-border/30 space-y-0.5">
          {tc.args && <p className="font-mono break-all">{typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args)}</p>}
          {tc.summary && <p>{tc.summary}</p>}
          {tc.errorMessage && <p className="text-destructive">{tc.errorMessage}</p>}
        </div>
      )}
    </div>
  );
}
