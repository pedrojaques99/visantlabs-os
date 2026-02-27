import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Plus, Edit2, Trash2, X, Save, Upload, Image as ImageIcon, Camera, Layers, MapPin, Sun, RefreshCw, Settings, Users, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { DataTable } from '../components/ui/data-table';
import { DataTableEditableCell } from '../components/ui/data-table-editable-cell';
import { ColumnDef } from '@tanstack/react-table';
import { CATEGORY_CONFIG } from '@/components/PresetCard';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { AdminImageUploader } from '../components/ui/AdminImageUploader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
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
import type { MockupPreset } from '../types/mockupPresets';
import { MOCKUP_PRESETS } from '../types/mockupPresets';
import type { AnglePreset } from '../types/anglePresets';
import { ANGLE_PRESETS } from '../types/anglePresets';
import type { TexturePreset } from '../types/texturePresets';
import { TEXTURE_PRESETS } from '../types/texturePresets';
import type { AmbiencePreset } from '../types/ambiencePresets';
import { AMBIENCE_PRESETS } from '../types/ambiencePresets';
import type { LuminancePreset } from '../types/luminancePresets';
import { LUMINANCE_PRESETS } from '../types/luminancePresets';
import type { AspectRatio, GeminiModel, UploadedImage } from '../types/types';
import { cn } from '../lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import type { BrandingPreset } from '../types/brandingPresets';
import { BRANDING_PRESETS } from '../types/brandingPresets';
import type { EffectPreset } from '../types/effectPresets';
import { EFFECT_PRESETS } from '../types/effectPresets';
import {
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_MATERIAL_TAGS,
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_BRANDING_TAGS,
  AVAILABLE_EFFECT_TAGS
} from '@/utils/mockupConstants';
import { PresetCard } from '@/components/PresetCard';
import { migrateLegacyPreset } from '@/types/communityPrompts';
import type { CommunityPrompt } from '@/types/communityPrompts';

const ADMIN_API = '/api/admin/presets';

const ASPECT_RATIOS: AspectRatio[] = ['9:16', '21:9', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '16:9', '1:1'];
const GEMINI_MODELS: GeminiModel[] = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];

interface PresetsData {
  mockupPresets: MockupPreset[];
  anglePresets: AnglePreset[];
  texturePresets: TexturePreset[];
  ambiencePresets: AmbiencePreset[];
  luminancePresets: LuminancePreset[];
  brandingPresets: BrandingPreset[];
  effectPresets: EffectPreset[];
}

type PresetType = 'all' | 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance' | 'branding' | 'effect';

interface PresetFormData {
  id: string;
  name: string;
  description: string;
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[];
  mockupCategoryId?: string;
}

