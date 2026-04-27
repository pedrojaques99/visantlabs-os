import React, { useState } from 'react';
import { Clipboard, Download, Edit2, Trash2, Heart, Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { migrateLegacyPreset } from '../types/communityPrompts';
import type { CommunityPrompt, PromptCategory } from '../types/communityPrompts';
import { Button } from '@/components/ui/button';
import { useGlitchCopy } from '@/hooks/useGlitchCopy';
import {
  LayoutGrid, Box, Settings, Palette, Diamond,
  Image as ImageIcon, Camera, Layers, MapPin, Sun,
} from 'lucide-react';
import { Clipboard as ClipboardIcon } from 'lucide-react';

export const CATEGORY_CONFIG: Record<PromptCategory, { icon: any; color: string; label: string }> = {
  'all':           { icon: LayoutGrid,  color: 'text-neutral-400',  label: 'All'          },
  '3d':            { icon: Box,         color: 'text-purple-400',   label: '3D'           },
  'presets':       { icon: Settings,    color: 'text-blue-400',     label: 'Presets'      },
  'aesthetics':    { icon: Palette,     color: 'text-pink-400',     label: 'Aesthetics'   },
  'themes':        { icon: Diamond,     color: 'text-amber-400',    label: 'Themes'       },
  'mockup':        { icon: ImageIcon,   color: 'text-blue-400',     label: 'Mockup'       },
  'angle':         { icon: Camera,      color: 'text-cyan-400',     label: 'Angle'        },
  'texture':       { icon: Layers,      color: 'text-green-400',    label: 'Texture'      },
  'ambience':      { icon: MapPin,      color: 'text-orange-400',   label: 'Ambience'     },
  'luminance':     { icon: Sun,         color: 'text-yellow-400',   label: 'Luminance'    },
  'ui-prompts':    { icon: ImageIcon,   color: 'text-purple-400',   label: 'UI Prompts'   },
  'figma-prompts': { icon: ClipboardIcon, color: 'text-pink-400',  label: 'Figma Prompts'},
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
}) => {
  const migrated = migrateLegacyPreset(preset);
  const hasImage = !!migrated.referenceImageUrl;
  const config = CATEGORY_CONFIG[migrated.category] ?? CATEGORY_CONFIG['all'];
  const Icon = config.icon;
  const isLiked = migrated.isLikedByUser ?? false;
  const likesCount = migrated.likesCount ?? 0;
  const isOwner = currentUserId && migrated.userId && currentUserId === migrated.userId;
  const { isCopying, glitchText, handleCopy } = useGlitchCopy(migrated.prompt);

  return (
    <div
      className={cn(
        'group relative flex flex-col bg-neutral-900/30 border rounded-xl overflow-hidden cursor-pointer transition-all duration-150',
        selected
          ? 'border-white/20 bg-white/[0.04]'
          : 'border-white/[0.05] hover:border-white/10 hover:bg-neutral-900/50'
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-[4/3] bg-neutral-900/50 overflow-hidden">
        {hasImage ? (
          <img
            src={migrated.referenceImageUrl}
            alt={migrated.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon size={28} className={cn('opacity-30', config.color)} />
          </div>
        )}

        {/* Selection badge */}
        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded flex items-center justify-center shadow-sm z-10">
            {selectionIndex !== undefined
              ? <span className="text-[10px] font-mono font-bold text-black">{selectionIndex}</span>
              : <Check size={10} className="text-black" strokeWidth={3} />
            }
          </div>
        )}

        {/* Hover actions overlay */}
        <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            aria-label="Copy prompt"
            onClick={(e) => { e.stopPropagation(); handleCopy('Copied', 'Failed'); }}
            className="p-1.5 rounded-md bg-neutral-950/70 backdrop-blur-sm border border-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            {isCopying ? <span className="text-[9px] font-mono">{glitchText}</span> : <Clipboard size={12} />}
          </button>
          {isAuthenticated && onDuplicate && (
            <button
              aria-label="Duplicate"
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="p-1.5 rounded-md bg-neutral-950/70 backdrop-blur-sm border border-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              {canEdit ? <Download size={12} /> : <Copy size={12} />}
            </button>
          )}
          {(isOwner || canEdit) && onEdit && (
            <button
              aria-label={t('common.edit')}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-md bg-neutral-950/70 backdrop-blur-sm border border-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              <Edit2 size={12} />
            </button>
          )}
          {canEdit && onDelete && (
            <button
              aria-label={t('common.delete')}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-md bg-neutral-950/70 backdrop-blur-sm border border-white/10 text-neutral-400 hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        {/* Title + like */}
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn(
            'text-xs font-semibold font-mono leading-snug line-clamp-1',
            selected ? 'text-white' : 'text-neutral-200'
          )}>
            {migrated.name}
          </h3>
          {isAuthenticated && onToggleLike && (
            <button
              aria-label={isLiked ? t('communityPresets.actions.unlike') : t('communityPresets.actions.like')}
              onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
              className="flex items-center gap-1 shrink-0 text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              <Heart size={11} className={isLiked ? 'fill-current text-neutral-400' : ''} />
              {likesCount > 0 && <span className="text-[10px] font-mono">{likesCount}</span>}
            </button>
          )}
        </div>

        {/* Description */}
        <p className="text-[11px] text-neutral-600 font-mono leading-relaxed line-clamp-2 flex-1">
          {migrated.description || migrated.prompt}
        </p>

        {/* Footer chips */}
        <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
          <span className={cn('text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border', config.color,
            'bg-white/[0.03] border-white/[0.06]')}>
            {config.label}
          </span>
          {migrated.difficulty && (
            <span className={cn(
              'text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border bg-white/[0.03] border-white/[0.06]',
              migrated.difficulty === 'beginner' ? 'text-green-500' :
              migrated.difficulty === 'intermediate' ? 'text-yellow-500' : 'text-red-400'
            )}>
              {migrated.difficulty.slice(0, 3)}
            </span>
          )}
          <span className="text-[9px] font-mono text-neutral-700 px-1.5 py-0.5 rounded border bg-white/[0.02] border-white/[0.04]">
            {migrated.aspectRatio}
          </span>
          {migrated.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[9px] font-mono text-neutral-700 px-1.5 py-0.5 rounded border bg-white/[0.02] border-white/[0.04]">
              #{tag}
            </span>
          ))}
          {(migrated.tags?.length ?? 0) > 2 && (
            <span className="text-[9px] font-mono text-neutral-800">
              +{(migrated.tags?.length ?? 0) - 2}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
