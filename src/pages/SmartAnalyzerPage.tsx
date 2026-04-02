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
  Type
} from 'lucide-react';

import { SEO } from '../components/SEO';
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Select } from '../components/ui/select';
import { AnalyzingImageOverlay } from '../components/ui/AnalyzingImageOverlay';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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

  // Stepped Journey Logic
  const step = useMemo(() => {
    if (!image) return 'idle';
    if (isAnalyzing) return 'analyzing';
    if (result) return 'result';
    return 'config';
  }, [image, isAnalyzing, result]);

  const displayContent = useMemo(() => {
    if (!result) return '';
    const raw = result.mode === 'figma-plugin'
      ? JSON.stringify(result.operations, null, 2)
      : result.prompt || '';
    return injectFont(raw, selectedFont, result.mode);
  }, [result, selectedFont]);

  // Redirect non-admins
  React.useEffect(() => {
    if (user && !isAdmin) {
      toast.error('Admin access required');
      navigate('/apps');
    }
  }, [user, isAdmin, navigate]);

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
  }, []);

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

  const analyzeImage = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    try {
      const token = authService.getToken();
      const response = await fetch('/api/plugin/smart-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: { base64: image.base64, mimeType: image.mimeType },
          mode,
          whiteLabel,
          saveToLib,
          publish,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }

      const data = await response.json();
      setResult(data);

      if (data.promptId) {
        toast.success('Saved to library!');
      } else {
        toast.success(mode === 'figma-plugin' ? 'Figma operations generated!' : 'Image analyzed!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to analyze image');
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

  // Open publish modal with current result data
  const openPublishModal = () => {
    if (!result) return;
    setPublishName(result.name);
    setPublishTags(result.tags || []);
    setShowPublishModal(true);
  };

  // Add a new tag
  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !publishTags.includes(tag)) {
      setPublishTags([...publishTags, tag]);
    }
    setNewTag('');
  };

  // Remove a tag
  const removeTag = (tagToRemove: string) => {
    setPublishTags(publishTags.filter(t => t !== tagToRemove));
  };

  // Publish to community
  const publishToCommunity = async () => {
    if (!result || !publishName.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsPublishing(true);
    try {
      const token = authService.getToken();

      // Get the content to save
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

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <SEO title="Smart Analyzer | Admin" description="AI-powered image analysis and prompt generation" />

      <div className="min-h-screen bg-black text-neutral-300 pb-32 pt-16 selection:bg-brand-cyan/30 selection:text-brand-cyan">
        <div className="max-w-7xl mx-auto px-8 lg:px-12">
          {/* Header Section */}
          <div className="mb-16 space-y-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/apps" className="text-neutral-500 hover:text-white transition-colors text-[10px] font-mono tracking-widest uppercase">
                      Systems
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-neutral-800" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-brand-cyan text-[10px] font-mono tracking-widest uppercase opacity-80">
                    Smart Analyzer
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-end justify-between pb-8">
              <div className="space-y-1">
                <h1 className="text-4xl font-semibold text-white tracking-tight font-manrope">
                  Image Analyzer
                </h1>
                <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-[0.2em] opacity-60">
                  AI-powered design and prompt engine
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
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
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* IDLE STEP: Simple Dropzone */}
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
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
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

            {/* CONFIG STEP: Selection UI */}
            {step === 'config' && (
              <motion.div
                key="config"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="grid lg:grid-cols-7 gap-12"
              >
                {/* Left: Preview */}
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

                {/* Right: Settings */}
                <div className="lg:col-span-3">
                  <GlassPanel padding="lg" className="h-full border-neutral-800/60 flex flex-col">
                    <div className="flex-1 space-y-8">
                      <div className="space-y-6">
                        <div className="mb-4">
                          <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500 font-bold opacity-50">Intent</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3 p-1.5 bg-neutral-950/50 rounded-2xl border border-white/[0.05]">
                          <button
                            onClick={() => setMode('image-gen')}
                            className={cn(
                              "flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-mono transition-all border border-transparent",
                              mode === 'image-gen' ? "bg-neutral-800 text-white border-white/5 shadow-2xl" : "text-neutral-500 hover:text-neutral-300"
                            )}
                          >
                            <Search size={14} /> AI Prompts
                          </button>
                          <button
                            onClick={() => setMode('figma-plugin')}
                            className={cn(
                              "flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-mono transition-all border border-transparent",
                              mode === 'figma-plugin' ? "bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-2xl" : "text-neutral-500 hover:text-neutral-300"
                            )}
                          >
                            <Figma size={14} /> Figma Design
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500 font-bold opacity-50">Preferences</h4>
                        </div>

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

                        {/* Font Selection */}
                        <div className="pt-4 space-y-3">
                          <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 font-bold flex items-center gap-2">
                            <Type size={12} /> Choose Font
                          </label>
                          <Select
                            options={GOOGLE_FONTS}
                            value={selectedFont}
                            onChange={setSelectedFont}
                            placeholder="Detect Font Automatically"
                          />
                          <p className="text-[9px] text-neutral-600 font-mono uppercase leading-tight">Apply this font to the resulting design or prompt.</p>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={analyzeImage}
                      className="w-full mt-12 bg-white hover:bg-neutral-200 text-black h-14 rounded-xl font-semibold tracking-tight transition-all active:scale-[0.98]"
                    >
                      Start Analysis
                      <ArrowRight size={18} className="ml-3 opacity-50" />
                    </Button>
                  </GlassPanel>
                </div>
              </motion.div>
            )}

            {/* RESULT STEP: Full View */}
            {step === 'result' && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-12"
              >
                <div className="grid lg:grid-cols-12 gap-12">
                   {/* Summary Header */}
                  <div className="lg:col-span-12 flex items-center justify-between bg-neutral-900/20 p-8 rounded-3xl mb-4 backdrop-blur-xl border border-white/[0.03]">
                    <div className="flex items-center gap-12">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest leading-none">Category</span>
                        <div className="flex items-center gap-3">
                          <Badge className={cn("px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-lg border", getCategoryColor(result.category))}>
                            {result.category}
                          </Badge>
                          {result.confidence && (
                            <span className="text-[10px] font-mono text-brand-cyan/40 tracking-tighter">
                              {Math.round(result.confidence * 100)}% RELIABILITY
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest leading-none">Name</span>
                        <span className="text-sm font-medium text-white tracking-tight">{result.name}</span>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button onClick={copyPrompt} variant="outline" className="border-neutral-800 text-neutral-300 hover:bg-white hover:text-black hover:border-white h-11 px-6 rounded-xl transition-all">
                        {copied ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
                        {copied ? 'Copied' : 'Copy Output'}
                      </Button>
                      <Button onClick={openPublishModal} className="bg-brand-cyan text-black hover:bg-brand-cyan/90 h-11 px-6 rounded-xl font-medium">
                        <Globe size={16} className="mr-2" />
                        Share
                      </Button>
                    </div>
                  </div>

                  {/* Sidebar: Media & Metadata */}
                  <div className="lg:col-span-4 space-y-8">
                    <GlassPanel padding="none" className="rounded-2xl overflow-hidden border-neutral-800">
                      <img src={image?.preview} alt="Result Source" className="w-full aspect-square object-cover" />
                    </GlassPanel>

                    {result.tags && result.tags.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                          <Tag size={12} /> Tags
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {result.tags.map((tag) => (
                            <span key={tag} className="text-[10px] font-mono px-2.5 py-1.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.mode === 'figma-plugin' && result.tokens && (
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                          <Palette size={12} /> Colors
                        </h4>
                        <div className="grid gap-2">
                          {result.tokens.colors.map((c, i) => (
                            <div key={i} className="flex items-center gap-3 bg-neutral-950/50 p-3 rounded-xl border border-neutral-900 group">
                              <div className="w-8 h-8 rounded-lg shadow-sm border border-white/10" style={{ backgroundColor: c.hex }} />
                              <div className="flex-1">
                                <span className="text-xs text-neutral-300 block">{c.name}</span>
                                <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-tighter">{c.hex}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Main: Generated Code/Prompt */}
                  <div className="lg:col-span-8">
                    <div className="relative group">
                      <div className="absolute -inset-[1px] bg-gradient-to-br from-neutral-800 to-transparent rounded-2xl opacity-50" />
                      <div className="relative bg-neutral-950 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="flex items-center gap-4 px-8 py-5 bg-neutral-900/20">
                          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.2em] shrink-0">{result.mode === 'figma-plugin' ? 'Design Code' : 'AI Prompt'}</span>
                          <div className="flex items-center gap-1.5 w-44 ml-auto">
                            <Type size={10} className="text-neutral-600 shrink-0" />
                            <Select
                              options={GOOGLE_FONTS}
                              value={selectedFont}
                              onChange={setSelectedFont}
                              placeholder="Font Override"
                              variant="node"
                            />
                          </div>
                          <span className="text-[10px] font-mono text-neutral-600 shrink-0">ID: {result.promptId || 'Draft'}</span>
                        </div>
                        <div className="p-8 max-h-[700px] overflow-auto scrollbar-thin scrollbar-thumb-neutral-800">
                          <pre className={cn(
                            "text-sm leading-relaxed whitespace-pre-wrap font-mono",
                            result.mode === 'figma-plugin' ? "text-purple-300" : "text-neutral-300"
                          )}>
                            {displayContent}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Overlay outside AnimatePresence to avoid mode="wait" conflict */}
          <AnalyzingImageOverlay isVisible={step === 'analyzing'} />
        </div>
      </div>

      {/* Publish Modal */}
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
    </>
  );
};
