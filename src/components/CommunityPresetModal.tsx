import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, AlertTriangle } from '@/lib/ui/icons';
import { GlitchLoader } from './ui/GlitchLoader';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { Select } from './ui/select';
import { AdminImageUploader } from './ui/AdminImageUploader';
import type { UploadedImage, AspectRatio, GeminiModel } from '../types/types';
import type { PromptCategory, LegacyPresetType } from '../types/communityPrompts';
import { authService } from '../services/authService';
import { cn } from '../lib/utils';
import { CATEGORY_CONFIG } from './PresetCard';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { MicroTitle } from './ui/MicroTitle';
import { Modal } from '@/components/ui/Modal';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface PresetFormData {
  category: PromptCategory;
  presetType?: LegacyPresetType;
  id: string;
  name: string;
  description: string;
  prompt: string;
  referenceImageUrl: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[];
  useCase?: string;
  examples?: string[];
}

interface CommunityPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PresetFormData) => Promise<void>;
  initialData?: Partial<PresetFormData>;
  isCreating: boolean;
}

const PRESET_API_BASE = '/api/community';

// Helper function to generate slug from text
const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

const getInitialFormData = (
  category: PromptCategory = 'presets',
  presetType?: LegacyPresetType
): PresetFormData => ({
  category,
  presetType: category === 'presets' ? presetType || 'mockup' : undefined,
  id: '',
  name: '',
  description: '',
  prompt: '',
  referenceImageUrl: '',
  aspectRatio: '16:9',
  model: GEMINI_MODELS.TEXT,
  tags: [],
  useCase: '',
});

// Infer preset metadata from prompt text via keyword heuristics
const CATEGORY_RULES: Array<{ regex: RegExp; category: string; presetType?: string }> = [
  {
    regex:
      /\b(mockup|mock-up|product shot|packaging|box|bag|bottle|cup|mug|t-?shirt|hoodie|tote|phone case|device|screen)\b/,
    category: 'presets',
    presetType: 'mockup',
  },
  { regex: /\b(3d|render|blender|cinema ?4d|isometric|voxel|clay)\b/, category: '3d' },
  {
    regex: /\b(texture|material|fabric|wood|marble|concrete|grain|paper)\b/,
    category: 'presets',
    presetType: 'texture',
  },
  {
    regex: /\b(light|lighting|neon|glow|shadow|backlit|rim light|golden hour|studio light)\b/,
    category: 'presets',
    presetType: 'luminance',
  },
  {
    regex: /\b(mood|ambient|atmosphere|vibe|dreamy|cinematic|film)\b/,
    category: 'presets',
    presetType: 'ambience',
  },
  {
    regex: /\b(angle|perspective|top.?down|bird.?eye|low angle|close.?up|macro|wide.?angle)\b/,
    category: 'presets',
    presetType: 'angle',
  },
  {
    regex: /\b(theme|style|retro|vintage|futuristic|minimalist|brutalist|y2k|cyberpunk|art deco)\b/,
    category: 'themes',
  },
  {
    regex: /\b(aesthetic|color palette|pastel|monochrome|gradient|duotone)\b/,
    category: 'aesthetics',
  },
];

const ASPECT_RATIO_RULES: Array<{ regex: RegExp; ratio: string }> = [
  { regex: /\b(portrait|vertical|story|stories|9:16|reel)\b/, ratio: '9:16' },
  { regex: /\b(square|1:1|instagram post)\b/, ratio: '1:1' },
  { regex: /\b(ultrawide|21:9|panoramic|banner)\b/, ratio: '21:9' },
  { regex: /\b(landscape|horizontal|16:9|youtube|thumbnail)\b/, ratio: '16:9' },
  { regex: /\b(4:3)\b/, ratio: '4:3' },
  { regex: /\b(3:4)\b/, ratio: '3:4' },
];

