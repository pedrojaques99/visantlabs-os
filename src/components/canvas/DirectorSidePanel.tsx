import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { X, Compass, Sparkles, ChevronDown, ChevronUp, MapPin, Camera, Lightbulb, Layers, Palette, Package, Wand2, FileText, Shirt, Smartphone, CupSoda, Grid3x3, Dices, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { Tag } from '@/components/shared/Tag';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { translateTag } from '@/utils/localeUtils';
import { organizeTagsByGroup, CATEGORY_GROUPS } from '@/utils/categoryGroups';
import { DesignTypeSection } from '@/components/mockupmachine/DesignTypeSection';
import type { DirectorNodeData, DesignType } from '@/types/reactFlow';
import {
  AVAILABLE_TAGS,
  AVAILABLE_BRANDING_TAGS,
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS
} from '@/utils/mockupConstants';

interface DirectorSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData: DirectorNodeData;
  nodeId: string;
  onAnalyze: () => void;
  onGeneratePrompt: () => void;
  onUpdateData: (nodeId: string, newData: Partial<DirectorNodeData>) => void;
}

// Collapsable category group component (reused from CategoriesSection pattern)
interface CollapsableCategoryGroupProps {
  title: string;
  tags: string[];
  selectedTags: string[];
  renderTagButton: (tag: string) => React.ReactNode;
  theme: string;
  t: (key: string) => string;
  icon?: React.ReactNode;
}

