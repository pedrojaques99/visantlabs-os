import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Sliders, Palette as PaletteIcon, X, Plus } from 'lucide-react';
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
    onEnhanceTextureChange,
    selectedColors,
    suggestedColors,
    colorInput,
    isValidColor,
    onColorInputChange,
    onAddColor,
    onRemoveColor,
  } = advancedOptionsProps;

  const colorPickerRef = useRef<HTMLInputElement>(null);
  const [isColorPaletteExpanded, setIsColorPaletteExpanded] = useState(false);

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

  // Integrate with external color palettes (branding)
  useEffect(() => {
    const handlePaletteColorSelected = (event: Event) => {
      const customEvent = event as CustomEvent;
      const color =
        typeof customEvent.detail === 'string'
          ? customEvent.detail
          : customEvent.detail?.color;

      if (!color) return;

      // Open advanced panel if closed so user can edit colors freely
      if (!isAdvancedOpen) {
        onToggleAdvanced();
      }

      // Expand color palette panel
      if (!isColorPaletteExpanded) {
        setIsColorPaletteExpanded(true);
      }

      // Add the selected color into the advanced options
      onColorInputChange({
        target: { value: color },
      } as React.ChangeEvent<HTMLInputElement>);
      onAddColor();

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          const el = document.getElementById('advanced-options-content');
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    };

    const handleOpenColorPicker = () => {
      if (!isAdvancedOpen) {
        onToggleAdvanced();
      }
      // Expand color palette panel
      if (!isColorPaletteExpanded) {
        setIsColorPaletteExpanded(true);
      }
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          const el = document.getElementById('advanced-options-content');
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(
        'mockup:paletteColorSelected',
        handlePaletteColorSelected as EventListener
      );
      window.addEventListener(
        'mockup:openColorPicker',
        handleOpenColorPicker as EventListener
      );
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(
          'mockup:paletteColorSelected',
          handlePaletteColorSelected as EventListener
        );
        window.removeEventListener(
          'mockup:openColorPicker',
          handleOpenColorPicker as EventListener
        );
      }
    };
  }, [isAdvancedOpen, isColorPaletteExpanded, onToggleAdvanced, onColorInputChange, onAddColor]);

  return (
    <section>
      <div id="advanced-options-content" className="space-y-4">
        <AdvancedOptions {...advancedOptionsProps} />

        {/* Color Palette Panel (collapsible) */}
        <div className={`mt-2 rounded-xl border transition-all duration-200 overflow-hidden ${theme === 'dark' ? 'bg-neutral-900/30 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
          <button
            onClick={() => setIsColorPaletteExpanded(!isColorPaletteExpanded)}
            className={`w-full flex justify-between items-center text-left p-3 transition-all duration-200 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-100/50'}`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <PaletteIcon size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
              <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                <span className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>
                  {t('mockup.colorPalette')}
                </span>
                {!isColorPaletteExpanded && selectedColors.length > 0 && (
                  <span className="text-[10px] font-mono truncate max-w-[200px] text-brand-cyan">
                    {selectedColors.map(color => color).join(', ')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[10px] font-mono ${theme === 'dark' ? 'text-neutral-600' : 'text-neutral-500'}`}>
                {selectedColors.length}/{5}
              </span>
              {isColorPaletteExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
            </div>
          </button>

          {isColorPaletteExpanded && (
            <div className="p-3 pt-0 animate-fade-in">
              {/* Selected Colors */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedColors.map(color => (
                  <div
                    key={color}
                    onClick={() => onRemoveColor(color)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border cursor-pointer transition-all duration-200 text-[9px] font-mono group ${theme === 'dark'
                        ? 'border-neutral-700/40 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600'
                        : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 hover:border-neutral-400'
                      }`}
                    title={`Click to remove: ${color}`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-white/10" style={{ backgroundColor: color }} />
                    <span className="truncate max-w-[72px]">{color}</span>
                    <X size={10} className={`opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`} />
                  </div>
                ))}

                {/* Suggested Colors */}
                {suggestedColors.slice(0, Math.max(0, 5 - selectedColors.length)).map(color => {
                  const isSelected = selectedColors.includes(color);
                  if (isSelected) return null;

                  return (
                    <div
                      key={color}
                      onClick={() => {
                        if (selectedColors.length < 5 && !selectedColors.includes(color)) {
                          onColorInputChange({
                            target: { value: color },
                          } as React.ChangeEvent<HTMLInputElement>);
                          onAddColor();
                        }
                      }}
                      className={`w-4 h-4 rounded-full border cursor-pointer transition-all duration-200 ${selectedColors.length >= 5
                          ? 'opacity-50 cursor-not-allowed'
                          : theme === 'dark'
                            ? 'border-neutral-700/40 hover:border-neutral-500 hover:scale-110'
                            : 'border-neutral-300 hover:border-neutral-400 hover:scale-110'
                        }`}
                      style={{ backgroundColor: color }}
                      title={selectedColors.length >= 5 ? 'Maximum 5 colors reached' : `Click to add: ${color}`}
                    />
                  );
                })}

                {/* Add New Color Button */}
                {selectedColors.length < 5 && (
                  <>
                    <input
                      ref={colorPickerRef}
                      type="color"
                      onChange={(e) => {
                        const color = e.target.value.toUpperCase();
                        onColorInputChange({
                          target: { value: color },
                        } as React.ChangeEvent<HTMLInputElement>);
                        onAddColor();
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => colorPickerRef.current?.click()}
                      className={`flex items-center justify-center w-8 h-8 rounded-md border-2 border-dashed transition-all duration-200 ${theme === 'dark'
                          ? 'border-neutral-700/40 text-neutral-400 hover:border-brand-cyan/50 hover:text-brand-cyan hover:bg-neutral-800/50'
                          : 'border-neutral-300 text-neutral-500 hover:border-brand-cyan/50 hover:text-brand-cyan hover:bg-neutral-100'
                        }`}
                      title="Add new color"
                    >
                      <Plus size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {true && (
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
            className={'flex-1'}
          />
          <ToggleItem
            value={enhanceTexture}
            onChange={onEnhanceTextureChange}
            label={t('mockup.enhanceTexture')}
            className={'flex-1'}
          />
        </div>
      </div>
    </section>
  );
};


