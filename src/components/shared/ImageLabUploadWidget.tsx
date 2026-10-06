import React, { useCallback, useEffect, useRef } from 'react';
import { Upload } from '@/lib/ui/icons';
import { Thumb } from '@/components/ui/Thumb';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

interface ImageLabUploadWidgetProps {
  imageUrl: string;
  onLoad: (url: string, name: string, mediaType: 'image' | 'video') => void;
  acceptVideo?: boolean;
}

export const ImageLabUploadWidget: React.FC<ImageLabUploadWidgetProps> = React.memo(
  ({ imageUrl, onLoad, acceptVideo = true }) => {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const lastBlobUrlRef = useRef<string | null>(null);

    useEffect(
      () => () => {
        if (lastBlobUrlRef.current) {
          try {
            URL.revokeObjectURL(lastBlobUrlRef.current);
          } catch {
            /* ignore */
          }
        }
      },
      []
    );

    const handleFile = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          const isVideo = file.type.startsWith('video/');
          if (lastBlobUrlRef.current) {
            try {
              URL.revokeObjectURL(lastBlobUrlRef.current);
            } catch {
              /* ignore */
            }
          }
          const url = URL.createObjectURL(file);
          lastBlobUrlRef.current = url;
          onLoad(url, file.name, isVideo ? 'video' : 'image');
          toast.success(t('toolEditor.loadedFile', { name: file.name }));
        }
        if (e.target) e.target.value = '';
      },
      [onLoad, t]
    );

    return (
      <>
        <button
          onClick={() => inputRef.current?.click()}
          title={t('toolEditor.uploadImage')}
          className="relative flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-[color,background-color,border-color,opacity] overflow-hidden"
        >
          {imageUrl ? (
            <Thumb
              src={imageUrl}
              alt="Source"
              className="absolute inset-0 w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity"
            />
          ) : (
            <Upload size={15} />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={acceptVideo ? 'image/*,video/*' : 'image/*'}
          className="hidden"
          aria-label={t('toolEditor.uploadImage')}
          onChange={handleFile}
        />
      </>
    );
  }
);
ImageLabUploadWidget.displayName = 'ImageLabUploadWidget';
