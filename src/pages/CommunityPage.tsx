import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Globe,
  Diamond,
  TrendingUp,
  Plus,
  Image as ImageIcon,
  Camera,
  Layers,
  MapPin,
  Sun,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Box,
  Settings,
  Palette,
  FolderOpen,
  Figma,
  Github,
  Workflow,
  Heart,
} from '@/lib/ui/icons';
import { PageShell } from '../components/ui/PageShell';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import {
  getAllCommunityPresets,
  getCommunityStats,
  clearCommunityPresetsCache,
} from '../services/communityPresetsService';
import { mockupApi } from '../services/mockupApi';
import { cn } from '../lib/utils';
import { getGithubUrl } from '../config/branding';
import { MicroTitle } from '../components/ui/MicroTitle';
import { ErrorState } from '@/components/ui/ErrorState';
import { GlassPanel } from '../components/ui/GlassPanel';
import { PremiumButton } from '../components/ui/PremiumButton';
import ClubLogo3D from '../components/3d/club-logo3d';
import { useMediaQuery } from '@/hooks/use-media-query';
import { CommunityPresetModal } from '../components/CommunityPresetModal';
import { WorkflowLibraryModal } from '../components/WorkflowLibraryModal';
import { canvasApi } from '../services/canvasApi';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { workflowApi } from '../services/workflowApi';
import type { CanvasWorkflow } from '../services/workflowApi';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';
import { Button } from '@/components/ui/button';
import { motion, useSpring, useTransform } from 'framer-motion';
import { glassSurface } from '@/lib/ui/glass';

// --- Components ---

const CountUp: React.FC<{ value: number }> = ({ value }) => {
  const spring = useSpring(0, { mass: 1, stiffness: 100, damping: 30 });
  const displayValue = useTransform(spring, (current) => Math.round(current));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{displayValue}</motion.span>;
};

type PresetType =
  | 'mockup'
  | 'angle'
  | 'texture'
  | 'ambience'
  | 'luminance'
  | '3d'
  | 'presets'
  | 'aesthetics'
  | 'themes'
  | 'ui-prompts'
  | 'figma-prompts';

interface PresetStats {
  mockup: number;
  angle: number;
  texture: number;
  ambience: number;
  luminance: number;
  '3d': number;
  presets: number;
  aesthetics: number;
  themes: number;
  'ui-prompts': number;
  'figma-prompts': number;
  total: number;
}

interface CategoryPresets {
  mockup: any[];
  angle: any[];
  texture: any[];
  ambience: any[];
  luminance: any[];
  '3d': any[];
  presets: any[];
  aesthetics: any[];
  themes: any[];
  'ui-prompts': any[];
  'figma-prompts': any[];
}

interface GlobalStats {
  totalUsers: number;
  totalPresets: number;
  totalBlankMockups: number;
}

