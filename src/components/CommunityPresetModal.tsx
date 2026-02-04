import React, { useState, useEffect } from 'react';
import { X, Save, Image as ImageIcon } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { Select } from './ui/select';
import { AdminImageUploader } from './ui/AdminImageUploader';
import { FormField } from './ui/form-field';
import { FormInput } from './ui/form-input';
import { FormTextarea } from './ui/form-textarea';
import type { UploadedImage, AspectRatio, GeminiModel } from '../types/types';
import type { PromptCategory, LegacyPresetType } from '../types/communityPrompts';
import { authService } from '../services/authService';
import { cn } from '../lib/utils';
import { CATEGORY_CONFIG } from './PresetCard';

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

const getInitialFormData = (category: PromptCategory = 'presets', presetType?: LegacyPresetType): PresetFormData => ({
    category,
    presetType: category === 'presets' ? (presetType || 'mockup') : undefined,
    id: '',
    name: '',
    description: '',
    prompt: '',
    referenceImageUrl: '',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
    tags: [],
    useCase: '',
});

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
            ? { ...getInitialFormData(initialData.category || 'presets', initialData.presetType), ...initialData }
            : getInitialFormData('presets', 'mockup')
    );
    const [tagInput, setTagInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [imageUploadError, setImageUploadError] = useState<string | null>(null);

    // Auto-generate ID from name when creating
    useEffect(() => {
        if (isCreating && formData.name) {
            const generatedId = generateSlug(formData.name);
            if (generatedId && generatedId !== formData.id) {
                setFormData(prev => ({ ...prev, id: generatedId }));
            }
        }
    }, [formData.name, isCreating]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    ...getInitialFormData(initialData.category || 'presets', initialData.presetType),
                    ...initialData
                });
            } else {
                setFormData(getInitialFormData('presets', 'mockup'));
            }
            setTagInput('');
            setError(null);
            setImageUploadError(null);
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
                    id: presetId
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.details || t('communityPresets.errors.failedToUploadImage'));
            }

            const { url } = await response.json();
            setFormData({ ...formData, referenceImageUrl: url });
            toast.success(t('communityPresets.messages.imageUploaded'));
        } catch (uploadError: any) {
            setImageUploadError(uploadError.message || t('communityPresets.errors.failedToUploadImage'));
            console.error('Error uploading image:', uploadError);
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleSubmit = async () => {
        const presetId = isCreating ? (formData.id || generateSlug(formData.name)) : formData.id;

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
            icon: config.icon
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

    const categoryIcon = CATEGORY_CONFIG[formData.category]?.icon || CATEGORY_CONFIG.presets.icon;
    const Icon = categoryIcon;

    // Determinar se precisa mostrar referenceImageUrl
    // Para categoria mockup OU para outras categorias (3d, aesthetics, themes)
    // Categorias antigas (angle, texture, ambience, luminance) não precisam de imagem
    const needsReferenceImage = formData.category === 'mockup'
        || (formData.category === 'presets' && formData.presetType === 'mockup')
        || (formData.category !== 'presets' && formData.category !== 'all' && !['angle', 'texture', 'ambience', 'luminance'].includes(formData.category));

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-10 bg-neutral-950/70 backdrop-blur-sm animate-fade-in"
            onClick={handleClose}
        >
            <div
                className="relative bg-neutral-900 border border-neutral-800/60 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/60">
                    <h2 className="text-lg font-semibold text-neutral-100">
                        {isCreating ? t('communityPresets.createPreset') : t('communityPresets.editPreset')}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <span>⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Image Upload Section */}
                        {needsReferenceImage && (
                            <div className="flex items-start gap-4 pb-5 border-b border-neutral-800/40">
                                {formData.referenceImageUrl ? (
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-neutral-700/50 bg-neutral-800 group flex-shrink-0">
                                        <img
                                            src={formData.referenceImageUrl}
                                            alt={t('communityPresets.referenceImageAlt')}
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData({ ...formData, referenceImageUrl: '' });
                                                setImageUploadError(null);
                                            }}
                                            className="absolute inset-0 bg-neutral-950/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-4 w-4 text-white" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-lg border border-neutral-700/50 bg-neutral-800/50 flex items-center justify-center flex-shrink-0">
                                        <ImageIcon className="h-6 w-6 text-neutral-500" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-neutral-200 mb-1">{t('communityPresets.referenceImage')}</p>
                                    <p className="text-xs text-neutral-500 mb-2">Image should be below 4 mb</p>
                                    <div className="flex items-center gap-2">
                                        <AdminImageUploader
                                            onImageUpload={handleImageUpload}
                                            disabled={isUploadingImage || !formData.name || formData.name.trim() === ''}
                                        />
                                        {formData.referenceImageUrl && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, referenceImageUrl: '' });
                                                    setImageUploadError(null);
                                                }}
                                                className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-neutral-300 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                    {isUploadingImage && (
                                        <div className="flex items-center gap-2 text-xs text-brand-cyan mt-2">
                                            <GlitchLoader size={12} />
                                            <span>{t('communityPresets.uploadingImage')}</span>
                                        </div>
                                    )}
                                    {imageUploadError && (
                                        <p className="text-xs text-red-400 mt-2">{imageUploadError}</p>
                                    )}
                                    {(!formData.name || formData.name.trim() === '') && (
                                        <p className="text-xs text-neutral-500 mt-2">{t('communityPresets.enterPresetNameFirst')}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Name Field */}
                        <div>
                            <label className="block text-xs text-neutral-400 mb-1.5">{t('communityPresets.nameRequired')} *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
                                placeholder="Enter preset name"
                            />
                            {isCreating && formData.id && (
                                <p className="text-xs text-neutral-500 mt-1.5">
                                    {t('communityPresets.autoGeneratedId')}: <span className="text-brand-cyan">{formData.id}</span>
                                </p>
                            )}
                        </div>

                        {/* Category & Preset Type Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative z-[60]">
                                <label className="block text-xs text-neutral-400 mb-1.5">{t('communityPresets.category')} *</label>
                                <Select
                                    options={categoryOptions.map(opt => ({ value: opt.value, label: opt.label }))}
                                    value={formData.category}
                                    onChange={(value) => {
                                        const newCategory = value as PromptCategory;
                                        setFormData({
                                            ...formData,
                                            category: newCategory,
                                            presetType: newCategory === 'presets' ? (formData.presetType || 'mockup') : undefined,
                                        });
                                    }}
                                    disabled={!isCreating}
                                    placeholder={t('communityPresets.category')}
                                />
                            </div>
                            {formData.category === 'presets' && (
                                <div className="relative z-[60]">
                                    <label className="block text-xs text-neutral-400 mb-1.5">{t('communityPresets.presetType')} *</label>
                                    <Select
                                        options={presetTypeOptions}
                                        value={formData.presetType || 'mockup'}
                                        onChange={(value) => setFormData({ ...formData, presetType: value as LegacyPresetType })}
                                        disabled={!isCreating}
                                        placeholder={t('communityPresets.presetType')}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Description & Aspect Ratio Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-neutral-400 mb-1.5">{t('communityPresets.descriptionOptional')}</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
                                    placeholder={t('communityPresets.descriptionPlaceholder')}
                                />
                            </div>
                            <div className="relative z-[50]">
                                <label className="block text-xs text-neutral-400 mb-1.5">{t('communityPresets.aspectRatioOptional')}</label>
                                <Select
                                    options={aspectRatioOptions}
                                    value={formData.aspectRatio}
                                    onChange={(value) => setFormData({ ...formData, aspectRatio: value as AspectRatio })}
                                    placeholder={t('communityPresets.aspectRatioPlaceholder')}
                                />
                            </div>
                        </div>

                        {/* Reference Image URL (manual) */}
                        {needsReferenceImage && (
                            <div>
                                <label className="block text-xs text-neutral-400 mb-1.5">{t('communityPresets.referenceImageManual')}</label>
                                <input
                                    type="text"
                                    value={formData.referenceImageUrl || ''}
                                    onChange={(e) => {
                                        setFormData({ ...formData, referenceImageUrl: e.target.value });
                                        setImageUploadError(null);
                                    }}
                                    className="w-full px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
                                    placeholder={t('communityPresets.referenceImageUrlPlaceholder')}
                                />
                            </div>
                        )}

                        {/* Prompt */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs text-neutral-400">{t('communityPresets.promptRequired')} *</label>
                                <span className="text-xs text-neutral-500">{formData.prompt.length} chars</span>
                            </div>
                            <textarea
                                value={formData.prompt}
                                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                                rows={4}
                                className="w-full px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors resize-none"
                                placeholder={t('communityPresets.describeWhatToGenerate')}
                            />
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="block text-xs text-neutral-400 mb-1.5">{t('communityPresets.tags.label')}</label>
                            <div className="flex gap-2">
                                <input
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
                                    className="flex-1 px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
                                />
                                <button
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
                                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-300 text-sm transition-colors"
                                >
                                    {t('communityPresets.tags.add')}
                                </button>
                            </div>
                            {formData.tags && formData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {formData.tags.map((tag, index) => (
                                        <span
                                            key={index}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800/70 border border-neutral-700/50 rounded-md text-xs text-neutral-300"
                                        >
                                            <span className="text-neutral-500">#</span>
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData({
                                                        ...formData,
                                                        tags: formData.tags?.filter((_, i) => i !== index) || [],
                                                    });
                                                }}
                                                className="text-neutral-500 hover:text-red-400 transition-colors ml-0.5"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-800/60 bg-neutral-900/50">
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="px-4 py-2 bg-transparent hover:bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-sm transition-colors disabled:opacity-50"
                    >
                        {t('communityPresets.actions.cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !formData.name || !formData.prompt}
                        className="px-5 py-2 bg-brand-cyan hover:bg-brand-cyan/90 text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <GlitchLoader size={14} />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <span>{t('communityPresets.actions.save')}</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
