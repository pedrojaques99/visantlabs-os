import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '@/config/api';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { ChevronLeft, PanelRightOpen, PanelRightClose, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { AppShell, AppShellTopBar, AppShellPanel, AppShellStatusBar } from '@/components/ui/AppShell';
import { AppShellLegalMenu } from '@/components/ui/AppShellLegalMenu';
import { AppShellMobileSheet } from '@/components/ui/AppShellMobileSheet';
import { DropOverlay } from '@/components/ui/DropOverlay';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { RisoCanvas } from '@/components/riso/RisoCanvas';
import { RisoControls } from '@/components/riso/RisoControls';
import { useRisoStore } from '@/stores/risoStore';
import { applyShaderToCanvas } from '@/utils/shaders/applyShaderToCanvas';
import { useIsMobile } from '@/hooks/use-media-query';
import { usePasteImage } from '@/hooks/usePasteImage';

const RISO_AI_PROMPT = `CORE DIRECTIVE: RISOGRAPH PRINT RECREATION
TASK: Analyze the input image and recreate it as an authentic risograph print — a vintage stencil-based duplication technique where each color is printed as a separate ink layer on uncoated paper.
STEP 1: COLOR ANALYSIS & REDUCTION — Reduce to max 4 ink layers loyal to original palette. White areas become raw paper.
STEP 2: GRAPHIC SIMPLIFICATION — Bold flat shapes, coarse halftone dots for mid-tones, hard-edged silhouettes with imperfection.
STEP 3: LAYER SIMULATION & OVERPRINT — Multiply blending where inks overlap. 1-3px misregistration. Slight ink bleed.
STEP 4: PAPER & INK TEXTURE — Off-white/cream paper with grain. Uneven ink density, speckle, ink dropout.
STEP 5: FINAL PRINT AESTHETIC — Handmade analog feel. No clean digital look. No shadows, glows, or gradients.
NEGATIVE PROMPT: smooth gradients, photorealistic rendering, clean digital illustration, anti-aliased edges, perfect color registration, white background, more than 4-5 ink colors, airbrushed tones, 3D shading, HDR, oversaturated digital colors`;

export const RisoMachinePage: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  useEffect(() => { document.title = 'Riso Machine — Visant'; }, []);

  const panelVisible = useRisoStore((s) => s.panelVisible);
  const setPanelVisible = useRisoStore((s) => s.setPanelVisible);
  const resetSettings = useRisoStore((s) => s.resetSettings);
  const frequency = useRisoStore((s) => s.frequency);
  const dotSize = useRisoStore((s) => s.dotSize);
  const misregistration = useRisoStore((s) => s.misregistration);
  const layers = useRisoStore((s) => s.layers);
  const fileName = useRisoStore((s) => s.fileName);
  const shaderEnabled = useRisoStore((s) => s.shaderEnabled);
  const shaderType = useRisoStore((s) => s.shaderType);
  const zoom = useRisoStore((s) => s.zoom);
  const soloLayer = useRisoStore((s) => s.soloLayer);
  const undo = useRisoStore((s) => s.undo);
  const redo = useRisoStore((s) => s.redo);
  const setZoom = useRisoStore((s) => s.setZoom);
  const setPan = useRisoStore((s) => s.setPan);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    const store = useRisoStore.getState();
    store.setIsExporting(true);
    try {
      let exportCanvas = canvasRef.current;
      if (store.shaderEnabled) {
        exportCanvas = await applyShaderToCanvas(exportCanvas, store.getShaderSettings());
      }
      const blob = await new Promise<Blob>((resolve) => {
        exportCanvas.toBlob((b) => resolve(b!), 'image/png');
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `riso_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PNG exported');
    } catch {
      toast.error('Export failed — try again');
    } finally {
      store.setIsExporting(false);
    }
  }, []);

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
        body: JSON.stringify({
          image: { base64, mimeType: 'image/png' },
          prompt: RISO_AI_PROMPT,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `AI enhancement failed (${res.status})`);
      }

      const data = await res.json();
      if (data.imageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          useRisoStore.getState().setImageUrl(data.imageUrl, 'ai-enhanced.png');
          toast.success('AI Riso enhancement applied');
        };
        img.src = data.imageUrl;
      }
    } catch (err: any) {
      toast.error(err?.message || 'AI enhancement unavailable');
    } finally {
      setIsAiProcessing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    resetSettings();
    useRisoStore.getState().setLayers([]);
    setConfirmReset(false);
    toast.success('Settings reset');
  }, [resetSettings]);

  useHotkeys('mod+e', (e) => { e.preventDefault(); handleExport(); }, { enableOnFormTags: false });
  useHotkeys('r', () => setConfirmReset(true), { enableOnFormTags: false });
  useHotkeys('tab', (e) => { e.preventDefault(); setPanelVisible(!panelVisible); }, { enableOnFormTags: false });
  useHotkeys('mod+z', (e) => { e.preventDefault(); undo(); }, { enableOnFormTags: false });
  useHotkeys('mod+shift+z', (e) => { e.preventDefault(); redo(); }, { enableOnFormTags: false });
  useHotkeys('mod+=', (e) => { e.preventDefault(); setZoom(zoom * 1.2); }, { enableOnFormTags: false });
  useHotkeys('mod+-', (e) => { e.preventDefault(); setZoom(zoom / 1.2); }, { enableOnFormTags: false });
  useHotkeys('mod+0', (e) => { e.preventDefault(); setZoom(1); setPan(0, 0); }, { enableOnFormTags: false });

  usePasteImage(useCallback(({ file }) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    useRisoStore.getState().setImageUrl(url, file.name || 'pasted-image');
    toast.success(`Loaded ${file.name || 'pasted image'}`);
  }, []));

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    useRisoStore.getState().setImageUrl(url, file.name);
    toast.success(`Loaded ${file.name}`);
  }, []);

  return (
    <AppShell>
      <AppShellTopBar
        left={
          <>
            <Tooltip content="Back to apps">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => navigate('/apps')}>
                <ChevronLeft size={16} />
              </Button>
            </Tooltip>
            <MicroTitle className="text-[10px] text-neutral-600 uppercase tracking-widest ml-1">
              RISO MACHINE
            </MicroTitle>
          </>
        }
        right={
          <>
            <Tooltip content="Reset settings (R)">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={14} />
              </Button>
            </Tooltip>
            {!isMobile && (
              <Tooltip content={panelVisible ? 'Hide panel (Tab)' : 'Show panel (Tab)'}>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => setPanelVisible(!panelVisible)}>
                  {panelVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                </Button>
              </Tooltip>
            )}
            <AppShellLegalMenu />
          </>
        }
      />

      <div
        className="absolute inset-0 pt-10 transition-all duration-300"
        style={{
          paddingRight: !isMobile && panelVisible ? 316 : 0,
          paddingBottom: isMobile ? (mobileSheetOpen ? '45%' : 48) : 40,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <RisoCanvas onCanvasReady={handleCanvasReady} />
        <DropOverlay visible={isDragOver} message="Drop image here" />
      </div>

      {!isMobile && (
        <AppShellPanel side="right" visible={panelVisible} width={300}>
          <RisoControls onExport={handleExport} onAiEnhance={handleAiEnhance} isAiProcessing={isAiProcessing} />
        </AppShellPanel>
      )}

      {isMobile && (
        <AppShellMobileSheet open={mobileSheetOpen} onToggle={() => setMobileSheetOpen(!mobileSheetOpen)}>
          <RisoControls onExport={handleExport} onAiEnhance={handleAiEnhance} isAiProcessing={isAiProcessing} />
        </AppShellMobileSheet>
      )}

      {!isMobile && (
        <AppShellStatusBar>
          <span>{Math.round(zoom * 100)}%</span>
          <span>•</span>
          <span>freq {frequency}</span>
          <span>•</span>
          <span>dot {dotSize.toFixed(2)}</span>
          <span>•</span>
          <span>misreg {misregistration}px</span>
          <span>•</span>
          <span>{layers.filter(l => l.visible).length} layers</span>
          {soloLayer >= 0 && (
            <>
              <span>•</span>
              <span className="text-amber-400">solo L{soloLayer + 1}</span>
            </>
          )}
          {shaderEnabled && (
            <>
              <span>•</span>
              <span className="text-cyan-400">{shaderType}</span>
            </>
          )}
          {fileName && (
            <>
              <span>•</span>
              <span className="max-w-[120px] truncate">{fileName}</span>
            </>
          )}
        </AppShellStatusBar>
      )}

      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset settings"
        message="All riso settings will return to defaults and extracted layers will be cleared."
        confirmText="Reset"
        variant="warning"
      />
    </AppShell>
  );
};
