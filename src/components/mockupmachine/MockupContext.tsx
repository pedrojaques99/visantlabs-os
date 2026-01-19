import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, Dispatch, SetStateAction } from 'react';
import type { UploadedImage, AspectRatio, DesignType, GeminiModel, Resolution } from '@/types/types';
import { getSurpriseMeSelectedTags, type SurpriseMeSelectedTags } from '@/utils/surpriseMeSettings';

interface MockupContextState {
    // Image State
    uploadedImage: UploadedImage | null;
    referenceImage: UploadedImage | null;
    referenceImages: UploadedImage[];
    isImagelessMode: boolean;
    designType: DesignType | null;
    selectedModel: GeminiModel | null;
    resolution: Resolution;
    aspectRatio: AspectRatio;

    // Generation State
    mockups: (string | null)[];
    isLoading: boolean[];
    isGeneratingPrompt: boolean;
    hasGenerated: boolean;
    hasAnalyzed: boolean;
    isAnalyzing: boolean;
    isAnalysisOverlayVisible: boolean;

    // Selection State
    selectedTags: string[];
    selectedBrandingTags: string[];
    selectedLocationTags: string[];
    selectedAngleTags: string[];
    selectedLightingTags: string[];
    selectedEffectTags: string[];
    selectedMaterialTags: string[];
    selectedColors: string[];
    suggestedTags: string[]; // This is for categories
    suggestedBrandingTags: string[];
    suggestedLocationTags: string[];
    suggestedAngleTags: string[];
    suggestedLightingTags: string[];
    suggestedEffectTags: string[];
    suggestedMaterialTags: string[];
    suggestedColors: string[];

    // Advanced Settings State
    isAdvancedOpen: boolean;
    isAllCategoriesOpen: boolean;
    generateText: boolean;
    withHuman: boolean;
    enhanceTexture: boolean;

    // Prompt States
    promptPreview: string;
    negativePrompt: string;
    additionalPrompt: string;
    isSmartPromptActive: boolean;
    isPromptManuallyEdited: boolean;
    isPromptReady: boolean;
    promptSuggestions: string[];
    isSuggestingPrompts: boolean;

    // Custom Input States
    customBrandingInput: string;
    customCategoryInput: string;
    customLocationInput: string;
    customAngleInput: string;
    customLightingInput: string;
    customEffectInput: string;
    customMaterialInput: string;
    colorInput: string;
    isValidColor: boolean;

    // UI State
    fullScreenImageIndex: number | null;
    mockupCount: number;

    // Surprise Me Mode State
    isSurpriseMeMode: boolean;
    surpriseMePool: SurpriseMeSelectedTags;

    // Additional Instructions
    instructions: string;
}

