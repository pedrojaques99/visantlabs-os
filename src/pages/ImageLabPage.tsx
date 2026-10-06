import React, {
  useCallback,
  useState,
  useMemo,
  useEffect,
  useRef,
  type PointerEvent as RPointerEvent,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CircleDot,
  Paintbrush,
  Undo2,
  Redo2,
  PanelRightOpen,
  Hand,
  MousePointer2,
  Printer,
  Play,
  Pause,
  Zap,
  Blend,
  Pin,
  HelpCircle,
  ChevronDown,
  Save,
} from '@/lib/ui/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Thumb } from '@/components/ui/Thumb';
import { API_BASE } from '@/config/api';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { Dropzone } from '@/components/ui/Dropzone';
import { HalftoneCanvas, type HalftoneCanvasHandle } from '@/components/halftone/HalftoneCanvas';
import { generateHalftoneSvg } from '@/components/halftone/halftone-svg-export';
import { HalftoneControls } from '@/components/halftone/HalftoneControls';
import {
  TextureFilterCanvas,
  type TextureFilterCanvasHandle,
} from '@/components/texture-filter/TextureFilterCanvas';
import { TextureFilterControls } from '@/components/texture-filter/TextureFilterControls';
import { RisoCanvas, type RisoCanvasHandle } from '@/components/riso/RisoCanvas';
import { RisoControls } from '@/components/riso/RisoControls';
import {
  ShaderLabCanvas,
  type ShaderLabCanvasHandle,
} from '@/components/shader-lab/ShaderLabCanvas';
import { ShaderLabControls } from '@/components/shader-lab/ShaderLabControls';
import { BeforeAfterOverlay } from '@/components/shared/BeforeAfterOverlay';
import { SendToButton } from '@/components/shared/SendToButton';
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
import { useTranslation } from '@/hooks/useTranslation';
import { loadImage } from '@/utils/imageUtils';
import { useMagicHand } from '@/hooks/useMagicHand';
import { exportVideoServerSide, type VideoFormat } from '@/utils/videoExport';
import { ImageLabUploadWidget } from '@/components/shared/ImageLabUploadWidget';
import { CanvasErrorBoundary } from '@/components/shared/CanvasErrorBoundary';
import { useIsMobile } from '@/hooks/use-media-query';
import { ImageLabSavePreset } from '@/components/shared/ImageLabSavePreset';
import { useToolInput } from '@/hooks/useToolInput';
import { BrandFunnelBanner } from '@/components/funnel/BrandFunnelBanner';

const VALID_MODES = new Set<string>(['halftone', 'texture', 'riso', 'shaders']);

const PRESET_KEYS: Record<ImageLabMode, string[]> = {
  halftone: Object.keys(HALFTONE_PRESETS),
  texture: Object.keys(FILTER_PRESETS),
  riso: Object.keys(RISO_FULL_PRESETS),
  shaders: [],
};

const RISO_AI_PROMPT = `CORE DIRECTIVE: RISOGRAPH PRINT RECREATION
TASK: Analyze the input image and recreate it as an authentic risograph print: a vintage stencil-based duplication technique where each color is printed as a separate ink layer on uncoated paper.
STEP 1: COLOR ANALYSIS & REDUCTION. Reduce to max 4 ink layers loyal to original palette. White areas become raw paper.
STEP 2: GRAPHIC SIMPLIFICATION. Bold flat shapes, coarse halftone dots for mid-tones, hard-edged silhouettes with imperfection.
STEP 3: LAYER SIMULATION & OVERPRINT. Multiply blending where inks overlap. 1-3px misregistration. Slight ink bleed.
STEP 4: PAPER & INK TEXTURE. Off-white/cream paper with grain. Uneven ink density, speckle, ink dropout.
STEP 5: FINAL PRINT AESTHETIC. Handmade analog feel. No clean digital look. No shadows, glows, or gradients.
NEGATIVE PROMPT: smooth gradients, photorealistic rendering, clean digital illustration, anti-aliased edges, perfect color registration, white background, more than 4-5 ink colors, airbrushed tones, 3D shading, HDR, oversaturated digital colors`;

/* ─── Per-mode state bridge ─── */

