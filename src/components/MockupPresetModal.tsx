import React from 'react';
import { Image as ImageIcon, Plus, Crown, Search, Globe, LayoutGrid } from '@/lib/ui/icons';
import { Input } from './ui/input';
import type { MockupPresetType, MockupPreset } from '../types/mockupPresets';
import type { Mockup } from '../services/mockupApi';
import { getImageUrl } from '@/utils/imageUtils';
import { updatePresetsCache } from '../services/mockupPresetsService';
import { getAllCommunityPresets } from '../services/communityPresetsService';
import { PresetCard, CATEGORY_CONFIG } from './PresetCard';
import type { CommunityPrompt } from '../types/communityPrompts';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchAllOfficialPresets } from '../services/unifiedPresetService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Modal } from './ui/Modal';

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
  const { t, tOr } = useTranslation();
  const [officialPresets, setOfficialPresets] = React.useState<MockupPreset[]>([]);
  const [communityPresets, setCommunityPresets] = React.useState<any[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = React.useState(false);
  const [selectedPresetIds, setSelectedPresetIds] = React.useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = React.useState<PresetFilterType>(
    initialCategory || 'all'
  );
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
          return presets
            .map((p: any) => {
              if (!p) return null;
              return {
                ...p,
                referenceImageUrl: p.referenceImageUrl || '',
                presetType, // Force override
              };
            })
            .filter(Boolean);
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
        const mockupOnly = allOfficialPresets.filter((p) => p.presetType === 'mockup');
        if (mockupOnly.length > 0) {
          updatePresetsCache(mockupOnly);
        }

        // Fetch community presets
        const allCommunity = await getAllCommunityPresets();
        const flattened: any[] = [];
        Object.entries(allCommunity).forEach(([type, list]) => {
          if (Array.isArray(list)) {
            list.forEach((p) => {
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
    [...officialUnified, ...communityUnified, ...userUnified].forEach((p) => {
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
      // O ref é o filho direto do corpo rolável do <Modal>.
      scrollContainerRef.current.parentElement?.scrollTo({ top: 0 });
    }
  }, [activeFilter]);

  // Filter presets by type and search query
  const filteredPresets = React.useMemo(() => {
    let result = allUnifiedPresets;

    // Filter by Source
    if (presetSource === 'official') {
      result = result.filter((p) => p.isOfficial);
    } else if (presetSource === 'community') {
      result = result.filter((p) => !p.isOfficial);
    }

    // Filter by Type
    if (activeFilter !== 'all') {
      result = result.filter((p) => p.presetType === activeFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
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
      all: 0,
      mockup: 0,
      texture: 0,
      angle: 0,
      ambience: 0,
      luminance: 0,
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

  const categoryOptions = (
    ['all', 'mockup', 'texture', 'angle', 'ambience', 'luminance'] as PresetFilterType[]
  ).map((type) => {
    const config = CATEGORY_CONFIG[type as keyof typeof CATEGORY_CONFIG];
    return {
      value: type,
      icon: config ? config.icon : ImageIcon,
      label: (
        <>
          <span>{tOr(`communityPresets.tabs.${type}`, type)}</span>
          <span className="text-muted-foreground tabular-nums">{presetCounts[type]}</span>
        </>
      ),
    };
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      id="mockup-preset-modal"
      size="xl"
      contentClassName="sm:max-w-4xl"
      headerClassName="p-4 sm:p-4"
      bodyClassName="p-0 sm:p-0 md:p-0"
      title={
        multiSelect
          ? t('canvasNodes.promptNode.presetModal.titleMulti')
              .replace('{selected}', selectedPresetIds.size.toString())
              .replace('{max}', maxSelections.toString())
          : t('canvasNodes.promptNode.presetModal.title')
      }
      footerClassName="justify-between p-4 sm:p-4"
      footer={
        multiSelect ? (
          <>
            <div className="text-xs text-muted-foreground">
              {selectedPresetIds.size === 0
                ? t('canvasNodes.promptNode.presetModal.multiSelectMessageEmpty').replace(
                    '{max}',
                    maxSelections.toString()
                  )
                : t('canvasNodes.promptNode.presetModal.multiSelectMessage')
                    .replace('{selected}', selectedPresetIds.size.toString())
                    .replace('{max}', maxSelections.toString())}
            </div>
            <Button
              variant="primary"
              onClick={handleSelectMockups}
              disabled={selectedPresetIds.size === 0 || isLoading}
            >
              {t('canvasNodes.promptNode.presetModal.confirmSelection')}
            </Button>
          </>
        ) : undefined
      }
    >
      {/* O corpo do Modal rola sem padding (bodyClassName): os filtros grudam no topo
          dele e o padding mora só no bloco de conteúdo abaixo. */}
      <div ref={scrollContainerRef}>
        <div className="sticky top-0 z-10 flex flex-col border-b border-border bg-popover">
          {/* Type Filters */}
          <div className="px-4 py-3 flex items-center gap-2">
            <SegmentedControl
              aria-label={t('canvasNodes.promptNode.presetModal.title')}
              size="sm"
              scrollable
              className="min-w-0"
              value={activeFilter}
              onChange={setActiveFilter}
              options={categoryOptions}
            />

            {/* Create New Button */}
            <Button
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = '/canvas';
              }}
              className="ml-auto shrink-0 gap-1.5"
            >
              <Plus size={12} />
              <span>{t('canvasNodes.promptNode.presetModal.createNew')}</span>
            </Button>
          </div>

          {/* Search Bar & Source Filter */}
          <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.search')}
                className="pl-9 h-9 text-xs w-full"
              />
            </div>

            {/* Source Toggle */}
            <SegmentedControl
              aria-label={t('communityPresets.filters.title')}
              size="sm"
              className="shrink-0 self-start sm:self-auto"
              value={presetSource}
              onChange={setPresetSource}
              options={[
                { value: 'all', icon: LayoutGrid, label: t('communityPresets.filters.all') },
                {
                  value: 'official',
                  icon: Crown,
                  label: t('communityPresets.filters.official'),
                },
                {
                  value: 'community',
                  icon: Globe,
                  label: t('communityPresets.filters.community'),
                },
              ]}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-4 sm:px-10 sm:pb-10 md:px-12 md:pb-12">
          {isLoadingPresets ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin"></div>
              <p className="text-xs">{t('canvasNodes.promptNode.presetModal.loading')}</p>
            </div>
          ) : filteredPresets.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground">
                {t('canvasNodes.promptNode.presetModal.noCommunity')}
              </p>
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              }}
            >
              {filteredPresets.map((preset) => (
                <PresetCard
                  key={`${preset.presetType || 'default'}-${preset.id}`}
                  preset={preset}
                  onClick={() => handlePresetClick(preset.id)}
                  isAuthenticated={true}
                  canEdit={false}
                  t={t}
                  selected={isPresetSelected(preset.id)}
                  selectionIndex={getSelectionIndex(preset.id)}
                  badge={
                    preset.isOfficial ? (
                      <Badge variant="warning" className="gap-1 px-1.5 text-2xs">
                        <Crown size={10} />
                        {t('canvasNodes.promptNode.presetModal.official')}
                      </Badge>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
