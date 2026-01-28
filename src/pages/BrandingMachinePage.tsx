import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BrandingWelcomeScreen } from '../components/branding/BrandingWelcomeScreen';
import { BrandingMoodboard } from '../components/branding/BrandingMoodboard';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Target as BowArrow } from 'lucide-react';
import { authService } from '../services/authService';
import { brandingApi } from '../services/brandingApi';
import { subscriptionService } from '../services/subscriptionService';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { migrateMarketResearch } from '@/utils/brandingHelpers';
import type { BrandingData } from '../types/types';
import { SEO } from '../components/SEO';
import { SoftwareApplicationSchema } from '../components/StructuredData';

const API_BASE_URL = '/api';

const isLocalDevelopment = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
};

export const BrandingMachinePage: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isCheckingAuth, subscriptionStatus, onCreditPackagesModalOpen } = useLayout();
  const { hasAccess, isLoading: isLoadingAccess } = usePremiumAccess();
  const [currentStep, setCurrentStep] = useState<number>(0); // 0 = welcome, 10 = moodboard
  const [prompt, setPrompt] = useState<string>('');
  const [brandingData, setBrandingData] = useState<BrandingData>({ prompt: '' });
  const [isGeneratingInitial, setIsGeneratingInitial] = useState<boolean>(false);
  const [generatingSteps, setGeneratingSteps] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingProject, setIsLoadingProject] = useState<boolean>(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showDependencyModal, setShowDependencyModal] = useState<boolean>(false);
  const [pendingGeneration, setPendingGeneration] = useState<{
    stepNumber: number;
    missingDeps: number[];
  } | null>(null);
  const loadedProjectIdRef = useRef<string | null>(null);

  const STEPS = [
    { id: 1, title: t('branding.steps.mercadoNicho') },
    { id: 2, title: t('branding.steps.publicoAlvo') },
    { id: 3, title: t('branding.steps.posicionamento') },
    { id: 4, title: t('branding.steps.insights') },
    { id: 5, title: t('branding.steps.competitors') },
    { id: 6, title: t('branding.steps.references') },
    { id: 7, title: t('branding.steps.swotAnalysis') },
    { id: 8, title: t('branding.steps.colorPalettes') },
    { id: 9, title: t('branding.steps.visualElements') },
    { id: 10, title: t('branding.steps.persona') },
    { id: 11, title: t('branding.steps.mockupIdeas') },
    { id: 12, title: t('branding.steps.moodboard') },
    { id: 13, title: t('branding.steps.archetypes') },
  ];

  // Redirect to waitlist if user doesn't have premium access
  // Note: Admin users (including free admins) have access via usePremiumAccess hook
  useEffect(() => {
    if (!isLoadingAccess && !hasAccess) {
      navigate('/waitlist', { replace: true });
    }
  }, [hasAccess, isLoadingAccess, navigate]);

  // Load project from URL if projectId is present
  useEffect(() => {
    const projectId = searchParams.get('projectId');
    if (projectId && projectId.trim() !== '' && projectId !== 'undefined' && isAuthenticated === true) {
      // Only load if it's a different project or hasn't been loaded yet
      if (loadedProjectIdRef.current !== projectId) {
        loadProject(projectId);
      }
    } else {
      // Reset ref when there's no projectId in URL
      loadedProjectIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isAuthenticated]);

  const loadProject = async (projectId: string) => {
    // Prevent duplicate loads
    if (loadedProjectIdRef.current === projectId || isLoadingProject) {
      return;
    }

    setIsLoadingProject(true);
    loadedProjectIdRef.current = projectId;

    try {
      const project = await brandingApi.getById(projectId);
      const id = project._id || (project as any).id;
      setCurrentProjectId(id);
      setPrompt(project.prompt);
      // Migrate old marketResearch format if needed
      const migratedData = migrateMarketResearch(project.data);
      // Use name from database if available, otherwise use name from data
      if (project.name) {
        migratedData.name = project.name;
      }
      setBrandingData(migratedData);
      // Go directly to moodboard view
      setCurrentStep(10);
      toast.success(t('branding.projectLoaded') || 'Project loaded successfully');
    } catch (error: any) {
      console.error('Error loading project:', error);
      toast.error(error.message || t('branding.errors.failedToLoadProject') || 'Failed to load project');
      // Clear projectId from URL if loading failed
      navigate('/branding-machine', { replace: true });
      loadedProjectIdRef.current = null;
    } finally {
      setIsLoadingProject(false);
    }
  };


  // Check if step has required dependencies
  const checkDependencies = (stepNumber: number): number[] => {
    const missing: number[] = [];

    switch (stepNumber) {
      case 1: // Mercado e Nicho - no dependencies
      case 2: // Público Alvo - no dependencies
      case 3: // Posicionamento - no dependencies
      case 4: // Insights - no dependencies
        break;
      case 5: // Competitors needs all 4 market research sections
        if (!brandingData.mercadoNicho && !brandingData.marketResearch) missing.push(1);
        if (!brandingData.publicoAlvo && !brandingData.marketResearch) missing.push(2);
        if (!brandingData.posicionamento && !brandingData.marketResearch) missing.push(3);
        if (!brandingData.insights && !brandingData.marketResearch) missing.push(4);
        break;
      case 6: // References needs all 4 market research sections + Competitors
        if (!brandingData.mercadoNicho && !brandingData.marketResearch) missing.push(1);
        if (!brandingData.publicoAlvo && !brandingData.marketResearch) missing.push(2);
        if (!brandingData.posicionamento && !brandingData.marketResearch) missing.push(3);
        if (!brandingData.insights && !brandingData.marketResearch) missing.push(4);
        if (!brandingData.competitors) missing.push(5);
        break;
      case 7: // SWOT needs all 4 market research sections + Competitors
        if (!brandingData.mercadoNicho && !brandingData.marketResearch) missing.push(1);
        if (!brandingData.publicoAlvo && !brandingData.marketResearch) missing.push(2);
        if (!brandingData.posicionamento && !brandingData.marketResearch) missing.push(3);
        if (!brandingData.insights && !brandingData.marketResearch) missing.push(4);
        if (!brandingData.competitors) missing.push(5);
        break;
      case 8: // Color Palettes needs SWOT + References
        if (!brandingData.swot) missing.push(7);
        if (!brandingData.references) missing.push(6);
        break;
      case 9: // Visual Elements needs Color Palettes
        if (!brandingData.colorPalettes) missing.push(8);
        break;
      case 10: // Persona needs all 4 market research sections
        if (!brandingData.mercadoNicho && !brandingData.marketResearch) missing.push(1);
        if (!brandingData.publicoAlvo && !brandingData.marketResearch) missing.push(2);
        if (!brandingData.posicionamento && !brandingData.marketResearch) missing.push(3);
        if (!brandingData.insights && !brandingData.marketResearch) missing.push(4);
        break;
      case 13: // Archetypes needs all 4 market research sections
        if (!brandingData.mercadoNicho && !brandingData.marketResearch) missing.push(1);
        if (!brandingData.publicoAlvo && !brandingData.marketResearch) missing.push(2);
        if (!brandingData.posicionamento && !brandingData.marketResearch) missing.push(3);
        if (!brandingData.insights && !brandingData.marketResearch) missing.push(4);
        break;
      // Steps 11 and 12 don't have strict dependencies
    }

    return missing;
  };

  const generateDependencies = async (missingDeps: number[]): Promise<boolean> => {
    // Generate missing dependencies first
    for (const depStep of missingDeps) {
      const depStepTitle = STEPS.find(s => s.id === depStep)?.title || `Step ${depStep}`;
      toast.info(t('branding.generatingDependency', { step: depStepTitle }));
      const success = await generateStepInternal(depStep, false);
      if (!success) {
        toast.error(t('branding.errors.failedToGenerateDependency', { step: depStepTitle }));
        return false;
      }
      // Small delay between steps
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return true;
  };

  const generateStepInternal = async (stepNumber: number, isInitial = false, silent = false): Promise<boolean> => {
    if (!prompt.trim()) {
      if (!silent) {
        toast.error(t('branding.errors.enterBrandDescription'));
      }
      return false;
    }

    // Check if user has credits (skip in local development)
    if (!isLocalDevelopment()) {
      const hasCredits = (subscriptionStatus?.totalCredits || 0) > 0;
      if (!hasCredits) {
        if (!silent) {
          toast.error(t('branding.errors.insufficientCredits'));
          onCreditPackagesModalOpen();
        }
        return false;
      }
    }

    if (isInitial) {
      setIsGeneratingInitial(true);
    } else {
      setGeneratingSteps(prev => new Set([...prev, stepNumber]));
    }

    try {
      const token = authService.getToken();
      if (!token) {
        if (!silent) {
          toast.error(t('branding.errors.signInRequired'));
          navigate('/');
        }
        return false;
      }

      const previousData = brandingData;

      const response = await fetch(`${API_BASE_URL}/branding/generate-step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          step: stepNumber,
          prompt,
          previousData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to generate step' }));
        throw new Error(errorData.error || errorData.message || 'Failed to generate step');
      }

      const responseData = await response.json();
      const { data, creditsDeducted = 0, creditsRemaining = 0, isAdmin = false } = responseData;

      // Show credit deduction notification
      if (isAdmin) {
        toast.info(t('credits.notificationUsedAdmin'));
      } else if (creditsDeducted > 0) {
        const plural = creditsDeducted > 1 ? 's' : '';
        const remainingPlural = creditsRemaining > 1 ? 's' : '';
        toast.success(
          `${t('credits.notificationUsed', { count: creditsDeducted, plural })}. ${t('credits.notificationRemaining', { remaining: creditsRemaining, plural: remainingPlural })}`
        );
      }

      // Helper function to clean and normalize string content
      const cleanString = (text: string): string => {
        if (!text) return '';

        // Convert literal \n to actual newlines
        let cleaned = text.replace(/\\n/g, '\n');

        // Remove leading/trailing whitespace but preserve internal formatting
        cleaned = cleaned.trim();

        // Normalize multiple consecutive newlines to double newlines (paragraph breaks)
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

        return cleaned;
      };

      // Helper function to ensure content is always a string for text sections
      const ensureString = (value: any): string => {
        if (typeof value === 'string') {
          return cleanString(value);
        }
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'object') {
          return JSON.stringify(value, null, 2);
        }
        return cleanString(String(value));
      };

      // Update branding data based on step
      const updatedData: BrandingData = { ...brandingData, prompt };

      switch (stepNumber) {
        case 1:
          // Step 1 now generates all 4 market research sections at once
          if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
            updatedData.mercadoNicho = ensureString(data.mercadoNicho);
            updatedData.publicoAlvo = ensureString(data.publicoAlvo);
            updatedData.posicionamento = ensureString(data.posicionamento);
            updatedData.insights = ensureString(data.insights);
          } else {
            // Fallback for old format
            updatedData.mercadoNicho = ensureString(data);
          }
          break;
        case 2:
          updatedData.publicoAlvo = ensureString(data);
          break;
        case 3:
          updatedData.posicionamento = ensureString(data);
          break;
        case 4:
          updatedData.insights = ensureString(data);
          break;
        case 5:
          updatedData.competitors = data;
          break;
        case 6:
          updatedData.references = data;
          break;
        case 7:
          updatedData.swot = data;
          break;
        case 8:
          updatedData.colorPalettes = data;
          break;
        case 9:
          updatedData.visualElements = data;
          break;
        case 10:
          updatedData.persona = data;
          break;
        case 11:
          updatedData.mockupIdeas = data;
          break;
        case 12:
          updatedData.moodboard = data;
          break;
        case 13:
          updatedData.archetypes = data;
          break;
      }

      setBrandingData(updatedData);

      // Track usage and deduct credits AFTER successful generation
      if (!isLocalDevelopment()) {
        try {
          await subscriptionService.trackBrandingUsage(true, stepNumber, prompt.length);
          // Update subscription status after successful tracking
          const updatedStatus = await subscriptionService.getSubscriptionStatus();
          // Note: subscriptionStatus is from useLayout, we can't update it directly here
          // The parent component should refresh it if needed
        } catch (trackError: any) {
          // If trackUsage fails, the content was still generated but credits weren't deducted
          // This is a critical error - log it but don't remove the content
          console.error(`[Usage Tracking] Failed to track usage after successful branding step ${stepNumber} generation:`, {
            error: trackError.message,
            stack: trackError.stack,
            stepNumber,
          });

          if (trackError.message === 'SUBSCRIPTION_REQUIRED' && !silent) {
            // Defer error handling to next event loop to avoid React hooks violations
            setTimeout(() => {
              toast.error(t('branding.errors.insufficientCredits') || 'Insufficient credits', {
                description: t('branding.errors.trackingFailedButContentGenerated') || 'Your content was generated successfully, but we couldn\'t update your credits. Please check your account.',
                duration: 6000,
              });
              onCreditPackagesModalOpen();
            }, 0);
          } else if (!silent) {
            // Show friendly message for other tracking errors
            setTimeout(() => {
              toast.info(t('branding.errors.trackingFailedButContentGenerated') || 'Your content was generated successfully! There was a minor issue updating your credits, but your work is safe.', {
                duration: 5000,
              });
            }, 0);
          }
        }
      }

      return true;
    } catch (error: any) {
      console.error('Error generating step:', error);
      if (!silent) {
        toast.error(error.message || t('branding.errors.failedToGenerateStep'));
      }
      return false;
    } finally {
      if (isInitial) {
        setIsGeneratingInitial(false);
      } else {
        setGeneratingSteps(prev => {
          const next = new Set(prev);
          next.delete(stepNumber);
          return next;
        });
      }
    }
  };

  const generateStep = async (stepNumber: number, isInitial = false, autoGenerateDeps = true) => {
    if (!prompt.trim()) {
      toast.error(t('branding.errors.enterBrandDescription'));
      return false;
    }

    // Check dependencies
    const missingDeps = checkDependencies(stepNumber);

    if (missingDeps.length > 0 && autoGenerateDeps) {
      // Show modal to ask for permission to generate dependencies
      return new Promise<boolean>((resolve) => {
        setPendingGeneration({ stepNumber, missingDeps });
        setShowDependencyModal(true);

        // Store resolve function to call it later
        (window as any).__resolveDependencyGeneration = async (confirmed: boolean) => {
          if (confirmed) {
            const depsSuccess = await generateDependencies(missingDeps);
            if (depsSuccess) {
              const result = await generateStepInternal(stepNumber, isInitial);
              resolve(result);
            } else {
              resolve(false);
            }
          } else {
            resolve(false);
          }
        };
      });
    } else if (missingDeps.length > 0) {
      const missingSteps = missingDeps.map(s => STEPS.find(st => st.id === s)?.title || `Step ${s}`).join(', ');
      toast.error(t('branding.errors.missingDependencies', { steps: missingSteps }));
      return false;
    }

    return await generateStepInternal(stepNumber, isInitial);
  };

  const handleDependencyConfirm = async () => {
    setShowDependencyModal(false);
    const resolve = (window as any).__resolveDependencyGeneration;
    if (resolve) {
      await resolve(true);
      (window as any).__resolveDependencyGeneration = null;
    }
  };

  const handleDependencyCancel = () => {
    setShowDependencyModal(false);
    const resolve = (window as any).__resolveDependencyGeneration;
    if (resolve) {
      resolve(false);
      (window as any).__resolveDependencyGeneration = null;
    }
    setPendingGeneration(null);
  };

  const handleStart = async () => {
    if (!prompt.trim()) {
      toast.error(t('branding.errors.enterBrandDescription'));
      return;
    }

    if (isCheckingAuth || isAuthenticated === null) {
      return;
    }

    if (isAuthenticated === false) {
      toast.error(t('branding.errors.signInRequired'));
      return;
    }

    const hasCredits = (subscriptionStatus?.totalCredits || 0) > 0;
    if (!hasCredits) {
      toast.error(t('branding.errors.insufficientCredits'));
      onCreditPackagesModalOpen();
      return;
    }

    setBrandingData({ prompt });
    await generateStep(1, true);
    // Go directly to moodboard after step 1 is generated
    setCurrentStep(10);
  };

  const getStepContent = (stepNumber: number) => {
    switch (stepNumber) {
      case 1:
        return brandingData.mercadoNicho;
      case 2:
        return brandingData.publicoAlvo;
      case 3:
        return brandingData.posicionamento;
      case 4:
        return brandingData.insights;
      case 5:
        return brandingData.competitors;
      case 6:
        return brandingData.references;
      case 7:
        return brandingData.swot;
      case 8:
        return brandingData.colorPalettes;
      case 9:
        return brandingData.visualElements;
      case 10:
        return brandingData.persona;
      case 11:
        return brandingData.mockupIdeas;
      case 12:
        return brandingData.moodboard;
      case 13:
        return brandingData.archetypes;
      default:
        return null;
    }
  };

  const handleGenerateSection = async (stepNumber: number) => {
    await generateStep(stepNumber, false, true);
  };

  // Helper function to check if a step has content
  const hasStepContent = (stepNumber: number): boolean => {
    const content = getStepContent(stepNumber);
    return !!(content &&
      !(typeof content === 'string' && !content.trim()) &&
      !(Array.isArray(content) && content.length === 0) &&
      !(typeof content === 'object' && Object.keys(content).length === 0));
  };

  // Helper function to generate a step with its dependencies recursively (silently, without showing errors)
  const generateStepWithDependencies = async (stepNumber: number, generatedSet: Set<number>): Promise<boolean> => {
    // Skip if already generated or being generated
    if (generatedSet.has(stepNumber) || generatingSteps.has(stepNumber)) {
      return true;
    }

    // Check if step already has content
    if (hasStepContent(stepNumber)) {
      generatedSet.add(stepNumber);
      return true;
    }

    // Check for missing dependencies
    const missingDeps = checkDependencies(stepNumber);

    // Generate missing dependencies first (recursively)
    if (missingDeps.length > 0) {
      for (const depStep of missingDeps) {
        // Check if dependency already exists
        if (hasStepContent(depStep) || generatedSet.has(depStep)) {
          continue;
        }

        // Recursively generate dependency first (silently)
        try {
          const depSuccess = await generateStepWithDependencies(depStep, generatedSet);
          if (!depSuccess) {
            // Silently continue - don't show error to user
            continue;
          }
          // Small delay after generating dependency
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          // Silently continue on error
          console.error(`Error generating dependency step ${depStep}:`, error);
          continue;
        }
      }
    }

    // Now generate the step itself (silently, without showing errors)
    try {
      const success = await generateStepInternal(stepNumber, false, true);

      if (success) {
        generatedSet.add(stepNumber);
        // Small delay after generating step
        await new Promise(resolve => setTimeout(resolve, 800));
        return true;
      }

      return false;
    } catch (error) {
      // Silently continue on error
      console.error(`Error generating step ${stepNumber}:`, error);
      return false;
    }
  };

  const handleGenerateAll = async () => {
    if (!prompt.trim()) {
      toast.error(t('branding.errors.enterBrandDescription'));
      return;
    }

    const stepsToGenerate = STEPS.filter(step => {
      const content = getStepContent(step.id);
      return !content || (typeof content === 'string' && !content.trim()) ||
        (Array.isArray(content) && content.length === 0) ||
        (typeof content === 'object' && Object.keys(content).length === 0);
    }).map(step => step.id);

    if (stepsToGenerate.length === 0) {
      toast.info(t('branding.allSectionsGenerated'));
      return;
    }

    toast.info(t('branding.generatingAllSections', { count: stepsToGenerate.length }));

    // Track which steps have been generated to avoid duplicates
    const generatedSet = new Set<number>();

    // Generate steps in order, automatically handling dependencies
    // Steps are automatically sorted by dependencies through the recursive function
    for (const stepNumber of stepsToGenerate.sort((a, b) => a - b)) {
      // This will automatically generate dependencies first (silently)
      await generateStepWithDependencies(stepNumber, generatedSet);
      // Continue with next step even if one fails (silently)
    }

    // Count how many were actually generated
    const successfullyGenerated = generatedSet.size;
    if (successfullyGenerated > 0) {
      toast.success(t('branding.allSectionsGeneratedSuccess'));
    }
  };

  const handleFeedback = async (stepNumber: number, type: 'up' | 'down') => {
    if (!prompt || !stepNumber) return;

    // Only save positive feedback (thumbs up)
    if (type !== 'up') return;

    try {
      const content = getStepContent(stepNumber);
      if (!content) return;

      await brandingApi.saveBrandingFeedback({
        prompt: prompt.trim(),
        step: stepNumber,
        output: content,
        rating: 1,
      });
    } catch (error: any) {
      console.error('Failed to save feedback:', error);
      // Don't show error to user - feedback is optional
    }
  };

  const handleSave = async (data: BrandingData, isAutoSave = false) => {
    setIsSaving(true);

    try {
      const token = authService.getToken();
      if (!token) {
        if (!isAutoSave) {
          toast.error(t('branding.errors.signInToSave'));
        }
        return;
      }

      const response = await fetch(`${API_BASE_URL}/branding/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt,
          data,
          name: data.name, // Send name separately for database storage
          projectId: currentProjectId, // Send projectId if exists to update instead of create
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('branding.errors.failedToSaveProject'));
      }

      const result = await response.json();
      // Update current project ID (either new or existing)
      const projectId = result.project?._id || result.project?.id;
      if (projectId) {
        // Only update state and URL if it's different from current
        if (projectId !== currentProjectId) {
          setCurrentProjectId(projectId);
          navigate(`/branding-machine?projectId=${projectId}`, { replace: true });
        }
      }

      // Update brandingData.name with the saved name from database
      const savedName = result.project?.name || data.name || null;
      if (savedName !== brandingData.name) {
        setBrandingData(prev => ({ ...prev, name: savedName }));
      }

      // Only show toast for manual saves, not auto-saves
      if (!isAutoSave) {
        toast.success(t('branding.success.projectSaved'));
      }

    } catch (error: any) {
      console.error('Error saving project:', error);
      // Only show error toast for manual saves
      if (!isAutoSave) {
        toast.error(error.message || t('branding.errors.failedToSaveProject'));
      }
    } finally {
      setIsSaving(false);
    }
  };


  const getDependencyModalMessage = () => {
    if (!pendingGeneration) return '';

    const depTitles = pendingGeneration.missingDeps
      .map(dep => STEPS.find(s => s.id === dep)?.title || `Step ${dep}`)
      .join(', ');

    return t('branding.dependencyModalMessage', {
      dependencies: depTitles
    });
  };

  if (isLoadingProject) {
    return (
      <div className={`h-screen w-full flex items-center justify-center ${theme === 'dark' ? 'bg-[#0C0C0C] text-neutral-300' : 'bg-neutral-50 text-neutral-800'
        }`}>
        <div className="text-center">
          <p className={`text-sm font-mono ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
            }`}>{t('branding.loadingProject')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Branding Machine com IA"
        description="Crie estratégias completas de branding com inteligência artificial. Gere identidades visuais profissionais passo a passo."
        keywords="branding machine, AI branding, identidade visual, estratégia de marca, design de marca"
      />
      <SoftwareApplicationSchema
        name="Branding Machine"
        description="Crie estratégias completas de branding com inteligência artificial. Gere identidades visuais profissionais passo a passo."
        applicationCategory="DesignApplication"
      />
      {showDependencyModal && pendingGeneration && (
        <ConfirmationModal
          isOpen={showDependencyModal}
          onClose={handleDependencyCancel}
          onConfirm={handleDependencyConfirm}
          title={t('branding.dependencyModalTitle')}
          message={getDependencyModalMessage()}
          confirmText={t('branding.generateDependencies')}
          cancelText={t('branding.cancel')}
          variant="info"
        />
      )}

      {currentStep === 0 ? (
        <BrandingWelcomeScreen
          prompt={prompt}
          onPromptChange={setPrompt}
          onStart={handleStart}
          isGenerating={isGeneratingInitial}
        />
      ) : (
        <div className="w-full bg-background text-foreground">
          {currentStep === 10 && (
            <div className="w-full animate-fade-in">
              <BrandingMoodboard
                data={brandingData}
                onSave={handleSave}
                isSaving={isSaving}
                prompt={prompt}
                projectName={brandingData.name}
                generatingSteps={generatingSteps}
                onGenerateSection={handleGenerateSection}
                onGenerateAll={handleGenerateAll}
                steps={STEPS}
                onFeedback={handleFeedback}
                checkDependencies={(stepNumber) => checkDependencies(stepNumber)}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};

