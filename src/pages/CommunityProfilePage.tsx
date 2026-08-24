import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Instagram,
  Youtube,
  Twitter,
  Globe,
  User,
  ImageIcon,
  Diamond,
  Edit,
  Workflow,
  Play,
  Heart,
  Share2,
} from '@/lib/ui/icons';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { PageShell } from '../components/ui/PageShell';
import { ErrorState } from '@/components/ui/ErrorState';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { userProfileService, type UserProfile } from '../services/userProfileService';
import { mockupApi, type Mockup } from '../services/mockupApi';
import { type CanvasWorkflow } from '../services/workflowApi';
import { getImageUrl } from '@/utils/imageUtils';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { EditCommunityProfileModal } from '../components/EditCommunityProfileModal';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { MockupPresetModal } from '../components/MockupPresetModal';
import { TexturePresetModal } from '../components/TexturePresetModal';
import { AnglePresetModal } from '../components/AnglePresetModal';
import { AmbiencePresetModal } from '../components/AmbiencePresetModal';
import { LuminancePresetModal } from '../components/LuminancePresetModal';
import { BackButton } from '../components/ui/BackButton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { workflowApi } from '../services/workflowApi';
import { MicroTitle } from '../components/ui/MicroTitle';
import { GlassPanel } from '../components/ui/GlassPanel';

/**
 * Empty state das abas do perfil. Helper local (não é componente de DS): as três
 * abas repetiam o mesmo bloco, e o dono do perfil precisa de um CTA em vez de
 * "esse usuário ainda não publicou nada" — que na própria página é beco sem saída.
 */
