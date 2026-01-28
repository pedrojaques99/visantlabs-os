import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Dices, ChevronDown, ChevronUp, FileText, Package, Shirt, Smartphone, MapPin, CupSoda, Palette, Grid3x3, X } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { translateTag } from '@/utils/localeUtils';
import { organizeTagsByGroup, CATEGORY_GROUPS } from '@/utils/categoryGroups';
import { Tag } from '@/components/shared/Tag';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MockupTagCategory } from '@/services/mockupTagService';
import { MockupPreset } from '../../types/mockupPresets';
import { useMockup } from './MockupContext';

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
  const poolTags = isSurpriseMeMode ? tags.filter(t => categoriesPool.includes(t)) : [];
  const poolTagsSummary = poolTags.length > 0
    ? poolTags.map(tag => translateTag(tag)).join(', ')
    : '';

  return (
    <div className={cn(
      `rounded-xl border-1 border-neutral-800/50 transition-all duration-200 overflow-hidden ${theme === 'dark' ? 'bg-neutral-900/30 border-1 border-neutral-800/50' : 'bg-white/50 border-1 border-neutral-200'}`,
      className
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex justify-between items-center text-left p-3 transition-all duration-200 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-100/50'}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
            <span className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>
              {title}
            </span>
            {!isExpanded && (hasSelection || poolTags.length > 0) && (
              <span className="text-[10px] font-mono truncate max-w-[200px]">
                {hasSelection && <span className="text-brand-cyan">{selectionSummary}</span>}
                {hasSelection && poolTags.length > 0 && <span className="text-neutral-500"> · </span>}
                {poolTags.length > 0 && (
                  <span className="text-neutral-500">
                    {poolTagsSummary} {t('mockup.inPool')}
                  </span>
                )}
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
  isSurpriseMeMode = false,
  categoriesPool = [],
  onPoolToggle,
  hasAnalyzed = false
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { 
    clearAllTags,
    selectedTags: allSelectedTags,
    selectedLocationTags,
    selectedAngleTags,
    selectedLightingTags,
    selectedEffectTags,
    selectedMaterialTags,
    selectedBrandingTags,
    selectedColors,
    surpriseMePool
  } = useMockup();
  
  // Check if there are any tags selected (normal or pool mode)
  const hasAnyTagsSelected = 
    allSelectedTags.length > 0 ||
    selectedLocationTags.length > 0 ||
    selectedAngleTags.length > 0 ||
    selectedLightingTags.length > 0 ||
    selectedEffectTags.length > 0 ||
    selectedMaterialTags.length > 0 ||
    selectedBrandingTags.length > 0 ||
    selectedColors.length > 0 ||
    (surpriseMePool.selectedCategoryTags?.length || 0) > 0 ||
    (surpriseMePool.selectedLocationTags?.length || 0) > 0 ||
    (surpriseMePool.selectedAngleTags?.length || 0) > 0 ||
    (surpriseMePool.selectedLightingTags?.length || 0) > 0 ||
    (surpriseMePool.selectedEffectTags?.length || 0) > 0 ||
    (surpriseMePool.selectedMaterialTags?.length || 0) > 0;

  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [isFinalExpanded, setIsFinalExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  // Custom category tags: selected tags that are not part of the known available tag list
  const customSelectedTags = useMemo(
    () => selectedTags.filter(tag => !availableTags.includes(tag)),
    [selectedTags, availableTags]
  );

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
    const trimmed = customInput.trim();
    if (trimmed) {
      onAddCustomTag();
      onCustomInputChange('');
      // Close input after adding tag to show button again
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
    blurTimeoutRef.current = window.setTimeout(() => {
      const trimmed = customInput.trim();
      if (trimmed) {
        handleCustomTagSubmit();
      } else {
        // If input is empty on blur, close it and show button
        handleCustomTagCancel();
      }
    }, 150);
  };

  // Merge available tags with suggested tags
  const mergedTags = [...new Set([...availableTags, ...displaySuggestedTags])];

  // Organize tags by category from database
  const dynamicGroups = useMemo(() => {
    if (!tagCategories || tagCategories.length === 0) {
      const organized = organizeTagsByGroup(mergedTags);
      return CATEGORY_GROUPS.map(cg => ({
        id: cg.id,
        key: cg.id,
        tags: organized.get(cg.id) || []
      })).filter(g => g.tags.length > 0);
    }

    const groups = tagCategories.map(cat => {
      const dbTagNames = cat.tags.map(t => t.name);
      const presetNamesInCategory = (mockupPresets || [])
        .filter(p => p.mockupCategoryId === cat.id)
        .map(p => p.name);

      return {
        id: cat.id,
        key: cat.name,
        tags: mergedTags.filter(tag =>
          dbTagNames.includes(tag) || presetNamesInCategory.includes(tag)
        )
      };
    });

    return groups.filter(g => g.tags.length > 0);
  }, [tagCategories, mergedTags, mockupPresets]);

  const strayTags = useMemo(() => {
    if (!tagCategories || tagCategories.length === 0) return [];

    const allCategorizedTags = tagCategories.flatMap(c => c.tags.map(t => t.name));
    const allCategorizedPresets = (mockupPresets || [])
      .filter(p => p.mockupCategoryId && tagCategories.some(c => c.id === p.mockupCategoryId))
      .map(p => p.name);

    return mergedTags.filter(tag =>
      !allCategorizedTags.includes(tag) && !allCategorizedPresets.includes(tag)
    );
  }, [tagCategories, mergedTags, mockupPresets]);

  const groupsToDisplay = useMemo(() => {
    return dynamicGroups.filter(g => g.id !== 'drinkware' && g.id !== 'other');
  }, [dynamicGroups]);

  const drinkwareGroup = useMemo(() => dynamicGroups.find(g => g.id === 'drinkware'), [dynamicGroups]);
  const otherGroup = useMemo(() => dynamicGroups.find(g => g.id === 'other'), [dynamicGroups]);

  const drinkwareTags = drinkwareGroup?.tags || [];
  const otherTags = [...(otherGroup?.tags || []), ...strayTags];
  const finalTags = [...drinkwareTags, ...otherTags];

  const getCategoryIcon = (group: { id: string | number; key: string }) => {
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

    if (iconMap[categoryId]) return iconMap[categoryId];

    const keyLower = group.key.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (keyLower.includes(key) || keyLower === key) {
        return icon;
      }
    }

    return null;
  };

  const hasFinalSection = finalTags.length > 0;
  const finalSelectedTags = finalTags.filter(tag => selectedTags.includes(tag));
  const hasFinalSelection = finalSelectedTags.length > 0;
  const finalPoolTags = isSurpriseMeMode ? finalTags.filter(t => categoriesPool.includes(t)) : [];
  const finalPoolTagsSummary = finalPoolTags.length > 0
    ? finalPoolTags.map(tag => translateTag(tag)).join(', ')
    : '';

  const renderTagButton = (tag: string) => {
    const isSelected = selectedTags.includes(tag);
    const isSuggested = displaySuggestedTags.includes(tag);
    const isInPool = isSurpriseMeMode && categoriesPool.includes(tag);

    const handleClick = () => {
      if (hasAnalyzed) return;
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
        disabled={hasAnalyzed}
        className={cn("scale-90 origin-left", hasAnalyzed ? "cursor-default" : "cursor-pointer")}
      />
    );
  };

  // Minimal view after analysis
  if (hasAnalyzed) {
    return (
      <section id="categories-section" className="animate-fade-in pb-0">
        <Tooltip content={t('mockup.categoriesComment')} position="top">
          <h3 className={cn(
            "text-[10px] font-mono uppercase tracking-wider mb-3 cursor-help",
            theme === 'dark' ? 'text-neutral-500' : 'text-neutral-500'
          )}>
            {t('mockup.categories')}
          </h3>
        </Tooltip>

        <div className="flex flex-wrap gap-2">
          {selectedTags.map(tag => renderTagButton(tag))}
        </div>
      </section>
    );
  }

  return (
    <section id="categories-section" className={cn("animate-fade-in", isComplete && 'pb-0')}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Tooltip content={t('mockup.categoriesComment')} position="top">
              <h3 className={cn(
                "text-[10px] font-mono uppercase tracking-wider cursor-help",
                theme === 'dark' ? 'text-neutral-500' : 'text-neutral-500'
              )}>
                {t('mockup.categories')}
              </h3>
            </Tooltip>
            {isAnalyzing && <GlitchLoader size={16} color="#71717a" />}
          </div>
          
          {/* Clear All Tags Button */}
          {hasAnyTagsSelected && (
            <Tooltip content={t('mockup.clearAllTags') || 'Limpar todas as tags selecionadas'} position="top">
              <button
                onClick={clearAllTags}
                className={cn(
                  "p-1.5 rounded-md transition-all duration-200",
                  theme === 'dark'
                    ? 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 border border-transparent hover:border-neutral-700/50'
                    : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 border border-transparent hover:border-neutral-300'
                )}
                title={t('mockup.clearAllTags') || 'Limpar todas as tags'}
                aria-label={t('mockup.clearAllTags') || 'Limpar todas as tags'}
              >
                <X size={14} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {/* Comment */}
        {!isComplete && (
          <div className="mb-2 px-1">
            <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-tighter">
              {t('mockup.categoriesComment')}
            </p>
          </div>
        )}

        {/* Category Groups */}
        <div className={cn(
          "grid grid-cols-1 gap-2 transition-opacity duration-300",
          isComplete && 'opacity-80'
        )}>
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

          {/* Final Section (Drinkware + Other) - Always visible; contains custom tags */}
          <div className={cn(
            `rounded-xl border transition-all duration-200 overflow-hidden ${theme === 'dark' ? 'bg-neutral-900/30 border-white/5' : 'bg-white/50 border-neutral-200'}`
          )}>
            <button
              onClick={() => setIsFinalExpanded(!isFinalExpanded)}
              className={`w-full flex justify-between items-center text-left p-3 transition-all duration-200 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-100/50'}`}
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
                  {!isFinalExpanded && (hasFinalSelection || finalPoolTags.length > 0 || customSelectedTags.length > 0) && (
                    <span className="text-[10px] font-mono truncate max-w-[200px]">
                      {hasFinalSelection && <span className="text-brand-cyan">{finalSelectedTags.map(tag => translateTag(tag)).join(', ')}</span>}
                      {hasFinalSelection && (finalPoolTags.length > 0 || customSelectedTags.length > 0) && <span className="text-neutral-500"> · </span>}
                      {finalPoolTags.length > 0 && (
                        <span className="text-neutral-500">
                          {finalPoolTagsSummary} {t('mockup.inPool')}
                        </span>
                      )}
                      {customSelectedTags.length > 0 && (
                        <span className="text-neutral-500">
                          {customSelectedTags.map(tag => translateTag(tag)).join(', ')}
                        </span>
                      )}
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
              <div className="p-3 pt-0 animate-fade-in space-y-3">
                {/* Predefined tags (drinkware + other) */}
                <div className="flex flex-wrap gap-1.5">
                  {drinkwareTags.map(tag => renderTagButton(tag))}
                  {otherTags.map(tag => renderTagButton(tag))}
                </div>

                {/* Custom tags section - inside OUTROS */}
                <div className={cn(
                  "rounded-lg border p-2.5 transition-all duration-200",
                  customSelectedTags.length > 0 || isEditingCustom
                    ? theme === 'dark'
                      ? 'bg-neutral-800/30 border-white/5'
                      : 'bg-white/60 border-neutral-200'
                    : theme === 'dark'
                      ? 'bg-neutral-900/20 border-white/5'
                      : 'bg-white/30 border-neutral-200/50'
                )}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={cn(
                      "text-[9px] font-mono uppercase tracking-widest",
                      theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
                    )}>
                      {t('mockup.customCategories') || 'CUSTOM'}
                    </span>
                    {customSelectedTags.length > 0 && (
                      <span className={cn(
                        "text-[9px] font-mono",
                        theme === 'dark' ? 'text-neutral-600' : 'text-neutral-400'
                      )}>
                        ({customSelectedTags.length})
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {customSelectedTags.map(tag => (
                      <Tag
                        key={`custom-${tag}`}
                        label={translateTag(tag)}
                        selected
                        removable
                        onRemove={() => onTagToggle(tag)}
                        onToggle={() => onTagToggle(tag)}
                        size="sm"
                        className="scale-90"
                      />
                    ))}
                    {isEditingCustom ? (
                      <Input
                        ref={inputRef}
                        type="text"
                        value={customInput}
                        onChange={(e) => onCustomInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        placeholder={t('mockup.customCategoryPlaceholder')}
                        className={cn(
                          "px-3 py-1 text-[10px] h-7 transition-all duration-200 focus:ring-0 w-[160px] font-mono rounded-full border animate-in fade-in",
                          theme === 'dark'
                            ? 'bg-neutral-800/50 border-neutral-700/50 text-neutral-200 placeholder:text-neutral-500 focus:border-brand-cyan/50'
                            : 'bg-neutral-100 border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:border-brand-cyan/50'
                        )}
                        autoFocus
                      />
                    ) : (
                      <Tag
                        label={t('mockup.addCustomCategoryLabel') || 'Custom tag'}
                        onToggle={handleCustomTagClick}
                        size="sm"
                        className="scale-90 group [&_svg]:group-hover:rotate-90 [&_svg]:transition-transform [&_svg]:duration-300"
                      >
                        <Plus size={12} />
                      </Tag>
                    )}
                    {customSelectedTags.length === 0 && !isEditingCustom && (
                      <span className={cn(
                        "text-[9px] font-mono ml-1",
                        theme === 'dark' ? 'text-neutral-600' : 'text-neutral-400'
                      )}>
                        {t('mockup.addCustomCategoryHint') || 'Adicione categorias personalizadas'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
