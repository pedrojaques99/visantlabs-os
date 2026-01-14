import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useBlocker, useLocation } from 'react-router-dom';
import { Menu, Pickaxe } from 'lucide-react';
import { ImageUploader } from '../components/ui/ImageUploader';
import { normalizeImageToBase64, detectMimeType } from '../services/reactFlowService';
import { MockupDisplay } from '../components/mockupmachine/MockupDisplay';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { WelcomeScreen } from './WelcomeScreen';
import { SidebarOrchestrator } from '../components/SidebarOrchestrator';
import { FloatingActionButtons } from '../components/mockupmachine/FloatingActionButtons';
import { GenerateButton } from '../components/ui/GenerateButton';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Button } from '../components/ui/button';
import { AnalyzingImageOverlay } from '../components/ui/AnalyzingImageOverlay';
import { aiApi } from '../services/aiApi';
import { RateLimitError, ModelOverloadedError } from '../services/geminiService';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { subscriptionService } from '../services/subscriptionService';
import { authService } from '../services/authService';
import { mockupApi } from '../services/mockupApi';
import { useLayout } from '@/hooks/useLayout';
import type { UploadedImage, AspectRatio, DesignType, GeminiModel, Resolution } from '../types/types';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { SEO } from '../components/SEO';
import { SoftwareApplicationSchema, WebSiteSchema } from '../components/StructuredData';
import { compressImage, getBase64ImageSize, needsCompression } from '@/utils/imageCompression';
import { saveMockupState, loadMockupState, clearMockupState } from '@/utils/mockupStatePersistence';
import { getAllAnglePresetsAsync } from '../services/anglePresetsService';
import { getAllTexturePresetsAsync } from '../services/texturePresetsService';
import { getAllAmbiencePresetsAsync } from '../services/ambiencePresetsService';
import { getAllLuminancePresetsAsync } from '../services/luminancePresetsService';
import type { AnglePreset } from '../types/anglePresets';
import type { TexturePreset } from '../types/texturePresets';
import type { AmbiencePreset } from '../types/ambiencePresets';
import type { LuminancePreset } from '../types/luminancePresets';
import { SurpriseMeSettingsModal } from '../components/SurpriseMeSettingsModal';
import { getSurpriseMeSelectedTags } from '@/utils/surpriseMeSettings';
import { MockupProvider, useMockup } from '../components/mockupmachine/MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';

const MOCKUP_COUNT = 2;

import { isLocalDevelopment } from '@/utils/env';
import {
  AVAILABLE_TAGS,
  AVAILABLE_BRANDING_TAGS,
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS,
  GENERIC_MOCKUP_TAGS,
  GENERIC_BRANDING_TAGS
} from '@/utils/mockupConstants';
import {
  getBackgroundDescription,
  getLightingDescription,
  getEffectDescription,
  getBackgroundsForBranding,
  filterPresetsByBranding,
  selectRandomBackground
} from '@/utils/promptHelpers';





export const MockupMachinePage: React.FC = () => {
  return (
    <MockupProvider>
      <MockupMachinePageContent />
    </MockupProvider>
  );
};

