import React, { useState, useEffect } from 'react';
import { Loader2, CircleCheck, CircleX, ChevronDown } from 'lucide-react';
import { formatDuration } from '@/utils/time';
import type { ToolCallRecord } from '@shared/types/chat';

interface ToolCallCardProps {
  tc: ToolCallRecord;
}

function formatArgs(args: any): string {
  if (!args) return '';
  if (typeof args === 'string') return args;
  const obj = { ...args };
  // Truncate long string values for readability
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string' && obj[key].length > 120) {
      obj[key] = obj[key].slice(0, 120) + '…';
    }
  }
  return JSON.stringify(obj, null, 2);
}

function useElapsed(startedAt: string | undefined, isRunning: boolean) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!isRunning || !startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const s = Math.round((Date.now() - start) / 1000);
      setElapsed(s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, isRunning]);
  return elapsed;
}

export function ToolCallCard({ tc }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const duration = formatDuration(tc.startedAt, tc.endedAt);
  const elapsed = useElapsed(tc.startedAt, tc.status === 'running');
  const statusColor =
    tc.status === 'running'
      ? 'text-brand-cyan'
      : tc.status === 'done'
      ? 'text-green-500'
      : 'text-destructive';
  const friendlyName = tc.name.replace(/_/g, ' ');
  const statusLabel =
    tc.status === 'running' ? 'Running' : tc.status === 'done' ? 'Completed' : 'Failed';

  return (
    <div
      className="rounded border border-border/40 bg-background/30 overflow-hidden"
      role="status"
      aria-label={`${friendlyName}: ${statusLabel}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] hover:bg-muted/30 transition-colors"
        aria-expanded={expanded}
      >
        {tc.status === 'running' && (
          <Loader2 size={10} className="animate-spin shrink-0 text-brand-cyan" />
        )}
        {tc.status === 'done' && <CircleCheck size={10} className="text-green-500 shrink-0" />}
        {tc.status === 'error' && <CircleX size={10} className="text-destructive shrink-0" />}
        <span className={`font-mono ${statusColor}`}>{friendlyName}</span>
        <span className="text-muted-foreground/50 ml-auto font-mono">
          {tc.status === 'running' ? elapsed : duration}
        </span>
        <ChevronDown
          size={8}
          className={`shrink-0 text-muted-foreground/40 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      {expanded && (
        <div className="px-2 pb-1.5 text-[10px] border-t border-border/30 space-y-1">
          {tc.args && (
            <pre className="font-mono text-muted-foreground/60 whitespace-pre-wrap break-all leading-relaxed">
              {formatArgs(tc.args)}
            </pre>
          )}
          {tc.summary && <p className="text-muted-foreground/70">{tc.summary}</p>}
          {tc.errorMessage && (
            <div className="flex items-start gap-1 text-destructive">
              <CircleX size={9} className="shrink-0 mt-0.5" />
              <p>{tc.errorMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
