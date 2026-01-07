import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Plus, Edit2, Trash2, X, Save, Upload, Image as ImageIcon, Camera, Layers, MapPin, Sun, RefreshCw, Settings, Users } from 'lucide-react';
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
} from "@/components/ui/BreadcrumbWithBack";
import { useLayout } from '../hooks/useLayout';
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
import type { AspectRatio, GeminiModel, UploadedImage } from '../types';
import { cn } from '../lib/utils';
import { useTranslation } from '../hooks/useTranslation';

const ADMIN_API = '/api/admin/presets';

const ASPECT_RATIOS: AspectRatio[] = ['9:16', '21:9', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '16:9', '1:1'];
const GEMINI_MODELS: GeminiModel[] = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];

interface PresetsData {
  mockupPresets: MockupPreset[];
  anglePresets: AnglePreset[];
  texturePresets: TexturePreset[];
  ambiencePresets: AmbiencePreset[];
  luminancePresets: LuminancePreset[];
}

type PresetType = 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance';

interface PresetFormData {
  id: string;
  name: string;
  description: string;
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[];
}

export const AdminPresetsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated: isUserAuthenticated, isCheckingAuth } = useLayout();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<PresetsData | null>(null);
  const [activeTab, setActiveTab] = useState<PresetType>('mockup');
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

  const handleEdit = (type: PresetType, preset: MockupPreset | AnglePreset | TexturePreset | AmbiencePreset | LuminancePreset) => {
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
      const url = isCreating
        ? `${ADMIN_API}/${activeTab}`
        : `${ADMIN_API}/${activeTab}/${editingPreset?.id}`;
      const method = isCreating ? 'POST' : 'PUT';

      const body: any = {
        id: formData.id,
        name: formData.name,
        description: formData.description,
        prompt: formData.prompt,
        aspectRatio: formData.aspectRatio,
        model: formData.model,
        tags: formData.tags && formData.tags.length > 0 ? formData.tags : undefined,
      };

      if (activeTab === 'mockup' && formData.referenceImageUrl !== undefined) {
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

  const currentPresets =
    activeTab === 'mockup' ? data?.mockupPresets || [] :
      activeTab === 'angle' ? data?.anglePresets || [] :
        activeTab === 'texture' ? data?.texturePresets || [] :
          activeTab === 'ambience' ? data?.ambiencePresets || [] :
            activeTab === 'luminance' ? data?.luminancePresets || [] : [];
  const isEditing = editingPreset !== null || isCreating;

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 relative">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>
      <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
        {!isCheckingAuth && !isAuthenticated && (
          <div className="max-w-md mx-auto">
            <div className="bg-zinc-900 border border-zinc-800/50 rounded-md p-6 md:p-8 space-y-4 text-center">
              {isUserAuthenticated === false ? (
                <>
                  <p className="text-zinc-400 font-mono mb-4">
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
                  <p className="text-zinc-400 font-mono mb-4">
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
            {/* Unified Header */}
            <Card className="bg-zinc-900 border border-zinc-800/50 rounded-xl mb-6">
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
                      <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-zinc-300">
                        {t('adminPresets.title') || 'Administração de Presets'}
                      </h1>
                      <p className="text-zinc-500 font-mono text-xs md:text-sm">
                        {t('adminPresets.subtitle') || 'Gerencie presets de mockup e gerações'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <TabsList className="bg-zinc-900/50 border border-zinc-800/50 p-1 h-auto flex-wrap">
                      <TabsTrigger value="overview" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-zinc-200 hover:bg-zinc-800/10 transition-all py-1.5 px-3 text-xs md:text-sm">
                        {t('admin.dashboard')}
                      </TabsTrigger>
                      <TabsTrigger value="generations" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-zinc-200 hover:bg-zinc-800/10 transition-all py-1.5 px-3 text-xs md:text-sm">
                        {t('admin.generations')}
                      </TabsTrigger>
                      <TabsTrigger value="users" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-zinc-200 hover:bg-zinc-800/10 transition-all py-1.5 px-3 text-xs md:text-sm">
                        {t('admin.users')}
                      </TabsTrigger>
                      <TabsTrigger value="presets" className="data-[state=active]:bg-brand-cyan/80 data-[state=active]:text-black hover:text-zinc-200 hover:bg-zinc-800/10 transition-all py-1.5 px-3 text-xs md:text-sm">
                        <Settings className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
                        {t('admin.presets')}
                      </TabsTrigger>
                    </TabsList>

                    <Button
                      onClick={handleRefresh}
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 border-zinc-800/50 hover:bg-zinc-800/50 h-9"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">{t('admin.refresh') || 'Atualizar'}</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Tabs and Actions Card */}
              <Card className="bg-zinc-900 border border-zinc-800/50 rounded-xl hover:border-[brand-cyan]/30 transition-all duration-300 shadow-lg">
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => {
                          setActiveTab('mockup');
                          if (isEditModalOpen) handleCancel();
                        }}
                        variant={activeTab === 'mockup' ? 'default' : 'outline'}
                        className={`font-mono transition-all ${activeTab === 'mockup'
                          ? 'bg-brand-cyan/80 hover:bg-brand-cyan text-black'
                          : 'border-zinc-700/60 hover:border-[brand-cyan]/30'
                          }`}
                      >
                        Mockup Presets
                      </Button>
                      <Button
                        onClick={() => {
                          setActiveTab('angle');
                          if (isEditModalOpen) handleCancel();
                        }}
                        variant={activeTab === 'angle' ? 'default' : 'outline'}
                        className={`font-mono transition-all ${activeTab === 'angle'
                          ? 'bg-brand-cyan/80 hover:bg-brand-cyan text-black'
                          : 'border-zinc-700/60 hover:border-[brand-cyan]/30'
                          }`}
                      >
                        Angle Presets
                      </Button>
                      <Button
                        onClick={() => {
                          setActiveTab('texture');
                          if (isEditModalOpen) handleCancel();
                        }}
                        variant={activeTab === 'texture' ? 'default' : 'outline'}
                        className={`font-mono transition-all ${activeTab === 'texture'
                          ? 'bg-brand-cyan/80 hover:bg-brand-cyan text-black'
                          : 'border-zinc-700/60 hover:border-[brand-cyan]/30'
                          }`}
                      >
                        Texture Presets
                      </Button>
                      <Button
                        onClick={() => {
                          setActiveTab('ambience');
                          if (isEditModalOpen) handleCancel();
                        }}
                        variant={activeTab === 'ambience' ? 'default' : 'outline'}
                        className={`font-mono transition-all ${activeTab === 'ambience'
                          ? 'bg-brand-cyan/80 hover:bg-brand-cyan text-black'
                          : 'border-zinc-700/60 hover:border-[brand-cyan]/30'
                          }`}
                      >
                        Ambience Presets
                      </Button>
                      <Button
                        onClick={() => {
                          setActiveTab('luminance');
                          if (isEditModalOpen) handleCancel();
                        }}
                        variant={activeTab === 'luminance' ? 'default' : 'outline'}
                        className={`font-mono transition-all ${activeTab === 'luminance'
                          ? 'bg-brand-cyan/80 hover:bg-brand-cyan text-black'
                          : 'border-zinc-700/60 hover:border-[brand-cyan]/30'
                          }`}
                      >
                        Luminance Presets
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="font-mono bg-brand-cyan/80 hover:bg-brand-cyan text-black disabled:bg-zinc-700 disabled:text-zinc-500"
                      >
                        Atualizar
                      </Button>
                      {!isEditing && (
                        <Button
                          onClick={handleCreate}
                          className="font-mono bg-brand-cyan/80 hover:bg-brand-cyan text-black"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Novo
                        </Button>
                      )}
                    </div>
                  </div>

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
                </CardContent>
              </Card>

              {/* Presets Grid - Bento Box Cards */}
              {currentPresets.length === 0 ? (
                <Card className="bg-zinc-900 border border-zinc-800/50 rounded-xl">
                  <CardContent className="p-12 text-center">
                    <p className="text-zinc-500 font-mono">Nenhum preset encontrado</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {currentPresets.map((preset) => {
                    const hasImage = activeTab === 'mockup' && (preset as any).referenceImageUrl;
                    return (
                      <Card
                        key={preset.id}
                        className="bg-zinc-900 border border-zinc-800/50 rounded-xl hover:border-[brand-cyan]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl"
                      >
                        <CardContent className="p-6">
                          {/* Image */}
                          <div className="mb-4">
                            {hasImage ? (
                              <img
                                src={(preset as any).referenceImageUrl}
                                alt={preset.name}
                                className="w-full h-48 object-cover rounded-lg border border-zinc-700/30 bg-zinc-900/30"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-48 rounded-lg border border-zinc-700/30 bg-zinc-900/30 flex items-center justify-center">
                                <ImageIcon className="h-12 w-12 text-zinc-600" />
                              </div>
                            )}
                          </div>

                          {/* ID Badge */}
                          <div className="mb-3">
                            <Badge variant="outline" className="bg-black/40 border-zinc-700/50 text-zinc-400 font-mono text-xs">
                              {preset.id}
                            </Badge>
                          </div>

                          {/* Name */}
                          <h3 className="text-lg font-semibold text-zinc-200 mb-2 font-mono">
                            {preset.name}
                          </h3>

                          {/* Description */}
                          <p className="text-sm text-zinc-400 mb-4 line-clamp-2 font-mono">
                            {preset.description}
                          </p>

                          {/* Metadata */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs font-mono">
                              <span className="text-zinc-500">Aspect Ratio:</span>
                              <Badge variant="outline" className="bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/30 text-xs">
                                {preset.aspectRatio}
                              </Badge>
                            </div>
                            {preset.model && (
                              <div className="flex items-center gap-2 text-xs font-mono">
                                <span className="text-zinc-500">Model:</span>
                                <span className="text-zinc-300">{preset.model}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-4 border-t border-zinc-800/50">
                            <Button
                              onClick={() => handleEdit(activeTab, preset)}
                              variant="outline"
                              size="sm"
                              className="flex-1 border-[brand-cyan]/30 text-brand-cyan hover:bg-brand-cyan/10 hover:border-[brand-cyan]/50 font-mono"
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              onClick={() => handleDelete(activeTab, preset.id)}
                              variant="outline"
                              size="sm"
                              className="border-red-400/30 text-red-400 hover:bg-red-400/10 hover:border-red-400/50 font-mono"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Batch Upload Modal */}
            {isBatchModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <Card className="bg-zinc-900 border border-zinc-800/50 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-zinc-200 font-mono">
                        Importar Batch de Mockup Presets
                      </h3>
                      <button
                        onClick={handleCloseBatchModal}
                        className="text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm text-zinc-400 font-mono mb-2">
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
                          className="w-full px-4 py-2 bg-black/40 border border-zinc-700/50 rounded-md text-zinc-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50 resize-none"
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
                        className="font-mono border-zinc-700/60 hover:border-[brand-cyan]/30"
                      >
                        Validar JSON
                      </Button>
                      <Button
                        onClick={handleBatchUpload}
                        disabled={isLoading || !batchJson.trim()}
                        className="font-mono bg-brand-cyan/80 hover:bg-brand-cyan text-black disabled:bg-zinc-700 disabled:text-zinc-500"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isLoading ? 'Enviando...' : 'Enviar Batch'}
                      </Button>
                      <Button
                        onClick={handleCloseBatchModal}
                        variant="outline"
                        className="font-mono border-zinc-700/60 hover:border-[brand-cyan]/30"
                      >
                        Fechar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Edit/Create Preset Modal */}
            {isEditModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                onClick={handleCancel}
              >
                <Card
                  className="bg-zinc-900 border border-zinc-800/50 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-zinc-200 font-mono">
                        {isCreating ? 'Criar Novo Preset' : 'Editar Preset'}
                      </h3>
                      <button
                        onClick={handleCancel}
                        className="text-zinc-400 hover:text-zinc-200 transition-colors"
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
                        <label className="block text-sm text-zinc-400 font-mono mb-2">
                          ID {isCreating && '(obrigatório)'}
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
                        <label className="block text-sm text-zinc-400 font-mono mb-2">
                          Nome (obrigatório)
                        </label>
                        <Input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="font-mono"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm text-zinc-400 font-mono mb-2">
                          Descrição (obrigatório)
                        </label>
                        <Input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="font-mono"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm text-zinc-400 font-mono mb-2">
                          Prompt (obrigatório)
                        </label>
                        <Textarea
                          value={formData.prompt}
                          onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                          rows={4}
                          className="font-mono resize-none"
                        />
                      </div>

                      {activeTab === 'mockup' && (
                        <div className="md:col-span-2 space-y-4">
                          <div>
                            <label className="block text-sm text-zinc-400 font-mono mb-2">
                              Imagem de Referência
                            </label>
                            {!formData.referenceImageUrl ? (
                              <div className="space-y-3">
                                <AdminImageUploader
                                  onImageUpload={handleImageUpload}
                                  disabled={isUploadingImage || !formData.id || formData.id.trim() === ''}
                                />
                                {isUploadingImage && (
                                  <p className="text-sm text-zinc-400 font-mono">Fazendo upload da imagem...</p>
                                )}
                                {imageUploadError && (
                                  <p className="text-sm text-red-400 font-mono">{imageUploadError}</p>
                                )}
                                {(!formData.id || formData.id.trim() === '') && (
                                  <p className="text-xs text-zinc-500 font-mono">
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
                                    className="w-full max-h-64 object-contain rounded-md border border-zinc-700/50 bg-black/40"
                                    onError={() => setImageUploadError('Erro ao carregar imagem. Verifique a URL.')}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData({ ...formData, referenceImageUrl: '' });
                                      setImageUploadError(null);
                                    }}
                                    className="absolute top-2 right-2 p-1 bg-black/80 hover:bg-black text-zinc-300 rounded transition-colors"
                                    title={t('adminPresets.removeImage')}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <div>
                                  <p className="text-xs text-zinc-500 font-mono mb-2">Ou faça upload de uma nova imagem:</p>
                                  <AdminImageUploader
                                    onImageUpload={handleImageUpload}
                                    disabled={isUploadingImage || !formData.id || formData.id.trim() === ''}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm text-zinc-400 font-mono mb-2">
                              Ou insira a URL manualmente
                            </label>
                            <input
                              type="text"
                              value={formData.referenceImageUrl || ''}
                              onChange={(e) => {
                                setFormData({ ...formData, referenceImageUrl: e.target.value });
                                setImageUploadError(null);
                              }}
                              className="w-full px-4 py-2 bg-black/40 border border-zinc-700/50 rounded-md text-zinc-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm text-zinc-400 font-mono mb-2">
                          Aspect Ratio (obrigatório)
                        </label>
                        <select
                          value={formData.aspectRatio}
                          onChange={(e) => setFormData({ ...formData, aspectRatio: e.target.value as AspectRatio })}
                          className="w-full px-4 py-2 bg-black/40 border border-zinc-700/50 rounded-md text-zinc-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50"
                        >
                          {ASPECT_RATIOS.map((ratio) => (
                            <option key={ratio} value={ratio}>
                              {ratio}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-400 font-mono mb-2">
                          Model (opcional)
                        </label>
                        <select
                          value={formData.model || ''}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value as GeminiModel || undefined })}
                          className="w-full px-4 py-2 bg-black/40 border border-zinc-700/50 rounded-md text-zinc-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50"
                        >
                          <option value="">Nenhum</option>
                          {GEMINI_MODELS.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm text-zinc-400 font-mono mb-2">
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
                              className="flex-1 px-4 py-2 bg-black/40 border border-zinc-700/50 rounded-md text-zinc-300 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50"
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
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/50 border border-zinc-700/30 rounded text-xs text-zinc-300 font-mono"
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
                                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
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
                        className="font-mono bg-brand-cyan/80 hover:bg-brand-cyan text-black disabled:bg-zinc-700 disabled:text-zinc-500"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar
                      </Button>
                      <Button
                        onClick={handleCancel}
                        variant="outline"
                        className="font-mono border-zinc-700/60 hover:border-[brand-cyan]/30"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default AdminPresetsPage;
