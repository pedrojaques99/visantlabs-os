import React, { useRef, useState, useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Image as ImageIcon, Plus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';

interface LogosSectionProps {
  guideline: BrandGuideline;
  logos: BrandGuideline['logos'];
  onLogosChange: (logos: BrandGuideline['logos']) => void;
  span?: string;
}

export const LogosSection: React.FC<LogosSectionProps> = ({ guideline, logos, onLogosChange, span }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const handleUpload = useCallback(async (files: File[]) => {
    if (isUploading || !guideline.id) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        const base64 = await fileToBase64(file);
        const result = await brandGuidelineApi.uploadLogo(guideline.id, base64, 'primary', file.name.replace(/\.[^/.]+$/, ''));
        onLogosChange(result.allLogos);
      }
      toast.success('Logo uploaded');
    } catch {
      toast.error('Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  }, [guideline.id, isUploading, onLogosChange]);

  const handleDelete = useCallback(async (index: number) => {
    if (!logos) return;
    const updated = logos.filter((_, i) => i !== index);
    onLogosChange(updated);
  }, [logos, onLogosChange]);

  return (
    <SectionBlock
      id="logos"
      icon={<ImageIcon size={14} />}
      title="Logotype"
      span={span as any}
      actions={(
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" disabled={isUploading} onClick={() => fileInputRef.current?.click()} aria-label="Upload logo">
          {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        </Button>
      )}
    >
      <div
        className="min-h-[80px]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (files.length) handleUpload(files); }}
      >
        {logos && logos.length > 0 ? (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {logos.map((logo, i) => (
              <div key={i} className="relative group/logo flex flex-col items-center gap-1.5 p-3 rounded-md border border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08] transition-colors">
                <div className="w-full h-16 flex items-center justify-center">
                  <img src={logo.url} alt={logo.label || `Logo ${i + 1}`} className="max-h-full max-w-full object-contain" />
                </div>
                <span className="text-[10px] font-mono text-neutral-500 truncate w-full text-center">{logo.label || `Logo ${i + 1}`}</span>
                <Button
                  variant="ghost" size="icon"
                  className="absolute top-1 right-1 h-5 w-5 text-neutral-700 hover:text-red-400 opacity-0 group-hover/logo:opacity-100 transition-all"
                  onClick={() => handleDelete(i)} aria-label="Remove logo"
                >
                  <Trash2 size={10} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <button
            className="w-full h-20 flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-white/10 text-neutral-700 hover:border-white/20 hover:text-neutral-500 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon size={18} strokeWidth={1} />
            <span className="text-[10px] font-mono">Drop or click to upload</span>
          </button>
        )}
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple
        onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) handleUpload(files); e.target.value = ''; }}
      />
    </SectionBlock>
  );
};
