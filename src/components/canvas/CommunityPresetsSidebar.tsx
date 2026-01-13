import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Plus, Search, X, Loader2 } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { useNavigate } from 'react-router-dom';
import {
    Sheet,
    SheetContent,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { getPromptsByCategory, clearCommunityPresetsCache } from '@/services/communityPresetsService';
import { useTranslation } from '@/hooks/useTranslation';
import type { CommunityPrompt, PromptCategory, LegacyPresetType, AspectRatio, GeminiModel } from '@/types/communityPrompts';
import { migrateLegacyPreset } from '@/types/communityPrompts';
import { PresetCard, CATEGORY_CONFIG } from '@/components/PresetCard';
import { authService } from '@/services/authService';
import { CommunityPresetModal } from '@/components/CommunityPresetModal';
import { toast } from 'sonner';

const PROMPT_CATEGORIES = Object.keys(CATEGORY_CONFIG) as PromptCategory[];

// Type definitions for Modal Form Data
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

// Initial form data helper
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

interface CommunityPresetsSidebarProps {
    isOpen?: boolean; // Optional in embedded mode
    onClose?: () => void; // Optional in embedded mode
    onImportPreset: (preset: any, type: string) => void;
    variant?: 'sheet' | 'embedded';
}

export const CommunityPresetsSidebar: React.FC<CommunityPresetsSidebarProps> = ({
    isOpen = true,
    onClose,
    onImportPreset,
    variant = 'sheet',
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<PromptCategory>('all');
    const [viewMode, setViewMode] = useState<'all' | 'my'>('all');
    const [presets, setPresets] = useState<CommunityPrompt[]>([]); // For 'my' presets
    const [allPresets, setAllPresets] = useState<CommunityPrompt[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Editing State (reused from Page/Modal logic)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editingPreset, setEditingPreset] = useState<string | null>(null);
    const [formData, setFormData] = useState<PresetFormData>(getInitialFormData());

    // Check authentication
    useEffect(() => {
        const checkAuth = async () => {
            const token = authService.getToken();
            setIsAuthenticated(!!token);
            if (token) {
                const user = await authService.verifyToken();
                if (user) setCurrentUserId(user.id);
            }
        };
        checkAuth();
    }, []);

    // Fetch All Presets
    const handleFetchAllPresets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Use service instead of raw fetch if possible, but service 'getAllCommunityPresets' returns Record.
            // 'getPromptsByCategory("all")' returns unique array of all presets.
            const result = await getPromptsByCategory('all');
            setAllPresets(result);
        } catch (err: any) {
            console.error('Failed to load all presets:', err);
            setError(t('communityPresets.errors.failedToLoad') || 'Failed to load presets');
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    // Fetch My Presets
    const handleFetchMyPresets = useCallback(async () => {
        const token = authService.getToken();
        if (!token) {
            // Silently fail or just set empty if not auth (shouldn't happen if viewMode is my)
            setPresets([]);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/community/presets/my', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error(t('communityPresets.errors.failedToLoad'));

            const result = (await response.json()) as CommunityPrompt[];
            setPresets(result.map(migrateLegacyPreset));
        } catch (err: any) {
            console.error('Failed to load my presets:', err);
            setError(err.message || t('communityPresets.errors.failedToLoad'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    // Reload data when view mode or open state changes
    useEffect(() => {
        if (!isOpen) return;

        if (viewMode === 'my' && isAuthenticated) {
            handleFetchMyPresets();
        } else {
            handleFetchAllPresets(); // Reload even if 'all' to ensure fresh data
        }
    }, [isOpen, viewMode, isAuthenticated, handleFetchMyPresets, handleFetchAllPresets]);

    // Trigger initial load for embedded mode since it might always be "open" in DOM but hidden via CSS or parent
    useEffect(() => {
        if (variant === 'embedded') {
            if (viewMode === 'my' && isAuthenticated) {
                handleFetchMyPresets();
            } else {
                handleFetchAllPresets();
            }
        }
    }, [variant, viewMode, isAuthenticated]);

    // Derived filtered presets
    const filteredPresets = useMemo(() => {
        const sourcePresets = viewMode === 'my' ? presets : allPresets;
        let filtered = sourcePresets;

        // Filter by Category
        if (activeTab !== 'all') {
            if (activeTab === 'presets') {
                filtered = filtered.filter(p => p.category === 'presets');
            } else {
                filtered = filtered.filter(p => p.category === activeTab);
            }
        }

        // Filter by Search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(p => {
                const migrated = migrateLegacyPreset(p);
                const name = migrated.name?.toLowerCase() || '';
                const desc = migrated.description?.toLowerCase() || '';
                const prompt = migrated.prompt?.toLowerCase() || '';
                const tags = migrated.tags || [];

                return (
                    name.includes(query) ||
                    desc.includes(query) ||
                    prompt.includes(query) ||
                    tags.some(tag => tag && typeof tag === 'string' && tag.toLowerCase().includes(query))
                );
            });
        }

        return filtered;
    }, [presets, allPresets, activeTab, searchQuery, viewMode]);

    // --- Modal Handlers ---

    const handleCreate = () => {
        setIsCreating(true);
        setEditingPreset(null);
        const presetType = activeTab === 'presets' ? 'mockup' : undefined;
        setFormData(getInitialFormData(activeTab === 'all' ? 'presets' : activeTab, presetType));
        setIsEditModalOpen(true);
    };

    const handleEdit = (preset: CommunityPrompt) => {
        const migrated = migrateLegacyPreset(preset);
        setEditingPreset(migrated.id);
        setIsCreating(false);
        setFormData({
            category: migrated.category,
            presetType: migrated.presetType,
            id: migrated.id,
            name: migrated.name,
            description: migrated.description,
            prompt: migrated.prompt,
            referenceImageUrl: migrated.referenceImageUrl || '',
            aspectRatio: migrated.aspectRatio,
            model: migrated.model,
            tags: migrated.tags || [],
            useCase: migrated.useCase,
            examples: migrated.examples,
        });
        setIsEditModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        const token = authService.getToken();
        if (!token) return;

        if (!confirm(t('communityPresets.messages.presetDeleteConfirm'))) return;

        try {
            await fetch(`/api/community/presets/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            // Refresh
            if (viewMode === 'my') handleFetchMyPresets();
            else handleFetchAllPresets();

            clearCommunityPresetsCache();
            toast.success(t('communityPresets.messages.presetDeleted'));
        } catch (e) {
            toast.error(t('communityPresets.errors.failedToDelete'));
        }
    };

    const handleSave = async (data: PresetFormData) => {
        const token = authService.getToken();
        if (!token) throw new Error(t('communityPresets.errors.mustBeAuthenticated'));

        const url = isCreating ? '/api/community/presets' : `/api/community/presets/${editingPreset}`;
        const method = isCreating ? 'POST' : 'PUT';

        // Construct body compatible with API
        const body: any = { ...data };
        // Cleanup based on category
        if (data.category === 'presets' && data.presetType) {
            body.presetType = data.presetType;
        }
        // ... (Similar logic to page for body construction, simplified here as spread usually works if backend is robust, but let's be safe)

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error('Failed to save');

        if (viewMode === 'my') await handleFetchMyPresets();
        else await handleFetchAllPresets();

        // Auto-import after save for "smart import" experience
        if (onImportPreset) {
            onImportPreset(data as any, data.category);
        }

        clearCommunityPresetsCache();
        toast.success(isCreating ? t('communityPresets.messages.presetCreated') : t('communityPresets.messages.presetUpdated'));
    };

    const handleToggleLike = async (presetId: string) => {
        const token = authService.getToken();
        if (!token) {
            toast.error(t('communityPresets.errors.mustBeAuthenticated'));
            return;
        }

        // Optimistic update
        const toggleLikeInList = (list: CommunityPrompt[]) => list.map(p => {
            if (p.id === presetId) {
                const isLiked = p.isLikedByUser;
                return { ...p, isLikedByUser: !isLiked, likesCount: (p.likesCount || 0) + (isLiked ? -1 : 1) };
            }
            return p;
        });

        setAllPresets(toggleLikeInList);
        setPresets(toggleLikeInList);

        try {
            await fetch(`/api/community/presets/${presetId}/like`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            // In background re-fetch could happen or we trust optimistic
        } catch (e) {
            // Revert if needed, simply reload list
            if (viewMode === 'my') handleFetchMyPresets();
            else handleFetchAllPresets();
        }
    };

    // --- Render Content ---

    const content = (
        <div className={cn("flex flex-col h-full bg-[#121212]", variant === 'embedded' ? "bg-transparent" : "")}>
            {/* Header Area */}
            <div className={cn(
                "flex-shrink-0 space-y-4 p-4",
                variant === 'sheet' ? "border-b border-zinc-800/50" : ""
            )}>
                {variant === 'sheet' && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Users className="h-5 w-5 text-brand-cyan" />
                            <h2 className="text-zinc-200 font-semibold">{t('communityPresets.title')}</h2>
                        </div>
                    </div>
                )}

                {/* View Mode & Create */}
                <div className="flex items-center gap-2">
                    <div className="flex p-1 rounded-lg bg-zinc-900 border border-zinc-800/50 flex-1">
                        <button
                            onClick={() => setViewMode('all')}
                            className={cn(
                                "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                viewMode === 'all'
                                    ? "bg-zinc-800 text-zinc-200 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {t('communityPresets.allPresets')}
                        </button>
                        <button
                            onClick={() => setViewMode('my')}
                            className={cn(
                                "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                viewMode === 'my'
                                    ? "bg-zinc-800 text-zinc-200 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {t('communityPresets.myPresets')}
                        </button>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="p-2 rounded-lg bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30 border border-brand-cyan/30 transition-colors"
                        title={t('communityPresets.createNew')}
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('communityPresets.searchPlaceholder') || "Search presets..."}
                        className="w-full pl-9 pr-4 py-2 bg-zinc-900/50 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-brand-cyan/50"
                    />
                </div>

                {/* Categories Tabs */}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {PROMPT_CATEGORIES.map((category) => {
                        const config = CATEGORY_CONFIG[category];
                        const Icon = config.icon;
                        const isActive = activeTab === category;

                        return (
                            <button
                                key={category}
                                onClick={() => setActiveTab(category)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-mono whitespace-nowrap transition-all",
                                    isActive
                                        ? "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan"
                                        : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                                )}
                            >
                                <Icon size={12} />
                                {t(`communityPresets.categories.${category}`) || config.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 pt-0">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <GlitchLoader size={24} color="brand-cyan" />
                    </div>
                ) : error ? (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                        {error}
                    </div>
                ) : filteredPresets.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 text-xs">
                        {t('communityPresets.noPresets')}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {filteredPresets.map(preset => (
                            <PresetCard
                                key={preset.id}
                                preset={preset}
                                isAuthenticated={isAuthenticated}
                                canEdit={preset.userId === currentUserId}
                                t={t}
                                onEdit={() => handleEdit(preset)}
                                onDelete={() => handleDelete(preset.id)}
                                onToggleLike={() => handleToggleLike(preset.id)}
                                onClick={() => {
                                    if (onImportPreset) {
                                        // Pass the raw preset object or migrated one
                                        onImportPreset(migrateLegacyPreset(preset), activeTab === 'all' ? preset.category : activeTab);
                                        if (onClose) onClose();
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Edit/Create Modal (Rendered outside portal/sheet scope usually, ensuring it's on top) */}
            <CommunityPresetModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSave}
                initialData={formData}
                isCreating={isCreating}
            />
        </div>
    );

    if (variant === 'sheet') {
        return (
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent side="right" className="w-full sm:max-w-md p-0 bg-[#121212] border-zinc-800">
                    {content}
                </SheetContent>
            </Sheet>
        );
    }

    return content;
};
