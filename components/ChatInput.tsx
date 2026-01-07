import React, { useMemo } from 'react';
import { Image, X, Pickaxe } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { useTranslation } from '../hooks/useTranslation';
import { getCreditsRequired } from '../utils/creditCalculator';
import type { UploadedImage, GeminiModel, Resolution } from '../types';
import { Card, CardContent } from './ui/card';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface ChatInputProps {
  // Prompt
  promptPreview: string;
  onPromptChange: (value: string) => void;

  // Modelo
  selectedModel: GeminiModel | null;
  onModelChange: (model: GeminiModel) => void;

  // Outputs
  mockupCount: number;
  onMockupCountChange: (count: number) => void;

  // Referências
  uploadedImage: UploadedImage | null;
  referenceImages: UploadedImage[];
  onImageUpload: (image: UploadedImage) => void;
  onReferenceImagesChange: (images: UploadedImage[]) => void;

  // Créditos
  resolution: Resolution;
  creditsRequired?: number;

  // Geração
  onGenerateClick: () => void;
  isGenerating: boolean;
  isGeneratingPrompt: boolean;
  isGenerateDisabled: boolean;
  isPromptReady: boolean;

  // Sugestões (opcional)
  promptSuggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  onGenerateSuggestion?: (suggestion: string) => void;
  creditsPerGeneration?: number;
}

const MODEL_NAMES: Record<GeminiModel, string> = {
  'gemini-2.5-flash-image': 'Mockup Machine® HD',
  'gemini-2.5-flash': 'Gemini Flash',
  'gemini-3-pro-image-preview': 'Mockup Machine® 4K',
  'veo-3.1-generate-preview': 'Mockup Machine® 4K',
  'veo-3.1-fast-generate-preview': 'Mockup Machine® 4K'
};

