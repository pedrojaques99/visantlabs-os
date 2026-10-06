import React, { useState, useCallback } from 'react';
import type { LucideIcon } from '@/lib/ui/icons';
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
} from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import {
  likeMiniApp,
  forkMiniApp,
  shareMiniApp,
  type MiniAppSummary,
} from '@/services/playgroundApi';
import { toast } from 'sonner';
import { MediaTile } from '@/components/ui/MediaTile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

export const MINIAPP_CATEGORY_CONFIG: Record<
  string,
  { icon: LucideIcon; color: string; label: string }
> = {
  brand: { icon: Palette, color: 'text-chart-1', label: 'Brand' },
  mockup: { icon: Image, color: 'text-chart-2', label: 'Mockup' },
  creative: { icon: Zap, color: 'text-chart-3', label: 'Creative' },
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
  const { t } = useTranslation();
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
        toast.error(t('playground.card.likeFailed'));
      }
    },
    [miniApp.id, t]
  );

  const handleFork = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const result = await forkMiniApp(miniApp.id);
        toast.success(t('playground.card.forked'));
        onFork?.(result.miniApp?.slug);
      } catch {
        toast.error(t('playground.card.forkFailed'));
      }
    },
    [miniApp.id, onFork, t]
  );

  const handleShare = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const { shareUrl } = await shareMiniApp(miniApp.id);
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success(t('playground.shareCopied'));
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error(t('playground.shareFailed'));
      }
    },
    [miniApp.id, t]
  );

  return (
    <MediaTile
      src={miniApp.thumbnail || undefined}
      alt={miniApp.title}
      aspectRatio="16 / 10"
      fallbackIcon={Layers}
      onClick={onClick}
      title={miniApp.title}
      subtitle={miniApp.author?.name || undefined}
      badge={
        <Badge variant="neutral" className="gap-1">
          <CatIcon className="h-3 w-3" aria-hidden="true" />
          {cat.label}
        </Badge>
      }
      actions={
        showActions ? (
          <>
            <Button
              variant="surface"
              size="icon-sm"
              onClick={handleLike}
              aria-pressed={liked}
              className={cn('bg-card', liked && 'text-destructive')}
              aria-label={t('playground.card.like')}
              title={t('playground.card.like')}
            >
              <Heart className="h-3.5 w-3.5" fill={liked ? 'currentColor' : 'none'} />
            </Button>
            <Button
              variant="surface"
              size="icon-sm"
              onClick={handleFork}
              className="bg-card"
              aria-label={t('playground.card.fork')}
              title={t('playground.card.fork')}
            >
              <GitFork className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="surface"
              size="icon-sm"
              onClick={handleShare}
              className="bg-card"
              aria-label={t('playground.copyShareLink')}
              title={t('playground.copyShareLink')}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </>
        ) : undefined
      }
      meta={
        <div className="space-y-2">
          {miniApp.description && <p className="line-clamp-2">{miniApp.description}</p>}
          <div className="flex items-center gap-3">
            <span className={cn('inline-flex items-center gap-1', liked && 'text-destructive')}>
              <Heart className="h-3 w-3" fill={liked ? 'currentColor' : 'none'} /> {likeCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <GitFork className="h-3 w-3" /> {miniApp.forksCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> {miniApp.viewsCount}
            </span>
            <div className="flex-1" />
            {miniApp.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded bg-muted px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        </div>
      }
    />
  );
};
