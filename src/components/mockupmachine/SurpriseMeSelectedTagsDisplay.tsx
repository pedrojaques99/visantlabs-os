import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useMockup } from './MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';
import { translateTag } from '@/utils/localeUtils';
import { Dices, Shuffle, ChevronDown, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type SectionKey = 'categories' | 'location' | 'angle' | 'lighting' | 'effects' | 'material';

const SECTIONS: { key: SectionKey; labelKey: string }[] = [
  { key: 'categories', labelKey: 'mockup.categories' },
  { key: 'location', labelKey: 'mockup.location' },
  { key: 'angle', labelKey: 'mockup.cameraAngle' },
  { key: 'lighting', labelKey: 'mockup.lightingMood' },
  { key: 'effects', labelKey: 'mockup.visualEffects' },
  { key: 'material', labelKey: 'mockup.material' },
];

// Internal/metadata tags that should not be displayed
const INTERNAL_TAGS = [
  'human interaction',
  'gerar texto contextual',
  'generate contextual text',
  'generate text',
  'gerar texto',
  'texto contextual',
  'contextual text',
  'placeholder text',
  'texto placeholder',
  'include human',
  'with human',
  'sem interação humana',
  'no human interaction',
  'no text',
  'sem texto',
].map(tag => tag.toLowerCase());

/**
 * Checks if a tag is an internal/metadata tag
 */
const isInternalTag = (tag: string): boolean => {
  const lowerTag = tag.toLowerCase();
  return INTERNAL_TAGS.some(internal => lowerTag.includes(internal));
};

/**
 * Filters out internal/metadata tags
 */
const filterValidTags = (tags: string[]): string[] => {
  return tags.filter(tag => !isInternalTag(tag));
};

interface TagDropdownProps {
  selectedTag: string | null;
  availableTags: string[];
  onSelect: (tag: string) => void;
  placeholder: string;
  theme: string;
}

const TagDropdown: React.FC<TagDropdownProps> = ({
  selectedTag,
  availableTags,
  onSelect,
  placeholder,
  theme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (tag: string) => {
    onSelect(tag);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      handleSelect(searchQuery.trim());
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const filteredTags = availableTags.filter(tag =>
    tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
    translateTag(tag).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showCustomOption = searchQuery.trim() &&
    !filteredTags.some(tag =>
      tag.toLowerCase() === searchQuery.toLowerCase() ||
      translateTag(tag).toLowerCase() === searchQuery.toLowerCase()
    );

  return (
    <div ref={dropdownRef} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-mono transition-all duration-200 border",
          selectedTag
            ? theme === 'dark'
              ? 'bg-neutral-800/60 text-neutral-400 border-neutral-700/50 hover:border-neutral-600'
              : 'bg-white text-brand-cyan border-brand-cyan/40 hover:border-brand-cyan/60'
            : theme === 'dark'
              ? 'bg-neutral-800/40 text-neutral-500 border-neutral-700/50 hover:border-neutral-600'
              : 'bg-neutral-100 text-neutral-500 border-neutral-300 hover:border-neutral-400'
        )}
      >
        <span className="truncate">
          {selectedTag ? translateTag(selectedTag) : placeholder}
        </span>
        <ChevronDown
          size={12}
          className={cn(
            "shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full rounded-lg border shadow-lg animate-fade-in overflow-hidden",
            theme === 'dark'
              ? 'bg-neutral-900 border-neutral-700/50'
              : 'bg-white border-neutral-200'
          )}
        >
          {/* Search Input */}
          <div className={cn(
            "p-1.5 border-b",
            theme === 'dark' ? 'border-neutral-700/50' : 'border-neutral-200'
          )}>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pesquisar ou digitar..."
              className={cn(
                "w-full px-2 py-1 text-[10px] font-mono rounded border-none outline-none",
                theme === 'dark'
                  ? 'bg-neutral-800/60 text-neutral-300 placeholder:text-neutral-600'
                  : 'bg-neutral-100 text-neutral-700 placeholder:text-neutral-400'
              )}
            />
          </div>

          {/* Options List */}
          <div className="max-h-40 overflow-y-auto">
            {/* Custom tag option */}
            {showCustomOption && (
              <button
                type="button"
                onClick={() => handleSelect(searchQuery.trim())}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-mono text-left transition-colors",
                  theme === 'dark'
                    ? 'text-brand-cyan hover:bg-neutral-800'
                    : 'text-brand-cyan hover:bg-neutral-100'
                )}
              >
                <Plus size={10} className="shrink-0" />
                <span className="truncate">Adicionar "{searchQuery.trim()}"</span>
              </button>
            )}

            {/* Filtered tags */}
            {filteredTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleSelect(tag)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-[10px] font-mono text-left transition-colors",
                  tag === selectedTag
                    ? theme === 'dark'
                      ? 'bg-brand-cyan/10 text-brand-cyan'
                      : 'bg-brand-cyan/10 text-brand-cyan'
                    : theme === 'dark'
                      ? 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'
                )}
              >
                <span className="truncate">{translateTag(tag)}</span>
                {tag === selectedTag && <Check size={10} className="shrink-0 text-brand-cyan" />}
              </button>
            ))}

            {/* Empty state */}
            {filteredTags.length === 0 && !showCustomOption && (
              <div className={cn(
                "px-2.5 py-2 text-[10px] font-mono text-center",
                theme === 'dark' ? 'text-neutral-600' : 'text-neutral-400'
              )}>
                Nenhuma tag encontrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ToggleCheckboxProps {
  value: boolean;
  onChange: (val: boolean) => void;
  label: string;
  theme: string;
}

const ToggleCheckbox: React.FC<ToggleCheckboxProps> = ({ value, onChange, label, theme }) => (
  <div
    className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer border transition-all duration-200",
      theme === 'dark'
        ? 'bg-neutral-800/40 border-neutral-700/40 hover:bg-neutral-800/60'
        : 'bg-neutral-100 border-neutral-200 hover:bg-neutral-200'
    )}
    onClick={() => onChange(!value)}
  >
    <div
      className={cn(
        "w-3.5 h-3.5 rounded flex items-center justify-center border transition-all duration-200",
        value
          ? 'bg-brand-cyan/80 border-brand-cyan'
          : theme === 'dark'
            ? 'bg-neutral-700 border-neutral-600'
            : 'bg-white border-neutral-400'
      )}
    >
      {value && (
        <Check size={10} className="text-black" strokeWidth={3} />
      )}
    </div>
    <label className={cn(
      "text-[10px] font-mono select-none cursor-pointer",
      theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
    )}>
      {label}
    </label>
  </div>
);

