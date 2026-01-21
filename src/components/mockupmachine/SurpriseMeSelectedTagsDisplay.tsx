import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useMockup } from './MockupContext';
import { Tag } from '../shared/Tag';
import { translateTag } from '@/utils/localeUtils';

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
        selectedColors
    } = useMockup();

    // Check if we have any tags to display
    const hasTags =
        selectedTags.length > 0 ||
        selectedLocationTags.length > 0 ||
        selectedAngleTags.length > 0 ||
        selectedLightingTags.length > 0 ||
        selectedEffectTags.length > 0 ||
        selectedMaterialTags.length > 0 ||
        selectedColors.length > 0;

    if (!hasTags) return null;

    const allTags: { tag: string; isColor: boolean }[] = [
        ...selectedTags.map((tag) => ({ tag, isColor: false })),
        ...selectedLocationTags.map((tag) => ({ tag, isColor: false })),
        ...selectedAngleTags.map((tag) => ({ tag, isColor: false })),
        ...selectedLightingTags.map((tag) => ({ tag, isColor: false })),
        ...selectedEffectTags.map((tag) => ({ tag, isColor: false })),
        ...selectedMaterialTags.map((tag) => ({ tag, isColor: false })),
        ...selectedColors.map((tag) => ({ tag, isColor: true }))
    ];

    return (
        <div className={`
            rounded-xl p-4 animate-fade-in transition-all duration-300
            ${theme === 'dark'
                ? 'bg-neutral-900/30'
                : 'bg-neutral-50/50'}
        `}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 opacity-70">
                <h3 className={`text-[10px] font-mono uppercase tracking-widest font-medium ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {t('mockup.generationConfig')}
                </h3>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {allTags.map(({ tag, isColor }) => (
                    <Tag
                        key={isColor ? `color-${tag}` : tag}
                        label={!isColor ? translateTag(tag) : tag}
                        selected={true}
                        className="text-neutral-500 bg-neutral-800/50 border-neutral-700/50 shadow-sm shadow-neutral-800/50 hover:border-neutral-600 hover:text-neutral-400"
                        size="sm"
                    />
                ))}
            </div>
        </div>
    );
};
