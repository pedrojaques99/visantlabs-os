import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Sliders, Palette as PaletteIcon, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdvancedOptions } from './AdvancedOptions';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import type { DesignType } from '@/types/types';
import { SkeletonText } from '@/components/ui/SkeletonLoader';
import { Button } from '@/components/ui/button'
import { MicroTitle } from '@/components/ui/MicroTitle'


interface RefineSectionProps {
  isAdvancedOpen: boolean;
  onToggleAdvanced: () => void;
  isGenerating?: boolean;
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
    onRemoveTextChange: (value: boolean) => void;
    designType: DesignType;
    generateText: boolean;
    withHuman: boolean;
    enhanceTexture: boolean;
    removeText: boolean;
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
  isGenerating = false,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const {
    designType,
    generateText,
    withHuman,
    enhanceTexture,
    removeText,
    onGenerateTextChange,
    onWithHumanChange,
    onEnhanceTextureChange,
    onRemoveTextChange,
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
      className={cn(
        `flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer border transition-all duration-200 ${className}`,
        theme === 'dark'
          ? 'bg-neutral-800/40 border-neutral-700/40 hover:bg-neutral-800/60'
          : 'bg-neutral-100 border-neutral-200 hover:bg-neutral-200'
      )}
      onClick={() => onChange(!value)}
    >
      <div
        className={cn(
          "w-3.5 h-3.5 rounded flex items-center justify-center border transition-all duration-200 shrink-0",
          value
            ? 'bg-brand-cyan/80 border-brand-cyan'
            : theme === 'dark'
              ? 'bg-neutral-700 border-neutral-600'
              : 'bg-white border-neutral-400'
        )}
      >
        {value && (
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-black">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <SkeletonText loading={isGenerating} className="min-w-0">
        <label className={cn(
          "text-[10px] font-mono select-none cursor-pointer",
          theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
        )}>
          {label}
        </label>
      </SkeletonText>
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
        <AdvancedOptions {...advancedOptionsProps} isGenerating={isGenerating} />

        {/* Color Palette Panel (collapsible) */}
        <div className={`mt-2 rounded-xl border transition-all duration-200 overflow-hidden ${theme === 'dark' ? 'bg-neutral-900/30 border-white/5' : 'bg-white/50 border-neutral-200'}`}>
          <Button variant="ghost" onClick={() => setIsColorPaletteExpanded(!isColorPaletteExpanded)}
            className={`w-full flex justify-between items-center text-left p-3 transition-all duration-200 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-100/50'}`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <PaletteIcon size={14} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'} />
              <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                <SkeletonText loading={isGenerating}>
                  <span className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>
                    {t('mockup.colorPalette')}
                  </span>
                </SkeletonText>
                {!isColorPaletteExpanded && selectedColors.length > 0 && (
                  <span className="text-[10px] font-mono truncate max-w-[200px] text-brand-cyan">
                    {selectedColors.map(color => color).join(', ')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <SkeletonText loading={isGenerating}>
                <span className={`text-[10px] font-mono ${theme === 'dark' ? 'text-neutral-600' : 'text-neutral-500'}`}>
                  {selectedColors.length}/{5}
                </span>
              </SkeletonText>
              {isColorPaletteExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
            </div>
          </Button>

          {isColorPaletteExpanded && (
            <div className="p-3 pt-0 animate-fade-in">
              {/* Selected Colors */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedColors.map(color => (
                  <div
                    key={color}
                    onClick={() => onRemoveColor(color)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border cursor-pointer transition-all duration-200 text-[10px] font-mono group ${theme === 'dark'
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
                    <Button variant="ghost" onClick={() => colorPickerRef.current?.click()}
                      className={`flex items-center justify-center w-8 h-8 rounded-md border-2 border-dashed transition-all duration-200 ${theme === 'dark'
                        ? 'border-neutral-700/40 text-neutral-400 hover:border-brand-cyan/50 hover:text-brand-cyan hover:bg-neutral-800/50'
                        : 'border-neutral-300 text-neutral-500 hover:border-brand-cyan/50 hover:text-brand-cyan hover:bg-neutral-100'
                        }`}
                      title="Add new color"
                    >
                      <Plus size={14} />
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
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
            value={removeText}
            onChange={onRemoveTextChange}
            label={t('mockup.removeText') || 'Remover texto'}
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


