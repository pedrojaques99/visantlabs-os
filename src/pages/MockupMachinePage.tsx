import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useBlocker, useLocation } from 'react-router-dom';
import { Menu, Pickaxe, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageUploader } from '../components/ui/ImageUploader';
import { normalizeImageToBase64, detectMimeType } from '../services/reactFlowService';
import { MockupDisplay } from '../components/mockupmachine/MockupDisplay';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { WelcomeScreen } from './WelcomeScreen';
import { SidebarOrchestrator } from '../components/mockupmachine/SidebarOrchestrator';
import { SurpriseMeControl } from '../components/mockupmachine/SurpriseMeControl';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Button } from '../components/ui/button';
import { AnalyzingImageOverlay } from '../components/ui/AnalyzingImageOverlay';
import { aiApi } from '../services/aiApi';
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
import { saveMockupState, loadMockupState, clearMockupState } from '@/utils/mockupStatePersistence';
import { getAllAnglePresetsAsync } from '../services/anglePresetsService';
import { getAllTexturePresetsAsync } from '../services/texturePresetsService';
import { getAllAmbiencePresetsAsync } from '../services/ambiencePresetsService';
import { getAllLuminancePresetsAsync } from '../services/luminancePresetsService';
import type { AnglePreset } from '../types/anglePresets';
import type { TexturePreset } from '../types/texturePresets';
import type { AmbiencePreset } from '../types/ambiencePresets';
import type { LuminancePreset } from '../types/luminancePresets';
import type { SurpriseMeSelectedTags } from '@/utils/surpriseMeSettings';
import { MockupProvider, useMockup } from '../components/mockupmachine/MockupContext';
import { useMockupTags } from '@/hooks/useMockupTags';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useCreditValidation } from '@/hooks/useCreditValidation';
import { useAnalysisOverlay } from '@/hooks/useAnalysisOverlay';
import { formatMockupError } from '@/utils/mockupErrorHandling';
import { compressImage } from '@/utils/imageCompression';

const MOCKUP_COUNT = 2;

