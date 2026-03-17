import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useMockup } from './MockupContext';
import { BrandGuidelineWizardModal } from './BrandGuidelineWizardModal';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';
import { ChevronDown, Plus, Check, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { MicroTitle } from '../ui/MicroTitle';
import { Button } from '@/components/ui/button'

interface BrandGuidelineSelectorProps {
    asButton?: boolean;
}

export const BrandGuidelineSelector: React.FC<BrandGuidelineSelectorProps> = ({ asButton }) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const { selectedBrandGuideline, setSelectedBrandGuideline } = useMockup();

    const [guidelines, setGuidelines] = useState<BrandGuideline[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchGuidelines = async () => {
        setIsLoading(true);
        try {
            const data = await brandGuidelineApi.getAll();
            setGuidelines(data);
        } catch (error) {
            console.error('Failed to load brand guidelines:', error);
            toast.error(t('mockup.errorLoadBrandGuidelines') || 'Failed to load Brand Guidelines');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGuidelines();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleWizardSuccess = (id: string) => {
        setIsWizardOpen(false);
        setEditingGuideline(null);
        setSelectedBrandGuideline(id);
        fetchGuidelines();
    };

    const handleEditGuideline = (e: React.MouseEvent, guideline: BrandGuideline) => {
        e.stopPropagation();
        setIsOpen(false);
        setEditingGuideline(guideline);
        setIsWizardOpen(true);
    };

    const handleOpenCreate = () => {
        setIsOpen(false);
        setEditingGuideline(null);
        setIsWizardOpen(true);
    };

    const selectedGuidelineObj = guidelines.find(g => g.id === selectedBrandGuideline);

    return (
        <div className={cn(
            "flex flex-col relative",
            asButton ? "z-[70]" : (isOpen ? "z-[60]" : "z-10")
        )}>
            <div className="relative" ref={dropdownRef}>
                <Button variant="ghost" type="button"
                    size="sm"
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "flex items-center justify-between cursor-pointer transition-all group",
                        asButton
                            ? cn("px-3 h-8 rounded-md border",
                                selectedBrandGuideline
                                    ? "bg-brand-cyan/5 border-brand-cyan/20 text-brand-cyan"
                                    : "bg-white/5 border-white/10 text-neutral-400 hover:text-white"
                            )
                            : cn("w-full p-4", isOpen ? "bg-white/10" : "hover:bg-white/5")
                    )}
                >
                    {asButton ? (
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "w-2 h-2 rounded-full transition-all duration-300",
                                selectedBrandGuideline ? "bg-brand-cyan" : "bg-neutral-600"
                            )} />
                            <MicroTitle as="span" className="font-bold text-inherit !text-[9px] uppercase">
                                {selectedGuidelineObj?.identity?.name || 'BRAND'}
                            </MicroTitle>
                            <ChevronDown size={10} className={cn("text-inherit opacity-50 transition-transform duration-300", isOpen && "rotate-180")} />
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col items-start gap-1">
                                <MicroTitle className={cn(
                                    "transition-colors select-none",
                                    selectedBrandGuideline ? "text-brand-cyan" : "text-neutral-500 group-hover:text-neutral-400"
                                )}>
                                    {t('mockup.brandGuideline') || 'BRAND GUIDELINE'}
                                </MicroTitle>
                                {selectedBrandGuideline ? (
                                    <span className="text-[11px] font-mono text-white truncate max-w-[180px] uppercase ">
                                        {selectedGuidelineObj?.identity?.name || 'Selected'}
                                    </span>
                                ) : (
                                    <MicroTitle className="text-[10px] text-neutral-600 tracking-tight">
                                        {t('mockup.optional') || 'OPCIONAL'}
                                    </MicroTitle>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {isLoading ? (
                                    <Loader2 size={14} className="animate-spin text-neutral-500" />
                                ) : null}
                                <ChevronDown size={14} className={cn("text-neutral-600 transition-transform duration-300", isOpen && "rotate-180")} />
                            </div>
                        </>
                    )}
                </Button>

                {isOpen && (
                    <div className={cn(
                        "absolute top-full mt-2 rounded-2xl border overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-3xl",
                        asButton ? "right-0 min-w-[220px]" : "left-0 right-0",
                        theme === 'dark' ? "bg-neutral-900/90 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" : "bg-white border-neutral-200 shadow-xl"
                    )}>
                        <div className="flex flex-col">
                            {/* Header / Search Placeholder or Title */}
                            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                                <MicroTitle className="text-[9px] opacity-300">SELECT BRAND</MicroTitle>
                                {isLoading && <Loader2 size={10} className="animate-spin opacity-300" />}
                            </div>

                            <div className="p-1.5 overflow-y-auto max-h-[280px] custom-scrollbar flex flex-col gap-1">
                                <button
                                    onClick={() => { setSelectedBrandGuideline(null); setIsOpen(false); }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all text-[11px] font-medium uppercase tracking-tight",
                                        !selectedBrandGuideline
                                            ? "text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20"
                                            : "text-neutral-500 hover:text-neutral-200 hover:bg-white/5 border border-transparent"
                                    )}
                                >
                                    <span>{t('mockup.none') || 'Nenhum'}</span>
                                    {!selectedBrandGuideline && <Check size={14} className="text-brand-cyan shadow-[0_0_10px_rgba(var(--brand-cyan-rgb),0.5)]" />}
                                </button>

                                {guidelines.map((g) => (
                                    <div
                                        key={g.id}
                                        className={cn(
                                            "w-full flex items-center gap-1 group/item px-1 py-1 rounded-xl transition-all border border-transparent",
                                            selectedBrandGuideline === g.id
                                                ? "bg-brand-cyan/5 border-brand-cyan/10"
                                                : "hover:bg-white/5"
                                        )}
                                    >
                                        <button
                                            onClick={() => { setSelectedBrandGuideline(g.id!); setIsOpen(false); }}
                                            className={cn(
                                                "flex-1 flex items-center gap-3 px-2 py-2 text-left truncate transition-colors",
                                                selectedBrandGuideline === g.id ? "text-brand-cyan" : "text-neutral-400 group-hover/item:text-neutral-100"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                selectedBrandGuideline === g.id ? "bg-brand-cyan animate-pulse" : "bg-neutral-700"
                                            )} />
                                            <span className="truncate text-[11px] font-bold uppercase tracking-tight">{g.identity?.name || 'Unnamed'}</span>
                                        </button>

                                        <div className="flex items-center gap-1 pr-1">
                                            <button
                                                onClick={(e) => handleEditGuideline(e, g)}
                                                className="opacity-0 group-hover/item:opacity-300 p-2 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-all"
                                                title={t('mockup.brandWizardEdit') || 'Edit'}
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            {selectedBrandGuideline === g.id && (
                                                <div className="w-8 flex justify-center">
                                                    <Check size={14} className="text-brand-cyan" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-2 border-t border-white/5 bg-white/[0.02]">
                                <button
                                    onClick={handleOpenCreate}
                                    className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest"
                                >
                                    <Plus size={14} />
                                    {t('mockup.createNewBrandGuideline') || 'New Brand DNA'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {selectedBrandGuideline && selectedGuidelineObj && selectedGuidelineObj._extraction && (
                <div className="px-3 pb-1 text-right">
                    <span className="text-[8px] font-mono opacity-30 uppercase tracking-tighter">DNA {selectedGuidelineObj._extraction.completeness}% Ready</span>
                </div>
            )}

            <BrandGuidelineWizardModal
                isOpen={isWizardOpen}
                onClose={() => { setIsWizardOpen(false); setEditingGuideline(null); }}
                onSuccess={handleWizardSuccess}
                editGuideline={editingGuideline}
            />
        </div>
    );
};
