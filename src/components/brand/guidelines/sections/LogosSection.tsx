import React, { useRef, useState, useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Image as ImageIcon, Plus, Trash2, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';

import { GlitchLoader } from '@/components/ui/GlitchLoader';
interface LogosSectionProps {
  guideline: BrandGuideline;
  logos: BrandGuideline['logos'];
  onLogosChange: (logos: BrandGuideline['logos']) => void;
  span?: string;
}

export const LogosSection: React.FC<LogosSectionProps> = ({
  guideline,
  logos,
  onLogosChange,
  span,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (isUploading || !guideline.id) return;
      setIsUploading(true);
      // Only the first logo (when none exists) becomes the primary; later uploads
      // are 'custom' so they don't silently override the chosen brand logo.
      let hasPrimary = (logos || []).some((l) => l.variant === 'primary');
      try {
        for (const file of files) {
          const base64 = await fileToBase64(file);
          const result = await brandGuidelineApi.uploadLogo(
            guideline.id,
            base64,
            hasPrimary ? 'custom' : 'primary',
            file.name.replace(/\.[^/.]+$/, '')
          );
          hasPrimary = true;
          onLogosChange(result.allLogos);
        }
        toast.success('Logo uploaded');
      } catch {
        toast.error('Failed to upload logo');
      } finally {
        setIsUploading(false);
      }
    },
    [guideline.id, isUploading, logos, onLogosChange]
  );

  // "Select as logo" — promote one asset to the brand's primary logo (the one
  // used in avatars + mockups) and demote any previous primary to 'custom'.
  // Meaningful variants (light/dark/icon/accent) are preserved.
  const handleSetPrimary = useCallback(
    (index: number) => {
      if (!logos) return;
      const target = logos[index];
      if (!target || target.variant === 'primary') return;
      const updated = logos.map((l, i) => {
        if (i === index) return { ...l, variant: 'primary' as const };
        if (l.variant === 'primary') return { ...l, variant: 'custom' as const };
        return l;
      });
      onLogosChange(updated);
      toast.success(`"${target.label || 'Logo'}" set as brand logo`);
    },
    [logos, onLogosChange]
  );

  const handleDelete = useCallback(
    async (index: number) => {
      if (!logos || !guideline.id) return;
      const logo = logos[index];
      if (!logo) return;
      const updated = logos.filter((_, i) => i !== index);
      onLogosChange(updated);
      try {
        if (logo.id) await brandGuidelineApi.deleteLogo(guideline.id, logo.id);
      } catch {
        onLogosChange(logos);
        toast.error('Failed to delete logo');
      }
    },
    [guideline.id, logos, onLogosChange]
  );

  return (
    <SectionBlock
      id="logos"
      icon={<ImageIcon size={14} />}
      title="Logotype"
      span={span as any}
      actions={
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-neutral-500 hover:text-white"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload logo"
        >
          {isUploading ? <GlitchLoader size={12} /> : <Plus size={12} />}
        </Button>
      }
    >
      <div
        className="min-h-[80px]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
          if (files.length) handleUpload(files);
        }}
      >
        {logos && logos.length > 0 ? (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
          >
            {logos.map((logo, i) => {
              if (!logo.url) return null;
              const isPrimary = logo.variant === 'primary';
              const ext = (logo.url ?? '').split('?')[0].toLowerCase();
              const fmt = ext.endsWith('.svg')
                ? 'SVG'
                : ext.endsWith('.png')
                  ? 'PNG'
                  : ext.endsWith('.jpg') || ext.endsWith('.jpeg')
                    ? 'JPG'
                    : ext.endsWith('.webp')
                      ? 'WEBP'
                      : '';
              return (
                <div
                  key={logo.id || i}
                  className={cn(
                    'relative group/logo flex flex-col items-center gap-1.5 p-3 rounded-md border bg-white/[0.03] transition-colors',
                    isPrimary
                      ? 'border-brand-cyan/40 ring-1 ring-brand-cyan/20'
                      : 'border-neutral-800 hover:border-white/10'
                  )}
                >
                  {/* Set-as-logo / primary indicator (top-left) */}
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(i)}
                    disabled={isPrimary}
                    title={isPrimary ? 'Brand logo (avatars & mockups)' : 'Set as brand logo'}
                    aria-label={isPrimary ? 'Current brand logo' : 'Set as brand logo'}
                    className={cn(
                      'absolute top-1 left-1 z-10 h-5 w-5 flex items-center justify-center rounded transition-all',
                      isPrimary
                        ? 'text-brand-cyan cursor-default'
                        : 'text-neutral-600 hover:text-brand-cyan opacity-0 group-hover/logo:opacity-100'
                    )}
                  >
                    <Gem size={11} className={isPrimary ? 'fill-brand-cyan' : ''} />
                  </button>

                  {/* Delete (top-right) */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 z-10 h-5 w-5 text-neutral-700 hover:text-destructive opacity-0 group-hover/logo:opacity-100 transition-all"
                    onClick={() => handleDelete(i)}
                    aria-label="Remove logo"
                  >
                    <Trash2 size={10} />
                  </Button>

                  <div className="w-full h-16 flex items-center justify-center">
                    <img
                      src={logo.url}
                      alt={logo.label || `Logo ${i + 1}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500 truncate w-full text-center">
                    {isPrimary && <span className="text-brand-cyan">● </span>}
                    {logo.label || `Logo ${i + 1}`}
                    {fmt && <span className="text-neutral-700"> · {fmt}</span>}
                  </span>
                </div>
              );
            })}
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

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) handleUpload(files);
          e.target.value = '';
        }}
      />
    </SectionBlock>
  );
};
