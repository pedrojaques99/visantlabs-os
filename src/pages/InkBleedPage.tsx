// ui-scale-ignore-file: raio-sortido — arquivo novo dentro do orçamento de raios; a soma da catraca não distingue isso.
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { SendToButton } from '@/components/shared/SendToButton';
import { ApplyBrandButton } from '@/components/shared/BrandSwatchRow';
import { ToolPanel, ToolPanelExportActions, ToolPanelHeader } from '@/components/shared/ToolPanel';
import {
  InkBleedCanvas,
  clampZoom,
  useArtworkViewport,
} from '@/components/ink-bleed/InkBleedCanvas';
import { InkBleedExportDialog } from '@/components/ink-bleed/InkBleedExportDialog';
import { InkBleedSections } from '@/components/ink-bleed/InkBleedPanel';
import { InkBleedTransport } from '@/components/ink-bleed/InkBleedTransport';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';
import { useIsMobile } from '@/hooks/use-media-query';
import { useToolEditorHotkeys } from '@/hooks/useToolEditorHotkeys';
import { useToolInput } from '@/hooks/useToolInput';
import { useTranslation } from '@/hooks/useTranslation';
import { applyBrandToDoc, brandName } from '@/lib/ink-bleed/brand';
import { FORMATS, fitFontSize, motionStart } from '@/lib/ink-bleed/engine';
import { exportPngDataUrl } from '@/lib/ink-bleed/exporter';
import { ensureFont, measureLines } from '@/lib/ink-bleed/fonts';
import { createLogoMask } from '@/lib/ink-bleed/logoMask';
import { shuffleDoc } from '@/lib/ink-bleed/shuffle';
import { Eraser, PanelRightClose, PanelRightOpen, Redo2, Shuffle, Undo2 } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { useInkBleedStore } from '@/stores/inkBleedStore';
import { copyImageAsPng } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';

const history = useInkBleedStore.temporal;

function useHistoryFlags() {
  const canUndo = useSyncExternalStore(
    history.subscribe,
    () => history.getState().pastStates.length > 0
  );
  const canRedo = useSyncExternalStore(
    history.subscribe,
    () => history.getState().futureStates.length > 0
  );
  return { canUndo, canRedo };
}

function usePlayback() {
  const isPlaying = useInkBleedStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let last: number | null = null;

    const tick = (now: number) => {
      const state = useInkBleedStore.getState();
      const { duration, speed } = state.doc.motion;
      // A background tab pauses this loop: do not let the first frame back jump ahead.
      const delta = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = state.progress + (delta / duration) * speed;
      state.setProgress(next % 1);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);
}

