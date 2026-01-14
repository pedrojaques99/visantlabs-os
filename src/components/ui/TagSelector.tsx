import React from 'react';
import { translateTag } from '@/utils/localeUtils';
import { useTheme } from '@/hooks/useTheme';

interface TagSelectorProps {
  tags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  limit?: number;
  highlight?: boolean;
}

export const TagSelector: React.FC<TagSelectorProps> = ({ tags, selectedTags, onTagToggle, limit, highlight = false }) => {
  const { theme } = useTheme();
  const limitReached = limit !== undefined && selectedTags.length >= limit;

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(tag => {
        const isSelected = selectedTags.includes(tag);
        const isDisabled = limitReached && !isSelected;

        const unselectedClass = theme === 'dark'
          ? highlight
            ? 'bg-neutral-800/50 text-neutral-300 border-[brand-cyan]/50 hover:border-[brand-cyan]/70 hover:text-white'
            : 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
          : highlight
            ? 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-400 hover:text-neutral-900'
            : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-400 hover:text-neutral-900';

        return (
          <button
            key={tag}
            onClick={() => onTagToggle(tag)}
            disabled={isDisabled}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border ${isSelected
              ? theme === 'dark'
                ? 'bg-brand-cyan/20 text-brand-cyan border-[brand-cyan]/30 shadow-sm shadow-[brand-cyan]/10'
                : 'bg-brand-cyan/20 text-neutral-800 border-[brand-cyan]/30 shadow-sm shadow-[brand-cyan]/10'
              : unselectedClass
              } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {translateTag(tag)}
          </button>
        );
      })}
    </div>
  );
};