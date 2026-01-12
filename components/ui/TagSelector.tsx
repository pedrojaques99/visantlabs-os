import React from 'react';
import { translateTag } from '../../utils/localeUtils';
import { useTheme } from '../../hooks/useTheme';

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
            ? 'bg-zinc-800/50 text-zinc-300 border-[brand-cyan]/50 hover:border-[brand-cyan]/70 hover:text-white'
            : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300'
          : highlight
            ? 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:border-zinc-400 hover:text-zinc-900'
            : 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:border-zinc-400 hover:text-zinc-900';

        return (
          <button
            key={tag}
            onClick={() => onTagToggle(tag)}
            disabled={isDisabled}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border ${isSelected
              ? theme === 'dark'
                ? 'bg-brand-cyan/20 text-brand-cyan border-[brand-cyan]/30 shadow-sm shadow-[brand-cyan]/10'
                : 'bg-brand-cyan/20 text-zinc-800 border-[brand-cyan]/30 shadow-sm shadow-[brand-cyan]/10'
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