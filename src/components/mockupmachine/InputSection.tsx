import React, { useState } from 'react';
import { ImageOff, Info, X, Plus, CheckCircle2, ChevronRight } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import type { UploadedImage, DesignType, GeminiModel } from '@/types/types';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { formatImageTo16_9 } from '@/utils/fileUtils';
import { isSafeUrl } from '@/utils/imageUtils';
import { cn, sectionTitleClass } from '@/lib/utils';

interface InputSectionProps {
  uploadedImage: UploadedImage | null;
  referenceImage: UploadedImage | null;
  referenceImages: UploadedImage[]; // Array de até 3 imagens para modelo Pro, até 1 para HD
  designType: DesignType | null;
  selectedModel: GeminiModel | null;
  onImageUpload: (image: UploadedImage) => void;
  onReferenceImagesChange: (images: UploadedImage[]) => void;
  onStartOver: () => void;
  isImagelessMode: boolean;
  hasAnalyzed?: boolean;
  className?: string; // Add className
}

export const InputSection: React.FC<InputSectionProps> = ({
  uploadedImage,
  referenceImage,
  referenceImages,
  designType,
  selectedModel,
  onImageUpload,
  onReferenceImagesChange,
  onStartOver,
  isImagelessMode,
  hasAnalyzed = false,
  className = ""
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  // No modo blank, usa referenceImage; caso contrário, usa uploadedImage
  const displayImage = designType === 'blank' ? referenceImage : uploadedImage;
  const isReferenceOnly = designType === 'blank' && referenceImage !== null;
  const hasImage = !!displayImage;
  const isProModel = selectedModel === 'gemini-3-pro-image-preview';
  const isHDModel = selectedModel === 'gemini-2.5-flash-image';
  // Allow 3 references before model selection (Pro max), limit to 1 for HD after selection
  const maxReferences = !selectedModel ? 3 : (isProModel ? 3 : (isHDModel ? 1 : 0));
  // Allow reference upload when there's a main image, even without model selected
  const canAddMoreReferences = hasImage && referenceImages.length < maxReferences;
  const supportsReferences = !selectedModel || isProModel || isHDModel; // Enable before model selection
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;

    setIsLoadingImage(true);
    const newImages: UploadedImage[] = [];
    const remainingSlots = maxReferences - referenceImages.length;
    const totalToLoad = Math.min(files.length, remainingSlots);

    try {
      // Import mockupApi dynamically to avoid circular dependencies if any
      const { mockupApi } = await import('@/services/mockupApi');

      const processPromises = files.slice(0, totalToLoad).map(async (file) => {
        return new Promise<UploadedImage>(async (resolve, reject) => {
          try {
            const reader = new FileReader();
            reader.onload = async () => {
              try {
                const base64 = (reader.result as string).split(',')[1];
                // First format to 16:9 as before to ensure consistency
                const formatted = await formatImageTo16_9(base64, file.type);

                // Upload to R2 immediately; keep only url to avoid holding base64
                const r2Url = await mockupApi.uploadTempImage(formatted.base64 || base64, formatted.mimeType);
                resolve({ url: r2Url, mimeType: formatted.mimeType });
              } catch (error) {
                console.error("Error processing/uploading image:", error);

                // Fallback: if upload fails, use base64 but warn
                const base64 = (reader.result as string).split(',')[1];
                toast.error(t('errors.imageUploadFailed'));
                resolve({ base64, mimeType: file.type });
              }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          } catch (e) {
            reject(e);
          }
        });
      });

      const processedImages = await Promise.all(processPromises);
      newImages.push(...processedImages);
      onReferenceImagesChange([...referenceImages, ...newImages]);
    } catch (error) {
      console.error('Error processing images:', error);
      toast.error(t('errors.uploadFailed'));
    } finally {
      setIsLoadingImage(false);
    }

    e.target.value = '';
  };

  const handleRemoveReferenceImage = (index: number) => {
    const newImages = referenceImages.filter((_, i) => i !== index);
    onReferenceImagesChange(newImages);
  };

  // Helper to get image source (R2 URL or base64)
  const getImageSrc = (img: UploadedImage) => {
    if (img.url) return img.url;
    if (img.base64) {
      const dataUrl = `data:${img.mimeType};base64,${img.base64}`;
      return isSafeUrl(dataUrl) ? dataUrl : '';
    }
    return '';
  };

  const capacityUsage = Math.round(Math.min(((displayImage ? 1 : 0) + referenceImages.length) / 4 * 100, 100));

  return (
    <section className={cn("flex flex-col gap-3 sm:gap-4 md:gap-6 w-full", className)}>
      {/* Files Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className={sectionTitleClass(theme === 'dark')}>
          {t('mockup.files')}
        </h2>
        {!isLoadingImage && (
          <label htmlFor={displayImage ? "multiple-image-upload" : "image-upload-blank"} className="cursor-pointer p-1.5 hover:bg-white/5 rounded-md transition-colors text-neutral-400 hover:text-white">
            <Plus size={16} />
          </label>
        )}
      </div>

      {/* Capacity Progress Section */}
      <div className="space-y-1 sm:space-y-2 flex-shrink-0">
        <div className="h-0.5 sm:h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-cyan transition-all duration-500"
            style={{ width: `${capacityUsage}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
            {capacityUsage}% {t('mockup.capacityUsed')}
          </span>
          <Info size={12} className="text-neutral-500 opacity-50 flex-shrink-0" />
        </div>
      </div>

      {/* Compact Files Grid */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 flex-1 min-h-0 content-start">
        {/* Main Image Card */}
        {displayImage && (
          <div className={`relative flex flex-col p-1.5 sm:p-2 rounded-lg border transition-all h-full group min-w-0 ${hasAnalyzed ? 'bg-brand-cyan/5 border-brand-cyan/20' : 'border-white/5'}`}>
            <div className="relative w-full aspect-[4/3] sm:aspect-[4/3] rounded-md overflow-hidden mb-1 sm:mb-2 flex items-center justify-center bg-neutral-800/30">
              <img
                src={getImageSrc(displayImage)}
                alt="Main"
                className="w-full h-[full] object-fit transition-transform duration-200"
              />
              {hasAnalyzed && (
                <div className="absolute inset-0 flex items-center justify-center bg-brand-cyan/10">
                  <CheckCircle2 size={12} className="text-brand-cyan" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 mb-1 sm:mb-2 transition-opacity duration-200 gap-2">
              <p className="text-[11px] sm:text-[12px] font-mono font-medium text-neutral-300 truncate">
                {isReferenceOnly ? t('mockup.referenceOnly') : t('mockup.mainFile')}
              </p>
              <p className="text-[10px] sm:text-[12px] font-mono text-neutral-500 uppercase tracking-tighter truncate">
                {displayImage.mimeType?.split('/')[1] || 'IMAGE'} • {displayImage.size ? `${(displayImage.size / 1024).toFixed(0)}KB` : '---'}
              </p>
            </div>

            <div className="flex items-center justify-between mt-auto pt-1.5 sm:pt-2 border-t border-white/5 duration-200">
              <label htmlFor="image-upload-blank" className="p-1 hover:bg-white/5 rounded-md transition-colors text-neutral-500 hover:text-white cursor-pointer">
                <Plus size={14} />
              </label>
              <button
                onClick={onStartOver}
                className="p-1 hover:bg-red-500/10 rounded-md transition-colors text-neutral-500 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Reference Images List */}
        {referenceImages.map((img, index) => (
          <div key={index} className="flex flex-col p-1.5 sm:p-2 rounded-lg border border-white/5 group animate-in slide-in-from-bottom-2 duration-200 h-full gap-2 min-w-0">
            <div className="w-full aspect-[4/3] sm:aspect-square rounded-md overflow-hidden mb-1 sm:mb-2 flex items-center justify-center bg-neutral-800/30">
              <img
                src={getImageSrc(img)}
                alt={`Ref ${index + 1}`}
                className="w-full h-[full] object-fit transition-transform duration-200"
              />
            </div>

            <div className="flex-1 min-w-0 mb-1 sm:mb-2 transition-opacity duration-200 gap-2">
              <p className="text-[11px] sm:text-[12px] font-mono font-medium text-neutral-400 truncate">
                REF {index + 1}
              </p>
              <p className="text-[10px] sm:text-[12px] font-mono text-neutral-400 uppercase tracking-tighter truncate">
                {img.mimeType?.split('/')[1] || 'IMAGE'} • {img.size ? `${(img.size / 1024).toFixed(0)}KB` : '---'}
              </p>
            </div>

            <div className="flex justify-end mt-auto pt-1.5 sm:pt-2 border-t border-white/5 duration-200">
              <button
                onClick={() => handleRemoveReferenceImage(index)}
                className="p-1 hover:bg-red-500/10 rounded-md transition-colors text-neutral-500 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}

        {/* Add Reference Button */}
        {canAddMoreReferences && !isLoadingImage && displayImage && (
          <label
            htmlFor="multiple-image-upload"
            className="flex flex-col items-center justify-center h-full min-h-[72px] sm:min-h-[96px] md:min-h-[96px] rounded-lg border border-dashed border-white/5 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer group min-w-0"
          >
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/5 flex items-center justify-center mb-0.5 sm:mb-1 group-hover:bg-white/10 transition-colors">
              <Plus size={12} className="text-neutral-500" />
            </div>
            <span className="text-[7px] sm:text-[8px] font-mono text-neutral-500 uppercase tracking-wider text-center px-1">{t('mockup.addMore')}</span>
          </label>
        )}
      </div>

      {/* Hidden Inputs */}
      <input
        id="image-upload-blank"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            setIsLoadingImage(true);
            try {
              const { mockupApi } = await import('@/services/mockupApi');
              const reader = new FileReader();
              const result = await new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  resolve(base64);
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
              });

              const formatted = await formatImageTo16_9(result, file.type);
              const r2Url = await mockupApi.uploadTempImage(formatted.base64 || result, formatted.mimeType);

              onImageUpload({
                url: r2Url,
                mimeType: formatted.mimeType,
                size: file.size,
                base64: formatted.base64 || result, // Restore base64 for generation
              });

            } catch (error) {
              console.error('Error processing/uploading image:', error);
              const { toast } = await import('sonner');
              toast.error(t('errors.imageUploadFailed'));
            } finally {
              setIsLoadingImage(false);
            }
          }
          e.target.value = '';
        }}
        className="hidden text-black"
      />

      <input
        id="multiple-image-upload"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleMultipleImageUpload}
        className="hidden text-black"
        disabled={isLoadingImage}
      />
    </section>
  );
};


