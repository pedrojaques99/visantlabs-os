import React, { useCallback, useRef, useState } from 'react';
import { API_BASE } from '@/config/api';
import { toast } from 'sonner';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { RisoCanvas, type RisoCanvasHandle } from '@/components/riso/RisoCanvas';
import { RisoControls } from '@/components/riso/RisoControls';
import { useRisoStore } from '@/stores/risoStore';
import { useExportCanvas } from '@/hooks/useExportCanvas';
import { loadImage } from '@/utils/imageUtils';
import { useToolEditorHotkeys } from '@/hooks/useToolEditorHotkeys';
import { useToolEditorDragDrop } from '@/hooks/useToolEditorDragDrop';
import { generateRisoSvgFromCanvas } from '@/components/riso/riso-svg-export';
import { downloadBlob } from '@/utils/clipboard';

const RISO_AI_PROMPT = `CORE DIRECTIVE: RISOGRAPH PRINT RECREATION
TASK: Analyze the input image and recreate it as an authentic risograph print — a vintage stencil-based duplication technique where each color is printed as a separate ink layer on uncoated paper.
STEP 1: COLOR ANALYSIS & REDUCTION — Reduce to max 4 ink layers loyal to original palette. White areas become raw paper.
STEP 2: GRAPHIC SIMPLIFICATION — Bold flat shapes, coarse halftone dots for mid-tones, hard-edged silhouettes with imperfection.
STEP 3: LAYER SIMULATION & OVERPRINT — Multiply blending where inks overlap. 1-3px misregistration. Slight ink bleed.
STEP 4: PAPER & INK TEXTURE — Off-white/cream paper with grain. Uneven ink density, speckle, ink dropout.
STEP 5: FINAL PRINT AESTHETIC — Handmade analog feel. No clean digital look. No shadows, glows, or gradients.
NEGATIVE PROMPT: smooth gradients, photorealistic rendering, clean digital illustration, anti-aliased edges, perfect color registration, white background, more than 4-5 ink colors, airbrushed tones, 3D shading, HDR, oversaturated digital colors`;

