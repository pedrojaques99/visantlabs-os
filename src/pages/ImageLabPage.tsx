import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, Eye, Split, EyeOff, Library, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/config/api';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { HalftoneCanvas } from '@/components/halftone/HalftoneCanvas';
import { HalftoneControls } from '@/components/halftone/HalftoneControls';
import { TextureFilterCanvas } from '@/components/texture-filter/TextureFilterCanvas';
import { TextureFilterControls } from '@/components/texture-filter/TextureFilterControls';
import { RisoCanvas } from '@/components/riso/RisoCanvas';
import { RisoControls } from '@/components/riso/RisoControls';
import { BeforeAfterOverlay } from '@/components/shared/BeforeAfterOverlay';
import { ExportModal } from '@/components/shared/ExportModal';
import { ImageLabPresetLibrary } from '@/components/shared/ImageLabPresetLibrary';
import { ModePreviewSwitcher } from '@/components/shared/ModePreviewSwitcher';
import { useHalftoneStore, HALFTONE_PRESETS } from '@/stores/halftoneStore';
import { useTextureFilterStore, FILTER_PRESETS } from '@/stores/textureFilterStore';
import { useRisoStore } from '@/stores/risoStore';
import { RISO_FULL_PRESETS } from '@/components/riso/RisoRenderer';
import { hexToRgb } from '@/utils/colorUtils';
import { useImageLabStore, type ImageLabMode } from '@/stores/imageLabStore';
import { useExportCanvas } from '@/hooks/useExportCanvas';
import { useToolEditorHotkeys } from '@/hooks/useToolEditorHotkeys';
import { useToolEditorDragDrop } from '@/hooks/useToolEditorDragDrop';
import { loadImage } from '@/utils/imageUtils';

const VALID_MODES = new Set<string>(['halftone', 'texture', 'riso']);

const PRESET_KEYS: Record<ImageLabMode, string[]> = {
  halftone: Object.keys(HALFTONE_PRESETS),
  texture: Object.keys(FILTER_PRESETS),
  riso: Object.keys(RISO_FULL_PRESETS),
};

const RISO_AI_PROMPT = `CORE DIRECTIVE: RISOGRAPH PRINT RECREATION
TASK: Analyze the input image and recreate it as an authentic risograph print — a vintage stencil-based duplication technique where each color is printed as a separate ink layer on uncoated paper.
STEP 1: COLOR ANALYSIS & REDUCTION — Reduce to max 4 ink layers loyal to original palette. White areas become raw paper.
STEP 2: GRAPHIC SIMPLIFICATION — Bold flat shapes, coarse halftone dots for mid-tones, hard-edged silhouettes with imperfection.
STEP 3: LAYER SIMULATION & OVERPRINT — Multiply blending where inks overlap. 1-3px misregistration. Slight ink bleed.
STEP 4: PAPER & INK TEXTURE — Off-white/cream paper with grain. Uneven ink density, speckle, ink dropout.
STEP 5: FINAL PRINT AESTHETIC — Handmade analog feel. No clean digital look. No shadows, glows, or gradients.
NEGATIVE PROMPT: smooth gradients, photorealistic rendering, clean digital illustration, anti-aliased edges, perfect color registration, white background, more than 4-5 ink colors, airbrushed tones, 3D shading, HDR, oversaturated digital colors`;

/* ─── Compare Controls ─── */

