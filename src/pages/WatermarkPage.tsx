import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stamp, Upload, X, Type, Image } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  useWatermarkStore,
  type WatermarkItem,
  type WatermarkPosition,
} from '@/stores/watermarkStore';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { loadImage, downloadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/Dropzone';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Input } from '@/components/ui/input';
import JSZip from 'jszip';
import { QuickActions } from '@/components/shared/QuickActions';
import { BrandToolSelect } from '@/components/shared/BrandToolSelect';
import { useToolInput } from '@/hooks/useToolInput';
import { useBrandDefaults } from '@/hooks/useBrandDefaults';
import { glassSurface } from '@/lib/ui/glass';
import { useTranslation } from '@/hooks/useTranslation';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { Thumb } from '@/components/ui/Thumb';
import { fade, transitions } from '@/lib/ui/motion';

/* ------------------------------------------------------------------ */
/*  Animation presets                                                  */
/* ------------------------------------------------------------------ */

const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: transitions.base,
};

/* ------------------------------------------------------------------ */
/*  Position helpers                                                   */
/* ------------------------------------------------------------------ */

const POSITION_GRID: WatermarkPosition[][] = [
  ['top-left', 'top-center', 'top-right'],
  ['center-left', 'center', 'center-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
];

function getPositionCoords(
  position: WatermarkPosition,
  cw: number,
  ch: number,
  wmW: number,
  wmH: number
): [number, number] {
  const pad = Math.min(cw, ch) * 0.03;
  const map: Record<Exclude<WatermarkPosition, 'tile'>, [number, number]> = {
    'top-left': [pad + wmH / 2, pad + wmW / 2],
    'top-center': [pad + wmH / 2, cw / 2],
    'top-right': [pad + wmH / 2, cw - pad - wmW / 2],
    'center-left': [ch / 2, pad + wmW / 2],
    center: [ch / 2, cw / 2],
    'center-right': [ch / 2, cw - pad - wmW / 2],
    'bottom-left': [ch - pad - wmH / 2, pad + wmW / 2],
    'bottom-center': [ch - pad - wmH / 2, cw / 2],
    'bottom-right': [ch - pad - wmH / 2, cw - pad - wmW / 2],
  };
  return map[position as Exclude<WatermarkPosition, 'tile'>];
}

/* ------------------------------------------------------------------ */
/*  Canvas watermark processor                                         */
/* ------------------------------------------------------------------ */

interface WmSettings {
  watermarkType: 'text' | 'logo';
  text: string;
  logoUrl: string;
  position: WatermarkPosition;
  opacity: number;
  scale: number;
  rotation: number;
  color: string;
}

async function applyWatermark(item: WatermarkItem, settings: WmSettings): Promise<string> {
  const img = await loadImage(item.sourceUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  ctx.globalAlpha = settings.opacity;

  const scaleFraction = settings.scale / 100;

  if (settings.watermarkType === 'text') {
    const fontSize = Math.max(12, canvas.width * scaleFraction * 0.15);
    ctx.font = `bold ${fontSize}px "Inter", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = settings.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(settings.text);
    const wmW = metrics.width;
    const wmH = fontSize;

    if (settings.position === 'tile') {
      const gap = Math.max(wmW, wmH) * 1.8;
      ctx.save();
      for (let y = -canvas.height; y < canvas.height * 2; y += gap) {
        for (let x = -canvas.width; x < canvas.width * 2; x += gap) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((settings.rotation * Math.PI) / 180);
          ctx.fillText(settings.text, 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
    } else {
      const [posY, posX] = getPositionCoords(
        settings.position,
        canvas.width,
        canvas.height,
        wmW,
        wmH
      );
      ctx.save();
      ctx.translate(posX, posY);
      ctx.rotate((settings.rotation * Math.PI) / 180);
      ctx.fillText(settings.text, 0, 0);
      ctx.restore();
    }
  } else {
    // Logo watermark
    if (!settings.logoUrl) throw new Error('No logo uploaded');
    const logo = await loadImage(settings.logoUrl, null);
    const targetW = canvas.width * scaleFraction * 0.3;
    const aspect = logo.naturalHeight / logo.naturalWidth;
    const wmW = targetW;
    const wmH = targetW * aspect;

    if (settings.position === 'tile') {
      const gap = Math.max(wmW, wmH) * 2;
      ctx.save();
      for (let y = -canvas.height; y < canvas.height * 2; y += gap) {
        for (let x = -canvas.width; x < canvas.width * 2; x += gap) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((settings.rotation * Math.PI) / 180);
          ctx.drawImage(logo, -wmW / 2, -wmH / 2, wmW, wmH);
          ctx.restore();
        }
      }
      ctx.restore();
    } else {
      const [posY, posX] = getPositionCoords(
        settings.position,
        canvas.width,
        canvas.height,
        wmW,
        wmH
      );
      ctx.save();
      ctx.translate(posX, posY);
      ctx.rotate((settings.rotation * Math.PI) / 180);
      ctx.drawImage(logo, -wmW / 2, -wmH / 2, wmW, wmH);
      ctx.restore();
    }
  }

  return canvas.toDataURL('image/png');
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export const WatermarkPage: React.FC = () => {
  const { t } = useTranslation();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [convertProgress, setConvertProgress] = useState(0);

  const items = useWatermarkStore((s) => s.items);
  const watermarkType = useWatermarkStore((s) => s.watermarkType);
  const text = useWatermarkStore((s) => s.text);
  const logoUrl = useWatermarkStore((s) => s.logoUrl);
  const position = useWatermarkStore((s) => s.position);
  const opacity = useWatermarkStore((s) => s.opacity);
  const scale = useWatermarkStore((s) => s.scale);
  const rotation = useWatermarkStore((s) => s.rotation);
  const color = useWatermarkStore((s) => s.color);
  const isProcessing = useWatermarkStore((s) => s.isProcessing);
  const addFiles = useWatermarkStore((s) => s.addFiles);
  const removeItem = useWatermarkStore((s) => s.removeItem);
  const updateItem = useWatermarkStore((s) => s.updateItem);
  const setWatermarkType = useWatermarkStore((s) => s.setWatermarkType);
  const setText = useWatermarkStore((s) => s.setText);
  const setLogoUrl = useWatermarkStore((s) => s.setLogoUrl);
  const setPosition = useWatermarkStore((s) => s.setPosition);
  const setOpacity = useWatermarkStore((s) => s.setOpacity);
  const setScale = useWatermarkStore((s) => s.setScale);
  const setRotation = useWatermarkStore((s) => s.setRotation);
  const setColor = useWatermarkStore((s) => s.setColor);
  const setIsProcessing = useWatermarkStore((s) => s.setIsProcessing);
  const reset = useWatermarkStore((s) => s.reset);

  const { pendingAsset, acceptAsset } = useToolInput('watermark');
  const { brandId, setBrandId, defaults: brandDefaults } = useBrandDefaults('watermark');

  /* --- Apply brand defaults when brand is selected --- */
  useEffect(() => {
    if (!brandDefaults) return;
    if (brandDefaults.logoUrl) setLogoUrl(brandDefaults.logoUrl);
    if (brandDefaults.textColor) setColor(brandDefaults.textColor);
  }, [brandDefaults, setLogoUrl, setColor]);

  useEffect(() => {
    if (!pendingAsset) return;
    const asset = acceptAsset();
    if (!asset) return;
    const url = asset.imageUrl || asset.imageBase64 || '';
    if (url) addFiles([{ url, name: asset.label || 'pipeline-asset.png' }]);
  }, [pendingAsset, acceptAsset, addFiles]);

  const hasItems = items.length > 0;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const queuedOrErrorCount = items.filter(
    (i) => i.status === 'queued' || i.status === 'error'
  ).length;
  const previewItem =
    items.find((i) => i.id === previewId) || items.find((i) => i.status === 'done') || items[0];

  /* --- File handling --- */

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const valid: { url: string; name: string }[] = [];
      Array.from(fileList).forEach((file) => {
        const error = validateFile(file, 'image');
        if (error) {
          toast.error(`${file.name}: ${error}`);
          return;
        }
        valid.push({ url: URL.createObjectURL(file), name: file.name });
      });
      if (valid.length) addFiles(valid);
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const error = validateFile(file, 'image');
      if (error) {
        toast.error(error);
        return;
      }
      setLogoUrl(URL.createObjectURL(file));
      e.target.value = '';
    },
    [setLogoUrl]
  );

  /* --- Processing --- */

  const handleProcessAll = useCallback(async () => {
    if (isProcessing) return;
    const toProcess = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (!toProcess.length) {
      toast.info(t('miniTools.nothingToProcess'));
      return;
    }

    const settings: WmSettings = {
      watermarkType,
      text,
      logoUrl,
      position,
      opacity,
      scale,
      rotation,
      color,
    };

    if (settings.watermarkType === 'logo' && !settings.logoUrl) {
      toast.error(t('miniTools.watermark.uploadLogoFirst'));
      return;
    }

    setIsProcessing(true);
    setConvertProgress(0);
    let done = 0;
    const total = toProcess.length;
    for (const item of toProcess) {
      updateItem(item.id, { status: 'processing' });
      try {
        const result = await applyWatermark(item, settings);
        updateItem(item.id, { status: 'done', resultBase64: result });
        done++;
      } catch (err: any) {
        console.error(`Watermark failed for ${item.fileName}:`, err);
        updateItem(item.id, { status: 'error', error: err?.message || 'Failed' });
        done++;
      }
      setConvertProgress(Math.round((done / total) * 100));
    }
    setIsProcessing(false);
    if (done > 0) toast.success(t('miniTools.watermark.done', { count: done }));
  }, [
    t,
    items,
    watermarkType,
    text,
    logoUrl,
    position,
    opacity,
    scale,
    rotation,
    color,
    isProcessing,
    updateItem,
    setIsProcessing,
  ]);

  /* --- Download --- */

  const handleDownloadAll = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBase64);
    if (!doneItems.length) return;

    if (doneItems.length === 1) {
      await downloadImage(doneItems[0].resultBase64, 'watermarked');
      return;
    }

    const zip = new JSZip();
    for (const item of doneItems) {
      const base64Data = item.resultBase64.includes(',')
        ? item.resultBase64.split(',')[1]
        : item.resultBase64;
      const ext = item.fileName.replace(/\.[^.]+$/, '');
      zip.file(`${ext}_watermarked.png`, base64Data, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `watermark-batch-${Date.now()}.zip`);
    toast.success(t('miniTools.zipDownloaded'));
  }, [items, t]);

  const handleCopyPreview = useCallback(async () => {
    const src = previewItem?.resultBase64 || previewItem?.sourceUrl;
    if (!src) return;
    const result = await copyImageAsPng(src);
    if (result.success) toast.success(t('miniTools.copied'));
    else toast.error(result.error || t('miniTools.copyFailed'));
  }, [previewItem, t]);

  /* ------------------------------------------------------------------ */
  /*  Panel content                                                      */
  /* ------------------------------------------------------------------ */

  const panelContent = hasItems ? (
    <div className="space-y-5">
      {/* Add more */}
      <Dropzone
        onFiles={handleFiles}
        accept="image/jpeg,image/png,image/webp"
        multiple
        label={t('miniTools.addImages')}
        size="sm"
        dropTarget={false}
      />

      {/* Thumbnail queue */}
      <div className="max-h-[32vh] overflow-y-auto space-y-1.5 pr-1">
        {items.map((item) => (
          <motion.div
            key={item.id}
            onClick={() => setPreviewId(item.id)}
            {...fade}
            layout
            className={cn(
              'group flex items-center gap-2 p-1.5 rounded-xl cursor-pointer transition-colors duration-200',
              previewItem?.id === item.id ? 'bg-muted ring-1 ring-border' : 'hover:bg-muted/60'
            )}
          >
            <Thumb
              src={item.resultBase64 || item.sourceUrl}
              alt=""
              className="w-10 h-10 rounded object-cover bg-muted flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-2xs font-mono text-foreground truncate">{item.fileName}</p>
              <StatusBadge status={item.status} />
            </div>
            <button
              type="button"
              aria-label={t('miniTools.remove')}
              onClick={(e) => {
                e.stopPropagation();
                removeItem(item.id);
              }}
              className={cn(
                hoverReveal,
                'text-muted-foreground hover:text-foreground flex-shrink-0'
              )}
            >
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="h-px bg-border" />

      {/* Controls */}
      <div className="space-y-4">
        <BrandToolSelect value={brandId} onChange={setBrandId} />

        {/* Type toggle */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t('miniTools.watermark.type')}
          </span>
          <SegmentedControl
            aria-label={t('miniTools.watermark.type')}
            size="sm"
            value={watermarkType}
            onChange={setWatermarkType}
            disabled={isProcessing}
            options={[
              { value: 'text', label: t('miniTools.watermark.text'), icon: Type },
              { value: 'logo', label: t('miniTools.watermark.logo'), icon: Image },
            ]}
          />
        </div>

        {/* Text input + color OR logo upload */}
        {watermarkType === 'text' ? (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t('miniTools.watermark.text')}
            </span>
            <div className="flex items-center gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isProcessing}
                placeholder={t('miniTools.watermark.textPlaceholder')}
                className="h-7 text-xs flex-1"
              />
              <label className="relative flex-shrink-0">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={isProcessing}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <div
                  className="w-7 h-7 rounded border border-border cursor-pointer"
                  style={{ backgroundColor: color }}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t('miniTools.watermark.logo')}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={isProcessing}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded border text-xs transition-colors duration-200',
                  logoUrl
                    ? 'border-border bg-muted text-foreground'
                    : 'border-dashed border-border bg-muted/40 text-muted-foreground hover:border-ring hover:text-foreground'
                )}
              >
                <Upload size={10} />
                {logoUrl
                  ? t('miniTools.watermark.changeLogo')
                  : t('miniTools.watermark.uploadLogo')}
              </button>
              {logoUrl && (
                <Thumb
                  src={logoUrl}
                  alt={t('miniTools.watermark.logo')}
                  className="w-7 h-7 rounded object-contain bg-muted border border-border"
                />
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>
        )}

        {/* Position grid */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t('miniTools.watermark.position')}
          </span>
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-1 w-fit">
              {POSITION_GRID.flat().map((pos) => (
                <button
                  key={pos}
                  type="button"
                  aria-label={t(`miniTools.watermark.positions.${pos}`)}
                  aria-pressed={position === pos}
                  onClick={() => setPosition(pos)}
                  disabled={isProcessing}
                  className={cn(
                    'w-5 h-5 rounded-md border transition-colors duration-200 flex items-center justify-center',
                    position === pos
                      ? 'bg-foreground border-foreground'
                      : 'bg-muted/40 border-border hover:border-ring'
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      position === pos ? 'bg-background' : 'bg-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setPosition('tile');
                if (rotation === 0) setRotation(-45);
              }}
              disabled={isProcessing}
              aria-pressed={position === 'tile'}
              className={cn(
                'w-full rounded border px-2 py-0.5 text-xs transition-colors duration-200',
                position === 'tile'
                  ? 'border-ring bg-muted text-foreground'
                  : 'border-border bg-muted/40 text-muted-foreground hover:border-ring hover:text-foreground'
              )}
            >
              {t('miniTools.watermark.tile')}
            </button>
          </div>
        </div>

        {/* Opacity slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('miniTools.watermark.opacity')}
            </span>
            <span className="text-2xs font-mono text-muted-foreground tabular-nums">
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            disabled={isProcessing}
            className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-brand-cyan"
          />
        </div>

        {/* Size slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('miniTools.watermark.size')}
            </span>
            <span className="text-2xs font-mono text-muted-foreground tabular-nums">{scale}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="1"
            value={scale}
            onChange={(e) => setScale(parseInt(e.target.value))}
            disabled={isProcessing}
            className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-brand-cyan"
          />
        </div>

        {/* Rotation slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('miniTools.watermark.rotation')}
            </span>
            <span className="text-2xs font-mono text-muted-foreground tabular-nums">
              {rotation}°
            </span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={rotation}
            onChange={(e) => setRotation(parseInt(e.target.value))}
            disabled={isProcessing}
            className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-brand-cyan"
          />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Actions */}
      <div className="space-y-2">
        <AnimatePresence>
          {queuedOrErrorCount > 0 && (
            <motion.div {...fadeScale}>
              <Button
                onClick={handleProcessAll}
                disabled={isProcessing}
                variant="primary"
                size="sm"
                className="w-full text-xs"
              >
                {isProcessing ? (
                  <GlitchLoader size={14} color="currentColor" />
                ) : (
                  <Stamp size={14} />
                )}
                <span className="ml-2">
                  {isProcessing
                    ? t('common.processing')
                    : queuedOrErrorCount > 1
                      ? t('miniTools.watermark.runCount', { count: queuedOrErrorCount })
                      : t('miniTools.watermark.run')}
                </span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {doneCount > 0 && !isProcessing && (
            <motion.div {...fadeScale}>
              <QuickActions
                toolId="watermark"
                outputMime="image/png"
                summary={t('miniTools.watermark.done', { count: doneCount })}
                onDownloadAll={handleDownloadAll}
                onCopy={handleCopyPreview}
                assetData={
                  previewItem?.resultBase64
                    ? {
                        imageBase64: previewItem.resultBase64,
                        mimeType: 'image/png',
                        label: previewItem.fileName,
                      }
                    : undefined
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  ) : undefined;

  const statusBarContent = hasItems ? (
    <div className="flex items-center gap-3 text-2xs tabular-nums text-muted-foreground">
      <span>
        {doneCount}/{items.length}
      </span>
    </div>
  ) : undefined;

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <MiniAppShell
      icon={Stamp}
      title={t('apps.watermark.name')}
      toolId="watermark"
      documentTitle={t('apps.watermark.name')}
      onReset={hasItems ? reset : undefined}
      panel={panelContent}
      panelLabel={t('miniTools.panelLabel')}
      statusBar={statusBarContent}
      dragDrop={{
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        isDragOver,
      }}
    >
      <AnimatePresence mode="wait">
        {!hasItems ? (
          <motion.div key="upload" {...fade} className="flex w-full justify-center py-8">
            <Dropzone
              onFiles={handleFiles}
              accept="image/jpeg,image/png,image/webp"
              multiple
              label={t('miniTools.dropImages')}
              dropTarget={false}
              className="max-w-md"
            />
          </motion.div>
        ) : (
          /* Working state — preview centered in canvas */
          <motion.div
            key="workspace"
            {...fadeScale}
            className={cn(
              'relative w-full max-w-3xl rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center',
              glassSurface.surface
            )}
          >
            {previewItem ? (
              <>
                <img
                  src={previewItem.resultBase64 || previewItem.sourceUrl}
                  alt={previewItem.fileName}
                  className="w-full h-auto max-h-[72vh] object-contain"
                />
                <AnimatePresence>
                  {isProcessing && (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center bg-background/80"
                      {...fade}
                    >
                      <FlyingPaperLoader
                        progress={convertProgress}
                        label={`${convertProgress}% · ${doneCount}/${items.length}`}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </MiniAppShell>
  );
};
