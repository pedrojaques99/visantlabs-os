import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, Library, Download, CircleDot, Paintbrush, Undo2, Redo2, RotateCcw, PanelRightOpen, Hand, Printer, Play, Pause, Zap, Blend } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/config/api';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { HalftoneCanvas, type HalftoneCanvasHandle } from '@/components/halftone/HalftoneCanvas';
import { generateHalftoneSvg } from '@/components/halftone/halftone-svg-export';
import { HalftoneControls } from '@/components/halftone/HalftoneControls';
import { TextureFilterCanvas, type TextureFilterCanvasHandle } from '@/components/texture-filter/TextureFilterCanvas';
import { TextureFilterControls } from '@/components/texture-filter/TextureFilterControls';
import { RisoCanvas, type RisoCanvasHandle } from '@/components/riso/RisoCanvas';
import { RisoControls } from '@/components/riso/RisoControls';
import { ShaderLabCanvas, type ShaderLabCanvasHandle } from '@/components/shader-lab/ShaderLabCanvas';
import { ShaderLabControls } from '@/components/shader-lab/ShaderLabControls';
import { BeforeAfterOverlay } from '@/components/shared/BeforeAfterOverlay';
import { ExportModal } from '@/components/shared/ExportModal';
import { ImageLabPresetLibrary } from '@/components/shared/ImageLabPresetLibrary';
import { useHalftoneStore, HALFTONE_PRESETS } from '@/stores/halftoneStore';
import { useTextureFilterStore, FILTER_PRESETS } from '@/stores/textureFilterStore';
import { useRisoStore } from '@/stores/risoStore';
import { useShaderLabStore } from '@/stores/shaderLabStore';
import { RISO_FULL_PRESETS } from '@/components/riso/RisoRenderer';
import { hexToRgb } from '@/utils/colorUtils';
import { useImageLabStore, type ImageLabMode } from '@/stores/imageLabStore';
import { useExportCanvas } from '@/hooks/useExportCanvas';
import { useToolEditorHotkeys } from '@/hooks/useToolEditorHotkeys';
import { useToolEditorDragDrop } from '@/hooks/useToolEditorDragDrop';
import { loadImage } from '@/utils/imageUtils';
import { useMagicHand } from '@/hooks/useMagicHand';
import { exportVideoServerSide, type VideoFormat } from '@/utils/videoExport';
import { ImageLabUploadWidget } from '@/components/shared/ImageLabUploadWidget';
import { useIsMobile } from '@/hooks/use-media-query';

const VALID_MODES = new Set<string>(['halftone', 'texture', 'riso', 'shaders']);

const PRESET_KEYS: Record<ImageLabMode, string[]> = {
  halftone: Object.keys(HALFTONE_PRESETS),
  texture: Object.keys(FILTER_PRESETS),
  riso: Object.keys(RISO_FULL_PRESETS),
  shaders: [],
};

const RISO_AI_PROMPT = `CORE DIRECTIVE: RISOGRAPH PRINT RECREATION
TASK: Analyze the input image and recreate it as an authentic risograph print — a vintage stencil-based duplication technique where each color is printed as a separate ink layer on uncoated paper.
STEP 1: COLOR ANALYSIS & REDUCTION — Reduce to max 4 ink layers loyal to original palette. White areas become raw paper.
STEP 2: GRAPHIC SIMPLIFICATION — Bold flat shapes, coarse halftone dots for mid-tones, hard-edged silhouettes with imperfection.
STEP 3: LAYER SIMULATION & OVERPRINT — Multiply blending where inks overlap. 1-3px misregistration. Slight ink bleed.
STEP 4: PAPER & INK TEXTURE — Off-white/cream paper with grain. Uneven ink density, speckle, ink dropout.
STEP 5: FINAL PRINT AESTHETIC — Handmade analog feel. No clean digital look. No shadows, glows, or gradients.
NEGATIVE PROMPT: smooth gradients, photorealistic rendering, clean digital illustration, anti-aliased edges, perfect color registration, white background, more than 4-5 ink colors, airbrushed tones, 3D shading, HDR, oversaturated digital colors`;

/* ─── Per-mode state bridge ─── */

