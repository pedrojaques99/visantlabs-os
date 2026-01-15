import { useCallback, useEffect, useState } from 'react';
import { MockupPreset } from '../types/mockupPresets.js';
import { useMockup } from '../components/mockupmachine/MockupContext';
import {
    AVAILABLE_TAGS,
    AVAILABLE_BRANDING_TAGS, // Fallback
    AVAILABLE_LOCATION_TAGS,
    AVAILABLE_ANGLE_TAGS,
    AVAILABLE_LIGHTING_TAGS,
    AVAILABLE_EFFECT_TAGS,
    AVAILABLE_MATERIAL_TAGS
} from '@/utils/mockupConstants';
import { brandingPresetsService } from '@/services/brandingPresetsService';
import { effectPresetsService } from '@/services/effectPresetsService';
import { mockupPresetsService } from '@/services/mockupPresetsService';
import { anglePresetsService } from '@/services/anglePresetsService';
import { ambiencePresetsService } from '@/services/ambiencePresetsService';
import { luminancePresetsService } from '@/services/luminancePresetsService';
import { texturePresetsService } from '@/services/texturePresetsService';
import { mockupTagService, MockupTagCategory } from '@/services/mockupTagService';

export const useMockupTags = () => {
    const {
        selectedTags, setSelectedTags,
        selectedBrandingTags, setSelectedBrandingTags,
        selectedLocationTags, setSelectedLocationTags,
        selectedAngleTags, setSelectedAngleTags,
        selectedLightingTags, setSelectedLightingTags,
        selectedEffectTags, setSelectedEffectTags,
        selectedMaterialTags, setSelectedMaterialTags,
        customBrandingInput, setCustomBrandingInput,
        customCategoryInput, setCustomCategoryInput,
        customLocationInput, setCustomLocationInput,
        customAngleInput, setCustomAngleInput,
        customLightingInput, setCustomLightingInput,
        customEffectInput, setCustomEffectInput,
        customMaterialInput, setCustomMaterialInput,
    } = useMockup();

    // Dynamic Tag State
    const [availableBrandingTags, setAvailableBrandingTags] = useState<string[]>(AVAILABLE_BRANDING_TAGS);
    const [availableMockupTags, setAvailableMockupTags] = useState<string[]>(AVAILABLE_TAGS);
    const [availableLocationTags, setAvailableLocationTags] = useState<string[]>(AVAILABLE_LOCATION_TAGS);
    const [availableAngleTags, setAvailableAngleTags] = useState<string[]>(AVAILABLE_ANGLE_TAGS);
    const [availableLightingTags, setAvailableLightingTags] = useState<string[]>(AVAILABLE_LIGHTING_TAGS);
    const [availableEffectTags, setAvailableEffectTags] = useState<string[]>(AVAILABLE_EFFECT_TAGS);
    const [availableMaterialTags, setAvailableMaterialTags] = useState<string[]>(AVAILABLE_MATERIAL_TAGS);
    const [mockupPresets, setMockupPresets] = useState<MockupPreset[]>([]);
    const [tagCategories, setTagCategories] = useState<MockupTagCategory[]>([]);

    // Fetch dynamic tags on mount
    useEffect(() => {
        const fetchTags = async () => {
            try {
                // Fetch all presets in parallel
                const [
                    brandingPresets,
                    mockupPresets,
                    anglePresets,
                    ambiencePresets,
                    luminancePresets,
                    effectPresets,
                    texturePresets,
                    dynamicMockupPresets,
                    dynamicTagCategories
                ] = await Promise.all([
                    brandingPresetsService.getAllAsync(),
                    mockupPresetsService.getCategoriesAsync(), // Use new categorized method
                    anglePresetsService.getAllAsync(),
                    ambiencePresetsService.getAllAsync(),
                    luminancePresetsService.getAllAsync(),
                    effectPresetsService.getAllAsync(),
                    texturePresetsService.getAllAsync(),
                    mockupPresetsService.getCategoriesAsync(),
                    mockupTagService.getCategoriesAsync()
                ]);

                if (brandingPresets.length > 0) {
                    setAvailableBrandingTags(brandingPresets.map(p => p.name));
                }
                if (dynamicMockupPresets.length > 0) {
                    setMockupPresets(dynamicMockupPresets);
                    const uniqueCategories = Array.from(new Set(dynamicMockupPresets.map(p => p.name))) as string[];
                    setAvailableMockupTags(uniqueCategories);
                }
                if (ambiencePresets.length > 0) {
                    setAvailableLocationTags(ambiencePresets.map(p => p.name));
                }
                if (anglePresets.length > 0) {
                    setAvailableAngleTags(anglePresets.map(p => p.name));
                }
                if (luminancePresets.length > 0) {
                    setAvailableLightingTags(luminancePresets.map(p => p.name));
                }
                if (effectPresets.length > 0) {
                    setAvailableEffectTags(effectPresets.map(p => p.name));
                }
                if (texturePresets.length > 0) {
                    setAvailableMaterialTags(texturePresets.map(p => p.name));
                }

                // Add the new tagCategories result
                if (dynamicTagCategories && dynamicTagCategories.length > 0) {
                    setTagCategories(dynamicTagCategories);
                }

            } catch (error) {
                console.error("Failed to fetch dynamic tags:", error);
                // Keep defaults on error
            }
        };

        fetchTags();
    }, []);

    const scrollToSection = useCallback((sectionId: string) => {
        setTimeout(() => {
            const section = document.getElementById(sectionId);
            const sidebar = document.getElementById('sidebar');
            if (section && sidebar) {
                const sidebarRect = sidebar.getBoundingClientRect();
                const elementRect = section.getBoundingClientRect();
                const relativeTop = elementRect.top - sidebarRect.top + sidebar.scrollTop;

                sidebar.scrollTo({
                    top: relativeTop - 20,
                    behavior: 'smooth'
                });
            }
        }, 150);
    }, []);

    const handleTagToggle = useCallback((tag: string) => {
        const wasEmpty = selectedTags.length === 0;
        setSelectedTags(selectedTags.includes(tag) ? [] : [tag]);

        if (wasEmpty && !selectedTags.includes(tag)) {
            scrollToSection('refine-section');
        }
    }, [selectedTags, setSelectedTags, scrollToSection]);

    const handleBrandingTagToggle = useCallback((tag: string) => {
        const wasEmpty = selectedBrandingTags.length === 0;
        const isAdding = !selectedBrandingTags.includes(tag);

        setSelectedBrandingTags(
            selectedBrandingTags.includes(tag)
                ? selectedBrandingTags.filter(t => t !== tag)
                : [...selectedBrandingTags, tag]
        );

        if (wasEmpty && isAdding) {
            scrollToSection('categories-section');
        }
    }, [selectedBrandingTags, setSelectedBrandingTags, scrollToSection]);

    const handleLocationTagToggle = useCallback((tag: string) =>
        setSelectedLocationTags(selectedLocationTags.includes(tag) ? [] : [tag]),
        [selectedLocationTags, setSelectedLocationTags]
    );

    const handleAngleTagToggle = useCallback((tag: string) =>
        setSelectedAngleTags(selectedAngleTags.includes(tag) ? [] : [tag]),
        [selectedAngleTags, setSelectedAngleTags]
    );

    const handleLightingTagToggle = useCallback((tag: string) =>
        setSelectedLightingTags(selectedLightingTags.includes(tag) ? [] : [tag]),
        [selectedLightingTags, setSelectedLightingTags]
    );

    const handleEffectTagToggle = useCallback((tag: string) =>
        setSelectedEffectTags(selectedEffectTags.includes(tag) ? [] : [tag]),
        [selectedEffectTags, setSelectedEffectTags]
    );

    const handleMaterialTagToggle = useCallback((tag: string) =>
        setSelectedMaterialTags(selectedMaterialTags.includes(tag) ? [] : [tag]),
        [selectedMaterialTags, setSelectedMaterialTags]
    );

    const handleAddCustomTag = useCallback((
        inputValue: string,
        selected: string[],
        setter: (tags: string[]) => void,
        inputSetter: (val: string) => void,
        limit: number
    ) => {
        const newTag = inputValue.trim();
        if (newTag && !selected.includes(newTag)) {
            setter([...selected, newTag]);
            inputSetter('');
        }
    }, []);

    const handleAddCustomBrandingTag = useCallback(() => {
        const wasEmpty = selectedBrandingTags.length === 0;
        handleAddCustomTag(customBrandingInput, selectedBrandingTags, setSelectedBrandingTags, setCustomBrandingInput, 5);
        if (wasEmpty && customBrandingInput.trim()) {
            scrollToSection('categories-section');
        }
    }, [customBrandingInput, selectedBrandingTags, setSelectedBrandingTags, setCustomBrandingInput, handleAddCustomTag, scrollToSection]);

    const handleAddCustomCategoryTag = useCallback(() => {
        const newTag = customCategoryInput.trim();
        if (newTag) {
            const wasEmpty = selectedTags.length === 0;
            setSelectedTags([newTag]);
            setCustomCategoryInput('');
            if (wasEmpty) {
                scrollToSection('refine-section');
            }
        }
    }, [customCategoryInput, selectedTags, setSelectedTags, setCustomCategoryInput, scrollToSection]);

    const handleRandomizeCategories = useCallback(() => {
        const shuffled = [...availableMockupTags].sort(() => 0.5 - Math.random());
        const wasEmpty = selectedTags.length === 0;
        setSelectedTags([shuffled[0]]);
        if (wasEmpty) {
            scrollToSection('refine-section');
        }
    }, [availableMockupTags, selectedTags.length, setSelectedTags, scrollToSection]);

    const handleAddCustomLocationTag = useCallback(() => {
        handleAddCustomTag(customLocationInput, selectedLocationTags, setSelectedLocationTags, setCustomLocationInput, 3);
    }, [customLocationInput, selectedLocationTags, setSelectedLocationTags, setCustomLocationInput, handleAddCustomTag]);

    const handleAddCustomAngleTag = useCallback(() => {
        handleAddCustomTag(customAngleInput, selectedAngleTags, setSelectedAngleTags, setCustomAngleInput, 3);
    }, [customAngleInput, selectedAngleTags, setSelectedAngleTags, setCustomAngleInput, handleAddCustomTag]);

    const handleAddCustomLightingTag = useCallback(() => {
        handleAddCustomTag(customLightingInput, selectedLightingTags, setSelectedLightingTags, setCustomLightingInput, 3);
    }, [customLightingInput, selectedLightingTags, setSelectedLightingTags, setCustomLightingInput, handleAddCustomTag]);

    const handleAddCustomEffectTag = useCallback(() => {
        handleAddCustomTag(customEffectInput, selectedEffectTags, setSelectedEffectTags, setCustomEffectInput, 3);
    }, [customEffectInput, selectedEffectTags, setSelectedEffectTags, setCustomEffectInput, handleAddCustomTag]);

    const handleAddCustomMaterialTag = useCallback(() => {
        handleAddCustomTag(customMaterialInput, selectedMaterialTags, setSelectedMaterialTags, setCustomMaterialInput, 3);
    }, [customMaterialInput, selectedMaterialTags, setSelectedMaterialTags, setCustomMaterialInput, handleAddCustomTag]);

    // Randomize functions
    const randomizeSelection = useCallback((available: string[], setter: (tags: string[]) => void, count: number = 1) => {
        if (available.length === 0) return;
        const random = [];
        const availableCopy = [...available];
        for (let i = 0; i < count; i++) {
            if (availableCopy.length === 0) break;
            const randomIndex = Math.floor(Math.random() * availableCopy.length);
            random.push(availableCopy[randomIndex]);
            availableCopy.splice(randomIndex, 1);
        }
        setter(random);
    }, []);

    const randomizeBranding = useCallback(() => randomizeSelection(availableBrandingTags, setSelectedBrandingTags, 1), [availableBrandingTags, setSelectedBrandingTags, randomizeSelection]);
    const randomizeCategory = useCallback(() => randomizeSelection(availableMockupTags, setSelectedTags, 1), [availableMockupTags, setSelectedTags, randomizeSelection]);
    const randomizeLocation = useCallback(() => randomizeSelection(availableLocationTags, setSelectedLocationTags, 1), [availableLocationTags, setSelectedLocationTags, randomizeSelection]);
    const randomizeAngle = useCallback(() => randomizeSelection(availableAngleTags, setSelectedAngleTags, 1), [availableAngleTags, setSelectedAngleTags, randomizeSelection]);
    const randomizeLighting = useCallback(() => randomizeSelection(availableLightingTags, setSelectedLightingTags, 1), [availableLightingTags, setSelectedLightingTags, randomizeSelection]);
    const randomizeEffect = useCallback(() => randomizeSelection(availableEffectTags, setSelectedEffectTags, 1), [availableEffectTags, setSelectedEffectTags, randomizeSelection]);
    const randomizeMaterial = useCallback(() => randomizeSelection(availableMaterialTags, setSelectedMaterialTags, 1), [availableMaterialTags, setSelectedMaterialTags, randomizeSelection]);


    return {
        // Tag Selection Handlers
        handleTagToggle,
        handleBrandingTagToggle,
        handleLocationTagToggle,
        handleAngleTagToggle,
        handleLightingTagToggle,
        handleEffectTagToggle,
        handleMaterialTagToggle,

        // Custom Tag Handlers
        handleAddCustomBrandingTag,
        handleAddCustomCategoryTag,
        handleAddCustomLocationTag,
        handleAddCustomAngleTag,
        handleAddCustomLightingTag,
        handleAddCustomEffectTag,
        handleAddCustomMaterialTag,

        // Randomize Handlers
        handleRandomizeCategories,
        randomizeBranding,
        randomizeCategory,
        randomizeLocation,
        randomizeAngle,
        randomizeLighting,
        randomizeEffect,
        randomizeMaterial,

        // Scroll Utility
        scrollToSection,

        // Dynamic Available Tags
        availableBrandingTags,
        availableMockupTags,
        availableLocationTags,
        availableAngleTags,
        availableLightingTags,
        availableEffectTags,
        availableMaterialTags,
        mockupPresets,
        tagCategories
    };
};
