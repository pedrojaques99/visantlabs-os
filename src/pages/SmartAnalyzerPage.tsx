import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import {
  Copy,
  Check,
  ImageIcon,
  Tag,
  Palette,
  X,
  Plus,
  Globe,
  Cpu,
  RefreshCw,
  Diamond,
} from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { useLayout } from '@/hooks/useLayout';
import { authService } from '@/services/authService';
import { GlassPanel } from '../components/ui/GlassPanel';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { mockupApi } from '@/services/mockupApi';

import { GEMINI_MODELS } from '../constants/geminiModels';
import { MockupCard } from '@/components/mockupmachine/MockupCard';
import { API_BASE } from '@/config/api';
import { copyToClipboard } from '@/utils/clipboard';

function injectFont(content: string, font: string, mode: 'figma-plugin' | 'image-gen'): string {
  if (!font) return content;
  if (mode === 'image-gen') {
    return content + `\n\nTypography: Use "${font}" as the primary typeface for all text elements.`;
  }
  try {
    const inject = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(inject);
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
          result[key] = key === 'fontFamily' ? font : inject(obj[key]);
        }
        return result;
      }
      return obj;
    };
    return JSON.stringify(inject(JSON.parse(content)), null, 2);
  } catch {
    return content;
  }
}

interface AnalysisResult {
  mode: 'figma-plugin' | 'image-gen';
  category: string;
  name: string;
  promptId?: string;
  // Image gen mode
  confidence?: number;
  tags?: string[];
  prompt?: string;
  promptType?: 'figma-plugin' | 'image-generation';
  libraryCategory?: string;
  // Figma plugin mode
  operations?: any[];
  tokens?: {
    colors: { name: string; hex: string }[];
    typography: { name: string; size: number; weight: number }[];
  };
}

