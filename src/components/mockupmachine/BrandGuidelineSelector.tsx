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

export const BrandGuidelineSelector: React.FC = () => {
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
            isOpen ? "z-[60]" : "z-10"
        )}>
            <div className="relative" ref={dropdownRef}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "w-full flex items-center justify-between p-4 cursor-pointer transition-all group",
                        isOpen ? "bg-white/10" : "hover:bg-white/5"
                    )}
                >
                    <div className="flex flex-col items-start gap-1">
                        <MicroTitle className={cn(
                            "transition-colors select-none",
                            selectedBrandGuideline ? "text-brand-cyan" : "text-neutral-500 group-hover:text-neutral-400"
                        )}>
                            {t('mockup.brandGuideline') || 'BRAND GUIDELINE'}
                        </MicroTitle>
                        {selectedBrandGuideline ? (
                            <span className="text-[11px] font-mono text-white truncate max-w-[180px] uppercase tracking-wider">
                                {selectedGuidelineObj?.identity?.name || 'Selected'}
                            </span>
                        ) : (
                            <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-tight">
                                {t('mockup.optional') || 'OPCIONAL'}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {isLoading ? (
                            <Loader2 size={14} className="animate-spin text-neutral-500" />
                        ) : null}
                        <ChevronDown size={14} className={cn("text-neutral-600 transition-transform duration-300", isOpen && "rotate-180")} />
                    </div>
                </button>

                {isOpen && (
                    <div className={cn(
                        "absolute top-full left-0 right-0 mt-2 rounded-xl border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200",
                        theme === 'dark' ? "bg-[#1A1A1A] border-white/10 shadow-2xl shadow-black/50" : "bg-white border-neutral-200 shadow-xl"
                    )}>
                        <div className="flex flex-col max-h-[240px]">
                            <div className="p-2 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                <button
                                    onClick={() => { setSelectedBrandGuideline(null); setIsOpen(false); }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors",
                                        !selectedBrandGuideline
                                            ? "text-brand-cyan bg-brand-cyan/10"
                                            : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                                    )}
                                >
                                    <span>{t('mockup.none') || 'None'}</span>
                                    {!selectedBrandGuideline && <Check size={14} />}
                                </button>

                                {guidelines.map((g) => (
                                    <div
                                        key={g.id}
                                        className={cn(
                                            "w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors group/item",
                                            selectedBrandGuideline === g.id
                                                ? "text-brand-cyan bg-brand-cyan/10"
                                                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                                        )}
                                    >
                                        <button
                                            onClick={() => { setSelectedBrandGuideline(g.id!); setIsOpen(false); }}
                                            className="flex items-center gap-2 truncate flex-1 text-left"
                                        >
                                            <span className="truncate">{g.identity?.name || 'Unnamed Guideline'}</span>
                                        </button>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={(e) => handleEditGuideline(e, g)}
                                                className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-all"
                                                title={t('mockup.brandWizardEdit') || 'Edit'}
                                            >
                                                <Pencil size={11} />
                                            </button>
                                            {selectedBrandGuideline === g.id && <Check size={14} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-1 border-t border-white/5">
                                <button
                                    onClick={handleOpenCreate}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-neutral-500 hover:text-neutral-300 transition-colors"
                                >
                                    <Plus size={12} />
                                    {t('mockup.createNewBrandGuideline') || 'Create New Brand Guideline'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {selectedBrandGuideline && selectedGuidelineObj && selectedGuidelineObj._extraction && (
                <div className="px-3.5 pb-2 text-right">
                     <span className="text-[9px] font-mono tracking-wider opacity-40">{selectedGuidelineObj._extraction.completeness}% Completo</span>
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
