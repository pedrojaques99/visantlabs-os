import React, { useState, useEffect } from 'react';
import { UserPlus, Heart, Plus, Info, Globe } from '@/lib/ui/icons';
import { useLocation } from 'react-router-dom';
import { AuthButton } from './AuthButton';
import { AuthModal } from './AuthModal';
import { ConfirmationModal } from './ConfirmationModal';
import { Button } from './ui/button';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { authService } from '../services/authService';
import { mockupApi } from '../services/mockupApi';
import { clearMockupState } from '@/utils/mockupStatePersistence';
import type { SubscriptionStatus } from '../services/subscriptionService';

interface HeaderProps {
  subscriptionStatus: SubscriptionStatus | null;
  onPricingClick: () => void;
  onJoinClick: () => void;
  onLogoClick: () => void;
  onMockupsClick?: () => void;
  onCreditsClick?: () => void;
  onCreateNewMockup?: () => void;
  onMyOutputsClick?: () => void;
  onLogoClickWithReset?: () => void;
  getUnsavedOutputsInfo?: () => {
    hasUnsaved: boolean;
    count: number;
    onSaveAll?: () => Promise<void>;
  } | null;
  navigateToHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  subscriptionStatus,
  onPricingClick,
  onJoinClick,
  onLogoClick,
  onMockupsClick,
  onCreditsClick,
  onCreateNewMockup,
  onMyOutputsClick,
  onLogoClickWithReset,
  getUnsavedOutputsInfo,
  navigateToHome,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const isOnWelcomeScreen = location.pathname === '/' || location.pathname === '/mockupmachine';
  // Try to get layout context, but don't fail if not available
  let isAuthenticated: boolean | null = null;
  try {
    const layout = useLayout();
    isAuthenticated = layout.isAuthenticated;
  } catch (error) {
    // If useLayout fails, we'll use authService directly as fallback
    if (typeof window !== 'undefined') {
      const token = authService.getToken();
      isAuthenticated = !!token;
    }
  }
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [unsavedWarningConfig, setUnsavedWarningConfig] = useState<{
    count: number;
    onSaveAll?: () => Promise<void>;
    onConfirm: () => void;
  } | null>(null);

