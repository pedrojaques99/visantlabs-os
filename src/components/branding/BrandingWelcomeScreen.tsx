import React, { useState } from 'react';
import { BrandingChatInput } from './BrandingChatInput';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { getTotalBrandingCredits } from '@/utils/creditCalculator';
import { toast } from 'sonner';
import { AuthModal } from '../AuthModal';
import { GlassPanel } from '@/components/ui/GlassPanel';

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
  const { isAuthenticated, isCheckingAuth, subscriptionStatus, onCreditPackagesModalOpen } =
    useLayout();
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
      <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden pt-16 md:pt-20">
        <div className="relative z-10 max-w-2xl w-full text-center space-y-8 animate-fade-in">
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              {t('branding.title')}
            </h1>
          </div>

          <div className="w-full animate-fade-in-down">
            <GlassPanel className="p-6 md:p-8 space-y-6 transition-colors duration-300">
              <div className="text-center">
                <h2 className="text-xl md:text-2xl font-semibold mb-2 normal-case text-foreground">
                  {t('branding.describeYourBrand')}
                </h2>
                <p className="text-sm md:text-base normal-case text-muted-foreground">
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
            </GlassPanel>
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
