import { useCallback } from 'react';
import { useMockup } from '../components/mockupmachine/MockupContext';
import {
    AVAILABLE_TAGS,
    AVAILABLE_ANGLE_TAGS,
    AVAILABLE_LOCATION_TAGS
} from '../utils/mockupConstants';

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
        if (newTag && selected.length < limit && !selected.map(t => t.toLowerCase()).includes(newTag.toLowerCase())) {
            setter([...selected, newTag]);
            inputSetter('');
        }
    }, []);

    const handleAddCustomBrandingTag = useCallback(() => {
        const wasEmpty = selectedBrandingTags.length === 0;
        handleAddCustomTag(customBrandingInput, selectedBrandingTags, setSelectedBrandingTags, setCustomBrandingInput, 3);
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
        const shuffled = [...AVAILABLE_TAGS].sort(() => 0.5 - Math.random());
        const wasEmpty = selectedTags.length === 0;
        setSelectedTags([shuffled[0]]);
        if (wasEmpty) {
            scrollToSection('refine-section');
        }
    }, [selectedTags.length, setSelectedTags, scrollToSection]);

    const handleAddCustomLocationTag = useCallback(() => {
        const newTag = customLocationInput.trim();
        if (newTag) {
            setSelectedLocationTags([newTag]);
            setCustomLocationInput('');
        }
    }, [customLocationInput, setSelectedLocationTags, setCustomLocationInput]);

    const handleAddCustomAngleTag = useCallback(() => {
        const newTag = customAngleInput.trim();
        if (newTag) {
            setSelectedAngleTags([newTag]);
            setCustomAngleInput('');
        }
    }, [customAngleInput, setSelectedAngleTags, setCustomAngleInput]);

    const handleAddCustomLightingTag = useCallback(() => {
        const newTag = customLightingInput.trim();
        if (newTag) {
            setSelectedLightingTags([newTag]);
            setCustomLightingInput('');
        }
    }, [customLightingInput, setSelectedLightingTags, setCustomLightingInput]);

    const handleAddCustomEffectTag = useCallback(() => {
        const newTag = customEffectInput.trim();
        if (newTag) {
            setSelectedEffectTags([newTag]);
            setCustomEffectInput('');
        }
    }, [customEffectInput, setSelectedEffectTags, setCustomEffectInput]);

    const handleAddCustomMaterialTag = useCallback(() => {
        const newTag = customMaterialInput.trim();
        if (newTag) {
            setSelectedMaterialTags([newTag]);
            setCustomMaterialInput('');
        }
    }, [customMaterialInput, setSelectedMaterialTags, setCustomMaterialInput]);

    return {
        handleTagToggle,
        handleBrandingTagToggle,
        handleLocationTagToggle,
        handleAngleTagToggle,
        handleLightingTagToggle,
        handleEffectTagToggle,
        handleMaterialTagToggle,
        handleAddCustomBrandingTag,
        handleAddCustomCategoryTag,
        handleAddCustomLocationTag,
        handleAddCustomAngleTag,
        handleAddCustomLightingTag,
        handleAddCustomEffectTag,
        handleAddCustomMaterialTag,
        handleRandomizeCategories,
        scrollToSection,
    };
};
