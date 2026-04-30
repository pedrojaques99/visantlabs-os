import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { User, X, ShieldCheck } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { CreditPackagesModal } from '../components/CreditPackagesModal';
import { TransactionsModal } from '../components/TransactionsModal';
import { EditProfileModal } from '../components/EditProfilePage';
import { PageShell } from '../components/ui/PageShell';
import { authService, type User as UserType } from '../services/authService';
import { subscriptionService, type SubscriptionStatus } from '../services/subscriptionService';
import { referralService, type ReferralStats } from '../services/referralService';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { toast } from 'sonner';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { BackButton } from "../components/ui/BackButton";
import { ApiSettings } from '../components/profile/ApiSettings';
import { ProfileOverview } from '../components/profile/ProfileOverview';
import { UsageHistory } from '../components/profile/UsageHistory';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

export const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isCheckingAuth } = useLayout();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
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
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  // Tab state management
  const [currentTab, setCurrentTab] = useState(searchParams.get('tab') || 'overview');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'history', 'configuration'].includes(tab)) {
      setCurrentTab(tab);
    } else {
      setCurrentTab('overview');
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    setSearchParams({ tab: value });
  };

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      if (isCheckingAuth) return;

      if (isAuthenticated === true) {
        setIsLoading(true);
        setError(null);
        try {
          const currentUser = await authService.verifyToken();

          if (!currentUser) {
            setError(t('common.loadError') || 'Failed to load profile');
            setUser(null);
            return;
          }

          setUser(currentUser);
          setAvatarUrl(currentUser.picture || '');

          // Load additional data
          loadSubscriptionStatus();
          loadReferralStats();

        } catch (err: any) {
          console.error('Failed to load user data:', err);
          setError(t('common.loadError') || 'Failed to load profile data');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isCheckingAuth, t]);

  const loadSubscriptionStatus = async () => {
    try {
      const status = await subscriptionService.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err) {
      console.error('Failed to load subscription status:', err);
    }
  };

  const loadReferralStats = async () => {
    try {
      setIsLoadingReferral(true);
      const stats = await referralService.getReferralStats();
      if (!stats.referralCode) {
        try {
          await referralService.generateReferralCode();
          const updatedStats = await referralService.getReferralStats();
          setReferralStats(updatedStats);
        } catch (genErr) {
          console.error('Failed to generate referral code:', genErr);
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
  };

  const handleRefreshUserData = () => {
    loadSubscriptionStatus();
    loadReferralStats();
    authService.verifyToken().then(u => {
      if (u) {
        setUser(u);
        setAvatarUrl(u.picture || '');
      }
    });
  };

  const handleManageSubscription = async () => {
    try {
      const { url } = await subscriptionService.createPortalSession();
      window.open(url, '_blank');
    } catch (error: any) {
      console.error('Failed to create portal session:', error);
      toast.error(t('subscription.portalError') || 'Failed to open subscription portal');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('common.selectImageFile') || 'Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('common.imageSizeLimit') || 'Image too large');
      return;
    }

    setIsUploadingPicture(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          const token = localStorage.getItem('auth_token');
          if (!token) throw new Error(t('common.authenticationRequired'));

          const response = await fetch(`${API_BASE}/auth/profile/picture`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ imageBase64: base64String }),
          });

          if (!response.ok) throw new Error(t('common.pictureUploadError') || 'Failed to upload picture');

          const data = await response.json();
          setAvatarUrl(data.picture);
          setUser(data.user);
          toast.success(t('common.pictureUploadSuccess') || 'Picture updated!');
        } catch (err: any) {
          toast.error(err.message || t('common.pictureUploadError') || 'Failed to upload picture');
        } finally {
          setIsUploadingPicture(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err.message || t('common.pictureUploadError') || 'Failed to upload picture');
      setIsUploadingPicture(false);
    }
  };

  if (isCheckingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 flex items-center justify-center">
        <GlitchLoader size={32} />
      </div>
    );
  }

  if (!user || isAuthenticated === false) {
    return (
      <PageShell pageId="profile-auth-error" width="5xl" title={t('common.notAuthenticated') || 'Acesso Restrito'}>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-red-400 font-mono mb-4">
              {t('common.notAuthenticated') || 'Please sign in to view your profile'}
            </p>
            <BackButton className="px-4 py-2 bg-neutral-800/50 text-neutral-400 rounded-md text-sm font-mono hover:bg-neutral-700/50 transition-colors mb-0" to="/" />
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      pageId="profile"
      width="5xl"
      seoTitle={t('common.profile')}
      seoDescription={t('profile.seoDescription')}
      title={t('common.profile') || 'Perfil'}
      description={t('common.subtitle') || 'Gerencie sua conta e assinatura'}
      microTitle="User // Account"
      breadcrumb={[
        { label: t('apps.home'), to: '/' },
        { label: t('common.profile') || 'Profile' }
      ]}
    >
      <div className="space-y-6">

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-mono flex items-center gap-2">
              <X size={16} />
              {error}
            </div>
          )}

          <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
            <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
              <CardContent className="p-2">
                <TabsList className="bg-transparent border-0 w-full justify-start overflow-x-auto">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black px-6">
                    {t('common.tabs.overview') || 'Dashboard'}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black px-6">
                    {t('common.tabs.history') || 'Histórico'}
                  </TabsTrigger>
                  <TabsTrigger value="configuration" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black px-6">
                    {t('common.tabs.configuration') || 'Configurações'}
                  </TabsTrigger>
                </TabsList>
              </CardContent>
            </Card>

            <TabsContent value="overview">
              <ProfileOverview
                user={user}
                subscriptionStatus={subscriptionStatus}
                referralStats={referralStats}
                isLoadingReferral={isLoadingReferral}
                onRefreshUserData={handleRefreshUserData}
                onManageSubscription={handleManageSubscription}
                onBuyCredits={() => setIsCreditPackagesModalOpen(true)}
                onViewTransactions={() => setIsTransactionsModalOpen(true)}
                onEditProfile={() => setIsEditProfileModalOpen(true)}
                isUploadingPicture={isUploadingPicture}
                onFileUpload={handleFileUpload}
                avatarUrl={avatarUrl}
              />
            </TabsContent>

            <TabsContent value="history">
              <UsageHistory isAuthenticated={true} />
            </TabsContent>

            <TabsContent value="configuration">
              <ApiSettings />
            </TabsContent>
          </Tabs>

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
          authService.invalidateCache();
          window.location.reload();
        }}
      />
    </PageShell>
  );
};