export const SurpriseMeSelectedTagsDisplay: React.FC<{ onRerollAll?: () => void }> = ({ onRerollAll }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const {
    selectedTags,
    selectedLocationTags,
    selectedAngleTags,
    selectedLightingTags,
    selectedEffectTags,
    selectedMaterialTags,
    isSurpriseMeMode,
    generateText,
    withHuman,
    enhanceTexture,
    // Setters
    setSelectedTags,
    setSelectedLocationTags,
    setSelectedAngleTags,
    setSelectedLightingTags,
    setSelectedEffectTags,
    setSelectedMaterialTags,
    setGenerateText,
    setWithHuman,
    setEnhanceTexture,
  } = useMockup();

  const {
    availableMockupTags,
    availableLocationTags,
    availableAngleTags,
    availableLightingTags,
    availableEffectTags,
    availableMaterialTags,
  } = useMockupTags();

  // Filter tags
  const sectionData: Record<SectionKey, string[]> = {
    categories: filterValidTags(selectedTags),
    location: filterValidTags(selectedLocationTags),
    angle: filterValidTags(selectedAngleTags),
    lighting: filterValidTags(selectedLightingTags),
    effects: filterValidTags(selectedEffectTags),
    material: filterValidTags(selectedMaterialTags),
  };

  const availableTagsMap: Record<SectionKey, string[]> = {
    categories: availableMockupTags,
    location: availableLocationTags,
    angle: availableAngleTags,
    lighting: availableLightingTags,
    effects: availableEffectTags,
    material: availableMaterialTags,
  };

  const settersMap: Record<SectionKey, (tags: string[]) => void> = {
    categories: setSelectedTags,
    location: setSelectedLocationTags,
    angle: setSelectedAngleTags,
    lighting: setSelectedLightingTags,
    effects: setSelectedEffectTags,
    material: setSelectedMaterialTags,
  };

  const handleRerollAll = () => {
    if (onRerollAll) {
      onRerollAll();
    }
  };

  // Clean up internal tags from state when detected
  useEffect(() => {
    const cleanInternalTags = (
      tags: string[],
      setter: (tags: string[]) => void
    ) => {
      const filtered = tags.filter(tag => !isInternalTag(tag));
      if (filtered.length !== tags.length) {
        setter(filtered);
      }
    };

    cleanInternalTags(selectedTags, setSelectedTags);
    cleanInternalTags(selectedLocationTags, setSelectedLocationTags);
    cleanInternalTags(selectedAngleTags, setSelectedAngleTags);
    cleanInternalTags(selectedLightingTags, setSelectedLightingTags);
    cleanInternalTags(selectedEffectTags, setSelectedEffectTags);
    cleanInternalTags(selectedMaterialTags, setSelectedMaterialTags);
  }, [
    selectedTags,
    selectedLocationTags,
    selectedAngleTags,
    selectedLightingTags,
    selectedEffectTags,
    selectedMaterialTags,
    setSelectedTags,
    setSelectedLocationTags,
    setSelectedAngleTags,
    setSelectedLightingTags,
    setSelectedEffectTags,
    setSelectedMaterialTags,
  ]);

  const handleTagSelect = (sectionKey: SectionKey, tag: string) => {
    const setter = settersMap[sectionKey];
    if (setter) {
      setter([tag]);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl p-3 animate-fade-in transition-all duration-300",
        theme === 'dark' ? 'bg-neutral-900/20' : 'bg-neutral-50/40',
        "border",
        theme === 'dark' ? 'border-neutral-800/40' : 'border-neutral-200/60'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <h3
          className={cn(
            "text-[10px] font-mono uppercase tracking-widest font-medium",
            theme === 'dark' ? 'text-neutral-500' : 'text-neutral-500'
          )}
        >
          {t('mockup.generationConfig')}
        </h3>
        {isSurpriseMeMode && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-cyan/10 border border-brand-cyan/20">
            <Dices size={10} className="text-brand-cyan/80" />
            <span className="text-[9px] font-mono text-brand-cyan/90 uppercase">Director</span>
          </span>
        )}
        {isSurpriseMeMode && onRerollAll && (
          <button
            onClick={handleRerollAll}
            className="ml-auto p-1.5 rounded-full hover:bg-neutral-800 transition-all duration-200 group/reroll"
            title="Sortear tudo novamente (Shuffle All)"
          >
            <Shuffle size={14} className="text-neutral-500 group-hover/reroll:text-brand-cyan group-hover/reroll:rotate-180 transition-all duration-500" />
          </button>
        )}
      </div>

      {/* Tag Dropdowns - 2 column grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {SECTIONS.map(({ key, labelKey }) => {
          const tags = sectionData[key];
          const availableTags = availableTagsMap[key];
          const selectedTag = tags.length > 0 ? tags[0] : null;

          return (
            <div key={key} className="flex flex-col gap-1">
              <span
                className={cn(
                  "text-[9px] font-mono uppercase tracking-wider",
                  theme === 'dark' ? 'text-neutral-600' : 'text-neutral-400'
                )}
              >
                {t(labelKey)}:
              </span>
              <TagDropdown
                selectedTag={selectedTag}
                availableTags={availableTags}
                onSelect={(tag) => handleTagSelect(key, tag)}
                placeholder={t('mockup.selectOption') || 'Select...'}
                theme={theme}
              />
            </div>
          );
        })}
      </div>

      {/* Checkboxes */}
      <div className="flex flex-wrap gap-2">
        <ToggleCheckbox
          value={generateText}
          onChange={setGenerateText}
          label={t('mockup.generateContextualText')}
          theme={theme}
        />
        <ToggleCheckbox
          value={withHuman}
          onChange={setWithHuman}
          label={t('mockup.includeHumanInteraction')}
          theme={theme}
        />
        <ToggleCheckbox
          value={enhanceTexture}
          onChange={setEnhanceTexture}
          label={t('mockup.enhanceTexture')}
          theme={theme}
        />
      </div>
    </div>
  );
};
