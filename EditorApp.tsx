import React, { useState, useCallback, useEffect, useRef } from 'react';
import { EditorSidebar } from './components/EditorSidebar';
import { EditorDisplay } from './components/EditorDisplay';
import { FullScreenViewer } from './components/FullScreenViewer';
import { Header } from './components/Header';
import { SubscriptionModal } from './components/SubscriptionModal';
import { CreditPackagesModal } from './components/CreditPackagesModal';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { RefundPolicy } from './pages/RefundPolicy';
import { UsagePolicy } from './pages/UsagePolicy';
import { LinearGradientBackground } from './components/ui/LinearGradientBackground';
import { aiApi } from './services/aiApi';
import { RateLimitError, ModelOverloadedError } from './services/geminiService';
import { mockupApi } from './services/mockupApi';
import { subscriptionService, type SubscriptionStatus } from './services/subscriptionService';
import { authService } from './services/authService';
import { useLayout } from './hooks/useLayout';
import type { UploadedImage, AspectRatio, GeminiModel } from './types';
import { getCreditsRequired } from './utils/creditCalculator';
import { toast } from 'sonner';

// Editor mode constants
const AVAILABLE_OBJECTS = ["Business Card", "Letterhead", "A4 Paper", "Envelope", "Credential", "Postcard", "Sticker", "Label"];
const AVAILABLE_THEMES = ["Christmas", "Carnival", "Romantic", "Snow", "Fire", "Summer", "Autumn", "Spring", "Winter"];
const AVAILABLE_ANGLE_TAGS = ["Eye-Level", "High Angle", "Low Angle", "Top-Down (Flat Lay)", "Dutch Angle", "Worm's-Eye View"];
const AVAILABLE_LOCATION_TAGS = ["Tokyo", "New York", "Brazil", "Paris", "London", "Nordic", "California Coast", "Minimalist Studio"];

// Standardized error messages
const ERROR_MESSAGES = {
  AUTHENTICATION_REQUIRED: "Please sign in to edit mockups.",
  AUTHENTICATION_ERROR: "Authentication error. Please sign in again.",
  SUBSCRIPTION_REQUIRED: "Subscription required. Please upgrade to continue editing mockups.",
  GENERATION_ERROR: "An error occurred during editing. Please try again.",
} as const;

const RATE_LIMIT_MESSAGE = "The AI is very popular right now! Please wait about 10 minutes and try again. This helps us ensure fair access for everyone. 🤖";

// Helper to detect if running in local development
const isLocalDevelopment = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
};

