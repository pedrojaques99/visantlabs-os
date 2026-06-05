import React, { useCallback, useRef, useState } from 'react';
import { Stamp, Upload, Download, Copy, X, Type, Image } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  useWatermarkStore,
  type WatermarkItem,
  type WatermarkPosition,
} from '@/stores/watermarkStore';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { loadImage, downloadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import JSZip from 'jszip';

/* ------------------------------------------------------------------ */
/*  Animation presets                                                  */
/* ------------------------------------------------------------------ */

const ease = [0.4, 0, 0.2, 1] as const;
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.35, ease } };
const fadeScale = { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 }, transition: { duration: 0.3, ease } };

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
  const inputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

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

  const hasItems = items.length > 0;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const queuedOrErrorCount = items.filter(
    (i) => i.status === 'queued' || i.status === 'error'
  ).length;
  const previewItem =
    items.find((i) => i.id === previewId) || items.find((i) => i.status === 'done') || items[0];

  /* --- File handling --- */

  const handleFiles = useCallback(
    (fileList: FileList) => {
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

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
      if (e.target) e.target.value = '';
    },
    [handleFiles]
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
      toast.info('Nothing to process');
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
      toast.error('Upload a logo image first');
      return;
    }

    setIsProcessing(true);
    let done = 0;
    for (const item of toProcess) {
      updateItem(item.id, { status: 'processing' });
      try {
        const result = await applyWatermark(item, settings);
        updateItem(item.id, { status: 'done', resultBase64: result });
        done++;
      } catch (err: any) {
        console.error(`Watermark failed for ${item.fileName}:`, err);
        updateItem(item.id, { status: 'error', error: err?.message || 'Failed' });
      }
    }
    setIsProcessing(false);
    if (done > 0) toast.success(`${done} image${done > 1 ? 's' : ''} watermarked`);
  }, [
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
    toast.success('ZIP downloaded');
  }, [items]);

  const handleCopyPreview = useCallback(async () => {
    const src = previewItem?.resultBase64 || previewItem?.sourceUrl;
    if (!src) return;
    const result = await copyImageAsPng(src);
    if (result.success) toast.success('Copied to clipboard');
    else toast.error(result.error || 'Copy failed');
  }, [previewItem]);

  /* --- Render --- */

  return (
    <MiniToolShell
      icon={Stamp}
      title="Watermark"
      countLabel={hasItems ? `${doneCount}/${items.length}` : undefined}
      onReset={reset}
      showReset={hasItems}
      centered={!hasItems}
      dragDrop={{
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        isDragOver,
      }}
    >
      <AnimatePresence mode="wait">
        {!hasItems ? (
          /* ---------- Empty / upload state ---------- */
          <motion.div
            key="empty"
            {...fadeUp}
            className="flex flex-col items-center justify-center gap-5 py-8"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease }}
              className="flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-900/60 border border-neutral-800"
            >
              <Stamp size={28} className="text-neutral-500" />
            </motion.div>

            <div className="text-center space-y-1.5">
              <h2 className="text-sm font-medium text-neutral-200">Add watermarks to images</h2>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                Text or logo watermark with position control — batch supported
              </p>
            </div>

            <motion.label
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex flex-col items-center justify-center gap-3 w-full max-w-md h-48 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200',
                isDragOver
                  ? 'border-brand-cyan bg-brand-cyan/5'
                  : 'border-neutral-800 hover:border-neutral-600 bg-neutral-950/40'
              )}
            >
              <Upload size={24} className="text-neutral-500" />
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                Drop images or click
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
            </motion.label>
          </motion.div>
        ) : (
          /* ---------- Working state ---------- */
          <motion.div key="workspace" {...fadeScale} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
              {/* Preview */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease }}
                className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950/40 min-h-[300px] flex items-center justify-center"
              >
                {previewItem ? (
                  <>
                    <img
                      src={previewItem.resultBase64 || previewItem.sourceUrl}
                      alt={previewItem.fileName}
                      className="w-full h-auto max-h-[60vh] object-contain"
                    />
                    <AnimatePresence>
                      {previewItem.status === 'processing' && (
                        <motion.div
                          key="processing-overlay"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease }}
                          className="absolute inset-0 flex items-center justify-center bg-neutral-950/60 backdrop-blur-sm"
                        >
                          <GlitchLoader size={20} color="brand-cyan" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {previewItem.status === 'done' && (
                        <motion.span
                          key="done-badge"
                          {...fadeScale}
                          className="absolute top-2 right-2 text-[10px] font-mono uppercase tracking-wider bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded"
                        >
                          WM
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </>
                ) : null}
              </motion.div>

              {/* Queue panel */}
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease }}
                className="space-y-3"
              >
                {/* Add more */}
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900/30 text-neutral-500 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-all duration-200">
                  <Upload size={12} />
                  Add images
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleInputChange}
                  />
                </label>

                {/* Thumbnail queue */}
                <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pr-1">
                  {items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease, delay: i * 0.03 }}
                      onClick={() => setPreviewId(item.id)}
                      className={cn(
                        'flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all duration-200 group',
                        previewItem?.id === item.id
                          ? 'bg-neutral-800/60 ring-1 ring-brand-cyan/30'
                          : 'hover:bg-neutral-900/60'
                      )}
                    >
                      <img
                        src={item.resultBase64 || item.sourceUrl}
                        alt=""
                        className="w-10 h-10 rounded object-cover bg-neutral-900 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono text-neutral-300 truncate">
                          {item.fileName}
                        </p>
                        <StatusBadge status={item.status} />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-300 transition-all duration-200 flex-shrink-0"
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Controls */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1, ease }}
              className="space-y-4"
            >
              {/* Type toggle + text/logo input */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Type</span>
                  <div className="flex gap-1">
                    {(['text', 'logo'] as const).map((t) => (
                      <motion.button
                        key={t}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setWatermarkType(t)}
                        disabled={isProcessing}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono transition-all duration-200',
                          watermarkType === t
                            ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'
                            : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-600'
                        )}
                      >
                        {t === 'text' ? <Type size={10} /> : <Image size={10} />}
                        {t === 'text' ? 'Text' : 'Logo'}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {watermarkType === 'text' ? (
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      disabled={isProcessing}
                      placeholder="Watermark text"
                      className="h-7 text-xs font-mono bg-neutral-900 border-neutral-800 flex-1"
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
                        className="w-7 h-7 rounded border border-neutral-700 cursor-pointer"
                        style={{ backgroundColor: color }}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isProcessing}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all duration-200',
                        logoUrl
                          ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                          : 'bg-neutral-900 text-neutral-500 border border-dashed border-neutral-700 hover:border-neutral-500'
                      )}
                    >
                      <Upload size={10} />
                      {logoUrl ? 'Change logo' : 'Upload logo'}
                    </button>
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt="logo"
                        className="w-7 h-7 rounded object-contain bg-neutral-900 border border-neutral-800"
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
                )}
              </div>

              {/* Position grid */}
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase mt-1">Pos</span>
                  <div className="space-y-1">
                    <div className="grid grid-cols-3 gap-1">
                      {POSITION_GRID.flat().map((pos) => (
                        <motion.button
                          key={pos}
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setPosition(pos)}
                          disabled={isProcessing}
                          className={cn(
                            'w-5 h-5 rounded-sm transition-all duration-200 flex items-center justify-center',
                            position === pos
                              ? 'bg-brand-cyan border border-brand-cyan'
                              : 'bg-neutral-900 border border-neutral-800 hover:border-neutral-600'
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              position === pos ? 'bg-neutral-950' : 'bg-neutral-600'
                            )}
                          />
                        </motion.button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setPosition('tile');
                        if (rotation === 0) setRotation(-45);
                      }}
                      disabled={isProcessing}
                      className={cn(
                        'w-full px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-all duration-200',
                        position === 'tile'
                          ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'
                          : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-600'
                      )}
                    >
                      Tile
                    </button>
                  </div>
                </div>

                {/* Sliders */}
                <div className="flex-1 space-y-2 min-w-[200px]">
                  {/* Opacity */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase w-12">
                      Opacity
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      disabled={isProcessing}
                      className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                    />
                    <span className="text-[10px] font-mono text-neutral-500 w-8 text-right tabular-nums">
                      {Math.round(opacity * 100)}%
                    </span>
                  </div>
                  {/* Size */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase w-12">Size</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="1"
                      value={scale}
                      onChange={(e) => setScale(parseInt(e.target.value))}
                      disabled={isProcessing}
                      className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                    />
                    <span className="text-[10px] font-mono text-neutral-500 w-8 text-right tabular-nums">
                      {scale}%
                    </span>
                  </div>
                  {/* Rotation */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase w-12">
                      Rotate
                    </span>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={rotation}
                      onChange={(e) => setRotation(parseInt(e.target.value))}
                      disabled={isProcessing}
                      className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                    />
                    <span className="text-[10px] font-mono text-neutral-500 w-8 text-right tabular-nums">
                      {rotation}deg
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <AnimatePresence>
                  {queuedOrErrorCount > 0 && (
                    <motion.div key="apply-btn" {...fadeScale} className="flex-1">
                      <Button
                        onClick={handleProcessAll}
                        disabled={isProcessing}
                        className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                      >
                        {isProcessing ? (
                          <GlitchLoader size={14} color="currentColor" />
                        ) : (
                          <Stamp size={14} />
                        )}
                        <span className="ml-2">
                          {isProcessing
                            ? 'Processing...'
                            : `Apply${queuedOrErrorCount > 1 ? ` ${queuedOrErrorCount} images` : ' All'}`}
                        </span>
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {doneCount > 0 && (
                    <>
                      <motion.div key="download-btn" {...fadeScale}>
                        <Button
                          onClick={handleDownloadAll}
                          className="bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                        >
                          <Download size={14} />
                          <span className="ml-2 tabular-nums">
                            {doneCount > 1 ? `Download ZIP (${doneCount})` : 'Download'}
                          </span>
                        </Button>
                      </motion.div>
                      <motion.div key="copy-btn" {...fadeScale}>
                        <Button
                          onClick={handleCopyPreview}
                          variant="outline"
                          className="font-mono text-xs uppercase tracking-widest border-neutral-700"
                          title="Copy current preview"
                        >
                          <Copy size={14} />
                        </Button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniToolShell>
  );
};
