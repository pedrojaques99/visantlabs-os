import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { useExtractFigStream } from '@/hooks/useExtractFigStream';
import { BrandIngestModal } from './BrandIngestModal';
import type { BrandGuideline } from '@/lib/figma-types';

interface BrandIngestButtonProps {
  guideline: BrandGuideline;
  onSuccess: () => void;
}

export const BrandIngestButton: React.FC<BrandIngestButtonProps> = ({ guideline, onSuccess }) => {
  const { state, stream, reset } = useExtractFigStream(guideline.id!);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isActive = state.status === 'streaming' || state.status === 'done' || state.status === 'error';

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (file.name.endsWith('.fig')) {
      stream(file);
    }
    // Non-.fig files: fallback to existing ingest (URL field in dropdown)
  };

  return (
    <>
      <Button
        variant="ghost"
        className="h-8 px-3 gap-1.5 text-xs border border-white/10 text-neutral-400 hover:text-neutral-200"
        disabled={state.status === 'streaming'}
        onClick={() => fileInputRef.current?.click()}
      >
        {state.status === 'streaming'
          ? <Loader2 size={13} className="animate-spin" />
          : <Upload size={13} />}
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

      {isActive && (
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
