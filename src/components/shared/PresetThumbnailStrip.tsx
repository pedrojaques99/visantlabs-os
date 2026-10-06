import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from '@/lib/ui/icons';
import { Thumb } from '@/components/ui/Thumb';
import { useTranslation } from '@/hooks/useTranslation';

export interface PresetThumbnailItem {
  name: string;
  colors?: string[];
}

interface PresetThumbnailStripProps {
  presets: PresetThumbnailItem[];
  imageUrl: string;
  onSelect: (name: string) => void;
}

export const PresetThumbnailStrip: React.FC<PresetThumbnailStripProps> = React.memo(
  ({ presets, imageUrl, onSelect }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(true);

    if (!imageUrl) return null;

    return (
      <div className="shrink-0 border-b border-border">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent transition-colors"
        >
          <span className="text-2xs text-muted-foreground">{t('common.presets')}</span>
          <ChevronDown
            size={12}
            className={cn(
              'text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </button>
        {open && (
          <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-thin animate-fade-in">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => onSelect(preset.name)}
                className="shrink-0 flex flex-col items-center gap-1 group transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150"
              >
                <div className="relative w-14 h-14 rounded-md overflow-hidden bg-muted">
                  <Thumb
                    src={imageUrl}
                    alt={preset.name}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  {preset.colors && (
                    <div className="absolute bottom-0.5 left-0.5 flex gap-px">
                      {preset.colors.slice(0, 4).map((c, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full border border-black/30"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-2xs text-muted-foreground group-hover:text-foreground transition-colors max-w-14 truncate">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
PresetThumbnailStrip.displayName = 'PresetThumbnailStrip';
