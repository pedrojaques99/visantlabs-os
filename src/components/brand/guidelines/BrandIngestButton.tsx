import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Upload, Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { BrandIngestApproval } from './BrandIngestApproval';
import type { BrandGuideline } from '@/lib/figma-types';

interface BrandIngestButtonProps {
  guideline: BrandGuideline;
  onSuccess: () => void;
}

const isFigmaUrl = (url: string) => url.includes('figma.com/');

export const BrandIngestButton: React.FC<BrandIngestButtonProps> = ({ guideline, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  const [figmaPreview, setFigmaPreview] = useState<null | { fileKey: string; fileName: string; colors: number; typography: number; components: number }>(null);
  const [approval, setApproval] = useState<null | { extracted: any; preview: BrandGuideline; payload: any; images?: string[] }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  // Step 1: dry run — extract without saving, show approval modal
  const dryRun = async (payload: Parameters<typeof brandGuidelineApi.ingest>[1]) => {
    setLoading(true);
    setOpen(false);
    try {
      const result = await brandGuidelineApi.ingest(guideline.id!, { ...payload, dryRun: true });
      if (result.dryRun && result.preview) {
        setApproval({ extracted: result.extracted, preview: result.preview as BrandGuideline, payload });
      }
    } catch (err: any) {
      toast.error(err?.needsToken ? 'Figma token required — Settings → Integrations' : (err?.message || 'Extraction failed'));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: apply approved data
  const apply = async () => {
    if (!approval) return;
    setApplying(true);
    try {
      if (approval.payload === null) {
        // .fig path: save structured tokens directly, then upload images via ingest
        const { colors, typography } = approval.preview;
        await brandGuidelineApi.update(guideline.id!, { colors, typography } as any);
        // Upload any extracted images so they get classified (logos vs media)
        if (approval.images?.length) {
          await brandGuidelineApi.ingest(guideline.id!, {
            source: 'images',
            images: approval.images,
            dryRun: false,
          });
        }
      } else {
        await brandGuidelineApi.ingest(guideline.id!, { ...approval.payload, dryRun: false });
      }
      toast.success('Brand data applied');
      onSuccess();
      setApproval(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  const handleUrlSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    if (isFigmaUrl(trimmed)) {
      setLoading(true);
      try {
        const p = await brandGuidelineApi.previewFigmaUrl(trimmed);
        setFigmaPreview({ fileKey: p.fileKey, fileName: p.fileName, colors: p.colors.length, typography: p.typography.length, components: p.components.length });
      } catch (err: any) {
        toast.error(err?.needsToken ? 'Figma token required — Settings → Integrations' : (err?.message || 'Could not preview Figma file'));
      } finally {
        setLoading(false);
      }
    } else {
      await dryRun({ source: 'url', url: trimmed });
      setUrl('');
    }
  };

  const handleFigmaImport = () => dryRun({ source: 'figma', url: url.trim() });

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const isPdf = file.type === 'application/pdf';
    const isFig = file.name.endsWith('.fig');

    if (isFig) {
      // Dedicated multipart endpoint — handles 400MB+ files, extracts colors/fonts/components
      // directly from the Kiwi binary (no Figma token needed)
      setLoading(true);
      setOpen(false);
      try {
        toast.info(`Parsing ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)…`);
        const result = await brandGuidelineApi.extractFig(guideline.id!, file);
        setApproval({ extracted: result.extracted, preview: result.preview, payload: null, images: (result as any).images });
      } catch (err: any) {
        toast.error(err?.message || 'Failed to parse .fig file');
      } finally {
        setLoading(false);
      }
      return;
    }

    const base64 = await fileToBase64(file);
    if (isPdf) {
      await dryRun({ source: 'pdf', data: base64, filename: file.name });
    } else {
      const images = await Promise.all(Array.from(files).map(fileToBase64));
      await dryRun({ source: 'images', images });
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 px-3 gap-1.5 text-xs border border-white/10 text-neutral-400 hover:text-neutral-200" disabled={loading || applying}>
            {(loading || applying) ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            <span className="hidden sm:inline">Extract</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72 p-3 space-y-3" onCloseAutoFocus={e => e.preventDefault()}>
          {/* URL */}
          <div className="space-y-1.5">
            <MicroTitle className="text-neutral-600">Website or Figma URL</MicroTitle>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={e => { setUrl(e.target.value); setFigmaPreview(null); }}
                onKeyDown={e => { if (e.key === 'Enter') handleUrlSubmit(); }}
                placeholder="https://... or figma.com/..."
                className="h-7 text-xs border-white/[0.08] bg-transparent placeholder:text-neutral-700 flex-1"
                autoFocus
              />
              <Button
                variant="ghost" size="sm"
                className="h-7 px-2 text-[10px] border border-white/[0.08] text-neutral-500 hover:text-neutral-200 shrink-0"
                onClick={handleUrlSubmit}
                disabled={!url.trim() || loading}
              >
                {isFigmaUrl(url) ? 'Preview' : 'Extract'}
              </Button>
            </div>
          </div>

          {/* Figma preview */}
          {figmaPreview && (
            <div className="rounded-md border border-white/[0.08] p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <Link2 size={11} className="text-neutral-500 shrink-0" />
                <p className="text-xs text-neutral-300 truncate font-medium">{figmaPreview.fileName}</p>
              </div>
              <div className="flex gap-3 text-[10px] font-mono text-neutral-500">
                <span>{figmaPreview.colors} colors</span>
                <span>{figmaPreview.typography} fonts</span>
                <span>{figmaPreview.components} components</span>
              </div>
              <Button onClick={handleFigmaImport} disabled={loading} className="w-full h-6 text-[10px] bg-white/[0.06] border border-white/10 text-neutral-200 hover:bg-white/[0.10]">
                {loading ? <Loader2 size={11} className="animate-spin mr-1" /> : null}
                Preview & approve
              </Button>
            </div>
          )}

          {/* File upload */}
          <div className="space-y-1.5">
            <MicroTitle className="text-neutral-600">Upload file</MicroTitle>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 h-8 rounded-md border border-dashed border-white/[0.08] text-[10px] text-neutral-600 hover:border-white/20 hover:text-neutral-400 transition-colors font-mono"
            >
              <Upload size={11} />
              Image, PDF or .fig
            </button>
            <p className="text-[9px] text-neutral-700 font-mono">.fig · image · PDF</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.fig"
        multiple
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Approval modal */}
      {approval && (
        <BrandIngestApproval
          extracted={approval.extracted}
          preview={approval.preview}
          existing={guideline}
          images={approval.images}
          onApprove={apply}
          onReject={() => setApproval(null)}
          isApplying={applying}
        />
      )}
    </>
  );
};
