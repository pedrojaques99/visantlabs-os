import React, { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { useExtractFigStream } from '@/hooks/useExtractFigStream';
import { useIngestAsStream } from '@/hooks/useIngestAsStream';
import { BrandIngestModal } from './BrandIngestModal';
import type { BrandGuideline } from '@/lib/figma-types';

interface BrandIngestButtonProps {
  guideline: BrandGuideline;
  onSuccess: () => void;
}

/**
 * Single entry-point for all brand extraction types.
 * - .fig  → useExtractFigStream (streaming NDJSON)
 * - PDF / images → useIngestAsStream (dryRun /ingest → normalised to FigStreamState)
 * Both paths share BrandIngestModal for the approve/select/apply step.
 */
export const BrandIngestButton: React.FC<BrandIngestButtonProps> = ({ guideline, onSuccess }) => {
  const fig    = useExtractFigStream(guideline.id!);
  const other  = useIngestAsStream(guideline.id!);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Whichever hook is active drives the modal
  const active      = fig.state.status !== 'idle' ? fig.state : other.state;
  const activeReset = fig.state.status !== 'idle' ? fig.reset  : other.reset;
  const activeTitle = fig.state.status !== 'idle' ? 'Extract from .fig' : 'Review extraction';

  const isBusy    = active.status === 'streaming';
  const showModal = active.status !== 'idle';

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    if (files[0].name.endsWith('.fig')) {
      fig.stream(files[0]);
    } else {
      await other.ingest(Array.from(files));
    }
  }, [fig, other]);

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
        accept=".fig,image/*,.pdf"
        multiple
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {showModal && (
        <BrandIngestModal
          title={activeTitle}
          state={active}
          guideline={guideline}
          onSuccess={() => { onSuccess(); activeReset(); }}
          onClose={activeReset}
        />
      )}
    </>
  );
};
