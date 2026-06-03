import React, { useState, useMemo, useContext, useDeferredValue, useCallback } from 'react';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { useTranslation } from '@/hooks/useTranslation';
import { MockupContext } from '@/components/mockupmachine/MockupContext';
import {
  ImageIcon,
  Plus,
  Search,
  LayoutGrid,
  List,
  Paintbrush,
  Zap,
  X,
  Eraser,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/components/shared/ToolPanel';
import { useNeedsLightBg } from '@/hooks/useNeedsLightBg';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useCanvasHeader } from '@/components/canvas/CanvasHeaderContext';
import { useBrandKitSafe } from '@/contexts/BrandKitContext';
import { copyToClipboard } from '@/utils/clipboard';
import { REFERENCE_DIMENSIONS, type ReferenceDimensionKey } from '@/constants/referenceDimensions';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { useReferenceSearch } from '@/hooks/useReferenceSearch';
import { referenceApi, type ReferenceResult } from '@/services/referenceApi';

interface BrandMediaLibraryPanelProps {
  onSelectAsset?: (url: string, type: 'image' | 'logo' | 'color') => void;
  onAddToBoard?: (url: string, type: 'image' | 'logo') => void;
  guidelineId?: string | null;
}

type TabType = 'logos' | 'media' | 'colors' | 'all' | 'refs';

