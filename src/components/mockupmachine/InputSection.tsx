import React, { useState } from 'react';
import { ImageOff, Info, X, Plus, CheckCircle2, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import type { UploadedImage, DesignType, GeminiModel } from '@/types/types';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { formatImageTo16_9 } from '@/utils/fileUtils';
import { isSafeUrl } from '@/utils/imageUtils';
import { cn, sectionTitleClass } from '@/lib/utils';
import { useMockup } from './MockupContext';

interface InputSectionProps {
  uploadedImage: UploadedImage | null;
  referenceImage: UploadedImage | null;
  referenceImages: UploadedImage[]; // Array de até 3 imagens para modelo Pro, até 1 para HD
  designType: DesignType | null;
  selectedModel: GeminiModel | null;
  onImageUpload: (image: UploadedImage) => void;
  onReferenceImagesChange: (images: UploadedImage[]) => void;
  onStartOver: () => void;
  hasAnalyzed?: boolean;
  className?: string; // Add className
  // Design Type Props
  onDesignTypeChange: (type: DesignType) => void;
  onScrollToSection: (sectionId: string) => void;
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
  hasAnalyzed = false,
  className = "",
  onDesignTypeChange,
  onScrollToSection
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

  const handleSingleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingImage(true);
    try {
      const { mockupApi } = await import('@/services/mockupApi');
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const formatted = await formatImageTo16_9(base64, file.type);
          const r2Url = await mockupApi.uploadTempImage(formatted.base64 || base64, formatted.mimeType);
          onImageUpload({ url: r2Url, mimeType: formatted.mimeType });
        } catch (error) {
          console.error("Error processing/uploading image:", error);
          const base64 = (reader.result as string).split(',')[1];
          toast.error(t('errors.imageUploadFailed'));
          onImageUpload({ base64, mimeType: file.type });
        } finally {
          setIsLoadingImage(false);
          e.target.value = '';
        }
      };
      
      reader.onerror = () => {
        toast.error(t('errors.uploadFailed'));
        setIsLoadingImage(false);
        e.target.value = '';
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error(t('errors.uploadFailed'));
      setIsLoadingImage(false);
      e.target.value = '';
    }
  };

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
          <div className="flex items-center gap-1">
            {canAddMoreReferences && (
              <label 
                htmlFor="multiple-image-upload" 
                className="cursor-pointer p-1.5 hover:bg-white/5 rounded-md transition-colors text-neutral-400 hover:text-white"
                title={t('mockup.addReferenceImage', { count: referenceImages.length })}
              >
                <Plus size={16} />
              </label>
            )}
            {displayImage && (
              <>
                <label
                  htmlFor="image-upload-blank"
                  className="p-1 hover:bg-white/5 rounded-md transition-colors text-neutral-500 hover:text-white cursor-pointer"
                  title={t('mockup.replaceImage')}
                >
                  <ArrowLeftRight size={14} />
                </label>
              </>
            )}
            {!displayImage && (
              <label 
                htmlFor="image-upload-blank" 
                className="cursor-pointer p-1.5 hover:bg-white/5 rounded-md transition-colors text-neutral-400 hover:text-white"
                title={t('mockup.uploadMainFile')}
              >
                <Plus size={16} />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Compact Files Grid */}
      <div
        className={cn(
          "grid gap-1.5 sm:gap-2 w-full min-h-0 content-start",
          displayImage && referenceImages.length === 0 ? "grid-cols-1" : "grid-cols-2"
        )}
      >
        {/* Main Image Card */}
        {displayImage && (
          <div className={`relative flex flex-col p-1.5 sm:p-2 rounded-lg border transition-all group w-full ${hasAnalyzed ? 'bg-brand-cyan/1 border-brand-cyan/10' : 'border-white/5'}`}>
            <div className="relative max-h-52 max-w-full rounded-md overflow-hidden mb-1 sm:mb-2 flex items-center justify-center">
              <img
                src={getImageSrc(displayImage)}
                alt="Main"
                className="max-h-52 max-w-full h-auto w-auto object-contain transition-transform duration-200"
              />
              {hasAnalyzed && (
                <div className="absolute inset-0 flex items-center justify-center bg-brand-cyan/10 pointer-events-none">
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

            {/* Footer with Design Type Switcher */}
            <div className="flex items-center justify-between mt-auto pt-1.5 sm:pt-2 border-t border-white/5 gap-2">
              <div className="flex items-center bg-neutral-900/50 rounded-md p-0.5 border border-white/5 gap-2">
                <button
                  onClick={() => onDesignTypeChange('logo')}
                  className={cn(
                    "px-2 py-1 text-[10px] font-mono rounded transition-colors",
                    designType === 'logo'
                      ? "bg-brand-cyan text-black font-semibold"
                      : "text-neutral-500 hover:text-neutral-300"
                  )}
                  title={t('mockup.itsALogo')}
                >
                  {t('mockup.typeLogo') || 'LOGO'}
                </button>
                <button
                  onClick={() => onDesignTypeChange('layout')}
                  className={cn(
                    "px-2 py-1 text-[10px] font-mono rounded transition-colors",
                    designType === 'layout'
                      ? "bg-brand-cyan text-black font-semibold"
                      : "text-neutral-500 hover:text-neutral-300"
                  )}
                  title={t('mockup.itsALayout')}
                >
                  {t('mockup.typeLayout') || 'LAYOUT'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reference Images List */}
        {referenceImages.map((img, index) => (
          <div key={index} className="flex flex-col p-1.5 sm:p-2 rounded-lg border border-white/5 group animate-in slide-in-from-bottom-2 duration-200 w-fit gap-2">
            <div className="relative max-h-40 max-w-full rounded-md overflow-hidden mb-1 sm:mb-2 flex items-center justify-center">
              <img
                src={getImageSrc(img)}
                alt={`Ref ${index + 1}`}
                className="max-h-40 max-w-full h-auto w-auto object-contain transition-transform duration-200"
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

      </div>

      <input
        id="image-upload-blank"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleSingleImageUpload}
        className="hidden"
        disabled={isLoadingImage}
      />
      <input
        id="multiple-image-upload"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleMultipleImageUpload}
        className="hidden"
        disabled={isLoadingImage}
      />

    </section>
  );
};


