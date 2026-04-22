import React, { useState } from 'react';
import { Braces, Check, Copy, Loader2, CircleCheck, CircleX } from 'lucide-react';
import type { ChatMessage, ToolCallRecord } from '../../store/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = message.operations ? JSON.stringify(message.operations, null, 2) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

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
              <summary>Thinking...</summary>
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
        {!isUser && message.metadata?.usage && (
          <div className="mt-1.5 text-[10px] font-mono text-muted-foreground/60 flex items-center gap-1">
            <span title="output tokens">↑{message.metadata.usage.output_tokens ?? message.metadata.usage.outputTokens ?? '?'}</span>
            {(message.metadata.usage.input_tokens ?? message.metadata.usage.inputTokens) && (
              <span title="input tokens"> · ↓{message.metadata.usage.input_tokens ?? message.metadata.usage.inputTokens}</span>
            )}
            <span>tok</span>
          </div>
        )}
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
        {message.operations && message.operations.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowJson((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border/60 hover:bg-muted/50 text-muted-foreground"
            >
              <Braces size={10} />
              {showJson ? 'Hide' : 'View'} JSON ({message.operations.length})
            </button>
            {showJson && (
              <div className="mt-1 relative">
                <button
                  type="button"
                  onClick={copy}
                  className="absolute top-1 right-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-background/80 border border-border/60 hover:bg-muted"
                  title="Copy JSON"
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <textarea
                  readOnly
                  value={json}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full h-40 text-[10px] font-mono p-2 pr-14 rounded bg-background/60 border border-border/60 resize-y"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
