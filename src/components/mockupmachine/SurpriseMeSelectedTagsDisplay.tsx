
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
        selectedColors,
        isSurpriseMeMode
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

    const renderTagGroup = (titleKey: string, tags: string[], isColor = false) => {
        if (tags.length === 0) return null;

        return (
            <div className="flex flex-col gap-2 min-w-0">
                <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                        <Tag
                            key={tag}
                            label={!isColor ? translateTag(tag) : tag}
                            selected={true}
                            // Make them non-interactive as this is a display summary
                            className={isColor ? 'font-mono' : ''}
                            size="sm"
                        >
                            {isColor && (
                                <div
                                    className="w-3 h-3 rounded-full border border-white/20 mr-1"
                                    style={{ backgroundColor: tag }}
                                />
                            )}
                        </Tag>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className={`
            rounded-xl p-4 animate-fade-in transition-all duration-300
            ${theme === 'dark'
                ? 'bg-neutral-900/30'
                : 'bg-neutral-50/50'}
        `}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 opacity-70">
                <h3 className={`text-[8px] font-mono uppercase tracking-widest font-medium ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {t('mockup.generationConfig')}
                </h3>
            </div>

            <div className="grid gap-2 justify-items-center text-[8px]">
                {renderTagGroup('mockup.categories', selectedTags)}
                {renderTagGroup('mockup.location', selectedLocationTags)}
                {renderTagGroup('mockup.cameraAngle', selectedAngleTags)}
                {renderTagGroup('mockup.lightingMood', selectedLightingTags)}
                {renderTagGroup('mockup.visualEffects', selectedEffectTags)}
                {renderTagGroup('mockup.material', selectedMaterialTags)}
                {renderTagGroup('mockup.colors', selectedColors, true)}
            </div>
        </div>
    );
};
