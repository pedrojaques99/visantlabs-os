import React, { useEffect, useState } from 'react';
import { Thumb } from '@/components/ui/Thumb';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useMockup } from './MockupContext';
import { BrandGuidelineWizardModal } from './BrandGuidelineWizardModal';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';
import { ChevronRight, Plus, Check, Pencil, Gem, Search } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { MicroTitle } from '../ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Modal } from '../ui/Modal';
import { SearchBar } from '../ui/SearchBar';
import { useMemo } from 'react';

import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { glassSurface } from '@/lib/ui/glass';
import { hoverReveal } from '@/lib/ui/hoverReveal';
interface BrandGuidelineSelectorProps {
  variant?: 'default' | 'minimal';
  asButton?: boolean;
}

export const BrandGuidelineSelector: React.FC<BrandGuidelineSelectorProps> = ({
  variant = 'default',
  asButton = false,
}) => {
  const isMinimal = variant === 'minimal' || asButton;
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { selectedBrandGuideline, setSelectedBrandGuideline } = useMockup();

  const [searchQuery, setSearchQuery] = useState('');
  const { data: guidelines = [], isLoading, refetch } = useBrandGuidelines(true);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);

  const filteredGuidelines = useMemo(() => {
    if (!searchQuery.trim()) return guidelines;
    const query = searchQuery.toLowerCase();
    return guidelines.filter(
      (g) =>
        (g.identity?.name || '').toLowerCase().includes(query) ||
        (g.identity?.tagline || '').toLowerCase().includes(query)
    );
  }, [guidelines, searchQuery]);

  const handleWizardSuccess = (id: string) => {
    setIsWizardOpen(false);
    setEditingGuideline(null);
    setSelectedBrandGuideline(id);
    refetch();
    setIsSelectionModalOpen(false);
  };

  const handleEditGuideline = (e: React.MouseEvent, guideline: BrandGuideline) => {
    e.stopPropagation();
    setEditingGuideline(guideline);
    setIsWizardOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingGuideline(null);
    setIsWizardOpen(true);
  };

  const handleSelect = (id: string | null) => {
    setSelectedBrandGuideline(id);
    setIsSelectionModalOpen(false);
  };

  const selectedGuidelineObj = guidelines.find((g) => g.id === selectedBrandGuideline);

  return (
    <div className={cn('relative', isMinimal ? 'inline-flex' : 'flex flex-col w-full')}>
      {isMinimal ? (
        <button
          onClick={() => setIsSelectionModalOpen(true)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selectedBrandGuideline
              ? 'bg-brand-cyan/10 text-foreground border-brand-cyan/40'
              : 'bg-neutral-900/60 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Gem size={10} />
          <span>
            {selectedBrandGuideline
              ? selectedGuidelineObj?.identity?.name
              : t('mockup.brandButton')}
          </span>
        </button>
      ) : (
        <Button
          variant="ghost"
          type="button"
          onClick={() => setIsSelectionModalOpen(true)}
          className={cn(
            'w-full p-4 flex items-center justify-between group transition-colors duration-300',
            'bg-neutral-900/40 hover:bg-neutral-900/60 border border-neutral-800 hover:border-border rounded-xl'
          )}
        >
          <div className="flex flex-col items-start gap-1">
            {!selectedBrandGuideline && (
              <MicroTitle className="transition-colors select-none text-2xs text-neutral-500 group-hover:text-neutral-400">
                {t('mockup.optional')}
              </MicroTitle>
            )}
            {selectedBrandGuideline ? (
              <div className="flex items-center gap-2">
                {selectedGuidelineObj?.logos?.[0]?.url && (
                  <div className="w-4 h-4 rounded-md overflow-hidden border border-border shrink-0">
                    <Thumb
                      src={selectedGuidelineObj.logos[0].url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <span className="text-2xs text-foreground truncate max-w-[150px] font-medium">
                  {selectedGuidelineObj?.identity?.name || t('mockup.unnamedBrand')}
                </span>
              </div>
            ) : (
              <span className="text-2xs text-neutral-600">{t('mockup.selectBrandTitle')}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isLoading ? (
              <GlitchLoader size={14} />
            ) : (
              <ChevronRight
                size={14}
                className="text-neutral-600 group-hover:text-foreground transition-colors"
              />
            )}
          </div>
        </Button>
      )}

      {/* Selection Modal */}
      <Modal
        isOpen={isSelectionModalOpen}
        onClose={() => setIsSelectionModalOpen(false)}
        title={t('mockup.selectBrandTitle')}
        description={t('mockup.selectBrandDescription')}
        size="md"
      >
        <div className="flex flex-col gap-4">
          {/* Search Field */}
          <div className="px-1">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('mockup.searchBrand')}
              className={cn('focus:border-neutral-600', glassSurface.control)}
              containerClassName="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
            {/* Option: None */}
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors border text-2xs',
                !selectedBrandGuideline
                  ? 'bg-brand-cyan/10 border-brand-cyan/30 text-foreground'
                  : 'bg-neutral-900/40 border-neutral-800 text-neutral-500 hover:text-foreground hover:bg-neutral-900/60'
              )}
            >
              <span>{t('mockup.none')}</span>
              {!selectedBrandGuideline && <Check size={14} />}
            </button>

            {/* List of Guidelines */}
            {filteredGuidelines.length > 0 ? (
              filteredGuidelines.map((g) => {
                const brandName = g.identity?.name || t('mockup.unnamedBrand');

                // Improved avatar selection algorithm
                const brandLogo =
                  g.logos?.find((l) => {
                    const v = (l.variant || '').toLowerCase();
                    return (
                      v === 'icon' ||
                      v === 'symbol' ||
                      v === 'mark' ||
                      v === 'avatar' ||
                      v === 'favicon'
                    );
                  }) ||
                  g.logos?.find((l) => (l.variant || '').toLowerCase() === 'primary') ||
                  g.logos?.[0];

                const initials = brandName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <div key={g.id} className="relative group">
                    <button
                      onClick={() => handleSelect(g.id!)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-3 rounded-xl transition-[color,background-color,border-color,box-shadow] border text-2xs text-left',
                        selectedBrandGuideline === g.id
                          ? 'bg-brand-cyan/10 border-brand-cyan/30 text-foreground'
                          : 'bg-neutral-900/40 border-neutral-800 text-neutral-400 hover:text-foreground hover:bg-neutral-900/60'
                      )}
                    >
                      <div className="flex items-center gap-3 truncate flex-1">
                        {/* Brand Thumbnail */}
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center border shrink-0 transition-[color,background-color,border-color,box-shadow,opacity] duration-300',
                            'border-neutral-800 bg-neutral-950/50'
                          )}
                        >
                          {brandLogo?.url ? (
                            <Thumb
                              src={brandLogo.url}
                              alt={brandName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span
                              className={cn(
                                'text-lg font-medium',
                                selectedBrandGuideline === g.id
                                  ? 'text-foreground'
                                  : 'text-neutral-600'
                              )}
                            >
                              {initials}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col truncate">
                          <span className="truncate font-medium text-2xs mb-0.5">{brandName}</span>
                          {g.identity?.tagline && (
                            <span className="truncate text-2xs text-neutral-500">
                              {g.identity.tagline}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedBrandGuideline === g.id && (
                          <Check size={12} className="text-foreground" />
                        )}
                      </div>
                    </button>

                    <button
                      onClick={(e) => handleEditGuideline(e, g)}
                      className={cn(
                        hoverReveal,
                        'absolute right-4 top-1/2 -translate-y-1/2 p-2 text-neutral-600 hover:text-foreground bg-neutral-950/80 rounded-xl border border-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      )}
                      title={t('common.edit')}
                      aria-label={t('common.edit')}
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                );
              })
            ) : searchQuery ? (
              <div className="py-20 flex flex-col items-center justify-center text-neutral-600 gap-3">
                <Search size={24} className="opacity-20" />
                <span className="text-2xs">{t('mockup.noResults')}</span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-2xs text-foreground border-b border-border leading-none pb-0.5 hover:border-foreground transition-colors"
                >
                  {t('common.clearSearch')}
                </button>
              </div>
            ) : null}
          </div>

          <div className="pt-2 border-t border-neutral-800">
            <button
              onClick={handleOpenCreate}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-brand-cyan text-black hover:bg-brand-cyan/90 transition-colors text-xs font-medium"
            >
              <Plus size={16} strokeWidth={3} />
              {t('mockup.createNewBrandGuideline')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Wizard Modal (Create/Edit) */}
      <BrandGuidelineWizardModal
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          setEditingGuideline(null);
        }}
        onSuccess={handleWizardSuccess}
        editGuideline={editingGuideline}
      />

      {selectedBrandGuideline && selectedGuidelineObj && (
        <div className="mt-2 px-1 flex items-center justify-between opacity-40">
          {selectedGuidelineObj.extraction?.completeness ? (
            <span className="text-2xs font-mono text-neutral-400">
              DNA {selectedGuidelineObj.extraction.completeness}%
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};