interface MockupContextActions {
    setUploadedImage: Dispatch<SetStateAction<UploadedImage | null>>;
    setReferenceImage: Dispatch<SetStateAction<UploadedImage | null>>;
    setReferenceImages: Dispatch<SetStateAction<UploadedImage[]>>;
    setIsImagelessMode: Dispatch<SetStateAction<boolean>>;
    setDesignType: Dispatch<SetStateAction<DesignType | null>>;
    setSelectedModel: Dispatch<SetStateAction<GeminiModel | null>>;
    setResolution: Dispatch<SetStateAction<Resolution>>;
    setAspectRatio: Dispatch<SetStateAction<AspectRatio>>;
    setMockups: Dispatch<SetStateAction<(string | null)[]>>;
    setIsLoading: Dispatch<SetStateAction<boolean[]>>;
    setHasGenerated: Dispatch<SetStateAction<boolean>>;
    setHasAnalyzed: Dispatch<SetStateAction<boolean>>;
    setIsAnalyzing: Dispatch<SetStateAction<boolean>>;
    setIsAnalysisOverlayVisible: Dispatch<SetStateAction<boolean>>;
    setIsGeneratingPrompt: Dispatch<SetStateAction<boolean>>;
    setSelectedTags: Dispatch<SetStateAction<string[]>>;
    setSelectedBrandingTags: Dispatch<SetStateAction<string[]>>;
    setSelectedLocationTags: Dispatch<SetStateAction<string[]>>;
    setSelectedAngleTags: Dispatch<SetStateAction<string[]>>;
    setSelectedLightingTags: Dispatch<SetStateAction<string[]>>;
    setSelectedEffectTags: Dispatch<SetStateAction<string[]>>;
    setSelectedMaterialTags: Dispatch<SetStateAction<string[]>>;
    setSelectedColors: Dispatch<SetStateAction<string[]>>;
    setSuggestedTags: Dispatch<SetStateAction<string[]>>;
    setSuggestedBrandingTags: Dispatch<SetStateAction<string[]>>;
    setSuggestedLocationTags: Dispatch<SetStateAction<string[]>>;
    setSuggestedAngleTags: Dispatch<SetStateAction<string[]>>;
    setSuggestedLightingTags: Dispatch<SetStateAction<string[]>>;
    setSuggestedEffectTags: Dispatch<SetStateAction<string[]>>;
    setSuggestedMaterialTags: Dispatch<SetStateAction<string[]>>;
    setSuggestedColors: Dispatch<SetStateAction<string[]>>;
    setIsAdvancedOpen: Dispatch<SetStateAction<boolean>>;
    setIsAllCategoriesOpen: Dispatch<SetStateAction<boolean>>;
    setGenerateText: Dispatch<SetStateAction<boolean>>;
    setWithHuman: Dispatch<SetStateAction<boolean>>;
    setEnhanceTexture: Dispatch<SetStateAction<boolean>>;
    setPromptPreview: Dispatch<SetStateAction<string>>;
    setNegativePrompt: Dispatch<SetStateAction<string>>;
    setAdditionalPrompt: Dispatch<SetStateAction<string>>;
    setIsSmartPromptActive: Dispatch<SetStateAction<boolean>>;
    setIsPromptManuallyEdited: Dispatch<SetStateAction<boolean>>;
    setIsPromptReady: Dispatch<SetStateAction<boolean>>;
    setPromptSuggestions: Dispatch<SetStateAction<string[]>>;
    setIsSuggestingPrompts: Dispatch<SetStateAction<boolean>>;
    setCustomBrandingInput: Dispatch<SetStateAction<string>>;
    setCustomCategoryInput: Dispatch<SetStateAction<string>>;
    setCustomLocationInput: Dispatch<SetStateAction<string>>;
    setCustomAngleInput: Dispatch<SetStateAction<string>>;
    setCustomLightingInput: Dispatch<SetStateAction<string>>;
    setCustomEffectInput: Dispatch<SetStateAction<string>>;
    setCustomMaterialInput: Dispatch<SetStateAction<string>>;
    setColorInput: Dispatch<SetStateAction<string>>;
    setIsValidColor: Dispatch<SetStateAction<boolean>>;
    setFullScreenImageIndex: Dispatch<SetStateAction<number | null>>;
    setMockupCount: Dispatch<SetStateAction<number>>;
    setIsSurpriseMeMode: Dispatch<SetStateAction<boolean>>;
    setSurpriseMePool: Dispatch<SetStateAction<SurpriseMeSelectedTags>>;
    setInstructions: Dispatch<SetStateAction<string>>;
    resetAll: () => void;
}

export type MockupContextValue = MockupContextState & MockupContextActions;

const MockupContext = createContext<MockupContextValue | undefined>(undefined);

const initialMockupCount = 2;

