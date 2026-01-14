import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Users, Plus, Edit2, Trash2, X, Save, Image as ImageIcon, Camera, Layers, MapPin, Sun, Heart, Maximize2, ExternalLink, Copy, Globe, User, LayoutGrid, Box, Settings, Palette, Sparkles, Download, Search } from 'lucide-react';

import { GridDotsBackground } from '../components/ui/GridDotsBackground';

import {
  BreadcrumbWithBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/BreadcrumbWithBack";
import { useLayout } from '@/hooks/useLayout';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import type { AspectRatio, GeminiModel, UploadedImage } from '../types/types';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '../lib/utils';
import { AuthModal } from '../components/AuthModal';
import { Select } from '../components/ui/select';
import { getAllCommunityPresets, clearCommunityPresetsCache } from '../services/communityPresetsService';
import { CommunityPresetModal } from '../components/CommunityPresetModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { CommunityPresetsSidebar } from '../components/CommunityPresetsSidebar';
import { PresetCard, CATEGORY_CONFIG } from '../components/PresetCard';
import type { PromptCategory, LegacyPresetType, CommunityPrompt } from '../types/communityPrompts';
import { migrateLegacyPreset } from '../types/communityPrompts';

// Constants
const COMMUNITY_API = '/api/community/presets';
const PRESET_TYPES = ['all', 'mockup', 'angle', 'texture', 'ambience', 'luminance'] as const;
const PROMPT_CATEGORIES = Object.keys(CATEGORY_CONFIG) as PromptCategory[];

// Types - manter compatibilidade
type PresetType = 'all' | 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance';

interface PresetFormData {
  category: PromptCategory;
  presetType?: LegacyPresetType;
  id: string;
  name: string;
  description: string;
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  context?: 'canvas' | 'mockup' | 'branding' | 'general';
  useCase?: string;
  examples?: string[];
}

// Usar CommunityPrompt do tipo importado
type CommunityPreset = CommunityPrompt;




const getPresetIcon = (type: PresetType | PromptCategory) => {
  // Usa CATEGORY_CONFIG para todas as categorias
  const Icon = CATEGORY_CONFIG[type as PromptCategory]?.icon || LayoutGrid;
  return <Icon size={20} />;
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
  difficulty: 'intermediate',
  context: 'general',
});

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substring(2, 7);
};

