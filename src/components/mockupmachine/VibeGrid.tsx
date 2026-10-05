import React from 'react';
import { VIBE_SEGMENTS, VIBE_STYLES, VibeSegment, VibeStyle } from '@/constants/mockupVibes';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Cloud,
  BarChart,
  ShoppingBag,
  Zap,
  Activity,
  Scale,
  HardHat,
  Coffee,
  Gem,
  Scissors,
  Palette,
  Leaf,
  Factory,
  ChevronRight,
  Trophy,
} from '@/lib/ui/icons';

interface VibeGridProps {
  selectedSegment: VibeSegment | null;
  selectedStyle: VibeStyle | null;
  onSelectSegment: (segment: VibeSegment) => void;
  onSelectStyle: (style: VibeStyle) => void;
}

const ICON_MAP: Record<string, any> = {
  Cpu,
  Cloud,
  BarChart,
  ShoppingBag,
  Zap,
  Activity,
  Scale,
  HardHat,
  Coffee,
  Gem,
  Scissors,
  Palette,
  Leaf,
  Factory,
  Trophy,
};

export const VibeGrid: React.FC<VibeGridProps> = ({
  selectedSegment,
  selectedStyle,
  onSelectSegment,
  onSelectStyle,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in duration-500">
      {/* 1. SEGMENT SELECTION */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <span className="text-2xs font-medium text-neutral-400">{t('mockup.segmentTitle')}</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {VIBE_SEGMENTS.map((seg) => {
            const isSelected = selectedSegment === seg.id;
            const Icon = ICON_MAP[seg.icon] || Cpu;

            return (
              <button
                key={seg.id}
                onClick={() => onSelectSegment(seg.id as VibeSegment)}
                aria-pressed={isSelected}
                className={cn(
                  'relative flex flex-col items-center gap-2.5 p-3.5 rounded-xl transition-[color,background-color,border-color,box-shadow] duration-300 group overflow-hidden border',
                  isSelected
                    ? 'bg-brand-cyan/10 border-brand-cyan/50'
                    : 'bg-neutral-900/60 border-neutral-800 hover:border-white/20 hover:bg-neutral-900/80'
                )}
              >
                {/* Icon Container */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-[color,background-color,border-color,box-shadow] duration-300',
                    isSelected
                      ? 'bg-neutral-800 text-foreground'
                      : 'bg-neutral-800/50 text-neutral-500 group-hover:text-neutral-300 group-hover:bg-neutral-800'
                  )}
                >
                  <Icon size={16} strokeWidth={isSelected ? 2.5 : 2} />
                </div>

                <span
                  className={cn(
                    'text-xs font-medium transition-colors duration-300 text-center leading-tight',
                    isSelected ? 'text-foreground' : 'text-neutral-500 group-hover:text-neutral-300'
                  )}
                >
                  {seg.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. STYLE SELECTION */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <span className="text-2xs font-medium text-neutral-400">{t('mockup.vibeTitle')}</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {VIBE_STYLES.map((style) => {
            const isSelected = selectedStyle === style.id;
            const Icon = ICON_MAP[style.icon] || Gem;

            return (
              <button
                key={style.id}
                onClick={() => onSelectStyle(style.id as VibeStyle)}
                aria-pressed={isSelected}
                disabled={!selectedSegment}
                className={cn(
                  'relative flex flex-col items-center gap-2.5 p-3.5 rounded-xl transition-[color,background-color,border-color,box-shadow,opacity] duration-300 group overflow-hidden border',
                  !selectedSegment && 'opacity-20 cursor-not-allowed grayscale',
                  isSelected
                    ? 'bg-brand-cyan/10 border-brand-cyan/50'
                    : 'bg-neutral-900/60 border-neutral-800 hover:border-white/20 hover:bg-neutral-900/80'
                )}
              >
                {/* Icon Container */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-[color,background-color,border-color,box-shadow,opacity] duration-300',
                    isSelected
                      ? 'bg-neutral-800 text-foreground'
                      : 'bg-neutral-800/50 text-neutral-500 group-hover:text-neutral-300 group-hover:bg-neutral-800'
                  )}
                >
                  <Icon size={16} strokeWidth={isSelected ? 2.5 : 2} />
                </div>

                <span
                  className={cn(
                    'text-xs font-medium transition-colors duration-300 text-center leading-tight',
                    isSelected ? 'text-foreground' : 'text-neutral-500 group-hover:text-neutral-300'
                  )}
                >
                  {style.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