export const AdminPresetsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated: isUserAuthenticated, isCheckingAuth } = useLayout();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<PresetsData | null>(null);
  const [activeTab, setActiveTab] = useState<PresetType>('all');
  const [editingPreset, setEditingPreset] = useState<{ type: PresetType; id: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<PresetFormData>({
    id: '',
    name: '',
    description: '',
    prompt: '',
    referenceImageUrl: '',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
    tags: [],
    mockupCategoryId: '',
  });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchJson, setBatchJson] = useState('');
  const [batchResult, setBatchResult] = useState<{
    created: number;
    failed: number;
    errors: Array<{ index: number; id?: string; error: string }>;
  } | null>(null);
  const [isValidatingJson, setIsValidatingJson] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [mockupCategories, setMockupCategories] = useState<{ id: string; name: string }[]>([]);



  // Check if user is admin and load data
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (isCheckingAuth) return;

      if (isUserAuthenticated === true) {
        try {
          const user = await authService.verifyToken();
          const userIsAdmin = user?.isAdmin || false;
          setIsAdmin(userIsAdmin);

          // Load data if user is admin
          if (userIsAdmin) {
            handleFetch();
          }
        } catch (error) {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [isUserAuthenticated, isCheckingAuth]);

  // Handle ESC key to close edit modal
  useEffect(() => {
    if (!isEditModalOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCreating(false);
        setEditingPreset(null);
        setFormData({
          id: '',
          name: '',
          description: '',
          prompt: '',
          referenceImageUrl: '',
          aspectRatio: '16:9',
          model: 'gemini-2.5-flash-image',
          mockupCategoryId: '',
        });
        setImageUploadError(null);
        setIsEditModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isEditModalOpen]);

  const isAuthenticated = isUserAuthenticated === true && isAdmin === true;

  const handleInlineSave = async (preset: CommunityPrompt, field: string, value: string) => {
    // Optimistic check: if value hasn't changed, do nothing
    if ((preset as any)[field] === value) return;

    const token = authService.getToken();
    if (!token) {
      toast.error(t('adminPresets.unauthorized'));
      return;
    }

    const type = (preset as any).category || 'mockup';
    const id = preset.id;

    try {
      const body: any = {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        prompt: preset.prompt,
        aspectRatio: preset.aspectRatio,
        model: preset.model,
        tags: preset.tags,
        referenceImageUrl: preset.referenceImageUrl,
        mockupCategoryId: preset.mockupCategoryId
      };

      // Update the modified field
      body[field] = value;

      const response = await fetch(`${ADMIN_API}/${type}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(t('adminPresets.saveError'));
      }

      toast.success(t('adminPresets.saveSuccess'));
      handleFetch(); // Refresh data
    } catch (error) {
      toast.error(t('adminPresets.saveError'));
      console.error(error);
    }
  };

  const handleInlineSaveCategory = async (preset: CommunityPrompt, field: string, value: any) => {
    // This specifically handles choice from select dropdown
    const token = authService.getToken();
    if (!token) {
      toast.error(t('adminPresets.unauthorized'));
      return;
    }

    const type = (preset as any).category || 'mockup';
    const id = preset.id;

    try {
      const body: any = {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        prompt: preset.prompt,
        aspectRatio: preset.aspectRatio,
        model: preset.model,
        tags: preset.tags,
        referenceImageUrl: preset.referenceImageUrl,
        mockupCategoryId: preset.mockupCategoryId
      };

      // Update the modified field
      body[field] = value;

      const response = await fetch(`${ADMIN_API}/${type}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(t('adminPresets.saveError'));
      }

      toast.success(t('adminPresets.saveSuccess'));
      handleFetch(); // Refresh data
    } catch (error) {
      toast.error(t('adminPresets.saveError'));
      console.error(error);
    }
  };



  const columns = useMemo<ColumnDef<CommunityPrompt>[]>(() => [
    {
      accessorKey: "referenceImageUrl",
      header: t('adminPresets.table.image'),
      cell: ({ row }) => {
        const imageUrl = row.getValue("referenceImageUrl") as string;
        const category = row.original.category;
        const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['presets'];
        const Icon = config.icon;

        return (
          <div className="w-10 h-10 rounded overflow-hidden bg-neutral-800 flex items-center justify-center group relative">
            {imageUrl ? (
              <>
                <img src={imageUrl} alt={row.getValue("name")} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-neutral-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => {
                  handleEdit((row.original.category as PresetType) || 'mockup', row.original as any);
                }}>
                  <Edit2 className="w-4 h-4 text-white" />
                </div>
              </>
            ) : (
              <Icon className={cn("w-5 h-5", config.color)} />
            )}
          </div>
        );
      },
      enableSorting: false,
      size: 60,
    },
    {
      accessorKey: "id",
      header: t('adminPresets.table.id'),
      cell: ({ row }) => <span className="font-mono text-xs text-neutral-400 select-all">{row.getValue("id")}</span>,
      size: 100,
    },
    {
      accessorKey: "name",
      header: t('adminPresets.table.name'),
      cell: ({ row }) => <DataTableEditableCell row={row} field="name" className="font-medium" onSave={handleInlineSave} />,
      size: 150,
    },
    {
      accessorKey: "description",
      header: t('adminPresets.descriptionRequired'), // Using existing key or fallback
      cell: ({ row }) => <DataTableEditableCell row={row} field="description" className="text-xs text-neutral-400" onSave={handleInlineSave} />,
      size: 200,
    },
    {
      accessorKey: "prompt",
      header: t('adminPresets.promptRequired'),
      cell: ({ row }) => <DataTableEditableCell row={row} field="prompt" type="textarea" className="font-mono text-[10px] text-neutral-500 line-clamp-2" onSave={handleInlineSave} />,
      size: 300,
    },
    {
      accessorKey: "category",
      header: "Tipo",
      cell: ({ row }) => {
        const category = row.original.category;
        const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['presets'];
        return (
          <Badge variant="outline" className="bg-neutral-900/50 border-neutral-800">
            <span className={cn("flex items-center gap-1.5", config.color)}>
              {React.createElement(config.icon, { className: "w-3 h-3" })}
              {config.label}
            </span>
          </Badge>
        );
      },
      size: 100,
    },
    {
      accessorKey: "mockupCategoryId",
      header: "Categoria Mockup",
      cell: ({ row }) => {
        if (row.original.category !== 'mockup') return null;
        return (
          <DataTableEditableCell
            row={row}
            field="mockupCategoryId"
            type="select"
            options={mockupCategories.map(c => ({
              value: c.id,
              label: t(`mockup.categoryGroups.${c.name}`, { defaultValue: c.name })
            }))}
            onSave={handleInlineSaveCategory}
          />
        );
      },
      size: 150,
    },
    {
      accessorKey: "model",
      header: t('adminPresets.table.model'),
      cell: ({ row }) => {
        const model = row.original.model;
        if (!model) return null;
        return (
          <Badge variant="secondary" className="text-[10px] h-5 bg-neutral-800 text-neutral-400 hover:bg-neutral-700">
            {model.includes('flash') ? 'HD' : '4K'}
          </Badge>
        );
      },
      size: 80,
    },
    {
      id: "actions",
      header: t('adminPresets.table.actions'),
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800"
              onClick={() => handleEdit((row.original.category as PresetType) || 'mockup', row.original as any)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-neutral-800"
              onClick={() => handleDelete((row.original.category as PresetType) || 'mockup', row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
      size: 100,
    },
  ], [t, mockupCategories]);

  const handleFetch = async () => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado para acessar esta página.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(ADMIN_API, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(t('admin.accessDenied'));
        }
        throw new Error(t('admin.failedToLoadData'));
      }

      const result = (await response.json()) as PresetsData;
      setData(result);

      // Fetch categories
      const categoriesResponse = await fetch('/api/mockup-tags/categories', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (categoriesResponse.ok) {
        const categoriesResult = await categoriesResponse.json();
        setMockupCategories(categoriesResult.map((c: any) => ({
          id: c.id || c._id,
          name: c.name
        })));
      }
    } catch (fetchError: any) {
      console.error('Erro ao carregar dados do admin:', fetchError);
      setData(null);
      setError(fetchError.message || 'Erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    handleFetch();
  };

  const handleEdit = (type: PresetType, preset: MockupPreset | AnglePreset | TexturePreset | AmbiencePreset | LuminancePreset | BrandingPreset | EffectPreset) => {
    setEditingPreset({ type, id: preset.id });
    setIsCreating(false);
    setFormData({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      prompt: preset.prompt,
      referenceImageUrl: 'referenceImageUrl' in preset ? preset.referenceImageUrl : undefined,
      aspectRatio: preset.aspectRatio,
      model: preset.model,
      tags: preset.tags || [],
    });
    setTagInput('');
    setIsEditModalOpen(true);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingPreset(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      prompt: '',
      referenceImageUrl: '',
      aspectRatio: '16:9',
      model: 'gemini-2.5-flash-image',
      tags: [],
    });
    setTagInput('');
    setIsEditModalOpen(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingPreset(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      prompt: '',
      referenceImageUrl: '',
      aspectRatio: '16:9',
      model: 'gemini-2.5-flash-image',
      tags: [],
    });
    setTagInput('');
    setImageUploadError(null);
    setIsEditModalOpen(false);
  };

  const handleImageUpload = async (image: UploadedImage) => {
    const token = authService.getToken();
    if (!token) {
      setImageUploadError('Você precisa estar autenticado como administrador.');
      return;
    }

    if (!formData.id || formData.id.trim() === '') {
      setImageUploadError('Por favor, defina o ID do preset antes de fazer upload da imagem.');
      return;
    }

    if (!image.base64) {
      setImageUploadError('Imagem inválida. Por favor, tente novamente.');
      return;
    }

    setIsUploadingImage(true);
    setImageUploadError(null);

    try {
      const response = await fetch(`${ADMIN_API}/mockup/${formData.id}/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ base64Image: image.base64 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || t('adminPresets.failedToUploadImage'));
      }

      const { url } = await response.json();
      setFormData({ ...formData, referenceImageUrl: url });
    } catch (uploadError: any) {
      setImageUploadError(uploadError.message || 'Erro ao fazer upload da imagem.');
      console.error('Error uploading image:', uploadError);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = async () => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado como administrador.');
      return;
    }

    if (!formData.id || !formData.name || !formData.description || !formData.prompt) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const type = isCreating ? (activeTab === 'all' ? 'mockup' : activeTab) : editingPreset?.type;

      if (!type) {
        throw new Error('Tipo de preset inválido.');
      }

      const url = isCreating
        ? `${ADMIN_API}/${type}`
        : `${ADMIN_API}/${type}/${editingPreset?.id}`;
      const method = isCreating ? 'POST' : 'PUT';

      const body: any = {
        id: formData.id,
        name: formData.name,
        description: formData.description,
        prompt: formData.prompt,
        aspectRatio: formData.aspectRatio,
        model: formData.model,
        tags: formData.tags && formData.tags.length > 0 ? formData.tags : undefined,
        mockupCategoryId: formData.mockupCategoryId || undefined,
      };

      if (type === 'mockup' && formData.referenceImageUrl !== undefined) {
        body.referenceImageUrl = formData.referenceImageUrl;
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
        throw new Error(errorData.error || t('adminPresets.failedToSavePreset'));
      }

      await handleFetch();
      handleCancel();
      setIsEditModalOpen(false);
    } catch (saveError: any) {
      setError(saveError.message || 'Erro ao salvar preset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (type: PresetType, id: string) => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado como administrador.');
      return;
    }

    if (!confirm('Tem certeza que deseja deletar este preset?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${ADMIN_API}/${type}/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('adminPresets.failedToDeletePreset'));
      }

      await handleFetch();
    } catch (deleteError: any) {
      setError(deleteError.message || 'Erro ao deletar preset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBatchModal = () => {
    if (activeTab !== 'mockup') {
      setError('Batch upload está disponível apenas para Mockup Presets.');
      return;
    }
    setIsBatchModalOpen(true);
    setBatchJson('');
    setBatchResult(null);
    setError(null);
  };

  const handleCloseBatchModal = () => {
    setIsBatchModalOpen(false);
    setBatchJson('');
    setBatchResult(null);
    setError(null);
  };

  const validateBatchJson = (): { valid: boolean; presets?: any[]; error?: string } => {
    if (!batchJson.trim()) {
      return { valid: false, error: 'JSON não pode estar vazio.' };
    }

    try {
      const parsed = JSON.parse(batchJson);

      if (!Array.isArray(parsed)) {
        return { valid: false, error: 'JSON deve ser um array de presets.' };
      }

      if (parsed.length === 0) {
        return { valid: false, error: 'Array não pode estar vazio.' };
      }

      const validAspectRatios = ['9:16', '21:9', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '16:9', '1:1'];
      const validModels = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];

      for (let i = 0; i < parsed.length; i++) {
        const preset = parsed[i];
        const index = i + 1;

        if (!preset.id || typeof preset.id !== 'string') {
          return { valid: false, error: `Preset ${index}: campo 'id' é obrigatório e deve ser uma string.` };
        }

        if (!preset.name || typeof preset.name !== 'string') {
          return { valid: false, error: `Preset ${index} (${preset.id}): campo 'name' é obrigatório e deve ser uma string.` };
        }

        if (!preset.description || typeof preset.description !== 'string') {
          return { valid: false, error: `Preset ${index} (${preset.id}): campo 'description' é obrigatório e deve ser uma string.` };
        }

        if (!preset.prompt || typeof preset.prompt !== 'string') {
          return { valid: false, error: `Preset ${index} (${preset.id}): campo 'prompt' é obrigatório e deve ser uma string.` };
        }

        if (!preset.aspectRatio || typeof preset.aspectRatio !== 'string') {
          return { valid: false, error: `Preset ${index} (${preset.id}): campo 'aspectRatio' é obrigatório e deve ser uma string.` };
        }

        if (!validAspectRatios.includes(preset.aspectRatio)) {
          return { valid: false, error: `Preset ${index} (${preset.id}): aspectRatio inválido. Valores válidos: ${validAspectRatios.join(', ')}.` };
        }

        if (preset.model && !validModels.includes(preset.model)) {
          return { valid: false, error: `Preset ${index} (${preset.id}): model inválido. Valores válidos: ${validModels.join(', ')}.` };
        }
      }

      // Check for duplicate IDs
      const ids = parsed.map((p: any) => p.id);
      const duplicateIds = ids.filter((id: string, index: number) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        return { valid: false, error: `IDs duplicados encontrados: ${[...new Set(duplicateIds)].join(', ')}.` };
      }

      return { valid: true, presets: parsed };
    } catch (parseError: any) {
      return { valid: false, error: `JSON inválido: ${parseError.message}` };
    }
  };

  const handleValidateJson = () => {
    const validation = validateBatchJson();
    if (validation.valid) {
      setError(null);
      alert(t('adminPresets.validJson', { count: validation.presets?.length || 0 }));
    } else {
      setError(validation.error || t('adminPresets.validationError'));
    }
  };

  const handleBatchUpload = async () => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado como administrador.');
      return;
    }

    const validation = validateBatchJson();
    if (!validation.valid || !validation.presets) {
      setError(validation.error || 'JSON inválido. Por favor, corrija os erros antes de enviar.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setBatchResult(null);

    try {
      const response = await fetch(`${ADMIN_API}/mockup/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ presets: validation.presets }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('adminPresets.failedToSendBatch'));
      }

      const result = await response.json();
      setBatchResult(result);

      if (result.created > 0) {
        await handleFetch();
      }
    } catch (batchError: any) {
      setError(batchError.message || 'Erro ao enviar batch.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePopulateFromDefaults = async () => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado como administrador.');
      return;
    }

    if (activeTab !== 'mockup') {
      setError('Popular presets padrão está disponível apenas para Mockup Presets.');
      return;
    }

    if (!confirm(`Tem certeza que deseja importar ${MOCKUP_PRESETS.length} preset(s) padrão do TypeScript?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setBatchResult(null);

    try {
      const response = await fetch(`${ADMIN_API}/mockup/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ presets: MOCKUP_PRESETS }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('adminPresets.failedToImportPresets'));
      }

      const result = await response.json();
      setBatchResult(result);

      if (result.created > 0) {
        await handleFetch();
        setError(null);
        // Show success message
        setTimeout(() => {
          setBatchResult(null);
        }, 5000);
      } else if (result.failed > 0) {
        setError(`Importação concluída com ${result.failed} erro(s). Verifique os detalhes.`);
      }
    } catch (populateError: any) {
      setError(populateError.message || 'Erro ao importar presets padrão.');
      setBatchResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePopulateAngleFromDefaults = async () => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado como administrador.');
      return;
    }

    if (activeTab !== 'angle') {
      setError('Popular presets padrão está disponível apenas para Angle Presets.');
      return;
    }

    if (!confirm(`Tem certeza que deseja importar ${ANGLE_PRESETS.length} preset(s) padrão do TypeScript?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setBatchResult(null);

    const errors: Array<{ index: number; id?: string; error: string }> = [];
    let created = 0;

    try {
      // Create presets one by one (no batch endpoint for angle presets)
      const promises = ANGLE_PRESETS.map(async (preset, index) => {
        try {
          const response = await fetch(`${ADMIN_API}/angle`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              id: preset.id,
              name: preset.name,
              description: preset.description,
              prompt: preset.prompt,
              aspectRatio: preset.aspectRatio,
              model: preset.model,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || t('adminPresets.failedToCreatePreset'));
          }

          created++;
        } catch (error: any) {
          errors.push({
            index: index + 1,
            id: preset.id,
            error: error.message || 'Erro ao criar preset.',
          });
        }
      });

      await Promise.all(promises);

      const result = {
        created,
        failed: errors.length,
        errors,
      };

      setBatchResult(result);

      if (result.created > 0) {
        await handleFetch();
        setError(null);
        // Show success message
        setTimeout(() => {
          setBatchResult(null);
        }, 5000);
      } else if (result.failed > 0) {
        setError(`Importação concluída com ${result.failed} erro(s). Verifique os detalhes.`);
      }
    } catch (populateError: any) {
      setError(populateError.message || 'Erro ao importar presets padrão.');
      setBatchResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePopulateTextureFromDefaults = async () => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado como administrador.');
      return;
    }

    if (activeTab !== 'texture') {
      setError('Popular presets padrão está disponível apenas para Texture Presets.');
      return;
    }

    if (!confirm(`Tem certeza que deseja importar ${TEXTURE_PRESETS.length} preset(s) padrão do TypeScript?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setBatchResult(null);

    try {
      let created = 0;
      let failed = 0;
      const errors: Array<{ index: number; id?: string; error: string }> = [];

      for (let i = 0; i < TEXTURE_PRESETS.length; i++) {
        const preset = TEXTURE_PRESETS[i];
        try {
          const response = await fetch(`${ADMIN_API}/texture`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(preset),
          });

          if (response.ok) {
            created++;
          } else {
            failed++;
            const errorData = await response.json();
            errors.push({ index: i, id: preset.id, error: errorData.error || t('common.unknownError') });
          }
        } catch (error: any) {
          failed++;
          errors.push({ index: i, id: preset.id, error: error.message || t('common.unknownError') });
        }
      }

      setBatchResult({ created, failed, errors });
      await handleFetch();
      toast.success(t('adminPresets.importedSuccess', { count: created }));
    } catch (error: any) {
      setError(error.message || 'Erro ao importar presets padrão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePopulateAmbienceFromDefaults = async () => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado como administrador.');
      return;
    }

    if (activeTab !== 'ambience') {
      setError('Popular presets padrão está disponível apenas para Ambience Presets.');
      return;
    }

    if (!confirm(`Tem certeza que deseja importar ${AMBIENCE_PRESETS.length} preset(s) padrão do TypeScript?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setBatchResult(null);

    try {
      let created = 0;
      let failed = 0;
      const errors: Array<{ index: number; id?: string; error: string }> = [];

      for (let i = 0; i < AMBIENCE_PRESETS.length; i++) {
        const preset = AMBIENCE_PRESETS[i];
        try {
          const response = await fetch(`${ADMIN_API}/ambience`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(preset),
          });

          if (response.ok) {
            created++;
          } else {
            failed++;
            const errorData = await response.json();
            errors.push({ index: i, id: preset.id, error: errorData.error || t('common.unknownError') });
          }
        } catch (error: any) {
          failed++;
          errors.push({ index: i, id: preset.id, error: error.message || t('common.unknownError') });
        }
      }

      setBatchResult({ created, failed, errors });
      await handleFetch();
      toast.success(t('adminPresets.importedSuccess', { count: created }));
    } catch (error: any) {
      setError(error.message || 'Erro ao importar presets padrão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePopulateLuminanceFromDefaults = async () => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado como administrador.');
      return;
    }

    if (activeTab !== 'luminance') {
      setError('Popular presets padrão está disponível apenas para Luminance Presets.');
      return;
    }

    if (!confirm(`Tem certeza que deseja importar ${LUMINANCE_PRESETS.length} preset(s) padrão do TypeScript?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setBatchResult(null);

    try {
      let created = 0;
      let failed = 0;
      const errors: Array<{ index: number; id?: string; error: string }> = [];

      for (let i = 0; i < LUMINANCE_PRESETS.length; i++) {
        const preset = LUMINANCE_PRESETS[i];
        try {
          const response = await fetch(`${ADMIN_API}/luminance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(preset),
          });

          if (response.ok) {
            created++;
          } else {
            failed++;
            const errorData = await response.json();
            errors.push({ index: i, id: preset.id, error: errorData.error || t('common.unknownError') });
          }
        } catch (error: any) {
          failed++;
          errors.push({ index: i, id: preset.id, error: error.message || t('common.unknownError') });
        }
      }

      setBatchResult({ created, failed, errors });
      await handleFetch();
      toast.success(t('adminPresets.importedSuccess', { count: created }));
    } catch (error: any) {
      setError(error.message || 'Erro ao importar presets padrão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePopulateFromTags = async () => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado como administrador.');
      return;
    }

    let tags: string[] = [];
    let endpoint = '';

    // Map active tab to tags and endpoint
    switch (activeTab) {
      case 'angle':
        tags = AVAILABLE_ANGLE_TAGS;
        endpoint = 'angle';
        break;
      case 'texture':
        tags = AVAILABLE_MATERIAL_TAGS; // Material tags map to textures
        endpoint = 'texture';
        break;
      case 'ambience':
        tags = AVAILABLE_LOCATION_TAGS; // Location tags map to ambience
        endpoint = 'ambience';
        break;
      case 'luminance':
        tags = AVAILABLE_LIGHTING_TAGS; // Lighting tags map to luminance
        endpoint = 'luminance';
        break;
      case 'branding':
        tags = AVAILABLE_BRANDING_TAGS;
        endpoint = 'branding';
        break;
      case 'effect':
        tags = AVAILABLE_EFFECT_TAGS;
        endpoint = 'effect';
        break;
      default:
        setError('Esta categoria não suporta população por tags.');
        return;
    }

    if (!confirm(t('adminPresets.confirmPopulate', { count: tags.length }))) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setBatchResult(null);

    try {
      let created = 0;
      let failed = 0;
      const errors: Array<{ index: number; id?: string; error: string }> = [];

      // Create presets from tags
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        // Generate ID from tag (kebab-case)
        const id = tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const presetData = {
          id,
          name: tag,
          description: tag, // Default description
          prompt: tag, // Default prompt is the tag itself
          // Add default values if needed based on type, but backend usually handles optional fields
          // For now sending minimal required fields
        };

        try {
          const response = await fetch(`${ADMIN_API}/${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(presetData),
          });

          if (response.ok) {
            created++;
          } else {
            // If it failed, check if it's because it already exists (409 Conflict) - we count as success/skipped or fail?
            // Usually we just want to know if it *failed* to be created. 
            // If it exists, we might just skip. 
            // For now, let's log fail but usually user wants to fill missing ones.
            failed++;
            const errorData = await response.json();
            errors.push({ index: i, id, error: errorData.error || t('common.unknownError') });
          }
        } catch (error: any) {
          failed++;
          errors.push({ index: i, id, error: error.message || t('common.unknownError') });
        }
      }

      setBatchResult({ created, failed, errors });
      await handleFetch();
      if (created > 0) {
        toast.success(t('adminPresets.importedSuccess', { count: created }));
      } else if (failed > 0) {
        toast.error(`Falha: ${failed} itens não puderam ser criados (podem já existir).`);
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao popular presets.');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate presets with category for "all" view and easy filtering
  const allPresetsWithCategory = useMemo(() => {
    if (!data) return [];

    const mockups = (data.mockupPresets || []).map(p => ({ ...p, category: 'mockup' as const }));
    const angles = (data.anglePresets || []).map(p => ({ ...p, category: 'angle' as const }));
    const textures = (data.texturePresets || []).map(p => ({ ...p, category: 'texture' as const }));
    const ambiences = (data.ambiencePresets || []).map(p => ({ ...p, category: 'ambience' as const }));
    const luminances = (data.luminancePresets || []).map(p => ({ ...p, category: 'luminance' as const }));
    const brandings = (data.brandingPresets || []).map(p => ({ ...p, category: 'branding' as const }));
    const effects = (data.effectPresets || []).map(p => ({ ...p, category: 'effect' as const }));

    return [
      ...mockups,
      ...angles,
      ...textures,
      ...ambiences,
      ...luminances,
      ...brandings,
      ...effects
    ];
  }, [data]);

  const currentPresets = useMemo(() => {
    if (activeTab === 'all') return allPresetsWithCategory;
    return allPresetsWithCategory.filter(p => p.category === activeTab);
  }, [activeTab, allPresetsWithCategory]);
  const isEditing = editingPreset !== null || isCreating;
  const effectiveEditType = isCreating ? (activeTab === 'all' ? 'mockup' : activeTab) : editingPreset?.type;

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-12 md:pt-14 relative">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>
      <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
        {!isCheckingAuth && !isAuthenticated && (
          <div className="max-w-md mx-auto">
            <div className="bg-neutral-900 border border-neutral-800/50 rounded-md p-6 md:p-8 space-y-4 text-center">
              {isUserAuthenticated === false ? (
                <>
                  <p className="text-neutral-400 font-mono mb-4">
                    Você precisa estar logado para acessar esta página.
                  </p>
                  <a
                    href="/"
                    className="inline-block px-4 py-2 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-colors"
                  >
                    Fazer Login
                  </a>
                </>
              ) : isAdmin === false ? (
                <>
                  <p className="text-neutral-400 font-mono mb-4">
                    Acesso negado. Você precisa ser um administrador para acessar esta página.
                  </p>
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 text-sm text-red-400 font-mono">
                      {error}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}

        {isAuthenticated && data && (
          <Tabs value="presets" className="space-y-6" onValueChange={(val) => {
            if (val !== 'presets') navigate('/admin');
          }}>
            {/* Row 1: Header */}
            <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl mb-6">
              <CardContent className="p-4 md:p-6">
                <div className="mb-4">
                  <BreadcrumbWithBack to="/">
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link to="/">{t('apps.home') || 'Home'}</Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link to="/admin">{t('admin.title') || 'Admin'}</Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Presets</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </BreadcrumbWithBack>
                </div>
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-6 w-6 md:h-8 md:w-8 text-brand-cyan" />
                    <div>
                      <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-neutral-300">
                        {t('adminPresets.title') || 'Administração de Presets'}
                      </h1>
                      <p className="text-neutral-500 font-mono text-xs md:text-sm">
                        {t('adminPresets.subtitle') || 'Gerencie presets de mockup e gerações'}
                      </p>
                    </div>
                  </div>

                  <TabsList className="bg-neutral-900/50 border border-neutral-800/50 p-1 h-auto flex-wrap">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-neutral-200 hover:bg-neutral-800/10 transition-all py-1.5 px-3 text-xs md:text-sm">
                      {t('admin.dashboard')}
                    </TabsTrigger>
                    <TabsTrigger value="generations" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-neutral-200 hover:bg-neutral-800/10 transition-all py-1.5 px-3 text-xs md:text-sm">
                      {t('admin.generations')}
                    </TabsTrigger>
                    <TabsTrigger value="users" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-neutral-200 hover:bg-neutral-800/10 transition-all py-1.5 px-3 text-xs md:text-sm">
                      {t('admin.users')}
                    </TabsTrigger>
                  </TabsList>
                </div>
              </CardContent>
            </Card>

            {/* Row 2: Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <Button
                onClick={handleRefresh}
                disabled={isLoading}
                className="font-mono bg-brand-cyan/80 hover:bg-brand-cyan text-black disabled:bg-neutral-700 disabled:text-neutral-500 h-9"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('admin.refresh') || 'Atualizar'}
              </Button>

              {!isEditing && (
                <Button
                  onClick={handleCreate}
                  className="font-mono bg-brand-cyan/80 hover:bg-brand-cyan text-black h-9"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo
                </Button>
              )}

              {!isEditing && activeTab === 'mockup' && (
                <>
                  <Button
                    onClick={handlePopulateFromDefaults}
                    disabled={isLoading}
                    className="font-mono bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/30 h-9"
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Popular Mockups Padrão
                  </Button>
                  <Button
                    onClick={handleOpenBatchModal}
                    disabled={isLoading}
                    className="font-mono bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/30 h-9"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Batch Upload
                  </Button>
                </>
              )}

              {!isEditing && activeTab !== 'mockup' && activeTab !== 'all' && (
                <Button
                  onClick={handlePopulateFromTags}
                  disabled={isLoading}
                  className="font-mono bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/30 h-9"
                >
                  <Layers className="h-4 w-4 mr-2" />
                  {t('adminPresets.populateDefaults') || 'Popular Padrões'}
                </Button>
              )}

              {/* View Toggle */}
              <div className="bg-neutral-900 border border-neutral-800 p-1 rounded-lg h-9 flex items-center ml-auto">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-1.5 rounded-md transition-all duration-200",
                    viewMode === 'grid'
                      ? "bg-neutral-800 text-white shadow-sm"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                  )}
                  title={t('adminPresets.viewGrid')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "p-1.5 rounded-md transition-all duration-200",
                    viewMode === 'table'
                      ? "bg-neutral-800 text-white shadow-sm"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                  )}
                  title={t('adminPresets.viewTable')}
                >
                  <TableIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Row 3: Category Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { id: 'all', label: 'All' },
                { id: 'mockup', label: 'Mockups' },
                { id: 'angle', label: 'Angles' },
                { id: 'texture', label: 'Textures' },
                { id: 'ambience', label: 'Ambiences' },
                { id: 'luminance', label: 'Luminances' },
                { id: 'branding', label: 'Branding' },
                { id: 'effect', label: 'Effects' }
              ].map((tab) => (
                <Button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as PresetType);
                    if (isEditModalOpen) handleCancel();
                  }}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  className={`font-mono transition-all h-8 text-xs ${activeTab === tab.id
                    ? 'bg-brand-cyan/80 hover:bg-brand-cyan text-black'
                    : 'border-neutral-700/60 hover:border-[brand-cyan]/30 text-neutral-400'
                    }`}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* Row 4: Grid */}
            <div className="space-y-6">
              {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-mono">
                  {error}
                </div>
              )}

              {batchResult && !isBatchModalOpen && (
                <div className={`mb-4 border rounded-xl p-4 text-sm font-mono ${batchResult.created > 0
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                  <div className="mb-2">
                    <strong>Resultado da importação:</strong> {batchResult.created} criado(s), {batchResult.failed} falha(s)
                  </div>
                  {batchResult.errors && batchResult.errors.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <strong>Erros:</strong>
                      {batchResult.errors.map((err, idx) => (
                        <div key={idx} className="text-xs">
                          Preset {err.index} {err.id ? `(${err.id})` : ''}: {err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {currentPresets.length === 0 ? (
                <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
                  <CardContent className="p-12 text-center">
                    <p className="text-neutral-500 font-mono">
                      {t('adminPresets.noPresets')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {viewMode === 'table' ? (
                    <div className="pb-20">
                      <DataTable columns={columns} data={currentPresets as any} searchKey="name" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {currentPresets.map((preset) => (
                        <PresetCard
                          key={`${preset.category}-${preset.id}`}
                          preset={preset as unknown as CommunityPrompt}
                          isAuthenticated={true}
                          canEdit={true}
                          onEdit={() => handleEdit((preset as any).category, preset)}
                          onDelete={() => handleDelete((preset as any).category, preset.id)}
                          t={t}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Batch Upload Modal */}
            {isBatchModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm p-4">
                <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-neutral-200 font-mono">
                        Importar Batch de Mockup Presets
                      </h3>
                      <button
                        onClick={handleCloseBatchModal}
                        className="text-neutral-400 hover:text-neutral-200 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm text-neutral-400 font-mono mb-2">
                          Cole o JSON com os presets (array de objetos)
                        </label>
                        <textarea
                          value={batchJson}
                          onChange={(e) => {
                            setBatchJson(e.target.value);
                            setBatchResult(null);
                            setError(null);
                          }}
                          rows={12}
                          className="w-full px-4 py-2 bg-neutral-950/70 border border-neutral-700/50 rounded-md text-neutral-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50 resize-none"
                          placeholder={`[\n  {\n    "id": "preset-id-1",\n    "name": "Nome do Preset 1",\n    "description": "Descrição do preset 1",\n    "prompt": "Prompt completo...",\n    "referenceImageUrl": "",\n    "aspectRatio": "16:9",\n    "model": "gemini-2.5-flash-image"\n  }\n]`}
                        />
                      </div>

                      {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 text-sm text-red-400 font-mono">
                          {error}
                        </div>
                      )}

                      {batchResult && (
                        <div className={`border rounded-md p-4 text-sm font-mono ${batchResult.created > 0
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                          }`}>
                          <div className="mb-2">
                            <strong>Resultado:</strong> {batchResult.created} criado(s), {batchResult.failed} falha(s)
                          </div>
                          {batchResult.errors && batchResult.errors.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <strong>Erros:</strong>
                              {batchResult.errors.map((err, idx) => (
                                <div key={idx} className="text-xs">
                                  Preset {err.index} {err.id ? `(${err.id})` : ''}: {err.error}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={handleValidateJson}
                        disabled={isLoading || !batchJson.trim()}
                        variant="outline"
                        className="font-mono border-neutral-700/60 hover:border-[brand-cyan]/30"
                      >
                        {t('adminPresets.validateJson')}
                      </Button>
                      <Button
                        onClick={handleBatchUpload}
                        disabled={isLoading || !batchJson.trim()}
                        className="font-mono bg-brand-cyan/80 hover:bg-brand-cyan text-black disabled:bg-neutral-700 disabled:text-neutral-500"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isLoading ? t('adminPresets.sending') : t('adminPresets.sendBatch')}
                      </Button>
                      <Button
                        onClick={handleCloseBatchModal}
                        variant="outline"
                        className="font-mono border-neutral-700/60 hover:border-[brand-cyan]/30"
                      >
                        {t('adminPresets.close')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Edit/Create Preset Modal */}
            {isEditModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm p-4"
                onClick={handleCancel}
              >
                <Card
                  className="bg-neutral-900 border border-neutral-800/50 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-neutral-200 font-mono">
                        {isCreating ? t('adminPresets.createTitle') : t('adminPresets.editTitle')}
                      </h3>
                      <button
                        onClick={handleCancel}
                        className="text-neutral-400 hover:text-neutral-200 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {error && (
                      <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md p-4 text-sm text-red-400 font-mono">
                        {error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-neutral-400 font-mono mb-2">
                          {t('adminPresets.idRequired')}
                        </label>
                        <Input
                          type="text"
                          value={formData.id}
                          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                          disabled={!isCreating}
                          className="font-mono"
                          placeholder="ex: my-custom-preset"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-neutral-400 font-mono mb-2">
                          {t('adminPresets.nameRequired')}
                        </label>
                        <Input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="font-mono"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm text-neutral-400 font-mono mb-2">
                          {t('adminPresets.descriptionRequired')}
                        </label>
                        <Input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="font-mono"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm text-neutral-400 font-mono mb-2">
                          {t('adminPresets.promptRequired')}
                        </label>
                        <Textarea
                          value={formData.prompt}
                          onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                          rows={4}
                          className="font-mono resize-none"
                        />
                      </div>

                      {effectiveEditType === 'mockup' && (
                        <div className="md:col-span-2 space-y-4">
                          <div>
                            <label className="block text-sm text-neutral-400 font-mono mb-2">
                              Imagem de Referência
                            </label>
                            {!formData.referenceImageUrl ? (
                              <div className="space-y-3">
                                <AdminImageUploader
                                  onImageUpload={handleImageUpload}
                                  disabled={isUploadingImage || !formData.id || formData.id.trim() === ''}
                                />
                                {isUploadingImage && (
                                  <p className="text-sm text-neutral-400 font-mono">Fazendo upload da imagem...</p>
                                )}
                                {imageUploadError && (
                                  <p className="text-sm text-red-400 font-mono">{imageUploadError}</p>
                                )}
                                {(!formData.id || formData.id.trim() === '') && (
                                  <p className="text-xs text-neutral-500 font-mono">
                                    Defina o ID do preset antes de fazer upload da imagem.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="relative">
                                  <img
                                    src={formData.referenceImageUrl}
                                    alt={t('adminPresets.reference')}
                                    className="w-full max-h-64 object-contain rounded-md border border-neutral-700/50 bg-neutral-950/70"
                                    onError={() => setImageUploadError('Erro ao carregar imagem. Verifique a URL.')}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData({ ...formData, referenceImageUrl: '' });
                                      setImageUploadError(null);
                                    }}
                                    className="absolute top-2 right-2 p-1 bg-neutral-950/80 hover:bg-black text-neutral-300 rounded transition-colors"
                                    title={t('adminPresets.removeImage')}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <div>
                                  <p className="text-xs text-neutral-500 font-mono mb-2">Ou faça upload de uma nova imagem:</p>
                                  <AdminImageUploader
                                    onImageUpload={handleImageUpload}
                                    disabled={isUploadingImage || !formData.id || formData.id.trim() === ''}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm text-neutral-400 font-mono mb-2">
                              Ou insira a URL manualmente
                            </label>
                            <input
                              type="text"
                              value={formData.referenceImageUrl || ''}
                              onChange={(e) => {
                                setFormData({ ...formData, referenceImageUrl: e.target.value });
                                setImageUploadError(null);
                              }}
                              className="w-full px-4 py-2 bg-neutral-950/70 border border-neutral-700/50 rounded-md text-neutral-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm text-neutral-400 font-mono mb-2">
                          Aspect Ratio (obrigatório)
                        </label>
                        <select
                          value={formData.aspectRatio}
                          onChange={(e) => setFormData({ ...formData, aspectRatio: e.target.value as AspectRatio })}
                          className="w-full px-4 py-2 bg-neutral-950/70 border border-neutral-700/50 rounded-md text-neutral-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50"
                        >
                          {ASPECT_RATIOS.map((ratio) => (
                            <option key={ratio} value={ratio}>
                              {ratio}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-neutral-400 font-mono mb-2">
                          Model (opcional)
                        </label>
                        <select
                          value={formData.model || ''}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value as GeminiModel || undefined })}
                          className="w-full px-4 py-2 bg-neutral-950/70 border border-neutral-700/50 rounded-md text-neutral-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50"
                        >
                          <option value="">Nenhum</option>
                          {GEMINI_MODELS.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </div>

                      {effectiveEditType === 'mockup' && (
                        <div>
                          <label className="block text-sm text-neutral-400 font-mono mb-2">
                            Categoria Mockup (opcional)
                          </label>
                          <select
                            value={formData.mockupCategoryId || ''}
                            onChange={(e) => setFormData({ ...formData, mockupCategoryId: e.target.value })}
                            className="w-full px-4 py-2 bg-neutral-950/70 border border-neutral-700/50 rounded-md text-neutral-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50"
                          >
                            <option value="">Nenhuma</option>
                            {mockupCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <label className="block text-sm text-neutral-400 font-mono mb-2">
                          Tags (opcional)
                        </label>
                        <div className="space-y-2">
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
                              placeholder="Digite uma tag e pressione Enter"
                              className="flex-1 px-4 py-2 bg-neutral-950/70 border border-neutral-700/50 rounded-md text-neutral-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50"
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
                              className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/30 rounded-md text-brand-cyan font-mono text-sm transition-colors"
                            >
                              Adicionar
                            </button>
                          </div>
                          {formData.tags && formData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {formData.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900/50 border border-neutral-700/30 rounded text-xs text-neutral-300 font-mono"
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData({
                                        ...formData,
                                        tags: formData.tags?.filter((_, i) => i !== index) || [],
                                      });
                                    }}
                                    className="text-neutral-500 hover:text-neutral-300 transition-colors"
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

                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="font-mono bg-brand-cyan/80 hover:bg-brand-cyan text-black disabled:bg-neutral-700 disabled:text-neutral-500"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar
                      </Button>
                      <Button
                        onClick={handleCancel}
                        variant="outline"
                        className="font-mono border-neutral-700/60 hover:border-[brand-cyan]/30"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
            }
          </Tabs >
        )}
      </div >
    </div >
  );
};

export default AdminPresetsPage;
