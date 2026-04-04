import React from 'react';
import { MOCKUP_VIBES } from '@/constants/mockupVibes';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Camera, Building2, Palmtree, Gem, Palette, Zap } from 'lucide-react';

interface VibeGridProps {
  selectedVibeId: string | null;
  onSelectVibe: (vibeId: string) => void;
}

const ICON_MAP: Record<string, any> = {
  Camera,
  Building2,
  Palmtree,
  Gem,
  Palette,
  Zap,
};

export const VibeGrid: React.FC<VibeGridProps> = ({
  selectedVibeId,
  onSelectVibe,
}) => {
  return (
    <div className="grid grid-cols-3 gap-3">
      {MOCKUP_VIBES.map((vibe) => {
        const isSelected = selectedVibeId === vibe.id;
        const Icon = ICON_MAP[vibe.iconName] || Camera;

        return (
          <motion.button
            key={vibe.id}
            onClick={() => onSelectVibe(vibe.id)}
            whileHover={{ y: -2 }}
            className={cn(
              "relative flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-500 group overflow-hidden border",
              isSelected
                ? "bg-brand-cyan/10 border-brand-cyan/40 shadow-[0_0_25px_rgba(var(--brand-cyan-rgb),0.15)]"
                : "bg-neutral-900/40 border-white/5 hover:border-white/10 hover:bg-neutral-900/60"
            )}
          >
            {/* Selection Status Indicator */}
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  layoutId="vibe-selection"
                  className="absolute top-2 right-2 w-4 h-4 bg-brand-cyan rounded-full flex items-center justify-center z-10 shadow-lg shadow-brand-cyan/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Check size={10} className="text-black" strokeWidth={4} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Icon Container */}
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
              isSelected
                ? "bg-brand-cyan text-black shadow-[0_0_15px_rgba(var(--brand-cyan-rgb),0.3)]"
                : "bg-neutral-800/80 text-neutral-400 group-hover:bg-neutral-700/80 group-hover:text-neutral-200"
            )}>
              <Icon size={20} strokeWidth={isSelected ? 2.5 : 2} />
            </div>

            {/* Label */}
            <div className="flex flex-col items-center gap-0.5">
              <span className={cn(
                "text-[10px] font-mono font-bold uppercase tracking-widest transition-colors duration-300",
                isSelected ? "text-brand-cyan" : "text-neutral-500 group-hover:text-neutral-300"
              )}>
                {vibe.name}
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};
