import React, { useRef, useState, useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Image as ImageIcon, Plus, Loader2, ChevronLeft, ChevronRight, Palette } from 'lucide-react';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const handleLogoUpload = useCallback(async (files: File[]) => {
    if (isUploading || !guideline.id) return;
    setIsUploading(true);

    try {
      for (const file of files) {
        const base64 = await fileToBase64(file);
        const result = await brandGuidelineApi.uploadLogo(
          guideline.id,
          base64,
          'primary',
          file.name.replace(/\.[^/.]+$/, ''),
        );
        onLogosChange(result.allLogos);
      }
      toast.success('Logo uploaded successfully');
    } catch (err) {
      toast.error('Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  }, [guideline.id, isUploading, onLogosChange]);

  return (
    <SectionBlock
      id="logos"
      icon={<ImageIcon size={14} />}
      title="Logotype"
      span={span as any}
      expandedContent={logos && logos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {logos.map((logo, i) => (
            <div key={i} className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-neutral-950/30 border border-white/[0.04] hover:border-brand-cyan/20 transition-all group/logo-item">
              <div className="w-full aspect-square flex items-center justify-center rounded-xl bg-neutral-950/40 overflow-hidden">
                <img
                  src={logo.url}
                  alt={logo.label || `Logo ${i + 1}`}
                  className="max-h-[80%] max-w-[80%] object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)] group-hover/logo-item:scale-105 transition-transform duration-500"
                />
              </div>
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest truncate max-w-full">
                {logo.label || `Logo ${i + 1}`}
              </span>
            </div>
          ))}
        </div>
      ) : undefined}
      actions={(
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-neutral-500 hover:text-white"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? <Loader2 size={12} className="animate-spin text-brand-cyan" /> : <Plus size={12} />}
        </Button>
      )}
    >
      <div className="flex flex-col h-full min-h-[300px] p-2 relative group/section">
        {isUploading && (
          <div className="absolute inset-0 z-20 bg-neutral-950/60 backdrop-blur-md flex items-center justify-center rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Loader2 size={32} className="animate-spin text-brand-cyan" />
                <div className="absolute inset-0 blur-xl bg-brand-cyan/20 animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold font-mono text-brand-cyan uppercase tracking-widest">Processing Assets</span>
                <div className="h-[1px] flex-1 bg-white/[0.03]" />
              </div>
            </div>
          </div>
        )}

        {logos && logos.length > 0 ? (
          <div className="relative flex-1 flex flex-col gap-6 w-full h-full pb-4">
            {/* Main Stage */}
            <div className="relative flex-1 w-full flex items-center justify-center rounded-3xl bg-neutral-950/40 border border-white/[0.03] group-hover/section:bg-neutral-950/60 group-hover/section:border-white/[0.06] transition-all duration-700 overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.4)]">
              {/* Background Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-brand-cyan/5 blur-[120px] rounded-full opacity-0 group-hover/section:opacity-100 transition-opacity duration-1000" />

              {/* Floating Label (On Hover) */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover/section:opacity-100 transition-all duration-500 pointer-events-none">
                <div className="px-3 py-1.5 rounded-lg bg-neutral-900/40 border border-white/[0.03] text-[11px] text-neutral-200 transition-all cursor-default font-medium tracking-tight flex items-center gap-2 group/tag">
                  <span className="uppercase tracking-widest leading-none">
                    {logos[Math.min(currentIndex, logos.length - 1)].label || `Logo ${currentIndex + 1}`}
                  </span>
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-8">
                <img
                  src={logos[Math.min(currentIndex, logos.length - 1)].url}
                  alt={logos[Math.min(currentIndex, logos.length - 1)].label || `Logo ${currentIndex + 1}`}
                  className="w-full h-full object-contain filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] group-hover/section:scale-110 transition-transform duration-1000 ease-out select-none"
                />
              </div>

              {/* Navigation Controls */}
              {logos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentIndex((prev) => (prev - 1 + logos.length) % logos.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full bg-neutral-900/40 backdrop-blur-md border border-white/[0.06] text-neutral-400 hover:text-white hover:bg-neutral-800/80 hover:border-brand-cyan/40 opacity-0 group-hover/section:opacity-100 -translate-x-4 group-hover/section:translate-x-0 transition-all duration-500"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => setCurrentIndex((prev) => (prev + 1) % logos.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full bg-neutral-900/40 backdrop-blur-md border border-white/[0.06] text-neutral-400 hover:text-white hover:bg-neutral-800/80 hover:border-brand-cyan/40 opacity-0 group-hover/section:opacity-100 translate-x-4 group-hover/section:translate-x-0 transition-all duration-500"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Pagination Only */}
            <div className="flex flex-col items-center gap-4">
              {logos.length > 1 && (
                <div className="flex items-center gap-2">
                  {logos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`h-1 rounded-full transition-all duration-500 ${i === Math.min(currentIndex, logos.length - 1)
                        ? 'w-8 bg-brand-cyan shadow-[0_0_10px_rgba(var(--brand-cyan-rgb),0.5)]'
                        : 'w-2 bg-neutral-800 hover:bg-neutral-600'
                        }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 w-full h-full flex-1 opacity-100">
            {[
              { label: 'Main Logo', icon: ImageIcon },
              { label: 'Symbol', icon: Palette },
              { label: 'Negative', icon: ImageIcon },
              { label: 'Alternative', icon: ImageIcon },
            ].map((p, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border border-white/[0.02] bg-white/[0.01] h-full w-full cursor-pointer hover:bg-white/[0.03] transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-lg text-neutral-800 border border-dashed border-white/5">
                  <p.icon size={20} strokeWidth={1} />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{p.label}</span>
              </div>
            ))}
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) handleLogoUpload(files);
            e.target.value = '';
          }}
        />
      </div>
    </SectionBlock>
  );
};
