import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { useExtractFileStream } from '@/hooks/useExtractFigStream';
import { useIngestAsStream } from '@/hooks/useIngestAsStream';
import { BrandIngestModal } from './BrandIngestModal';
import type { BrandGuideline } from '@/lib/figma-types';
import type { FigStreamState } from '@/hooks/useExtractFigStream';

import { GlitchLoader } from '@/components/ui/GlitchLoader';

const IDLE_STATE: FigStreamState = {
  status: 'idle',
  statusMessage: '',
};

interface BrandIngestButtonProps {
  guideline: BrandGuideline;
  onSuccess: () => void;
  triggerRef?: React.MutableRefObject<((files: FileList) => void) | null>;
}

type SourceTag = 'fig_file' | 'pdf' | 'images';
type ActiveSource = {
  state: FigStreamState;
  reset: () => void;
  title: string;
  source: SourceTag;
} | null;

/**
 * Single entry-point for all brand extraction types.
 *   .fig   → /extract-fig  (streaming NDJSON, binary Figma parse)
 *   .pdf   → /extract-pdf  (streaming NDJSON, Gemini native PDF vision)
 *   images → useIngestAsStream (dryRun /ingest → normalised FigStreamState)
 * All paths share BrandIngestModal for the approve/select/apply step.
 *
 * Click opens the modal in drop zone mode first — user can drag & drop or browse.
 */
export const BrandIngestButton: React.FC<BrandIngestButtonProps> = ({
  guideline,
  onSuccess,
  triggerRef,
}) => {
  const fig = useExtractFileStream(guideline.id!, 'extract-fig');
  const pdf = useExtractFileStream(guideline.id!, 'extract-pdf');
  const images = useIngestAsStream(guideline.id!);
  const [showDropZoneModal, setShowDropZoneModal] = useState(false);

  // Whichever hook is not idle drives the modal
  const active: ActiveSource =
    fig.state.status !== 'idle'
      ? { state: fig.state, reset: fig.reset, title: 'Extract from .fig', source: 'fig_file' }
      : pdf.state.status !== 'idle'
      ? { state: pdf.state, reset: pdf.reset, title: 'Extract from PDF', source: 'pdf' }
      : images.state.status !== 'idle'
      ? { state: images.state, reset: images.reset, title: 'Review extraction', source: 'images' }
      : null;

  const isBusy = !!active && active.state.status === 'streaming';
  const showExtractModal = !!active && active.state.status !== 'idle';

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setShowDropZoneModal(false);
      const file = files[0];

      if (file.name.endsWith('.fig')) {
        fig.stream(file);
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        pdf.stream(file);
      } else if (
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.type === 'text/plain' ||
        file.type === 'text/markdown'
      ) {
        pdf.stream(file);
      } else {
        await images.ingest(Array.from(files));
      }
    },
    [fig, pdf, images]
  );

  useEffect(() => {
    if (triggerRef) triggerRef.current = handleFiles;
    return () => {
      if (triggerRef) triggerRef.current = null;
    };
  }, [triggerRef, handleFiles]);

  const handleClose = useCallback(() => {
    setShowDropZoneModal(false);
    if (active) active.reset();
  }, [active]);

  return (
    <>
      <Button
        variant="ghost"
        className="h-8 px-3 gap-1.5 text-xs border border-white/10 text-neutral-400 hover:text-neutral-200"
        disabled={isBusy}
        onClick={() => setShowDropZoneModal(true)}
      >
        {isBusy ? <GlitchLoader size={13} /> : <Upload size={13} />}
        <span className="hidden sm:inline">Extract</span>
      </Button>

      {/* Drop zone modal (no extraction running yet) */}
      {showDropZoneModal && !showExtractModal && (
        <BrandIngestModal
          title="Extract Brand"
          source="manual"
          state={IDLE_STATE}
          guideline={guideline}
          showDropZone
          onDropFiles={handleFiles}
          onSuccess={onSuccess}
          onClose={() => setShowDropZoneModal(false)}
        />
      )}

      {/* Extraction/Review modal (extraction in progress or done) */}
      {showExtractModal && active && (
        <BrandIngestModal
          title={active.title}
          source={active.source}
          state={active.state}
          guideline={guideline}
          onSuccess={() => {
            onSuccess();
            active.reset();
            setShowDropZoneModal(false);
          }}
          onClose={handleClose}
        />
      )}
    </>
  );
};
