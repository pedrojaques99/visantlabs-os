import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scissors, Video, Upload, X, Play, Plus, Loader2, Zap, Download } from 'lucide-react';
import { toast } from 'sonner';
import { PageShell } from '../components/ui/PageShell';
import { Button } from '../components/ui/button';
import { RenderQueueProvider } from '../hooks/moodboard/useRenderQueue';
import { RenderToast } from '../components/moodboard/RenderToast';
import { BentoItem } from '../components/moodboard/BentoItem';
import { BatchToolbar } from '../components/moodboard/BatchToolbar';
import { RemotionPlayerModal } from '../components/moodboard/RemotionPlayerModal';
import { FrameAnimateModal } from '../components/moodboard/FrameAnimateModal';
import { moodboardApi } from '../services/moodboardApi';
import { authService } from '../services/authService';
import { applyShaderEffect } from '../utils/shaders/shaderRenderer';
import { generateThumbnail, revokeThumbnail } from '../utils/moodboard/thumbnail';
import type { CroppedImage, AnimationPreset, RenderSlide, TransitionType } from '../types/moodboard';
import type { ImageProvider } from '../types/types';
import { GEMINI_MODELS } from '../constants/geminiModels';
import { getCreditsRequired } from '../utils/creditCalculator';
import { ModelSelector } from '../components/shared/ModelSelector';

async function callVideoApi(body: object): Promise<string> {
  const token = authService.getToken();
  const res = await fetch('/api/video/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Video generation failed'); }
  const { videoUrl, videoBase64 } = await res.json();
  return videoUrl || (videoBase64 ? `data:video/mp4;base64,${videoBase64}` : '');
}

const generateVideoFromImage = (imageBase64: string, prompt: string, allowSound: boolean) =>
  callVideoApi({ imageBase64, prompt, includeAudio: allowSound });

const generateVideoFromFrames = (startFrame: string, endFrame: string, prompt: string, allowSound: boolean) =>
  callVideoApi({ startFrame, endFrame, prompt, includeAudio: allowSound });

const generateVideoFromMoodboard = (referenceImages: string[], prompt: string, allowSound: boolean) =>
  callVideoApi({ referenceImages, prompt, includeAudio: allowSound });

// ---------------------------------------------------------------------------
// Regen queue — model-agnostic, processes one job at a time
// ---------------------------------------------------------------------------
interface RegenJob { id: string; model: string; provider: ImageProvider; }

function useRegenQueue(runJob: (job: RegenJob) => Promise<void>) {
  const queue = useRef<RegenJob[]>([]);
  const running = useRef(false);

  const flush = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length > 0) {
      const job = queue.current.shift()!;
      await runJob(job).catch(() => {}); // errors handled inside runJob
    }
    running.current = false;
  }, [runJob]);

  const enqueue = useCallback((job: RegenJob) => {
    queue.current.push(job);
    flush();
  }, [flush]);

  const enqueueAll = useCallback((jobs: RegenJob[]) => {
    queue.current.push(...jobs);
    flush();
  }, [flush]);

  return { enqueue, enqueueAll };
}

const SESSION_KEY = 'moodboard-session-v1';

function loadSession(): { sourceImage: string | null; croppedImages: CroppedImage[] } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { sourceImage: null, croppedImages: [] };
    return JSON.parse(raw);
  } catch { return { sourceImage: null, croppedImages: [] }; }
}

function saveSession(sourceImage: string | null, croppedImages: CroppedImage[]) {
  try {
    const toSave = {
      sourceImage,
      croppedImages: croppedImages.map(c => ({
        ...c,
        thumbnailUrl: undefined, // blob URL — não persistir
        isUpscaling: false,
        isAnimating: false,
        upscaleStartTime: undefined,
        animationStartTime: undefined,
      })),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(toSave));
  } catch { /* quota exceeded — ignore */ }
}

