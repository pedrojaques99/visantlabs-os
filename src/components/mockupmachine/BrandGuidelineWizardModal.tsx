import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Modal } from '../ui/Modal';
import { GlitchLoader } from '../ui/GlitchLoader';
import { MediaKitGallery } from '../brand/MediaKitGallery';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, FileText, X, ShieldCheck } from 'lucide-react';
import { MicroTitle } from '../ui/MicroTitle';
import { pdfToBase64, validatePdfFile } from '@/utils/pdfUtils';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BrandGuidelineWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (id: string) => void;
    editGuideline?: BrandGuideline | null;
}

export const BrandGuidelineWizardModal: React.FC<BrandGuidelineWizardModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    editGuideline,
}) => {
    const { t } = useTranslation();
    const isEditMode = !!editGuideline;

    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isIngesting, setIsIngesting] = useState(false);

    // PDF selection state
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    // Local media/logos state for the gallery (edit mode)
    const [media, setMedia] = useState<BrandGuideline['media']>([]);
    const [logos, setLogos] = useState<BrandGuideline['logos']>([]);

    // Pre-fill when editing
    useEffect(() => {
        if (isOpen && editGuideline) {
            setName(editGuideline.identity?.name || '');
            setUrl(editGuideline.identity?.website || '');
            setMedia(editGuideline.media || []);
            setLogos(editGuideline.logos || []);
            setName('');
            setUrl('');
            setMedia([]);
            setLogos([]);
            setPdfFile(null);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
    }, [isOpen, editGuideline]);

    const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validatePdfFile(file);
        if (!validation.isValid) {
            toast.error(validation.error);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
            return;
        }

        setPdfFile(file);
    };

    const removePdf = () => {
        setPdfFile(null);
        if (pdfInputRef.current) pdfInputRef.current.value = '';
    };

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const hasUrl = trimmedUrl.length > 0;
    const canSubmit = trimmedName.length > 0 && !isSubmitting && !isIngesting;

    const handleClose = useCallback(() => {
        if (isSubmitting || isIngesting) return;
        setName('');
        setUrl('');
        setPdfFile(null);
        onClose();
    }, [isSubmitting, isIngesting, onClose]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setIsSubmitting(true);
        try {
            let workingId: string;

            if (isEditMode) {
                const updatedData: Partial<BrandGuideline> = {
                    identity: { name: trimmedName, website: trimmedUrl || undefined },
                };
                await brandGuidelineApi.update(editGuideline!.id!, updatedData);
                workingId = editGuideline!.id!;
            } else {
                const newGuideline = await brandGuidelineApi.create({
                    identity: { name: trimmedName, website: trimmedUrl || undefined },
                });
                workingId = newGuideline.id!;
            }

            // Handle URL Ingestion
            if (hasUrl) {
                const oldUrl = isEditMode ? (editGuideline!.identity?.website || '') : '';
                if (!isEditMode || (isEditMode && trimmedUrl !== oldUrl)) {
                    setIsSubmitting(false);
                    setIsIngesting(true);
                    try {
                        await brandGuidelineApi.ingest(workingId, { source: 'url', url: trimmedUrl });
                        toast.success(t('mockup.brandWizardSuccessWithExtraction'));
                    } catch {
                        toast.warning(t('mockup.brandWizardErrorIngest'));
                    }
                    setIsIngesting(false);
                } else if (isEditMode) {
                    toast.success(t('mockup.brandWizardEditSuccess'));
                }
            } else if (!pdfFile) {
                if (isEditMode) toast.success(t('mockup.brandWizardEditSuccess'));
                else toast.success(t('mockup.brandWizardSuccess'));
            }

            // Handle PDF Ingestion
            if (pdfFile) {
                setIsSubmitting(false);
                setIsIngesting(true);
                try {
                    const base64 = await pdfToBase64(pdfFile);
                    await brandGuidelineApi.ingest(workingId, {
                        source: 'pdf',
                        data: base64,
                        filename: pdfFile.name
                    });
                    toast.success(t('mockup.brandWizardSuccessWithExtraction'));
                } catch {
                    toast.error(t('mockup.brandWizardErrorPdf'));
                }
                setIsIngesting(false);
            }

            setName('');
            setUrl('');
            setPdfFile(null);
            onSuccess(workingId);

        } catch {
            toast.error(isEditMode ? t('mockup.brandWizardErrorEdit') : t('mockup.brandWizardErrorCreate'));
        } finally {
            setIsSubmitting(false);
            setIsIngesting(false);
        }
    }, [canSubmit, isEditMode, trimmedName, trimmedUrl, editGuideline, hasUrl, pdfFile, onSuccess, t]);

    const submitLabel = isIngesting
        ? t('mockup.brandWizardExtracting')
        : isSubmitting
            ? null
            : isEditMode
                ? t('mockup.brandWizardSave')
                : hasUrl
                    ? t('mockup.brandWizardSubmit')
                    : t('mockup.brandWizardSubmitNoUrl');

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={isEditMode ? t('mockup.brandWizardEditTitle') : t('mockup.brandWizardTitle')}
            description={isEditMode ? t('mockup.brandWizardEditDescription') : t('mockup.brandWizardDescription')}
            size={isEditMode ? 'md' : 'sm'}
            closeOnBackdropClick={!isSubmitting && !isIngesting}
            closeOnEscape={!isSubmitting && !isIngesting}
            footer={
                <div className="flex items-center gap-3 w-full">
                    <Button variant="ghost"
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting || isIngesting}
                        className="px-4 py-2 text-sm font-mono text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        {t('mockup.brandWizardCancel')}
                    </Button>
                    <Button variant="brand"
                        type="submit"
                        form="brand-wizard-form"
                        disabled={!canSubmit}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-mono text-sm font-bold transition-all",
                            canSubmit
                                ? "bg-brand-cyan text-black hover:bg-brand-cyan/80"
                                : "bg-neutral-800/60 text-neutral-600 cursor-not-allowed"
                        )}
                    >
                        {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                        {isIngesting && <GlitchLoader size={14} color="black" />}
                        {submitLabel && <span>{submitLabel}</span>}
                    </Button>
                </div>
            }
        >
            <form id="brand-wizard-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                    <MicroTitle as="label" htmlFor="brand-wizard-name">
                        {t('mockup.brandWizardNameLabel')}
                    </MicroTitle>
                    <Input
                        id="brand-wizard-name"
                        type="text"
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('mockup.brandNamePlaceholder')}
                        disabled={isSubmitting || isIngesting}
                        className="w-full bg-neutral-900/60 border border-white/10 rounded-md px-3 py-2.5 text-sm font-mono text-white placeholder:text-neutral-700 focus:outline-none focus:border-brand-cyan/50 transition-colors disabled:opacity-50"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <MicroTitle as="label" htmlFor="brand-wizard-url">
                        {t('mockup.brandWizardUrlLabel')}
                    </MicroTitle>
                    <Input
                        id="brand-wizard-url"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder={t('mockup.brandWizardUrlPlaceholder')}
                        disabled={isSubmitting || isIngesting}
                        className="w-full bg-neutral-900/60 border border-white/10 rounded-md px-3 py-2.5 text-sm font-mono text-white placeholder:text-neutral-700 focus:outline-none focus:border-brand-cyan/50 transition-colors disabled:opacity-50"
                    />
                    {hasUrl && (
                        <MicroTitle as="p" className="text-neutral-600 mt-0.5 lowercase">
                            Colors, typography, and brand details will be auto-extracted.
                        </MicroTitle>
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <MicroTitle as="label" htmlFor="brand-wizard-pdf">
                        {t('mockup.brandWizardPdfLabel')}
                    </MicroTitle>
                    <input
                        ref={pdfInputRef}
                        id="brand-wizard-pdf"
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfChange}
                        className="hidden"
                        disabled={isSubmitting || isIngesting}
                    />

                    {!pdfFile ? (
                        <button
                            type="button"
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={isSubmitting || isIngesting}
                            className="w-full flex items-center justify-between gap-3 bg-neutral-900/40 border border-white/5 hover:border-brand-cyan/30 rounded-md px-3 py-3 text-sm font-mono text-neutral-400 hover:text-white transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <FileText size={18} className="text-neutral-600 group-hover:text-brand-cyan transition-colors" />
                                <span className="text-xs truncate">{t('mockup.brandWizardPdfPlaceholder')}</span>
                            </div>
                            <ShieldCheck size={14} className="text-neutral-800 group-hover:text-brand-cyan/40" />
                        </button>
                    ) : (
                        <div className="flex items-center justify-between gap-3 bg-brand-cyan/5 border border-brand-cyan/20 rounded-md px-3 py-2.5 overflow-hidden">
                            <div className="flex items-center gap-3 min-w-0">
                                <FileText size={18} className="text-brand-cyan shrink-0" />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-mono text-brand-cyan/60 uppercase leading-none mb-1">
                                        {t('mockup.brandWizardPdfSelected')}
                                    </span>
                                    <span className="text-[11px] font-mono text-white truncate">
                                        {pdfFile.name}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={removePdf}
                                className="p-1.5 rounded-full hover:bg-white/5 text-neutral-600 hover:text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    <MicroTitle as="p" className="text-neutral-700 mt-0.5 lowercase">
                        {t('mockup.brandWizardPdfHint')}
                    </MicroTitle>
                </div>
            </form>

            {/* Media Kit — only in edit mode (guideline must exist for uploads) */}
            {isEditMode && editGuideline?.id && (
                <div className="mt-6 pt-5 border-t border-white/5">
                    <MediaKitGallery
                        guidelineId={editGuideline.id}
                        media={media || []}
                        logos={logos || []}
                        onMediaChange={setMedia}
                        onLogosChange={setLogos}
                        compact
                    />
                </div>
            )}
        </Modal>
    );
};
