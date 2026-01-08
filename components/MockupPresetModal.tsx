import React from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Plus, Crown, Search, Globe, LayoutGrid } from 'lucide-react';
import { Input } from './ui/input';
import type { MockupPresetType, MockupPreset } from '../types/mockupPresets';
import type { Mockup } from '../services/mockupApi';
import { getImageUrl } from '../utils/imageUtils';
import { cn } from '../lib/utils';
import { updatePresetsCache } from '../services/mockupPresetsService';
import { getAllCommunityPresets } from '../services/communityPresetsService';
import { PresetCard, CATEGORY_CONFIG } from './PresetCard';
import type { CommunityPrompt } from '../types/communityPrompts';
import { useTranslation } from '../hooks/useTranslation';
import { fetchAllOfficialPresets } from '../services/unifiedPresetService';

interface MockupPresetModalProps {
  isOpen: boolean;
  selectedPresetId: MockupPresetType | string;
  onClose: () => void;
  onSelectPreset?: (presetId: MockupPresetType | string) => void;
  onSelectPresets?: (presetIds: string[]) => void;
  userMockups?: Mockup[];
  isLoading?: boolean;
  multiSelect?: boolean;
  maxSelections?: number;
  initialCategory?: PresetFilterType;
}

type PresetFilterType = 'all' | 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance';

interface UnifiedPreset extends CommunityPrompt {
  isOfficial?: boolean;
}

