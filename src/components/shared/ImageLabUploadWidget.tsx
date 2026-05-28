import React, { useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

interface ImageLabUploadWidgetProps {
  imageUrl: string;
  onLoad: (url: string, name: string, mediaType: 'image' | 'video') => void;
  acceptVideo?: boolean;
}

export const ImageLabUploadWidget: React.FC<ImageLabUploadWidgetProps> = React.memo(({
  imageUrl,
  onLoad,
  acceptVideo = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

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
    <>
      <button
        onClick={() => inputRef.current?.click()}
        title="Upload image"
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all overflow-hidden"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Source" className="absolute inset-0 w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity" />
        ) : (
          <Upload size={15} />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={acceptVideo ? 'image/*,video/*' : 'image/*'}
        className="hidden"
        aria-label="Upload image"
        onChange={handleFile}
      />
    </>
  );
});
ImageLabUploadWidget.displayName = 'ImageLabUploadWidget';
