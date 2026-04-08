import React, { useState } from 'react';
import { X, Plus, CheckCircle2, ArrowLeftRight } from 'lucide-react';
import type { UploadedImage, DesignType, GeminiModel } from '@/types/types';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { formatImageTo16_9 } from '@/utils/fileUtils';
import { isSafeUrl } from '@/utils/imageUtils';
import { cn } from '@/lib/utils';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { MicroTitle } from '../ui/MicroTitle';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BrandGuidelineSelector } from './BrandGuidelineSelector';


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
      "relative flex flex-col p-2 rounded-2xl border transition-all group w-full animate-in fade-in zoom-in-95 duration-500",
      highlight ? "bg-brand-cyan/[0.02] border-brand-cyan/20 shadow-[0_10px_32px_rgba(var(--brand-cyan-rgb),0.05)]" : "bg-neutral-900/20 border-white/[0.03] hover:border-white/10"
    )}>
      {/* Image Container */}
      <div className="relative h-64 w-full rounded-xl overflow-hidden flex items-center justify-center group/img-container bg-black/20 p-4">
        <img
          src={getImageSrc(img)}
          alt={label}
          loading="lazy"
          className="max-h-full max-w-full object-contain transition-transform duration-700 group-hover/img-container:scale-[1.02]"
        />

        {/* Hover Overlay with Replace Action */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img-container:opacity-100 transition-all duration-300 backdrop-blur-md bg-black/40">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReplace();
            }}
            className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all transform translate-y-4 group-hover/img-container:translate-y-0 duration-500"
          >
            <div className="p-3 rounded-full bg-brand-cyan text-black shadow-[0_0_20px_rgba(var(--brand-cyan-rgb),0.4)]">
              <ArrowLeftRight size={20} />
            </div>
            <span className="text-[10px] font-bold font-mono tracking-widest text-white uppercase">{t('mockup.replace') || 'Substituir'}</span>
          </button>
        </div>

        {/* Status Badge */}
        {isAnalyzed && (
          <div className="absolute top-3 right-3 flex items-center justify-center bg-brand-cyan text-black w-6 h-6 rounded-full shadow-[0_0_15px_rgba(var(--brand-cyan-rgb),0.5)] z-10 animate-in zoom-in duration-500">
            <CheckCircle2 size={12} strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Info & Footer */}
      <div className="mt-3 px-2 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className={cn("w-1 h-1 rounded-full", highlight ? "bg-brand-cyan animate-pulse" : "bg-neutral-600")} />
            <p className={cn(
              "text-[10px] font-mono font-bold uppercase tracking-widest truncate",
              highlight ? "text-brand-cyan" : "text-neutral-500"
            )}>
              {label}
            </p>
          </div>
          <p className="text-[10px] font-mono text-neutral-600 tracking-tight opacity-60">
            {img.mimeType?.split('/')[1]?.toUpperCase() || 'IMG'} • {img.size ? `${(img.size / 1024).toFixed(0)}KB` : '--'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {onAddRef && (
            <button
              onClick={onAddRef}
              className="p-2 hover:bg-brand-cyan/10 rounded-lg transition-colors text-neutral-700 hover:text-brand-cyan group/add"
              title={t('mockup.addReference') || "Adicionar referência"}
            >
              <Plus size={14} className="group-hover/add:scale-110 transition-transform" />
            </button>
          )}

          {onRemove && (
            <button
              onClick={onRemove}
              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-neutral-700 hover:text-red-400 group/remove"
              title={t('mockup.removeFileTitle') || "Remover arquivo"}
            >
              <X size={14} className="group-hover/remove:rotate-90 transition-transform duration-300" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <section className={cn("flex flex-col gap-8 w-full", className)}>
      {/* Header Area: Metadata + Settings */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.03] pb-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <MicroTitle className="text-neutral-600 font-mono text-[10px] tracking-[0.2em] mb-1">
              WORKSPACE INITIALIZED
            </MicroTitle>
            <p className="text-sm font-bold text-white tracking-tight">
              {t('mockup.filesLoaded', { count: referenceImages.length + 1 }) || `${referenceImages.length + 1} Assets Carregados`}
            </p>
          </div>
        </div>

        {!isLoadingImage && (
          <div className="flex items-center gap-2">
            {/* Design Type Segmented Control */}
            <div className="flex items-center p-1 bg-neutral-900/50 rounded-xl border border-white/[0.05]">
              <button
                onClick={() => onDesignTypeChange('layout')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase transition-all",
                  designType === 'layout'
                    ? "bg-white/10 text-white shadow-lg"
                    : "text-neutral-600 hover:text-neutral-400"
                )}
              >
                Full Layout
              </button>
              <button
                onClick={() => onDesignTypeChange('logo')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase transition-all",
                  designType === 'logo'
                    ? "bg-brand-cyan/20 text-brand-cyan shadow-[0_0_15px_rgba(var(--brand-cyan-rgb),0.1)]"
                    : "text-neutral-600 hover:text-neutral-400"
                )}
              >
                Logo Isolar
              </button>
            </div>

            {uploadedImage && <BrandGuidelineSelector asButton />}
          </div>
        )}
      </div>

      {/* Standardized Files Grid */}
      <div
        className={cn(
          "grid gap-5 w-full min-h-[140px]",
          displayImage ? (referenceImages.length === 0 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2") : "grid-cols-1"
        )}
      >
        {/* Main Image Card */}
        {displayImage ? (
          <ImageCard
            img={displayImage}
            label={t('mockup.mainFile') || "PRIMARY DESIGN"}
            onReplace={() => document.getElementById('image-upload-blank')?.click()}
            onAddRef={canAddMoreReferences ? () => document.getElementById('multiple-image-upload')?.click() : undefined}
            isAnalyzed={hasAnalyzed}
            highlight={hasAnalyzed}
          />
        ) : (
          <label
            htmlFor="image-upload-blank"
            className="flex flex-col items-center justify-center p-12 rounded-3xl border-2 border-dashed border-white/5 hover:border-brand-cyan/20 bg-white/[0.02] hover:bg-brand-cyan/[0.02] transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-brand-cyan/10 transition-all">
              <Plus className="text-neutral-500 group-hover:text-brand-cyan" size={20} />
            </div>
            <MicroTitle className="text-neutral-600 group-hover:text-brand-cyan/60">Initialize Workspace</MicroTitle>
            <p className="text-[10px] text-neutral-700 font-mono mt-1 group-hover:text-neutral-500 transition-colors uppercase">Drop primary design asset</p>
          </label>
        )}

        {/* Reference Images List */}
        {referenceImages.map((img, index) => (
          <ImageCard
            key={index}
            img={img}
            label={t('mockup.referenceLabel', { order: index + 1 }) || `REF-0${index + 1}`}
            onReplace={() => {
              setReplacingRefIndex(index);
              document.getElementById('replace-reference-upload')?.click();
            }}
            onRemove={() => handleRemoveReferenceImage(index)}
          />
        ))}

        {/* Add Reference Placeholder */}
        {canAddMoreReferences && (
          <label
            htmlFor="multiple-image-upload"
            className="flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-white/5 hover:border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all cursor-pointer group"
          >
            <Plus className="text-neutral-700 group-hover:text-neutral-500 mb-2" size={16} />
            <span className="text-[10px] font-bold font-mono text-neutral-600 group-hover:text-neutral-400 uppercase tracking-widest">+ Add Reference</span>
          </label>
        )}
      </div>

      {/* Hidden Inputs */}
      <Input id="image-upload-blank" type="file" accept="image/*" onChange={handleSingleImageUpload} className="hidden" />
      <Input id="multiple-image-upload" type="file" accept="image/*" multiple onChange={handleMultipleImageUpload} className="hidden" />
      <Input id="replace-reference-upload" type="file" accept="image/*" onChange={handleReferenceReplace} className="hidden" />
    </section>
  );
};
