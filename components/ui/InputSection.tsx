import React, { useState } from 'react';
import { ImageOff, Info, X, Plus } from 'lucide-react';
import { GlitchLoader } from './GlitchLoader';
import type { UploadedImage, DesignType, GeminiModel } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { formatImageTo16_9 } from '../../utils/fileUtils';
import { isSafeUrl } from '../../utils/imageUtils';

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
  isImagelessMode
}) => {
  const { t } = useTranslation();
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
      const processPromises = files.slice(0, totalToLoad).map(async (file) => {
        const reader = new FileReader();
        return new Promise<UploadedImage>((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              const formatted = await formatImageTo16_9(base64, file.type);
              resolve(formatted);
            } catch (error) {
              // If formatting fails, use original
              const base64 = (reader.result as string).split(',')[1];
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
    } finally {
      setIsLoadingImage(false);
    }

    e.target.value = '';
  };

  const handleRemoveReferenceImage = (index: number) => {
    const newImages = referenceImages.filter((_, i) => i !== index);
    onReferenceImagesChange(newImages);
  };

  return (
    <section className={hasImage ? 'pb-0' : ''}>
      <h2 className={`font-semibold font-mono uppercase tracking-widest mb-3 transition-all duration-300 ${hasImage ? 'text-[10px] text-zinc-600 mb-1' : 'text-sm text-zinc-400'}`}>
        {t('mockup.input')}
      </h2>

      <div className={`${hasImage && supportsReferences ? 'flex gap-2' : (hasImage ? 'w-1/4 opacity-80' : 'w-1/4')} mx-auto transition-all duration-300`}>
        <div className={`relative aspect-[4/3] bg-black/20 rounded-md p-2 border border-zinc-700/50 ${supportsReferences && hasImage ? 'flex-1' : ''}`}>
          {isLoadingImage ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
              <GlitchLoader size={18} color="#52ddeb" />
              <p className="text-xs font-mono mt-2">{t('mockup.loadingImage')}</p>
            </div>
          ) : displayImage ? (
            <label htmlFor="image-upload-blank" className="w-full h-full cursor-pointer group relative">
              <img
                src={isSafeUrl(`data:${displayImage.mimeType};base64,${displayImage.base64}`) ? `data:${displayImage.mimeType};base64,${displayImage.base64}` : ''}
                alt={isReferenceOnly ? t('mockup.referenceImageAlt') : t('mockup.uploadedDesignAlt')}
                className={`w-full h-full object-contain rounded-md group-hover:opacity-80 transition-opacity ${isReferenceOnly ? 'opacity-70' : ''}`}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                <p className="text-xs font-mono text-white">{isReferenceOnly ? t('mockup.clickToChangeReference') : t('mockup.clickToChange')}</p>
              </div>
              {isReferenceOnly && (
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-zinc-900/80 backdrop-blur-sm rounded-md border border-zinc-700/50">
                  <Info size={12} className="text-brand-cyan/80" />
                  <span className="text-[10px] font-mono text-zinc-400">{t('mockup.referenceOnly')}</span>
                </div>
              )}
            </label>
          ) : (
            <label htmlFor="image-upload-blank" className="w-full h-full flex flex-col items-center justify-center text-zinc-700 cursor-pointer hover:text-zinc-500 transition-colors">
              <ImageOff size={40} strokeWidth={1} />
              <p className="text-xs font-mono mt-2">{t('common.noImage')}</p>
              {designType === 'blank' && (
                <p className="text-xs font-mono mt-1 text-zinc-600">{t('mockup.clickToUploadReference')}</p>
              )}
            </label>
          )}
          <input
            id="image-upload-blank"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                setIsLoadingImage(true);
                try {
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
                  onImageUpload(formatted);
                } catch (error) {
                  console.error('Error processing image:', error);
                  // If formatting fails, try to use original
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    onImageUpload({ base64, mimeType: file.type });
                  };
                  reader.readAsDataURL(file);
                } finally {
                  setIsLoadingImage(false);
                }
              }
              e.target.value = '';
            }}
            className="hidden"
          />
        </div>

        {supportsReferences && hasImage && referenceImages.map((img, index) => (
          <div key={index} className="relative aspect-[4/3] bg-black/20 rounded-md p-2 border border-zinc-700/50 flex-1 group">
            <img
              src={isSafeUrl(`data:${img.mimeType};base64,${img.base64}`) ? `data:${img.mimeType};base64,${img.base64}` : ''}
              alt={`${t('mockup.referenceImageAlt')} ${index + 1}`}
              className="w-full h-full object-contain rounded-md"
            />
            <button
              onClick={() => handleRemoveReferenceImage(index)}
              className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title={t('mockup.removeImage')}
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {supportsReferences && hasImage && canAddMoreReferences && (
          <>
            {isLoadingImage ? (
              <div className="aspect-[4/3] flex-1 flex items-center justify-center bg-zinc-800/50 rounded-md border border-zinc-700/50">
                <GlitchLoader size={16} color="#52ddeb" />
              </div>
            ) : (
              <label
                htmlFor="multiple-image-upload"
                className={`aspect-[4/3] flex items-center justify-center bg-zinc-800/50 text-zinc-400 rounded-md border border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/70 transition-all duration-200 cursor-pointer ${isImagelessMode ? 'flex-[0.3]' : 'flex-1'}`}
              >
                <Plus size={24} />
              </label>
            )}
            <input
              id="multiple-image-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleMultipleImageUpload}
              className="hidden"
              disabled={isLoadingImage}
            />
          </>
        )}
      </div>

      {supportsReferences && referenceImages.length >= maxReferences && (
        <div className="mb-3 p-2 bg-zinc-800/30 rounded-md border border-zinc-700/50">
          <p className="text-xs font-mono text-zinc-500 text-center">
            {t('mockup.maxReferenceImages')}
          </p>
        </div>
      )}
    </section>
  );
};


