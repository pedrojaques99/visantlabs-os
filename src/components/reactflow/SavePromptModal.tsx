import React, { useState, useEffect } from 'react';
import { X, Sparkles, Globe, Lock } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { toast } from 'sonner';
import { authService } from '@/services/authService';
import { clearCommunityPresetsCache } from '@/services/communityPresetsService';
import { cn } from '@/lib/utils';

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
            setError('O nome é obrigatório');
            return;
        }

        const token = authService.getToken();
        if (!token) {
            toast.error('Você precisa estar autenticado para salvar um prompt');
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
                throw new Error(errorData.error || 'Erro ao salvar o prompt');
            }

            clearCommunityPresetsCache();
            toast.success('Prompt salvo com sucesso!');
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
                className="relative bg-neutral-900 border border-neutral-800/60 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/60">
                    <h2 className="text-lg font-semibold text-neutral-100">Salvar Prompt</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 flex-1 overflow-y-auto max-h-[70vh]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                            <span>⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Name */}
                        <div>
                            <label className="block text-xs text-neutral-400 mb-1.5">Nome do Prompt *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Minimalist Interior Design"
                                autoFocus
                                className="w-full px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs text-neutral-400 mb-1.5">Descrição (opcional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Uma breve descrição sobre o que esse prompt faz..."
                                rows={2}
                                className="w-full px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors resize-none"
                            />
                        </div>

                        {/* Privacy */}
                        <div>
                            <label className="block text-xs text-neutral-400 mb-2">Privacidade</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setIsPublic(false)}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-lg border transition-all text-left",
                                        !isPublic
                                            ? "bg-neutral-800/60 border-neutral-600 text-neutral-200"
                                            : "bg-transparent border-neutral-700/50 text-neutral-500 hover:border-neutral-600 hover:bg-neutral-800/30"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Lock size={14} className={!isPublic ? "text-brand-cyan" : ""} />
                                        <span className="text-sm font-medium">Privado</span>
                                    </div>
                                    <p className="text-[10px] opacity-70 leading-relaxed">Apenas você poderá ver e usar</p>
                                </button>

                                <button
                                    onClick={() => setIsPublic(true)}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-lg border transition-all text-left",
                                        isPublic
                                            ? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan"
                                            : "bg-transparent border-neutral-700/50 text-neutral-500 hover:border-neutral-600 hover:bg-neutral-800/30"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Globe size={14} className={isPublic ? "text-brand-cyan" : ""} />
                                        <span className="text-sm font-medium">Público</span>
                                    </div>
                                    <p className="text-[10px] opacity-70 leading-relaxed">Compartilhe com a comunidade</p>
                                </button>
                            </div>
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="block text-xs text-neutral-400 mb-1.5">Tags</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addTag();
                                        }
                                    }}
                                    placeholder="moderno, arquitetura..."
                                    className="flex-1 px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-neutral-200 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
                                />
                                <button
                                    onClick={addTag}
                                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-300 text-sm transition-colors"
                                >
                                    Add
                                </button>
                            </div>
                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800/70 border border-neutral-700/50 rounded-md text-xs text-neutral-300"
                                        >
                                            <span className="text-neutral-500">#</span>
                                            {tag}
                                            <button
                                                onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                                                className="text-neutral-500 hover:text-red-400 transition-colors ml-0.5"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Prompt Preview */}
                        <div className="pt-4 border-t border-neutral-800/50">
                            <label className="block text-xs text-neutral-400 mb-1.5">Visualização do Prompt</label>
                            <div className="p-3 bg-neutral-950/50 border border-neutral-800/50 rounded-lg max-h-28 overflow-y-auto">
                                <p className="text-xs text-neutral-400 whitespace-pre-wrap leading-relaxed">
                                    {prompt}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-800/60 bg-neutral-900/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-transparent hover:bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-sm transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || !name.trim()}
                        className="px-5 py-2 bg-brand-cyan hover:bg-brand-cyan/90 text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <GlitchLoader size={14} color="black" />
                                <span>Salvando...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={14} />
                                <span>Salvar Prompt</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
