import React, { useState, useMemo, type ReactNode } from 'react';
import { Braces, Check, Copy, ChevronDown, ChevronUp, Undo2, RefreshCw, Clock, CircleCheck } from 'lucide-react';
import type { ChatMessage, SummaryItem } from '../../store/types';
import { copyToClipboard } from '@/utils/clipboard';
import { relativeTime } from '@/utils/time';
import { renderMarkdownBlocks } from '@/utils/markdownRenderer';
import { ToolCallCard } from '@/components/shared/chat/ToolCallCard';

interface MessageBubbleProps {
  message: ChatMessage;
  isLast?: boolean;
  onUndo?: () => void;
  onRetry?: () => void;
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


function focusNodeInFigma(nodeId: string) {
  parent.postMessage({ pluginMessage: { type: 'FOCUS_NODE', nodeId } }, 'https://www.figma.com');
}

function buildNodeMap(items?: SummaryItem[]): Map<string, string> {
  const map = new Map<string, string>();
  if (!items) return map;
  for (const item of items) {
    if (item.nodeId && item.nodeName) map.set(item.nodeName, item.nodeId);
  }
  return map;
}

const AT_REF_REGEX = /@"([^"]+)"/g;

function renderContentWithLinks(content: string, nodeMap: Map<string, string>, useMarkdown: boolean): ReactNode[] {
  if (nodeMap.size === 0 && !useMarkdown) return [content];
  if (nodeMap.size === 0 && useMarkdown) return renderMarkdownBlocks(content);

  // First pass: replace @"refs" with placeholders, then render markdown
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  AT_REF_REGEX.lastIndex = 0;
  while ((match = AT_REF_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const chunk = content.slice(lastIndex, match.index);
      if (useMarkdown) parts.push(...renderMarkdownBlocks(chunk));
      else parts.push(chunk);
    }
    const name = match[1];
    const nodeId = nodeMap.get(name);
    if (nodeId) {
      parts.push(
        <button
          key={`${nodeId}-${match.index}`}
          type="button"
          onClick={() => focusNodeInFigma(nodeId)}
          className="inline text-brand-cyan hover:underline cursor-pointer font-medium"
          title={`Go to "${name}"`}
        >
          @"{name}"
        </button>
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = AT_REF_REGEX.lastIndex;
  }
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    if (useMarkdown) parts.push(...renderMarkdownBlocks(remaining));
    else parts.push(remaining);
  }
  return parts;
}


export function MessageBubble({ message, isLast, onUndo, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.isError;
  const [showAllOps, setShowAllOps] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = message.operations ? JSON.stringify(message.operations, null, 2) : '';
  const ops = message.operations ?? [];
  const visibleOps = showAllOps ? ops : ops.slice(0, OPS_PREVIEW_LIMIT);
  const hiddenCount = ops.length - OPS_PREVIEW_LIMIT;

  const handleCopy = (text: string) => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const copy = () => handleCopy(json);

  const usage = message.metadata?.usage;
  const outTokens = usage?.output_tokens ?? usage?.outputTokens;
  const inTokens = usage?.input_tokens ?? usage?.inputTokens;

  const copyContent = () => handleCopy(message.content);

  const bubbleClass = isUser
    ? 'bg-brand-cyan text-black'
    : isError
      ? 'bg-destructive/10 border border-destructive/30 text-destructive'
      : 'bg-card border border-border text-foreground';

  return (
    <div className={`group/bubble flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200`}>
      <div className={`relative max-w-xs px-3 py-2 rounded-lg text-sm select-text ${bubbleClass}`}>
        <div className={`absolute -top-2 ${isUser ? '-left-2' : '-right-2'} flex items-center gap-0.5 opacity-0 group-hover/bubble:opacity-100 transition-opacity`}>
          {!isUser && ops.length > 0 && onUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center hover:border-brand-cyan/50"
              title="Undo operations"
            >
              <Undo2 size={9} />
            </button>
          )}
          {!isUser && isLast && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center hover:border-brand-cyan/50"
              title="Retry"
            >
              <RefreshCw size={9} />
            </button>
          )}
          <button
            type="button"
            onClick={copyContent}
            className="w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center hover:border-brand-cyan/50"
            title="Copy message"
          >
            {copied ? <Check size={9} /> : <Copy size={9} />}
          </button>
        </div>
        {message.thinking && (
          <div className="text-xs text-muted-foreground mb-2">
            <details>
              <summary className="cursor-pointer select-none">Thinking…</summary>
              <pre className="text-[10px] mt-1 overflow-auto max-h-24">{message.thinking}</pre>
            </details>
          </div>
        )}

        {/* Content: markdown for assistant, plain for user */}
        <div className="space-y-1">
          {useMemo(() => renderContentWithLinks(message.content, buildNodeMap(message.summaryItems), !isUser), [message.content, message.summaryItems, isUser])}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.attachments.map((att) =>
              att.type === 'image' && att.preview ? (
                <img
                  key={att.id}
                  src={att.preview}
                  alt={att.name}
                  className="max-w-[200px] max-h-[150px] rounded-md object-contain border border-border/50"
                />
              ) : (
                <span key={att.id} className="text-[10px] opacity-75">{att.name}</span>
              )
            )}
          </div>
        )}

        {/* Tool calls — expandable cards */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} tc={tc} />
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

        {/* Timestamp */}
        {message.timestamp && (
          <div className="mt-1 text-[9px] text-muted-foreground/40 flex items-center gap-0.5">
            <Clock size={7} />
            {relativeTime(message.timestamp)}
          </div>
        )}

      </div>
    </div>
  );
}
