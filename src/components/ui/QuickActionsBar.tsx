import React, { useState, useEffect } from 'react';
import { Dices, Shuffle } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { GlitchLoader } from './GlitchLoader';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';

interface QuickActionsBarProps {
  onSurpriseMe: () => void;
  isGenerating: boolean;
  isGeneratingPrompt: boolean;
  autoGenerate: boolean;
  onAutoGenerateChange: (value: boolean) => void;
  isSurpriseMeMode: boolean;
  onSurpriseMeModeChange: (value: boolean) => void;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  onSurpriseMe,
  isGenerating,
  isGeneratingPrompt,
  autoGenerate,
  onAutoGenerateChange,
  isSurpriseMeMode,
  onSurpriseMeModeChange,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    onSurpriseMe();

    // Reset animation after it completes
    setTimeout(() => {
      setIsAnimating(false);
    }, 800);
  };

  // Reset animation when prompt generation starts
  useEffect(() => {
    if (isGeneratingPrompt) {
      setIsAnimating(false);
    }
  }, [isGeneratingPrompt]);

  return (
    <div className="flex items-center py-2">
      <div className={`flex-grow border-t border-dashed ${theme === 'dark' ? 'border-neutral-700/50' : 'border-neutral-300/50'}`}></div>
      <div className="flex-shrink mx-2 flex flex-col items-center gap-2">
        <Tooltip content={isSurpriseMeMode ? t('mockup.surpriseMeModeActiveTooltip') : t('mockup.surpriseMeTooltip')} position="top">
          <button
            onClick={handleClick}
            disabled={isGenerating || isGeneratingPrompt}
            data-tutorial-target="surprise-me"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md border hover:border-brand-cyan/30 hover:bg-brand-cyan/10 hover:text-brand-cyan transition-all text-sm font-mono transform hover:scale-[1.02] active:scale-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-brand-cyan/10 cursor-pointer ${isAnimating ? 'dice-button-clicked' : ''} ${isSurpriseMeMode
              ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/50 shadow-brand-cyan/20'
              : theme === 'dark'
                ? 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50 shadow-black/20'
                : 'bg-neutral-100 text-neutral-700 border-neutral-300 shadow-neutral-200/20'
              }`}
          >
            {(isGeneratingPrompt || isAnimating) ? (
              <GlitchLoader size={16} color="currentColor" />
            ) : (
              <Dices size={16} />
            )}
            {t('mockup.surpriseMe')}
          </button>
        </Tooltip>
      </div>
      <div className={`flex-grow border-t border-dashed ${theme === 'dark' ? 'border-neutral-700/50' : 'border-neutral-300/50'}`}></div>
    </div>
  );
};
