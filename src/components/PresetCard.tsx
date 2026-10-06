import React from 'react';
import { Clipboard, Download, Edit2, Trash2, Heart, Copy, Check } from '@/lib/ui/icons';
import { cn } from '../lib/utils';
import { migrateLegacyPreset } from '../types/communityPrompts';
import type { CommunityPrompt, PromptCategory } from '../types/communityPrompts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MediaTile } from '@/components/ui/MediaTile';
import { useGlitchCopy } from '@/hooks/useGlitchCopy';
import {
  LayoutGrid,
  Box,
  Settings,
  Palette,
  Diamond,
  Image as ImageIcon,
  Camera,
  Layers,
  MapPin,
  Sun,
} from '@/lib/ui/icons';
import { Clipboard as ClipboardIcon } from '@/lib/ui/icons';
import { glassSurface } from '@/lib/ui/glass';

export const CATEGORY_CONFIG: Record<PromptCategory, { icon: any; color: string; label: string }> =
  {
    all: { icon: LayoutGrid, color: 'text-neutral-400', label: 'All' },
    '3d': { icon: Box, color: 'text-chart-4', label: '3D' },
    presets: { icon: Settings, color: 'text-chart-1', label: 'Presets' },
    aesthetics: { icon: Palette, color: 'text-chart-5', label: 'Aesthetics' },
    themes: { icon: Diamond, color: 'text-warning', label: 'Themes' },
    mockup: { icon: ImageIcon, color: 'text-chart-1', label: 'Mockup' },
    angle: { icon: Camera, color: 'text-neutral-400', label: 'Angle' },
    texture: { icon: Layers, color: 'text-success', label: 'Texture' },
    ambience: { icon: MapPin, color: 'text-chart-3', label: 'Ambience' },
    luminance: { icon: Sun, color: 'text-warning', label: 'Luminance' },
    'ui-prompts': { icon: ImageIcon, color: 'text-chart-4', label: 'UI Prompts' },
    'figma-prompts': { icon: ClipboardIcon, color: 'text-chart-5', label: 'Figma Prompts' },
  };

interface PresetCardProps {
  preset: CommunityPrompt;
  currentUserId?: string | null;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleLike?: () => void;
  isAuthenticated: boolean;
  canEdit: boolean;
  t: (key: string) => string;
  selected?: boolean;
  selectionIndex?: number;
  /** Static marker shown top-left before the selection badge (e.g. "Official"). */
  badge?: React.ReactNode;
}

export const PresetCard: React.FC<PresetCardProps> = ({
  preset,
  currentUserId,
  onClick,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleLike,
  isAuthenticated,
  canEdit,
  t,
  selected,
  selectionIndex,
  badge,
}) => {
  const migrated = migrateLegacyPreset(preset);
  const config = CATEGORY_CONFIG[migrated.category] ?? CATEGORY_CONFIG['all'];
  const categoryKey = migrated.category in CATEGORY_CONFIG ? migrated.category : 'all';
  const difficultyKey = migrated.difficulty
    ? migrated.difficulty.charAt(0).toUpperCase() + migrated.difficulty.slice(1)
    : '';
  const isLiked = migrated.isLikedByUser ?? false;
  const likesCount = migrated.likesCount ?? 0;
  const isOwner = currentUserId && migrated.userId && currentUserId === migrated.userId;
  const { isCopying, glitchText, handleCopy } = useGlitchCopy(migrated.prompt);
  // The like toggle carries the count and is the only control that stays visible
  // (persistentActions); copy/duplicate/edit/delete keep the hover reveal. Meta
  // only shows the count when there is no toggle, so it is never repeated.
  const showLikeToggle = isAuthenticated && !!onToggleLike;

  // Card controls are siblings of MediaTile's stretched main action: every one
  // stops propagation so it never also triggers onClick.
  const stop =
    (fn: () => void) =>
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      fn();
    };

  return (
    <MediaTile
      src={migrated.referenceImageUrl || undefined}
      alt={migrated.name}
      aspectRatio={4 / 3}
      title={migrated.name}
      subtitle={migrated.description || migrated.prompt}
      onClick={onClick}
      selected={selected}
      fallbackIcon={config.icon}
      className="h-full"
      badge={
        badge || selected ? (
          <>
            {badge}
            {selected && (
              <Badge variant="neutral" className="px-1.5 tabular-nums">
                {selectionIndex !== undefined ? selectionIndex : <Check size={10} />}
              </Badge>
            )}
          </>
        ) : undefined
      }
      actions={
        <>
          <Button
            variant="surface"
            size={isCopying ? 'xs' : 'icon-sm'}
            aria-label={t('common.copy')}
            onClick={stop(() =>
              handleCopy(
                t('canvasNodes.promptNode.presetCard.copied'),
                t('canvasNodes.promptNode.presetCard.copyFailed')
              )
            )}
          >
            {isCopying ? <span className="font-mono">{glitchText}</span> : <Clipboard />}
          </Button>
          {isAuthenticated && onDuplicate && (
            <Button
              variant="surface"
              size="icon-sm"
              aria-label={t('communityPresets.actions.duplicate')}
              onClick={stop(onDuplicate)}
            >
              {canEdit ? <Download /> : <Copy />}
            </Button>
          )}
          {(isOwner || canEdit) && onEdit && (
            <Button
              variant="surface"
              size="icon-sm"
              aria-label={t('common.edit')}
              onClick={stop(onEdit)}
            >
              <Edit2 />
            </Button>
          )}
          {canEdit && onDelete && (
            <Button
              variant="surface"
              size="icon-sm"
              aria-label={t('common.delete')}
              onClick={stop(onDelete)}
              className="hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </>
      }
      persistentActions={
        showLikeToggle && onToggleLike ? (
          <Button
            variant="surface"
            size={likesCount > 0 ? 'xs' : 'icon-sm'}
            aria-label={
              isLiked ? t('communityPresets.actions.unlike') : t('communityPresets.actions.like')
            }
            aria-pressed={isLiked}
            onClick={stop(onToggleLike)}
            className="tabular-nums"
          >
            <Heart className={isLiked ? 'fill-current' : undefined} />
            {likesCount > 0 && likesCount}
          </Button>
        ) : undefined
      }
      meta={
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-muted-foreground">
            {t(`communityPresets.categories.${categoryKey}`)}
          </span>
          {migrated.difficulty && (
            <span
              className={cn(
                'rounded border border-border bg-muted px-1.5 py-0.5',
                migrated.difficulty === 'beginner'
                  ? 'text-success'
                  : migrated.difficulty === 'intermediate'
                    ? 'text-warning'
                    : 'text-destructive'
              )}
            >
              {t(`communityPresets.difficulty${difficultyKey}`)}
            </span>
          )}
          {migrated.aspectRatio && (
            <span className={cn('rounded px-1.5 py-0.5 font-mono', glassSurface.control)}>
              {migrated.aspectRatio}
            </span>
          )}
          {migrated.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className={cn('rounded px-1.5 py-0.5', glassSurface.control)}>
              #{tag}
            </span>
          ))}
          {(migrated.tags?.length ?? 0) > 2 && <span>+{(migrated.tags?.length ?? 0) - 2}</span>}
          {!showLikeToggle && likesCount > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Heart size={10} />
              {likesCount}
            </span>
          )}
        </div>
      }
    />
  );
};
