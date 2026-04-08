import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Upload,
  Loader2,
  Copy,
  Check,
  Save,
  ImageIcon,
  Tag,
  Percent,
  Figma,
  Palette,
  X,
  Plus,
  Globe,
  Cpu,
  Search,
  ArrowRight,
  Maximize2,
  RefreshCw,
  Type,
  Diamond
} from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { useLayout } from '@/hooks/useLayout';
import { authService } from '@/services/authService';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Select } from '../components/ui/select';
import { AnalyzingImageOverlay } from '../components/ui/AnalyzingImageOverlay';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { mockupApi } from '@/services/mockupApi';

import { GEMINI_MODELS } from '../constants/geminiModels';
import type { AspectRatio } from '../types/types';
import { MockupCard } from '@/components/mockupmachine/MockupCard';

const GOOGLE_FONTS = [
  { value: '', label: 'Auto Detect' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Geist', label: 'Geist' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Space Grotesk', label: 'Space Grotesk' },
  { value: 'Syne', label: 'Syne' },
  { value: 'Manrope', label: 'Manrope' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
  { value: 'Libre Baskerville', label: 'Libre Baskerville' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'IBM Plex Mono', label: 'IBM Plex Mono' },
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
];

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

  const [image, setImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [showFullImage, setShowFullImage] = useState<string | null>(null);

  // AI Prompt Params
  const [intensity, setIntensity] = useState<'literal' | 'balanced' | 'creative'>('balanced');
  const [visualStyle, setVisualStyle] = useState<'auto' | 'photorealistic' | 'cinematic' | 'digital-art' | 'minimalist' | '3d-render'>('auto');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '4:3' | '9:16'>('16:9');

  // Figma Plugin Params
  const [useAutoLayout, setUseAutoLayout] = useState(true);
  const [useSemanticNaming, setUseSemanticNaming] = useState(true);
  const [useTokens, setUseTokens] = useState(false);

  // Stepped Journey Logic
  const step = useMemo(() => {
    if (!image) return 'idle';
    if (isAnalyzing) return 'analyzing';
    if (result) return 'result';
    return 'config';
  }, [image, isAnalyzing, result]);

  const refinedPrompt = useMemo(() => {
    if (!result) return '';

    // If the user has edited the prompt (or AI refined it), use that as the base
    let p = editedPrompt;

    if (!p) {
      p = result.mode === 'figma-plugin'
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
      ? activeSuggestions.filter(s => s !== suggestion)
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
    const common = ["Cinematic Lighting", "Minimalist Style", "Golden Hour"];
    const cats: Record<string, string[]> = {
      'ui-screenshot': ["Dark Mode", "Landing Page", "Mobile App UI", "SaaS Dashboard"],
      'figma-design': ["Clean Logic", "Standard Tokens", "Componentize Layers"],
      'mockup': ["Trocar pessoa", "Imaginar outros 3 novos ângulos", "Adicione mais pessoas trabalhando na sala", "Nature Environment"],
      '3d': ["Neon Cyberpunk", "Voxel Art", "Soft Global Illumination"],
      'aesthetics': ["Film Grain", "Hyper Realistic 8K", "Moody Atmosphere"],
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
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
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
            useTokens
          }
        }));
      } catch (e) {
        // Silently handle quota errors - it's secondary to the core app flow
        console.warn('Analysis state exceeds storage quota. Persistence disabled for this session.');
      }
    }
  }, [image, result, mode, intensity, visualStyle, aspectRatio, selectedFont, useAutoLayout, useSemanticNaming, useTokens, generatedImage, generatedVariations, mockupId, isLiked, activeSuggestions, editedPrompt]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Use PNG, JPG, or WebP.');
      return;
    }

    // Validate file size (5MB)
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
      const response = await fetch('/api/mockups/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          promptText: refinedPrompt,
          baseImage: {
            base64: image.base64,
            mimeType: image.mimeType
          },
          aspectRatio,
          model: GEMINI_MODELS.IMAGE_NB2,
          resolution: '1K'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Generation failed');
      }

      const data = await response.json();
      const imageResult = data.imageUrl || (data.imageBase64 ? `data:image/png;base64,${data.imageBase64}` : null);

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
        const response = await fetch('/api/mockups/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            promptText: refinedPrompt,
            baseImage: {
              base64: image.base64,
              mimeType: image.mimeType
            },
            aspectRatio,
            model: GEMINI_MODELS.IMAGE_NB2,
            resolution: '1K'
          }),
        });
        
        if (!response.ok) return null;
        const data = await response.json();
        return data.imageUrl || (data.imageBase64 ? `data:image/png;base64,${data.imageBase64}` : null);
      };

      // Generate 4 in parallel
      const results = await Promise.all([
        generateOne(),
        generateOne(),
        generateOne(),
        generateOne()
      ]);

      const validResults = results.filter(r => !!r) as string[];

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
        isLiked: isLiked
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

  const handlePaste = useCallback((e: ClipboardEvent) => {
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
  }, [handleFileSelect]);

  React.useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const analyzeImage = async (refinements: string[] = []) => {
    if (!image) return;

    if (refinements.length > 0) {
      toast.loading('Refining prompt...', { id: 'refine' });
    } else {
      setIsAnalyzing(true);
    }

    try {
      const token = authService.getToken();
      const response = await fetch('/api/plugin/smart-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image,
          mode,
          whiteLabel,
          saveToLib,
          publish,
          refinements, // Pass suggestions for rewriting
          currentPrompt: result?.prompt || '',
          params: mode === 'image-gen' ? {
            intensity,
            visualStyle,
            aspectRatio,
            selectedFont
          } : {
            useAutoLayout,
            useSemanticNaming,
            useTokens,
            selectedFont
          }
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
    navigator.clipboard.writeText(displayContent);
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
    setPublishTags(publishTags.filter(t => t !== tagToRemove));
  };

  const publishToCommunity = async () => {
    if (!result || !publishName.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsPublishing(true);
    try {
      const token = authService.getToken();
      const promptContent = result.mode === 'figma-plugin' && result.operations
        ? JSON.stringify(result.operations, null, 2)
        : result.prompt || '';

      const response = await fetch('/api/plugin/smart-analyze/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: publishName.trim(),
          prompt: promptContent,
          category: result.mode === 'figma-plugin' ? 'figma-prompts' : (result.libraryCategory || result.category),
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
      'mockup': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'texture': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'ambience': 'bg-green-500/20 text-green-400 border-green-500/30',
      'luminance': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      '3d': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'aesthetics': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      'themes': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    };
    return colors[category] || 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
  };

  const adminActions = (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-end mr-4">
        <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-tighter">System Access</span>
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
      breadcrumb={[
        { label: 'Systems', to: '/apps' },
        { label: 'Smart Analyzer' }
      ]}
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
                    "group relative border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center h-[400px] text-center",
                    isDragging
                      ? "border-brand-cyan bg-brand-cyan/5"
                      : "border-neutral-800 hover:border-neutral-700 bg-neutral-900/20"
                  )}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleInputChange} accept="image/*" />

                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-neutral-950 flex items-center justify-center border border-neutral-800 group-hover:border-neutral-700 transition-all duration-500">
                      <ImageIcon size={32} className="text-neutral-500 group-hover:text-brand-cyan transition-colors" />
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

            {step === 'config' && (
              <motion.div
                key="config"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="grid lg:grid-cols-7 gap-12"
              >
                <div className="lg:col-span-4 space-y-4">
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 group">
                    <img
                      src={image?.preview}
                      alt="Preview"
                      className="w-full aspect-[16/10] object-contain p-4"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] font-mono text-white/50 uppercase">{image?.mimeType.split('/')[1]} Image</span>
                      <Button variant="ghost" size="sm" onClick={() => window.open(image?.preview, '_blank')} className="h-7 text-[10px] text-white/80">
                        <Maximize2 size={12} className="mr-1.5" /> Full Image
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <GlassPanel padding="lg" className="h-full border-neutral-800/60 flex flex-col">
                    <div className="flex-1 space-y-8">
                      <div className="space-y-4">
                        <label className="text-xs font-semibold text-neutral-400 block pl-1">Target Dimension</label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'image-gen', label: 'AI Prompt', sub: 'For image generators', icon: Diamond },
                            { id: 'figma-plugin', label: 'Plugin Data', sub: 'For Figma Code Connect', icon: Figma },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => setMode(opt.id as any)}
                              className={cn(
                                "flex flex-col items-start p-4 rounded-2xl border transition-all text-left relative overflow-hidden",
                                mode === opt.id
                                  ? "bg-brand-cyan/5 border-brand-cyan/20 text-brand-cyan"
                                  : "bg-neutral-900/40 border-white/[0.03] text-neutral-500 hover:border-white/10"
                              )}
                            >
                              <opt.icon size={16} className={cn("mb-3", mode === opt.id ? "text-brand-cyan" : "opacity-30")} />
                              <span className="text-xs font-bold leading-none mb-1.5">{opt.label}</span>
                              <span className="text-[9px] font-mono uppercase tracking-tighter opacity-50">{opt.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 pt-6">
                        <div className="grid gap-2">
                          {[
                            { label: 'White Label', sub: 'Omit brand identifiers', value: whiteLabel, set: setWhiteLabel },
                            { label: 'Save Archive', sub: 'Store in library', value: saveToLib, set: setSaveToLib },
                            { label: 'Community Sync', sub: 'Automatic public sync', value: publish, set: setPublish, disabled: !saveToLib },
                          ].map((opt) => (
                            <div
                              key={opt.label}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-xl transition-all border border-transparent",
                                "bg-neutral-900/40 hover:bg-neutral-900/60 hover:border-white/5",
                                opt.disabled && "opacity-30 pointer-events-none"
                              )}
                            >
                              <div>
                                <span className="text-sm text-neutral-300 block leading-none mb-1.5">{opt.label}</span>
                                <span className="text-[9px] text-neutral-600 font-mono block tracking-tight uppercase leading-none">{opt.sub}</span>
                              </div>
                              <Switch
                                checked={opt.value}
                                onCheckedChange={opt.set}
                                className="data-[state=unchecked]:bg-neutral-800 border border-white/5 shadow-inner"
                              />
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex items-center justify-between w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-neutral-900 group-hover:bg-neutral-800 transition-colors">
                              <Cpu size={14} className={cn("text-neutral-500", showAdvanced && "text-brand-cyan")} />
                            </div>
                            <div className="text-left">
                              <span className="text-xs font-semibold text-neutral-300 block">Advanced Config</span>
                              <span className="text-[8px] font-mono uppercase tracking-widest text-neutral-600">Model & Style tweaks</span>
                            </div>
                          </div>
                          <div className={cn("transition-transform duration-300", showAdvanced && "rotate-180")}>
                            <ArrowRight size={14} className="text-neutral-700 rotate-90" />
                          </div>
                        </button>

                        <AnimatePresence>
                          {showAdvanced && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.4, ease: "circOut" }}
                              className="overflow-hidden"
                            >
                              <div className="pt-8 space-y-8">

                                <AnimatePresence mode="wait">
                                  {mode === 'image-gen' ? (
                                    <motion.div
                                      key="image-gen-params"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="space-y-8"
                                    >
                                      <div className="space-y-3">
                                        <label className="text-xs font-semibold text-neutral-500 block pl-1">Creative Intensity</label>
                                        <div className="grid grid-cols-3 gap-2">
                                          {['literal', 'balanced', 'creative'].map((v) => (
                                            <button
                                              key={v}
                                              onClick={() => setIntensity(v as any)}
                                              className={cn(
                                                "py-2 rounded-lg text-[10px] font-mono border transition-all uppercase tracking-tighter",
                                                intensity === v ? "bg-white/10 border-white/20 text-white" : "border-transparent text-neutral-600 hover:text-neutral-400"
                                              )}
                                            >
                                              {v}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-3">
                                        <label className="text-xs font-semibold text-neutral-500 block pl-1">Visual Style</label>
                                        <Select
                                          options={[
                                            { value: 'auto', label: 'Detect Automatically (Auto)' },
                                            { value: 'photorealistic', label: 'Photorealistic' },
                                            { value: 'cinematic', label: 'Cinematic' },
                                            { value: 'digital-art', label: 'Digital Art' },
                                            { value: 'minimalist', label: 'Minimalist' },
                                            { value: '3d-render', label: '3D Render' },
                                          ]}
                                          value={visualStyle}
                                          onChange={setVisualStyle as any}
                                          variant="node"
                                        />
                                      </div>

                                      <div className="space-y-3">
                                        <label className="text-xs font-semibold text-neutral-500 block pl-1">Aspect Ratio</label>
                                        <div className="grid grid-cols-4 gap-2">
                                          {['1:1', '16:9', '4:3', '9:16'].map((r) => (
                                            <button
                                              key={r}
                                              onClick={() => setAspectRatio(r as any)}
                                              className={cn(
                                                "py-2 rounded-lg text-[10px] font-mono border transition-all",
                                                aspectRatio === r ? "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan" : "border-transparent text-neutral-600 hover:text-neutral-400"
                                              )}
                                            >
                                              {r}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="figma-params"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="space-y-8"
                                    >
                                      <div className="space-y-3">
                                        <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 font-bold flex items-center gap-2">
                                          <Type size={12} /> Choose Font
                                        </label>
                                        <Select
                                          options={GOOGLE_FONTS}
                                          value={selectedFont}
                                          onChange={setSelectedFont}
                                          placeholder="Detect Font Automatically"
                                          variant="node"
                                        />
                                      </div>

                                      <div className="grid gap-2">
                                        {[
                                          { label: 'Auto Layout', sub: 'Responsive structure', value: useAutoLayout, set: setUseAutoLayout },
                                          { label: 'Semantic Naming', sub: 'Meaningful layer names', value: useSemanticNaming, set: setUseSemanticNaming },
                                          { label: 'Variable Tokens', sub: 'Bind colors & typography', value: useTokens, set: setUseTokens },
                                        ].map((opt) => (
                                          <div
                                            key={opt.label}
                                            className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/40 border border-transparent hover:border-white/5 transition-all"
                                          >
                                            <div>
                                              <span className="text-sm text-neutral-300 block leading-none mb-1.5">{opt.label}</span>
                                              <span className="text-[9px] text-neutral-600 font-mono block tracking-tight uppercase leading-none">{opt.sub}</span>
                                            </div>
                                            <Switch
                                              checked={opt.value}
                                              onCheckedChange={opt.set}
                                              className="data-[state=unchecked]:bg-neutral-800 border border-white/5 shadow-inner"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <Button
                      onClick={() => analyzeImage()}
                      className="w-full mt-12 bg-white hover:bg-neutral-200 text-black h-14 rounded-xl font-semibold tracking-tight transition-all active:scale-[0.98]"
                    >
                      Start Analysis
                      <ArrowRight size={18} className="ml-3 opacity-50" />
                    </Button>
                  </GlassPanel>
                </div>
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
                    {(isGenerating || isGeneratingVariations || generatedImage || generatedVariations.length > 0) && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between pl-1">
                          <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-brand-cyan flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-brand-cyan" />
                            {generatedVariations.length > 0 ? "Visual Variations Suite" : "Generated Visual Synthesis"}
                          </h4>
                          <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                            {generatedVariations.length > 0 ? `${generatedVariations.length} Scenarios` : "8K • Photorealistic"} • {selectedFont || 'Standard'}
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
                                  className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-white/5 shadow-2xl"
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
                              className="relative aspect-video rounded-3xl overflow-hidden bg-neutral-900 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5"
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

                    {/* #1: CREATIVE PROMPT BLOCK */}
                    <div className="flex flex-col">
                      <GlassPanel padding="lg" className="rounded-3xl border-neutral-800/60 bg-neutral-950/40 relative group">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-6">
                            <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-neutral-500 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-brand-cyan" />
                              Creative Prompt Blueprint
                            </h3>
                            {result.mode === 'figma-plugin' && (
                              <div className="w-[180px]">
                                <Select
                                  value={selectedFont}
                                  onChange={(val) => setSelectedFont(val)}
                                  options={[
                                    { value: '', label: 'Auto Detect', icon: <Type size={12} /> },
                                    { value: 'Inter', label: 'Inter' },
                                    { value: 'Outfit', label: 'Outfit' },
                                    { value: 'Roboto Mono', label: 'Roboto Mono' },
                                    { value: 'Playfair Display', label: 'Playfair Display' },
                                  ]}
                                  className="h-[38px] bg-white/5 border-white/10 text-[10px] uppercase tracking-widest font-mono"
                                />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {result.mode === 'image-gen' && (
                              <div className="flex items-center gap-2">
                                <Button 
                                  onClick={() => handleGenerateVariations()}
                                  disabled={isGenerating || isGeneratingVariations}
                                  variant="outline"
                                  className={cn(
                                    "h-10 px-4 border-white/10 hover:border-brand-cyan/50 hover:bg-brand-cyan/5 text-neutral-400 hover:text-brand-cyan rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest group",
                                    isGeneratingVariations && "opacity-80"
                                  )}
                                >
                                  {isGeneratingVariations ? (
                                    <Loader2 size={12} className="mr-2 animate-spin" />
                                    ) : (
                                      <Diamond size={12} className="mr-2 group-hover:scale-110 transition-transform opacity-50" />
                                    )}
                                  {isGeneratingVariations ? 'Thinking...' : 'Variações'}
                                </Button>

                                <Button 
                                  onClick={() => handleGenerateWithGemini()}
                                  disabled={isGenerating || isGeneratingVariations}
                                  className={cn(
                                    "h-10 px-5 bg-brand-cyan hover:bg-brand-cyan-dark text-black rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest group shadow-[0_0_20px_rgba(34,211,238,0.2)]",
                                    isGenerating && "opacity-80"
                                  )}
                                >
                                  {isGenerating ? (
                                    <Loader2 size={12} className="mr-2 animate-spin" />
                                    ) : (
                                      <Diamond size={12} className="mr-2 group-hover:rotate-12 transition-transform text-black/40" />
                                    )}
                                  {isGenerating ? 'Envisioning...' : 'Gerar com Gemini'}
                                </Button>
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl">
                              <Button 
                                onClick={openPublishModal}
                                variant="ghost"
                                className="h-8 w-8 p-0 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5"
                              >
                                <Globe size={14} />
                              </Button>
                              <div className="w-px h-4 bg-white/10" />
                              <Button 
                                onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                                variant="ghost"
                                className={cn(
                                  "h-8 px-3 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all",
                                  isEditingPrompt ? "bg-brand-cyan text-black" : "text-neutral-500 hover:text-white"
                                )}
                              >
                                {isEditingPrompt ? 'Salvar' : 'Editar'}
                              </Button>
                              <Button 
                                onClick={copyPrompt}
                                variant="ghost"
                                className="h-8 px-3 rounded-lg text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-white"
                              >
                                {copied ? <Check size={12} /> : <Copy size={12} />}
                              </Button>
                            </div>
                          </div>
                        </div>

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
                              placeholder="Sculpt your vision here..."
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

                        {/* Prompt Suggestions/Refinements */}
                        <div className="mt-12 space-y-6 pt-8 border-t border-white/5">
                          <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-600 font-bold pl-1 flex items-center gap-2">
                            <Plus size={10} /> Dynamic Refinements
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {getPromptSuggestions(result.category).map((s) => (
                              <button
                                key={s}
                                onClick={() => toggleSuggestion(s)}
                                className={cn(
                                  "px-4 py-2.5 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all border outline-none active:scale-95",
                                  activeSuggestions.includes(s)
                                    ? "bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan shadow-[0_0_20px_rgba(34,211,238,0.1)]"
                                    : "bg-neutral-900/30 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
                                )}
                              >
                                {activeSuggestions.includes(s) && <Check size={10} className="mr-2 inline-block" />}
                                {s}
                              </button>
                            ))}
                            
                            <div className="relative group/input flex items-center min-w-[240px]">
                              <Input 
                                placeholder="Refinar prompt..."
                                className="h-[42px] px-5 pl-10 bg-neutral-950 border-neutral-800/80 rounded-xl text-[10px] font-mono uppercase tracking-widest placeholder:text-neutral-700 focus:border-brand-cyan/30 focus:shadow-[0_0_20px_-10px_rgba(34,211,238,0.3)] transition-all"
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
                              <Plus size={12} className="absolute left-4 text-neutral-600 group-focus-within/input:text-brand-cyan transition-colors" />
                            </div>

                            {activeSuggestions.length > 0 && (
                              <Button 
                                variant="ghost" 
                                onClick={() => setActiveSuggestions([])}
                                className="h-10 px-4 text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-600 hover:text-white"
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

                  {/* SIDEBAR: CONTEXT & METADATA */}
                  <div className="lg:col-span-4 space-y-12">
                    {/* #3: SOURCE IMAGE */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2 pl-1">
                        <ImageIcon size={12} /> Source Context
                      </h4>
                      <GlassPanel padding="none" className="rounded-2xl overflow-hidden border-neutral-800/40 opacity-80 hover:opacity-100 transition-opacity">
                        <img 
                          src={image?.preview} 
                          alt="Source" 
                          className="w-full aspect-square object-cover cursor-zoom-in" 
                          onClick={() => image?.preview && setShowFullImage(image.preview)}
                        />
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
                            <span key={tag} className="text-[10px] font-mono px-3 py-2 rounded-xl bg-neutral-900/50 border border-neutral-800/50 text-neutral-500 transition-colors hover:text-white hover:border-neutral-700">
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
                            <div key={i} className="flex items-center gap-4 bg-neutral-950/50 p-3 rounded-2xl border border-neutral-900 group hover:border-neutral-700 transition-all">
                              <div className="w-10 h-10 rounded-xl shadow-sm border border-white/5" style={{ backgroundColor: c.hex }} />
                              <div className="flex-1">
                                <span className="text-xs text-neutral-300 block mb-0.5">{c.name}</span>
                                <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-tighter">{c.hex}</span>
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
              <DialogTitle className="text-xl font-semibold tracking-tight">Save to Community</DialogTitle>
              <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-[0.1em] leading-none">Global resource synchronization</p>
            </div>
            <Globe className="text-brand-cyan/20" size={32} />
          </div>

          <div className="p-8 space-y-8">
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest font-bold">Title</label>
                <Input
                  value={publishName}
                  onChange={(e) => setPublishName(e.target.value)}
                  placeholder="E.g. Professional Dashboard Dark"
                  className="bg-neutral-900 border-neutral-800 h-12 focus:border-brand-cyan/50 focus:ring-0 transition-all rounded-xl"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest font-bold">Tags</label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-4 bg-neutral-900/50 rounded-xl border border-neutral-800/50">
                  {publishTags.map((tag) => (
                    <span key={tag} className="flex items-center gap-2 bg-neutral-900 text-neutral-300 px-3 py-1.5 rounded-lg text-[11px] font-mono border border-neutral-800">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="text-neutral-600 hover:text-white">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {publishTags.length === 0 && <span className="text-neutral-600 font-mono text-[10px] uppercase">No tags defined</span>}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add category tag..."
                    className="bg-neutral-900 border-neutral-800 flex-1 h-11 rounded-xl"
                  />
                  <Button onClick={addTag} variant="outline" className="border-neutral-800 hover:bg-white hover:text-black px-4 rounded-xl">
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-neutral-900/30 p-8 pt-0 flex items-center justify-between gap-4">
            <Button variant="ghost" onClick={() => setShowPublishModal(false)} className="text-neutral-500 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={publishToCommunity}
              disabled={isPublishing || !publishName.trim()}
              className="bg-white text-black hover:bg-neutral-200 h-12 px-8 rounded-xl font-semibold min-w-[160px]"
            >
              {isPublishing ? <Loader2 size={18} className="animate-spin" /> : "Publish Now"}
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
