import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
    designType: DesignType | null;
    suggestedLocationTags: string[];
    suggestedAngleTags: string[];
    suggestedLightingTags: string[];
    suggestedEffectTags: string[];
    suggestedMaterialTags: string[];
    suggestedColors: string[];
  };
}

export const RefineSection: React.FC<RefineSectionProps> = ({
  isAdvancedOpen,
  onToggleAdvanced,
  advancedOptionsProps
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <section>
      <h2 className={`text-sm font-semibold font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>{t('mockup.refine')}</h2>

      <button
        onClick={onToggleAdvanced}
        className={`w-full flex justify-between items-center text-left text-sm font-semibold font-mono uppercase tracking-widest mt-3 p-3 rounded-md border transition-all cursor-pointer ${theme === 'dark'
          ? 'text-neutral-400 bg-neutral-800/30 border-neutral-700/50 hover:border-neutral-600/80'
          : 'text-neutral-700 bg-neutral-100 border-neutral-300 hover:border-neutral-400'
          }`}
      >
        <span>{t('mockup.advancedOptions')}</span>
        {isAdvancedOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isAdvancedOpen && (
        <div id="advanced-options-content">
          <AdvancedOptions {...advancedOptionsProps} />
        </div>
      )}
    </section>
  );
};


