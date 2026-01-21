import React from 'react';
import { ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import { AdvancedOptions } from './AdvancedOptions';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import type { DesignType } from '@/types/types';


interface RefineSectionProps {
  isAdvancedOpen: boolean;
  onToggleAdvanced: () => void;
  advancedOptionsProps: {
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
    onGenerateTextChange: (value: boolean) => void;
    onWithHumanChange: (value: boolean) => void;
    onEnhanceTextureChange: (value: boolean) => void;
    designType: DesignType | null;
    generateText: boolean;
    withHuman: boolean;
    enhanceTexture: boolean;
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
  };
}

export const RefineSection: React.FC<RefineSectionProps> = ({
  isAdvancedOpen,
  onToggleAdvanced,
  advancedOptionsProps,

}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const {
    designType,
    generateText,
    withHuman,
    enhanceTexture,
    onGenerateTextChange,
    onWithHumanChange,
    onEnhanceTextureChange
  } = advancedOptionsProps;

  const ToggleItem = ({
    value,
    onChange,
    label,
    className = ""
  }: {
    value: boolean,
    onChange: (val: boolean) => void,
    label: string,
    className?: string
  }) => (
    <div
      className={`flex items-center p-2.5 rounded-md cursor-pointer border transition-all duration-200 ${className} ${theme === 'dark' ? 'bg-neutral-800/50 border-neutral-700/50 hover:bg-neutral-800' : 'bg-neutral-100 border-neutral-300 hover:bg-neutral-200'}`}
      onClick={() => onChange(!value)}
    >
      <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all duration-200 ${value ? 'bg-brand-cyan/80 border-[brand-cyan]' : theme === 'dark' ? 'bg-neutral-700 border-neutral-600' : 'bg-white border-neutral-400'}`}>
        {value && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <label className={`ml-3 text-xs select-none cursor-pointer ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-700'}`}>{label}</label>
    </div>
  );

  return (
    <section>
      <button
        onClick={onToggleAdvanced}
        className={`w-full flex justify-between items-center text-left text-sm font-semibold font-mono uppercase tracking-widest mt-3 p-3 rounded-md border transition-all cursor-pointer ${theme === 'dark'
          ? 'text-neutral-400 bg-neutral-800/30 border-neutral-700/50 hover:border-neutral-600/80'
          : 'text-neutral-700 bg-neutral-100 border-neutral-300 hover:border-neutral-400'
          }`}
      >
        <div className="flex items-center gap-2">
          <Sliders size={16} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
          <span>{t('mockup.refine')}</span>
        </div>
        {isAdvancedOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isAdvancedOpen && (
        <div id="advanced-options-content" className="space-y-4">
          <AdvancedOptions {...advancedOptionsProps} />

          <div className="flex flex-col sm:flex-row gap-2">
            {designType !== 'blank' && (
              <ToggleItem
                value={generateText}
                onChange={onGenerateTextChange}
                label={t('mockup.generateContextualText')}
                className="flex-1"
              />
            )}
            <ToggleItem
              value={withHuman}
              onChange={onWithHumanChange}
              label={t('mockup.includeHumanInteraction')}
              className={designType !== 'blank' ? 'flex-1' : 'w-full'}
            />
            <ToggleItem
              value={enhanceTexture}
              onChange={onEnhanceTextureChange}
              label={t('mockup.enhanceTexture')}
              className={designType !== 'blank' ? 'flex-1' : 'w-full'}
            />
          </div>
        </div>
      )}
    </section>
  );
};