const MockupMachinePageContent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { subscriptionStatus, isAuthenticated, isCheckingAuth, onSubscriptionModalOpen, onCreditPackagesModalOpen, setSubscriptionStatus, registerUnsavedOutputsHandler, registerResetHandler } = useLayout();

  const {
    uploadedImage, setUploadedImage,
    referenceImage, setReferenceImage,
    referenceImages, setReferenceImages,
    isImagelessMode, setIsImagelessMode,
    selectedModel, setSelectedModel,
    resolution, setResolution,
    designType, setDesignType,
    selectedTags, setSelectedTags,
    selectedBrandingTags, setSelectedBrandingTags,
    mockupCount, setMockupCount,
    mockups, setMockups,
    isLoading, setIsLoading,
    isAnalyzing, setIsAnalyzing,
    isGeneratingPrompt, setIsGeneratingPrompt,
    suggestedTags, setSuggestedTags,
    generateText, setGenerateText,
    withHuman, setWithHuman,
    enhanceTexture, setEnhanceTexture,
    aspectRatio, setAspectRatio,
    promptPreview, setPromptPreview,
    negativePrompt, setNegativePrompt,
    additionalPrompt, setAdditionalPrompt,
    fullScreenImageIndex, setFullScreenImageIndex,
    hasGenerated, setHasGenerated,
    isSmartPromptActive, setIsSmartPromptActive,
    isPromptManuallyEdited, setIsPromptManuallyEdited,
    isPromptReady, setIsPromptReady,
    isAdvancedOpen, setIsAdvancedOpen,
    isAllCategoriesOpen, setIsAllCategoriesOpen,
    selectedLocationTags, setSelectedLocationTags,
    selectedAngleTags, setSelectedAngleTags,
    selectedLightingTags, setSelectedLightingTags,
    selectedEffectTags, setSelectedEffectTags,
    selectedMaterialTags, setSelectedMaterialTags,
    selectedColors, setSelectedColors,
    colorInput, setColorInput,
    isValidColor, setIsValidColor,
    isSuggestingPrompts, setIsSuggestingPrompts,
    promptSuggestions, setPromptSuggestions,
    suggestedBrandingTags, setSuggestedBrandingTags,
    suggestedLocationTags, setSuggestedLocationTags,
    suggestedAngleTags, setSuggestedAngleTags,
    suggestedLightingTags, setSuggestedLightingTags,
    suggestedEffectTags, setSuggestedEffectTags,
    suggestedMaterialTags, setSuggestedMaterialTags,
    suggestedColors, setSuggestedColors,
    customBrandingInput, setCustomBrandingInput,
    customCategoryInput, setCustomCategoryInput,
    customLocationInput, setCustomLocationInput,
    customAngleInput, setCustomAngleInput,
    customLightingInput, setCustomLightingInput,
    customEffectInput, setCustomEffectInput,
    customMaterialInput, setCustomMaterialInput,
    resetAll,
    hasAnalyzed,
    setHasAnalyzed
  } = useMockup();

  const {
    handleTagToggle,
    handleBrandingTagToggle,
    handleLocationTagToggle,
    handleAngleTagToggle,
    handleLightingTagToggle,
    handleEffectTagToggle,
    handleMaterialTagToggle,
    handleAddCustomBrandingTag,
    handleAddCustomCategoryTag,
    handleRandomizeCategories,
    scrollToSection
  } = useMockupTags();

  const promptWasReadyBeforeEditRef = useRef<boolean>(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);
  const [autoGenerateSource, setAutoGenerateSource] = useState<'surprise' | 'angles' | 'environments' | null>(null);
  const [isAutoGenerateMode, setIsAutoGenerateMode] = useState(false);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [mockupLikedStatus, setMockupLikedStatus] = useState<Map<number, boolean>>(new Map()); // Map index -> isLiked
  const [savedMockupIds, setSavedMockupIds] = useState<Map<number, string>>(new Map()); // Map index -> mockup ID
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [unsavedDialogConfig, setUnsavedDialogConfig] = useState<{
    onConfirm: () => void;
    onSaveAll?: () => Promise<void>;
    message: string;
    showSaveAll?: boolean;
  } | null>(null);
  const [isSurpriseMeSettingsOpen, setIsSurpriseMeSettingsOpen] = useState(false);

  // Check if there are unsaved images for navigation blocker
  const hasUnsavedImages = mockups.some((mockup, index) =>
    mockup !== null && !savedIndices.has(index)
  );

  // Block navigation if there are unsaved images
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedImages && currentLocation.pathname !== nextLocation.pathname
  );

  const [sidebarWidth, setSidebarWidth] = useState(715); // 30% maior que 550
  const sidebarRef = useRef<HTMLElement>(null);
  const [isSidebarVisibleMobile, setIsSidebarVisibleMobile] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const analysisTimeoutRef = useRef<number | null>(null);
  const prevBrandingTagsLength = useRef(0);
  const autoGenerateTimeoutRef = useRef<number | null>(null);
  const isAutoGeneratingRef = useRef(false);
  const generateOutputsButtonRef = useRef<HTMLButtonElement>(null);
  const hasRestoredStateRef = useRef(false);
  const generatedSmartPromptRef = useRef<string | null>(null);

  // Restore state from localStorage on mount (prioritize edit-mockup if exists)
  useEffect(() => {
    // Only restore once on mount
    if (hasRestoredStateRef.current) return;
    hasRestoredStateRef.current = true;

    try {
      // First check for edit-mockup (has priority)
      const editMockupData = localStorage.getItem('edit-mockup');
      if (editMockupData) {
        try {
          const editData = JSON.parse(editMockupData);
          // Handle edit-mockup (existing logic would go here if needed)
          // For now, just remove it to avoid conflicts
          localStorage.removeItem('edit-mockup');
        } catch (error) {
          // Invalid edit-mockup data, remove it
          localStorage.removeItem('edit-mockup');
        }
        // Don't restore persisted state if edit-mockup exists
        return;
      }

      // Try to restore persisted state
      const persistedState = loadMockupState();
      if (persistedState) {
        // Restore all state
        setMockups(persistedState.mockups);
        setUploadedImage(persistedState.uploadedImage);
        setReferenceImage(persistedState.referenceImage);
        setReferenceImages(persistedState.referenceImages);
        setDesignType(persistedState.designType);
        setSelectedTags(persistedState.selectedTags);
        setSelectedBrandingTags(persistedState.selectedBrandingTags);
        setSelectedLocationTags(persistedState.selectedLocationTags);
        setSelectedAngleTags(persistedState.selectedAngleTags);
        setSelectedLightingTags(persistedState.selectedLightingTags);
        setSelectedEffectTags(persistedState.selectedEffectTags);
        setSelectedColors(persistedState.selectedColors);
        setPromptPreview(persistedState.promptPreview);
        setAspectRatio(persistedState.aspectRatio);
        setSelectedModel(persistedState.selectedModel);
        setResolution(persistedState.resolution);
        setHasGenerated(persistedState.hasGenerated);
        setMockupCount(persistedState.mockupCount);
        setGenerateText(persistedState.generateText);
        setWithHuman(persistedState.withHuman);
        setEnhanceTexture(persistedState.enhanceTexture ?? false);
        setNegativePrompt(persistedState.negativePrompt);
        setAdditionalPrompt(persistedState.additionalPrompt);
        setSuggestedTags(persistedState.suggestedTags || []);
        setSuggestedBrandingTags(persistedState.suggestedBrandingTags || []);
        setSuggestedLocationTags(persistedState.suggestedLocationTags || []);
        setSuggestedAngleTags(persistedState.suggestedAngleTags || []);
        setSuggestedLightingTags(persistedState.suggestedLightingTags || []);
        setSuggestedEffectTags(persistedState.suggestedEffectTags || []);
        setSuggestedMaterialTags(persistedState.suggestedMaterialTags || []);
        setSuggestedColors(persistedState.suggestedColors || []);

        // Hide welcome screen and show mockups
        setShowWelcome(false);

        // Adjust loading array to match mockups length
        setIsLoading(Array(persistedState.mockups.length).fill(false));

        // Clear persisted state after restoring (to avoid stale data)
        clearMockupState();
      }
    } catch (error) {
      // Silently fail - don't break UX if restoration fails
      if (isLocalDevelopment()) {
        console.warn('Failed to restore mockup state:', error);
      }
    }
  }, []); // Only run once on mount

  const handleModelChange = useCallback((model: GeminiModel) => {
    const previousModel = selectedModel;

    // If switching to 2.5 Flash, reset resolution (not applicable)
    if (model === 'gemini-2.5-flash-image' && previousModel === 'gemini-3-pro-image-preview') {
      setResolution('1K');
      toast.info(t('messages.switchedToHD'), { duration: 3000 });
    } else if (model === 'gemini-3-pro-image-preview' && previousModel === 'gemini-2.5-flash-image') {
      // Switching to 3 Pro - validate credits if needed
      if (subscriptionStatus) {
        const minCredits = 3; // Minimum credits for 3 Pro
        const totalCredits = subscriptionStatus.totalCredits || 0;
        const remaining = subscriptionStatus.hasActiveSubscription
          ? totalCredits
          : Math.min(subscriptionStatus.freeGenerationsRemaining || 0, totalCredits);

        if (remaining < minCredits) {
          toast.warning(t('messages.modelRequiresCredits', { minCredits, remaining }), { duration: 4000 });
          onCreditPackagesModalOpen();
          return; // Don't switch if insufficient credits
        }
      }
      toast.success(t('messages.switchedTo4K'), { duration: 3000 });
    }

    setSelectedModel(model);

    // Reset prompt ready status when model changes (may need regeneration)
    if (promptPreview.trim()) {
      setIsPromptReady(false);
      toast.info(t('messages.modelChanged'), { duration: 3000 });
    }
  }, [selectedModel, subscriptionStatus, promptPreview, onCreditPackagesModalOpen]);

  // Note: mockupCount changes should NOT affect already generated images
  // It only affects the number of images for the next generation


  // Reset showWelcome when navigating to home route
  // Only reset if we're actually in imageless mode (not when starting a blank mockup)
  // Also don't reset if we just uploaded an image (check by ensuring no mockups generated yet)
  useEffect(() => {
    // Don't reset to welcome if we have an uploaded image (even if no mockups generated yet)
    // This prevents the welcome screen from reappearing after image upload
    // Also don't reset if we have generated mockups (hasGenerated is true or mockups array has non-null values)
    const hasAnyMockups = mockups.some(m => m !== null);
    if (location.pathname === '/' &&
      !uploadedImage &&
      !referenceImage &&
      mockups.every(m => m === null) &&
      !isImagelessMode &&
      isPromptReady &&
      designType !== 'blank' &&
      !hasGenerated &&
      !hasAnyMockups) {
      setShowWelcome(true);
    } else if (hasGenerated || hasAnyMockups) {
      // Explicitly keep welcome screen hidden if we have generated mockups
      setShowWelcome(false);
    }
  }, [location.pathname, uploadedImage, referenceImage, mockups, isImagelessMode, designType, hasGenerated]);

  // Save state to localStorage when mockups are generated (with debounce)
  useEffect(() => {
    // Save if there are generated mockups OR if an image has been uploaded (to persist analysis)
    const hasAnyMockups = mockups.some(m => m !== null);
    if (!hasAnyMockups && !uploadedImage && !hasGenerated) return;

    const timeoutId = setTimeout(async () => {
      try {
        await saveMockupState({
          mockups,
          uploadedImage,
          referenceImage,
          referenceImages,
          designType,
          selectedTags,
          selectedBrandingTags,
          selectedLocationTags,
          selectedAngleTags,
          selectedLightingTags,
          selectedEffectTags,
          selectedColors,
          promptPreview,
          aspectRatio,
          selectedModel,
          resolution,
          hasGenerated,
          mockupCount,
          generateText,
          withHuman,
          enhanceTexture,
          negativePrompt,
          additionalPrompt,
          suggestedTags,
          suggestedBrandingTags,
          suggestedLocationTags,
          suggestedAngleTags,
          suggestedLightingTags,
          suggestedEffectTags,
          suggestedMaterialTags,
          suggestedColors,
        });
      } catch (error) {
        // Silently fail - don't break UX if localStorage fails
        if (isLocalDevelopment()) {
          console.warn('Failed to save mockup state:', error);
        }
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [
    mockups,
    uploadedImage,
    referenceImage,
    referenceImages,
    designType,
    selectedTags,
    selectedBrandingTags,
    selectedLocationTags,
    selectedAngleTags,
    selectedLightingTags,
    selectedEffectTags,
    selectedColors,
    promptPreview,
    aspectRatio,
    selectedModel,
    resolution,
    hasGenerated,
    mockupCount,
    generateText,
    withHuman,
    enhanceTexture,
    negativePrompt,
    additionalPrompt,
    isPromptReady,
    suggestedTags,
    suggestedBrandingTags,
    suggestedLocationTags,
    suggestedAngleTags,
    suggestedLightingTags,
    suggestedEffectTags,
    suggestedMaterialTags,
    suggestedColors,
  ]);

  const buildPrompt = useCallback(() => {
    const baseQuality = "A photorealistic, super-detailed";
    let aspectInstruction = '';
    switch (aspectRatio) {
      case '16:9': aspectInstruction = `widescreen cinematic shot`; break;
      case '4:3': aspectInstruction = `standard photo`; break;
      case '1:1': aspectInstruction = `square composition`; break;
      default: aspectInstruction = `image with an aspect ratio of ${aspectRatio}`; break;
    }
    let basePrompt = '';

    // Special handling for Letterhead - elegant A4 paper on minimalist clipboard, contract-style document
    const isLetterhead = selectedTags.includes('Letterhead');

    if (designType === 'blank') {
      if (isLetterhead) {
        basePrompt = `${baseQuality} ${aspectInstruction} of an elegant A4 paper letterhead mockup placed on a minimalist clipboard or document holder. The scene should feature a clean, professional contract-style document aesthetic with the paper elegantly displayed. The clipboard should be minimalist and modern, creating a sophisticated business document presentation. The scene should be clean, minimalist, and ready for a design to be placed on the letterhead. Emphasize authentic paper texture, subtle shadows, and professional product photography lighting with sharp focus. There should be absolutely no text, logos, or any other graphic elements on the mockup surfaces.`;
      } else {
        basePrompt = `${baseQuality} ${aspectInstruction} of a blank white ${selectedTags.join(' and ')} mockup. The scene should be clean, minimalist, and ready for a design to be placed on it. Emphasize authentic materials, subtle surface details, and professional product photography lighting with sharp focus. There should be absolutely no text, logos, or any other graphic elements on the mockup surfaces.`;
      }
    } else {
      const designTerm = designType === 'logo' ? 'logo' : 'design';
      if (isLetterhead) {
        basePrompt = `${baseQuality} ${aspectInstruction} of an elegant A4 paper letterhead mockup placed on a minimalist clipboard or document holder featuring the provided ${designTerm}. The scene should feature a clean, professional contract-style document aesthetic with the paper elegantly displayed. The clipboard should be minimalist and modern, creating a sophisticated business document presentation. Emphasize authentic paper texture, subtle shadows, and professional product photography lighting with sharp focus.`;
      } else {
        basePrompt = `${baseQuality} ${aspectInstruction} of a ${selectedTags.join(' and ')} mockup featuring the provided ${designTerm}. Emphasize authentic materials, subtle surface details, and professional product photography lighting with sharp focus.`;
      }
    }

    if (selectedBrandingTags.length > 0) basePrompt += ` The brand's style is: ${selectedBrandingTags.join(', ')}.`;
    if (selectedLocationTags.length > 0) {
      // Special handling for Minimalist Studio
      if (selectedLocationTags.includes('Minimalist Studio')) {
        basePrompt += ` The scene should be set in a professional photography studio with infinite white wall background, studio lighting, clean and minimalist aesthetic.`;
        basePrompt += ` The scene should include a plant in the setting.`;
      } else if (selectedLocationTags.includes('Light Box')) {
        basePrompt += ` The scene should be set in a professional lightbox photography environment with seamless white or neutral background, even diffused lighting, completely neutral and minimal aesthetic. This is a professional product photography setup with no decorative elements, plants, or distractions - purely focused on showcasing the product with clean, professional lighting.`;
      } else {
        basePrompt += ` The scene should be set in or evoke the aesthetic of: ${selectedLocationTags.join(', ')}.`;
      }
    }
    if (selectedAngleTags.length > 0) basePrompt += ` The camera angle should be: ${selectedAngleTags.join(', ')}.`;
    if (selectedLightingTags.length > 0) basePrompt += ` The lighting should be: ${selectedLightingTags.join(', ')}.`;
    if (selectedEffectTags.length > 0) basePrompt += ` Apply a visual effect of: ${selectedEffectTags.join(', ')}.`;
    if (selectedMaterialTags.length > 0) basePrompt += ` The materials and textures should feature: ${selectedMaterialTags.join(', ')}.`;
    if (selectedColors.length > 0) basePrompt += ` The scene's color palette should be dominated by or feature accents of: ${selectedColors.join(', ')}.`;

    // Add instruction about reference images if present
    if (referenceImages.length > 0) {
      basePrompt += ` IMPORTANT: The provided reference image${referenceImages.length > 1 ? 's' : ''} ${referenceImages.length > 1 ? 'are' : 'is'} included as style and composition guidance. Study ${referenceImages.length > 1 ? 'these images' : 'this image'} carefully and create a mockup that matches the aesthetic, mood, composition style, lighting approach, color palette, and overall visual feeling of ${referenceImages.length > 1 ? 'these reference mockups' : 'this reference mockup'}. Use ${referenceImages.length > 1 ? 'them' : 'it'} as inspiration for creating a similar visual quality and atmosphere.`;
    }

    if (designType !== 'blank') {
      if (designType === 'logo') {
        if (generateText) basePrompt += " If appropriate for the mockup type, generate plausible placeholder text to make the scene more realistic.";
        else basePrompt += " No additional text, words, or letters should be generated. The design is the sole graphic element.";
      }

      basePrompt += " Place the design exactly as provided, without modification, cropping, or re-drawing.";
    }

    if (designType === 'logo') {
      basePrompt += " When placing the design, ensure a comfortable safe area or 'breathing room' around it. The design must never touch or be clipped by the edges of the mockup surface (e.g., the edges of a business card or a book cover).";
      basePrompt += " CRITICAL: Analyze the provided logo image and ensure proper contrast between the logo and the mockup substrate. If the logo is light/white (transparent PNG), it must NEVER be placed on a light/white substrate - use dark or colored substrates instead. If the logo is dark, it must NEVER be placed on a dark substrate - use light or colored substrates instead. Always ensure the logo is clearly visible and has sufficient contrast with the background.";
    }

    if (withHuman) {
      const humanAction = Math.random() < 0.5 ? 'looking at' : 'interacting with';
      if (designType === 'blank') {
        basePrompt += ` The scene should include a human person naturally ${humanAction} the mockup.`;
      } else {
        basePrompt += ` The scene should include a human person naturally ${humanAction} the mockup product. Ensure the moment feels contextual for the product type.`;
      }
    }

    if (additionalPrompt.trim()) {
      basePrompt += ` The scene must also include the following details: ${additionalPrompt.trim()}.`;
    }
    if (negativePrompt.trim()) {
      basePrompt += ` AVOID THE FOLLOWING: ${negativePrompt.trim()}.`;
    }

    return basePrompt;
  }, [designType, selectedTags, aspectRatio, selectedBrandingTags, selectedLocationTags, selectedAngleTags, selectedLightingTags, selectedEffectTags, selectedMaterialTags, selectedColors, generateText, withHuman, negativePrompt, additionalPrompt, referenceImages]);

  const handleGenerateSmartPrompt = useCallback(async () => {
    if (isGeneratingPrompt) {
      if (isLocalDevelopment()) {
        console.warn('Prompt generation already in progress, skipping duplicate call');
      }
      return;
    }

    // Allow prompt generation if: has reference images OR (has design type AND (blank mode OR has uploaded image))
    const hasRefImagesForSmartPrompt = referenceImages.length > 0;
    const hasValidDesignSetup = designType && (designType === 'blank' || uploadedImage);
    if (!hasRefImagesForSmartPrompt && !hasValidDesignSetup) return;

    setIsGeneratingPrompt(true);
    setPromptSuggestions([]);

    // Check if user has their own API key and notify them
    try {
      const { hasGeminiApiKey } = await import('../services/userSettingsService');
      const userHasApiKey = await hasGeminiApiKey();
      if (userHasApiKey) {
        toast.info('API do usuário está sendo usada', {
          duration: 3000,
        });
      }
    } catch (error) {
      // Silently fail - don't block generation if key check fails
      if (isLocalDevelopment()) {
        console.warn('Failed to check user API key:', error);
      }
    }

    try {
      // Compress image if it's too large for the API
      let imageToSend = uploadedImage;
      if (uploadedImage && needsCompression(uploadedImage.base64, 3.5 * 1024 * 1024)) { // Limit to 3.5MB for API safely
        try {
          if (isLocalDevelopment()) {
            console.log('🖼️ Compressing image for Smart Prompt API...');
          }
          const compressedBase64 = await compressImage(uploadedImage.base64, {
            maxSizeBytes: 3.5 * 1024 * 1024, // 3.5MB target
            maxWidth: 3072,
            maxHeight: 3072,
            quality: 0.8
          });

          imageToSend = {
            ...uploadedImage,
            base64: compressedBase64,
            size: getBase64ImageSize(compressedBase64)
          };

          if (isLocalDevelopment()) {
            console.log(`✅ Image compressed: ${(uploadedImage.size / 1024 / 1024).toFixed(2)}MB -> ${(imageToSend.size / 1024 / 1024).toFixed(2)}MB`);
          }
        } catch (compressionError) {
          console.warn('Failed to compress image for API, sending original:', compressionError);
        }
      }

      const smartPromptResult = await aiApi.generateSmartPrompt({
        baseImage: imageToSend,
        designType: designType,
        brandingTags: selectedBrandingTags,
        categoryTags: selectedTags,
        locationTags: selectedLocationTags,
        angleTags: selectedAngleTags,
        lightingTags: selectedLightingTags,
        effectTags: selectedEffectTags,
        selectedColors: selectedColors,
        aspectRatio: aspectRatio,
        generateText: generateText,
        withHuman: withHuman,
        enhanceTexture: enhanceTexture,
        negativePrompt: negativePrompt,
        additionalPrompt: additionalPrompt,
      });

      // Handle both old string format and new object format
      const smartPrompt = typeof smartPromptResult === 'string'
        ? smartPromptResult
        : smartPromptResult.prompt;

      // Always track prompt generation usage (even if tokens are not available, use 0)
      try {
        const inputTokens = typeof smartPromptResult === 'object' ? (smartPromptResult.inputTokens ?? 0) : 0;
        const outputTokens = typeof smartPromptResult === 'object' ? (smartPromptResult.outputTokens ?? 0) : 0;

        const token = authService.getToken();
        await fetch('/api/mockups/track-prompt-generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            inputTokens,
            outputTokens,
            feature: 'mockupmachine',
          }),
        });
      } catch (trackError) {
        if (isLocalDevelopment()) {
          console.error('Failed to track prompt generation:', trackError);
        }
        // Don't fail the prompt generation if tracking fails
      }

      // Add reference images instruction if present
      let finalPrompt = smartPrompt;
      if (referenceImages.length > 0) {
        finalPrompt += ` IMPORTANT: The provided reference image${referenceImages.length > 1 ? 's' : ''} ${referenceImages.length > 1 ? 'are' : 'is'} included as style and composition guidance. Study ${referenceImages.length > 1 ? 'these images' : 'this image'} carefully and create a mockup that matches the aesthetic, mood, composition style, lighting approach, color palette, and overall visual feeling of ${referenceImages.length > 1 ? 'these reference mockups' : 'this reference mockup'}. Use ${referenceImages.length > 1 ? 'them' : 'it'} as inspiration for creating a similar visual quality and atmosphere.`;
      }

      setPromptPreview(finalPrompt);
      generatedSmartPromptRef.current = finalPrompt; // Store for use in auto-generate
      setIsSmartPromptActive(true);
      setIsPromptManuallyEdited(false);
      setIsPromptReady(true);
      // Track that prompt is ready so manual edits can still allow direct generation
      promptWasReadyBeforeEditRef.current = true;

      toast.success(t('messages.promptGeneratedSuccessfully'), { duration: 4000 });

      // Scroll to generate outputs button after toast appears
      setTimeout(() => {
        if (generateOutputsButtonRef.current && sidebarRef.current) {
          const buttonRect = generateOutputsButtonRef.current.getBoundingClientRect();
          const sidebarRect = sidebarRef.current.getBoundingClientRect();
          const relativeTop = buttonRect.top - sidebarRect.top + sidebarRef.current.scrollTop;

          sidebarRef.current.scrollTo({
            top: relativeTop - 20,
            behavior: 'smooth'
          });
        } else {
          generateOutputsButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 800);
    } catch (err) {
      if (err instanceof RateLimitError) {
        toast.error(t('messages.rateLimit'), { duration: 5000 });
      } else {
        if (isLocalDevelopment()) {
          console.error("Error generating smart prompt:", err);
        }
        toast.error(t('messages.aiBusy'), { duration: 5000 });
      }
      setPromptPreview(buildPrompt());
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [uploadedImage, designType, selectedTags, selectedBrandingTags, selectedLocationTags, selectedAngleTags, selectedLightingTags, selectedEffectTags, selectedColors, aspectRatio, generateText, withHuman, enhanceTexture, negativePrompt, additionalPrompt, buildPrompt, t, isGeneratingPrompt, referenceImages]);

  useEffect(() => {
    // Tags changed - reset prompt ready state and track that it was reset
    setIsPromptReady(false);
    promptWasReadyBeforeEditRef.current = false;
  }, [
    JSON.stringify(selectedTags),
    JSON.stringify(selectedBrandingTags),
    designType,
    uploadedImage?.base64 ? 'hasImage' : 'noImage',
    JSON.stringify(selectedLocationTags),
    JSON.stringify(selectedAngleTags),
    JSON.stringify(selectedLightingTags),
    JSON.stringify(selectedEffectTags),
    JSON.stringify(selectedColors),
    aspectRatio,
    generateText,
    withHuman,
    enhanceTexture
  ]);


  const resetControls = useCallback(() => {
    setDesignType(null);
    setSelectedModel(null);
    setResolution('1K');
    setMockups(Array(mockupCount).fill(null));
    setSelectedTags([]);
    setSelectedBrandingTags([]);
    setSelectedLocationTags([]);
    setSelectedAngleTags([]);
    setSelectedLightingTags([]);
    setSelectedEffectTags([]);
    setSelectedMaterialTags([]);
    setSelectedColors([]);
    setColorInput('');
    setIsValidColor(false);
    setIsAdvancedOpen(false);
    setIsAllCategoriesOpen(false);
    setSuggestedTags([]);
    setHasGenerated(false);
    setNegativePrompt('');
    setAdditionalPrompt('');
    setGenerateText(false);
    setWithHuman(false);
    setIsSmartPromptActive(true);
    setPromptSuggestions([]);
    setPromptPreview('');
    setIsPromptManuallyEdited(false);
    setIsPromptReady(false);
    setMockups(Array(mockupCount).fill(null));
    setIsLoading(Array(mockupCount).fill(false));
    setReferenceImage(null);
    setReferenceImages([]);
    setSavedIndices(new Set());
    setSavedMockupIds(new Map());
    setMockupLikedStatus(new Map());
    setUploadedImage(null);
    setIsImagelessMode(false);
    // Clear localStorage when resetting
    clearMockupState();
  }, [mockupCount]);

  const handleImageUpload = useCallback(async (image: UploadedImage) => {
    // Check authentication using context state first
    if (isAuthenticated === false) {
      toast.error(t('messages.authenticationRequired'), { duration: 5000 });
      return;
    }

    // If still checking auth, verify with cache
    if (isAuthenticated === null || isCheckingAuth) {
      try {
        const user = await authService.verifyToken(); // Use verifyToken with cache
        if (!user) {
          toast.error(t('messages.authenticationRequired'), { duration: 5000 });
          return;
        }
      } catch (error) {
        toast.error(t('messages.authenticationError'), { duration: 5000 });
        return;
      }
    }

    // isAuthenticated === true, safe to proceed

    // Se estiver no modo blank mockup, a imagem é apenas referência visual
    if (designType === 'blank') {
      setReferenceImage(image);
      // Não reseta o estado, apenas atualiza a referência visual
      return;
    }

    // Para outros modos, a imagem é usada na geração
    // Reset controls primeiro (ele vai resetar uploadedImage, mas vamos setar depois)
    setReferenceImage(null);
    setReferenceImages([]);
    setIsImagelessMode(false);
    resetControls();
    // Agora seta uploadedImage DEPOIS do reset para que não seja sobrescrito
    setUploadedImage(image);
    setSelectedModel(null);
    setResolution('1K');
    // Por último, esconde welcome screen para garantir que fique false
    setShowWelcome(false);
  }, [designType, resetControls, isAuthenticated, isCheckingAuth]);

  const handleStartOver = () => {
    setUploadedImage(null);
    setReferenceImage(null);
    setReferenceImages([]);
    setIsImagelessMode(false);
    resetControls();
    setShowWelcome(true);
    // Clear persisted state from localStorage
    clearMockupState();
  };

  const handleDesignTypeChange = (type: DesignType) => {
    // Se mudar de blank para outro tipo, limpar referenceImage
    if (designType === 'blank' && type !== 'blank') {
      setReferenceImage(null);
      setReferenceImages([]);
    }
    setDesignType(type);
  };

  const handleProceedWithoutImage = useCallback(async () => {
    // Check authentication from context
    if (isAuthenticated !== true) {
      toast.error(t('messages.authenticationRequired'), { duration: 5000 });
      return;
    }
    // Hide welcome screen first
    setShowWelcome(false);
    // Set blank mockup mode
    setIsImagelessMode(true);
    setDesignType('blank');
    // Reset necessary controls without resetting designType
    setSelectedModel(null);
    setResolution('1K');
    setMockups(Array(mockupCount).fill(null));
    setIsLoading(Array(mockupCount).fill(false));
    setSelectedTags([]);
    setSelectedBrandingTags([]);
    setSelectedLocationTags([]);
    setSelectedAngleTags([]);
    setSelectedLightingTags([]);
    setSelectedEffectTags([]);
    setSelectedColors([]);
    setColorInput('');
    setIsValidColor(false);
    setIsAdvancedOpen(false);
    setIsAllCategoriesOpen(false);
    setSuggestedTags([]);
    setHasGenerated(false);
    setNegativePrompt('');
    setAdditionalPrompt('');
    setGenerateText(false);
    setWithHuman(false);
    setIsSmartPromptActive(true);
    setPromptSuggestions([]);
    setPromptPreview('');
    setIsPromptManuallyEdited(false);
    setIsPromptReady(false);
    setReferenceImage(null);
    setReferenceImages([]);
    setSavedIndices(new Set());
    setSavedMockupIds(new Map());
    setMockupLikedStatus(new Map());
    setUploadedImage(null);
  }, [isAuthenticated, mockupCount]);

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value.trim();
    setColorInput(newColor);
    setIsValidColor(/^#([0-9A-F]{3}){1,2}$/i.test(newColor));
  };

  const handleAddColor = () => {
    const sanitizedColor = colorInput.trim().toUpperCase();
    if (isValidColor && !selectedColors.includes(sanitizedColor) && selectedColors.length < 5) {
      setSelectedColors([...selectedColors, sanitizedColor]);
      setColorInput('');
      setIsValidColor(false);
    }
  };

  const handleRemoveColor = (colorToRemove: string) => {
    setSelectedColors(selectedColors.filter(color => color !== colorToRemove));
  };



  const handleNewAngles = useCallback(() => {
    if (selectedTags.length === 0) {
      const shuffledCategories = [...AVAILABLE_TAGS].sort(() => 0.5 - Math.random());
      setSelectedTags([shuffledCategories[0]]);
    }

    const currentAngle = selectedAngleTags[0];
    const availableAngles = currentAngle
      ? AVAILABLE_ANGLE_TAGS.filter(angle => angle !== currentAngle)
      : AVAILABLE_ANGLE_TAGS;

    if (availableAngles.length === 0) {
      const shuffled = [...AVAILABLE_ANGLE_TAGS].sort(() => 0.5 - Math.random());
      setSelectedAngleTags([shuffled[0]]);
    } else {
      const shuffled = [...availableAngles].sort(() => 0.5 - Math.random());
      setSelectedAngleTags([shuffled[0]]);
    }

    setTimeout(() => {
      setShouldAutoGenerate(true);
      setAutoGenerateSource('angles');
    }, 300);
  }, [selectedTags.length, selectedAngleTags]);

  const handleNewEnvironments = useCallback(() => {
    if (selectedTags.length === 0) {
      const shuffledCategories = [...AVAILABLE_TAGS].sort(() => 0.5 - Math.random());
      setSelectedTags([shuffledCategories[0]]);
    }

    const currentEnv = selectedLocationTags[0];
    const availableEnvs = currentEnv
      ? AVAILABLE_LOCATION_TAGS.filter(env => env !== currentEnv)
      : AVAILABLE_LOCATION_TAGS;

    if (availableEnvs.length === 0) {
      const shuffled = [...AVAILABLE_LOCATION_TAGS].sort(() => 0.5 - Math.random());
      setSelectedLocationTags([shuffled[0]]);
    } else {
      const shuffled = [...availableEnvs].sort(() => 0.5 - Math.random());
      setSelectedLocationTags([shuffled[0]]);
    }

    setTimeout(() => {
      setShouldAutoGenerate(true);
      setAutoGenerateSource('environments');
    }, 300);
  }, [selectedTags.length, selectedLocationTags]);

  const handleAnalyze = useCallback(async () => {
    if (!uploadedImage || designType === 'blank') {
      return;
    }

    setIsAnalyzing(true);

    try {
      // 1. Semantic Analysis via Gemini (tags for all sections)
      let imageToAnalyze = uploadedImage;
      if (uploadedImage && needsCompression(uploadedImage.base64, 3.5 * 1024 * 1024)) { // 3.5MB binary (safe for 4.5MB payload)
        try {
          if (isLocalDevelopment()) {
            console.log('🔍 Compressing image for Analysis API...');
          }
          const compressedBase64 = await compressImage(uploadedImage.base64, {
            maxSizeBytes: 3.5 * 1024 * 1024,
            maxWidth: 3072, // 3K resolution
            maxHeight: 3072,
            quality: 0.8
          });

          imageToAnalyze = {
            ...uploadedImage,
            base64: compressedBase64,
            size: getBase64ImageSize(compressedBase64)
          };

          if (isLocalDevelopment()) {
            console.log(`✅ Image compressed for analysis: ${(uploadedImage.size / 1024 / 1024).toFixed(2)}MB -> ${(imageToAnalyze.size / 1024 / 1024).toFixed(2)}MB`);
          }
        } catch (compressionError) {
          console.warn('Failed to compress image for analysis, sending original:', compressionError);
        }
      }

      const analysis = await aiApi.analyzeSetup(imageToAnalyze);

      setSuggestedBrandingTags(analysis.branding);
      setSuggestedTags(analysis.categories);
      setSuggestedLocationTags(analysis.locations);
      setSuggestedAngleTags(analysis.angles);
      setSuggestedLightingTags(analysis.lighting);
      setSuggestedEffectTags(analysis.effects);
      setSuggestedMaterialTags(analysis.materials);

      // Automatically set design type based on AI analysis
      // Fallback to 'logo' if AI doesn't return designType
      setDesignType(analysis.designType || 'logo');

      // 2. Color Extraction (Local processing for speed and cost-benefit)
      try {
        const { extractColors } = await import('@/utils/colorExtraction');
        const colorResult = await extractColors(uploadedImage.base64, uploadedImage.mimeType, 8);
        setSuggestedColors(colorResult.colors);
      } catch (colorErr) {
        console.error("Error extracting colors:", colorErr);
      }

      // 3. Auto-expand sections to display all suggested tags
      setIsAllCategoriesOpen(true);
      setIsAdvancedOpen(true);

      // 4. Auto-select default model if not already selected
      if (!selectedModel) {
        setSelectedModel('gemini-2.5-flash-image');
      }

    } catch (err) {
      if (err instanceof RateLimitError) {
        toast.error(t('messages.rateLimit'), { duration: 5000 });
      } else {
        if (isLocalDevelopment()) {
          console.error("Error getting full analysis:", err);
        }
        toast.error(t('messages.aiCouldntGenerateSuggestions'), { duration: 5000 });
      }
    } finally {
      setIsAnalyzing(false);
      setHasAnalyzed(true);
    }
  }, [uploadedImage, designType, t]);

  useEffect(() => {
    if (prevBrandingTagsLength.current === 0 && selectedBrandingTags.length === 1) {
      setIsAllCategoriesOpen(true);
    }
    prevBrandingTagsLength.current = selectedBrandingTags.length;
  }, [selectedBrandingTags]);




  // Check for unsaved images and warn before leaving
  useEffect(() => {
    const hasUnsavedImages = mockups.some((mockup, index) =>
      mockup !== null && !savedIndices.has(index)
    );

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedImages) {
        e.preventDefault();
        // Modern browsers ignore custom messages, but we still need to set returnValue
        e.returnValue = '';
        return '';
      }
    };

    if (hasUnsavedImages) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [mockups, savedIndices]);

  // Auto-collapse sections when reference images are uploaded
  useEffect(() => {
    const hasReferenceImage = referenceImage !== null || referenceImages.length > 0;
    const shouldCollapseSections = hasReferenceImage && uploadedImage !== null && designType !== 'blank';

    if (shouldCollapseSections) {
      // Collapse categories and advanced options
      setIsAllCategoriesOpen(false);
      setIsAdvancedOpen(false);

      // Auto-scroll to prompt section after a short delay
      setTimeout(() => {
        const promptSection = document.getElementById('prompt-section');
        const sidebar = sidebarRef.current;
        if (promptSection && sidebar) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const elementRect = promptSection.getBoundingClientRect();
          const relativeTop = elementRect.top - sidebarRect.top + sidebar.scrollTop;

          sidebar.scrollTo({
            top: relativeTop - 20,
            behavior: 'smooth'
          });
        }
      }, 300);
    }
  }, [referenceImage, referenceImages, uploadedImage, designType]);


  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setPromptPreview(newValue);
    if (isSmartPromptActive) {
      setIsSmartPromptActive(false);
    }
    setIsPromptManuallyEdited(true);
    // If prompt is manually edited and was ready before (tags haven't changed), keep it ready
    // This allows direct generation after manual editing if tags haven't changed
    if (newValue.trim().length > 0 && promptWasReadyBeforeEditRef.current) {
      setIsPromptReady(true);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPromptPreview(suggestion);
    if (isSmartPromptActive) setIsSmartPromptActive(false);
    setIsPromptManuallyEdited(false);
  };

  const handleSimplify = () => {
    setPromptPreview(buildPrompt());
    setIsSmartPromptActive(false);
    setIsPromptManuallyEdited(false);
    setPromptSuggestions([]);
  };

  const handleSuggestPrompts = async () => {
    if (!promptPreview.trim()) return;
    setIsSuggestingPrompts(true);
    setPromptSuggestions([]);
    try {
      const suggestions = await aiApi.suggestPromptVariations(promptPreview);
      setPromptSuggestions(suggestions);
    } catch (err) {
      if (err instanceof RateLimitError) {
        toast.error(t('messages.rateLimit'), { duration: 5000 });
      } else {
        if (isLocalDevelopment()) {
          console.error("Error suggesting prompts:", err);
        }
        toast.error(t('messages.aiCouldntBrainstorm'), { duration: 5000 });
      }
    } finally {
      setIsSuggestingPrompts(false);
    }
  };

  // Helper function to compress images before sending
  const compressImageIfNeeded = useCallback(async (image: UploadedImage | null | undefined): Promise<UploadedImage | undefined> => {
    if (!image || !image.base64) return undefined;

    try {
      // Check if compression is needed (larger than 4.5MB)
      // Vercel limit is ~4.5MB for body, but with 10MB limit in WelcomeScreen, we want to allow as much as possible
      // We'll use 4.5MB as the trigger, which is close to the limit (binary size)
      // Note: 4.5MB binary is ~6MB base64 which might fail Vercel (4.5MB limit applies to body).
      // Wait, Vercel limit is 4.5MB *Body Size*. 
      // 3MB binary = 4MB Base64. 4.5MB Body Limit.
      // So 3.5MB is the absolute max safe binary size.
      const maxSizeBytes = 3.5 * 1024 * 1024; // 3.5MB (Safe limit for 4.5MB payload)
      if (needsCompression(image.base64, maxSizeBytes)) {
        if (isLocalDevelopment()) {
          console.log('[MockupMachinePage] Compressing image before sending...', {
            originalSize: (getBase64ImageSize(image.base64) / 1024 / 1024).toFixed(2) + 'MB',
            targetLimit: '3.5MB'
          });
        }

        const compressedBase64 = await compressImage(image.base64, {
          maxWidth: 3072, // 3K resolution (preserve more detail)
          maxHeight: 3072,
          maxSizeBytes: maxSizeBytes,
          quality: 0.85,
          mimeType: image.mimeType
        });

        // Extract base64 data and mime type from compressed result
        const base64Data = compressedBase64.includes(',')
          ? compressedBase64.split(',')[1]
          : compressedBase64;
        const mimeType = compressedBase64.startsWith('data:')
          ? compressedBase64.match(/data:([^;]+);/)?.[1] || image.mimeType
          : image.mimeType;

        const compressedSize = (getBase64ImageSize(compressedBase64) / 1024 / 1024).toFixed(2);
        if (isLocalDevelopment()) {
          console.log('[MockupMachinePage] Image compressed successfully', {
            compressedSize: compressedSize + 'MB'
          });
        }

        return {
          base64: base64Data,
          mimeType: mimeType
        };
      }

      return image;
    } catch (error) {
      if (isLocalDevelopment()) {
        console.error('[MockupMachinePage] Failed to compress image, using original:', error);
      }
      return image;
    }
  }, []);

  // Helper function to check if user has enough credits
  const hasEnoughCredits = useCallback((creditsNeeded: number): boolean => {
    // In local development, always allow operations
    if (isLocalDevelopment()) {
      return true;
    }

    // If no subscription status available, consider as no credits
    if (!subscriptionStatus) {
      return false;
    }

    // Check if user has enough credits
    const totalCredits = subscriptionStatus.totalCredits || 0;

    // Block if user has 0 credits available
    if (totalCredits === 0) {
      return false;
    }

    return totalCredits >= creditsNeeded;
  }, [subscriptionStatus]);

  const validateAuthAndSubscription = useCallback(async (
    creditsNeeded?: number,
    model?: GeminiModel | null,
    resolution?: Resolution
  ): Promise<boolean> => {
    let actualCreditsNeeded = creditsNeeded;
    if (actualCreditsNeeded === undefined && model) {
      const creditsPerImage = getCreditsRequired(model, resolution);
      actualCreditsNeeded = mockupCount * creditsPerImage;
    } else if (actualCreditsNeeded === undefined) {
      actualCreditsNeeded = 1;
    }
    if (!isLocalDevelopment()) {
      // Check authentication from context
      if (isAuthenticated !== true) {
        toast.error(t('messages.authenticationRequired'), { duration: 5000 });
        return false;
      }
    }

    if (!isLocalDevelopment()) {
      // Only check if user has enough credits available
      // Don't block based on subscription status - allow users without subscription to try
      if (subscriptionStatus) {
        // totalCredits already includes both earned credits (purchased) and monthly credits remaining
        // So we should use it directly for both subscribed and free users
        const totalCredits = subscriptionStatus.totalCredits || 0;
        const remaining = totalCredits;

        // Only show error if user has no credits available
        if (remaining < actualCreditsNeeded) {
          const resetDate = subscriptionStatus.creditsResetDate ? new Date(subscriptionStatus.creditsResetDate).toLocaleDateString() : t('messages.yourNextBillingCycle');
          const message = subscriptionStatus.hasActiveSubscription
            ? t('messages.needCreditsSubscription', {
              creditsNeeded: actualCreditsNeeded,
              plural: actualCreditsNeeded > 1 ? 's' : '',
              remaining,
              pluralRemaining: remaining > 1 ? 's' : '',
              resetDate
            })
            : t('messages.needCreditsButHave', {
              creditsNeeded: actualCreditsNeeded,
              plural: actualCreditsNeeded > 1 ? 's' : '',
              remaining,
              pluralRemaining: remaining > 1 ? 's' : ''
            });

          toast.error(message, { duration: 5000 });
          // Open credit packages modal first (default for users without credits)
          onCreditPackagesModalOpen();
          return false;
        }
      } else {
        // If no subscription status available, assume user has no credits
        toast.error(t('messages.needCredits', { creditsNeeded: actualCreditsNeeded, plural: actualCreditsNeeded > 1 ? 's' : '' }), { duration: 5000 });
        // Open credit packages modal first (default for users without credits)
        onCreditPackagesModalOpen();
        return false;
      }
    }

    return true;
  }, [subscriptionStatus, mockupCount, onSubscriptionModalOpen, isAuthenticated, t]);

  const executeImageEditOperation = useCallback(async (params: {
    base64Image: string;
    prompt: string;
    onSuccess: (result: string) => void;
    setIsLoading: (loading: boolean) => void;
    promptLength?: number;
  }): Promise<void> => {
    const { base64Image, prompt, onSuccess, setIsLoading, promptLength = 0 } = params;

    const modelToUse = selectedModel || 'gemini-2.5-flash-image';
    const resolutionToUse = modelToUse === 'gemini-3-pro-image-preview' ? resolution : undefined;

    const canProceed = await validateAuthAndSubscription(undefined, modelToUse, resolutionToUse);
    if (!canProceed) return;

    setIsLoading(true);

    try {
      // Normalize image to base64 (handles URLs correctly)
      const normalizedBase64 = await normalizeImageToBase64(base64Image);
      const mimeType = detectMimeType(base64Image);

      const referenceImage: UploadedImage = {
        base64: normalizedBase64,
        mimeType: mimeType
      };

      // Compress reference image if needed to prevent payload too large errors
      const compressedReferenceImage = await compressImageIfNeeded(referenceImage);
      if (!compressedReferenceImage) {
        throw new Error(t('messages.failedToProcessReferenceImage'));
      }

      // Compress reference images if available
      let compressedReferenceImages: UploadedImage[] | undefined;
      if (referenceImages.length > 0) {
        const compressionPromises = referenceImages.map(img => compressImageIfNeeded(img));
        const compressed = await Promise.all(compressionPromises);
        compressedReferenceImages = compressed.filter((img): img is UploadedImage => img !== undefined);
      }

      // Use reference images if available (Pro: up to 3, HD: up to 1)
      const referenceImagesToUse = compressedReferenceImages && compressedReferenceImages.length > 0
        ? compressedReferenceImages
        : undefined;

      // CRITICAL: Use backend endpoint which validates and deducts credits BEFORE generation
      const result = await mockupApi.generate({
        promptText: prompt,
        baseImage: {
          base64: compressedReferenceImage.base64,
          mimeType: compressedReferenceImage.mimeType
        },
        model: modelToUse,
        resolution: resolutionToUse,
        aspectRatio: aspectRatio,
        referenceImages: referenceImagesToUse?.map(img => ({
          base64: img.base64,
          mimeType: img.mimeType
        })),
        imagesCount: 1
      });

      onSuccess(result.imageBase64);

      // Show credit deduction notification
      if (result.isAdmin) {
        toast.info(t('credits.notificationUsedAdmin'));
      } else if (result.creditsDeducted > 0) {
        const plural = result.creditsDeducted > 1 ? 's' : '';
        const remainingPlural = result.creditsRemaining > 1 ? 's' : '';
        toast.success(
          `${t('credits.notificationUsed', { count: result.creditsDeducted, plural })}. ${t('credits.notificationRemaining', { remaining: result.creditsRemaining, plural: remainingPlural })}`
        );
      }

      // Credits were already deducted by backend before generation
      // Update subscription status to reflect new credits
      try {
        const updatedStatus = await subscriptionService.getSubscriptionStatus();
        setSubscriptionStatus(updatedStatus);
      } catch (statusError: any) {
        if (isLocalDevelopment()) {
          console.error('Failed to refresh subscription status:', statusError);
        }
        // Non-critical - credits were already deducted, just status refresh failed
      }
    } catch (err) {
      if (isLocalDevelopment()) {
        console.error('Error in image edit operation:', err);
      }
      const errorInfo = getErrorMessage(err);
      toast.error(errorInfo.message, {
        description: errorInfo.suggestion,
        duration: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [validateAuthAndSubscription, selectedModel, resolution, aspectRatio, onSubscriptionModalOpen, setSubscriptionStatus, compressImageIfNeeded, referenceImages, t]);

  const runGeneration = useCallback(async (indexToUpdate?: number, promptOverride?: string, appendMode: boolean = false) => {
    // Prevent multiple simultaneous calls to runGeneration
    // Check if any generation is currently in progress
    if (isLoading.some(Boolean)) {
      if (isLocalDevelopment()) {
        console.warn('[runGeneration] Generation already in progress, ignoring duplicate call');
      }
      return;
    }

    if (!selectedModel) {
      toast.error(t('messages.selectModelBeforeGenerating'), { duration: 5000 });
      return;
    }

    const modelToUse = selectedModel || 'gemini-2.5-flash-image';
    const resolutionToUse = modelToUse === 'gemini-3-pro-image-preview' ? resolution : undefined;

    const canProceed = await validateAuthAndSubscription(undefined, modelToUse, resolutionToUse);
    if (!canProceed) return;

    const promptToUse = promptOverride || promptPreview;
    // Allow generation if: has reference images OR (has design type AND (blank mode OR has uploaded image)) AND has prompt
    const hasReferenceImages = referenceImages.length > 0;
    const hasValidSetup = hasReferenceImages || (designType && (designType === 'blank' || uploadedImage));
    if (!hasValidSetup || !promptToUse.trim()) {
      toast.error(t('messages.completeSteps'), { duration: 5000 });
      return;
    }

    if (!hasGenerated) setHasGenerated(true);

    const generateAndSet = async (index: number) => {
      let imageGenerated = false;

      try {
        // Note: Credit validation and deduction now happens in backend endpoint
        // No need to validate here - backend will return error if insufficient credits

        // No modo blank, não passa imagem (apenas referência visual)
        const baseImageForGeneration = designType === 'blank' ? undefined : (uploadedImage || undefined);

        // Compress base image if needed to prevent payload too large errors
        const compressedBaseImage = await compressImageIfNeeded(baseImageForGeneration);

        // Compress reference images if needed
        let compressedReferenceImages: UploadedImage[] | undefined;
        if (referenceImages.length > 0) {
          const compressionPromises = referenceImages.map(img => compressImageIfNeeded(img));
          const compressed = await Promise.all(compressionPromises);
          compressedReferenceImages = compressed.filter((img): img is UploadedImage => img !== undefined);
        }

        // Use reference images if available (Pro: up to 3, HD: up to 1)
        const referenceImagesToUse = compressedReferenceImages && compressedReferenceImages.length > 0
          ? compressedReferenceImages
          : undefined;

        // CRITICAL: Use backend endpoint which validates and deducts credits BEFORE generation
        // This prevents abuse and ensures credits are always deducted atomically
        // Pass slot index as uniqueId to allow parallel batch requests with same parameters
        const result = await mockupApi.generate({
          promptText: promptToUse,
          baseImage: compressedBaseImage ? {
            base64: compressedBaseImage.base64,
            mimeType: compressedBaseImage.mimeType
          } : undefined,
          model: modelToUse,
          resolution: resolutionToUse,
          aspectRatio: aspectRatio,
          referenceImages: referenceImagesToUse?.map(img => ({
            base64: img.base64,
            mimeType: img.mimeType
          })),
          imagesCount: 1,
          feature: 'mockupmachine',
          uniqueId: index // Use slot index to differentiate parallel batch requests
        });

        // Image successfully generated - set it in state (prefer URL from R2 if available)
        imageGenerated = true;
        const finalImage = result.imageUrl || result.imageBase64;
        setMockups(prev => { const newMockups = [...prev]; newMockups[index] = finalImage; return newMockups; });

        // Show credit deduction notification
        if (result.isAdmin) {
          toast.info(t('credits.notificationUsedAdmin'));
        } else if (result.creditsDeducted > 0) {
          const plural = result.creditsDeducted > 1 ? 's' : '';
          const remainingPlural = result.creditsRemaining > 1 ? 's' : '';
          toast.success(
            `${t('credits.notificationUsed', { count: result.creditsDeducted, plural })}. ${t('credits.notificationRemaining', { remaining: result.creditsRemaining, plural: remainingPlural })}`
          );
        }

        // Credits were already deducted by backend before generation
        // Update subscription status to reflect new credits
        try {
          const updatedStatus = await subscriptionService.getSubscriptionStatus();
          setSubscriptionStatus(updatedStatus);
        } catch (statusError: any) {
          if (isLocalDevelopment()) {
            console.error('Failed to refresh subscription status:', statusError);
          }
          // Non-critical - credits were already deducted, just status refresh failed
        }
      } catch (err) {
        if (isLocalDevelopment()) {
          console.error(`Error generating mockup for slot ${index}:`, err);
        }
        const errorInfo = getErrorMessage(err);

        // Only show error if image wasn't generated
        if (!imageGenerated) {
          toast.error(errorInfo.message, {
            description: errorInfo.suggestion,
            duration: 7000,
          });
          setMockups(prev => { const newMockups = [...prev]; newMockups[index] = null; return newMockups; });
        }
      } finally {
        setIsLoading(prev => { const newLoading = [...prev]; newLoading[index] = false; return newLoading; });
      }
    };

    if (indexToUpdate !== undefined) {
      setIsLoading(prev => { const newLoading = [...prev]; newLoading[indexToUpdate] = true; return newLoading; });
      await generateAndSet(indexToUpdate);
    } else {
      if (appendMode) {
        // Append mode: add new slots at the end without replacing existing ones
        // Get current length before adding new slots
        const currentLength = mockups.length;
        const newStartIndex = currentLength;

        setMockups(prev => {
          const newMockups = [...prev];
          // Add new slots for the generation (based on mockupCount)
          for (let i = 0; i < mockupCount; i++) {
            newMockups.push(null);
          }
          return newMockups;
        });

        setIsLoading(prev => {
          const newLoading = [...prev];
          // Add loading state for new slots
          for (let i = 0; i < mockupCount; i++) {
            newLoading.push(true);
          }
          return newLoading;
        });

        setPromptSuggestions([]);

        // Generate all new mockups in parallel
        const promises = Array.from({ length: mockupCount }, (_, i) =>
          generateAndSet(newStartIndex + i)
        );
        await Promise.allSettled(promises);

        // Refresh subscription status after all generations complete
        // Note: Usage tracking is handled in generateAndSet for each image
        // In local development, credits aren't deducted so no need to refresh
        const isLocal = isLocalDevelopment();
        if (!isLocal) {
          try {
            const updatedStatus = await subscriptionService.getSubscriptionStatus();
            setSubscriptionStatus(updatedStatus);
          } catch (statusError: any) {
            if (isLocalDevelopment()) {
              console.error('Failed to refresh subscription status after append generation:', statusError);
            }
          }
        }
      } else {
        // Normal mode: adjust arrays to match mockupCount when generating new images
        setMockups(prev => {
          const newMockups = [...prev];
          // Only expand if needed, never shrink to preserve existing images
          while (newMockups.length < mockupCount) {
            newMockups.push(null);
          }
          // Reset only the slots that will be generated (up to mockupCount)
          for (let i = 0; i < mockupCount; i++) {
            newMockups[i] = null;
          }
          return newMockups;
        });

        setIsLoading(prev => {
          const newLoading = [...prev];
          // Only expand if needed
          while (newLoading.length < mockupCount) {
            newLoading.push(false);
          }
          // Set loading for slots that will be generated
          for (let i = 0; i < mockupCount; i++) {
            newLoading[i] = true;
          }
          return newLoading;
        });

        setPromptSuggestions([]);

        // Track which images were successfully generated for batch tracking
        const successfulIndices: number[] = [];
        const promises = Array.from({ length: mockupCount }, (_, i) =>
          generateAndSet(i)
            .then(() => {
              // Only count as successful if image was actually generated
              // generateAndSet always tracks usage for each successfully generated image
              if (mockups[i] !== null) {
                successfulIndices.push(i);
              }
            })
            .catch(() => { })
        );
        await Promise.allSettled(promises);

        // Count successful generations
        const successfulCount = successfulIndices.length;

        // Note: Usage tracking is automatically handled in generateAndSet for each image
        // Each successfully generated mockup will have a corresponding usage_record
        // This ensures accurate tracking and credits are only deducted for successful generations

        // Refresh subscription status after all generations complete
        // Note: Usage tracking is handled in generateAndSet for each image
        // In local development, credits aren't deducted so no need to refresh
        const isLocal = isLocalDevelopment();
        if (successfulCount > 0 && !isLocal) {
          try {
            const updatedStatus = await subscriptionService.getSubscriptionStatus();
            setSubscriptionStatus(updatedStatus);
          } catch (statusError: any) {
            if (isLocalDevelopment()) {
              console.error('Failed to refresh subscription status after batch generation:', statusError);
            }
          }
        }
      }
    }
  }, [uploadedImage, selectedTags, selectedBrandingTags, promptPreview, hasGenerated, designType, mockupCount, subscriptionStatus, aspectRatio, selectedModel, resolution, validateAuthAndSubscription, onSubscriptionModalOpen, setSubscriptionStatus, mockups, referenceImages, compressImageIfNeeded, t]);

  const handleSurpriseMe = useCallback(async (autoGenerate: boolean = false) => {
    // Ensure model is selected (default to gemini-2.5-flash-image if not set)
    const modelToUse = selectedModel || 'gemini-2.5-flash-image';
    if (!selectedModel) {
      setSelectedModel('gemini-2.5-flash-image');
    }

    // Ensure designType is set (default to 'blank' if not set, since Surprise Me works without image)
    const designTypeToUse = designType || 'blank';
    if (!designType) {
      setDesignType('blank');
    }

    // Keep existing branding tags - don't change them
    // Use current branding tags from state
    const brandingTagsToUse = selectedBrandingTags.length > 0 ? selectedBrandingTags : [];

    // Load selected tags from settings
    const selectedTagsSettings = getSurpriseMeSelectedTags();

    // 1. Categories: Prioritize AI suggestions
    let selectedCategory: string;
    const aiSuggestedCategories = suggestedTags || [];
    const userAllowedCategories = selectedTagsSettings.selectedCategoryTags;

    const filteredAiCategories = aiSuggestedCategories.filter(tag =>
      userAllowedCategories.length === 0 || userAllowedCategories.includes(tag)
    );

    if (filteredAiCategories.length > 0) {
      selectedCategory = filteredAiCategories[Math.floor(Math.random() * filteredAiCategories.length)];
    } else {
      const availableCategories = GENERIC_MOCKUP_TAGS.filter(tag =>
        userAllowedCategories.length === 0 || userAllowedCategories.includes(tag)
      );
      const categoriesToPickFrom = availableCategories.length > 0 ? availableCategories : GENERIC_MOCKUP_TAGS;
      selectedCategory = categoriesToPickFrom[Math.floor(Math.random() * categoriesToPickFrom.length)];
    }
    setSelectedTags([selectedCategory]);

    // 2. Location: Prioritize AI suggestions
    let selectedBackground: string;
    const aiSuggestedLocations = suggestedLocationTags || [];
    const userAllowedLocations = selectedTagsSettings.selectedLocationTags;

    // First filter AI suggestions by user's "Surprise Me" settings
    const filteredAiLocations = aiSuggestedLocations.filter(tag =>
      userAllowedLocations.length === 0 || userAllowedLocations.includes(tag)
    );

    if (filteredAiLocations.length > 0) {
      selectedBackground = filteredAiLocations[Math.floor(Math.random() * filteredAiLocations.length)];
    } else {
      // Fallback: Pick based on branding but respect user selection
      const suitableBackgrounds = getBackgroundsForBranding(brandingTagsToUse);
      const filteredBackgrounds = suitableBackgrounds.filter(bg =>
        bg !== 'Nature landscape' && (
          userAllowedLocations.length === 0 ||
          userAllowedLocations.includes(bg)
        )
      );

      // Add preferred options if not already included
      const preferredOptions = ['Light Box', 'Minimalist Studio'];
      const backgroundsToUse = filteredBackgrounds.length > 0
        ? [...new Set([...preferredOptions, ...filteredBackgrounds])]
        : [...new Set([...preferredOptions, ...suitableBackgrounds])];

      selectedBackground = backgroundsToUse[Math.floor(Math.random() * backgroundsToUse.length)];
    }
    setSelectedLocationTags([selectedBackground]);

    // 3. Presets and Tags: Prioritize AI suggestions for Angle, Lighting, Effect, etc.
    let selectedPresets: {
      angle?: AnglePreset;
      texture?: TexturePreset;
      ambience?: AmbiencePreset;
      luminance?: LuminancePreset;
    } = {};

    try {
      const { determineArchetypeFromBranding, getRandomArchetype } = await import('@/utils/promptHelpers');
      const [allAnglePresets, allTexturePresets, allAmbiencePresets, allLuminancePresets] = await Promise.all([
        getAllAnglePresetsAsync().catch(() => [] as AnglePreset[]),
        getAllTexturePresetsAsync().catch(() => [] as TexturePreset[]),
        getAllAmbiencePresetsAsync().catch(() => [] as AmbiencePreset[]),
        getAllLuminancePresetsAsync().catch(() => [] as LuminancePreset[]),
      ]);

      // --- ARCHETYPE LOGIC START ---
      // Determine archetype based on branding OR random chance
      let currentArchetype = determineArchetypeFromBranding(brandingTagsToUse);

      // 20% chance to ignore branding and pick a random archetype for variety
      // OR if no branding tags provided
      if (!currentArchetype || Math.random() < 0.2) {
        currentArchetype = getRandomArchetype();
      }

      console.log('[SurpriseMe] Selected Archetype:', currentArchetype.name);

      // Helper to pick a tag from archetype preference (80% chance) or random (20% chance)
      const pickTagWithVariety = (archetypeTags: string[], availableTags: string[], userAllowedTags: string[] = []): string => {
        const shouldUseArchetype = Math.random() < 0.8;
        let pool = availableTags;

        // Filter by user allowed tags if any
        if (userAllowedTags.length > 0) {
          pool = pool.filter(t => userAllowedTags.includes(t));
        }

        if (shouldUseArchetype && archetypeTags && archetypeTags.length > 0) {
          // Try to find archetype tags that are also in the allowed pool
          const archetypePool = archetypeTags.filter(t =>
            userAllowedTags.length === 0 || userAllowedTags.includes(t)
          );

          if (archetypePool.length > 0) {
            return archetypePool[Math.floor(Math.random() * archetypePool.length)];
          }
        }

        // Fallback to random from pool
        return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : "";
      };

      // SELECT LOCATION
      const userAllowedLocations = selectedTagsSettings.selectedLocationTags;
      if (currentArchetype.visuals.locations) {
        selectedBackground = pickTagWithVariety(currentArchetype.visuals.locations, AVAILABLE_LOCATION_TAGS, userAllowedLocations);
      }
      setSelectedLocationTags([selectedBackground || selectRandomBackground(brandingTagsToUse)]);

      // SELECT LIGHTING
      const userAllowedLighting = selectedTagsSettings.selectedLightingTags;
      let lightingTag = "";
      if (currentArchetype.visuals.lighting) {
        lightingTag = pickTagWithVariety(currentArchetype.visuals.lighting, AVAILABLE_LIGHTING_TAGS, userAllowedLighting);
      }
      if (!lightingTag) {
        // Fallback
        const availableLighting = userAllowedLighting.length > 0 ? userAllowedLighting : AVAILABLE_LIGHTING_TAGS;
        lightingTag = availableLighting[Math.floor(Math.random() * availableLighting.length)];
      }
      setSelectedLightingTags([lightingTag]);

      // SELECT EFFECT (Optional - 50% chance)
      const userAllowedEffects = selectedTagsSettings.selectedEffectTags;
      if (Math.random() < 0.5) {
        let effectTag = "";
        if (currentArchetype.visuals.effects) {
          effectTag = pickTagWithVariety(currentArchetype.visuals.effects, AVAILABLE_EFFECT_TAGS, userAllowedEffects);
        }
        if (!effectTag) {
          const availableEffects = userAllowedEffects.length > 0 ? userAllowedEffects : AVAILABLE_EFFECT_TAGS;
          effectTag = availableEffects[Math.floor(Math.random() * availableEffects.length)];
        }
        setSelectedEffectTags([effectTag]);
      } else {
        setSelectedEffectTags([]);
      }

      // SELECT MATERIAL (If Logo)
      if (designType === 'logo') {
        const userAllowedMaterials = selectedTagsSettings.selectedMaterialTags;
        let materialTag = "";
        if (currentArchetype.visuals.materials) {
          materialTag = pickTagWithVariety(currentArchetype.visuals.materials, AVAILABLE_MATERIAL_TAGS, userAllowedMaterials);
        }
        if (!materialTag) {
          const availableMaterials = userAllowedMaterials.length > 0 ? userAllowedMaterials : AVAILABLE_MATERIAL_TAGS;
          materialTag = availableMaterials[Math.floor(Math.random() * availableMaterials.length)];
        }
        setSelectedMaterialTags([materialTag]);
      }

      // SELECT ANGLE (Random but consistent)
      const userAllowedAngles = selectedTagsSettings.selectedAngleTags;
      const availableAngles = userAllowedAngles.length > 0 ? userAllowedAngles : AVAILABLE_ANGLE_TAGS;
      const angleTag = availableAngles[Math.floor(Math.random() * availableAngles.length)];
      setSelectedAngleTags([angleTag]);

      // --- ARCHETYPE LOGIC END ---

      // Fallback filtering for presets (keeping existing logic for safety)
      const filteredAnglePresets = filterPresetsByBranding(allAnglePresets, brandingTagsToUse);
      const filteredTexturePresets = filterPresetsByBranding(allTexturePresets, brandingTagsToUse);
      const filteredAmbiencePresets = filterPresetsByBranding(allAmbiencePresets, brandingTagsToUse);
      const filteredLuminancePresets = filterPresetsByBranding(allLuminancePresets, brandingTagsToUse);

      if (filteredAnglePresets.length > 0 && Math.random() < 0.4) {
        selectedPresets.angle = filteredAnglePresets[Math.floor(Math.random() * filteredAnglePresets.length)];
      }
      if (filteredTexturePresets.length > 0 && Math.random() < 0.3) {
        selectedPresets.texture = filteredTexturePresets[Math.floor(Math.random() * filteredTexturePresets.length)];
      }
      if (filteredAmbiencePresets.length > 0 && Math.random() < 0.5) {
        selectedPresets.ambience = filteredAmbiencePresets[Math.floor(Math.random() * filteredAmbiencePresets.length)];
      }
      if (filteredLuminancePresets.length > 0 && Math.random() < 0.5) {
        selectedPresets.luminance = filteredLuminancePresets[Math.floor(Math.random() * filteredLuminancePresets.length)];
      }
    } catch (error) {
      console.warn('Failed to load presets, using fallback logic:', error);
    }

    // Helper for picking tags (prioritizing AI suggestions)
    const pickTag = (suggested: string[], availableFromSettings: string[], allAvailable: string[], probability: number) => {
      if (Math.random() > probability) return null;

      // Filter suggested by settings
      const filteredSuggested = suggested.filter(tag =>
        availableFromSettings.length === 0 || availableFromSettings.includes(tag)
      );

      if (filteredSuggested.length > 0) {
        return filteredSuggested[Math.floor(Math.random() * filteredSuggested.length)];
      }

      // Fallback to settings-allowed tags
      if (availableFromSettings.length > 0) {
        return availableFromSettings[Math.floor(Math.random() * availableFromSettings.length)];
      }

      // Final fallback
      return allAvailable[Math.floor(Math.random() * allAvailable.length)];
    };

    const userAllowedAngles = selectedTagsSettings.selectedAngleTags;
    const userAllowedLightings = selectedTagsSettings.selectedLightingTags;
    const userAllowedEffects = selectedTagsSettings.selectedEffectTags;
    const userAllowedMaterials = selectedTagsSettings.selectedMaterialTags;

    const randomAngle = selectedPresets.angle ? null : pickTag(suggestedAngleTags || [], userAllowedAngles, AVAILABLE_ANGLE_TAGS, 0.5);
    const randomLighting = selectedPresets.luminance ? null : pickTag(suggestedLightingTags || [], userAllowedLightings, AVAILABLE_LIGHTING_TAGS, 0.6);
    const randomEffect = pickTag(suggestedEffectTags || [], userAllowedEffects, AVAILABLE_EFFECT_TAGS, 0.4);
    const randomMaterial = pickTag(suggestedMaterialTags || [], userAllowedMaterials, AVAILABLE_MATERIAL_TAGS, 0.3);

    setSelectedAngleTags(randomAngle ? [randomAngle] : []);
    setSelectedLightingTags(randomLighting ? [randomLighting] : []);
    setSelectedEffectTags(randomEffect ? [randomEffect] : []);
    setSelectedMaterialTags(randomMaterial ? [randomMaterial] : []);
    setSelectedColors([]);

    // Reset prompt and manual edit state so auto-generation can proceed
    setPromptPreview('');
    setIsPromptReady(false);
    setIsPromptManuallyEdited(false);

    setIsAllCategoriesOpen(true);
    setIsAdvancedOpen(true);

    // Alternar o checkbox "generate human" de forma aleatória
    const randomWithHuman = Math.random() < 0.5;
    setWithHuman(randomWithHuman);

    if (autoGenerate) {
      // Auto-generate mode: Set tags -> Auto Generate Prompt -> Auto Generate Output
      setTimeout(() => {
        setShouldAutoGenerate(true);
        setAutoGenerateSource('surprise');
      }, 420); // Delay to allow state updates to settle

      // Scroll to generate outputs button after state changes are applied
      setTimeout(() => {
        if (generateOutputsButtonRef.current && sidebarRef.current) {
          const buttonRect = generateOutputsButtonRef.current.getBoundingClientRect();
          const sidebarRect = sidebarRef.current.getBoundingClientRect();
          const relativeTop = buttonRect.top - sidebarRect.top + sidebarRef.current.scrollTop;

          sidebarRef.current.scrollTo({
            top: relativeTop - 20,
            behavior: 'smooth'
          });
        } else {
          generateOutputsButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 600);
    } else {
      // Manual mode: Set tags -> Wait for user review
      // We set source to 'surprise' so that WHEN they click generate, it proceeds to image generation automatically
      setTimeout(() => {
        setAutoGenerateSource('surprise');

        // Scroll to the categories section so user can review the surprised tags
        const categoriesSection = document.getElementById('categories-section');
        const sidebar = document.getElementById('sidebar');
        if (categoriesSection && sidebar) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const elementRect = categoriesSection.getBoundingClientRect();
          const relativeTop = elementRect.top - sidebarRect.top + sidebar.scrollTop;

          sidebar.scrollTo({
            top: relativeTop - 20,
            behavior: 'smooth'
          });
        }
      }, 420);
    }
  }, [aspectRatio, designType, selectedModel, selectedBrandingTags, generateText, withHuman, additionalPrompt, negativePrompt, runGeneration, mockups]);

  const handleSaveAllUnsaved = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error(t('messages.authenticationRequired'), { duration: 5000 });
      return;
    }

    const unsavedIndices = mockups
      .map((mockup, index) => (mockup !== null && !savedIndices.has(index) ? index : null))
      .filter((index): index is number => index !== null);

    if (unsavedIndices.length === 0) {
      return;
    }

    try {
      // Save all unsaved images
      const savePromises = unsavedIndices.map(async (index) => {
        const imageBase64 = mockups[index];
        if (imageBase64) {
          const isLiked = mockupLikedStatus.get(index) ?? false;

          const savedMockup = await mockupApi.save({
            imageBase64: imageBase64,
            prompt: promptPreview,
            designType: designType || 'blank',
            tags: selectedTags,
            brandingTags: selectedBrandingTags,
            aspectRatio: aspectRatio,
            isLiked: isLiked,
          });

          // Update liked status from saved mockup
          if (savedMockup._id) {
            setMockupLikedStatus(prev => new Map(prev).set(index, savedMockup.isLiked ?? isLiked));
          }

          return { index, mockupId: savedMockup._id };
        }
        return null;
      });

      const results = await Promise.all(savePromises);

      // Mark all as saved and store mockup IDs
      setSavedIndices(prev => new Set([...prev, ...unsavedIndices]));
      setSavedMockupIds(prev => {
        const newMap = new Map(prev);
        results.forEach(result => {
          if (result && result.mockupId) {
            newMap.set(result.index, result.mockupId);
          }
        });
        return newMap;
      });

      toast.success(t('messages.savedOutputs', { count: unsavedIndices.length, plural: unsavedIndices.length > 1 ? 's' : '' }), { duration: 3000 });
    } catch (error: any) {
      if (isLocalDevelopment()) {
        console.error('Failed to save all mockups:', error);
      }
      toast.error(t('messages.failedToSaveOutputs'), { duration: 5000 });
      throw error;
    }
  }, [isAuthenticated, mockups, savedIndices, mockupLikedStatus, promptPreview, designType, selectedTags, selectedBrandingTags, aspectRatio]);

  // Register handlers with Layout context for Header to use
  useEffect(() => {
    if (registerUnsavedOutputsHandler) {
      registerUnsavedOutputsHandler(() => {
        const hasUnsaved = mockups.some((mockup, index) =>
          mockup !== null && !savedIndices.has(index)
        );
        if (hasUnsaved) {
          const unsavedCount = mockups.filter((m, i) => m !== null && !savedIndices.has(i)).length;
          return {
            hasUnsaved: true,
            count: unsavedCount,
            onSaveAll: handleSaveAllUnsaved
          };
        }
        return null;
      });
    }
  }, [registerUnsavedOutputsHandler, mockups, savedIndices, handleSaveAllUnsaved]);

  useEffect(() => {
    if (registerResetHandler) {
      registerResetHandler(() => {
        resetControls();
      });
    }
  }, [registerResetHandler, resetControls]);

  const handleGenerateClick = useCallback(async () => {
    // Check authentication using context state first
    if (isAuthenticated === false) {
      toast.error(t('messages.authenticationRequired'), { duration: 5000 });
      return;
    }

    // If still checking auth, verify with cache
    if (isAuthenticated === null || isCheckingAuth) {
      try {
        const user = await authService.verifyToken(); // Use verifyToken with cache
        if (!user) {
          toast.error(t('messages.authenticationRequired'), { duration: 5000 });
          return;
        }
      } catch (error) {
        toast.error(t('messages.authenticationError'), { duration: 5000 });
        return;
      }
    }

    // isAuthenticated === true, safe to proceed

    // Check if prompt is ready (was generated and tags haven't changed)
    // OR if prompt exists and was manually edited (user wants to use their custom prompt)
    const hasPrompt = promptPreview.trim().length > 0;

    // Check if we have valid setup (reference images or design type selected)
    const hasReferenceImagesForPrompt = referenceImages.length > 0;
    const hasValidSetupForPrompt = hasReferenceImagesForPrompt || designType;

    if (!isPromptReady && !hasPrompt) {
      // No prompt exists and not ready - generate smart prompt if conditions are met
      if (hasValidSetupForPrompt) {
        await handleGenerateSmartPrompt();
      } else {
        toast.error(t('messages.completeSteps'), { duration: 5000 });
      }
    } else if (!isPromptReady && hasPrompt) {
      // Prompt exists but tags changed (isPromptReady is false due to useEffect)
      // Force user to regenerate prompt to ensure it matches current tags
      if (hasValidSetupForPrompt) {
        toast.info(t('messages.tagsChanged'), { duration: 4000 });
        await handleGenerateSmartPrompt();
      } else {
        toast.error(t('messages.completeSteps'), { duration: 5000 });
      }
    } else {
      // Prompt is ready (isPromptReady is true) - generate outputs directly
      // This means tags haven't changed since last prompt generation
      // If there are already generated outputs, append new ones instead of replacing
      const hasExistingOutputs = mockups.some(m => m !== null);

      // Scroll to top to show MockupDisplay
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Also scroll the main content area if it exists
        const mainElement = document.querySelector('main');
        if (mainElement) {
          mainElement.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);

      await runGeneration(undefined, undefined, hasExistingOutputs);
      // setIsPromptReady(false); // Kept ready so "Generate Results" stays active or can be hidden logic-side
      // Hide sidebar on mobile after generation
      setIsSidebarVisibleMobile(false);
    }
  }, [promptPreview, selectedTags, designType, referenceImages, handleGenerateSmartPrompt, runGeneration, mockups, savedIndices, handleSaveAllUnsaved, isAuthenticated, isCheckingAuth, t]);

  const handleGenerateSuggestion = useCallback(async (suggestion: string) => {
    // Check authentication using context state first
    if (isAuthenticated === false) {
      toast.error(t('messages.authenticationRequired'), { duration: 5000 });
      return;
    }

    // If still checking auth, verify with cache
    if (isAuthenticated === null || isCheckingAuth) {
      try {
        const user = await authService.verifyToken(); // Use verifyToken with cache
        if (!user) {
          toast.error(t('messages.authenticationRequired'), { duration: 5000 });
          return;
        }
      } catch (error) {
        toast.error(t('messages.authenticationError'), { duration: 5000 });
        return;
      }
    }

    // isAuthenticated === true, safe to proceed

    if (!selectedModel) {
      toast.error(t('messages.selectModelBeforeGenerating'), { duration: 5000 });
      return;
    }

    // Allow generation if: has reference images OR (has design type AND (blank mode OR has uploaded image)) AND has suggestion
    const hasRefImages = referenceImages.length > 0;
    const hasValidSetupForSuggestion = hasRefImages || (designType && (designType === 'blank' || uploadedImage));
    if (!hasValidSetupForSuggestion || !suggestion.trim()) {
      toast.error(t('messages.completeSteps'), { duration: 5000 });
      return;
    }

    // Generate using the suggestion prompt in append mode (adds to existing mockups)
    await runGeneration(undefined, suggestion, true);
  }, [selectedModel, designType, uploadedImage, referenceImages, selectedTags, runGeneration, isAuthenticated, isCheckingAuth, t]);

  const handleSaveMockup = useCallback(async (index: number, imageBase64: string) => {
    if (!isAuthenticated) {
      toast.error(t('messages.authenticationRequired'), { duration: 5000 });
      return;
    }

    try {
      const isLiked = mockupLikedStatus.get(index) ?? false;

      const savedMockup = await mockupApi.save({
        imageBase64: imageBase64,
        prompt: promptPreview,
        designType: designType || 'blank',
        tags: selectedTags,
        brandingTags: selectedBrandingTags,
        aspectRatio: aspectRatio,
        isLiked: isLiked,
      });

      // Mark as saved and store the mockup ID
      setSavedIndices(prev => new Set([...prev, index]));
      if (savedMockup._id) {
        setSavedMockupIds(prev => new Map(prev).set(index, savedMockup._id));
        // Update liked status from saved mockup
        setMockupLikedStatus(prev => new Map(prev).set(index, savedMockup.isLiked ?? isLiked));
      }
    } catch (error: any) {
      if (isLocalDevelopment()) {
        console.error('[Save] Failed to save mockup:', {
          index,
          message: error?.message,
          status: error?.status,
          details: error?.details,
          error: error,
        });
      }

      // Show user-friendly error message
      const errorMessage = error?.details || error?.message || t('messages.failedToSaveMockup');
      toast.error(errorMessage, { duration: 5000 });
      throw error; // Re-throw to let component handle it
    }
  }, [isAuthenticated, mockupLikedStatus, promptPreview, designType, selectedTags, selectedBrandingTags, aspectRatio, t]);

  const handleRedrawClick = (index: number) => runGeneration(index);
  const handleOpenFullScreen = (index: number) => setFullScreenImageIndex(index);
  const handleCloseFullScreen = () => setFullScreenImageIndex(null);

  // Handler for syncing like state directly (used when hook updates state)
  const handleLikeStateChange = useCallback((index: number) => (newIsLiked: boolean) => {
    // Direct state update (no toggle) - used by hook after it updates backend
    setMockupLikedStatus(prev => new Map(prev).set(index, newIsLiked));
  }, []);

  // Fallback handler for when hook is not used (items without mockupId)
  const handleToggleLike = useCallback(async (index: number) => {
    if (!isAuthenticated) {
      toast.error(t('messages.authenticationRequired'), { duration: 5000 });
      return;
    }

    const mockupId = savedMockupIds.get(index);
    const currentIsLiked = mockupLikedStatus.get(index) ?? false;
    const newLikedState = !currentIsLiked;

    // Update local state immediately for responsive UI
    setMockupLikedStatus(prev => new Map(prev).set(index, newLikedState));

    // Check if mockupId is valid
    const isValidObjectId = mockupId && /^[0-9a-fA-F]{24}$/.test(mockupId);

    // If mockup is not saved yet, save it with the new like status (same as Save All)
    if (!mockupId || !isValidObjectId) {
      const imageBase64 = mockups[index];
      if (!imageBase64) {
        if (isLocalDevelopment()) {
          console.error('[Like] No image to save for index:', index);
        }
        // Revert local state if no image
        setMockupLikedStatus(prev => new Map(prev).set(index, currentIsLiked));
        return;
      }

      try {
        // Save mockup with new like status (same pattern as Save All)
        const savedMockup = await mockupApi.save({
          imageBase64: imageBase64,
          prompt: promptPreview,
          designType: designType || 'blank',
          tags: selectedTags,
          brandingTags: selectedBrandingTags,
          aspectRatio: aspectRatio,
          isLiked: newLikedState,
        });

        // Mark as saved and store the mockup ID
        setSavedIndices(prev => new Set([...prev, index]));
        if (savedMockup._id) {
          setSavedMockupIds(prev => new Map(prev).set(index, savedMockup._id));
          // Update liked status from saved mockup
          setMockupLikedStatus(prev => new Map(prev).set(index, savedMockup.isLiked ?? newLikedState));
        }

        toast.success(newLikedState ? t('canvas.addedToFavorites') : t('canvas.removedFromFavorites'), { duration: 2000 });
      } catch (error: any) {
        if (isLocalDevelopment()) {
          console.error('[Like] Failed to save mockup with like status:', {
            index,
            isLiked: newLikedState,
            error: error?.message || error,
          });
        }
        // Revert local state on error
        setMockupLikedStatus(prev => new Map(prev).set(index, currentIsLiked));
        toast.error(t('canvasNodes.outputNode.failedToUpdateLikeStatus'), { duration: 3000 });
      }
      return;
    }

    // If mockup is already saved, update the like status
    try {
      await mockupApi.update(mockupId, { isLiked: newLikedState });
      toast.success(newLikedState ? t('canvas.addedToFavorites') : t('canvas.removedFromFavorites'), { duration: 2000 });
    } catch (error: any) {
      if (isLocalDevelopment()) {
        console.error('[Like] Failed to update like status:', {
          mockupId,
          isLiked: newLikedState,
          error: error?.message || error,
        });
      }
      // Revert local state on error
      setMockupLikedStatus(prev => new Map(prev).set(index, currentIsLiked));
      toast.error(t('canvasNodes.outputNode.failedToUpdateLikeStatus'), { duration: 3000 });
    }
  }, [isAuthenticated, savedMockupIds, mockupLikedStatus, mockups, promptPreview, designType, selectedTags, selectedBrandingTags, aspectRatio, t]);

  const handleRemoveMockup = useCallback((index: number) => {
    const mockup = mockups[index];
    if (!mockup) return;

    const isSaved = savedIndices.has(index);

    // Helper function to remove the mockup and adjust all related indices
    const removeMockupAndAdjustIndices = () => {
      setMockups(prev => prev.filter((_, i) => i !== index));
      setIsLoading(prev => prev.filter((_, i) => i !== index));

      // Adjust fullScreenImageIndex: close modal if viewing deleted mockup, adjust index if viewing later mockup
      if (fullScreenImageIndex !== null) {
        if (fullScreenImageIndex === index) {
          // Close modal if viewing the deleted mockup
          setFullScreenImageIndex(null);
        } else if (fullScreenImageIndex > index) {
          // Adjust index if viewing a mockup after the deleted one
          setFullScreenImageIndex(fullScreenImageIndex - 1);
        }
      }

      // Adjust savedIndices: remove the deleted index and shift down indices greater than it
      setSavedIndices(prev => {
        const newSet = new Set<number>();
        prev.forEach(savedIndex => {
          if (savedIndex < index) {
            newSet.add(savedIndex);
          } else if (savedIndex > index) {
            newSet.add(savedIndex - 1);
          }
          // Skip the deleted index
        });
        return newSet;
      });

      // Adjust savedMockupIds: same logic as savedIndices
      setSavedMockupIds(prev => {
        const newMap = new Map<number, string>();
        prev.forEach((mockupId, savedIndex) => {
          if (savedIndex < index) {
            newMap.set(savedIndex, mockupId);
          } else if (savedIndex > index) {
            newMap.set(savedIndex - 1, mockupId);
          }
          // Skip the deleted index
        });
        return newMap;
      });

      // Adjust mockupLikedStatus: same logic
      setMockupLikedStatus(prev => {
        const newMap = new Map<number, boolean>();
        prev.forEach((isLiked, savedIndex) => {
          if (savedIndex < index) {
            newMap.set(savedIndex, isLiked);
          } else if (savedIndex > index) {
            newMap.set(savedIndex - 1, isLiked);
          }
          // Skip the deleted index
        });
        return newMap;
      });
    };

    if (!isSaved) {
      // Show confirmation dialog for unsaved outputs
      setUnsavedDialogConfig({
        onConfirm: removeMockupAndAdjustIndices,
        message: t('messages.unsavedOutputRemoveMessage'),
        showSaveAll: false
      });
      setShowUnsavedDialog(true);
    } else {
      // For saved outputs, remove from display
      removeMockupAndAdjustIndices();
      toast.success(t('messages.outputRemoved'), { duration: 2000 });
    }
  }, [mockups, savedIndices, fullScreenImageIndex, t]);
  const handleRedrawFromModal = (index: number) => { handleRedrawClick(index); handleCloseFullScreen(); };
  const handleZoomInFromModal = (index: number) => { handleCloseFullScreen(); handleZoomInFromOutput(index); };
  const handleZoomOutFromModal = (index: number) => { handleCloseFullScreen(); handleZoomOutFromOutput(index); };
  const handleNewAngleFromModal = (index: number, angle: string) => { handleCloseFullScreen(); handleNewAngleFromOutput(index, angle); };
  const handleNewBackgroundFromModal = (index: number) => { handleCloseFullScreen(); handleNewBackgroundFromOutput(index); };
  const handleNewBackgroundFromModalWithPreset = (index: number, background: string) => {
    handleCloseFullScreen();
    handleNewBackgroundFromOutputWithPreset(index, background);
  };
  const handleNewLightingFromModalWithPreset = (index: number, lighting: string) => {
    handleCloseFullScreen();
    handleNewLightingFromOutputWithPreset(index, lighting);
  };

  const handleNewAngleFromOutput = useCallback(async (index: number, angle: string) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    // Close fullscreen modal immediately
    handleCloseFullScreen();

    // Ensure we stay on MockupMachinePage (not WelcomeScreen)
    setShowWelcome(false);
    if (!hasGenerated) {
      setHasGenerated(true);
    }

    // Open sidebar on mobile if it's closed
    if (!isSidebarVisibleMobile) {
      setIsSidebarVisibleMobile(true);
    }

    // Calculate new index before appending
    const newIndex = mockups.length;

    // Append new slot
    setMockups(prev => [...prev, null]);
    setIsLoading(prev => [...prev, true]);

    const anglePrompt = `${buildPrompt()} The camera angle should be changed to: ${angle}. Keep the same product, design, and overall composition, but change only the camera perspective. It is critical that all design elements in the image, including any text, logos, graphics, and branding elements, are preserved exactly as they appear in the original image. Do not modify, re-draw, alter, or recreate any text, logos, or design elements. They must remain identical to the original image.`;

    await executeImageEditOperation({
      base64Image: outputImage,
      prompt: anglePrompt,
      onSuccess: (result) => {
        setMockups(prev => {
          const newMockups = [...prev];
          // Find the first null slot (should be at newIndex)
          const targetIndex = newIndex < prev.length ? newIndex : prev.length;
          newMockups[targetIndex] = result;
          return newMockups;
        });
        // Collapse sidebar after generation completes
        setIsSidebarVisibleMobile(false);
      },
      setIsLoading: (loading) => {
        setIsLoading(prev => {
          const newLoading = [...prev];
          const targetIndex = newIndex < newLoading.length ? newIndex : newLoading.length;
          newLoading[targetIndex] = loading;
          return newLoading;
        });
        // Collapse sidebar when loading finishes (even if error)
        if (!loading) {
          setIsSidebarVisibleMobile(false);
        }
      },
      promptLength: anglePrompt.length
    });
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, executeImageEditOperation, handleCloseFullScreen, isSidebarVisibleMobile, hasGenerated]);

  const handleNewBackgroundFromOutput = useCallback(async (index: number) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    // Close fullscreen modal immediately
    handleCloseFullScreen();

    // Ensure we stay on MockupMachinePage (not WelcomeScreen)
    setShowWelcome(false);
    if (!hasGenerated) {
      setHasGenerated(true);
    }

    // Open sidebar on mobile if it's closed
    if (!isSidebarVisibleMobile) {
      setIsSidebarVisibleMobile(true);
    }

    // Calculate new index before appending
    const newIndex = mockups.length;

    // Append new slot
    setMockups(prev => [...prev, null]);
    setIsLoading(prev => [...prev, true]);

    const currentEnv = selectedLocationTags[0];
    const availableEnvs = currentEnv
      ? AVAILABLE_LOCATION_TAGS.filter(env => env !== currentEnv)
      : AVAILABLE_LOCATION_TAGS;

    const newEnv = availableEnvs.length > 0
      ? availableEnvs[Math.floor(Math.random() * availableEnvs.length)]
      : AVAILABLE_LOCATION_TAGS[Math.floor(Math.random() * AVAILABLE_LOCATION_TAGS.length)];

    const backgroundPrompt = `${buildPrompt()} The scene should be changed to a different environment: ${newEnv}. Keep the same product, design, and camera angle, but change only the background, setting, and environmental context. It is critical that all design elements in the image, including any text, logos, graphics, and branding elements, are preserved exactly as they appear in the original image. Do not modify, re-draw, alter, or recreate any text, logos, or design elements. They must remain identical to the original image.`;

    await executeImageEditOperation({
      base64Image: outputImage,
      prompt: backgroundPrompt,
      onSuccess: (result) => {
        setMockups(prev => {
          const newMockups = [...prev];
          newMockups[newIndex] = result;
          return newMockups;
        });
        // Collapse sidebar after generation completes
        setIsSidebarVisibleMobile(false);
      },
      setIsLoading: (loading) => {
        setIsLoading(prev => {
          const newLoading = [...prev];
          newLoading[newIndex] = loading;
          return newLoading;
        });
        // Collapse sidebar when loading finishes (even if error)
        if (!loading) {
          setIsSidebarVisibleMobile(false);
        }
      },
      promptLength: backgroundPrompt.length
    });
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, selectedLocationTags, executeImageEditOperation, handleCloseFullScreen, isSidebarVisibleMobile, hasGenerated]);

  const handleNewBackgroundFromOutputWithPreset = useCallback(async (index: number, background: string) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    // Close fullscreen modal immediately
    handleCloseFullScreen();

    // Ensure we stay on MockupMachinePage (not WelcomeScreen)
    setShowWelcome(false);
    if (!hasGenerated) {
      setHasGenerated(true);
    }

    // Open sidebar on mobile if it's closed
    if (!isSidebarVisibleMobile) {
      setIsSidebarVisibleMobile(true);
    }

    // Calculate new index before appending
    const newIndex = mockups.length;

    // Append new slot
    setMockups(prev => [...prev, null]);
    setIsLoading(prev => [...prev, true]);

    // Use the selected background preset
    const newEnv = background;

    // Special handling for Minimalist Studio and Light Box (same as in buildPrompt)
    let backgroundPrompt = '';
    if (newEnv === 'Minimalist Studio') {
      backgroundPrompt = `${buildPrompt()} The scene should be changed to a professional photography studio with infinite white wall background, studio lighting, clean and minimalist aesthetic. The scene should include a plant in the setting. Keep the same product, design, and camera angle, but change only the background, setting, and environmental context. It is critical that all design elements in the image, including any text, logos, graphics, and branding elements, are preserved exactly as they appear in the original image. Do not modify, re-draw, alter, or recreate any text, logos, or design elements. They must remain identical to the original image.`;
    } else if (newEnv === 'Light Box') {
      backgroundPrompt = `${buildPrompt()} The scene should be changed to a professional lightbox photography environment with seamless white or neutral background, even diffused lighting, completely neutral and minimal aesthetic. This is a professional product photography setup with no decorative elements, plants, or distractions - purely focused on showcasing the product with clean, professional lighting. Keep the same product, design, and camera angle, but change only the background, setting, and environmental context. It is critical that all design elements in the image, including any text, logos, graphics, and branding elements, are preserved exactly as they appear in the original image. Do not modify, re-draw, alter, or recreate any text, logos, or design elements. They must remain identical to the original image.`;
    } else {
      backgroundPrompt = `${buildPrompt()} The scene should be changed to a different environment: ${newEnv}. Keep the same product, design, and camera angle, but change only the background, setting, and environmental context. It is critical that all design elements in the image, including any text, logos, graphics, and branding elements, are preserved exactly as they appear in the original image. Do not modify, re-draw, alter, or recreate any text, logos, or design elements. They must remain identical to the original image.`;
    }

    await executeImageEditOperation({
      base64Image: outputImage,
      prompt: backgroundPrompt,
      onSuccess: (result) => {
        setMockups(prev => {
          const newMockups = [...prev];
          newMockups[newIndex] = result;
          return newMockups;
        });
        // Collapse sidebar after generation completes
        setIsSidebarVisibleMobile(false);
      },
      setIsLoading: (loading) => {
        setIsLoading(prev => {
          const newLoading = [...prev];
          newLoading[newIndex] = loading;
          return newLoading;
        });
        // Collapse sidebar when loading finishes (even if error)
        if (!loading) {
          setIsSidebarVisibleMobile(false);
        }
      },
      promptLength: backgroundPrompt.length
    });
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, executeImageEditOperation, handleCloseFullScreen, isSidebarVisibleMobile, hasGenerated]);

  const handleNewLightingFromOutputWithPreset = useCallback(async (index: number, lighting: string) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    // Close fullscreen modal immediately
    handleCloseFullScreen();

    // Ensure we stay on MockupMachinePage (not WelcomeScreen)
    setShowWelcome(false);
    if (!hasGenerated) {
      setHasGenerated(true);
    }

    // Open sidebar on mobile if it's closed
    if (!isSidebarVisibleMobile) {
      setIsSidebarVisibleMobile(true);
    }

    // Calculate new index before appending
    const newIndex = mockups.length;

    // Append new slot
    setMockups(prev => [...prev, null]);
    setIsLoading(prev => [...prev, true]);

    // Use the selected lighting preset
    const newLighting = lighting;

    const lightingPrompt = `${buildPrompt()} The lighting should be changed to: ${newLighting}. Keep the same product, design, camera angle, and overall composition, but change only the lighting conditions and atmosphere. It is critical that all design elements in the image, including any text, logos, graphics, and branding elements, are preserved exactly as they appear in the original image. Do not modify, re-draw, alter, or recreate any text, logos, or design elements. They must remain identical to the original image.`;

    await executeImageEditOperation({
      base64Image: outputImage,
      prompt: lightingPrompt,
      onSuccess: (result) => {
        setMockups(prev => {
          const newMockups = [...prev];
          newMockups[newIndex] = result;
          return newMockups;
        });
        // Collapse sidebar after generation completes
        setIsSidebarVisibleMobile(false);
      },
      setIsLoading: (loading) => {
        setIsLoading(prev => {
          const newLoading = [...prev];
          newLoading[newIndex] = loading;
          return newLoading;
        });
        // Collapse sidebar when loading finishes (even if error)
        if (!loading) {
          setIsSidebarVisibleMobile(false);
        }
      },
      promptLength: lightingPrompt.length
    });
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, executeImageEditOperation, handleCloseFullScreen, isSidebarVisibleMobile, hasGenerated]);

  const handleZoomInFromOutput = useCallback(async (index: number) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    // Close fullscreen modal immediately
    handleCloseFullScreen();

    // Ensure we stay on MockupMachinePage (not WelcomeScreen)
    setShowWelcome(false);
    if (!hasGenerated) {
      setHasGenerated(true);
    }

    // Open sidebar on mobile if it's closed
    if (!isSidebarVisibleMobile) {
      setIsSidebarVisibleMobile(true);
    }

    // Calculate new index before appending
    const newIndex = mockups.length;

    // Append new slot
    setMockups(prev => [...prev, null]);
    setIsLoading(prev => [...prev, true]);

    const zoomInPrompt = `${buildPrompt()} Apply a zoom in effect. Move the camera closer to the subject/product while maintaining the same angle, lighting, and overall composition style. Keep the same product and design, but show more detail and a tighter framing. It is critical that all design elements in the image, including any text, logos, graphics, and branding elements, are preserved exactly as they appear in the original image. Do not modify, re-draw, alter, or recreate any text, logos, or design elements. They must remain identical to the original image.`;

    await executeImageEditOperation({
      base64Image: outputImage,
      prompt: zoomInPrompt,
      onSuccess: (result) => {
        setMockups(prev => {
          const newMockups = [...prev];
          newMockups[newIndex] = result;
          return newMockups;
        });
        // Collapse sidebar after generation completes
        setIsSidebarVisibleMobile(false);
      },
      setIsLoading: (loading) => {
        setIsLoading(prev => {
          const newLoading = [...prev];
          newLoading[newIndex] = loading;
          return newLoading;
        });
        // Collapse sidebar when loading finishes (even if error)
        if (!loading) {
          setIsSidebarVisibleMobile(false);
        }
      },
      promptLength: zoomInPrompt.length
    });
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, executeImageEditOperation, handleCloseFullScreen, isSidebarVisibleMobile, hasGenerated]);

  const handleZoomOutFromOutput = useCallback(async (index: number) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    // Close fullscreen modal immediately
    handleCloseFullScreen();

    // Ensure we stay on MockupMachinePage (not WelcomeScreen)
    setShowWelcome(false);
    if (!hasGenerated) {
      setHasGenerated(true);
    }

    // Open sidebar on mobile if it's closed
    if (!isSidebarVisibleMobile) {
      setIsSidebarVisibleMobile(true);
    }

    // Calculate new index before appending
    const newIndex = mockups.length;

    // Append new slot
    setMockups(prev => [...prev, null]);
    setIsLoading(prev => [...prev, true]);

    const zoomOutPrompt = `${buildPrompt()} Apply a zoom out effect. Move the camera further away from the subject/product while maintaining the same angle, lighting, and overall composition style. Keep the same product and design, but show more of the surrounding environment and a wider framing. It is critical that all design elements in the image, including any text, logos, graphics, and branding elements, are preserved exactly as they appear in the original image. Do not modify, re-draw, alter, or recreate any text, logos, or design elements. They must remain identical to the original image.`;

    await executeImageEditOperation({
      base64Image: outputImage,
      prompt: zoomOutPrompt,
      onSuccess: (result) => {
        setMockups(prev => {
          const newMockups = [...prev];
          newMockups[newIndex] = result;
          return newMockups;
        });
        // Collapse sidebar after generation completes
        setIsSidebarVisibleMobile(false);
      },
      setIsLoading: (loading) => {
        setIsLoading(prev => {
          const newLoading = [...prev];
          newLoading[newIndex] = loading;
          return newLoading;
        });
        // Collapse sidebar when loading finishes (even if error)
        if (!loading) {
          setIsSidebarVisibleMobile(false);
        }
      },
      promptLength: zoomOutPrompt.length
    });
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, executeImageEditOperation, handleCloseFullScreen, isSidebarVisibleMobile, hasGenerated]);

  const handleReImagineFromOutput = useCallback(async (index: number, reimaginePrompt: string) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    // Close fullscreen modal immediately
    handleCloseFullScreen();

    // Ensure we stay on MockupMachinePage (not WelcomeScreen)
    setShowWelcome(false);
    if (!hasGenerated) {
      setHasGenerated(true);
    }

    // Open sidebar on mobile if it's closed
    if (!isSidebarVisibleMobile) {
      setIsSidebarVisibleMobile(true);
    }

    // Calculate new index before appending
    const newIndex = mockups.length;

    // Append new slot
    setMockups(prev => [...prev, null]);
    setIsLoading(prev => [...prev, true]);

    // Intelligent prompt that combines the original context with user's requested changes
    const intelligentPrompt = `You are helping a user refine and reimagine their mockup design. 

CURRENT CONTEXT:
- Original prompt: "${promptPreview}"
- Design type: ${designType || 'mockup'}
- Product categories: ${selectedTags.join(', ')}
- Brand style: ${selectedBrandingTags.join(', ')}
${selectedLocationTags.length > 0 ? `- Environment: ${selectedLocationTags.join(', ')}` : ''}
${selectedAngleTags.length > 0 ? `- Camera angle: ${selectedAngleTags.join(', ')}` : ''}
${selectedLightingTags.length > 0 ? `- Lighting: ${selectedLightingTags.join(', ')}` : ''}
${selectedEffectTags.length > 0 ? `- Visual effects: ${selectedEffectTags.join(', ')}` : ''}

USER'S REQUESTED CHANGES:
"${reimaginePrompt}"

INSTRUCTIONS:
1. Analyze the current image provided
2. Understand what the user wants to change based on their request
3. Apply ONLY the changes they requested while maintaining everything else they didn't mention
4. Keep the overall composition, quality, and photorealistic style
5. Preserve the core product/mockup unless specifically asked to change it
6. If the user mentions new elements (colors, objects, atmosphere), integrate them naturally
7. If the user asks to change the style or mood, adjust lighting, colors, and atmosphere accordingly
8. Maintain professional product photography quality

Generate the new mockup image with the requested changes applied.`;

    await executeImageEditOperation({
      base64Image: outputImage,
      prompt: intelligentPrompt,
      onSuccess: (result) => {
        setMockups(prev => {
          const newMockups = [...prev];
          const targetIndex = newIndex < prev.length ? newIndex : prev.length;
          newMockups[targetIndex] = result;
          return newMockups;
        });
        toast.success(t('messages.mockupReimagined'), { duration: 3000 });
        // Collapse sidebar after generation completes
        setIsSidebarVisibleMobile(false);
      },
      setIsLoading: (loading) => {
        setIsLoading(prev => {
          const newLoading = [...prev];
          const targetIndex = newIndex < newLoading.length ? newIndex : newLoading.length;
          newLoading[targetIndex] = loading;
          return newLoading;
        });
        // Collapse sidebar when loading finishes (even if error)
        if (!loading) {
          setIsSidebarVisibleMobile(false);
        }
      },
      promptLength: intelligentPrompt.length
    });
  }, [mockups, isLoading, isGeneratingPrompt, promptPreview, designType, selectedTags, selectedBrandingTags, selectedLocationTags, selectedAngleTags, selectedLightingTags, selectedEffectTags, executeImageEditOperation, handleCloseFullScreen, isSidebarVisibleMobile, hasGenerated]);

  const designTypeSelected = !!designType;
  const brandingComplete = selectedBrandingTags.length > 0;
  const categoriesComplete = selectedTags.length > 0;
  const isGenerating = isLoading.some(Boolean);

  useEffect(() => {
    if (autoGenerateTimeoutRef.current) {
      clearTimeout(autoGenerateTimeoutRef.current);
      autoGenerateTimeoutRef.current = null;
    }

    // Allow auto-generate if: has reference images OR design type is selected
    const hasRefImagesForAuto = referenceImages.length > 0;
    const canAutoGenerate = hasRefImagesForAuto || designType;

    if (shouldAutoGenerate && !isGeneratingPrompt && !promptPreview.trim() && !isAutoGeneratingRef.current) {
      if (canAutoGenerate) {
        isAutoGeneratingRef.current = true;
        handleGenerateSmartPrompt().finally(() => {
          isAutoGeneratingRef.current = false;
        });
        setShouldAutoGenerate(false);
        // Only clear source if it's NOT 'surprise' - surprise needs to persist to trigger image generation
        if (autoGenerateSource !== 'surprise') {
          setAutoGenerateSource(null);
        }
      } else {
        setShouldAutoGenerate(false);
        setAutoGenerateSource(null);
      }
    }

    return () => {
      if (autoGenerateTimeoutRef.current) {
        clearTimeout(autoGenerateTimeoutRef.current);
        autoGenerateTimeoutRef.current = null;
      }
    };
  }, [shouldAutoGenerate, isGeneratingPrompt, promptPreview, handleGenerateSmartPrompt, selectedTags.length, designType, referenceImages.length, autoGenerateSource]);

  // Effect to handle final image generation for Surprise Me flow
  useEffect(() => {
    // Only trigger if:
    // 1. Source is 'surprise'
    // 2. Prompt is ready (generated)
    // 3. Not currently generating images
    if (autoGenerateSource === 'surprise' && isPromptReady && !isGenerating && !isGeneratingPrompt) {
      // Clear source first to prevent potential loops (although dependence on isPromptReady helps)
      setAutoGenerateSource(null);

      // Trigger generation
      runGeneration(undefined, undefined, true);
    }
  }, [autoGenerateSource, isPromptReady, isGenerating, isGeneratingPrompt, runGeneration]);

  const displayBrandingTags = [...new Set([...AVAILABLE_BRANDING_TAGS, ...selectedBrandingTags])];
  const displaySuggestedTags = [...new Set([...suggestedTags, ...selectedTags])];
  const displayAvailableCategoryTags = [...new Set([...AVAILABLE_TAGS, ...selectedTags])];
  const displayLocationTags = [...new Set([...AVAILABLE_LOCATION_TAGS, ...selectedLocationTags])];
  const displayAngleTags = [...new Set([...AVAILABLE_ANGLE_TAGS, ...selectedAngleTags])];
  const displayLightingTags = [...new Set([...AVAILABLE_LIGHTING_TAGS, ...selectedLightingTags])];
  const displayEffectTags = [...new Set([...AVAILABLE_EFFECT_TAGS, ...selectedEffectTags])];
  const displayMaterialTags = [...new Set([...AVAILABLE_MATERIAL_TAGS, ...selectedMaterialTags])];

  // Calculate credits needed for main generation
  const creditsNeededForGeneration = useMemo(() => {
    if (!selectedModel) return 0;
    const modelToUse = selectedModel || 'gemini-2.5-flash-image';
    const resolutionToUse = modelToUse === 'gemini-3-pro-image-preview' ? resolution : undefined;
    const creditsPerImage = getCreditsRequired(modelToUse, resolutionToUse);
    return mockupCount * creditsPerImage;
  }, [selectedModel, resolution, mockupCount]);

  // Calculate credits needed for edit operations (single image)
  const creditsNeededForEdit = useMemo(() => {
    if (!selectedModel) return 1; // Default to 1 credit if no model selected
    const modelToUse = selectedModel || 'gemini-2.5-flash-image';
    const resolutionToUse = modelToUse === 'gemini-3-pro-image-preview' ? resolution : undefined;
    return getCreditsRequired(modelToUse, resolutionToUse);
  }, [selectedModel, resolution]);

  // Check if user has any credits available
  const hasAnyCredits = useMemo(() => {
    if (isLocalDevelopment()) return true;
    if (!subscriptionStatus) return false;
    const totalCredits = subscriptionStatus.totalCredits || 0;
    return totalCredits > 0;
  }, [subscriptionStatus]);

  // Disable button for: auth checking, not authenticated, currently generating, insufficient credits, or 0 credits
  const isGenerateDisabled = isCheckingAuth ||
    isAuthenticated !== true ||
    isGenerating ||
    isGeneratingPrompt ||
    isSuggestingPrompts ||
    !hasAnyCredits ||
    (creditsNeededForGeneration > 0 && !hasEnoughCredits(creditsNeededForGeneration));

  // Disable edit operations if user doesn't have enough credits for a single edit operation or has 0 credits
  const isEditOperationDisabled = !isLocalDevelopment() &&
    (isAuthenticated !== true || !hasAnyCredits || !hasEnoughCredits(creditsNeededForEdit));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isGenerateDisabled) {
          handleGenerateClick();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGenerateDisabled, handleGenerateClick]);

  const getErrorMessage = useCallback((err: any): { message: string; suggestion?: string } => {
    if (err instanceof RateLimitError) {
      return {
        message: t('messages.rateLimit'),
        suggestion: t('messages.tryAgainIn10Minutes'),
      };
    }

    if (err instanceof ModelOverloadedError) {
      return {
        message: err.message || t('messages.modelOverloaded'),
        suggestion: t('messages.modelOverloadedSuggestion'),
      };
    }

    try {
      const errorStr = err?.message || err?.toString() || '';
      const status = err?.status;

      // Check for payload too large errors (413)
      if (status === 413 || errorStr.includes('413') || errorStr.includes('Payload Too Large') || errorStr.includes('Request Entity Too Large') || errorStr.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
        return {
          message: 'Arquivo muito grande para processar',
          suggestion: 'O tamanho do arquivo excede o limite permitido. Tente reduzir a resolução da imagem, usar um formato mais compacto (como JPEG) ou remover imagens de referência desnecessárias. As imagens são comprimidas automaticamente, mas algumas podem ainda ser muito grandes.',
        };
      }

      // Check for model overloaded messages
      if (errorStr.includes('model is overloaded') || errorStr.includes('model overloaded') || errorStr.includes('overloaded')) {
        return {
          message: t('messages.modelOverloaded'),
          suggestion: t('messages.modelOverloadedSuggestion'),
        };
      }

      if (errorStr.includes('503') || errorStr.includes('Service Unavailable')) {
        return {
          message: t('messages.serviceUnavailable'),
          suggestion: t('messages.serviceUnavailableSuggestion'),
        };
      }

      if (errorStr.includes('timeout')) {
        return {
          message: t('messages.requestTimeout'),
          suggestion: t('messages.requestTimeoutSuggestion'),
        };
      }

      if (errorStr.includes('Unable to process input image')) {
        return {
          message: t('messages.unableToProcessImage'),
          suggestion: t('messages.unableToProcessImageSuggestion'),
        };
      }

      if (errorStr.includes('INVALID_ARGUMENT')) {
        return {
          message: t('messages.invalidImageFormat'),
          suggestion: t('messages.invalidImageFormatSuggestion'),
        };
      }

      if (errorStr.includes('429') || errorStr.includes('rate limit')) {
        return {
          message: t('messages.rateLimit'),
          suggestion: t('messages.tryAgainIn10Minutes'),
        };
      }

      if (errorStr.includes('network') || errorStr.includes('fetch')) {
        return {
          message: t('messages.networkError'),
          suggestion: t('messages.networkErrorSuggestion'),
        };
      }

      if (errorStr.includes('{"error"')) {
        const jsonMatch = errorStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const errorObj = JSON.parse(jsonMatch[0]);
          if (errorObj?.error?.message) {
            const apiMessage = errorObj.error.message;
            if (apiMessage.includes('Unable to process input image')) {
              return {
                message: t('messages.unableToProcessImage'),
                suggestion: t('messages.unableToProcessImageSuggestion'),
              };
            }
            if (apiMessage.includes('Payload Too Large') || apiMessage.includes('413')) {
              return {
                message: 'Arquivo muito grande para processar',
                suggestion: 'O tamanho do arquivo excede o limite permitido. Tente reduzir a resolução da imagem, usar um formato mais compacto (como JPEG) ou remover imagens de referência desnecessárias. As imagens são comprimidas automaticamente, mas algumas podem ainda ser muito grandes.',
              };
            }
            return { message: apiMessage };
          }
        }
      }

      if (err?.error?.message) {
        const apiMessage = err.error.message;
        if (apiMessage.includes('Unable to process input image')) {
          return {
            message: t('messages.unableToProcessImage'),
            suggestion: t('messages.unableToProcessImageSuggestion'),
          };
        }
        if (apiMessage.includes('Payload Too Large') || apiMessage.includes('413')) {
          return {
            message: 'Arquivo muito grande para processar',
            suggestion: 'O tamanho do arquivo excede o limite permitido. Tente reduzir a resolução da imagem, usar um formato mais compacto (como JPEG) ou remover imagens de referência desnecessárias. As imagens são comprimidas automaticamente, mas algumas podem ainda ser muito grandes.',
          };
        }
        return { message: apiMessage };
      }
    } catch (parseError) {
    }

    return {
      message: t('messages.generationError'),
      suggestion: t('messages.generationErrorSuggestion'),
    };
  }, [t]);



  // Helper values for GenerateButton visibility

  const hasUserChanges = designTypeSelected || brandingComplete || categoriesComplete || referenceImages.length > 0 || (uploadedImage && !isImagelessMode);

  // Logic to show generation button (matches SidebarOrchestrator logic)
  const shouldShowGenerateButton = isPromptReady || hasUserChanges;

  return (
    <>
      <SEO
        title={t('mockup.seoTitle')}
        description={t('mockup.seoDescription')}
        keywords={t('mockup.seoKeywords')}
      />
      <SoftwareApplicationSchema
        name="Mockup Machine"
        description="Gere mockups profissionais com inteligência artificial. Ferramenta integrada de geração rápida de mockups e assets para designers."
        applicationCategory="DesignApplication"
      />
      <WebSiteSchema />
      <AnalyzingImageOverlay isVisible={isAnalyzing} />

      {showWelcome || (!uploadedImage && !isImagelessMode && designType !== 'blank') ? (
        <WelcomeScreen
          onImageUpload={handleImageUpload}
          onBlankMockup={handleProceedWithoutImage}
        />
      ) : (
        <div className="pt-12 md:pt-14">
          <div className={`flex flex-col lg:flex-row h-[calc(100vh-2.5rem-120px)] md:h-[calc(100vh-5rem)] ${!hasGenerated ? 'justify-center py-4 md:py-8' : ''} ${hasGenerated ? 'relative' : ''}`}>

            {/* Collapse/Expand Toggle Button */}
            {hasGenerated && (
              <Button
                onClick={() => {
                  // Check if we are on mobile or desktop based on visibility state or window width
                  // Since we don't track window width here, we use a heuristic or simple toggle
                  // If sidebar is visible on mobile, close it.
                  if (isSidebarVisibleMobile) {
                    setIsSidebarVisibleMobile(false);
                  } else {
                    // Desktop toggle
                    setIsSidebarCollapsed(!isSidebarCollapsed);
                  }
                }}
                variant="outline"
                size="icon"
                className={`z-30 shadow-md bg-background border-border hover:bg-accent text-muted-foreground
                        ${isSidebarVisibleMobile
                    ? 'fixed top-20 right-4 lg:hidden' /* Mobile Close: Fixed top-right */
                    : 'absolute top-4 left-4 lg:static lg:mr-4 lg:mt-0 transition-all' /* Desktop Toggle: In flow or absolute */
                  }
                        /* On desktop, we want it in the Main area flow but absolute helps if we want it "outside" sidebar */
                        ${!isSidebarVisibleMobile ? 'lg:absolute lg:left-0 lg:ml-2 lg:top-4' : ''}
                        /* When collapsed on desktop, move it to left edge */
                    `}
                style={{
                  /* Dynamic positioning for desktop if needed, but flex layout handles main area */
                }}
              >
                {isSidebarVisibleMobile || !isSidebarCollapsed ? (
                  <Menu className="h-4 w-4 rotate-180" /> /* Close/Collapse Icon */
                ) : (
                  <Menu className="h-4 w-4" /> /* Expand Icon */
                )}
              </Button>
            )}

            <div className={`${hasGenerated && !isSidebarVisibleMobile ? (isSidebarCollapsed ? 'hidden' : 'hidden lg:flex') : hasGenerated ? 'flex' : ''} ${hasGenerated ? 'h-full' : ''}`}>
              <SidebarOrchestrator
                sidebarWidth={sidebarWidth}
                sidebarRef={sidebarRef}
                onSidebarWidthChange={setSidebarWidth}
                // onCloseMobile removed to use external button
                onSurpriseMe={handleSurpriseMe}
                onOpenSurpriseMeSettings={() => setIsSurpriseMeSettingsOpen(true)}
                onImageUpload={handleImageUpload}
                onReferenceImagesChange={setReferenceImages}
                onStartOver={handleStartOver}
                onDesignTypeChange={handleDesignTypeChange}
                onSuggestPrompts={handleSuggestPrompts}
                onGenerateSmartPrompt={handleGenerateSmartPrompt}
                onSimplify={handleSimplify}
                onRegenerate={() => runGeneration()}
                onGenerateClick={handleGenerateClick}
                onGenerateSuggestion={handleGenerateSuggestion}
                onAnalyze={handleAnalyze}
                generateOutputsButtonRef={generateOutputsButtonRef}
                authenticationRequiredMessage={t('messages.authenticationRequired')}
                onBlankMockup={handleProceedWithoutImage}
              />
            </div>
            {hasGenerated && (
              <>
                <main className={`flex-1 p-2 md:p-4 lg:p-8 overflow-y-auto min-w-0 h-full ${!isSidebarVisibleMobile ? 'w-full' : ''} relative`}>
                  {/* Desktop Toggle Button specific placement in Main if sidebar is consistent */}
                  {!isSidebarVisibleMobile && (
                    <div className="hidden lg:block absolute top-4 left-4 z-50">
                      <Button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        variant="outline"
                        size="icon"
                        className="shadow-sm bg-background/80 backdrop-blur-sm border-border/50 hover:bg-accent"
                        title={isSidebarCollapsed ? t('mockup.expandSidebar') : t('mockup.collapseSidebar')}
                      >
                        {isSidebarCollapsed ? <Menu size={18} /> : <div className="flex"><Menu size={18} className="rotate-180" /></div>}
                        {/* Or use specific icons like PanelLeftClose/Open if available */}
                      </Button>
                    </div>
                  )}

                  <MockupDisplay
                    mockups={mockups}
                    isLoading={isLoading}
                    onRedraw={handleRedrawClick}
                    onView={handleOpenFullScreen}
                    onNewAngle={(index, angle) => handleNewAngleFromOutput(index, angle)}
                    onNewBackground={handleNewBackgroundFromOutput}
                    onReImagine={handleReImagineFromOutput}
                    onSave={handleSaveMockup}
                    savedIndices={savedIndices}
                    savedMockupIds={savedMockupIds}
                    onToggleLike={handleToggleLike}
                    likedIndices={mockupLikedStatus}
                    onRemove={handleRemoveMockup}
                    prompt={promptPreview}
                    designType={designType || undefined}
                    tags={selectedTags}
                    brandingTags={selectedBrandingTags}
                    aspectRatio={aspectRatio as '16:9' | '4:3' | '1:1'}
                    editButtonsDisabled={isEditOperationDisabled}
                    creditsPerOperation={creditsNeededForEdit}
                  />
                </main>
              </>
            )}
          </div>
        </div>
      )}

      {fullScreenImageIndex !== null && (
        <FullScreenViewer
          showActions={true}
          base64Image={mockups[fullScreenImageIndex]}
          isLoading={isLoading[fullScreenImageIndex]}
          onClose={handleCloseFullScreen}
          onZoomIn={() => handleZoomInFromModal(fullScreenImageIndex)}
          onZoomOut={() => handleZoomOutFromModal(fullScreenImageIndex)}
          onNewAngle={(angle) => handleNewAngleFromModal(fullScreenImageIndex, angle)}
          onNewBackground={(background) => handleNewBackgroundFromModalWithPreset(fullScreenImageIndex, background)}
          onNewLighting={(lighting) => handleNewLightingFromModalWithPreset(fullScreenImageIndex, lighting)}
          onReImagine={(reimaginePrompt) => handleReImagineFromOutput(fullScreenImageIndex, reimaginePrompt)}
          availableAngles={AVAILABLE_ANGLE_TAGS}
          availableBackgrounds={AVAILABLE_LOCATION_TAGS}
          availableLightings={AVAILABLE_LIGHTING_TAGS}
          onOpenInEditor={(imageBase64: string) => {
            navigate(`/editor?image=${encodeURIComponent(imageBase64)}`);
          }}
          isAuthenticated={isAuthenticated === true}
          mockupId={savedMockupIds.get(fullScreenImageIndex)}
          onToggleLike={() => handleToggleLike(fullScreenImageIndex)}
          onLikeStateChange={(newIsLiked) => {
            // Sync state when hook updates it
            setMockupLikedStatus(prev => new Map(prev).set(fullScreenImageIndex, newIsLiked));
          }}
          isLiked={mockupLikedStatus.get(fullScreenImageIndex) ?? false}
          editButtonsDisabled={isEditOperationDisabled}
          creditsPerOperation={creditsNeededForEdit}
        />
      )}

      {hasGenerated && !isSidebarVisibleMobile && shouldShowGenerateButton && (
        <div className="lg:hidden">
          <GenerateButton
            onClick={handleGenerateClick}
            disabled={isGenerateDisabled || (isPromptReady && isGenerating)}
            isGeneratingPrompt={isGeneratingPrompt}
            isGenerating={isGenerating}
            isPromptReady={isPromptReady}
            variant="floating"
            creditsRequired={selectedModel && isPromptReady ? mockupCount * getCreditsRequired(selectedModel, resolution) : undefined}
          />
        </div>
      )}

      <FloatingActionButtons
        isVisible={(hasGenerated || hasAnalyzed) && !isSidebarVisibleMobile}
        onSurpriseMe={() => handleSurpriseMe(true)}
        isGeneratingPrompt={isGeneratingPrompt}
        isGenerating={isGenerating}
        hasAnalyzed={hasAnalyzed}
      />

      {showUnsavedDialog && unsavedDialogConfig && (
        <ConfirmationModal
          isOpen={showUnsavedDialog}
          onClose={() => {
            setShowUnsavedDialog(false);
            setUnsavedDialogConfig(null);
            // Reset blocker if it was blocked
            if (blocker.state === 'blocked') {
              blocker.reset();
            }
          }}
          onConfirm={unsavedDialogConfig.onConfirm}
          onSaveAll={unsavedDialogConfig.onSaveAll}
          title={t('messages.unsavedOutputsTitle')}
          message={unsavedDialogConfig.message}
          confirmText={t('messages.dontCare')}
          cancelText={t('common.cancel')}
          variant="warning"
          showSaveAll={unsavedDialogConfig.showSaveAll}
        />
      )}

      <SurpriseMeSettingsModal
        isOpen={isSurpriseMeSettingsOpen}
        onClose={() => setIsSurpriseMeSettingsOpen(false)}
      />
    </>
  );
};

