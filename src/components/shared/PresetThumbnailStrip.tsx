import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface PresetThumbnailItem {
  name: string;
  colors?: string[];
}

interface PresetThumbnailStripProps {
  presets: PresetThumbnailItem[];
  imageUrl: string;
  onSelect: (name: string) => void;
}

export const PresetThumbnailStrip: React.FC<PresetThumbnailStripProps> = React.memo(({
  presets,
  imageUrl,
  onSelect,
}) => {
  const [open, setOpen] = useState(true);

  if (!imageUrl) return null;

  return (
    <div className="shrink-0 border-b border-neutral-800/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800/10 transition-colors"
      >
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Presets</span>
        <ChevronDown size={12} className={cn('text-neutral-500 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent animate-fade-in">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onSelect(preset.name)}
              className="shrink-0 flex flex-col items-center gap-1 group transition-all duration-150"
            >
              <div className="relative w-14 h-14 rounded-md overflow-hidden bg-neutral-800">
                <img
                  src={imageUrl}
                  alt={preset.name}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                {preset.colors && (
                  <div className="absolute bottom-0.5 left-0.5 flex gap-px">
                    {preset.colors.slice(0, 4).map((c, i) => (
                      <div key={i} className="w-2 h-2 rounded-full border border-black/30" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-500 group-hover:text-neutral-300 transition-colors max-w-14 truncate">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
PresetThumbnailStrip.displayName = 'PresetThumbnailStrip';
