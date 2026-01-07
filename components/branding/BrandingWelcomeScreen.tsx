import React, { useState } from 'react';
import { GridDotsBackground } from '../ui/GridDotsBackground';
import { BrandingChatInput } from './BrandingChatInput';
import { useTranslation } from '../../hooks/useTranslation';
import { useLayout } from '../../hooks/useLayout';
import { useTheme } from '../../hooks/useTheme';
import { getTotalBrandingCredits } from '../../utils/creditCalculator';
import { InteractiveASCIICopy } from '../ui/InteractiveASCIICopy';
import { toast } from 'sonner';
import { AuthModal } from '../AuthModal';

interface BrandingWelcomeScreenProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onStart: () => void;
  isGenerating?: boolean;
}

export const BrandingWelcomeScreen: React.FC<BrandingWelcomeScreenProps> = ({
  prompt,
  onPromptChange,
  onStart,
  isGenerating = false,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isAuthenticated, isCheckingAuth, subscriptionStatus, onCreditPackagesModalOpen } = useLayout();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleStart = async () => {
    if (!prompt.trim()) {
      toast.error(t('branding.errors.enterBrandDescription'));
      return;
    }

    if (isCheckingAuth || isAuthenticated === null) {
      return;
    }

    if (isAuthenticated === false) {
      setShowAuthModal(true);
      return;
    }

    const hasCredits = (subscriptionStatus?.totalCredits || 0) > 0;
    if (!hasCredits) {
      toast.error(t('branding.errors.insufficientCredits'));
      onCreditPackagesModalOpen();
      return;
    }

    onStart();
  };

  return (
    <>
      <div
        className={`relative min-h-screen flex items-center justify-center p-6 overflow-hidden pt-16 md:pt-20 transition-all duration-300 ${theme === 'dark'
          }`}
      >
        <div className="absolute inset-0 z-0">
          <GridDotsBackground opacity={theme === 'dark' ? 0.02 : 0.05} />
          <InteractiveASCIICopy isDarkMode={true} fullHeight={true} color="brand-cyan" />
        </div>
        <div className="relative z-10 max-w-2xl w-full text-center space-y-8 animate-fade-in">
          <div className="space-y-4">
            <h1 className={`text-2xl md:text-3xl font-regular font-mono tracking-wider flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'
              }`}>
              BRANDING MACHINE® <span className="text-brand-cyan text-sm">v1.0</span>
            </h1>
          </div>

          <div className="w-full animate-fade-in-down">
            <div className={`rounded-xl p-6 md:p-8 space-y-6 transition-all duration-300 ${theme === 'dark'
              ? 'bg-card/30 backdrop-blur-sm'
              : 'bg-card/50 backdrop-blur-sm'
              }`}>
              <div className="text-center">
                <h2 className={`text-xl md:text-2xl font-semibold mb-2 normal-case ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'
                  }`}>
                  {t('branding.describeYourBrand')}
                </h2>
                <p className={`text-sm md:text-base normal-case ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                  }`}>
                  {t('branding.describeYourBrandDescription')}
                </p>
              </div>

              <BrandingChatInput
                promptPreview={prompt}
                onPromptChange={onPromptChange}
                creditsRequired={getTotalBrandingCredits()}
                onGenerateClick={handleStart}
                isGenerating={isGenerating}
                isGeneratingPrompt={false}
                isGenerateDisabled={!prompt.trim() || isGenerating || isCheckingAuth}
                isPromptReady={!!prompt.trim()}
              />
            </div>
          </div>
        </div>
      </div>

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
          }}
          onSuccess={() => {
            setShowAuthModal(false);
            if (prompt.trim()) {
              setTimeout(() => {
                handleStart();
              }, 500);
            }
          }}
          isSignUp={isSignUp}
          setIsSignUp={setIsSignUp}
        />
      )}
    </>
  );
};

