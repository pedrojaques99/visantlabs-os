import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal, X, Heart, Layers } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import FuseLib from 'fuse.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Fuse: any = FuseLib;
import { PageShell } from '../components/ui/PageShell';
import { useLayout } from '@/hooks/useLayout';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import type { AspectRatio, GeminiModel } from '../types/types';
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
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ────────────────────────────────────────────────────────────────
const COMMUNITY_API = '/api/community/presets';
const PRESET_TYPES = ['all', 'mockup', 'angle', 'texture', 'ambience', 'luminance'] as const;
const PROMPT_CATEGORIES = Object.keys(CATEGORY_CONFIG) as PromptCategory[];

type SortKey = 'newest' | 'likes' | 'used';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'likes',  label: 'Most liked' },
  { value: 'used',   label: 'Most used' },
];

// ─── Fuse config ──────────────────────────────────────────────────────────────
const FUSE_OPTIONS = {
  keys: [
    { name: 'name',        weight: 0.45 },
    { name: 'description', weight: 0.30 },
    { name: 'tags',        weight: 0.15 },
    { name: 'prompt',      weight: 0.10 },
  ],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 2,
};

// ─── Types ────────────────────────────────────────────────────────────────────
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

type CommunityPreset = CommunityPrompt;

const generateSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
  + '-' + Math.random().toString(36).substring(2, 7);