export const BrandMediaLibraryPanel: React.FC<BrandMediaLibraryPanelProps> = ({
  onSelectAsset: propOnSelectAsset,
  onAddToBoard: propOnAddToBoard,
  guidelineId: propGuidelineId,
}) => {
  const { t } = useTranslation();
  const canvasHeader = useCanvasHeader();
  const brandKit = useBrandKitSafe();
  const mockupContext = useContext(MockupContext);
  const mockupGuideline = mockupContext?.selectedBrandGuideline ?? null;

  // Fall back to context callbacks when no props provided (side panel mode)
  const onSelectAsset = propOnSelectAsset ?? brandKit?.libraryCallbacks.onSelectAsset;
  const onAddToBoard = propOnAddToBoard ?? brandKit?.libraryCallbacks.onAddToBoard;

  const selectedBrandGuidelineId = propGuidelineId ?? brandKit?.activeBrandId ?? mockupGuideline;

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const { data: guideline, isLoading } = useQuery({
    queryKey: ['brand-guideline', selectedBrandGuidelineId],
    queryFn: () =>
      selectedBrandGuidelineId ? brandGuidelineApi.getById(selectedBrandGuidelineId) : null,
    enabled: !!selectedBrandGuidelineId,
    staleTime: 5 * 60 * 1000,
  });

  const { filteredLogos, filteredMedia, colors } = useMemo(() => {
    if (!guideline) return { filteredLogos: [], filteredMedia: [], colors: [] };
    const query = deferredSearchQuery.toLowerCase();
    return {
      filteredLogos: (guideline.logos || []).filter(
        (l) => !query || l.label?.toLowerCase().includes(query)
      ),
      filteredMedia: (guideline.media || []).filter(
        (m) => !query || m.label?.toLowerCase().includes(query)
      ),
      colors: guideline.colors || [],
    };
  }, [guideline, deferredSearchQuery]);

  const handleAssetSelect = (url: string, type: 'image' | 'logo') => {
    if (onSelectAsset) {
      onSelectAsset(url, type);
      toast.success('Asset referenced');
    } else if (onAddToBoard) {
      onAddToBoard(url, type);
      toast.success('Asset added to board');
    }
  };

  const handleApplyToTheme = (hex: string, mode: 'background' | 'primary') => {
    if (mode === 'background') {
      canvasHeader.setBackgroundColor(hex);
      toast.success('Canvas Background updated');
    } else {
      canvasHeader.setBrandCyan(hex);
      toast.success('Brand Primary Color updated');
    }
  };

  // ── References tab — smart ranking via hook ──
  const [expandedDim, setExpandedDim] = useState<ReferenceDimensionKey | null>(null);
  const refFilterKeys: ReferenceDimensionKey[] = [
    'mockup_type',
    'aesthetic',
    'vibe',
    'niche',
    'lighting',
  ];
  const refSearch = useReferenceSearch({
    brandGuidelineId: selectedBrandGuidelineId,
    enabled: activeTab === 'refs',
  });

  const [sanitizingIds, setSanitizingIds] = useState<Set<string>>(new Set());

  const handleSanitize = useCallback(
    async (ref: ReferenceResult) => {
      setSanitizingIds((prev) => new Set(prev).add(ref.id));
      const toastId = toast.loading('Sanitizando referência...');
      try {
        const newUrl = await referenceApi.sanitize(ref);
        refSearch.updateResult(ref.id, { referenceImageUrl: newUrl, sanitized: true });
        toast.success('Referência sanitizada com sucesso', { id: toastId });
      } catch {
        toast.error('Erro ao sanitizar referência', { id: toastId });
      } finally {
        setSanitizingIds((prev) => {
          const next = new Set(prev);
          next.delete(ref.id);
          return next;
        });
      }
    },
    [refSearch]
  );

  if (!selectedBrandGuidelineId && activeTab !== 'refs') {
    return (
      <div className="flex flex-col h-full">
        {/* Show tabs even without brand — so refs tab is accessible */}
        <div className="flex flex-col gap-2 p-2 border-b border-white/[0.06]">
          <SegmentedControl
            variant="brand"
            size="sm"
            value={activeTab}
            onChange={(v) => setActiveTab(v as TabType)}
            options={(['all', 'logos', 'media', 'colors', 'refs'] as TabType[]).map((tab) => ({
              value: tab,
              label: tab === 'refs' ? 'Refs' : t(`common.tabs.${tab}`) || tab,
            }))}
          />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 py-16 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mb-3 border border-dashed border-neutral-800">
            <LayoutGrid className="text-neutral-600" size={20} />
          </div>
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
            No Brand Selected
          </p>
          <p className="text-[10px] text-neutral-700 mt-1 font-mono">
            Select a brand or browse References.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab + search bar */}
      <div className="flex flex-col gap-2 p-2 border-b border-white/[0.06]">
        <SegmentedControl
          variant="brand"
          size="sm"
          value={activeTab}
          onChange={(v) => setActiveTab(v as TabType)}
          options={(['all', 'logos', 'media', 'colors', 'refs'] as TabType[]).map((tab) => ({
            value: tab,
            label: tab === 'refs' ? 'Refs' : t(`common.tabs.${tab}`) || tab,
          }))}
        />
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600"
              size={11}
            />
            <input
              type="text"
              placeholder={activeTab === 'refs' ? 'Search references...' : 'Search assets...'}
              value={activeTab === 'refs' ? refSearch.query : searchQuery}
              onChange={(e) =>
                activeTab === 'refs'
                  ? refSearch.setQuery(e.target.value)
                  : setSearchQuery(e.target.value)
              }
              className="w-full bg-neutral-900/50 border border-white/5 rounded-md pl-7 pr-2 py-1 text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 font-mono"
            />
          </div>
          <div className="flex items-center border border-white/5 rounded-md bg-neutral-900/30">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-l transition-colors',
                viewMode === 'grid' ? 'text-brand-cyan' : 'text-neutral-600 hover:text-neutral-400'
              )}
            >
              <LayoutGrid size={12} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 rounded-r transition-colors',
                viewMode === 'list' ? 'text-brand-cyan' : 'text-neutral-600 hover:text-neutral-400'
              )}
            >
              <List size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(6)].map((_, i) => (
              <SkeletonLoader key={i} height="80px" width="100%" className="rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-5 pb-6">
            {(activeTab === 'all' || activeTab === 'logos') && filteredLogos.length > 0 && (
              <div className="space-y-2">
                <MicroTitle className="text-neutral-600">Logotypes</MicroTitle>
                <div
                  className={cn(
                    viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1'
                  )}
                >
                  {filteredLogos.map((logo, i) => (
                    <AssetCard
                      key={`logo-${i}`}
                      url={logo.url!}
                      label={logo.label || `Logo ${i + 1}`}
                      type="logo"
                      viewMode={viewMode}
                      onClick={() => handleAssetSelect(logo.url!, 'logo')}
                      onAdd={onAddToBoard ? () => onAddToBoard(logo.url!, 'logo') : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
            {(activeTab === 'all' || activeTab === 'media') && filteredMedia.length > 0 && (
              <div className="space-y-2">
                <MicroTitle className="text-neutral-600">Brand Assets</MicroTitle>
                <div
                  className={cn(
                    viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1'
                  )}
                >
                  {filteredMedia.map((asset, i) => (
                    <AssetCard
                      key={`media-${i}`}
                      url={asset.url!}
                      label={asset.label || `Asset ${i + 1}`}
                      type="image"
                      viewMode={viewMode}
                      onClick={() => handleAssetSelect(asset.url!, 'image')}
                      onAdd={onAddToBoard ? () => onAddToBoard(asset.url!, 'image') : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
            {(activeTab === 'all' || activeTab === 'colors') && colors.length > 0 && (
              <div className="space-y-2">
                <MicroTitle className="text-neutral-600">Palette</MicroTitle>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color, i) => (
                    <div
                      key={i}
                      className="group relative flex flex-col items-center gap-1 cursor-pointer"
                      onClick={() => {
                        copyToClipboard(color.hex || '');
                        toast.success(`Copied ${color.hex}`);
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg border border-white/10 group-hover:scale-110 transition-transform shadow"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="text-[9px] font-mono text-neutral-600">{color.hex}</span>
                      <div className="absolute top-0.5 right-0.5 flex-col gap-0.5 hidden group-hover:flex">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyToTheme(color.hex!, 'background');
                          }}
                          className="p-0.5 rounded bg-black/60 text-white hover:text-brand-cyan"
                          title="Apply as BG"
                        >
                          <Paintbrush size={8} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyToTheme(color.hex!, 'primary');
                          }}
                          className="p-0.5 rounded bg-black/60 text-white hover:text-brand-cyan"
                          title="Set as Primary"
                        >
                          <Zap size={8} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* References tab — smart ranked */}
            {activeTab === 'refs' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <MicroTitle className="text-neutral-600">
                    {selectedBrandGuidelineId ? 'Smart References' : 'Curated References'}
                  </MicroTitle>
                  {refSearch.activeFilterCount > 0 && (
                    <button
                      onClick={refSearch.clearFilters}
                      className="text-[9px] text-brand-cyan/60 hover:text-brand-cyan font-mono uppercase flex items-center gap-0.5"
                    >
                      <X size={8} /> Clear
                    </button>
                  )}
                </div>
                {/* Dimension refinement chips */}
                <div className="flex flex-wrap gap-1 relative">
                  {refFilterKeys.map((key) => {
                    const activeValue = refSearch.dimFilters[key];
                    const label = key.replace('_', ' ');
                    const isExp = expandedDim === key;
                    return (
                      <div key={key} className="relative">
                        <button
                          onClick={() => setExpandedDim(isExp ? null : key)}
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider border transition-all',
                            activeValue
                              ? 'bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan'
                              : 'bg-neutral-900/60 border-neutral-800 text-neutral-500 hover:text-white'
                          )}
                        >
                          {activeValue || label}
                        </button>
                        {isExp && (
                          <div className="absolute top-full left-0 mt-1 z-50 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl p-1.5 min-w-[130px] max-h-[180px] overflow-y-auto">
                            {REFERENCE_DIMENSIONS[key].map((v) => (
                              <button
                                key={v}
                                onClick={() => {
                                  refSearch.toggleDimFilter(key, v);
                                  setExpandedDim(null);
                                }}
                                className={cn(
                                  'block w-full text-left px-2 py-1 text-[10px] rounded transition-colors',
                                  refSearch.dimFilters[key] === v
                                    ? 'bg-brand-cyan/10 text-brand-cyan'
                                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                                )}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {expandedDim && (
                    <div
                      className="fixed inset-0 z-40"
                      role="button"
                      tabIndex={-1}
                      aria-label="Close filter dropdown"
                      onClick={() => setExpandedDim(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setExpandedDim(null);
                      }}
                    />
                  )}
                </div>
                {/* Smart grid */}
                {refSearch.isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <GlitchLoader size={16} />
                  </div>
                ) : refSearch.results.length === 0 ? (
                  <p className="text-[10px] font-mono text-neutral-700 text-center py-10 uppercase tracking-widest">
                    No references found
                  </p>
                ) : (
                  <div
                    className={cn(
                      viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1'
                    )}
                  >
                    {refSearch.results.map((ref) => {
                      const isRecommended = ref.relevanceScore >= 0.7;

                      if (viewMode === 'list') {
                        return (
                          <div
                            key={ref.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                'application/vsn-asset-url',
                                ref.referenceImageUrl
                              );
                              e.dataTransfer.setData('application/vsn-asset-type', 'image');
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onClick={() => {
                              if (onAddToBoard) onAddToBoard(ref.referenceImageUrl, 'image');
                              toast.success('Reference added');
                            }}
                            className={cn(
                              'flex items-center gap-3 p-2 rounded-md bg-neutral-900/30 border transition-all group cursor-pointer',
                              isRecommended
                                ? 'border-brand-cyan/20'
                                : 'border-white/5 hover:border-neutral-700'
                            )}
                          >
                            <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-neutral-950">
                              <img
                                src={ref.referenceImageUrl}
                                alt={ref.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-mono font-bold text-neutral-400 truncate">
                                {ref.name}
                              </p>
                              <div className="flex gap-0.5 mt-0.5">
                                {[
                                  ...(ref.dimensions.mockup_type || []).slice(0, 1),
                                  ...(ref.dimensions.aesthetic || []).slice(0, 1),
                                ].map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[7px] px-1 py-0.5 rounded bg-white/10 text-white/60"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {isRecommended && (
                              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-brand-cyan/90 text-black">
                                <Zap size={7} />
                                <span className="text-[7px] font-bold uppercase tracking-wider">
                                  Match
                                </span>
                              </div>
                            )}
                            {!ref.sanitized && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSanitize(ref);
                                }}
                                disabled={sanitizingIds.has(ref.id)}
                                className="p-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                title="Sanitizar — remover branding do studio"
                              >
                                {sanitizingIds.has(ref.id) ? (
                                  <GlitchLoader size={10} />
                                ) : (
                                  <Eraser size={10} />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={ref.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              'application/vsn-asset-url',
                              ref.referenceImageUrl
                            );
                            e.dataTransfer.setData('application/vsn-asset-type', 'image');
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onClick={() => {
                            if (onAddToBoard) onAddToBoard(ref.referenceImageUrl, 'image');
                            toast.success('Reference added');
                          }}
                          className={cn(
                            'group relative aspect-square rounded-lg overflow-hidden bg-neutral-900 border transition-all cursor-pointer',
                            isRecommended
                              ? 'border-brand-cyan/20 shadow-[0_0_8px_rgba(var(--brand-cyan-rgb),0.08)]'
                              : 'border-white/5 hover:border-neutral-700'
                          )}
                        >
                          <img
                            src={ref.referenceImageUrl}
                            alt={ref.name}
                            loading="lazy"
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                          />
                          {isRecommended && (
                            <div className="absolute top-1 left-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-brand-cyan/90 text-black">
                              <Zap size={7} />
                              <span className="text-[7px] font-bold uppercase tracking-wider">
                                Match
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[9px] font-medium text-white truncate">{ref.name}</p>
                            <div className="flex gap-0.5 mt-0.5">
                              {[
                                ...(ref.dimensions.mockup_type || []).slice(0, 1),
                                ...(ref.dimensions.aesthetic || []).slice(0, 1),
                              ].map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[7px] px-1 py-0.5 rounded bg-white/10 text-white/60"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-4 h-4 rounded-full bg-brand-cyan/80 flex items-center justify-center">
                              <Plus size={8} className="text-black" />
                            </div>
                            {!ref.sanitized && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSanitize(ref);
                                }}
                                disabled={sanitizingIds.has(ref.id)}
                                className="w-4 h-4 rounded-full bg-amber-500/80 flex items-center justify-center hover:bg-amber-400 transition-colors disabled:opacity-50"
                                title="Sanitizar — remover branding do studio"
                              >
                                {sanitizingIds.has(ref.id) ? (
                                  <GlitchLoader size={6} />
                                ) : (
                                  <Eraser size={8} className="text-black" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {activeTab !== 'refs' &&
              guideline &&
              !filteredLogos.length &&
              !filteredMedia.length &&
              !colors.length && (
                <p className="text-[10px] font-mono text-neutral-700 text-center py-10 uppercase tracking-widest">
                  No assets found
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Dark image detection (shared hook) ──────────────────────────────────────
// useNeedsLightBg imported from @/hooks/useNeedsLightBg

// ─── Asset Card (shared) ──────────────────────────────────────────────────────
interface AssetCardProps {
  url: string;
  label: string;
  type: 'image' | 'logo';
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onAdd?: () => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ url, label, type, viewMode, onClick, onAdd }) => {
  const needsLightBg = useNeedsLightBg(url);
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/vsn-asset-url', url);
    e.dataTransfer.setData('application/vsn-asset-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (viewMode === 'list') {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        className="flex items-center gap-3 p-2 rounded-md bg-neutral-900/30 border border-white/5 hover:border-neutral-700 transition-all group cursor-pointer"
        onClick={onClick}
      >
        <div
          className={cn(
            'w-8 h-8 rounded overflow-hidden flex-shrink-0',
            needsLightBg ? 'bg-white' : 'bg-neutral-950'
          )}
        >
          <img src={url} alt={label} className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono font-bold text-neutral-400 truncate">{label}</p>
          <p className="text-[9px] font-mono text-neutral-600">
            {type === 'logo' ? 'Logo' : 'Image'}
          </p>
        </div>
        {onAdd && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="p-1 rounded bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus size={10} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex flex-col gap-1.5 p-2 rounded-lg bg-neutral-900/30 border border-white/5 hover:border-neutral-700 transition-all group cursor-pointer"
      onClick={onClick}
    >
      <div
        className={cn(
          'relative aspect-square w-full rounded-md overflow-hidden flex items-center justify-center p-2',
          needsLightBg ? 'bg-white' : 'bg-neutral-950'
        )}
      >
        <img
          src={url}
          alt={label}
          className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300"
        />
        {onAdd && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="absolute top-1 right-1 p-1 rounded bg-brand-cyan/90 text-black opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus size={10} />
          </button>
        )}
      </div>
      <p className="text-[9px] font-mono text-neutral-500 truncate text-center">{label}</p>
    </div>
  );
};
