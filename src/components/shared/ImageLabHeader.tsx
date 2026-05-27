import React, { useCallback } from 'react';
import { ImageIcon, X, Film, RotateCcw, PanelRightClose } from 'lucide-react';
import { toast } from 'sonner';
import { useImageLabStore, type ImageLabMode } from '@/stores/imageLabStore';
import { ToolPanelHeader } from './ToolPanel';

interface ImageLabHeaderProps {
  imageUrl: string;
  fileName: string;
  mediaType?: 'image' | 'video';
  acceptVideo?: boolean;
  onLoad: (url: string, name: string, mediaType: 'image' | 'video') => void;
  onClear: () => void;
  onResetSettings?: () => void;
  onClosePanel?: () => void;
}

const MODE_LABELS: Record<ImageLabMode, string> = {
  halftone: 'CMYK Halftone',
  texture: 'Texture Filter',
  riso: 'Riso Machine',
};

export const ImageLabHeader: React.FC<ImageLabHeaderProps> = React.memo(({
  imageUrl,
  fileName,
  mediaType = 'image',
  acceptVideo = false,
  onLoad,
  onClear,
  onResetSettings,
  onClosePanel,
}) => {
  const mode = useImageLabStore((s) => s.mode);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      onLoad(URL.createObjectURL(file), file.name, isVideo ? 'video' : 'image');
      toast.success(`Loaded ${file.name}`);
    }
    if (e.target) e.target.value = '';
  }, [onLoad]);

  return (
    <ToolPanelHeader>
      {imageUrl ? (
        <div className="flex items-center gap-3">
          {mediaType === 'video' ? (
            <div className="w-10 h-10 rounded-md bg-neutral-800 shrink-0 flex items-center justify-center">
              <Film size={14} className="text-neutral-400" />
            </div>
          ) : (
            <img src={imageUrl} alt={fileName} className="w-10 h-10 rounded-md object-cover bg-neutral-800 shrink-0" />
          )}
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[11px] text-neutral-400 font-mono truncate">{fileName}</span>
            <span className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest">{MODE_LABELS[mode]}</span>
          </div>
          {onResetSettings && (
            <button
              onClick={onResetSettings}
              aria-label="Reset to defaults"
              title="Reset all settings to defaults"
              className="text-neutral-600 hover:text-amber-400 transition-colors shrink-0 p-1"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button onClick={onClear} aria-label="Clear image" className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0 p-1">
            <X size={14} />
          </button>
          {onClosePanel && (
            <button onClick={onClosePanel} aria-label="Hide panel" title="Hide panel (Tab)" className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0 p-1 -mr-1">
              <PanelRightClose size={14} />
            </button>
          )}
        </div>
      ) : (
        <label className="flex items-center gap-3 cursor-pointer text-neutral-500 hover:text-neutral-300 transition-colors">
          <ImageIcon size={16} />
          <span className="text-[11px] uppercase tracking-widest">
            Upload {acceptVideo ? 'image or video' : 'image'}
          </span>
          <input
            type="file"
            accept={acceptVideo ? 'image/*,video/*' : 'image/*'}
            className="hidden"
            aria-label={`Upload ${acceptVideo ? 'image or video' : 'image'}`}
            onChange={handleFile}
          />
        </label>
      )}
    </ToolPanelHeader>
  );
});
ImageLabHeader.displayName = 'ImageLabHeader';
