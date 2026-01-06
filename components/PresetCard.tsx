import React, { useState, useEffect } from 'react';
import { Copy, Download, Edit2, Trash2, Heart, LayoutGrid, Box, Settings, Palette, Sparkles, Image as ImageIcon, Camera, Layers, MapPin, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { authService } from '../services/authService';
import { migrateLegacyPreset } from '../types/communityPrompts';
import type { CommunityPrompt, PromptCategory } from '../types/communityPrompts';

export const CATEGORY_CONFIG: Record<PromptCategory, { icon: any; color: string; label: string }> = {
  'all': { icon: LayoutGrid, color: 'text-zinc-300', label: 'All Prompts' },
  '3d': { icon: Box, color: 'text-purple-400', label: '3D' },
  'presets': { icon: Settings, color: 'text-blue-400', label: 'Presets' },
  'aesthetics': { icon: Palette, color: 'text-pink-400', label: 'Aesthetics' },
  'themes': { icon: Sparkles, color: 'text-amber-400', label: 'Themes' },
  'mockup': { icon: ImageIcon, color: 'text-blue-400', label: 'Mockup' },
  'angle': { icon: Camera, color: 'text-cyan-400', label: 'Angle' },
  'texture': { icon: Layers, color: 'text-green-400', label: 'Texture' },
  'ambience': { icon: MapPin, color: 'text-orange-400', label: 'Ambience' },
  'luminance': { icon: Sun, color: 'text-yellow-400', label: 'Luminance' },
};

const getPresetIcon = (category: PromptCategory) => {
  const Icon = CATEGORY_CONFIG[category]?.icon || LayoutGrid;
  return <Icon size={20} />;
};

interface PresetCardProps {
  preset: CommunityPrompt;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleLike?: () => void;
  isAuthenticated: boolean;
  canEdit: boolean;
  t: (key: string) => string;
}

export const PresetCard: React.FC<PresetCardProps> = ({
  preset,
  onClick,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleLike,
  isAuthenticated,
  canEdit,
  t,
}) => {
  const migrated = migrateLegacyPreset(preset);
  const hasImage =
    (migrated.category === 'presets' && migrated.presetType === 'mockup' && migrated.referenceImageUrl) ||
    (migrated.category !== 'presets' && migrated.referenceImageUrl);
  const presetIcon = getPresetIcon(migrated.category);
  const isLiked = migrated.isLikedByUser || false;
  const likesCount = migrated.likesCount || 0;
  const [isCopyingPrompt, setIsCopyingPrompt] = useState(false);
  const [glitchText, setGlitchText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const isOwner = currentUserId && migrated.userId && currentUserId === migrated.userId;

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

  useEffect(() => {
    if (isCopyingPrompt) {
      const glitchChars = '*•□./-®';
      const glitchInterval = setInterval(() => {
        const randomGlitch = Array.from({ length: 4 }, () =>
          glitchChars[Math.floor(Math.random() * glitchChars.length)]
        ).join('');
        setGlitchText(randomGlitch);
      }, 150);

      const timeout = setTimeout(() => {
        setIsCopyingPrompt(false);
        setGlitchText('');
      }, 600);

      return () => {
        clearInterval(glitchInterval);
        clearTimeout(timeout);
      };
    }
  }, [isCopyingPrompt]);

  return (
    <div
      className="bg-card border border-zinc-800/50 rounded-md p-4 hover:border-brand-cyan/30 hover:bg-card/80 transition-all group relative cursor-pointer"
      onClick={onClick}
    >
      <div className="mb-3">
        {hasImage ? (
          <div className="relative w-full aspect-square rounded-md overflow-hidden border border-zinc-700/30 bg-zinc-900/30">
            <img
              src={migrated.referenceImageUrl}
              alt={migrated.name}
              className="w-full h-full object-cover bg-zinc-900/50 group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-md border border-zinc-700/30 bg-zinc-900/30 flex items-center justify-center">
            <div className="text-zinc-500">{presetIcon}</div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-zinc-200 mb-0.5 font-mono line-clamp-1">
              {migrated.name}
            </h3>
            <p className="text-xs text-zinc-500 font-mono line-clamp-2 leading-snug">
              {migrated.description}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={async (e) => {
                e.stopPropagation();
                setIsCopyingPrompt(true);
                try {
                  await navigator.clipboard.writeText(migrated.prompt);
                  toast.success('Prompt copied to clipboard');
                } catch (err) {
                  toast.error('Failed to copy prompt');
                }
              }}
              className="p-1.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 rounded transition-colors opacity-0 group-hover:opacity-100 relative min-w-[16px] min-h-[16px] flex items-center justify-center"
              title="Copy prompt"
            >
              {isCopyingPrompt ? (
                <span className="text-[10px] font-mono text-zinc-400">{glitchText}</span>
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            {isAuthenticated && onDuplicate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="p-1.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 rounded transition-colors opacity-0 group-hover:opacity-100"
                title={t('communityPresets.actions.duplicate') || 'Duplicate'}
              >
                {canEdit ? <Download className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
            {isOwner && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
                className="p-1.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 rounded transition-colors opacity-0 group-hover:opacity-100"
                title={t('communityPresets.actions.edit')}
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
            {canEdit && onEdit && onDelete && (
              <>
                {!isOwner && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.();
                    }}
                    className="p-1.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title={t('communityPresets.actions.edit')}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.();
                  }}
                  className="p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title={t('communityPresets.actions.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tags */}
        <div
          className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent scroll-smooth cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => {
            const container = e.currentTarget;
            const startX = e.pageX - container.offsetLeft;
            const scrollLeft = container.scrollLeft;
            let isDown = true;

            const handleMouseMove = (e: MouseEvent) => {
              if (!isDown) return;
              e.preventDefault();
              const x = e.pageX - container.offsetLeft;
              const walk = (x - startX) * 2;
              container.scrollLeft = scrollLeft - walk;
            };

            const handleMouseUp = () => {
              isDown = false;
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
          onWheel={(e) => {
            e.currentTarget.scrollLeft += e.deltaY;
          }}
        >
          <span
            className={cn(
              'px-2 py-0.5 rounded border font-mono text-xs flex-shrink-0 whitespace-nowrap',
              migrated.category === '3d' && 'bg-purple-500/20 border-purple-500/30 text-purple-400',
              migrated.category === 'presets' && 'bg-blue-500/20 border-blue-500/30 text-blue-400',
              migrated.category === 'aesthetics' && 'bg-pink-500/20 border-pink-500/30 text-pink-400',
              migrated.category === 'themes' && 'bg-amber-500/20 border-amber-500/30 text-amber-400',
              migrated.category === 'mockup' && 'bg-blue-500/20 border-blue-500/30 text-blue-400',
              migrated.category === 'angle' && 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
              migrated.category === 'texture' && 'bg-green-500/20 border-green-500/30 text-green-400',
              migrated.category === 'ambience' && 'bg-orange-500/20 border-orange-500/30 text-orange-400',
              migrated.category === 'luminance' && 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
              !migrated.category && 'bg-zinc-800/40 border-zinc-700/30 text-zinc-500'
            )}
          >
            {CATEGORY_CONFIG[migrated.category]?.label ||
              t(`communityPresets.categories.${migrated.category}`) ||
              t(`communityPresets.tabs.${migrated.category}`) ||
              migrated.category}
          </span>
          {migrated.category === 'presets' && migrated.presetType && (
            <span className="px-2 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/30 text-zinc-500 font-mono text-[10px] uppercase flex-shrink-0 whitespace-nowrap">
              {migrated.presetType}
            </span>
          )}
          {migrated.difficulty && (
            <span
              className={cn(
                'px-2 py-0.5 rounded border font-mono text-[10px] flex-shrink-0 whitespace-nowrap',
                migrated.difficulty === 'beginner' &&
                  'bg-green-500/20 border-green-500/30 text-green-400',
                migrated.difficulty === 'intermediate' &&
                  'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
                migrated.difficulty === 'advanced' && 'bg-red-500/20 border-red-500/30 text-red-400'
              )}
            >
              {t(
                `communityPresets.difficulty${migrated.difficulty.charAt(0).toUpperCase() + migrated.difficulty.slice(1)}`
              )}
            </span>
          )}
          <span className="px-2 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/30 text-zinc-500 font-mono text-xs flex-shrink-0 whitespace-nowrap">
            {migrated.aspectRatio}
          </span>
          {isAuthenticated && onToggleLike && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike();
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all text-xs font-mono flex-shrink-0 whitespace-nowrap ${
                isLiked
                  ? 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50'
                  : 'bg-zinc-900/40 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400'
              }`}
              title={isLiked ? t('communityPresets.actions.unlike') : t('communityPresets.actions.like')}
            >
              <Heart size={12} className={isLiked ? 'fill-current' : ''} />
              <span>{likesCount}</span>
            </button>
          )}
        </div>

        {/* Tags - Mostra todas as tags, incluindo as antigas */}
        {migrated.tags && migrated.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {migrated.tags.map((tag, index) => (
              <span
                key={index}
                className="px-1.5 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/20 text-zinc-500 font-mono text-[10px] hover:border-zinc-600/40 hover:text-zinc-400 transition-colors"
                title={tag}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