export const MockupPresetModal: React.FC<MockupPresetModalProps> = ({
  isOpen,
  selectedPresetId,
  onClose,
  onSelectPreset,
  onSelectPresets,
  userMockups = [],
  isLoading = false,
  multiSelect = false,
  maxSelections = 5,
  initialCategory,
}) => {
  const { t } = useTranslation();
  const [officialPresets, setOfficialPresets] = React.useState<MockupPreset[]>([]);
  const [communityPresets, setCommunityPresets] = React.useState<any[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = React.useState(false);
  const [selectedPresetIds, setSelectedPresetIds] = React.useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = React.useState<PresetFilterType>(initialCategory || 'all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [presetSource, setPresetSource] = React.useState<'all' | 'official' | 'community'>('all');

  // Fetch all presets
  React.useEffect(() => {
    if (!isOpen) {
      setOfficialPresets([]);
      setCommunityPresets([]);
      return;
    }

    const fetchAllPresets = async () => {
      setIsLoadingPresets(true);
      try {
        // Fetch ALL official presets (mockup, angle, texture, ambience, luminance)
        const officialData = await fetchAllOfficialPresets();

        // Helper function to process presets by type (reduces code duplication)
        const processPresetType = (presets: any[] | undefined, presetType: string): any[] => {
          if (!presets || !Array.isArray(presets)) {
            return [];
          }
          return presets.map((p: any) => {
            if (!p) return null;
            return {
              ...p,
              referenceImageUrl: p.referenceImageUrl || '',
              presetType, // Force override
            };
          }).filter(Boolean);
        };

        // Combine all official presets with their correct presetType
        const allOfficialPresets: any[] = [
          ...processPresetType(officialData.mockupPresets, 'mockup'),
          ...processPresetType(officialData.anglePresets, 'angle'),
          ...processPresetType(officialData.texturePresets, 'texture'),
          ...processPresetType(officialData.ambiencePresets, 'ambience'),
          ...processPresetType(officialData.luminancePresets, 'luminance'),
        ];

        setOfficialPresets(allOfficialPresets);

        // Update mockup cache only with mockup presets
        const mockupOnly = allOfficialPresets.filter(p => p.presetType === 'mockup');
        if (mockupOnly.length > 0) {
          updatePresetsCache(mockupOnly);
        }

        // Fetch community presets
        const allCommunity = await getAllCommunityPresets();
        const flattened: any[] = [];
        Object.entries(allCommunity).forEach(([type, list]) => {
          if (Array.isArray(list)) {
            list.forEach(p => {
              flattened.push({
                ...p,
                referenceImageUrl: p.referenceImageUrl || '',
                presetType: type,
              });
            });
          }
        });
        setCommunityPresets(flattened);
      } catch (error) {
        console.error('Failed to load presets:', error);
        setOfficialPresets([]);
        setCommunityPresets([]);
      } finally {
        setIsLoadingPresets(false);
      }
    };

    fetchAllPresets();
  }, [isOpen]);

  // Event Listeners
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      const modalElement = document.getElementById('mockup-preset-modal');
      if (modalElement) modalElement.focus();

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  // Reset selections
  React.useEffect(() => {
    if (isOpen && !multiSelect) {
      setSelectedPresetIds(new Set());
    }
  }, [isOpen, multiSelect]);

  // Sync activeFilter with initialCategory when modal opens
  React.useEffect(() => {
    if (isOpen && initialCategory) {
      setActiveFilter(initialCategory);
    }
  }, [isOpen, initialCategory]);

  const handlePresetClick = (presetId: string) => {
    if (isLoading) return;

    if (multiSelect) {
      setSelectedPresetIds((prev) => {
        const next = new Set(prev);
        if (next.has(presetId)) {
          next.delete(presetId);
        } else if (next.size < maxSelections) {
          next.add(presetId);
        }
        return next;
      });
    } else {
      onSelectPreset?.(presetId);
      onClose();
    }
  };

  const handleSelectMockups = () => {
    if (selectedPresetIds.size > 0 && onSelectPresets) {
      onSelectPresets(Array.from(selectedPresetIds));
      setSelectedPresetIds(new Set());
    }
  };

  const isPresetSelected = (presetId: string) => {
    return multiSelect ? selectedPresetIds.has(presetId) : presetId === selectedPresetId;
  };

  const getSelectionIndex = (presetId: string) => {
    if (!multiSelect || !selectedPresetIds.has(presetId)) return undefined;
    return Array.from(selectedPresetIds).indexOf(presetId) + 1;
  };

  // Combine and filter all presets
  const allUnifiedPresets = React.useMemo(() => {
    // Convert official presets to unified format (presetType already set during fetch)
    const officialUnified: UnifiedPreset[] = officialPresets.map((preset: any) => ({
      id: preset.id,
      userId: 'system',
      category: preset.presetType || 'presets',
      presetType: preset.presetType || 'mockup',
      name: preset.name,
      description: preset.description,
      prompt: preset.prompt,
      referenceImageUrl: preset.referenceImageUrl,
      aspectRatio: preset.aspectRatio,
      isApproved: true,
      createdAt: preset.createdAt || new Date().toISOString(),
      updatedAt: preset.updatedAt || new Date().toISOString(),
      isOfficial: true,
    }));

    // Convert community presets to unified format (presetType already set during fetch)
    const communityUnified: UnifiedPreset[] = communityPresets.map((preset: any) => ({
      ...preset,
      category: preset.category || preset.presetType || 'presets',
      presetType: preset.presetType,
      isOfficial: false,
    }));

    // Convert user mockups to unified format
    const userUnified: UnifiedPreset[] = userMockups.map((mockup) => ({
      id: mockup._id || '',
      userId: 'user',
      category: 'mockup',
      presetType: 'mockup',
      name: mockup.prompt?.substring(0, 30) || 'Custom Mockup',
      description: mockup.prompt || '',
      prompt: mockup.prompt || '',
      referenceImageUrl: getImageUrl(mockup),
      aspectRatio: '16:9',
      isApproved: true,
      createdAt: mockup.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOfficial: false,
    }));

    // Deduplicate: Official > Community > User
    const seenIds = new Set<string>();
    const merged: UnifiedPreset[] = [];

    // Helper to generate unique key
    const getUniqueKey = (p: UnifiedPreset) => `${p.presetType}:${p.id}`;

    // Add presets in order of priority, ensuring no duplicates
    [...officialUnified, ...communityUnified, ...userUnified].forEach(p => {
      const key = getUniqueKey(p);
      if (!seenIds.has(key)) {
        seenIds.add(key);
        merged.push(p);
      }
    });

    return merged;
  }, [officialPresets, communityPresets, userMockups]);

  // Scroll container ref
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Reset scroll when filter changes
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeFilter]);

  // Filter presets by type and search query
  const filteredPresets = React.useMemo(() => {
    let result = allUnifiedPresets;

    // Filter by Source
    if (presetSource === 'official') {
      result = result.filter(p => p.isOfficial);
    } else if (presetSource === 'community') {
      result = result.filter(p => !p.isOfficial);
    }

    // Filter by Type
    if (activeFilter !== 'all') {
      result = result.filter(p => p.presetType === activeFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.prompt && p.prompt.toLowerCase().includes(query))
      );
    }

    return result;
  }, [allUnifiedPresets, activeFilter, searchQuery, presetSource]);

  // Count presets by type
  // Optimized: single pass reduce instead of multiple filter calls
  const presetCounts = React.useMemo(() => {
    const initialCounts: Record<PresetFilterType, number> = {
      all: 0, mockup: 0, texture: 0, angle: 0, ambience: 0, luminance: 0,
    };

    const counts = allUnifiedPresets.reduce((acc, p) => {
      acc.all++;
      if (p.presetType && Object.prototype.hasOwnProperty.call(acc, p.presetType)) {
        acc[p.presetType as PresetFilterType]++;
      }
      return acc;
    }, initialCounts);

    return counts;
  }, [allUnifiedPresets]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      id="mockup-preset-modal"
      tabIndex={-1}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mockup-preset-modal-title"
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] bg-black/95 backdrop-blur-xl border border-zinc-800/50 rounded-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-zinc-900/20">
          <div className="flex items-center gap-2">
            <ImageIcon size={20} className="text-brand-cyan" />
            <h2 id="mockup-preset-modal-title" className="text-sm font-mono text-zinc-300 uppercase tracking-wider">
              {multiSelect
                ? t('canvasNodes.promptNode.presetModal.titleMulti')
                  .replace('{selected}', selectedPresetIds.size.toString())
                  .replace('{max}', maxSelections.toString())
                : t('canvasNodes.promptNode.presetModal.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800/50 rounded-full"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Type Filters and Search */}
        <div className="flex flex-col border-b border-zinc-800/50 bg-zinc-900/10">
          <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {(['all', 'mockup', 'texture', 'angle', 'ambience', 'luminance'] as PresetFilterType[]).map((type) => {
              const config = CATEGORY_CONFIG[type as keyof typeof CATEGORY_CONFIG];
              const Icon = config ? config.icon : ImageIcon;
              const count = presetCounts[type];

              return (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase transition-all whitespace-nowrap border',
                    activeFilter === type
                      ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30'
                      : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <Icon size={12} />
                  <span>{t(`communityPresets.tabs.${type}`) || type}</span>
                  <span className="ml-1 text-[9px] opacity-60">({count})</span>
                </button>
              );
            })}

            {/* Create New Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = '/canvas';
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 ml-auto bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 rounded-full text-[10px] font-mono text-brand-cyan transition-all hover:scale-105 whitespace-nowrap"
            >
              <Plus size={12} />
              <span>{t('canvasNodes.promptNode.presetModal.createNew')}</span>
            </button>
          </div>

          {/* Search Bar & Source Filter */}
          <div className="px-4 py-3 border-t border-zinc-800/50 bg-zinc-900/5 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.search') || 'Search presets...'}
                className="pl-9 h-9 bg-zinc-900/50 border-zinc-800/50 focus:border-brand-cyan/30 focus:ring-1 focus:ring-brand-cyan/30 font-mono text-xs w-full"
              />
            </div>

            {/* Source Toggle */}
            <div className="flex bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-1 shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setPresetSource('all')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all',
                  presetSource === 'all'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
                title={t('communityPresets.filters.all') || 'All'}
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Todos</span>
              </button>
              <button
                onClick={() => setPresetSource('official')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all',
                  presetSource === 'official'
                    ? 'bg-amber-500/10 text-amber-500 shadow-sm'
                    : 'text-zinc-500 hover:text-amber-500/70'
                )}
                title={t('communityPresets.filters.official') || 'Official'}
              >
                <Crown size={14} />
                <span className="hidden sm:inline">Oficial</span>
              </button>
              <button
                onClick={() => setPresetSource('community')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all',
                  presetSource === 'community'
                    ? 'bg-brand-cyan/10 text-brand-cyan shadow-sm'
                    : 'text-zinc-500 hover:text-brand-cyan/70'
                )}
                title={t('communityPresets.filters.community') || 'Community'}
              >
                <Globe size={14} />
                <span className="hidden sm:inline">Comunidade</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 custom-scrollbar bg-black/50">
          {isLoadingPresets ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
              <div className="w-6 h-6 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin"></div>
              <p className="text-xs font-mono">{t('canvasNodes.promptNode.presetModal.loading')}</p>
            </div>
          ) : filteredPresets.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm font-mono text-zinc-500">{t('canvasNodes.promptNode.presetModal.noCommunity')}</p>
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
              }}
            >
              {filteredPresets.map((preset) => (
                <div key={`${preset.presetType || 'default'}-${preset.id}`} className="relative">
                  {preset.isOfficial && (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[8px] font-mono text-amber-400 uppercase backdrop-blur-sm">
                      <Crown size={8} />
                      <span>{t('canvasNodes.promptNode.presetModal.official') || 'Official'}</span>
                    </div>
                  )}
                  <PresetCard
                    preset={preset}
                    onClick={() => handlePresetClick(preset.id)}
                    isAuthenticated={true}
                    canEdit={false}
                    t={t}
                    selected={isPresetSelected(preset.id)}
                    selectionIndex={getSelectionIndex(preset.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Select Mockups button (multi-select mode only) */}
        {multiSelect && (
          <div className="border-t border-zinc-800/50 p-4 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md">
            <div className="text-xs font-mono text-zinc-400">
              {selectedPresetIds.size === 0
                ? t('canvasNodes.promptNode.presetModal.multiSelectMessageEmpty').replace('{max}', maxSelections.toString())
                : t('canvasNodes.promptNode.presetModal.multiSelectMessage')
                  .replace('{selected}', selectedPresetIds.size.toString())
                  .replace('{max}', maxSelections.toString())}
            </div>
            <button
              onClick={handleSelectMockups}
              disabled={selectedPresetIds.size === 0 || isLoading}
              className={cn(
                'px-6 py-2.5 bg-brand-cyan text-black font-semibold rounded-md text-xs font-mono transition-all hover:bg-brand-cyan/90 hover:shadow-lg hover:shadow-brand-cyan/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
                selectedPresetIds.size > 0 && 'animate-pulse-subtle'
              )}
            >
              {t('canvasNodes.promptNode.presetModal.confirmSelection')}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