const renderEmptyTab = ({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8 bg-card border border-dashed border-border rounded-2xl">
    <div className="mb-4">{icon}</div>
    <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
    <p className="text-sm text-muted-foreground max-w-sm">{body}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export const CommunityProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [presets, setPresets] = useState<Record<string, any[]>>({
    mockup: [],
    angle: [],
    texture: [],
    ambience: [],
    luminance: [],
  });
  const [workflows, setWorkflows] = useState<CanvasWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedMockup, setSelectedMockup] = useState<Mockup | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Default to mockups tab
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (() => {
    const tab = searchParams.get('tab');
    return tab === 'workflows' || tab === 'presets' ? tab : 'mockups';
  })();
  const setActiveTab = useCallback(
    (tab: string) => {
      // Aba no query param: refresh mantém o lugar e dá pra linkar direto.
      const next = new URLSearchParams(searchParams);
      if (tab === 'mockups') next.delete('tab');
      else next.set('tab', tab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<any | null>(null);
  const [openModalType, setOpenModalType] = useState<
    'mockup' | 'texture' | 'angle' | 'ambience' | 'luminance' | null
  >(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);
  const lastIdentifierRef = useRef<string | null>(null);
  const has404ErrorRef = useRef(false);

  useEffect(() => {
    const getCurrentUser = async () => {
      if (isAuthenticated === true) {
        try {
          const user = await authService.verifyToken();
          if (user) {
            setCurrentUserId(user.id);
          }
        } catch (err) {
          console.error('Failed to get current user:', err);
        }
      }
    };
    getCurrentUser();
  }, [isAuthenticated]);

  const isOwnProfile = useMemo(() => {
    if (!isAuthenticated || !profile || !currentUserId) return false;
    return currentUserId === profile.id;
  }, [isAuthenticated, profile, currentUserId]);

  // SSoT do fetch do perfil: as 4 chamadas viviam duplicadas verbatim aqui e em
  // handleProfileUpdate.
  const fetchProfileBundle = useCallback(async (id: string) => {
    const [profileData, mockupsData, presetsData, workflowsData] = await Promise.all([
      userProfileService.getUserProfile(id),
      userProfileService.getUserMockups(id),
      userProfileService.getUserPresets(id),
      userProfileService.getUserWorkflows(id),
    ]);
    return { profileData, mockupsData, presetsData, workflowsData };
  }, []);

  const applyProfileBundle = useCallback(
    (bundle: Awaited<ReturnType<typeof fetchProfileBundle>>) => {
      setProfile(bundle.profileData);
      setMockups(bundle.mockupsData);
      setPresets(bundle.presetsData);
      setWorkflows(bundle.workflowsData);
    },
    []
  );

  useEffect(() => {
    if (!identifier) {
      setError(t('community.profile.invalidIdentifier'));
      setNotFound(false);
      setIsLoading(false);
      lastIdentifierRef.current = null;
      has404ErrorRef.current = false;
      return;
    }

    if (lastIdentifierRef.current !== identifier) {
      has404ErrorRef.current = false;
      lastIdentifierRef.current = identifier;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (isLoadingRef.current && lastIdentifierRef.current === identifier) {
      return;
    }

    if (has404ErrorRef.current && lastIdentifierRef.current === identifier) {
      setIsLoading(false);
      return;
    }

    const loadProfile = async () => {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      setNotFound(false);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const bundle = await fetchProfileBundle(identifier);

        if (abortController.signal.aborted) {
          return;
        }

        has404ErrorRef.current = false;
        applyProfileBundle(bundle);
      } catch (err: any) {
        if (abortController.signal.aborted) {
          return;
        }

        console.error('Failed to load profile:', err);
        // 404 e falha de leitura são estados diferentes: um é "não existe",
        // o outro é "não deu pra ler" e merece retry.
        if (err.status === 404) {
          has404ErrorRef.current = true;
          setNotFound(true);
        } else {
          setError(err.message || t('community.profile.loadFailed'));
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
        isLoadingRef.current = false;
        abortControllerRef.current = null;
      }
    };

    loadProfile();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isLoadingRef.current = false;
    };
    // `reloadKey` é o gatilho do retry; `isAuthenticated` revalida o estado de
    // like depois do login (antes só reagia a `identifier`).
  }, [identifier, reloadKey, isAuthenticated, fetchProfileBundle, applyProfileBundle, t]);

  const retryLoad = useCallback(() => {
    has404ErrorRef.current = false;
    setReloadKey((k) => k + 1);
  }, []);

  const handleView = useCallback((mockup: Mockup) => {
    setSelectedMockup(mockup);
  }, []);

  const handleCloseViewer = () => {
    setSelectedMockup(null);
  };

  const allPresets = useMemo(() => {
    const combined = [
      ...presets.mockup,
      ...presets.angle,
      ...presets.texture,
      ...presets.ambience,
      ...presets.luminance,
    ];

    const uniqueMap = new Map<string, any>();
    combined.forEach((preset) => {
      const id = preset._id || preset.id;
      if (id && !uniqueMap.has(id)) {
        uniqueMap.set(id, preset);
      }
    });

    return Array.from(uniqueMap.values());
  }, [presets]);

  const handlePresetClick = useCallback((preset: any) => {
    setSelectedPreset(preset);
    setOpenModalType(
      preset.presetType as 'mockup' | 'texture' | 'angle' | 'ambience' | 'luminance'
    );
  }, []);

  const handleClosePresetModal = useCallback(() => {
    setSelectedPreset(null);
    setOpenModalType(null);
  }, []);

  const handleSelectPreset = useCallback(
    (presetId: string) => {
      if (selectedPreset) {
        const type = selectedPreset.presetType || selectedPreset.category || 'mockup';
        const id = selectedPreset.id || selectedPreset._id || presetId;
        navigate(
          `/canvas?action=createNode&type=${encodeURIComponent(type)}&presetId=${encodeURIComponent(
            id
          )}`
        );
      } else {
        toast.success(t('common.presetSelected') || 'Preset selected');
      }
      handleClosePresetModal();
    },
    [t, handleClosePresetModal, selectedPreset, navigate]
  );

  // Ângulo navega pro canvas igual aos outros tipos. Antes só disparava um toast
  // e não fazia nada — irmão de mockup/texture com comportamento diferente.
  const handleSelectAngle = handleSelectPreset;

  const handleProfileUpdate = async () => {
    if (!identifier) return;

    try {
      applyProfileBundle(await fetchProfileBundle(identifier));
      toast.success(t('common.profileUpdatedSuccess'));
    } catch (err: any) {
      console.error('Failed to reload profile:', err);
      toast.error(t('common.failedToReloadProfile'));
    }
  };

  const handleToggleWorkflowLike = async (e: React.MouseEvent, workflow: CanvasWorkflow) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error(t('auth.loginRequired') || 'Please login to like workflows');
      return;
    }

    const newLikedState = !workflow.isLikedByUser;

    // Optimistic update — reverted in catch if the write fails.
    const applyLike = (liked: boolean) =>
      setWorkflows((prev) =>
        prev.map((w) => {
          if (w._id === workflow._id) {
            return {
              ...w,
              isLikedByUser: liked,
              likesCount: liked ? (w.likesCount || 0) + 1 : Math.max(0, (w.likesCount || 0) - 1),
            };
          }
          return w;
        })
      );

    applyLike(newLikedState);

    try {
      await workflowApi.toggleLike(workflow._id);
    } catch (err) {
      console.error('Failed to toggle like:', err);
      // Revert the optimistic state so the UI matches the DB.
      applyLike(!newLikedState);
      toast.error(t('community.failedToUpdateLike') || 'Failed to update like');
    }
  };

  const handleDuplicateWorkflow = async (e: React.MouseEvent, workflow: CanvasWorkflow) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error(t('auth.loginRequired') || 'Please login to duplicate workflows');
      return;
    }

    try {
      await workflowApi.duplicate(workflow._id);
      toast.success(t('community.workflowDuplicated') || 'Workflow duplicated to your library');
      // Could redirect to canvas with new ID if desired
    } catch (err) {
      console.error('Failed to duplicate workflow:', err);
      toast.error(t('community.failedToDuplicateWorkflow') || 'Failed to duplicate workflow');
    }
  };

  const socialLink = (url: string | null, icon: React.ReactNode, label: string) => {
    if (!url) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 bg-muted border border-border rounded-lg text-muted-foreground hover:border-border-hover hover:text-foreground transition-colors duration-200"
        aria-label={label}
        title={label}
      >
        {icon}
      </a>
    );
  };

  const profileName = profile?.name || profile?.username || t('common.user');
  const PROFILE_BREADCRUMB = [
    { label: t('common.community'), to: '/community' },
    { label: t('common.profile') },
  ];

  if (isLoading) {
    return (
      <PageShell
        pageId="community-profile"
        title={t('common.profile')}
        breadcrumb={PROFILE_BREADCRUMB}
        hideHeader
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <GlitchLoader size={36} className="mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">
              {t('community.profile.loading_profile')}
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  // 404 ("esse perfil não existe") e falha de leitura ("não deu pra ler") são
  // telas diferentes: só a segunda oferece retry.
  if (notFound || (!profile && !error)) {
    return (
      <PageShell
        pageId="community-profile"
        title={t('common.profile')}
        breadcrumb={PROFILE_BREADCRUMB}
        hideHeader
      >
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
          <User size={40} strokeWidth={1} className="text-muted-foreground" />
          <p className="text-foreground">{t('community.profile.notFound')}</p>
          <div className="flex items-center gap-3">
            <BackButton className="mb-0" />
            <Button variant="surface" size="sm" asChild>
              <Link to="/community">{t('common.community')}</Link>
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !profile) {
    return (
      <PageShell
        pageId="community-profile"
        title={t('common.profile')}
        breadcrumb={PROFILE_BREADCRUMB}
        hideHeader
      >
        <ErrorState
          className="min-h-[60vh]"
          title={t('community.profile.loadFailed')}
          description={error ?? undefined}
          retryLabel={t('common.retry')}
          onRetry={retryLoad}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      pageId="community-profile"
      seoTitle={t('community.profileTitle', { name: profileName })}
      seoDescription={profile.bio || t('community.viewProfile', { name: profileName })}
      title={profileName}
      breadcrumb={PROFILE_BREADCRUMB}
      // O card de perfil abaixo já é a identidade da página — o header do shell
      // em cima dele seria header duplo.
      hideHeader
    >
      <div>
        {/* Profile Header Card */}
        <div className="relative mb-8 rounded-2xl overflow-hidden bg-card border border-border">
          {/* Cover Image */}
          <div className="h-48 md:h-64 relative w-full bg-muted overflow-hidden">
            {profile.coverImageUrl ? (
              <>
                <img
                  src={profile.coverImageUrl}
                  alt={t('common.cover')}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-90" />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <div className="text-muted-foreground/30">
                  <ImageIcon size={64} strokeWidth={0.5} />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-90" />
              </div>
            )}
          </div>

          {/* Profile Content */}
          <div className="px-6 pb-6 relative z-10 -mt-16 md:-mt-20">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-32 h-32 md:w-36 md:h-36 rounded-2xl bg-muted border-4 border-card overflow-hidden flex items-center justify-center shadow-xl">
                  {profile.picture ? (
                    <img
                      src={profile.picture}
                      alt={profile.name || t('common.profile')}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <User size={64} className="text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left min-w-0">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground font-manrope mb-2 tracking-tight">
                  {profileName}
                </h1>

                {profile.bio && (
                  <p className="text-muted-foreground text-sm md:text-base mb-4 max-w-2xl line-clamp-3">
                    {profile.bio}
                  </p>
                )}

                {/* Socials & Actions */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  {socialLink(profile.instagram, <Instagram size={18} />, t('community.instagram'))}
                  {socialLink(profile.youtube, <Youtube size={18} />, t('community.youtube'))}
                  {socialLink(profile.x, <Twitter size={18} />, t('community.twitter'))}
                  {socialLink(profile.website, <Globe size={18} />, t('community.website'))}

                  {isOwnProfile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditModalOpen(true)}
                      className="ml-2 gap-2"
                    >
                      <Edit size={14} />
                      {t('community.profile.editProfile')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Stats */}
              <GlassPanel padding="sm" className="flex-row gap-4 md:gap-8 mt-4 md:mt-0 shrink-0">
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold font-manrope text-foreground tabular-nums">
                    {mockups.length}
                  </div>
                  <MicroTitle>{t('community.profile.mockups')}</MicroTitle>
                </div>
                <div className="w-px bg-border" />
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold font-manrope text-foreground tabular-nums">
                    {workflows.length}
                  </div>
                  <MicroTitle>{t('community.profile.workflows')}</MicroTitle>
                </div>
                <div className="w-px bg-border" />
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold font-manrope text-foreground tabular-nums">
                    {allPresets.length}
                  </div>
                  <MicroTitle>{t('community.profile.presets')}</MicroTitle>
                </div>
              </GlassPanel>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="mockups" className="gap-2">
                <ImageIcon size={14} />
                {t('community.profile.mockups')}
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-5">
                  {mockups.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="workflows" className="gap-2">
                <Workflow size={14} />
                {t('community.profile.workflows')}
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-5">
                  {workflows.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="presets" className="gap-2">
                <Diamond size={14} />
                {t('community.profile.presets')}
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-5">
                  {allPresets.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Mockups Tab */}
          <TabsContent
            value="mockups"
            className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
          >
            {mockups.length === 0 ? (
              renderEmptyTab({
                icon: <ImageIcon size={48} className="text-muted-foreground" strokeWidth={1} />,
                title: t('community.profile.noMockupsTitle'),
                body: isOwnProfile
                  ? t('community.profile.ownerNoMockupsBody')
                  : t('community.profile.noMockupsBody'),
                action: isOwnProfile ? (
                  <Button variant="brand" size="sm" asChild>
                    <Link to="/create">{t('community.profile.createMockup')}</Link>
                  </Button>
                ) : null,
              })
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {mockups.map((mockup) => {
                  const imageUrl = getImageUrl(mockup);
                  if (!imageUrl) return null;

                  return (
                    <button
                      type="button"
                      key={mockup._id}
                      className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:border-border-hover focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:shadow-lg transition-all duration-300 aspect-square"
                      onClick={() => handleView(mockup)}
                    >
                      <img
                        src={imageUrl}
                        alt={mockup.prompt || t('mockup.title')}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {/* Contagem de likes é informação, não controle: sem hover
                              (touch) ela some. hoverReveal mantém visível onde não
                              há ponteiro fino e revela no foco de teclado. */}
                      <div
                        className={cn(
                          hoverReveal,
                          'absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4'
                        )}
                      >
                        <div className="flex items-center gap-2 text-white">
                          <Heart
                            size={14}
                            className={cn(
                              mockup.isLiked ? 'fill-current text-destructive' : 'text-white'
                            )}
                          />
                          <span className="text-xs font-mono tabular-nums">
                            {mockup.likesCount || 0}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Workflows Tab */}
          <TabsContent
            value="workflows"
            className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
          >
            {workflows.length === 0 ? (
              renderEmptyTab({
                icon: <Workflow size={48} className="text-muted-foreground" strokeWidth={1} />,
                title: t('community.profile.noWorkflowsTitle'),
                body: isOwnProfile
                  ? t('community.profile.ownerNoWorkflowsBody')
                  : t('community.profile.noWorkflowsBody'),
                action: isOwnProfile ? (
                  <Button variant="brand" size="sm" asChild>
                    <Link to="/canvas">{t('community.profile.createWorkflow')}</Link>
                  </Button>
                ) : null,
              })
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {workflows.map((workflow) => (
                  <GlassPanel
                    key={workflow._id}
                    className="group overflow-hidden hover:border-border-hover transition-all duration-300 flex flex-col h-full"
                  >
                    <div className="aspect-video w-full bg-muted relative overflow-hidden">
                      {workflow.thumbnailUrl ? (
                        <img
                          src={workflow.thumbnailUrl}
                          alt={workflow.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          <Workflow size={48} strokeWidth={1} />
                        </div>
                      )}

                      {/* Overlay Actions */}
                      <div
                        className={cn(
                          hoverReveal,
                          'absolute inset-0 bg-background/70 duration-200 flex items-center justify-center gap-2'
                        )}
                      >
                        <Button variant="brand" size="sm" className="gap-2" asChild>
                          <Link to={`/canvas/${workflow._id}`}>
                            <Play size={14} className="fill-current" />
                            {t('community.profile.run')}
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          onClick={(e) => handleDuplicateWorkflow(e, workflow)}
                          aria-label={t('community.profile.duplicate_to_my_library')}
                          title={t('community.profile.duplicate_to_my_library')}
                        >
                          <Share2 size={14} />
                        </Button>
                      </div>

                      {/* Categoria é metadado, não ação: fica sempre visível.
                              Antes só aparecia no hover — invisível no touch. */}
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant="secondary"
                          className="bg-background/70 backdrop-blur-sm text-xs"
                        >
                          {workflow.category}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-4 flex flex-col flex-1">
                      <h3 className="font-semibold text-foreground line-clamp-1 mb-2">
                        <Link
                          to={`/canvas/${workflow._id}`}
                          className="hover:underline underline-offset-2 focus-visible:outline-none focus-visible:underline"
                        >
                          {workflow.name}
                        </Link>
                      </h3>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                        {workflow.description}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                        <div className="flex items-center gap-1 text-muted-foreground text-xs font-mono">
                          <span>
                            {t('community.nodesCount', { count: workflow.nodes?.length || 0 })}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            onClick={(e) => handleToggleWorkflowLike(e, workflow)}
                            aria-pressed={!!workflow.isLikedByUser}
                            className={cn(
                              'flex items-center gap-1.5 text-xs font-mono transition-colors',
                              workflow.isLikedByUser
                                ? 'text-destructive hover:text-destructive'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Heart
                              size={14}
                              className={cn(workflow.isLikedByUser && 'fill-current')}
                            />
                            {workflow.likesCount || 0}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </GlassPanel>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Presets Tab */}
          <TabsContent
            value="presets"
            className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
          >
            {allPresets.length === 0 ? (
              renderEmptyTab({
                icon: <Diamond size={48} className="text-muted-foreground" strokeWidth={1} />,
                title: t('community.profile.noPresetsTitle'),
                body: isOwnProfile
                  ? t('community.profile.ownerNoPresetsBody')
                  : t('community.profile.noPresetsBody'),
                action: isOwnProfile ? (
                  <Button variant="brand" size="sm" asChild>
                    <Link to="/community/presets?view=my">
                      {t('community.profile.createPreset')}
                    </Link>
                  </Button>
                ) : null,
              })
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allPresets.map((preset) => (
                  <GlassPanel
                    asChild
                    key={preset._id || preset.id}
                    className="group flex flex-col text-left h-full p-0 overflow-hidden hover:border-border-hover transition-all duration-300"
                  >
                    <button type="button" onClick={() => handlePresetClick(preset)}>
                      <div className="aspect-[3/2] w-full bg-muted relative overflow-hidden">
                        {preset.referenceImageUrl ? (
                          <img
                            src={preset.referenceImageUrl}
                            alt={preset.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Diamond size={32} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2">
                          <Badge
                            variant="secondary"
                            className="bg-background/70 backdrop-blur-sm text-2xs uppercase"
                          >
                            {preset.presetType}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-4 flex flex-col flex-1 w-full">
                        <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">
                          {preset.name}
                        </h3>
                        {preset.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {preset.description}
                          </p>
                        )}
                      </div>
                    </button>
                  </GlassPanel>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Full Screen Viewer */}
      {selectedMockup && getImageUrl(selectedMockup) && (
        <FullScreenViewer
          base64Image={selectedMockup.imageBase64 || undefined}
          imageUrl={selectedMockup.imageUrl || undefined}
          isLoading={false}
          onClose={handleCloseViewer}
          mockup={selectedMockup}
          onOpenInEditor={(imageBase64: string) => {
            navigate(`/editor?image=${encodeURIComponent(imageBase64)}`);
          }}
          isAuthenticated={isAuthenticated === true}
          mockupId={selectedMockup._id}
          onToggleLike={
            selectedMockup._id
              ? async () => {
                  const prevLiked = selectedMockup.isLiked || false;
                  const prevCount = selectedMockup.likesCount || 0;
                  const newLikedState = !prevLiked;
                  const newCount = newLikedState ? prevCount + 1 : Math.max(0, prevCount - 1);

                  // INTEGRITY CAVEAT: mockupApi.update({ isLiked }) mutates the SHARED
                  // mockup document's like flag — it is NOT an actor-scoped like, so any
                  // viewer's toggle overwrites the same field and the count is not a real
                  // per-user tally. Proper fix needs a backend actor-scoped like endpoint
                  // (out of frontend scope). Optimistic update below reverts on failure.
                  setMockups((prev) =>
                    prev.map((m) =>
                      m._id === selectedMockup._id
                        ? { ...m, isLiked: newLikedState, likesCount: newCount }
                        : m
                    )
                  );
                  setSelectedMockup((prev) =>
                    prev ? { ...prev, isLiked: newLikedState, likesCount: newCount } : null
                  );

                  try {
                    await mockupApi.update(selectedMockup._id, { isLiked: newLikedState });
                  } catch (error) {
                    console.error('Failed to toggle like:', error);
                    // Revert optimistic state so a failed write leaves no phantom like.
                    setMockups((prev) =>
                      prev.map((m) =>
                        m._id === selectedMockup._id
                          ? { ...m, isLiked: prevLiked, likesCount: prevCount }
                          : m
                      )
                    );
                    setSelectedMockup((prev) =>
                      prev ? { ...prev, isLiked: prevLiked, likesCount: prevCount } : null
                    );
                    toast.error(t('community.failedToUpdateLike') || 'Failed to update like');
                  }
                }
              : undefined
          }
          onLikeStateChange={(newIsLiked) => {
            if (selectedMockup._id) {
              setMockups((prev) =>
                prev.map((m) => (m._id === selectedMockup._id ? { ...m, isLiked: newIsLiked } : m))
              );
              setSelectedMockup((prev) => (prev ? { ...prev, isLiked: newIsLiked } : null));
            }
          }}
          isLiked={selectedMockup.isLiked || false}
          editButtonsDisabled={true}
          creditsPerOperation={1}
        />
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && profile && (
        <EditCommunityProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          profile={profile}
          onUpdate={handleProfileUpdate}
        />
      )}

      {/* Preset Modals */}
      {openModalType === 'mockup' && selectedPreset && (
        <MockupPresetModal
          isOpen={openModalType === 'mockup' && selectedPreset !== null}
          selectedPresetId={selectedPreset.id || selectedPreset._id || ''}
          onClose={handleClosePresetModal}
          onSelectPreset={handleSelectPreset}
          isLoading={false}
        />
      )}

      {openModalType === 'texture' && selectedPreset && (
        <TexturePresetModal
          isOpen={openModalType === 'texture' && selectedPreset !== null}
          selectedPresetId={selectedPreset.id || selectedPreset._id || ''}
          onClose={handleClosePresetModal}
          onSelectPreset={handleSelectPreset}
          isLoading={false}
        />
      )}

      {openModalType === 'angle' && selectedPreset && (
        <AnglePresetModal
          isOpen={openModalType === 'angle' && selectedPreset !== null}
          selectedAngleId={selectedPreset.id || selectedPreset._id || ''}
          onClose={handleClosePresetModal}
          onSelectAngle={handleSelectAngle}
          isLoading={false}
        />
      )}

      {openModalType === 'ambience' && selectedPreset && (
        <AmbiencePresetModal
          isOpen={openModalType === 'ambience' && selectedPreset !== null}
          selectedPresetId={selectedPreset.id || selectedPreset._id || ''}
          onClose={handleClosePresetModal}
          onSelectPreset={handleSelectPreset}
          isLoading={false}
        />
      )}

      {openModalType === 'luminance' && selectedPreset && (
        <LuminancePresetModal
          isOpen={openModalType === 'luminance' && selectedPreset !== null}
          selectedPresetId={selectedPreset.id || selectedPreset._id || ''}
          onClose={handleClosePresetModal}
          onSelectPreset={handleSelectPreset}
          isLoading={false}
        />
      )}
    </PageShell>
  );
};
