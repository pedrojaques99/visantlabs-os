import React, { useRef, useState, useCallback } from 'react';
import { Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { useExtractFigStream } from '@/hooks/useExtractFigStream';
import { BrandIngestModal } from './BrandIngestModal';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { buildBrandIngestPayload } from '@/hooks/queries/useBrandImport';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';

interface BrandIngestButtonProps {
  guideline: BrandGuideline;
  onSuccess: () => void;
}

const FigmaIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
    <path d="M8 24C10.208 24 12 22.208 12 20V16H8C5.792 16 4 17.792 4 20C4 22.208 5.792 24 8 24Z" fill="#0ACF83"/>
    <path d="M4 12C4 9.792 5.792 8 8 8H12V16H8C5.792 16 4 14.208 4 12Z" fill="#A259FF"/>
    <path d="M4 4C4 1.792 5.792 0 8 0H12V8H8C5.792 8 4 6.208 4 4Z" fill="#F24E1E"/>
    <path d="M12 0H16C18.208 0 20 1.792 20 4C20 6.208 18.208 8 16 8H12V0Z" fill="#FF7262"/>
    <path d="M20 12C20 14.208 18.208 16 16 16C13.792 16 12 14.208 12 12C12 9.792 13.792 8 16 8C18.208 8 20 9.792 20 12Z" fill="#1ABCFE"/>
  </svg>
);

export const BrandIngestButton: React.FC<BrandIngestButtonProps> = ({ guideline, onSuccess }) => {
  const { state, stream, reset } = useExtractFigStream(guideline.id!);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const figInputRef = useRef<HTMLInputElement>(null);

  const [figmaUrl, setFigmaUrl] = useState('');
  const [showFigmaInput, setShowFigmaInput] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);

  const isBusy = state.status === 'streaming' || isIngesting;
  const isFigStreamActive = state.status === 'streaming' || state.status === 'done' || state.status === 'error';

  const handleFileIngest = useCallback(async (files: File[]) => {
    if (!files.length) return;
    // .fig files go through the streaming extractor
    const figFile = files.find(f => f.name.endsWith('.fig'));
    if (figFile) { stream(figFile); return; }

    setIsIngesting(true);
    try {
      const payload = await buildBrandIngestPayload(files);
      if (payload) {
        await brandGuidelineApi.ingest(guideline.id!, payload);
        toast.success('Extração concluída');
        onSuccess();
      }
    } catch {
      toast.error('Erro na extração');
    } finally {
      setIsIngesting(false);
    }
  }, [guideline.id, stream, onSuccess]);

  const handleFigmaSubmit = useCallback(async () => {
    const url = figmaUrl.trim();
    if (!url) return;
    setIsIngesting(true);
    try {
      await brandGuidelineApi.linkFigmaFile(guideline.id!, url);
      await brandGuidelineApi.importFromFigma(guideline.id!, { importColors: true, importTypography: true });
      toast.success('Tokens Figma importados');
      onSuccess();
    } catch (err: any) {
      if (err?.needsToken) toast.warning('Token Figma não configurado — vá em Perfil > Configuração');
      else toast.warning('Figma linkado, mas extração de tokens falhou');
    } finally {
      setIsIngesting(false);
      setFigmaUrl('');
      setShowFigmaInput(false);
    }
  }, [guideline.id, figmaUrl, onSuccess]);

  const btnClass = "flex items-center gap-1.5 h-8 px-3 text-xs font-mono border border-white/10 rounded-md text-neutral-400 hover:text-neutral-200 hover:border-white/20 transition-all disabled:opacity-40 bg-transparent";

  return (
    <>
      {/* PDF */}
      <button
        className={btnClass}
        disabled={isBusy}
        onClick={() => pdfInputRef.current?.click()}
        title="Upload PDF (brandbook ou guia)"
      >
        {isIngesting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
        <span className="hidden sm:inline">PDF</span>
      </button>
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={e => { handleFileIngest(Array.from(e.target.files || [])); e.target.value = ''; }}
      />

      {/* Images */}
      <button
        className={btnClass}
        disabled={isBusy}
        onClick={() => imageInputRef.current?.click()}
        title="Upload imagens da marca"
      >
        <ImageIcon size={12} />
        <span className="hidden sm:inline">Images</span>
      </button>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => { handleFileIngest(Array.from(e.target.files || [])); e.target.value = ''; }}
      />

      {/* .fig file (hidden trigger) */}
      <input
        ref={figInputRef}
        type="file"
        accept=".fig"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) stream(f); e.target.value = ''; }}
      />

      {/* Figma URL */}
      {showFigmaInput ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={figmaUrl}
            onChange={e => setFigmaUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleFigmaSubmit(); if (e.key === 'Escape') { setShowFigmaInput(false); setFigmaUrl(''); } }}
            placeholder="figma.com/file/..."
            className={cn(
              "h-8 w-52 text-xs font-mono bg-neutral-900/60 border-white/15 text-white placeholder:text-neutral-700",
              "focus-visible:ring-0 focus-visible:border-white/30"
            )}
            disabled={isIngesting}
          />
          <button
            className={cn(btnClass, "px-2")}
            disabled={!figmaUrl.trim() || isIngesting}
            onClick={handleFigmaSubmit}
          >
            {isIngesting ? <Loader2 size={12} className="animate-spin" /> : '↵'}
          </button>
        </div>
      ) : (
        <button
          className={btnClass}
          disabled={isBusy}
          onClick={() => setShowFigmaInput(true)}
          title="Link Figma file"
        >
          <FigmaIcon />
          <span className="hidden sm:inline">Figma</span>
        </button>
      )}

      {isFigStreamActive && (
        <BrandIngestModal
          state={state}
          guideline={guideline}
          onSuccess={() => { onSuccess(); reset(); }}
          onClose={reset}
        />
      )}
    </>
  );
};
