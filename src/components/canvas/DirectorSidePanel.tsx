import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { X, Compass, Diamond, ChevronDown, ChevronUp, MapPin, Camera, Lightbulb, Layers, Palette, Package, FileText, Shirt, Smartphone, CupSoda, Grid3x3, Dices, Shuffle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { Tag } from '@/components/shared/Tag';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { translateTag } from '@/utils/localeUtils';
import { organizeTagsByGroup, CATEGORY_GROUPS } from '@/utils/categoryGroups';
import { DesignTypeSection } from '@/components/mockupmachine/DesignTypeSection';
import type { DirectorNodeData } from '@/types/reactFlow';
import type { DesignType } from '@/types/types';
import {
  AVAILABLE_TAGS,
  AVAILABLE_BRANDING_TAGS,
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS
} from '@/utils/mockupConstants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';

interface DirectorSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData: DirectorNodeData;
  nodeId: string;
  onAnalyze: () => void;
  onGeneratePrompt: () => void;
  onUpdateData: (nodeId: string, newData: Partial<DirectorNodeData>) => void;
}

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
      'rounded-md border transition-all duration-200',
      theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'
    )}>
      <Button
        variant="ghost"
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
              <MicroTitle className="text-xs truncate max-w-[200px] text-neutral-300">
                {selectionSummary}
              </MicroTitle>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasSelection && (
            <span className="text-xs text-neutral-300 bg-neutral-700/50 px-1.5 py-0.5 rounded">
              {groupSelectedTags.length}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="" />
          ) : (
            <ChevronDown size={16} className="" />
          )}
        </div>
      </Button>
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

interface CollapsableTagSectionProps {
  title: string;
  tags: string[];
  selectedTags: string[];
  suggestedTags: string[];
  onTagToggle: (tag: string) => void;
  customInput: string;
  onCustomInputChange: (value: string) => void;
  onAddCustomTag: () => void;
  theme: string;
  t: (key: string) => string;
  icon?: React.ReactNode;
  isSurpriseMeMode?: boolean;
  poolTags?: string[];
  onPoolToggle?: (tag: string) => void;
  isSingleSelection?: boolean;
}

