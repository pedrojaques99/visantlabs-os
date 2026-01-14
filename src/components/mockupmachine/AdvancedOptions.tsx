import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { translateTag } from '@/utils/localeUtils';
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
}

const CollapsableTagSection: React.FC<CollapsableTagSectionProps> = ({
  title,
  tags,
  selectedTags,
  onTagToggle,
  customInput,
  onCustomInputChange,
  onAddCustomTag,
  suggestedTags = []
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate if content overflows (more than 1 row)
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && !isExpanded) {
        const container = containerRef.current;
        const children = Array.from(container.children) as HTMLElement[];
        if (children.length === 0) {
          setHasOverflow(false);
          return;
        }

        // Check if tags wrap to more than one line
        let firstRowBottom = children[0]?.offsetTop + children[0]?.offsetHeight;
        const hasMultipleRows = children.some(child => child.offsetTop > firstRowBottom);
        setHasOverflow(hasMultipleRows);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [tags, selectedTags, isExpanded]);

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
    blurTimeoutRef.current = window.setTimeout(() => {
      handleCustomTagSubmit();
    }, 150);
  };

  return (
    <div className={`p-4 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
      <div className="mb-2">
        <h4 className={`text-xs font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{title}</h4>
      </div>

      <div
        ref={containerRef}
        className={`flex flex-wrap gap-2 cursor-pointer transition-all duration-500 ease-in-out ${!isExpanded ? 'max-h-[2.5rem] overflow-hidden' : 'max-h-[500px]'}`}
        style={{
          transition: 'max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out'
        }}
      >
        {/* Custom tag input/button - always first */}
        {!isEditingCustom ? (
          <button
            onClick={handleCustomTagClick}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border inline-flex items-center gap-1 cursor-pointer ${theme === 'dark'
              ? 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
              : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-400 hover:text-neutral-900'
              }`}
          >
            <Plus size={14} />
            <span>{t('mockup.customTagLabel')}</span>
          </button>
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
            const hasSelection = selectedTags.length > 0;

            return (
              <button
                key={tag}
                onClick={() => onTagToggle(tag)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border cursor-pointer ${isSelected
                  ? theme === 'dark'
                    ? 'bg-brand-cyan/20 text-brand-cyan border-[brand-cyan]/30 shadow-sm shadow-[brand-cyan]/10'
                    : 'bg-brand-cyan/20 text-neutral-800 border-[brand-cyan]/30 shadow-sm shadow-[brand-cyan]/10'
                  : theme === 'dark'
                    ? isSuggested
                      ? 'bg-neutral-800/80 text-neutral-300 border-brand-cyan/50 hover:border-brand-cyan/70 hover:text-white animate-pulse-subtle'
                      : 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                    : isSuggested
                      ? 'bg-brand-cyan/10 text-neutral-800 border-brand-cyan/50 shadow-sm shadow-brand-cyan/5 animate-pulse-subtle'
                      : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-400 hover:text-neutral-900'
                  } ${hasSelection && !isSelected ? 'opacity-40' : ''}`}
              >
                {translateTag(tag)}
              </button>
            );
          });
        })()}
      </div>

      {/* Expand/Collapse button - outside overflow container */}
      {hasOverflow && (
        <div className="flex justify-center mt-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-1.5 rounded transition-all duration-200 ${theme === 'dark' ? 'hover:bg-neutral-800/50 text-neutral-500 hover:text-neutral-400' : 'hover:bg-neutral-200/50 text-neutral-600 hover:text-neutral-700'}`}
            aria-label={isExpanded ? t('common.collapse') : t('common.expand')}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
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
  suggestedColors
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Remove todos os # existentes e adiciona um no início se houver conteúdo
    if (value) {
      value = value.replace(/#/g, '');
      if (value.length > 0) {
        value = '#' + value;
      }
    }
    // Cria um evento sintético com o valor modificado
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value: value
      }
    } as React.ChangeEvent<HTMLInputElement>;
    onColorInputChange(syntheticEvent);
  };

  return (
    <div className="space-y-4 pt-4 animate-fade-in-down">
      <div className={`p-4 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
        <h4 className={`text-xs font-mono mb-3 uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{t('mockup.colorPalette')}</h4>

        {/* Two-column layout: Input on left, Suggestions on right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left column: Color input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-grow relative flex items-center">
                <input
                  type="text"
                  value={colorInput}
                  onChange={handleColorInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddColor();
                    }
                  }}
                  className={`w-full p-2 rounded-md border focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-xs font-mono transition-colors duration-200 pl-8 ${theme === 'dark'
                    ? 'bg-black/40 border-neutral-700/50 text-neutral-400'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-700'
                    }`}
                  placeholder="#52ddeb"
                />
                {(isValidColor || !colorInput) && (
                  <span
                    className="absolute left-2.5 w-4 h-4 rounded-md border border-neutral-600"
                    style={{ backgroundColor: isValidColor ? colorInput : '#52ddeb' }}
                  ></span>
                )}
              </div>
              <button
                onClick={onAddColor}
                disabled={!isValidColor}
                className={`px-3 rounded-md border text-xs font-mono transition-all ${isValidColor
                  ? theme === 'dark'
                    ? 'bg-neutral-700/50 text-neutral-400 border-neutral-700/50 hover:bg-neutral-600/50 hover:text-neutral-300 cursor-pointer'
                    : 'bg-neutral-200 text-neutral-700 border-neutral-300 hover:bg-neutral-300 hover:text-neutral-900 cursor-pointer'
                  : 'bg-neutral-800/30 text-neutral-600 border-neutral-700/30 cursor-not-allowed opacity-50'
                  }`}
              >
                {t('common.add')}
              </button>
            </div>

            {/* Selected colors */}
            {selectedColors.length > 0 && (
              <div className="flex flex-wrap gap-2 min-h-[26px]">
                {selectedColors.map(color => (
                  <div key={color} className={`flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md border text-xs ${theme === 'dark'
                    ? 'bg-neutral-900/80 border-neutral-700'
                    : 'bg-neutral-200 border-neutral-300'
                    }`}>
                    <span
                      className="w-3 h-3 rounded-md border border-white/10"
                      style={{ backgroundColor: color }}
                    ></span>
                    <span className="font-mono">{color}</span>
                    <button onClick={() => onRemoveColor(color)} className={`rounded-md cursor-pointer ${theme === 'dark' ? 'text-neutral-500 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'
                      }`}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column: Suggested Colors */}
          {suggestedColors.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {suggestedColors.map(color => {
                  const isSelected = selectedColors.includes(color);
                  const limitReached = selectedColors.length >= 5;
                  const isDisabled = limitReached && !isSelected;

                  return (
                    <button
                      key={color}
                      onClick={() => {
                        if (!isDisabled) {
                          if (isSelected) {
                            onRemoveColor(color);
                          } else {
                            // Auto-add color directly
                            const syntheticEvent = {
                              target: { value: color }
                            } as React.ChangeEvent<HTMLInputElement>;
                            onColorInputChange(syntheticEvent);
                            // Small delay to ensure state is updated
                            setTimeout(() => onAddColor(), 10);
                          }
                        }
                      }}
                      className={`group relative w-8 h-8 rounded-md border transition-all duration-200 ${isSelected
                        ? 'border-brand-cyan ring-2 ring-brand-cyan/30 scale-110 z-10'
                        : 'border-white/10 hover:border-brand-cyan/50 hover:scale-105'
                        } ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
                          <div className="w-2 h-2 bg-white rounded-full shadow-sm"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
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
        />
      )}
      <div className={`p-4 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
        <h4 className={`text-xs font-mono mb-2 uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{t('mockup.negativePrompt')}</h4>
        <textarea
          value={negativePrompt}
          onChange={onNegativePromptChange}
          rows={2}
          className={`w-full p-2 rounded-md border focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-xs whitespace-pre-wrap font-mono transition-colors duration-200 resize-y ${theme === 'dark'
            ? 'bg-black/40 border-neutral-700/50 text-neutral-400'
            : 'bg-neutral-50 border-neutral-300 text-neutral-700'
            }`}
          placeholder={t('mockup.negativePromptPlaceholder')}
        />
      </div>
      <div className={`p-4 rounded-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
        <h4 className={`text-xs font-mono mb-2 uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{t('mockup.additionalPrompt')}</h4>
        <textarea
          value={additionalPrompt}
          onChange={onAdditionalPromptChange}
          rows={2}
          className={`w-full p-2 rounded-md border focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-xs whitespace-pre-wrap font-mono transition-colors duration-200 resize-y ${theme === 'dark'
            ? 'bg-black/40 border-neutral-700/50 text-neutral-400'
            : 'bg-neutral-50 border-neutral-300 text-neutral-700'
            }`}
          placeholder={t('mockup.additionalPromptPlaceholder')}
        />
      </div>
    </div>
  );
};