const inferFromPrompt = (prompt: string): Partial<PresetFormData> => {
  const lower = prompt.toLowerCase();
  const inferred: Partial<PresetFormData> = {};

  for (const rule of CATEGORY_RULES) {
    if (rule.regex.test(lower)) {
      inferred.category = rule.category as PromptCategory;
      if (rule.presetType) inferred.presetType = rule.presetType as LegacyPresetType;
      break;
    }
  }

  for (const rule of ASPECT_RATIO_RULES) {
    if (rule.regex.test(lower)) {
      inferred.aspectRatio = rule.ratio as AspectRatio;
      break;
    }
  }

  // Infer name: first sentence or first ~50 chars
  const firstLine = prompt.split(/[.\n]/)[0]?.trim() || '';
  if (firstLine.length > 0) {
    inferred.name = firstLine.length > 50 ? firstLine.slice(0, 50).trim() : firstLine;
  }

  // Infer tags from notable keywords
  const tagKeywords = prompt.match(
    /\b(minimal|luxury|organic|bold|elegant|modern|classic|playful|professional|vintage|retro|neon|dark|bright|soft|matte|glossy)\b/gi
  );
  if (tagKeywords) {
    inferred.tags = [...new Set(tagKeywords.map((t) => t.toLowerCase()))];
  }

  return inferred;
};

