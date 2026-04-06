import React from 'react';

/**
 * Parses a string with <accent>...</accent> tags into React nodes.
 * Words inside <accent> get wrapped in a span with the accent color.
 *
 * Example: "BUY <accent>NOW</accent>" with accent='#ff0' →
 *   ['BUY ', <span style={{color:'#ff0'}}>NOW</span>]
 *
 * Falls back to plain text if no tags are present.
 */
export function parseAccent(content: string, accentColor: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /<accent>(.*?)<\/accent>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      React.createElement(
        'span',
        { key: `accent-${key++}`, style: { color: accentColor } },
        match[1]
      )
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
}

/**
 * Strips <accent> tags returning plain text — used as the value when entering
 * contentEditable mode (we re-wrap accent words on save heuristically, but
 * during edit the user works with plain text).
 */
export function stripAccent(content: string): string {
  return content.replace(/<\/?accent>/g, '');
}
