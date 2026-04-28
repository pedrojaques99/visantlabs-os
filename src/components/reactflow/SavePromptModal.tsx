import React, { useState, useEffect } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { X, Diamond, Globe, Lock } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { toast } from 'sonner';
import { authService } from '@/services/authService';
import { clearCommunityPresetsCache } from '@/services/communityPresetsService';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

import { useTranslation } from '@/hooks/useTranslation';

interface SavePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    prompt: string;
    initialData?: {
        name?: string;
        description?: string;
    };
}

export const SavePromptModal: React.FC<SavePromptModalProps> = ({
    isOpen,
    onClose,
    prompt,
    initialData,
}) => {
    useScrollLock(isOpen);
    const { t } = useTranslation();
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [isPublic, setIsPublic] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
            setDescription(initialData?.description || '');
            setIsPublic(false);
            setTags([]);
            setTagInput('');
            setError(null);
        }
    }, [isOpen, initialData]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const generateSlug = (text: string): string => {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError(t('canvasNodes.savePromptModal.errorMandatoryName') || 'Name is mandatory');
            return;
        }

        const token = authService.getToken();
        if (!token) {
            toast.error(t('canvasNodes.savePromptModal.errorNotAuthenticated') || 'You need to be authenticated to save a prompt');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const id = generateSlug(name) + '-' + Date.now();
            // Garantir que description nunca seja vazia (backend exige esse campo)
            const finalDescription = description.trim() || `Prompt: ${name}`;
            const body = {
                id,
                name: name.trim(),
                description: finalDescription,
                prompt,
                isPublic,
                category: 'presets',
                presetType: 'mockup', // Default to mockup for prompts
                aspectRatio: '16:9',
                tags: tags.length > 0 ? tags : undefined,
                isApproved: isPublic, // Se for público, já marca como aprovado para aparecer na comunidade
            };

            const response = await fetch('/api/community/presets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || t('canvasNodes.savePromptModal.errorSaving') || 'Error saving prompt');
            }

            clearCommunityPresetsCache();
            toast.success(t('canvasNodes.savePromptModal.success') || 'Prompt saved successfully!');
            onClose();
        } catch (err: any) {
            setError(err.message);
            console.error('Error saving prompt:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const addTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                className="relative bg-neutral-900 border-node border-neutral-800/60 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/60">
                    <h2 className="text-lg font-semibold text-neutral-100">{t('canvasNodes.savePromptModal.title') || 'Save Prompt'}</h2>
                    <Button variant="ghost"
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                        <X size={18} />
                    </Button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 flex-1 overflow-y-auto max-h-[70vh]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border-node border-red-500/30 rounded-md text-red-400 text-sm flex items-center gap-2">
                            <span>⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Name */}
                        <div>
                            <label className="block text-xs text-neutral-400 mb-1.5">{t('canvasNodes.savePromptModal.name') || 'Prompt Name *'}</label>
                            <Input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('canvasNodes.savePromptModal.namePlaceholder') || "Ex: Minimalist Interior Design"}
                                autoFocus
                                className="w-full px-3 py-2.5 bg-neutral-800/50 border-node border-neutral-700/50 rounded-md text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs text-neutral-400 mb-1.5">{t('canvasNodes.savePromptModal.description') || 'Description (optional)'}</label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('canvasNodes.savePromptModal.descriptionPlaceholder') || "A brief description of what this prompt does..."}
                                rows={2}
                                className="w-full px-3 py-2.5 bg-neutral-800/50 border-node border-neutral-700/50 rounded-md text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors resize-none"
                            />
                        </div>

                        {/* Privacy */}
                        <div>
                            <label className="block text-xs text-neutral-400 mb-2">{t('canvasNodes.savePromptModal.privacy') || 'Privacy'}</label>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="ghost"
                                    onClick={() => setIsPublic(false)}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-md border transition-all text-left",
                                        !isPublic
                                            ? "bg-neutral-800/60 border-neutral-600 text-neutral-200"
                                            : "bg-transparent border-neutral-700/50 text-neutral-500 hover:border-neutral-600 hover:bg-neutral-800/30"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Lock size={14} className={!isPublic ? "text-brand-cyan" : ""} />
                                        <span className="text-sm font-medium">{t('canvasNodes.savePromptModal.private') || 'Private'}</span>
                                    </div>
                                    <p className="text-[10px] opacity-70 leading-relaxed">{t('canvasNodes.savePromptModal.privateHint') || 'Only you can see and use'}</p>
                                </Button>

                                <Button variant="ghost"
                                    onClick={() => setIsPublic(true)}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-md border transition-all text-left",
                                        isPublic
                                            ? "bg-brand-cyan/10 border-neutral-800 text-brand-cyan"
                                            : "bg-transparent border-neutral-700/50 text-neutral-500 hover:border-neutral-600 hover:bg-neutral-800/30"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Globe size={14} className={isPublic ? "text-brand-cyan" : ""} />
                                        <span className="text-sm font-medium">{t('canvasNodes.savePromptModal.public') || 'Public'}</span>
                                    </div>
                                    <p className="text-[10px] opacity-70 leading-relaxed">{t('canvasNodes.savePromptModal.publicHint') || 'Share with the community'}</p>
                                </Button>
                            </div>
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="block text-xs text-neutral-400 mb-1.5">{t('canvasNodes.savePromptModal.tags') || 'Tags'}</label>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addTag();
                                        }
                                    }}
                                    placeholder={t('canvasNodes.savePromptModal.tagsPlaceholder') || "modern, architecture..."}
                                    className="flex-1 px-3 py-2.5 bg-neutral-800/50 border-node border-neutral-700/50 rounded-md text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
                                />
                                <Button variant="outline"
                                    onClick={addTag}
                                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border-node border-neutral-700 rounded-md text-neutral-300 text-sm transition-colors"
                                >
                                    {t('canvasNodes.savePromptModal.add') || 'Add'}
                                </Button>
                            </div>
                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800/70 border-node border-neutral-700/50 rounded-md text-xs text-neutral-300"
                                        >
                                            <span className="text-neutral-500">#</span>
                                            {tag}
                                            <Button variant="ghost"
                                                onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                                                className="text-neutral-500 hover:text-red-400 transition-colors ml-0.5"
                                            >
                                                <X size={12} />
                                            </Button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Prompt Preview */}
                        <div className="pt-4 border-t border-neutral-800/50">
                            <label className="block text-xs text-neutral-400 mb-1.5">{t('canvasNodes.savePromptModal.promptPreview') || 'Prompt Preview'}</label>
                            <div className="p-3 bg-neutral-950/50 border-node border-neutral-800/50 rounded-md max-h-28 overflow-y-auto">
                                <p className="text-xs text-neutral-400 whitespace-pre-wrap leading-relaxed">
                                    {prompt}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-800/60 bg-neutral-900/50">
                    <Button variant="outline"
                        onClick={onClose}
                        className="px-4 py-2 bg-transparent hover:bg-neutral-800 border-node border-neutral-700 rounded-md text-neutral-300 text-sm transition-colors"
                    >
                        {t('common.cancel') || 'Cancel'}
                    </Button>
                    <Button variant="brand"
                        onClick={handleSave}
                        disabled={isLoading || !name.trim()}
                        className="px-5 py-2 bg-brand-cyan hover:bg-brand-cyan/90 text-black font-medium rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <GlitchLoader size={14} color="black" />
                                <span>{t('canvasNodes.savePromptModal.saving') || 'Saving...'}</span>
                            </>
                        ) : (
                            <>
                                <Diamond size={14} />
                                <span>{t('canvasNodes.savePromptModal.save') || 'Save Prompt'}</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
