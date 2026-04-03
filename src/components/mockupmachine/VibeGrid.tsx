import React from 'react';
import { cn } from '@/lib/utils';
import { MOCKUP_VIBES, MockupVibe } from '@/constants/mockupVibes';
import * as LucideIcons from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Tooltip } from '@/components/ui/Tooltip';

interface VibeGridProps {
  selectedVibeId: string | null;
  onSelectVibe: (vibeId: string) => void;
  className?: string;
}

export const VibeGrid: React.FC<VibeGridProps> = ({
  selectedVibeId,
  onSelectVibe,
  className
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      {MOCKUP_VIBES.map((vibe) => {
        const Icon = (LucideIcons as any)[vibe.iconName] || LucideIcons.Sparkles;
        const isSelected = selectedVibeId === vibe.id;

        return (
          <Tooltip key={vibe.id} content={vibe.description}>
            <button
              onClick={() => onSelectVibe(vibe.id)}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-300",
                "hover:scale-[1.02] active:scale-[0.98]",
                isSelected 
                  ? "bg-brand-cyan/10 border-brand-cyan text-brand-cyan shadow-[0_0_15px_rgba(var(--brand-cyan-rgb),0.2)]" 
                  : isDark
                    ? "bg-neutral-900/50 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
                    : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                isSelected ? "bg-brand-cyan/20" : isDark ? "bg-neutral-800" : "bg-neutral-100"
              )}>
                <Icon size={20} strokeWidth={isSelected ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-center line-clamp-1">
                {vibe.name}
              </span>
              
              {isSelected && (
                <div className="absolute top-1.5 right-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
                </div>
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
};