export const CommunityPresetsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated: isUserAuthenticated, isCheckingAuth } = useLayout();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [presets, setPresets] = useState<CommunityPreset[]>([]);
  const [activeTab, setActiveTab] = useState<PromptCategory>(() => {
    const typeParam = searchParams.get('type');
    if (typeParam && PROMPT_CATEGORIES.includes(typeParam as PromptCategory)) {
      return typeParam as PromptCategory;
    }
    // Compatibilidade: se for presetType antigo, mapear para 'presets'
    if (typeParam && PRESET_TYPES.includes(typeParam as any)) {
      return 'presets';
    }
    return 'all';
  });
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<PresetFormData>({
    category: 'presets',
    presetType: 'mockup',
    id: '',
    name: '',
    description: '',
    prompt: '',
    referenceImageUrl: '',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
    tags: [],
    difficulty: 'intermediate',
    context: 'general',
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'my'>(() => {
    const modeParam = searchParams.get('view');
    return modeParam === 'my' ? 'my' : 'all';
  });
  const [allPresets, setAllPresets] = useState<CommunityPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<CommunityPreset | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [presetToDuplicate, setPresetToDuplicate] = useState<CommunityPreset | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Computed values
  const isAuthenticated = isUserAuthenticated === true;



  // Handlers - Data operations
  const handleFetchMyPresets = useCallback(async () => {
    const token = authService.getToken();
    if (!token) {
      setError(t('communityPresets.errors.mustBeAuthenticated'));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(COMMUNITY_API + '/my', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(t('communityPresets.errors.mustBeAuthenticated'));
        }
        throw new Error(t('communityPresets.errors.failedToLoad'));
      }

      const result = (await response.json()) as CommunityPreset[];
      // Migrar presets legados
      setPresets(result.map(migrateLegacyPreset));
    } catch (fetchError: any) {
      console.error('Error loading my presets:', fetchError);
      setPresets([]);
      setError(fetchError.message || t('communityPresets.errors.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const handleFetchAllPresets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use cached service method instead of direct fetch
      const grouped = await getAllCommunityPresets();

      const allPresetsArray: CommunityPreset[] = [];
      Object.values(grouped).forEach(presetArray => {
        if (Array.isArray(presetArray)) {
          // migrateLegacyPreset is safe to call even if already migrated by service
          allPresetsArray.push(...presetArray.map(migrateLegacyPreset));
        }
      });
      setAllPresets(allPresetsArray);
    } catch (fetchError: any) {
      console.error('Error loading all presets:', fetchError);
      setAllPresets([]);
      setError(fetchError.message || t('communityPresets.errors.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const handleFetch = useCallback(() => {
    if (viewMode === 'my') {
      handleFetchMyPresets();
    } else {
      handleFetchAllPresets();
    }
  }, [viewMode, handleFetchMyPresets, handleFetchAllPresets]);


  // Handlers - Form management
  const handleEdit = useCallback((preset: CommunityPreset) => {
    // Migrar preset se necessário
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
      difficulty: migrated.difficulty,
      context: migrated.context,
      useCase: migrated.useCase,
      examples: migrated.examples,
    });
    setIsEditModalOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setIsCreating(true);
    setEditingPreset(null);
    // Se activeTab for 'presets', usar 'mockup' como padrão, senão usar a categoria
    const presetType = activeTab === 'presets' ? 'mockup' : undefined;
    setFormData(getInitialFormData(activeTab === 'all' ? 'presets' : activeTab, presetType));
    setIsEditModalOpen(true);
  }, [activeTab]);

  const handleCancel = useCallback(() => {
    setIsCreating(false);
    setEditingPreset(null);
    setFormData(getInitialFormData('presets', 'mockup'));
    setIsEditModalOpen(false);
  }, []);

  // Effects
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam && PROMPT_CATEGORIES.includes(typeParam as PromptCategory)) {
      setActiveTab(typeParam as PromptCategory);
    } else if (typeParam && PRESET_TYPES.includes(typeParam as any)) {
      // Compatibilidade: mapear presetType antigo para 'presets'
      setActiveTab('presets');
    }
  }, [searchParams]);

  useEffect(() => {
    setFilterTag(null);
  }, [activeTab]);

  useEffect(() => {
    if (!isCheckingAuth) {
      if (viewMode === 'my' && isUserAuthenticated === true) {
        handleFetchMyPresets();
      } else if (viewMode === 'all') {
        handleFetchAllPresets();
      }
    }
  }, [isUserAuthenticated, isCheckingAuth, viewMode, handleFetchMyPresets, handleFetchAllPresets]);

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'my' || viewParam === 'all') {
      setViewMode(viewParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isEditModalOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isEditModalOpen, handleCancel]);

  // Auto-open create modal if create=true in URL
  useEffect(() => {
    const createParam = searchParams.get('create');
    if (createParam === 'true' && !isEditModalOpen && !isCreating && isAuthenticated) {
      handleCreate();
      // Remove the create parameter from URL after opening modal
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('create');
      navigate(`/community/presets?${newSearchParams.toString()}`, { replace: true });
    }
  }, [searchParams, isEditModalOpen, isCreating, isAuthenticated, handleCreate, navigate]);

  // Handlers - Image upload


  // Handlers - Save/Delete
  const handleSave = useCallback(async (data: PresetFormData) => {
    const token = authService.getToken();
    if (!token) {
      throw new Error(t('communityPresets.errors.mustBeAuthenticatedToCreate'));
    }

    const presetId = data.id;

    setIsLoading(true);
    setError(null);

    try {
      const url = isCreating
        ? COMMUNITY_API
        : `${COMMUNITY_API}/${editingPreset}`;
      const method = isCreating ? 'POST' : 'PUT';

      const body: any = {
        category: data.category,
        id: presetId,
        name: data.name,
        description: data.description,
        prompt: data.prompt,
        aspectRatio: data.aspectRatio,
        tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
      };

      // Adicionar presetType apenas se category for 'presets'
      if (data.category === 'presets' && data.presetType) {
        body.presetType = data.presetType;
      }

      // Adicionar referenceImageUrl se necessário
      const needsReferenceImage = (data.category === 'presets' && data.presetType === 'mockup')
        || (data.category !== 'presets' && data.referenceImageUrl);
      if (needsReferenceImage && data.referenceImageUrl !== undefined) {
        body.referenceImageUrl = data.referenceImageUrl;
      }

      // Adicionar novos campos opcionais
      if (data.difficulty) body.difficulty = data.difficulty;
      if (data.context) body.context = data.context;
      if (data.useCase) body.useCase = data.useCase;
      if (data.examples && data.examples.length > 0) body.examples = data.examples;
      if (data.model) body.model = data.model;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (isCreating ? t('communityPresets.errors.failedToCreate') : t('communityPresets.errors.failedToUpdate')));
      }

      if (viewMode === 'my') {
        await handleFetchMyPresets();
      } else {
        await handleFetchAllPresets();
      }
      clearCommunityPresetsCache(); // Clear cache when presets are updated
      handleCancel();
      setIsEditModalOpen(false);
      toast.success(isCreating ? t('communityPresets.messages.presetCreated') : t('communityPresets.messages.presetUpdated'));
    } catch (saveError: any) {
      console.error('Save error:', saveError);
      throw saveError; // Re-throw to be handled by the modal
    } finally {
      setIsLoading(false);
    }
  }, [isCreating, editingPreset, viewMode, t, handleFetchMyPresets, handleFetchAllPresets, handleCancel]);

  const handleDelete = useCallback(async (id: string) => {
    const token = authService.getToken();
    if (!token) {
      setError(t('communityPresets.errors.mustBeAuthenticated'));
      return;
    }

    if (!confirm(t('communityPresets.messages.presetDeleteConfirm'))) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${COMMUNITY_API}/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('communityPresets.errors.failedToDelete'));
      }

      if (viewMode === 'my') {
        await handleFetchMyPresets();
      } else {
        await handleFetchAllPresets();
      }
      clearCommunityPresetsCache(); // Clear cache when presets are deleted
      toast.success(t('communityPresets.messages.presetDeleted'));
    } catch (deleteError: any) {
      setError(deleteError.message || t('communityPresets.errors.failedToDelete'));
    } finally {
      setIsLoading(false);
    }
  }, [t, viewMode, handleFetchMyPresets, handleFetchAllPresets]);

  const handleDuplicateClick = useCallback((preset: CommunityPreset) => {
    setPresetToDuplicate(preset);
    setDuplicateModalOpen(true);
  }, []);

  const handleConfirmDuplicate = useCallback(async () => {
    if (!presetToDuplicate) return;

    const token = authService.getToken();
    if (!token) {
      toast.error(t('communityPresets.errors.mustBeAuthenticated'));
      return;
    }

    setIsLoading(true);

    try {
      // Migrar preset se necessário
      const migrated = migrateLegacyPreset(presetToDuplicate);
      // Generate a new unique ID based on the name + random suffix
      const newId = generateSlug(migrated.name + '-copy');

      const body: any = {
        category: migrated.category,
        id: newId,
        name: `${migrated.name} (Copy)`,
        description: migrated.description,
        prompt: migrated.prompt,
        aspectRatio: migrated.aspectRatio,
        tags: migrated.tags,
        model: migrated.model,
      };

      // Adicionar presetType se category for 'presets'
      if (migrated.category === 'presets' && migrated.presetType) {
        body.presetType = migrated.presetType;
      }

      // Adicionar referenceImageUrl se necessário
      const needsReferenceImage = (migrated.category === 'presets' && migrated.presetType === 'mockup')
        || (migrated.category !== 'presets' && migrated.referenceImageUrl);
      if (needsReferenceImage && migrated.referenceImageUrl) {
        body.referenceImageUrl = migrated.referenceImageUrl;
      }

      // Adicionar novos campos opcionais
      if (migrated.difficulty) body.difficulty = migrated.difficulty;
      if (migrated.context) body.context = migrated.context;
      if (migrated.useCase) body.useCase = migrated.useCase;
      if (migrated.examples && migrated.examples.length > 0) body.examples = migrated.examples;

      const response = await fetch(COMMUNITY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('communityPresets.errors.failedToCreate'));
      }

      // If viewing my presets, refresh list
      if (viewMode === 'my') {
        await handleFetchMyPresets();
      }

      toast.success(t('communityPresets.messages.presetDuplicated') || "Preset duplicated successfully");
      setDuplicateModalOpen(false);
      setPresetToDuplicate(null);
    } catch (error: any) {
      console.error('Duplicate error:', error);
      toast.error(error.message || "Failed to duplicate preset");
    } finally {
      setIsLoading(false);
    }
  }, [presetToDuplicate, t, viewMode, handleFetchMyPresets]);

  const handleToggleLike = useCallback(async (presetId: string) => {
    const token = authService.getToken();
    if (!token) {
      toast.error(t('communityPresets.errors.mustBeAuthenticated'));
      return;
    }

    // Find current preset to get initial state
    const sourcePresets = viewMode === 'my' ? presets : allPresets;
    const preset = sourcePresets.find(p => p.id === presetId);
    if (!preset) return;

    const currentIsLiked = preset.isLikedByUser || false;
    const currentLikesCount = preset.likesCount || 0;

    // Optimistic update
    if (viewMode === 'my') {
      setPresets(prev => prev.map(p =>
        p.id === presetId
          ? {
            ...p,
            isLikedByUser: !currentIsLiked,
            likesCount: currentIsLiked ? Math.max(0, currentLikesCount - 1) : currentLikesCount + 1
          }
          : p
      ));
    } else {
      setAllPresets(prev => prev.map(p =>
        p.id === presetId
          ? {
            ...p,
            isLikedByUser: !currentIsLiked,
            likesCount: currentIsLiked ? Math.max(0, currentLikesCount - 1) : currentLikesCount + 1
          }
          : p
      ));
    }

    try {
      const response = await fetch(`${COMMUNITY_API}/${presetId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('communityPresets.errors.failedToToggleLike'));
      }

      const result = await response.json();

      // Update with server response
      if (viewMode === 'my') {
        setPresets(prev => prev.map(p =>
          p.id === presetId
            ? {
              ...p,
              isLikedByUser: result.isLikedByUser,
              likesCount: result.likesCount
            }
            : p
        ));
      } else {
        setAllPresets(prev => prev.map(p =>
          p.id === presetId
            ? {
              ...p,
              isLikedByUser: result.isLikedByUser,
              likesCount: result.likesCount
            }
            : p
        ));
      }
    } catch (error: any) {
      // Revert optimistic update on error
      if (viewMode === 'my') {
        setPresets(prev => prev.map(p =>
          p.id === presetId
            ? {
              ...p,
              isLikedByUser: currentIsLiked,
              likesCount: currentLikesCount
            }
            : p
        ));
      } else {
        setAllPresets(prev => prev.map(p =>
          p.id === presetId
            ? {
              ...p,
              isLikedByUser: currentIsLiked,
              likesCount: currentLikesCount
            }
            : p
        ));
      }
      toast.error(error.message || t('communityPresets.errors.failedToToggleLike'));
      console.error('Error toggling like:', error);
    }
  }, [viewMode, presets, allPresets, t]);

  // Handlers - Tab navigation
  const handleTabChange = useCallback((category: PromptCategory) => {
    setActiveTab(category);
    navigate(`/community/presets?type=${category}&view=${viewMode}`, { replace: true });
    if (isEditModalOpen) handleCancel();
  }, [navigate, isEditModalOpen, handleCancel, viewMode]);

  const handleViewModeChange = useCallback((mode: 'all' | 'my') => {
    setViewMode(mode);
    navigate(`/community/presets?type=${activeTab}&view=${mode}`, { replace: true });
    if (isEditModalOpen) handleCancel();
  }, [navigate, activeTab, isEditModalOpen, handleCancel]);

  // Computed - Tags and filtering
  const allTags = useMemo(() => {
    const sourcePresets = viewMode === 'my' ? presets : allPresets;
    let currentCategoryPresets = sourcePresets;

    // Filtrar por categoria
    if (activeTab !== 'all') {
      if (activeTab === 'presets') {
        // Para presets, manter compatibilidade com filtro de presetType se houver
        currentCategoryPresets = sourcePresets.filter(p => p.category === 'presets');
      } else {
        currentCategoryPresets = sourcePresets.filter(p => p.category === activeTab);
      }
    }

    const tagCounts = new Map<string, number>();
    currentCategoryPresets.forEach(preset => {
      if (preset.tags && Array.isArray(preset.tags)) {
        preset.tags.forEach(tag => {
          if (tag && typeof tag === 'string' && tag.trim().length > 0) {
            const trimmedTag = tag.trim();
            tagCounts.set(trimmedTag, (tagCounts.get(trimmedTag) || 0) + 1);
          }
        });
      }
    });

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [presets, allPresets, activeTab, viewMode]);

  const currentPresets = useMemo(() => {
    const sourcePresets = viewMode === 'my' ? presets : allPresets;
    let filtered = sourcePresets;

    // Filtrar por categoria
    if (activeTab !== 'all') {
      if (activeTab === 'presets') {
        filtered = sourcePresets.filter(p => p.category === 'presets');
      } else {
        filtered = sourcePresets.filter(p => p.category === activeTab);
      }
    }

    // Filtrar por tag
    if (filterTag) {
      filtered = filtered.filter(p =>
        p.tags && Array.isArray(p.tags) && p.tags.includes(filterTag)
      );
    }

    // Filtrar por busca
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => {
        const migrated = migrateLegacyPreset(p);
        const name = migrated.name?.toLowerCase() || '';
        const description = migrated.description?.toLowerCase() || '';
        const prompt = migrated.prompt?.toLowerCase() || '';
        const tags = migrated.tags || [];

        return (
          name.includes(query) ||
          description.includes(query) ||
          prompt.includes(query) ||
          tags.some(tag => tag && typeof tag === 'string' && tag.toLowerCase().includes(query))
        );
      });
    }

    return filtered;
  }, [presets, allPresets, activeTab, filterTag, searchQuery, viewMode]);

  // Ordenar categorias por quantidade de presets
  const sortedCategories = useMemo(() => {
    const sourcePresets = viewMode === 'my' ? presets : allPresets;

    // Calcular quantidade por categoria
    const categoryCounts = PROMPT_CATEGORIES.reduce((acc, category) => {
      if (category === 'all') {
        acc[category] = sourcePresets.length;
      } else {
        acc[category] = sourcePresets.filter(p => {
          if (category === 'presets') {
            return p.category === 'presets';
          }
          return p.category === category;
        }).length;
      }
      return acc;
    }, {} as Record<PromptCategory, number>);

    // Separar 'all' e ordenar o resto por quantidade (decrescente)
    const allCategory: PromptCategory[] = ['all'];
    const otherCategories = PROMPT_CATEGORIES
      .filter(cat => cat !== 'all')
      .sort((a, b) => categoryCounts[b] - categoryCounts[a]);

    return [...allCategory, ...otherCategories];
  }, [presets, allPresets, viewMode]);

  const isEditing = editingPreset !== null || isCreating;



  return (
    <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-12 md:pt-14 relative">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
        <div className="mb-6">
          <BreadcrumbWithBack to="/community">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">{t('common.home')}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/community">{t('common.community')}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t('common.presets')}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </BreadcrumbWithBack>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {viewMode === 'all' ? (
                <Globe className="h-6 w-6 md:h-8 md:w-8 text-brand-cyan" />
              ) : (
                <User className="h-6 w-6 md:h-8 md:w-8 text-indigo-400" />
              )}
              <h1 className={cn(
                "text-3xl md:text-4xl font-semibold font-manrope",
                viewMode === 'all' ? "text-neutral-300" : "text-indigo-100"
              )}>
                {viewMode === 'my' ? t('communityPresets.myPresets') : t('communityPresets.allPresets')}
              </h1>
            </div>
            <p className="text-neutral-500 font-mono text-sm md:text-base mb-6">
              {viewMode === 'my' ? t('communityPresets.myPresetsSubtitle') : t('communityPresets.subtitle')}
            </p>
          </div>
        </div>

        {isCheckingAuth && (
          <div className="max-w-md mx-auto">
            <div className="bg-neutral-900 border border-neutral-800/50 rounded-md p-6 md:p-8 text-center">
              <p className="text-neutral-400 font-mono">{t('common.loading')}</p>
            </div>
          </div>
        )}

        {!isCheckingAuth && viewMode === 'my' && !isAuthenticated && (
          <div className="max-w-md mx-auto">
            <div className="bg-neutral-900 border border-neutral-800/50 rounded-md p-6 md:p-8 space-y-4 text-center">
              <p className="text-neutral-400 font-mono mb-4">
                {t('communityPresets.errors.mustBeAuthenticated')}
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-block px-4 py-2 bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/50 text-neutral-300 font-medium rounded-md text-sm font-mono transition-colors"
              >
                {t('header.register')}
              </button>
            </div>
          </div>
        )}

        {!isCheckingAuth && (viewMode === 'all' || isAuthenticated) && (
          <div className="space-y-4">
            {/* View Mode (All/My) - Sub Hierarchy Tabs */}
            <div className="flex items-center justify-between border-neutral-800/30">
              <div className="flex p-1 rounded-lg border border-neutral-800/50">
                <button
                  onClick={() => handleViewModeChange('all')}
                  className={cn(
                    "px-6 py-2 rounded-md text-xs font-mono transition-all flex items-center gap-2",
                    viewMode === 'all'
                      ? 'bg-neutral-800 text-brand-cyan shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-300'
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />
                  {t('communityPresets.viewAll')}
                </button>
                <button
                  onClick={() => handleViewModeChange('my')}
                  className={cn(
                    "px-6 rounded-md text-xs font-mono transition-all flex items-center gap-2",
                    viewMode === 'my'
                      ? 'bg-neutral-800 text-indigo-400 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-300'
                  )}
                  disabled={!isAuthenticated}
                >
                  <User className="h-3.5 w-3.5" />
                  {t('communityPresets.viewMy')}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('communityPresets.search.placeholder') || 'Search presets...'}
                    className="bg-black/40 backdrop-blur-sm border border-neutral-700/30 rounded-md pl-8 pr-8 py-2 w-48 md:w-64 focus:outline-none focus:border-[brand-cyan]/50 text-xs text-neutral-300 font-mono"
                  />
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-neutral-500" size={14} />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {!isEditing && isAuthenticated && (
                  <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-950/70 hover:bg-neutral-800/50 border border-neutral-800/50 text-neutral-300 font-medium rounded-md text-sm font-mono transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    {t('communityPresets.createNew')}
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <CommunityPresetsSidebar
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              activeCategory={activeTab}
              onCategoryChange={handleTabChange}
              allTags={allTags}
              filterTag={filterTag}
              onFilterTagChange={setFilterTag}
              currentPresetsCount={currentPresets.length}
              categories={sortedCategories}
              t={t}
            />
            <div>
              {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-mono">
                  {error}
                </div>
              )}
              {/* Gallery Container */}
              <div className="space-y-4">

                {/* Bento Box Grid */}
                {currentPresets.length === 0 ? (
                  <div key="empty" className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-12 text-center tab-content-active">
                    <p className="text-neutral-500 font-mono">
                      {searchQuery.trim()
                        ? (t('communityPresets.search.noResults') || `No presets found for "${searchQuery}"`)
                        : t('communityPresets.table.noPresets')
                      }
                    </p>
                    {searchQuery.trim() && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="mt-4 px-4 py-2 text-xs font-mono text-neutral-400 hover:text-neutral-300 border border-neutral-700/50 rounded-md hover:border-neutral-600/50 transition-colors"
                      >
                        {t('communityPresets.search.clear') || 'Clear search'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div key={`${activeTab}-${viewMode}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 tab-content-active">
                    {currentPresets.map((preset) => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        onClick={() => setSelectedPreset(preset)}
                        onEdit={isAuthenticated ? () => handleEdit(preset) : undefined}
                        onDelete={viewMode === 'my' ? () => handleDelete(preset.id) : undefined}
                        onDuplicate={isAuthenticated ? () => handleDuplicateClick(preset) : undefined}
                        onToggleLike={isAuthenticated ? () => handleToggleLike(preset.id) : undefined}
                        isAuthenticated={isAuthenticated}
                        canEdit={viewMode === 'my'}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit/Create Preset Modal */}
        <CommunityPresetModal
          isOpen={isEditModalOpen}
          onClose={handleCancel}
          onSave={handleSave}
          initialData={formData}
          isCreating={isCreating}
        />

        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setShowAuthModal(false);
              handleFetch();
            }}
            defaultIsSignUp={true}
          />
        )}

        <ConfirmationModal
          isOpen={duplicateModalOpen}
          onClose={() => {
            setDuplicateModalOpen(false);
            setPresetToDuplicate(null);
          }}
          onConfirm={handleConfirmDuplicate}
          title={t('communityPresets.actions.duplicateConfirm') || "Duplicate Preset"}
          message={t('communityPresets.actions.duplicateMessage') || "Are you sure you want to duplicate this preset? It will be added to your personal collection."}
          confirmText={t('communityPresets.actions.duplicateButton') || "Duplicate"}
          cancelText={t('communityPresets.actions.cancel') || "Cancel"}
          variant="info"
        />

        {/* Preset Detail Modal */}
        {selectedPreset && (
          <PresetDetailModal
            preset={selectedPreset}
            onClose={() => setSelectedPreset(null)}
            onOpenInCanvas={() => {
              // Store preset in localStorage for canvas to pick up
              try {
                const migrated = migrateLegacyPreset(selectedPreset);
                localStorage.setItem('import-community-preset', JSON.stringify({
                  category: migrated.category,
                  presetType: migrated.presetType,
                  id: migrated.id,
                  name: migrated.name,
                  description: migrated.description,
                  prompt: migrated.prompt,
                  referenceImageUrl: migrated.referenceImageUrl,
                  aspectRatio: migrated.aspectRatio,
                  model: migrated.model,
                  tags: migrated.tags,
                }));
                navigate('/canvas');
                setSelectedPreset(null);
              } catch (error) {
                console.error('Failed to store preset for import:', error);
                toast.error(t('communityPresets.errors.failedToLoad'));
              }
            }}
            onToggleLike={isAuthenticated ? () => {
              if (selectedPreset) {
                handleToggleLike(selectedPreset.id);
              }
            } : undefined}
            onEdit={() => {
              if (selectedPreset) {
                handleEdit(selectedPreset);
                setSelectedPreset(null);
                setIsEditModalOpen(true);
              }
            }}
            isLiked={selectedPreset.isLikedByUser || false}
            likesCount={selectedPreset.likesCount || 0}
            isAuthenticated={isAuthenticated}
            t={t}
          />
        )}
      </div>
    </div>
  );
};


