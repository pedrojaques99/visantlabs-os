import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/hooks/useTranslation';
import { Modal } from '../ui/Modal';
import { GlitchLoader } from '../ui/GlitchLoader';
import { MediaKitGallery } from '../brand/MediaKitGallery';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FileText, X, ShieldCheck, Image as ImageIcon, Upload, Plus, Figma } from 'lucide-react';
import { MicroTitle } from '../ui/MicroTitle';
import { validatePdfFile } from '@/utils/pdfUtils';
import { buildBrandIngestPayload } from '@/hooks/queries/useBrandImport';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validateFile } from '@/utils/fileUtils';

const isFigmaUrl = (text: string): boolean => {
    try {
        const u = new URL(text);
        const host = u.hostname;
        const path = u.pathname;
        return (host === 'figma.com' || host === 'www.figma.com') &&
            (path.startsWith('/file/') || path.startsWith('/design/'));
    } catch {
        return false;
    }
};

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
    const qc = useQueryClient();
    const isEditMode = !!editGuideline;

    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [figmaUrl, setFigmaUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isIngesting, setIsIngesting] = useState(false);

    // PDF selection state
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    // Image selection state
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    // .fig file state
    const [figFile, setFigFile] = useState<File | null>(null);
    const figFileInputRef = useRef<HTMLInputElement>(null);

    // Local media/logos state for the gallery (edit mode)
    const [media, setMedia] = useState<BrandGuideline['media']>([]);
    const [logos, setLogos] = useState<BrandGuideline['logos']>([]);

    const DRAFT_KEY = 'visant_brand_wizard_draft';

    // Persist text inputs as draft (new mode only)
    useEffect(() => {
        if (!isOpen || isEditMode) return;
        const draft = { name, url, figmaUrl };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, [name, url, figmaUrl, isOpen, isEditMode]);

    useEffect(() => {
        if (isOpen && editGuideline) {
            setName(editGuideline.identity?.name || '');
            setUrl(editGuideline.identity?.website || '');
            setMedia(editGuideline.media || []);
            setLogos(editGuideline.logos || []);
        } else if (isOpen) {
            // Restore draft if available
            try {
                const saved = localStorage.getItem(DRAFT_KEY);
                if (saved) {
                    const draft = JSON.parse(saved);
                    setName(draft.name || '');
                    setUrl(draft.url || '');
                    setFigmaUrl(draft.figmaUrl || '');
                    setPdfFile(null);
                    setFigFile(null);
                    setImageFiles([]);
                    setImagePreviews([]);
                    setMedia([]);
                    setLogos([]);
                    if (pdfInputRef.current) pdfInputRef.current.value = '';
                    if (figFileInputRef.current) figFileInputRef.current.value = '';
                    if (imageInputRef.current) imageInputRef.current.value = '';
                    return;
                }
            } catch {}
            setName('');
            setUrl('');
            setFigmaUrl('');
            setMedia([]);
            setLogos([]);
            setPdfFile(null);
            setFigFile(null);
            setImageFiles([]);
            setImagePreviews([]);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
            if (figFileInputRef.current) figFileInputRef.current.value = '';
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    }, [isOpen, editGuideline]);

    // Handle paste event
    useEffect(() => {
        if (!isOpen || isSubmitting || isIngesting) return;

        const handlePaste = (e: ClipboardEvent) => {
            const target = e.target as HTMLElement;
            const isTypingInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            // Detect Figma URL paste anywhere (even in inputs, intercept only if it's a Figma URL)
            if (e.clipboardData?.types.includes('text/plain')) {
                const text = e.clipboardData.getData('text/plain').trim();
                if (isFigmaUrl(text)) {
                    if (!isTypingInInput || (target as HTMLInputElement).id !== 'brand-wizard-figma') {
                        e.preventDefault();
                        setFigmaUrl(text);
                        toast.success('URL do Figma detectada');
                        return;
                    }
                }
            }

            // Don't intercept other text pastes in inputs
            if (isTypingInInput && e.clipboardData?.types.includes('text/plain')) {
                return;
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            const files: File[] = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                }
            }

            if (files.length === 0) return;

            e.preventDefault();
            const imageFilesFromPaste = files.filter(f => f.type.startsWith('image/'));
            const pdfFilesFromPaste = files.filter(f => f.type === 'application/pdf');

            if (imageFilesFromPaste.length > 0) {
                setImageFiles(prevFiles => {
                    const newFiles = [...prevFiles];
                    const newPreviews: string[] = [];
                    let addedCount = 0;

                    for (const file of imageFilesFromPaste) {
                        if (newFiles.length >= 10) break;
                        const error = validateFile(file, 'image');
                        if (error) {
                            toast.error(`${file.name}: ${error}`);
                            continue;
                        }
                        newFiles.push(file);
                        newPreviews.push(URL.createObjectURL(file));
                        addedCount++;
                    }

                    if (addedCount > 0) {
                        setImagePreviews(prevPreviews => [...prevPreviews, ...newPreviews]);
                        toast.success(t('mockup.brandWizardImagesPasted'));
                    }
                    return newFiles;
                });
            } else if (pdfFilesFromPaste.length > 0) {
                const file = pdfFilesFromPaste[0];
                const validation = validatePdfFile(file);
                if (!validation.isValid) {
                    toast.error(validation.error);
                } else {
                    setPdfFile(file);
                    toast.success(t('mockup.brandWizardPdfPasted'));
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isOpen, isSubmitting, isIngesting, t]);

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

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newFiles = [...imageFiles];
        const newPreviews = [...imagePreviews];

        for (const file of files) {
            if (newFiles.length >= 10) break;

            const error = validateFile(file, 'image');
            if (error) {
                toast.error(`${file.name}: ${error}`);
                continue;
            }

            newFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
        }

        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const removeImage = (index: number) => {
        const newFiles = [...imageFiles];
        const newPreviews = [...imagePreviews];

        // Revoke the URL to avoid memory leaks
        URL.revokeObjectURL(newPreviews[index]);

        newFiles.splice(index, 1);
        newPreviews.splice(index, 1);

        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
    };

    const removePdf = () => {
        setPdfFile(null);
        if (pdfInputRef.current) pdfInputRef.current.value = '';
    };

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const hasUrl = trimmedUrl.length > 0;
    const hasFigma = isFigmaUrl(figmaUrl.trim());
    const canSubmit = trimmedName.length > 0 && !isSubmitting && !isIngesting;

    const handleFormDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const text = e.dataTransfer.getData('text/plain').trim();
        if (isFigmaUrl(text)) {
            setFigmaUrl(text);
            toast.success('URL do Figma detectada');
        }
    };

    const handleClose = useCallback(() => {
        if (isSubmitting || isIngesting) return;
        setName('');
        setUrl('');
        setPdfFile(null);
        setFigFile(null);
        setImageFiles([]);
        imagePreviews.forEach(url => URL.revokeObjectURL(url));
        setImagePreviews([]);
        onClose();
    }, [isSubmitting, isIngesting, imagePreviews, onClose]);

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

            // Handle Extraction Sources (PDF and/or Images)
            if (pdfFile || imageFiles.length > 0) {
                setIsSubmitting(false);
                setIsIngesting(true);
                try {
                    const inputFiles: File[] = [];
                    if (pdfFile) inputFiles.push(pdfFile);
                    inputFiles.push(...imageFiles);
                    const payload = await buildBrandIngestPayload(inputFiles);
                    if (payload) {
                        await brandGuidelineApi.ingest(workingId, payload);
                        toast.success(t('mockup.brandWizardSuccessWithExtraction'));
                    }
                } catch (err) {
                    console.error('Ingestion error:', err);
                    toast.error(t('mockup.brandWizardErrorIngest'));
                }
                setIsIngesting(false);
            }

            // Handle .fig file upload
            if (figFile) {
                setIsIngesting(true);
                try {
                    const form = new FormData();
                    form.append('file', figFile);
                    const token = localStorage.getItem('auth_token') || '';
                    const headers: Record<string, string> = {};
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                    await fetch(`/api/brand-guidelines/${workingId}/extract-fig`, {
                        method: 'POST', headers, body: form,
                    });
                    toast.success('Arquivo Figma extraído com sucesso');
                } catch {
                    toast.warning('Erro ao extrair arquivo Figma');
                } finally {
                    setIsIngesting(false);
                }
            }

            // Handle Figma URL: link + auto-import all tokens
            const trimmedFigma = figmaUrl.trim();
            if (trimmedFigma && isFigmaUrl(trimmedFigma)) {
                setIsIngesting(true);
                try {
                    await brandGuidelineApi.linkFigmaFile(workingId, trimmedFigma);
                    await brandGuidelineApi.importFromFigma(workingId, {
                        importColors: true,
                        importTypography: true,
                    });
                    toast.success('Tokens Figma importados — cores e tipografia extraídas');
                } catch (err: any) {
                    if (err?.needsToken) {
                        toast.warning('Token Figma não configurado — vá em Perfil > Configuração');
                    } else {
                        toast.warning('Figma linkado, mas extração de tokens falhou');
                    }
                } finally {
                    setIsIngesting(false);
                }
            }

            setName('');
            setUrl('');
            setFigmaUrl('');
            setPdfFile(null);
            setFigFile(null);
            setImageFiles([]);
            setImagePreviews([]);
            localStorage.removeItem(DRAFT_KEY);
            await qc.invalidateQueries({ queryKey: ['brand-guidelines'] });
            onSuccess(workingId);

        } catch {
            toast.error(isEditMode ? t('mockup.brandWizardErrorEdit') : t('mockup.brandWizardErrorCreate'));
        } finally {
            setIsSubmitting(false);
            setIsIngesting(false);
        }
    }, [canSubmit, isEditMode, trimmedName, trimmedUrl, editGuideline, hasUrl, pdfFile, onSuccess, t, qc]);

    const submitLabel = isIngesting
        ? t('mockup.brandWizardExtracting')
        : isSubmitting
            ? null
            : isEditMode
                ? t('common.save')
                : (hasUrl || pdfFile || imageFiles.length > 0)
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
                        {t('common.cancel')}
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
                        {isSubmitting && <GlitchLoader size={14} />}
                        {isIngesting && <GlitchLoader size={14} color="black" />}
                        {submitLabel && <span>{submitLabel}</span>}
                    </Button>
                </div>
            }
        >
            <form
                id="brand-wizard-form"
                onSubmit={handleSubmit}
                onDrop={handleFormDrop}
                onDragOver={(e) => e.preventDefault()}
                className="flex flex-col gap-5"
            >
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

                {/* PDF and Images selection (Combined or separate?) */}
                <div className="grid grid-cols-2 gap-4">
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
                                className="w-full flex items-center justify-between gap-3 bg-neutral-900/40 border border-white/5 hover:border-brand-cyan/30 rounded-md px-3 py-3 text-sm font-mono text-neutral-400 hover:text-white transition-all group h-[42px]"
                            >
                                <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-neutral-600 group-hover:text-brand-cyan transition-colors" />
                                    <span className="text-[10px] uppercase tracking-wider">{t('mockup.brandWizardPdfPlaceholderShort') || 'PDF'}</span>
                                </div>
                                <ShieldCheck size={12} className="text-neutral-800 group-hover:text-brand-cyan/40" />
                            </button>
                        ) : (
                            <div className="flex items-center justify-between gap-2 bg-brand-cyan/5 border border-brand-cyan/20 rounded-md px-2 py-1.5 overflow-hidden h-[42px]">
                                <div className="flex items-center gap-2 min-w-0">
                                    <FileText size={16} className="text-brand-cyan shrink-0" />
                                    <span className="text-[10px] font-mono text-white truncate max-w-[80px]">
                                        {pdfFile.name}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={removePdf}
                                    className="p-1 rounded-full hover:bg-white/5 text-neutral-600 hover:text-white transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <MicroTitle as="label" htmlFor="brand-wizard-images">
                            {t('mockup.brandWizardImagesLabel') || 'Images'}
                        </MicroTitle>
                        <input
                            ref={imageInputRef}
                            id="brand-wizard-images"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                            className="hidden"
                            disabled={isSubmitting || isIngesting || imageFiles.length >= 10}
                        />

                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={isSubmitting || isIngesting || imageFiles.length >= 10}
                            className="w-full flex items-center justify-between gap-3 bg-neutral-900/40 border border-white/5 hover:border-brand-cyan/30 rounded-md px-3 py-3 text-sm font-mono text-neutral-400 hover:text-white transition-all group h-[42px] disabled:opacity-30"
                        >
                            <div className="flex items-center gap-2">
                                <ImageIcon size={16} className="text-neutral-600 group-hover:text-brand-cyan transition-colors" />
                                <span className="text-[10px] uppercase tracking-wider">
                                    {imageFiles.length > 0 ? `${imageFiles.length}/10` : (t('mockup.brandWizardImagesPlaceholderShort') || 'IMAGES')}
                                </span>
                            </div>
                            <Plus size={12} className="text-neutral-800 group-hover:text-brand-cyan/40" />
                        </button>
                    </div>
                </div>

                {/* Image Previews Grid */}
                {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-5 gap-2 mt-1">
                        {imagePreviews.map((preview, index) => (
                            <div key={index} className="relative group aspect-square rounded bg-neutral-900 border border-white/5 overflow-hidden">
                                <img src={preview} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute top-0.5 right-0.5 p-1 bg-black/60 rounded-full text-white/40 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Figma URL + .fig file upload */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <MicroTitle as="label" htmlFor="brand-wizard-figma" className="flex items-center gap-1.5">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0">
                                <path d="M8 24C10.208 24 12 22.208 12 20V16H8C5.792 16 4 17.792 4 20C4 22.208 5.792 24 8 24Z" fill="#0ACF83"/>
                                <path d="M4 12C4 9.792 5.792 8 8 8H12V16H8C5.792 16 4 14.208 4 12Z" fill="#A259FF"/>
                                <path d="M4 4C4 1.792 5.792 0 8 0H12V8H8C5.792 8 4 6.208 4 4Z" fill="#F24E1E"/>
                                <path d="M12 0H16C18.208 0 20 1.792 20 4C20 6.208 18.208 8 16 8H12V0Z" fill="#FF7262"/>
                                <path d="M20 12C20 14.208 18.208 16 16 16C13.792 16 12 14.208 12 12C12 9.792 13.792 8 16 8C18.208 8 20 9.792 20 12Z" fill="#1ABCFE"/>
                            </svg>
                            Figma
                        </MicroTitle>
                        {/* .fig file upload button */}
                        <div>
                            <input
                                ref={figFileInputRef}
                                type="file"
                                accept=".fig"
                                className="hidden"
                                disabled={isSubmitting || isIngesting}
                                onChange={e => { const f = e.target.files?.[0]; if (f) setFigFile(f); e.target.value = ''; }}
                            />
                            {figFile ? (
                                <div className="flex items-center gap-1.5 bg-brand-cyan/5 border border-brand-cyan/20 rounded px-2 py-1">
                                    <Upload size={10} className="text-brand-cyan" />
                                    <span className="text-[10px] font-mono text-white truncate max-w-[100px]">{figFile.name}</span>
                                    <button type="button" onClick={() => setFigFile(null)} className="text-neutral-600 hover:text-white transition-colors">
                                        <X size={10} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => figFileInputRef.current?.click()}
                                    disabled={isSubmitting || isIngesting}
                                    className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono text-neutral-500 hover:text-neutral-200 border border-white/5 hover:border-white/15 rounded transition-all disabled:opacity-40"
                                >
                                    <Upload size={10} />
                                    .fig file
                                </button>
                            )}
                        </div>
                    </div>
                    <Input
                        id="brand-wizard-figma"
                        type="url"
                        value={figmaUrl}
                        onChange={(e) => setFigmaUrl(e.target.value)}
                        placeholder="figma.com/file/... ou figma.com/design/..."
                        disabled={isSubmitting || isIngesting}
                        className="w-full bg-neutral-900/60 border border-white/10 rounded-md px-3 py-2.5 text-sm font-mono text-white placeholder:text-neutral-700 focus:outline-none focus:border-brand-cyan/50 transition-colors disabled:opacity-50"
                    />
                    {hasFigma && (
                        <MicroTitle as="p" className="text-neutral-600 mt-0.5 lowercase">
                            cores e tipografia serão extraídas automaticamente via API Figma.
                        </MicroTitle>
                    )}
                </div>

                <MicroTitle as="p" className="text-neutral-700 mt-1 lowercase">
                    {t('mockup.brandWizardExtractionHint') || 'extração essencialista de estratégia, arquétipos e tokens.'}
                </MicroTitle>
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
