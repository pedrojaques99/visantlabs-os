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
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { MicroTitle } from '../ui/MicroTitle';
import { GlassPanel } from '../ui/GlassPanel';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BrandGuidelineSelector } from './BrandGuidelineSelector';
import { Switch } from '@/components/ui/switch';


interface InputSectionProps {
  uploadedImage: UploadedImage | null;
  referenceImages: UploadedImage[]; // Array de até 3 imagens para modelo Pro, até 1 para HD
  designType: DesignType;
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

  const displayImage = uploadedImage;
  const hasImage = !!displayImage;
  const isProModel = selectedModel === GEMINI_MODELS.PRO;
  const isHDModel = selectedModel === GEMINI_MODELS.FLASH;
  // Allow 3 references before model selection (Pro max), limit to 1 for HD after selection
  const maxReferences = !selectedModel ? 3 : (isProModel ? 3 : (isHDModel ? 1 : 0));
  // Allow reference upload when there's a main image, even without model selected
  const canAddMoreReferences = hasImage && referenceImages.length < maxReferences;
  const supportsReferences = !selectedModel || isProModel || isHDModel; // Enable before model selection
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [replacingRefIndex, setReplacingRefIndex] = useState<number | null>(null);

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

  const handleReferenceReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replacingRefIndex === null) return;

    setIsLoadingImage(true);
    try {
      const { mockupApi } = await import('@/services/mockupApi');
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const formatted = await formatImageTo16_9(base64, file.type);
          const r2Url = await mockupApi.uploadTempImage(formatted.base64 || base64, formatted.mimeType);

          const newRefs = [...referenceImages];
          newRefs[replacingRefIndex] = { url: r2Url, mimeType: formatted.mimeType };
          onReferenceImagesChange(newRefs);
        } catch (error) {
          console.error("Error replacing reference image:", error);
          toast.error(t('errors.imageUploadFailed'));
        } finally {
          setIsLoadingImage(false);
          setReplacingRefIndex(null);
          e.target.value = '';
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing replacement:', error);
      setIsLoadingImage(false);
      setReplacingRefIndex(null);
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

  const ImageCard = ({
    img,
    label,
    onReplace,
    onRemove,
    onAddRef,
    isAnalyzed = false,
    highlight = false
  }: {
    img: UploadedImage;
    label: string;
    onReplace: () => void;
    onRemove?: () => void;
    onAddRef?: () => void;
    isAnalyzed?: boolean;
    highlight?: boolean;
  }) => (
    <div className={cn(
      "relative flex flex-col p-2.5 rounded-xl border transition-all group w-full animate-in fade-in zoom-in-95 duration-300",
      highlight ? "bg-brand-cyan/[0.03] border-brand-cyan/20 shadow-lg shadow-brand-cyan/5" : "bg-neutral-900/40 border-white/[0.05] hover:border-white/10"
    )}>
      {/* Image Container */}
      <div className="relative h-auto max-h-[min(200px,38vh)] w-full rounded-md overflow-hidden flex items-center justify-center group/img-container">
        <img
          src={getImageSrc(img)}
          alt={label}
          loading="lazy"
          decoding="async"
          className="max-h-[min(200px,28vh)] w-full h-auto object-contain transition-transform duration-300 group-hover/img-container:scale-[1.02]"
        />

        {/* Hover Overlay with Replace Action */}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center gap-4 opacity-0 group-hover/img-container:opacity-300 transition-all duration-300 backdrop-blur-[10px] p-3">
          <Button variant="ghost" type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReplace();
            }}
            className="flex flex-col items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-white/10 transition-all transform translate-y-2 group-hover/img-container:translate-y-0 text-white"
          >
            <div className="p-3 rounded-full bg-white/10 border border-white/20 group-hover:bg-brand-cyan group-hover:text-black transition-all shadow-xl">
              <ArrowLeftRight size={20} />
            </div>
            <MicroTitle as="span" className="font-bold text-white">{t('mockup.replace') || 'Substituir'}</MicroTitle>
          </Button>

          {onAddRef && (
            <Button variant="ghost" type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddRef();
              }}
              className="flex flex-col items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-white/10 transition-all transform translate-y-2 group-hover/img-container:translate-y-0 text-white delay-75"
            >
              <div className="p-3 rounded-full bg-white/10 border border-white/20 group-hover:bg-brand-cyan group-hover:text-black transition-all shadow-xl">
                <Plus size={20} />
              </div>
              <MicroTitle as="span" className="font-bold text-white">+ REF</MicroTitle>
            </Button>
          )}
        </div>

        {/* Status Badge (Top Right) */}
        {isAnalyzed && (
          <div className="absolute top-2 right-2 flex items-center justify-center bg-brand-cyan text-black p-1 rounded-full shadow-lg border border-brand-cyan/50 z-10 animate-in zoom-in duration-300">
            <CheckCircle2 size={12} strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Info & Footer */}
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-[11px] font-mono font-bold uppercase  truncate mb-0.5",
            highlight ? "text-brand-cyan" : "text-neutral-300"
          )}>
            {label}
          </p>
          <MicroTitle className="text-[10px] tracking-tighter truncate opacity-80">
            {img.mimeType?.split('/')[1] || 'IMG'} • {img.size ? `${(img.size / 1024).toFixed(0)}KB` : '---'}
          </MicroTitle>
        </div>

        {onRemove && (
          <Button
            onClick={onRemove}
            className="p-1.5 hover:bg-white/5 rounded transition-colors text-neutral-600 hover:text-red-400 group/remove"
            title={t('mockup.removeFileTitle') || "Remover arquivo"}
          >
            <X size={14} className="group-hover/remove:scale-110 transition-transform" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <section className={cn("flex flex-col gap-5 w-full", className)}>
      {/* Files Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-10">
          <MicroTitle className="text-brand-cyan uppercase mr-20">
            {t('mockup.filesLoaded', { count: referenceImages.length + 1 }) || `${referenceImages.length + 1} Arquivo(s) carregados`}
          </MicroTitle>
        </div>

        {!isLoadingImage && (
          <div className="flex items-center gap-3">
            {uploadedImage && (
              <>
                {/* Brand Guideline Button */}
                <BrandGuidelineSelector asButton />

                <div
                  role="button"
                  onClick={() => onDesignTypeChange(designType === 'logo' ? 'layout' : 'logo')}
                  className={cn(
                    "px-3 h-8 rounded-md transition-all flex items-center gap-2 border cursor-pointer select-none",
                    designType === 'logo'
                      ? "bg-brand-cyan/5 border-brand-cyan/20 text-brand-cyan"
                      : "bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10"
                  )}
                  title={t('mockup.transparentBackground') || 'Isolar Logotipo'}
                >
                  <Switch
                    checked={designType === 'logo'}
                    onCheckedChange={() => onDesignTypeChange(designType === 'logo' ? 'layout' : 'logo')}
                    className="scale-[0.6] origin-left pointer-events-none"
                  />
                  <MicroTitle as="span" className="font-bold text-inherit !text-[9px]">
                    {t('mockup.transparentBackground') || 'ISOLAR'}
                  </MicroTitle>
                </div>
              </>
            )}

            {canAddMoreReferences && (
              <label
                htmlFor="multiple-image-upload"
                className="cursor-pointer px-3 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-all text-neutral-400 hover:text-white flex items-center gap-2"
                title={t('mockup.addReferenceImage', { count: referenceImages.length })}
              >
                <Plus size={12} />
                <MicroTitle as="span" className="font-bold text-inherit !text-[9px]">REF</MicroTitle>
              </label>
            )}
            {!displayImage && (
              <label
                htmlFor="image-upload-blank"
                className="cursor-pointer px-3 h-8 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 rounded-md transition-all text-brand-cyan flex items-center gap-2 animate-pulse"
              >
                <Plus size={12} />
                <MicroTitle as="span" className="font-bold text-inherit !text-[9px]">UPLOAD</MicroTitle>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Standardized Files Grid */}
      <div
        className={cn(
          "grid gap-4 w-full min-h-0",
          displayImage && referenceImages.length === 0 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
        )}
      >
        {/* Main Image Card */}
        {displayImage && (
          <ImageCard
            img={displayImage}
            label={t('mockup.mainFile')}
            onReplace={() => document.getElementById('image-upload-blank')?.click()}
            onAddRef={canAddMoreReferences ? () => document.getElementById('multiple-image-upload')?.click() : undefined}
            isAnalyzed={hasAnalyzed}
            highlight={hasAnalyzed}
          />
        )}

        {/* Reference Images List */}
        {referenceImages.map((img, index) => (
          <ImageCard
            key={index}
            img={img}
            label={t('mockup.referenceLabel', { order: index + 1 }) || `Referência ${index + 1}`}
            onReplace={() => {
              setReplacingRefIndex(index);
              document.getElementById('replace-reference-upload')?.click();
            }}
            onRemove={() => handleRemoveReferenceImage(index)}
          />
        ))}


      </div>

      {/* Hidden Inputs */}
      <Input id="image-upload-blank" type="file" accept="image/*" onChange={handleSingleImageUpload} className="hidden" />
      <Input id="multiple-image-upload" type="file" accept="image/*" multiple onChange={handleMultipleImageUpload} className="hidden" />
      <Input id="replace-reference-upload" type="file" accept="image/*" onChange={handleReferenceReplace} className="hidden" />
    </section>
  );
};