const CompareControls: React.FC = React.memo(() => {
  const labStore = useImageLabStore;
  const compareMode = labStore((s) => s.compareMode);
  const setCompareMode = labStore((s) => s.setCompareMode);
  const hasImage = labStore((s) => !!s.sourceUrl);

  if (!hasImage) return null;

  return (
    <div className="flex items-center gap-1 ml-2">
      <button
        onClick={() => setCompareMode(compareMode === 'toggle' ? 'off' : 'toggle')}
        className={cn(
          'p-1.5 rounded-md transition-all duration-150',
          compareMode === 'toggle'
            ? 'bg-white/10 text-white'
            : 'text-neutral-600 hover:text-neutral-400'
        )}
        title="Before/After toggle (Alt+Z)"
      >
        {compareMode === 'toggle' ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <button
        onClick={() => setCompareMode(compareMode === 'split' ? 'off' : 'split')}
        className={cn(
          'p-1.5 rounded-md transition-all duration-150',
          compareMode === 'split'
            ? 'bg-white/10 text-white'
            : 'text-neutral-600 hover:text-neutral-400'
        )}
        title="Split comparison (Alt+X)"
      >
        <Split size={14} />
      </button>
    </div>
  );
});
CompareControls.displayName = 'CompareControls';

/* ─── Per-mode state bridge ─── */

function usePerModeState(mode: ImageLabMode) {
  const h = useHalftoneStore;
  const t = useTextureFilterStore;
  const r = useRisoStore;

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

  return useMemo(() => {
    if (mode === 'halftone') return { panelVisible: hPanel, setPanelVisible: hSetPanel, resetSettings: hReset, fileName: hFile, zoom: hZoom, undo: hUndo, redo: hRedo, historyIndex: hHi, historyLength: hHl, hasImage: !!hImg, store: h };
    if (mode === 'texture') return { panelVisible: tPanel, setPanelVisible: tSetPanel, resetSettings: tReset, fileName: tFile, zoom: tZoom, undo: tUndo, redo: tRedo, historyIndex: tHi, historyLength: tHl, hasImage: !!tImg, store: t };
    return { panelVisible: rPanel, setPanelVisible: rSetPanel, resetSettings: rReset, fileName: rFile, zoom: rZoom, undo: rUndo, redo: rRedo, historyIndex: rHi, historyLength: rHl, hasImage: !!rImg, store: r };
  }, [mode, hPanel, hSetPanel, hReset, hFile, hZoom, hUndo, hRedo, hHi, hHl, hImg,
    tPanel, tSetPanel, tReset, tFile, tZoom, tUndo, tRedo, tHi, tHl, tImg,
    rPanel, rSetPanel, rReset, rFile, rZoom, rUndo, rRedo, rHi, rHl, rImg]);
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

  const broadcastImage = useCallback((url: string, name: string, mediaType: 'image' | 'video' = 'image') => {
    labStore.getState().setSource(url, name, mediaType);
    halftoneStore.getState().setImageUrl(url, name);
    risoStore.getState().setImageUrl(url, name);
    textureStore.getState().setImageUrl(url, name, mediaType === 'video' ? 'video' : 'image');
  }, []);

  const { canvasRef, onCanvasReady, exportPng } = useExportCanvas({
    filenamePrefix: `imagelab_${mode}`,
    getShaderSettings: () => {
      const s = activeStore.getState() as any;
      return s.shaderEnabled ? s.getShaderSettings() : undefined;
    },
    setIsExporting: (v) => (activeStore.getState() as any).setIsExporting(v),
  });

  const getShaderSettings = useCallback(() => {
    const s = activeStore.getState() as any;
    return s.shaderEnabled ? s.getShaderSettings() : undefined;
  }, [activeStore]);

  const { isDragOver, dragProps, dropMessage } = useToolEditorDragDrop({
    accept: mode === 'texture' ? 'image+video' : 'image',
    onFile: useCallback((file: File) => {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      broadcastImage(url, file.name || 'pasted', isVideo ? 'video' : 'image');
      toast.success(`Loaded ${file.name || 'pasted image'}`);
    }, [broadcastImage]),
    dropMessage: mode === 'texture' ? 'Drop image or video here' : 'Drop image here',
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
  }, [handleModeChange, setCompareMode, cyclePreset, setExportModalOpen]);

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

  const handleReset = useCallback(() => {
    resetSettings();
    if (mode === 'riso') {
      risoStore.getState().setLayers([]);
    }
  }, [resetSettings, mode]);

  const statusItems = useStatusItems(mode);

  const controlsPanel = useMemo(() => {
    switch (mode) {
      case 'halftone': return <HalftoneControls onExport={() => setExportModalOpen(true)} />;
      case 'texture': return <TextureFilterControls onExport={() => setExportModalOpen(true)} />;
      case 'riso': return <RisoControls onExport={() => setExportModalOpen(true)} onAiEnhance={handleAiEnhance} isAiProcessing={isAiProcessing} />;
    }
  }, [mode, handleAiEnhance, isAiProcessing, setExportModalOpen]);

  const extraTopBarLeft = useMemo(() => (
    <>
      <ModePreviewSwitcher mode={mode} onChange={handleModeChange} />
      <CompareControls />
    </>
  ), [mode, handleModeChange]);

  const extraTopBarRight = useMemo(() => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setPresetLibraryOpen(true)}
        className="p-1.5 rounded-md text-neutral-600 hover:text-neutral-400 transition-colors"
        title="Community Presets (Shift+P)"
      >
        <Library size={14} />
      </button>
      <button
        onClick={() => setExportModalOpen(true)}
        className="p-1.5 rounded-md text-neutral-600 hover:text-neutral-400 transition-colors"
        title="Export Settings (Shift+E)"
      >
        <Settings2 size={14} />
      </button>
    </div>
  ), [setExportModalOpen]);

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
        undo={{ handler: undo, disabled: historyIndex < 0 }}
        redo={{ handler: redo, disabled: historyIndex >= historyLength - 1 }}
        extraTopBarLeft={extraTopBarLeft}
        extraTopBarRight={extraTopBarRight}
        controlsPanel={controlsPanel}
        statusItems={statusItems}
        fileName={fileName}
        isDragOver={isDragOver}
        dragProps={dragProps}
        dropMessage={dropMessage}
      >
        {mode === 'halftone' && <HalftoneCanvas onCanvasReady={onCanvasReady} />}
        {mode === 'texture' && <TextureFilterCanvas onCanvasReady={onCanvasReady} />}
        {mode === 'riso' && <RisoCanvas onCanvasReady={onCanvasReady} />}

        <BeforeAfterOverlay sourceUrl={sourceUrl} />

        {!hasImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="flex flex-col items-center gap-4 text-neutral-500">
              <Upload size={28} strokeWidth={1.2} />
              <p className="text-[11px] uppercase tracking-widest">
                Drop or paste an image{mode === 'texture' ? ' or video' : ''} to begin
              </p>
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] tracking-wide opacity-60">
                  Ctrl+V — paste · Tab — toggle panel · 1/2/3 — switch mode
                </p>
                <p className="text-[10px] tracking-wide opacity-40">
                  Alt+Z — before/after · Alt+X — split · [ ] — cycle presets
                </p>
                <p className="text-[10px] tracking-wide opacity-30">
                  Shift+E — export · Shift+P — community presets
                </p>
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

  const compareMode = useImageLabStore((s) => s.compareMode);

  return useMemo(() => {
    const extras: { label: string; color?: string }[] = [];
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
    }
  }, [mode, compareMode, hZoom, hFrequency, hDotSize, hBlendMode, hShaderEnabled, hShaderType,
    tZoom, tBlendMode, tOpacity, tTextureName, tMaskMode, tShaderEnabled, tShaderType,
    rZoom, rFrequency, rDotSize, rMisregistration, rLayers, rSoloLayer, rShaderEnabled, rShaderType]);
}
