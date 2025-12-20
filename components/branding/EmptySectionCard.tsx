import React from 'react';
import { Pickaxe, Lock } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../hooks/useTheme';
import { getBrandingStepCredits } from '../../utils/creditCalculator';
import { getSectionEmoji } from '../../utils/brandingHelpers';

interface EmptySectionCardProps {
  stepNumber: number;
  stepTitle: string;
  onGenerate: () => void;
  isGenerating?: boolean;
  isBlocked?: boolean;
  missingDependencies?: number[];
  steps?: Array<{ id: number; title: string }>;
}

export const EmptySectionCard: React.FC<EmptySectionCardProps> = ({
  stepNumber,
  stepTitle,
  onGenerate,
  isGenerating = false,
  isBlocked = false,
  missingDependencies = [],
  steps = [],
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const creditsRequired = getBrandingStepCredits(stepNumber);
  const emoji = getSectionEmoji(stepNumber);

  const getMissingDepsText = () => {
    if (missingDependencies.length === 0) return '';
    const depTitles = missingDependencies
      .map(dep => steps.find(s => s.id === dep)?.title || `Step ${dep}`)
      .join(', ');
    return depTitles;
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!isBlocked) {
          onGenerate();
        }
      }}
      disabled={isGenerating || isBlocked}
      className={`aspect-square border-2 rounded-xl p-4 md:p-6 active:scale-[0.98] transition-all duration-200 relative flex flex-col items-center justify-center gap-3 w-full ${
        isBlocked
          ? theme === 'dark'
            ? 'bg-black/30 border-zinc-700/50 cursor-not-allowed opacity-60'
            : 'bg-zinc-50 border-zinc-300/50 cursor-not-allowed opacity-60'
          : theme === 'dark'
            ? 'bg-black border-white/10 hover:border-white/20 hover:bg-white/5 active:bg-white/10 cursor-pointer group'
            : 'bg-zinc-100 border-zinc-300 hover:border-zinc-400 hover:bg-zinc-200 active:bg-zinc-300 cursor-pointer group'
      } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isBlocked ? `Bloqueado: requer ${getMissingDepsText()}` : undefined}
    >
      {/* Blocked Icon Overlay */}
      {isBlocked && (
        <div className={`absolute top-2 left-2 p-1.5 rounded-md ${
          theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
        }`}>
          <Lock className={`h-3 w-3 ${
            theme === 'dark' ? 'text-red-400' : 'text-red-600'
          }`} />
        </div>
      )}

      {/* Emoji Icon */}
      <div className={`text-3xl md:text-4xl filter transition-all duration-200 ${
        isBlocked 
          ? 'grayscale opacity-50' 
          : 'grayscale group-hover:grayscale-0'
      }`}>
        {emoji}
      </div>

      {/* Label */}
      <h3 className={`font-semibold font-manrope text-xs md:text-sm text-center leading-tight max-w-full truncate px-2 ${
        theme === 'dark' ? 'text-white' : 'text-zinc-800'
      }`}>
        {stepTitle}
      </h3>

      {/* Credits Badge - Pilula style */}
      {!isBlocked && (
        <div className={`absolute top-3 right-3 px-2 py-1 border rounded-md flex items-center gap-1.5 transition-all duration-200 ${
          theme === 'dark'
            ? 'bg-white/10 border-white/20 group-hover:bg-white/15'
            : 'bg-zinc-200 border-zinc-300 group-hover:bg-zinc-300'
        }`}>
          <Pickaxe size={12} className={theme === 'dark' ? 'text-white/80' : 'text-zinc-700'} />
          <span className={`text-xs font-mono font-semibold ${
            theme === 'dark' ? 'text-white/90' : 'text-zinc-800'
          }`}>
            {creditsRequired}
          </span>
        </div>
      )}

      {/* Blocked Badge */}
      {isBlocked && (
        <div className={`absolute top-3 right-3 px-2 py-1 border rounded-md flex items-center gap-1.5 ${
          theme === 'dark'
            ? 'bg-red-500/20 border-red-500/30'
            : 'bg-red-100 border-red-300'
        }`}>
          <Lock size={12} className={theme === 'dark' ? 'text-red-400' : 'text-red-600'} />
          <span className={`text-xs font-mono font-semibold ${
            theme === 'dark' ? 'text-red-400' : 'text-red-600'
          }`}>
            Bloqueado
          </span>
        </div>
      )}

      {/* Loading overlay */}
      {isGenerating && (
        <div className={`absolute inset-0 rounded-xl flex items-center justify-center z-10 ${
          theme === 'dark' ? 'bg-black/80' : 'bg-white/90'
        }`}>
          <div className={`w-6 h-6 border-2 rounded-md animate-spin ${
            theme === 'dark'
              ? 'border-white/30 border-t-white'
              : 'border-zinc-400 border-t-zinc-600'
          }`} />
        </div>
      )}
    </button>
  );
};

