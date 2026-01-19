import React, { useState } from 'react';
import type { DesignType, GeminiModel, Resolution, AspectRatio } from '@/types/types';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';

interface OutputConfigSectionProps {
  mockupCount: number;
  onMockupCountChange: (count: number) => void;
  designType: DesignType | null;
  selectedModel: GeminiModel | null;
  resolution: Resolution;
  onResolutionChange: (resolution: Resolution) => void;
  setSelectedModel: (model: GeminiModel) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
}

// Aspect ratios principais
const MAIN_ASPECT_RATIOS: AspectRatio[] = ['16:9', '1:1', '4:3', '9:16'];

// Outros aspect ratios disponíveis para o Mockup Machine® 4K
const OTHER_ASPECT_RATIOS: AspectRatio[] = ['21:9', '2:3', '3:2', '3:4', '4:5', '5:4'];

export const OutputConfigSection: React.FC<OutputConfigSectionProps> = ({
  mockupCount,
  onMockupCountChange,
  designType,
  selectedModel,
  resolution,
  onResolutionChange,
  setSelectedModel,
  aspectRatio,
  onAspectRatioChange
}) => {
  const isProModel = selectedModel === 'gemini-3-pro-image-preview';
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [showOther, setShowOther] = useState(false);

  // Check if selected aspect ratio is in the "Other" category
  const isOtherSelected = !MAIN_ASPECT_RATIOS.includes(aspectRatio) && aspectRatio !== undefined;

  // Unified Resolution/Model Logic
  // HD -> gemini-2.5-flash-image
  // 1K/2K/4K -> gemini-3-pro-image-preview with resolution set

  const handleResolutionClick = (res: 'HD' | Resolution) => {
    if (res === 'HD') {
      setSelectedModel('gemini-2.5-flash-image');
    } else {
      setSelectedModel('gemini-3-pro-image-preview');
      onResolutionChange(res);
    }
  };

  const currentActiveResolution = isProModel ? resolution : 'HD';

  return (
    <section className="space-y-6 pt-4 border-t border-neutral-800/20 pb-6">
      <h2 className={`text-sm font-semibold font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>{t('mockup.outputConfig')}</h2>

      <div className="space-y-5">

        {/* Unified Config Row: Number of Images + Resolution */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Number of Images */}
          <div className="space-y-2">
            <h4 className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{t('mockup.numberOfImages')}</h4>
            <div className={`relative flex items-center rounded-md border transition-all duration-200 overflow-hidden ${theme === 'dark' ? 'bg-neutral-800/50 border-neutral-700/50 hover:border-neutral-600' : 'bg-neutral-100 border-neutral-300 hover:border-neutral-400'}`}>
              <input
                type="number"
                min={1}
                max={4}
                value={mockupCount}
                onChange={(e) => onMockupCountChange(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 4))}
                className={`w-full p-2.5 bg-transparent border-none focus:outline-none focus:ring-0 text-xs font-monoSync ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}
              />
              <div className="absolute right-3 pointer-events-none">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-tighter">outputs</span>
              </div>
            </div>
          </div>

          {/* Unified Resolution Selection */}
          <div className="space-y-2">
            <h4 className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>RESOLUÇÃO / QUALIDADE</h4>
            <div className="flex gap-1.5 h-[38px]"> {/* Fixed height to match input */}
              {(['HD', '1K', '2K', '4K'] as const).map(res => {
                const isActive = currentActiveResolution === res;
                const isHd = res === 'HD';

                return (
                  <button
                    key={res}
                    onClick={() => handleResolutionClick(res)}
                    className={`flex-1 flex flex-col items-center justify-center text-[10px] font-mono rounded transition-all duration-200 border cursor-pointer relative group ${isActive
                      ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40 shadow-[0_0_10px_-5px_#22d3ee]'
                      : theme === 'dark'
                        ? 'bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                        : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'
                      }`}
                  >
                    <span className={isActive ? 'font-bold' : ''}>{res}</span>
                    {/* Optional credit cost hint on hover or active */}
                    {/* <span className="text-[8px] opacity-60 scale-75">{isHd ? '1c' : '3-7c'}</span> */}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Aspect Ratio Section - Always visible now, controlled by model capabilities potentially, but let's show it for all as HD usually supports it too */}
        <div className="space-y-2 pt-2">
          <h4 className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{t('mockup.aspectRatioTitle') || 'PROPORÇÃO_'}</h4>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {MAIN_ASPECT_RATIOS.map((ratio) => {
              const [w, h] = ratio.split(':').map(Number);
              const isLandscape = w > h;
              const isSquare = w === h;
              const isSelected = aspectRatio === ratio;

              return (
                <button
                  key={ratio}
                  onClick={() => onAspectRatioChange(ratio)}
                  className={`flex flex-col items-center justify-center gap-1 py-3 px-1 w-full rounded-sm transition-all duration-200 border cursor-pointer ${isSelected
                      ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/40 shadow-[0_0_10px_-5px_#22d3ee]'
                      : theme === 'dark'
                        ? 'bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                        : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'
                    }`}
                >
                  <div className={`${isSquare ? 'w-5 h-5' : isLandscape ? 'w-7 h-4' : 'w-4 h-7'} border ${isSelected ? 'border-brand-cyan/60' : 'border-neutral-600/50'
                    } rounded-sm`} />
                  <span className="text-[10px] font-mono mt-1">{ratio}</span>
                </button>
              );
            })}

            <button
              onClick={() => setShowOther(!showOther)}
              className={`flex flex-col items-center justify-center gap-1 py-3 px-1 w-full rounded-sm transition-all duration-200 border cursor-pointer ${isOtherSelected
                  ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/40 shadow-[0_0_10px_-5px_#22d3ee]'
                  : theme === 'dark'
                    ? 'bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                    : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'
                }`}
            >
              <span className="text-[10px] font-mono uppercase tracking-widest">{t('mockup.otherAspectRatio') || 'OUTROS'}</span>
            </button>
          </div>

          {showOther && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2 pt-2 border-t border-neutral-800/50 animate-fade-in">
              {OTHER_ASPECT_RATIOS.map((ratio) => {
                const [w, h] = ratio.split(':').map(Number);
                const isLandscape = w > h;
                const isSquare = w === h;
                const isSelected = aspectRatio === ratio;

                return (
                  <button
                    key={ratio}
                    onClick={() => {
                      onAspectRatioChange(ratio);
                      setShowOther(false);
                    }}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 w-full rounded-sm transition-all duration-200 border cursor-pointer ${isSelected
                        ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/40 shadow-[0_0_10px_-5px_#22d3ee]'
                        : theme === 'dark'
                          ? 'bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                          : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'
                      }`}
                  >
                    <div className={`${isSquare ? 'w-5 h-5' : isLandscape ? 'w-7 h-4' : 'w-4 h-7'} border ${isSelected ? 'border-brand-cyan/60' : 'border-neutral-600/50'
                      } rounded-sm`} />
                    <span className="text-[10px] font-mono mt-1">{ratio}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
