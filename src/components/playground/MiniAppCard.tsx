import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Heart, GitFork, Eye, Sparkles, Palette, Image, Wrench, BarChart3, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MiniAppSummary } from '@/services/playgroundApi';

export const MINIAPP_CATEGORY_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  brand:    { icon: Palette,    color: 'text-purple-400',  label: 'Brand' },
  mockup:   { icon: Image,      color: 'text-blue-400',    label: 'Mockup' },
  creative: { icon: Sparkles,   color: 'text-pink-400',    label: 'Creative' },
  utility:  { icon: Wrench,     color: 'text-amber-400',   label: 'Utility' },
  data:     { icon: BarChart3,  color: 'text-green-400',   label: 'Data' },
};

interface MiniAppCardProps {
  miniApp: MiniAppSummary;
  onClick?: () => void;
}

export const MiniAppCard: React.FC<MiniAppCardProps> = ({ miniApp, onClick }) => {
  const cat = MINIAPP_CATEGORY_CONFIG[miniApp.category] || MINIAPP_CATEGORY_CONFIG.utility;
  const CatIcon = cat.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-left w-full rounded-xl border border-neutral-800 bg-neutral-900/30',
        'hover:border-white/10 hover:bg-neutral-900/60 transition-all duration-200',
        'focus:outline-none focus:ring-1 focus:ring-brand-cyan/30',
      )}
    >
      {/* Thumbnail */}
      <div className="aspect-[16/10] rounded-t-xl bg-neutral-950/80 overflow-hidden relative flex items-center justify-center">
        {miniApp.thumbnail ? (
          <img
            src={miniApp.thumbnail}
            alt={miniApp.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-30">
            <Layers className="w-8 h-8 text-neutral-500" />
            <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">preview</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-neutral-900/80 backdrop-blur-sm', cat.color)}>
            <CatIcon className="w-3 h-3" />
            {cat.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        <h3 className="text-xs font-semibold text-neutral-200 truncate">{miniApp.title}</h3>
        {miniApp.description && (
          <p className="text-[11px] text-neutral-500 line-clamp-2">{miniApp.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 pt-1">
          <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
            <Heart className="w-3 h-3" /> {miniApp.likesCount}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
            <GitFork className="w-3 h-3" /> {miniApp.forksCount}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
            <Eye className="w-3 h-3" /> {miniApp.viewsCount}
          </span>
          <div className="flex-1" />
          {miniApp.tags?.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] font-mono text-neutral-600 bg-neutral-800/50 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
};
