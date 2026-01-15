import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Dices } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { translateTag } from '@/utils/localeUtils';
import { organizeTagsByGroup, CATEGORY_GROUPS } from '@/utils/categoryGroups';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/shared/Tag';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MockupTagCategory } from '@/services/mockupTagService';
import { MockupPreset } from '../../types/mockupPresets';

interface CategoriesSectionProps {
  suggestedTags: string[];
  availableTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  isAnalyzing: boolean;
  isAllCategoriesOpen: boolean;
  onToggleAllCategories: () => void;
  customInput: string;
  onCustomInputChange: (value: string) => void;
  onAddCustomTag: () => void;
  onRandomize: () => void;
  isComplete: boolean;
  displaySuggestedTags: string[];
  tagCategories: MockupTagCategory[];
  mockupPresets?: MockupPreset[];
}

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  suggestedTags,
  availableTags,
  selectedTags,
  onTagToggle,
  isAnalyzing,
  isAllCategoriesOpen,
  onToggleAllCategories,
  customInput,
  onCustomInputChange,
  onAddCustomTag,
  onRandomize,
  isComplete,
  displaySuggestedTags,
  tagCategories,
  mockupPresets = []
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isEditingCustom && inputRef.current) {
      inputRef.current.focus();
    }

    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, [isEditingCustom]);

  const handleCustomTagClick = () => {
    setIsEditingCustom(true);
  };

  const handleCustomTagSubmit = () => {
    if (customInput.trim()) {
      onAddCustomTag();
      setIsEditingCustom(false);
    } else {
      handleCustomTagCancel();
    }
  };

  const handleCustomTagCancel = () => {
    onCustomInputChange('');
    setIsEditingCustom(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      handleCustomTagSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      handleCustomTagCancel();
    }
  };

  const handleBlur = () => {
    // Delay blur to allow click events to fire first
    blurTimeoutRef.current = window.setTimeout(() => {
      handleCustomTagSubmit();
    }, 150);
  };

  // Merge available tags with suggested tags (default tags first, then AI suggested tags)
  const mergedTags = [...new Set([...availableTags, ...displaySuggestedTags])];

  // Organize tags by category from database
  const dynamicGroups = useMemo(() => {
    if (!tagCategories || tagCategories.length === 0) {
      // Fallback to legacy grouping
      const organized = organizeTagsByGroup(mergedTags);
      return CATEGORY_GROUPS.map(cg => ({
        id: cg.id,
        key: cg.id, // standardized property name
        tags: organized.get(cg.id) || []
      })).filter(g => g.tags.length > 0);
    }

    // Map merged tags to their database categories
    const groups = tagCategories.map(cat => {
      const dbTagNames = cat.tags.map(t => t.name);

      // Also include presets that belong to this category based on their mockupCategoryId
      const presetNamesInCategory = (mockupPresets || [])
        .filter(p => p.mockupCategoryId === cat.id)
        .map(p => p.name);

      return {
        id: cat.id,
        key: cat.name, // the translation key
        tags: mergedTags.filter(tag =>
          dbTagNames.includes(tag) || presetNamesInCategory.includes(tag)
        )
      };
    });

    return groups.filter(g => g.tags.length > 0);
  }, [tagCategories, mergedTags]);

  // Tags that didn't fit into any deliberate category
  const strayTags = useMemo(() => {
    if (!tagCategories || tagCategories.length === 0) return [];

    const allCategorizedTags = tagCategories.flatMap(c => c.tags.map(t => t.name));

    // Also consider preset names categorized by ID as "categorized"
    const allCategorizedPresets = (mockupPresets || [])
      .filter(p => p.mockupCategoryId && tagCategories.some(c => c.id === p.mockupCategoryId))
      .map(p => p.name);

    return mergedTags.filter(tag =>
      !allCategorizedTags.includes(tag) && !allCategorizedPresets.includes(tag)
    );
  }, [tagCategories, mergedTags]);

  const groupsToDisplay = useMemo(() => {
    return dynamicGroups.filter(g => g.id !== 'drinkware' && g.id !== 'other');
  }, [dynamicGroups]);

  const drinkwareGroup = useMemo(() => dynamicGroups.find(g => g.id === 'drinkware'), [dynamicGroups]);
  const otherGroup = useMemo(() => dynamicGroups.find(g => g.id === 'other'), [dynamicGroups]);

  const drinkwareTags = drinkwareGroup?.tags || [];
  const otherTags = [...(otherGroup?.tags || []), ...strayTags];

  const hasFinalSection = drinkwareTags.length > 0 || otherTags.length > 0;

  const renderTagButton = (tag: string) => {
    const isSelected = selectedTags.includes(tag);
    const isSuggested = displaySuggestedTags.includes(tag);
    const hasSelection = selectedTags.length > 0;

    return (
      <Tag
        key={tag}
        label={translateTag(tag)}
        selected={isSelected}
        suggested={isSuggested}
        onToggle={() => onTagToggle(tag)}
        disabled={hasSelection && !isSelected}
      />
    );
  };

  return (
    <section id="categories-section" className={`animate-fade-in ${isComplete ? 'pb-0' : ''}`}>
      <div className={`flex justify-between items-center ${isComplete ? 'mb-1' : 'mb-3'}`}>
        <h2 className="font-semibold font-mono uppercase tracking-widest text-sm text-neutral-400 transition-all duration-300">
          {t('mockup.categories')}
        </h2>
        {isAnalyzing && <GlitchLoader size={16} color="#71717a" />}
      </div>
      {!isComplete && (
        <p className="text-xs text-neutral-500 mb-3 font-mono">{t('mockup.categoriesComment')}</p>
      )}
      <div className={isComplete ? 'opacity-80' : ''}>
        <div className="grid grid-cols-2 gap-3">
          {groupsToDisplay.map((group) => {
            const groupTags = group.tags || [];
            if (groupTags.length === 0) return null;

            return (
              <div key={group.id} className="space-y-2">
                {/* Subtle group label */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500/60">
                    {t(`mockup.categoryGroups.${group.key}`)}
                  </span>
                  <div className="flex-1 h-px bg-neutral-800/30"></div>
                </div>

                {/* Tags in this group */}
                <div className="flex flex-wrap gap-2 cursor-pointer">
                  {groupTags.map(tag => renderTagButton(tag))}
                </div>
              </div>
            );
          })}

          {/* Final section: Drinkware + Other + Custom - full width */}
          {hasFinalSection && (
            <div className="col-span-2 space-y-2 mt-3">
              {/* Combined labels for drinkware and other */}
              <div className="flex items-center gap-2">
                {drinkwareTags.length > 0 && (
                  <>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500/60">
                      {t(`mockup.categoryGroups.drinkware`)}
                    </span>
                    {otherTags.length > 0 && (
                      <>
                        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500/60">
                          /
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500/60">
                          {t(`mockup.categoryGroups.other`)}
                        </span>
                      </>
                    )}
                  </>
                )}
                {drinkwareTags.length === 0 && otherTags.length > 0 && (
                  <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500/60">
                    {t(`mockup.categoryGroups.other`)}
                  </span>
                )}
                <div className="flex-1 h-px bg-neutral-800/30"></div>
              </div>

              {/* Tags: drinkware + other + custom */}
              <div className="flex flex-wrap gap-2 cursor-pointer">
                {drinkwareTags.map(tag => renderTagButton(tag))}
                {otherTags.map(tag => renderTagButton(tag))}

                {/* Custom category input - inline with other tags */}
                {!isComplete && (
                  <>
                    {!isEditingCustom ? (
                      <Tag
                        label={t('mockup.customCategoryLabel')}
                        onToggle={handleCustomTagClick}
                        removable={false}
                        className="gap-1"
                      >
                        <Plus size={14} />
                      </Tag>
                    ) : (
                      <Input
                        ref={inputRef}
                        type="text"
                        value={customInput}
                        onChange={(e) => onCustomInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        placeholder={t('mockup.customCategoryPlaceholder')}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium transition-all duration-200 border-[brand-cyan]/30 focus:ring-0 min-w-[120px] font-mono",
                          theme === 'dark'
                            ? 'bg-brand-cyan/20 text-brand-cyan'
                            : 'bg-brand-cyan/20 text-neutral-800'
                        )}
                        autoFocus
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Fallback: if no drinkware/other but custom exists */}
          {!hasFinalSection && !isComplete && (
            <div className="col-span-2 flex flex-wrap gap-2 mt-3">
              {!isEditingCustom ? (
                <Tag
                  label={t('mockup.customCategoryLabel')}
                  onToggle={handleCustomTagClick}
                  className="gap-1"
                >
                  <Plus size={14} />
                </Tag>
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={customInput}
                  onChange={(e) => onCustomInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  placeholder={t('mockup.customCategoryPlaceholder')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border border-[brand-cyan]/30 focus:outline-none focus:ring-0 min-w-[120px] font-mono ${theme === 'dark'
                    ? 'bg-brand-cyan/20 text-brand-cyan'
                    : 'bg-brand-cyan/20 text-neutral-800'
                    }`}
                  autoFocus
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

