import React, { useState, useEffect } from 'react';
import { Dices } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../hooks/useTheme';

interface QuickActionsBarProps {
  onSurpriseMe: () => void;
  isGenerating: boolean;
  isGeneratingPrompt: boolean;
  autoGenerate: boolean;
  onAutoGenerateChange: (value: boolean) => void;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  onSurpriseMe,
  isGenerating,
  isGeneratingPrompt,
  autoGenerate,
  onAutoGenerateChange,
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
      <div className={`flex-grow border-t border-dashed ${theme === 'dark' ? 'border-zinc-700/50' : 'border-zinc-300/50'}`}></div>
      <div className="flex-shrink mx-2 flex flex-col items-center gap-2">
        <Tooltip content={t('mockup.surpriseMeTooltip')} position="top">
          <button 
            onClick={handleClick}
            disabled={isGenerating || isGeneratingPrompt}
            data-tutorial-target="surprise-me"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md border hover:border-[#52ddeb]/30 hover:bg-[#52ddeb]/10 hover:text-[#52ddeb] transition-all text-sm font-mono transform hover:scale-[1.02] active:scale-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-[#52ddeb]/10 cursor-pointer ${isAnimating ? 'dice-button-clicked' : ''} ${
              theme === 'dark'
                ? 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 shadow-black/20'
                : 'bg-zinc-100 text-zinc-700 border-zinc-300 shadow-zinc-200/20'
            }`}
          >
            <Dices size={16} className={isAnimating ? 'dice-icon-animate' : ''} />
            {t('mockup.surpriseMe')}
          </button>
        </Tooltip>
        <Tooltip content={t('mockup.autoGenerateTooltip')} position="top">
          <div 
            className={`group flex items-center gap-1.5 cursor-pointer opacity-40 hover:opacity-100 transition-opacity duration-200 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}
            onClick={() => onAutoGenerateChange(!autoGenerate)}
          >
          <div className={`w-3 h-3 rounded-md flex items-center justify-center border transition-all duration-200 ${
            autoGenerate 
              ? 'bg-[#52ddeb]/80 border-[#52ddeb] opacity-100' 
              : theme === 'dark' 
                ? 'bg-zinc-700/50 border-zinc-600/50 group-hover:border-zinc-500 group-hover:bg-zinc-700' 
                : 'bg-white/50 border-zinc-400/50 group-hover:border-zinc-400 group-hover:bg-white'
          }`}>
            {autoGenerate && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <label className={`text-[10px] select-none cursor-pointer font-mono group-hover:text-[11px] transition-all ${theme === 'dark' ? 'text-zinc-500 group-hover:text-zinc-400' : 'text-zinc-500 group-hover:text-zinc-600'}`}>
            {t('mockup.autoGenerate')}
          </label>
          </div>
        </Tooltip>
      </div>
      <div className={`flex-grow border-t border-dashed ${theme === 'dark' ? 'border-zinc-700/50' : 'border-zinc-300/50'}`}></div>
    </div>
  );
};