// PresetDetailModal Component
const PresetDetailModal: React.FC<{
  preset: CommunityPreset;
  onClose: () => void;
  onOpenInCanvas: () => void;
  onToggleLike?: () => void;
  onEdit?: () => void;
  isLiked: boolean;
  likesCount: number;
  isAuthenticated: boolean;
  t: (key: string) => string;
}> = ({ preset, onClose, onOpenInCanvas, onToggleLike, onEdit, isLiked, likesCount, isAuthenticated, t }) => {
  const migrated = migrateLegacyPreset(preset);
  const hasImage = (migrated.category === 'presets' && migrated.presetType === 'mockup' && migrated.referenceImageUrl)
    || (migrated.category !== 'presets' && migrated.referenceImageUrl);
  const presetIcon = getPresetIcon(migrated.category);
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [glitchText, setGlitchText] = useState('');
  const isOwner = currentUserId && migrated.userId && currentUserId === migrated.userId;

  useEffect(() => {
    const getCurrentUser = async () => {
      if (isAuthenticated) {
        const user = await authService.verifyToken();
        if (user) {
          setCurrentUserId(user.id);
        }
      }
    };
    getCurrentUser();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isCopying) {
      const glitchChars = '*•□./-®'
      const glitchInterval = setInterval(() => {
        const randomGlitch = Array.from({ length: 4 }, () =>
          glitchChars[Math.floor(Math.random() * glitchChars.length)]
        ).join('')
        setGlitchText(randomGlitch)
      }, 150)

      const timeout = setTimeout(() => {
        setIsCopying(false)
        setGlitchText('')
      }, 600)

      return () => {
        clearInterval(glitchInterval)
        clearTimeout(timeout)
      }
    }
  }, [isCopying]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isImageFullscreen) {
          setIsImageFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose, isImageFullscreen]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0F0F0F] border border-neutral-800/60 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0F0F0F] border-b border-neutral-800/50 p-10 flex items-center justify-between z-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-semibold text-neutral-100 font-mono mb-1 truncate">
              {migrated.name}
            </h2>
            <p className="text-sm text-neutral-400 font-mono">
              {migrated.description}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {isOwner && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-mono bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50"
                title={t('communityPresets.actions.edit')}
              >
                <Edit2 size={16} />
                <span>{t('communityPresets.actions.edit')}</span>
              </button>
            )}
            {isAuthenticated && onToggleLike && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike();
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-mono ${isLiked
                  ? 'bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50'
                  : 'bg-neutral-900/40 text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-400'
                  }`}
                title={isLiked ? t('communityPresets.actions.unlike') : t('communityPresets.actions.like')}
              >
                <Heart size={16} className={isLiked ? 'fill-current' : ''} />
                <span>{likesCount}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex gap-6">
            {/* Image or Icon - Left Side */}
            <div className="flex-shrink-0 w-1/2">
              {hasImage ? (
                <div className="relative rounded-lg overflow-hidden border border-neutral-700/30 bg-neutral-900/30 aspect-square group">
                  <img
                    src={migrated.referenceImageUrl}
                    alt={migrated.name}
                    className="w-full h-full object-cover bg-neutral-900/50"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsImageFullscreen(true);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-neutral-700/50 rounded-md text-neutral-300 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    title="View fullscreen"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              ) : (
                <div className="w-full aspect-square rounded-lg border border-neutral-700/30 bg-neutral-900/30 flex items-center justify-center">
                  <div className="text-neutral-500">{presetIcon}</div>
                </div>
              )}
            </div>

            {/* Info - Right Side */}
            <div className="flex-1 space-y-4 min-w-0">
              {/* Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-xl p-4">
                  <label className="block text-xs font-semibold text-neutral-400 font-mono mb-2 uppercase">
                    Category
                  </label>
                  <p className="text-sm text-neutral-200 font-mono">{t(`communityPresets.categories.${migrated.category}`)}</p>
                </div>
                {migrated.category === 'presets' && migrated.presetType && (
                  <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-xl p-4">
                    <label className="block text-xs font-semibold text-neutral-400 font-mono mb-2 uppercase">
                      Preset Type
                    </label>
                    <p className="text-sm text-neutral-200 font-mono uppercase">{migrated.presetType}</p>
                  </div>
                )}
                <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-xl p-3">
                  <label className="block text-xs font-semibold text-neutral-400 font-mono mb-1.5 uppercase">
                    Aspect Ratio
                  </label>
                  <p className="text-sm text-neutral-200 font-mono">{migrated.aspectRatio}</p>
                </div>
              </div>

              {/* Prompt */}
              <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-neutral-400 font-mono uppercase">
                    Prompt
                  </label>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setIsCopying(true);
                      try {
                        await navigator.clipboard.writeText(migrated.prompt);
                        toast.success('Prompt copied to clipboard');
                      } catch (err) {
                        toast.error('Failed to copy prompt');
                      }
                    }}
                    className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 rounded-md transition-all relative min-w-[14px] min-h-[14px] flex items-center justify-center"
                    title="Copy prompt"
                  >
                    {isCopying ? (
                      <span className="text-[10px] font-mono text-neutral-400">
                        {glitchText}
                      </span>
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
                <p className="text-sm text-neutral-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">{migrated.prompt}</p>
              </div>

              {/* Examples */}
              {migrated.examples && migrated.examples.length > 0 && (
                <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-xl p-4">
                  <label className="block text-xs font-semibold text-neutral-400 font-mono mb-2 uppercase">
                    {t('communityPresets.examples')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {migrated.examples.map((example, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-neutral-800/40 rounded border border-neutral-700/20 text-neutral-400 font-mono text-xs"
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {migrated.tags && migrated.tags.length > 0 && (
                <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-xl p-4">
                  <label className="block text-xs font-semibold text-neutral-400 font-mono mb-2 uppercase">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {migrated.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-neutral-800/40 rounded border border-neutral-700/20 text-neutral-400 font-mono text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-[#0F0F0F] border-t border-neutral-800/50 p-6 flex gap-3">
          <button
            onClick={onOpenInCanvas}
            className="flex items-center gap-2 flex-1 px-6 py-3 bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/50 text-neutral-300 font-medium rounded-xl text-sm font-mono transition-all"
          >
            <ExternalLink className="h-4 w-4" />
            {t('communityPresets.openInCanvas')}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-neutral-900/50 border border-neutral-700/50 text-neutral-300 hover:bg-neutral-800/50 hover:border-neutral-600/50 font-medium rounded-xl text-sm font-mono transition-all"
          >
            {t('common.close')}
          </button>
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {isImageFullscreen && hasImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
          onClick={() => setIsImageFullscreen(false)}
        >
          <button
            onClick={() => setIsImageFullscreen(false)}
            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-lg transition-colors z-10"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={migrated.referenceImageUrl}
            alt={migrated.name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default CommunityPresetsPage;

