import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useMockup } from './MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';
import { Tag } from '../shared/Tag';
import { translateTag } from '@/utils/localeUtils';
import { Dices, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';

type SectionKey = 'categories' | 'location' | 'angle' | 'lighting' | 'effects' | 'material' | 'colors';

const SECTIONS: { key: SectionKey; labelKey: string; isColor: boolean }[] = [
  { key: 'categories', labelKey: 'mockup.categories', isColor: false },
  { key: 'location', labelKey: 'mockup.location', isColor: false },
  { key: 'angle', labelKey: 'mockup.cameraAngle', isColor: false },
  { key: 'lighting', labelKey: 'mockup.lightingMood', isColor: false },
  { key: 'effects', labelKey: 'mockup.visualEffects', isColor: false },
  { key: 'material', labelKey: 'mockup.material', isColor: false },
  { key: 'colors', labelKey: 'mockup.colorPalette', isColor: true },
];

export const SurpriseMeSelectedTagsDisplay: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const {
    selectedTags,
    selectedLocationTags,
    selectedAngleTags,
    selectedLightingTags,
    selectedEffectTags,
    selectedMaterialTags,
    selectedColors,
    isSurpriseMeMode,
    // Setters
    setSelectedTags,
    setSelectedLocationTags,
    setSelectedAngleTags,
    setSelectedLightingTags,
    setSelectedEffectTags,
    setSelectedMaterialTags,
    setSelectedColors,
  } = useMockup();

  const {
    availableMockupTags,
    availableLocationTags,
    availableAngleTags,
    availableLightingTags,
    availableEffectTags,
    availableMaterialTags,
  } = useMockupTags();

  const sectionData: Record<SectionKey, string[]> = {
    categories: selectedTags,
    location: selectedLocationTags,
    angle: selectedAngleTags,
    lighting: selectedLightingTags,
    effects: selectedEffectTags,
    material: selectedMaterialTags,
    colors: selectedColors,
  };

  const availableTagsMap: Record<SectionKey, string[]> = {
    categories: availableMockupTags,
    location: availableLocationTags,
    angle: availableAngleTags,
    lighting: availableLightingTags,
    effects: availableEffectTags,
    material: availableMaterialTags,
    colors: [], // Colors handled differently if needed, or skipped for now
  };

  const settersMap: Record<SectionKey, (tags: string[]) => void> = {
    categories: setSelectedTags,
    location: setSelectedLocationTags,
    angle: setSelectedAngleTags,
    lighting: setSelectedLightingTags,
    effects: setSelectedEffectTags,
    material: setSelectedMaterialTags,
    colors: setSelectedColors,
  };

  const handleRerollTag = (sectionKey: SectionKey, currentTag: string) => {
    if (sectionKey === 'colors') return; // Skip colors for now

    const pool = availableTagsMap[sectionKey];
    if (!pool || pool.length <= 1) return;

    // Filter out current tag to ensure change
    const candidates = pool.filter(t => t !== currentTag);
    if (candidates.length === 0) return;

    const randomNewTag = candidates[Math.floor(Math.random() * candidates.length)];
    const setter = settersMap[sectionKey];

    if (setter) {
      setter([randomNewTag]);
    }
  };

  const groups = SECTIONS.filter(({ key }) => sectionData[key].length > 0);

  if (groups.length === 0) return null;

  return (
    <div
      className={`
        rounded-xl p-3 animate-fade-in transition-all duration-300
        ${theme === 'dark' ? 'bg-neutral-900/20' : 'bg-neutral-50/40'}
        border ${theme === 'dark' ? 'border-neutral-800/40' : 'border-neutral-200/60'}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <h3
          className={`text-[10px] font-mono uppercase tracking-widest font-medium ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-500'
            }`}
        >
          {t('mockup.generationConfig')}
        </h3>
        {isSurpriseMeMode && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-cyan/10 border border-brand-cyan/20">
            <Dices size={10} className="text-brand-cyan/80" />
            <span className="text-[9px] font-mono text-brand-cyan/90 uppercase">Director</span>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {groups.map(({ key, labelKey, isColor }) => {
          const tags = sectionData[key];
          if (tags.length === 0) return null;
          return (
            <div key={key} className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-[9px] font-mono uppercase tracking-wider mr-1 shrink-0 ${theme === 'dark' ? 'text-neutral-600' : 'text-neutral-400'
                  }`}
              >
                {t(labelKey)}:
              </span>
              {tags.map((tag) => (
                <div
                  key={isColor ? `color-${tag}` : tag}
                  className="group relative"
                  onClick={() => !isColor && handleRerollTag(key, tag)}
                  title={!isColor ? "Clique para sortear outra opção (Reroll)" : ""}
                >
                  <Tag
                    label={!isColor ? translateTag(tag) : tag}
                    selected={true}
                    size="sm"
                    className={cn(
                      "text-[10px] border transition-all duration-200 cursor-pointer pr-6",
                      "hover:border-brand-cyan/70 hover:text-brand-cyan hover:shadow-sm hover:scale-105",
                      theme === 'dark'
                        ? 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50 hover:bg-neutral-800'
                        : 'bg-white/80 text-neutral-600 border-neutral-200 hover:bg-white'
                    )}
                  >
                    {isColor ? (
                      <div
                        className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: tag }}
                      />
                    ) : (
                      <>
                        <Shuffle
                          size={10}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-brand-cyan"
                        />
                      </>
                    )}
                  </Tag>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