function usePerModeState(mode: ImageLabMode) {
  const h = useHalftoneStore;
  const t = useTextureFilterStore;
  const r = useRisoStore;
  const s = useShaderLabStore;

  const hPanel = h((s) => s.panelVisible);
  const hSetPanel = h((s) => s.setPanelVisible);
  const hReset = h((s) => s.resetSettings);
  const hFile = h((s) => s.fileName);
  const hZoom = h((s) => s.zoom);
  const hUndo = h((s) => s.undo);
  const hRedo = h((s) => s.redo);
  const hHi = h((s) => s.historyIndex);
  const hHl = h((s) => s.settingsHistory.length);
  const hImg = h((s) => s.imageUrl);

  const tPanel = t((s) => s.panelVisible);
  const tSetPanel = t((s) => s.setPanelVisible);
  const tReset = t((s) => s.resetSettings);
  const tFile = t((s) => s.fileName);
  const tZoom = t((s) => s.zoom);
  const tUndo = t((s) => s.undo);
  const tRedo = t((s) => s.redo);
  const tHi = t((s) => s.historyIndex);
  const tHl = t((s) => s.settingsHistory.length);
  const tImg = t((s) => s.imageUrl);

  const rPanel = r((s) => s.panelVisible);
  const rSetPanel = r((s) => s.setPanelVisible);
  const rReset = r((s) => s.resetSettings);
  const rFile = r((s) => s.fileName);
  const rZoom = r((s) => s.zoom);
  const rUndo = r((s) => s.undo);
  const rRedo = r((s) => s.redo);
  const rHi = r((s) => s.historyIndex);
  const rHl = r((s) => s.settingsHistory.length);
  const rImg = r((s) => s.imageUrl);

  const sZoom = s((st) => st.zoom);
  const sUndo = s((st) => st.undo);
  const sRedo = s((st) => st.redo);
  const sHi = s((st) => st.historyIndex);
  const sHl = s((st) => st.historyLength);
  const sImg = s((st) => st.imageUrl);
  const sFile = s((st) => st.fileName);
  const sReset = s((st) => st.reset);

  const [sPanelVisible, setSPanelVisible] = useState(true);

  return useMemo(() => {
    if (mode === 'halftone')
      return {
        panelVisible: hPanel,
        setPanelVisible: hSetPanel,
        resetSettings: hReset,
        fileName: hFile,
        zoom: hZoom,
        undo: hUndo,
        redo: hRedo,
        historyIndex: hHi,
        historyLength: hHl,
        hasImage: !!hImg,
        store: h,
      };
    if (mode === 'texture')
      return {
        panelVisible: tPanel,
        setPanelVisible: tSetPanel,
        resetSettings: tReset,
        fileName: tFile,
        zoom: tZoom,
        undo: tUndo,
        redo: tRedo,
        historyIndex: tHi,
        historyLength: tHl,
        hasImage: !!tImg,
        store: t,
      };
    if (mode === 'shaders')
      return {
        panelVisible: sPanelVisible,
        setPanelVisible: setSPanelVisible,
        resetSettings: sReset,
        fileName: sFile,
        zoom: sZoom,
        undo: sUndo,
        redo: sRedo,
        historyIndex: sHi,
        historyLength: sHl,
        hasImage: !!sImg,
        store: s,
      };
    return {
      panelVisible: rPanel,
      setPanelVisible: rSetPanel,
      resetSettings: rReset,
      fileName: rFile,
      zoom: rZoom,
      undo: rUndo,
      redo: rRedo,
      historyIndex: rHi,
      historyLength: rHl,
      hasImage: !!rImg,
      store: r,
    };
  }, [
    mode,
    hPanel,
    hSetPanel,
    hReset,
    hFile,
    hZoom,
    hUndo,
    hRedo,
    hHi,
    hHl,
    hImg,
    tPanel,
    tSetPanel,
    tReset,
    tFile,
    tZoom,
    tUndo,
    tRedo,
    tHi,
    tHl,
    tImg,
    rPanel,
    rSetPanel,
    rReset,
    rFile,
    rZoom,
    rUndo,
    rRedo,
    rHi,
    rHl,
    rImg,
    sPanelVisible,
    sReset,
    sFile,
    sZoom,
    sUndo,
    sRedo,
    sHi,
    sHl,
    sImg,
  ]);
}

/* ─── Canvas thumbnail hook ─── */

function useCanvasThumbnails(
  canvasRefsMap: React.MutableRefObject<Record<ImageLabMode, HTMLCanvasElement | null>>
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
    halftone: null,
    texture: null,
    riso: null,
    shaders: null,
  });

  const frameId = useRef<number>(0);
  const debounceId = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 3.6: debounce thumbnail capture ~500ms. History changes can fire rapidly
  // (slider drags commit several entries); without this we toDataURL+JPEG-encode
  // on every one. The trailing rAF (added in Phase 2.2) is preserved and still
  // cancelled on unmount so a queued capture can't setState after unmount.
  const capture = useCallback(
    (modeKey: ImageLabMode) => {
      if (debounceId.current) clearTimeout(debounceId.current);
      debounceId.current = setTimeout(() => {
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
          } catch {
            /* tainted canvas, ignore */
          }
        });
      }, 500);
    },
    [canvasRefsMap]
  );

  useEffect(() => {
    if (hImg) capture('halftone');
  }, [hHi, hImg, capture]);
  useEffect(() => {
    if (tImg) capture('texture');
  }, [tHi, tImg, capture]);
  useEffect(() => {
    if (rImg) capture('riso');
  }, [rHi, rImg, capture]);
  useEffect(() => {
    if (sImg) capture('shaders');
  }, [sHi, sImg, capture]);

  // Cancel any pending debounce timer + capture frame on unmount so neither can
  // fire a setState on an unmounted component (e.g. after a fast mode switch).
  useEffect(
    () => () => {
      if (debounceId.current) clearTimeout(debounceId.current);
      cancelAnimationFrame(frameId.current);
    },
    []
  );

  return thumbs;
}

/* ─── Preset cycling hook ─── */

