import React, { useRef, useState } from 'react';
import { Menu, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import type { PromptCategory } from '../types/communityPrompts';
import { CATEGORY_CONFIG } from './PresetCard';

interface CommunityPresetsSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeCategory: PromptCategory;
  onCategoryChange: (category: PromptCategory) => void;
  allTags: { tag: string; count: number }[];
  filterTag: string | null;
  onFilterTagChange: (tag: string | null) => void;
  currentPresetsCount: number;
  categories: PromptCategory[];
  t: (key: string) => string;
}

export const CommunityPresetsSidebar: React.FC<CommunityPresetsSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  activeCategory,
  onCategoryChange,
  allTags,
  filterTag,
  onFilterTagChange,
  currentPresetsCount,
  categories,
  t,
}) => {
  const handleTagClick = (tag: string | null) => {
    onFilterTagChange(filterTag === tag ? null : tag);
  };


  return (
    <div className="w-full space-y-4 mb-2">
      {/* Categories Section */}
      <div className="relative bg-black/30 backdrop-blur-sm border border-zinc-800/40 rounded-xl p-2">
        <div className="flex flex-wrap gap-2 items-center justify-center md:justify-start">
          {categories.map((category) => {
            const config = CATEGORY_CONFIG[category];
            const Icon = config?.icon;
            const isActive = activeCategory === category;

            return (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 border",
                  isActive
                    ? 'bg-zinc-800 text-white border-zinc-700 shadow-lg shadow-zinc-900/50 scale-105'
                    : 'text-zinc-500 border-transparent hover:bg-zinc-800/30 hover:text-zinc-300'
                )}
              >
                {Icon && <Icon size={14} className={isActive ? config.color : 'text-zinc-500 group-hover:text-zinc-400'} />}
                <span>
                  {t(`communityPresets.categories.${category}`) || config?.label || category}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags Section - Horizontal Scroll */}
      {allTags.length > 0 && (
        <div className="relative group">
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide [&::-webkit-scrollbar]:hidden mask-linear-fade items-center">
            <button
              onClick={() => handleTagClick(null)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                filterTag === null
                  ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20'
                  : 'text-zinc-500 border-zinc-800 hover:border-zinc-700 bg-black/20 hover:bg-black/40'
              )}
            >
              {t('communityPresets.tags.all') || 'All'}
            </button>

            <div className="w-[1px] h-6 bg-zinc-800 mx-1 flex-shrink-0" />

            {allTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border group/tag",
                  filterTag === tag
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                    : 'text-zinc-400 border-zinc-800/50 hover:border-zinc-700 bg-black/20 hover:bg-black/40 hover:text-zinc-300'
                )}
              >
                <span>#{tag}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  filterTag === tag
                    ? "bg-zinc-700 text-zinc-300"
                    : "bg-zinc-900/50 text-zinc-600 group-hover/tag:text-zinc-500"
                )}>
                  {count}
                </span>
              </button>
            ))}
          </div>
          {/* Gradient Fade for scroll indication */}
          <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-[#121212] to-transparent pointer-events-none md:block hidden" />
        </div>
      )}
    </div>
  );
};

