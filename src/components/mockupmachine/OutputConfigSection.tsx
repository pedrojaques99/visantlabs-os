import React, { useState } from 'react';
import { Cpu, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { authService } from '@/services/authService';
import { Select } from '@/components/ui/select';
import { SkeletonText } from '@/components/ui/SkeletonLoader';
import { ImageProvider, DesignType, GeminiModel, Resolution, AspectRatio } from '@/types/types';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MicroTitle } from '@/components/ui/MicroTitle'

interface OutputConfigSectionProps {
  mockupCount: number;
  onMockupCountChange: (count: number) => void;
  designType: DesignType;
  selectedModel: GeminiModel | null;
  resolution: Resolution;
  onResolutionChange: (resolution: Resolution) => void;
  setSelectedModel: (model: GeminiModel | null) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  imageProvider: ImageProvider;
  setImageProvider: (provider: ImageProvider) => void;
  isGenerating?: boolean;
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
  isGenerating = false,
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

  const aspectRatioLabel = (ratio: AspectRatio): string => {
    const labels: Record<string, string> = {
      '1:1': t('mockup.aspectRatioSquare') || 'Square',
      '9:16': t('mockup.aspectRatioPortrait') || 'Portrait',
      '16:9': t('mockup.aspectRatioWidescreen') || 'Widescreen',
      '4:3': t('mockup.aspectRatioStandard') || 'Standard',
      '3:4': t('mockup.aspectRatioPortrait43') || 'Portrait',
      '2:3': t('mockup.aspectRatioPortrait23') || 'Portrait',
      '3:2': t('mockup.aspectRatioLandscape') || 'Landscape',
      '4:5': t('mockup.aspectRatioPortrait45') || 'Portrait',
      '5:4': t('mockup.aspectRatioLandscape54') || 'Landscape',
      '21:9': t('mockup.aspectRatioUltrawide') || 'Ultrawide',
    };
    return labels[ratio] || ratio;
  };

