import React from 'react';
import { VIBE_SEGMENTS, VIBE_STYLES, VibeSegment, VibeStyle } from '@/constants/mockupVibes';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Cpu, Cloud, BarChart, ShoppingBag, Zap, Activity, Scale, HardHat, Coffee,
  Gem, Scissors, Palette, Leaf, Factory, ChevronRight, Trophy
} from 'lucide-react';

interface VibeGridProps {
  selectedSegment: VibeSegment | null;
  selectedStyle: VibeStyle | null;
  onSelectSegment: (segment: VibeSegment) => void;
  onSelectStyle: (style: VibeStyle) => void;
}

const ICON_MAP: Record<string, any> = {
  Cpu, Cloud, BarChart, ShoppingBag, Zap, Activity, Scale, HardHat, Coffee,
  Gem, Scissors, Palette, Leaf, Factory, Trophy
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
          <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan/50" />
          <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-[0.2em]">
            {t('mockup.segmentTitle') || '01. SEGMENTO'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {VIBE_SEGMENTS.map((seg) => {
            const isSelected = selectedSegment === seg.id;
            const Icon = ICON_MAP[seg.icon] || Cpu;

            return (
              <button
                key={seg.id}
                onClick={() => onSelectSegment(seg.id as VibeSegment)}
                className={cn(
                  "relative flex flex-col items-center gap-2.5 p-3.5 rounded-xl transition-all duration-300 group overflow-hidden border",
                  isSelected
                    ? "bg-brand-cyan/10 border-brand-cyan/50 shadow-[0_0_20px_rgba(var(--brand-cyan-rgb),0.1)]"
                    : "bg-neutral-900/60 border-white/5 hover:border-white/20 hover:bg-neutral-900/80"
                )}
              >
                {/* Icon Container */}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                  isSelected
                    ? "bg-brand-cyan text-black shadow-[0_0_10px_rgba(var(--brand-cyan-rgb),0.3)]"
                    : "bg-neutral-800/50 text-neutral-500 group-hover:text-neutral-300 group-hover:bg-neutral-800"
                )}>
                  <Icon size={16} strokeWidth={isSelected ? 2.5 : 2} />
                </div>

                <span className={cn(
                  "text-[9px] font-mono font-bold uppercase tracking-widest transition-colors duration-300 text-center leading-tight",
                  isSelected ? "text-brand-cyan" : "text-neutral-500 group-hover:text-neutral-300"
                )}>
                  {seg.name}
                </span>

                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-3 h-3 bg-brand-cyan rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                    <Check size={8} className="text-black" strokeWidth={4} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. STYLE SELECTION */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan/50" />
          <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-[0.2em]">
            {t('mockup.vibeTitle') || '02. VIBE / DIREÇÃO'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {VIBE_STYLES.map((style) => {
            const isSelected = selectedStyle === style.id;
            const Icon = ICON_MAP[style.icon] || Gem;

            return (
              <button
                key={style.id}
                onClick={() => onSelectStyle(style.id as VibeStyle)}
                disabled={!selectedSegment}
                className={cn(
                  "relative flex flex-col items-center gap-2.5 p-3.5 rounded-xl transition-all duration-300 group overflow-hidden border",
                  !selectedSegment && "opacity-20 cursor-not-allowed grayscale",
                  isSelected
                    ? "bg-brand-cyan/10 border-brand-cyan/50 shadow-[0_0_20px_rgba(var(--brand-cyan-rgb),0.1)]"
                    : "bg-neutral-900/60 border-white/5 hover:border-white/20 hover:bg-neutral-900/80"
                )}
              >
                {/* Icon Container */}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                  isSelected
                    ? "bg-brand-cyan text-black shadow-[0_0_10px_rgba(var(--brand-cyan-rgb),0.3)]"
                    : "bg-neutral-800/50 text-neutral-500 group-hover:text-neutral-300 group-hover:bg-neutral-800"
                )}>
                  <Icon size={16} strokeWidth={isSelected ? 2.5 : 2} />
                </div>

                <span className={cn(
                  "text-[9px] font-mono font-bold uppercase tracking-widest transition-colors duration-300 text-center leading-tight",
                  isSelected ? "text-brand-cyan" : "text-neutral-500 group-hover:text-neutral-300"
                )}>
                  {style.name}
                </span>

                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-3 h-3 bg-brand-cyan rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                    <Check size={8} className="text-black" strokeWidth={4} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