import { isLocalDevelopment } from '@/utils/env';
import {
  AVAILABLE_TAGS,
  AVAILABLE_BRANDING_TAGS,
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS
} from '@/utils/mockupConstants';
import {
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
    referenceImages, setReferenceImages,

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
    resetAll,
    hasAnalyzed,
    setHasAnalyzed,
    isAnalysisOverlayVisible,
    setIsAnalysisOverlayVisible,
    instructions,
    setInstructions,
    isSurpriseMeMode,
    setIsSurpriseMeMode,
    surpriseMePool,
    imageProvider,
  } = useMockup();

  // Custom hooks for common operations (after getting mockupCount from context)
  const { requireAuth } = useAuthGuard();
  const { hasEnoughCredits, validateCredits } = useCreditValidation(mockupCount, onCreditPackagesModalOpen);
  const { showTemporaryOverlay, hideOverlay } = useAnalysisOverlay();

  const {
    availableMockupTags,
    availableLocationTags
  } = useMockupTags();

  const promptWasReadyBeforeEditRef = useRef<boolean>(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);
  const [autoGenerateSource, setAutoGenerateSource] = useState<'surprise' | 'angles' | 'environments' | 'surprise-prompt-only' | null>(null);
  const [isAutoGenerateMode, setIsAutoGenerateMode] = useState(false);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [mockupLikedStatus, setMockupLikedStatus] = useState<Map<number, boolean>>(new Map()); // Map index -> isLiked
  const [savedMockupIds, setSavedMockupIds] = useState<Map<number, string>>(new Map()); // Map index -> mockup ID
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isDiceAnimatingFloating, setIsDiceAnimatingFloating] = useState(false);
  const [autoGenerateFloating, setAutoGenerateFloating] = useState(true);

  // React to external tag changes (e.g. SurpriseMeSelectedTagsDisplay reroll)
  useEffect(() => {
    const handler = () => {
      // Invalidate current prompt so it regenerates based on new tags
      setIsPromptReady(false);
      setPromptPreview('');
      setShouldAutoGenerate(true);
      setAutoGenerateSource('surprise-prompt-only');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mockup:tagsChanged', handler as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mockup:tagsChanged', handler as EventListener);
      }
    };
  }, []);
  const [unsavedDialogConfig, setUnsavedDialogConfig] = useState<{
    onConfirm: () => void;
    onSaveAll?: () => Promise<void>;
    message: string;
    showSaveAll?: boolean;
  } | null>(null);

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
        setInstructions(persistedState.instructions || '');

        // Hide welcome screen and show mockups
        setShowWelcome(false);

        // Adjust loading array to match mockups length
        setIsLoading(Array(persistedState.mockups.length).fill(false));
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
    if ((location.pathname === '/' || location.pathname === '/mockupmachine') &&
      !uploadedImage &&
      mockups.every(m => m === null) &&
      isPromptReady &&
      !hasGenerated &&
      !hasAnyMockups &&
      location.pathname !== '/mockupmachine') {
      setShowWelcome(true);
    } else if (hasGenerated || hasAnyMockups || location.pathname === '/mockupmachine') {
      // Explicitly keep welcome screen hidden if we have generated mockups or are on the mockupmachine route
      setShowWelcome(false);
    }
  }, [location.pathname, uploadedImage, mockups, designType, hasGenerated, isPromptReady]);

  // Save state to localStorage when mockups are generated (with debounce)
  // Using a longer debounce (1500ms) to prevent excessive saves and localStorage quota issues
  useEffect(() => {
    // Save if there are generated mockups OR if an image has been uploaded (to persist analysis)
    const hasAnyMockups = mockups.some(m => m !== null);
    if (!hasAnyMockups && !uploadedImage && !hasGenerated) return;

    console.log('[🔄 SaveEffect] Persistence effect triggered', {
      hasAnyMockups,
      hasUploadedImage: !!uploadedImage,
      hasGenerated,
      mockupsCount: mockups.length,
      timestamp: new Date().toISOString()
    });

    const timeoutId = setTimeout(async () => {
      console.log('[🔄 SaveEffect] Debounce completed, saving state...');
      try {
        await saveMockupState({
          mockups,
          uploadedImage,
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
          instructions,
          timestamp: Date.now()
        });
      } catch (error) {
        // Silently fail - don't break UX if localStorage fails
        if (isLocalDevelopment()) {
          console.warn('Failed to save mockup state:', error);
        }
      }
    }, 1500); // Debounce 1500ms to reduce save frequency and prevent quota issues

    return () => clearTimeout(timeoutId);
  }, [
    mockups,
    uploadedImage,
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
    // Note: isPromptReady is intentionally excluded - it's not persisted and causes extra saves
    suggestedTags,
    suggestedBrandingTags,
    suggestedLocationTags,
    suggestedAngleTags,
    suggestedLightingTags,
    suggestedEffectTags,
    suggestedMaterialTags,
    suggestedColors,
    instructions,
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

    if (selectedAngleTags.length > 0) basePrompt += ` The camera angle should be: ${selectedAngleTags.join(', ')}.`;
    if (selectedLightingTags.length > 0) basePrompt += ` The lighting should be: ${selectedLightingTags.join(', ')}.`;
    if (selectedEffectTags.length > 0) basePrompt += ` Apply a visual effect of: ${selectedEffectTags.join(', ')}.`;
    if (selectedMaterialTags.length > 0) basePrompt += ` The materials and textures should feature: ${selectedMaterialTags.join(', ')}.`;
    if (selectedColors.length > 0) basePrompt += ` The scene's color palette should be dominated by or feature accents of: ${selectedColors.join(', ')}.`;

    // Add instruction about reference images if present
    if (referenceImages.length > 0) {
      basePrompt += ` IMPORTANT: The provided reference image${referenceImages.length > 1 ? 's' : ''} ${referenceImages.length > 1 ? 'are' : 'is'} included as style and composition guidance. Study ${referenceImages.length > 1 ? 'these images' : 'this image'} carefully and create a mockup that matches the aesthetic, mood, composition style, lighting approach, color palette, and overall visual feeling of ${referenceImages.length > 1 ? 'these reference mockups' : 'this reference mockup'}. Use ${referenceImages.length > 1 ? 'them' : 'it'} as inspiration for creating a similar visual quality and atmosphere.`;
    }

    if (designType === 'logo') {
      if (generateText) basePrompt += " If appropriate for the mockup type, generate plausible placeholder text to make the scene more realistic.";
      else basePrompt += " No additional text or letters should be generated. The design is the sole graphic element.";
    }

    basePrompt += " Place the design exactly as provided, without modification.";

    if (designType === 'logo') {
      basePrompt += " When placing the design, ensure a comfortable safe area or 'breathing room' around it. The design must never touch or be clipped by the edges of the mockup surface (e.g., the edges of a business card or a book cover).";
      basePrompt += " CRITICAL: Analyze the provided logo image and ensure proper contrast between the logo and the mockup substrate. If the logo is white, it must never be placed on a white substrate - use dark or colored substrates instead.";
    }

    if (withHuman) {
      const humanAction = Math.random() < 0.5 ? 'looking at' : 'interacting with';
      basePrompt += ` The scene should include a human person naturally ${humanAction} the mockup product. Ensure the moment feels contextual for the product type.`;
    }

    if (additionalPrompt.trim()) {
      basePrompt += ` The scene must also include the following details: ${additionalPrompt.trim()}.`;
    }
    if (negativePrompt.trim()) {
      basePrompt += ` AVOID THE FOLLOWING: ${negativePrompt.trim()}.`;
    }
    if (instructions.trim()) {
      basePrompt += ` ADDITIONAL INSTRUCTIONS: ${instructions.trim()}.`;
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

    // Require a design type before generating any prompt
    if (!designType) {
      toast.error(t('messages.selectDesignTypeFirst') || 'Selecione o tipo (logo ou layout) antes de gerar o prompt.');
      return;
    }

    // Allow prompt generation only if we have a design type AND (uploaded image / reference)
    const hasRefImagesForSmartPrompt = referenceImages.length > 0;
    const hasValidDesignSetup = designType && (uploadedImage || hasRefImagesForSmartPrompt);
    if (!hasValidDesignSetup) {
      toast.error(t('messages.completeSteps') || 'Complete as etapas de configuração antes de gerar o prompt.');
      return;
    }

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
      // Image compression removed as requested by user
      let imageToSend = uploadedImage;


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
        instructions: instructions,
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
      const errorInfo = formatMockupError(err, t);
      if (errorInfo.message === t('messages.rateLimit')) {
        toast.error(errorInfo.message, { duration: 5000 });
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
  }, [
    uploadedImage,
    designType,
    selectedTags,
    selectedBrandingTags,
    selectedLocationTags,
    selectedAngleTags,
    selectedLightingTags,
    selectedEffectTags,
    selectedColors,
    aspectRatio,
    generateText,
    withHuman,
    enhanceTexture,
    negativePrompt,
    additionalPrompt,
    instructions,
    buildPrompt,
    t,
    isGeneratingPrompt,
    referenceImages
  ]);

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
    enhanceTexture,
    instructions
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
    setHasAnalyzed(false);
    setSuggestedBrandingTags([]);
    setSuggestedLocationTags([]);
    setSuggestedAngleTags([]);
    setSuggestedLightingTags([]);
    setSuggestedEffectTags([]);
    setSuggestedMaterialTags([]);
    setSuggestedColors([]);
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
    setReferenceImages([]);
    setSavedIndices(new Set());
    setSavedMockupIds(new Map());
    setMockupLikedStatus(new Map());
    setUploadedImage(null);
    setInstructions('');
    // Clear localStorage when resetting
    clearMockupState();
  }, [mockupCount]);

  const handleAnalyze = useCallback(async (imageOverride?: UploadedImage, silent?: boolean) => {
    const imageToUse = imageOverride ?? uploadedImage;
    const t0 = Date.now();
    if (import.meta.env.DEV) console.log('[dev] analyze: handleAnalyze start', silent ? '(silent)' : '');
    if (!imageToUse) {
      if (import.meta.env.DEV) console.log('[dev] analyze: skip (no image or blank)');
      return;
    }

    let nextStepTimeoutId: number | null = null;
    const nextStepShownRef = { current: false };

    if (!silent) {
      setIsAnalyzing(true);
      showTemporaryOverlay(5000); // Mostrar overlay por no máximo 5 segundos

      // Após 5 segundos, mostrar o próximo passo mesmo que a análise não tenha completado
      nextStepTimeoutId = window.setTimeout(() => {
        if (import.meta.env.DEV) console.log('[dev] analyze: showing next step after 5s (analysis may still be running)');
        nextStepShownRef.current = true;
        setIsAllCategoriesOpen(true);
        setIsAdvancedOpen(true);
        setHasAnalyzed(true);
        if (!selectedModel) setSelectedModel('gemini-2.5-flash-image');
      }, 5000);
    }

    try {
      let imageToAnalyze = imageToUse;
      if (imageToUse.base64) {
        try {
          const dataUrl = await compressImage(imageToUse.base64.includes(',') ? imageToUse.base64 : `data:${imageToUse.mimeType};base64,${imageToUse.base64}`, {
            maxWidth: 1024,
            maxHeight: 1024,
            maxSizeBytes: 500 * 1024,
            mimeType: imageToUse.mimeType,
          });
          const comma = dataUrl.indexOf(',');
          const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
          const mime = /^data:([^;]+);/.exec(dataUrl)?.[1] || imageToUse.mimeType;
          imageToAnalyze = { base64: b64, mimeType: mime };
        } catch {
          /* keep original if compression fails */
        }
      }

      const userContext = selectedBrandingTags.length > 0 ? { selectedBrandingTags } : undefined;
      if (import.meta.env.DEV) console.log('[dev] analyze: aiApi.analyzeSetup start', ((Date.now() - t0) / 1000).toFixed(2) + 's');
      const analysis = await aiApi.analyzeSetup(imageToAnalyze, instructions, userContext);
      if (import.meta.env.DEV) console.log('[dev] analyze: aiApi.analyzeSetup done', ((Date.now() - t0) / 1000).toFixed(2) + 's');

      setSuggestedBrandingTags(analysis.branding);
      setSuggestedTags(analysis.categories);
      setSuggestedLocationTags(analysis.locations);
      setSuggestedAngleTags(analysis.angles);
      setSuggestedLightingTags(analysis.lighting);
      setSuggestedEffectTags(analysis.effects);
      setSuggestedMaterialTags(analysis.materials);
      // Design type is now manually selected by user, not auto-set from analysis

      if (imageToUse.base64) {
        try {
          if (import.meta.env.DEV) console.log('[dev] analyze: extractColors start', ((Date.now() - t0) / 1000).toFixed(2) + 's');
          const { extractColors } = await import('@/utils/colorExtraction');
          const colorResult = await extractColors(imageToUse.base64, imageToUse.mimeType, 8);
          setSuggestedColors(colorResult.colors);
          if (import.meta.env.DEV) console.log('[dev] analyze: extractColors done', ((Date.now() - t0) / 1000).toFixed(2) + 's');
        } catch (colorErr) {
          console.error("Error extracting colors:", colorErr);
        }
      }

      // Se a análise terminou antes de 5 segundos, mostrar o próximo passo agora
      // Se terminou depois de 5 segundos, o timeout já terá mostrado o próximo passo
      if (!silent) {
        // Se o timeout ainda não executou, cancelar e mostrar o próximo passo agora
        if (nextStepTimeoutId !== null && !nextStepShownRef.current) {
          clearTimeout(nextStepTimeoutId);
          nextStepTimeoutId = null;
          setIsAllCategoriesOpen(true);
          setIsAdvancedOpen(true);
          setHasAnalyzed(true);
          if (!selectedModel) setSelectedModel('gemini-2.5-flash-image');
        }
        // Se o timeout já executou (passou de 5s), apenas atualizar os dados
        // (hasAnalyzed já está true, então o conteúdo já está visível)
      }
      if (import.meta.env.DEV) console.log('[dev] analyze: handleAnalyze success', ((Date.now() - t0) / 1000).toFixed(2) + 's');
    } catch (err) {
      const errorInfo = formatMockupError(err, t);
      if (errorInfo.message === t('messages.rateLimit')) {
        toast.error(errorInfo.message, { duration: 5000 });
      } else {
        if (isLocalDevelopment()) console.error("Error getting full analysis:", err);
        toast.error(errorInfo.message, { description: errorInfo.suggestion, duration: 5000 });
      }
    } finally {
      if (import.meta.env.DEV) console.log('[dev] analyze: handleAnalyze finally', ((Date.now() - t0) / 1000).toFixed(2) + 's');
      if (!silent) {
        setIsAnalyzing(false);
        // Garantir que o overlay seja ocultado quando a análise terminar
        // (mesmo que ainda não tenham passado os 5 segundos)
        hideOverlay();

        // Limpar timeout se ainda existir
        if (nextStepTimeoutId !== null) {
          clearTimeout(nextStepTimeoutId);
        }
      }
    }
  }, [uploadedImage, designType, instructions, selectedBrandingTags, t, showTemporaryOverlay, hideOverlay]);

  // Botão explícito de análise (dispara a análise completa com overlay)
  const handleAnalyzeButtonClick = useCallback(() => {
    void handleAnalyze();
  }, [handleAnalyze]);

  const handleImageUpload = useCallback(async (image: UploadedImage) => {
    // Check authentication
    if (!(await requireAuth())) return;

    // Para outros modos, a imagem é usada na geração
    // Reset controls primeiro (ele vai resetar uploadedImage, mas vamos setar depois)
    setReferenceImages([]);
    resetControls();
    // Agora seta uploadedImage DEPOIS do reset para que não seja sobrescrito
    setUploadedImage(image);

    // Upload to temp R2 to save storage
    if (image.base64 && !image.url) {
      mockupApi.uploadTempImage(image.base64, image.mimeType)
        .then(url => {
          setUploadedImage(prev => prev ? ({ ...prev, url, base64: undefined }) : null);
        })
        .catch(err => {
          if (isLocalDevelopment()) console.error('Failed to upload temp image:', err);
        });
    }

    setSelectedModel(null);
    setResolution('1K');
    // Por último, esconde welcome screen para garantir que fique false
    setShowWelcome(false);

    // Navega para a rota /mockupmachine
    navigate('/mockupmachine');

    // Auto-extract colors from uploaded image (local only, sem chamar análise de IA)
    try {
      const { extractColors } = await import('@/utils/colorExtraction');
      const colorResult = await extractColors(image.base64, image.mimeType, 8);
      setSuggestedColors(colorResult.colors);
      if (isLocalDevelopment()) {
        console.log('🎨 Auto-extracted colors:', colorResult.colors);
      }
    } catch (colorErr) {
      if (isLocalDevelopment()) {
        console.error("Error auto-extracting colors:", colorErr);
      }
      // Non-critical - don't block UX if color extraction fails
    }
  }, [designType, resetControls, isAuthenticated, isCheckingAuth, t]);

  const handleReplaceImage = useCallback(async (image: UploadedImage) => {
    // Check authentication
    if (!(await requireAuth())) return;

    // Validate image data
    if (!image || (!image.base64 && !image.url)) {
      console.error('Invalid image: missing base64 or url');
      return;
    }

    // Ensure base64 is a string
    const base64String = typeof image.base64 === 'string' ? image.base64 : '';
    const mimeType = image.mimeType || 'image/png';

    // Para outros modos, substitui a imagem mantendo o setup
    const validImage: UploadedImage = base64String ? { base64: base64String, mimeType } : { url: image.url!, mimeType };
    setUploadedImage(validImage);

    // Upload to temp R2 to save storage
    if (base64String && !image.url) {
      mockupApi.uploadTempImage(base64String, mimeType)
        .then(url => {
          setUploadedImage(prev => prev ? ({ ...prev, url, base64: undefined }) : null);
        })
        .catch(err => {
          if (isLocalDevelopment()) console.error('Failed to upload temp image:', err);
        });
    }

    // Auto-extract colors from uploaded image (only if we have base64)
    if (base64String) {
      try {
        const { extractColors } = await import('@/utils/colorExtraction');
        const colorResult = await extractColors(base64String, mimeType, 8);
        setSuggestedColors(colorResult.colors);
        if (isLocalDevelopment()) {
          console.log('🎨 Auto-extracted colors:', colorResult.colors);
        }
      } catch (colorErr) {
        if (isLocalDevelopment()) {
          console.error("Error auto-extracting colors:", colorErr);
        }
      }
    }

  }, [designType, isAuthenticated, isCheckingAuth, t]);

  const handleStartOver = () => {
    setUploadedImage(null);
    setReferenceImages([]);
    resetControls();
    setShowWelcome(true);
    // Clear persisted state from localStorage
    clearMockupState();
    localStorage.removeItem('edit-mockup');
  };

  const handleDesignTypeChange = (type: DesignType) => {
    // Se mudar de blank para outro tipo, limpar referenceImage

    setDesignType(type);
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
    const hasReferenceImage = referenceImages.length > 0;
    const shouldCollapseSections = hasReferenceImage && uploadedImage !== null;

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
  }, [referenceImages, uploadedImage, designType]);


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
      const errorInfo = formatMockupError(err, t);
      if (errorInfo.message === t('messages.rateLimit')) {
        toast.error(errorInfo.message, { duration: 5000 });
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

    const canProceed = await validateCredits({ model: modelToUse, resolution: resolutionToUse });
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

      // Process reference image if needed (compression disabled)
      const processedReferenceImage = referenceImage || undefined;
      if (!processedReferenceImage) {
        throw new Error(t('messages.failedToProcessReferenceImage'));
      }

      // Process reference images if available (compression disabled)
      const processedReferenceImages = referenceImages.length > 0 ? referenceImages : undefined;

      // Use reference images if available (Pro: up to 3, HD: up to 1)
      const referenceImagesToUse = processedReferenceImages && processedReferenceImages.length > 0
        ? processedReferenceImages
        : undefined;

      // CRITICAL: Use backend endpoint which validates and deducts credits BEFORE generation
      // Prefer url over base64 for referenceImages so Gemini can read when we only have R2 URL
      const result = await mockupApi.generate({
        promptText: prompt,
        baseImage: {
          base64: processedReferenceImage.base64,
          mimeType: processedReferenceImage.mimeType
        },
        model: modelToUse,
        resolution: resolutionToUse,
        aspectRatio: aspectRatio,
        referenceImages: referenceImagesToUse?.map(img =>
          img.url ? { url: img.url, mimeType: img.mimeType } : { base64: img.base64, mimeType: img.mimeType }
        ),
        imagesCount: 1,
        provider: imageProvider,
      });

      onSuccess(result.imageUrl || result.imageBase64 || '');

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
      const errorInfo = formatMockupError(err, t);
      toast.error(errorInfo.message, {
        description: errorInfo.suggestion,
        duration: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [validateCredits, selectedModel, resolution, aspectRatio, onSubscriptionModalOpen, setSubscriptionStatus, referenceImages, t]);



  const runGeneration = useCallback(async (indexToUpdate?: number, promptOverride?: string, appendMode: boolean = false) => {
    // Prevent multiple simultaneous calls to runGeneration
    // Check if any generation is currently in progress
    // Prevent multiple simultaneous calls to runGeneration ONLY if not in append mode
    // We want to allow concurrent generations if we are adding new images
    if (isLoading.some(Boolean) && !appendMode && indexToUpdate === undefined) {
      if (isLocalDevelopment()) {
        console.warn('[runGeneration] Generation already in progress and not in append mode, ignoring duplicate call');
      }
      return;
    }

    if (!selectedModel) {
      toast.error(t('messages.selectModelBeforeGenerating'), { duration: 5000 });
      return;
    }

    const modelToUse = selectedModel || 'gemini-2.5-flash-image';
    const resolutionToUse = modelToUse === 'gemini-3-pro-image-preview' ? resolution : undefined;

    const canProceed = await validateCredits({ model: modelToUse, resolution: resolutionToUse });
    if (!canProceed) return;

    const promptToUse = promptOverride || promptPreview;
    // Allow generation if: has reference images OR (has design type AND has uploaded image) AND has prompt
    const hasReferenceImages = referenceImages.length > 0;
    const hasValidSetup = hasReferenceImages || (designType && uploadedImage);
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

        // No modo normal, passa imagem (não existe mais modo blank)
        const baseImageForGeneration = (uploadedImage || undefined);

        // Process base image if needed (compression disabled)
        const processedBaseImage = baseImageForGeneration || undefined;

        // Use reference images directly (compression disabled)
        const processedReferenceImages = referenceImages.length > 0 ? referenceImages : undefined;

        // Use reference images if available (Pro: up to 3, HD: up to 1)
        const referenceImagesToUse = processedReferenceImages && processedReferenceImages.length > 0
          ? processedReferenceImages
          : undefined;

        // CRITICAL: Use backend endpoint which validates and deducts credits BEFORE generation
        // This prevents abuse and ensures credits are always deducted atomically
        // Pass slot index as uniqueId to allow parallel batch requests with same parameters
        const result = await mockupApi.generate({
          promptText: promptToUse,
          baseImage: processedBaseImage
            ? processedBaseImage.url
              ? { url: processedBaseImage.url, mimeType: processedBaseImage.mimeType }
              : { base64: processedBaseImage.base64, mimeType: processedBaseImage.mimeType }
            : undefined,
          model: modelToUse,
          resolution: resolutionToUse,
          aspectRatio: aspectRatio,
          referenceImages: referenceImagesToUse?.map(img =>
            img.url ? { url: img.url, mimeType: img.mimeType } : { base64: img.base64, mimeType: img.mimeType }
          ),
          imagesCount: 1,
          feature: 'mockupmachine',
          uniqueId: index, // Use slot index to differentiate parallel batch requests
          provider: imageProvider,
        });

        // Image successfully generated - set it in state (prefer URL; if only base64, try client-side upload)
        imageGenerated = true;
        let finalImage: string | null;
        if (result.imageUrl) {
          finalImage = result.imageUrl;
        } else if (result.imageBase64) {
          try {
            finalImage = await mockupApi.uploadTempImage(result.imageBase64, 'image/png');
          } catch {
            finalImage = result.imageBase64; // persistence will null it; still show in UI
          }
        } else {
          finalImage = null;
        }
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
        const errorInfo = formatMockupError(err, t);

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
        // Append mode (Prepend logic): add new slots at the BEGINNING
        // Get current length before adding new slots
        const currentLength = mockups.length;

        // We need to shift saved indices and IDs because we are inserting at 0
        // This must happen synchronously before async operations

        // Shift saved indices
        setSavedIndices(prev => {
          const newSet = new Set<number>();
          prev.forEach(index => {
            newSet.add(index + mockupCount);
          });
          return newSet;
        });

        // Shift saved mockup IDs
        setSavedMockupIds(prev => {
          const newMap = new Map<number, string>();
          prev.forEach((id, index) => {
            newMap.set(index + mockupCount, id);
          });
          return newMap;
        });

        // Shift liked status
        setMockupLikedStatus(prev => {
          const newMap = new Map<number, boolean>();
          prev.forEach((status, index) => {
            newMap.set(index + mockupCount, status);
          });
          return newMap;
        });

        // Insert available slots at the beginning
        setMockups(prev => {
          const newMockups = [...prev];
          // Add new slots at the beginning
          const newSlots = Array(mockupCount).fill(null);
          return [...newSlots, ...newMockups];
        });

        setIsLoading(prev => {
          const newLoading = [...prev];
          const newSlots = Array(mockupCount).fill(true);
          return [...newSlots, ...newLoading];
        });

        setPromptSuggestions([]);

        // Generate all new mockups in parallel
        // The indices for the NEW items are 0 to mockupCount-1
        const promises = Array.from({ length: mockupCount }, (_, i) =>
          generateAndSet(i)
        );
        await Promise.allSettled(promises);

        // Refresh subscription status after all generations complete
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
  }, [uploadedImage, selectedTags, selectedBrandingTags, promptPreview, hasGenerated, designType, mockupCount, subscriptionStatus, aspectRatio, selectedModel, resolution, validateCredits, onSubscriptionModalOpen, setSubscriptionStatus, mockups, referenceImages, t]);

  const handleSurpriseMe = useCallback(async (autoGenerate: boolean = false) => {
    // Ensure model is selected (default to gemini-2.5-flash-image if not set)
    const modelToUse = selectedModel || 'gemini-2.5-flash-image';
    if (!selectedModel) {
      setSelectedModel('gemini-2.5-flash-image');
    }

    // Ensure designType is set (default to 'logo' if not set, since Surprise Me works best with a type)
    const designTypeToUse = designType || 'logo';
    if (!designType) {
      setDesignType('logo');
    }

    // Keep existing branding tags - don't change them
    // Use current branding tags from state
    const brandingTagsToUse = selectedBrandingTags.length > 0 ? selectedBrandingTags : [];

    // Use pool from Context when Pool Mode is active, otherwise use empty arrays (no restrictions)
    const selectedTagsSettings: SurpriseMeSelectedTags = isSurpriseMeMode ? surpriseMePool : {
      selectedCategoryTags: [],
      selectedLocationTags: [],
      selectedAngleTags: [],
      selectedLightingTags: [],
      selectedEffectTags: [],
      selectedMaterialTags: [],
    };

    // 1. Categories: Prioritize AI suggestions
    let selectedCategory: string;
    const aiSuggestedCategories = suggestedTags || [];
    const userAllowedCategories = selectedTagsSettings.selectedCategoryTags;

    // First filter AI suggestions by user's "Surprise Me" settings
    const filteredAiCategories = aiSuggestedCategories.filter(tag =>
      userAllowedCategories.length === 0 || userAllowedCategories.includes(tag)
    );

    if (filteredAiCategories.length > 0) {
      selectedCategory = filteredAiCategories[Math.floor(Math.random() * filteredAiCategories.length)];
    } else {
      // Fallback: Use available dynamic tags instead of static list
      // filtered by user settings if any
      const poolToUse = userAllowedCategories.length > 0
        ? availableMockupTags.filter(tag => userAllowedCategories.includes(tag))
        : availableMockupTags;

      // If pool is empty (edge case), fallback to full list
      const finalPool = poolToUse.length > 0 ? poolToUse : availableMockupTags;

      selectedCategory = finalPool[Math.floor(Math.random() * finalPool.length)];
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

      // Filter preferred options by user allowed list if set
      const filteredPreferredOptions = userAllowedLocations.length > 0
        ? preferredOptions.filter(opt => userAllowedLocations.includes(opt))
        : preferredOptions;

      // Ensure we have something to pick from
      const optionsToUse = filteredPreferredOptions.length > 0 ? filteredPreferredOptions : preferredOptions;

      const backgroundsToUse = filteredBackgrounds.length > 0
        ? [...new Set([...optionsToUse, ...filteredBackgrounds])]
        : [...new Set([...optionsToUse, ...suitableBackgrounds])];

      // Final availability check with full location list fallback
      const finalBackgrounds = backgroundsToUse.length > 0
        ? backgroundsToUse
        : availableLocationTags; // Fallback to all dynamic locations

      selectedBackground = finalBackgrounds[Math.floor(Math.random() * finalBackgrounds.length)];
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

    // Always generate prompt automatically
    // The autoGenerate checkbox only controls if outputs are also generated automatically
    setTimeout(() => {
      setShouldAutoGenerate(true);
      if (autoGenerate) {
        // Auto-generate mode: Set tags -> Auto Generate Prompt -> Auto Generate Output
        setAutoGenerateSource('surprise');
      } else {
        // Prompt-only mode: Set tags -> Auto Generate Prompt -> Wait for user
        setAutoGenerateSource('surprise-prompt-only');
      }
    }, 2000); // Increased delay to allow users to see selected tags
  }, [aspectRatio, designType, selectedModel, selectedBrandingTags, generateText, withHuman, additionalPrompt, negativePrompt, runGeneration, mockups, isSurpriseMeMode, surpriseMePool]);

  const handleSurpriseMeWithDice = useCallback((autoGen: boolean) => {
    setIsDiceAnimatingFloating(true);
    showTemporaryOverlay(300);
    handleSurpriseMe(autoGen);
    setTimeout(() => setIsDiceAnimatingFloating(false), 800);
  }, [handleSurpriseMe, showTemporaryOverlay]);

  useEffect(() => {
    if (isGeneratingPrompt) setIsDiceAnimatingFloating(false);
  }, [isGeneratingPrompt]);

  const handleSaveAllUnsaved = useCallback(async () => {
    if (!(await requireAuth())) return;

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
            designType: designType || 'logo',
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

  // Handle navigation blocker
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setUnsavedDialogConfig({
        message: t('messages.unsavedChangesMessage') || "You have unsaved changes. Are you sure you want to discard them?",
        onConfirm: () => {
          clearMockupState();
          localStorage.removeItem('edit-mockup');
          blocker.proceed();
        },
        onSaveAll: async () => {
          await handleSaveAllUnsaved();
          // We don't auto-proceed after save, user can decide
        },
        showSaveAll: true
      });
      setShowUnsavedDialog(true);
    }
  }, [blocker, t, handleSaveAllUnsaved]);

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
    // Check authentication
    if (!(await requireAuth())) return;

    // Check if prompt is ready (was generated and tags haven't changed)
    // OR if prompt exists and was manually edited (user wants to use their custom prompt)
    const hasPrompt = promptPreview.trim().length > 0;

    // Check if we have valid setup (design type selected and optionally reference images)
    const hasReferenceImagesForPrompt = referenceImages.length > 0;
    const hasValidSetupForPrompt = !!designType && (uploadedImage || hasReferenceImagesForPrompt);

    if (!isPromptReady && !hasPrompt) {
      // No prompt exists and not ready - require valid setup
      if (!hasValidSetupForPrompt) {
        toast.error(t('messages.selectDesignTypeFirst') || t('messages.completeSteps'), { duration: 5000 });
        return;
      }
      await handleGenerateSmartPrompt();
    } else if (!isPromptReady && hasPrompt) {
      // Prompt exists but tags changed (isPromptReady is false due to useEffect)
      // Force user to regenerate prompt to ensure it matches current tags
      if (!hasValidSetupForPrompt) {
        toast.error(t('messages.selectDesignTypeFirst') || t('messages.completeSteps'), { duration: 5000 });
        return;
      }
      toast.info(t('messages.tagsChanged'), { duration: 4000 });
      await handleGenerateSmartPrompt();
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
  }, [promptPreview, selectedTags, designType, referenceImages, handleGenerateSmartPrompt, runGeneration, mockups, savedIndices, handleSaveAllUnsaved, requireAuth, t]);

  const handleGenerateSuggestion = useCallback(async (suggestion: string) => {
    // Check authentication
    if (!(await requireAuth())) return;

    if (!selectedModel) {
      toast.error(t('messages.selectModelBeforeGenerating'), { duration: 5000 });
      return;
    }

    // Allow generation if: has reference images OR (has design type AND has uploaded image) AND has suggestion
    const hasRefImages = referenceImages.length > 0;
    const hasValidSetupForSuggestion = hasRefImages || (designType && uploadedImage);
    if (!hasValidSetupForSuggestion || !suggestion.trim()) {
      toast.error(t('messages.completeSteps'), { duration: 5000 });
      return;
    }

    // Generate using the suggestion prompt in append mode (adds to existing mockups)
    await runGeneration(undefined, suggestion, true);
  }, [selectedModel, designType, uploadedImage, referenceImages, selectedTags, runGeneration, requireAuth, t]);

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
        designType: designType || 'logo',
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
    if (!(await requireAuth())) return;

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
          designType: designType || 'logo',
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

  const prepareForNewMockupSlot = useCallback(() => {
    // Close fullscreen modal immediately
    handleCloseFullScreen();

    // Ensure we stay on MockupMachinePage
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

    return newIndex;
  }, [handleCloseFullScreen, hasGenerated, isSidebarVisibleMobile, mockups.length]);

  const handleNewAngleFromOutput = useCallback(async (index: number, angle: string) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    const newIndex = prepareForNewMockupSlot();

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
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, executeImageEditOperation, prepareForNewMockupSlot]);

  const handleNewBackgroundFromOutput = useCallback(async (index: number) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    const newIndex = prepareForNewMockupSlot();

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
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, selectedLocationTags, executeImageEditOperation, prepareForNewMockupSlot]);

  const handleNewBackgroundFromOutputWithPreset = useCallback(async (index: number, background: string) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    const newIndex = prepareForNewMockupSlot();

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
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, executeImageEditOperation, prepareForNewMockupSlot]);

  const handleNewLightingFromOutputWithPreset = useCallback(async (index: number, lighting: string) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    const newIndex = prepareForNewMockupSlot();

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
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, executeImageEditOperation, prepareForNewMockupSlot]);

  const handleZoomInFromOutput = useCallback(async (index: number) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    const newIndex = prepareForNewMockupSlot();

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
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, executeImageEditOperation, prepareForNewMockupSlot]);

  const handleZoomOutFromOutput = useCallback(async (index: number) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    const newIndex = prepareForNewMockupSlot();

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
  }, [mockups, isLoading, isGeneratingPrompt, buildPrompt, executeImageEditOperation, prepareForNewMockupSlot]);

  const handleReImagineFromOutput = useCallback(async (index: number, reimaginePrompt: string) => {
    const outputImage = mockups[index];
    if (!outputImage || isLoading[index] || isGeneratingPrompt) return;

    const newIndex = prepareForNewMockupSlot();

    // Intelligent prompt that combines the original context with user's requested changes
    const intelligentPrompt = `You are helping a user refine and reimagine their mockup design. 

CURRENT CONTEXT:
- Original prompt: "${promptPreview}"
- Design type: ${designType || 'logo'}
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
  }, [mockups, isLoading, isGeneratingPrompt, promptPreview, designType, selectedTags, selectedBrandingTags, selectedLocationTags, selectedAngleTags, selectedLightingTags, selectedEffectTags, executeImageEditOperation, prepareForNewMockupSlot, t]);

  const designTypeSelected = !!designType;
  const brandingComplete = selectedBrandingTags.length > 0;
  const categoriesComplete = selectedTags.length > 0;

  // const isGenerating = isLoading.some(Boolean); // Removed to allow concurrent operations
  const isGenerating = false; // Always allow interactions that support queuing

  useEffect(() => {
    if (autoGenerateTimeoutRef.current) {
      clearTimeout(autoGenerateTimeoutRef.current);
      autoGenerateTimeoutRef.current = null;
    }

    // Allow auto-generate only if design type is selected and setup is valid
    const hasRefImagesForAuto = referenceImages.length > 0;
    const canAutoGenerate = !!designType && (uploadedImage || hasRefImagesForAuto);

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
    // 3. Not currently generating prompt (allow concurrent image generation)
    if (autoGenerateSource === 'surprise' && isPromptReady && !isGeneratingPrompt) {
      // Clear source first to prevent potential loops (although dependence on isPromptReady helps)
      setAutoGenerateSource(null);

      // Trigger generation
      runGeneration(undefined, undefined, true);
    }
  }, [autoGenerateSource, isPromptReady, isGeneratingPrompt, runGeneration]);

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
  // Disable button for: auth checking, not authenticated, currently generating prompt, insufficient credits, or 0 credits
  // We allow isGenerating (image generation) to enable queuing/concurrent generation
  const isGenerateDisabled = isCheckingAuth ||
    isAuthenticated !== true ||
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




  // Helper values for GenerateButton visibility

  const hasUserChanges = designTypeSelected || brandingComplete || categoriesComplete || referenceImages.length > 0 || (!!uploadedImage);

  // Logic to show generation button (matches SidebarOrchestrator logic)
  const shouldShowGenerateButton = isPromptReady || hasUserChanges;

  // --- View State Helpers ---
  const isSetupMode = !hasAnalyzed;
  const isDashboardMode = hasAnalyzed;

  // Se vazio, mostrar a WelcomeScreen por cima, pro user sempre upar a imagem pela WelcomeScreen
  const shouldShowWelcome = !uploadedImage;

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
      <AnalyzingImageOverlay isVisible={isAnalysisOverlayVisible} />

      {shouldShowWelcome ? (
        <WelcomeScreen
          onImageUpload={handleImageUpload}
        />
      ) : (
        <div className="h-full w-full pt-12 md:pt-14 overflow-hidden bg-background">
          <div className={cn(
            "flex h-full transition-all duration-500",
            isSetupMode ? "flex-col items-center justify-center p-4 md:p-8" : "flex-row"
          )}>

            {/* Sidebar Orchestrator Container */}
            <div className={cn(
              "z-30 transition-all duration-500 ease-in-out",
              isSetupMode ? "w-full" : [
                "fixed inset-0 lg:relative lg:inset-auto",
                isSidebarVisibleMobile ? "flex bg-background/95 backdrop-blur-md" : "hidden lg:flex",
                isSidebarCollapsed ? "lg:w-0 lg:opacity-0 lg:pointer-events-none" : "lg:w-auto lg:opacity-100"
              ]
            )}>
              <SidebarOrchestrator
                sidebarWidth={sidebarWidth}
                sidebarRef={sidebarRef}
                onSidebarWidthChange={setSidebarWidth}
                onSurpriseMe={handleSurpriseMe}
                onImageUpload={handleImageUpload}
                onReplaceImage={handleReplaceImage}
                onReferenceImagesChange={setReferenceImages}
                onStartOver={handleStartOver}
                onDesignTypeChange={handleDesignTypeChange}
                onSuggestPrompts={handleSuggestPrompts}
                onGenerateSmartPrompt={handleGenerateSmartPrompt}
                onSimplify={handleSimplify}
                onRegenerate={() => runGeneration()}
                onGenerateClick={handleGenerateClick}
                onGenerateSuggestion={handleGenerateSuggestion}
                onAnalyze={handleAnalyzeButtonClick}
                generateOutputsButtonRef={generateOutputsButtonRef}
                authenticationRequiredMessage={t('messages.authenticationRequired')}
              />
            </div>

            {/* Dashboard Main Area */}
            {isDashboardMode && (
              <main className={cn(
                "flex-1 min-w-0 h-full relative overflow-hidden transition-all duration-500",
                "p-2 md:p-6 lg:p-8 custom-scrollbar",
                isSidebarCollapsed && "lg:pl-16 shadow-[inset_20px_0_30px_-20px_rgba(0,0,0,0.3)]"
              )}>

                {/* Desktop Sidebar Toggle */}
                <div className="hidden lg:block absolute left-4 top-6 z-40">
                  <Button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-xl bg-neutral-900/50 backdrop-blur-md border border-white/5 hover:bg-neutral-800 hover:border-brand-cyan/30 text-neutral-400 hover:text-brand-cyan shadow-xl transition-all group"
                  >
                    <X className={cn(
                      "h-5 w-5 transition-transform duration-500",
                      !isSidebarCollapsed ? "rotate-180" : "group-hover:scale-110"
                    )} />
                  </Button>
                </div>

                {/* Mobile Sidebar Toggle (Visible only when sidebar is hidden) */}
                {!isSidebarVisibleMobile && (
                  <div className="lg:hidden fixed bottom-6 left-6 z-40">
                    <Button
                      onClick={() => setIsSidebarVisibleMobile(true)}
                      variant="default"
                      size="icon"
                      className="w-12 h-12 rounded-full bg-brand-cyan text-black shadow-2xl shadow-brand-cyan/20 hover:scale-110 active:scale-95 transition-all"
                    >
                      <Menu className="h-6 w-6" />
                    </Button>
                  </div>
                )}

                {/* Top Action Bar (Mobile Only - Closes Sidebar) */}
                {isSidebarVisibleMobile && (
                  <div className="lg:hidden fixed top-6 right-6 z-50 mt-[30px]">
                    <Button
                      onClick={() => setIsSidebarVisibleMobile(false)}
                      variant="outline"
                      size="icon"
                      className="w-10 h-10 rounded-full bg-neutral-900 shadow-xl border-white/10"
                    >
                      <Menu className="h-5 w-5 rotate-180" />
                    </Button>
                  </div>
                )}

                {/* Content Rendering */}
                <div className="h-full w-full min-w-0 animate-fade-in-up overflow-hidden">
                  <MockupDisplay
                    mockups={mockups}
                    isLoading={isLoading}
                    isSidebarCollapsed={isSidebarCollapsed}
                    onRedraw={handleRedrawClick}
                    onView={handleOpenFullScreen}
                    onNewAngle={handleNewAngleFromOutput}
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
                </div>
              </main>
            )}
          </div>
        </div>
      )}

      {/* Overlays / Modals / Portals */}
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
            setMockupLikedStatus(prev => new Map(prev).set(fullScreenImageIndex, newIsLiked));
          }}
          isLiked={mockupLikedStatus.get(fullScreenImageIndex) ?? false}
          editButtonsDisabled={isEditOperationDisabled}
          creditsPerOperation={creditsNeededForEdit}
        />
      )}

      {/* Floating SurpriseMeControl (mobile only, when sidebar hidden) */}
      {!isSidebarVisibleMobile && ((isDashboardMode && shouldShowGenerateButton) || hasAnalyzed) && (
        <div className="fixed bottom-0 right-0 left-0 z-[60] lg:hidden animate-in fade-in slide-in-from-bottom-4 duration-300 bg-background px-4 md:px-6">
          <SurpriseMeControl
            onSurpriseMe={handleSurpriseMeWithDice}
            isGeneratingPrompt={isGeneratingPrompt}
            isDiceAnimating={isDiceAnimatingFloating}
            isSurpriseMeMode={isSurpriseMeMode}
            setIsSurpriseMeMode={setIsSurpriseMeMode}
            autoGenerate={autoGenerateFloating}
            setAutoGenerate={setAutoGenerateFloating}
            selectedModel={selectedModel}
            mockupCount={mockupCount}
            resolution={resolution}
            showBackground
            containerClassName="shadow-lg !pb-0 rounded-b-none"
            onGeneratePrompt={handleGenerateSmartPrompt}
            onGenerateOutputs={handleGenerateClick}
            isGenerateDisabled={isGenerateDisabled}
            isGeneratingOutputs={isLoading.some(Boolean)}
            isPromptReady={isPromptReady}
            showGenerateButtons
          />
        </div>
      )}

      {/* Confirmation & Settings Modals */}
      {showUnsavedDialog && unsavedDialogConfig && (
        <ConfirmationModal
          isOpen={showUnsavedDialog}
          onClose={() => {
            setShowUnsavedDialog(false);
            setUnsavedDialogConfig(null);
            if (blocker.state === 'blocked') blocker.reset();
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
    </>
  );
};