const CollapsableTagSection: React.FC<CollapsableTagSectionProps> = ({
  title,
  tags,
  selectedTags,
  suggestedTags,
  onTagToggle,
  customInput,
  onCustomInputChange,
  onAddCustomTag,
  theme,
  t,
  icon,
  isSurpriseMeMode = false,
  poolTags = [],
  onPoolToggle,
  isSingleSelection = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
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
    if (!isExpanded) setIsExpanded(true);
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
    blurTimeoutRef.current = window.setTimeout(() => {
      handleCustomTagSubmit();
    }, 150);
  };

  const hasSelection = selectedTags.length > 0;
  const selectionSummary = hasSelection
    ? selectedTags.map(tag => translateTag(tag)).join(', ')
    : '';
  const poolCount = isSurpriseMeMode
    ? tags.filter(t => poolTags?.includes(t)).length
    : 0;

  const allDisplayTags = [...new Set([...tags, ...selectedTags, ...suggestedTags])];
  const sortedTags = [...allDisplayTags].sort((a, b) => {
    const aIsSuggested = suggestedTags.includes(a);
    const bIsSuggested = suggestedTags.includes(b);
    const aIsSelected = selectedTags.includes(a);
    const bIsSelected = selectedTags.includes(b);

    if (aIsSuggested && !bIsSuggested) return -1;
    if (!aIsSuggested && bIsSuggested) return 1;
    if (aIsSelected && !bIsSelected) return -1;
    if (!aIsSelected && bIsSelected) return 1;
    return 0;
  });

  return (
    <div className={cn(
      'rounded-md border transition-all duration-200',
      theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'
    )}>
      <Button
        variant="ghost"
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
              'text-xs',
              theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
            )}>
              {title}
            </span>
            {!isExpanded && (hasSelection || poolCount > 0) && (
              <MicroTitle className="text-xs truncate max-w-[200px] text-neutral-300">
                {selectionSummary}
              </MicroTitle>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSurpriseMeMode && <Dices size={12} className="text-neutral-500" />}
          {hasSelection && (
            <span className="text-xs text-neutral-300 bg-neutral-700/50 px-1.5 py-0.5 rounded">
              {selectedTags.length}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="" />
          ) : (
            <ChevronDown size={16} className="" />
          )}
        </div>
      </Button>
      {isExpanded && (
        <div className="p-3 pt-0 animate-fade-in">
          {suggestedTags.length > 0 && (
            <div className="mb-2">
              <span className="text-xs text-neutral-400 mb-1 block">
                {t('mockup.suggested') || 'Suggested'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestedTags.map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  const isInPool = isSurpriseMeMode && poolTags?.includes(tag);
                  return (
                    <Tag
                      key={tag}
                      label={translateTag(tag)}
                      selected={isSelected}
                      suggested={!isSurpriseMeMode && !isSelected}
                      inPool={isInPool}
                      onToggle={() => {
                        if (isSurpriseMeMode && onPoolToggle) {
                          onPoolToggle(tag);
                        } else {
                          onTagToggle(tag);
                        }
                      }}
                      disabled={!isSurpriseMeMode && hasSelection && !isSelected && isSingleSelection}
                      size="sm"
                    />
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {!isEditingCustom ? (
              <Tag
                label={t('mockup.customTagLabel')}
                onToggle={handleCustomTagClick}
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
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border border-neutral-600/30 focus:outline-none focus:ring-0 min-w-[120px]',
                  theme === 'dark'
                    ? 'bg-neutral-800/50 text-neutral-300'
                    : 'bg-neutral-100/50 text-neutral-800'
                )}
                autoFocus
              />
            )}
            {sortedTags
              .filter(tag => !suggestedTags.includes(tag))
              .map(tag => {
                const isSelected = selectedTags.includes(tag);
                const isInPool = isSurpriseMeMode && poolTags?.includes(tag);
                return (
                  <Tag
                    key={tag}
                    label={translateTag(tag)}
                    selected={isSelected}
                    inPool={isInPool}
                    onToggle={() => {
                      if (isSurpriseMeMode && onPoolToggle) {
                        onPoolToggle(tag);
                      } else {
                        onTagToggle(tag);
                      }
                    }}
                    disabled={!isSurpriseMeMode && hasSelection && !isSelected && isSingleSelection}
                    size="sm"
                  />
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

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
      'rounded-md border transition-all duration-200',
      theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'
    )}>
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex justify-between items-center text-left p-3 transition-all duration-200',
          'hover:bg-neutral-800/10',
          isExpanded && (theme === 'dark' ? 'bg-neutral-800/20' : 'bg-neutral-100/50')
        )}
      >
        <div className="flex items-center gap-2">
          <Palette size={14} className="" />
          <span className={cn(
            'text-xs',
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
      </Button>

      {isExpanded && (
        <div className="p-3 pt-0 animate-fade-in">
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestedColors.map(color => (
              <Button
                variant="ghost"
                key={color}
                onClick={() => onColorToggle(color)}
                className={cn(
                  'w-8 h-8 rounded-md border-2 transition-all duration-200',
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

  const [customBrandingInput, setCustomBrandingInput] = useState('');
  const [customLocationInput, setCustomLocationInput] = useState('');
  const [customAngleInput, setCustomAngleInput] = useState('');
  const [customLightingInput, setCustomLightingInput] = useState('');
  const [customEffectInput, setCustomEffectInput] = useState('');
  const [customMaterialInput, setCustomMaterialInput] = useState('');

  const [isBrandingExpanded, setIsBrandingExpanded] = useState(false);
  const [isLocationExpanded, setIsLocationExpanded] = useState(false);
  const [isAngleExpanded, setIsAngleExpanded] = useState(false);
  const [isLightingExpanded, setIsLightingExpanded] = useState(false);
  const [isEffectExpanded, setIsEffectExpanded] = useState(false);
  const [isMaterialExpanded, setIsMaterialExpanded] = useState(false);

  const connectedImage = nodeData.connectedImage;
  const isAnalyzing = nodeData.isAnalyzing || false;
  const hasAnalyzed = nodeData.hasAnalyzed || false;
  const isGeneratingPrompt = nodeData.isGeneratingPrompt || false;
  const generatedPrompt = nodeData.generatedPrompt;
  const selectedDesignType = nodeData.selectedDesignType || nodeData.suggestedDesignType || null;

  const selectedBrandingTags = nodeData.selectedBrandingTags || [];
  const selectedLocationTags = nodeData.selectedLocationTags || [];
  const selectedAngleTags = nodeData.selectedAngleTags || [];
  const selectedLightingTags = nodeData.selectedLightingTags || [];
  const selectedEffectTags = nodeData.selectedEffectTags || [];
  const selectedMaterialTags = nodeData.selectedMaterialTags || [];

  const suggestedBrandingTags = nodeData.suggestedBrandingTags || [];
  const suggestedLocationTags = nodeData.suggestedLocationTags || [];
  const suggestedAngleTags = nodeData.suggestedAngleTags || [];
  const suggestedLightingTags = nodeData.suggestedLightingTags || [];
  const suggestedEffectTags = nodeData.suggestedEffectTags || [];
  const suggestedMaterialTags = nodeData.suggestedMaterialTags || [];

  const suggestedColors = nodeData.suggestedColors || [];
  const selectedColors = nodeData.selectedColors || [];

  const renderTagButton = (tag: string) => (
    <Tag
      label={translateTag(tag)}
      selected={selectedBrandingTags.includes(tag)}
      onToggle={() => {
        const updated = selectedBrandingTags.includes(tag)
          ? selectedBrandingTags.filter(t => t !== tag)
          : [...selectedBrandingTags, tag];
        onUpdateData(nodeId, { selectedBrandingTags: updated });
      }}
      size="sm"
    />
  );

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-0 h-full w-80 bg-neutral-950 border-l border-neutral-800/50 shadow-xl flex flex-col z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-neutral-800/50">
        <div className="flex items-center gap-3">
          <Compass size={20} className="text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-200 uppercase">
            {t('canvasNodes.directorNode.title') || 'Director'}
          </h2>
        </div>
        <Button
          variant="ghost"
          onClick={onClose}
          className="p-2 text-neutral-500 hover:text-white transition-colors rounded-md hover:bg-neutral-800/50"
        >
          <X size={18} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {connectedImage ? (
          <>
            <DesignTypeSection
              designType={selectedDesignType}
              onDesignTypeChange={(type) => {
                onUpdateData(nodeId, { selectedDesignType: type });
              }}
              uploadedImage={connectedImage ? { url: connectedImage, mimeType: 'image/png' } : null}
              onScrollToSection={() => { }}
            />

            {!hasAnalyzed && (
              <Button
                variant="brand"
                onClick={onAnalyze}
                disabled={isAnalyzing}
                className={cn(
                  'w-full px-4 py-3 rounded-md border transition-all duration-200',
                  'flex items-center justify-center gap-2',
                  'text-sm',
                  isAnalyzing
                    ? 'bg-neutral-800/50 border-neutral-700/50 text-neutral-400 cursor-not-allowed'
                    : 'bg-brand-cyan/10 border-[brand-cyan]/30 text-brand-cyan hover:bg-brand-cyan/20'
                )}
              >
                {isAnalyzing ? (
                  <>
                    <GlitchLoader size="sm" />
                    {t('mockup.analyzing') || 'Analyzing...'}
                  </>
                ) : (
                  <>
                    <Diamond size={16} />
                    {t('canvasNodes.directorNode.analyze') || 'Analyze Image'}
                  </>
                )}
              </Button>
            )}

            {hasAnalyzed && (
              <>
                <CollapsableTagSection
                  title={t('mockup.branding') || 'Branding'}
                  tags={AVAILABLE_BRANDING_TAGS}
                  selectedTags={selectedBrandingTags}
                  suggestedTags={suggestedBrandingTags}
                  onTagToggle={(tag) => {
                    const updated = selectedBrandingTags.includes(tag)
                      ? selectedBrandingTags.filter(t => t !== tag)
                      : [...selectedBrandingTags, tag];
                    onUpdateData(nodeId, { selectedBrandingTags: updated });
                  }}
                  customInput={customBrandingInput}
                  onCustomInputChange={setCustomBrandingInput}
                  onAddCustomTag={() => {
                    if (customBrandingInput.trim()) {
                      onUpdateData(nodeId, {
                        selectedBrandingTags: [...selectedBrandingTags, customBrandingInput]
                      });
                      setCustomBrandingInput('');
                    }
                  }}
                  theme={theme}
                  t={t}
                  icon={<Shirt size={14} className="text-neutral-400" />}
                />

                <CollapsableTagSection
                  title={t('mockup.location') || 'Location'}
                  tags={AVAILABLE_LOCATION_TAGS}
                  selectedTags={selectedLocationTags}
                  suggestedTags={suggestedLocationTags}
                  onTagToggle={(tag) => {
                    const updated = selectedLocationTags.includes(tag)
                      ? selectedLocationTags.filter(t => t !== tag)
                      : [...selectedLocationTags, tag];
                    onUpdateData(nodeId, { selectedLocationTags: updated });
                  }}
                  customInput={customLocationInput}
                  onCustomInputChange={setCustomLocationInput}
                  onAddCustomTag={() => {
                    if (customLocationInput.trim()) {
                      onUpdateData(nodeId, {
                        selectedLocationTags: [...selectedLocationTags, customLocationInput]
                      });
                      setCustomLocationInput('');
                    }
                  }}
                  theme={theme}
                  t={t}
                  icon={<MapPin size={14} className="text-neutral-400" />}
                />

                <CollapsableTagSection
                  title={t('mockup.angle') || 'Angle'}
                  tags={AVAILABLE_ANGLE_TAGS}
                  selectedTags={selectedAngleTags}
                  suggestedTags={suggestedAngleTags}
                  onTagToggle={(tag) => {
                    const updated = selectedAngleTags.includes(tag)
                      ? selectedAngleTags.filter(t => t !== tag)
                      : [...selectedAngleTags, tag];
                    onUpdateData(nodeId, { selectedAngleTags: updated });
                  }}
                  customInput={customAngleInput}
                  onCustomInputChange={setCustomAngleInput}
                  onAddCustomTag={() => {
                    if (customAngleInput.trim()) {
                      onUpdateData(nodeId, {
                        selectedAngleTags: [...selectedAngleTags, customAngleInput]
                      });
                      setCustomAngleInput('');
                    }
                  }}
                  theme={theme}
                  t={t}
                  icon={<Camera size={14} className="text-neutral-400" />}
                />

                <CollapsableTagSection
                  title={t('mockup.lighting') || 'Lighting'}
                  tags={AVAILABLE_LIGHTING_TAGS}
                  selectedTags={selectedLightingTags}
                  suggestedTags={suggestedLightingTags}
                  onTagToggle={(tag) => {
                    const updated = selectedLightingTags.includes(tag)
                      ? selectedLightingTags.filter(t => t !== tag)
                      : [...selectedLightingTags, tag];
                    onUpdateData(nodeId, { selectedLightingTags: updated });
                  }}
                  customInput={customLightingInput}
                  onCustomInputChange={setCustomLightingInput}
                  onAddCustomTag={() => {
                    if (customLightingInput.trim()) {
                      onUpdateData(nodeId, {
                        selectedLightingTags: [...selectedLightingTags, customLightingInput]
                      });
                      setCustomLightingInput('');
                    }
                  }}
                  theme={theme}
                  t={t}
                  icon={<Lightbulb size={14} className="text-neutral-400" />}
                />

                <CollapsableTagSection
                  title={t('mockup.effect') || 'Effect'}
                  tags={AVAILABLE_EFFECT_TAGS}
                  selectedTags={selectedEffectTags}
                  suggestedTags={suggestedEffectTags}
                  onTagToggle={(tag) => {
                    const updated = selectedEffectTags.includes(tag)
                      ? selectedEffectTags.filter(t => t !== tag)
                      : [...selectedEffectTags, tag];
                    onUpdateData(nodeId, { selectedEffectTags: updated });
                  }}
                  customInput={customEffectInput}
                  onCustomInputChange={setCustomEffectInput}
                  onAddCustomTag={() => {
                    if (customEffectInput.trim()) {
                      onUpdateData(nodeId, {
                        selectedEffectTags: [...selectedEffectTags, customEffectInput]
                      });
                      setCustomEffectInput('');
                    }
                  }}
                  theme={theme}
                  t={t}
                  icon={<Diamond size={14} className="text-neutral-400" />}
                />

                <CollapsableTagSection
                  title={t('mockup.material') || 'Material'}
                  tags={AVAILABLE_MATERIAL_TAGS}
                  selectedTags={selectedMaterialTags}
                  suggestedTags={suggestedMaterialTags}
                  onTagToggle={(tag) => {
                    const updated = selectedMaterialTags.includes(tag)
                      ? selectedMaterialTags.filter(t => t !== tag)
                      : [...selectedMaterialTags, tag];
                    onUpdateData(nodeId, { selectedMaterialTags: updated });
                  }}
                  customInput={customMaterialInput}
                  onCustomInputChange={setCustomMaterialInput}
                  onAddCustomTag={() => {
                    if (customMaterialInput.trim()) {
                      onUpdateData(nodeId, {
                        selectedMaterialTags: [...selectedMaterialTags, customMaterialInput]
                      });
                      setCustomMaterialInput('');
                    }
                  }}
                  theme={theme}
                  t={t}
                  icon={<Layers size={14} className="text-neutral-400" />}
                />

                <ColorSection
                  suggestedColors={suggestedColors}
                  selectedColors={selectedColors}
                  onColorToggle={(color) => {
                    const updated = selectedColors.includes(color)
                      ? selectedColors.filter(c => c !== color)
                      : [...selectedColors, color];
                    onUpdateData(nodeId, { selectedColors: updated });
                  }}
                  theme={theme}
                  t={t}
                />

                {(generatedPrompt || isGeneratingPrompt) && (
                  <div className="bg-neutral-800/20 border border-neutral-700/30 rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-neutral-400 flex-shrink-0" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                        {t('mockup.generatedPrompt') || 'Generated Prompt'}
                      </span>
                    </div>
                    {isGeneratingPrompt ? (
                      <div className="flex items-center justify-center py-4">
                        <GlitchLoader size="sm" />
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        {generatedPrompt}
                      </p>
                    )}
                  </div>
                )}

                {hasAnalyzed && !isGeneratingPrompt && !generatedPrompt && (
                  <Button
                    variant="outline"
                    onClick={onGeneratePrompt}
                    className="w-full text-xs py-2"
                  >
                    {t('mockup.generatePrompt') || 'Generate Prompt'}
                  </Button>
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Smartphone size={32} className="text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-500">
              {t('canvasNodes.directorNode.connectImageFirst') || 'Connect an image to the Director node to start'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
