import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Dices, ChevronDown, ChevronUp, FileText, Package, Shirt, Smartphone, MapPin, CupSoda, Palette, Grid3x3 } from 'lucide-react';
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
  // Surprise Me Mode props
  isSurpriseMeMode?: boolean;
  categoriesPool?: string[];
  onPoolToggle?: (tag: string) => void;
  hasAnalyzed?: boolean;
}

interface CollapsableCategoryGroupProps {
  title: string;
  tags: string[];
  selectedTags: string[];
  renderTagButton: (tag: string) => React.ReactNode;
  theme: string;
  t: (key: string) => string;
  className?: string;
  isSurpriseMeMode?: boolean;
  categoriesPool?: string[];
  icon?: React.ReactNode;
}

const CollapsableCategoryGroup: React.FC<CollapsableCategoryGroupProps> = ({
  title,
  tags,
  selectedTags,
  renderTagButton,
  theme,
  t,
  className,
  isSurpriseMeMode,
  categoriesPool = [],
  icon
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const groupSelectedTags = tags.filter(tag => selectedTags.includes(tag));
  const hasSelection = groupSelectedTags.length > 0;
  const selectionSummary = hasSelection
    ? groupSelectedTags.map(tag => translateTag(tag)).join(', ')
    : '';
  const poolCount = isSurpriseMeMode ? tags.filter(t => categoriesPool.includes(t)).length : 0;

  return (
    <div className={cn(
      `rounded-lg border transition-all duration-200 ${theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'}`,
      className
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10 ${isExpanded ? (theme === 'dark' ? 'bg-neutral-800/20' : 'bg-neutral-100/50') : ''}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
            <span className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>
              {title}
            </span>
          {!isExpanded && (hasSelection || poolCount > 0) && (
            <span className="text-[10px] font-mono truncate max-w-[200px]">
              {hasSelection && <span className="text-brand-cyan">{selectionSummary}</span>}
              {hasSelection && poolCount > 0 && <span className="text-neutral-500"> · </span>}
              {poolCount > 0 && <span className="text-neutral-500">{poolCount} {t('mockup.inPool')}</span>}
            </span>
          )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSurpriseMeMode && <Dices size={12} className="text-brand-cyan/60" />}
          {isExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 pt-0 animate-fade-in">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map(tag => (
              <React.Fragment key={tag}>
                {renderTagButton(tag)}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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
  mockupPresets = [],
  // Surprise Me Mode props
  isSurpriseMeMode = false,
  categoriesPool = [],
  onPoolToggle,
  hasAnalyzed = false
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [isFinalExpanded, setIsFinalExpanded] = useState(false);
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
    if (!isFinalExpanded) setIsFinalExpanded(true);
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
  const finalTags = [...drinkwareTags, ...otherTags];

  // Icon mapping for categories
  const getCategoryIcon = (group: { id: string | number; key: string }) => {
    // Try to match by id first (for legacy categories), then by key (for database categories)
    const categoryId = typeof group.id === 'string' ? group.id : group.key.toLowerCase();
    
    const iconMap: Record<string, React.ReactNode> = {
      'stationery': <FileText size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />,
      'packaging': <Package size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />,
      'apparel': <Shirt size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />,
      'devices': <Smartphone size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />,
      'signage': <MapPin size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />,
      'drinkware': <CupSoda size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />,
      'art': <Palette size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />,
      'other': <Grid3x3 size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
    };
    
    // Try direct match first
    if (iconMap[categoryId]) return iconMap[categoryId];
    
    // Try matching by key (for database categories that might have different names)
    const keyLower = group.key.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (keyLower.includes(key) || keyLower === key) {
        return icon;
      }
    }
    
    return null;
  };

  const hasFinalSection = finalTags.length > 0 || !isComplete;
  const finalSelectedTags = finalTags.filter(tag => selectedTags.includes(tag));
  const hasFinalSelection = finalSelectedTags.length > 0;
  const finalPoolCount = isSurpriseMeMode ? finalTags.filter(t => categoriesPool.includes(t)).length : 0;

  const renderTagButton = (tag: string) => {
    const isSelected = selectedTags.includes(tag);
    const isSuggested = displaySuggestedTags.includes(tag);
    const hasAnySelection = selectedTags.length > 0;
    const isInPool = isSurpriseMeMode && categoriesPool.includes(tag);

    // In Surprise Me Mode, clicking toggles pool membership
    const handleClick = () => {
      if (hasAnalyzed) return; // Disable clicking after analysis in minimal mode
      if (isSurpriseMeMode && onPoolToggle) {
        onPoolToggle(tag);
      } else {
        onTagToggle(tag);
      }
    };

    return (
      <Tag
        key={tag}
        label={translateTag(tag)}
        selected={isSelected}
        suggested={!isSurpriseMeMode && isSuggested}
        inPool={isInPool}
        onToggle={handleClick}
        disabled={!hasAnalyzed && !isSurpriseMeMode && hasAnySelection && !isSelected}
        className={cn("scale-90 origin-left", hasAnalyzed ? "cursor-default" : "cursor-pointer")}
      />
    );
  };

  const renderCustomTagButton = () => {
    if (isComplete) return null;

    return !isEditingCustom ? (
      <Tag
        label={t('mockup.customCategoryLabel')}
        onToggle={handleCustomTagClick}
        removable={false}
        className="gap-1 scale-90 origin-left"
      >
        <Plus size={12} />
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
          "px-3 py-1.5 text-[10px] h-7 transition-all duration-200 border-[brand-cyan]/30 focus:ring-0 min-w-[120px] font-mono",
          theme === 'dark'
            ? 'bg-brand-cyan/20 text-brand-cyan'
            : 'bg-brand-cyan/20 text-neutral-800'
        )}
        autoFocus
      />
    );
  };

  if (hasAnalyzed) {
    return (
      <section id="categories-section" className="animate-fade-in pb-0">
        <h3 className={cn(
          "text-[10px] font-mono uppercase tracking-wider mb-3",
          theme === 'dark' ? 'text-neutral-500' : 'text-neutral-500'
        )}>
          {t('mockup.categories')}
        </h3>

        <div className="flex flex-wrap gap-2">
          {selectedTags.map(tag => renderTagButton(tag))}
        </div>
      </section>
    );
  }

  return (
    <section id="categories-section" className={`animate-fade-in ${isComplete ? 'pb-0' : ''}`}>
      <button
        onClick={onToggleAllCategories}
        className={`w-full flex justify-between items-center text-left text-sm font-semibold font-mono uppercase tracking-widest p-3 rounded-md border transition-all cursor-pointer ${theme === 'dark'
          ? 'text-neutral-400 bg-neutral-800/30 border-neutral-700/50 hover:border-neutral-600/80'
          : 'text-neutral-700 bg-neutral-100 border-neutral-300 hover:border-neutral-400'
          }`}
      >
        <div className="flex items-center gap-3">
          <span>{t('mockup.categories')}</span>
          {isAnalyzing && <GlitchLoader size={16} color="#71717a" />}
        </div>
        {isAllCategoriesOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isAllCategoriesOpen && (
        <div className="mt-4 space-y-2">
          {!isComplete && (
            <p className="text-[10px] text-neutral-500 mb-2 font-mono px-1 uppercase tracking-tighter">{t('mockup.categoriesComment')}</p>
          )}

          <div className={`grid grid-cols-1 gap-2 transition-opacity duration-300 ${isComplete ? 'opacity-80' : ''}`}>
            {groupsToDisplay.map((group) => (
              <CollapsableCategoryGroup
                key={group.id}
                title={t(`mockup.categoryGroups.${group.key}`)}
                tags={group.tags}
                selectedTags={selectedTags}
                renderTagButton={renderTagButton}
                theme={theme}
                t={t}
                isSurpriseMeMode={isSurpriseMeMode}
                categoriesPool={categoriesPool}
                icon={getCategoryIcon(group)}
              />
            ))}

            {hasFinalSection && (
              <div className={`rounded-lg border transition-all duration-200 ${theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'}`}>
                <button
                  onClick={() => setIsFinalExpanded(!isFinalExpanded)}
                  className={`w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10 ${isFinalExpanded ? (theme === 'dark' ? 'bg-neutral-800/20' : 'bg-neutral-100/50') : ''}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {drinkwareTags.length > 0 ? (
                      <CupSoda size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
                    ) : (
                      <Grid3x3 size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
                    )}
                    <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                      <span className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>
                        {drinkwareTags.length > 0
                          ? t(`mockup.categoryGroups.drinkware`) + (otherTags.length > 0 ? ` / ${t(`mockup.categoryGroups.other`)}` : '')
                          : t(`mockup.categoryGroups.other`)}
                      </span>
                    {!isFinalExpanded && (hasFinalSelection || finalPoolCount > 0) && (
                      <span className="text-[10px] font-mono truncate max-w-[200px]">
                        {hasFinalSelection && <span className="text-brand-cyan">{finalSelectedTags.map(tag => translateTag(tag)).join(', ')}</span>}
                        {hasFinalSelection && finalPoolCount > 0 && <span className="text-neutral-500"> · </span>}
                        {finalPoolCount > 0 && <span className="text-neutral-500">{finalPoolCount} {t('mockup.inPool')}</span>}
                      </span>
                    )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isSurpriseMeMode && <Dices size={12} className="text-brand-cyan/60" />}
                    {isFinalExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
                  </div>
                </button>

                {isFinalExpanded && (
                  <div className="p-3 pt-0 animate-fade-in">
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {drinkwareTags.map(tag => renderTagButton(tag))}
                      {otherTags.map(tag => renderTagButton(tag))}
                      {renderCustomTagButton()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

