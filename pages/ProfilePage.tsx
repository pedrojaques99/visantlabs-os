import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { User, Camera, CreditCard, ExternalLink, X, Pickaxe, Share2, Copy, ImageIcon, FilePenLine, FileText, Palette, Users, Heart, HardDrive, Image, TrendingUp, Settings } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { CreditPackagesModal } from '../components/CreditPackagesModal';
import { TransactionsModal } from '../components/TransactionsModal';
import { EditProfileModal } from '../components/EditProfilePage';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { authService, type User as UserType } from '../services/authService';
import { subscriptionService, type SubscriptionStatus } from '../services/subscriptionService';
import { referralService, type ReferralStats } from '../services/referralService';
import { useTranslation } from '../hooks/useTranslation';
import { useLayout } from '../hooks/useLayout';
import { toast } from 'sonner';
import { usageHistoryService, type UsageHistoryRecord, type FeatureType } from '../services/usageHistoryService';
import { SEO } from '../components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import {
  BreadcrumbWithBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/BreadcrumbWithBack";
import { BackButton } from "@/components/ui/BackButton";

export const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isCheckingAuth, onConfigurationModalOpen } = useLayout();

  // Helper function to format dates in a friendly way
  const formatFriendlyDate = (dateString: string | Date): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // If it's today
    if (diffDays === 0) {
      return t('common.today') || 'Today';
    }

    // If it's tomorrow
    if (diffDays === 1 && date > now) {
      return t('common.tomorrow') || 'Tomorrow';
    }

    // If it's yesterday
    if (diffDays === 1 && date < now) {
      return t('common.yesterday') || 'Yesterday';
    }

    // If it's within the next 7 days
    if (diffDays <= 7 && date > now) {
      return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    }

    // Default format
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatFriendlyDateTime = (dateString: string | Date): string => {
    const date = new Date(dateString);

    // Always show date and time in a consistent format
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const [user, setUser] = useState<UserType | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreditPackagesModalOpen, setIsCreditPackagesModalOpen] = useState(false);
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [isLoadingReferral, setIsLoadingReferral] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [usageHistory, setUsageHistory] = useState<UsageHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<FeatureType | 'all'>('all');
  const [historyPagination, setHistoryPagination] = useState({ limit: 50, offset: 0, total: 0, hasMore: false });
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [storageUsage, setStorageUsage] = useState<{
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    formatted: { used: string; limit: string; remaining: string };
  } | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);

  // Load user data when authenticated state changes (sincronizado com contexto)
  useEffect(() => {
    const loadUserData = async () => {
      // Wait for initial auth check to complete
      if (isCheckingAuth) {
        return;
      }

      if (isAuthenticated === true) {
        setIsLoading(true);
        setError(null);
        try {
          // Load user data for profile - uses cached result from authService
          // verifyToken() uses cache/throttle, so this is efficient
          const currentUser = await authService.verifyToken();

          if (!currentUser) {
            setError(t('profile.loadError') || 'Failed to load profile');
            setUser(null);
            return;
          }

          setUser(currentUser);
          setAvatarUrl(currentUser.picture || '');

          // Load subscription status
          try {
            const status = await subscriptionService.getSubscriptionStatus();
            setSubscriptionStatus(status);
          } catch (err) {
            console.error('Failed to load subscription status:', err);
          }

          // Load referral stats
          try {
            setIsLoadingReferral(true);
            const stats = await referralService.getReferralStats();

            // If no referral code exists, generate one
            if (!stats.referralCode) {
              try {
                const newCode = await referralService.generateReferralCode();
                // Reload stats after generating code
                const updatedStats = await referralService.getReferralStats();
                setReferralStats(updatedStats);
              } catch (genErr) {
                console.error('Failed to generate referral code:', genErr);
                // Still set stats even if generation fails
                setReferralStats(stats);
              }
            } else {
              setReferralStats(stats);
            }
          } catch (err) {
            console.error('Failed to load referral stats:', err);
          } finally {
            setIsLoadingReferral(false);
          }

          // Load storage usage
          try {
            setIsLoadingStorage(true);
            const token = authService.getToken();
            if (token) {
              const response = await fetch('/api/storage/usage', {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (response.ok) {
                const storageData = await response.json();
                setStorageUsage(storageData);
              }
            }
          } catch (err) {
            console.error('Failed to load storage usage:', err);
          } finally {
            setIsLoadingStorage(false);
          }
        } catch (err: any) {
          console.error('Failed to load user data:', err);
          setError(t('profile.loadError') || 'Failed to load profile data');
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      } else if (isAuthenticated === false) {
        setUser(null);
        setIsLoading(false);
        setError(null);
      }
    };

    loadUserData();
  }, [isAuthenticated, isCheckingAuth, t]);

  // Load usage history
  useEffect(() => {
    const loadUsageHistory = async () => {
      if (!isAuthenticated || isCheckingAuth) {
        return;
      }

      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const filters = historyFilter !== 'all' ? { feature: historyFilter } : undefined;
        const response = await usageHistoryService.getUsageHistory(filters, {
          limit: historyPagination.limit,
          offset: historyPagination.offset,
        });

        setUsageHistory(response.records);
        setHistoryPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          hasMore: response.pagination.hasMore,
        }));
      } catch (err: any) {
        console.error('Failed to load usage history:', err);
        setHistoryError(err.message || t('usageHistory.loadError'));
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadUsageHistory();
  }, [isAuthenticated, isCheckingAuth, historyFilter, historyPagination.offset]);

  // Reset pagination when filter changes
  useEffect(() => {
    setHistoryPagination(prev => {
      if (prev.offset !== 0) {
        return { ...prev, offset: 0 };
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFilter]);

  // Calculate statistics from usage history
  const usageStats = useMemo(() => {
    if (!usageHistory || usageHistory.length === 0) {
      return {
        totalRecords: 0,
        totalCredits: 0,
        byFeature: {
          mockupmachine: { count: 0, credits: 0 },
          brandingmachine: { count: 0, credits: 0 },
          canvas: { count: 0, credits: 0 },
        },
        byModel: {} as Record<string, number>,
        last7Days: { count: 0, credits: 0 },
        last30Days: { count: 0, credits: 0 },
      };
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      totalRecords: usageHistory.length,
      totalCredits: usageHistory.reduce((sum, record) => sum + (record.creditsDeducted || 0), 0),
      byFeature: {
        mockupmachine: { count: 0, credits: 0 },
        brandingmachine: { count: 0, credits: 0 },
        canvas: { count: 0, credits: 0 },
      },
      byModel: {} as Record<string, number>,
      last7Days: { count: 0, credits: 0 },
      last30Days: { count: 0, credits: 0 },
    };

    usageHistory.forEach((record) => {
      const recordDate = new Date(record.timestamp);
      const credits = record.creditsDeducted || 0;

      // By feature
      if (record.feature && record.feature in stats.byFeature) {
        const feature = record.feature as keyof typeof stats.byFeature;
        stats.byFeature[feature].count++;
        stats.byFeature[feature].credits += credits;
      }

      // By model
      if (record.model) {
        stats.byModel[record.model] = (stats.byModel[record.model] || 0) + 1;
      }

      // By period
      if (recordDate >= sevenDaysAgo) {
        stats.last7Days.count++;
        stats.last7Days.credits += credits;
      }
      if (recordDate >= thirtyDaysAgo) {
        stats.last30Days.count++;
        stats.last30Days.credits += credits;
      }
    });

    return stats;
  }, [usageHistory]);

  const handleManageSubscription = async () => {
    try {
      const { url } = await subscriptionService.createPortalSession();
      window.open(url, '_blank');
    } catch (error: any) {
      console.error('Failed to create portal session:', error);
      toast.error(t('subscription.portalError') || 'Failed to open subscription portal');
    }
  };

  const handleCopyReferralLink = async () => {
    if (!referralStats?.referralCode) {
      toast.error(t('referral.noCode') || 'Referral code not available');
      return;
    }

    const referralLink = referralService.getReferralLink(referralStats.referralCode);

    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success(t('referral.linkCopied') || 'Referral link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast.error(t('referral.copyFailed') || 'Failed to copy link');
    }
  };

  const handlePictureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.selectImageFile'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.imageSizeLimit'));
      return;
    }

    setIsUploadingPicture(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;

          // Get auth token
          const token = localStorage.getItem('auth_token');
          if (!token) {
            throw new Error(t('profile.authenticationRequired'));
          }

          // Upload to backend
          const response = await fetch('/api/auth/profile/picture', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ imageBase64: base64String }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: t('profile.uploadFailed') }));
            throw new Error(errorData.error || t('profile.pictureUploadError'));
          }

          const data = await response.json();
          setAvatarUrl(data.picture);
          setUser(data.user);
          toast.success(t('profile.pictureUploadSuccess'));
        } catch (err: any) {
          console.error('Upload error:', err);
          toast.error(err.message || t('profile.pictureUploadError'));
        } finally {
          setIsUploadingPicture(false);
        }
      };
      reader.onerror = () => {
        toast.error(t('profile.fileReadError'));
        setIsUploadingPicture(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('File upload error:', err);
      toast.error(err.message || t('profile.pictureUploadError'));
      setIsUploadingPicture(false);
    }
  };

  const handleLinkGoogle = async () => {
    setIsLinkingGoogle(true);
    try {
      const authUrl = await authService.getGoogleLinkUrl();
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Link Google error:', error);
      toast.error(error.message || t('profile.googleLinkError'));
      setIsLinkingGoogle(false);
    }
  };

  // Handle Google link callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleLinked = urlParams.get('google_linked');
    const error = urlParams.get('error');

    if (googleLinked === 'true') {
      toast.success(t('profile.googleLinkSuccess'));
      // Reload user data
      authService.invalidateCache();
      window.history.replaceState({}, '', window.location.pathname);
      // Reload page to refresh user data
      window.location.reload();
    } else if (error) {
      let errorMessage = t('profile.googleLinkError');
      if (error === 'google_already_linked') {
        errorMessage = t('profile.googleAlreadyLinked');
      } else if (error === 'email_mismatch') {
        errorMessage = t('profile.googleEmailMismatch');
      } else if (error === 'invalid_state') {
        errorMessage = t('profile.invalidLinkRequest');
      }
      toast.error(errorMessage);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const referralLink = referralStats?.referralCode
    ? referralService.getReferralLink(referralStats.referralCode)
    : '';

  const totalCreditsAvailable = subscriptionStatus
    ? typeof subscriptionStatus.totalCredits === 'number'
      ? subscriptionStatus.totalCredits
      : (subscriptionStatus.totalCreditsEarned ?? 0) + (subscriptionStatus.creditsRemaining ?? 0)
    : 0;

  const hasActiveSubscription = Boolean(subscriptionStatus?.hasActiveSubscription);


  if (isCheckingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <GlitchLoader size={32} />
        </div>
      </div>
    );
  }

  if (!user || isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-mono mb-4">
            {t('profile.notAuthenticated') || 'Please sign in to view your profile'}
          </p>
          <BackButton className="px-4 py-2 bg-zinc-800/50 text-zinc-400 rounded-md text-sm font-mono hover:bg-zinc-700/50 transition-colors mb-0" to="/" />
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t('profile.seoTitle')}
        description={t('profile.seoDescription')}
        noindex={true}
      />
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10 space-y-8">
          {/* Breadcrumb with Back Button */}
          <div className="mb-4">
            <BreadcrumbWithBack to="/">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">{t('apps.home')}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{t('profile.breadcrumb')}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </BreadcrumbWithBack>
          </div>
          <div className="flex items-center gap-4 mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-zinc-300">
              {t('profile.title') || 'PROFILE'}
            </h1>
            <p className="text-zinc-500 font-mono text-sm md:text-base ml-auto hidden md:block">
              {t('profile.subtitle') || 'Manage your account settings'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-mono flex items-center gap-2">
              <X size={16} />
              {error}
            </div>
          )}

          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Container 1: Profile Info - Top Left */}
            <section className="bg-[#1A1A1A] border border-zinc-800/50 rounded-2xl p-6 md:p-8 flex flex-col gap-6">
              <div className="flex flex-col items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploadingPicture}
                  className="hidden"
                />
                <div
                  className="relative w-24 h-24 rounded-2xl bg-[#1A1A1A] border border-zinc-800/50 overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity group"
                  onClick={handlePictureClick}
                  title={t('profile.uploadPicture') || 'Click to upload picture'}
                >
                  {isUploadingPicture ? (
                    <GlitchLoader size={32} />
                  ) : avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user.name || t('profile.title')}
                      className="w-full h-full object-cover"
                      onError={() => setAvatarUrl('')}
                    />
                  ) : (
                    <User size={40} className="text-zinc-600" />
                  )}
                  <span className="absolute bottom-1 right-1 bg-brand-cyan text-black rounded-md p-1.5 shadow-lg shadow-brand-cyan/30 group-hover:bg-brand-cyan/90 transition">
                    <Camera size={14} />
                  </span>
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl md:text-2xl font-semibold text-white font-manrope">
                    {user.name || t('profile.name') || 'Your name'}
                  </h2>
                  <p className="text-sm text-zinc-400">{user.email}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setIsEditProfileModalOpen(true)}
                  className="w-full px-4 py-2.5 bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40 hover:bg-brand-cyan/25 rounded-md text-sm font-mono transition text-center cursor-pointer"
                >
                  {t('profile.edit') || 'Edit profile'}
                </button>
                <button
                  onClick={onConfigurationModalOpen}
                  className="w-full px-4 py-2.5 bg-black/40 border border-zinc-800 text-zinc-300 hover:bg-black/60 rounded-xl text-sm font-mono transition text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Settings size={16} />
                  {t('auth.configuration') || 'Configuration'}
                </button>
                {user && (user.id || user.email) && (
                  <Link
                    to={`/profile/${user.username || user.id}`}
                    className="w-full px-4 py-2.5 bg-black/40 border border-zinc-800 text-zinc-300 hover:bg-black/60 rounded-xl text-sm font-mono transition text-center flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ExternalLink size={16} />
                    {t('profile.viewPublicProfile')}
                  </Link>
                )}
                {/* Google OAuth buttons hidden */}
                {false && !user.googleId && (
                  <button
                    onClick={handleLinkGoogle}
                    disabled={isLinkingGoogle}
                    className="w-full px-4 py-2.5 bg-transparent border border-zinc-800/30 text-zinc-500 hover:border-zinc-700/50 hover:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-mono transition text-center cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLinkingGoogle ? (
                      <>
                        <GlitchLoader size={14} />
                        <span>{t('profile.linkingGoogle')}</span>
                      </>
                    ) : (
                      <span>{t('profile.google')}</span>
                    )}
                  </button>
                )}
                {false && user.googleId && (
                  <div className="w-full px-4 py-2.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded-xl text-sm font-mono text-center flex items-center justify-center gap-2">
                    <span>✓</span>
                    <span>{t('profile.googleLinked')}</span>
                  </div>
                )}
                <Link
                  to="/my-outputs"
                  className="w-full px-4 py-2.5 bg-black/40 border border-zinc-800 text-zinc-300 hover:bg-black/60 rounded-xl text-sm font-mono transition text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Heart size={16} strokeWidth={2} />
                  {t('profile.myMockups') || 'My Mockups'}
                </Link>
                <Link
                  to="/community"
                  className="w-full px-4 py-2.5 bg-black/40 border border-zinc-800 text-zinc-300 hover:bg-black/60 rounded-xl text-sm font-mono transition text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Users size={16} />
                  {t('communityPresets.title') || 'Community Presets'}
                </Link>
                {/* My Brandings link hidden */}
                {/* <Link
                to="/my-brandings"
                className="w-full px-4 py-2.5 bg-black/40 border border-zinc-800 text-zinc-300 hover:bg-black/60 rounded-xl text-sm font-mono transition text-center flex items-center justify-center gap-2"
              >
                <FilePenLine size={16} />
                {t('profile.myBrandings') || 'My Brandings'}
              </Link> */}
                {/* My Budgets link hidden */}
                {/* <Link
                to="/my-budgets"
                className="w-full px-4 py-2.5 bg-black/40 border border-zinc-800 text-zinc-300 hover:bg-black/60 rounded-xl text-sm font-mono transition text-center flex items-center justify-center gap-2"
              >
                <FileText size={16} />
                {t('profile.myBudgets') || 'Meus Orçamentos'}
              </Link> */}
                {/* My Projects link hidden */}
                {/* <Link
                to="/canvas"
                className="w-full px-4 py-2.5 bg-black/40 border border-zinc-800 text-zinc-300 hover:bg-black/60 rounded-xl text-sm font-mono transition text-center flex items-center justify-center gap-2"
              >
                <Palette size={16} />
                {t('profile.myProjects') || 'Meus Projetos'}
              </Link> */}
              </div>
            </section>

            {/* Container 2: Credits & Stats - Top Right */}
            <section className="bg-[#1A1A1A] border border-zinc-800/50 rounded-2xl p-6 md:p-8 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <Pickaxe size={20} className="text-brand-cyan" />
                <div>
                  <p className="text-sm font-normal text-zinc-100 font-redhatmono">
                    {t('credits.title') || 'CREDITS'}
                  </p>
                </div>
              </div>

              {subscriptionStatus ? (
                <>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black/40 border border-zinc-800 rounded-xl p-4">
                        <p className="text-xs text-zinc-500 font-mono mb-2">
                          {t('credits.available') || 'Available'}
                        </p>
                        <p className="text-4xl font-bold text-brand-cyan font-mono">
                          {totalCreditsAvailable}
                        </p>
                      </div>
                      <button
                        onClick={() => setIsCreditPackagesModalOpen(true)}
                        className="bg-brand-cyan/10 border border-brand-cyan/30 hover:bg-brand-cyan/20 rounded-md transition flex items-center justify-center gap-2 text-brand-cyan font-mono text-sm cursor-pointer"
                      >
                        <CreditCard size={16} />
                        {t('credits.buyCredits') || 'Buy credits'}
                      </button>
                    </div>

                    <div className="bg-black/30 border border-zinc-800 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-zinc-500 font-mono">
                          {t('profile.totalCreditsUsed') || 'Total de créditos usados'}
                        </p>
                        <p className="text-xl font-bold text-zinc-200 font-mono">
                          {subscriptionStatus.creditsUsed ?? 0}
                        </p>
                      </div>
                    </div>

                    {/* Storage Usage - Compact */}
                    {isLoadingStorage ? (
                      <div className="bg-black/30 border border-zinc-800 rounded-xl p-3">
                        <div className="flex items-center justify-center">
                          <GlitchLoader size={16} />
                        </div>
                      </div>
                    ) : storageUsage ? (
                      <div className="bg-black/30 border border-zinc-800 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <HardDrive size={14} className="text-brand-cyan" />
                            <p className="text-xs text-zinc-500 font-mono">
                              {t('storage.used') || 'Used'}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-brand-cyan font-mono">
                            {storageUsage.formatted.used}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-zinc-500 font-mono">
                            {t('storage.of') || 'of'} {storageUsage.formatted.limit}
                          </p>
                          <p className="text-xs text-zinc-400 font-mono">
                            {storageUsage.percentage.toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-zinc-800 rounded-md h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${storageUsage.percentage >= 90
                              ? 'bg-red-500'
                              : storageUsage.percentage >= 75
                                ? 'bg-yellow-500'
                                : 'bg-brand-cyan'
                              }`}
                            style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {subscriptionStatus.creditsResetDate && (
                      <p className="text-xs text-zinc-500 font-mono text-center">
                        {subscriptionStatus.hasActiveSubscription
                          ? t('credits.renews', {
                            date: formatFriendlyDate(subscriptionStatus.creditsResetDate),
                          })
                          : t('credits.resets', {
                            date: formatFriendlyDate(subscriptionStatus.creditsResetDate),
                          })}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    {hasActiveSubscription && subscriptionStatus?.subscriptionStatus !== 'free' && (
                      <button
                        onClick={handleManageSubscription}
                        className="w-full px-4 py-3 bg-transparent border border-zinc-800/30 hover:border-zinc-700/50 rounded-xl transition flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-400 font-mono text-sm cursor-pointer"
                        title={t('profile.manageSubscription') || 'Manage subscription'}
                      >
                        <CreditCard size={16} />
                        {t('profile.manageSubscription') || 'Manage subscription'}
                      </button>
                    )}
                    <button
                      onClick={() => setIsTransactionsModalOpen(true)}
                      className="w-full px-4 py-3 bg-transparent border border-zinc-800/30 hover:border-zinc-700/50 rounded-xl transition flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-400 font-mono text-sm cursor-pointer"
                    >
                      <FileText size={16} />
                      {t('profile.viewAllTransactions') || 'Transactions'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <p className="text-sm text-zinc-400 font-mono text-center">
                    {t('profile.noSubscriptionData') || 'Subscription data not available yet.'}
                  </p>
                  <Link
                    to="/profile/edit"
                    className="px-4 py-2 bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan rounded-md font-mono text-sm hover:bg-brand-cyan/30 transition cursor-pointer"
                  >
                    {t('profile.completeProfile') || 'Complete profile'}
                  </Link>
                </div>
              )}
            </section>

            {/* Container 3: Referral Program - Bottom Span */}
            <section className="bg-[#1A1A1A] border border-zinc-800/50 rounded-2xl p-6 md:p-8 flex flex-col gap-6 md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                <Share2 size={20} className="text-brand-cyan" />
                <div>
                  <p className="text-sm font-normal text-zinc-100 font-redhatmono">
                    {t('referral.title') || 'Referral Program'}
                  </p>
                </div>
              </div>

              {referralStats ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs text-zinc-400 font-mono uppercase block">
                        {t('referral.yourLink') || 'Your link'}
                      </label>
                      <button
                        onClick={handleCopyReferralLink}
                        disabled={!referralStats.referralCode}
                        className="px-3 py-1.5 bg-brand-cyan/90 hover:bg-brand-cyan disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-semibold rounded-md text-xs font-mono transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isLoadingReferral ? (
                          <GlitchLoader size={12} />
                        ) : (
                          <Copy size={12} />
                        )}
                        {isLoadingReferral
                          ? t('common.loading') || 'Loading'
                          : t('referral.copy') || 'Copy'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={referralLink}
                      readOnly
                      placeholder={t('referral.generating') || 'Generating referral link...'}
                      className="w-full px-4 py-3 bg-black/40 border border-zinc-800 rounded-md text-zinc-200 font-mono text-xs focus:outline-none focus:border-brand-cyan/70 transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-black/30 border border-zinc-800 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-zinc-500 font-mono">
                          {t('referral.friendsReferred') || 'Friends'}
                        </p>
                        <p className="text-2xl font-bold text-brand-cyan font-mono">
                          {referralStats.referredUsersCount || 0}
                        </p>
                      </div>
                    </div>
                    <div className="bg-black/30 border border-zinc-800 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-zinc-500 font-mono">
                          {t('referral.totalEarned') || 'Earned'}
                        </p>
                        <p className="text-2xl font-bold text-brand-cyan font-mono">
                          {referralStats.totalCreditsEarned || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-500 font-mono mt-2 text-center">
                    {t('referral.description') || 'Share and earn credits'}
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                  <GlitchLoader size={20} />
                  <p className="text-sm text-zinc-500 font-mono text-center">
                    {isLoadingReferral
                      ? t('common.loading') || 'Loading...'
                      : t('referral.generating') || 'Generating referral code...'}
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Usage History Section - Mini Dashboard */}
          <section id="usage-history-section" className="space-y-6">
            {/* Header */}
            <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-brand-cyan" />
                  <div>
                    <p className="text-sm font-normal text-zinc-100 font-redhatmono">
                      {t('usageHistory.title') || 'Usage History'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Display */}
            {historyError && (
              <Card className="bg-[#1A1A1A] border border-red-500/30 rounded-xl">
                <CardContent className="p-4">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-mono flex items-center gap-2">
                    <X size={16} />
                    {historyError}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {isLoadingHistory ? (
              <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <GlitchLoader size={20} />
                    <p className="text-sm text-zinc-500 font-mono text-center">
                      {t('common.loading') || 'Loading...'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : usageHistory.length === 0 ? (
              <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <p className="text-sm text-zinc-500 font-mono text-center">
                      {t('usageHistory.noRecords') || 'No usage records found'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Statistics Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {/* Total Records */}
                  <Card className="bg-card border border-zinc-800/50 rounded-md hover:border-brand-cyan/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <FileText className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-4xl font-bold text-zinc-300 mb-2 font-mono">
                          {usageStats.totalRecords}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">Total de Usos</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">Registros totais</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Credits */}
                  <Card className="bg-card border border-zinc-800/50 rounded-md hover:border-brand-cyan/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <CreditCard className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-4xl font-bold text-[#52ddeb] mb-2 font-mono">
                          {usageStats.totalCredits}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">Créditos Gastos</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">Total consumido</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Last 7 Days */}
                  <Card className="bg-card border border-zinc-800/50 rounded-md hover:border-brand-cyan/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <TrendingUp className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {usageStats.last7Days.count}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">Últimos 7 Dias</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{usageStats.last7Days.credits} créditos</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Mockup Machine Stats */}
                  <Card className="bg-card border border-zinc-800/50 rounded-md hover:border-brand-cyan/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <Image className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {usageStats.byFeature.mockupmachine.count}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">Mockup Machine</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{usageStats.byFeature.mockupmachine.credits} créditos</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Branding Machine Stats */}
                  <Card className="bg-card border border-zinc-800/50 rounded-md hover:border-brand-cyan/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <Palette className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {usageStats.byFeature.brandingmachine.count}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">Branding Machine</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{usageStats.byFeature.brandingmachine.credits} créditos</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Canvas Stats */}
                  <Card className="bg-card border border-zinc-800/50 rounded-md hover:border-brand-cyan/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <ImageIcon className="h-6 w-6 text-brand-cyan" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                          {usageStats.byFeature.canvas.count}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">Canvas</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">{usageStats.byFeature.canvas.credits} créditos</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Filter buttons */}
                <Card className="bg-card border border-zinc-800/50 rounded-md">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setHistoryFilter('all')}
                        className={`px-3 py-1.5 rounded-md text-xs font-mono transition ${historyFilter === 'all'
                          ? 'bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan'
                          : 'bg-black/40 border border-zinc-800 text-zinc-400 hover:bg-black/60'
                          }`}
                      >
                        {t('usageHistory.all') || 'All'}
                      </button>
                      <button
                        onClick={() => setHistoryFilter('brandingmachine')}
                        className={`px-3 py-1.5 rounded-md text-xs font-mono transition ${historyFilter === 'brandingmachine'
                          ? 'bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan'
                          : 'bg-black/40 border border-zinc-800 text-zinc-400 hover:bg-black/60'
                          }`}
                      >
                        {t('usageHistory.brandingMachine') || 'Branding Machine'}
                      </button>
                      <button
                        onClick={() => setHistoryFilter('mockupmachine')}
                        className={`px-3 py-1.5 rounded-md text-xs font-mono transition ${historyFilter === 'mockupmachine'
                          ? 'bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan'
                          : 'bg-black/40 border border-zinc-800 text-zinc-400 hover:bg-black/60'
                          }`}
                      >
                        {t('usageHistory.mockupMachine') || 'Mockup Machine'}
                      </button>
                      <button
                        onClick={() => setHistoryFilter('canvas')}
                        className={`px-3 py-1.5 rounded-md text-xs font-mono transition ${historyFilter === 'canvas'
                          ? 'bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan'
                          : 'bg-black/40 border border-zinc-800 text-zinc-400 hover:bg-black/60'
                          }`}
                      >
                        {t('usageHistory.canvas') || 'Canvas'}
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* History Table */}
                <Card className="bg-card border border-zinc-800/50 rounded-md hover:border-brand-cyan/30 transition-all duration-300 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-zinc-300 font-mono">
                      <FileText className="h-5 w-5 text-brand-cyan" />
                      {t('usageHistory.title') || 'Usage History'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800/50 hover:bg-transparent">
                          <TableHead className="text-zinc-500 font-mono">
                            {t('usageHistory.date') || 'Date'}
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            {t('usageHistory.feature') || 'Feature'}
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            {t('usageHistory.credits') || 'Credits'}
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            {t('usageHistory.model') || 'Model'}
                          </TableHead>
                          <TableHead className="text-zinc-500 font-mono">
                            {t('usageHistory.details') || 'Details'}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usageHistory.map((record) => (
                          <TableRow key={record.id} className="border-zinc-800/30 text-zinc-300 hover:bg-black/20 transition-colors">
                            <TableCell className="px-4 py-4 text-sm font-mono">
                              {formatFriendlyDateTime(record.timestamp)}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-sm font-mono">
                              {record.feature === 'brandingmachine' && (t('usageHistory.brandingMachine') || 'Branding Machine')}
                              {record.feature === 'mockupmachine' && (t('usageHistory.mockupMachine') || 'Mockup Machine')}
                              {record.feature === 'canvas' && (t('usageHistory.canvas') || 'Canvas')}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-sm text-brand-cyan font-mono font-semibold">
                              {record.creditsDeducted}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-sm text-zinc-400 font-mono">
                              {record.model || '-'}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-sm text-zinc-400 font-mono">
                              {record.stepNumber && (
                                <span className="text-xs">
                                  {t('usageHistory.step') || 'Step'} {record.stepNumber}
                                </span>
                              )}
                              {record.resolution && (
                                <span className="text-xs ml-2">
                                  {record.resolution}
                                </span>
                              )}
                              {!record.stepNumber && !record.resolution && '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {historyPagination.total > historyPagination.limit && (
                      <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500 font-mono">
                          {t('usageHistory.showing') || 'Showing'} {historyPagination.offset + 1} - {Math.min(historyPagination.offset + historyPagination.limit, historyPagination.total)} {t('usageHistory.of') || 'of'} {historyPagination.total}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setHistoryPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                            disabled={historyPagination.offset === 0}
                            className="px-3 py-1.5 bg-black/40 border border-zinc-800 text-zinc-300 rounded-md text-xs font-mono hover:bg-black/60 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            {t('usageHistory.previous') || 'Previous'}
                          </button>
                          <button
                            onClick={() => setHistoryPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                            disabled={!historyPagination.hasMore}
                            className="px-3 py-1.5 bg-black/40 border border-zinc-800 text-zinc-300 rounded-md text-xs font-mono hover:bg-black/60 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            {t('usageHistory.next') || 'Next'}
                          </button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </section>
        </div>

        <CreditPackagesModal
          isOpen={isCreditPackagesModalOpen}
          onClose={() => setIsCreditPackagesModalOpen(false)}
          subscriptionStatus={subscriptionStatus}
        />
        <TransactionsModal
          isOpen={isTransactionsModalOpen}
          onClose={() => setIsTransactionsModalOpen(false)}
        />
        <EditProfileModal
          isOpen={isEditProfileModalOpen}
          onClose={() => {
            setIsEditProfileModalOpen(false);
            // Reload user data after closing
            authService.invalidateCache();
            window.location.reload();
          }}
        />
      </div>
    </>
  );
};