export const CommunityPresetModal: React.FC<CommunityPresetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  isCreating,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<PresetFormData>(
    initialData
      ? {
          ...getInitialFormData(initialData.category || 'presets', initialData.presetType),
          ...initialData,
        }
      : getInitialFormData('presets', 'mockup')
  );
  const [tagInput, setTagInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  // Auto-infer fields when prompt changes (only on create, only first auto-fill or when prompt is pasted)
  const handlePromptChange = (newPrompt: string) => {
    const wasPaste = newPrompt.length - formData.prompt.length > 10;
    setFormData((prev) => {
      const updated = { ...prev, prompt: newPrompt };
      if (isCreating && newPrompt.length > 15 && (wasPaste || !autoFilled)) {
        const inferred = inferFromPrompt(newPrompt);
        if ((!prev.name || wasPaste) && inferred.name) updated.name = inferred.name;
        if (inferred.category) updated.category = inferred.category;
        if (inferred.presetType) updated.presetType = inferred.presetType;
        if (inferred.aspectRatio) updated.aspectRatio = inferred.aspectRatio;
        if (inferred.tags?.length) updated.tags = inferred.tags;
        setAutoFilled(true);
      }
      return updated;
    });
  };

  // Auto-generate ID from name when creating
  useEffect(() => {
    if (isCreating && formData.name) {
      const generatedId = generateSlug(formData.name);
      if (generatedId && generatedId !== formData.id) {
        setFormData((prev) => ({ ...prev, id: generatedId }));
      }
    }
  }, [formData.name, isCreating]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          ...getInitialFormData(initialData.category || 'presets', initialData.presetType),
          ...initialData,
        });
      } else {
        setFormData(getInitialFormData('presets', 'mockup'));
      }
      setTagInput('');
      setError(null);
      setImageUploadError(null);
      setAutoFilled(false);
    }
  }, [isOpen, initialData]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    setFormData(getInitialFormData('presets', 'mockup'));
    setTagInput('');
    setError(null);
    setImageUploadError(null);
    onClose();
  };

  const handleImageUpload = async (image: UploadedImage) => {
    const token = authService.getToken();
    if (!token) {
      setImageUploadError(t('communityPresets.errors.mustBeAuthenticatedToCreate'));
      return;
    }

    const presetId = formData.id || generateSlug(formData.name);
    if (!presetId || presetId.trim() === '') {
      setImageUploadError(t('communityPresets.enterPresetNameFirst'));
      return;
    }

    setIsUploadingImage(true);
    setImageUploadError(null);

    try {
      if (!image.base64) {
        throw new Error('Image data is missing');
      }

      const uploadUrl = `${PRESET_API_BASE}/upload-image`;
      console.log('[CommunityPresetModal] Uploading image to:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          base64Image: image.base64,
          id: presetId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || t('common.failedToUploadImage'));
      }

      const { url } = await response.json();
      setFormData({ ...formData, referenceImageUrl: url });
      toast.success(t('common.imageUploadedSuccess'));
    } catch (uploadError: any) {
      setImageUploadError(uploadError.message || t('common.failedToUploadImage'));
      console.error('Error uploading image:', uploadError);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    const presetId = isCreating ? formData.id || generateSlug(formData.name) : formData.id;

    if (!formData.name || !formData.prompt) {
      setError(t('communityPresets.errors.missingFields'));
      return;
    }

    // Validar category e presetType
    if (formData.category === 'presets' && !formData.presetType) {
      setError('Preset type is required when category is "presets"');
      return;
    }

    if (!presetId || presetId.trim() === '') {
      setError('Could not generate preset ID. Please enter a valid name.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSave({ ...formData, id: presetId });
      handleClose();
    } catch (saveError: any) {
      setError(saveError.message || t('communityPresets.errors.failedToCreate'));
    } finally {
      setIsLoading(false);
    }
  };

  const categoryOptions = Object.entries(CATEGORY_CONFIG)
    .filter(([key]) => key !== 'all')
    .map(([key, config]) => ({
      value: key as PromptCategory,
      label: t(`communityPresets.categories.${key}`) || config.label,
      icon: config.icon,
    }));

  const presetTypeOptions = [
    { value: 'mockup', label: t('communityPresets.tabs.mockup') },
    { value: 'angle', label: t('communityPresets.tabs.angle') },
    { value: 'texture', label: t('communityPresets.tabs.texture') },
    { value: 'ambience', label: t('communityPresets.tabs.ambience') },
    { value: 'luminance', label: t('communityPresets.tabs.luminance') },
  ];

  const aspectRatioOptions = [
    { value: '1:1', label: '1:1 (Square)' },
    { value: '16:9', label: '16:9 (Landscape)' },
    { value: '9:16', label: '9:16 (Portrait)' },
    { value: '4:3', label: '4:3' },
    { value: '3:4', label: '3:4' },
    { value: '21:9', label: '21:9 (Ultrawide)' },
  ];

  if (!isOpen) return null;

  // Determinar se precisa mostrar referenceImageUrl
  // Para categoria mockup OU para outras categorias (3d, aesthetics, themes)
  // Categorias antigas (angle, texture, ambience, luminance) não precisam de imagem
  const needsReferenceImage =
    formData.category === 'mockup' ||
    (formData.category === 'presets' && formData.presetType === 'mockup') ||
    (formData.category !== 'presets' &&
      formData.category !== 'all' &&
      !['angle', 'texture', 'ambience', 'luminance'].includes(formData.category));

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      id="community-preset"
      size="lg"
      title={isCreating ? t('communityPresets.createPreset') : t('communityPresets.editPreset')}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="brand"
            onClick={handleSubmit}
            disabled={isLoading || !formData.name || !formData.prompt}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <GlitchLoader size={14} />
                <span>{t('common.saving')}</span>
              </>
            ) : (
              <span>{t('common.save')}</span>
            )}
          </Button>
        </div>
      }
    >
      <div>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-5">
          {/* Prompt First — paste and auto-fill */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <MicroTitle as="label">{t('communityPresets.promptRequired')} *</MicroTitle>
              <MicroTitle as="span" className="text-muted-foreground lowercase">
                {t('communityPresets.charsCount', { count: formData.prompt.length })}
              </MicroTitle>
            </div>
            <Textarea
              value={formData.prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              rows={5}
              autoFocus
              className="w-full resize-none"
              placeholder={t('communityPresets.describeWhatToGenerate')}
            />
            {isCreating && autoFilled && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {t('communityPresets.autoFilledHint')}
              </p>
            )}
          </div>

          {/* Image Upload Section */}
          {needsReferenceImage && (
            <div className="flex items-start gap-4 pb-5 border-b border-border">
              {formData.referenceImageUrl ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted group flex-shrink-0">
                  <img
                    src={formData.referenceImageUrl}
                    alt={t('common.reference')}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, referenceImageUrl: '' });
                      setImageUploadError(null);
                    }}
                    aria-label={t('communityPresets.removeImage2')}
                    className={cn(
                      hoverReveal,
                      'absolute inset-0 bg-background/70 flex items-center justify-center'
                    )}
                  >
                    <X className="h-4 w-4 text-foreground" />
                  </Button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <MicroTitle as="p" className="text-foreground mb-1">
                  {t('communityPresets.referenceImage')}
                </MicroTitle>
                <MicroTitle as="p" className="text-muted-foreground mb-2 lowercase">
                  {t('communityPresets.imageSizeHint')}
                </MicroTitle>
                <div className="flex items-center gap-2">
                  <AdminImageUploader
                    onImageUpload={handleImageUpload}
                    disabled={isUploadingImage || !formData.name || formData.name.trim() === ''}
                  />
                  {formData.referenceImageUrl && (
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, referenceImageUrl: '' });
                        setImageUploadError(null);
                      }}
                      className="px-3 py-1.5 text-xs"
                    >
                      {t('common.cancel')}
                    </Button>
                  )}
                </div>
                {isUploadingImage && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <GlitchLoader size={12} />
                    <span>{t('communityPresets.uploadingImage')}</span>
                  </div>
                )}
                {imageUploadError && (
                  <p className="text-xs text-destructive mt-2">{imageUploadError}</p>
                )}
                {(!formData.name || formData.name.trim() === '') && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('communityPresets.enterPresetNameFirst')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Name Field */}
          <div>
            <MicroTitle as="label" className="mb-1.5">
              {t('communityPresets.nameRequired')} *
            </MicroTitle>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full"
              placeholder={t('communityPresets.namePlaceholder')}
            />
            {isCreating && formData.id && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {t('communityPresets.autoGeneratedId')}:{' '}
                <span className="text-foreground">{formData.id}</span>
              </p>
            )}
          </div>

          {/* Category & Preset Type Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative z-50">
              <MicroTitle as="label" className="mb-1.5">
                {t('communityPresets.category')} *
              </MicroTitle>
              <Select
                options={categoryOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
                value={formData.category}
                onChange={(value) => {
                  const newCategory = value as PromptCategory;
                  setFormData({
                    ...formData,
                    category: newCategory,
                    presetType:
                      newCategory === 'presets' ? formData.presetType || 'mockup' : undefined,
                  });
                }}
                disabled={!isCreating}
                placeholder={t('communityPresets.category')}
              />
            </div>
            {formData.category === 'presets' && (
              <div className="relative z-50">
                <MicroTitle as="label" className="mb-1.5">
                  {t('communityPresets.presetType')} *
                </MicroTitle>
                <Select
                  options={presetTypeOptions}
                  value={formData.presetType || 'mockup'}
                  onChange={(value) =>
                    setFormData({ ...formData, presetType: value as LegacyPresetType })
                  }
                  disabled={!isCreating}
                  placeholder={t('communityPresets.presetType')}
                />
              </div>
            )}
          </div>

          {/* Description & Aspect Ratio Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <MicroTitle as="label" className="mb-1.5">
                {t('communityPresets.descriptionOptional')}
              </MicroTitle>
              <Input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full"
                placeholder={t('communityPresets.descriptionPlaceholder')}
              />
            </div>
            <div className="relative z-50">
              <MicroTitle as="label" className="mb-1.5">
                {t('communityPresets.aspectRatioOptional')}
              </MicroTitle>
              <Select
                options={aspectRatioOptions}
                value={formData.aspectRatio}
                onChange={(value) =>
                  setFormData({ ...formData, aspectRatio: value as AspectRatio })
                }
                placeholder={t('communityPresets.aspectRatioPlaceholder')}
              />
            </div>
          </div>

          {/* Reference Image URL (manual) */}
          {needsReferenceImage && (
            <div>
              <MicroTitle as="label" className="mb-1.5">
                {t('communityPresets.referenceImageManual')}
              </MicroTitle>
              <Input
                type="text"
                value={formData.referenceImageUrl || ''}
                onChange={(e) => {
                  setFormData({ ...formData, referenceImageUrl: e.target.value });
                  setImageUploadError(null);
                }}
                className="w-full"
                placeholder={t('communityPresets.referenceImageUrlPlaceholder')}
              />
            </div>
          )}

          {/* Tags */}
          <div>
            <MicroTitle as="label" className="mb-1.5">
              {t('communityPresets.tags.label')}
            </MicroTitle>
            <div className="flex gap-2">
              <Input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    const newTag = tagInput.trim();
                    if (!formData.tags?.includes(newTag)) {
                      setFormData({
                        ...formData,
                        tags: [...(formData.tags || []), newTag],
                      });
                    }
                    setTagInput('');
                  }
                }}
                placeholder={t('communityPresets.tags.placeholder')}
                className="flex-1"
              />
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
                    setFormData({
                      ...formData,
                      tags: [...(formData.tags || []), tagInput.trim()],
                    });
                    setTagInput('');
                  }
                }}
                className="px-4 py-2 text-sm"
              >
                {t('communityPresets.tags.add')}
              </Button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted border border-border rounded-lg text-xs text-foreground"
                  >
                    <span className="text-muted-foreground">#</span>
                    {tag}
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          tags: formData.tags?.filter((_, i) => i !== index) || [],
                        });
                      }}
                      aria-label={t('communityPresets.removeTag')}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                    >
                      <X size={12} />
                    </Button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
