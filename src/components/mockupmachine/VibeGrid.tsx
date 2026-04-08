import React from 'react';
import { VIBE_SEGMENTS, VIBE_STYLES, VibeSegment, VibeStyle } from '@/constants/mockupVibes';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Cpu, Cloud, BarChart, ShoppingBag, Zap, Activity, Scale, HardHat, Coffee,
  Gem, Scissors, Palette, Flashlight, Leaf, Factory, ChevronRight
} from 'lucide-react';

interface VibeGridProps {
  selectedSegment: VibeSegment | null;
  selectedStyle: VibeStyle | null;
  onSelectSegment: (segment: VibeSegment) => void;
  onSelectStyle: (style: VibeStyle) => void;
}

const ICON_MAP: Record<string, any> = {
  Cpu, Cloud, BarChart, ShoppingBag, Zap, Activity, Scale, HardHat, Coffee,
  Gem, Scissors, Palette, Flashlight, Leaf, Factory
};

export const VibeGrid: React.FC<VibeGridProps> = ({
  selectedSegment,
  selectedStyle,
  onSelectSegment,
  onSelectStyle,
}) => {
  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
      {/* 1. SEGMENT SELECTION */}
      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-[0.2em] px-1">
          1. Segmento (Indústria)
        </span>
        <div className="flex flex-wrap gap-2">
          {VIBE_SEGMENTS.map((seg) => {
            const isSelected = selectedSegment === seg.id;
            const Icon = ICON_MAP[seg.icon] || Cpu;

            return (
              <button
                key={seg.id}
                onClick={() => onSelectSegment(seg.id as VibeSegment)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300 font-mono text-[10px] uppercase tracking-wider",
                  isSelected
                    ? "bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan shadow-[0_0_15px_rgba(var(--brand-cyan-rgb),0.1)]"
                    : "bg-neutral-900/40 border-white/5 text-neutral-500 hover:border-white/10 hover:text-neutral-300"
                )}
              >
                <Icon size={12} className={cn(isSelected ? "text-brand-cyan" : "text-neutral-600")} />
                {seg.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. STYLE SELECTION */}
      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-[0.2em] px-1">
          2. Vibe (Direção de Arte)
        </span>
        <div className="grid grid-cols-3 gap-2.5">
          {VIBE_STYLES.map((style) => {
            const isSelected = selectedStyle === style.id;
            const Icon = ICON_MAP[style.icon] || Gem;

            return (
              <motion.button
                key={style.id}
                onClick={() => onSelectStyle(style.id as VibeStyle)}
                whileHover={{ y: -2 }}
                disabled={!selectedSegment}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-500 group overflow-hidden border",
                  !selectedSegment && "opacity-30 cursor-not-allowed grayscale",
                  isSelected
                    ? "bg-brand-cyan/10 border-brand-cyan/40 shadow-[0_0_20px_rgba(var(--brand-cyan-rgb),0.1)]"
                    : "bg-neutral-900/40 border-white/5 hover:border-white/10 hover:bg-neutral-900/60"
                )}
              >
                {/* Icon Container */}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500",
                  isSelected
                    ? "bg-brand-cyan text-black"
                    : "bg-neutral-800/80 text-neutral-400 group-hover:text-neutral-200"
                )}>
                  <Icon size={16} strokeWidth={isSelected ? 2.5 : 2} />
                </div>

                <span className={cn(
                  "text-[10px] font-mono font-bold uppercase tracking-widest transition-colors duration-300",
                  isSelected ? "text-brand-cyan" : "text-neutral-500 group-hover:text-neutral-300"
                )}>
                  {style.name}
                </span>

                {isSelected && (
                  <motion.div
                    layoutId="style-selection"
                    className="absolute top-1 right-1 w-3 h-3 bg-brand-cyan rounded-full flex items-center justify-center shadow-lg"
                  >
                    <Check size={8} className="text-black" strokeWidth={4} />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
