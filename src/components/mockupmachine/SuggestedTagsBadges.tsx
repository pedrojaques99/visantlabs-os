import React from 'react';
import { Plus } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { translateTag } from '@/utils/localeUtils';

interface SuggestedTagsBadgesProps {
  suggestedTags: string[];
  selectedTags: string[];
  onSelect: (tag: string) => void;
  isLoading?: boolean;
  maxVisible?: number;
}

export const SuggestedTagsBadges: React.FC<SuggestedTagsBadgesProps> = ({
  suggestedTags,
  selectedTags,
  onSelect,
  isLoading = false,
  maxVisible = 3,
}) => {
  const { theme } = useTheme();

  // Filter out already selected tags
  const availableSuggestions = suggestedTags.filter((tag) => !selectedTags.includes(tag));

  if (availableSuggestions.length === 0 || isLoading) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 mb-1">
      {availableSuggestions.slice(0, maxVisible).map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onSelect(tag)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs transition-colors duration-200',
            'border border-dashed text-neutral-400 hover:text-foreground hover:bg-muted',
            theme === 'dark' ? 'border-neutral-700' : 'border-neutral-300'
          )}
        >
          <Plus size={8} />
          <span>{translateTag(tag)}</span>
        </button>
      ))}
    </div>
  );
};
