import React, { useRef, useState, useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Image as ImageIcon, Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider truncate max-w-full">
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
      <div className="flex flex-col items-center justify-center min-h-[120px] py-4 px-3 relative">
        {isUploading && (
          <div className="absolute inset-0 z-10 bg-neutral-950/40 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
             <div className="flex flex-col items-center gap-2">
                <Loader2 size={20} className="animate-spin text-brand-cyan" />
                <span className="text-[9px] font-mono text-brand-cyan uppercase tracking-widest">Processing</span>
             </div>
          </div>
        )}

        {logos && logos.length > 0 ? (
          <div className="relative group/logo flex flex-col items-center gap-4 w-full">
            <div className="relative w-full aspect-[3/2] flex items-center justify-center rounded-2xl bg-neutral-950/20 border border-white/[0.02] group-hover/logo:bg-neutral-950/40 transition-all duration-500 overflow-hidden">
              <img
                src={logos[Math.min(currentIndex, logos.length - 1)].url}
                alt={logos[Math.min(currentIndex, logos.length - 1)].label || `Logo ${currentIndex + 1}`}
                className="max-h-[80px] w-[75%] object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)] group-hover/logo:scale-105 transition-transform duration-500"
              />
              {logos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentIndex((prev) => (prev - 1 + logos.length) % logos.length)}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full bg-neutral-900/60 backdrop-blur-sm border border-white/[0.06] text-neutral-400 hover:text-white hover:bg-neutral-800/80 opacity-0 group-hover/logo:opacity-100 transition-all duration-300"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    onClick={() => setCurrentIndex((prev) => (prev + 1) % logos.length)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full bg-neutral-900/60 backdrop-blur-sm border border-white/[0.06] text-neutral-400 hover:text-white hover:bg-neutral-800/80 opacity-0 group-hover/logo:opacity-100 transition-all duration-300"
                  >
                    <ChevronRight size={12} />
                  </button>
                </>
              )}
            </div>
            {logos.length > 1 && (
              <div className="flex items-center gap-1.5">
                {logos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === Math.min(currentIndex, logos.length - 1)
                        ? 'w-3 bg-brand-cyan'
                        : 'w-1 bg-neutral-700 hover:bg-neutral-500'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-5 py-8">
            <ImageIcon size={36} strokeWidth={1} />
            <span className="text-[9px] font-mono uppercase tracking-[0.3em] font-bold">No Assets</span>
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
