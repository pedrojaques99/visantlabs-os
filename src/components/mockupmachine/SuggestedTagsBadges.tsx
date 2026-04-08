import React from 'react';
import { Diamond } from 'lucide-react';
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
  const availableSuggestions = suggestedTags.filter(
    (tag) => !selectedTags.includes(tag)
  );

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
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wide transition-all duration-200",
            "border border-dashed cursor-pointer group",
            theme === 'dark'
              ? "bg-brand-cyan/5 border-brand-cyan/30 text-brand-cyan/80 hover:bg-brand-cyan/15 hover:border-brand-cyan/50"
              : "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/20 hover:border-brand-cyan/60"
          )}
        >
          <Diamond size={8} className="opacity-60 group-hover:opacity-300 transition-opacity" />
          <span>{translateTag(tag)}</span>
        </button>
      ))}
    </div>
  );
};
