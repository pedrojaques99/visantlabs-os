import React, { useState, useEffect } from 'react';
import { Copy, Download, Edit2, Trash2, Heart, Play } from '@/lib/ui/icons';
import { cn } from '../lib/utils';
import { authService } from '../services/authService';
import type { CanvasWorkflow } from '../services/workflowApi';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';
import { Button } from '@/components/ui/button';
import { MediaTile } from '@/components/ui/MediaTile';

interface WorkflowCardProps {
  workflow: CanvasWorkflow;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleLike?: () => void;
  isAuthenticated: boolean;
  canEdit: boolean;
  t: (key: string) => string;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({
  workflow,
  onClick,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleLike,
  isAuthenticated,
  canEdit,
  t,
}) => {
  const categoryConfig =
    WORKFLOW_CATEGORY_CONFIG[workflow.category as keyof typeof WORKFLOW_CATEGORY_CONFIG] ||
    WORKFLOW_CATEGORY_CONFIG.general;
  const CategoryIcon = categoryConfig.icon;
  const isLiked = workflow.isLikedByUser || false;
  const likesCount = workflow.likesCount || 0;
  const usageCount = workflow.usageCount || 0;
  // The like toggle carries the count and is the only control that stays visible
  // (persistentActions); duplicate/edit/delete keep the hover reveal. Meta only
  // shows the count when there is no toggle, so it is never repeated.
  const showLikeToggle = isAuthenticated && !!onToggleLike;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const isOwner = currentUserId && workflow.userId && currentUserId === workflow.userId;

  useEffect(() => {
    const getCurrentUser = async () => {
      if (isAuthenticated) {
        const user = await authService.verifyToken();
        if (user) {
          setCurrentUserId(user.id);
        }
      }
    };
    getCurrentUser();
  }, [isAuthenticated]);

  const nodeCount = Array.isArray(workflow.nodes) ? workflow.nodes.length : 0;
  const edgeCount = Array.isArray(workflow.edges) ? workflow.edges.length : 0;

  // Card controls are siblings of MediaTile's stretched main action: every one
  // stops propagation so it never also triggers onClick.
  const stop =
    (fn: () => void) =>
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      fn();
    };

  const chip = 'rounded border border-border bg-muted px-1.5 py-0.5 font-mono whitespace-nowrap';

  return (
    <MediaTile
      src={workflow.thumbnailUrl || undefined}
      alt={workflow.name}
      aspectRatio={16 / 9}
      title={workflow.name}
      subtitle={workflow.description}
      onClick={onClick}
      fallbackIcon={CategoryIcon}
      className="h-full"
      actions={
        <>
          {isAuthenticated && onDuplicate && (
            <Button
              variant="surface"
              size="icon-sm"
              onClick={stop(onDuplicate)}
              aria-label={
                isOwner ? t('workflows.actions.duplicate') : t('workflows.actions.addToLibrary')
              }
              title={
                isOwner ? t('workflows.actions.duplicate') : t('workflows.actions.addToLibrary')
              }
            >
              {isOwner ? <Copy /> : <Download />}
            </Button>
          )}
          {(isOwner || canEdit) && onEdit && (
            <Button
              variant="surface"
              size="icon-sm"
              onClick={stop(onEdit)}
              aria-label={t('common.edit')}
              title={t('common.edit')}
            >
              <Edit2 />
            </Button>
          )}
          {(isOwner || canEdit) && onDelete && (
            <Button
              variant="surface"
              size="icon-sm"
              onClick={stop(onDelete)}
              aria-label={t('common.delete')}
              title={t('common.delete')}
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
            className="tabular-nums"
            onClick={stop(onToggleLike)}
            aria-pressed={isLiked}
            aria-label={isLiked ? t('workflows.actions.unlike') : t('workflows.actions.like')}
            title={isLiked ? t('workflows.actions.unlike') : t('workflows.actions.like')}
          >
            <Heart className={isLiked ? 'fill-current' : undefined} />
            {likesCount > 0 && likesCount}
          </Button>
        ) : undefined
      }
      meta={
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn(chip, categoryConfig.badgeClass)}>{categoryConfig.label}</span>
            <span className={chip}>
              {t('workflows.stats.nodes').replace('{count}', String(nodeCount))}
            </span>
            <span className={chip}>
              {t('workflows.stats.edges').replace('{count}', String(edgeCount))}
            </span>
            {usageCount > 0 && (
              <span className={cn(chip, 'inline-flex items-center gap-1')}>
                <Play size={10} />
                {usageCount}
              </span>
            )}
            {!showLikeToggle && likesCount > 0 && (
              <span className={cn(chip, 'inline-flex items-center gap-1 tabular-nums')}>
                <Heart size={10} className={isLiked ? 'fill-current' : undefined} />
                {likesCount}
              </span>
            )}
          </div>
          {workflow.tags && workflow.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {workflow.tags.map((tag, index) => (
                <span key={index} className={chip} title={tag}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
};