export const MockupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
    const [referenceImage, setReferenceImage] = useState<UploadedImage | null>(null);
    const [referenceImages, setReferenceImages] = useState<UploadedImage[]>([]);
    const [isImagelessMode, setIsImagelessMode] = useState(false);
    const [designType, setDesignType] = useState<DesignType | null>(null);
    const [selectedModel, setSelectedModel] = useState<GeminiModel | null>(null);
    const [resolution, setResolution] = useState<Resolution>('1K');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [mockups, setMockups] = useState<(string | null)[]>(Array(initialMockupCount).fill(null));
    const [isLoading, setIsLoading] = useState<boolean[]>(Array(initialMockupCount).fill(false));
    const [hasGenerated, setHasGenerated] = useState(false);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isAnalysisOverlayVisible, setIsAnalysisOverlayVisible] = useState(false);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedBrandingTags, setSelectedBrandingTags] = useState<string[]>([]);
    const [selectedLocationTags, setSelectedLocationTags] = useState<string[]>([]);
    const [selectedAngleTags, setSelectedAngleTags] = useState<string[]>([]);
    const [selectedLightingTags, setSelectedLightingTags] = useState<string[]>([]);
    const [selectedEffectTags, setSelectedEffectTags] = useState<string[]>([]);
    const [selectedMaterialTags, setSelectedMaterialTags] = useState<string[]>([]);
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
    const [suggestedBrandingTags, setSuggestedBrandingTags] = useState<string[]>([]);
    const [suggestedLocationTags, setSuggestedLocationTags] = useState<string[]>([]);
    const [suggestedAngleTags, setSuggestedAngleTags] = useState<string[]>([]);
    const [suggestedLightingTags, setSuggestedLightingTags] = useState<string[]>([]);
    const [suggestedEffectTags, setSuggestedEffectTags] = useState<string[]>([]);
    const [suggestedMaterialTags, setSuggestedMaterialTags] = useState<string[]>([]);
    const [suggestedColors, setSuggestedColors] = useState<string[]>([]);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(true);
    const [isAllCategoriesOpen, setIsAllCategoriesOpen] = useState(false);
    const [generateText, setGenerateText] = useState(false);
    const [withHuman, setWithHuman] = useState(false);
    const [enhanceTexture, setEnhanceTexture] = useState(false);
    const [promptPreview, setPromptPreview] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [additionalPrompt, setAdditionalPrompt] = useState('');
    const [isSmartPromptActive, setIsSmartPromptActive] = useState(false);
    const [isPromptManuallyEdited, setIsPromptManuallyEdited] = useState(false);
    const [isPromptReady, setIsPromptReady] = useState(false);
    const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
    const [isSuggestingPrompts, setIsSuggestingPrompts] = useState(false);
    const [customBrandingInput, setCustomBrandingInput] = useState('');
    const [customCategoryInput, setCustomCategoryInput] = useState('');
    const [customLocationInput, setCustomLocationInput] = useState('');
    const [customAngleInput, setCustomAngleInput] = useState('');
    const [customLightingInput, setCustomLightingInput] = useState('');
    const [customEffectInput, setCustomEffectInput] = useState('');
    const [customMaterialInput, setCustomMaterialInput] = useState('');
    const [colorInput, setColorInput] = useState('');
    const [isValidColor, setIsValidColor] = useState(false);
    const [fullScreenImageIndex, setFullScreenImageIndex] = useState<number | null>(null);
    const [mockupCount, setMockupCount] = useState(initialMockupCount);

    // Surprise Me Mode State - load initial pool from localStorage
    const [isSurpriseMeMode, setIsSurpriseMeMode] = useState(false);
    const [surpriseMePool, setSurpriseMePool] = useState<SurpriseMeSelectedTags>(() => getSurpriseMeSelectedTags());
    const [instructions, setInstructions] = useState('');

    const resetAll = () => {
        setUploadedImage(null);
        setReferenceImage(null);
        setReferenceImages([]);
        setIsImagelessMode(false);
        setDesignType(null);
        setSelectedTags([]);
        setSelectedBrandingTags([]);
        setSelectedLocationTags([]);
        setSelectedAngleTags([]);
        setSelectedLightingTags([]);
        setSelectedEffectTags([]);
        setSelectedMaterialTags([]);
        setSelectedColors([]);
        setPromptPreview('');
        setNegativePrompt('');
        setAdditionalPrompt('');
        setIsSmartPromptActive(false);
        setIsPromptManuallyEdited(false);
        setIsPromptReady(false);
        setCustomBrandingInput('');
        setCustomCategoryInput('');
        setMockups(Array(mockupCount).fill(null));
        setIsLoading(Array(mockupCount).fill(false));
        setIsLoading(Array(mockupCount).fill(false));
        setHasGenerated(false);
        setHasAnalyzed(false);
        setHasAnalyzed(false);
        setIsSurpriseMeMode(false);
        setIsAnalysisOverlayVisible(false);
        setInstructions('');
    };

    const value = useMemo(() => ({
        uploadedImage, setUploadedImage,
        referenceImage, setReferenceImage,
        referenceImages, setReferenceImages,
        isImagelessMode, setIsImagelessMode,
        designType, setDesignType,
        selectedModel, setSelectedModel,
        resolution, setResolution,
        aspectRatio, setAspectRatio,
        mockups, setMockups,
        isLoading, setIsLoading,
        hasGenerated, setHasGenerated,
        hasAnalyzed, setHasAnalyzed,
        isAnalyzing, setIsAnalyzing,
        isAnalysisOverlayVisible, setIsAnalysisOverlayVisible,
        isGeneratingPrompt, setIsGeneratingPrompt,
        selectedTags, setSelectedTags,
        selectedBrandingTags, setSelectedBrandingTags,
        selectedLocationTags, setSelectedLocationTags,
        selectedAngleTags, setSelectedAngleTags,
        selectedLightingTags, setSelectedLightingTags,
        selectedEffectTags, setSelectedEffectTags,
        selectedMaterialTags, setSelectedMaterialTags,
        selectedColors, setSelectedColors,
        suggestedTags, setSuggestedTags,
        suggestedBrandingTags, setSuggestedBrandingTags,
        suggestedLocationTags, setSuggestedLocationTags,
        suggestedAngleTags, setSuggestedAngleTags,
        suggestedLightingTags, setSuggestedLightingTags,
        suggestedEffectTags, setSuggestedEffectTags,
        suggestedMaterialTags, setSuggestedMaterialTags,
        suggestedColors, setSuggestedColors,
        isAdvancedOpen, setIsAdvancedOpen,
        isAllCategoriesOpen, setIsAllCategoriesOpen,
        generateText, setGenerateText,
        withHuman, setWithHuman,
        enhanceTexture, setEnhanceTexture,
        promptPreview, setPromptPreview,
        negativePrompt, setNegativePrompt,
        additionalPrompt, setAdditionalPrompt,
        isSmartPromptActive, setIsSmartPromptActive,
        isPromptManuallyEdited, setIsPromptManuallyEdited,
        isPromptReady, setIsPromptReady,
        promptSuggestions, setPromptSuggestions,
        isSuggestingPrompts, setIsSuggestingPrompts,
        customBrandingInput, setCustomBrandingInput,
        customCategoryInput, setCustomCategoryInput,
        customLocationInput, setCustomLocationInput,
        customAngleInput, setCustomAngleInput,
        customLightingInput, setCustomLightingInput,
        customEffectInput, setCustomEffectInput,
        customMaterialInput, setCustomMaterialInput,
        colorInput, setColorInput,
        isValidColor, setIsValidColor,
        fullScreenImageIndex, setFullScreenImageIndex,
        mockupCount, setMockupCount,
        isSurpriseMeMode, setIsSurpriseMeMode,
        surpriseMePool, setSurpriseMePool,
        instructions, setInstructions,
        resetAll
    }), [
        uploadedImage, referenceImage, referenceImages, isImagelessMode, designType,
        selectedModel, resolution, aspectRatio, mockups, isLoading, hasGenerated,
        isAnalyzing, isGeneratingPrompt, selectedTags, selectedBrandingTags,
        selectedLocationTags, selectedAngleTags, selectedLightingTags, selectedEffectTags,
        selectedMaterialTags, selectedColors, suggestedTags,
        suggestedBrandingTags, suggestedLocationTags, suggestedAngleTags,
        suggestedLightingTags, suggestedEffectTags, suggestedMaterialTags,
        suggestedColors, isAdvancedOpen,
        isAllCategoriesOpen, generateText, withHuman, enhanceTexture, promptPreview,
        negativePrompt, additionalPrompt, isSmartPromptActive, isPromptManuallyEdited,
        isPromptReady, promptSuggestions, isSuggestingPrompts, customBrandingInput,
        customCategoryInput, customLocationInput, customAngleInput, customLightingInput,
        customEffectInput, customMaterialInput, colorInput, isValidColor,
        fullScreenImageIndex, mockupCount, isSurpriseMeMode, surpriseMePool,
        instructions, resetAll
    ]);

    return (
        <MockupContext.Provider value={value}>
            {children}
        </MockupContext.Provider>
    );
};

export const useMockup = () => {
    const context = useContext(MockupContext);
    if (context === undefined) {
        throw new Error('useMockup must be used within a MockupProvider');
    }
    return context;
};
