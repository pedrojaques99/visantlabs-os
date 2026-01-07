import React, { useCallback, useState } from 'react';
import { fileToBase64 } from '../../utils/fileUtils';
import { GlitchLoader } from './GlitchLoader';
import type { UploadedImage } from '../../types';
import { UploadCloud } from 'lucide-react';

interface AdminImageUploaderProps {
  onImageUpload: (image: UploadedImage) => void;
  disabled?: boolean;
}

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export const AdminImageUploader: React.FC<AdminImageUploaderProps> = ({
  onImageUpload,
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File | Blob | null) => {
    if (!file) return;

    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      setError('Tipo de arquivo não suportado. Use JPEG, PNG, WebP ou GIF.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setError(`Imagem muito grande (${fileSizeMB}MB). Máximo: ${MAX_IMAGE_SIZE_MB}MB.`);
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const imageData = await fileToBase64(file);
      onImageUpload(imageData);
    } catch (err) {
      setError('Erro ao processar imagem. Tente novamente.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }, [onImageUpload]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => e.preventDefault();
  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="w-full">
      <label
        htmlFor="admin-file-upload"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={`relative block w-full p-4 bg-zinc-900 border rounded-md cursor-pointer transition-all duration-300 ${isDragging
          ? 'border-dashed border-2 border-[brand-cyan]/40 bg-brand-cyan/10 shadow-2xl shadow-[brand-cyan]/10'
          : 'border-zinc-800/10 hover:border-zinc-800/20'
          } ${isProcessing || disabled ? 'cursor-wait opacity-50' : ''}`}
      >
        <input
          id="admin-file-upload"
          type="file"
          accept={SUPPORTED_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing || disabled}
        />
        <div className="flex items-center justify-center gap-4">
          {isProcessing && (
            <>
              <GlitchLoader size={24} color="brand-cyan" />
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-zinc-400">Processando imagem...</p>
                <p className="text-xs font-mono tracking-wider text-zinc-500">Aguarde</p>
              </div>
            </>
          )}
          {!isProcessing && isDragging && (
            <>
              <UploadCloud size={32} className="text-brand-cyan/80 transition-colors flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-zinc-300">Solte a imagem aqui</p>
                <p className="text-xs font-mono tracking-wider text-zinc-500">Solte para fazer upload</p>
              </div>
            </>
          )}
          {!isProcessing && !isDragging && (
            <>
              <UploadCloud size={32} className="text-zinc-600 group-hover:text-brand-cyan/80 transition-colors flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-zinc-400">Clique para fazer upload</p>
                <p className="text-xs font-mono tracking-wider text-zinc-500">JPEG, PNG, WebP ou GIF (máx. {MAX_IMAGE_SIZE_MB}MB)</p>
              </div>
            </>
          )}
        </div>
      </label>
      {error && (
        <p className="text-center text-red-400/80 text-sm mt-2">{error}</p>
      )}
    </div>
  );
};