const getInitialForm = (category: PromptCategory = 'presets', presetType?: LegacyPresetType): PresetFormData => ({
  category, presetType: category === 'presets' ? (presetType || 'mockup') : undefined,
  id: '', name: '', description: '', prompt: '', referenceImageUrl: '',
  aspectRatio: '16:9', model: GEMINI_MODELS.FLASH, tags: [],
  difficulty: 'intermediate', context: 'general',
});

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const PresetDetailModal: React.FC<{
  preset: CommunityPreset;
  currentUserId: string | null;
  isAuthenticated: boolean;
  isLiked: boolean;
  likesCount: number;
  onClose: () => void;
  onOpenInCanvas: () => void;
  onToggleLike?: () => void;
  onEdit?: () => void;
  t: (key: string) => string;
}> = ({ preset, currentUserId, isAuthenticated, isLiked, likesCount, onClose, onOpenInCanvas, onToggleLike, onEdit, t }) => {
  const migrated = migrateLegacyPreset(preset);
  const hasImage = !!migrated.referenceImageUrl;
  const config = CATEGORY_CONFIG[migrated.category] ?? CATEGORY_CONFIG['all'];
  const isOwner = currentUserId && migrated.userId && currentUserId === migrated.userId;
  const [copied, setCopied] = useState(false);

  const copyPrompt = () => {
    navigator.clipboard.writeText(migrated.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="bg-neutral-950 border border-white/[0.08] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-neutral-950/95 backdrop-blur-sm border-b border-white/[0.06] px-6 py-4 flex items-center gap-4 z-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100 font-mono truncate">{migrated.name}</h2>
            <p className="text-[11px] text-neutral-500 font-mono mt-0.5 truncate">{migrated.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated && onToggleLike && (
              <button onClick={onToggleLike}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-neutral-300 transition-colors text-[11px] font-mono">
                <Heart size={12} className={isLiked ? 'fill-current text-neutral-300' : ''} />
                {likesCount > 0 && likesCount}
              </button>
            )}
            {(isOwner || isAuthenticated) && onEdit && (
              <button onClick={onEdit}
                className="px-3 py-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-neutral-300 transition-colors text-[11px] font-mono">
                Edit
              </button>
            )}
            <button onClick={onClose}
              className="p-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-neutral-300 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col md:flex-row gap-6">
          {/* Image */}
          <div className="md:w-2/5 shrink-0">
            {hasImage ? (
              <img src={migrated.referenceImageUrl} alt={migrated.name} loading="lazy"
                className="w-full aspect-square object-cover rounded-xl border border-white/[0.06]"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-full aspect-square rounded-xl border border-white/[0.06] bg-neutral-900/30 flex items-center justify-center">
                <config.icon size={32} className={cn('opacity-20', config.color)} />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Meta chips */}
            <div className="flex flex-wrap gap-1.5">
              <span className={cn('text-[10px] font-mono px-2 py-1 rounded-lg border bg-white/[0.03] border-white/[0.06]', config.color)}>
                {config.label}
              </span>
              {migrated.aspectRatio && (
                <span className="text-[10px] font-mono px-2 py-1 rounded-lg border bg-white/[0.03] border-white/[0.06] text-neutral-600">
                  {migrated.aspectRatio}
                </span>
              )}
              {migrated.difficulty && (
                <span className="text-[10px] font-mono px-2 py-1 rounded-lg border bg-white/[0.03] border-white/[0.06] text-neutral-600">
                  {migrated.difficulty}
                </span>
              )}
            </div>

            {/* Prompt */}
            <div className="bg-neutral-900/40 border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-600">Prompt</span>
                <button onClick={copyPrompt}
                  className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-600 hover:text-neutral-300 transition-colors">
                  {copied ? <><span className="text-green-500">Copied</span></> : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-neutral-400 font-mono leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                {migrated.prompt}
              </p>
            </div>

            {/* Tags */}
            {migrated.tags && migrated.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {migrated.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-mono px-2 py-1 rounded-lg border bg-white/[0.02] border-white/[0.05] text-neutral-700">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-950/95 backdrop-blur-sm border-t border-white/[0.06] px-6 py-4 flex gap-3">
          <Button variant="surface" className="flex-1" onClick={onOpenInCanvas}>
            Open in Canvas
          </Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── CommunityPresetsPage ─────────────────────────────────────────────────────
export const CommunityPresetsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated: isUserAuthenticated, isCheckingAuth } = useLayout();
  const isAuthenticated = isUserAuthenticated === true;

  // ── State ──────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading]               = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [allPresets, setAllPresets]             = useState<CommunityPreset[]>([]);
  const [myPresets, setMyPresets]               = useState<CommunityPreset[]>([]);
  const [searchQuery, setSearchQuery]           = useState('');
  const [activeTab, setActiveTab]               = useState<PromptCategory>(() => {
    const p = searchParams.get('type');
    if (p && PROMPT_CATEGORIES.includes(p as PromptCategory)) return p as PromptCategory;
    if (p && PRESET_TYPES.includes(p as any)) return 'presets';
    return 'all';
  });
  const [filterTag, setFilterTag]               = useState<string | null>(null);
  const [sortKey, setSortKey]                   = useState<SortKey>('newest');
  const [viewMode, setViewMode]                 = useState<'all' | 'my'>(() =>
    searchParams.get('view') === 'my' ? 'my' : 'all'
  );
  const [currentUserId, setCurrentUserId]       = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset]     = useState<CommunityPreset | null>(null);
  const [editingPreset, setEditingPreset]       = useState<string | null>(null);
  const [isCreating, setIsCreating]             = useState(false);
  const [isEditModalOpen, setIsEditModalOpen]   = useState(false);
  const [formData, setFormData]                 = useState<PresetFormData>(getInitialForm());
  const [showAuthModal, setShowAuthModal]       = useState(false);
  const [duplicateOpen, setDuplicateOpen]       = useState(false);
  const [deleteOpen, setDeleteOpen]             = useState(false);
  const [presetToDelete, setPresetToDelete]     = useState<string | null>(null);
  const [presetToDuplicate, setPresetToDuplicate] = useState<CommunityPreset | null>(null);

  const isFetchingAllRef = useRef(false);
  const isFetchingMyRef  = useRef(false);
  const gridRef          = useRef<HTMLDivElement>(null);
  const searchRef        = useRef<HTMLInputElement>(null);

  // ── Auth user ID (once) ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { setCurrentUserId(null); return; }
    authService.verifyToken().then(u => setCurrentUserId(u?.id ?? null));
  }, [isAuthenticated]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (isFetchingAllRef.current) return;
    isFetchingAllRef.current = true;
    setIsLoading(true); setError(null);
    try {
      const grouped = await getAllCommunityPresets();
      const map = new Map<string, CommunityPreset>();
      Object.values(grouped).forEach(arr => arr?.forEach(p => {
        const m = migrateLegacyPreset(p);
        if (!map.has(m.id)) map.set(m.id, m);
      }));
      setAllPresets(Array.from(map.values()));
    } catch (e: any) {
      setError(e.message ?? t('communityPresets.errors.failedToLoad'));
    } finally { isFetchingAllRef.current = false; setIsLoading(false); }
  }, [t]);

  const fetchMy = useCallback(async () => {
    const token = authService.getToken();
    if (!token || isFetchingMyRef.current) return;
    isFetchingMyRef.current = true;
    setIsLoading(true); setError(null);
    try {
      const res = await fetch(`${COMMUNITY_API}/my`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(t('communityPresets.errors.failedToLoad'));
      const data: CommunityPreset[] = await res.json();
      setMyPresets(data.map(migrateLegacyPreset));
    } catch (e: any) {
      setError(e.message ?? t('communityPresets.errors.failedToLoad'));
    } finally { isFetchingMyRef.current = false; setIsLoading(false); }
  }, [t]);

  useEffect(() => {
    if (isCheckingAuth) return;
    if (viewMode === 'my' && isAuthenticated) fetchMy();
    else if (viewMode === 'all') fetchAll();
  }, [isCheckingAuth, isAuthenticated, viewMode, fetchAll, fetchMy]);

  // ── URL sync ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = searchParams.get('type');
    if (p && PROMPT_CATEGORIES.includes(p as PromptCategory)) setActiveTab(p as PromptCategory);
  }, [searchParams]);

  useEffect(() => { setFilterTag(null); }, [activeTab]);

  // ── Fuse instance ──────────────────────────────────────────────────────────
  const source = viewMode === 'my' ? myPresets : allPresets;

  const fuse = useMemo(() => new Fuse(source, FUSE_OPTIONS), [source]);

  // ── Filtering + search + sort ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = source;

    // Category
    if (activeTab !== 'all') items = items.filter(p => p.category === activeTab);

    // Tag
    if (filterTag) items = items.filter(p => p.tags?.includes(filterTag));

    // Search (Fuse)
    if (searchQuery.trim().length >= 2) {
      const fuseOnFiltered = new Fuse(items, FUSE_OPTIONS);
      items = fuseOnFiltered.search(searchQuery.trim()).map(r => r.item);
    }

    return items;
  }, [source, activeTab, filterTag, searchQuery]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case 'newest': return arr.sort((a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      case 'likes': return arr.sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0));
      case 'used':  return arr.sort((a, b) => (b.usageCount  ?? 0) - (a.usageCount  ?? 0));
    }
  }, [filtered, sortKey]);

  // ── Tags ───────────────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const base = activeTab === 'all' ? source : source.filter(p => p.category === activeTab);
    const counts = new Map<string, number>();
    base.forEach(p => p.tags?.forEach(tag => {
      if (tag?.trim()) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }));
    return Array.from(counts.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  }, [source, activeTab]);

  // ── Category counts ────────────────────────────────────────────────────────
  const sortedCategories = useMemo(() => {
    const counts = PROMPT_CATEGORIES.reduce((acc, cat) => {
      acc[cat] = cat === 'all' ? source.length : source.filter(p => p.category === cat).length;
      return acc;
    }, {} as Record<PromptCategory, number>);
    return ['all' as PromptCategory, ...PROMPT_CATEGORIES.filter(c => c !== 'all').sort((a, b) => counts[b] - counts[a])];
  }, [source]);

  // ── Virtual grid ──────────────────────────────────────────────────────────
  const COLS = 3; // TODO: make responsive with useMediaQuery
  const rowCount = Math.ceil(sorted.length / COLS);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => document.documentElement,
    estimateSize: () => 280,
    overscan: 4,
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTabChange = useCallback((cat: PromptCategory) => {
    setActiveTab(cat);
    navigate(`/community/presets?type=${cat}&view=${viewMode}`, { replace: true });
  }, [navigate, viewMode]);

  const handleViewMode = useCallback((mode: 'all' | 'my') => {
    setViewMode(mode);
    navigate(`/community/presets?type=${activeTab}&view=${mode}`, { replace: true });
  }, [navigate, activeTab]);

  const handleCreate = useCallback(() => {
    setIsCreating(true);
    setEditingPreset(null);
    setFormData(getInitialForm(activeTab === 'all' ? 'presets' : activeTab));
    setIsEditModalOpen(true);
  }, [activeTab]);

  const handleEdit = useCallback((preset: CommunityPreset) => {
    const m = migrateLegacyPreset(preset);
    setEditingPreset(m.id); setIsCreating(false);
    setFormData({ category: m.category, presetType: m.presetType, id: m.id, name: m.name,
      description: m.description, prompt: m.prompt, referenceImageUrl: m.referenceImageUrl ?? '',
      aspectRatio: m.aspectRatio, model: m.model, tags: m.tags ?? [],
      difficulty: m.difficulty, context: m.context, useCase: m.useCase, examples: m.examples });
    setIsEditModalOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsCreating(false); setEditingPreset(null);
    setFormData(getInitialForm()); setIsEditModalOpen(false);
  }, []);

  const handleSave = useCallback(async (data: PresetFormData) => {
    const token = authService.getToken();
    if (!token) throw new Error(t('communityPresets.errors.mustBeAuthenticatedToCreate'));
    setIsLoading(true); setError(null);
    try {
      const url  = isCreating ? COMMUNITY_API : `${COMMUNITY_API}/${editingPreset}`;
      const body: any = { category: data.category, id: data.id, name: data.name,
        description: data.description, prompt: data.prompt, aspectRatio: data.aspectRatio,
        tags: data.tags?.length ? data.tags : undefined };
      if (data.category === 'presets' && data.presetType) body.presetType = data.presetType;
      if (data.referenceImageUrl) body.referenceImageUrl = data.referenceImageUrl;
      if (data.difficulty) body.difficulty = data.difficulty;
      if (data.context)    body.context    = data.context;
      if (data.model)      body.model      = data.model;
      if (data.useCase)    body.useCase    = data.useCase;
      if (data.examples?.length) body.examples = data.examples;
      const res = await fetch(url, { method: isCreating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      clearCommunityPresetsCache();
      viewMode === 'my' ? await fetchMy() : await fetchAll();
      handleCancel();
      toast.success(isCreating ? t('communityPresets.messages.presetCreated') : t('communityPresets.messages.presetUpdated'));
    } catch (e: any) { throw e; } finally { setIsLoading(false); }
  }, [isCreating, editingPreset, viewMode, t, fetchMy, fetchAll, handleCancel]);

  const handleDelete = useCallback((id: string) => {
    setPresetToDelete(id); setDeleteOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!presetToDelete) return;
    const token = authService.getToken();
    if (!token) return;
    setDeleteOpen(false); setPresetToDelete(null); setIsLoading(true);
    try {
      const res = await fetch(`${COMMUNITY_API}/${presetToDelete}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error);
      clearCommunityPresetsCache();
      viewMode === 'my' ? await fetchMy() : await fetchAll();
      toast.success(t('communityPresets.messages.presetDeleted'));
    } catch (e: any) { setError(e.message); } finally { setIsLoading(false); }
  }, [presetToDelete, viewMode, t, fetchMy, fetchAll]);

  const handleConfirmDuplicate = useCallback(async () => {
    if (!presetToDuplicate) return;
    const token = authService.getToken();
    if (!token) { toast.error(t('communityPresets.errors.mustBeAuthenticated')); return; }
    setIsLoading(true);
    try {
      const m = migrateLegacyPreset(presetToDuplicate);
      const body: any = { category: m.category, id: generateSlug(m.name + '-copy'),
        name: `${m.name} (Copy)`, description: m.description, prompt: m.prompt,
        aspectRatio: m.aspectRatio, tags: m.tags, model: m.model };
      if (m.category === 'presets' && m.presetType) body.presetType = m.presetType;
      if (m.referenceImageUrl) body.referenceImageUrl = m.referenceImageUrl;
      if (m.difficulty) body.difficulty = m.difficulty;
      const res = await fetch(COMMUNITY_API, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      if (viewMode === 'my') await fetchMy();
      toast.success(t('communityPresets.messages.presetDuplicated') || 'Duplicated');
      setDuplicateOpen(false); setPresetToDuplicate(null);
    } catch (e: any) { toast.error(e.message); } finally { setIsLoading(false); }
  }, [presetToDuplicate, viewMode, t, fetchMy]);

  const updatePreset = useCallback((id: string, patch: Partial<CommunityPreset>) => {
    const mapper = (prev: CommunityPreset[]) => prev.map(p => p.id === id ? { ...p, ...patch } : p);
    viewMode === 'my' ? setMyPresets(mapper) : setAllPresets(mapper);
  }, [viewMode]);

  const handleToggleLike = useCallback(async (id: string) => {
    const token = authService.getToken();
    if (!token) { toast.error(t('communityPresets.errors.mustBeAuthenticated')); return; }
    const preset = source.find(p => p.id === id);
    if (!preset) return;
    const wasLiked = preset.isLikedByUser ?? false;
    const wasCount = preset.likesCount ?? 0;
    updatePreset(id, { isLikedByUser: !wasLiked, likesCount: wasLiked ? Math.max(0, wasCount - 1) : wasCount + 1 });
    try {
      const res = await fetch(`${COMMUNITY_API}/${id}/like`, { method: 'POST',
        headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      updatePreset(id, { isLikedByUser: data.isLikedByUser, likesCount: data.likesCount });
    } catch { updatePreset(id, { isLikedByUser: wasLiked, likesCount: wasCount }); }
  }, [source, updatePreset, t]);

  // ── Keyboard shortcut (/) to focus search ─────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const headerActions = (
    <div className="flex items-center gap-2">
      {/* View toggle */}
      <div className="flex bg-white/[0.03] p-0.5 rounded-lg border border-white/[0.06]">
        {(['all', 'my'] as const).map(mode => (
          <button key={mode}
            onClick={() => handleViewMode(mode)}
            className={cn('px-3 py-1.5 rounded-md text-xs font-mono transition-all',
              viewMode === mode ? 'bg-white/[0.08] text-neutral-200' : 'text-neutral-600 hover:text-neutral-400'
            )}>
            {mode === 'all' ? t('communityPresets.tabs.all') || 'All' : t('communityPresets.tabs.my') || 'My'}
          </button>
        ))}
      </div>

      {isAuthenticated && (
        <Button variant="brand" size="sm" onClick={handleCreate} className="gap-1.5">
          <Plus size={13} />
          {t('communityPresets.buttons.create') || 'Create'}
        </Button>
      )}
    </div>
  );

  return (
    <PageShell
      pageId="community-presets"
      seoTitle={viewMode === 'my' ? 'My Presets' : t('communityPresets.title')}
      title={viewMode === 'my' ? 'My Presets' : t('communityPresets.title')}
      microTitle="Community // Library"
      description={t('communityPresets.subtitle')}
      breadcrumb={[
        { label: t('common.home') || 'Home', to: '/' },
        { label: t('common.community') || 'Community', to: '/community' },
        { label: t('common.presets') || 'Presets' },
      ]}
      actions={headerActions}
    >
      <div className="space-y-4">
        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search presets… ( / )"
              className="w-48 focus:w-64 pl-8 pr-8 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs font-mono text-neutral-300 placeholder:text-neutral-700 focus:outline-none focus:border-white/10 transition-all duration-200"
              aria-label="Search presets"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400 transition-colors">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sort */}
          <Select
            value={sortKey}
            onChange={(v) => setSortKey(v as SortKey)}
            options={SORT_OPTIONS}
            className="w-36 text-xs"
          />

          {/* Count */}
          <span className="text-[11px] font-mono text-neutral-700 shrink-0">
            {sorted.length} preset{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <CommunityPresetsSidebar
          activeCategory={activeTab}
          onCategoryChange={handleTabChange}
          allTags={allTags}
          filterTag={filterTag}
          onFilterTagChange={setFilterTag}
          currentPresetsCount={sorted.length}
          categories={sortedCategories}
          t={t}
        />

        {/* ── Auth gate ─────────────────────────────────────────────────────── */}
        {viewMode === 'my' && !isAuthenticated && !isCheckingAuth && (
          <div className="py-20 flex flex-col items-center gap-4">
            <p className="text-sm font-mono text-neutral-600">{t('communityPresets.errors.mustBeAuthenticated')}</p>
            <Button variant="surface" size="sm" onClick={() => setShowAuthModal(true)}>
              {t('header.register') || 'Sign in'}
            </Button>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {isLoading && sorted.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/[0.04] bg-neutral-900/20 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-neutral-900/50" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-neutral-800/50 rounded w-3/4" />
                  <div className="h-2.5 bg-neutral-800/30 rounded w-full" />
                  <div className="h-2.5 bg-neutral-800/30 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!isLoading && sorted.length === 0 && (viewMode === 'all' || isAuthenticated) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-[280px] flex flex-col items-center justify-center gap-6 border border-white/[0.03] rounded-3xl bg-neutral-950/20"
          >
            <div className="p-6 rounded-full bg-white/[0.02] border border-white/[0.04]">
              <Layers size={28} strokeWidth={1} className="text-neutral-700" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-700">
                {searchQuery ? `No results for "${searchQuery}"` : 'No presets yet'}
              </p>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="font-mono text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors underline underline-offset-2">
                  Clear search
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Virtual Grid ─────────────────────────────────────────────────── */}
        {!isLoading && sorted.length > 0 && (
          <div ref={gridRef}>
            <div
              style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
            >
              {virtualizer.getVirtualItems().map((vRow) => {
                const startIdx = vRow.index * COLS;
                const rowItems = sorted.slice(startIdx, startIdx + COLS);

                return (
                  <div
                    key={vRow.key}
                    data-index={vRow.index}
                    ref={virtualizer.measureElement}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%',
                      transform: `translateY(${vRow.start}px)` }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4"
                  >
                    {rowItems.map((preset) => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        currentUserId={currentUserId}
                        onClick={() => setSelectedPreset(preset)}
                        onEdit={isAuthenticated ? () => handleEdit(preset) : undefined}
                        onDelete={viewMode === 'my' ? () => handleDelete(preset.id) : undefined}
                        onDuplicate={isAuthenticated ? () => { setPresetToDuplicate(preset); setDuplicateOpen(true); } : undefined}
                        onToggleLike={isAuthenticated ? () => handleToggleLike(preset.id) : undefined}
                        isAuthenticated={isAuthenticated}
                        canEdit={viewMode === 'my'}
                        t={t}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <CommunityPresetModal
        isOpen={isEditModalOpen}
        onClose={handleCancel}
        onSave={handleSave}
        initialData={formData}
        isCreating={isCreating}
      />

      {showAuthModal && (
        <AuthModal isOpen onClose={() => setShowAuthModal(false)}
          onSuccess={() => { setShowAuthModal(false); fetchMy(); }}
          defaultIsSignUp={true} />
      )}

      <ConfirmationModal
        isOpen={duplicateOpen}
        onClose={() => { setDuplicateOpen(false); setPresetToDuplicate(null); }}
        onConfirm={handleConfirmDuplicate}
        title="Duplicate Preset"
        message="Duplicate this preset into your collection?"
        confirmText="Duplicate"
        cancelText={t('common.cancel')}
        variant="info"
      />

      <ConfirmationModal
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setPresetToDelete(null); }}
        onConfirm={handleConfirmDelete}
        title={t('communityPresets.actions.deleteConfirm') || 'Delete Preset'}
        message={t('communityPresets.messages.presetDeleteConfirm') || 'This action cannot be undone.'}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
      />

      <AnimatePresence>
        {selectedPreset && (
          <PresetDetailModal
            preset={selectedPreset}
            currentUserId={currentUserId}
            isAuthenticated={isAuthenticated}
            isLiked={selectedPreset.isLikedByUser ?? false}
            likesCount={selectedPreset.likesCount ?? 0}
            onClose={() => setSelectedPreset(null)}
            onOpenInCanvas={() => {
              try {
                const m = migrateLegacyPreset(selectedPreset);
                localStorage.setItem('import-community-preset', JSON.stringify(m));
                navigate('/canvas');
                setSelectedPreset(null);
              } catch { toast.error(t('communityPresets.errors.failedToLoad')); }
            }}
            onToggleLike={() => handleToggleLike(selectedPreset.id)}
            onEdit={() => { handleEdit(selectedPreset); setSelectedPreset(null); }}
            t={t}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
};

export default CommunityPresetsPage;
