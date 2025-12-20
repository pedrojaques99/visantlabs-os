import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AdvancedOptions } from './AdvancedOptions';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../hooks/useTheme';

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
      <h2 className={`text-sm font-semibold font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>{t('mockup.refine')}</h2>
      
      <button 
        onClick={onToggleAdvanced} 
        className={`w-full flex justify-between items-center text-left text-sm font-semibold font-mono uppercase tracking-widest mt-3 p-3 rounded-md border transition-all cursor-pointer ${
          theme === 'dark'
            ? 'text-zinc-400 bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600/80'
            : 'text-zinc-700 bg-zinc-100 border-zinc-300 hover:border-zinc-400'
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


