import React, { type ReactNode } from 'react';

/**
 * Parse inline markdown: **bold**, *italic*, `code`, [text](url), [color:#hex]text[/color]
 */
export function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(\[color:([^\]]+)\]([\s\S]*?)\[\/color\])/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    if (match[2]) {
      parts.push(<strong key={key++} className="font-semibold text-neutral-200">{match[2]}</strong>);
    } else if (match[4]) {
      parts.push(<em key={key++} className="text-neutral-300">{match[4]}</em>);
    } else if (match[6]) {
      parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-background/60 border border-border/30 text-[10px] font-mono">{match[6]}</code>);
    } else if (match[8] && match[9]) {
      parts.push(<a key={key++} href={match[9]} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline">{match[8]}</a>);
    } else if (match[11] && match[12] !== undefined) {
      const hexColor = match[11].startsWith('#') ? match[11] : `#${match[11]}`;
      parts.push(<span key={key++} style={{ color: hexColor }}>{match[12]}</span>);
    }
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

/**
 * Parse block-level markdown: code blocks, lists, paragraphs with inline formatting.
 */
export function renderMarkdownBlocks(text: string): ReactNode[] {
  if (!text) return [];
  const blocks = text.split(/\n\n+/);
  const elements: ReactNode[] = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];

    // Code block
    if (block.startsWith('```')) {
      const lines = block.split('\n');
      const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n');
      elements.push(
        <pre key={bi} className="mt-1.5 mb-1 p-2 rounded bg-background/60 border border-border/40 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
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

/**
 * Backward-compatible: render inline-only markdown (single line, no blocks).
 */
export const renderMarkdown = (text: string): React.ReactNode => {
  if (!text) return null;
  const nodes = renderInline(text);
  return <>{nodes}</>;
};

/**
 * Render markdown text preserving line breaks and bullets (legacy API).
 */
export const renderMarkdownWithLines = (text: string): React.ReactNode => {
  if (!text) return null;
  return <>{renderMarkdownBlocks(text)}</>;
};

interface MarkdownRendererProps {
  content: string;
  preserveLines?: boolean;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  preserveLines = false,
  className = '',
}) => {
  return (
    <div className={className}>
      {preserveLines ? renderMarkdownWithLines(content) : renderMarkdown(content)}
    </div>
  );
};