export const RisoMachinePage: React.FC = () => {
  const store = useRisoStore;
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const risoCanvasRef = useRef<RisoCanvasHandle>(null);

  const panelVisible = store((s) => s.panelVisible);
  const setPanelVisible = store((s) => s.setPanelVisible);
  const resetSettings = store((s) => s.resetSettings);
  const frequency = store((s) => s.frequency);
  const dotSize = store((s) => s.dotSize);
  const misregistration = store((s) => s.misregistration);
  const ditherMode = store((s) => s.ditherMode);
  const layers = store((s) => s.layers);
  const fileName = store((s) => s.fileName);
  const shaderEnabled = store((s) => s.shaderEnabled);
  const shaderType = store((s) => s.shaderType);
  const zoom = store((s) => s.zoom);
  const soloLayer = store((s) => s.soloLayer);
  const undo = store((s) => s.undo);
  const redo = store((s) => s.redo);
  const historyIndex = store((s) => s.historyIndex);
  const historyLength = store((s) => s.settingsHistory.length);

  const { canvasRef, onCanvasReady, exportPng } = useExportCanvas({
    filenamePrefix: 'riso',
    getShaderSettings: () => {
      const s = store.getState();
      return s.shaderEnabled ? s.getShaderSettings() : undefined;
    },
    setIsExporting: (v) => store.getState().setIsExporting(v),
  });

  const { isDragOver, dragProps, dropMessage } = useToolEditorDragDrop({
    accept: 'image',
    onFile: useCallback((file: File) => {
      const url = URL.createObjectURL(file);
      store.getState().setImageUrl(url, file.name || 'pasted-image');
      toast.success(`Loaded ${file.name || 'pasted image'}`);
    }, []),
  });

  useToolEditorHotkeys({
    onExport: exportPng,
    panelVisible,
    setPanelVisible,
    undo,
    redo,
    zoom: { current: zoom, set: (z) => store.getState().setZoom(z), resetPan: () => store.getState().setPan(0, 0) },
  });

  // --- SVG Export ---
  const handleExportSvg = useCallback(() => {
    if (!canvasRef.current) return;
    store.getState().setIsExporting(true);
    try {
      const settings = store.getState().getSettings();
      const svg = generateRisoSvgFromCanvas(canvasRef.current, settings);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      downloadBlob(blob, `riso_${Date.now()}.svg`);
      toast.success('SVG exported');
    } catch {
      toast.error('SVG export failed');
    } finally {
      store.getState().setIsExporting(false);
    }
  }, [canvasRef]);

  // --- Hi-Res PNG Export (2x) ---
  const handleExportHiRes = useCallback(() => {
    const renderer = risoCanvasRef.current?.getRenderer();
    if (!renderer) return;
    store.getState().setIsExporting(true);
    try {
      const settings = store.getState().getSettings();
      const scaled = renderer.renderAtScale(settings, 2);
      scaled.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, `riso_2x_${Date.now()}.png`);
          toast.success('Hi-Res PNG exported (2x)');
        }
      }, 'image/png');
    } catch {
      toast.error('Hi-Res export failed');
    } finally {
      store.getState().setIsExporting(false);
    }
  }, []);

  // --- Per-layer SVG export ---
  const handleExportLayer = useCallback((index: number) => {
    if (!canvasRef.current) return;
    store.getState().setIsExporting(true);
    try {
      const settings = store.getState().getSettings();
      const svg = generateRisoSvgFromCanvas(canvasRef.current, settings, { layerIndex: index });
      const layerHex = settings.layers[index]?.hex || 'layer';
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      downloadBlob(blob, `riso_layer${index + 1}_${layerHex.replace('#', '')}_${Date.now()}.svg`);
      toast.success(`Layer ${index + 1} exported as SVG`);
    } catch {
      toast.error('Layer export failed');
    } finally {
      store.getState().setIsExporting(false);
    }
  }, [canvasRef]);

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
        store.getState().setImageUrl(data.imageUrl, 'ai-enhanced.png');
        toast.success('AI Riso enhancement applied');
      }
    } catch (err: any) {
      toast.error(err?.message || 'AI enhancement unavailable');
    } finally {
      setIsAiProcessing(false);
    }
  }, [canvasRef]);

  const handleReset = useCallback(() => {
    resetSettings();
    store.getState().setLayers([]);
  }, [resetSettings]);

  const statusItems = [
    { label: `${Math.round(zoom * 100)}%` },
    { label: `freq ${frequency}` },
    { label: `dot ${dotSize.toFixed(2)}` },
    { label: ditherMode !== 'stochastic' ? ditherMode : '', color: 'text-neutral-400' },
    { label: `misreg ${misregistration}px` },
    { label: `${layers.filter(l => l.visible).length} layers` },
    ...(soloLayer >= 0 ? [{ label: `solo L${soloLayer + 1}`, color: 'text-amber-400' }] : []),
    ...(shaderEnabled ? [{ label: shaderType, color: 'text-cyan-400' }] : []),
  ].filter(s => s.label);

  return (
    <ToolEditorShell
      title="RISO MACHINE"
      documentTitle="Riso Machine — Visant"
      panelVisible={panelVisible}
      setPanelVisible={setPanelVisible}
      onReset={handleReset}
      resetMessage="All riso settings will return to defaults and extracted layers will be cleared."
      undo={{ handler: undo, disabled: historyIndex < 0 }}
      redo={{ handler: redo, disabled: historyIndex >= historyLength - 1 }}
      controlsPanel={
        <RisoControls
          onExport={exportPng}
          onExportSvg={handleExportSvg}
          onExportHiRes={handleExportHiRes}
          onExportLayer={handleExportLayer}
          onAiEnhance={handleAiEnhance}
          isAiProcessing={isAiProcessing}
        />
      }
      statusItems={statusItems}
      fileName={fileName}
      isDragOver={isDragOver}
      dragProps={dragProps}
      dropMessage={dropMessage}
    >
      <RisoCanvas ref={risoCanvasRef} onCanvasReady={onCanvasReady} />
    </ToolEditorShell>
  );
};
