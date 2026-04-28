import React from 'react';
import { cn } from '../lib/utils';
import type { PromptCategory } from '../types/communityPrompts';
import { CATEGORY_CONFIG } from './PresetCard';

interface CommunityPresetsSidebarProps {
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
  activeCategory,
  onCategoryChange,
  allTags,
  filterTag,
  onFilterTagChange,
  currentPresetsCount,
  categories,
  t,
}) => (
  <div className="space-y-3">
    {/* Categories */}
    <div className="flex flex-wrap gap-1.5">
      {categories.map((cat) => {
        const cfg = CATEGORY_CONFIG[cat];
        const Icon = cfg?.icon;
        const isActive = activeCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-wide transition-all duration-100 border',
              isActive
                ? 'bg-white/[0.06] border-white/10 text-neutral-200'
                : 'border-transparent text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.03]'
            )}
          >
            {Icon && <Icon size={12} className={isActive ? cfg.color : 'text-neutral-700'} />}
            {cfg?.label ?? cat}
          </button>
        );
      })}
    </div>

    {/* Tags */}
    {allTags.length > 0 && (
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 items-center">
        <button
          onClick={() => onFilterTagChange(null)}
          className={cn(
            'shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all duration-100',
            filterTag === null
              ? 'bg-white/[0.06] border-white/10 text-neutral-300'
              : 'border-transparent text-neutral-700 hover:text-neutral-400'
          )}
        >
          all tags
        </button>
        <div className="w-px h-3 bg-neutral-800 shrink-0" />
        {allTags.map(({ tag, count }) => (
          <button
            key={tag}
            onClick={() => onFilterTagChange(filterTag === tag ? null : tag)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all duration-100',
              filterTag === tag
                ? 'bg-white/[0.06] border-white/10 text-neutral-200'
                : 'border-transparent text-neutral-700 hover:text-neutral-400'
            )}
          >
            #{tag}
            <span className="text-neutral-800">{count}</span>
          </button>
        ))}
      </div>
    )}
  </div>
);
