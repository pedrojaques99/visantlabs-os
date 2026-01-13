import React from 'react';

/**
 * Parse and render markdown text to React elements
 * Supports: **bold**, *italic*, - bullets, [color:#hex]text[/color]
 */

interface ParsedNode {
  type: 'text' | 'bold' | 'italic' | 'color' | 'bullet';
  content: string;
  color?: string;
}

/**
 * Parse markdown text into nodes
 */
const parseMarkdown = (text: string): ParsedNode[] => {
  if (!text) return [];
  
  const nodes: ParsedNode[] = [];
  let i = 0;
  let currentText = '';
  
  while (i < text.length) {
    // Check for color tags: [color:#hex]text[/color]
    const colorTagMatch = text.substring(i).match(/^\[color:([^\]]+)\]/);
    if (colorTagMatch) {
      // Save any accumulated text
      if (currentText) {
        nodes.push({ type: 'text', content: currentText });
        currentText = '';
      }
      
      const color = colorTagMatch[1];
      const tagLength = colorTagMatch[0].length;
      i += tagLength;
      
      // Find closing tag
      const closingTag = '[/color]';
      const closingIndex = text.indexOf(closingTag, i);
      
      if (closingIndex !== -1) {
        const colorContent = text.substring(i, closingIndex);
        nodes.push({ type: 'color', content: colorContent, color });
        i = closingIndex + closingTag.length;
        continue;
      } else {
        // No closing tag, treat as regular text
        currentText += text.substring(i - tagLength, i);
        continue;
      }
    }
    
    // Check for bold: **text**
    if (text.substring(i, i + 2) === '**') {
      // Save any accumulated text
      if (currentText) {
        nodes.push({ type: 'text', content: currentText });
        currentText = '';
      }
      
      const closingBold = text.indexOf('**', i + 2);
      if (closingBold !== -1) {
        const boldContent = text.substring(i + 2, closingBold);
        nodes.push({ type: 'bold', content: boldContent });
        i = closingBold + 2;
        continue;
      }
    }
    
    // Check for italic: *text* (but not ** which is bold)
    if (text[i] === '*' && text[i + 1] !== '*') {
      // Save any accumulated text
      if (currentText) {
        nodes.push({ type: 'text', content: currentText });
        currentText = '';
      }
      
      const closingItalic = text.indexOf('*', i + 1);
      if (closingItalic !== -1) {
        const italicContent = text.substring(i + 1, closingItalic);
        nodes.push({ type: 'italic', content: italicContent });
        i = closingItalic + 1;
        continue;
      }
    }
    
    // Regular character
    currentText += text[i];
    i++;
  }
  
  // Add remaining text
  if (currentText) {
    nodes.push({ type: 'text', content: currentText });
  }
  
  return nodes;
};

/**
 * Render a single parsed node
 */
const renderNode = (node: ParsedNode, key: number): React.ReactNode => {
  switch (node.type) {
    case 'bold':
      return (
        <strong key={key} className="font-semibold text-zinc-200">
          {node.content}
        </strong>
      );
    case 'italic':
      return (
        <em key={key} className="italic text-zinc-300">
          {node.content}
        </em>
      );
    case 'color':
      const color = node.color || '#ffffff';
      // Normalize color format
      const hexColor = color.startsWith('#') ? color : `#${color}`;
      return (
        <span key={key} style={{ color: hexColor }}>
          {node.content}
        </span>
      );
    case 'text':
    default:
      return node.content;
  }
};

/**
 * Render markdown text with formatting
 */
export const renderMarkdown = (text: string): React.ReactNode => {
  if (!text) return null;
  
  const nodes = parseMarkdown(text);
  
  return (
    <>
      {nodes.map((node, index) => renderNode(node, index))}
    </>
  );
};

/**
 * Render markdown text preserving line breaks and bullets
 */
export const renderMarkdownWithLines = (text: string): React.ReactNode => {
  if (!text) return null;
  
  const lines = text.split('\n');
  
  return (
    <>
      {lines.map((line, lineIndex) => {
        const trimmedLine = line.trim();
        
        // Check if it's a bullet point
        const bulletMatch = trimmedLine.match(/^[-*•]\s*(.+)$/);
        if (bulletMatch) {
          const bulletContent = bulletMatch[1];
          return (
            <div key={lineIndex} className="flex items-start gap-2 mb-2">
              <span className="text-brand-cyan mt-1 flex-shrink-0 font-bold">•</span>
              <span className="flex-1">{renderMarkdown(bulletContent)}</span>
            </div>
          );
        }
        
        // Regular line
        if (trimmedLine) {
          return (
            <p key={lineIndex} className="mb-2">
              {renderMarkdown(trimmedLine)}
            </p>
          );
        }
        
        // Empty line
        return <br key={lineIndex} />;
      })}
    </>
  );
};

/**
 * Component to render markdown text
 */
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




















