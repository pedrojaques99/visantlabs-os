import React, { useState, useEffect } from 'react';
import { UserPlus, Heart, Sun, Moon, FilePenLine, Plus, Search, Info, Globe } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { AuthButton } from './AuthButton';
import { AuthModal } from './AuthModal';
import { ConfirmationModal } from './ConfirmationModal';
import { Button } from './ui/button';
import { useTheme } from '../hooks/useTheme';
import { useLayout } from '../hooks/useLayout';
import { useTranslation } from '../hooks/useTranslation';
import { authService } from '../services/authService';
import { mockupApi } from '../services/mockupApi';
import { clearMockupState } from '../utils/mockupStatePersistence';
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
  onMyBrandingsClick?: () => void;
  onLogoClickWithReset?: () => void;
  getUnsavedOutputsInfo?: () => { hasUnsaved: boolean; count: number; onSaveAll?: () => Promise<void> } | null;
  navigateToHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ subscriptionStatus, onPricingClick, onJoinClick, onLogoClick, onMockupsClick, onCreditsClick, onCreateNewMockup, onMyOutputsClick, onMyBrandingsClick, onLogoClickWithReset, getUnsavedOutputsInfo, navigateToHome }) => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const isOnWelcomeScreen = location.pathname === '/';
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
  const [brandingsCount, setBrandingsCount] = useState<number | null>(null);
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
      } catch (error) {
        setSavedCount(0);
      }
    };

    if (isAuthenticated) {
      loadSavedCount();
      // Refresh count every 30 seconds
      const interval = setInterval(loadSavedCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Load saved brandings count
  useEffect(() => {
    const loadBrandingsCount = async () => {
      if (!isAuthenticated) {
        setBrandingsCount(null);
        return;
      }

      try {
        const { brandingApi } = await import('../services/brandingApi');
        const brandings = await brandingApi.getAll();
        setBrandingsCount(Array.isArray(brandings) ? brandings.length : 0);
      } catch (error) {
        setBrandingsCount(0);
      }
    };

    if (isAuthenticated) {
      loadBrandingsCount();
      // Refresh count every 30 seconds
      const interval = setInterval(loadBrandingsCount, 30000);
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
          }
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
          }
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
    <header className="fixed top-0 left-0 right-0 h-10 md:h-14 bg-black/95 backdrop-blur-[2px] border-b border-black/95 flex items-center justify-between px-2 md:px-6 z-50">
      <button
        onClick={handleLogoClick}
        className="flex items-center gap-1.5 md:gap-2.5 hover:opacity-80 transition-opacity group cursor-pointer"
      >
        <img
          src="/logo-vsn-labs.png"
          alt="VSN Labs"
          className="h-5 md:h-7 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
        />
        <div className="hidden sm:flex items-baseline gap-1.5">
          <span className="text-xs md:text-sm font-mono text-zinc-500 uppercase">Visant Labs®</span>
          <span className="text-[10px] font-mono text-zinc-600">v1.1</span>
        </div>
      </button>
      <div className="flex items-center gap-1.5 md:gap-4">
        {/* Pricing button hidden */}
        {/* <button
          onClick={onPricingClick}
          className="hidden md:block text-[11px] md:text-xs font-mono text-zinc-500 hover:text-zinc-400 transition-colors tracking-wider uppercase"
        >
          {t('header.pricing')}
        </button> */}
        {/* Mockup Machine button hidden */}
        {/* <button
          onClick={() => {
            if (navigateToHome) {
              navigateToHome();
            } else {
              window.location.href = '/';
            }
          }}
          className="p-1.5 md:px-3 md:py-1.5 text-zinc-500 hover:text-brand-cyan transition-colors rounded border border-zinc-800/50 hover:border-[brand-cyan]/30 cursor-pointer"
          title="Mockup Machine"
          aria-label="Go to Mockup Machine"
        >
          <Pickaxe size={14} className="md:w-4 md:h-4" />
        </button> */}
        {/* New Mockup button - hidden on WelcomeScreen */}
        {!isOnWelcomeScreen && (
          <Button
            onClick={handleNewMockupClick}
            variant="outline"
            size="sm"
            className="text-[10px] md:text-xs font-mono text-zinc-400 hover:text-brand-cyan border-zinc-700/30 hover:border-[brand-cyan]/50 hover:bg-zinc-800/30"
            title="New Mockup"
            aria-label="Create new mockup"
          >
            <Plus size={12} className="md:w-3.5 md:h-3.5" />
            <span className="hidden sm:inline">New Mockup</span>
          </Button>
        )}
        {/* Explore Mockups button */}
        {/* Explore Mockups button - hidden */}
        {/* <button
          onClick={() => {
            window.history.pushState({}, '', '/mockups');
            const popStateEvent = new PopStateEvent('popstate', { state: {} });
            window.dispatchEvent(popStateEvent);
          }}
          className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-mono text-zinc-400 hover:text-brand-cyan transition-colors rounded border border-zinc-700/30 hover:border-[brand-cyan]/50 hover:bg-zinc-800/30 cursor-pointer"
          title="Explore Mockups"
          aria-label="Explore mockups"
        >
          <Search size={12} className="md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">{t('welcome.exploreMockups')}</span>
        </button> */}
        {/* Community button */}
        <button
          onClick={() => {
            window.history.pushState({}, '', '/community');
            const popStateEvent = new PopStateEvent('popstate', { state: {} });
            window.dispatchEvent(popStateEvent);
          }}
          className="p-1.5 md:p-2 text-zinc-500 hover:text-brand-cyan transition-colors rounded hover:bg-zinc-800/30 cursor-pointer"
          title="Community"
          aria-label="Community"
        >
          <Globe size={14} className="md:w-4 md:h-4" strokeWidth={2} />
        </button>
        {/* About button - only on WelcomeScreen */}
        {isOnWelcomeScreen && (
          <button
            onClick={() => {
              window.history.pushState({}, '', '/about');
              const popStateEvent = new PopStateEvent('popstate', { state: {} });
              window.dispatchEvent(popStateEvent);
            }}
            className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-mono text-zinc-400 hover:text-brand-cyan transition-colors rounded border border-zinc-700/30 hover:border-[brand-cyan]/50 hover:bg-zinc-800/30 cursor-pointer"
            title="About"
            aria-label="About"
          >
            <Info size={12} className="md:w-3.5 md:h-3.5" />
            <span className="hidden sm:inline">{t('about.title') || 'About'}</span>
          </button>
        )}
        {/* Temporarily hidden */}
        {/* <button
          onClick={() => {
            window.location.href = '/branding-machine';
          }}
          className="hidden md:block text-[11px] md:text-xs font-mono text-zinc-500 hover:text-zinc-400 transition-colors tracking-wider uppercase"
        >
          Branding
        </button> */}
        {/* Budget Machine temporarily hidden */}
        {/* <button
          onClick={() => {
            window.location.href = '/budget-machine';
          }}
          className="hidden md:block text-[11px] md:text-xs font-mono text-zinc-500 hover:text-zinc-400 transition-colors tracking-wider uppercase"
        >
          Budget
        </button> */}
        {isAuthenticated === false && (
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-0.5 md:gap-1.5 p-1.5 md:px-3 md:py-1.5 bg-brand-cyan/20 text-brand-cyan rounded-md border border-[brand-cyan]/30 hover:border-[brand-cyan]/50 hover:bg-brand-cyan/30 text-[10px] md:text-xs font-mono transition-colors cursor-pointer"
          >
            <UserPlus size={11} className="md:w-[14px] md:h-[14px]" />
            <span className="hidden sm:inline">Register</span>
          </button>
        )}
        {isAuthenticated && onMyOutputsClick && (
          <button
            onClick={onMyOutputsClick}
            className="relative p-1.5 md:p-2 text-zinc-500 hover:text-brand-cyan transition-colors rounded hover:bg-zinc-800/30 cursor-pointer"
            title="Saved"
            aria-label="View saved outputs"
          >
            <Heart size={14} className="md:w-4 md:h-4" strokeWidth={2} />
            {savedCount !== null && savedCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 bg-zinc-800/40 text-zinc-400 text-[8px] md:text-[9px] font-mono font-medium px-0.5 md:px-1 py-0 md:py-0.5 rounded-md min-w-[14px] md:min-w-[16px] text-center">
                {savedCount > 99 ? '99+' : savedCount}
              </span>
            )}
          </button>
        )}
        {/* My Branding Projects button hidden */}
        {/* {isAuthenticated && onMyBrandingsClick && (
          <button
            onClick={onMyBrandingsClick}
            className="relative p-1.5 md:p-2 text-zinc-500 hover:text-brand-cyan transition-colors rounded hover:bg-zinc-800/30"
            title="My Branding Projects"
            aria-label="View my branding projects"
          >
            <FilePenLine size={14} className="md:w-4 md:h-4" strokeWidth={2} />
            {brandingsCount !== null && brandingsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 bg-zinc-800/40 text-zinc-400 text-[8px] md:text-[9px] font-mono font-medium px-0.5 md:px-1 py-0 md:py-0.5 rounded-md min-w-[14px] md:min-w-[16px] text-center">
                {brandingsCount > 99 ? '99+' : brandingsCount}
              </span>
            )}
          </button>
        )} */}
        <AuthButton subscriptionStatus={subscriptionStatus} onCreditsClick={onCreditsClick} />
        {/* Theme button hidden */}
        {/* <button
          onClick={() => {
            toggleTheme();
            window.location.reload();
          }}
          className="flex items-center justify-center p-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-mono text-zinc-500 hover:text-zinc-400 transition-colors rounded border border-zinc-800/50 hover:border-zinc-700 cursor-pointer"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun size={11} className="md:w-3 md:h-3" />
          ) : (
            <Moon size={11} className="md:w-3 md:h-3" />
          )}
        </button> */}
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
          message={t('messages.unsavedOutputsMessage', { count: unsavedWarningConfig.count, plural: unsavedWarningConfig.count > 1 ? 's' : '' })}
          confirmText={t('messages.resetAnyway')}
          cancelText={t('common.cancel')}
          variant="warning"
          showSaveAll={!!unsavedWarningConfig.onSaveAll}
        />
      )}
    </header>
  );
};


