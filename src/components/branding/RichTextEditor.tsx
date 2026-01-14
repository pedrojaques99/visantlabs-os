import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Bold, Italic, List, Palette } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import {
  applyBold,
  applyItalic,
  insertBullet,
  applyTextColor,
  setTextSelection,
} from '@/utils/markdownFormatter';
import { Textarea } from '@/components/ui/textarea';
import { renderMarkdownWithLines } from '@/utils/markdownRenderer';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const COLOR_PRESETS = [
  'brand-cyan', // Primary cyan
  '#ffffff', // White
  '#fbbf24', // Yellow
  '#f87171', // Red
  '#60a5fa', // Blue
  '#34d399', // Green
  '#a78bfa', // Purple
  '#fb7185', // Pink
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '',
  className = '',
  minHeight = '300px',
}) => {
  const { theme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const pendingCursorPos = useRef<{ start: number; end: number } | null>(null);

  // Restore cursor position after value updates
  useEffect(() => {
    if (pendingCursorPos.current && textareaRef.current) {
      const { start, end } = pendingCursorPos.current;
      setTextSelection(textareaRef.current, start, end);
      pendingCursorPos.current = null;
    }
  }, [value]);

  // Sync scroll between textarea and overlay
  const handleScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Sync scroll on mount and when value changes
  useEffect(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleFormat = useCallback(
    (
      formatFn: (
        value: string,
        start: number,
        end: number,
        ...args: any[]
      ) => { newValue: string; newStart: number; newEnd: number },
      ...formatArgs: any[]
    ) => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      const currentValue = textarea.value;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const result = formatFn(currentValue, start, end, ...formatArgs);

      // Store cursor position to restore after React update
      pendingCursorPos.current = {
        start: result.newStart,
        end: result.newEnd,
      };

      onChange(result.newValue);
    },
    [onChange]
  );

  const handleBold = () => handleFormat(applyBold);
  const handleItalic = () => handleFormat(applyItalic);
  const handleBullet = () => handleFormat(insertBullet);

  const handleColorSelect = (color: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const result = applyTextColor(textarea.value, start, end, color);

    // Store cursor position to restore after React update
    pendingCursorPos.current = {
      start: result.newStart,
      end: result.newEnd,
    };

    onChange(result.newValue);
    setShowColorPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault();
        handleBold();
      } else if (e.key === 'i') {
        e.preventDefault();
        handleItalic();
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Toolbar */}
      <div className={`flex items-center gap-1 p-2 border rounded-t-xl border-b-0 ${theme === 'dark'
        ? 'bg-neutral-900 border-neutral-800/60'
        : 'bg-neutral-100 border-neutral-300'
        }`}>
        <button
          type="button"
          onClick={handleBold}
          className={`p-2 rounded transition-colors hover:text-brand-cyan ${theme === 'dark'
            ? 'hover:bg-black/40 text-neutral-300'
            : 'hover:bg-neutral-200 text-neutral-700'
            }`}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleItalic}
          className={`p-2 rounded transition-colors hover:text-brand-cyan ${theme === 'dark'
            ? 'hover:bg-black/40 text-neutral-300'
            : 'hover:bg-neutral-200 text-neutral-700'
            }`}
          title="Itálico (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleBullet}
          className={`p-2 rounded transition-colors hover:text-brand-cyan ${theme === 'dark'
            ? 'hover:bg-black/40 text-neutral-300'
            : 'hover:bg-neutral-200 text-neutral-700'
            }`}
          title="Lista com marcadores"
        >
          <List className="h-4 w-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={`p-2 rounded transition-colors hover:text-brand-cyan ${theme === 'dark'
              ? 'hover:bg-black/40 text-neutral-300'
              : 'hover:bg-neutral-200 text-neutral-700'
              }`}
            title="Cor do texto"
          >
            <Palette className="h-4 w-4" />
          </button>
          {showColorPicker && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowColorPicker(false)}
              />
              <div className={`absolute top-full left-0 mt-1 p-2 border rounded-md shadow-lg z-20 ${theme === 'dark'
                ? 'bg-neutral-900 border-neutral-800/60'
                : 'bg-white border-neutral-300'
                }`}>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorSelect(color)}
                      className={`w-8 h-8 rounded border hover:border-[brand-cyan] transition-colors ${theme === 'dark' ? 'border-neutral-700' : 'border-neutral-400'
                        }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <div className={`mt-2 pt-2 border-t ${theme === 'dark' ? 'border-neutral-800' : 'border-neutral-300'
                  }`}>
                  <input
                    type="color"
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="w-full h-8 cursor-pointer"
                    title="Cor personalizada"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Editor container with overlay */}
      <div
        ref={containerRef}
        className={`relative rounded-t-none border-t-0 border overflow-hidden ${theme === 'dark'
          ? 'border-neutral-800/60 bg-[#141414]'
          : 'border-neutral-300 bg-white'
          }`}
        style={{ minHeight }}
      >
        {/* Transparent textarea for input - must be first for proper z-index */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder=""
          className="font-geist rounded-t-none border-0 bg-transparent text-transparent caret-[brand-cyan] resize-none relative z-10"
          style={{
            minHeight,
            color: 'transparent',
            padding: '0.5rem 0.75rem',
            fontFamily: 'var(--font-geist-mono), monospace',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        />

        {/* Overlay with rendered markdown - positioned absolutely over textarea */}
        <div
          ref={overlayRef}
          className="absolute inset-0 overflow-auto pointer-events-none px-3 py-2"
          style={{
            fontFamily: 'var(--font-geist-mono), monospace',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            minHeight,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        >
          {value ? (
            <div className={`text-sm font-manrope leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800'
              }`}>
              {renderMarkdownWithLines(value)}
            </div>
          ) : (
            <span className={`font-manrope ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'
              }`}>{placeholder}</span>
          )}
        </div>
      </div>
    </div>
  );
};

