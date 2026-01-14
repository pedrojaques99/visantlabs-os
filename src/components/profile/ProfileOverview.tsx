import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Camera, CreditCard, ExternalLink, Share2, Copy, Heart, Users, HardDrive, Plus, ArrowRight, UserCog } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { type User as UserType } from '@/services/authService';
import { type SubscriptionStatus } from '@/services/subscriptionService';
import { referralService, type ReferralStats } from '@/services/referralService';
import { toast } from 'sonner';
import { GlitchLoader } from '@/components/ui/GlitchLoader';

interface ProfileOverviewProps {
    user: UserType;
    subscriptionStatus: SubscriptionStatus | null;
    referralStats: ReferralStats | null;
    isLoadingReferral: boolean;
    onRefreshUserData: () => void;
    onManageSubscription: () => void;
    onBuyCredits: () => void;
    onViewTransactions: () => void;
    onEditProfile: () => void;
    isUploadingPicture?: boolean;
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    avatarUrl: string;
}

export const ProfileOverview: React.FC<ProfileOverviewProps> = ({
    user,
    subscriptionStatus,
    referralStats,
    isLoadingReferral,
    onManageSubscription,
    onBuyCredits,
    onViewTransactions,
    onEditProfile,
    isUploadingPicture = false,
    onFileUpload,
    avatarUrl
}) => {
    const { t } = useTranslation();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [storageUsage, setStorageUsage] = useState<{
        used: number;
        limit: number;
        remaining: number;
        percentage: number;
        formatted: { used: string; limit: string; remaining: string };
    } | null>(null);
    const [isLoadingStorage, setIsLoadingStorage] = useState(false);

    // Load storage usage
    useEffect(() => {
        const loadStorage = async () => {
            setIsLoadingStorage(true);
            try {
                const token = localStorage.getItem('auth_token');
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
        };
        loadStorage();
    }, []);

    const handleCopyReferralLink = async () => {
        if (!referralStats?.referralCode) {
            toast.error(t('referral.noCode') || 'Código de indicação não disponível');
            return;
        }

        const referralLink = referralService.getReferralLink(referralStats.referralCode);

        try {
            await navigator.clipboard.writeText(referralLink);
            toast.success(t('referral.linkCopied') || 'Link de indicação copiado!');
        } catch (err) {
            console.error('Failed to copy link:', err);
            toast.error(t('referral.copyFailed') || 'Falha ao copiar link');
        }
    };

    const handlePictureClick = () => {
        fileInputRef.current?.click();
    };

    const referralLink = referralStats?.referralCode
        ? referralService.getReferralLink(referralStats.referralCode)
        : '';

    const totalCreditsAvailable = subscriptionStatus
        ? typeof subscriptionStatus.totalCredits === 'number'
            ? subscriptionStatus.totalCredits
            : (subscriptionStatus.totalCreditsEarned ?? 0) + (subscriptionStatus.creditsRemaining ?? 0)
        : 0;

    const hasActiveSubscription = Boolean(subscriptionStatus?.hasActiveSubscription);

    // Helper function to format dates
    const formatFriendlyDate = (dateString: string | Date): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    return (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in duration-500">
            {/* Container 1: Profile Info - Top Left */}
            <section className="bg-neutral-900 border border-neutral-800/50 rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-lg shadow-black/20">
                <div className="flex flex-col items-center gap-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={onFileUpload}
                        disabled={isUploadingPicture}
                        className="hidden"
                    />
                    <div
                        className="relative w-28 h-28 rounded-2xl bg-[#0C0C0C] border border-neutral-800 focus-within:ring-2 ring-brand-cyan/20 overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition-all duration-300 group shadow-lg"
                        onClick={handlePictureClick}
                        title={t('profile.uploadPicture') || 'Clique para enviar foto'}
                    >
                        {isUploadingPicture ? (
                            <GlitchLoader size={32} />
                        ) : avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={user.name || t('profile.title')}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        ) : (
                            <User size={48} className="text-neutral-700" />
                        )}
                        <span className="absolute bottom-2 right-2 bg-brand-cyan text-black rounded-lg p-1.5 shadow-lg shadow-brand-cyan/20 group-hover:bg-brand-cyan/90 transition-all hover:scale-110">
                            <Camera size={14} />
                        </span>
                    </div>
                    <div className="text-center space-y-1">
                        <h2 className="text-2xl font-bold text-white font-manrope tracking-tight">
                            {user.name || t('profile.name') || 'Seu nome'}
                        </h2>
                        <p className="text-sm text-neutral-500 font-mono">{user.email}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 mt-2">
                    <button
                        onClick={onEditProfile}
                        className="w-full px-4 py-2.5 bg-neutral-900/50 hover:bg-neutral-900 text-neutral-300 border border-neutral-800/50 hover:border-neutral-700 rounded-xl text-sm font-mono transition flex items-center justify-between group cursor-pointer font-medium"
                    >
                        <div className="flex items-center gap-3">
                            <UserCog size={16} strokeWidth={2} className="group-hover:text-brand-cyan transition-colors" />
                            <span>{t('profile.edit') || 'Editar perfil'}</span>
                        </div>
                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </button>

                    {user && (user.id || user.email) && (
                        <Link
                            to={`/profile/${user.username || user.id}`}
                            className="w-full px-4 py-2.5 bg-neutral-900/50 hover:bg-neutral-900 text-neutral-300 border border-neutral-800/50 hover:border-neutral-700 rounded-xl text-sm font-mono transition flex items-center justify-between group cursor-pointer font-medium"
                        >
                            <div className="flex items-center gap-3">
                                <ExternalLink size={16} strokeWidth={2} className="group-hover:text-brand-cyan transition-colors" />
                                <span>{t('profile.viewPublicProfile') || 'Ver Perfil Público'}</span>
                            </div>
                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                        </Link>
                    )}

                    <div className="flex flex-col gap-3 pt-2">
                        <Link
                            to="/my-outputs"
                            className="w-full px-4 py-2.5 bg-neutral-900/50 hover:bg-neutral-900 text-neutral-300 border border-neutral-800/50 hover:border-neutral-700 rounded-xl text-sm font-mono transition flex items-center justify-between group cursor-pointer font-medium"
                        >
                            <div className="flex items-center gap-3">
                                <Heart size={16} strokeWidth={2} className="group-hover:text-brand-cyan transition-colors" />
                                <span>{t('profile.myMockups') || 'Meus Mockups'}</span>
                            </div>
                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                        </Link>
                        <Link
                            to="/community"
                            className="w-full px-4 py-2.5 bg-neutral-900/50 hover:bg-neutral-900 text-neutral-300 border border-neutral-800/50 hover:border-neutral-700 rounded-xl text-sm font-mono transition flex items-center justify-between group cursor-pointer font-medium"
                        >
                            <div className="flex items-center gap-3">
                                <Users size={16} strokeWidth={2} className="group-hover:text-brand-cyan transition-colors" />
                                <span>{t('communityPresets.title') || 'Presets da Comunidade'}</span>
                            </div>
                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Container 2: Credits & Stats - Top Right */}
            <section className="bg-neutral-900 border border-neutral-800/50 rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-lg shadow-black/20">
                <div className="flex items-center gap-3 border-b border-neutral-800/50 pb-4">
                    <div className="p-2 bg-brand-cyan/10 rounded-lg">
                        <CreditCard size={20} className="text-brand-cyan" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-neutral-100 font-redhatmono">
                            {t('credits.title') || 'CRÉDITOS'}
                        </h3>
                    </div>
                </div>

                {subscriptionStatus ? (
                    <>
                        <div className="space-y-4 flex-1">
                            <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 relative overflow-hidden group">
                                {/* Buy Credits Button in Top Right */}
                                <div className="absolute top-4 right-4 z-20">
                                    <button
                                        onClick={onBuyCredits}
                                        className="p-2 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/20 hover:border-brand-cyan/40 text-brand-cyan rounded-lg transition-all flex items-center gap-2 group-hover:scale-105"
                                        title={t('credits.buyCredits') || "Comprar Créditos"}
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <p className="text-xs text-neutral-500 font-mono mb-1 uppercase tracking-wider">
                                    {t('credits.available') || 'DISPONÍVEIS'}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-4xl font-bold text-white font-mono tracking-tight">
                                        {totalCreditsAvailable}
                                    </p>
                                    <span className="text-xs text-brand-cyan font-mono bg-brand-cyan/10 px-2 py-0.5 rounded-full border border-brand-cyan/20">{t('credits.active') || 'Ativo'}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-3">
                                    <p className="text-[10px] text-neutral-500 font-mono uppercase mb-1">{t('profile.totalCreditsUsed') || 'USADOS'}</p>
                                    <p className="text-lg font-bold text-neutral-300 font-mono">{subscriptionStatus.creditsUsed ?? 0}</p>
                                </div>
                                {/* Storage Usage - Compact */}
                                {isLoadingStorage ? (
                                    <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-3 flex items-center justify-center">
                                        <GlitchLoader size={16} />
                                    </div>
                                ) : storageUsage ? (
                                    <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-3">
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <HardDrive size={10} className="text-neutral-500" />
                                                <p className="text-[10px] text-neutral-500 font-mono uppercase">{t('credits.storage') || 'STORAGE'}</p>
                                            </div>
                                            <p className="text-[10px] text-brand-cyan font-mono">{storageUsage.percentage.toFixed(0)}%</p>
                                        </div>
                                        <div className="w-full bg-neutral-800 rounded-full h-1.5 mb-1">
                                            <div className="bg-brand-cyan h-1.5 rounded-full transition-all" style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}></div>
                                        </div>
                                        <p className="text-[10px] text-neutral-400 font-mono">{storageUsage.formatted.used} / {storageUsage.formatted.limit}</p>
                                    </div>
                                ) : <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-3"></div>}
                            </div>

                            {subscriptionStatus.creditsResetDate && (
                                <div className="text-center pt-2">
                                    <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">
                                        {subscriptionStatus.hasActiveSubscription
                                            ? t('credits.renews', {
                                                date: formatFriendlyDate(subscriptionStatus.creditsResetDate),
                                            })
                                            : t('credits.resets', {
                                                date: formatFriendlyDate(subscriptionStatus.creditsResetDate),
                                            })}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                onClick={onViewTransactions}
                                className="w-full px-4 py-2.5 bg-neutral-900/50 hover:bg-neutral-900 text-neutral-300 border border-neutral-800/50 hover:border-neutral-700 rounded-xl text-sm font-mono transition text-center font-medium"
                            >
                                {t('profile.viewAllTransactions') || 'Transações'}
                            </button>
                            {hasActiveSubscription && subscriptionStatus?.subscriptionStatus !== 'free' && (
                                <button
                                    onClick={onManageSubscription}
                                    className="w-full px-4 py-2.5 bg-neutral-900/50 hover:bg-neutral-900 text-neutral-300 border border-neutral-800/50 hover:border-neutral-700 rounded-xl text-sm font-mono transition text-center flex items-center justify-center gap-2 font-medium"
                                    title={t('profile.manageSubscription') || 'Gerenciar Assinatura'}
                                >
                                    <CreditCard size={14} />
                                    {t('profile.manageSubscription') || 'Gerenciar'}
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-4 py-12 flex-1">
                        <p className="text-sm text-neutral-400 font-mono text-center max-w-[200px]">
                            {t('profile.noSubscriptionData') || 'Dados de assinatura indisponíveis.'}
                        </p>
                    </div>
                )}
            </section>

            {/* Container 3: Referral Program - Bottom Span */}
            <section className="bg-neutral-900 border border-neutral-800/50 rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-lg shadow-black/20">
                <div className="flex items-center gap-3 border-b border-neutral-800/50 pb-4">
                    <div className="p-2 bg-brand-cyan/10 rounded-lg">
                        <Share2 size={20} className="text-brand-cyan" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-neutral-100 font-redhatmono">
                            {t('referral.title') || 'INDICAÇÃO'}
                        </h3>
                    </div>
                </div>

                {referralStats ? (
                    <>
                        <div className="space-y-4 flex-1">
                            <div className="bg-transparent rounded-xl p-0">
                                <p className="text-sm text-neutral-400 font-mono mb-6 leading-relaxed">
                                    {t('referral.description') || 'Compartilhe seu link e ganhe créditos bônus quando amigos entrarem.'}
                                </p>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-neutral-600 font-mono uppercase block tracking-widest">
                                        {t('referral.yourLink') || 'SEU LINK DE INDICAÇÃO'}
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1 group">
                                            <input
                                                type="text"
                                                value={referralLink}
                                                readOnly
                                                className="w-full px-3 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-neutral-400 group-hover:text-neutral-200 font-mono text-xs focus:outline-none focus:border-brand-cyan/30 transition pr-10"
                                            />
                                            <button
                                                onClick={handleCopyReferralLink}
                                                disabled={!referralStats.referralCode}
                                                className="absolute right-1 top-1 p-1 bg-neutral-800 hover:bg-brand-cyan/20 text-neutral-400 hover:text-brand-cyan rounded-md transition-colors"
                                            >
                                                {isLoadingReferral ? <GlitchLoader size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <div className="bg-neutral-900/20 border border-neutral-800/50 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                    <Users className="text-neutral-600 mb-2" size={20} />
                                    <p className="text-xl font-bold text-neutral-300 font-mono mb-1">
                                        {referralStats.referredUsersCount || 0}
                                    </p>
                                    <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-wide">
                                        {t('referral.friendsReferred') || 'AMIGOS INDICADOS'}
                                    </p>
                                </div>
                                <div className="bg-neutral-900/20 border border-neutral-800/50 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                    <CreditCard className="text-brand-cyan/50 mb-2" size={20} />
                                    <p className="text-xl font-bold text-brand-cyan font-mono mb-1">
                                        {referralStats.totalCreditsEarned || 0}
                                    </p>
                                    <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-wide">
                                        {t('referral.totalEarned') || 'TOTAL DE CRÉDITOS GANHOS'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 flex-1">
                        <GlitchLoader size={20} />
                        <p className="text-sm text-neutral-500 font-mono text-center">
                            {isLoadingReferral
                                ? t('common.loading') || 'Carregando...'
                                : t('referral.generating') || 'Gerando código...'}
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
};
