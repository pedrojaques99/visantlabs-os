import React from 'react';
import { SkeletonLoader } from '../ui/SkeletonLoader';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../hooks/useTheme';
import { ListSection } from './ListSection';
import { CompetitorsSection } from './CompetitorsSection';
import { SWOTSection } from './SWOTSection';
import { ColorPalettesSection } from './ColorPalettesSection';
import { PersonaSection } from './PersonaSection';
import { ArchetypesSection } from './ArchetypesSection';
import { TextSection } from './TextSection';
import { EmptySectionCard } from './EmptySectionCard';

interface SectionContentRendererProps {
  stepNumber: number;
  content: any;
  isGenerating: boolean;
  isEditing: boolean;
  hasData: boolean;
  stepTitle?: string;
  onGenerate?: () => void;
  onContentChange?: (value: any) => void;
}

export const SectionContentRenderer: React.FC<SectionContentRendererProps> = ({
  stepNumber,
  content,
  isGenerating,
  isEditing,
  hasData,
  stepTitle,
  onGenerate,
  onContentChange,
}) => {
  const { t } = useTranslation();

  if (isGenerating) {
    return (
      <div className="space-y-2">
        <SkeletonLoader height="1rem" className="w-full" />
        <SkeletonLoader height="1rem" className="w-5/6" />
        <SkeletonLoader height="1rem" className="w-4/6" />
      </div>
    );
  }

  if (!hasData && onGenerate) {
    // Don't show EmptySectionCard for step 12 (moodboard)
    if (stepNumber === 12) {
      return null;
    }
    return (
      <EmptySectionCard
        stepNumber={stepNumber}
        stepTitle={stepTitle || ''}
        onGenerate={onGenerate}
        isGenerating={isGenerating}
      />
    );
  }

  // Helper function to clean and normalize string content
  const cleanString = (text: string): string => {
    if (!text) return '';
    
    // Convert literal \n to actual newlines
    let cleaned = text.replace(/\\n/g, '\n');
    
    // Remove leading/trailing whitespace but preserve internal formatting
    cleaned = cleaned.trim();
    
    // Normalize multiple consecutive newlines to double newlines (paragraph breaks)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned;
  };

  // Helper function to ensure content is a string for text sections
  const ensureString = (value: any): string => {
    if (typeof value === 'string') {
      return cleanString(value);
    }
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return cleanString(String(value));
  };

  // Step 5 is Competitors (array of strings or objects with name and url)
  if (stepNumber === 5 && Array.isArray(content)) {
    return (
      <CompetitorsSection
        competitors={content}
        isEditing={isEditing}
        onContentChange={onContentChange}
      />
    );
  }

  // Render content based on step number and type
  // Steps 6, 9 are arrays (references, visual elements)
  if ((stepNumber === 6 || stepNumber === 9) && Array.isArray(content)) {
    return (
      <ListSection
        items={content}
        isEditing={isEditing}
        onContentChange={onContentChange}
      />
    );
  }

  // Step 7 is SWOT (object)
  if (stepNumber === 7 && typeof content === 'object' && content !== null) {
    return (
      <SWOTSection
        swot={content}
        isEditing={isEditing}
        onContentChange={onContentChange}
      />
    );
  }

  // Step 8 is Color Palettes (array)
  if (stepNumber === 8 && Array.isArray(content)) {
    return (
      <ColorPalettesSection
        palettes={content}
        isEditing={isEditing}
        onContentChange={onContentChange}
      />
    );
  }

  // Step 10 is Persona (object)
  if (stepNumber === 10 && typeof content === 'object' && content !== null) {
    return (
      <PersonaSection
        persona={content}
        isEditing={isEditing}
        onContentChange={onContentChange}
      />
    );
  }

  // Step 12 is Moodboard (object)
  if (stepNumber === 12 && typeof content === 'object' && content !== null) {
    const moodboard = content as {
      summary?: string;
      visualDirection?: string;
      keyElements?: string[];
    };
    
    // Render moodboard as formatted text sections
    const moodboardText = [
      moodboard.summary ? `**Resumo:**\n${moodboard.summary}` : '',
      moodboard.visualDirection ? `**Direção Visual:**\n${moodboard.visualDirection}` : '',
      moodboard.keyElements && moodboard.keyElements.length > 0
        ? `**Elementos Chave:**\n${moodboard.keyElements.map(el => `• ${el}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    
    return (
      <TextSection
        content={moodboardText}
        isEditing={isEditing}
        onContentChange={onContentChange}
      />
    );
  }

  // Step 13 is Archetypes (object)
  if (stepNumber === 13 && typeof content === 'object' && content !== null) {
    return (
      <ArchetypesSection
        archetypes={content}
        isEditing={isEditing}
        onContentChange={onContentChange}
      />
    );
  }

  // Fallback for other string content
  if (typeof content === 'string') {
    return (
      <TextSection
        content={content}
        isEditing={isEditing}
        onContentChange={onContentChange}
      />
    );
  }

  const { theme } = useTheme();
  return (
    <div className={`text-sm font-manrope ${
      theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
    }`}>
      {JSON.stringify(content, null, 2)}
    </div>
  );
};

