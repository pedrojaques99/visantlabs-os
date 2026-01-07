import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Instagram, Youtube, Twitter, Globe, User, ImageIcon, Sparkles, Edit, ArrowLeft, Minus, Plus } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { userProfileService, type UserProfile } from '../services/userProfileService';
import { mockupApi, type Mockup } from '../services/mockupApi';
import { getImageUrl } from '../utils/imageUtils';
import { useLayout } from '../hooks/useLayout';
import { useTranslation } from '../hooks/useTranslation';
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

export const CommunityProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, subscriptionStatus } = useLayout();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [presets, setPresets] = useState<Record<string, any[]>>({
    mockup: [],
    angle: [],
    texture: [],
    ambience: [],
    luminance: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMockup, setSelectedMockup] = useState<Mockup | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('profilePageColumns');
    return saved ? parseInt(saved, 10) : 4;
  });
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'mockups' | 'presets'>('mockups');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<any | null>(null);
  const [openModalType, setOpenModalType] = useState<'mockup' | 'texture' | 'angle' | 'ambience' | 'luminance' | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);
  const lastIdentifierRef = useRef<string | null>(null);
  const has404ErrorRef = useRef(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

    // Reset 404 error flag if identifier changed
    if (lastIdentifierRef.current !== identifier) {
      has404ErrorRef.current = false;
      lastIdentifierRef.current = identifier;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Prevent concurrent requests for the same identifier
    if (isLoadingRef.current && lastIdentifierRef.current === identifier) {
      return;
    }

    // Don't retry if we already have a 404 error for this identifier
    if (has404ErrorRef.current && lastIdentifierRef.current === identifier) {
      setIsLoading(false);
      return;
    }

    const loadProfile = async () => {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      // Create new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const [profileData, mockupsData, presetsData] = await Promise.all([
          userProfileService.getUserProfile(identifier),
          userProfileService.getUserMockups(identifier),
          userProfileService.getUserPresets(identifier),
        ]);

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        has404ErrorRef.current = false;
        setProfile(profileData);
        setMockups(mockupsData);
        setPresets(presetsData);
      } catch (err: any) {
        // Ignore aborted requests
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

    // Cleanup function
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

  const handleColumnsChange = useCallback((newColumns: number) => {
    const clamped = Math.max(1, Math.min(6, newColumns));
    setColumns(clamped);
    localStorage.setItem('profilePageColumns', clamped.toString());
  }, []);

  const getGridClasses = useCallback(() => {
    return 'grid gap-2 md:gap-3 lg:gap-4';
  }, []);

  const getGridStyle = useCallback(() => {
    return {
      gridTemplateColumns: isMobile ? 'repeat(1, minmax(0, 1fr))' : `repeat(${columns}, minmax(0, 1fr))`,
    };
  }, [columns, isMobile]);

  const allPresets = useMemo(() => {
    return [
      ...presets.mockup,
      ...presets.angle,
      ...presets.texture,
      ...presets.ambience,
      ...presets.luminance,
    ];
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
    toast.success(t('common.presetSelected') || 'Preset selected');
    handleClosePresetModal();
  }, [t, handleClosePresetModal]);

  const handleSelectAngle = useCallback((angleId: string) => {
    toast.success(t('common.presetSelected') || 'Preset selected');
    handleClosePresetModal();
  }, [t, handleClosePresetModal]);

  const handleProfileUpdate = async () => {
    if (!identifier) return;

    try {
      const [profileData, mockupsData, presetsData] = await Promise.all([
        userProfileService.getUserProfile(identifier),
        userProfileService.getUserMockups(identifier),
        userProfileService.getUserPresets(identifier),
      ]);

      setProfile(profileData);
      setMockups(mockupsData);
      setPresets(presetsData);
      toast.success(t('common.profileUpdatedSuccess'));
    } catch (err: any) {
      console.error('Failed to reload profile:', err);
      toast.error(t('common.failedToReloadProfile'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <GlitchLoader size={36} className="mx-auto mb-4" />
              <p className="text-zinc-400 font-mono text-sm">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
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
      <div className="min-h-screen bg-[#121212] text-zinc-300 relative overflow-hidden">
        {/* Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <GridDotsBackground />
        </div>

        {/* Header with Cover Image */}
        <div className="relative z-10 pt-16 md:pt-20">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            {/* Breadcrumb with Back Button */}
            <div className="mb-4">
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

            {/* Cover Image */}
            <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden mb-4 bg-zinc-900/50 border border-zinc-800/60">
              {profile.coverImageUrl ? (
                <img
                  src={profile.coverImageUrl}
                  alt={t('common.cover')}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-zinc-700">
                    <ImageIcon size={48} strokeWidth={1} />
                  </div>
                </div>
              )}
            </div>

            {/* Profile Info Section */}
            <div className="relative -mt-16 md:-mt-20 mb-8">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-6">
                {/* Profile Picture */}
                <div className="relative">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-md bg-zinc-900 border-4 border-[#121212] overflow-hidden flex items-center justify-center">
                    {profile.picture ? (
                      <img
                        src={profile.picture}
                        alt={profile.name || t('common.profile')}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={64} className="text-zinc-600" />
                    )}
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-2xl md:text-3xl font-semibold text-zinc-200 font-manrope mb-2">
                    {profile.name || profile.username || t('common.user')}
                  </h1>
                  {profile.bio && (
                    <p className="text-sm md:text-base text-zinc-400 font-mono mb-4 max-w-2xl">
                      {profile.bio}
                    </p>
                  )}

                  {/* Social Links */}
                  <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                    {profile.instagram && (
                      <a
                        href={profile.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-zinc-900/50 border border-zinc-800/60 rounded-md hover:border-[#brand-cyan]/50 hover:bg-zinc-900/80 transition-colors"
                        title={t('community.instagram')}
                      >
                        <Instagram size={18} className="text-zinc-400 hover:text-brand-cyan transition-colors" />
                      </a>
                    )}
                    {profile.youtube && (
                      <a
                        href={profile.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-zinc-900/50 border border-zinc-800/60 rounded-md hover:border-[#brand-cyan]/50 hover:bg-zinc-900/80 transition-colors"
                        title={t('community.youtube')}
                      >
                        <Youtube size={18} className="text-zinc-400 hover:text-brand-cyan transition-colors" />
                      </a>
                    )}
                    {profile.x && (
                      <a
                        href={profile.x}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-zinc-900/50 border border-zinc-800/60 rounded-md hover:border-[#brand-cyan]/50 hover:bg-zinc-900/80 transition-colors"
                        title={t('community.twitter')}
                      >
                        <Twitter size={18} className="text-zinc-400 hover:text-brand-cyan transition-colors" />
                      </a>
                    )}
                    {profile.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-zinc-900/50 border border-zinc-800/60 rounded-md hover:border-[#brand-cyan]/50 hover:bg-zinc-900/80 transition-colors"
                        title={t('community.website')}
                      >
                        <Globe size={18} className="text-zinc-400 hover:text-brand-cyan transition-colors" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Edit Button (if own profile) */}
                {isOwnProfile && (
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-4 py-2 bg-brand-cyan/15 text-brand-cyan border border-[#brand-cyan]/40 hover:bg-brand-cyan/25 rounded-xl text-sm font-mono transition flex items-center gap-2"
                  >
                    <Edit size={16} />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-brand-cyan font-mono mb-1">
                  {profile.stats.mockups}
                </p>
                <p className="text-xs text-zinc-500 font-mono uppercase">Mockups</p>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-brand-cyan font-mono mb-1">
                  {profile.stats.presets}
                </p>
                <p className="text-xs text-zinc-500 font-mono uppercase">Presets</p>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 text-center">
                <p className="text-xs text-zinc-500 font-mono uppercase mb-1">Member Since</p>
                <p className="text-sm text-zinc-400 font-mono">
                  {new Date(profile.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-4 mb-6 border-b border-zinc-800/60">
              <button
                onClick={() => setActiveTab('mockups')}
                className={`px-4 py-2 font-mono text-sm transition-colors border-b-2 ${activeTab === 'mockups'
                    ? 'text-brand-cyan border-[#brand-cyan]'
                    : 'text-zinc-500 border-transparent hover:text-zinc-400'
                  }`}
              >
                Mockups ({mockups.length})
              </button>
              <button
                onClick={() => setActiveTab('presets')}
                className={`px-4 py-2 font-mono text-sm transition-colors border-b-2 ${activeTab === 'presets'
                    ? 'text-brand-cyan border-[#brand-cyan]'
                    : 'text-zinc-500 border-transparent hover:text-zinc-400'
                  }`}
              >
                Presets ({allPresets.length})
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pb-12 md:pb-16">
          {/* Floating Column Control */}
          {((activeTab === 'mockups' && mockups.length > 0) || (activeTab === 'presets' && allPresets.length > 0)) && !isMobile && (
            <div className="fixed bottom-4 md:bottom-6 left-4 md:left-6 z-30">
              <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md border border-zinc-800/60 rounded-md p-1.5 shadow-lg">
                <button
                  onClick={() => handleColumnsChange(columns - 1)}
                  disabled={columns <= 1}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-zinc-800/30"
                  aria-label={t('common.decreaseColumns')}
                >
                  <Minus size={14} />
                </button>
                <div className="px-2.5">
                  <span className="text-xs font-mono text-zinc-400 min-w-[1.5rem] text-center">
                    {columns}
                  </span>
                </div>
                <button
                  onClick={() => handleColumnsChange(columns + 1)}
                  disabled={columns >= 6}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-zinc-800/30"
                  aria-label={t('common.increaseColumns')}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Mockups Gallery */}
          {activeTab === 'mockups' && (
            <>
              {mockups.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center py-16">
                  <ImageIcon size={64} className="text-zinc-700 mb-6" strokeWidth={1} />
                  <h2 className="text-xl font-semibold font-mono uppercase text-zinc-500 mb-3">
                    NO MOCKUPS YET
                  </h2>
                  <p className="text-sm text-zinc-600 font-mono max-w-md">
                    This user hasn't created any mockups yet.
                  </p>
                </div>
              ) : (
                <div className={getGridClasses()} style={getGridStyle()}>
                  {mockups.map((mockup) => {
                    const imageUrl = getImageUrl(mockup);
                    if (!imageUrl) return null;

                    return (
                      <div
                        key={mockup._id}
                        className="group relative bg-black/30 backdrop-blur-sm border border-zinc-800/60 rounded-md overflow-hidden hover:border-[#brand-cyan]/50 transition-all duration-300"
                      >
                        <div
                          className="aspect-square relative overflow-hidden bg-zinc-900/50 cursor-pointer"
                          onClick={() => handleView(mockup)}
                        >
                          <img
                            src={imageUrl}
                            alt={mockup.prompt || t('mockup.title')}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Presets Gallery */}
          {activeTab === 'presets' && (
            <>
              {allPresets.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center py-16">
                  <Sparkles size={64} className="text-zinc-700 mb-6" strokeWidth={1} />
                  <h2 className="text-xl font-semibold font-mono uppercase text-zinc-500 mb-3">
                    NO PRESETS YET
                  </h2>
                  <p className="text-sm text-zinc-600 font-mono max-w-md">
                    This user hasn't created any presets yet.
                  </p>
                </div>
              ) : (
                <div className={getGridClasses()} style={getGridStyle()}>
                  {allPresets.map((preset) => (
                    <button
                      key={preset._id || preset.id}
                      onClick={() => handlePresetClick(preset)}
                      className="group relative bg-black/30 backdrop-blur-sm border border-zinc-800/60 rounded-md overflow-hidden hover:border-[#brand-cyan]/50 transition-all duration-300 p-4 cursor-pointer text-left w-full"
                      aria-label={`Open ${preset.name} preset`}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-zinc-200 font-mono line-clamp-2">
                            {preset.name}
                          </h3>
                          <span className="px-2 py-1 bg-zinc-900/50 rounded text-xs text-zinc-400 font-mono uppercase flex-shrink-0">
                            {preset.presetType}
                          </span>
                        </div>
                        {preset.description && (
                          <p className="text-xs text-zinc-500 font-mono line-clamp-2">
                            {preset.description}
                          </p>
                        )}
                        {preset.referenceImageUrl && (
                          <div className="aspect-video rounded overflow-hidden bg-zinc-900/50 mt-2">
                            <img
                              src={preset.referenceImageUrl}
                              alt={preset.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
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

