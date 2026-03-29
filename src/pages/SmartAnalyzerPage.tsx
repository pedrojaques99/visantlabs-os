import React, { useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Wand2,
  Upload,
  Loader2,
  Copy,
  Check,
  Save,
  Sparkles,
  ImageIcon,
  Tag,
  Percent,
  Figma,
  Palette,
  X,
  Plus,
  Globe
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

  // Paste event listener (Ctrl+V)
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleFileSelect(file);
            toast.success('Image pasted!');
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFileSelect]);

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
    if (!result) return;

    let textToCopy: string;
    if (result.mode === 'figma-plugin' && result.operations) {
      textToCopy = JSON.stringify(result.operations, null, 2);
    } else if (result.prompt) {
      textToCopy = result.prompt;
    } else {
      return;
    }

    navigator.clipboard.writeText(textToCopy);
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

      <div className="min-h-screen bg-[#050505] text-neutral-300 pb-20 pt-10">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-12">
            <Breadcrumb className="mb-6">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/apps" className="text-neutral-500 hover:text-brand-cyan transition-colors text-[10px] font-mono tracking-[0.2em]">
                      APPS
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-neutral-800" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-neutral-400 text-[10px] font-mono tracking-[0.2em] uppercase">
                    SMART ANALYZER
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-brand-cyan/20 to-purple-500/20 border border-brand-cyan/30">
                <Wand2 className="w-8 h-8 text-brand-cyan" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white font-manrope">Smart Analyzer</h1>
                <p className="text-sm text-neutral-500 font-mono">Auto-detect image type & generate prompts</p>
              </div>
              <Badge variant="outline" className="ml-auto border-brand-cyan/50 text-brand-cyan">
                ADMIN
              </Badge>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Upload Section */}
            <Card className="bg-neutral-900/50 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-lg font-mono flex items-center gap-2">
                  <Upload size={18} className="text-brand-cyan" />
                  Upload Image
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`
                    relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                    transition-all duration-300
                    ${isDragging
                      ? 'border-brand-cyan bg-brand-cyan/10'
                      : 'border-neutral-700 hover:border-neutral-600'
                    }
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleInputChange}
                    className="hidden"
                  />

                  {image?.preview ? (
                    <div className="space-y-4">
                      <img
                        src={image.preview}
                        alt="Preview"
                        className="max-h-48 mx-auto rounded-lg object-contain"
                      />
                      <p className="text-xs text-neutral-500">Click or drag to replace</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-neutral-800 flex items-center justify-center">
                        <ImageIcon size={32} className="text-neutral-600" />
                      </div>
                      <div>
                        <p className="text-neutral-400">Drop image here or click to upload</p>
                        <p className="text-xs text-neutral-600 mt-1">PNG, JPG, WebP up to 5MB</p>
                        <p className="text-xs text-brand-cyan/60 mt-2 font-mono">or press Ctrl+V to paste</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mode Toggle */}
                <div className="flex gap-2 p-1 bg-neutral-800/50 rounded-lg">
                  <button
                    onClick={() => setMode('image-gen')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-mono transition-all ${
                      mode === 'image-gen'
                        ? 'bg-brand-cyan text-black'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Palette size={14} />
                    Image Gen
                  </button>
                  <button
                    onClick={() => setMode('figma-plugin')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-mono transition-all ${
                      mode === 'figma-plugin'
                        ? 'bg-purple-500 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Figma size={14} />
                    Figma Plugin
                  </button>
                </div>

                {/* Options */}
                <div className="space-y-4 pt-4 border-t border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-neutral-400">White Label</span>
                      <p className="text-[10px] text-neutral-600">Remove logos & brand elements</p>
                    </div>
                    <Switch
                      checked={whiteLabel}
                      onCheckedChange={setWhiteLabel}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">Save to Library</span>
                    <Switch
                      checked={saveToLib}
                      onCheckedChange={setSaveToLib}
                    />
                  </div>

                  {saveToLib && (
                    <div className="flex items-center justify-between pl-4">
                      <span className="text-sm text-neutral-500">Publish publicly</span>
                      <Switch
                        checked={publish}
                        onCheckedChange={setPublish}
                      />
                    </div>
                  )}
                </div>

                <Button
                  onClick={analyzeImage}
                  disabled={!image || isAnalyzing}
                  className="w-full bg-brand-cyan hover:bg-brand-cyan/90 text-black font-mono"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze Image
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results Section */}
            <Card className="bg-neutral-900/50 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-lg font-mono flex items-center gap-2">
                  {result?.mode === 'figma-plugin' ? (
                    <Figma size={18} className="text-purple-400" />
                  ) : (
                    <Wand2 size={18} className="text-purple-400" />
                  )}
                  {result?.mode === 'figma-plugin' ? 'Figma Operations' : 'Analysis Result'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="space-y-6">
                    {/* Category & Name */}
                    <div className="flex items-center gap-3">
                      <Badge className={`${getCategoryColor(result.category)} border`}>
                        {result.category}
                      </Badge>
                      {result.confidence && (
                        <div className="flex items-center gap-1 text-xs text-neutral-500">
                          <Percent size={12} />
                          {Math.round(result.confidence * 100)}% confidence
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Component Name</p>
                      <p className="text-white font-medium">{result.name}</p>
                    </div>

                    {/* Mode: Figma Plugin */}
                    {result.mode === 'figma-plugin' && result.operations && (
                      <>
                        {/* Tokens */}
                        {result.tokens && (result.tokens.colors.length > 0 || result.tokens.typography.length > 0) && (
                          <div className="space-y-3">
                            <p className="text-xs text-neutral-500 flex items-center gap-1">
                              <Palette size={12} /> Extracted Tokens
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {result.tokens.colors.map((c, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 bg-neutral-800 px-2 py-1 rounded text-xs"
                                >
                                  <div
                                    className="w-3 h-3 rounded-sm border border-white/20"
                                    style={{ backgroundColor: c.hex }}
                                  />
                                  <span className="text-neutral-400">{c.name}</span>
                                  <span className="text-neutral-600 font-mono">{c.hex}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Operations JSON */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-neutral-500">
                              Operations ({result.operations.length})
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={copyPrompt}
                              className="h-7 text-xs text-neutral-400 hover:text-white"
                            >
                              {copied ? <Check size={14} /> : <Copy size={14} />}
                              <span className="ml-1">{copied ? 'Copied!' : 'Copy JSON'}</span>
                            </Button>
                          </div>
                          <div className="bg-neutral-950 rounded-lg p-4 border border-neutral-800 max-h-[300px] overflow-auto">
                            <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap">
                              {JSON.stringify(result.operations, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Mode: Image Generation */}
                    {result.mode === 'image-gen' && (
                      <>
                        {/* Tags */}
                        {result.tags && result.tags.length > 0 && (
                          <div>
                            <p className="text-xs text-neutral-500 mb-2 flex items-center gap-1">
                              <Tag size={12} /> Tags
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {result.tags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs border-neutral-700 text-neutral-400">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Prompt Type */}
                        {result.promptType && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-neutral-500">Prompt Type:</span>
                            <Badge variant="outline" className={
                              result.promptType === 'figma-plugin'
                                ? 'border-pink-500/50 text-pink-400'
                                : 'border-green-500/50 text-green-400'
                            }>
                              {result.promptType === 'figma-plugin' ? 'Figma Plugin' : 'Image Generation'}
                            </Badge>
                          </div>
                        )}

                        {/* Generated Prompt */}
                        {result.prompt && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-neutral-500">Generated Prompt</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={copyPrompt}
                                className="h-7 text-xs text-neutral-400 hover:text-white"
                              >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                <span className="ml-1">{copied ? 'Copied!' : 'Copy'}</span>
                              </Button>
                            </div>
                            <div className="bg-neutral-950 rounded-lg p-4 border border-neutral-800">
                              <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                {result.prompt}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Saved indicator */}
                    {result.promptId && (
                      <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                        <Save size={14} />
                        Saved to {result.libraryCategory || 'figma-prompts'} library
                      </div>
                    )}

                    {/* Publish Button */}
                    <Button
                      onClick={openPublishModal}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-mono"
                    >
                      <Globe size={16} className="mr-2" />
                      Publish to Community
                    </Button>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-neutral-600">
                    {mode === 'figma-plugin' ? (
                      <Figma size={48} className="mb-4 opacity-30" />
                    ) : (
                      <Wand2 size={48} className="mb-4 opacity-30" />
                    )}
                    <p className="text-sm">Upload an image to analyze</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Publish Modal */}
      <Dialog open={showPublishModal} onOpenChange={setShowPublishModal}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono">
              <Globe size={20} className="text-purple-400" />
              Publish to Community
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Preview Card */}
            <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-3">Preview</p>
              <div className="flex items-start gap-3">
                {image?.preview && (
                  <img
                    src={image.preview}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-neutral-700"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{publishName || 'Untitled'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`${getCategoryColor(result?.category || '')} border text-[10px]`}>
                      {result?.category}
                    </Badge>
                    <span className="text-[10px] text-neutral-500">
                      {result?.mode === 'figma-plugin' ? 'Figma Operations' : 'Image Prompt'}
                    </span>
                  </div>
                  {publishTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {publishTags.slice(0, 4).map((tag, i) => (
                        <span key={i} className="text-[9px] text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                      {publishTags.length > 4 && (
                        <span className="text-[9px] text-neutral-600">+{publishTags.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="text-xs text-neutral-400 mb-2 block">Name</label>
              <Input
                value={publishName}
                onChange={(e) => setPublishName(e.target.value)}
                placeholder="Enter a name..."
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs text-neutral-400 mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {publishTags.map((tag, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 bg-neutral-800 text-neutral-300 px-2 py-1 rounded text-xs"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag..."
                  className="bg-neutral-800 border-neutral-700 text-white flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTag}
                  className="border-neutral-700 text-neutral-400 hover:text-white"
                >
                  <Plus size={14} />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowPublishModal(false)}
              className="text-neutral-400"
            >
              Cancel
            </Button>
            <Button
              onClick={publishToCommunity}
              disabled={isPublishing || !publishName.trim()}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              {isPublishing ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Globe size={14} className="mr-2" />
                  Publish
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
