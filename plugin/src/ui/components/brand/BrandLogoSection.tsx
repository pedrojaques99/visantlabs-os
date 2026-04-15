import React from 'react';
import { usePluginStore } from '../../store';
import { useLogoUpload } from '../../hooks/useLogoUpload';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { MousePointer2, X, FileText, ImageIcon } from 'lucide-react';
import type { LogoSlot } from '../../store/types';
import { cn } from '@/lib/utils';

type Variant = 'light' | 'dark' | 'accent';

function LogoPreview({ logo }: { logo: LogoSlot }) {
  const preview = logo.thumbnailUrl || logo.src || logo.url;
  if (!preview) {
    return <ImageIcon size={20} className="text-neutral-800" />;
  }
  // PDFs don't render in <img>; fall back to icon + label.
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
  const { linkFromSelection, clearSlot, busySlot } = useLogoUpload();
  const busy = busySlot === logo.name;
  const hasLogo = !!(logo.url || logo.thumbnailUrl || logo.src);

  return (
    <div className="flex flex-col gap-1.5 group">
      <div 
        className={cn(
          "w-full aspect-square bg-neutral-950 border border-white/5 rounded-xl flex items-center justify-center overflow-hidden relative transition-all group-hover:border-brand-cyan/20 cursor-pointer",
          !hasLogo && "hover:bg-neutral-900 border-dashed"
        )}
        onClick={() => !hasLogo && linkFromSelection(logo.name as Variant)}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-2">
            <GlitchLoader size={12} />
            <span className="text-[8px] font-mono text-brand-cyan uppercase animate-pulse">Capturing...</span>
          </div>
        ) : <LogoPreview logo={logo} />}
        
        {/* Hover Actions Overlay */}
        <div className={cn(
          "absolute inset-0 bg-neutral-950/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-all duration-200",
          !hasLogo && "pointer-events-none opacity-0" // Stay invisible if empty
        )}>
          {!busy && hasLogo && (
            <>
              {/* Primary Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 bg-neutral-900 border-white/10 text-white hover:text-brand-cyan hover:border-brand-cyan/30 rounded-lg"
                  onClick={(e) => { e.stopPropagation(); linkFromSelection(logo.name as Variant); }}
                  title="Capture selection from Figma"
                >
                  <MousePointer2 size={14} />
                </Button>
              </div>

              {/* Danger Action (Top Right) */}
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); clearSlot(logo.name as Variant); }}
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
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
             <MousePointer2 size={14} className="text-brand-cyan" />
          </div>
        )}
      </div>

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
  return (
    <div className="grid grid-cols-4 gap-3">
      {logos.map((logo) => (
        <LogoSlotCard key={logo.name} logo={logo} />
      ))}
      <div 
        className="aspect-square rounded-xl border border-dashed border-white/5 flex flex-col items-center justify-center opacity-30 hover:opacity-100 hover:border-brand-cyan/30 hover:bg-neutral-900/40 transition-all cursor-pointer group"
        onClick={() => {
          // Future: add additional slot or just notify
          parent.postMessage({ pluginMessage: { type: 'NOTIFY', message: 'Select an object in Figma and click a slot to link.' } }, '*');
        }}
      >
        <MousePointer2 size={12} className="text-neutral-500 group-hover:text-brand-cyan" />
        <span className="text-[8px] mt-1 font-mono uppercase tracking-tighter text-neutral-600">Pick Frame</span>
      </div>
    </div>
  );
}
