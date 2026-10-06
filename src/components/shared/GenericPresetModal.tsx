import React from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronUp, Users, LucideIcon } from '@/lib/ui/icons';
import { getCommunityPresetsByType } from '@/services/communityPresetsService';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

interface PresetItem {
  id: string;
  name: string;
  description?: string;
  prompt?: string;
  thumbnail?: string;
}

interface GenericPresetModalProps<T extends string> {
  isOpen: boolean;
  selectedPresetId: T | string;
  onClose: () => void;
  onSelectPreset: (presetId: T | string) => void;
  isLoading?: boolean;

  // Configuration
  title: string;
  icon: LucideIcon;
  officialPresets: PresetItem[];
  communityPresetType: 'ambience' | 'angle' | 'luminance' | 'texture';
  fallbackIcon: LucideIcon;
}

export function GenericPresetModal<T extends string>({
  isOpen,
  selectedPresetId,
  onClose,
  onSelectPreset,
  isLoading = false,
  title,
  icon: Icon,
  officialPresets,
  communityPresetType,
  fallbackIcon: FallbackIcon,
}: GenericPresetModalProps<T>) {
  const { t } = useTranslation();
  const [communityPresets, setCommunityPresets] = React.useState<any[]>([]);
  const [isLoadingCommunityPresets, setIsLoadingCommunityPresets] = React.useState(false);
  const [expandedPrompts, setExpandedPrompts] = React.useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = React.useState<'official' | 'community'>('official');

  const togglePrompt = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(presetId)) {
        next.delete(presetId);
      } else {
        next.add(presetId);
      }
      return next;
    });
  };

  // Load community presets when modal opens
  React.useEffect(() => {
    if (!isOpen) {
      setCommunityPresets([]);
      return;
    }

    const fetchCommunityPresets = async () => {
      setIsLoadingCommunityPresets(true);
      try {
        const community = await getCommunityPresetsByType(communityPresetType);
        setCommunityPresets(community);
      } catch (error) {
        console.error(`Failed to load community ${communityPresetType} presets:`, error);
        setCommunityPresets([]);
      } finally {
        setIsLoadingCommunityPresets(false);
      }
    };

    fetchCommunityPresets();
  }, [isOpen, communityPresetType]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      const modalElement = document.getElementById('preset-modal');
      if (modalElement) {
        modalElement.focus();
      }

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderPresetCard = (preset: PresetItem, isCommunity: boolean = false) => {
    const isSelected = preset.id === selectedPresetId;
    const isPromptExpanded = expandedPrompts.has(preset.id);

    return (
      <div
        key={`${isCommunity ? 'community-' : ''}${preset.id}`}
        className={cn(
          'flex flex-col rounded-md border transition-[color,background-color,border-color,opacity] overflow-hidden group',
          isSelected
            ? 'bg-brand-cyan/10 border-brand-cyan/50 hover:bg-brand-cyan/15'
            : 'bg-card/30 border-border hover:bg-accent hover:border-border-hover',
          isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        {/* Thumbnail */}
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            if (!isLoading) {
              onSelectPreset(preset.id as T);
              onClose();
            }
          }}
          disabled={isLoading}
          className={cn(
            'relative w-full aspect-square bg-card/30 border-b border-border overflow-hidden flex-shrink-0',
            !isLoading && 'cursor-pointer'
          )}
        >
          <div className="w-full h-full flex items-center justify-center bg-card/50">
            <FallbackIcon size={40} className="text-muted-foreground" />
          </div>
          {/* Selection Indicator */}
          {isSelected && (
            <div className="absolute top-2 right-2 w-3 h-3 bg-brand-cyan rounded-md border-2 border-black" />
          )}
          {/* Community Badge */}
          {isCommunity && (
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-muted/70 border border-border rounded text-2xs text-foreground">
              {t('common.community')}
            </div>
          )}
        </Button>

        {/* Name and Prompt Section */}
        <div className="flex flex-col p-3 min-h-[80px]">
          {/* Name */}
          <div
            className={cn(
              'text-sm font-medium mb-2 line-clamp-2 leading-tight',
              isSelected ? 'text-brand-cyan' : 'text-foreground'
            )}
          >
            {preset.name}
          </div>

          {/* Description */}
          {preset.description && (
            <div className="text-2xs text-muted-foreground mb-2 line-clamp-2">
              {preset.description}
            </div>
          )}

          {/* Collapsible Prompt */}
          {preset.prompt && (
            <div className="flex-1 flex flex-col min-h-0">
              <Button
                variant="ghost"
                onClick={(e) => togglePrompt(preset.id, e)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                aria-expanded={isPromptExpanded}
              >
                <span className="text-2xs">{t('common.prompt')}</span>
                {isPromptExpanded ? (
                  <ChevronUp size={12} className="flex-shrink-0" />
                ) : (
                  <ChevronDown size={12} className="flex-shrink-0" />
                )}
              </Button>
              {isPromptExpanded && (
                <div className="text-2xs text-muted-foreground font-mono leading-relaxed overflow-y-auto max-h-24">
                  {preset.prompt}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const modalContent = (
    <div
      id="preset-modal"
      tabIndex={-1}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-modal-title"
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] bg-background/95 backdrop-blur-xl border border-border rounded-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon size={20} className="text-muted-foreground" />
            <h2
              id="preset-modal-title"
              className="text-sm font-semibold text-foreground tracking-tight"
            >
              {title}
            </h2>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title={t('common.closeEsc')}
          >
            <X size={20} />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pt-4 border-b border-border">
          <Button
            variant="ghost"
            onClick={() => setActiveTab('official')}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-colors duration-200 border-b-2 relative',
              activeTab === 'official'
                ? 'text-brand-cyan border-brand-cyan'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border-hover'
            )}
          >
            {t('common.official')} ({officialPresets.length})
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('community')}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-colors duration-200 border-b-2 flex items-center gap-1.5 relative',
              activeTab === 'community'
                ? 'text-brand-cyan border-brand-cyan'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border-hover'
            )}
          >
            <Users size={12} />
            {t('common.community')} ({communityPresets.length})
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 relative">
          {/* Official Presets Tab */}
          <div
            className={cn(
              'transition-[opacity,transform] duration-300 ease-in-out',
              activeTab === 'official'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 absolute inset-0 pointer-events-none'
            )}
          >
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {officialPresets.map((preset) => renderPresetCard(preset, false))}
              </div>
            </div>
          </div>

          {/* Community Presets Tab */}
          <div
            className={cn(
              'transition-[opacity,transform] duration-300 ease-in-out',
              activeTab === 'community'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 absolute inset-0 pointer-events-none'
            )}
          >
            <div>
              {isLoadingCommunityPresets ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                </div>
              ) : communityPresets.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">{t('communityPresets.noPresets')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {communityPresets.map((preset: any) => renderPresetCard(preset, true))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
