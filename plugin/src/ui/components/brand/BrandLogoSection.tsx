import React, { useRef } from 'react';
import { usePluginStore } from '../../store';
import { useLogoUpload } from '../../hooks/useLogoUpload';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { MousePointer2, X, FileText, ImageIcon, Plus, Upload } from 'lucide-react';
import type { LogoSlot } from '../../store/types';
import { cn } from '@/lib/utils';

function LogoPreview({ logo }: { logo: LogoSlot }) {
  const preview = logo.thumbnailUrl || logo.src || logo.url;
  if (!preview) {
    return <ImageIcon size={20} className="text-neutral-800" />;
  }
  if (logo.format === 'pdf' && !logo.thumbnailUrl) {
    return (
      <div className="flex flex-col items-center gap-1 text-center px-2">
        <FileText size={16} className="text-muted-foreground" />
        <span className="text-[8px] uppercase text-muted-foreground truncate max-w-full">PDF</span>
      </div>
    );
  }
  return (
    <img
      src={preview}
      alt={logo.label || logo.name}
      className="max-h-full max-w-full object-contain p-2"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

function LogoSlotCard({ logo }: { logo: LogoSlot }) {
  const { linkFromSelection, uploadFile, clearSlot, busySlot } = useLogoUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = busySlot === logo.name;
  const hasLogo = !!(logo.url || logo.thumbnailUrl || logo.src);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(logo.name, file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5 group">
      <div
        className={cn(
          'w-full aspect-square bg-neutral-950 border border-white/5 rounded-xl flex items-center justify-center overflow-hidden relative transition-all group-hover:border-brand-cyan/20 cursor-pointer',
          !hasLogo && 'hover:bg-neutral-900 border-dashed'
        )}
        onClick={() => !hasLogo && !busy && linkFromSelection(logo.name)}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-2">
            <GlitchLoader size={12} />
            <span className="text-[8px] font-mono text-brand-cyan uppercase animate-pulse">
              Capturing...
            </span>
          </div>
        ) : (
          <LogoPreview logo={logo} />
        )}

        {/* Hover Actions Overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-neutral-950/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-all duration-200',
            !hasLogo && 'pointer-events-none opacity-0'
          )}
        >
          {!busy && hasLogo && (
            <>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-neutral-900 border-white/10 text-white hover:text-brand-cyan hover:border-brand-cyan/30 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    linkFromSelection(logo.name);
                  }}
                  title="Capture selection from Figma"
                >
                  <MousePointer2 size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-neutral-900 border-white/10 text-white hover:text-brand-cyan hover:border-brand-cyan/30 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  title="Upload image file"
                >
                  <Upload size={14} />
                </Button>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSlot(logo.name);
                }}
                className="absolute top-1.5 right-1.5 p-1 rounded-full text-neutral-500 hover:text-red-400 hover:bg-neutral-900 transition-colors"
                title="Remove Logo"
              >
                <X size={10} />
              </button>
            </>
          )}
        </div>

        {/* Empty state hint */}
        {!hasLogo && !busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <MousePointer2
              size={12}
              className="text-neutral-600 group-hover:text-brand-cyan transition-colors"
            />
            <span className="text-[7px] font-mono uppercase text-neutral-600 group-hover:text-brand-cyan transition-colors text-center leading-tight px-1">
              Select → Click
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="text-[7px] font-mono text-neutral-700 hover:text-brand-cyan underline transition-colors"
            >
              or upload
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.svg,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center justify-center">
        <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 group-hover:text-brand-cyan transition-colors">
          {logo.name}
        </span>
      </div>
    </div>
  );
}

export function BrandLogoSection() {
  const logos = usePluginStore((s) => s.logos);
  const addLogoSlot = usePluginStore((s) => s.addLogoSlot);

  const handleAddSlot = () => {
    const idx = logos.length + 1;
    const name = `variant-${idx}`;
    addLogoSlot(name);
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      {logos.map((logo) => (
        <LogoSlotCard key={logo.name} logo={logo} />
      ))}
      <div
        className="aspect-square rounded-xl border border-dashed border-white/5 flex flex-col items-center justify-center opacity-40 hover:opacity-100 hover:border-brand-cyan/30 hover:bg-neutral-900/40 transition-all cursor-pointer group"
        onClick={handleAddSlot}
        title="Add logo variant"
      >
        <Plus
          size={14}
          className="text-neutral-500 group-hover:text-brand-cyan transition-colors"
        />
        <span className="text-[7px] mt-1 font-mono uppercase tracking-tighter text-neutral-600 group-hover:text-brand-cyan transition-colors">
          Add Slot
        </span>
      </div>
    </div>
  );
}