function usePerModeState(mode: ImageLabMode) {
  const h = useHalftoneStore;
  const t = useTextureFilterStore;
  const r = useRisoStore;
  const s = useShaderLabStore;

  const hPanel = h((s) => s.panelVisible); const hSetPanel = h((s) => s.setPanelVisible);
  const hReset = h((s) => s.resetSettings); const hFile = h((s) => s.fileName);
  const hZoom = h((s) => s.zoom); const hUndo = h((s) => s.undo); const hRedo = h((s) => s.redo);
  const hHi = h((s) => s.historyIndex); const hHl = h((s) => s.settingsHistory.length);
  const hImg = h((s) => s.imageUrl);

  const tPanel = t((s) => s.panelVisible); const tSetPanel = t((s) => s.setPanelVisible);
  const tReset = t((s) => s.resetSettings); const tFile = t((s) => s.fileName);
  const tZoom = t((s) => s.zoom); const tUndo = t((s) => s.undo); const tRedo = t((s) => s.redo);
  const tHi = t((s) => s.historyIndex); const tHl = t((s) => s.settingsHistory.length);
  const tImg = t((s) => s.imageUrl);

  const rPanel = r((s) => s.panelVisible); const rSetPanel = r((s) => s.setPanelVisible);
  const rReset = r((s) => s.resetSettings); const rFile = r((s) => s.fileName);
  const rZoom = r((s) => s.zoom); const rUndo = r((s) => s.undo); const rRedo = r((s) => s.redo);
  const rHi = r((s) => s.historyIndex); const rHl = r((s) => s.settingsHistory.length);
  const rImg = r((s) => s.imageUrl);

  const sZoom = s((st) => st.zoom); const sUndo = s((st) => st.undo); const sRedo = s((st) => st.redo);
  const sHi = s((st) => st.historyIndex); const sHl = s((st) => st.historyLength);
  const sImg = s((st) => st.imageUrl); const sFile = s((st) => st.fileName);
  const sReset = s((st) => st.reset);

  const [sPanelVisible, setSPanelVisible] = useState(true);

  return useMemo(() => {
    if (mode === 'halftone') return { panelVisible: hPanel, setPanelVisible: hSetPanel, resetSettings: hReset, fileName: hFile, zoom: hZoom, undo: hUndo, redo: hRedo, historyIndex: hHi, historyLength: hHl, hasImage: !!hImg, store: h };
    if (mode === 'texture') return { panelVisible: tPanel, setPanelVisible: tSetPanel, resetSettings: tReset, fileName: tFile, zoom: tZoom, undo: tUndo, redo: tRedo, historyIndex: tHi, historyLength: tHl, hasImage: !!tImg, store: t };
    if (mode === 'shaders') return { panelVisible: sPanelVisible, setPanelVisible: setSPanelVisible, resetSettings: sReset, fileName: sFile, zoom: sZoom, undo: sUndo, redo: sRedo, historyIndex: sHi, historyLength: sHl, hasImage: !!sImg, store: s };
    return { panelVisible: rPanel, setPanelVisible: rSetPanel, resetSettings: rReset, fileName: rFile, zoom: rZoom, undo: rUndo, redo: rRedo, historyIndex: rHi, historyLength: rHl, hasImage: !!rImg, store: r };
  }, [mode, hPanel, hSetPanel, hReset, hFile, hZoom, hUndo, hRedo, hHi, hHl, hImg,
    tPanel, tSetPanel, tReset, tFile, tZoom, tUndo, tRedo, tHi, tHl, tImg,
    rPanel, rSetPanel, rReset, rFile, rZoom, rUndo, rRedo, rHi, rHl, rImg,
    sPanelVisible, sReset, sFile, sZoom, sUndo, sRedo, sHi, sHl, sImg]);
}

/* ─── Canvas thumbnail hook ─── */

function useCanvasThumbnails(
  canvasRefsMap: React.MutableRefObject<Record<ImageLabMode, HTMLCanvasElement | null>>,
) {
  const hHi = useHalftoneStore((s) => s.historyIndex);
  const hImg = useHalftoneStore((s) => s.imageUrl);
  const tHi = useTextureFilterStore((s) => s.historyIndex);
  const tImg = useTextureFilterStore((s) => s.imageUrl);
  const rHi = useRisoStore((s) => s.historyIndex);
  const rImg = useRisoStore((s) => s.imageUrl);

  const sHi = useShaderLabStore((s) => s.historyIndex);
  const sImg = useShaderLabStore((s) => s.imageUrl);

  const [thumbs, setThumbs] = useState<Record<ImageLabMode, string | null>>({
    halftone: null, texture: null, riso: null, shaders: null,
  });

  const frameId = useRef<number>(0);

  const capture = useCallback((modeKey: ImageLabMode) => {
    const canvas = canvasRefsMap.current[modeKey];
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    cancelAnimationFrame(frameId.current);
    frameId.current = requestAnimationFrame(() => {
      try {
        const tmp = document.createElement('canvas');
        const size = 72;
        tmp.width = size;
        tmp.height = size;
        const ctx = tmp.getContext('2d');
        if (!ctx) return;
        const scale = Math.max(size / canvas.width, size / canvas.height);
        const w = canvas.width * scale;
        const h = canvas.height * scale;
        ctx.drawImage(canvas, (size - w) / 2, (size - h) / 2, w, h);
        const url = tmp.toDataURL('image/jpeg', 0.6);
        setThumbs((prev) => ({ ...prev, [modeKey]: url }));
      } catch { /* tainted canvas, ignore */ }
    });
  }, [canvasRefsMap]);

  useEffect(() => { if (hImg) capture('halftone'); }, [hHi, hImg, capture]);
  useEffect(() => { if (tImg) capture('texture'); }, [tHi, tImg, capture]);
  useEffect(() => { if (rImg) capture('riso'); }, [rHi, rImg, capture]);
  useEffect(() => { if (sImg) capture('shaders'); }, [sHi, sImg, capture]);

  return thumbs;
}

