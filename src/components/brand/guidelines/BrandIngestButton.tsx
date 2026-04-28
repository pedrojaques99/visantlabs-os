import React, { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { useExtractFileStream } from '@/hooks/useExtractFigStream';
import { useIngestAsStream } from '@/hooks/useIngestAsStream';
import { BrandIngestModal } from './BrandIngestModal';
import type { BrandGuideline } from '@/lib/figma-types';
import type { FigStreamState } from '@/hooks/useExtractFigStream';

interface BrandIngestButtonProps {
  guideline: BrandGuideline;
  onSuccess: () => void;
}

type SourceTag = 'fig_file' | 'pdf' | 'images';
type ActiveSource = { state: FigStreamState; reset: () => void; title: string; source: SourceTag } | null;

/**
 * Single entry-point for all brand extraction types.
 *   .fig   → /extract-fig  (streaming NDJSON, binary Figma parse)
 *   .pdf   → /extract-pdf  (streaming NDJSON, Gemini native PDF vision)
 *   images → useIngestAsStream (dryRun /ingest → normalised FigStreamState)
 * All paths share BrandIngestModal for the approve/select/apply step.
 */
export const BrandIngestButton: React.FC<BrandIngestButtonProps> = ({ guideline, onSuccess }) => {
  const fig    = useExtractFileStream(guideline.id!, 'extract-fig');
  const pdf    = useExtractFileStream(guideline.id!, 'extract-pdf');
  const images = useIngestAsStream(guideline.id!);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Whichever hook is not idle drives the modal
  const active: ActiveSource =
    fig.state.status    !== 'idle' ? { state: fig.state,    reset: fig.reset,    title: 'Extract from .fig', source: 'fig_file' } :
    pdf.state.status    !== 'idle' ? { state: pdf.state,    reset: pdf.reset,    title: 'Extract from PDF',  source: 'pdf'      } :
    images.state.status !== 'idle' ? { state: images.state, reset: images.reset, title: 'Review extraction', source: 'images'   } :
    null;

  const isBusy    = !!active && active.state.status === 'streaming';
  const showModal = !!active && active.state.status !== 'idle';

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];

    if (file.name.endsWith('.fig')) {
      fig.stream(file);
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      pdf.stream(file);
    } else {
      await images.ingest(Array.from(files));
    }
  }, [fig, pdf, images]);

  return (
    <>
      <Button
        variant="ghost"
        className="h-8 px-3 gap-1.5 text-xs border border-white/10 text-neutral-400 hover:text-neutral-200"
        disabled={isBusy}
        onClick={() => fileInputRef.current?.click()}
      >
        {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        <span className="hidden sm:inline">Extract</span>
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".fig,.pdf,image/*"
        multiple
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {showModal && active && (
        <BrandIngestModal
          title={active.title}
          source={active.source}
          state={active.state}
          guideline={guideline}
          onSuccess={() => { onSuccess(); active.reset(); }}
          onClose={active.reset}
        />
      )}
    </>
  );
};