export const CommunityPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated: isUserAuthenticated, isCheckingAuth } = useLayout();
  const [stats, setStats] = useState<PresetStats>({
    mockup: 0,
    angle: 0,
    texture: 0,
    ambience: 0,
    luminance: 0,
    '3d': 0,
    presets: 0,
    aesthetics: 0,
    themes: 0,
    'ui-prompts': 0,
    'figma-prompts': 0,
    total: 0,
  });
  const [categoryPresets, setCategoryPresets] = useState<CategoryPresets>({
    mockup: [],
    angle: [],
    texture: [],
    ambience: [],
    luminance: [],
    '3d': [],
    presets: [],
    aesthetics: [],
    themes: [],
    'ui-prompts': [],
    'figma-prompts': [],
  });
  const [globalCommunityStats, setGlobalCommunityStats] = useState<GlobalStats>({
    totalUsers: 0,
    totalPresets: 0,
    totalBlankMockups: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [communityMockups, setCommunityMockups] = useState<any[]>([]);
  const [allPublicMockups, setAllPublicMockups] = useState<any[]>([]);
  const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [workflows, setWorkflows] = useState<CanvasWorkflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [workflowsError, setWorkflowsError] = useState(false);
  const [showWorkflowLibrary, setShowWorkflowLibrary] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { theme } = useTheme();

  // ClubLogo3D é WebGL: recebe hex, não classe utilitária. Resolvido pelo tema
  // pra não ficar uma peça quase preta sobre um card claro no light mode.
  const logo3dColor = theme === 'dark' ? '#0f0f0f' : '#d4d4d4';

  const handleLoadWorkflow = async (workflow: CanvasWorkflow) => {
    try {
      if (!isAuthenticated) {
        toast.error(t('workflows.errors.mustBeAuthenticated') || 'You must be logged in');
        return;
      }

      // Create a new project from this workflow
      // Ensure nodes/edges are properly typed/formatted if needed
      const newProject = await canvasApi.save(workflow.name, workflow.nodes, workflow.edges);

      toast.success(
        t('workflows.messages.loaded', { name: workflow.name }) ||
          `Workflow loaded: ${workflow.name}`
      );
      navigate(`/canvas/${newProject._id}`);
    } catch (error) {
      console.error('Failed to load workflow:', error);
      toast.error(t('workflows.errors.failedToLoad') || 'Failed to load workflow');
    }
  };

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setStatsError(false);
    try {
      const [allPresets, publicMockups, globalStats] = await Promise.all([
        // Presets são o conteúdo da página: falhar aqui é um estado de erro.
        getAllCommunityPresets({ throwOnError: true }),
        mockupApi.getAllPublic().catch(() => []),
        // Os contadores do hero são acessórios e já se escondem em zero —
        // derrubar a página inteira por causa deles seria desproporcional.
        getCommunityStats().catch(() => ({
          totalUsers: 0,
          totalPresets: 0,
          totalBlankMockups: 0,
        })),
      ]);

      // Store all presets for each category (remove duplicates by id)
      const removeDuplicates = (presets: any[]) => {
        const seen = new Set<string | number>();
        return presets.filter((preset) => {
          if (!preset?.id) return false;
          if (seen.has(preset.id)) return false;
          seen.add(preset.id);
          return true;
        });
      };

      const newStats: PresetStats = {
        mockup: allPresets.mockup?.length || 0,
        angle: allPresets.angle?.length || 0,
        texture: allPresets.texture?.length || 0,
        ambience: allPresets.ambience?.length || 0,
        luminance: allPresets.luminance?.length || 0,
        '3d': allPresets['3d']?.length || 0,
        presets: allPresets.presets?.length || 0,
        aesthetics: allPresets.aesthetics?.length || 0,
        themes: allPresets.themes?.length || 0,
        'ui-prompts': allPresets['ui-prompts']?.length || 0,
        'figma-prompts': allPresets['figma-prompts']?.length || 0,
        total: 0,
      };
      newStats.total = Object.values(newStats).reduce(
        (sum, val) => sum + (typeof val === 'number' ? val : 0),
        0
      );
      setStats(newStats);
      setGlobalCommunityStats(globalStats);

      setCategoryPresets({
        mockup: removeDuplicates(allPresets.mockup || []),
        angle: removeDuplicates(allPresets.angle || []),
        texture: removeDuplicates(allPresets.texture || []),
        ambience: removeDuplicates(allPresets.ambience || []),
        luminance: removeDuplicates(allPresets.luminance || []),
        '3d': removeDuplicates(allPresets['3d'] || []),
        presets: removeDuplicates(allPresets.presets || []),
        aesthetics: removeDuplicates(allPresets.aesthetics || []),
        themes: removeDuplicates(allPresets.themes || []),
        'ui-prompts': removeDuplicates(allPresets['ui-prompts'] || []),
        'figma-prompts': removeDuplicates(allPresets['figma-prompts'] || []),
      });

      // Store latest mockups
      const sortedMockups = (publicMockups || [])
        .filter((mockup: any) => mockup?._id && (mockup.imageUrl || mockup.imageBase64))
        .sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      setAllPublicMockups(sortedMockups);
      setCommunityMockups(sortedMockups.slice(0, 10));
    } catch (error) {
      console.error('Failed to load community stats:', error);
      setStatsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const loadWorkflows = useCallback(async () => {
    setWorkflowsLoading(true);
    setWorkflowsError(false);
    try {
      const publicWorkflows = await workflowApi.getPublic();
      setWorkflows(publicWorkflows);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      // Sem isto, uma falha de rede renderiza o empty state e mente:
      // "nenhum workflow público" é um estado diferente de "não deu pra ler".
      setWorkflowsError(true);
    } finally {
      setWorkflowsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // A modal de biblioteca reserva ações a admin; sem resolver a flag ela ficava
  // presa em `false` e o admin nunca as via.
  useEffect(() => {
    if (isUserAuthenticated !== true) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    authService
      .verifyToken()
      .then((user) => {
        if (!cancelled) setIsAdmin(!!user?.isAdmin);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isUserAuthenticated]);

  const presetTypes: Array<{
    type: PresetType;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    count: number;
    presets: any[];
  }> = [
    {
      type: 'mockup',
      icon: ImageIcon,
      label: t('communityPresets.tabs.mockup'),
      count: stats.mockup,
      presets: categoryPresets.mockup,
    },
    {
      type: 'angle',
      icon: Camera,
      label: t('communityPresets.tabs.angle'),
      count: stats.angle,
      presets: categoryPresets.angle,
    },
    {
      type: 'texture',
      icon: Layers,
      label: t('communityPresets.tabs.texture'),
      count: stats.texture,
      presets: categoryPresets.texture,
    },
    {
      type: 'ambience',
      icon: MapPin,
      label: t('communityPresets.tabs.ambience'),
      count: stats.ambience,
      presets: categoryPresets.ambience,
    },
    {
      type: 'luminance',
      icon: Sun,
      label: t('communityPresets.tabs.luminance'),
      count: stats.luminance,
      presets: categoryPresets.luminance,
    },
    {
      type: '3d',
      icon: Box,
      label: t('communityPresets.categories.3d'),
      count: stats['3d'],
      presets: categoryPresets['3d'],
    },
    {
      type: 'presets',
      icon: Settings,
      label: t('common.presets'),
      count: stats.presets,
      presets: categoryPresets.presets,
    },
    {
      type: 'aesthetics',
      icon: Palette,
      label: t('communityPresets.categories.aesthetics'),
      count: stats.aesthetics,
      presets: categoryPresets.aesthetics,
    },
    {
      type: 'themes',
      icon: Diamond,
      label: t('communityPresets.categories.themes'),
      count: stats.themes,
      presets: categoryPresets.themes,
    },
    // AI-generated prompts
    {
      type: 'ui-prompts',
      icon: Diamond,
      label: t('nav.community.uiPrompts'),
      count: stats['ui-prompts'],
      presets: categoryPresets['ui-prompts'],
    },
    {
      type: 'figma-prompts',
      icon: Figma,
      label: t('nav.community.figmaPrompts'),
      count: stats['figma-prompts'],
      presets: categoryPresets['figma-prompts'],
    },
  ];

  const isAuthenticated = isUserAuthenticated === true;

  const handleSavePreset = useCallback(
    async (data: any) => {
      const token = authService.getToken();
      if (!token) {
        throw new Error(t('communityPresets.errors.mustBeAuthenticatedToCreate'));
      }

      const COMMUNITY_API = '/api/community/presets';
      const presetId = data.id;

      try {
        const body: any = {
          presetType: data.presetType,
          id: presetId,
          name: data.name,
          description: data.description,
          prompt: data.prompt,
          aspectRatio: data.aspectRatio,
          tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
        };

        if (data.presetType === 'mockup' && data.referenceImageUrl !== undefined) {
          body.referenceImageUrl = data.referenceImageUrl;
        }

        const response = await fetch(COMMUNITY_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t('communityPresets.errors.failedToCreate'));
        }

        clearCommunityPresetsCache();
        toast.success(t('communityPresets.messages.presetCreated'));

        await loadStats();
      } catch (saveError: any) {
        console.error('Save error:', saveError);
        throw saveError;
      }
    },
    [t, loadStats]
  );

  return (
    <PageShell
      pageId="community"
      seoTitle={t('communityPresets.title')}
      seoDescription={t('communityPresets.subtitle')}
      // `title` alimenta o aria-label do <main> e o h1 sr-only; `breadcrumb`
      // renderiza fora do AppShell. `microTitle`/`description` só existem no
      // header que `hideHeader` remove — o hero abaixo faz esse trabalho.
      title={t('communityPresets.title')}
      breadcrumb={[{ label: t('apps.home'), to: '/' }, { label: t('communityPresets.title') }]}
      hideHeader
    >
      <div className="relative z-10">
        {/* Hero Section */}
        <div className="relative mb-16 min-h-[380px] flex items-center overflow-hidden rounded-2xl border border-border bg-card">
          {/* 3D Object - Repositioned for better balance */}
          <div className="absolute right-0 top-0 w-full md:w-1/2 h-full pointer-events-none z-0">
            <Suspense fallback={null}>
              <ClubLogo3D isMobile={isMobile} color={logo3dColor} starColor="#52ddeb" />
            </Suspense>
          </div>

          {/* Content — full-width padding so it lines up with the sections below */}
          <div className="relative z-10 w-full px-6 md:px-10 py-12">
            <div className="max-w-2xl">
              {/* Badge - Premium Styling */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border backdrop-blur-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="text-2xs text-muted-foreground">
                    {t('community.activeBadge')}
                  </span>
                </div>
              </motion.div>

              {/* Title - Elegant & Impactful */}
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-[1.1] font-manrope tracking-tight"
              >
                {t('communityPresets.title')}
              </motion.h1>

              {/* Description - Refined Typography */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-muted-foreground text-sm md:text-base mb-8 max-w-lg leading-relaxed font-manrope"
              >
                {t('communityPresets.subtitle')}
              </motion.p>

              {/* Action Buttons - Consistent & Premium */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-3"
              >
                <PremiumButton
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 h-11 px-5 text-sm"
                >
                  <Plus size={18} />
                  <span>{t('community.criar_um_novo_prompt')}</span>
                </PremiumButton>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/community/presets')}
                    className="h-11 px-5 bg-muted hover:bg-muted/80 text-foreground rounded-lg border border-border backdrop-blur-md transition-[color,background-color,border-color,filter] flex items-center gap-2"
                  >
                    <Globe size={18} className="text-muted-foreground" />
                    <span className="font-manrope font-semibold">
                      {t('community.explorar_galeria')}
                    </span>
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => setShowWorkflowLibrary(true)}
                    aria-label={t('community.workflowLibrary')}
                    title={t('community.workflowLibrary')}
                    className="h-11 px-4 bg-muted hover:bg-muted/80 text-foreground rounded-lg border border-border backdrop-blur-md transition-[color,background-color,border-color,filter] flex items-center gap-2"
                  >
                    <FolderOpen size={18} className="text-muted-foreground" />
                  </Button>
                </div>
              </motion.div>

              {/* Stats - Integrated Grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-10 max-w-lg"
              >
                {(isLoading || globalCommunityStats.totalUsers > 0) && (
                  <GlassPanel padding="sm" className={cn('group', glassSurface.control)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xs font-medium text-muted-foreground font-manrope">
                        {t('community.membros')}
                      </span>
                      <TrendingUp
                        size={14}
                        className="text-muted-foreground group-hover:text-foreground transition-colors"
                      />
                    </div>
                    <p className="text-3xl font-bold text-foreground font-mono tracking-tighter">
                      {isLoading ? '...' : <CountUp value={globalCommunityStats.totalUsers} />}
                    </p>
                  </GlassPanel>
                )}

                {(isLoading || globalCommunityStats.totalPresets > 0) && (
                  <GlassPanel padding="sm" className={cn('group', glassSurface.control)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xs font-medium text-muted-foreground font-manrope">
                        {t('community.criaes')}
                      </span>
                      <Diamond
                        size={14}
                        className="text-muted-foreground group-hover:text-foreground transition-colors"
                      />
                    </div>
                    <p className="text-3xl font-bold text-foreground font-mono tracking-tighter">
                      {isLoading ? '...' : <CountUp value={globalCommunityStats.totalPresets} />}
                    </p>
                  </GlassPanel>
                )}

                {(isLoading || globalCommunityStats.totalBlankMockups > 0) && (
                  <GlassPanel
                    padding="sm"
                    className={cn('hidden sm:flex group', glassSurface.control)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xs font-medium text-muted-foreground font-manrope">
                        {t('community.publicado')}
                      </span>
                      <ImageIcon
                        size={14}
                        className="text-muted-foreground group-hover:text-foreground transition-colors"
                      />
                    </div>
                    <p className="text-3xl font-bold text-foreground font-mono tracking-tighter">
                      {isLoading ? (
                        '...'
                      ) : (
                        <CountUp value={globalCommunityStats.totalBlankMockups} />
                      )}
                    </p>
                  </GlassPanel>
                )}
              </motion.div>
            </div>
          </div>
        </div>

        {isCheckingAuth && (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
          </div>
        )}

        {!isCheckingAuth && (
          <div className="space-y-24">
            {/* Exploration Categories */}
            <section className="space-y-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                  <MicroTitle className="text-muted-foreground">
                    {t('community.curadoria')}
                  </MicroTitle>
                  <h2 className="text-3xl font-bold text-foreground font-manrope tracking-tight">
                    {t('community.explorar_por_categoria')}
                  </h2>
                </div>
                <Link
                  to="/community/presets"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm transition-all hover:translate-x-1"
                >
                  {t('community.allCategories')}
                  <ArrowRight size={16} />
                </Link>
              </div>

              {statsError ? (
                <ErrorState
                  className="min-h-[240px]"
                  title={t('community.loadErrorTitle')}
                  description={t('community.loadErrorDescription')}
                  retryLabel={t('common.retry')}
                  onRetry={loadStats}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  {presetTypes.map((category) => (
                    <GlassPanel
                      asChild
                      key={category.type}
                      className="group relative rounded-2xl p-6 flex flex-col h-full hover:border-border-hover transition-all hover:-translate-y-1 active:translate-y-0 overflow-hidden bg-muted/40"
                    >
                      <Link to={`/community/presets?type=${category.type}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity [mask-image:linear-gradient(to_bottom_left,black,transparent)] scale-150">
                          <category.icon size={120} className="text-muted-foreground" />
                        </div>

                        <div className="flex items-center justify-between mb-6">
                          <div className="p-3 bg-muted rounded-xl group-hover:bg-muted group-hover:scale-110 transition-all duration-300">
                            <category.icon
                              size={24}
                              className="text-muted-foreground group-hover:text-foreground transition-colors"
                            />
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-2xl font-bold font-mono text-foreground whitespace-nowrap group-hover:text-foreground transition-colors">
                              <CountUp value={category.count} />
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              {t('common.presets')}
                            </span>
                          </div>
                        </div>

                        <div className="mb-6 flex-1">
                          <h3 className="text-lg font-semibold text-foreground font-manrope mb-1 capitalize group-hover:text-foreground transition-colors text-left">
                            {category.label}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed text-left">
                            {t('community.categoryCardDescription', {
                              category: category.label.toLowerCase(),
                            })}
                          </p>
                        </div>

                        {/* Prévia: 5 nomes, sem scroll aninhado. O card inteiro é o link —
                        uma lista rolável aqui dentro competia com ele e cada linha
                        tinha hover state sem ser clicável. */}
                        <div className="space-y-2 pt-4 border-t border-border w-full">
                          {category.presets.length > 0 ? (
                            <>
                              {category.presets.slice(0, 5).map((preset: any, index: number) => (
                                <div
                                  key={`${category.type}-${preset.id || preset._id || index}`}
                                  className="flex items-center gap-3 py-1"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
                                  <p className="text-xs text-muted-foreground truncate text-left">
                                    {preset.name}
                                  </p>
                                </div>
                              ))}
                              {category.presets.length > 5 && (
                                <p className="text-xs text-muted-foreground/70 pt-1 text-left">
                                  +{category.presets.length - 5}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground text-left">
                              {t('community.vazio')}
                            </p>
                          )}
                        </div>
                      </Link>
                    </GlassPanel>
                  ))}
                </div>
              )}
            </section>

            {/* Workflows Section */}
            <section className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground font-manrope">
                    {t('community.workflows_da_comunidade')}
                  </h2>
                  <p className="text-muted-foreground text-sm max-w-lg mt-2">
                    {t('community.workflowsDescription')}
                  </p>
                </div>
                <Link
                  to="/canvas"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm transition-all hover:translate-x-1"
                >
                  {t('community.openCanvas')}
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {workflowsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-md p-6">
                      <div className="aspect-video bg-muted rounded-md mb-4" />
                      <div className="h-4 bg-muted rounded mb-2" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </div>
                  ))
                ) : workflows.length > 0 ? (
                  workflows.slice(0, 8).map((workflow) => {
                    const categoryConfig =
                      WORKFLOW_CATEGORY_CONFIG[
                        workflow.category as keyof typeof WORKFLOW_CATEGORY_CONFIG
                      ] || WORKFLOW_CATEGORY_CONFIG.general;
                    const CategoryIcon = categoryConfig.icon;

                    return (
                      <GlassPanel
                        asChild
                        key={workflow._id}
                        className="group relative rounded-2xl p-6 flex flex-col h-full hover:border-border-hover transition-all hover:-translate-y-1 active:translate-y-0 text-left"
                      >
                        {/* Abre ESTE workflow. Antes ia pra `/canvas` cru: o usuário
                            clicava num workflow específico e caía num canvas vazio. */}
                        <Link to={`/canvas/${workflow._id}`}>
                          {workflow.thumbnailUrl ? (
                            <div className="aspect-video rounded-md overflow-hidden border border-border bg-muted/40 mb-4">
                              <img
                                src={workflow.thumbnailUrl}
                                alt={workflow.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ) : (
                            <div className="aspect-video rounded-md border border-border bg-muted/40 flex items-center justify-center mb-4">
                              <CategoryIcon size={32} className="text-muted-foreground" />
                            </div>
                          )}

                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-foreground font-mono mb-1 line-clamp-1 group-hover:text-foreground transition-colors">
                              {workflow.name}
                            </h3>
                            <p className="text-xs text-muted-foreground font-mono line-clamp-2 mb-3">
                              {workflow.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-3 border-t border-border">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded border font-mono text-2xs flex-shrink-0',
                                categoryConfig.badgeClass
                              )}
                            >
                              {categoryConfig.label}
                            </span>
                            <span className="px-2 py-0.5 bg-muted rounded border border-border text-muted-foreground font-mono text-2xs flex-shrink-0">
                              {t('community.nodesCount', {
                                count: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
                              })}
                            </span>
                            {workflow.likesCount > 0 && (
                              <span className="px-2 py-0.5 bg-muted rounded border border-border text-muted-foreground font-mono text-2xs flex-shrink-0 inline-flex items-center gap-1">
                                <Heart size={10} className="fill-current" />
                                {workflow.likesCount}
                              </span>
                            )}
                          </div>
                        </Link>
                      </GlassPanel>
                    );
                  })
                ) : workflowsError ? (
                  <ErrorState
                    className="col-span-full min-h-[240px]"
                    title={t('community.workflowsLoadError')}
                    description={t('community.loadErrorDescription')}
                    retryLabel={t('common.retry')}
                    onRetry={loadWorkflows}
                  />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full min-h-[240px] flex flex-col items-center justify-center gap-6 border border-border rounded-2xl bg-card backdrop-blur-sm"
                  >
                    <div className={cn('p-6 rounded-full', glassSurface.control)}>
                      <Workflow size={32} strokeWidth={1} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('community.noPublicWorkflows')}
                    </p>
                  </motion.div>
                )}
              </div>

              {workflows.length > 8 && (
                <div className="flex justify-center mt-8">
                  <Button
                    variant="ghost"
                    onClick={() => setShowWorkflowLibrary(true)}
                    className="flex items-center gap-2 px-6 py-2 bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border rounded-full transition-all text-sm font-mono group"
                  >
                    {t('community.viewAllWorkflows')}
                    <ArrowRight
                      size={16}
                      className="group-hover:translate-x-0.5 transition-transform"
                    />
                  </Button>
                </div>
              )}
            </section>

            {/* Gallery Section */}
            <section className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-foreground font-manrope">
                    {t('community.galeria_da_comunidade')}
                  </h2>
                  <p className="text-muted-foreground text-sm max-w-lg">
                    {t('community.galleryDescription')}
                  </p>
                </div>
                <Link
                  to="/mockups"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm transition-all hover:translate-x-1"
                >
                  {t('community.viewFullGallery')}
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square bg-muted rounded-2xl border border-border"
                    />
                  ))
                ) : statsError ? (
                  <ErrorState
                    className="col-span-full min-h-[240px]"
                    title={t('community.loadErrorTitle')}
                    description={t('community.loadErrorDescription')}
                    retryLabel={t('common.retry')}
                    onRetry={loadStats}
                  />
                ) : (isGalleryExpanded ? allPublicMockups : communityMockups).length > 0 ? (
                  (isGalleryExpanded ? allPublicMockups : communityMockups).map((mockup) => (
                    <GlassPanel
                      asChild
                      key={mockup._id}
                      className="group relative aspect-square rounded-2xl overflow-hidden hover:border-border-hover transition-all hover:shadow-2xl"
                    >
                      <Link to="/mockups" className="block w-full h-full">
                        {mockup.imageUrl || mockup.imageBase64 ? (
                          <img
                            src={mockup.imageUrl || mockup.imageBase64}
                            alt={mockup.prompt || t('community.mockupAlt')}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon size={48} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-300 p-4 flex flex-col justify-end">
                          <MicroTitle as="p" className="text-neutral-400 mb-1">
                            {t('community.promptLabel')}
                          </MicroTitle>
                          <p className="text-xs text-white font-mono line-clamp-2 mb-2">
                            {mockup.prompt}
                          </p>
                          {/* O tile leva pra galeria — é o que o destino faz. Antes
                              prometia "usar como referência", que ele nunca fez. */}
                          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                            <ArrowRight size={10} className="text-neutral-400" />
                            <span className="text-2xs text-neutral-300">
                              {t('community.viewFullGallery')}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </GlassPanel>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full min-h-[240px] flex flex-col items-center justify-center gap-6 border border-border rounded-2xl bg-card backdrop-blur-sm"
                  >
                    <div className={cn('p-6 rounded-full', glassSurface.control)}>
                      <ImageIcon size={32} strokeWidth={1} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('community.emptyGallery')}</p>
                  </motion.div>
                )}
              </div>

              {allPublicMockups.length > 10 && (
                <div className="flex justify-center mt-8">
                  <Button
                    variant="ghost"
                    onClick={() => setIsGalleryExpanded(!isGalleryExpanded)}
                    className="flex items-center gap-2 px-6 py-2 bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border rounded-full transition-all text-sm font-mono group"
                  >
                    {isGalleryExpanded ? (
                      <>
                        {t('community.seeLess')}{' '}
                        <ChevronUp
                          size={16}
                          className="group-hover:-translate-y-0.5 transition-transform"
                        />
                      </>
                    ) : (
                      <>
                        {t('community.seeMore')}{' '}
                        <ChevronDown
                          size={16}
                          className="group-hover:translate-y-0.5 transition-transform"
                        />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </section>

            {/* GitHub Ecosystem CTA */}
            <section className="relative">
              <GlassPanel padding="none" className="relative z-10 overflow-hidden">
                <div className="p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="max-w-xl space-y-4 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 text-muted-foreground">
                      <Github size={24} />
                      <MicroTitle as="span" className="font-semibold text-muted-foreground">
                        {t('community.openSource')}
                      </MicroTitle>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground font-manrope leading-tight">
                      {t('community.growTogetherTitle')}
                    </h2>
                    <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                      {t('community.growTogetherBody')}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <a
                      href={getGithubUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 px-8 py-4 bg-foreground text-background font-bold rounded-lg transition-all hover:opacity-90 active:scale-95 shadow-xl"
                    >
                      <Github size={22} className="group-hover:rotate-12 transition-transform" />
                      <span>{t('community.ver_repositrio')}</span>
                      <ArrowRight
                        size={18}
                        className="group-hover:translate-x-1 transition-transform"
                      />
                    </a>
                    <MicroTitle as="p">{t('community.license')}</MicroTitle>
                  </div>
                </div>
              </GlassPanel>
            </section>
          </div>
        )}

        {/* Create Preset Modal */}
        <CommunityPresetModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleSavePreset}
          isCreating={true}
        />

        <WorkflowLibraryModal
          isOpen={showWorkflowLibrary}
          onClose={() => setShowWorkflowLibrary(false)}
          onLoadWorkflow={handleLoadWorkflow}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          t={t}
        />
      </div>
    </PageShell>
  );
};

export default CommunityPage;
