import React, { useState, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { FormInput } from '@/components/ui/form-input';
import { Button } from '@/components/ui/button';
import type { UploadedImage } from '@/types/types';
import { X, Upload } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { getContrastColor } from '@/utils/colorUtils';
import { budgetApi } from '@/services/budgetApi';
import { toast } from 'sonner';

interface BrandCustomizationSectionProps {
  brandName: string;
  brandColors: string[];
  brandLogo?: string;
  brandBackgroundColor?: string;
  brandAccentColor?: string;
  budgetId?: string;
  onBrandNameChange: (name: string) => void;
  onBrandColorsChange: (colors: string[]) => void;
  onBrandLogoChange: (logo: string | undefined) => void;
  onBrandBackgroundColorChange: (color: string | undefined) => void;
  onBrandAccentColorChange: (color: string | undefined) => void;
}

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const fileToBase64 = (file: File): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (base64) {
        resolve({ base64, mimeType: file.type });
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const BrandCustomizationSection: React.FC<BrandCustomizationSectionProps> = ({
  brandName,
  brandColors,
  brandLogo,
  brandBackgroundColor,
  brandAccentColor,
  budgetId,
  onBrandNameChange,
  onBrandColorsChange,
  onBrandLogoChange,
  onBrandBackgroundColorChange,
  onBrandAccentColorChange,
}) => {
  const { t } = useTranslation();
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      toast.error(t('upload.unsupportedFileType') || 'Unsupported file type');
      return;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(t('upload.imageTooLarge', { size: fileSizeMB, max: MAX_IMAGE_SIZE_MB }) || `Image size must be less than ${MAX_IMAGE_SIZE_MB}MB`);
      return;
    }

    setIsUploadingLogo(true);
    try {
      const imageData = await fileToBase64(file);
      await handleImageUpload(imageData);
    } catch (error: any) {
      console.error('Error processing file:', error);
      toast.error(t('upload.couldNotProcess') || 'Failed to process image');
    } finally {
      setIsUploadingLogo(false);
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageUpload = async (image: UploadedImage) => {
    if (!budgetId) {
      // Se não tem budgetId, salva como base64 temporariamente
      onBrandLogoChange(image.base64);
      return;
    }

    // Upload para R2
    try {
      const imageUrl = await budgetApi.uploadLogo(budgetId, image.base64);
      onBrandLogoChange(imageUrl);
      toast.success(t('budget.logoUploaded') || 'Logo uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(error.message || t('budget.logoUploadError') || 'Failed to upload logo');
      // Fallback para base64 se upload falhar
      onBrandLogoChange(image.base64);
    }
  };

  const handleRemoveLogo = () => {
    onBrandLogoChange(undefined);
  };

  // Calcular cor de texto baseado no contraste
  const textColor = brandBackgroundColor
    ? getContrastColor(brandBackgroundColor) === 'white' ? 'text-white' : 'text-black'
    : 'text-zinc-200';

  return (
    <div
      className="space-y-6 rounded-xl p-6 transition-colors"
      style={{
        backgroundColor: brandBackgroundColor || undefined,
      }}
    >
      <h3 className={`text-lg font-semibold font-mono ${textColor}`}>
        {t('budget.brandCustomization')}
      </h3>

      <div>
        <label className={`block text-xs mb-2 font-mono ${textColor} opacity-80`}>
          {t('budget.brandName')}
        </label>
        <FormInput
          value={brandName}
          onChange={(e) => onBrandNameChange(e.target.value)}
          placeholder={t('budget.placeholders.brandName')}
          className={brandBackgroundColor ? `bg-white/10 border-white/20 ${textColor}` : ''}
        />
      </div>

      <div>
        <label className={`block text-xs mb-2 font-mono ${textColor} opacity-80`}>
          {t('budget.brandLogo')}
        </label>
        {isUploadingLogo ? (
          <div className="flex items-center gap-2 p-4 border border-zinc-800 rounded-xl bg-black/20">
            <GlitchLoader size={16} color="brand-cyan" />
            <span className="text-sm text-zinc-400 font-mono">
              {t('budget.uploadingLogo') || 'Uploading logo...'}
            </span>
          </div>
        ) : brandLogo ? (
          <div className="relative inline-block">
            <img
              src={brandLogo}
              alt="Brand logo"
              className="max-h-32 max-w-48 object-contain rounded-md border border-zinc-800"
            />
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 rounded-md text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_MIME_TYPES.join(',')}
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploadingLogo}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingLogo}
              className="border border-zinc-800 bg-black/20 hover:bg-black/30 text-zinc-200 hover:text-brand-cyan"
            >
              <Upload className="h-4 w-4" />
              {t('budget.uploadLogo') || 'Upload Logo'}
            </Button>
          </div>
        )}
      </div>

      {/* Cor de Fundo */}
      <div>
        <label className={`block text-xs mb-2 font-mono ${textColor} opacity-80`}>
          {t('budget.brandBackgroundColor')}
        </label>
        <div className="flex gap-2">
          <FormInput
            type="color"
            value={brandBackgroundColor || '#000000'}
            onChange={(e) => onBrandBackgroundColorChange(e.target.value || undefined)}
            className="w-20 h-10 cursor-pointer"
          />
          <FormInput
            type="text"
            value={brandBackgroundColor || ''}
            onChange={(e) => onBrandBackgroundColorChange(e.target.value || undefined)}
            placeholder={t('budget.placeholders.brandBackgroundColor')}
            className="flex-1"
          />
          {brandBackgroundColor && (
            <button
              type="button"
              onClick={() => onBrandBackgroundColorChange(undefined)}
              className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-red-400 font-mono text-sm transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Cor de Destaque */}
      <div>
        <label className={`block text-xs mb-2 font-mono ${textColor} opacity-80`}>
          {t('budget.brandAccentColor')}
        </label>
        <div className="flex gap-2">
          <FormInput
            type="color"
            value={brandAccentColor || 'brand-cyan'}
            onChange={(e) => onBrandAccentColorChange(e.target.value || undefined)}
            className="w-20 h-10 cursor-pointer"
          />
          <FormInput
            type="text"
            value={brandAccentColor || ''}
            onChange={(e) => onBrandAccentColorChange(e.target.value || undefined)}
            placeholder={t('budget.placeholders.brandAccentColor')}
            className="flex-1"
          />
          {brandAccentColor && (
            <button
              type="button"
              onClick={() => onBrandAccentColorChange(undefined)}
              className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-red-400 font-mono text-sm transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
