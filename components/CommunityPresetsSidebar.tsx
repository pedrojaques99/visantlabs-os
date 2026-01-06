import React, { useRef, useState } from 'react';
import { Menu, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import type { PromptCategory } from '../types/communityPrompts';
import { LayoutGrid, Box, Settings, Palette, Sparkles, ImageIcon, Camera, Layers, MapPin, Sun } from 'lucide-react';

const CATEGORY_CONFIG: Record<PromptCategory, { icon: any; color: string; label: string }> = {
  'all': { icon: LayoutGrid, color: 'text-zinc-300', label: 'All Prompts' },
  '3d': { icon: Box, color: 'text-purple-400', label: '3D' },
  'presets': { icon: Settings, color: 'text-blue-400', label: 'Presets' },
  'aesthetics': { icon: Palette, color: 'text-pink-400', label: 'Aesthetics' },
  'themes': { icon: Sparkles, color: 'text-amber-400', label: 'Themes' },
  'mockup': { icon: ImageIcon, color: 'text-blue-400', label: 'Mockup' },
  'angle': { icon: Camera, color: 'text-cyan-400', label: 'Angle' },
  'texture': { icon: Layers, color: 'text-green-400', label: 'Texture' },
  'ambience': { icon: MapPin, color: 'text-orange-400', label: 'Ambience' },
  'luminance': { icon: Sun, color: 'text-yellow-400', label: 'Luminance' },
};

interface CommunityPresetsSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeCategory: PromptCategory;
  onCategoryChange: (category: PromptCategory) => void;
  allTags: string[];
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
    <div className="relative bg-black/30 backdrop-blur-sm border border-zinc-800/40 rounded-md px-3 md:px-4 py-2.5 md:py-3 opacity-70 hover:opacity-90 transition-opacity w-full transition-all duration-300">

      {/* Categories Section - Always visible */}
      <div className="space-y-2 mb-3">
        <div className="flex flex-wrap gap-1.5 transition-all duration-300">
          {categories.map((category) => {
            const config = CATEGORY_CONFIG[category];
            const Icon = config?.icon;
            const isActive = activeCategory === category;
            
            return (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-all whitespace-nowrap",
                  isActive
                    ? 'bg-zinc-800/50 text-zinc-200 border-zinc-700/50'
                    : 'text-zinc-500 border-zinc-700/20 hover:border-zinc-600/30 hover:bg-zinc-800/30'
                )}
              >
                {Icon && <Icon size={12} className={isActive ? config.color : 'text-zinc-500'} />}
                <span>
                  {t(`communityPresets.categories.${category}`) || config?.label || category}
                </span>
              </button>
            );
          })}
          <button
          onClick={onToggleCollapse}
          className="p-1 text-zinc-500 hover:text-zinc-400 transition-colors flex-shrink-0 ml-auto transition-all duration-300"
          title={isCollapsed ? (t('communityPresets.filters.show') || 'Show filters') : (t('communityPresets.filters.collapse') || 'Collapse')}
        >
          {isCollapsed ? <Menu size={14} /> : <ChevronUp size={14} />}
        </button>
        </div>
      </div>

      {/* Tags Section - Cloud Layout - Only visible when expanded */}
      {!isCollapsed && allTags.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold font-mono uppercase text-zinc-400 tracking-wider mb-2 transition-all duration-300">
            {t('communityPresets.tags.title') || 'Tags'}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleTagClick(null)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-mono border transition-all whitespace-nowrap",
                filterTag === null
                  ? 'text-brand-cyan border-[#52ddeb]/30 bg-brand-cyan/10'
                  : 'text-zinc-500 border-zinc-700/20 hover:border-zinc-600/30 hover:bg-zinc-800/30'
              )}
            >
              {t('communityPresets.tags.all') || 'All Tags'}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-mono border transition-all whitespace-nowrap",
                  filterTag === tag
                    ? 'text-brand-cyan border-[#52ddeb]/30 bg-brand-cyan/10'
                    : 'text-zinc-500 border-zinc-700/20 hover:border-zinc-600/30 hover:bg-zinc-800/30'
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

