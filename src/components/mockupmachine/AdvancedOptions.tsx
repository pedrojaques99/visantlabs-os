import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, ChevronDown, ChevronUp, Dices, MapPin, Camera, Lightbulb, Sparkles, Layers, XCircle, FilePlus } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { translateTag } from '@/utils/localeUtils';
import { Tag } from '@/components/shared/Tag';
import type { DesignType } from '@/types/types';

interface AdvancedOptionsProps {
  selectedLocationTags: string[];
  selectedAngleTags: string[];
  selectedLightingTags: string[];
  selectedEffectTags: string[];
  selectedColors: string[];
  colorInput: string;
  isValidColor: boolean;
  negativePrompt: string;
  additionalPrompt: string;
  onLocationTagToggle: (tag: string) => void;
  onAngleTagToggle: (tag: string) => void;
  onLightingTagToggle: (tag: string) => void;
  onEffectTagToggle: (tag: string) => void;
  onColorInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddColor: () => void;
  onRemoveColor: (color: string) => void;
  onNegativePromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onAdditionalPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  availableLocationTags: string[];
  availableAngleTags: string[];
  availableLightingTags: string[];
  availableEffectTags: string[];
  customLocationInput: string;
  customAngleInput: string;
  customLightingInput: string;
  customEffectInput: string;
  onCustomLocationInputChange: (value: string) => void;
  onCustomAngleInputChange: (value: string) => void;
  onCustomLightingInputChange: (value: string) => void;
  onCustomEffectInputChange: (value: string) => void;
  onAddCustomLocationTag: () => void;
  onAddCustomAngleTag: () => void;
  onAddCustomLightingTag: () => void;
  onAddCustomEffectTag: () => void;
  selectedMaterialTags: string[];
  availableMaterialTags: string[];
  customMaterialInput: string;
  onMaterialTagToggle: (tag: string) => void;
  onCustomMaterialInputChange: (value: string) => void;
  onAddCustomMaterialTag: () => void;
  designType: DesignType | null;
  suggestedLocationTags: string[];
  suggestedAngleTags: string[];
  suggestedLightingTags: string[];
  suggestedEffectTags: string[];
  suggestedMaterialTags: string[];
  suggestedColors: string[];
  // Surprise Me Mode props
  isSurpriseMeMode?: boolean;
  locationPool?: string[];
  anglePool?: string[];
  lightingPool?: string[];
  effectPool?: string[];
  materialPool?: string[];
  onLocationPoolToggle?: (tag: string) => void;
  onAnglePoolToggle?: (tag: string) => void;
  onLightingPoolToggle?: (tag: string) => void;
  onEffectPoolToggle?: (tag: string) => void;
  onMaterialPoolToggle?: (tag: string) => void;
}

interface CollapsableTagSectionProps {
  title: string;
  tags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  customInput: string;
  onCustomInputChange: (value: string) => void;
  onAddCustomTag: () => void;
  suggestedTags?: string[];
  // Surprise Me Mode props
  isSurpriseMeMode?: boolean;
  poolTags?: string[];
  onPoolToggle?: (tag: string) => void;
  icon?: React.ReactNode;
}

