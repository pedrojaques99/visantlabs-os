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
    <div className="w-full space-y-4">
      {/* Categories & Tags Container */}
      <div className="relative bg-neutral-950 backdrop-blur-sm border border-neutral-800/40 rounded-xl p-3 md:p-4 space-y-4">
        {/* Categories Row */}
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
                    ? 'bg-neutral-800 text-white border-neutral-700 shadow-lg shadow-neutral-900/50 scale-105'
                    : 'text-neutral-500 border-transparent hover:bg-neutral-800/30 hover:text-neutral-300'
                )}
              >
                {Icon && <Icon size={14} className={isActive ? config.color : 'text-neutral-500 group-hover:text-neutral-400'} />}
                <span>
                  {t(`communityPresets.categories.${category}`) || config?.label || category}
                </span>
              </button>
            );
          })}
        </div>

        {/* Separator - Only show if we have tags */}
        {allTags.length > 0 && (
          <div className="w-full h-px bg-neutral-800/50" />
        )}

        {/* Tags Section - Horizontal Scroll */}
        {allTags.length > 0 && (
          <div className="relative group">
            <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide [&::-webkit-scrollbar]:hidden mask-linear-fade items-center">
              <button
                onClick={() => handleTagClick(null)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  filterTag === null
                    ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20'
                    : 'text-neutral-500 border-neutral-800 hover:border-neutral-700 bg-neutral-950/20 hover:bg-neutral-950/70' // Darker bg for contrast inside container
                )}
              >
                {t('communityPresets.tags.all') || 'All'}
              </button>

              <div className="w-[1px] h-4 bg-neutral-800 mx-1 flex-shrink-0" />

              {allTags.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border group/tag",
                    filterTag === tag
                      ? 'bg-neutral-800 text-neutral-100 border-neutral-700'
                      : 'text-neutral-400 border-neutral-800/50 hover:border-neutral-700 bg-neutral-950/20 hover:bg-neutral-950/70 hover:text-neutral-300'
                  )}
                >
                  <span>#{tag}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    filterTag === tag
                      ? "bg-neutral-700 text-neutral-300"
                      : "bg-neutral-900/50 text-neutral-600 group-hover/tag:text-neutral-500"
                  )}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
            {/* Gradient Fade for scroll indication - Adjusted for inside container */}
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0C0C0C]/10 to-transparent pointer-events-none md:block hidden" />
          </div>
        )}
      </div>
    </div>
  );
};

