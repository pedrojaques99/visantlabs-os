import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Users, Plus, Edit2, Trash2, X, Save, Image as ImageIcon, Camera, Layers, MapPin, Sun, ArrowLeft, Heart, Maximize2, ExternalLink, RefreshCcw, Copy } from 'lucide-react';

import { GridDotsBackground } from '../components/ui/GridDotsBackground';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useLayout } from '../hooks/useLayout';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import type { AspectRatio, GeminiModel, UploadedImage } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import { AuthModal } from '../components/AuthModal';
import { Select } from '../components/ui/select';
import { getAllCommunityPresets, clearCommunityPresetsCache } from '../services/communityPresetsService';
import { CommunityPresetModal } from '../components/CommunityPresetModal';
import { ConfirmationModal } from '../components/ConfirmationModal';

// Constants
const COMMUNITY_API = '/api/community/presets';
const PRESET_TYPES = ['mockup', 'angle', 'texture', 'ambience', 'luminance'] as const;

// Types
type PresetType = 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance';

interface PresetFormData {
  presetType: PresetType;
  id: string;
  name: string;
  description: string;
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[];
}

interface CommunityPreset {
  _id?: string;
  userId: string;
  presetType: PresetType;
  id: string;
  name: string;
  description: string;
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[];
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  likesCount?: number;
  isLikedByUser?: boolean;
}



