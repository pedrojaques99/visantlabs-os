import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { RichTextEditor } from './RichTextEditor';
import { MarkdownRenderer } from '@/utils/markdownRenderer';

interface PublicoAlvoSectionProps {
  content: string;
  isEditing?: boolean;
  onContentChange?: (value: string) => void;
}

export const PublicoAlvoSection: React.FC<PublicoAlvoSectionProps> = ({
  content,
  isEditing = false,
  onContentChange,
}) => {
  const { theme } = useTheme();

  // Helper to clean and normalize content
  const cleanContent = (text: string): string => {
    if (!text) return '';

    // Convert literal \n to actual newlines
    let cleaned = text.replace(/\\n/g, '\n');

    // Remove leading/trailing whitespace but preserve internal formatting
    cleaned = cleaned.trim();

    // Normalize multiple consecutive newlines to double newlines (paragraph breaks)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned;
  };

  // Ensure content is always a string and clean it
  const safeContent = typeof content === 'string'
    ? cleanContent(content)
    : (content ? cleanContent(String(content)) : '');

  if (isEditing && onContentChange) {
    return (
      <RichTextEditor
        value={safeContent}
        onChange={onContentChange}
        placeholder="Digite sua análise de público alvo aqui..."
        minHeight="300px"
      />
    );
  }

  // If content is empty, show placeholder
  if (!safeContent.trim()) {
    return (
      <div className={`border rounded-xl p-4 md:p-6 transition-colors ${theme === 'dark'
        ? 'bg-black/40 border-neutral-800/60'
        : 'bg-neutral-100 border-neutral-300'
        }`}>
        <div className={`text-sm font-manrope italic ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'
          }`}>
          Nenhum conteúdo disponível.
        </div>
      </div>
    );
  }

  // Dividir texto em parágrafos e renderizar em cards se for texto muito longo
  // Apenas dividir se houver múltiplos parágrafos claramente separados E o texto for muito longo
  const paragraphs = safeContent.split('\n\n').filter(p => p.trim());
  const hasMultipleParagraphs = paragraphs.length > 1;
  const isVeryLongText = safeContent.length > 1000;

  // Só dividir em cards se houver múltiplos parágrafos E o texto for muito longo
  // Caso contrário, renderizar como um único bloco de texto
  if (hasMultipleParagraphs && isVeryLongText) {
    return (
      <div className="space-y-4">
        {paragraphs.map((paragraph, index) => (
          <div
            key={index}
            className={`border rounded-xl p-4 md:p-6 transition-colors ${theme === 'dark'
              ? 'bg-black/40 border-neutral-800/60 hover:border-neutral-700/60'
              : 'bg-neutral-100 border-neutral-300 hover:border-neutral-400'
              }`}
          >
            <div className={`text-sm font-manrope leading-relaxed ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
              }`}>
              <MarkdownRenderer content={paragraph.trim()} preserveLines />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render as a single block of text with proper line breaks
  return (
    <div className={`border rounded-xl p-4 md:p-6 transition-colors ${theme === 'dark'
      ? 'bg-black/40 border-neutral-800/60 hover:border-neutral-700/60'
      : 'bg-neutral-100 border-neutral-300 hover:border-neutral-400'
      }`}>
      <div className={`text-sm font-manrope leading-relaxed whitespace-pre-wrap ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
        }`}>
        <MarkdownRenderer content={safeContent} preserveLines />
      </div>
    </div>
  );
};