function usePresetCycling(mode: ImageLabMode) {
  const [currentPresetIndex, setCurrentPresetIndex] = useState(-1);

  const cyclePreset = useCallback(
    (direction: 1 | -1) => {
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
            color: hexToRgb(hex),
            hex,
            visible: true,
            alpha: 0.85,
            angle: i * 22.5,
            offsetX: [1, -1, 1, -1][i],
            offsetY: [-1, 1, 1, -1][i],
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
    },
    [mode, currentPresetIndex]
  );

  useEffect(() => {
    setCurrentPresetIndex(-1);
  }, [mode]);

  return cyclePreset;
}

/* ─── Main Page ─── */

export const ImageLabPage: React.FC = () => {
  const { t } = useTranslation();
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
  const {
    panelVisible,
    setPanelVisible,
    resetSettings,
    fileName,
    zoom,
    undo,
    redo,
    historyIndex,
    historyLength,
    hasImage,
    store: activeStore,
  } = active;

  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [presetLibraryOpen, setPresetLibraryOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [fxBarVisible, setFxBarVisible] = useState(true);
  const [fxBarPinned, setFxBarPinned] = useState(false);
  const fxBarRef = useRef<HTMLDivElement>(null);
  const fxHideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const FX_PROXIMITY_PX = 80;
  const FX_HIDE_DELAY = 1200;
  const FX_INITIAL_DELAY = 2000;

  const canAutoHide = !isMobile && !fxBarPinned;

  useEffect(() => {
    if (!canAutoHide) return;
    const t = setTimeout(() => setFxBarVisible(false), FX_INITIAL_DELAY);
    return () => clearTimeout(t);
  }, [canAutoHide]);

  // Clear the proximity-driven auto-hide timer on unmount (it's scheduled from
  // pointer handlers, outside the effect above).
  useEffect(() => () => clearTimeout(fxHideTimer.current), []);

  const handleCanvasPointerMove = useCallback(
    (e: RPointerEvent<HTMLDivElement>) => {
      if (!canAutoHide) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const nearTop = relY < FX_PROXIMITY_PX;

      if (nearTop) {
        clearTimeout(fxHideTimer.current);
        setFxBarVisible(true);
      } else if (!fxBarRef.current?.matches(':hover')) {
        clearTimeout(fxHideTimer.current);
        fxHideTimer.current = setTimeout(() => setFxBarVisible(false), FX_HIDE_DELAY);
      }
    },
    [canAutoHide]
  );

  const handleFxBarEnter = useCallback(() => {
    if (!canAutoHide) return;
    clearTimeout(fxHideTimer.current);
    setFxBarVisible(true);
  }, [canAutoHide]);

  const handleFxBarLeave = useCallback(() => {
    if (!canAutoHide) return;
    fxHideTimer.current = setTimeout(() => setFxBarVisible(false), FX_HIDE_DELAY);
  }, [canAutoHide]);

  const cyclePreset = usePresetCycling(mode);

  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode && VALID_MODES.has(urlMode) && urlMode !== mode) {
      setMode(urlMode as ImageLabMode);
    }
  }, []);

  const handleModeChange = useCallback(
    (m: ImageLabMode) => {
      setMode(m);
      setSearchParams({ mode: m }, { replace: true });
    },
    [setMode, setSearchParams]
  );

  const shaderLabStore = useShaderLabStore;

  // Track the latest blob URL this page created so we can revoke the previous
  // one when a new file is loaded and clean up on unmount (avoids leaking
  // object URLs across uploads / mode switches).
  const lastBlobUrlRef = useRef<string | null>(null);
  const createTrackedObjectUrl = useCallback((file: File) => {
    const prev = lastBlobUrlRef.current;
    if (prev) {
      try {
        URL.revokeObjectURL(prev);
      } catch {
        /* ignore */
      }
    }
    const url = URL.createObjectURL(file);
    lastBlobUrlRef.current = url;
    return url;
  }, []);
  useEffect(
    () => () => {
      if (lastBlobUrlRef.current) {
        try {
          URL.revokeObjectURL(lastBlobUrlRef.current);
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  const broadcastImage = useCallback(
    (url: string, name: string, mediaType: 'image' | 'video' = 'image') => {
      labStore.getState().setSource(url, name, mediaType);
      halftoneStore.getState().setImageUrl(url, name, mediaType);
      risoStore.getState().setImageUrl(url, name, mediaType);
      textureStore.getState().setImageUrl(url, name, mediaType);
      shaderLabStore.getState().setImageUrl(url, name, mediaType);
    },
    []
  );

  /* ── Pipeline input: receive piped assets from other tools ── */
  const { pendingAsset, acceptAsset } = useToolInput('image-lab');
  useEffect(() => {
    if (!pendingAsset) return;
    const asset = acceptAsset();
    if (!asset) return;
    const url = asset.imageUrl || asset.imageBase64 || '';
    if (url) {
      broadcastImage(url, asset.label || 'piped-image');
      toast.success(t('imagelab.loaded', { name: asset.label || t('imagelab.pipedImage') }));
    }
  }, [pendingAsset, acceptAsset, broadcastImage]);

  const canvasRefsMap = useRef<Record<ImageLabMode, HTMLCanvasElement | null>>({
    halftone: null,
    texture: null,
    riso: null,
    shaders: null,
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

  const handleVideoExport = useCallback(
    async (fmt: VideoFormat, onProgress: (pct: number) => void) => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('No canvas');

      const vc = getActiveVideoControls();
      if (!vc?.videoRef.current) throw new Error('No video source');

      const video = vc.videoRef.current;

      const renderFrame = async (v: HTMLVideoElement) => {
        if (mode === 'halftone') {
          const r = halftoneRef.current?.getRenderer();
          if (r) {
            r.updateTexture(v);
            r.render({
              ...useHalftoneStore.getState().getSettings(),
              effectOpacity: useImageLabStore.getState().effectOpacity,
            });
          }
        } else if (mode === 'riso') {
          const r = risoRef.current?.getRenderer();
          if (r) {
            r.updateTexture(v);
            r.render({
              ...useRisoStore.getState().getSettings(),
              effectOpacity: useImageLabStore.getState().effectOpacity,
            });
          }
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
    },
    [canvasRef, mode, getActiveVideoControls]
  );

  const { isDragOver, dragProps, dropMessage } = useToolEditorDragDrop({
    accept: 'image+video',
    onFile: useCallback(
      (file: File) => {
        const isVideo = file.type.startsWith('video/');
        const url = createTrackedObjectUrl(file);
        broadcastImage(url, file.name || 'pasted', isVideo ? 'video' : 'image');
        toast.success(t('imagelab.loaded', { name: file.name || t('imagelab.pastedImage') }));
      },
      [broadcastImage, createTrackedObjectUrl]
    ),
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
    // Declarative shortcut map keyed by `e.key`. Each handler keeps the exact
    // modifier guards and preventDefault placement of the original if/else
    // chain — no behavior change, just a flat table instead of 50 lines of ifs.
    const noMods = (e: KeyboardEvent) => !e.altKey && !e.shiftKey && !e.ctrlKey;
    const SHORTCUTS: Record<string, (e: KeyboardEvent) => void> = {
      '1': (e) => noMods(e) && handleModeChange('halftone'),
      '2': (e) => noMods(e) && handleModeChange('texture'),
      '3': (e) => noMods(e) && handleModeChange('riso'),
      '4': (e) => noMods(e) && handleModeChange('shaders'),
      z: (e) => {
        if (!e.altKey) return;
        e.preventDefault();
        const current = labStore.getState().compareMode;
        setCompareMode(current === 'toggle' ? 'off' : 'toggle');
      },
      x: (e) => {
        if (!e.altKey) return;
        e.preventDefault();
        const current = labStore.getState().compareMode;
        setCompareMode(current === 'split' ? 'off' : 'split');
      },
      v: (e) => {
        if (!noMods(e)) return;
        e.preventDefault();
        setMagicHandActive(false);
      },
      m: (e) => {
        if (!noMods(e)) return;
        e.preventDefault();
        setMagicHandActive(!labStore.getState().magicHandActive);
      },
      Escape: (e) => {
        const current = labStore.getState().compareMode;
        if (current !== 'off') {
          e.preventDefault();
          setCompareMode('off');
        }
      },
      '[': (e) => {
        e.preventDefault();
        cyclePreset(-1);
      },
      ']': (e) => {
        e.preventDefault();
        cyclePreset(1);
      },
      E: (e) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        setExportModalOpen(true);
      },
      P: (e) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        setPresetLibraryOpen(true);
      },
      '?': (e) => {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      },
      '/': (e) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      },
    };

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      SHORTCUTS[e.key]?.(e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleModeChange, setCompareMode, cyclePreset, setExportModalOpen, setMagicHandActive]);

  useEffect(() => {
    if (compareMode !== 'toggle') return;
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setShowOriginal(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setShowOriginal(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [compareMode, setShowOriginal]);

  const handleAiEnhance = useCallback(async () => {
    if (!canvasRef.current) return;
    setIsAiProcessing(true);
    try {
      // 3.5: encode as WebP q0.9 instead of lossless PNG. A full-res riso canvas
      // as PNG inflated the base64 JSON payload and pushed it toward the 10MB
      // body limit; WebP preserves the hard-edged halftone/dither dots far
      // better than JPEG (which rings on sharp edges) while cutting the payload
      // several-fold. The image is about to be re-generated by Gemini anyway, so
      // q0.9 is visually lossless for this use. mimeType is sent to match.
      // (True multipart upload — multer on /ai/riso-enhance + relaxed body
      // parser — is a follow-up; this route is the sole JSON-contract caller.)
      const MIME = 'image/webp';
      const dataUrl = canvasRef.current.toDataURL(MIME, 0.9);
      const base64 = dataUrl.split(',')[1];
      const res = await fetch(`${API_BASE}/ai/riso-enhance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: { base64, mimeType: MIME }, prompt: RISO_AI_PROMPT }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `AI enhancement failed (${res.status})`);
      }
      const data = await res.json();
      if (data.imageUrl) {
        await loadImage(data.imageUrl);
        broadcastImage(data.imageUrl, 'ai-enhanced.png');
        toast.success(t('imagelab.aiRisoApplied'));
      }
    } catch (err: any) {
      toast.error(err?.message || t('imagelab.aiUnavailable'));
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
      toast.success(t('imagelab.copiedPng'));
    } catch {
      toast.error(t('imagelab.copyFailed'));
    }
  }, [canvasRef]);

  // Snapshot the processed result canvas as a PNG data URL for "Send to →".
  const captureResultPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return undefined;
    }
  }, [canvasRef]);

  const handleReset = useCallback(() => {
    resetSettings();
    if (mode === 'riso') {
      risoStore.getState().setLayers([]);
    }
  }, [resetSettings, mode]);

  const statusItems = useStatusItems(mode);

  const modeControls = useMemo(() => {
    switch (mode) {
      case 'halftone':
        return (
          <HalftoneControls
            onExport={() => setExportModalOpen(true)}
            onCopyAsPng={handleCopyAsPng}
          />
        );
      case 'texture':
        return (
          <TextureFilterControls
            onExport={() => setExportModalOpen(true)}
            onCopyAsPng={handleCopyAsPng}
          />
        );
      case 'riso':
        return (
          <RisoControls
            onExport={() => setExportModalOpen(true)}
            onAiEnhance={handleAiEnhance}
            isAiProcessing={isAiProcessing}
            onCopyAsPng={handleCopyAsPng}
          />
        );
      case 'shaders':
        return (
          <ShaderLabControls
            onExport={() => setExportModalOpen(true)}
            onCopyAsPng={handleCopyAsPng}
          />
        );
    }
  }, [mode, handleAiEnhance, isAiProcessing, setExportModalOpen, handleCopyAsPng]);

  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const controlsPanel = useMemo(
    () => (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-hidden">{modeControls}</div>
        {/* Save preset — collapsed behind a button at the bottom, by the export actions */}
        <div className="shrink-0 border-t border-border">
          {savePresetOpen && (
            <div className="px-4 pt-3 animate-fade-in">
              <ImageLabSavePreset />
            </div>
          )}
          <button
            onClick={() => setSavePresetOpen((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={savePresetOpen}
          >
            <Save size={12} />
            {t('imagelab.savePreset')}
            <ChevronDown
              size={12}
              className={cn('transition-transform', savePresetOpen && 'rotate-180')}
            />
          </button>
        </div>
      </div>
    ),
    [modeControls, savePresetOpen]
  );

  const MODE_ITEMS: { id: ImageLabMode; icon: React.ReactNode; label: string }[] = useMemo(
    () => [
      { id: 'halftone', icon: <CircleDot size={16} />, label: 'Halftone' },
      { id: 'texture', icon: <Paintbrush size={16} />, label: 'Texture' },
      { id: 'riso', icon: <Printer size={16} />, label: 'Riso' },
      { id: 'shaders', icon: <Zap size={16} />, label: 'Shaders' },
    ],
    []
  );

  const tbBtn = cn(
    'flex items-center justify-center rounded-xl transition-colors',
    isMobile ? 'w-11 h-11' : 'w-9 h-9'
  );
  const tbIcon = isMobile ? 18 : 15;

  // `dark contents`: os modais irmãos do shell (export, presets) ficam no escopo escuro do editor.
  return (
    <div className="dark contents text-foreground">
      <ToolEditorShell
        title={t('imagelab.title')}
        documentTitle={t('imagelab.documentTitle')}
        panelVisible={panelVisible}
        setPanelVisible={setPanelVisible}
        onReset={handleReset}
        resetMessage={
          mode === 'riso'
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
        canvasClassName="absolute inset-0 transition-[color,background-color,border-color,filter] duration-300"
      >
        {/* Funil de marca (Fase 5). Precisa ficar DENTRO do AppShell (zIndex 40),
            senão o z-30 do banner some por baixo do shell. Posição custom: a
            faixa top-center default colide com a FX bar (top-0 + mt-3, z-30),
            então ancoramos no canto inferior esquerdo — livre em desktop (status
            bar é bottom-center) e acima do mobile sheet (~56px) no mobile. */}
        <BrandFunnelBanner
          toolId="image-lab"
          className="fixed bottom-16 md:bottom-3 left-3 z-30 flex items-center gap-3 rounded-full border border-border bg-popover/80 backdrop-blur-xl pl-3 pr-1.5 py-1.5 max-w-[calc(100vw-2rem)]"
        />
        {/* Proximity sensor for FX bar auto-hide (z-0: works when magic hand inactive) */}
        <div className="absolute inset-0 z-0" onPointerMove={handleCanvasPointerMove} />
        {/* Top-strip proximity trigger — z-20 above magic hand overlay (z-10).
            Centered + bounded so it never overlaps the right control panel, whose
            section-tab rail has clickable icons in the top-right corner. */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[65%] max-w-3xl h-20 z-20"
          onPointerMove={handleCanvasPointerMove}
        />

        {/* Floating tools — canvas-only actions */}
        <div
          className={cn(
            'absolute left-3 top-3 z-20 flex flex-col gap-1 bg-popover/90 backdrop-blur-xl border border-border rounded-xl p-1.5 shadow-2xl shadow-black/50',
            isMobile && 'left-2 top-2 p-1'
          )}
        >
          <ImageLabUploadWidget imageUrl={sourceUrl} onLoad={broadcastImage} />
          {hasImage && <OpacityToggle value={effectOpacity} onChange={setEffectOpacity} />}
          {hasImage && (
            <>
              <button
                onClick={() => setMagicHandActive(false)}
                title={t('imagelab.selectTool')}
                className={cn(
                  tbBtn,
                  !magicHandActive
                    ? 'bg-accent text-foreground ring-1 ring-ring shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <MousePointer2 size={tbIcon} />
              </button>
              <button
                onClick={() => setMagicHandActive(!magicHandActive)}
                title={t('imagelab.magicHand')}
                className={cn(
                  tbBtn,
                  magicHandActive
                    ? 'bg-accent text-foreground ring-1 ring-ring shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Hand size={tbIcon} />
              </button>
            </>
          )}
          {hasImage && sourceMediaType === 'video' && (
            <>
              <div className="h-px bg-border mx-1 my-0.5" />
              <button
                onClick={() => {
                  const vc = getActiveVideoControls();
                  if (vc) {
                    if (videoIsPlaying) {
                      vc.pause();
                    } else {
                      vc.play();
                    }
                  }
                }}
                title={videoIsPlaying ? t('imagelab.pause') : t('imagelab.play')}
                className={cn(tbBtn, 'text-muted-foreground hover:text-foreground hover:bg-accent')}
              >
                {videoIsPlaying ? <Pause size={tbIcon} /> : <Play size={tbIcon} />}
              </button>
              {videoDuration > 0 && (
                <div
                  className="flex flex-col items-center gap-0.5 py-1"
                  title={`${videoCurrentTime.toFixed(1)}s / ${videoDuration.toFixed(1)}s`}
                >
                  <input
                    type="range"
                    min={0}
                    max={videoDuration}
                    step={0.01}
                    value={videoCurrentTime}
                    onChange={(e) => {
                      const vc = getActiveVideoControls();
                      if (vc) vc.seek(parseFloat(e.target.value));
                    }}
                    className="w-7 h-[2px] appearance-none bg-border rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                    style={{
                      writingMode: 'vertical-lr',
                      direction: 'rtl',
                      height: '56px',
                      width: '12px',
                    }}
                  />
                  <span className="text-2xs tabular-nums text-muted-foreground">
                    {videoCurrentTime.toFixed(1)}s
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Floating top bar — FX modes + undo/redo + panel toggle */}
        <div
          ref={fxBarRef}
          className="absolute top-0 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center"
          onPointerEnter={handleFxBarEnter}
          onPointerLeave={handleFxBarLeave}
        >
          {/* Collapsed handle — always visible on desktop when bar is hidden */}
          {canAutoHide && (
            <button
              onClick={() => {
                clearTimeout(fxHideTimer.current);
                setFxBarVisible(true);
              }}
              title={t('imagelab.showFxBar')}
              aria-label={t('imagelab.showFxBar')}
              className={cn(
                'flex items-center justify-center h-5 px-8 rounded-b-xl transition-[color,background-color,border-color,opacity,filter] duration-300',
                'bg-background/90 border-b border-x border-border',
                'text-muted-foreground hover:text-foreground hover:bg-background',
                fxBarVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'
              )}
            >
              <ChevronDown size={10} />
            </button>
          )}

          {/* Full bar */}
          <div
            className={cn(
              'mt-3 transition-[opacity,transform] duration-300',
              fxBarVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-2 pointer-events-none'
            )}
          >
            <div className="flex items-center gap-1 px-1.5 py-1 rounded-full bg-background/95 border border-border shadow-lg">
              {/* Undo / Redo */}
              <div className="flex items-center gap-0.5 pr-1 border-r border-border">
                <button
                  onClick={undo}
                  disabled={historyIndex < 0}
                  title={t('imagelab.undo')}
                  aria-label={t('imagelab.undo')}
                  className="flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-25 disabled:pointer-events-none"
                >
                  <Undo2 size={14} />
                </button>
                <button
                  onClick={redo}
                  disabled={historyIndex >= historyLength - 1}
                  title={t('imagelab.redo')}
                  aria-label={t('imagelab.redo')}
                  className="flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-25 disabled:pointer-events-none"
                >
                  <Redo2 size={14} />
                </button>
              </div>

              {/* FX Mode tabs */}
              {MODE_ITEMS.map((m, i) => {
                const thumb = thumbs[m.id];
                const isActive = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleModeChange(m.id)}
                    className={cn(
                      'group/fx relative flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-[color,background-color,border-color,box-shadow] duration-200 text-2xs font-medium whitespace-nowrap',
                      isActive
                        ? 'bg-accent text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <span
                      className={cn(
                        'transition-colors',
                        isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground group-hover/fx:text-foreground'
                      )}
                    >
                      {m.icon}
                    </span>
                    <span>{m.label}</span>
                    <span
                      className={cn(
                        'text-2xs font-mono tabular-nums transition-colors',
                        isActive ? 'text-muted-foreground' : 'text-muted-foreground/60'
                      )}
                    >
                      {i + 1}
                    </span>
                    {thumb && !isActive && (
                      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 group-hover/fx:opacity-100 transition-opacity duration-200 z-50">
                        <div className="rounded-xl overflow-hidden border border-border shadow-xl shadow-black/60 bg-card">
                          <Thumb src={thumb} alt="" className="w-28 h-28 object-cover" />
                          <div className="px-2 py-1 text-2xs text-muted-foreground text-center bg-popover/90">
                            {m.label}
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Help + Pin + Panel toggle */}
              <div className="pl-1 border-l border-border flex items-center gap-0.5">
                {hasImage && (
                  <SendToButton
                    source="image-lab"
                    outputMime="image/png"
                    mimeType="image/png"
                    label={`Image Lab: ${mode}`}
                    variant="node"
                    getImageBase64={captureResultPng}
                    className="mr-0.5"
                  />
                )}
                <button
                  onClick={() => setShortcutsOpen(true)}
                  title={t('imagelab.shortcuts')}
                  aria-label={t('imagelab.shortcuts')}
                  className="flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <HelpCircle size={12} />
                </button>
                {!isMobile && (
                  <>
                    <button
                      onClick={() => {
                        setFxBarPinned(!fxBarPinned);
                        setFxBarVisible(true);
                      }}
                      title={fxBarPinned ? t('imagelab.unpinBar') : t('imagelab.pinBar')}
                      aria-label={fxBarPinned ? t('imagelab.unpinBar') : t('imagelab.pinBar')}
                      aria-pressed={fxBarPinned}
                      className={cn(
                        'flex items-center justify-center w-7 h-7 rounded-full transition-colors',
                        fxBarPinned
                          ? 'text-foreground bg-accent'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      <Pin size={12} className={cn(fxBarPinned && 'rotate-45')} />
                    </button>
                    <button
                      onClick={() => setPanelVisible(!panelVisible)}
                      title={t('common.hidePanelShortcut')}
                      aria-label={t('common.hidePanelShortcut')}
                      className={cn(
                        'flex items-center justify-center w-7 h-7 rounded-full transition-colors',
                        panelVisible
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      <PanelRightOpen size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <CanvasErrorBoundary>
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
        </CanvasErrorBoundary>

        <div
          ref={magicHandAreaRef}
          className="absolute inset-0 z-10"
          onWheel={(e) => {
            const overlay = e.currentTarget as HTMLElement;
            overlay.style.pointerEvents = 'none';
            const target = document.elementFromPoint(e.clientX, e.clientY);
            overlay.style.pointerEvents = 'auto';
            target?.dispatchEvent(
              new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                deltaX: e.deltaX,
                deltaY: e.deltaY,
                deltaZ: e.deltaZ,
                deltaMode: e.deltaMode,
                clientX: e.clientX,
                clientY: e.clientY,
              })
            );
          }}
          style={{
            cursor: magicHandActive && hasImage ? 'grab' : undefined,
            touchAction: magicHandActive && hasImage ? 'none' : 'auto',
            pointerEvents: magicHandActive && hasImage ? 'auto' : 'none',
          }}
        />

        <BeforeAfterOverlay sourceUrl={sourceUrl} />

        {!hasImage && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
            <Dropzone
              onFiles={([file]) => {
                if (!file) return;
                const isVideo = file.type.startsWith('video/');
                const url = createTrackedObjectUrl(file);
                broadcastImage(url, file.name, isVideo ? 'video' : 'image');
                toast.success(t('imagelab.loaded', { name: file.name }));
              }}
              accept="image/*,video/*"
              label={t('imagelab.dropPrompt')}
              dropTarget={false}
              className="max-w-md"
            />
          </div>
        )}
        {/* Shortcuts help overlay */}
        {shortcutsOpen && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setShortcutsOpen(false)}
          >
            <div
              className="bg-popover border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-foreground">
                  {t('imagelab.shortcutsTitle')}
                </span>
                <button
                  onClick={() => setShortcutsOpen(false)}
                  aria-label={t('common.closeEsc')}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <kbd className="text-xs font-mono">Esc</kbd>
                </button>
              </div>
              <div className="space-y-3 text-2xs">
                {(
                  [
                    ['modes', [['1 / 2 / 3 / 4', 'switchMode']]],
                    [
                      'canvas',
                      [
                        ['Ctrl+V', 'paste'],
                        ['Ctrl+Z', 'undo'],
                        ['Ctrl+Shift+Z', 'redo'],
                        ['[ / ]', 'cyclePresets'],
                        ['V', 'select'],
                        ['M', 'magicHand'],
                        ['Scroll', 'zoom'],
                      ],
                    ],
                    [
                      'compare',
                      [
                        ['Alt+Z', 'beforeAfter'],
                        ['Alt+X', 'split'],
                        ['Esc', 'exitCompare'],
                      ],
                    ],
                    [
                      'panels',
                      [
                        ['Tab', 'togglePanel'],
                        ['Shift+E', 'export'],
                        ['Shift+P', 'communityPresets'],
                        ['?', 'help'],
                      ],
                    ],
                  ] as [string, [string, string][]][]
                ).map(([section, items]) => (
                  <div key={section}>
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">
                      {t(`imagelab.shortcutSections.${section}`)}
                    </div>
                    {items.map(([key, desc]) => (
                      <div key={key} className="flex items-center justify-between py-0.5">
                        <span className="text-muted-foreground">
                          {t(`imagelab.shortcutItems.${desc}`)}
                        </span>
                        <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-2xs">
                          {key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
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
        onExportSvg={
          mode === 'halftone'
            ? async () => {
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
              }
            : undefined
        }
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
          if (mode === 'shaders') {
            // Shaders have no synchronous hi-res re-render path (the WebGL render
            // is async, but onExportScaled is sync). Rather than let ExportModal
            // interpolate the screen canvas up to `scale` — a fake-resolution
            // export whose readout would overclaim the true dims — return the
            // native-resolution shader canvas so the export stays honest (1x).
            // Known follow-up: ExportModal's dim readout still reflects the
            // chosen scale for shaders; making it truthful needs an ExportModal change.
            return canvasRef.current ?? undefined;
          }
          return undefined;
        }}
      />

      <ImageLabPresetLibrary
        isOpen={presetLibraryOpen}
        onClose={() => setPresetLibraryOpen(false)}
      />
    </div>
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
    if (sourceMediaType === 'video') extras.push({ label: 'video', color: 'text-success' });
    if (compareMode !== 'off')
      extras.push({
        label: compareMode === 'toggle' ? 'before/after' : 'split view',
        color: 'text-warning',
      });

    switch (mode) {
      case 'halftone':
        return [
          { label: `${Math.round(hZoom * 100)}%` },
          { label: `freq ${hFrequency}` },
          { label: `dot ${hDotSize.toFixed(2)}` },
          { label: ['subtractive', 'additive', 'normal'][hBlendMode] },
          ...(hShaderEnabled ? [{ label: hShaderType, color: 'text-muted-foreground' }] : []),
          ...extras,
        ];
      case 'texture':
        return [
          { label: `${Math.round(tZoom * 100)}%` },
          { label: tBlendMode },
          { label: `${(tOpacity * 100).toFixed(0)}%` },
          { label: tTextureName },
          ...(tMaskMode ? [{ label: 'mask', color: 'text-foreground' }] : []),
          ...(tShaderEnabled ? [{ label: tShaderType, color: 'text-muted-foreground' }] : []),
          ...extras,
        ];
      case 'riso':
        return [
          { label: `${Math.round(rZoom * 100)}%` },
          { label: `freq ${rFrequency}` },
          { label: `dot ${rDotSize.toFixed(2)}` },
          ...(rMisregistration > 0 ? [{ label: `misreg ${rMisregistration}px` }] : []),
          ...(rLayers.filter((l) => l.visible).length > 0
            ? [{ label: `${rLayers.filter((l) => l.visible).length} layers` }]
            : []),
          ...(rSoloLayer >= 0 ? [{ label: `solo L${rSoloLayer + 1}`, color: 'text-warning' }] : []),
          ...(rShaderEnabled ? [{ label: rShaderType, color: 'text-muted-foreground' }] : []),
          ...extras,
        ];
      case 'shaders':
        return [
          { label: `${Math.round(sZoom * 100)}%` },
          ...(sShaderEnabled
            ? [{ label: sShaderType, color: 'text-muted-foreground' }]
            : [{ label: 'off' }]),
          ...extras,
        ];
    }
  }, [
    mode,
    compareMode,
    sourceMediaType,
    hZoom,
    hFrequency,
    hDotSize,
    hBlendMode,
    hShaderEnabled,
    hShaderType,
    tZoom,
    tBlendMode,
    tOpacity,
    tTextureName,
    tMaskMode,
    tShaderEnabled,
    tShaderType,
    rZoom,
    rFrequency,
    rDotSize,
    rMisregistration,
    rLayers,
    rSoloLayer,
    rShaderEnabled,
    rShaderType,
    sShaderType,
    sShaderEnabled,
    sZoom,
  ]);
}

/* ─── Opacity Toggle (horizontal popover) ─── */

const OpacityToggle: React.FC<{ value: number; onChange: (v: number) => void }> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title={t('imagelab.effectOpacity', { value: Math.round(value * 100) })}
        aria-label={t('imagelab.effectOpacity', { value: Math.round(value * 100) })}
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-xl transition-colors',
          open
            ? 'bg-accent text-foreground ring-1 ring-ring'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        )}
      >
        <Blend size={15} />
      </button>
      {open && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-30 flex items-center gap-2 bg-popover/95 backdrop-blur-xl border border-border rounded-xl px-3 py-2 shadow-2xl shadow-black/50 animate-fade-in">
          <span className="text-2xs tabular-nums text-muted-foreground w-6 text-right shrink-0">
            {Math.round(value * 100)}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-28 h-[2px] appearance-none bg-border rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
          />
        </div>
      )}
    </div>
  );
};