export const SmartAnalyzerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useLayout();
  const isAdmin = user?.isAdmin === true;

  const [image, setImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveToLib, setSaveToLib] = useState(false);
  const [publish, setPublish] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'figma-plugin' | 'image-gen'>('image-gen');
  const [whiteLabel, setWhiteLabel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Publish modal state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishName, setPublishName] = useState('');
  const [publishTags, setPublishTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedFont, setSelectedFont] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedVariations, setGeneratedVariations] = useState<string[]>([]);
  const [mockupId, setMockupId] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [showFullImage, setShowFullImage] = useState<string | null>(null);

  // AI Prompt Params
  const [intensity, setIntensity] = useState<'literal' | 'balanced' | 'creative'>('balanced');
  const [visualStyle, setVisualStyle] = useState<
    'auto' | 'photorealistic' | 'cinematic' | 'digital-art' | 'minimalist' | '3d-render'
  >('auto');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '4:3' | '9:16'>('16:9');

  // Figma Plugin Params
  const [useAutoLayout, setUseAutoLayout] = useState(true);
  const [useSemanticNaming, setUseSemanticNaming] = useState(true);
  const [useTokens, setUseTokens] = useState(false);

  const step = useMemo(() => {
    if (!image) return 'idle';
    if (isAnalyzing) return 'analyzing';
    if (result) return 'result';
    return 'analyzing';
  }, [image, isAnalyzing, result]);

  const refinedPrompt = useMemo(() => {
    if (!result) return '';

    // If the user has edited the prompt (or AI refined it), use that as the base
    let p = editedPrompt;

    if (!p) {
      p =
        result.mode === 'figma-plugin'
          ? JSON.stringify(result.operations, null, 2)
          : result.prompt || '';

      // Fallback for when re-analysis is not yet triggered or all suggestions cleared
      if (activeSuggestions.length > 0 && result.mode === 'image-gen') {
        p += `\n\nCreative Refinements:\n- ` + activeSuggestions.join('\n- ');
      }
    }

    return injectFont(p, selectedFont, result.mode);
  }, [result, selectedFont, activeSuggestions, editedPrompt]);

  const displayContent = useMemo(() => refinedPrompt, [refinedPrompt]);

  const toggleSuggestion = (suggestion: string) => {
    const newSuggestions = activeSuggestions.includes(suggestion)
      ? activeSuggestions.filter((s) => s !== suggestion)
      : [...activeSuggestions, suggestion];

    setActiveSuggestions(newSuggestions);

    // If we have suggestions, trigger AI re-analysis to rewrite the prompt
    if (newSuggestions.length > 0) {
      analyzeImage(newSuggestions);
    } else {
      // Reset to original if all cleared
      setEditedPrompt('');
    }
  };

  const getPromptSuggestions = (category: string) => {
    const common = ['Cinematic Lighting', 'Minimalist Style', 'Golden Hour'];
    const cats: Record<string, string[]> = {
      'ui-screenshot': ['Dark Mode', 'Landing Page', 'Mobile App UI', 'SaaS Dashboard'],
      'figma-design': ['Clean Logic', 'Standard Tokens', 'Componentize Layers'],
      mockup: [
        'Trocar pessoa',
        'Imaginar outros 3 novos ângulos',
        'Adicione mais pessoas trabalhando na sala',
        'Nature Environment',
      ],
      '3d': ['Neon Cyberpunk', 'Voxel Art', 'Soft Global Illumination'],
      aesthetics: ['Film Grain', 'Hyper Realistic 8K', 'Moody Atmosphere'],
    };
    return [...(cats[category] || []), ...common];
  };

  // Redirect non-admins
  React.useEffect(() => {
    if (user && !isAdmin) {
      toast.error('Admin access required');
      navigate('/apps');
    }
  }, [user, isAdmin, navigate]);

  // PERSISTENCE: Save/Load from sessionStorage (more appropriate for page state and avoids localStorage quota limits)
  const STORAGE_KEY = 'smart-analyzer-state';

  // Restore on mount
  React.useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const data = JSON.parse(saved);
      if (data.image) {
        // Use data URL for preview since blob URL from another session is invalid
        const previewUrl = `data:${data.image.mimeType};base64,${data.image.base64}`;
        setImage({ ...data.image, preview: previewUrl });
      }
      if (data.result) setResult(data.result);
      if (data.mode) setMode(data.mode);
      if (data.params) {
        // Restore params if exists
        if (data.params.intensity) setIntensity(data.params.intensity);
        if (data.params.visualStyle) setVisualStyle(data.params.visualStyle);
        if (data.params.aspectRatio) setAspectRatio(data.params.aspectRatio);
        if (data.params.selectedFont) setSelectedFont(data.params.selectedFont);
      }
      if (data.generatedImage) setGeneratedImage(data.generatedImage);
      if (data.generatedVariations) setGeneratedVariations(data.generatedVariations);
      if (data.mockupId) setMockupId(data.mockupId);
      if (data.isLiked) setIsLiked(data.isLiked);
      if (data.activeSuggestions) setActiveSuggestions(data.activeSuggestions);
      if (data.editedPrompt) setEditedPrompt(data.editedPrompt);
    } catch (e) {
      console.error('Failed to restore analyzer state', e);
    }
  }, []);

  // Save changes
  React.useEffect(() => {
    if (image || result) {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            image,
            result,
            mode,
            generatedImage,
            generatedVariations,
            mockupId,
            isLiked,
            activeSuggestions,
            editedPrompt,
            params: {
              intensity,
              visualStyle,
              aspectRatio,
              selectedFont,
              useAutoLayout,
              useSemanticNaming,
              useTokens,
            },
          })
        );
      } catch (e) {
        // Silently handle quota errors - it's secondary to the core app flow
        console.warn(
          'Analysis state exceeds storage quota. Persistence disabled for this session.'
        );
      }
    }
  }, [
    image,
    result,
    mode,
    intensity,
    visualStyle,
    aspectRatio,
    selectedFont,
    useAutoLayout,
    useSemanticNaming,
    useTokens,
    generatedImage,
    generatedVariations,
    mockupId,
    isLiked,
    activeSuggestions,
    editedPrompt,
  ]);

  const pendingAnalyze = useRef(false);

  const handleFileSelect = useCallback((file: File) => {
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Use PNG, JPG, or WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Max 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setImage({
        base64,
        mimeType: file.type,
        preview: URL.createObjectURL(file),
      });
      setResult(null);
      setGeneratedImage(null);
      setGeneratedVariations([]);
      setEditedPrompt('');
      setActiveSuggestions([]);
      pendingAnalyze.current = true;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const reset = useCallback(() => {
    setImage(null);
    setResult(null);
    setGeneratedImage(null);
    setGeneratedVariations([]);
    setMockupId(null);
    setIsLiked(false);
    setActiveSuggestions([]);
    setEditedPrompt('');
    setIsEditingPrompt(false);
    sessionStorage.removeItem('smart-analyzer-state');
  }, []);

  const handleGenerateInline = useCallback(async () => {
    if (!result?.prompt || !image?.base64) {
      toast.error('Analyze the image first');
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setGeneratedVariations([]);

    try {
      const token = authService.getToken();
      const response = await fetch(`${API_BASE}/mockups/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promptText: refinedPrompt,
          baseImage: {
            base64: image.base64,
            mimeType: image.mimeType,
          },
          aspectRatio,
          model: GEMINI_MODELS.IMAGE_NB2,
          resolution: '1K',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Generation failed');
      }

      const data = await response.json();
      const imageResult =
        data.imageUrl || (data.imageBase64 ? `data:image/png;base64,${data.imageBase64}` : null);

      if (imageResult) {
        setGeneratedImage(imageResult);
        toast.success('Generated successfully!');
      } else {
        throw new Error('No image returned from server');
      }
    } catch (error: any) {
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  }, [result, image, aspectRatio, refinedPrompt]);

  const handleGenerateVariations = useCallback(async () => {
    if (!result?.prompt || !image?.base64) {
      toast.error('Analyze the image first');
      return;
    }

    setIsGeneratingVariations(true);
    setGeneratedImage(null);
    setGeneratedVariations([]);

    toast.loading('Envisioning multiple variations...', { id: 'variations' });

    try {
      const token = authService.getToken();
      const generateOne = async () => {
        const response = await fetch(`${API_BASE}/mockups/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            promptText: refinedPrompt,
            baseImage: {
              base64: image.base64,
              mimeType: image.mimeType,
            },
            aspectRatio,
            model: GEMINI_MODELS.IMAGE_NB2,
            resolution: '1K',
          }),
        });

        if (!response.ok) return null;
        const data = await response.json();
        return (
          data.imageUrl || (data.imageBase64 ? `data:image/png;base64,${data.imageBase64}` : null)
        );
      };

      // Generate 4 in parallel
      const results = await Promise.all([
        generateOne(),
        generateOne(),
        generateOne(),
        generateOne(),
      ]);

      const validResults = results.filter((r) => !!r) as string[];

      if (validResults.length > 0) {
        setGeneratedVariations(validResults);
        toast.success(`Generated ${validResults.length} variations!`, { id: 'variations' });
      } else {
        throw new Error('Generation failed for all variations');
      }
    } catch (error: any) {
      toast.error('Failed to generate variations', { id: 'variations' });
    } finally {
      setIsGeneratingVariations(false);
    }
  }, [result, image, aspectRatio, refinedPrompt]);

  const handleSaveToLibrary = async (imageBase64: string) => {
    if (!result || !imageBase64) return;
    try {
      const saved = await mockupApi.save({
        imageBase64,
        prompt: refinedPrompt,
        designType: result.category || 'other',
        tags: [result.name],
        brandingTags: [],
        aspectRatio: aspectRatio,
        isLiked: isLiked,
      });
      setMockupId(saved._id || null);
      toast.success('Saved to your library');
    } catch (error) {
      toast.error('Failed to save media');
    }
  };

  const handleToggleLike = async () => {
    if (!mockupId) {
      // If not saved yet, save it as liked
      setIsLiked(true);
      if (generatedImage) await handleSaveToLibrary(generatedImage);
      return;
    }

    try {
      const newStatus = !isLiked;
      await mockupApi.update(mockupId, { isLiked: newStatus });
      setIsLiked(newStatus);
      toast.success(newStatus ? 'Added to favorites' : 'Removed from favorites');
    } catch (error) {
      toast.error('Failed to update favorite status');
    }
  };

  const handleGenerateWithGemini = useCallback(() => {
    handleGenerateInline();
  }, [handleGenerateInline]);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleFileSelect(file);
            toast.success('Image captured from clipboard');
            break;
          }
        }
      }
    },
    [handleFileSelect]
  );

  React.useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  React.useEffect(() => {
    if (image && pendingAnalyze.current) {
      pendingAnalyze.current = false;
      analyzeImage();
    }
  }, [image]);

  const analyzeImage = async (refinements: string[] = []) => {
    if (!image) return;

    if (refinements.length > 0) {
      toast.loading('Refining prompt...', { id: 'refine' });
    } else {
      setIsAnalyzing(true);
    }

    try {
      const token = authService.getToken();
      const response = await fetch(`${API_BASE}/plugin/smart-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image,
          mode,
          whiteLabel,
          saveToLib,
          publish,
          refinements, // Pass suggestions for rewriting
          currentPrompt: result?.prompt || '',
          params:
            mode === 'image-gen'
              ? {
                  intensity,
                  visualStyle,
                  aspectRatio,
                  selectedFont,
                }
              : {
                  useAutoLayout,
                  useSemanticNaming,
                  useTokens,
                  selectedFont,
                },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }

      const data = await response.json();

      if (refinements.length > 0) {
        setEditedPrompt(data.prompt);
        toast.success('Prompt refined', { id: 'refine' });
      } else {
        setResult(data);
        toast.success('Analysis complete');
      }
    } catch (error: any) {
      toast.error(error.message || 'Analysis failed', { id: 'refine' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyPrompt = () => {
    if (!result || !displayContent) return;
    copyToClipboard(displayContent);
    setCopied(true);
    toast.success(result.mode === 'figma-plugin' ? 'Operations JSON copied!' : 'Prompt copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const openPublishModal = () => {
    if (!result) return;
    setPublishName(result.name);
    setPublishTags(result.tags || []);
    setShowPublishModal(true);
  };

  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !publishTags.includes(tag)) {
      setPublishTags([...publishTags, tag]);
    }
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    setPublishTags(publishTags.filter((t) => t !== tagToRemove));
  };

  const publishToCommunity = async () => {
    if (!result || !publishName.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsPublishing(true);
    try {
      const token = authService.getToken();
      const promptContent =
        result.mode === 'figma-plugin' && result.operations
          ? JSON.stringify(result.operations, null, 2)
          : result.prompt || '';

      const response = await fetch(`${API_BASE}/plugin/smart-analyze/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: publishName.trim(),
          prompt: promptContent,
          category:
            result.mode === 'figma-plugin'
              ? 'figma-prompts'
              : result.libraryCategory || result.category,
          tags: publishTags,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish');
      }

      toast.success('Published to Community!');
      setShowPublishModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'ui-screenshot': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'figma-design': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      mockup: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      texture: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      ambience: 'bg-green-500/20 text-green-400 border-green-500/30',
      luminance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      '3d': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      aesthetics: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      themes: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    };
    return colors[category] || 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
  };

  const adminActions = (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-end mr-4">
        <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-tighter">
          System Access
        </span>
        <span className="text-xs font-mono text-white">ADMINISTRATOR</span>
      </div>
      {step !== 'idle' && (
        <Button
          onClick={reset}
          variant="ghost"
          className="h-10 px-4 text-neutral-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-neutral-800 transition-all rounded-lg"
        >
          <RefreshCw size={14} className="mr-2" />
          Reset
        </Button>
      )}
    </div>
  );

  return (
    <PageShell
      pageId="smart-analyzer"
      seoTitle="Smart Analyzer | Admin"
      seoDescription="AI-powered image analysis and prompt generation"
      title="Image Analyzer"
      microTitle="Admin // Analysis"
      description="AI-powered design and prompt engine for professional workflows."
      breadcrumb={[{ label: 'Systems', to: '/apps' }, { label: 'Smart Analyzer' }]}
      actions={adminActions}
    >
      <div className="selection:bg-brand-cyan/30 selection:text-brand-cyan">
        <AnimatePresence mode="wait">
          {step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="max-w-3xl mx-auto"
            >
              <GlassPanel
                padding="lg"
                className={cn(
                  'group relative border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center h-[400px] text-center',
                  isDragging
                    ? 'border-brand-cyan bg-brand-cyan/5'
                    : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/20'
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleInputChange}
                  accept="image/*"
                />

                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-neutral-950 flex items-center justify-center border border-neutral-800 group-hover:border-neutral-700 transition-all duration-500">
                    <ImageIcon
                      size={32}
                      className="text-neutral-500 group-hover:text-brand-cyan transition-colors"
                    />
                  </div>
                </div>

                <div className="mt-8 space-y-2">
                  <h3 className="text-xl font-medium text-white">Start here</h3>
                  <p className="text-sm text-neutral-500 max-w-xs">
                    Drag an image here, click to browse, or paste with Ctrl+V.
                  </p>
                </div>

                <div className="mt-12 flex items-center gap-2 text-[10px] font-mono tracking-widest text-neutral-600 uppercase border border-neutral-800 px-4 py-1.5 rounded-full">
                  <Cpu size={10} />
                  System Ready
                </div>
              </GlassPanel>
            </motion.div>
          )}

          {step === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="max-w-md mx-auto flex flex-col items-center gap-6 py-20"
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-neutral-950 flex items-center justify-center border border-neutral-800">
                  <GlitchLoader size={28} />
                </div>
                <div className="absolute inset-0 rounded-full border border-brand-cyan/20 animate-ping" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-sm font-semibold text-white">Extracting prompt</h3>
                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 animate-pulse">
                  Analyzing visual patterns...
                </p>
              </div>

              {image && (
                <div className="w-32 h-20 rounded-xl overflow-hidden border border-neutral-800 opacity-40">
                  <img src={image.preview} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </motion.div>
          )}

          {step === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-12"
            >
              <div className="grid lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-10">
                  {/* #2: GENERATED RESULT BLOCK (LARGE) - Moved above prompt */}
                  {/* #2: GENERATED RESULT BLOCK (LARGE) - Moved above prompt */}
                  {(isGenerating ||
                    isGeneratingVariations ||
                    generatedImage ||
                    generatedVariations.length > 0) && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pl-1">
                        <h4 className="text-[10px] font-mono uppercase tracking-[0.1em] text-brand-cyan flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-brand-cyan" />
                          {generatedVariations.length > 0
                            ? 'Visual Variations Suite'
                            : 'Generated Visual Synthesis'}
                        </h4>
                        <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                          {generatedVariations.length > 0
                            ? `${generatedVariations.length} Scenarios`
                            : '8K • Photorealistic'}{' '}
                          • {selectedFont || 'Standard'}
                        </span>
                      </div>

                      <AnimatePresence mode="wait">
                        {generatedVariations.length > 0 ? (
                          <motion.div
                            key="variations-grid"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="grid grid-cols-2 gap-4"
                          >
                            {generatedVariations.map((v, idx) => (
                              <motion.div
                                key={`var-${idx}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl"
                              >
                                <MockupCard
                                  base64Image={v}
                                  isLoading={false}
                                  isRedrawing={false}
                                  onRedraw={() => {}} // Local redraw handled by Re-imagine or Variations button
                                  onView={() => setShowFullImage(v)}
                                  onNewAngle={() => {}}
                                  onNewBackground={() => {}}
                                  onSave={handleSaveToLibrary}
                                  aspectRatio={aspectRatio as any}
                                  prompt={refinedPrompt}
                                  designType={result.category}
                                  className="w-full h-full"
                                />
                              </motion.div>
                            ))}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="single-result"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="relative aspect-video rounded-3xl overflow-hidden bg-neutral-900 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-neutral-800"
                          >
                            <MockupCard
                              base64Image={generatedImage}
                              isLoading={isGenerating || isGeneratingVariations}
                              isRedrawing={isGenerating && !!generatedImage}
                              onRedraw={handleGenerateInline}
                              onView={() => setShowFullImage(generatedImage)}
                              onNewAngle={() => {}}
                              onNewBackground={() => {}}
                              onSave={handleSaveToLibrary}
                              isSaved={!!mockupId}
                              mockupId={mockupId || undefined}
                              onToggleLike={handleToggleLike}
                              isLiked={isLiked}
                              aspectRatio={aspectRatio as any}
                              prompt={refinedPrompt}
                              designType={result.category}
                              className="w-full h-full"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* PROMPT OUTPUT */}
                  <div className="flex flex-col">
                    <GlassPanel
                      padding="lg"
                      className="rounded-3xl border-neutral-800/60 bg-neutral-950/40 relative group"
                    >
                      {/* Header: category chip + secondary actions */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-lg border',
                              getCategoryColor(result.category)
                            )}
                          >
                            {result.category}
                          </span>
                          {result.confidence != null && (
                            <span className="text-[10px] font-mono text-neutral-600">
                              {Math.round(result.confidence * 100)}%
                            </span>
                          )}
                          {result.name && (
                            <span className="text-[10px] font-mono text-neutral-600 truncate max-w-[200px]">
                              {result.name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl">
                          <Button
                            onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                            variant="ghost"
                            className={cn(
                              'h-8 px-3 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all',
                              isEditingPrompt
                                ? 'bg-brand-cyan text-black'
                                : 'text-neutral-500 hover:text-white'
                            )}
                          >
                            {isEditingPrompt ? 'Save' : 'Edit'}
                          </Button>
                          <Button
                            onClick={openPublishModal}
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5"
                          >
                            <Globe size={14} />
                          </Button>
                        </div>
                      </div>

                      {/* Prompt content */}
                      <div className="relative flex flex-col">
                        {isEditingPrompt ? (
                          <textarea
                            value={refinedPrompt}
                            onChange={(e) => {
                              setEditedPrompt(e.target.value);
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            className="w-full bg-transparent border-0 text-lg leading-relaxed text-neutral-200 focus:ring-0 resize-none font-sans scrollbar-hide selection:bg-brand-cyan/30 p-0 min-h-[120px]"
                            placeholder="Edit your prompt..."
                            autoFocus
                            onFocus={(e) => {
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                          />
                        ) : (
                          <pre className="text-lg leading-relaxed text-neutral-200 whitespace-pre-wrap font-sans selection:bg-brand-cyan/30">
                            {refinedPrompt}
                          </pre>
                        )}
                      </div>

                      {/* Primary CTA: Copy */}
                      <div className="mt-8 pt-6 border-t border-neutral-800 flex items-center gap-3">
                        <Button
                          onClick={copyPrompt}
                          className={cn(
                            'h-12 px-6 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]',
                            copied
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-white hover:bg-neutral-200 text-black'
                          )}
                        >
                          {copied ? (
                            <Check size={16} className="mr-2" />
                          ) : (
                            <Copy size={16} className="mr-2" />
                          )}
                          {copied ? 'Copied!' : 'Copy Prompt'}
                        </Button>

                        {result.mode === 'image-gen' && (
                          <>
                            <Button
                              onClick={() => handleGenerateWithGemini()}
                              disabled={isGenerating || isGeneratingVariations}
                              variant="outline"
                              className={cn(
                                'h-12 px-5 border-white/10 hover:border-brand-cyan/30 hover:bg-brand-cyan/5 text-neutral-400 hover:text-brand-cyan rounded-xl transition-all text-xs font-semibold',
                                isGenerating && 'opacity-80'
                              )}
                            >
                              {isGenerating ? (
                                <GlitchLoader size={14} className="mr-2" />
                              ) : (
                                <Diamond size={14} className="mr-2 opacity-50" />
                              )}
                              {isGenerating ? 'Generating...' : 'Generate'}
                            </Button>
                            <Button
                              onClick={() => handleGenerateVariations()}
                              disabled={isGenerating || isGeneratingVariations}
                              variant="ghost"
                              className="h-12 px-4 text-neutral-500 hover:text-neutral-300 text-xs font-semibold"
                            >
                              {isGeneratingVariations ? (
                                <GlitchLoader size={14} className="mr-2" />
                              ) : (
                                <Diamond size={14} className="mr-2 opacity-30" />
                              )}
                              4x Variations
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Refinements */}
                      <div className="mt-8 space-y-4 pt-6 border-t border-neutral-800">
                        <h4 className="text-[10px] font-mono uppercase tracking-[0.1em] text-neutral-600 font-bold pl-1 flex items-center gap-2">
                          <Plus size={10} /> Refinements
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {getPromptSuggestions(result.category).map((s) => (
                            <button
                              key={s}
                              onClick={() => toggleSuggestion(s)}
                              className={cn(
                                'px-4 py-2.5 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all border outline-none active:scale-95',
                                activeSuggestions.includes(s)
                                  ? 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                                  : 'bg-neutral-900/30 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
                              )}
                            >
                              {activeSuggestions.includes(s) && (
                                <Check size={10} className="mr-2 inline-block" />
                              )}
                              {s}
                            </button>
                          ))}

                          <div className="relative group/input flex items-center min-w-[200px]">
                            <Input
                              placeholder="Custom..."
                              className="h-[42px] px-5 pl-10 bg-neutral-950 border-neutral-800/80 rounded-xl text-[10px] font-mono uppercase tracking-widest placeholder:text-neutral-700 focus:border-neutral-600 transition-all"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = e.currentTarget.value.trim();
                                  if (val) {
                                    toggleSuggestion(val);
                                    e.currentTarget.value = '';
                                  }
                                }
                              }}
                            />
                            <Plus
                              size={12}
                              className="absolute left-4 text-neutral-600 group-focus-within/input:text-brand-cyan transition-colors"
                            />
                          </div>

                          {activeSuggestions.length > 0 && (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setActiveSuggestions([]);
                                setEditedPrompt('');
                              }}
                              className="h-10 px-4 text-[10px] font-mono uppercase tracking-[0.1em] text-neutral-600 hover:text-white"
                            >
                              <RefreshCw size={10} className="mr-2" />
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                    </GlassPanel>
                  </div>
                </div>

                {/* SIDEBAR */}
                <div className="lg:col-span-4 space-y-12">
                  {/* SOURCE IMAGE + REPLACE */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2 pl-1">
                      <ImageIcon size={12} /> Source
                    </h4>
                    <GlassPanel
                      padding="none"
                      className="rounded-2xl overflow-hidden border-white/10 opacity-80 hover:opacity-100 transition-opacity relative group/source"
                    >
                      <img
                        src={image?.preview}
                        alt="Source"
                        className="w-full aspect-square object-cover cursor-zoom-in"
                        onClick={() => image?.preview && setShowFullImage(image.preview)}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/source:opacity-100 transition-opacity"
                      >
                        <span className="text-[10px] font-mono uppercase tracking-widest text-white/80 bg-black/40 px-4 py-2 rounded-lg border border-white/10">
                          Analyze Another
                        </span>
                      </button>
                    </GlassPanel>
                  </div>

                  {/* #4: TAGS & CONTROLS */}
                  {result.tags && result.tags.length > 0 && (
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2 pl-1">
                        <Tag size={12} /> Visual Keywords
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-mono px-3 py-2 rounded-xl bg-neutral-900/50 border border-white/10 text-neutral-500 transition-colors hover:text-white hover:border-neutral-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.mode === 'figma-plugin' && result.tokens && (
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2 pl-1">
                        <Palette size={12} /> Extracted Palette
                      </h4>
                      <div className="grid gap-3">
                        {result.tokens.colors.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-4 bg-neutral-950/50 p-3 rounded-2xl border border-neutral-900 group hover:border-neutral-700 transition-all"
                          >
                            <div
                              className="w-10 h-10 rounded-xl shadow-sm border border-neutral-800"
                              style={{ backgroundColor: c.hex }}
                            />
                            <div className="flex-1">
                              <span className="text-xs text-neutral-300 block mb-0.5">
                                {c.name}
                              </span>
                              <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-tighter">
                                {c.hex}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={showPublishModal} onOpenChange={setShowPublishModal}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-xl p-0 overflow-hidden">
          <div className="bg-neutral-950 p-8 flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Save to Community
              </DialogTitle>
              <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-[0.1em] leading-none">
                Global resource synchronization
              </p>
            </div>
            <Globe className="text-brand-cyan/20" size={32} />
          </div>

          <div className="p-8 space-y-8">
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest font-bold">
                  Title
                </label>
                <Input
                  value={publishName}
                  onChange={(e) => setPublishName(e.target.value)}
                  placeholder="E.g. Professional Dashboard Dark"
                  className="bg-neutral-900 border-neutral-800 h-12 focus:border-neutral-600 focus:ring-0 transition-all rounded-xl"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest font-bold">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-4 bg-neutral-900/50 rounded-xl border border-white/10">
                  {publishTags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-2 bg-neutral-900 text-neutral-300 px-3 py-1.5 rounded-lg text-[11px] font-mono border border-neutral-800"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-neutral-600 hover:text-white"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {publishTags.length === 0 && (
                    <span className="text-neutral-600 font-mono text-[10px] uppercase">
                      No tags defined
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add category tag..."
                    className="bg-neutral-900 border-neutral-800 flex-1 h-11 rounded-xl"
                  />
                  <Button
                    onClick={addTag}
                    variant="outline"
                    className="border-neutral-800 hover:bg-white hover:text-black px-4 rounded-xl"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-neutral-900/30 p-8 pt-0 flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => setShowPublishModal(false)}
              className="text-neutral-500 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={publishToCommunity}
              disabled={isPublishing || !publishName.trim()}
              className="bg-white text-black hover:bg-neutral-200 h-12 px-8 rounded-xl font-semibold min-w-[160px]"
            >
              {isPublishing ? <GlitchLoader size={18} /> : 'Publish Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showFullImage} onOpenChange={() => setShowFullImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-transparent flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center group">
            <img
              src={showFullImage || ''}
              alt="Preview"
              className="max-w-full max-h-screen object-contain rounded-2xl shadow-2xl"
            />
            <Button
              variant="ghost"
              onClick={() => setShowFullImage(null)}
              className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 h-10 w-10 p-0 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all"
            >
              <X size={20} />
            </Button>

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-white/70 text-[10px] font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
              Presione ESC para sair
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};
