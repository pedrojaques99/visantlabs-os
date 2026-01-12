import React, { useState, useEffect } from 'react';
import { X, Save, Sparkles, Globe, Lock } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';
import { FormField } from '../ui/form-field';
import { FormInput } from '../ui/form-input';
import { FormTextarea } from '../ui/form-textarea';
import { authService } from '../../services/authService';
import { clearCommunityPresetsCache } from '../../services/communityPresetsService';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
            onClick={onClose}
        >
            <div
                className="relative bg-zinc-900 border border-zinc-800/60 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800/60 bg-zinc-900/20 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-brand-cyan/10 rounded-lg border border-brand-cyan/20">
                            <Save className="h-5 w-5 text-brand-cyan" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-200 font-manrope tracking-tight">Salvar Prompt</h2>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5">Salve seu prompt para reutilizar ou compartilhar</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-all hover:scale-110 active:scale-95"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[70vh]">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm font-mono flex items-center gap-2">
                            <span className="shrink-0">⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <FormField label="Nome do Prompt" required>
                            <FormInput
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Minimalist Interior Design"
                                autoFocus
                            />
                        </FormField>

                        <FormField label="Descrição (opcional)">
                            <FormTextarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Uma breve descrição sobre o que esse prompt faz..."
                                rows={3}
                            />
                        </FormField>

                        <div className="pt-2">
                            <label className="text-xs font-semibold text-zinc-400 font-mono mb-3 uppercase tracking-wider block">
                                Privacidade
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setIsPublic(false)}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-xl border transition-all text-left group",
                                        !isPublic
                                            ? "bg-zinc-800/50 border-zinc-700 text-zinc-200"
                                            : "bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800/20"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Lock size={14} className={!isPublic ? "text-brand-cyan" : ""} />
                                        <span className="text-sm font-mono font-bold">Privado</span>
                                    </div>
                                    <p className="text-[10px] opacity-70 leading-relaxed font-mono">Apenas você poderá ver e usar este prompt na sua biblioteca.</p>
                                </button>

                                <button
                                    onClick={() => setIsPublic(true)}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-xl border transition-all text-left group",
                                        isPublic
                                            ? "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan"
                                            : "bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800/20"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Globe size={14} className={isPublic ? "text-brand-cyan" : ""} />
                                        <span className="text-sm font-mono font-bold">Público</span>
                                    </div>
                                    <p className="text-[10px] opacity-70 leading-relaxed font-mono">Compartilhe com a comunidade na página explorar.</p>
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">
                                Tags
                            </label>
                            <div className="flex gap-2">
                                <FormInput
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addTag();
                                        }
                                    }}
                                    placeholder="moderno, arquitetura..."
                                    className="flex-1 bg-zinc-900/50 border-zinc-800 focus:border-brand-cyan/30"
                                />
                                <Button
                                    variant="secondary"
                                    onClick={addTag}
                                    className="px-4 font-mono text-xs"
                                >
                                    Add
                                </Button>
                            </div>
                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3 ml-1">
                                    {tags.map((tag, idx) => (
                                        <Badge
                                            key={idx}
                                            variant="outline"
                                            className="px-2 py-0.5 bg-zinc-800/40 border border-zinc-700/30 text-[10px] text-zinc-400 font-mono gap-1.5 group"
                                        >
                                            #{tag}
                                            <button
                                                onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                                                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                                            >
                                                <X size={10} />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-zinc-800">
                            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 block">Visualização do Prompt</label>
                            <div className="p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg max-h-32 overflow-y-auto">
                                <p className="text-xs text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
                                    {prompt}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-800/60 bg-zinc-900/20 backdrop-blur-sm flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1 font-mono text-zinc-400 hover:text-zinc-200"
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="brand"
                        onClick={handleSave}
                        disabled={isLoading || !name.trim()}
                        className="flex-[1.5] font-mono shadow-lg shadow-brand-cyan/10"
                    >
                        {isLoading ? (
                            <>
                                <GlitchLoader size={16} color="black" className="mr-2" />
                                <span>Salvando...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} className="mr-2" />
                                <span>Salvar Prompt</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
