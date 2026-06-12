import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/hooks/useTranslation';
import { Modal } from '../ui/Modal';
import { GlitchLoader } from '../ui/GlitchLoader';
import { FlyingPaperLoader } from '../ui/FlyingPaperLoader';
import { MediaKitGallery } from '../brand/MediaKitGallery';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FileText, X, Image as ImageIcon, Figma } from 'lucide-react';
import { validatePdfFile } from '@/utils/pdfUtils';
import { buildBrandIngestPayload } from '@/hooks/queries/useBrandImport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validateFile } from '@/utils/fileUtils';

function sanitizePreviewUrl(url: string): string {
  if (url.startsWith('blob:') || url.startsWith('data:image/')) return url;
  return '';
}

const isFigmaUrl = (text: string): boolean => {
  try {
    const u = new URL(text);
    const host = u.hostname;
    const path = u.pathname;
    return (
      (host === 'figma.com' || host === 'www.figma.com') &&
      (path.startsWith('/file/') || path.startsWith('/design/'))
    );
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

  // Wizard step (new mode only): 1 = identity, 2 = materials
  const [step, setStep] = useState<1 | 2>(1);
  // Unified dropzone state
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const allFilesInputRef = useRef<HTMLInputElement>(null);
  // Live label shown by the FlyingPaperLoader while processing
  const [ingestPhase, setIngestPhase] = useState('');

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
    if (!isOpen) return;
    setStep(1);
    setIngestPhase('');
    dragDepth.current = 0;
    setIsDragging(false);
    if (editGuideline) {
      setName(editGuideline.identity?.name || '');
      setUrl(editGuideline.identity?.website || '');
      setMedia(editGuideline.media || []);
      setLogos(editGuideline.logos || []);
    } else {
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
            toast.success(t('mockup.brandWizardFigmaUrlDetected'));
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
      const imageFilesFromPaste = files.filter((f) => f.type.startsWith('image/'));
      const pdfFilesFromPaste = files.filter((f) => f.type === 'application/pdf');

      if (imageFilesFromPaste.length > 0) {
        setImageFiles((prevFiles) => {
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
            setImagePreviews((prevPreviews) => [...prevPreviews, ...newPreviews]);
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

  const removeFig = () => setFigFile(null);

  // Unified file router — filters dropped/selected files by type and gives feedback
  const routeFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const images = files.filter((f) => f.type.startsWith('image/'));
      const pdfs = files.filter((f) => f.type === 'application/pdf');
      const figs = files.filter((f) => f.name.toLowerCase().endsWith('.fig'));
      const rejected = files.filter(
        (f) => !images.includes(f) && !pdfs.includes(f) && !figs.includes(f)
      );

      // PDF — keep the first valid one
      if (pdfs.length > 0) {
        const validation = validatePdfFile(pdfs[0]);
        if (!validation.isValid) toast.error(validation.error);
        else {
          setPdfFile(pdfs[0]);
          toast.success(t('mockup.brandWizardPdfSelected') || 'PDF adicionado');
        }
      }

      // .fig — keep the first one
      if (figs.length > 0) setFigFile(figs[0]);

      // Images — append up to 10, validate each
      if (images.length > 0) {
        setImageFiles((prev) => {
          const nextFiles = [...prev];
          const nextPreviews: string[] = [];
          let added = 0;
          for (const file of images) {
            if (nextFiles.length >= 10) {
              toast.warning('Máximo de 10 imagens');
              break;
            }
            const error = validateFile(file, 'image');
            if (error) {
              toast.error(`${file.name}: ${error}`);
              continue;
            }
            nextFiles.push(file);
            nextPreviews.push(URL.createObjectURL(file));
            added++;
          }
          if (added > 0) setImagePreviews((p) => [...p, ...nextPreviews]);
          return nextFiles;
        });
      }

      rejected.forEach((f) =>
        toast.error(`${f.name}: ${t('mockup.brandWizardUnsupportedFile') || 'formato não suportado'}`)
      );
    },
    [t]
  );

  // Dropzone drag handlers (depth-counted so nested children don't flicker)
  const handleZoneDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };
  const handleZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) {
      routeFiles(dropped);
      return;
    }
    // No files — maybe a Figma URL was dragged in
    const text = e.dataTransfer.getData('text/plain').trim();
    if (isFigmaUrl(text)) {
      setFigmaUrl(text);
      toast.success(t('mockup.brandWizardFigmaUrlDetected'));
    }
  };

  const trimmedName = name.trim();
  const trimmedUrl = url.trim();
  const hasUrl = trimmedUrl.length > 0;
  const hasFigma = isFigmaUrl(figmaUrl.trim());
  const canSubmit = trimmedName.length > 0 && !isSubmitting && !isIngesting;
  const isProcessing = isSubmitting || isIngesting;
  const materialsCount = (pdfFile ? 1 : 0) + imageFiles.length + (figFile ? 1 : 0) + (hasFigma ? 1 : 0);
  const hasStagedFiles = !!pdfFile || imageFiles.length > 0 || !!figFile;

  const handleClose = useCallback(() => {
    if (isSubmitting || isIngesting) return;
    setName('');
    setUrl('');
    setPdfFile(null);
    setFigFile(null);
    setImageFiles([]);
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImagePreviews([]);
    onClose();
  }, [isSubmitting, isIngesting, imagePreviews, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;

      setIsSubmitting(true);
      setIngestPhase(t('mockup.brandWizardCreating') || 'Criando guideline…');
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
          const oldUrl = isEditMode ? editGuideline!.identity?.website || '' : '';
          if (!isEditMode || (isEditMode && trimmedUrl !== oldUrl)) {
            setIsSubmitting(false);
            setIsIngesting(true);
            setIngestPhase(t('mockup.brandWizardExtracting') || 'Extraindo do site…');
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
          setIngestPhase(t('mockup.brandWizardReadingFiles') || 'Lendo materiais…');
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
          setIngestPhase(t('mockup.brandWizardReadingFig') || 'Lendo arquivo .fig…');
          try {
            const form = new FormData();
            form.append('file', figFile);
            const token = localStorage.getItem('auth_token') || '';
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            await fetch(`/api/brand-guidelines/${workingId}/extract-fig`, {
              method: 'POST',
              headers,
              body: form,
            });
            toast.success(t('mockup.brandWizardFigExtractSuccess'));
          } catch {
            toast.warning(t('mockup.brandWizardFigExtractError'));
          } finally {
            setIsIngesting(false);
          }
        }

        // Handle Figma URL: link + auto-import all tokens
        const trimmedFigma = figmaUrl.trim();
        if (trimmedFigma && isFigmaUrl(trimmedFigma)) {
          setIsIngesting(true);
          setIngestPhase(t('mockup.brandWizardImportingFigma') || 'Importando tokens do Figma…');
          try {
            await brandGuidelineApi.linkFigmaFile(workingId, trimmedFigma);
            await brandGuidelineApi.importFromFigma(workingId, {
              importColors: true,
              importTypography: true,
            });
            toast.success(t('mockup.brandWizardFigmaTokensImported'));
          } catch (err: any) {
            if (err?.needsToken) {
              toast.warning(t('mockup.brandWizardFigmaNoToken'));
            } else {
              toast.warning(t('mockup.brandWizardFigmaLinkedTokensFailed'));
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
        toast.error(
          isEditMode ? t('mockup.brandWizardErrorEdit') : t('mockup.brandWizardErrorCreate')
        );
      } finally {
        setIsSubmitting(false);
        setIsIngesting(false);
      }
    },
    [
      canSubmit,
      isEditMode,
      trimmedName,
      trimmedUrl,
      editGuideline,
      hasUrl,
      pdfFile,
      onSuccess,
      t,
      qc,
    ]
  );

  const isWizard = !isEditMode;

  // Enter / submit dispatcher: in wizard step 1, advance instead of creating
  const onFormSubmit = (e: React.FormEvent) => {
    if (isWizard && step === 1) {
      e.preventDefault();
      if (trimmedName) setStep(2);
      return;
    }
    handleSubmit(e);
  };

  // ── Reusable field blocks ─────────────────────────────────────────────────
  const identityFields = (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="brand-wizard-name" className="text-sm font-medium text-neutral-300">
          {t('mockup.brandWizardNameLabel')}
        </label>
        <Input
          id="brand-wizard-name"
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('mockup.brandNamePlaceholder')}
          disabled={isProcessing}
          className="w-full bg-neutral-900/60 border border-white/10 rounded-lg px-3.5 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="brand-wizard-url" className="text-sm font-medium text-neutral-300">
          {t('mockup.brandWizardUrlLabel')}
        </label>
        <Input
          id="brand-wizard-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('mockup.brandWizardUrlPlaceholder')}
          disabled={isProcessing}
          className="w-full bg-neutral-900/60 border border-white/10 rounded-lg px-3.5 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors disabled:opacity-50"
        />
        {hasUrl && (
          <p className="text-xs text-neutral-500 mt-0.5">{t('mockup.brandWizardUrlHint')}</p>
        )}
      </div>
    </div>
  );

  const materialsFields = (
    <div className="flex flex-col gap-4">
      {/* Unified drop zone — filters by type, animates while dragging */}
      <input
        ref={allFilesInputRef}
        type="file"
        accept=".pdf,image/*,.fig"
        multiple
        className="hidden"
        disabled={isProcessing}
        onChange={(e) => {
          routeFiles(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isProcessing && allFilesInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isProcessing) {
            e.preventDefault();
            allFilesInputRef.current?.click();
          }
        }}
        onDragEnter={handleZoneDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleZoneDragLeave}
        onDrop={handleZoneDrop}
        className={cn(
          'relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 px-6 flex flex-col items-center justify-center text-center select-none focus:outline-none',
          isDragging
            ? 'border-brand-cyan/60 bg-brand-cyan/[0.06] py-6'
            : 'border-white/10 hover:border-neutral-600 bg-neutral-900/40 py-8'
        )}
      >
        {isDragging ? (
          <FlyingPaperLoader label={t('mockup.brandWizardDropActive') || 'Solte para adicionar'} />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3 text-neutral-500">
              <FileText size={20} />
              <ImageIcon size={20} />
              <Figma size={20} />
            </div>
            <p className="text-sm text-neutral-300">
              {t('mockup.brandWizardDropTitle') || 'Arraste seus arquivos aqui'}
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              {t('mockup.brandWizardDropHint') ||
                'PDF, imagens ou .fig — ou clique para selecionar'}
            </p>
          </>
        )}
      </div>

      {/* Staged files — visual feedback per type */}
      {hasStagedFiles && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {pdfFile && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 max-w-full">
                <FileText size={14} className="text-neutral-300 shrink-0" />
                <span className="text-xs text-white truncate max-w-[140px]">{pdfFile.name}</span>
                <button
                  type="button"
                  onClick={removePdf}
                  className="p-0.5 rounded-full hover:bg-white/5 text-neutral-600 hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {figFile && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 max-w-full">
                <Figma size={14} className="text-neutral-300 shrink-0" />
                <span className="text-xs text-white truncate max-w-[140px]">{figFile.name}</span>
                <button
                  type="button"
                  onClick={removeFig}
                  className="p-0.5 rounded-full hover:bg-white/5 text-neutral-600 hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {imagePreviews.map((preview, index) => (
                <div
                  key={index}
                  className="relative group aspect-square rounded bg-neutral-900 border border-neutral-800 overflow-hidden"
                >
                  <img
                    src={sanitizePreviewUrl(preview)}
                    alt=""
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                  />
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
        </div>
      )}

      {/* Figma URL */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="brand-wizard-figma"
          className="flex items-center gap-1.5 text-xs text-neutral-400"
        >
          <Figma size={12} className="shrink-0" />
          {t('mockup.brandWizardFigmaLabel') || 'Figma (opcional)'}
        </label>
        <Input
          id="brand-wizard-figma"
          type="url"
          value={figmaUrl}
          onChange={(e) => setFigmaUrl(e.target.value)}
          placeholder={t('mockup.brandWizardFigmaPlaceholder')}
          disabled={isProcessing}
          className="w-full bg-neutral-900/60 border border-white/10 rounded-lg px-3.5 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors disabled:opacity-50"
        />
        {hasFigma && (
          <p className="text-xs text-neutral-500 mt-0.5">{t('mockup.brandWizardFigmaHint')}</p>
        )}
      </div>

      <p className="text-xs text-neutral-600">{t('mockup.brandWizardExtractionHint')}</p>
    </div>
  );

  // ── Footer (depends on mode / step / processing) ──────────────────────────
  const ghostBtn =
    'px-4 py-2 text-sm font-mono text-neutral-400 hover:text-white transition-colors disabled:opacity-50';
  const brandBtn = (enabled: boolean) =>
    cn(
      'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-mono text-sm font-bold transition-all',
      enabled
        ? 'bg-brand-cyan text-black hover:bg-brand-cyan/80'
        : 'bg-neutral-800/60 text-neutral-600 cursor-not-allowed'
    );

  let footer: React.ReactNode;
  if (isProcessing) {
    footer = (
      <div className="flex items-center justify-center gap-2 w-full text-sm font-mono text-brand-cyan/80">
        <GlitchLoader size={14} color="var(--brand-cyan)" />
        <span>{ingestPhase || t('mockup.brandWizardExtracting')}</span>
      </div>
    );
  } else if (isWizard && step === 1) {
    footer = (
      <div className="flex items-center gap-3 w-full">
        <Button variant="ghost" type="button" onClick={handleClose} className={ghostBtn}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="brand"
          type="submit"
          form="brand-wizard-form"
          disabled={!trimmedName}
          className={brandBtn(!!trimmedName)}
        >
          <span>{t('mockup.brandWizardNext') || 'Próximo'}</span>
        </Button>
      </div>
    );
  } else {
    // Wizard step 2, or edit mode
    const primaryLabel = isEditMode
      ? t('common.save')
      : materialsCount > 0
      ? t('mockup.brandWizardSubmit')
      : t('mockup.brandWizardSubmitNoUrl');
    footer = (
      <div className="flex items-center gap-3 w-full">
        <Button
          variant="ghost"
          type="button"
          onClick={isWizard ? () => setStep(1) : handleClose}
          className={ghostBtn}
        >
          {isWizard ? t('mockup.brandWizardBack') || 'Voltar' : t('common.cancel')}
        </Button>
        <Button
          variant="brand"
          type="submit"
          form="brand-wizard-form"
          disabled={!canSubmit}
          className={brandBtn(canSubmit)}
        >
          <span>{primaryLabel}</span>
        </Button>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? t('mockup.brandWizardEditTitle') : t('mockup.brandWizardTitle')}
      description={
        isEditMode ? t('mockup.brandWizardEditDescription') : t('mockup.brandWizardDescription')
      }
      size={isEditMode ? 'lg' : 'md'}
      closeOnBackdropClick={!isProcessing}
      closeOnEscape={!isProcessing}
      footer={footer}
    >
      {/* Processing overlay — FlyingPaper animation with live phase label */}
      {isProcessing ? (
        <div className="py-12 flex flex-col items-center justify-center">
          <FlyingPaperLoader label={ingestPhase || t('mockup.brandWizardExtracting')} />
        </div>
      ) : (
        <>
          {/* Step indicator (new mode only) */}
          {isWizard && (
            <div className="flex items-center gap-2 mb-5">
              {[
                { n: 1, label: t('mockup.brandWizardStepIdentity') || 'Identidade' },
                { n: 2, label: t('mockup.brandWizardStepMaterials') || 'Materiais' },
              ].map((s, i) => (
                <React.Fragment key={s.n}>
                  <button
                    type="button"
                    onClick={() => s.n === 1 && setStep(1)}
                    disabled={s.n === 2 && !trimmedName}
                    className={cn(
                      'flex items-center gap-2 text-xs font-mono transition-colors',
                      step === s.n
                        ? 'text-brand-cyan'
                        : 'text-neutral-600 hover:text-neutral-400 disabled:hover:text-neutral-600'
                    )}
                  >
                    <span
                      className={cn(
                        'flex items-center justify-center w-5 h-5 rounded-full border text-[10px] transition-colors',
                        step === s.n
                          ? 'border-brand-cyan text-brand-cyan'
                          : 'border-neutral-700 text-neutral-600'
                      )}
                    >
                      {s.n}
                    </span>
                    {s.label}
                  </button>
                  {i === 0 && (
                    <span className="flex-1 h-px bg-neutral-800" aria-hidden />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          <form
            id="brand-wizard-form"
            onSubmit={onFormSubmit}
            onDrop={handleZoneDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col gap-6"
          >
            {isWizard ? (
              step === 1 ? (
                identityFields
              ) : (
                materialsFields
              )
            ) : (
              <>
                {identityFields}
                {materialsFields}
              </>
            )}
          </form>

          {/* Media Kit — only in edit mode (guideline must exist for uploads) */}
          {isEditMode && editGuideline?.id && (
            <div className="mt-6 pt-5 border-t border-neutral-800">
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
        </>
      )}
    </Modal>
  );
};
