import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { SkeletonLoader } from '../ui/SkeletonLoader';

interface BrandingCompactCardProps {
  stepId: number;
  stepTitle: string;
  emoji: string;
  isGenerating: boolean;
  onClick: () => void;
}

export const BrandingCompactCard: React.FC<BrandingCompactCardProps> = ({
  stepId,
  stepTitle,
  emoji,
  isGenerating,
  onClick,
}) => {
  const { theme } = useTheme();
  return (
    <div
      onClick={onClick}
      className={`aspect-square border rounded-xl p-3 md:p-4 hover:border-[brand-cyan]/50 transition-all duration-200 cursor-pointer group relative animate-fade-in-down flex flex-col items-center justify-center w-1/2 md:max-w-[150px] ${theme === 'dark'
        ? 'bg-[#141414] border-zinc-800/60'
        : 'bg-white border-zinc-300'
        }`}
    >
      <div className="text-2xl md:text-3xl mb-2 transition-transform duration-200">
        {emoji}
      </div>
      <h3 className={`font-semibold font-manrope text-xs md:text-sm text-center leading-tight ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'
        }`}>
        {stepTitle}
      </h3>
      {isGenerating && (
        <div className={`absolute inset-0 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-black/50' : 'bg-white/80'
          }`}>
          <SkeletonLoader height="1rem" className="w-3/4" />
        </div>
      )}
    </div>
  );
};

