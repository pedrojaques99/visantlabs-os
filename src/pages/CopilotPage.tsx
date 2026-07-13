import React, { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Zap, Lock, Image as ImageIcon, ClipboardList, Figma } from 'lucide-react';
import { toast } from 'sonner';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { ChatShell, type ChatShellStrings } from '@/components/shared/chat/ChatShell';
import { copilotChatApi } from '@/services/adminChatApi';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/ui/glass';
import { useInAppShell } from '@/components/shell/InAppShellContext';

/**
 * Preview travado para free users — mostra o produto em vez de um 403 seco
 * (paywall que vende, plano §1.9). Reusa o fluxo de assinatura existente
 * via onSubscriptionModalOpen; visual segue os cards do AppsPage.
 */
const CopilotLockedPreview: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, onSubscriptionModalOpen } = useLayout();

  const capabilities = [
    {
      icon: ImageIcon,
      title: t('copilot.locked.capabilityMockupsTitle'),
      desc: t('copilot.locked.capabilityMockupsDesc'),
    },
    {
      icon: ClipboardList,
      title: t('copilot.locked.capabilityPlanTitle'),
      desc: t('copilot.locked.capabilityPlanDesc'),
    },
    {
      icon: Figma,
      title: t('copilot.locked.capabilityFigmaTitle'),
      desc: t('copilot.locked.capabilityFigmaDesc'),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8 text-center">
        <div className="w-16 h-16 rounded-2xl border border-neutral-800 bg-neutral-900 flex items-center justify-center">
          <Zap size={28} className="text-brand-cyan" />
        </div>

        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan uppercase tracking-wider">
            <Lock size={10} />
            {t('copilot.locked.badge')}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t('copilot.title')}</h1>
          <p className="text-sm text-neutral-400 leading-relaxed max-w-md mx-auto">
            {t('copilot.locked.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          {capabilities.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className={cn('rounded-2xl p-5 text-left space-y-3', glassSurface.panel)}
            >
              <div className="p-2 rounded-xl bg-white/5 border border-neutral-800 w-fit">
                <Icon size={16} className="text-neutral-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-neutral-200">{title}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {!isAuthenticated ? (
            <Button variant="surface" size="sm" onClick={() => navigate('/login')}>
              {t('auth.signIn')}
            </Button>
          ) : (
            <Button variant="surface" size="sm" onClick={() => onSubscriptionModalOpen()}>
              {t('copilot.locked.cta')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/pricing')}>
            {t('premium.seePlans')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const CopilotPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { hasAccess, isLoading } = usePremiumAccess();
  const { onSubscriptionModalOpen } = useLayout();
  // Prompt vindo do Cmd+K (ação agêntica) → semeia o input do Copilot.
  const [searchParams] = useSearchParams();
  const initialPrompt = searchParams.get('prompt') ?? undefined;
  // Dentro do AppShell o AppTopBar é o header: sem o offset pt-24 (do Header
  // antigo) e altura acompanha o <main>, não 100dvh. P (fix /copilot).
  const inShell = useInAppShell();

  const strings: ChatShellStrings = useMemo(
    () => ({
      sidebarLabel: t('copilot.title'),
      welcome: t('copilot.welcome'),
      newSession: t('copilot.newSession'),
      sessionLoaded: t('copilot.sessionLoaded'),
      selectSession: t('copilot.selectSession'),
      inputPlaceholder: t('copilot.inputPlaceholder'),
    }),
    [t]
  );

  const suggestions = useMemo(
    () => [
      t('copilot.suggestions.mockupKit'),
      t('copilot.suggestions.seasonalCampaign'),
      t('copilot.suggestions.figmaPiece'),
    ],
    [t]
  );

  // Assinatura pode expirar no meio da sessão — o backend responde 403
  // subscription_required; aqui viramos isso em upsell em vez de erro seco.
  const handleRequestError = useCallback(
    (error: unknown) => {
      const msg = error instanceof Error ? error.message : '';
      if (msg.toLowerCase().includes('subscription')) {
        toast.error(t('copilot.subscriptionExpired'));
        onSubscriptionModalOpen();
        return true;
      }
      return false;
    },
    [onSubscriptionModalOpen, t]
  );

  return (
    <div
      className={cn(
        'w-full flex flex-col overflow-hidden',
        inShell ? 'h-full' : 'h-[100dvh]',
        theme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'
      )}
    >
      <SEO title={t('copilot.seoTitle')} description={t('copilot.seoDescription')} noindex={true} />

      <div
        className={cn(
          'flex-1 w-full h-full flex flex-col overflow-hidden',
          !inShell && 'pt-16 md:pt-20 lg:pt-24'
        )}
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <GlitchLoader />
          </div>
        ) : hasAccess ? (
          <ChatShell
            mode="inline"
            api={copilotChatApi}
            wsPath="/copilot/ws"
            sessionsQueryKey="copilot-sessions"
            feature="copilot"
            sidebarIcon={<Zap className="h-4 w-4 text-brand-cyan" />}
            strings={strings}
            suggestions={suggestions}
            initialInput={initialPrompt}
            onRequestError={handleRequestError}
          />
        ) : (
          <CopilotLockedPreview />
        )}
      </div>
    </div>
  );
};

export default CopilotPage;
