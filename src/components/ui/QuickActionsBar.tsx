import React, { useState, useEffect } from 'react';
import { Dices, Settings } from 'lucide-react';
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
  onOpenSurpriseMeSettings?: () => void;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  onSurpriseMe,
  isGenerating,
  isGeneratingPrompt,
  autoGenerate,
  onAutoGenerateChange,
  onOpenSurpriseMeSettings,
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
        <Tooltip content={t('mockup.surpriseMeTooltip')} position="top">
          <button
            onClick={handleClick}
            disabled={isGenerating || isGeneratingPrompt}
            data-tutorial-target="surprise-me"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md border hover:border-[brand-cyan]/30 hover:bg-brand-cyan/10 hover:text-brand-cyan transition-all text-sm font-mono transform hover:scale-[1.02] active:scale-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-[brand-cyan]/10 cursor-pointer ${isAnimating ? 'dice-button-clicked' : ''} ${theme === 'dark'
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
        <div className="flex items-center gap-1.5">
          <Tooltip content={t('mockup.autoGenerateTooltip')} position="top">
            <div
              className={`group flex items-center gap-1.5 cursor-pointer opacity-40 hover:opacity-100 transition-opacity duration-200 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-500'}`}
              onClick={() => onAutoGenerateChange(!autoGenerate)}
            >
              <div className={`w-3 h-3 rounded-md flex items-center justify-center border transition-all duration-200 ${autoGenerate
                ? 'bg-brand-cyan/80 border-[brand-cyan] opacity-100'
                : theme === 'dark'
                  ? 'bg-neutral-700/50 border-neutral-600/50 group-hover:border-neutral-500 group-hover:bg-neutral-700'
                  : 'bg-white/50 border-neutral-400/50 group-hover:border-neutral-400 group-hover:bg-white'
                }`}>
                {autoGenerate && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <label className={`text-[10px] select-none cursor-pointer font-mono group-hover:text-[11px] transition-all ${theme === 'dark' ? 'text-neutral-500 group-hover:text-neutral-400' : 'text-neutral-500 group-hover:text-neutral-600'}`}>
                {t('mockup.autoGenerate')}
              </label>
            </div>
          </Tooltip>
          {onOpenSurpriseMeSettings && (
            <Tooltip content={t('mockup.surpriseMeSettingsTooltip') || 'Surprise Me Settings'} position="top">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSurpriseMeSettings();
                }}
                disabled={isGenerating || isGeneratingPrompt}
                className={`opacity-40 hover:opacity-100 transition-opacity duration-200 p-1 rounded hover:bg-neutral-800/50 disabled:opacity-30 disabled:cursor-not-allowed ${theme === 'dark' ? 'text-neutral-500 hover:text-neutral-400' : 'text-neutral-500 hover:text-neutral-600'}`}
                aria-label={t('mockup.surpriseMeSettings')}
              >
                <Settings size={12} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      <div className={`flex-grow border-t border-dashed ${theme === 'dark' ? 'border-neutral-700/50' : 'border-neutral-300/50'}`}></div>
    </div>
  );
};


