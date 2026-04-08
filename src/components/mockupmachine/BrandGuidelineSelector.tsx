import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useLayout } from '@/hooks/useLayout';
import { useMockup } from './MockupContext';
import { BrandGuidelineWizardModal } from './BrandGuidelineWizardModal';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';
import { ChevronRight, Plus, Check, Loader2, Pencil, Gem, Search } from 'lucide-react';
import { toast } from 'sonner';
import { MicroTitle } from '../ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Modal } from '../ui/Modal';
import { SearchBar } from '../ui/SearchBar';
import { useMemo } from 'react';

interface BrandGuidelineSelectorProps {
    asButton?: boolean;
}

export const BrandGuidelineSelector: React.FC<BrandGuidelineSelectorProps> = ({ asButton }) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const { user } = useLayout();
    const { selectedBrandGuideline, setSelectedBrandGuideline } = useMockup();

    const isAdmin = user?.isAdmin === true;
    const isTester = user?.userCategory === 'tester' || user?.username === 'tester';
    const canSelectBrand = isAdmin || isTester;

    const [searchQuery, setSearchQuery] = useState('');
    const { data: guidelines = [], isLoading, refetch } = useBrandGuidelines(true);
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);

    const filteredGuidelines = useMemo(() => {
        if (!searchQuery.trim()) return guidelines;
        const query = searchQuery.toLowerCase();
        return guidelines.filter(g =>
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

    const selectedGuidelineObj = guidelines.find(g => g.id === selectedBrandGuideline);

    if (!canSelectBrand) return null;

    return (
        <div className="flex flex-col relative w-full">
            <Button
                variant="ghost"
                type="button"
                onClick={() => setIsSelectionModalOpen(true)}
                className={cn(
                    "w-full p-4 flex items-center justify-between group transition-all duration-300",
                    "bg-neutral-900/40 hover:bg-neutral-900/60 border border-white/5 hover:border-white/10 rounded-xl",
                    selectedBrandGuideline && "border-brand-cyan/20 bg-brand-cyan/[0.02]"
                )}
            >
                <div className="flex flex-col items-start gap-1">
                    {!selectedBrandGuideline && (
                        <MicroTitle className="transition-colors select-none text-[10px] text-neutral-500 group-hover:text-neutral-400 font-mono">
                            {t('mockup.optional') || 'OPCIONAL'}
                        </MicroTitle>
                    )}
                    {selectedBrandGuideline ? (
                        <div className="flex items-center gap-2">
                            {selectedGuidelineObj?.logos?.[0]?.url && (
                                <div className="w-4 h-4 rounded-sm overflow-hidden border border-white/10 shrink-0">
                                    <img src={selectedGuidelineObj.logos[0].url} alt="" className="w-full h-full object-cover" />
                                </div>
                            )}
                            <span className="text-[11px] font-mono text-white truncate max-w-[150px] uppercase font-bold tracking-wider">
                                {selectedGuidelineObj?.identity?.name || 'Selected'}
                            </span>
                        </div>
                    ) : (
                        <span className="text-[11px] font-mono text-neutral-600 uppercase">
                            Selecionar Projeto
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isLoading ? (
                        <Loader2 size={14} className="animate-spin text-neutral-500" />
                    ) : (
                        <ChevronRight size={14} className="text-neutral-600 group-hover:text-white transition-all transform group-hover:translate-x-0.5" />
                    )}
                </div>
            </Button>

            {/* Selection Modal */}
            <Modal
                isOpen={isSelectionModalOpen}
                onClose={() => setIsSelectionModalOpen(false)}
                title={t('mockup.selectBrandTitle') || 'SELECIONAR DNA DA MARCA'}
                description={t('mockup.selectBrandDescription') || 'Escolha um guia de marca para contextualizar suas gerações.'}
                size="md"
            >
                <div className="flex flex-col gap-4">
                    {/* Search Field */}
                    <div className="px-1">
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder={t('mockup.searchBrand') || 'Buscar marca...'}
                            className="bg-neutral-900/60 border-white/5 focus:border-brand-cyan/30"
                            containerClassName="w-full"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                        {/* Option: None */}
                        <button
                            onClick={() => handleSelect(null)}
                            className={cn(
                                "w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all border font-mono text-[10px] uppercase tracking-wider",
                                !selectedBrandGuideline
                                    ? "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan"
                                    : "bg-neutral-900/40 border-white/5 text-neutral-500 hover:text-white hover:bg-neutral-900/60"
                            )}
                        >
                            <span>{t('mockup.none') || 'IGNORAR CONTEXTO'}</span>
                            {!selectedBrandGuideline && <Check size={14} />}
                        </button>

                        {/* List of Guidelines */}
                        {filteredGuidelines.length > 0 ? (
                            filteredGuidelines.map((g) => {
                                const brandName = g.identity?.name || 'Unnamed Project';
                                const brandLogo = g.logos?.find(l => l.variant === 'icon') || g.logos?.[0];
                                const initials = brandName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                                return (
                                    <div key={g.id} className="relative group">
                                        <button
                                            onClick={() => handleSelect(g.id!)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all border font-mono text-[10px] uppercase tracking-wider text-left",
                                                selectedBrandGuideline === g.id
                                                    ? "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan"
                                                    : "bg-neutral-900/40 border-white/5 text-neutral-400 hover:text-white hover:bg-neutral-900/60 shadow-sm"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 truncate flex-1">
                                                {/* Brand Thumbnail */}
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center border shrink-0 transition-all duration-300",
                                                    selectedBrandGuideline === g.id ? "border-brand-cyan/40 bg-brand-cyan/5" : "border-white/5 bg-neutral-950/50 group-hover:border-white/10"
                                                )}>
                                                    {brandLogo?.url ? (
                                                        <img
                                                            src={brandLogo.url}
                                                            alt={brandName}
                                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = ''; // Force initials fallback
                                                            }}
                                                        />
                                                    ) : (
                                                        <span className={cn(
                                                            "text-lg font-bold tracking-tighter opacity-30",
                                                            selectedBrandGuideline === g.id ? "text-brand-cyan opacity-80" : "text-neutral-600"
                                                        )}>
                                                            {initials}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex flex-col truncate">
                                                    <span className="truncate font-bold text-[11px] tracking-normal mb-0.5">{brandName}</span>
                                                    {g.identity?.tagline && (
                                                        <span className="truncate text-[10px] opacity-40 font-sans normal-case tracking-normal">{g.identity.tagline}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {selectedBrandGuideline === g.id && (
                                                    <div className="w-5 h-5 rounded-full bg-brand-cyan/10 flex items-center justify-center">
                                                        <Check size={10} className="text-brand-cyan" />
                                                    </div>
                                                )}
                                            </div>
                                        </button>

                                        <button
                                            onClick={(e) => handleEditGuideline(e, g)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-600 hover:text-white bg-neutral-950/80 rounded-lg border border-white/5"
                                        >
                                            <Pencil size={12} />
                                        </button>
                                    </div>
                                );
                            })
                        ) : searchQuery ? (
                            <div className="py-20 flex flex-col items-center justify-center text-neutral-600 gap-3">
                                <Search size={24} className="opacity-20" />
                                <span className="text-[10px] font-mono uppercase tracking-widest">{t('mockup.noResults') || 'Nenhuma marca encontrada'}</span>
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="text-[10px] text-brand-cyan border-b border-brand-cyan/30 leading-none pb-0.5 hover:text-white hover:border-white transition-all cursor-pointer"
                                >
                                    Limpar busca
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <div className="pt-2 border-t border-white/5">
                        <button
                            onClick={handleOpenCreate}
                            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-brand-cyan text-black hover:bg-brand-cyan/90 transition-all font-mono text-[11px] font-bold uppercase tracking-widest shadow-[0_10px_20px_rgba(var(--brand-cyan-rgb),0.2)]"
                        >
                            <Plus size={16} strokeWidth={3} />
                            {t('mockup.createNewBrandGuideline') || 'ADICIONAR NOVO DNA'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Wizard Modal (Create/Edit) */}
            <BrandGuidelineWizardModal
                isOpen={isWizardOpen}
                onClose={() => { setIsWizardOpen(false); setEditingGuideline(null); }}
                onSuccess={handleWizardSuccess}
                editGuideline={editingGuideline}
            />

            {selectedBrandGuideline && selectedGuidelineObj && (
                <div className="mt-2 px-1 flex items-center justify-between opacity-40">
                    {selectedGuidelineObj._extraction && (
                        <span className="text-[10px] font-mono text-brand-cyan uppercase tracking-tighter">
                            DNA {selectedGuidelineObj._extraction.completeness}%
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
