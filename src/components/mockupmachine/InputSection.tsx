import React, { useState } from 'react';
import { Thumb } from '@/components/ui/Thumb';
import { X, Plus, CheckCircle2, ArrowLeftRight } from '@/lib/ui/icons';
import type { UploadedImage, DesignType, GeminiModel } from '@/types/types';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { formatImageTo16_9 } from '@/utils/fileUtils';
import { isSafeUrl } from '@/utils/imageUtils';
import { cn } from '@/lib/utils';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { MicroTitle } from '../ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Share2 } from '@/lib/ui/icons';
import { BrandGuidelineSelector } from './BrandGuidelineSelector';
import { useMockup } from '@/hooks/useMockup';
import { MockupCard } from './MockupCard';

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
  className = '',
  onDesignTypeChange,
  onScrollToSection,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const displayImage = uploadedImage;
  const hasImage = !!displayImage;
  const isProModel = selectedModel === GEMINI_MODELS.PRO;
  const isHDModel = selectedModel === GEMINI_MODELS.FLASH;
  // Allow 3 references before model selection (Pro max), limit to 1 for HD after selection
  const maxReferences = !selectedModel ? 3 : isProModel ? 3 : isHDModel ? 1 : 0;
  // Allow reference upload when there's a main image, even without model selected
  const canAddMoreReferences = hasImage && referenceImages.length < maxReferences;
  const supportsReferences = !selectedModel || isProModel || isHDModel; // Enable before model selection
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [replacingRefIndex, setReplacingRefIndex] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const mockupContext = useMockup();

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
          const r2Url = await mockupApi.uploadTempImage(
            formatted.base64 || base64,
            formatted.mimeType
          );
          onImageUpload({ url: r2Url, mimeType: formatted.mimeType });
        } catch (error) {
          console.error('Error processing/uploading image:', error);
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
          const r2Url = await mockupApi.uploadTempImage(
            formatted.base64 || base64,
            formatted.mimeType
          );

          const newRefs = [...referenceImages];
          newRefs[replacingRefIndex] = { url: r2Url, mimeType: formatted.mimeType };
          onReferenceImagesChange(newRefs);
        } catch (error) {
          console.error('Error replacing reference image:', error);
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
        return new Promise<UploadedImage>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              // First format to 16:9 as before to ensure consistency
              const formatted = await formatImageTo16_9(base64, file.type);

              // Upload to R2 immediately; keep only url to avoid holding base64
              const r2Url = await mockupApi.uploadTempImage(
                formatted.base64 || base64,
                formatted.mimeType
              );
              resolve({ url: r2Url, mimeType: formatted.mimeType });
            } catch (error) {
              console.error('Error processing/uploading image:', error);

              // Fallback: if upload fails, use base64 but warn
              const base64 = (reader.result as string).split(',')[1];
              toast.error(t('errors.imageUploadFailed'));
              resolve({ base64, mimeType: file.type });
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
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

  const capacityUsage = Math.round(
    Math.min((((displayImage ? 1 : 0) + referenceImages.length) / 4) * 100, 100)
  );

  const ImageCard = ({
    img,
    label,
    onReplace,
    onRemove,
    onAddRef,
    isAnalyzed = false,
    highlight = false,
  }: {
    img: UploadedImage;
    label: string;
    onReplace: () => void;
    onRemove?: () => void;
    onAddRef?: () => void;
    isAnalyzed?: boolean;
    highlight?: boolean;
  }) => (
    <div
      className={cn(
        'relative flex flex-col p-2 rounded-xl border transition-[color,background-color,border-color,box-shadow] group w-full animate-in fade-in zoom-in-95 duration-500',
        highlight
          ? 'bg-neutral-900/30 border-border'
          : 'bg-neutral-900/20 border-border hover:border-border-hover'
      )}
    >
      {/* Image Container */}
      <div className="relative h-32 sm:h-40 md:h-48 w-full rounded-xl overflow-hidden flex items-center justify-center group/img-container bg-muted p-4">
        <Thumb
          src={getImageSrc(img)}
          alt={label}
          loading="lazy"
          className="max-h-full max-w-full object-contain rounded-xl"
        />

        {/* Hover Overlay with Replace Action */}
        {/* EXCEÇÃO ao ui-scale/opacidade-cru: scrim sobre mídia */}
        <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 bg-black/40 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/img-container:opacity-100 group-focus-within/img-container:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReplace();
            }}
            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-popover border border-border hover:bg-accent hover:border-border-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="p-3 rounded-full bg-muted text-foreground">
              <ArrowLeftRight size={20} />
            </div>
            <span className="text-xs font-medium text-foreground">{t('mockup.replace')}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <section className={cn('flex flex-col gap-8 w-full', className)}>
      {/* Header Area: Metadata + Settings */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">
              {t('mockup.filesLoaded', { count: referenceImages.length + 1 })}
            </p>
          </div>
        </div>

        {!isLoadingImage && (
          <div className="flex items-center gap-2">
            {/* Design Type Segmented Control */}
            <div className="flex items-center p-1 bg-neutral-900/50 rounded-xl border border-neutral-800">
              <button
                onClick={() => onDesignTypeChange('layout')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                  designType === 'layout'
                    ? 'bg-muted text-foreground'
                    : 'text-neutral-500 hover:text-neutral-300'
                )}
                aria-pressed={designType === 'layout'}
              >
                {t('mockup.typeLayout')}
              </button>
              <button
                onClick={() => onDesignTypeChange('logo')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                  designType === 'logo'
                    ? 'bg-muted text-foreground'
                    : 'text-neutral-500 hover:text-neutral-300'
                )}
                aria-pressed={designType === 'logo'}
              >
                {t('mockup.typeLogo')}
              </button>
            </div>

            {uploadedImage && <BrandGuidelineSelector asButton />}

            {/* Instructions Toggle (Shared icon style as requested) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowInstructions(!showInstructions)}
              className={cn(
                'w-10 h-10 rounded-xl border transition-colors',
                showInstructions
                  ? 'bg-brand-cyan/10 border-brand-cyan/40 text-foreground'
                  : 'bg-neutral-900/50 border-neutral-800 text-neutral-500 hover:text-foreground'
              )}
              title={t('mockup.addInstructions')}
              aria-label={t('mockup.addInstructions')}
              aria-pressed={showInstructions}
            >
              <Share2 size={16} />
            </Button>
          </div>
        )}
      </div>

      {showInstructions && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <div className="relative">
            <Textarea
              placeholder={t('mockup.instructionsPlaceholder')}
              className="relative min-h-[100px] bg-neutral-900/40 border-border rounded-xl text-sm focus:border-neutral-600 transition-colors placeholder:text-neutral-600 custom-scrollbar"
              value={mockupContext.instructions}
              onChange={(e) => mockupContext.setInstructions(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Standardized Files Grid */}
      <div
        className={cn(
          'grid gap-5 w-full min-h-[140px]',
          displayImage
            ? referenceImages.length === 0
              ? 'grid-cols-1'
              : 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1'
        )}
      >
        {/* Main Image Card */}
        {displayImage ? (
          <ImageCard
            img={displayImage}
            label={t('mockup.mainFile')}
            onReplace={() => document.getElementById('image-upload-blank')?.click()}
            onAddRef={
              canAddMoreReferences
                ? () => document.getElementById('multiple-image-upload')?.click()
                : undefined
            }
            isAnalyzed={hasAnalyzed}
            highlight={hasAnalyzed}
          />
        ) : (
          <label
            htmlFor="image-upload-blank"
            className="flex flex-col items-center justify-center p-12 rounded-xl border-2 border-dashed border-neutral-800 hover:border-neutral-700 bg-muted hover:bg-accent transition-colors cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus
                className="text-neutral-500 group-hover:text-foreground transition-colors"
                size={20}
              />
            </div>
            <span className="text-sm text-neutral-400 group-hover:text-foreground transition-colors">
              {t('mockup.uploadMainDesign')}
            </span>
          </label>
        )}

        {/* Reference Images List */}
        {referenceImages.map((img, index) => (
          <ImageCard
            key={index}
            img={img}
            label={t('mockup.referenceLabel', { order: index + 1 })}
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
            className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-neutral-800 hover:border-border-hover bg-muted hover:bg-accent transition-colors cursor-pointer group"
          >
            <Plus className="text-neutral-700 group-hover:text-neutral-500 mb-2" size={16} />
            <span className="text-2xs font-medium text-neutral-600 group-hover:text-neutral-400">
              {t('mockup.addReferenceImage', { count: referenceImages.length })}
            </span>
          </label>
        )}
      </div>

      {/* Hidden Inputs */}
      <Input
        id="image-upload-blank"
        type="file"
        accept="image/*"
        onChange={handleSingleImageUpload}
        className="hidden"
      />
      <Input
        id="multiple-image-upload"
        type="file"
        accept="image/*"
        multiple
        onChange={handleMultipleImageUpload}
        className="hidden"
      />
      <Input
        id="replace-reference-upload"
        type="file"
        accept="image/*"
        onChange={handleReferenceReplace}
        className="hidden"
      />
    </section>
  );
};
