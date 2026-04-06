import React, { useState, useMemo, useContext, useDeferredValue } from 'react';
import { Modal } from '@/components/ui/Modal';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { useTranslation } from '@/hooks/useTranslation';
import { MockupContext } from '@/components/mockupmachine/MockupContext';
import { Loader2, ImageIcon, Palette, Type, Plus, ChevronRight, Search, LayoutGrid, List, Paintbrush, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import type { BrandGuideline } from '@/lib/figma-types';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useCanvasHeader } from '@/components/canvas/CanvasHeaderContext';

interface BrandMediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset?: (url: string, type: 'image' | 'logo' | 'color') => void;
  onAddToBoard?: (url: string, type: 'image' | 'logo') => void;
  /** Override guideline ID (for canvas context where MockupContext isn't available) */
  guidelineId?: string | null;
}

type TabType = 'logos' | 'media' | 'colors' | 'all';

export const BrandMediaLibraryModal: React.FC<BrandMediaLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectAsset,
  onAddToBoard,
  guidelineId: propGuidelineId
}) => {
  const { t } = useTranslation();
  const canvasHeader = useCanvasHeader();
  const mockupContext = useContext(MockupContext);
  const mockupGuideline = mockupContext?.selectedBrandGuideline ?? null;
  const selectedBrandGuidelineId = propGuidelineId ?? mockupGuideline;

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const { data: guideline, isLoading } = useQuery({
    queryKey: ['brand-guideline', selectedBrandGuidelineId],
    queryFn: () => selectedBrandGuidelineId ? brandGuidelineApi.getById(selectedBrandGuidelineId) : null,
    enabled: !!selectedBrandGuidelineId && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const { filteredLogos, filteredMedia, colors } = useMemo(() => {
    if (!guideline) return { filteredLogos: [], filteredMedia: [], colors: [] };
    
    const query = deferredSearchQuery.toLowerCase();
    const logos = guideline.logos || [];
    const media = guideline.media || [];
    const colors = guideline.colors || [];

    return {
      filteredLogos: logos.filter(l => !query || l.label?.toLowerCase().includes(query)),
      filteredMedia: media.filter(m => !query || m.label?.toLowerCase().includes(query)),
      colors
    };
  }, [guideline, deferredSearchQuery]);

  if (!selectedBrandGuidelineId) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Brand Media Library" size="lg">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mb-4 border border-dashed border-neutral-800">
            <LayoutGrid className="text-neutral-600" size={32} />
          </div>
          <h3 className="text-sm font-mono text-neutral-400 uppercase tracking-widest mb-2 font-bold">No Brand Selected</h3>
          <p className="text-xs text-neutral-600 max-w-xs font-mono">
            Please connect or select a Brand Guideline in the main setup to access its media library.
          </p>
        </div>
      </Modal>
    );
  }

  const handleAssetSelect = (url: string, type: 'image' | 'logo') => {
    if (onSelectAsset) {
      onSelectAsset(url, type);
      toast.success('Asset referenced');
      onClose();
    } else if (onAddToBoard) {
      onAddToBoard(url, type);
      toast.success('Asset added to board');
      onClose();
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

  const renderSkeletons = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="aspect-square rounded-2xl bg-neutral-900/30 border border-white/5 p-3 flex flex-col gap-3">
          <SkeletonLoader height="100%" width="100%" className="rounded-xl" />
          <SkeletonLoader height="8px" width="60%" />
        </div>
      ))}
    </div>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Brand Media Library: ${guideline?.identity?.name || 'Loading...'}`} 
      size="xl"
      contentClassName="bg-neutral-950/98"
    >
      <div className="flex flex-col h-[600px]">
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-6 border-b border-white/5">
          <div className="flex items-center p-1 bg-neutral-900/50 border border-white/5 rounded-lg">
            {(['all', 'logos', 'media', 'colors'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider font-bold transition-all",
                  activeTab === tab 
                    ? "bg-brand-cyan text-black shadow-[0_0_15px_rgba(var(--brand-cyan-rgb),0.3)]" 
                    : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                {t(`common.tabs.${tab}`) || tab.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={12} />
              <input 
                type="text" 
                placeholder="SEARCH ASSETS..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900/50 border border-white/5 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-brand-cyan/30 font-mono"
              />
            </div>
            <div className="flex items-center p-1 bg-neutral-900/30 rounded-lg">
               <button 
                onClick={() => setViewMode('grid')}
                className={cn("p-1.5 rounded-md transition-colors", viewMode === 'grid' ? "text-brand-cyan" : "text-neutral-600 hover:text-neutral-400")}
               >
                 <LayoutGrid size={14} />
               </button>
               <button 
                onClick={() => setViewMode('list')}
                className={cn("p-1.5 rounded-md transition-colors", viewMode === 'list' ? "text-brand-cyan" : "text-neutral-600 hover:text-neutral-400")}
               >
                 <List size={14} />
               </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
             {renderSkeletons()}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-8 pb-10">
              {/* Logos Section */}
              {(activeTab === 'all' || activeTab === 'logos') && filteredLogos.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <MicroTitle className="text-brand-cyan">LOGOTYPES</MicroTitle>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <div className={cn(
                    viewMode === 'grid' 
                      ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" 
                      : "flex flex-col gap-2"
                  )}>
                    {filteredLogos.map((logo, i) => (
                      <AssetCard 
                        key={`logo-${i}`} 
                        url={logo.url!} 
                        label={logo.label || `Logo ${i+1}`} 
                        type="logo" 
                        viewMode={viewMode}
                        onClick={() => handleAssetSelect(logo.url!, 'logo')}
                        onAdd={() => onAddToBoard && onAddToBoard(logo.url!, 'logo')}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Media Section */}
              {(activeTab === 'all' || activeTab === 'media') && filteredMedia.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <MicroTitle className="text-brand-cyan">BRAND ASSETS</MicroTitle>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <div className={cn(
                    viewMode === 'grid' 
                      ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" 
                      : "flex flex-col gap-2"
                  )}>
                    {filteredMedia.map((asset, i) => (
                      <AssetCard 
                        key={`media-${i}`} 
                        url={asset.url!} 
                        label={asset.label || `Asset ${i+1}`} 
                        type="image" 
                        viewMode={viewMode}
                        onClick={() => handleAssetSelect(asset.url!, 'image')}
                        onAdd={() => onAddToBoard && onAddToBoard(asset.url!, 'image')}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Colors Section */}
              {(activeTab === 'all' || activeTab === 'colors') && colors.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <MicroTitle className="text-brand-cyan">PRIMARY PALETTE</MicroTitle>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {colors.map((color, i) => (
                      <div 
                        key={i} 
                        className="group relative flex flex-col items-center gap-2 cursor-pointer"
                        onClick={() => {
                          const hex = color.hex || '';
                          if (hex) {
                            navigator.clipboard.writeText(hex);
                            toast.success(`Color ${hex} copied!`);
                          }
                        }}
                      >
                        <div 
                          className="w-16 h-16 rounded-xl border border-white/5 shadow-lg group-hover:scale-105 transition-transform"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-tight">{color.hex}</span>
                        
                        {/* Theme Options */}
                        <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                            onClick={(e) => { e.stopPropagation(); handleApplyToTheme(color.hex!, 'background'); }}
                            className="p-1 rounded bg-black/60 text-white hover:text-brand-cyan transition-colors"
                            title="Apply as Canvas Background"
                           >
                             <Paintbrush size={10} />
                           </button>
                           <button 
                            onClick={(e) => { e.stopPropagation(); handleApplyToTheme(color.hex!, 'primary'); }}
                            className="p-1 rounded bg-black/60 text-white hover:text-brand-cyan transition-colors"
                            title="Set as Brand Primary"
                           >
                             <Zap size={10} />
                           </button>
                        </div>

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-10 pointer-events-none rounded-xl transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {guideline && !filteredLogos.length && !filteredMedia.length && activeTab !== 'colors' && (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-700">
                  <p className="text-xs font-mono uppercase tracking-widest">No assets found matching your criteria</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

interface AssetCardProps {
  url: string;
  label: string;
  type: 'image' | 'logo';
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onAdd?: () => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ url, label, type, viewMode, onClick, onAdd }) => {
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
        className="flex items-center gap-4 p-2 rounded-lg bg-neutral-900/30 border border-white/5 hover:border-brand-cyan/30 hover:bg-neutral-900/50 transition-all group cursor-pointer"
        onClick={onClick}
      >
        <div className="w-10 h-10 aspect-square rounded-md overflow-hidden bg-neutral-950 flex items-center justify-center">
          <img src={url} alt={label} className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase truncate">{label}</p>
          <p className="text-[8px] font-mono text-neutral-600 uppercase tracking-tighter">{type === 'logo' ? 'Logotype' : 'Brand Image'}</p>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           {onAdd && (
             <button 
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="p-1.5 rounded-md bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 border border-brand-cyan/20"
              title="Add to board"
             >
               <Plus size={12} />
             </button>
           )}
           <div className="p-1.5 rounded-md bg-neutral-800 text-neutral-400">
             <ChevronRight size={12} />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="flex flex-col gap-3 p-3 rounded-2xl bg-neutral-900/30 border border-white/5 hover:border-brand-cyan/30 transition-all group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-950 flex items-center justify-center p-4">
        <img src={url} alt={label} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-300 transition-opacity flex items-center justify-center gap-2">
           {onAdd && (
             <button 
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="w-8 h-8 rounded-lg bg-brand-cyan text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
              title="Add to Board"
             >
               <Plus size={16} strokeWidth={2.5} />
             </button>
           )}
           <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md text-white flex items-center justify-center border border-white/20">
              <ImageIcon size={14} />
           </div>
        </div>
      </div>
      <div className="px-1 truncate">
        <p className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-tighter group-hover:text-brand-cyan transition-colors truncate">
          {label}
        </p>
      </div>
    </div>
  );
};
