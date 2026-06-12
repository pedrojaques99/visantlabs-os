import React, { useState, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Heart,
  GitFork,
  Eye,
  Zap,
  Palette,
  Image,
  Wrench,
  BarChart3,
  Layers,
  Link2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  likeMiniApp,
  forkMiniApp,
  shareMiniApp,
  type MiniAppSummary,
} from '@/services/playgroundApi';
import { toast } from 'sonner';

export const MINIAPP_CATEGORY_CONFIG: Record<
  string,
  { icon: LucideIcon; color: string; label: string }
> = {
  brand: { icon: Palette, color: 'text-purple-400', label: 'Brand' },
  mockup: { icon: Image, color: 'text-blue-400', label: 'Mockup' },
  creative: { icon: Zap, color: 'text-pink-400', label: 'Creative' },
  utility: { icon: Wrench, color: 'text-warning', label: 'Utility' },
  data: { icon: BarChart3, color: 'text-success', label: 'Data' },
};

interface MiniAppCardProps {
  miniApp: MiniAppSummary;
  onClick?: () => void;
  onFork?: (newSlug: string) => void;
  showActions?: boolean;
}

export const MiniAppCard: React.FC<MiniAppCardProps> = ({
  miniApp,
  onClick,
  onFork,
  showActions = true,
}) => {
  const cat = MINIAPP_CATEGORY_CONFIG[miniApp.category] || MINIAPP_CATEGORY_CONFIG.utility;
  const CatIcon = cat.icon;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(miniApp.likesCount);
  const [copied, setCopied] = useState(false);

  const handleLike = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const result = await likeMiniApp(miniApp.id);
        setLiked(result.liked);
        setLikeCount((c) => (result.liked ? c + 1 : Math.max(0, c - 1)));
      } catch {
        toast.error('Failed to like');
      }
    },
    [miniApp.id]
  );

  const handleFork = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const result = await forkMiniApp(miniApp.id);
        toast.success('Forked!');
        onFork?.(result.miniApp?.slug);
      } catch {
        toast.error('Failed to fork');
      }
    },
    [miniApp.id, onFork]
  );

  const handleShare = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const { shareUrl } = await shareMiniApp(miniApp.id);
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success('Link copied!');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Failed to share');
      }
    },
    [miniApp.id]
  );

  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-left w-full rounded-xl border border-neutral-800 bg-neutral-900/30',
        'hover:border-white/10 hover:bg-neutral-900/60 transition-all duration-200',
        'focus:outline-none focus:ring-1 focus:ring-brand-cyan/30'
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
            <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
              preview
            </span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-neutral-900/80 backdrop-blur-sm',
              cat.color
            )}
          >
            <CatIcon className="w-3 h-3" />
            {cat.label}
          </span>
        </div>

        {/* Action buttons overlay */}
        {showActions && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleLike}
              className={cn(
                'p-1.5 rounded-lg bg-neutral-900/80 backdrop-blur-sm transition-colors',
                liked ? 'text-destructive' : 'text-neutral-400 hover:text-destructive'
              )}
              title="Like"
            >
              <Heart className="w-3.5 h-3.5" fill={liked ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={handleFork}
              className="p-1.5 rounded-lg bg-neutral-900/80 backdrop-blur-sm text-neutral-400 hover:text-brand-cyan transition-colors"
              title="Fork"
            >
              <GitFork className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleShare}
              className="p-1.5 rounded-lg bg-neutral-900/80 backdrop-blur-sm text-neutral-400 hover:text-brand-cyan transition-colors"
              title="Copy link"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : (
                <Link2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-neutral-200 truncate flex-1">
            {miniApp.title}
          </h3>
          {miniApp.author?.name && (
            <span
              className="text-[10px] text-neutral-500 truncate max-w-[80px]"
              title={miniApp.author.name}
            >
              {miniApp.author.name}
            </span>
          )}
        </div>
        {miniApp.description && (
          <p className="text-[11px] text-neutral-500 line-clamp-2">{miniApp.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 pt-1">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px]',
              liked ? 'text-destructive' : 'text-neutral-500'
            )}
          >
            <Heart className="w-3 h-3" fill={liked ? 'currentColor' : 'none'} /> {likeCount}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
            <GitFork className="w-3 h-3" /> {miniApp.forksCount}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
            <Eye className="w-3 h-3" /> {miniApp.viewsCount}
          </span>
          <div className="flex-1" />
          {miniApp.tags?.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-mono text-neutral-600 bg-neutral-800/50 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
};
