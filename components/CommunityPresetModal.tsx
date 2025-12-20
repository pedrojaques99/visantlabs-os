import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '../hooks/useTranslation';
import { Select } from './ui/select';
import { AdminImageUploader } from './ui/AdminImageUploader';
import type { UploadedImage, AspectRatio, GeminiModel } from '../types';
import { authService } from '../services/authService';
import { cn } from '../lib/utils';

type PresetType = 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance';

interface PresetFormData {
    presetType: PresetType;
    id: string;
    name: string;
    description: string;
    prompt: string;
    referenceImageUrl: string;
    aspectRatio: AspectRatio;
    model?: GeminiModel;
    tags?: string[];
}

interface CommunityPresetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: PresetFormData) => Promise<void>;
    initialData?: Partial<PresetFormData>;
    isCreating: boolean;
}

const COMMUNITY_API = '/api/community-presets';

// Helper function to generate slug from text
const generateSlug = (text: string): string => {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

const getInitialFormData = (presetType: PresetType): PresetFormData => ({
    presetType,
    id: '',
    name: '',
    description: '',
    prompt: '',
    referenceImageUrl: '',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
    tags: [],
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
        initialData ? { ...getInitialFormData('mockup'), ...initialData } : getInitialFormData('mockup')
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
                setFormData({ ...getInitialFormData('mockup'), ...initialData });
            } else {
                setFormData(getInitialFormData('mockup'));
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
        setFormData(getInitialFormData('mockup'));
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

            const response = await fetch(`${COMMUNITY_API}/${presetId}/upload-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ base64Image: image.base64 }),
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

    const presetIcon = {
        mockup: ImageIcon,
        angle: ImageIcon,
        texture: ImageIcon,
        ambience: ImageIcon,
        luminance: ImageIcon,
    }[formData.presetType];

    const Icon = presetIcon;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
            onClick={handleClose}
        >
            <div
                className="relative bg-gradient-to-br from-[#1A1A1A] via-[#1A1A1A] to-[#1F1F1F] border border-zinc-800/60 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(82, 221, 235, 0.03), transparent 50%)',
                }}
            >
                {/* Header */}
                <div className="relative flex items-center justify-between p-6 border-b border-zinc-800/60 bg-zinc-900/20 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-cyan/10 rounded-lg">
                            <Icon className="h-5 w-5 text-brand-cyan" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-zinc-200 font-mono">
                                {isCreating ? t('communityPresets.createPreset') : t('communityPresets.editPreset')}
                            </h2>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5">
                                {isCreating ? 'Create a new community preset' : 'Edit your community preset'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-all hover:scale-110 active:scale-95"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 font-mono text-sm animate-slide-down">
                            <span>⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-6">
                        {/* Preset Type */}
                        <div className="relative z-10">
                            <div className="absolute inset-0 bg-gradient-to-r from-brand-cyan/5 to-transparent rounded-xl blur-xl"></div>
                            <div className="relative bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700/60 transition-all">
                                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono mb-3 uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan"></span>
                                    {t('communityPresets.presetType')}
                                </label>
                                <Select
                                    options={presetTypeOptions}
                                    value={formData.presetType}
                                    onChange={(value) => setFormData({ ...formData, presetType: value as PresetType })}
                                    disabled={!isCreating}
                                    placeholder={t('communityPresets.presetType')}
                                />
                                {!isCreating && (
                                    <p className="text-xs text-zinc-500 font-mono mt-2 flex items-center gap-1.5">
                                        <span>🔒</span>
                                        <span>{t('communityPresets.typeCannotBeChanged')}</span>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Name & ID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {!isCreating && (
                                <div className="group bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700/60 transition-all">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono mb-3 uppercase tracking-wider">
                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                        {t('communityPresets.presetId')}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.id}
                                        disabled
                                        className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/40 rounded-lg text-zinc-200 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <p className="text-xs text-zinc-500 font-mono mt-2 flex items-center gap-1.5">
                                        <span>🔒</span>
                                        <span>{t('communityPresets.presetIdDisabled')}</span>
                                    </p>
                                </div>
                            )}

                            <div className={cn(
                                "group bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700/60 transition-all",
                                isCreating && "md:col-span-2"
                            )}>
                                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono mb-3 uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                    {t('communityPresets.nameRequired')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/40 rounded-lg text-zinc-200 font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-2 focus:ring-brand-cyan/10 focus:bg-zinc-900/80 transition-all"
                                    placeholder={t('communityPresets.nameRequired')}
                                />
                                {isCreating && formData.id && (
                                    <p className="text-xs text-zinc-500 font-mono mt-2 flex items-center gap-1.5">
                                        <span>✨</span>
                                        <span>{t('communityPresets.autoGeneratedId')}: <span className="text-brand-cyan">{formData.id}</span></span>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Description & Aspect Ratio */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="group bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700/60 transition-all">
                                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono mb-3 uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                    {t('communityPresets.descriptionOptional')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/40 rounded-lg text-zinc-200 font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-2 focus:ring-brand-cyan/10 focus:bg-zinc-900/80 transition-all"
                                    placeholder={t('communityPresets.descriptionPlaceholder')}
                                />
                            </div>

                            <div className="relative z-10 bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700/60 transition-all">
                                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono mb-3 uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                    {t('communityPresets.aspectRatioOptional')}
                                </label>
                                <Select
                                    options={aspectRatioOptions}
                                    value={formData.aspectRatio}
                                    onChange={(value) => setFormData({ ...formData, aspectRatio: value as AspectRatio })}
                                    placeholder={t('communityPresets.aspectRatioPlaceholder')}
                                />
                            </div>
                        </div>

                        {/* Prompt */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 via-transparent to-transparent rounded-xl blur-xl"></div>
                            <div className="relative group bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700/60 transition-all">
                                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono mb-3 uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan"></span>
                                    {t('communityPresets.promptRequired')}
                                </label>
                                <textarea
                                    value={formData.prompt}
                                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                                    rows={6}
                                    className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/40 rounded-lg text-zinc-200 font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-2 focus:ring-brand-cyan/10 focus:bg-zinc-900/80 resize-none transition-all leading-relaxed"
                                    placeholder={t('communityPresets.promptRequired')}
                                />
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-xs text-zinc-500 font-mono">{t('communityPresets.describeWhatToGenerate')}</p>
                                    <p className="text-xs text-zinc-600 font-mono">{formData.prompt.length} chars</p>
                                </div>
                            </div>
                        </div>

                        {/* Image Upload (Mockup only) */}
                        {formData.presetType === 'mockup' && (
                            <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-xl p-5 space-y-4 hover:border-zinc-700/60 transition-all">
                                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                    {t('communityPresets.referenceImage')}
                                </label>
                                {!formData.referenceImageUrl ? (
                                    <div className="space-y-3">
                                        <AdminImageUploader
                                            onImageUpload={handleImageUpload}
                                            disabled={isUploadingImage || !formData.name || formData.name.trim() === ''}
                                        />
                                        {isUploadingImage && (
                                            <div className="flex items-center gap-2 text-sm text-brand-cyan font-mono">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>{t('communityPresets.uploadingImage')}</span>
                                            </div>
                                        )}
                                        {imageUploadError && (
                                            <p className="text-sm text-red-400 font-mono flex items-center gap-2">
                                                <span>⚠</span>
                                                <span>{imageUploadError}</span>
                                            </p>
                                        )}
                                        {(!formData.name || formData.name.trim() === '') && (
                                            <p className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                                                <span>ℹ️</span>
                                                <span>{t('communityPresets.enterPresetNameFirst')}</span>
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="relative rounded-lg overflow-hidden border border-zinc-700/40 bg-zinc-900/60 group">
                                            <img
                                                src={formData.referenceImageUrl}
                                                alt={t('communityPresets.referenceImageAlt')}
                                                className="w-full max-h-64 object-contain"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, referenceImageUrl: '' });
                                                    setImageUploadError(null);
                                                }}
                                                className="absolute top-3 right-3 p-2 bg-zinc-900/95 hover:bg-red-500/20 hover:border-red-500/50 border border-zinc-700/50 text-zinc-300 hover:text-red-400 rounded-lg transition-all shadow-lg opacity-0 group-hover:opacity-100"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono mb-3 uppercase tracking-wider">
                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                        {t('communityPresets.referenceImageManual')}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.referenceImageUrl || ''}
                                        onChange={(e) => {
                                            setFormData({ ...formData, referenceImageUrl: e.target.value });
                                            setImageUploadError(null);
                                        }}
                                        className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/40 rounded-lg text-zinc-200 font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-2 focus:ring-brand-cyan/10 focus:bg-zinc-900/80 transition-all"
                                        placeholder={t('communityPresets.referenceImageUrlPlaceholder')}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Tags */}
                        <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700/60 transition-all">
                            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 font-mono mb-3 uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                {t('communityPresets.tags.label')}
                            </label>
                            <div className="space-y-3">
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
                                        className="flex-1 px-4 py-3 bg-zinc-900/60 border border-zinc-700/40 rounded-lg text-zinc-200 font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-2 focus:ring-brand-cyan/10 focus:bg-zinc-900/80 transition-all"
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
                                        className="px-5 py-3 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 rounded-lg text-zinc-300 font-mono text-sm transition-all font-medium hover:scale-105 active:scale-95"
                                    >
                                        {t('communityPresets.tags.add')}
                                    </button>
                                </div>
                                {formData.tags && formData.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {formData.tags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="group inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-950/70 border border-zinc-700/50 rounded-lg text-xs text-zinc-200 font-mono hover:border-brand-cyan/40 hover:bg-zinc-900/70 transition-all"
                                            >
                                                <span className="text-brand-cyan/60">#</span>
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({
                                                            ...formData,
                                                            tags: formData.tags?.filter((_, i) => i !== index) || [],
                                                        });
                                                    }}
                                                    className="text-zinc-500 hover:text-red-400 transition-colors hover:scale-110"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-zinc-600 font-mono">{t('communityPresets.pressEnterToAddTags')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-800/60 bg-zinc-900/20 backdrop-blur-sm flex gap-3">
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="px-6 py-3 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 rounded-lg text-zinc-300 font-mono text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t('communityPresets.actions.cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !formData.name || !formData.prompt}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-brand-cyan to-brand-cyan/90 hover:from-brand-cyan/90 hover:to-brand-cyan text-black font-semibold rounded-lg text-sm font-mono transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-cyan/20 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                <span>{t('communityPresets.actions.save')}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
