import React, { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../hooks/useTheme';
import { translateTag } from '../../utils/localeUtils';
import type { DesignType } from '../../types';

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
}

interface CollapsableTagSectionProps {
  title: string;
  tags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  customInput: string;
  onCustomInputChange: (value: string) => void;
  onAddCustomTag: () => void;
}

const CollapsableTagSection: React.FC<CollapsableTagSectionProps> = ({
  title,
  tags,
  selectedTags,
  onTagToggle,
  customInput,
  onCustomInputChange,
  onAddCustomTag
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
    blurTimeoutRef.current = window.setTimeout(() => {
      handleCustomTagSubmit();
    }, 150);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className={`text-xs font-mono ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>{title}</h4>
      </div>

      <div className="flex flex-wrap gap-2 cursor-pointer">
        {tags.map(tag => {
          const isSelected = selectedTags.includes(tag);
          const hasSelection = selectedTags.length > 0;

          return (
            <button
              key={tag}
              onClick={() => onTagToggle(tag)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer ${isSelected
                ? theme === 'dark'
                  ? 'bg-brand-cyan/20 text-brand-cyan border-[#brand-cyan]/30 shadow-sm shadow-[#brand-cyan]/10'
                  : 'bg-brand-cyan/20 text-zinc-800 border-[#brand-cyan]/30 shadow-sm shadow-[#brand-cyan]/10'
                : theme === 'dark'
                  ? 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300'
                  : 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:border-zinc-400 hover:text-zinc-900'
                } ${hasSelection && !isSelected ? 'opacity-40' : ''}`}
            >
              {translateTag(tag)}
            </button>
          );
        })}
        {!isEditingCustom ? (
          <button
            onClick={handleCustomTagClick}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border transform hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center gap-1 cursor-pointer ${theme === 'dark'
              ? 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300'
              : 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:border-zinc-400 hover:text-zinc-900'
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
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border border-[#brand-cyan]/30 focus:outline-none focus:ring-0 min-w-[120px] font-mono ${theme === 'dark'
              ? 'bg-brand-cyan/20 text-brand-cyan'
              : 'bg-brand-cyan/20 text-zinc-800'
              }`}
            autoFocus
          />
        )}
      </div>
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
  designType
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
      <div>
        <h4 className={`text-xs font-mono mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>{t('mockup.colorPalette')}</h4>
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
              className={`w-full p-2 rounded-md border focus:outline-none focus:border-[#brand-cyan]/50 focus:ring-0 text-xs font-mono transition-colors duration-200 pl-8 ${theme === 'dark'
                ? 'bg-black/40 border-zinc-700/50 text-zinc-400'
                : 'bg-zinc-50 border-zinc-300 text-zinc-700'
                }`}
              placeholder="#brand-cyan"
            />
            {(isValidColor || !colorInput) && (
              <span
                className="absolute left-2.5 w-4 h-4 rounded-md border border-zinc-600"
                style={{ backgroundColor: isValidColor ? colorInput : '#brand-cyan' }}
              ></span>
            )}
          </div>
          <button
            onClick={onAddColor}
            className={`px-3 rounded-md border text-xs font-mono cursor-pointer ${theme === 'dark'
              ? 'bg-zinc-700/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-600/50 hover:text-zinc-300'
              : 'bg-zinc-200 text-zinc-700 border-zinc-300 hover:bg-zinc-300 hover:text-zinc-900'
              }`}
          >
            {t('common.add')}
          </button>
        </div>
        {selectedColors.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 min-h-[26px]">
            {selectedColors.map(color => (
              <div key={color} className={`flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md border text-xs ${theme === 'dark'
                ? 'bg-zinc-900/80 border-zinc-700'
                : 'bg-zinc-200 border-zinc-300'
                }`}>
                <span
                  className="w-3 h-3 rounded-md border border-white/10"
                  style={{ backgroundColor: color }}
                ></span>
                <span className="font-mono">{color}</span>
                <button onClick={() => onRemoveColor(color)} className={`rounded-md cursor-pointer ${theme === 'dark' ? 'text-zinc-500 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
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
      />
      <CollapsableTagSection
        title={t('mockup.lightingMood')}
        tags={availableLightingTags}
        selectedTags={selectedLightingTags}
        onTagToggle={onLightingTagToggle}
        customInput={customLightingInput}
        onCustomInputChange={onCustomLightingInputChange}
        onAddCustomTag={onAddCustomLightingTag}
      />
      <CollapsableTagSection
        title={t('mockup.visualEffects')}
        tags={availableEffectTags}
        selectedTags={selectedEffectTags}
        onTagToggle={onEffectTagToggle}
        customInput={customEffectInput}
        onCustomInputChange={onCustomEffectInputChange}
        onAddCustomTag={onAddCustomEffectTag}
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
        />
      )}
      <div>
        <h4 className={`text-xs font-mono mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>{t('mockup.negativePrompt')}</h4>
        <textarea
          value={negativePrompt}
          onChange={onNegativePromptChange}
          rows={2}
          className={`w-full p-2 rounded-md border focus:outline-none focus:border-[#brand-cyan]/50 focus:ring-0 text-xs whitespace-pre-wrap font-mono transition-colors duration-200 resize-y ${theme === 'dark'
            ? 'bg-black/40 border-zinc-700/50 text-zinc-400'
            : 'bg-zinc-50 border-zinc-300 text-zinc-700'
            }`}
          placeholder={t('mockup.negativePromptPlaceholder')}
        />
      </div>
      <div>
        <h4 className={`text-xs font-mono mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>{t('mockup.additionalPrompt')}</h4>
        <textarea
          value={additionalPrompt}
          onChange={onAdditionalPromptChange}
          rows={2}
          className={`w-full p-2 rounded-md border focus:outline-none focus:border-[#brand-cyan]/50 focus:ring-0 text-xs whitespace-pre-wrap font-mono transition-colors duration-200 resize-y ${theme === 'dark'
            ? 'bg-black/40 border-zinc-700/50 text-zinc-400'
            : 'bg-zinc-50 border-zinc-300 text-zinc-700'
            }`}
          placeholder={t('mockup.additionalPromptPlaceholder')}
        />
      </div>
    </div>
  );
};