export const InkBleedPage: React.FC = () => {
  const { t } = useTranslation();
  const activeBrand = useActiveBrandSafe()?.activeBrand ?? null;

  const format = useInkBleedStore((s) => s.doc.format);
  const source = useInkBleedStore((s) => s.doc.source);
  const fontFamily = useInkBleedStore((s) => s.doc.typography.fontFamily);
  const fontWeight = useInkBleedStore((s) => s.doc.typography.fontWeight);
  const presetId = useInkBleedStore((s) => s.doc.presetId);
  const brandLocked = useInkBleedStore((s) => s.doc.brandLocked);
  const setBrandLocked = useInkBleedStore((s) => s.setBrandLocked);
  const hasLogo = useInkBleedStore((s) => !!s.logo);
  const saveBlocked = useInkBleedStore((s) => s.saveBlocked);
  const setDoc = useInkBleedStore((s) => s.setDoc);
  const setLogo = useInkBleedStore((s) => s.setLogo);
  const setSource = useInkBleedStore((s) => s.setSource);
  const setPlaying = useInkBleedStore((s) => s.setPlaying);
  const setProgress = useInkBleedStore((s) => s.setProgress);
  const setTypography = useInkBleedStore((s) => s.setTypography);
  const reset = useInkBleedStore((s) => s.reset);

  const [panelVisible, setPanelVisible] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const isMobile = useIsMobile();
  const [isDragOver, setIsDragOver] = useState(false);

  const { width, height } = FORMATS[format];
  const viewport = useArtworkViewport(width, height);
  const { canUndo, canRedo } = useHistoryFlags();
  usePlayback();

  useEffect(() => {
    if (saveBlocked) toast.warning(t('inkBleed.saveBlocked'));
  }, [saveBlocked, t]);

  const togglePlay = useCallback(() => {
    const { isPlaying, progress, doc } = useInkBleedStore.getState();
    // Paused on the finished artwork, play starts the cycle from its beginning.
    if (!isPlaying && progress >= 1) setProgress(motionStart(doc.motion.mode));
    setPlaying(!isPlaying);
  }, [setPlaying, setProgress]);

  const loadLogo = useCallback(
    async (src: string, name: string) => {
      try {
        setLogo(await createLogoMask(src, name));
        setSource('logo');
      } catch (error) {
        console.error('[ink-bleed] logo failed', error);
        toast.error(t('inkBleed.logo.failed'));
      }
    },
    [setLogo, setSource, t]
  );

  const handleLogoFiles = useCallback(
    (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file) return;
      const error = validateFile(file, 'image');
      if (error) {
        toast.error(error);
        return;
      }
      const url = URL.createObjectURL(file);
      void loadLogo(url, file.name).finally(() => URL.revokeObjectURL(url));
    },
    [loadLogo]
  );

  // Another tool sent an image here: it becomes the artwork.
  const { pendingAsset, acceptAsset } = useToolInput('ink-bleed');
  useEffect(() => {
    if (!pendingAsset) return;
    const asset = acceptAsset();
    const src = asset?.imageUrl || asset?.imageBase64;
    if (src) void loadLogo(src, asset?.label || 'asset.png');
  }, [pendingAsset, acceptAsset, loadLogo]);

  useEffect(() => {
    void ensureFont(fontFamily, fontWeight);
  }, [fontFamily, fontWeight]);

  // A new font, style or format can push the text out of the artwork. Only ever
  // shrinks: a size the person chose stays as long as it fits.
  const fitRun = useRef(0);
  useEffect(() => {
    const run = ++fitRun.current;
    void ensureFont(fontFamily, fontWeight).then((ok) => {
      if (!ok || run !== fitRun.current) return;
      const { doc } = useInkBleedStore.getState();
      const fit = fitFontSize(doc, (lines, size) =>
        measureLines(lines, fontFamily, fontWeight, size)
      );
      if (doc.typography.fontSize > fit) setTypography({ fontSize: fit });
    });
  }, [format, fontFamily, fontWeight, presetId, setTypography]);

  const applyBrand = useCallback(async () => {
    if (!activeBrand) return;
    const { doc } = useInkBleedStore.getState();
    const next = applyBrandToDoc(doc, activeBrand);
    const fontChanged = next.typography.fontFamily !== doc.typography.fontFamily;
    if (fontChanged && !(await ensureFont(next.typography.fontFamily, 400))) {
      // A brand can use a typeface that is not on Google Fonts. Say so instead of
      // quietly drawing the brand name in a fallback.
      toast.warning(t('inkBleed.font.brandMissing', { family: next.typography.fontFamily }));
      next.typography = { ...next.typography, fontFamily: doc.typography.fontFamily };
    } else if (fontChanged) {
      next.typography = { ...next.typography, fontWeight: 400 };
    }
    setDoc(next);
    toast.success(t('inkBleed.brandApplied', { brand: brandName(activeBrand) ?? '' }));
  }, [activeBrand, setDoc, t]);

  const copyArtwork = useCallback(async () => {
    const { doc, logo, progress } = useInkBleedStore.getState();
    const dataUrl = await exportPngDataUrl({ doc, logo, progress, scale: 1, transparent: false });
    const result = await copyImageAsPng(dataUrl);
    if (result.success) toast.success(t('miniTools.copied'));
    else toast.error(result.error || t('miniTools.copyFailed'));
  }, [t]);

  const artworkForPipeline = useCallback(async () => {
    const { doc, logo, progress } = useInkBleedStore.getState();
    return exportPngDataUrl({ doc, logo, progress, scale: 1, transparent: false });
  }, []);

  const shuffle = useCallback(() => {
    const { doc } = useInkBleedStore.getState();
    setPlaying(false);
    setProgress(1);
    setDoc(shuffleDoc(doc));
  }, [setDoc, setPlaying, setProgress]);

  const undo = useCallback(() => history.getState().undo(), []);
  const redo = useCallback(() => history.getState().redo(), []);

  useToolEditorHotkeys({
    onExport: () => setExportOpen(true),
    panelVisible,
    setPanelVisible,
    undo,
    redo,
    zoom: {
      current: viewport.zoom,
      set: (z) => viewport.setZoom(clampZoom(z)),
      resetPan: viewport.fit,
    },
    extras: [
      {
        keys: 'space',
        handler: (e) => {
          e.preventDefault();
          togglePlay();
        },
      },
      { keys: 's', handler: shuffle },
    ],
  });

  const dragProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    },
    onDragLeave: () => setIsDragOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files?.length) handleLogoFiles(e.dataTransfer.files);
    },
  };

  const awaitingLogo = source === 'logo' && !hasLogo;

  const controlsPanel = (
    <ToolPanel>
      {activeBrand && (
        <ToolPanelHeader>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-2xs text-muted-foreground">
              {brandName(activeBrand)}
            </span>
            {brandLocked ? (
              <button
                type="button"
                onClick={() => setBrandLocked(false)}
                className="shrink-0 text-2xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('inkBleed.brandRelease')}
              </button>
            ) : (
              <ApplyBrandButton onApply={() => void applyBrand()} className="shrink-0" />
            )}
          </div>
        </ToolPanelHeader>
      )}
      <InkBleedSections onLogoFiles={handleLogoFiles} onLogoUrl={loadLogo} />
      <ToolPanelExportActions
        onExport={() => setExportOpen(true)}
        isExporting={false}
        disabled={awaitingLogo}
        onCopyAsPng={() => void copyArtwork()}
        sendTo={
          <SendToButton
            source="ink-bleed"
            outputMime="image/png"
            mimeType="image/png"
            label={t('apps.inkBleed.name')}
            getImageBase64={artworkForPipeline}
          />
        }
      />
    </ToolPanel>
  );

  return (
    <ToolEditorShell
      title={t('apps.inkBleed.name')}
      documentTitle={t('apps.inkBleed.name')}
      panelVisible={panelVisible}
      setPanelVisible={setPanelVisible}
      onReset={reset}
      // The app bar above already says where we are. A second bar would repeat it.
      hideTopBar
      controlsPanel={controlsPanel}
      controlsPanelWidth={340}
      mobileSheetLabel={t('inkBleed.tabs.panel')}
      isDragOver={isDragOver}
      dragProps={dragProps}
      dropMessage={t('inkBleed.logo.drop')}
    >
      {/* The shell reserves the panel with padding: everything here lives in that box. */}
      <div className="relative h-full w-full">
        <InkBleedCanvas viewport={viewport} onLogoFiles={handleLogoFiles} />
        <div
          data-canvas-ui
          className={cn(
            'absolute left-3 top-3 z-10 flex items-center gap-0.5 rounded-xl p-1 cursor-default',
            'border border-border bg-card shadow-lg'
          )}
        >
          <Tooltip content={t('inkBleed.shuffleHint')}>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('inkBleed.shuffle')}
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={shuffle}
            >
              <Shuffle size={14} />
              {t('inkBleed.shuffle')}
            </Button>
          </Tooltip>
          <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
          <Tooltip content={t('toolEditor.undoHint')}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('toolEditor.undo')}
              className="h-7 w-7 text-muted-foreground disabled:opacity-30"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 size={14} />
            </Button>
          </Tooltip>
          <Tooltip content={t('toolEditor.redoHint')}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('toolEditor.redo')}
              className="h-7 w-7 text-muted-foreground disabled:opacity-30"
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 size={14} />
            </Button>
          </Tooltip>
          <Tooltip content={t('toolEditor.resetHint')}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.resetSettingsTitle')}
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setConfirmReset(true)}
            >
              <Eraser size={14} />
            </Button>
          </Tooltip>
          {!isMobile && (
            <Tooltip
              content={panelVisible ? t('toolEditor.hidePanelHint') : t('toolEditor.showPanelHint')}
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label={panelVisible ? t('common.hidePanel') : t('common.showPanel')}
                className="h-7 w-7 text-muted-foreground"
                onClick={() => setPanelVisible(!panelVisible)}
              >
                {panelVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </Button>
            </Tooltip>
          )}
        </div>
        <InkBleedTransport viewport={viewport} onTogglePlay={togglePlay} />
      </div>
      <InkBleedExportDialog isOpen={exportOpen} onClose={() => setExportOpen(false)} />
      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          reset();
          setConfirmReset(false);
          toast.success(t('common.settingsReset'));
        }}
        title={t('common.resetSettingsTitle')}
        message={t('common.resetSettingsMessage')}
        confirmText={t('common.reset')}
        variant="warning"
      />
    </ToolEditorShell>
  );
};
