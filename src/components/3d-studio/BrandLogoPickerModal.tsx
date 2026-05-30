import React, { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { SearchBar } from '@/components/ui/SearchBar';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { cn } from '@/lib/utils';
import { ChevronLeft, Image as ImageIcon } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

function isSvgUrl(url: string): boolean {
  const path = url.split('?')[0].toLowerCase();
  return path.endsWith('.svg');
}

interface BrandLogoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  guidelines: BrandGuideline[];
  isLoading: boolean;
  onSelectLogo: (logoUrl: string, fileName: string) => void;
}

export const BrandLogoPickerModal: React.FC<BrandLogoPickerModalProps> = ({
  isOpen,
  onClose,
  guidelines,
  isLoading,
  onSelectLogo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuideline, setSelectedGuideline] = useState<BrandGuideline | null>(null);

  const filteredGuidelines = useMemo(() => {
    if (!searchQuery.trim()) return guidelines;
    const q = searchQuery.toLowerCase();
    return guidelines.filter(g =>
      (g.identity?.name || g.name || '').toLowerCase().includes(q)
    );
  }, [guidelines, searchQuery]);

  const handleClose = () => {
    setSelectedGuideline(null);
    setSearchQuery('');
    onClose();
  };

  const handleBack = () => {
    setSelectedGuideline(null);
    setSearchQuery('');
  };

  const handlePickLogo = (logo: { url: string; variant: string; label?: string }) => {
    const ext = logo.url.split('.').pop()?.split('?')[0] || 'svg';
    const name = logo.label || `${selectedGuideline?.identity?.name || 'brand'}-${logo.variant}.${ext}`;
    onSelectLogo(logo.url, name);
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={selectedGuideline ? (selectedGuideline.identity?.name || 'Logos') : 'Import from Brand'}
      size="md"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <GlitchLoader size={20} />
        </div>
      ) : selectedGuideline ? (
        <div className="space-y-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={14} /> Back to guidelines
          </button>

          {(!selectedGuideline.logos || selectedGuideline.logos.length === 0) ? (
            <p className="text-center text-neutral-500 text-sm py-8">No logos in this guideline</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...selectedGuideline.logos]
                .sort((a, b) => {
                  const aIsSvg = isSvgUrl(a.url);
                  const bIsSvg = isSvgUrl(b.url);
                  if (aIsSvg && !bIsSvg) return -1;
                  if (!aIsSvg && bIsSvg) return 1;
                  return 0;
                })
                .map((logo) => {
                  const svg = isSvgUrl(logo.url);
                  return (
                    <button
                      key={logo.id}
                      onClick={() => handlePickLogo(logo)}
                      className={cn(
                        'group relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer',
                        svg
                          ? 'border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/5'
                          : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                      )}
                    >
                      <div className="w-full aspect-square flex items-center justify-center bg-white/5 rounded overflow-hidden relative">
                        <img
                          src={logo.url}
                          alt={logo.label || logo.variant}
                          className="max-w-full max-h-full object-contain p-2"
                        />
                        <span className={cn(
                          'absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider',
                          svg
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/10 text-neutral-500'
                        )}>
                          {svg ? 'SVG' : 'IMG'}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400 group-hover:text-white transition-colors">
                        {logo.label || logo.variant}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {guidelines.length > 3 && (
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search guidelines..."
            />
          )}
          <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700">
            {filteredGuidelines.map((g) => {
              const primaryLogo = g.logos?.find(l => l.variant === 'primary') || g.logos?.[0];
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedGuideline(g)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border border-white/10',
                    'hover:border-white/30 hover:bg-white/5 transition-all text-left'
                  )}
                >
                  <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                    {primaryLogo ? (
                      <img src={primaryLogo.url} alt="" className="max-w-full max-h-full object-contain p-1" />
                    ) : (
                      <ImageIcon size={16} className="text-neutral-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{g.identity?.name || g.name || 'Untitled'}</p>
                    {g.logos && g.logos.length > 0 && (
                      <p className="text-[10px] text-neutral-500">{g.logos.length} logo{g.logos.length > 1 ? 's' : ''}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
};
