import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandingWelcomeScreen } from '../components/branding/BrandingWelcomeScreen';
import { BrandingMoodboard } from '../components/branding/BrandingMoodboard';
import { BrandingExpertChat } from '../components/branding/BrandingExpertChat';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { markStepErrored, clearErroredSteps } from '../components/branding/EmptySectionCard';
import { Target as BowArrow, Diamond } from '@/lib/ui/icons';
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
import { isVisantV2 } from '../types/branding';
import { SEO } from '../components/SEO';
import { SoftwareApplicationSchema } from '../components/StructuredData';
import { CanvasErrorBoundary } from '@/components/shared/CanvasErrorBoundary';
import { GlitchLoader } from '@/components/ui/GlitchLoader';

const API_BASE_URL = '/api';

/**
 * Outcome of one step inside a "generate all" run.
 * - `ok`      → the step now has content because of (or already before) this run
 * - `failed`  → we tried and it did not produce content
 * - `skipped-in-flight` → another call is already generating it; we deliberately
 *   did not fire a second request and cannot claim success or failure for it.
 * A boolean cannot express the third case, which is why an in-flight step used to
 * be counted as a success in the "generated X of Y" tally.
 */
type StepGenerationOutcome = 'ok' | 'failed' | 'skipped-in-flight';

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
  const { isAuthenticated, isCheckingAuth, subscriptionStatus, onCreditPackagesModalOpen } =
    useLayout();
  const { hasAccess, isLoading: isLoadingAccess } = usePremiumAccess();
  const [currentStep, setCurrentStep] = useState<number>(0); // 0 = welcome, 10 = moodboard
  const [prompt, setPrompt] = useState<string>('');
  const [brandingData, setBrandingData] = useState<BrandingData>({ prompt: '' });
  const [isGeneratingInitial, setIsGeneratingInitial] = useState<boolean>(false);
  const [generatingSteps, setGeneratingSteps] = useState<Set<number>>(new Set());
  // Concurrency source of truth for "is this step in flight right now".
  // `generatingSteps` (state) is only for rendering: any async loop that reads it
  // sees the snapshot captured by the render that created the closure, so a step
  // that started/finished mid-loop is invisible to it. The ref is mutated
  // synchronously alongside the state and never goes stale.
  const generatingStepsRef = useRef<Set<number>>(new Set());
  // Same rationale as `generatingStepsRef`, for the generated content itself.
  // `handleGenerateAll` awaits one step at a time for minutes; every reader inside
  // that loop still closes over the `brandingData` of the render that produced the
  // handler, so each step would build `previousData` (and its own `updatedData`)
  // from the pre-loop snapshot and silently drop everything generated earlier in
  // the same run. The ref is written synchronously right before every
  // `setBrandingData` and is therefore always the latest committed content.
  // Rendering keeps reading the state — the ref never replaces it.
  const brandingDataRef = useRef<BrandingData>({ prompt: '' });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingProject, setIsLoadingProject] = useState<boolean>(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showDependencyModal, setShowDependencyModal] = useState<boolean>(false);
  const [pendingGeneration, setPendingGeneration] = useState<{
    stepNumber: number;
    missingDeps: number[];
  } | null>(null);
  const [isExpertChatOpen, setIsExpertChatOpen] = useState(false);
  const loadedProjectIdRef = useRef<string | null>(null);

  const [useVisantV2, setUseVisantV2] = useState(true);

  const STEPS_LEGACY = [
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

  const STEPS_V2 = [
    { id: 101, title: t('branding.steps.centralMessage'), phase: 1 },
    { id: 102, title: t('branding.steps.marketResearchV2'), phase: 1 },
    { id: 103, title: t('branding.steps.personaV2'), phase: 1 },
    { id: 104, title: t('branding.steps.archetypesTone'), phase: 1 },
    { id: 105, title: t('branding.steps.manifesto'), phase: 1 },
    { id: 106, title: t('branding.steps.swotV2'), phase: 1 },
    { id: 107, title: t('branding.steps.colorPaletteV2'), phase: 2 },
    { id: 108, title: t('branding.steps.typography'), phase: 2 },
    { id: 109, title: t('branding.steps.graphicSystem'), phase: 2 },
    { id: 110, title: t('branding.steps.logoConcept'), phase: 2 },
  ];

  const STEPS = useVisantV2 ? STEPS_V2 : STEPS_LEGACY;

  // Redirect to waitlist if user doesn't have premium access
  // Note: Admin users (including free admins) have access via usePremiumAccess hook
  useEffect(() => {
    if (!isLoadingAccess && !hasAccess) {
      navigate('/waitlist', { replace: true });
    }
  }, [hasAccess, isLoadingAccess, navigate]);

  // Handoff da Naming Machine: nome escolhido + brief pré-preenchem o prompt inicial
  const location = useLocation();
  useEffect(() => {
    const s = location.state as { name?: string; brief?: string } | null;
    if (!s?.name || searchParams.get('projectId')) return;
    setPrompt(`Nome da marca: ${s.name}\n\n${s.brief || ''}`.trim());
    // Limpa o state para não re-aplicar em navegações futuras
    navigate('/branding-machine', { replace: true, state: null });
    toast.success(`"${s.name}" carregado — briefing do naming aplicado ao prompt.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load project from URL if projectId is present
  useEffect(() => {
    const projectId = searchParams.get('projectId');
    if (
      projectId &&
      projectId.trim() !== '' &&
      projectId !== 'undefined' &&
      isAuthenticated === true
    ) {
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
    // Reset stale per-step error flags from any previously viewed project.
    clearErroredSteps();

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
      brandingDataRef.current = migratedData;
      setBrandingData(migratedData);
      setUseVisantV2(isVisantV2(migratedData));
      setCurrentStep(10);
      toast.success(t('branding.projectLoaded') || 'Project loaded successfully');
    } catch (error: any) {
      console.error('Error loading project:', error);
      toast.error(
        error.message || t('branding.errors.failedToLoadProject') || 'Failed to load project'
      );
      // Clear projectId from URL if loading failed
      navigate('/branding-machine', { replace: true });
      loadedProjectIdRef.current = null;
    } finally {
      setIsLoadingProject(false);
    }
  };

  // Check if step has required dependencies.
  // `source` defaults to the render snapshot (correct for JSX/read-only callers);
  // anything running inside an async generation loop must pass
  // `brandingDataRef.current` so it sees steps generated earlier in the same run.
  const checkDependencies = (stepNumber: number, source: BrandingData = brandingData): number[] => {
    const missing: number[] = [];

    switch (stepNumber) {
      case 1: // Mercado e Nicho - no dependencies
      case 2: // Público Alvo - no dependencies
      case 3: // Posicionamento - no dependencies
      case 4: // Insights - no dependencies
        break;
      case 5: // Competitors needs all 4 market research sections
        if (!source.mercadoNicho && !source.marketResearch) missing.push(1);
        if (!source.publicoAlvo && !source.marketResearch) missing.push(2);
        if (!source.posicionamento && !source.marketResearch) missing.push(3);
        if (!source.insights && !source.marketResearch) missing.push(4);
        break;
      case 6: // References needs all 4 market research sections + Competitors
        if (!source.mercadoNicho && !source.marketResearch) missing.push(1);
        if (!source.publicoAlvo && !source.marketResearch) missing.push(2);
        if (!source.posicionamento && !source.marketResearch) missing.push(3);
        if (!source.insights && !source.marketResearch) missing.push(4);
        if (!source.competitors) missing.push(5);
        break;
      case 7: // SWOT needs all 4 market research sections + Competitors
        if (!source.mercadoNicho && !source.marketResearch) missing.push(1);
        if (!source.publicoAlvo && !source.marketResearch) missing.push(2);
        if (!source.posicionamento && !source.marketResearch) missing.push(3);
        if (!source.insights && !source.marketResearch) missing.push(4);
        if (!source.competitors) missing.push(5);
        break;
      case 8: // Color Palettes needs SWOT + References
        if (!source.swot) missing.push(7);
        if (!source.references) missing.push(6);
        break;
      case 9: // Visual Elements needs Color Palettes
        if (!source.colorPalettes) missing.push(8);
        break;
      case 10: // Persona needs all 4 market research sections
        if (!source.mercadoNicho && !source.marketResearch) missing.push(1);
        if (!source.publicoAlvo && !source.marketResearch) missing.push(2);
        if (!source.posicionamento && !source.marketResearch) missing.push(3);
        if (!source.insights && !source.marketResearch) missing.push(4);
        break;
      case 13: // Archetypes needs all 4 market research sections
        if (!source.mercadoNicho && !source.marketResearch) missing.push(1);
        if (!source.publicoAlvo && !source.marketResearch) missing.push(2);
        if (!source.posicionamento && !source.marketResearch) missing.push(3);
        if (!source.insights && !source.marketResearch) missing.push(4);
        break;
      // Steps 11 and 12 don't have strict dependencies

      // ═══ Metodologia Visant v2 ═══
      case 101:
        break; // No deps
      case 102:
        if (!source.centralMessage) missing.push(101);
        break;
      case 103:
        if (!source.centralMessage) missing.push(101);
        if (!source.marketResearchV2) missing.push(102);
        break;
      case 104:
        if (!source.centralMessage) missing.push(101);
        if (!source.marketResearchV2) missing.push(102);
        if (!source.personaV2) missing.push(103);
        break;
      case 105:
        if (!source.centralMessage) missing.push(101);
        if (!source.archetypesV2) missing.push(104);
        break;
      case 106:
        if (!source.centralMessage) missing.push(101);
        if (!source.marketResearchV2) missing.push(102);
        if (!source.personaV2) missing.push(103);
        break;
      case 107:
        if (!source.centralMessage) missing.push(101);
        if (!source.manifesto) missing.push(105);
        break;
      case 108:
        if (!source.centralMessage) missing.push(101);
        if (!source.archetypesV2) missing.push(104);
        break;
      case 109:
        if (!source.manifesto) missing.push(105);
        if (!source.colorPaletteV2) missing.push(107);
        if (!source.typography) missing.push(108);
        break;
      case 110:
        if (!source.centralMessage) missing.push(101);
        if (!source.colorPaletteV2) missing.push(107);
        if (!source.typography) missing.push(108);
        break;
    }

    return missing;
  };

  const generateDependencies = async (missingDeps: number[]): Promise<boolean> => {
    // Generate missing dependencies first
    for (const depStep of missingDeps) {
      const depStepTitle = STEPS.find((s) => s.id === depStep)?.title || `Step ${depStep}`;
      toast.info(t('branding.generatingDependency', { step: depStepTitle }));
      const success = await generateStepInternal(depStep, false);
      if (!success) {
        toast.error(t('branding.errors.failedToGenerateDependency', { step: depStepTitle }));
        return false;
      }
      // Small delay between steps
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return true;
  };

  const generateStepInternal = async (
    stepNumber: number,
    isInitial = false,
    silent = false
  ): Promise<boolean> => {
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
      generatingStepsRef.current.add(stepNumber);
      setGeneratingSteps((prev) => new Set([...prev, stepNumber]));
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

      // Fresh content, not the render snapshot: inside "generate all" this is the
      // only way step N receives what steps 1..N-1 just produced.
      const previousData = brandingDataRef.current;

      const response = await fetch(`${API_BASE_URL}/branding/generate-step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          step: stepNumber,
          prompt,
          previousData,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Failed to generate step' }));
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
          `${t('credits.notificationUsed', { count: creditsDeducted, plural })}. ${t(
            'credits.notificationRemaining',
            { remaining: creditsRemaining, plural: remainingPlural }
          )}`
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
      // Merge onto the fresh content too — spreading the render snapshot here would
      // overwrite the state with a version missing every step generated since.
      const updatedData: BrandingData = { ...brandingDataRef.current, prompt };

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

        // ═══ Metodologia Visant v2 ═══
        case 101:
          updatedData.centralMessage = data.centralMessage;
          updatedData.pillars = data.pillars;
          updatedData.version = 'v2';
          break;
        case 102:
          updatedData.marketResearchV2 = data;
          break;
        case 103:
          updatedData.personaV2 = data;
          break;
        case 104:
          updatedData.archetypesV2 = data.archetypes;
          updatedData.toneOfVoice = data.toneOfVoice;
          break;
        case 105:
          updatedData.manifesto = data;
          break;
        case 106:
          updatedData.swot = data;
          break;
        case 107:
          updatedData.colorPaletteV2 = data;
          break;
        case 108:
          updatedData.typography = data;
          break;
        case 109:
          updatedData.graphicSystem = data;
          break;
        case 110:
          updatedData.logoConcept = data;
          break;
      }

      // Only reached after a successful response — a step that threw never lands
      // in the ref, so a mid-run failure cannot poison later steps' previousData.
      brandingDataRef.current = updatedData;
      setBrandingData(updatedData);

      // Success: clear any prior error flag for this step.
      markStepErrored(stepNumber, false);

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
          console.error(
            `[Usage Tracking] Failed to track usage after successful branding step ${stepNumber} generation:`,
            {
              error: trackError.message,
              stack: trackError.stack,
              stepNumber,
            }
          );

          if (trackError.message === 'SUBSCRIPTION_REQUIRED' && !silent) {
            // Defer error handling to next event loop to avoid React hooks violations
            setTimeout(() => {
              toast.error(t('branding.errors.insufficientCredits') || 'Insufficient credits', {
                description:
                  t('branding.errors.trackingFailedButContentGenerated') ||
                  "Your content was generated successfully, but we couldn't update your credits. Please check your account.",
                duration: 6000,
              });
              onCreditPackagesModalOpen();
            }, 0);
          } else if (!silent) {
            // Show friendly message for other tracking errors
            setTimeout(() => {
              toast.info(
                t('branding.errors.trackingFailedButContentGenerated') ||
                  'Your content was generated successfully! There was a minor issue updating your credits, but your work is safe.',
                {
                  duration: 5000,
                }
              );
            }, 0);
          }
        }
      }

      return true;
    } catch (error: any) {
      console.error('Error generating step:', error);
      // Flag the step so its tile renders a distinct error+retry state instead
      // of an indistinguishable "click to generate" tile.
      markStepErrored(stepNumber, true);
      if (!silent) {
        toast.error(error.message || t('branding.errors.failedToGenerateStep'));
      }
      return false;
    } finally {
      if (isInitial) {
        setIsGeneratingInitial(false);
      } else {
        generatingStepsRef.current.delete(stepNumber);
        setGeneratingSteps((prev) => {
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

    // Check dependencies against the freshest content: this handler can also run
    // while another generation is in flight, and the modal must not offer to
    // regenerate a dependency that just landed.
    const missingDeps = checkDependencies(stepNumber, brandingDataRef.current);

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
      const missingSteps = missingDeps
        .map((s) => STEPS.find((st) => st.id === s)?.title || `Step ${s}`)
        .join(', ');
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

    clearErroredSteps();
    const initialData: BrandingData = {
      prompt,
      ...(useVisantV2 ? { version: 'v2' as const } : {}),
    };
    // Must land in the ref before the await below, otherwise the first step would
    // send the previous project's content as its `previousData`.
    brandingDataRef.current = initialData;
    setBrandingData(initialData);
    await generateStep(useVisantV2 ? 101 : 1, true);
    setCurrentStep(10);
  };

  // `source` defaults to the render snapshot; async generation paths pass
  // `brandingDataRef.current` so they see content produced earlier in the same run.
  const getStepContent = (stepNumber: number, source: BrandingData = brandingData) => {
    switch (stepNumber) {
      case 1:
        return source.mercadoNicho;
      case 2:
        return source.publicoAlvo;
      case 3:
        return source.posicionamento;
      case 4:
        return source.insights;
      case 5:
        return source.competitors;
      case 6:
        return source.references;
      case 7:
        return source.swot;
      case 8:
        return source.colorPalettes;
      case 9:
        return source.visualElements;
      case 10:
        return source.persona;
      case 11:
        return source.mockupIdeas;
      case 12:
        return source.moodboard;
      case 13:
        return source.archetypes;

      // ═══ Metodologia Visant v2 ═══
      case 101:
        return source.centralMessage
          ? { centralMessage: source.centralMessage, pillars: source.pillars }
          : null;
      case 102:
        return source.marketResearchV2;
      case 103:
        return source.personaV2;
      case 104:
        return source.archetypesV2
          ? { archetypes: source.archetypesV2, toneOfVoice: source.toneOfVoice }
          : null;
      case 105:
        return source.manifesto;
      case 106:
        return source.swot;
      case 107:
        return source.colorPaletteV2;
      case 108:
        return source.typography;
      case 109:
        return source.graphicSystem;
      case 110:
        return source.logoConcept;
      default:
        return null;
    }
  };

  const handleGenerateSection = async (stepNumber: number) => {
    await generateStep(stepNumber, false, true);
  };

  // Helper function to check if a step has content
  const hasStepContent = (stepNumber: number, source: BrandingData = brandingData): boolean => {
    const content = getStepContent(stepNumber, source);
    return !!(
      content &&
      !(typeof content === 'string' && !content.trim()) &&
      !(Array.isArray(content) && content.length === 0) &&
      !(typeof content === 'object' && Object.keys(content).length === 0)
    );
  };

  // Helper function to generate a step with its dependencies recursively (silently, without showing errors)
  const generateStepWithDependencies = async (
    stepNumber: number,
    generatedSet: Set<number>
  ): Promise<StepGenerationOutcome> => {
    // Already produced content in this run (directly or as someone's dependency).
    if (generatedSet.has(stepNumber)) {
      return 'ok';
    }

    // Being generated right now by another in-flight call (e.g. the user hit the
    // per-section generate button). We must not fire a second request for it, but
    // we also have no idea whether it will succeed — so it is neither ok nor failed.
    if (generatingStepsRef.current.has(stepNumber)) {
      return 'skipped-in-flight';
    }

    // Check if step already has content
    if (hasStepContent(stepNumber, brandingDataRef.current)) {
      generatedSet.add(stepNumber);
      return 'ok';
    }

    // Check for missing dependencies
    const missingDeps = checkDependencies(stepNumber, brandingDataRef.current);

    // Generate missing dependencies first (recursively)
    if (missingDeps.length > 0) {
      for (const depStep of missingDeps) {
        // Check if dependency already exists
        if (hasStepContent(depStep, brandingDataRef.current) || generatedSet.has(depStep)) {
          continue;
        }

        // Recursively generate dependency first (silently)
        try {
          const depOutcome = await generateStepWithDependencies(depStep, generatedSet);
          if (depOutcome !== 'ok') {
            // Failed or still in flight elsewhere — silently continue, don't show
            // an error to the user; the step below will just run with what exists.
            continue;
          }
          // Small delay after generating dependency
          await new Promise((resolve) => setTimeout(resolve, 500));
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
        await new Promise((resolve) => setTimeout(resolve, 800));
        return 'ok';
      }

      // generateStepInternal already called markStepErrored(stepNumber, true) in
      // its catch; the no-credits / no-prompt early returns are legitimate failures
      // for this step too.
      return 'failed';
    } catch (error) {
      // Silently continue on error
      console.error(`Error generating step ${stepNumber}:`, error);
      return 'failed';
    }
  };

  const handleGenerateAll = async () => {
    if (!prompt.trim()) {
      toast.error(t('branding.errors.enterBrandDescription'));
      return;
    }

    const stepsToGenerate = STEPS.filter((step) => {
      const content = getStepContent(step.id, brandingDataRef.current);
      return (
        !content ||
        (typeof content === 'string' && !content.trim()) ||
        (Array.isArray(content) && content.length === 0) ||
        (typeof content === 'object' && Object.keys(content).length === 0)
      );
    }).map((step) => step.id);

    if (stepsToGenerate.length === 0) {
      toast.info(t('branding.allSectionsGenerated'));
      return;
    }

    toast.info(t('branding.generatingAllSections', { count: stepsToGenerate.length }));

    // Track which steps have been generated to avoid duplicates
    const generatedSet = new Set<number>();

    // Generate steps in order, automatically handling dependencies.
    // Steps are automatically sorted by dependencies through the recursive function.
    let succeededCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    for (const stepNumber of stepsToGenerate.sort((a, b) => a - b)) {
      // This will automatically generate dependencies first (silently).
      const outcome = await generateStepWithDependencies(stepNumber, generatedSet);
      if (outcome === 'ok') {
        succeededCount += 1;
      } else if (outcome === 'failed') {
        // Continue with next step even if one fails, but keep an honest tally
        // and flag the step so its tile shows the error+retry state.
        failedCount += 1;
        markStepErrored(stepNumber, true);
      } else {
        // 'skipped-in-flight': another generation owns this step. Not a success and
        // not a failure — do NOT flag it as errored, and do NOT count it as generated.
        skippedCount += 1;
      }
    }

    // Honest result: report how many of the requested steps actually generated,
    // and never fold "still running elsewhere" into the success number.
    const total = stepsToGenerate.length;
    // TODO(i18n): replace the literals below once these keys land in src/locales:
    //   branding.generateAllPartial   ({succeeded}, {total}, {failed})
    //   branding.generateAllNone      ({failed})
    //   branding.generateAllSkipped   ({skipped})  — appended when skipped > 0
    const skippedNote =
      skippedCount > 0 ? ` ${skippedCount} were already running and weren't counted.` : '';
    if (failedCount === 0 && skippedCount === 0) {
      toast.success(t('branding.allSectionsGeneratedSuccess'));
    } else if (succeededCount > 0) {
      toast.warning(
        `Generated ${succeededCount} of ${total} sections — ${failedCount} failed.${skippedNote} Retry the highlighted ones.`
      );
    } else if (failedCount > 0) {
      toast.error(
        `Couldn't generate any sections (${failedCount} failed).${skippedNote} Please try again.`
      );
    } else {
      // Nothing succeeded, nothing failed: every requested step was already running.
      toast.info(`All ${total} sections were already being generated. Nothing new was started.`);
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
          Authorization: `Bearer ${token}`,
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
      if (savedName !== brandingDataRef.current.name) {
        // Ref is the latest committed value, so merging onto it is equivalent to
        // the functional update it replaces — and keeps the ref in sync.
        const renamed: BrandingData = { ...brandingDataRef.current, name: savedName };
        brandingDataRef.current = renamed;
        setBrandingData(renamed);
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
      .map((dep) => STEPS.find((s) => s.id === dep)?.title || `Step ${dep}`)
      .join(', ');

    return t('branding.dependencyModalMessage', {
      dependencies: depTitles,
    });
  };

  if (isLoadingProject) {
    return (
      <div
        className={`h-screen w-full flex items-center justify-center ${
          theme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'
        }`}
      >
        <GlitchLoader size={28} />
      </div>
    );
  }

  return (
    <CanvasErrorBoundary fallbackMessage="Branding Machine crashed">
      <SEO
        title={t('branding.machine.branding_machine_com_ia')}
        description={t('branding.machine.crie_estratgias_completas_de_bran')}
        keywords="branding machine, AI branding, identidade visual, estratégia de marca, design de marca"
      />
      <SoftwareApplicationSchema
        name="Branding Machine"
        description={t('branding.machine.crie_estratgias_completas_de_bran')}
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
          cancelText={t('common.cancel')}
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

      {/* Floating Expert Chat Button */}
      {currentStep !== 0 && (
        <button
          onClick={() =>
            navigate(`/branding-expert${currentProjectId ? `?projectId=${currentProjectId}` : ''}`)
          }
          className="fixed bottom-20 right-6 z-40 w-12 h-12 bg-brand-gradient text-white rounded-full shadow-lg hover:shadow-brand-cyan/20 transition-all hover:scale-110 active:scale-95 flex items-center justify-center group"
          title={t('branding.machine.falar_com_especialista')}
        >
          <Diamond size={20} className="group-hover:rotate-12 transition-transform" />
        </button>
      )}
    </CanvasErrorBoundary>
  );
};
