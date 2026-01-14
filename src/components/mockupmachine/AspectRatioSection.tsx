import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AspectRatio, GeminiModel } from '@/types/types';
import { useTranslation } from '@/hooks/useTranslation';

interface AspectRatioSectionProps {
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  selectedModel: GeminiModel | null;
}

// Aspect ratios principais
const MAIN_ASPECT_RATIOS: AspectRatio[] = ['16:9', '1:1', '4:3', '9:16'];

// Outros aspect ratios disponíveis para o Mockup Machine® 4K
const OTHER_ASPECT_RATIOS: AspectRatio[] = ['21:9', '2:3', '3:2', '3:4', '4:5', '5:4'];

export const AspectRatioSection: React.FC<AspectRatioSectionProps> = ({
  aspectRatio,
  onAspectRatioChange,
  selectedModel
}) => {
  const [showOther, setShowOther] = useState(false);
  const isProModel = selectedModel === 'gemini-3-pro-image-preview';
  const isOtherSelected = !MAIN_ASPECT_RATIOS.includes(aspectRatio) && aspectRatio !== undefined;
  const { t } = useTranslation();

  if (!selectedModel) return null;

  return (
    <section>
      <h2 className={`text-sm font-semibold font-mono uppercase tracking-widest mb-2 transition-all duration-300 ${aspectRatio ? 'text-neutral-600' : 'text-neutral-400'}`}>
        {isProModel ? t('mockup.aspectRatioTitle') : t('mockup.autoAspectRatioTitle')}
      </h2>
      {!isProModel && (
        <p className="text-xs text-neutral-500 mb-3 font-mono">{t('mockup.autoAspectRatioDescription')}</p>
      )}
      <div className="flex flex-wrap justify-center gap-2 cursor-pointer">
        {MAIN_ASPECT_RATIOS.map((ratio) => {
          const [w, h] = ratio.split(':').map(Number);
          const isLandscape = w > h;
          const isPortrait = h > w;
          const isSquare = w === h;
          const isSelected = aspectRatio === ratio;

          return (
            <button
              key={ratio}
              onClick={() => onAspectRatioChange(ratio)}
              disabled={!isProModel}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-4 md:px-5 text-xs font-mono rounded-md transition-all duration-200 border ${isSelected
                ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40 cursor-pointer'
                : isProModel
                  ? 'bg-neutral-800/30 text-neutral-500 border-neutral-700/30 hover:border-neutral-600/50 hover:text-neutral-400 cursor-pointer'
                  : 'bg-neutral-800/20 text-neutral-600 border-neutral-700/20 opacity-40 cursor-not-allowed'
                }`}
              title={!isProModel ? t('mockup.aspectRatioAutoTooltip') : t('mockup.aspectRatioValue', { ratio })}
            >
              <div className={`${isSquare ? 'w-6 h-6' : isLandscape ? 'w-8 h-5' : 'w-5 h-8'} border ${isSelected ? 'border-[brand-cyan]/60' : 'border-neutral-600/50'
                } rounded-md`} />
              <span className="text-[10px] mt-0.5">{ratio}</span>
            </button>
          );
        })}

        {isProModel && (
          <>
            <button
              onClick={() => setShowOther(!showOther)}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-4 md:px-5 text-xs font-mono rounded-md transition-all duration-200 border cursor-pointer ${isOtherSelected
                ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                : 'bg-neutral-800/30 text-neutral-500 border-neutral-700/30 hover:border-neutral-600/50 hover:text-neutral-400'
                }`}
            >
              <span className="text-[10px]">{t('mockup.otherAspectRatio')}</span>
            </button>
          </>
        )}
      </div>

      {isProModel && showOther && (
        <div className="mt-3 pt-3 border-t border-neutral-700/30 animate-fade-in">
          <div className="flex flex-wrap justify-center gap-2 cursor-pointer">
            {OTHER_ASPECT_RATIOS.map((ratio) => {
              const [w, h] = ratio.split(':').map(Number);
              const isLandscape = w > h;
              const isPortrait = h > w;
              const isSquare = w === h;
              const isSelected = aspectRatio === ratio;

              return (
                <button
                  key={ratio}
                  onClick={() => {
                    onAspectRatioChange(ratio);
                    setShowOther(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-4 md:px-5 text-xs font-mono rounded-md transition-all duration-200 border cursor-pointer ${isSelected
                    ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                    : 'bg-neutral-800/30 text-neutral-500 border-neutral-700/30 hover:border-neutral-600/50 hover:text-neutral-400'
                    }`}
                  title={t('mockup.aspectRatioValue', { ratio })}
                >
                  <div className={`${isSquare ? 'w-6 h-6' : isLandscape ? 'w-8 h-5' : 'w-5 h-8'} border ${isSelected ? 'border-[brand-cyan]/60' : 'border-neutral-600/50'
                    } rounded-md`} />
                  <span className="text-[10px] mt-0.5">{ratio}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