const EditorApp: React.FC = () => {
  const [editorMockup, setEditorMockup] = useState<string | null>(null);
  const [editorIsLoading, setEditorIsLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [customObjectInput, setCustomObjectInput] = useState('');
  const [customThemeInput, setCustomThemeInput] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isCreditPackagesModalOpen, setIsCreditPackagesModalOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(550);
  const [fullScreenImageIndex, setFullScreenImageIndex] = useState<number | null>(null);
  const [aspectRatio] = useState<AspectRatio>('16:9');
  // Always use HD Flash model for editor
  const MODEL_TO_USE: GeminiModel = 'gemini-2.5-flash-image';
  
  const { isAuthenticated, isCheckingAuth } = useLayout(); // Usar estado de autenticação do contexto centralizado
  
  const sidebarRef = useRef<HTMLElement>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isUsagePolicyOpen, setIsUsagePolicyOpen] = useState(false);

  // Load initial image from query params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const imageParam = urlParams.get('image');
    if (imageParam) {
      try {
        setEditorMockup(decodeURIComponent(imageParam));
        // Clean URL
        window.history.replaceState({}, '', '/editor');
      } catch (error) {
        console.error('Error loading image from query param:', error);
      }
    }
  }, []);

  // Load subscription status on mount and when authentication changes
  useEffect(() => {
    const loadSubscriptionStatus = async () => {
      if (isAuthenticated === true) {
        try {
          const status = await subscriptionService.getSubscriptionStatus();
          setSubscriptionStatus(status);
        } catch (error) {
          console.error('Failed to load subscription status:', error);
        }
      }
    };

    loadSubscriptionStatus();
  }, [isAuthenticated]);

  // Handle location changes for modals
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      setCurrentPath(path);
      if (path === '/privacy') {
        setIsPrivacyOpen(true);
        setIsTermsOpen(false);
        setIsRefundOpen(false);
        setIsUsagePolicyOpen(false);
      } else if (path === '/terms') {
        setIsTermsOpen(true);
        setIsPrivacyOpen(false);
        setIsRefundOpen(false);
        setIsUsagePolicyOpen(false);
      } else if (path === '/refund') {
        setIsRefundOpen(true);
        setIsPrivacyOpen(false);
        setIsTermsOpen(false);
        setIsUsagePolicyOpen(false);
      } else if (path === '/usage-policy') {
        setIsUsagePolicyOpen(true);
        setIsPrivacyOpen(false);
        setIsTermsOpen(false);
        setIsRefundOpen(false);
      } else {
        setIsPrivacyOpen(false);
        setIsTermsOpen(false);
        setIsRefundOpen(false);
        setIsUsagePolicyOpen(false);
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Sidebar resizer
  useEffect(() => {
    if (!editorMockup) return;

    const resizer = document.getElementById('sidebar-resizer');
    if (!resizer || !sidebarRef.current) return;
    
    const sidebar = sidebarRef.current;

    const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = sidebar.offsetWidth;
        
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const newWidth = startWidth + dx;
            const minWidth = 380;
            const maxWidth = 800;

            if (newWidth >= minWidth && newWidth <= maxWidth) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    resizer.addEventListener('mousedown', handleMouseDown);
    
    return () => {
        resizer.removeEventListener('mousedown', handleMouseDown);
    };
  }, [editorMockup]);

  // Helper function to validate authentication and subscription
  const validateAuthAndSubscription = useCallback(async (
    creditsNeeded?: number,
    model?: GeminiModel | null
  ): Promise<boolean> => {
    // Calculate credits needed if not provided
    let actualCreditsNeeded = creditsNeeded;
    if (actualCreditsNeeded === undefined && model) {
      actualCreditsNeeded = getCreditsRequired(model);
    } else if (actualCreditsNeeded === undefined) {
      // Fallback to 1 if model not provided
      actualCreditsNeeded = 1;
    }
    // Check authentication first (skip in local development)
    if (!isLocalDevelopment()) {
      // Use context state first - if not authenticated, return early
      if (isAuthenticated === false) {
        toast.error(ERROR_MESSAGES.AUTHENTICATION_REQUIRED, { duration: 5000 });
        return false;
      }
      
      // If still checking auth, verify with cache
      if (isAuthenticated === null || isCheckingAuth) {
        try {
          const user = await authService.verifyToken(); // Use verifyToken with cache
          if (!user) {
            toast.error(ERROR_MESSAGES.AUTHENTICATION_REQUIRED, { duration: 5000 });
            return false;
          }
        } catch (error) {
          toast.error(ERROR_MESSAGES.AUTHENTICATION_ERROR, { duration: 5000 });
          return false;
        }
      }
      
      // isAuthenticated === true, safe to proceed
    }

    // Check subscription status (skip in local development)
    if (!isLocalDevelopment()) {
      if (subscriptionStatus && !subscriptionStatus.canGenerate) {
        toast.error(ERROR_MESSAGES.SUBSCRIPTION_REQUIRED, { duration: 5000 });
        setIsSubscriptionModalOpen(true);
        return false;
      }
      
      // Check if user has enough remaining credits
      if (subscriptionStatus) {
        // totalCredits already includes both earned credits (purchased) and monthly credits remaining
        // So we should use it directly for both subscribed and free users
        const totalCredits = subscriptionStatus.totalCredits || 0;
        const remaining = totalCredits;
        
        if (remaining < actualCreditsNeeded) {
          const message = subscriptionStatus.hasActiveSubscription
            ? `You need ${actualCreditsNeeded} credit${actualCreditsNeeded > 1 ? 's' : ''} but only have ${remaining} remaining. Credits will renew on ${subscriptionStatus.creditsResetDate ? new Date(subscriptionStatus.creditsResetDate).toLocaleDateString() : 'your next billing cycle'}.`
            : `You need ${actualCreditsNeeded} credit${actualCreditsNeeded > 1 ? 's' : ''} but only have ${remaining} remaining. Please subscribe or buy credits to continue.`;
          
          toast.error(message, { duration: 5000 });
          setIsSubscriptionModalOpen(true);
          return false;
        }
      }
    }

    return true;
  }, [subscriptionStatus, isAuthenticated, isCheckingAuth]);

  // Helper function to execute image edit operations
  const executeImageEditOperation = useCallback(async (params: {
    base64Image: string;
    prompt: string;
    onSuccess: (result: string) => void;
    setIsLoading: (loading: boolean) => void;
    promptLength?: number;
  }): Promise<void> => {
    const { base64Image, prompt, onSuccess, setIsLoading, promptLength = 0 } = params;

    // Always use HD Flash model (1 credit)
    const modelToUse = MODEL_TO_USE;
    const creditsNeeded = 1;

    // Validate auth and subscription
    const canProceed = await validateAuthAndSubscription(creditsNeeded, modelToUse);
    if (!canProceed) return;

    setIsLoading(true);

    try {
      // CRITICAL: Use backend endpoint which validates and deducts credits BEFORE generation
      const result = await mockupApi.generate({
        promptText: prompt,
        baseImage: {
          base64: base64Image,
          mimeType: 'image/png'
        },
        model: modelToUse,
        resolution: undefined, // HD Flash doesn't use resolution
        aspectRatio: aspectRatio,
        referenceImages: undefined,
        imagesCount: 1
      });
      
      // Image successfully generated - call onSuccess
      onSuccess(result.imageBase64);

      // Credits were already deducted by backend before generation
      // Update subscription status to reflect new credits
      try {
        const updatedStatus = await subscriptionService.getSubscriptionStatus();
        setSubscriptionStatus(updatedStatus);
      } catch (statusError: any) {
        console.error('Failed to refresh subscription status:', statusError);
        // Non-critical - credits were already deducted, just status refresh failed
      }
    } catch (err) {
      console.error('Error in image edit operation:', err);
      const errorInfo = getErrorMessage(err);
      toast.error(errorInfo.message, {
        description: errorInfo.suggestion,
        duration: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [validateAuthAndSubscription, aspectRatio]);

  // Helper function to extract user-friendly error message
  const getErrorMessage = (err: any): { message: string; suggestion?: string } => {
    if (err instanceof RateLimitError) {
      return {
        message: RATE_LIMIT_MESSAGE,
        suggestion: 'Try again in about 10 minutes. This helps ensure fair access for everyone.',
      };
    }
    
    if (err instanceof ModelOverloadedError) {
      return {
        message: err.message || 'The AI model is currently overloaded.',
        suggestion: 'This is a temporary issue. Your credits have not been deducted. Please try again in a few minutes.',
      };
    }
    
    try {
      const errorStr = err?.message || err?.toString() || '';
      const status = err?.status;
      
      // Check for payload too large errors (413)
      if (status === 413 || errorStr.includes('413') || errorStr.includes('Payload Too Large') || errorStr.includes('Request Entity Too Large') || errorStr.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
        return {
          message: 'File too large to process',
          suggestion: 'The file size exceeds the allowed limit. Try reducing the image resolution, using a more compact format (like JPEG), or removing unnecessary reference images. Images are automatically compressed, but some may still be too large.',
        };
      }
      
      // Check for model overloaded messages
      if (errorStr.includes('model is overloaded') || errorStr.includes('model overloaded') || errorStr.includes('overloaded')) {
        return {
          message: 'The AI model is currently overloaded.',
          suggestion: 'This is a temporary issue with the AI service. Your credits have not been deducted. Please try again in a few minutes.',
        };
      }
      
      if (errorStr.includes('503') || errorStr.includes('Service Unavailable')) {
        return {
          message: 'The AI service is temporarily unavailable.',
          suggestion: 'The service is experiencing high load. Your credits have not been deducted. Please try again in a few minutes.',
        };
      }
      
      if (errorStr.includes('timeout')) {
        return {
          message: 'Request timed out.',
          suggestion: 'The AI service is taking longer than expected. This may be due to high load. Your credits have not been deducted. Please try again.',
        };
      }
      
      if (errorStr.includes('Unable to process input image')) {
        return {
          message: 'Unable to process the uploaded image.',
          suggestion: 'Please try a different image format (PNG, JPG, or WEBP) or check if the file is corrupted.',
        };
      }
      
      if (errorStr.includes('INVALID_ARGUMENT')) {
        return {
          message: 'Invalid image format.',
          suggestion: 'Please upload a valid PNG, JPG, or WEBP image. Maximum file size is 10MB.',
        };
      }
      
      if (errorStr.includes('429') || errorStr.includes('rate limit')) {
        return {
          message: RATE_LIMIT_MESSAGE,
          suggestion: 'Try again in about 10 minutes. This helps ensure fair access for everyone.',
        };
      }
      
      if (errorStr.includes('network') || errorStr.includes('fetch')) {
        return {
          message: 'Network error occurred.',
          suggestion: 'Please check your internet connection and try again.',
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
                message: 'Unable to process the uploaded image.',
                suggestion: 'Please try a different image format (PNG, JPG, or WEBP) or check if the file is corrupted.',
              };
            }
            if (apiMessage.includes('Payload Too Large') || apiMessage.includes('413') || apiMessage.includes('Request Entity Too Large') || apiMessage.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
              return {
                message: 'File too large to process',
                suggestion: 'The file size exceeds the allowed limit. Try reducing the image resolution, using a more compact format (like JPEG), or removing unnecessary reference images.',
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
            message: 'Unable to process the uploaded image.',
            suggestion: 'Please try a different image format (PNG, JPG, or WEBP) or check if the file is corrupted.',
          };
        }
        if (apiMessage.includes('Payload Too Large') || apiMessage.includes('413') || apiMessage.includes('Request Entity Too Large') || apiMessage.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
          return {
            message: 'File too large to process',
            suggestion: 'The file size exceeds the allowed limit. Try reducing the image resolution, using a more compact format (like JPEG), or removing unnecessary reference images.',
          };
        }
        return { message: apiMessage };
      }
    } catch (parseError) {
      // If parsing fails, use generic message
    }
    
    return {
      message: ERROR_MESSAGES.GENERATION_ERROR,
      suggestion: 'Please try again or adjust your prompt. If the issue persists, try refreshing the page.',
    };
  };

  // Custom prompt edit handler
  const handleCustomPromptEdit = useCallback(async (prompt: string) => {
    if (!editorMockup || !prompt.trim() || editorIsLoading) return;

    await executeImageEditOperation({
      base64Image: editorMockup,
      prompt: prompt.trim(),
      onSuccess: setEditorMockup,
      setIsLoading: setEditorIsLoading,
      promptLength: prompt.length
    });
  }, [editorMockup, editorIsLoading, executeImageEditOperation]);

  // Editor handlers
  const handleEditorImageUpload = useCallback(async (image: UploadedImage) => {
    const canProceed = await validateAuthAndSubscription(0);
    if (!canProceed) return;
    setEditorMockup(image.base64);
  }, [validateAuthAndSubscription]);

  const handleEditorStartOver = useCallback(() => {
    setEditorMockup(null);
    setSelectedObject(null);
    setSelectedThemes([]);
    setCustomObjectInput('');
    setCustomThemeInput('');
  }, []);

  const handleEditorObjectToggle = useCallback((object: string) => {
    setSelectedObject(prev => prev === object ? null : object);
  }, []);

  const handleEditorAddCustomObject = useCallback(() => {
    const newObject = customObjectInput.trim();
    if (newObject && !selectedObject) {
      setSelectedObject(newObject);
      setCustomObjectInput('');
    }
  }, [customObjectInput, selectedObject]);

  const handleEditorChangeObject = useCallback(async () => {
    if (!editorMockup || !selectedObject || editorIsLoading) return;

    // Always use HD Flash model (1 credit)
    const modelToUse = MODEL_TO_USE;
    const creditsNeeded = 1;

    const canProceed = await validateAuthAndSubscription(creditsNeeded, modelToUse);
    if (!canProceed) return;

    setEditorIsLoading(true);

    try {
      const referenceImage: UploadedImage = {
        base64: editorMockup,
        mimeType: 'image/png'
      };

      // Track retry progress for UI feedback
      const result = await aiApi.changeObjectInMockup(
        referenceImage, 
        selectedObject, 
        modelToUse, 
        undefined // HD Flash doesn't use resolution
      );
      
      // Image successfully changed - update state
      setEditorMockup(result);

      // Track usage for successful generation
      // TODO: Migrate changeObjectInMockup to use backend /generate endpoint which handles credit deduction atomically
      // Currently changeObjectInMockup calls Gemini API directly, so we use deprecated /track-usage endpoint
      // Note: /track-usage endpoint does NOT deduct credits (it's deprecated), only creates audit records
      // Backend detects local development via process.env, not from request body
      try {
        await subscriptionService.trackUsage(true, 1, modelToUse, true, 0, undefined, 'canvas');
        // Update status after successful trackUsage
        const updatedStatus = await subscriptionService.getSubscriptionStatus();
        setSubscriptionStatus(updatedStatus);
      } catch (trackError: any) {
        // If trackUsage fails, the image was still generated but credits weren't deducted
        console.error('Failed to track usage after successful generation:', trackError);
        // Try to refresh status anyway to get current credits
        try {
          const updatedStatus = await subscriptionService.getSubscriptionStatus();
          setSubscriptionStatus(updatedStatus);
        } catch (statusError) {
          console.error('Failed to refresh subscription status:', statusError);
        }
        
        if (trackError.message === 'SUBSCRIPTION_REQUIRED') {
          toast.error(ERROR_MESSAGES.SUBSCRIPTION_REQUIRED, { duration: 5000 });
          setIsSubscriptionModalOpen(true);
        }
      }
    } catch (err) {
      console.error('Error changing object:', err);
      const errorInfo = getErrorMessage(err);
      toast.error(errorInfo.message, {
        description: errorInfo.suggestion,
        duration: 7000,
      });
    } finally {
      setEditorIsLoading(false);
    }
  }, [editorMockup, selectedObject, editorIsLoading, validateAuthAndSubscription]);

  const handleEditorThemeToggle = useCallback((theme: string) => {
    setSelectedThemes(prev => prev.includes(theme) ? prev.filter(t => t !== theme) : prev.length < 3 ? [...prev, theme] : prev);
  }, []);

  const handleEditorAddCustomTheme = useCallback(() => {
    const newTheme = customThemeInput.trim();
    if (newTheme && selectedThemes.length < 3 && !selectedThemes.includes(newTheme)) {
      setSelectedThemes(prev => [...prev, newTheme]);
      setCustomThemeInput('');
    }
  }, [customThemeInput, selectedThemes]);

  const handleEditorApplyThemes = useCallback(async () => {
    if (!editorMockup || selectedThemes.length === 0 || editorIsLoading) return;

    // Always use HD Flash model (1 credit)
    const modelToUse = MODEL_TO_USE;
    const creditsNeeded = 1;

    const canProceed = await validateAuthAndSubscription(creditsNeeded, modelToUse);
    if (!canProceed) return;

    setEditorIsLoading(true);

    try {
      const referenceImage: UploadedImage = {
        base64: editorMockup,
        mimeType: 'image/png'
      };

      // Track retry progress for UI feedback
      const result = await aiApi.applyThemeToMockup(
        referenceImage, 
        selectedThemes, 
        modelToUse, 
        undefined // HD Flash doesn't use resolution
      );
      
      // Image successfully updated - update state
      setEditorMockup(result);

      // Track usage for successful generation
      // TODO: Migrate applyThemeToMockup to use backend /generate endpoint which handles credit deduction atomically
      // Currently applyThemeToMockup calls Gemini API directly, so we use deprecated /track-usage endpoint
      // Note: /track-usage endpoint does NOT deduct credits (it's deprecated), only creates audit records
      // Backend detects local development via process.env, not from request body
      try {
        await subscriptionService.trackUsage(true, 1, modelToUse, true, 0, undefined, 'canvas');
        // Update status after successful trackUsage
        const updatedStatus = await subscriptionService.getSubscriptionStatus();
        setSubscriptionStatus(updatedStatus);
      } catch (trackError: any) {
        // If trackUsage fails, the image was still generated but credits weren't deducted
        console.error('Failed to track usage after successful generation:', trackError);
        // Try to refresh status anyway to get current credits
        try {
          const updatedStatus = await subscriptionService.getSubscriptionStatus();
          setSubscriptionStatus(updatedStatus);
        } catch (statusError) {
          console.error('Failed to refresh subscription status:', statusError);
        }
        
        if (trackError.message === 'SUBSCRIPTION_REQUIRED') {
          toast.error(ERROR_MESSAGES.SUBSCRIPTION_REQUIRED, { duration: 5000 });
          setIsSubscriptionModalOpen(true);
        }
      }
    } catch (err) {
      console.error('Error applying themes:', err);
      const errorInfo = getErrorMessage(err);
      toast.error(errorInfo.message, {
        description: errorInfo.suggestion,
        duration: 7000,
      });
    } finally {
      setEditorIsLoading(false);
    }
  }, [editorMockup, selectedThemes, editorIsLoading, validateAuthAndSubscription]);

  const handleEditorZoomIn = useCallback(async () => {
    if (!editorMockup || editorIsLoading) return;

    const zoomInPrompt = `Apply a zoom in effect. Move the camera closer to the subject while maintaining the same angle. It is critical that all design elements in the image, including any text, logos.`;

    await executeImageEditOperation({
      base64Image: editorMockup,
      prompt: zoomInPrompt,
      onSuccess: setEditorMockup,
      setIsLoading: setEditorIsLoading,
      promptLength: zoomInPrompt.length
    });
  }, [editorMockup, editorIsLoading, executeImageEditOperation]);

  const handleEditorZoomOut = useCallback(async () => {
    if (!editorMockup || editorIsLoading) return;

    const zoomOutPrompt = `Apply a zoom out effect. Move the camera further away from the subject while maintaining the same angle. It is critical that all design elements in the image, including any text, logos.`;

    await executeImageEditOperation({
      base64Image: editorMockup,
      prompt: zoomOutPrompt,
      onSuccess: setEditorMockup,
      setIsLoading: setEditorIsLoading,
      promptLength: zoomOutPrompt.length
    });
  }, [editorMockup, editorIsLoading, executeImageEditOperation]);

  const handleEditorNewAngle = useCallback(async (angle: string) => {
    if (!editorMockup || editorIsLoading) return;

    const anglePrompt = `Change the camera angle to: ${angle}. Keep the same product, design, and overall composition, but change only the camera perspective. It is critical that all design elements in the image, including any text, logos.`;

    await executeImageEditOperation({
      base64Image: editorMockup,
      prompt: anglePrompt,
      onSuccess: setEditorMockup,
      setIsLoading: setEditorIsLoading,
      promptLength: anglePrompt.length
    });
  }, [editorMockup, editorIsLoading, executeImageEditOperation]);

  const handleEditorNewBackground = useCallback(async () => {
    if (!editorMockup || editorIsLoading) return;

    const newEnv = AVAILABLE_LOCATION_TAGS[Math.floor(Math.random() * AVAILABLE_LOCATION_TAGS.length)];
    const backgroundPrompt = `Change the scene to a different environment: ${newEnv}. Keep the same product, design, and camera angle, but change only the background, setting, and environmental context. It is critical that all design elements in the image, including any text, logos.`;

    await executeImageEditOperation({
      base64Image: editorMockup,
      prompt: backgroundPrompt,
      onSuccess: setEditorMockup,
      setIsLoading: setEditorIsLoading,
      promptLength: backgroundPrompt.length
    });
  }, [editorMockup, editorIsLoading, executeImageEditOperation]);

  const handleClosePrivacy = () => {
    setIsPrivacyOpen(false);
    if (window.location.pathname === '/privacy') {
      window.history.pushState({}, '', '/editor');
    }
  };

  const handleCloseTerms = () => {
    setIsTermsOpen(false);
    if (window.location.pathname === '/terms') {
      window.history.pushState({}, '', '/editor');
    }
  };

  const handleCloseRefund = () => {
    setIsRefundOpen(false);
    if (window.location.pathname === '/refund') {
      window.history.pushState({}, '', '/editor');
    }
  };

  const handleCloseUsagePolicy = () => {
    setIsUsagePolicyOpen(false);
    if (window.location.pathname === '/usage-policy') {
      window.history.pushState({}, '', '/editor');
    }
  };

  const handleCloseFullScreen = () => setFullScreenImageIndex(null);

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-300 font-sans relative">
      {!editorMockup && (
        <div className="fixed inset-0 z-0">
          <LinearGradientBackground
            topColor="#DCEAF3"
            middleColor="#3C9FB5"
            bottomColor="#052A36"
            direction="vertical"
            fullHeight={true}
          />
        </div>
      )}
      <div className="relative z-10">
        <PrivacyPolicy isOpen={isPrivacyOpen || currentPath === '/privacy'} onClose={handleClosePrivacy} />
        <TermsOfService isOpen={isTermsOpen || currentPath === '/terms'} onClose={handleCloseTerms} />
        <RefundPolicy isOpen={isRefundOpen || currentPath === '/refund'} onClose={handleCloseRefund} />
        <UsagePolicy isOpen={isUsagePolicyOpen || currentPath === '/usage-policy'} onClose={handleCloseUsagePolicy} />
        
        <Header
        subscriptionStatus={subscriptionStatus}
        onPricingClick={() => {
          window.history.pushState({}, '', '/pricing');
          setCurrentPath('/pricing');
        }}
        onJoinClick={() => setIsSubscriptionModalOpen(true)}
        onCreditsClick={() => setIsCreditPackagesModalOpen(true)}
        onLogoClick={() => {
          window.history.pushState({}, '', '/');
          setCurrentPath('/');
        }}
        onMockupsClick={() => {
          window.history.pushState({}, '', '/mockups');
          setCurrentPath('/mockups');
        }}
        onCreateNewMockup={() => {
          window.history.pushState({}, '', '/');
          setCurrentPath('/');
          const popStateEvent = new PopStateEvent('popstate', { state: {} });
          window.dispatchEvent(popStateEvent);
        }}
      />
      
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
      />
      
      <CreditPackagesModal
        isOpen={isCreditPackagesModalOpen}
        onClose={() => setIsCreditPackagesModalOpen(false)}
        subscriptionStatus={subscriptionStatus}
        initialTab="credits"
      />
      
      <div className="pt-12 md:pt-14">
        <div className={`flex flex-col md:flex-row h-[calc(100vh-3rem-120px)] md:h-[calc(100vh-3.5rem)] ${!editorMockup ? 'justify-center py-4 md:py-[30px] px-10' : ''}`} style={{ alignItems: 'center' }}>
          <EditorSidebar
            sidebarWidth={sidebarWidth}
            sidebarRef={sidebarRef}
            subscriptionStatus={subscriptionStatus}
            isBannerDismissed={isBannerDismissed}
            onUpgrade={() => setIsSubscriptionModalOpen(true)}
            onDismissBanner={() => setIsBannerDismissed(true)}
            editorMockup={editorMockup}
            onEditorImageUpload={handleEditorImageUpload}
            onStartOver={handleEditorStartOver}
            availableObjects={AVAILABLE_OBJECTS}
            onCustomPromptEdit={handleCustomPromptEdit}
            onPresetApply={handleCustomPromptEdit}
            selectedObject={selectedObject}
            onObjectToggle={handleEditorObjectToggle}
            customObjectInput={customObjectInput}
            onCustomObjectInputChange={setCustomObjectInput}
            onAddCustomObject={handleEditorAddCustomObject}
            onChangeObject={handleEditorChangeObject}
            isChangingObject={editorIsLoading}
            availableThemes={AVAILABLE_THEMES}
            selectedThemes={selectedThemes}
            onThemeToggle={handleEditorThemeToggle}
            customThemeInput={customThemeInput}
            onCustomThemeInputChange={setCustomThemeInput}
            onAddCustomTheme={handleEditorAddCustomTheme}
            onApplyThemes={handleEditorApplyThemes}
            isApplyingThemes={editorIsLoading}
            onZoomIn={handleEditorZoomIn}
            onZoomOut={handleEditorZoomOut}
            onNewAngle={handleEditorNewAngle}
            onNewBackground={handleEditorNewBackground}
            isProcessing={editorIsLoading}
            isAuthenticated={isAuthenticated}
            authenticationRequiredMessage={ERROR_MESSAGES.AUTHENTICATION_REQUIRED}
            availableAngles={AVAILABLE_ANGLE_TAGS}
          />
          {editorMockup && (
            <>
              <div 
                id="sidebar-resizer"
                className="hidden md:block flex-shrink-0 w-2 cursor-col-resize group"
              >
                <div className="w-px h-full mx-auto bg-zinc-800/50 group-hover:bg-brand-cyan/50 transition-colors duration-200"></div>
              </div>
              <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
                <EditorDisplay
                  base64Image={editorMockup}
                  isLoading={editorIsLoading}
                  onView={() => setFullScreenImageIndex(0)}
                  onNewAngle={handleEditorNewAngle}
                  onNewBackground={handleEditorNewBackground}
                  onZoomIn={handleEditorZoomIn}
                  onZoomOut={handleEditorZoomOut}
                  aspectRatio={aspectRatio}
                  availableAngles={AVAILABLE_ANGLE_TAGS}
                />
              </main>
            </>
          )}
        </div>
      </div>

      {fullScreenImageIndex !== null && editorMockup && (
        <FullScreenViewer
          base64Image={editorMockup}
          isLoading={editorIsLoading}
          onClose={handleCloseFullScreen}
          onOpenInEditor={(imageBase64) => {
            handleEditorImageUpload({
              base64: imageBase64,
              mimeType: 'image/png'
            });
            handleCloseFullScreen();
          }}
          isAuthenticated={isAuthenticated === true}
        />
      )}
      </div>
    </div>
  );
};

export default EditorApp;

