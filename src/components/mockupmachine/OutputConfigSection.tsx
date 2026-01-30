import React, { useState } from 'react';
import { Cpu, Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { authService } from '@/services/authService';

import { ImageProvider, DesignType, GeminiModel, Resolution, AspectRatio } from '@/types/types';

interface OutputConfigSectionProps {
  mockupCount: number;
  onMockupCountChange: (count: number) => void;
  designType: DesignType | null;
  selectedModel: GeminiModel | null;
  resolution: Resolution;
  onResolutionChange: (resolution: Resolution) => void;
  setSelectedModel: (model: GeminiModel | null) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  imageProvider: ImageProvider;
  setImageProvider: (provider: ImageProvider) => void;
}

const MAIN_ASPECT_RATIOS: AspectRatio[] = ['1:1', '9:16', '16:9', '4:3', '3:4'];
const OTHER_ASPECT_RATIOS: AspectRatio[] = ['2:3', '3:2', '4:5', '5:4', '21:9'];
// Base resolution options - will be augmented dynamically
const resolutionOptions: Resolution[] = ['1K', '2K', '4K'];

export const OutputConfigSection: React.FC<OutputConfigSectionProps> = ({
  mockupCount,
  onMockupCountChange,
  designType,
  selectedModel,
  resolution,
  onResolutionChange,
  setSelectedModel,
  aspectRatio,
  onAspectRatioChange,
  imageProvider,
  setImageProvider,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [showOther, setShowOther] = useState(false);

  // Check if user is admin to show Seedream
  const isAdmin = authService.isAdmin();

  // Also check if user has a specific Seedream key (pending implementation in userSettingsService, 
  // but for now we rely on admin check as primary gate or if we want to allow users with keys later)
  // For now, per requirement: "visible to admins"

  const isSeedream = imageProvider === 'seedream';
  const currentActiveResolution = resolution;

  const sectionTitleClass = (isDark: boolean) =>
    `text-[10px] font-mono uppercase tracking-widest ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`;

  const isOtherSelected = OTHER_ASPECT_RATIOS.includes(aspectRatio);

  return (
    <section className="space-y-6 pt-4 border-t border-neutral-800/20 pb-6">
      <h2 className={sectionTitleClass(theme === 'dark')}>{t('mockup.outputConfig') || 'PRODUÇÃO'}</h2>

      <div className="space-y-5">

        {/* AI Provider Toggle - Only visible for Admins */}
        {isAdmin && (
          <div className="space-y-2">
            <h4 className={sectionTitleClass(theme === 'dark')}>MODELO DE IA</h4>
            <div className="flex gap-1.5">
              <button
                onClick={() => setImageProvider('gemini')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-[11px] font-mono rounded-md transition-all duration-200 border cursor-pointer ${imageProvider === 'gemini'
                  ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40 shadow-[0_0_10px_-5px_#22d3ee]'
                  : theme === 'dark'
                    ? 'bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                    : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'
                  }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Gemini</span>
              </button>
              <button
                onClick={() => {
                  setImageProvider('seedream');
                  // Switch to 2K minimum for Seedream if needed, though API supports others
                  // forcing 2K/4K for better quality usually
                  if (resolution !== '2K' && resolution !== '4K') {
                    onResolutionChange('2K');
                    // Seedream doesn't use gemini models, but we might keep state consistent
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-[11px] font-mono rounded-md transition-all duration-200 border cursor-pointer ${imageProvider === 'seedream'
                  ? 'bg-violet-500/20 text-violet-400 border-violet-500/40 shadow-[0_0_10px_-5px_#8b5cf6]'
                  : theme === 'dark'
                    ? 'bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                    : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'
                  }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Seedream</span>
              </button>
            </div>
          </div>
        )}

        {/* Unified Config Row: Number of Images + Resolution */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Number of Images */}
          <div className="space-y-2">
            <h4 className={sectionTitleClass(theme === 'dark')}>{t('mockup.numberOfImages') || 'IMAGENS'}</h4>
            <div className={`relative flex items-center rounded-md border transition-all duration-200 overflow-hidden ${theme === 'dark' ? 'bg-neutral-800/50 border-neutral-700/50 hover:border-neutral-600' : 'bg-neutral-100 border-neutral-300 hover:border-neutral-400'}`}>
              <input
                type="number"
                min={1}
                max={4}
                value={mockupCount}
                onChange={(e) => onMockupCountChange(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 4))}
                className={`w-full p-2.5 bg-transparent border-none focus:outline-none focus:ring-0 text-xs font-monoSync ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}
              />
              <div className="absolute right-8 pointer-events-none">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-tighter">outputs</span>
              </div>
            </div>
          </div>

          {/* Unified Resolution Selection */}
          <div className="space-y-2">
            <h4 className={sectionTitleClass(theme === 'dark')}>RESOLUÇÃO / QUALIDADE</h4>
            <div className="flex gap-1.5 h-[38px]"> {/* Fixed height to match input */}
              {(imageProvider === 'gemini' ? ['HD', '1K', '2K', '4K'] : ['2K', '4K']).map((res) => {
                const isActive = resolution === res;
                // const isHd = res === 'HD';

                return (
                  <button
                    key={res}
                    onClick={() => onResolutionChange(res as Resolution)}
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

        {/* Aspect Ratio Section */}
        <div className="space-y-2 pt-2">
          <h4 className={sectionTitleClass(theme === 'dark')}>{t('mockup.aspectRatioTitle') || 'PROPORÇÃO'}</h4>
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
                    } rounded-[4px]`} />
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
                      } rounded-[4px]`} />
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