const CollapsableTagSection: React.FC<CollapsableTagSectionProps> = ({
  title,
  tags,
  selectedTags,
  onTagToggle,
  customInput,
  onCustomInputChange,
  onAddCustomTag,
  suggestedTags = [],
  // Surprise Me Mode props
  isSurpriseMeMode = false,
  poolTags = [],
  onPoolToggle,
  icon
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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
  const selectionSummary = selectedTags.length > 0
    ? selectedTags.map(tag => translateTag(tag)).join(', ')
    : '';
  const poolCount = isSurpriseMeMode ? tags.filter(t => poolTags.includes(t)).length : 0;

  return (
    <div className={`rounded-lg border transition-all duration-200 ${theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10 ${isExpanded ? (theme === 'dark' ? 'bg-neutral-800/20' : 'bg-neutral-100/50') : ''}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
            <span className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{title}</span>
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
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleCustomTagClick();
            }}
            className="p-1 rounded-md hover:bg-neutral-500/20 text-neutral-500 hover:text-brand-cyan transition-colors"
            title={t('mockup.addCustomTag')}
          >
            <Plus size={14} />
          </div>
          {isSurpriseMeMode && <Dices size={12} className="text-brand-cyan/60" />}
          {isExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
        </div>
      </button>

      {isExpanded && (
        <div className={`p-3 pt-0 animate-fade-in`}>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {/* Custom tag input/button - always first */}
            {!isEditingCustom ? (
              <Tag
                label={t('mockup.customTagLabel')}
                onToggle={handleCustomTagClick}
                className="gap-1 scale-90 origin-left"
              >
                <Plus size={12} />
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
                className={`px-3 py-1.5 text-[10px] font-medium rounded-md transition-all duration-200 border border-[brand-cyan]/30 focus:outline-none focus:ring-0 min-w-[120px] font-mono ${theme === 'dark'
                  ? 'bg-brand-cyan/10 text-brand-cyan'
                  : 'bg-brand-cyan/5 text-neutral-800'
                  }`}
                autoFocus
              />
            )}

            {/* Regular tags */}
            {(() => {
              const allDisplayTags = [...new Set([...tags, ...selectedTags, ...suggestedTags])];

              // Sort tags: suggested first, then selected, then others
              const sortedTags = [...allDisplayTags].sort((a, b) => {
                const aIsSuggested = suggestedTags.includes(a);
                const bIsSuggested = suggestedTags.includes(b);
                const aIsSelected = selectedTags.includes(a);
                const bIsSelected = selectedTags.includes(b);

                // Suggested tags first
                if (aIsSuggested && !bIsSuggested) return -1;
                if (!aIsSuggested && bIsSuggested) return 1;

                // Then selected tags
                if (aIsSelected && !bIsSelected) return -1;
                if (!aIsSelected && bIsSelected) return 1;

                return 0;
              });

              return sortedTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                const isSuggested = suggestedTags.includes(tag);
                const isInPool = isSurpriseMeMode && poolTags.includes(tag);

                // In Surprise Me Mode, clicking toggles pool membership
                const handleClick = () => {
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
                    disabled={!isSurpriseMeMode && hasSelection && !isSelected}
                    className="scale-90 origin-left"
                  />
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export const AdvancedOptions: React.FC<AdvancedOptionsProps> = ({
  selectedLocationTags,
  selectedAngleTags,
  selectedLightingTags,
  selectedEffectTags,
  selectedColors,
  colorInput,
  isValidColor,
  negativePrompt,
  additionalPrompt,
  onLocationTagToggle,
  onAngleTagToggle,
  onLightingTagToggle,
  onEffectTagToggle,
  onColorInputChange,
  onAddColor,
  onRemoveColor,
  onNegativePromptChange,
  onAdditionalPromptChange,
  availableLocationTags,
  availableAngleTags,
  availableLightingTags,
  availableEffectTags,
  customLocationInput,
  customAngleInput,
  customLightingInput,
  customEffectInput,
  onCustomLocationInputChange,
  onCustomAngleInputChange,
  onCustomLightingInputChange,
  onCustomEffectInputChange,
  onAddCustomLocationTag,
  onAddCustomAngleTag,
  onAddCustomLightingTag,
  onAddCustomEffectTag,
  selectedMaterialTags,
  availableMaterialTags,
  customMaterialInput,
  onMaterialTagToggle,
  onCustomMaterialInputChange,
  onAddCustomMaterialTag,
  designType,
  suggestedLocationTags,
  suggestedAngleTags,
  suggestedLightingTags,
  suggestedEffectTags,
  suggestedMaterialTags,
  suggestedColors,
  // Surprise Me Mode props
  isSurpriseMeMode = false,
  locationPool = [],
  anglePool = [],
  lightingPool = [],
  effectPool = [],
  materialPool = [],
  onLocationPoolToggle,
  onAnglePoolToggle,
  onLightingPoolToggle,
  onEffectPoolToggle,
  onMaterialPoolToggle
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [isNegativeExpanded, setIsNegativeExpanded] = useState(false);
  const [isAdditionalExpanded, setIsAdditionalExpanded] = useState(false);

  return (
    <div className="space-y-2 pt-4 animate-fade-in-down">

      <div id="location-section">
        <CollapsableTagSection
          title={t('mockup.location')}
          tags={availableLocationTags}
          selectedTags={selectedLocationTags}
          onTagToggle={onLocationTagToggle}
          customInput={customLocationInput}
          onCustomInputChange={onCustomLocationInputChange}
          onAddCustomTag={onAddCustomLocationTag}
          suggestedTags={suggestedLocationTags}
          isSurpriseMeMode={isSurpriseMeMode}
          poolTags={locationPool}
          onPoolToggle={onLocationPoolToggle}
          icon={<MapPin size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />}
        />
      </div>
      <CollapsableTagSection
        title={t('mockup.cameraAngle')}
        tags={availableAngleTags}
        selectedTags={selectedAngleTags}
        onTagToggle={onAngleTagToggle}
        customInput={customAngleInput}
        onCustomInputChange={onCustomAngleInputChange}
        onAddCustomTag={onAddCustomAngleTag}
        suggestedTags={suggestedAngleTags}
        isSurpriseMeMode={isSurpriseMeMode}
        poolTags={anglePool}
        onPoolToggle={onAnglePoolToggle}
        icon={<Camera size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />}
      />
      <CollapsableTagSection
        title={t('mockup.lightingMood')}
        tags={availableLightingTags}
        selectedTags={selectedLightingTags}
        onTagToggle={onLightingTagToggle}
        customInput={customLightingInput}
        onCustomInputChange={onCustomLightingInputChange}
        onAddCustomTag={onAddCustomLightingTag}
        suggestedTags={suggestedLightingTags}
        isSurpriseMeMode={isSurpriseMeMode}
        poolTags={lightingPool}
        onPoolToggle={onLightingPoolToggle}
        icon={<Lightbulb size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />}
      />
      <CollapsableTagSection
        title={t('mockup.visualEffects')}
        tags={availableEffectTags}
        selectedTags={selectedEffectTags}
        onTagToggle={onEffectTagToggle}
        customInput={customEffectInput}
        onCustomInputChange={onCustomEffectInputChange}
        onAddCustomTag={onAddCustomEffectTag}
        suggestedTags={suggestedEffectTags}
        isSurpriseMeMode={isSurpriseMeMode}
        poolTags={effectPool}
        onPoolToggle={onEffectPoolToggle}
        icon={<Sparkles size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />}
      />
      {designType === 'logo' && (
        <CollapsableTagSection
          title={t('mockup.material')}
          tags={availableMaterialTags}
          selectedTags={selectedMaterialTags}
          onTagToggle={onMaterialTagToggle}
          customInput={customMaterialInput}
          onCustomInputChange={onCustomMaterialInputChange}
          onAddCustomTag={onAddCustomMaterialTag}
          suggestedTags={suggestedMaterialTags}
          isSurpriseMeMode={isSurpriseMeMode}
          poolTags={materialPool}
          onPoolToggle={onMaterialPoolToggle}
          icon={<Layers size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />}
        />
      )}

      {/* Prompts Section */}
      <div className="space-y-2">
        <div className={`rounded-lg border transition-all duration-200 ${theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'}`}>
          <button
            onClick={() => setIsNegativeExpanded(!isNegativeExpanded)}
            className={`w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10 ${isNegativeExpanded ? (theme === 'dark' ? 'bg-neutral-800/20' : 'bg-neutral-100/50') : ''}`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <XCircle size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
              <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                <span className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{t('mockup.negativePrompt')}</span>
                {!isNegativeExpanded && negativePrompt && (
                  <span className="text-[10px] text-neutral-500 font-mono truncate max-w-[200px]">{negativePrompt}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isNegativeExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
            </div>
          </button>

          {isNegativeExpanded && (
            <div className="p-3 pt-0">
              <textarea
                value={negativePrompt}
                onChange={onNegativePromptChange}
                rows={2}
                className={`w-full p-2.5 mt-2 rounded-md border focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-xs whitespace-pre-wrap font-mono transition-colors duration-200 resize-y h-[80px] ${theme === 'dark'
                  ? 'bg-neutral-950/70 border-neutral-700/50 text-neutral-400'
                  : 'bg-neutral-50 border-neutral-300 text-neutral-700'
                  }`}
                placeholder={t('mockup.negativePromptPlaceholder')}
              />
            </div>
          )}
        </div>

        <div className={`rounded-lg border transition-all duration-200 ${theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'}`}>
          <button
            onClick={() => setIsAdditionalExpanded(!isAdditionalExpanded)}
            className={`w-full flex justify-between items-center text-left p-3 transition-all duration-200 hover:bg-neutral-800/10 ${isAdditionalExpanded ? (theme === 'dark' ? 'bg-neutral-800/20' : 'bg-neutral-100/50') : ''}`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FilePlus size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
              <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                <span className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{t('mockup.additionalPrompt')}</span>
                {!isAdditionalExpanded && additionalPrompt && (
                  <span className="text-[10px] text-neutral-500 font-mono truncate max-w-[200px]">{additionalPrompt}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isAdditionalExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
            </div>
          </button>

          {isAdditionalExpanded && (
            <div className="p-3 pt-0">
              <textarea
                value={additionalPrompt}
                onChange={onAdditionalPromptChange}
                rows={2}
                className={`w-full p-2.5 mt-2 rounded-md border focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-xs whitespace-pre-wrap font-mono transition-colors duration-200 resize-y h-[80px] ${theme === 'dark'
                  ? 'bg-neutral-950/70 border-neutral-700/50 text-neutral-400'
                  : 'bg-neutral-50 border-neutral-300 text-neutral-700'
                  }`}
                placeholder={t('mockup.additionalPromptPlaceholder')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
