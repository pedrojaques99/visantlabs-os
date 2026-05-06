import React, { useState, useMemo, type ReactNode } from 'react';
import { Braces, Check, Copy, Loader2, CircleCheck, CircleX, ChevronDown, ChevronUp, Undo2, RefreshCw, Clock } from 'lucide-react';
import type { ChatMessage, SummaryItem, ToolCallRecord } from '../../store/types';

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

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function formatDuration(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
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

// Lightweight markdown renderer — bold, italic, inline code, code blocks, links, lists
function renderMarkdown(text: string): ReactNode[] {
  const blocks = text.split(/\n\n+/);
  const elements: ReactNode[] = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];

    // Code block
    if (block.startsWith('```')) {
      const lines = block.split('\n');
      const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n');
      elements.push(
        <pre key={bi} className="mt-1.5 mb-1 p-2 rounded bg-background/60 border border-border/40 text-[10px] font-redhatmono overflow-x-auto whitespace-pre-wrap">
          {code}
        </pre>
      );
      continue;
    }

    // List items
    if (/^[\s]*[-*•]\s/.test(block) || /^[\s]*\d+\.\s/.test(block)) {
      const items = block.split('\n').filter(l => l.trim());
      elements.push(
        <ul key={bi} className="mt-1 mb-1 pl-3 space-y-0.5">
          {items.map((item, ii) => (
            <li key={ii} className="text-sm list-disc list-inside">
              {renderInline(item.replace(/^[\s]*[-*•]\s*/, '').replace(/^[\s]*\d+\.\s*/, ''))}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Regular paragraph
    const lines = block.split('\n');
    elements.push(
      <p key={bi} className="whitespace-pre-wrap break-words">
        {lines.map((line, li) => (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            {renderInline(line)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return elements;
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Match: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    if (match[2]) parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
    else if (match[4]) parts.push(<em key={key++}>{match[4]}</em>);
    else if (match[6]) parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-background/60 border border-border/30 text-[10px] font-redhatmono">{match[6]}</code>);
    else if (match[8] && match[9]) parts.push(<a key={key++} href={match[9]} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline">{match[8]}</a>);
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

function renderContentWithLinks(content: string, nodeMap: Map<string, string>, useMarkdown: boolean): ReactNode[] {
  if (nodeMap.size === 0 && !useMarkdown) return [content];
  if (nodeMap.size === 0 && useMarkdown) return renderMarkdown(content);

  // First pass: replace @"refs" with placeholders, then render markdown
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  AT_REF_REGEX.lastIndex = 0;
  while ((match = AT_REF_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const chunk = content.slice(lastIndex, match.index);
      if (useMarkdown) parts.push(...renderMarkdown(chunk));
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
    if (useMarkdown) parts.push(...renderMarkdown(remaining));
    else parts.push(remaining);
  }
  return parts;
}

function ToolCallCardItem({ tc }: { tc: ToolCallRecord }) {
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
        <span className={`font-redhatmono ${statusColor}`}>{friendlyName}</span>
        {duration && <span className="text-muted-foreground/50 ml-auto font-redhatmono">{duration}</span>}
        <ChevronDown size={8} className={`shrink-0 text-muted-foreground/40 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-2 pb-1.5 text-[9px] text-muted-foreground/70 border-t border-border/30 space-y-0.5">
          {tc.args && <p className="font-redhatmono break-all">{typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args)}</p>}
          {tc.summary && <p>{tc.summary}</p>}
          {tc.errorMessage && <p className="text-destructive">{tc.errorMessage}</p>}
        </div>
      )}
    </div>
  );
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

  const copyText = (text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const copy = () => copyText(json);

  const usage = message.metadata?.usage;
  const outTokens = usage?.output_tokens ?? usage?.outputTokens;
  const inTokens = usage?.input_tokens ?? usage?.inputTokens;

  const copyContent = () => copyText(message.content);

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
              <ToolCallCardItem key={tc.id} tc={tc} />
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
