import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Modal } from '../ui/Modal';
import { GlitchLoader } from '../ui/GlitchLoader';
import { MediaKitGallery } from '../brand/MediaKitGallery';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { MicroTitle } from '../ui/MicroTitle';

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
        } else if (isOpen) {
            setName('');
            setUrl('');
            setMedia([]);
            setLogos([]);
        }
    }, [isOpen, editGuideline]);

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const hasUrl = trimmedUrl.length > 0;
    const canSubmit = trimmedName.length > 0 && !isSubmitting && !isIngesting;

    const handleClose = () => {
        if (isSubmitting || isIngesting) return;
        setName('');
        setUrl('');
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setIsSubmitting(true);
        try {
            if (isEditMode) {
                const updatedData: Partial<BrandGuideline> = {
                    identity: { name: trimmedName, website: trimmedUrl || undefined },
                };
                await brandGuidelineApi.update(editGuideline!.id!, updatedData);

                const oldUrl = editGuideline!.identity?.website || '';
                if (hasUrl && trimmedUrl !== oldUrl) {
                    setIsSubmitting(false);
                    setIsIngesting(true);
                    try {
                        await brandGuidelineApi.ingest(editGuideline!.id!, { source: 'url', url: trimmedUrl });
                        toast.success(t('mockup.brandWizardSuccessWithExtraction'));
                    } catch {
                        toast.warning(t('mockup.brandWizardErrorIngest'));
                    }
                    setIsIngesting(false);
                } else {
                    toast.success(t('mockup.brandWizardEditSuccess'));
                }

                setName('');
                setUrl('');
                onSuccess(editGuideline!.id!);
            } else {
                const newGuideline = await brandGuidelineApi.create({
                    identity: { name: trimmedName, website: trimmedUrl || undefined },
                });

                const newId = newGuideline.id!;

                if (hasUrl) {
                    setIsSubmitting(false);
                    setIsIngesting(true);
                    try {
                        await brandGuidelineApi.ingest(newId, { source: 'url', url: trimmedUrl });
                        toast.success(t('mockup.brandWizardSuccessWithExtraction'));
                    } catch {
                        toast.warning(t('mockup.brandWizardErrorIngest'));
                    }
                    setIsIngesting(false);
                } else {
                    toast.success(t('mockup.brandWizardSuccess'));
                }

                setName('');
                setUrl('');
                onSuccess(newId);
            }
        } catch {
            toast.error(isEditMode ? t('mockup.brandWizardErrorEdit') : t('mockup.brandWizardErrorCreate'));
        } finally {
            setIsSubmitting(false);
            setIsIngesting(false);
        }
    };

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
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting || isIngesting}
                        className="px-4 py-2 text-sm font-mono text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        {t('mockup.brandWizardCancel')}
                    </button>
                    <button
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
                    </button>
                </div>
            }
        >
            <form id="brand-wizard-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                    <MicroTitle as="label" htmlFor="brand-wizard-name">
                        {t('mockup.brandWizardNameLabel')}
                    </MicroTitle>
                    <input
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
                    <input
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