  // Load saved mockups count
  useEffect(() => {
    const loadSavedCount = async () => {
      if (!isAuthenticated) {
        setSavedCount(null);
        return;
      }

      try {
        const mockups = await mockupApi.getAll();
        setSavedCount(Array.isArray(mockups) ? mockups.length : 0);
      } catch {
        // Falha de leitura = contagem desconhecida, não "zero salvos".
        setSavedCount(null);
      }
    };

    if (isAuthenticated) {
      loadSavedCount();
      // Refresh count every 30 seconds
      const interval = setInterval(loadSavedCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogoClick = () => {
    // Check for unsaved outputs if handlers are available
    if (getUnsavedOutputsInfo && onLogoClickWithReset && navigateToHome) {
      const unsavedInfo = getUnsavedOutputsInfo();
      if (unsavedInfo?.hasUnsaved) {
        // Show confirmation modal
        setUnsavedWarningConfig({
          count: unsavedInfo.count,
          onSaveAll: unsavedInfo.onSaveAll,
          onConfirm: () => {
            clearMockupState();
            onLogoClickWithReset();
            navigateToHome();
            setShowUnsavedWarning(false);
            setUnsavedWarningConfig(null);
          },
        });
        setShowUnsavedWarning(true);
        return; // Don't call onLogoClick, we're handling it
      }
    }
    // No unsaved outputs or handlers not available - call original onLogoClick
    onLogoClick();
  };

  const handleNewMockupClick = () => {
    // If we have info about unsaved outputs, warn before starting a new mockup
    if (getUnsavedOutputsInfo) {
      const unsavedInfo = getUnsavedOutputsInfo();
      if (unsavedInfo?.hasUnsaved && onCreateNewMockup) {
        setUnsavedWarningConfig({
          count: unsavedInfo.count,
          onSaveAll: unsavedInfo.onSaveAll,
          onConfirm: () => {
            clearMockupState();
            onCreateNewMockup();
            setShowUnsavedWarning(false);
            setUnsavedWarningConfig(null);
          },
        });
        setShowUnsavedWarning(true);
        return;
      }
    }

    // Default behaviour: delegate to onCreateNewMockup or navigate home
    if (onCreateNewMockup) {
      onCreateNewMockup();
    } else if (navigateToHome) {
      navigateToHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-10 md:h-14 bg-background/95 border-b border-border flex items-center justify-between px-2 md:px-6 z-50">
      <Button
        variant="ghost"
        onClick={handleLogoClick}
        className="flex items-center gap-1.5 md:gap-2.5 hover:opacity-80 transition-opacity group cursor-pointer"
      >
        <img
          src="/logo-vsn-labs.png"
          alt="VSN Labs"
          className="h-5 md:h-7 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
        />
        <div className="hidden sm:flex items-baseline gap-1.5">
          <span className="text-xs md:text-sm text-muted-foreground">Visant Labs®</span>
          <span className="text-2xs font-mono text-muted-foreground">v1.1</span>
        </div>
      </Button>
      <div className="flex items-center gap-1.5 md:gap-4">
        {!isOnWelcomeScreen && (
          <Button
            onClick={handleNewMockupClick}
            variant="outline"
            size="sm"
            className="text-2xs md:text-xs text-muted-foreground hover:text-foreground border-border hover:border-border-hover hover:bg-accent"
            aria-label={t('header.createNewMockup')}
          >
            <Plus size={12} className="md:w-3.5 md:h-3.5" />
            <span className="hidden sm:inline">{t('header.createNewMockup')}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            window.history.pushState({}, '', '/community');
            const popStateEvent = new PopStateEvent('popstate', { state: {} });
            window.dispatchEvent(popStateEvent);
          }}
          className="p-1.5 md:p-2 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-accent cursor-pointer"
          title={t('header.communityMockups')}
          aria-label={t('header.communityMockups')}
        >
          <Globe size={14} className="md:w-4 md:h-4" strokeWidth={2} />
        </Button>
        {isOnWelcomeScreen && (
          <Button
            variant="ghost"
            onClick={() => {
              window.history.pushState({}, '', '/about');
              const popStateEvent = new PopStateEvent('popstate', { state: {} });
              window.dispatchEvent(popStateEvent);
            }}
            className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-2xs md:text-xs text-muted-foreground hover:text-foreground transition-colors rounded border border-border hover:border-border-hover hover:bg-accent cursor-pointer"
            aria-label={t('header.about')}
          >
            <Info size={12} className="md:w-3.5 md:h-3.5" />
            <span className="hidden sm:inline">{t('header.about')}</span>
          </Button>
        )}
        {isAuthenticated === false && (
          <Button
            variant="ghost"
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-0.5 md:gap-1.5 p-1.5 md:px-3 md:py-1.5 bg-brand-cyan/20 text-foreground rounded-md border border-border hover:border-border-hover hover:bg-brand-cyan/30 text-2xs md:text-xs transition-colors cursor-pointer"
          >
            <UserPlus size={11} className="md:w-[14px] md:h-[14px]" />
            <span className="hidden sm:inline">{t('header.register')}</span>
          </Button>
        )}
        {isAuthenticated && onMyOutputsClick && (
          <Button
            variant="ghost"
            onClick={onMyOutputsClick}
            className="relative p-1.5 md:p-2 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-accent cursor-pointer"
            title={t('header.saved')}
            aria-label={t('header.saved')}
          >
            <Heart size={14} className="md:w-4 md:h-4" strokeWidth={2} />
            {savedCount !== null && savedCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 bg-muted text-muted-foreground text-2xs font-medium tabular-nums px-0.5 md:px-1 py-0 md:py-0.5 rounded-md min-w-[14px] md:min-w-[16px] text-center">
                {savedCount > 99 ? '99+' : savedCount}
              </span>
            )}
          </Button>
        )}
        <AuthButton subscriptionStatus={subscriptionStatus} onCreditsClick={onCreditsClick} />
      </div>

      {showRegisterModal && (
        <AuthModal
          isOpen={showRegisterModal}
          onClose={() => {
            setShowRegisterModal(false);
          }}
          onSuccess={() => {
            window.location.reload();
          }}
          defaultIsSignUp={true}
        />
      )}

      {showUnsavedWarning && unsavedWarningConfig && (
        <ConfirmationModal
          isOpen={showUnsavedWarning}
          onClose={() => {
            setShowUnsavedWarning(false);
            setUnsavedWarningConfig(null);
          }}
          onConfirm={unsavedWarningConfig.onConfirm}
          onSaveAll={unsavedWarningConfig.onSaveAll}
          title={t('messages.unsavedOutputsTitle')}
          message={t('messages.unsavedOutputsMessage', {
            count: unsavedWarningConfig.count,
            plural: unsavedWarningConfig.count > 1 ? 's' : '',
          })}
          confirmText={t('messages.resetAnyway')}
          cancelText={t('common.cancel')}
          variant="warning"
          showSaveAll={!!unsavedWarningConfig.onSaveAll}
        />
      )}
    </header>
  );
};