/* ─── Preset cycling hook ─── */

function usePresetCycling(mode: ImageLabMode) {
  const [currentPresetIndex, setCurrentPresetIndex] = useState(-1);

  const cyclePreset = useCallback((direction: 1 | -1) => {
    const keys = PRESET_KEYS[mode];
    if (!keys.length) return;

    const next = currentPresetIndex + direction;
    const idx = ((next % keys.length) + keys.length) % keys.length;
    setCurrentPresetIndex(idx);
    const name = keys[idx];

    if (mode === 'halftone') {
      useHalftoneStore.getState().applyPreset(name);
    } else if (mode === 'texture') {
      const preset = FILTER_PRESETS[name];
      const store = useTextureFilterStore.getState();
      Object.entries(preset).forEach(([k, v]) => store.updateSetting(k as any, v as any));
    } else if (mode === 'riso') {
      const preset = RISO_FULL_PRESETS[name];
      if (preset) {
        const store = useRisoStore.getState();
        const layers = preset.colors.map((hex: string, i: number) => ({
          color: hexToRgb(hex), hex, visible: true, alpha: 0.85,
          angle: i * 22.5, offsetX: [1, -1, 1, -1][i], offsetY: [-1, 1, 1, -1][i],
        }));
        store.setLayers(layers);
        store.updateSetting('frequency', preset.frequency);
        store.updateSetting('dotSize', preset.dotSize);
        store.updateSetting('paperColor', preset.paperColor);
        store.updateSetting('paperNoise', preset.paperNoise);
        store.updateSetting('inkNoise', preset.inkNoise);
        store.updateSetting('inkDropout', preset.inkDropout);
        store.updateSetting('misregistration', preset.misregistration);
        store.updateSetting('edgeBleed', preset.edgeBleed);
      }
    }
    toast.success(`Preset: ${name}`);
  }, [mode, currentPresetIndex]);

  useEffect(() => { setCurrentPresetIndex(-1); }, [mode]);

  return cyclePreset;
}

/* ─── Main Page ─── */