const getPresetIcon = (type: PresetType) => {
  const icons = {
    mockup: ImageIcon,
    angle: Camera,
    texture: Layers,
    ambience: MapPin,
    luminance: Sun,
  };
  const Icon = icons[type];
  return <Icon size={20} />;
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
  const [activeTab, setActiveTab] = useState<PresetType>(() => {
    const typeParam = searchParams.get('type');
    if (typeParam && ['mockup', 'angle', 'texture', 'ambience', 'luminance'].includes(typeParam)) {
      return typeParam as PresetType;
    }
    return 'mockup';
  });
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<PresetFormData>({
    presetType: 'mockup',
    id: '',
    name: '',
    description: '',
    prompt: '',
    referenceImageUrl: '',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
    tags: [],
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
      setPresets(result);
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
      const token = authService.getToken();
      const response = await fetch('/api/community/presets/public', {
        headers: token ? {
          Authorization: `Bearer ${token}`,
        } : {},
      });

      if (!response.ok) {
        throw new Error(t('communityPresets.errors.failedToLoad'));
      }

      const grouped = (await response.json()) as Record<string, CommunityPreset[]>;
      // Flatten grouped presets into a single array
      const allPresetsArray: CommunityPreset[] = [];
      Object.values(grouped).forEach(presetArray => {
        if (Array.isArray(presetArray)) {
          allPresetsArray.push(...presetArray);
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

  const handleRefresh = useCallback(() => {
    handleFetch();
  }, [handleFetch]);

  // Handlers - Form management
  const handleEdit = useCallback((preset: CommunityPreset) => {
    setEditingPreset(preset.id);
    setIsCreating(false);
    setFormData({
      presetType: preset.presetType,
      id: preset.id,
      name: preset.name,
      description: preset.description,
      prompt: preset.prompt,
      referenceImageUrl: preset.referenceImageUrl || '',
      aspectRatio: preset.aspectRatio,
      tags: preset.tags || [],
    });
    setIsEditModalOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setIsCreating(true);
    setEditingPreset(null);
    setFormData(getInitialFormData(activeTab));
    setIsEditModalOpen(true);
  }, [activeTab]);

  const handleCancel = useCallback(() => {
    setIsCreating(false);
    setEditingPreset(null);
    setFormData(getInitialFormData(activeTab));
    setIsEditModalOpen(false);
  }, [activeTab]);

  // Effects
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam && PRESET_TYPES.includes(typeParam as PresetType)) {
      setActiveTab(typeParam as PresetType);
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
        presetType: data.presetType,
        id: presetId,
        name: data.name,
        description: data.description,
        prompt: data.prompt,
        aspectRatio: data.aspectRatio,
        tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
      };

      if (data.presetType === 'mockup' && data.referenceImageUrl !== undefined) {
        body.referenceImageUrl = data.referenceImageUrl;
      }

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
      // Generate a new unique ID based on the name + random suffix
      const newId = generateSlug(presetToDuplicate.name + '-copy');

      const body: any = {
        presetType: presetToDuplicate.presetType,
        id: newId,
        name: `${presetToDuplicate.name} (Copy)`,
        description: presetToDuplicate.description,
        prompt: presetToDuplicate.prompt,
        aspectRatio: presetToDuplicate.aspectRatio,
        tags: presetToDuplicate.tags,
        model: presetToDuplicate.model,
      };

      if (presetToDuplicate.presetType === 'mockup' && presetToDuplicate.referenceImageUrl) {
        body.referenceImageUrl = presetToDuplicate.referenceImageUrl;
      }

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
  const handleTabChange = useCallback((type: PresetType) => {
    setActiveTab(type);
    navigate(`/community/presets?type=${type}&view=${viewMode}`, { replace: true });
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
    const currentPresets = sourcePresets.filter(p => p.presetType === activeTab);
    const tags = new Set<string>();

    currentPresets.forEach(preset => {
      if (preset.tags && Array.isArray(preset.tags)) {
        preset.tags.forEach(tag => {
          if (tag && typeof tag === 'string' && tag.trim().length > 0) {
            tags.add(tag.trim());
          }
        });
      }
    });

    return Array.from(tags).sort();
  }, [presets, allPresets, activeTab, viewMode]);

  const currentPresets = useMemo(() => {
    const sourcePresets = viewMode === 'my' ? presets : allPresets;
    let filtered = sourcePresets.filter(p => p.presetType === activeTab);
    if (filterTag) {
      filtered = filtered.filter(p =>
        p.tags && Array.isArray(p.tags) && p.tags.includes(filterTag)
      );
    }
    return filtered;
  }, [presets, allPresets, activeTab, filterTag, viewMode]);

  const isEditing = editingPreset !== null || isCreating;



  return (
    <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 relative">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>
      <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
        <div className="mb-6">
          <Breadcrumb>
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
          </Breadcrumb>
        </div>
        <div className="flex items-start gap-4 mb-8">
          <button
            onClick={() => navigate('/community')}
            className="p-2 hover:bg-zinc-800/50 rounded-md transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-zinc-400" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-6 w-6 md:h-8 md:w-8 text-brand-cyan" />
              <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-zinc-300">
                {viewMode === 'my' ? t('communityPresets.myPresets') : t('communityPresets.allPresets')}
              </h1>
            </div>
            <p className="text-zinc-500 font-mono text-sm md:text-base ml-9 md:ml-11">
              {viewMode === 'my' ? t('communityPresets.myPresetsSubtitle') : t('communityPresets.subtitle')}
            </p>
          </div>
        </div>

        {isCheckingAuth && (
          <div className="max-w-md mx-auto">
            <div className="bg-[#1A1A1A] border border-zinc-800/50 rounded-md p-6 md:p-8 text-center">
              <p className="text-zinc-400 font-mono">{t('common.loading')}</p>
            </div>
          </div>
        )}

        {!isCheckingAuth && viewMode === 'my' && !isAuthenticated && (
          <div className="max-w-md mx-auto">
            <div className="bg-[#1A1A1A] border border-zinc-800/50 rounded-md p-6 md:p-8 space-y-4 text-center">
              <p className="text-zinc-400 font-mono mb-4">
                {t('communityPresets.errors.mustBeAuthenticated')}
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-block px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 text-zinc-300 font-medium rounded-md text-sm font-mono transition-colors"
              >
                {t('header.register')}
              </button>
            </div>
          </div>
        )}

        {!isCheckingAuth && (viewMode === 'all' || isAuthenticated) && (
          <div className="space-y-6">
            <div className="bg-[#1A1A1A] border border-zinc-800/50 rounded-md p-4 md:p-6">
              {/* View Mode Tabs */}
              <div className="flex gap-2 mb-4 pb-4 border-b border-zinc-800/30">
                <button
                  onClick={() => handleViewModeChange('all')}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-mono transition-all",
                    viewMode === 'all'
                      ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                      : 'bg-zinc-900/50 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                  )}
                >
                  {t('communityPresets.viewAll')}
                </button>
                <button
                  onClick={() => handleViewModeChange('my')}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-mono transition-all",
                    viewMode === 'my'
                      ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                      : 'bg-zinc-900/50 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                  )}
                  disabled={!isAuthenticated}
                >
                  {t('communityPresets.viewMy')}
                </button>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div className="flex gap-2 flex-wrap">
                  {PRESET_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleTabChange(type)}
                      className={cn(
                        "px-4 py-2 rounded-md text-sm font-mono transition-all",
                        activeTab === type
                          ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                          : 'bg-zinc-900/50 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                      )}
                    >
                      {t(`communityPresets.tabs.${type}`)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRefresh}
                    className="flex items-center justify-center p-2 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 text-zinc-300 rounded-md transition-colors disabled:bg-zinc-900/50 disabled:text-zinc-600 disabled:border-zinc-800/50"
                    disabled={isLoading}
                    title={t('communityPresets.actions.refresh')}
                    aria-label={t('communityPresets.actions.refresh')}
                  >
                    <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                  {viewMode === 'my' && !isEditing && isAuthenticated && (
                    <button
                      onClick={handleCreate}
                      className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 text-zinc-300 font-medium rounded-md text-sm font-mono transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      {t('communityPresets.createNew')}
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-mono">
                  {error}
                </div>
              )}

              {/* Tag Cloud - Minimalista dentro da galeria */}
              {allTags.length > 0 && (
                <div className="mb-6 pb-4 border-b border-zinc-800/30">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setFilterTag(null)}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-mono transition-all",
                        filterTag === null
                          ? 'text-zinc-300 bg-zinc-800/50 border border-zinc-700/50'
                          : 'text-zinc-500/60 hover:text-zinc-400 border border-transparent hover:border-zinc-700/30'
                      )}
                    >
                      All
                    </button>
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-mono transition-all",
                          filterTag === tag
                            ? 'text-zinc-300 bg-zinc-800/50 border border-zinc-700/50'
                            : 'text-zinc-500/60 hover:text-zinc-400 border border-transparent hover:border-zinc-700/30'
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bento Box Grid */}
              {currentPresets.length === 0 ? (
                <div className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl p-12 text-center">
                  <p className="text-zinc-500 font-mono">{t('communityPresets.table.noPresets')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentPresets.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      onClick={() => setSelectedPreset(preset)}
                      onEdit={viewMode === 'my' ? () => handleEdit(preset) : undefined}
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
        )}

        {/* Edit/Create Preset Modal */}
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
                localStorage.setItem('import-community-preset', JSON.stringify({
                  presetType: selectedPreset.presetType,
                  id: selectedPreset.id,
                  name: selectedPreset.name,
                  description: selectedPreset.description,
                  prompt: selectedPreset.prompt,
                  referenceImageUrl: selectedPreset.referenceImageUrl,
                  aspectRatio: selectedPreset.aspectRatio,
                  model: selectedPreset.model,
                  tags: selectedPreset.tags,
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

// PresetCard Component
const PresetCard: React.FC<{
  preset: CommunityPreset;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleLike?: () => void;
  isAuthenticated: boolean;
  canEdit: boolean;
  t: (key: string) => string;
}> = ({ preset, onClick, onEdit, onDelete, onDuplicate, onToggleLike, isAuthenticated, canEdit, t }) => {
  const hasImage = preset.presetType === 'mockup' && preset.referenceImageUrl;
  const presetIcon = getPresetIcon(preset.presetType);
  const isLiked = preset.isLikedByUser || false;
  const likesCount = preset.likesCount || 0;

  return (
    <div
      className="bg-card border border-zinc-800/50 rounded-md p-4 hover:border-brand-cyan/30 hover:bg-card/80 transition-all group relative cursor-pointer"
      onClick={onClick}
    >
      <div className="mb-3">
        {hasImage ? (
          <div className="relative w-full aspect-square rounded-md overflow-hidden border border-zinc-700/30 bg-zinc-900/30">
            <img
              src={preset.referenceImageUrl}
              alt={preset.name}
              className="w-full h-full object-contain bg-zinc-900/50 group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-md border border-zinc-700/30 bg-zinc-900/30 flex items-center justify-center">
            <div className="text-zinc-500">{presetIcon}</div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-zinc-200 mb-0.5 font-mono line-clamp-1">
              {preset.name}
            </h3>
            <p className="text-xs text-zinc-500 font-mono line-clamp-2 leading-snug">
              {preset.description}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {isAuthenticated && onDuplicate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="p-1.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 rounded transition-colors opacity-0 group-hover:opacity-100"
                title={t('communityPresets.actions.duplicate') || "Duplicate"}
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            {canEdit && onEdit && onDelete && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                  }}
                  className="p-1.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title={t('communityPresets.actions.edit')}
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.();
                  }}
                  className="p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title={t('communityPresets.actions.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/30 text-zinc-500 font-mono text-xs">
            {preset.aspectRatio}
          </span>
          <span className="px-2 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/30 text-zinc-500 font-mono text-[10px] uppercase">
            {preset.presetType}
          </span>
          {isAuthenticated && onToggleLike && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike();
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all text-xs font-mono ml-auto ${isLiked
                ? 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50'
                : 'bg-zinc-900/40 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400'
                }`}
              title={isLiked ? t('communityPresets.actions.unlike') : t('communityPresets.actions.like')}
            >
              <Heart size={12} className={isLiked ? 'fill-current' : ''} />
              <span>{likesCount}</span>
            </button>
          )}
        </div>

        {/* Tags */}
        {preset.tags && preset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {preset.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-1.5 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/20 text-zinc-500 font-mono text-[10px] hover:border-zinc-600/40 hover:text-zinc-400 transition-colors"
              >
                {tag}
              </span>
            ))}
            {preset.tags.length > 3 && (
              <span className="px-1.5 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/20 text-zinc-500 font-mono text-[10px]">
                +{preset.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div >
  );
};

// PresetDetailModal Component
const PresetDetailModal: React.FC<{
  preset: CommunityPreset;
  onClose: () => void;
  onOpenInCanvas: () => void;
  onToggleLike?: () => void;
  isLiked: boolean;
  likesCount: number;
  isAuthenticated: boolean;
  t: (key: string) => string;
}> = ({ preset, onClose, onOpenInCanvas, onToggleLike, isLiked, likesCount, isAuthenticated, t }) => {
  const hasImage = preset.presetType === 'mockup' && preset.referenceImageUrl;
  const presetIcon = getPresetIcon(preset.presetType);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0F0F0F] border border-zinc-800/60 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0F0F0F] border-b border-zinc-800/50 p-6 flex items-center justify-between z-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-semibold text-zinc-100 font-mono mb-1 truncate">
              {preset.name}
            </h2>
            <p className="text-sm text-zinc-400 font-mono">
              {preset.description}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {isAuthenticated && onToggleLike && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike();
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-mono ${isLiked
                  ? 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50'
                  : 'bg-zinc-900/40 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400'
                  }`}
                title={isLiked ? t('communityPresets.actions.unlike') : t('communityPresets.actions.like')}
              >
                <Heart size={16} className={isLiked ? 'fill-current' : ''} />
                <span>{likesCount}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Image or Icon */}
          {hasImage ? (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-zinc-700/30 bg-zinc-900/30">
              <img
                src={preset.referenceImageUrl}
                alt={preset.name}
                className="w-full h-full object-contain bg-zinc-900/50"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="w-full aspect-video rounded-lg border border-zinc-700/30 bg-zinc-900/30 flex items-center justify-center">
              <div className="text-zinc-500">{presetIcon}</div>
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4">
              <label className="block text-xs font-semibold text-zinc-400 font-mono mb-2 uppercase">
                Aspect Ratio
              </label>
              <p className="text-sm text-zinc-200 font-mono">{preset.aspectRatio}</p>
            </div>
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4">
              <label className="block text-xs font-semibold text-zinc-400 font-mono mb-2 uppercase">
                Type
              </label>
              <p className="text-sm text-zinc-200 font-mono uppercase">{preset.presetType}</p>
            </div>
          </div>

          {/* Prompt */}
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4">
            <label className="block text-xs font-semibold text-zinc-400 font-mono mb-2 uppercase">
              Prompt
            </label>
            <p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap">{preset.prompt}</p>
          </div>

          {/* Tags */}
          {preset.tags && preset.tags.length > 0 && (
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4">
              <label className="block text-xs font-semibold text-zinc-400 font-mono mb-2 uppercase">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {preset.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-zinc-800/40 rounded border border-zinc-700/20 text-zinc-400 font-mono text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-[#0F0F0F] border-t border-zinc-800/50 p-6 flex gap-3">
          <button
            onClick={onOpenInCanvas}
            className="flex items-center gap-2 flex-1 px-6 py-3 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 text-zinc-300 font-medium rounded-xl text-sm font-mono transition-all"
          >
            <ExternalLink className="h-4 w-4" />
            {t('communityPresets.openInCanvas')}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-zinc-900/50 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-600/50 font-medium rounded-xl text-sm font-mono transition-all"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommunityPresetsPage;

