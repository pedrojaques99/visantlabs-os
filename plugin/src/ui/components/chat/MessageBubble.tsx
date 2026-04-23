import React, { useState } from 'react';
import { Braces, Check, Copy, Loader2, CircleCheck, CircleX, ChevronDown, ChevronUp } from 'lucide-react';
import type { ChatMessage, ToolCallRecord } from '../../store/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

const OPS_PREVIEW_LIMIT = 4;

function friendlyOpLabel(op: any): string {
  const type = (op?.type || 'operation') as string;
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatNum(n: number | undefined): string {
  if (n == null) return '?';
  return n.toLocaleString();
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [showAllOps, setShowAllOps] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = message.operations ? JSON.stringify(message.operations, null, 2) : '';
  const ops = message.operations ?? [];
  const visibleOps = showAllOps ? ops : ops.slice(0, OPS_PREVIEW_LIMIT);
  const hiddenCount = ops.length - OPS_PREVIEW_LIMIT;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const usage = message.metadata?.usage;
  const outTokens = usage?.output_tokens ?? usage?.outputTokens;
  const inTokens = usage?.input_tokens ?? usage?.inputTokens;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
          isUser ? 'bg-brand-cyan text-black' : 'bg-card border border-border text-foreground'
        }`}
      >
        {message.thinking && (
          <div className="text-xs text-muted-foreground mb-2">
            <details>
              <summary className="cursor-pointer select-none">Thinking…</summary>
              <pre className="text-[10px] mt-1 overflow-auto max-h-24">{message.thinking}</pre>
            </details>
          </div>
        )}

        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 text-xs opacity-75">
            {message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 flex flex-col gap-0.5">
            {message.toolCalls.map((tc) => (
              <div key={tc.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {tc.status === 'running' && <Loader2 size={10} className="animate-spin shrink-0" />}
                {tc.status === 'done'    && <CircleCheck size={10} className="text-green-500 shrink-0" />}
                {tc.status === 'error'  && <CircleX size={10} className="text-destructive shrink-0" />}
                <span className="font-mono">{tc.name}</span>
                {tc.summary && <span className="opacity-70">— {tc.summary}</span>}
                {tc.errorMessage && <span className="text-destructive">{tc.errorMessage}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Operations applied */}
        {ops.length > 0 && (
          <div className="mt-2.5 rounded-md border border-border/50 bg-background/40 overflow-hidden">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/40">
              <CircleCheck size={11} className="text-green-500 shrink-0" />
              <span className="text-[10px] font-semibold text-foreground/80">
                {ops.length} operation{ops.length > 1 ? 's' : ''} applied
              </span>
            </div>
            <ul className="px-2.5 py-1.5 space-y-0.5">
              {visibleOps.map((op, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-brand-cyan/50 shrink-0" />
                  <span className="truncate">{friendlyOpLabel(op)}</span>
                </li>
              ))}
            </ul>
            {ops.length > OPS_PREVIEW_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllOps((v) => !v)}
                className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground/70 hover:text-muted-foreground py-1 border-t border-border/40 hover:bg-muted/30 transition-colors"
              >
                {showAllOps ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {showAllOps ? 'Show less' : `Show ${hiddenCount} more`}
              </button>
            )}
            <div className="px-2.5 pb-2 pt-1 border-t border-border/40 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowJson((v) => !v)}
                className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <Braces size={9} />
                {showJson ? 'Hide JSON' : 'View JSON'}
              </button>
              {showJson && (
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  {copied ? <Check size={9} /> : <Copy size={9} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            {showJson && (
              <textarea
                readOnly
                value={json}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full h-36 text-[10px] font-mono p-2 bg-background/60 border-t border-border/40 resize-y focus:outline-none"
              />
            )}
          </div>
        )}

        {/* Token usage card */}
        {!isUser && (outTokens != null || inTokens != null) && (
          <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-md bg-background/30 border border-border/30">
            <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/60">
              {outTokens != null && (
                <span title="Output tokens">
                  <span className="text-foreground/40">out</span> {formatNum(outTokens)}
                </span>
              )}
              {outTokens != null && inTokens != null && <span className="text-border">·</span>}
              {inTokens != null && (
                <span title="Input tokens">
                  <span className="text-foreground/40">in</span> {formatNum(inTokens)}
                </span>
              )}
              <span className="text-border">tok</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