  return (
    <section className="space-y-6 pt-4 border-t border-neutral-800/20 pb-6">
      <SkeletonText loading={isGenerating}>
        <h2 className={sectionTitleClass(theme === 'dark')}>
          {t('mockup.outputConfig') || 'PRODUÇÃO'}
        </h2>
      </SkeletonText>

      <div className="space-y-5">
        {/* 2x2 Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Row 1, Col 1: Model (Only visible for Admins) */}
          {isAdmin && (
            <div className="space-y-2">
              <SkeletonText loading={isGenerating}>
                <h4 className={sectionTitleClass(theme === 'dark')}>MODELO DE IA</h4>
              </SkeletonText>
              <div className="flex flex-nowrap items-center justify-start gap-1.5 text-center">
                <Select
                  value={imageProvider}
                  onChange={(value) => {
                    if (value === 'gemini') {
                      setImageProvider('gemini');
                    } else if (value === 'seedream') {
                      setImageProvider('seedream');
                      // Switch to 2K minimum for Seedream if needed, though API supports others
                      // forcing 2K/4K for better quality usually
                      if (resolution !== '2K' && resolution !== '4K') {
                        onResolutionChange('2K');
                      }
                    }
                  }}
                  options={[
                    { value: 'gemini', label: 'Gemini' },
                    { value: 'seedream', label: 'Seedream' },
                  ]}
                  className="w-full"
                  loading={isGenerating}
                />
              </div>
            </div>
          )}

          {/* Row 1, Col 2: Resolution */}
          <div className="space-y-2">
            <SkeletonText loading={isGenerating}>
              <h4 className={sectionTitleClass(theme === 'dark')}>RESOLUÇÃO / QUALIDADE</h4>
            </SkeletonText>
            <div className="flex gap-1.5 h-[38px]">
              {' '}
              {/* Fixed height to match input */}
              {(imageProvider === 'gemini' ? ['HD', '1K', '2K', '4K'] : ['2K', '4K']).map((res) => {
                const isActive = resolution === res;
                // const isHd = res === 'HD';

                return (
                  <Button variant="ghost"                     key={res}
                    onClick={() => onResolutionChange(res as Resolution)}
                    className={`flex-1 flex flex-col items-center justify-center text-[10px] font-mono rounded transition-all duration-200 border cursor-pointer relative group ${isActive
                        ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40 shadow-[0_0_10px_-5px_#22d3ee]'
                        : theme === 'dark'
                          ? 'bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                          : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'
                      }`}
                  >
                    <SkeletonText loading={isGenerating}>
                      <span className={isActive ? 'font-bold' : ''}>{res}</span>
                    </SkeletonText>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Row 2, Col 1: Number of Images */}
          <div className="space-y-2">
            <SkeletonText loading={isGenerating}>
              <h4 className={sectionTitleClass(theme === 'dark')}>
                {t('mockup.numberOfImages') || 'NÚMERO DE IMAGENS'}
              </h4>
            </SkeletonText>
            <div
              className={`relative flex items-center rounded-md border transition-all duration-200 overflow-hidden ${theme === 'dark' ? 'bg-neutral-800/50 border-neutral-700/50 hover:border-neutral-600' : 'bg-neutral-100 border-neutral-300 hover:border-neutral-400'}`}
            >
              <Input
                type="number"
                min={1}
                max={4}
                value={mockupCount}
                onChange={(e) =>
                  onMockupCountChange(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 4))
                }
                className={`w-full py-2.5 pl-3 pr-14 bg-transparent border-none focus:outline-none focus:ring-0 text-xs font-monoSync [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}
              />
              <div className="absolute right-7 pointer-events-none">
                <SkeletonText loading={isGenerating}>
                  <MicroTitle className="text-[10px] tracking-tighter">
                    outputs
                  </MicroTitle>
                </SkeletonText>
              </div>
              <div className={`absolute right-1 flex flex-col h-[80%] my-auto justify-center space-y-[1px] ${theme === 'dark' ? 'border-neutral-700/50' : 'border-neutral-300'} border-l pl-1`}>
                <Button variant="ghost"                   type="button"
                  onClick={() => onMockupCountChange(Math.min(mockupCount + 1, 4))}
                  className={`flex items-center justify-center p-0.5 rounded-sm transition-colors ${theme === 'dark' ? 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-700/50' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200'}`}
                >
                  <ChevronUp size={12} />
                </Button>
                <Button variant="ghost"                   type="button"
                  onClick={() => onMockupCountChange(Math.max(mockupCount - 1, 1))}
                  className={`flex items-center justify-center p-0.5 rounded-sm transition-colors ${theme === 'dark' ? 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-700/50' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200'}`}
                >
                  <ChevronDown size={12} />
                </Button>
              </div>
            </div>
          </div>

          {/* Row 2, Col 2: Aspect Ratio */}
          <div className={`space-y-2 ${!isAdmin ? 'sm:col-span-2' : ''}`}>
            <SkeletonText loading={isGenerating}>
              <div className="flex justify-between items-center mb-1">
                <h4 className={sectionTitleClass(theme === 'dark')}>
                  {t('mockup.aspectRatioTitle') || 'PROPORÇÃO'}
                </h4>
                <p
                  className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider"
                  role="status"
                  aria-live="polite"
                >
                  {aspectRatio} — {aspectRatioLabel(aspectRatio)}
                </p>
              </div>
            </SkeletonText>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {MAIN_ASPECT_RATIOS.map((ratio) => {
                const [w, h] = ratio.split(':').map(Number);
                const isLandscape = w > h;
                const isSquare = w === h;
                const isSelected = aspectRatio === ratio;

                return (
                  <Button variant="ghost"                     key={ratio}
                    onClick={() => onAspectRatioChange(ratio)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 w-full rounded-sm transition-all duration-200 border cursor-pointer ${isSelected
                        ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/40 shadow-[0_0_10px_-5px_#22d3ee]'
                        : theme === 'dark'
                          ? 'bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                          : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'
                      }`}
                  >
                    <div
                      className={`${isSquare ? 'w-4 h-4' : isLandscape ? 'w-5 h-3' : 'w-3 h-5'} border ${isSelected ? 'border-brand-cyan/60' : 'border-neutral-600/50'
                        } rounded-[3px]`}
                    />
                    <SkeletonText loading={isGenerating}>
                      <span className="text-[9px] font-mono mt-0.5">{ratio}</span>
                    </SkeletonText>
                  </Button>
                );
              })}

              <Button variant="ghost"                 onClick={() => setShowOther(!showOther)}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 w-full rounded-sm transition-all duration-200 border cursor-pointer ${isOtherSelected
                    ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/40 shadow-[0_0_10px_-5px_#22d3ee]'
                    : theme === 'dark'
                      ? 'bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300'
                      : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'
                  }`}
              >
                <SkeletonText loading={isGenerating}>
                  <span className="text-[9px] font-mono uppercase tracking-widest">
                    {t('mockup.otherAspectRatio') || 'OUTROS'}
                  </span>
                </SkeletonText>
              </Button>
            </div>

            {showOther && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2 pt-2 border-t border-neutral-800/50 animate-fade-in">
                {OTHER_ASPECT_RATIOS.map((ratio) => {
                  const [w, h] = ratio.split(':').map(Number);
                  const isLandscape = w > h;
                  const isSquare = w === h;
                  const isSelected = aspectRatio === ratio;

                  return (
                    <Button variant="ghost"                       key={ratio}
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
                      <div
                        className={`${isSquare ? 'w-4 h-4' : isLandscape ? 'w-5 h-3' : 'w-3 h-5'} border ${isSelected ? 'border-brand-cyan/60' : 'border-neutral-600/50'
                          } rounded-[3px]`}
                      />
                      <SkeletonText loading={isGenerating}>
                        <span className="text-[9px] font-mono mt-0.5">{ratio}</span>
                      </SkeletonText>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
