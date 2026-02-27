import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Instagram, Youtube, Twitter, Globe, User, ImageIcon, Sparkles, Edit, Workflow, Play, Heart, Share2 } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { userProfileService, type UserProfile } from '../services/userProfileService';
import { mockupApi, type Mockup } from '../services/mockupApi';
import { type CanvasWorkflow } from '../services/workflowApi';
import { getImageUrl } from '@/utils/imageUtils';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { SEO } from '../components/SEO';
import { EditCommunityProfileModal } from '../components/EditCommunityProfileModal';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { MockupPresetModal } from '../components/MockupPresetModal';
import { TexturePresetModal } from '../components/TexturePresetModal';
import { AnglePresetModal } from '../components/AnglePresetModal';
import { AmbiencePresetModal } from '../components/AmbiencePresetModal';
import { LuminancePresetModal } from '../components/LuminancePresetModal';
import {
  BreadcrumbWithBack,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
import { BackButton } from '../components/ui/BackButton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';
import { workflowApi } from '../services/workflowApi';

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
  const [selectedMockup, setSelectedMockup] = useState<Mockup | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Default to mockups tab
  const [activeTab, setActiveTab] = useState('mockups');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<any | null>(null);
  const [openModalType, setOpenModalType] = useState<'mockup' | 'texture' | 'angle' | 'ambience' | 'luminance' | null>(null);

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

  useEffect(() => {
    if (!identifier) {
      setError('Invalid profile identifier');
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

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const [profileData, mockupsData, presetsData, workflowsData] = await Promise.all([
          userProfileService.getUserProfile(identifier),
          userProfileService.getUserMockups(identifier),
          userProfileService.getUserPresets(identifier),
          userProfileService.getUserWorkflows(identifier),
        ]);

        if (abortController.signal.aborted) {
          return;
        }

        has404ErrorRef.current = false;
        setProfile(profileData);
        setMockups(mockupsData);
        setPresets(presetsData);
        setWorkflows(workflowsData);
      } catch (err: any) {
        if (abortController.signal.aborted) {
          return;
        }

        console.error('Failed to load profile:', err);
        if (err.status === 404) {
          has404ErrorRef.current = true;
          setError('User not found');
        } else {
          setError(err.message || 'Failed to load profile');
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
  }, [identifier]);

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
    setOpenModalType(preset.presetType as 'mockup' | 'texture' | 'angle' | 'ambience' | 'luminance');
  }, []);

  const handleClosePresetModal = useCallback(() => {
    setSelectedPreset(null);
    setOpenModalType(null);
  }, []);

  const handleSelectPreset = useCallback((presetId: string) => {
    if (selectedPreset) {
      const type = selectedPreset.presetType || selectedPreset.category || 'mockup';
      const id = selectedPreset.id || selectedPreset._id || presetId;
      navigate(`/canvas?action=createNode&type=${encodeURIComponent(type)}&presetId=${encodeURIComponent(id)}`);
    } else {
      toast.success(t('common.presetSelected') || 'Preset selected');
    }
    handleClosePresetModal();
  }, [t, handleClosePresetModal, selectedPreset, navigate]);

  const handleSelectAngle = useCallback((angleId: string) => {
    toast.success(t('common.presetSelected') || 'Preset selected');
    handleClosePresetModal();
  }, [t, handleClosePresetModal]);

  const handleProfileUpdate = async () => {
    if (!identifier) return;

    try {
      const [profileData, mockupsData, presetsData, workflowsData] = await Promise.all([
        userProfileService.getUserProfile(identifier),
        userProfileService.getUserMockups(identifier),
        userProfileService.getUserPresets(identifier),
        userProfileService.getUserWorkflows(identifier),
      ]);

      setProfile(profileData);
      setMockups(mockupsData);
      setPresets(presetsData);
      setWorkflows(workflowsData);
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

    try {
      const newLikedState = !workflow.isLikedByUser;
      await workflowApi.toggleLike(workflow._id);

      setWorkflows(prev => prev.map(w => {
        if (w._id === workflow._id) {
          return {
            ...w,
            isLikedByUser: newLikedState,
            likesCount: newLikedState ? (w.likesCount || 0) + 1 : Math.max(0, (w.likesCount || 0) - 1)
          };
        }
        return w;
      }));
    } catch (err) {
      console.error('Failed to toggle like:', err);
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
        className="p-2 bg-neutral-900/50 border border-neutral-800/60 rounded-md hover:border-brand-cyan/50 hover:bg-neutral-900/80 hover:text-brand-cyan transition-all duration-200"
        title={label}
      >
        {icon}
      </a>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-12 md:pt-14 relative overflow-hidden">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <GlitchLoader size={36} className="mx-auto mb-4" />
              <p className="text-neutral-400 font-mono text-sm">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-12 md:pt-14 relative overflow-hidden">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-red-400 font-mono mb-4">{error || 'User not found'}</p>
              <BackButton className="mb-0" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t('community.profileTitle', { name: profile.name || profile.username || t('common.user') })}
        description={profile.bio || t('community.viewProfile', { name: profile.name || profile.username || t('common.user') })}
      />

      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 relative overflow-hidden">
        {/* Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <GridDotsBackground />
        </div>

        {/* Content */}
        <div className="relative z-10 pt-20 md:pt-24 pb-12">
          <div className="max-w-7xl mx-auto px-4 md:px-6">

            {/* Breadcrumb */}
            <div className="mb-6">
              <BreadcrumbWithBack to="/community">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/">{t('common.home')}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/community">{t('common.community')}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {profile?.name || profile?.username || t('common.user')}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </BreadcrumbWithBack>
            </div>

            {/* Profile Header Card */}
            <div className="relative mb-8 rounded-md overflow-hidden bg-neutral-900/20 border border-neutral-800/50">

              {/* Cover Image */}
              <div className="h-48 md:h-64 relative w-full bg-neutral-900/50 overflow-hidden">
                {profile.coverImageUrl ? (
                  <>
                    <img
                      src={profile.coverImageUrl}
                      alt={t('common.cover')}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0C] via-transparent to-transparent opacity-90" />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-900/50">
                    <div className="text-neutral-800">
                      <ImageIcon size={64} strokeWidth={0.5} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0C] via-transparent to-transparent opacity-90" />
                  </div>
                )}
              </div>

              {/* Profile Content */}
              <div className="px-6 pb-6 relative z-10 -mt-16 md:-mt-20">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-6">

                  {/* Avatar */}
                  <div className="relative group">
                    <div className="w-32 h-32 md:w-36 md:h-36 rounded-md bg-neutral-900 border-4 border-[#0C0C0C] overflow-hidden flex items-center justify-center shadow-xl">
                      {profile.picture ? (
                        <img
                          src={profile.picture}
                          alt={profile.name || t('common.profile')}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <User size={64} className="text-neutral-600" />
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center md:text-left min-w-0">
                    <h1 className="text-3xl md:text-4xl font-bold text-neutral-100 font-manrope mb-2 tracking-tight">
                      {profile.name || profile.username || t('common.user')}
                    </h1>

                    {profile.bio && (
                      <p className="text-neutral-400 font-mono text-sm md:text-base mb-4 max-w-2xl line-clamp-3">
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
                          className="ml-2 gap-2 border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/10 hover:text-brand-cyan hover:border-brand-cyan/50"
                        >
                          <Edit size={14} />
                          Edit Profile
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4 md:gap-8 mt-4 md:mt-0 p-4 bg-neutral-900/40 rounded-xl border border-neutral-800/50 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-bold font-manrope text-white">
                        {profile.stats.mockups}
                      </div>
                      <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Mockups</div>
                    </div>
                    <div className="w-px bg-neutral-800/50" />
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-bold font-manrope text-white">
                        {workflows.length}
                      </div>
                      <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Workflows</div>
                    </div>
                    <div className="w-px bg-neutral-800/50" />
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-bold font-manrope text-white">
                        {profile.stats.presets}
                      </div>
                      <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Presets</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="bg-neutral-900/50 border border-neutral-800/50">
                  <TabsTrigger value="mockups" className="gap-2">
                    <ImageIcon size={14} />
                    Mockups
                    <Badge variant="secondary" className="ml-1 bg-neutral-800/50 text-xs px-1.5 py-0 h-5">
                      {mockups.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="workflows" className="gap-2">
                    <Workflow size={14} />
                    Workflows
                    <Badge variant="secondary" className="ml-1 bg-neutral-800/50 text-xs px-1.5 py-0 h-5">
                      {workflows.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="presets" className="gap-2">
                    <Sparkles size={14} />
                    Presets
                    <Badge variant="secondary" className="ml-1 bg-neutral-800/50 text-xs px-1.5 py-0 h-5">
                      {allPresets.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Mockups Tab */}
              <TabsContent value="mockups" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                {mockups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8 bg-neutral-900/20 border border-neutral-800/50 rounded-xl border-dashed">
                    <ImageIcon size={48} className="text-neutral-700 mb-4" strokeWidth={1} />
                    <h2 className="text-lg font-semibold font-mono uppercase text-neutral-500 mb-2">
                      No mockups yet
                    </h2>
                    <p className="text-sm text-neutral-600 font-mono max-w-sm">
                      This user hasn't published any mockups yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {mockups.map((mockup) => {
                      const imageUrl = getImageUrl(mockup);
                      if (!imageUrl) return null;

                      return (
                        <div
                          key={mockup._id}
                          className="group relative bg-neutral-900/40 border border-neutral-800/50 rounded-xl overflow-hidden hover:border-brand-cyan/50 hover:shadow-lg hover:shadow-brand-cyan/5 transition-all duration-300 aspect-square cursor-pointer"
                          onClick={() => handleView(mockup)}
                        >
                          <img
                            src={imageUrl}
                            alt={mockup.prompt || t('mockup.title')}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                            <div className="flex items-center gap-2 text-white">
                              <Heart size={14} className={cn(mockup.isLiked ? "fill-red-500 text-red-500" : "text-white")} />
                              <span className="text-xs font-mono">{mockup.likesCount || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Workflows Tab */}
              <TabsContent value="workflows" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                {workflows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8 bg-neutral-900/20 border border-neutral-800/50 rounded-xl border-dashed">
                    <Workflow size={48} className="text-neutral-700 mb-4" strokeWidth={1} />
                    <h2 className="text-lg font-semibold font-mono uppercase text-neutral-500 mb-2">
                      No workflows yet
                    </h2>
                    <p className="text-sm text-neutral-600 font-mono max-w-sm">
                      This user hasn't published any workflows yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {workflows.map(workflow => (
                      <Card
                        key={workflow._id}
                        className="group overflow-hidden bg-neutral-900/40 border-neutral-800/50 hover:border-brand-cyan/50 hover:bg-neutral-800/60 transition-all duration-300 flex flex-col h-full"
                      >
                        <div
                          className="aspect-video w-full bg-neutral-950 relative overflow-hidden cursor-pointer"
                          onClick={() => navigate(`/canvas/${workflow._id}`)}
                        >
                          {workflow.thumbnailUrl ? (
                            <img
                              src={workflow.thumbnailUrl}
                              alt={workflow.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-neutral-700">
                              <Workflow size={48} strokeWidth={1} />
                            </div>
                          )}

                          {/* Overlay Actions */}
                          <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              className="gap-2 bg-brand-cyan text-black hover:bg-brand-cyan/90 border-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/canvas/${workflow._id}`);
                              }}
                            >
                              <Play size={14} className="fill-current" />
                              Run
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              onClick={(e) => handleDuplicateWorkflow(e, workflow)}
                              title="Duplicate to my library"
                            >
                              <Share2 size={14} />
                            </Button>
                          </div>

                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Badge variant="secondary" className="bg-neutral-950/70 backdrop-blur-sm border-neutral-700 text-xs">
                              {workflow.category}
                            </Badge>
                          </div>
                        </div>

                        <CardContent className="p-4 flex flex-col flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3
                              className="font-semibold text-neutral-200 line-clamp-1 group-hover:text-brand-cyan transition-colors cursor-pointer"
                              onClick={() => navigate(`/canvas/${workflow._id}`)}
                            >
                              {workflow.name}
                            </h3>
                          </div>

                          <p className="text-sm text-neutral-500 font-mono line-clamp-2 mb-4 flex-1">
                            {workflow.description}
                          </p>

                          <div className="flex items-center justify-between pt-3 border-t border-neutral-800/50 mt-auto">
                            <div className="flex items-center gap-1 text-neutral-500 text-xs font-mono">
                              <span>{workflow.nodes?.length || 0} nodes</span>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => handleToggleWorkflowLike(e, workflow)}
                                className={cn(
                                  "flex items-center gap-1.5 text-xs font-mono transition-colors",
                                  workflow.isLikedByUser
                                    ? "text-red-400 hover:text-red-300"
                                    : "text-neutral-500 hover:text-neutral-300"
                                )}
                              >
                                <Heart
                                  size={14}
                                  className={cn(workflow.isLikedByUser && "fill-current")}
                                />
                                {workflow.likesCount || 0}
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Presets Tab */}
              <TabsContent value="presets" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                {allPresets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8 bg-neutral-900/20 border border-neutral-800/50 rounded-xl border-dashed">
                    <Sparkles size={48} className="text-neutral-700 mb-4" strokeWidth={1} />
                    <h2 className="text-lg font-semibold font-mono uppercase text-neutral-500 mb-2">
                      No presets yet
                    </h2>
                    <p className="text-sm text-neutral-600 font-mono max-w-sm">
                      This user hasn't published any presets yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {allPresets.map((preset) => (
                      <button
                        key={preset._id || preset.id}
                        onClick={() => handlePresetClick(preset)}
                        className="group flex flex-col text-left h-full bg-neutral-900/40 border border-neutral-800/50 rounded-xl overflow-hidden hover:border-brand-cyan/50 hover:bg-neutral-800/60 transition-all duration-300"
                      >
                        <div className="aspect-[3/2] w-full bg-neutral-950 relative overflow-hidden">
                          {preset.referenceImageUrl ? (
                            <img
                              src={preset.referenceImageUrl}
                              alt={preset.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Sparkles size={32} className="text-neutral-700" />
                            </div>
                          )}
                          <div className="absolute bottom-2 right-2">
                            <Badge variant="secondary" className="bg-neutral-950/70 backdrop-blur-sm border-neutral-700 text-[10px] uppercase">
                              {preset.presetType}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-4 flex flex-col flex-1 w-full">
                          <h3 className="font-semibold text-neutral-200 font-mono text-sm mb-1 line-clamp-1 group-hover:text-brand-cyan transition-colors">
                            {preset.name}
                          </h3>
                          {preset.description && (
                            <p className="text-xs text-neutral-500 font-mono line-clamp-2 mt-1">
                              {preset.description}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
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
            onToggleLike={selectedMockup._id ? async () => {
              try {
                const newLikedState = !selectedMockup.isLiked;
                await mockupApi.update(selectedMockup._id, { isLiked: newLikedState });
                setMockups(prev => prev.map(m =>
                  m._id === selectedMockup._id ? { ...m, isLiked: newLikedState } : m
                ));
                setSelectedMockup(prev => prev ? { ...prev, isLiked: newLikedState } : null);
              } catch (error) {
                console.error('Failed to toggle like:', error);
              }
            } : undefined}
            onLikeStateChange={(newIsLiked) => {
              if (selectedMockup._id) {
                setMockups(prev => prev.map(m =>
                  m._id === selectedMockup._id ? { ...m, isLiked: newIsLiked } : m
                ));
                setSelectedMockup(prev => prev ? { ...prev, isLiked: newIsLiked } : null);
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
      </div>
    </>
  );
};
