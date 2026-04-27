import React, { useState, useMemo, useContext, useDeferredValue } from 'react';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { useTranslation } from '@/hooks/useTranslation';
import { MockupContext } from '@/components/mockupmachine/MockupContext';
import { ImageIcon, Plus, Search, LayoutGrid, List, Paintbrush, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useCanvasHeader } from '@/components/canvas/CanvasHeaderContext';
import { useBrandKitSafe } from '@/contexts/BrandKitContext';

interface BrandMediaLibraryPanelProps {
  onSelectAsset?: (url: string, type: 'image' | 'logo' | 'color') => void;
  onAddToBoard?: (url: string, type: 'image' | 'logo') => void;
  guidelineId?: string | null;
}

type TabType = 'logos' | 'media' | 'colors' | 'all';

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
    queryFn: () => selectedBrandGuidelineId ? brandGuidelineApi.getById(selectedBrandGuidelineId) : null,
    enabled: !!selectedBrandGuidelineId,
    staleTime: 5 * 60 * 1000,
  });

  const { filteredLogos, filteredMedia, colors } = useMemo(() => {
    if (!guideline) return { filteredLogos: [], filteredMedia: [], colors: [] };
    const query = deferredSearchQuery.toLowerCase();
    return {
      filteredLogos: (guideline.logos || []).filter(l => !query || l.label?.toLowerCase().includes(query)),
      filteredMedia: (guideline.media || []).filter(m => !query || m.label?.toLowerCase().includes(query)),
      colors: guideline.colors || [],
    };
  }, [guideline, deferredSearchQuery]);

  const handleAssetSelect = (url: string, type: 'image' | 'logo') => {
    if (onSelectAsset) { onSelectAsset(url, type); toast.success('Asset referenced'); }
    else if (onAddToBoard) { onAddToBoard(url, type); toast.success('Asset added to board'); }
  };

  const handleApplyToTheme = (hex: string, mode: 'background' | 'primary') => {
    if (mode === 'background') { canvasHeader.setBackgroundColor(hex); toast.success('Canvas Background updated'); }
    else { canvasHeader.setBrandCyan(hex); toast.success('Brand Primary Color updated'); }
  };

  if (!selectedBrandGuidelineId) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mb-3 border border-dashed border-neutral-800">
          <LayoutGrid className="text-neutral-600" size={20} />
        </div>
        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">No Brand Selected</p>
        <p className="text-[10px] text-neutral-700 mt-1 font-mono">Select a brand in the canvas header.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab + search bar */}
      <div className="flex flex-col gap-2 p-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-1 p-0.5 bg-neutral-900/50 border border-white/5 rounded-md">
          {(['all', 'logos', 'media', 'colors'] as TabType[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn('flex-1 py-1 rounded text-[9px] font-mono uppercase tracking-wider font-bold transition-all',
                activeTab === tab ? 'bg-brand-cyan text-black' : 'text-neutral-500 hover:text-neutral-300'
              )}
            >
              {t(`common.tabs.${tab}`) || tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600" size={11} />
            <input type="text" placeholder="Search assets..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900/50 border border-white/5 rounded-md pl-7 pr-2 py-1 text-[10px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 font-mono"
            />
          </div>
          <div className="flex items-center border border-white/5 rounded-md bg-neutral-900/30">
            <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-l transition-colors', viewMode==='grid'?'text-brand-cyan':'text-neutral-600 hover:text-neutral-400')}><LayoutGrid size={12} /></button>
            <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded-r transition-colors', viewMode==='list'?'text-brand-cyan':'text-neutral-600 hover:text-neutral-400')}><List size={12} /></button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(6)].map((_, i) => <SkeletonLoader key={i} height="80px" width="100%" className="rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-5 pb-6">
            {(activeTab === 'all' || activeTab === 'logos') && filteredLogos.length > 0 && (
              <div className="space-y-2">
                <MicroTitle className="text-neutral-600">Logotypes</MicroTitle>
                <div className={cn(viewMode==='grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1')}>
                  {filteredLogos.map((logo, i) => (
                    <AssetCard key={`logo-${i}`} url={logo.url!} label={logo.label || `Logo ${i+1}`} type="logo"
                      viewMode={viewMode} onClick={() => handleAssetSelect(logo.url!, 'logo')}
                      onAdd={onAddToBoard ? () => onAddToBoard(logo.url!, 'logo') : undefined} />
                  ))}
                </div>
              </div>
            )}
            {(activeTab === 'all' || activeTab === 'media') && filteredMedia.length > 0 && (
              <div className="space-y-2">
                <MicroTitle className="text-neutral-600">Brand Assets</MicroTitle>
                <div className={cn(viewMode==='grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1')}>
                  {filteredMedia.map((asset, i) => (
                    <AssetCard key={`media-${i}`} url={asset.url!} label={asset.label || `Asset ${i+1}`} type="image"
                      viewMode={viewMode} onClick={() => handleAssetSelect(asset.url!, 'image')}
                      onAdd={onAddToBoard ? () => onAddToBoard(asset.url!, 'image') : undefined} />
                  ))}
                </div>
              </div>
            )}
            {(activeTab === 'all' || activeTab === 'colors') && colors.length > 0 && (
              <div className="space-y-2">
                <MicroTitle className="text-neutral-600">Palette</MicroTitle>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color, i) => (
                    <div key={i} className="group relative flex flex-col items-center gap-1 cursor-pointer"
                      onClick={() => { navigator.clipboard.writeText(color.hex || ''); toast.success(`Copied ${color.hex}`); }}
                    >
                      <div className="w-10 h-10 rounded-lg border border-white/10 group-hover:scale-110 transition-transform shadow"
                        style={{ backgroundColor: color.hex }} />
                      <span className="text-[9px] font-mono text-neutral-600">{color.hex}</span>
                      <div className="absolute top-0.5 right-0.5 flex-col gap-0.5 hidden group-hover:flex">
                        <button onClick={e => { e.stopPropagation(); handleApplyToTheme(color.hex!, 'background'); }}
                          className="p-0.5 rounded bg-black/60 text-white hover:text-brand-cyan" title="Apply as BG"><Paintbrush size={8} /></button>
                        <button onClick={e => { e.stopPropagation(); handleApplyToTheme(color.hex!, 'primary'); }}
                          className="p-0.5 rounded bg-black/60 text-white hover:text-brand-cyan" title="Set as Primary"><Zap size={8} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {guideline && !filteredLogos.length && !filteredMedia.length && !colors.length && (
              <p className="text-[10px] font-mono text-neutral-700 text-center py-10 uppercase tracking-widest">No assets found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Asset Card (shared) ──────────────────────────────────────────────────────
interface AssetCardProps { url: string; label: string; type: 'image'|'logo'; viewMode: 'grid'|'list'; onClick: ()=>void; onAdd?: ()=>void; }

const AssetCard: React.FC<AssetCardProps> = ({ url, label, type, viewMode, onClick, onAdd }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/vsn-asset-url', url);
    e.dataTransfer.setData('application/vsn-asset-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (viewMode === 'list') {
    return (
      <div draggable onDragStart={handleDragStart}
        className="flex items-center gap-3 p-2 rounded-md bg-neutral-900/30 border border-white/5 hover:border-neutral-700 transition-all group cursor-pointer"
        onClick={onClick}>
        <div className="w-8 h-8 rounded overflow-hidden bg-neutral-950 flex-shrink-0">
          <img src={url} alt={label} className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono font-bold text-neutral-400 truncate">{label}</p>
          <p className="text-[9px] font-mono text-neutral-600">{type === 'logo' ? 'Logo' : 'Image'}</p>
        </div>
        {onAdd && (
          <button onClick={e => { e.stopPropagation(); onAdd(); }}
            className="p-1 rounded bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus size={10} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div draggable onDragStart={handleDragStart}
      className="flex flex-col gap-1.5 p-2 rounded-lg bg-neutral-900/30 border border-white/5 hover:border-neutral-700 transition-all group cursor-pointer"
      onClick={onClick}>
      <div className="relative aspect-square w-full rounded-md overflow-hidden bg-neutral-950 flex items-center justify-center p-2">
        <img src={url} alt={label} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300" />
        {onAdd && (
          <button onClick={e => { e.stopPropagation(); onAdd(); }}
            className="absolute top-1 right-1 p-1 rounded bg-brand-cyan/90 text-black opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus size={10} />
          </button>
        )}
      </div>
      <p className="text-[9px] font-mono text-neutral-500 truncate text-center">{label}</p>
    </div>
  );
};