const CollapsableCategoryGroup: React.FC<CollapsableCategoryGroupProps> = ({
  title,
  tags,
  selectedTags,
  renderTagButton,
  theme,
  t,
  icon
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const groupSelectedTags = tags.filter(tag => selectedTags.includes(tag));
  const hasSelection = groupSelectedTags.length > 0;
  const selectionSummary = hasSelection
    ? groupSelectedTags.map(tag => translateTag(tag)).join(', ')
    : '';

  return (
    <div className={cn(
      'rounded-lg border transition-all duration-200',
      theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex justify-between items-center text-left p-3 transition-all duration-200',
          'hover:bg-neutral-800/10',
          isExpanded && (theme === 'dark' ? 'bg-neutral-800/20' : 'bg-neutral-100/50')
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
            <span className={cn(
              'text-[10px] font-mono uppercase tracking-widest',
              theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
            )}>
              {title}
            </span>
            {!isExpanded && hasSelection && (
              <span className="text-[10px] font-mono truncate max-w-[200px] text-brand-cyan">
                {selectionSummary}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasSelection && (
            <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-1.5 py-0.5 rounded">
              {groupSelectedTags.length}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="text-neutral-500" />
          ) : (
            <ChevronDown size={16} className="text-neutral-500" />
          )}
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

// Color palette section
interface ColorSectionProps {
  suggestedColors: string[];
  selectedColors: string[];
  onColorToggle: (color: string) => void;
  theme: string;
  t: (key: string) => string;
}

const ColorSection: React.FC<ColorSectionProps> = ({
  suggestedColors,
  selectedColors,
  onColorToggle,
  theme,
  t
}) => {
  const [isExpanded, setIsExpanded] = useState(suggestedColors.length > 0);

  if (suggestedColors.length === 0) return null;

  return (
    <div className={cn(
      'rounded-lg border transition-all duration-200',
      theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex justify-between items-center text-left p-3 transition-all duration-200',
          'hover:bg-neutral-800/10',
          isExpanded && (theme === 'dark' ? 'bg-neutral-800/20' : 'bg-neutral-100/50')
        )}
      >
        <div className="flex items-center gap-2">
          <Palette size={14} className="text-neutral-500" />
          <span className={cn(
            'text-[10px] font-mono uppercase tracking-widest',
            theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
          )}>
            {t('mockup.colorPalette') || 'Color Palette'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedColors.length > 0 && (
            <div className="flex gap-0.5">
              {selectedColors.slice(0, 5).map(color => (
                <div
                  key={color}
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="text-neutral-500" />
          ) : (
            <ChevronDown size={16} className="text-neutral-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 pt-0 animate-fade-in">
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestedColors.map(color => (
              <button
                key={color}
                onClick={() => onColorToggle(color)}
                className={cn(
                  'w-8 h-8 rounded-lg border-2 transition-all duration-200',
                  selectedColors.includes(color)
                    ? 'border-brand-cyan scale-110 shadow-lg shadow-brand-cyan/20'
                    : 'border-transparent hover:border-neutral-500 hover:scale-105'
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const DirectorSidePanel: React.FC<DirectorSidePanelProps> = ({
  isOpen,
  onClose,
  nodeData,
  nodeId,
  onAnalyze,
  onGeneratePrompt,
  onUpdateData
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isAllCategoriesOpen, setIsAllCategoriesOpen] = useState(false);

  const connectedImage = nodeData.connectedImage;
  const isAnalyzing = nodeData.isAnalyzing || false;
  const hasAnalyzed = nodeData.hasAnalyzed || false;
  const isGeneratingPrompt = nodeData.isGeneratingPrompt || false;
  const generatedPrompt = nodeData.generatedPrompt;

  // Design type
  const selectedDesignType = nodeData.selectedDesignType || nodeData.suggestedDesignType || null;

  // Tag selections
  const selectedBrandingTags = nodeData.selectedBrandingTags || [];
  const selectedCategoryTags = nodeData.selectedCategoryTags || [];
  const selectedLocationTags = nodeData.selectedLocationTags || [];
  const selectedAngleTags = nodeData.selectedAngleTags || [];
  const selectedLightingTags = nodeData.selectedLightingTags || [];
  const selectedEffectTags = nodeData.selectedEffectTags || [];
  const selectedMaterialTags = nodeData.selectedMaterialTags || [];
  const selectedColors = nodeData.selectedColors || [];

  // Suggested tags from analysis
  const suggestedBrandingTags = nodeData.suggestedBrandingTags || [];
  const suggestedCategoryTags = nodeData.suggestedCategoryTags || [];
  const suggestedLocationTags = nodeData.suggestedLocationTags || [];
  const suggestedAngleTags = nodeData.suggestedAngleTags || [];
  const suggestedLightingTags = nodeData.suggestedLightingTags || [];
  const suggestedEffectTags = nodeData.suggestedEffectTags || [];
  const suggestedMaterialTags = nodeData.suggestedMaterialTags || [];
  const suggestedColors = nodeData.suggestedColors || [];

  // Pool mode state
  const isSurpriseMeMode = nodeData.isSurpriseMeMode || false;
  const surpriseMePool = nodeData.surpriseMePool || {
    selectedCategoryTags: [],
    selectedLocationTags: [],
    selectedAngleTags: [],
    selectedLightingTags: [],
    selectedEffectTags: [],
    selectedMaterialTags: []
  };

  // Organize category tags by groups (like CategoriesSection)
  const organizedCategories = useMemo(() => {
    const mergedTags = [...new Set([...AVAILABLE_TAGS, ...suggestedCategoryTags])];
    const organized = organizeTagsByGroup(mergedTags);
    
    return CATEGORY_GROUPS.map(cg => ({
      id: cg.id,
      key: cg.id,
      tags: organized.get(cg.id) || []
    })).filter(g => g.tags.length > 0);
  }, [suggestedCategoryTags]);

  // Get category icon
  const getCategoryIcon = (groupId: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'stationery': <FileText size={14} className="text-neutral-500" />,
      'packaging': <Package size={14} className="text-neutral-500" />,
      'apparel': <Shirt size={14} className="text-neutral-500" />,
      'devices': <Smartphone size={14} className="text-neutral-500" />,
      'signage': <MapPin size={14} className="text-neutral-500" />,
      'drinkware': <CupSoda size={14} className="text-neutral-500" />,
      'art': <Palette size={14} className="text-neutral-500" />,
      'other': <Grid3x3 size={14} className="text-neutral-500" />
    };
    return iconMap[groupId] || null;
  };

  // Pool toggle handler
  const togglePoolTag = useCallback((
    category: keyof typeof surpriseMePool,
    tag: string
  ) => {
    const currentPool = surpriseMePool[category] || [];
    const newPool = currentPool.includes(tag)
      ? currentPool.filter(t => t !== tag)
      : [...currentPool, tag];
    
    onUpdateData(nodeId, {
      surpriseMePool: {
        ...surpriseMePool,
        [category]: newPool
      }
    });
  }, [nodeId, onUpdateData, surpriseMePool]);

  // Tag toggle handlers - with single selection logic for non-pool mode
  const createTagToggle = useCallback((
    field: keyof DirectorNodeData,
    currentTags: string[],
    isSingleSelection: boolean = false,
    poolCategory?: keyof typeof surpriseMePool
  ) => (tag: string) => {
    if (isSurpriseMeMode && poolCategory) {
      // In pool mode, toggle pool instead
      togglePoolTag(poolCategory, tag);
      return;
    }

    // Normal mode: single selection logic
    if (isSingleSelection) {
      // If clicking a selected tag, deselect it. Otherwise, replace selection.
      const newTags = currentTags.includes(tag)
        ? currentTags.filter(t => t !== tag)
        : [tag];
      onUpdateData(nodeId, { [field]: newTags });
    } else {
      // Multiple selection (branding, colors)
      const newTags = currentTags.includes(tag)
        ? currentTags.filter(t => t !== tag)
        : [...currentTags, tag];
      onUpdateData(nodeId, { [field]: newTags });
    }
  }, [nodeId, onUpdateData, isSurpriseMeMode, togglePoolTag]);

  const toggleBrandingTag = createTagToggle('selectedBrandingTags', selectedBrandingTags, false);
  const toggleCategoryTag = createTagToggle('selectedCategoryTags', selectedCategoryTags, true, 'selectedCategoryTags');
  const toggleLocationTag = createTagToggle('selectedLocationTags', selectedLocationTags, true, 'selectedLocationTags');
  const toggleAngleTag = createTagToggle('selectedAngleTags', selectedAngleTags, true, 'selectedAngleTags');
  const toggleLightingTag = createTagToggle('selectedLightingTags', selectedLightingTags, true, 'selectedLightingTags');
  const toggleEffectTag = createTagToggle('selectedEffectTags', selectedEffectTags, true, 'selectedEffectTags');
  const toggleMaterialTag = createTagToggle('selectedMaterialTags', selectedMaterialTags, true, 'selectedMaterialTags');
  const toggleColor = createTagToggle('selectedColors', selectedColors, false);

  const handleDesignTypeChange = useCallback((type: DesignType) => {
    onUpdateData(nodeId, { selectedDesignType: type });
  }, [nodeId, onUpdateData]);

  const handleToggleSurpriseMeMode = useCallback(() => {
    onUpdateData(nodeId, { isSurpriseMeMode: !isSurpriseMeMode });
  }, [nodeId, onUpdateData, isSurpriseMeMode]);

  // Render tag button for categories
  const renderCategoryTagButton = useCallback((tag: string) => {
    const isSelected = selectedCategoryTags.includes(tag);
    const isSuggested = suggestedCategoryTags.includes(tag);
    const isInPool = isSurpriseMeMode && surpriseMePool.selectedCategoryTags.includes(tag);
    const hasAnySelection = selectedCategoryTags.length > 0;

    return (
      <Tag
        key={tag}
        label={translateTag(tag)}
        selected={isSelected}
        suggested={!isSurpriseMeMode && !isSelected && isSuggested}
        inPool={isInPool}
        onToggle={() => toggleCategoryTag(tag)}
        disabled={!isSurpriseMeMode && hasAnySelection && !isSelected}
        size="sm"
      />
    );
  }, [selectedCategoryTags, suggestedCategoryTags, toggleCategoryTag, isSurpriseMeMode, surpriseMePool]);

  // Check if we have any selections for the generate button
  // Design type is required, plus at least one tag
  const hasSelections = selectedDesignType !== null && (
    selectedBrandingTags.length > 0 ||
    selectedCategoryTags.length > 0 ||
    selectedLocationTags.length > 0 ||
    selectedAngleTags.length > 0 ||
    selectedLightingTags.length > 0 ||
    selectedEffectTags.length > 0 ||
    selectedMaterialTags.length > 0 ||
    selectedColors.length > 0
  );

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed right-0 top-0 h-full z-50',
        'w-[400px] max-w-[90vw]',
        'bg-neutral-950/95 backdrop-blur-xl',
        'border-l border-neutral-800/50',
        'flex flex-col',
        'animate-slide-in-right'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800/50">
        <div className="flex items-center gap-3">
          <Compass size={20} className="text-brand-cyan" />
          <h2 className="text-sm font-semibold text-neutral-200 font-mono uppercase">
            {t('canvasNodes.directorNode.title') || 'Director'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-neutral-500 hover:text-white transition-colors rounded-lg hover:bg-neutral-800/50"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Connected Image Preview */}
        {connectedImage && (
          <div className="rounded-lg overflow-hidden border border-neutral-800/50">
            <img
              src={
                connectedImage.startsWith('data:') 
                  ? connectedImage 
                  : connectedImage.startsWith('http://') || connectedImage.startsWith('https://')
                    ? connectedImage
                    : `data:image/png;base64,${connectedImage}`
              }
              alt="Connected"
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        {/* No Image State */}
        {!connectedImage && (
          <div className="rounded-lg border border-dashed border-neutral-700/50 p-8 text-center">
            <Compass size={32} className="mx-auto text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-500 font-mono">
              {t('canvasNodes.directorNode.connectImageFirst') || 'Connect an image to the Director node to start'}
            </p>
          </div>
        )}

        {/* Analyze Button */}
        {connectedImage && !hasAnalyzed && (
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className={cn(
              'w-full px-4 py-3 rounded-lg border transition-all duration-200',
              'flex items-center justify-center gap-2',
              'text-sm font-mono',
              isAnalyzing
                ? 'bg-neutral-800/50 border-neutral-700/50 text-neutral-400 cursor-not-allowed'
                : 'bg-brand-cyan/10 border-[brand-cyan]/30 text-brand-cyan hover:bg-brand-cyan/20'
            )}
          >
            {isAnalyzing ? (
              <>
                <GlitchLoader size={16} color="currentColor" />
                <span>{t('canvasNodes.directorNode.analyzing') || 'Analyzing...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>{t('canvasNodes.directorNode.analyzeImage') || 'Analyze Image'}</span>
              </>
            )}
          </button>
        )}

        {/* Tag Selection Sections (after analysis) */}
        {hasAnalyzed && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-brand-cyan" />
                <span className="text-xs font-mono text-brand-cyan">
                  {t('canvasNodes.directorNode.selectTags') || 'Select tags for your prompt'}
                </span>
              </div>
              
              {/* Pool Mode Toggle */}
              <div
                className={cn(
                  'flex items-center gap-2 cursor-pointer transition-all duration-200 px-2 py-1 rounded',
                  isSurpriseMeMode 
                    ? 'bg-brand-cyan/10 border border-brand-cyan/30' 
                    : 'hover:bg-neutral-800/30'
                )}
                onClick={handleToggleSurpriseMeMode}
                title={isSurpriseMeMode ? t('mockup.surpriseMeModeDisableTooltip') : t('mockup.surpriseMeModeEnableTooltip')}
              >
                <div className={cn(
                  'w-3 h-3 rounded flex items-center justify-center border transition-all duration-200',
                  isSurpriseMeMode
                    ? 'bg-brand-cyan border-brand-cyan'
                    : 'bg-neutral-800 border-neutral-600'
                )}>
                  {isSurpriseMeMode && (
                    <Shuffle size={8} className="text-black" />
                  )}
                </div>
                <Dices size={12} className={cn(
                  isSurpriseMeMode ? 'text-brand-cyan' : 'text-neutral-500'
                )} />
                <span className={cn(
                  'text-[9px] font-mono uppercase tracking-widest',
                  isSurpriseMeMode ? 'text-brand-cyan' : 'text-neutral-500'
                )}>
                  {t('mockup.surpriseMeMode') || 'Pool Mode'}
                </span>
              </div>
            </div>

            {/* Design Type Section */}
            <DesignTypeSection
              designType={selectedDesignType}
              onDesignTypeChange={handleDesignTypeChange}
              uploadedImage={connectedImage ? (() => {
                // Convert connectedImage string to UploadedImage format
                if (connectedImage.startsWith('http://') || connectedImage.startsWith('https://')) {
                  return { url: connectedImage, mimeType: 'image/png' };
                } else if (connectedImage.startsWith('data:')) {
                  const base64Part = connectedImage.split(',')[1];
                  return { base64: base64Part, mimeType: connectedImage.split(';')[0].split(':')[1] || 'image/png' };
                } else {
                  return { base64: connectedImage, mimeType: 'image/png' };
                }
              })() : null}
              isImagelessMode={!connectedImage}
              onScrollToSection={() => {}}
            />

            {/* Branding Tags */}
            <div className="rounded-lg border border-neutral-800/50">
              <button
                onClick={() => {}}
                className="w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Package size={14} className="text-neutral-500" />
                  <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                      {t('mockup.branding') || 'Branding'}
                    </span>
                    {selectedBrandingTags.length > 0 && (
                      <span className="text-[10px] font-mono truncate text-brand-cyan">
                        {selectedBrandingTags.map(tag => translateTag(tag)).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedBrandingTags.length > 0 && (
                    <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-1.5 py-0.5 rounded">
                      {selectedBrandingTags.length}
                    </span>
                  )}
                </div>
              </button>
              <div className="p-3 pt-0">
                {suggestedBrandingTags.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[9px] font-mono uppercase text-brand-cyan/70 mb-1 block">
                      {t('mockup.suggested') || 'Suggested'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedBrandingTags.map(tag => (
                        <Tag
                          key={tag}
                          label={translateTag(tag)}
                          selected={selectedBrandingTags.includes(tag)}
                          suggested={!selectedBrandingTags.includes(tag)}
                          onToggle={() => toggleBrandingTag(tag)}
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {AVAILABLE_BRANDING_TAGS.filter(tag => !suggestedBrandingTags.includes(tag)).map(tag => (
                    <Tag
                      key={tag}
                      label={translateTag(tag)}
                      selected={selectedBrandingTags.includes(tag)}
                      onToggle={() => toggleBrandingTag(tag)}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Categories Section - Organized by Groups */}
            <div className="rounded-lg border border-neutral-800/50">
              <button
                onClick={() => setIsAllCategoriesOpen(!isAllCategoriesOpen)}
                className={cn(
                  'w-full flex justify-between items-center text-left p-3 transition-all duration-200',
                  'hover:bg-neutral-800/10',
                  isAllCategoriesOpen && 'bg-neutral-800/20'
                )}
              >
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-neutral-500" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                    {t('mockup.categories') || 'Categories'}
                  </span>
                </div>
                {isAllCategoriesOpen ? (
                  <ChevronUp size={16} className="text-neutral-500" />
                ) : (
                  <ChevronDown size={16} className="text-neutral-500" />
                )}
              </button>

              {isAllCategoriesOpen && (
                <div className="p-3 pt-0 space-y-2">
                  {/* Show suggested tags first */}
                  {suggestedCategoryTags.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[9px] font-mono uppercase text-brand-cyan/70 mb-2 block">
                        {t('mockup.suggested') || 'Suggested'}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestedCategoryTags.map(tag => {
                          const isSelected = selectedCategoryTags.includes(tag);
                          const isInPool = isSurpriseMeMode && surpriseMePool.selectedCategoryTags.includes(tag);
                          const hasAnySelection = selectedCategoryTags.length > 0;
                          return (
                            <Tag
                              key={tag}
                              label={translateTag(tag)}
                              selected={isSelected}
                              suggested={!isSurpriseMeMode && !isSelected}
                              inPool={isInPool}
                              onToggle={() => toggleCategoryTag(tag)}
                              disabled={!isSurpriseMeMode && hasAnySelection && !isSelected}
                              size="sm"
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category Groups */}
                  {organizedCategories.map((group) => (
                    <CollapsableCategoryGroup
                      key={group.id}
                      title={t(`mockup.categoryGroups.${group.key}`) || group.key}
                      tags={group.tags}
                      selectedTags={selectedCategoryTags}
                      renderTagButton={renderCategoryTagButton}
                      theme={theme}
                      t={t}
                      icon={getCategoryIcon(group.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Location Tags */}
            <div className="rounded-lg border border-neutral-800/50">
              <button
                onClick={() => {}}
                className="w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MapPin size={14} className="text-neutral-500" />
                  <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                      {t('mockup.location') || 'Location'}
                    </span>
                    {selectedLocationTags.length > 0 && (
                      <span className="text-[10px] font-mono truncate text-brand-cyan">
                        {selectedLocationTags.map(tag => translateTag(tag)).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedLocationTags.length > 0 && (
                    <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-1.5 py-0.5 rounded">
                      {selectedLocationTags.length}
                    </span>
                  )}
                </div>
              </button>
              <div className="p-3 pt-0">
                {suggestedLocationTags.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[9px] font-mono uppercase text-brand-cyan/70 mb-1 block">
                      {t('mockup.suggested') || 'Suggested'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedLocationTags.map(tag => {
                        const isSelected = selectedLocationTags.includes(tag);
                        const isInPool = isSurpriseMeMode && surpriseMePool.selectedLocationTags.includes(tag);
                        const hasSelection = selectedLocationTags.length > 0;
                        return (
                          <Tag
                            key={tag}
                            label={translateTag(tag)}
                            selected={isSelected}
                            suggested={!isSurpriseMeMode && !isSelected}
                            inPool={isInPool}
                            onToggle={() => toggleLocationTag(tag)}
                            disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                            size="sm"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {AVAILABLE_LOCATION_TAGS.filter(tag => !suggestedLocationTags.includes(tag)).map(tag => {
                    const isSelected = selectedLocationTags.includes(tag);
                    const isInPool = isSurpriseMeMode && surpriseMePool.selectedLocationTags.includes(tag);
                    const hasSelection = selectedLocationTags.length > 0;
                    return (
                      <Tag
                        key={tag}
                        label={translateTag(tag)}
                        selected={isSelected}
                        inPool={isInPool}
                        onToggle={() => toggleLocationTag(tag)}
                        disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                        size="sm"
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Angle Tags */}
            <div className="rounded-lg border border-neutral-800/50">
              <button
                onClick={() => {}}
                className="w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Camera size={14} className="text-neutral-500" />
                  <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                      {t('mockup.angle') || 'Angle'}
                    </span>
                    {selectedAngleTags.length > 0 && (
                      <span className="text-[10px] font-mono truncate text-brand-cyan">
                        {selectedAngleTags.map(tag => translateTag(tag)).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedAngleTags.length > 0 && (
                    <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-1.5 py-0.5 rounded">
                      {selectedAngleTags.length}
                    </span>
                  )}
                </div>
              </button>
              <div className="p-3 pt-0">
                {suggestedAngleTags.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[9px] font-mono uppercase text-brand-cyan/70 mb-1 block">
                      {t('mockup.suggested') || 'Suggested'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedAngleTags.map(tag => {
                        const isSelected = selectedAngleTags.includes(tag);
                        const isInPool = isSurpriseMeMode && surpriseMePool.selectedAngleTags.includes(tag);
                        const hasSelection = selectedAngleTags.length > 0;
                        return (
                          <Tag
                            key={tag}
                            label={translateTag(tag)}
                            selected={isSelected}
                            suggested={!isSurpriseMeMode && !isSelected}
                            inPool={isInPool}
                            onToggle={() => toggleAngleTag(tag)}
                            disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                            size="sm"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {AVAILABLE_ANGLE_TAGS.filter(tag => !suggestedAngleTags.includes(tag)).map(tag => {
                    const isSelected = selectedAngleTags.includes(tag);
                    const isInPool = isSurpriseMeMode && surpriseMePool.selectedAngleTags.includes(tag);
                    const hasSelection = selectedAngleTags.length > 0;
                    return (
                      <Tag
                        key={tag}
                        label={translateTag(tag)}
                        selected={isSelected}
                        inPool={isInPool}
                        onToggle={() => toggleAngleTag(tag)}
                        disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                        size="sm"
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Lighting Tags */}
            <div className="rounded-lg border border-neutral-800/50">
              <button
                onClick={() => {}}
                className="w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Lightbulb size={14} className="text-neutral-500" />
                  <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                      {t('mockup.lighting') || 'Lighting'}
                    </span>
                    {selectedLightingTags.length > 0 && (
                      <span className="text-[10px] font-mono truncate text-brand-cyan">
                        {selectedLightingTags.map(tag => translateTag(tag)).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedLightingTags.length > 0 && (
                    <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-1.5 py-0.5 rounded">
                      {selectedLightingTags.length}
                    </span>
                  )}
                </div>
              </button>
              <div className="p-3 pt-0">
                {suggestedLightingTags.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[9px] font-mono uppercase text-brand-cyan/70 mb-1 block">
                      {t('mockup.suggested') || 'Suggested'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedLightingTags.map(tag => {
                        const isSelected = selectedLightingTags.includes(tag);
                        const isInPool = isSurpriseMeMode && surpriseMePool.selectedLightingTags.includes(tag);
                        const hasSelection = selectedLightingTags.length > 0;
                        return (
                          <Tag
                            key={tag}
                            label={translateTag(tag)}
                            selected={isSelected}
                            suggested={!isSurpriseMeMode && !isSelected}
                            inPool={isInPool}
                            onToggle={() => toggleLightingTag(tag)}
                            disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                            size="sm"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {AVAILABLE_LIGHTING_TAGS.filter(tag => !suggestedLightingTags.includes(tag)).map(tag => {
                    const isSelected = selectedLightingTags.includes(tag);
                    const isInPool = isSurpriseMeMode && surpriseMePool.selectedLightingTags.includes(tag);
                    const hasSelection = selectedLightingTags.length > 0;
                    return (
                      <Tag
                        key={tag}
                        label={translateTag(tag)}
                        selected={isSelected}
                        inPool={isInPool}
                        onToggle={() => toggleLightingTag(tag)}
                        disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                        size="sm"
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Effect Tags */}
            <div className="rounded-lg border border-neutral-800/50">
              <button
                onClick={() => {}}
                className="w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Sparkles size={14} className="text-neutral-500" />
                  <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                      {t('mockup.effects') || 'Effects'}
                    </span>
                    {selectedEffectTags.length > 0 && (
                      <span className="text-[10px] font-mono truncate text-brand-cyan">
                        {selectedEffectTags.map(tag => translateTag(tag)).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedEffectTags.length > 0 && (
                    <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-1.5 py-0.5 rounded">
                      {selectedEffectTags.length}
                    </span>
                  )}
                </div>
              </button>
              <div className="p-3 pt-0">
                {suggestedEffectTags.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[9px] font-mono uppercase text-brand-cyan/70 mb-1 block">
                      {t('mockup.suggested') || 'Suggested'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedEffectTags.map(tag => {
                        const isSelected = selectedEffectTags.includes(tag);
                        const isInPool = isSurpriseMeMode && surpriseMePool.selectedEffectTags.includes(tag);
                        const hasSelection = selectedEffectTags.length > 0;
                        return (
                          <Tag
                            key={tag}
                            label={translateTag(tag)}
                            selected={isSelected}
                            suggested={!isSurpriseMeMode && !isSelected}
                            inPool={isInPool}
                            onToggle={() => toggleEffectTag(tag)}
                            disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                            size="sm"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {AVAILABLE_EFFECT_TAGS.filter(tag => !suggestedEffectTags.includes(tag)).map(tag => {
                    const isSelected = selectedEffectTags.includes(tag);
                    const isInPool = isSurpriseMeMode && surpriseMePool.selectedEffectTags.includes(tag);
                    const hasSelection = selectedEffectTags.length > 0;
                    return (
                      <Tag
                        key={tag}
                        label={translateTag(tag)}
                        selected={isSelected}
                        inPool={isInPool}
                        onToggle={() => toggleEffectTag(tag)}
                        disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                        size="sm"
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Material Tags */}
            <div className="rounded-lg border border-neutral-800/50">
              <button
                onClick={() => {}}
                className="w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Layers size={14} className="text-neutral-500" />
                  <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                      {t('mockup.materials') || 'Materials'}
                    </span>
                    {selectedMaterialTags.length > 0 && (
                      <span className="text-[10px] font-mono truncate text-brand-cyan">
                        {selectedMaterialTags.map(tag => translateTag(tag)).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedMaterialTags.length > 0 && (
                    <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-1.5 py-0.5 rounded">
                      {selectedMaterialTags.length}
                    </span>
                  )}
                </div>
              </button>
              <div className="p-3 pt-0">
                {suggestedMaterialTags.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[9px] font-mono uppercase text-brand-cyan/70 mb-1 block">
                      {t('mockup.suggested') || 'Suggested'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedMaterialTags.map(tag => {
                        const isSelected = selectedMaterialTags.includes(tag);
                        const isInPool = isSurpriseMeMode && surpriseMePool.selectedMaterialTags.includes(tag);
                        const hasSelection = selectedMaterialTags.length > 0;
                        return (
                          <Tag
                            key={tag}
                            label={translateTag(tag)}
                            selected={isSelected}
                            suggested={!isSurpriseMeMode && !isSelected}
                            inPool={isInPool}
                            onToggle={() => toggleMaterialTag(tag)}
                            disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                            size="sm"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {AVAILABLE_MATERIAL_TAGS.filter(tag => !suggestedMaterialTags.includes(tag)).map(tag => {
                    const isSelected = selectedMaterialTags.includes(tag);
                    const isInPool = isSurpriseMeMode && surpriseMePool.selectedMaterialTags.includes(tag);
                    const hasSelection = selectedMaterialTags.length > 0;
                    return (
                      <Tag
                        key={tag}
                        label={translateTag(tag)}
                        selected={isSelected}
                        inPool={isInPool}
                        onToggle={() => toggleMaterialTag(tag)}
                        disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                        size="sm"
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Color Palette */}
            <ColorSection
              suggestedColors={suggestedColors}
              selectedColors={selectedColors}
              onColorToggle={toggleColor}
              theme={theme}
              t={t}
            />
          </div>
        )}

        {/* Generated Prompt Preview */}
        {generatedPrompt && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 size={14} className="text-green-400" />
              <span className="text-xs font-mono text-green-400 uppercase">
                {t('canvasNodes.directorNode.generatedPrompt') || 'Generated Prompt'}
              </span>
            </div>
            <p className="text-sm text-neutral-300 whitespace-pre-wrap">{generatedPrompt}</p>
          </div>
        )}
      </div>

      {/* Footer with Generate Button */}
      {hasAnalyzed && (
        <div className="p-4 border-t border-neutral-800/50">
          <button
            onClick={onGeneratePrompt}
            disabled={!hasSelections || isGeneratingPrompt}
            className={cn(
              'w-full px-4 py-3 rounded-lg border transition-all duration-200',
              'flex items-center justify-center gap-2',
              'text-sm font-mono font-semibold',
              (!hasSelections || isGeneratingPrompt)
                ? 'bg-neutral-800/50 border-neutral-700/50 text-neutral-500 cursor-not-allowed'
                : 'bg-brand-cyan text-black border-brand-cyan hover:bg-brand-cyan/90'
            )}
          >
            {isGeneratingPrompt ? (
              <>
                <GlitchLoader size={16} color="currentColor" />
                <span>{t('canvasNodes.directorNode.generating') || 'Generating...'}</span>
              </>
            ) : (
              <>
                <Wand2 size={16} />
                <span>{t('canvasNodes.directorNode.generateAndCreate') || 'Generate Prompt & Create Node'}</span>
              </>
            )}
          </button>
          {!hasSelections && (
            <p className="text-[10px] text-neutral-500 text-center mt-2 font-mono">
              {!selectedDesignType 
                ? (t('mockup.pleaseSelectDesignType') || 'Please select a design type')
                : (t('canvasNodes.directorNode.selectAtLeastOneTag') || 'Select at least one tag to generate')
              }
            </p>
          )}
        </div>
      )}
    </div>
  );
};