function MoodboardStudio() {
  const saved = loadSession();
  const [sourceImage, setSourceImage] = useState<string | null>(saved.sourceImage);
  const [croppedImages, setCroppedImages] = useState<CroppedImage[]>(saved.croppedImages);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [remotionData, setRemotionData] = useState<{
    name?: string; thumbnailUrl?: string; url?: string;
    preset?: AnimationPreset; slides?: RenderSlide[]; transition?: TransitionType;
  } | null>(null);
  const [showFrameModal, setShowFrameModal] = useState(false);
  const [allowSound, setAllowSound] = useState(true);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const [isCreatingFullVideo, setIsCreatingFullVideo] = useState(false);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [batchRegenModel, setBatchRegenModel] = useState<string>(GEMINI_MODELS.IMAGE_FLASH);
  const [batchRegenProvider, setBatchRegenProvider] = useState<ImageProvider>('gemini');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveSession(sourceImage, croppedImages); }, [sourceImage, croppedImages]);

  const getImageDimensions = (url: string): Promise<{ width: number; height: number }> =>
    new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve({ width: 1920, height: 1080 });
      img.src = url;
    });

  const handleAISuggest = useCallback(async (itemsToSuggest?: CroppedImage[]) => {
    const targets = itemsToSuggest || (selectedIds.size > 0 ? croppedImages.filter(c => selectedIds.has(c.id)) : croppedImages);
    if (targets.length === 0) return;
    setIsAISuggesting(true);
    try {
      const { suggestions } = await moodboardApi.suggest(targets.map(t => ({ id: t.id, base64: t.url })));
      setCroppedImages(prev => prev.map(crop => {
        const s = suggestions.find(s => s.id === crop.id);
        return s ? { ...crop, animationPrompt: s.prompt, suggestedPreset: s.preset as AnimationPreset } : crop;
      }));
    } catch (err: any) {
      console.error('AI suggest failed', err);
    } finally {
      setIsAISuggesting(false);
    }
  }, [croppedImages, selectedIds]);

  const processFiles = useCallback(async (files: File[]) => {
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (valid.length === 0) return;

    if (valid.length === 1 && !sourceImage && croppedImages.length === 0) {
      const reader = new FileReader();
      reader.onload = e => {
        setSourceImage(e.target?.result as string);
        setCroppedImages([]);
        setSelectedIds(new Set());
      };
      reader.readAsDataURL(valid[0]);
      return;
    }

    const newItems: CroppedImage[] = await Promise.all(valid.map(async file => {
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      const id = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let thumbnailUrl: string | undefined;
      try { thumbnailUrl = await generateThumbnail(dataUrl, id); } catch {}
      return { id, url: dataUrl, thumbnailUrl, isUpscaling: false, isAnimating: false };
    }));

    setCroppedImages(prev => [...prev, ...newItems]);
    handleAISuggest(newItems);
  }, [sourceImage, croppedImages, handleAISuggest]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const files: File[] = [];
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) { const f = items[i].getAsFile(); if (f) files.push(f); }
      }
      if (files.length > 0) processFiles(files);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || []).filter((f: File) => f.type.startsWith('image/'));
      if (files.length > 0) processFiles(files as File[]);
    };
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    window.addEventListener('paste', handlePaste);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);
    return () => { window.removeEventListener('paste', handlePaste); window.removeEventListener('drop', handleDrop); window.removeEventListener('dragover', handleDragOver); };
  }, [processFiles]);

  const splitImage = async () => {
    if (!sourceImage) return;
    setIsAnalyzing(true);
    try {
      const { boxes } = await moodboardApi.detectGrid(sourceImage);
      if (boxes.length === 0) { toast.error('No grid detected. Try a moodboard with clearly separated images.'); return; }

      const img = new Image();
      img.src = sourceImage;
      await new Promise(r => (img.onload = r));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const newCrops: CroppedImage[] = [];

      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        const x = (box.x / 100) * img.width, y = (box.y / 100) * img.height;
        const w = (box.width / 100) * img.width, h = (box.height / 100) * img.height;
        canvas.width = w; canvas.height = h;
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        const id = `crop-${i}-${Date.now()}`;
        let thumbnailUrl: string | undefined;
        try { thumbnailUrl = await generateThumbnail(canvas.toDataURL('image/jpeg', 0.9), id); } catch {}
        newCrops.push({ id, url: canvas.toDataURL('image/jpeg', 0.9), thumbnailUrl, isUpscaling: false, isAnimating: false });
      }

      setCroppedImages(newCrops);
      setSelectedIds(new Set());
      toast.success(`Detected ${newCrops.length} images`);
      handleAISuggest(newCrops);
    } catch (err: any) {
      toast.error(err.message || 'Failed to detect grid');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpscale = async (id: string) => {
    const crop = croppedImages.find(c => c.id === id);
    if (!crop || crop.upscaledUrl || crop.isUpscaling) return;
    setCroppedImages(prev => prev.map(c => c.id === id ? { ...c, isUpscaling: true, upscaleStartTime: Date.now() } : c));
    try {
      const upscaledBase64 = await applyShaderEffect(crop.url, undefined, undefined, {
        shaderType: 'upscale',
        scaleFactor: 2.0,
        upscaleSharpening: 0.3,
      });
      setCroppedImages(prev => prev.map(c => c.id === id ? { ...c, upscaledUrl: upscaledBase64, isUpscaling: false } : c));
    } catch (err: any) {
      toast.error(err.message || 'Upscale failed');
      setCroppedImages(prev => prev.map(c => c.id === id ? { ...c, isUpscaling: false } : c));
    }
  };

  const handleAnimate = async (id: string, prompt: string) => {
    const crop = croppedImages.find(c => c.id === id);
    if (!crop || !crop.url || crop.isAnimating) return;
    setCroppedImages(prev => prev.map(c => c.id === id ? { ...c, isAnimating: true, animationStartTime: Date.now() } : c));
    try {
      const videoUrl = await generateVideoFromImage(crop.upscaledUrl || crop.url, prompt, allowSound);
      setCroppedImages(prev => prev.map(c => c.id === id ? { ...c, videoUrl, isAnimating: false } : c));
    } catch (err: any) {
      toast.error(err.message || 'Video generation failed');
      setCroppedImages(prev => prev.map(c => c.id === id ? { ...c, isAnimating: false } : c));
    }
  };

  const croppedImagesRef = useRef(croppedImages);
  useEffect(() => { croppedImagesRef.current = croppedImages; }, [croppedImages]);

  const runRegenJob = useCallback(async ({ id, model, provider }: RegenJob) => {
    const crop = croppedImagesRef.current.find(c => c.id === id);
    if (!crop?.url) return;
    setRegeneratingIds(prev => new Set(prev).add(id));
    try {
      const token = authService.getToken();
      const base64 = crop.upscaledUrl || crop.url;
      const pureBase64 = base64.startsWith('data:') ? base64.split(',')[1] : base64;
      const mimeType = base64.startsWith('data:') ? base64.split(';')[0].slice(5) : 'image/jpeg';
      const res = await fetch('/api/mockups/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ promptText: `Reimagine em 4k — enhance quality, lighting and detail while preserving the original composition and style [${Date.now()}]`, baseImage: { base64: pureBase64, mimeType }, model, provider }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Regeneration failed'); }
      const { imageBase64, imageUrl } = await res.json();
      if (!imageBase64 && !imageUrl) throw new Error('No image returned');
      const regeneratedUrl = imageUrl || `data:image/png;base64,${imageBase64}`;
      setCroppedImages(prev => prev.map(c => c.id === id ? { ...c, regeneratedUrl } : c));
      toast.success('AI Regeneration ready', {
        description: 'Accept or discard on the image card.',
        action: { label: 'Download', onClick: () => downloadImage(regeneratedUrl, `regen-${id}-${Date.now()}.png`) },
        duration: 10000,
      });
    } catch (err: any) {
      toast.error(`Item ${id.slice(-4)}: ${err.message || 'Regeneration failed'}`);
    } finally {
      setRegeneratingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, []);

  const { enqueue: enqueueRegen, enqueueAll: enqueueRegenAll } = useRegenQueue(runRegenJob);

  const handleRegenerate = useCallback((id: string, model: string, provider: ImageProvider) => {
    enqueueRegen({ id, model, provider });
  }, [enqueueRegen]);

  const handleFrameAnimate = async (start: string, end: string, prompt: string) => {
    setShowFrameModal(false);
    toast.info('Generating frame animation with Veo 3...');
    try {
      const videoUrl = await generateVideoFromFrames(start, end, prompt, allowSound);
      setVideoModalUrl(videoUrl);
    } catch (err: any) {
      toast.error(err.message || 'Frame animation failed');
    }
  };

  const handleCreateFullVideo = async () => {
    const targets = selectedIds.size > 0 ? croppedImages.filter(c => selectedIds.has(c.id)) : croppedImages;
    if (targets.length === 0 || isCreatingFullVideo) return;
    setIsCreatingFullVideo(true);
    toast.info('Generating full moodboard video with Veo 3...');
    try {
      const referenceImages = targets.map(c => c.upscaledUrl || c.url);
      const prompt = 'A professional cinematic video showcasing these images with smooth transitions, professional lighting, and high aesthetic quality.';
      const videoUrl = await generateVideoFromMoodboard(referenceImages, prompt, allowSound);
      setVideoModalUrl(videoUrl);
    } catch (err: any) {
      toast.error(err.message || 'Full video generation failed');
    } finally {
      setIsCreatingFullVideo(false);
    }
  };

  const handleBatchRemotion = async (preset: AnimationPreset) => {
    const targets = selectedIds.size > 0 ? croppedImages.filter(c => selectedIds.has(c.id)) : croppedImages;
    if (targets.length === 1) {
      const crop = targets[0];
      const url = crop.upscaledUrl || crop.url;
      const dims = await getImageDimensions(url);
      setRemotionData({ name: `Clip ${crop.id.slice(-4)}`, thumbnailUrl: crop.thumbnailUrl || url, slides: [{ imageUrl: url, preset, durationInSeconds: 5, ...dims }] });
    } else {
      const slides: RenderSlide[] = await Promise.all(targets.map(async c => {
        const url = c.upscaledUrl || c.url;
        const dims = await getImageDimensions(url);
        return { imageUrl: url, preset: c.suggestedPreset || preset, durationInSeconds: 5, ...dims };
      }));
      setRemotionData({ name: `Moodboard (${targets.length})`, thumbnailUrl: targets[0].thumbnailUrl || targets[0].url, slides, transition: 'fade' });
    }
  };

  const handleRemotionAnimate = async (url: string, preset: AnimationPreset, crop: CroppedImage, index: number) => {
    const dims = await getImageDimensions(url);
    setRemotionData({ name: `Item ${index + 1}`, thumbnailUrl: crop.thumbnailUrl || url, slides: [{ imageUrl: url, preset, durationInSeconds: 5, ...dims }] });
  };

  const removeImage = (id: string) => {
    revokeThumbnail(id);
    setCroppedImages(prev => prev.filter(c => c.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleUpdateCardImage = async (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async e => {
      const url = e.target?.result as string;
      let thumbnailUrl: string | undefined;
      try { thumbnailUrl = await generateThumbnail(url, id); } catch {}
      setCroppedImages(prev => prev.map(c => c.id === id ? { ...c, url, thumbnailUrl } : c));
    };
    reader.readAsDataURL(file);
  };

  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const downloadAll = () => {
    const targets = selectedIds.size > 0 ? croppedImages.filter(c => selectedIds.has(c.id)) : croppedImages;
    targets.forEach((crop, i) => setTimeout(() => downloadImage(crop.upscaledUrl || crop.url, `item-${i + 1}${crop.upscaledUrl ? '-4k' : ''}.jpg`), i * 300));
  };

  const handleReset = () => {
    croppedImages.forEach(c => revokeThumbnail(c.id));
    setSourceImage(null); setCroppedImages([]); setSelectedIds(new Set());
    sessionStorage.removeItem(SESSION_KEY);
  };

  const handleRegenAll = () => {
    const targets = selectedIds.size > 0 ? croppedImages.filter(c => selectedIds.has(c.id) && c.url) : croppedImages.filter(c => c.url);
    enqueueRegenAll(targets.map(c => ({ id: c.id, model: batchRegenModel, provider: batchRegenProvider })));
  };

  const handleAddManualCard = () => {
    const id = `manual-${Date.now()}`;
    setCroppedImages(prev => [{ id, url: '', isUpscaling: false, isAnimating: false }, ...prev]);
  };

  return (
    <PageShell
      pageId="moodboard-studio"
      title="Moodboard Studio"
      description="Extract, upscale and animate images from moodboards"
      breadcrumb={[
        { label: 'Apps', to: '/apps' },
        { label: 'Moodboard Studio' },
      ]}
    >
      <input type="file" ref={fileInputRef} onChange={e => processFiles(Array.from(e.target.files || []))} accept="image/*" multiple className="hidden" />

      <AnimatePresence mode="wait">
        {/* Drop Zone */}
        {!sourceImage && croppedImages.length === 0 && (
          <motion.div key="dropzone" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh]"
          >
            <motion.div
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.01 }}
              className="aspect-video w-full max-w-lg rounded-2xl border-2 border-dashed border-border hover:border-neutral-600 flex flex-col items-center justify-center gap-6 transition-all duration-300 cursor-pointer bg-neutral-950/40 px-8 py-10"
            >
              <Upload size={28} className="text-neutral-600" strokeWidth={1} />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.4em] font-medium text-neutral-500">Upload or Drop Moodboard</p>
                <p className="text-[9px] text-neutral-700 uppercase tracking-[0.2em] mt-2">Single image for AI grid detection · Multiple for batch processing</p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Source Image — awaiting split */}
        {sourceImage && croppedImages.length === 0 && (
          <motion.div key="source" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6 max-w-2xl mx-auto"
          >
            <div className="relative w-full rounded-2xl overflow-hidden border border-border bg-neutral-950 group">
              <img src={sourceImage} alt="Source" className="w-full h-auto object-contain max-h-[500px]" />
              <button onClick={handleReset} className="absolute top-4 right-4 p-2 rounded-lg bg-black/50 text-neutral-400 hover:text-white transition-all border border-white/10">
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-3">
              <Button variant="default" onClick={splitImage} disabled={isAnalyzing}>
                {isAnalyzing ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Scissors size={15} className="mr-2" />}
                {isAnalyzing ? 'Detecting Grid...' : 'Detect & Extract'}
              </Button>
              <Button variant="secondary" onClick={() => setShowFrameModal(true)} disabled={isCreatingFullVideo}>
                <Video size={15} className="mr-2" />Frame Animation
              </Button>
            </div>
          </motion.div>
        )}

        {/* Images Grid */}
        {croppedImages.length > 0 && (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-white">{croppedImages.length} images</span>
                {croppedImages.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={handleCreateFullVideo} disabled={isCreatingFullVideo}>
                    {isCreatingFullVideo ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Video size={13} className="mr-1.5" />}
                    {isCreatingFullVideo ? 'Generating...' : 'Full Video (Veo 3)'}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <ModelSelector
                  type="image"
                  variant="node"
                  selectedModel={batchRegenModel}
                  onModelChange={(m, p) => { setBatchRegenModel(m); if (p) setBatchRegenProvider(p); }}
                  className="w-[160px]"
                />
                <Button variant="secondary" size="sm" onClick={handleRegenAll} disabled={regeneratingIds.size > 0}>
                  <Zap size={13} className="mr-1.5" />
                  Regenerar todos
                  <span className="ml-1.5 text-[9px] opacity-60">
                    {getCreditsRequired(batchRegenModel, undefined, batchRegenProvider) * croppedImages.filter(c => c.url).length}cr
                  </span>
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadAll}>
                  <Download size={13} className="mr-1.5" />Baixar todos
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset}>Reset</Button>
                <Button variant="secondary" size="sm" onClick={handleAddManualCard}><Plus size={13} className="mr-1" />Add</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {croppedImages.map((crop, idx) => (
                <BentoItem
                  key={crop.id}
                  crop={crop}
                  index={idx}
                  isSelected={selectedIds.has(crop.id)}
                  onToggleSelect={toggleSelect}
                  onRemove={removeImage}
                  onUpscale={handleUpscale}
                  onAnimate={handleAnimate}
                  onRemotionAnimate={(url, preset) => handleRemotionAnimate(url, preset, crop, idx)}
                  onDownload={downloadImage}
                  onFullscreen={setFullscreenUrl}
                  onViewVideo={setVideoModalUrl}
                  onUpdateImage={(file) => handleUpdateCardImage(crop.id, file)}
                  onRegenerate={handleRegenerate}
                  isRegenerating={regeneratingIds.has(crop.id)}
                  onAcceptRegenerated={id => setCroppedImages(prev => prev.map(c => c.id === id && c.regeneratedUrl ? { ...c, url: c.regeneratedUrl, thumbnailUrl: undefined, upscaledUrl: undefined, regeneratedUrl: undefined } : c))}
                  onDiscardRegenerated={id => setCroppedImages(prev => prev.map(c => c.id === id ? { ...c, regeneratedUrl: undefined } : c))}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {fullscreenUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-8"
            onClick={() => setFullscreenUrl(null)}
          >
            <button className="absolute top-6 right-6 p-3 rounded-full bg-white text-black hover:scale-110 transition-transform" onClick={() => setFullscreenUrl(null)}>
              <X size={20} strokeWidth={1.5} />
            </button>
            <img src={fullscreenUrl} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          </motion.div>
        )}

        {videoModalUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-8"
            onClick={() => setVideoModalUrl(null)}
          >
            <button className="absolute top-6 right-6 p-3 rounded-full bg-white text-black hover:scale-110 transition-transform" onClick={() => setVideoModalUrl(null)}>
              <X size={20} strokeWidth={1.5} />
            </button>
            <video src={videoModalUrl} controls autoPlay loop className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          </motion.div>
        )}
      </AnimatePresence>

      {sourceImage && (
        <FrameAnimateModal
          isOpen={showFrameModal}
          onClose={() => setShowFrameModal(false)}
          onAnimate={handleFrameAnimate}
          sourceImage={sourceImage}
          allowSound={allowSound}
          onSoundToggle={() => setAllowSound(!allowSound)}
        />
      )}

      <RemotionPlayerModal
        isOpen={!!remotionData}
        onClose={() => setRemotionData(null)}
        name={remotionData?.name}
        thumbnailUrl={remotionData?.thumbnailUrl}
        imageUrl={remotionData?.slides?.[0]?.imageUrl || ''}
        preset={remotionData?.slides?.[0]?.preset || 'zoom-in'}
        slides={remotionData?.slides}
        transition={remotionData?.transition}
      />

      <BatchToolbar
        selectedCount={selectedIds.size}
        totalCount={croppedImages.length}
        onSelectAll={() => setSelectedIds(new Set(croppedImages.map(c => c.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
        onBatchUpscale={() => Array.from(selectedIds).forEach(id => handleUpscale(id))}
        onBatchDownload={downloadAll}
        onBatchRemove={() => { Array.from(selectedIds).forEach(id => removeImage(id)); setSelectedIds(new Set()); }}
        onBatchRemotion={handleBatchRemotion}
        onAISuggest={() => handleAISuggest()}
        isAISuggesting={isAISuggesting}
      />

      {/* AI suggesting indicator */}
      <AnimatePresence>
        {isAISuggesting && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 right-6 z-40 bg-neutral-950/90 backdrop-blur-xl border border-border px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl"
          >
            <Loader2 size={14} className="text-neutral-400 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">AI Analyzing</span>
          </motion.div>
        )}
      </AnimatePresence>

      <RenderToast />
    </PageShell>
  );
}

export function MoodboardStudioPage() {
  return (
    <RenderQueueProvider>
      <MoodboardStudio />
    </RenderQueueProvider>
  );
}