export const ImageLabPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const labStore = useImageLabStore;
  const mode = labStore((s) => s.mode);
  const setMode = labStore((s) => s.setMode);
  const sourceUrl = labStore((s) => s.sourceUrl);
  const compareMode = labStore((s) => s.compareMode);
  const setCompareMode = labStore((s) => s.setCompareMode);
  const setShowOriginal = labStore((s) => s.setShowOriginal);
  const exportModalOpen = labStore((s) => s.exportModalOpen);
  const setExportModalOpen = labStore((s) => s.setExportModalOpen);
  const magicHandActive = labStore((s) => s.magicHandActive);
  const setMagicHandActive = labStore((s) => s.setMagicHandActive);
  const effectOpacity = labStore((s) => s.effectOpacity);
  const setEffectOpacity = labStore((s) => s.setEffectOpacity);
  const sourceMediaType = labStore((s) => s.sourceMediaType);
  const videoIsPlaying = labStore((s) => s.videoIsPlaying);
  const videoDuration = labStore((s) => s.videoDuration);
  const videoCurrentTime = labStore((s) => s.videoCurrentTime);

  const halftoneStore = useHalftoneStore;
  const textureStore = useTextureFilterStore;
  const risoStore = useRisoStore;

  const active = usePerModeState(mode);
  const { panelVisible, setPanelVisible, resetSettings, fileName, zoom, undo, redo, historyIndex, historyLength, hasImage, store: activeStore } = active;

  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [presetLibraryOpen, setPresetLibraryOpen] = useState(false);

  const cyclePreset = usePresetCycling(mode);

  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode && VALID_MODES.has(urlMode) && urlMode !== mode) {
      setMode(urlMode as ImageLabMode);
    }
  }, []);

  const handleModeChange = useCallback((m: ImageLabMode) => {
    setMode(m);
    setSearchParams({ mode: m }, { replace: true });
  }, [setMode, setSearchParams]);

  const shaderLabStore = useShaderLabStore;

  const broadcastImage = useCallback((url: string, name: string, mediaType: 'image' | 'video' = 'image') => {
    labStore.getState().setSource(url, name, mediaType);
    halftoneStore.getState().setImageUrl(url, name, mediaType);
    risoStore.getState().setImageUrl(url, name, mediaType);
    textureStore.getState().setImageUrl(url, name, mediaType);
    shaderLabStore.getState().setImageUrl(url, name, mediaType);
  }, []);

  const canvasRefsMap = useRef<Record<ImageLabMode, HTMLCanvasElement | null>>({
    halftone: null, texture: null, riso: null, shaders: null,
  });
  const halftoneRef = useRef<HalftoneCanvasHandle>(null);
  const risoRef = useRef<RisoCanvasHandle>(null);
  const textureRef = useRef<TextureFilterCanvasHandle>(null);
  const shaderRef = useRef<ShaderLabCanvasHandle>(null);
  const magicHandAreaRef = useRef<HTMLDivElement>(null);
  const thumbs = useCanvasThumbnails(canvasRefsMap);

  useMagicHand(magicHandAreaRef);

  const onHalftoneCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRefsMap.current.halftone = canvas;
  }, []);
  const onTextureCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRefsMap.current.texture = canvas;
  }, []);
  const onRisoCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRefsMap.current.riso = canvas;
  }, []);
  const onShaderCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRefsMap.current.shaders = canvas;
  }, []);

  const { canvasRef, onCanvasReady, exportPng } = useExportCanvas({
    filenamePrefix: `imagelab_${mode}`,
    getShaderSettings: () => {
      const s = activeStore.getState() as any;
      return s.shaderEnabled ? s.getShaderSettings() : undefined;
    },
    setIsExporting: (v) => (activeStore.getState() as any).setIsExporting(v),
  });

  useEffect(() => {
    const active = canvasRefsMap.current[mode];
    if (active) canvasRef.current = active;
  }, [mode, canvasRef]);

  const getShaderSettings = useCallback(() => {
    const s = activeStore.getState() as any;
    return s.shaderEnabled ? s.getShaderSettings() : undefined;
  }, [activeStore]);

  const getActiveVideoControls = useCallback(() => {
    if (mode === 'halftone') return halftoneRef.current?.getVideoControls();
    if (mode === 'riso') return risoRef.current?.getVideoControls();
    if (mode === 'texture') return textureRef.current?.getVideoControls();
    return null;
  }, [mode]);

  const handleVideoExport = useCallback(async (fmt: VideoFormat, onProgress: (pct: number) => void) => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('No canvas');

    const vc = getActiveVideoControls();
    if (!vc?.videoRef.current) throw new Error('No video source');

    const video = vc.videoRef.current;

    const renderFrame = async (v: HTMLVideoElement) => {
      if (mode === 'halftone') {
        const r = halftoneRef.current?.getRenderer();
        if (r) { r.updateTexture(v); r.render({ ...useHalftoneStore.getState().getSettings(), effectOpacity: useImageLabStore.getState().effectOpacity }); }
      } else if (mode === 'riso') {
        const r = risoRef.current?.getRenderer();
        if (r) { r.updateTexture(v); r.render({ ...useRisoStore.getState().getSettings(), effectOpacity: useImageLabStore.getState().effectOpacity }); }
      } else if (mode === 'texture') {
        // TextureFilterCanvas renderFrame is internal, trigger via seeking (rAF will pick it up)
      }
    };

    return exportVideoServerSide({
      video,
      renderFrame,
      canvas,
      format: fmt,
      fps: 30,
      onProgress,
    });
  }, [canvasRef, mode, getActiveVideoControls]);

  const { isDragOver, dragProps, dropMessage } = useToolEditorDragDrop({
    accept: 'image+video',
    onFile: useCallback((file: File) => {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      broadcastImage(url, file.name || 'pasted', isVideo ? 'video' : 'image');
      toast.success(`Loaded ${file.name || 'pasted image'}`);
    }, [broadcastImage]),
    dropMessage: 'Drop image or video here',
  });

  useToolEditorHotkeys({
    onExport: exportPng,
    panelVisible,
    setPanelVisible,
    undo,
    redo,
    zoom: {
      current: zoom,
      set: (z) => (activeStore.getState() as any).setZoom(z),
      resetPan: () => (activeStore.getState() as any).setPan(0, 0),
    },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1' && !e.altKey && !e.shiftKey && !e.ctrlKey) handleModeChange('halftone');
      if (e.key === '2' && !e.altKey && !e.shiftKey && !e.ctrlKey) handleModeChange('texture');
      if (e.key === '3' && !e.altKey && !e.shiftKey && !e.ctrlKey) handleModeChange('riso');
      if (e.key === '4' && !e.altKey && !e.shiftKey && !e.ctrlKey) handleModeChange('shaders');

      if (e.altKey && e.key === 'z') {
        e.preventDefault();
        const current = labStore.getState().compareMode;
        setCompareMode(current === 'toggle' ? 'off' : 'toggle');
      }

      if (e.altKey && e.key === 'x') {
        e.preventDefault();
        const current = labStore.getState().compareMode;
        setCompareMode(current === 'split' ? 'off' : 'split');
      }

      if (e.key === 'm' && !e.altKey && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        setMagicHandActive(!labStore.getState().magicHandActive);
      }

      if (e.key === 'Escape') {
        const current = labStore.getState().compareMode;
        if (current !== 'off') { e.preventDefault(); setCompareMode('off'); }
      }

      if (e.key === '[') { e.preventDefault(); cyclePreset(-1); }
      if (e.key === ']') { e.preventDefault(); cyclePreset(1); }

      if (e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setExportModalOpen(true);
      }

      if (e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setPresetLibraryOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleModeChange, setCompareMode, cyclePreset, setExportModalOpen, setMagicHandActive]);

  useEffect(() => {
    if (compareMode !== 'toggle') return;
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setShowOriginal(true); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setShowOriginal(false); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [compareMode, setShowOriginal]);

  const handleAiEnhance = useCallback(async () => {
    if (!canvasRef.current) return;
    setIsAiProcessing(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const res = await fetch(`${API_BASE}/ai/riso-enhance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: { base64, mimeType: 'image/png' }, prompt: RISO_AI_PROMPT }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `AI enhancement failed (${res.status})`);
      }
      const data = await res.json();
      if (data.imageUrl) {
        await loadImage(data.imageUrl);
        broadcastImage(data.imageUrl, 'ai-enhanced.png');
        toast.success('AI Riso enhancement applied');
      }
    } catch (err: any) {
      toast.error(err?.message || 'AI enhancement unavailable');
    } finally {
      setIsAiProcessing(false);
    }
  }, [canvasRef, broadcastImage]);

  const handleCopyAsPng = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed'))), 'image/png');
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Copied as PNG');
    } catch {
      toast.error('Failed to copy — try again');
    }
  }, [canvasRef]);

  const handleReset = useCallback(() => {
    resetSettings();
    if (mode === 'riso') {
      risoStore.getState().setLayers([]);
    }
  }, [resetSettings, mode]);

  const statusItems = useStatusItems(mode);

  const controlsPanel = useMemo(() => {
    switch (mode) {
      case 'halftone': return <HalftoneControls onExport={() => setExportModalOpen(true)} onCopyAsPng={handleCopyAsPng} />;
      case 'texture': return <TextureFilterControls onExport={() => setExportModalOpen(true)} onCopyAsPng={handleCopyAsPng} />;
      case 'riso': return <RisoControls onExport={() => setExportModalOpen(true)} onAiEnhance={handleAiEnhance} isAiProcessing={isAiProcessing} onCopyAsPng={handleCopyAsPng} />;
      case 'shaders': return <ShaderLabControls onExport={() => setExportModalOpen(true)} onCopyAsPng={handleCopyAsPng} />;
    }
  }, [mode, handleAiEnhance, isAiProcessing, setExportModalOpen, handleCopyAsPng]);

  const MODE_ITEMS: { id: ImageLabMode; icon: React.ReactNode; label: string }[] = useMemo(() => [
    { id: 'halftone', icon: <CircleDot size={16} />, label: 'Halftone' },
    { id: 'texture', icon: <Paintbrush size={16} />, label: 'Texture' },
    { id: 'riso', icon: <Printer size={16} />, label: 'Riso' },
    { id: 'shaders', icon: <Zap size={16} />, label: 'Shaders' },
  ], []);

  const tbBtn = cn('flex items-center justify-center rounded-lg transition-all', isMobile ? 'w-11 h-11' : 'w-9 h-9');
  const tbIcon = isMobile ? 18 : 15;

  return (
    <>
      <ToolEditorShell
        title="IMAGE LAB"
        documentTitle="Image Lab — Visant"
        panelVisible={panelVisible}
        setPanelVisible={setPanelVisible}
        onReset={handleReset}
        resetMessage={mode === 'riso'
          ? 'All riso settings will return to defaults and extracted layers will be cleared.'
          : `All ${mode} settings will return to defaults.`
        }
        controlsPanel={controlsPanel}
        statusItems={statusItems}
        fileName={fileName}
        isDragOver={isDragOver}
        dragProps={dragProps}
        dropMessage={dropMessage}
        showLegalMenu={false}
        hideTopBar
        canvasClassName="absolute inset-0 transition-all duration-300"
      >
        {/* Floating left toolbar */}
        <div className={cn('absolute left-3 top-3 z-20 flex flex-col gap-1 bg-neutral-950/90 backdrop-blur-xl border border-neutral-800/60 rounded-xl p-1.5 shadow-2xl shadow-black/50', isMobile && 'left-2 top-2 p-1')}>
          <ImageLabUploadWidget
            imageUrl={sourceUrl}
            onLoad={broadcastImage}
          />
          {/* Effect Opacity — collapsible */}
          {hasImage && (
            <OpacityToggle value={effectOpacity} onChange={setEffectOpacity} />
          )}

          {/* Video Playback Controls */}
          {hasImage && sourceMediaType === 'video' && (
            <>
              <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />
              <button
                onClick={() => {
                  const vc = getActiveVideoControls();
                  if (vc) videoIsPlaying ? vc.pause() : vc.play();
                }}
                title={videoIsPlaying ? 'Pause' : 'Play'}
                className={cn(tbBtn, 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5')}
              >
                {videoIsPlaying ? <Pause size={tbIcon} /> : <Play size={tbIcon} />}
              </button>
              {videoDuration > 0 && (
                <div className="flex flex-col items-center gap-0.5 py-1" title={`${videoCurrentTime.toFixed(1)}s / ${videoDuration.toFixed(1)}s`}>
                  <input
                    type="range"
                    min={0} max={videoDuration} step={0.01}
                    value={videoCurrentTime}
                    onChange={(e) => {
                      const vc = getActiveVideoControls();
                      if (vc) vc.seek(parseFloat(e.target.value));
                    }}
                    className="w-7 h-[2px] appearance-none bg-neutral-700 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '56px', width: '12px' }}
                  />
                  <span className="text-[7px] font-mono text-neutral-600">{videoCurrentTime.toFixed(1)}s</span>
                </div>
              )}
            </>
          )}

          <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />

          {/* Undo / Redo */}
          <button onClick={undo} disabled={historyIndex < 0} title="Undo (Ctrl+Z)" className={cn(tbBtn, 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none')}>
            <Undo2 size={tbIcon} />
          </button>
          <button onClick={redo} disabled={historyIndex >= historyLength - 1} title="Redo (Ctrl+Shift+Z)" className={cn(tbBtn, 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none')}>
            <Redo2 size={tbIcon} />
          </button>

          {hasImage && (
            <button
              onClick={() => setMagicHandActive(!magicHandActive)}
              title="Magic Hand (M) — drag to shape the effect"
              className={cn(
                tbBtn,
                magicHandActive
                  ? 'bg-white/10 text-white ring-1 ring-white/30 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5',
              )}
            >
              <Hand size={tbIcon} />
            </button>
          )}

          <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />

          {/* Utilities */}
          <button onClick={handleReset} title="Reset (R)" className={cn(tbBtn, 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5')}>
            <RotateCcw size={tbIcon} />
          </button>
          <button onClick={() => setPresetLibraryOpen(true)} title="Community Presets (Shift+P)" className={cn(tbBtn, 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5')}>
            <Library size={tbIcon} />
          </button>
          <button onClick={() => setExportModalOpen(true)} title="Export (Shift+E)" className={cn(tbBtn, 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5')}>
            <Download size={tbIcon} />
          </button>

          {/* FX Modes */}
          <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />
          <span className="text-[6px] font-mono uppercase tracking-widest text-neutral-600 text-center px-1 select-none">FX</span>
          {MODE_ITEMS.map((m) => {
            const thumb = thumbs[m.id];
            return (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                title={`${m.label} (${m.id === 'halftone' ? '1' : m.id === 'texture' ? '2' : '3'})`}
                className={cn(
                  'group/fx relative flex items-center justify-center rounded-lg transition-all duration-150 overflow-hidden',
                  isMobile ? 'w-11 h-11' : 'w-9 h-9',
                  mode === m.id
                    ? 'ring-1 ring-white/30 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5',
                  !thumb && mode === m.id && 'bg-white/10 text-white',
                )}
              >
                {thumb ? (
                  <>
                    <img src={thumb} alt={m.label} className={cn(
                      'absolute inset-0 w-full h-full object-cover transition-opacity',
                      mode === m.id ? 'opacity-100' : 'opacity-50 hover:opacity-80'
                    )} />
                    <span className="relative z-10 text-[7px] font-mono uppercase tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] opacity-0 group-hover/fx:opacity-100 transition-opacity">
                      {m.label.slice(0, 3)}
                    </span>
                  </>
                ) : m.icon}
              </button>
            );
          })}

          {!isMobile && !panelVisible && (
            <button onClick={() => setPanelVisible(true)} title="Show panel (Tab)" className={cn(tbBtn, 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5')}>
              <PanelRightOpen size={tbIcon} />
            </button>
          )}
        </div>

        <div className={mode !== 'halftone' ? 'hidden' : 'contents'}>
          <HalftoneCanvas ref={halftoneRef} onCanvasReady={onHalftoneCanvasReady} />
        </div>
        <div className={mode !== 'texture' ? 'hidden' : 'contents'}>
          <TextureFilterCanvas ref={textureRef} onCanvasReady={onTextureCanvasReady} />
        </div>
        <div className={mode !== 'riso' ? 'hidden' : 'contents'}>
          <RisoCanvas ref={risoRef} onCanvasReady={onRisoCanvasReady} />
        </div>
        <div className={mode !== 'shaders' ? 'hidden' : 'contents'}>
          <ShaderLabCanvas ref={shaderRef} onCanvasReady={onShaderCanvasReady} />
        </div>

        <div
          ref={magicHandAreaRef}
          className="absolute inset-0 z-10"
          onWheel={(e) => {
            e.currentTarget.style.pointerEvents = 'none';
            requestAnimationFrame(() => {
              if (magicHandAreaRef.current) {
                magicHandAreaRef.current.style.pointerEvents =
                  magicHandActive && hasImage ? 'auto' : 'none';
              }
            });
          }}
          style={{
            cursor: magicHandActive && hasImage ? 'grab' : undefined,
            touchAction: magicHandActive && hasImage ? 'none' : 'auto',
            pointerEvents: magicHandActive && hasImage ? 'auto' : 'none',
          }}
        />

        <BeforeAfterOverlay sourceUrl={sourceUrl} />

        {!hasImage && (
          <label className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer">
            <div className="flex flex-col items-center gap-4 text-neutral-500 group">
              <div className="w-16 h-16 rounded-2xl border border-dashed border-neutral-700 group-hover:border-neutral-500 flex items-center justify-center transition-colors">
                <Upload size={24} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
              </div>
              <p className="text-[11px] uppercase tracking-widest">
                Drop or paste an image or video to begin
              </p>
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] tracking-wide opacity-60">
                  Ctrl+V — paste · Tab — toggle panel · 1/2/3/4 — switch mode
                </p>
                <p className="text-[10px] tracking-wide opacity-40">
                  Alt+Z — before/after · Alt+X — split · [ ] — cycle presets
                </p>
              </div>
            </div>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const isVideo = file.type.startsWith('video/');
                  const url = URL.createObjectURL(file);
                  broadcastImage(url, file.name, isVideo ? 'video' : 'image');
                  toast.success(`Loaded ${file.name}`);
                }
                e.target.value = '';
              }}
            />
          </label>
        )}
      </ToolEditorShell>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        canvasRef={canvasRef}
        filenamePrefix={`imagelab_${mode}`}
        getShaderSettings={getShaderSettings}
        isVideo={sourceMediaType === 'video'}
        onExportVideo={sourceMediaType === 'video' ? handleVideoExport : undefined}
        onExportSvg={mode === 'halftone' ? async () => {
          const imgUrl = halftoneStore.getState().imageUrl;
          if (!imgUrl) return undefined;
          const settings = halftoneStore.getState().getSettings();
          const img = await loadImage(imgUrl);
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext('2d');
          if (!ctx) return undefined;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, c.width, c.height);
          return generateHalftoneSvg(imageData, settings);
        } : undefined}
        onExportScaled={(scale) => {
          if (mode === 'halftone') {
            const renderer = halftoneRef.current?.getRenderer();
            if (!renderer) return undefined;
            return renderer.renderAtScale(halftoneStore.getState().getSettings(), scale);
          }
          if (mode === 'riso') {
            const renderer = risoRef.current?.getRenderer();
            if (!renderer) return undefined;
            return renderer.renderAtScale(risoStore.getState().getSettings(), scale);
          }
          if (mode === 'texture') {
            return textureRef.current?.renderAtScale(scale);
          }
          return undefined;
        }}
      />

      <ImageLabPresetLibrary
        isOpen={presetLibraryOpen}
        onClose={() => setPresetLibraryOpen(false)}
      />
    </>
  );
};

/* ─── Status Items Hook ─── */

function useStatusItems(mode: ImageLabMode) {
  const halftone = useHalftoneStore;
  const texture = useTextureFilterStore;
  const riso = useRisoStore;
  const shader = useShaderLabStore;

  const hZoom = halftone((s) => s.zoom);
  const hFrequency = halftone((s) => s.frequency);
  const hDotSize = halftone((s) => s.dotSize);
  const hBlendMode = halftone((s) => s.blendMode);
  const hShaderEnabled = halftone((s) => s.shaderEnabled);
  const hShaderType = halftone((s) => s.shaderType);

  const tZoom = texture((s) => s.zoom);
  const tBlendMode = texture((s) => s.blendMode);
  const tOpacity = texture((s) => s.opacity);
  const tTextureName = texture((s) => s.textureName);
  const tMaskMode = texture((s) => s.maskMode);
  const tShaderEnabled = texture((s) => s.shaderEnabled);
  const tShaderType = texture((s) => s.shaderType);

  const rZoom = riso((s) => s.zoom);
  const rFrequency = riso((s) => s.frequency);
  const rDotSize = riso((s) => s.dotSize);
  const rMisregistration = riso((s) => s.misregistration);
  const rLayers = riso((s) => s.layers);
  const rSoloLayer = riso((s) => s.soloLayer);
  const rShaderEnabled = riso((s) => s.shaderEnabled);
  const rShaderType = riso((s) => s.shaderType);

  const sShaderType = shader((s) => s.shaderType);
  const sShaderEnabled = shader((s) => s.shaderEnabled);
  const sZoom = shader((s) => s.zoom);

  const compareMode = useImageLabStore((s) => s.compareMode);
  const sourceMediaType = useImageLabStore((s) => s.sourceMediaType);

  return useMemo(() => {
    const extras: { label: string; color?: string }[] = [];
    if (sourceMediaType === 'video') extras.push({ label: 'video', color: 'text-green-400' });
    if (compareMode !== 'off') extras.push({ label: compareMode === 'toggle' ? 'before/after' : 'split view', color: 'text-amber-400' });

    switch (mode) {
      case 'halftone':
        return [
          { label: `${Math.round(hZoom * 100)}%` },
          { label: `freq ${hFrequency}` },
          { label: `dot ${hDotSize.toFixed(2)}` },
          { label: ['subtractive', 'additive', 'normal'][hBlendMode] },
          ...(hShaderEnabled ? [{ label: hShaderType, color: 'text-cyan-400' }] : []),
          ...extras,
        ];
      case 'texture':
        return [
          { label: `${Math.round(tZoom * 100)}%` },
          { label: tBlendMode },
          { label: `${(tOpacity * 100).toFixed(0)}%` },
          { label: tTextureName },
          ...(tMaskMode ? [{ label: 'mask', color: 'text-purple-400' }] : []),
          ...(tShaderEnabled ? [{ label: tShaderType, color: 'text-cyan-400' }] : []),
          ...extras,
        ];
      case 'riso':
        return [
          { label: `${Math.round(rZoom * 100)}%` },
          { label: `freq ${rFrequency}` },
          { label: `dot ${rDotSize.toFixed(2)}` },
          { label: `misreg ${rMisregistration}px` },
          { label: `${rLayers.filter(l => l.visible).length} layers` },
          ...(rSoloLayer >= 0 ? [{ label: `solo L${rSoloLayer + 1}`, color: 'text-amber-400' }] : []),
          ...(rShaderEnabled ? [{ label: rShaderType, color: 'text-cyan-400' }] : []),
          ...extras,
        ];
      case 'shaders':
        return [
          { label: `${Math.round(sZoom * 100)}%` },
          ...(sShaderEnabled ? [{ label: sShaderType, color: 'text-cyan-400' }] : [{ label: 'off' }]),
          ...extras,
        ];
    }
  }, [mode, compareMode, sourceMediaType, hZoom, hFrequency, hDotSize, hBlendMode, hShaderEnabled, hShaderType,
    tZoom, tBlendMode, tOpacity, tTextureName, tMaskMode, tShaderEnabled, tShaderType,
    rZoom, rFrequency, rDotSize, rMisregistration, rLayers, rSoloLayer, rShaderEnabled, rShaderType,
    sShaderType, sShaderEnabled, sZoom]);
}

/* ─── Opacity Toggle (collapsible) ─── */

const OpacityToggle: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => setOpen(!open)}
        title={`Effect Opacity ${Math.round(value * 100)}%`}
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-lg transition-all',
          open
            ? 'bg-white/10 text-white ring-1 ring-white/30'
            : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5',
        )}
      >
        <Blend size={15} />
      </button>
      {open && (
        <div className="flex flex-col items-center gap-0.5 py-1 animate-fade-in">
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-7 h-[2px] appearance-none bg-neutral-700 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            style={{ writingMode: 'vertical-lr' as any, direction: 'rtl', height: '56px', width: '12px' }}
          />
          <span className="text-[8px] font-mono text-neutral-600">{Math.round(value * 100)}</span>
        </div>
      )}
    </div>
  );
};