export const ChatInput: React.FC<ChatInputProps> = ({
  promptPreview,
  onPromptChange,
  selectedModel,
  onModelChange,
  mockupCount,
  onMockupCountChange,
  uploadedImage,
  referenceImages,
  onImageUpload,
  onReferenceImagesChange,
  resolution,
  creditsRequired,
  onGenerateClick,
  isGenerating,
  isGeneratingPrompt,
  isGenerateDisabled,
  isPromptReady,
  promptSuggestions = [],
  onSuggestionClick,
  onGenerateSuggestion,
  creditsPerGeneration
}) => {
  const { t } = useTranslation();

  const calculatedCredits = useMemo(() => {
    if (selectedModel && isPromptReady) {
      return mockupCount * getCreditsRequired(selectedModel, resolution);
    }
    return creditsRequired;
  }, [selectedModel, mockupCount, resolution, isPromptReady, creditsRequired]);

  const allReferenceImages = useMemo(() => {
    const images: UploadedImage[] = [];
    if (uploadedImage) images.push(uploadedImage);
    if (referenceImages.length > 0) images.push(...referenceImages);
    return images;
  }, [uploadedImage, referenceImages]);

  const handleAddReferenceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const newImage: UploadedImage = { base64, mimeType: file.type };

        if (!uploadedImage) {
          onImageUpload(newImage);
        } else {
          const totalImages = uploadedImage ? 1 + referenceImages.length : referenceImages.length;
          if (totalImages < 3) {
            onReferenceImagesChange([...referenceImages, newImage]);
          }
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleRemoveReferenceImage = (index: number) => {
    if (index === 0 && uploadedImage) {
      onReferenceImagesChange([]);
    } else {
      const refIndex = uploadedImage ? index - 1 : index;
      if (refIndex >= 0 && refIndex < referenceImages.length) {
        const newImages = referenceImages.filter((_, i) => i !== refIndex);
        onReferenceImagesChange(newImages);
      }
    }
  };

  return (
    <Card className="w-full border-border/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardContent className="p-4 space-y-4">
        {/* Prompt Textarea */}
        <div className="space-y-2">
          <Textarea
            value={promptPreview}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={6}
            className="min-h-[120px] resize-y font-mono text-sm"
            placeholder={t('mockup.promptPlaceholder')}
          />
        </div>

        {/* Configurações Compactas */}
        <div className="space-y-3 pt-2 border-t border-border/50">
          {/* Modelo e Número de Outputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('mockup.modelSelection')}
              </label>
              <Select
                value={selectedModel || ''}
                onChange={(value) => onModelChange(value as GeminiModel)}
                className="text-sm"
                options={[
                  { value: '', label: t('mockup.selectModel') },
                  { value: 'gemini-2.5-flash-image', label: MODEL_NAMES['gemini-2.5-flash-image'] },
                  { value: 'gemini-3-pro-image-preview', label: MODEL_NAMES['gemini-3-pro-image-preview'] },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('mockup.numberOfImages')}
              </label>
              <Select
                value={String(mockupCount)}
                onChange={(value) => onMockupCountChange(Number(value))}
                className="text-sm"
                options={[1, 2, 3, 4].map(count => ({
                  value: String(count),
                  label: String(count)
                }))}
              />
            </div>
          </div>

          {/* Referências de Imagens */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('mockup.referenceImages')}
            </label>
            <div className="flex items-center gap-2">
              {allReferenceImages.length > 0 ? (
                <div className="flex gap-2 flex-1">
                  {allReferenceImages.map((img, index) => {
                    const isUploadedImage = index === 0 && uploadedImage;
                    return (
                      <div key={index} className="relative group">
                        <div className="w-12 h-12 rounded-md border border-border bg-muted/50 p-1 overflow-hidden">
                          <img
                            src={`data:${img.mimeType};base64,${img.base64}`}
                            alt={`Reference ${index + 1}`}
                            className="w-full h-full object-contain rounded-md"
                          />
                        </div>
                        {!isUploadedImage && (
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleRemoveReferenceImage(index)}
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            title={t('mockup.removeImage')}
                          >
                            <X size={10} />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 text-xs text-muted-foreground">
                  {t('common.noImage')}
                </div>
              )}
              {allReferenceImages.length < 3 && (
                <label className="cursor-pointer">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="cursor-pointer"
                  >
                    <Image size={14} className="mr-1.5" />
                    {allReferenceImages.length > 0 ? t('mockup.addMore') : t('mockup.addImage')}
                  </Button>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAddReferenceImage}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Créditos Necessários */}
          {calculatedCredits !== undefined && calculatedCredits > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('mockup.creditsRequired')}:</span>
              <Badge variant="secondary">
                {calculatedCredits} {calculatedCredits === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}
              </Badge>
            </div>
          )}

          {/* Botão Generate Output */}
          <Button
            onClick={onGenerateClick}
            disabled={isGenerateDisabled || (isPromptReady && isGenerating)}
            className="w-full bg-brand-cyan hover:bg-brand-cyan/90 text-black font-semibold shadow-lg shadow-[brand-cyan]/20"
            size="lg"
          >
            {isGeneratingPrompt ? (
              <>
                <GlitchLoader size={12} />
                <span>{t('mockup.generatingPrompt')}</span>
              </>
            ) : isGenerating ? (
              <>
                <GlitchLoader size={12} />
                <span>{t('mockup.generatingOutputs')}</span>
              </>
            ) : isPromptReady ? (
              <>
                <Pickaxe size={14} />
                <span>{t('mockup.generateOutputs')}</span>
              </>
            ) : (
              <>
                <Pickaxe size={14} />
                <span>{t('mockup.generatePrompt')}</span>
              </>
            )}
          </Button>
        </div>

        {/* Sugestões de Prompt (se houver) */}
        {promptSuggestions.length > 0 && (
          <div className="pt-2 border-t border-border/50 space-y-2 animate-fade-in">
            <p className="text-xs font-medium text-muted-foreground">{t('mockup.aiSuggestions')}</p>
            {promptSuggestions.map((suggestion, index) => (
              <Card key={index} className="border-border/50 bg-muted/30">
                <CardContent className="p-3 space-y-2">
                  <Button
                    variant="ghost"
                    onClick={() => onSuggestionClick?.(suggestion)}
                    className="w-full text-left text-xs h-auto py-2 font-normal justify-start"
                  >
                    {suggestion}
                  </Button>
                  {onGenerateSuggestion && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateSuggestion(suggestion);
                        }}
                        disabled={isGenerating || !suggestion.trim()}
                        className="flex-1 bg-brand-cyan hover:bg-brand-cyan/90 text-black"
                        size="sm"
                      >
                        {isGenerating ? (
                          <>
                            <GlitchLoader size={12} />
                            <span>{t('mockup.generatingOutputs')}</span>
                          </>
                        ) : (
                          <>
                            <Pickaxe size={12} />
                            <span>{t('mockup.generateOutputs')}</span>
                          </>
                        )}
                      </Button>
                      {creditsPerGeneration !== undefined && creditsPerGeneration > 0 && (
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {creditsPerGeneration} {creditsPerGeneration === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
