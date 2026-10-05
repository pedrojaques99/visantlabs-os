import React, { useCallback, useEffect, useState } from 'react';
import { Upload, Copy, Image as ImageIcon, Check, Download } from '@/lib/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFaviconStore, FAVICON_SIZES, type GeneratedIcon } from '@/stores/faviconStore';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { loadImage } from '@/utils/imageUtils';
import { downloadBlob, copyToClipboard } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { encodePngsToIco } from '@/utils/icoEncoder';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QuickActions } from '@/components/shared/QuickActions';
import { BrandToolSelect } from '@/components/shared/BrandToolSelect';
import { useToolInput } from '@/hooks/useToolInput';
import { useBrandDefaults } from '@/hooks/useBrandDefaults';
import JSZip from 'jszip';
import { glassSurface } from '@/lib/ui/glass';
import { useTranslation } from '@/hooks/useTranslation';
import { Thumb } from '@/components/ui/Thumb';
import { fade, transitions } from '@/lib/ui/motion';

const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: transitions.base,
};

/** Transparency checkerboard from theme tokens (no raw hex). */
const checkerboard = (cell: number) =>
  `repeating-conic-gradient(var(--muted) 0% 25%, var(--card) 0% 50%) 0 0 / ${cell}px ${cell}px`;

const SIZE_LABELS: Record<number, string> = {
  16: 'favicon',
  32: 'favicon 2x',
  48: 'Windows tile',
  64: 'Windows tile 2x',
  128: 'Chrome Web Store',
  180: 'apple-touch-icon',
  192: 'Android Chrome',
  512: 'PWA / maskable',
};

async function generateIcons(
  sourceUrl: string,
  backgroundColor: string,
  borderRadius: number,
  padding: number
): Promise<GeneratedIcon[]> {
  const img = await loadImage(sourceUrl, null);
  const results: GeneratedIcon[] = [];

  for (const size of FAVICON_SIZES) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Background with optional border radius
    if (backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      if (borderRadius > 0) {
        const r = ((borderRadius / 100) * size) / 2;
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, r);
        ctx.fill();
        ctx.clip();
      } else {
        ctx.fillRect(0, 0, size, size);
      }
    } else if (borderRadius > 0) {
      // Clip even for transparent bg
      const r = ((borderRadius / 100) * size) / 2;
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, r);
      ctx.clip();
    }

    // Draw image with padding
    const pad = (padding / 100) * size;
    const drawSize = size - pad * 2;
    const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - srcSize) / 2;
    const sy = (img.naturalHeight - srcSize) / 2;
    ctx.drawImage(img, sx, sy, srcSize, srcSize, pad, pad, drawSize, drawSize);

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png')
    );
    results.push({ size, blob, url: URL.createObjectURL(blob) });
  }

  return results;
}

function buildHtmlSnippet(): string {
  return `<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />`;
}

function buildManifestSnippet(): string {
  return JSON.stringify(
    {
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2
  );
}

export const FaviconPage: React.FC = () => {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const sourceUrl = useFaviconStore((s) => s.sourceUrl);
  const fileName = useFaviconStore((s) => s.fileName);
  const backgroundColor = useFaviconStore((s) => s.backgroundColor);
  const borderRadius = useFaviconStore((s) => s.borderRadius);
  const padding = useFaviconStore((s) => s.padding);
  const generatedIcons = useFaviconStore((s) => s.generatedIcons);
  const isGenerating = useFaviconStore((s) => s.isGenerating);
  const setSource = useFaviconStore((s) => s.setSource);
  const setBackgroundColor = useFaviconStore((s) => s.setBackgroundColor);
  const setBorderRadius = useFaviconStore((s) => s.setBorderRadius);
  const setPadding = useFaviconStore((s) => s.setPadding);
  const setGeneratedIcons = useFaviconStore((s) => s.setGeneratedIcons);
  const setIsGenerating = useFaviconStore((s) => s.setIsGenerating);
  const reset = useFaviconStore((s) => s.reset);

  const { pendingAsset, acceptAsset } = useToolInput('favicon');
  const { brandId, setBrandId, defaults: brandDefaults } = useBrandDefaults('favicon');

  /* --- Accept piped asset from another tool --- */
  useEffect(() => {
    if (!pendingAsset) return;
    const asset = acceptAsset();
    if (!asset) return;
    const url = asset.imageUrl || asset.imageBase64 || '';
    if (url) setSource(url, asset.label || 'pipeline-asset.png');
  }, [pendingAsset, acceptAsset, setSource]);

  /* --- Apply brand defaults when brand is selected --- */
  useEffect(() => {
    if (!brandDefaults) return;
    if (brandDefaults.logoUrl) {
      setSource(brandDefaults.logoUrl, 'brand-logo');
    }
  }, [brandDefaults, setSource]);

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file, 'image');
      if (error) {
        toast.error(error);
        return;
      }
      // Revoke previous URL
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSource(URL.createObjectURL(file), file.name);
    },
    [sourceUrl, setSource]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (e.target) e.target.value = '';
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleGenerate = useCallback(async () => {
    if (!sourceUrl || isGenerating) return;
    setIsGenerating(true);
    try {
      // Revoke previous icon URLs
      generatedIcons.forEach((icon) => {
        if (icon.url) URL.revokeObjectURL(icon.url);
      });
      const icons = await generateIcons(sourceUrl, backgroundColor, borderRadius, padding);
      setGeneratedIcons(icons);
      toast.success(t('miniTools.favicon.generated', { count: icons.length }));
    } catch (err: any) {
      console.error('Favicon generation failed:', err);
      toast.error(err?.message || t('miniTools.favicon.generateFailed'));
    } finally {
      setIsGenerating(false);
    }
  }, [
    sourceUrl,
    backgroundColor,
    borderRadius,
    padding,
    isGenerating,
    generatedIcons,
    setGeneratedIcons,
    setIsGenerating,
    t,
  ]);

  const handleDownloadZip = useCallback(async () => {
    if (!generatedIcons.length) return;
    const zip = new JSZip();

    for (const icon of generatedIcons) {
      if (!icon.blob) continue;
      const nameMap: Record<number, string> = {
        16: 'favicon-16x16.png',
        32: 'favicon-32x32.png',
        48: 'favicon-48x48.png',
        64: 'favicon-64x64.png',
        128: 'favicon-128x128.png',
        180: 'apple-touch-icon.png',
        192: 'android-chrome-192x192.png',
        512: 'android-chrome-512x512.png',
      };
      zip.file(nameMap[icon.size] || `icon-${icon.size}x${icon.size}.png`, icon.blob);
    }

    // Generate favicon.ico from 16 + 32
    const icoBlobs = generatedIcons
      .filter((i) => (i.size === 16 || i.size === 32) && i.blob)
      .map((i) => i.blob!);
    if (icoBlobs.length) {
      const ico = await encodePngsToIco(icoBlobs);
      zip.file('favicon.ico', ico);
    }

    // site.webmanifest
    zip.file('site.webmanifest', buildManifestSnippet());

    // html-snippet.txt
    zip.file('html-snippet.txt', buildHtmlSnippet());

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `favicon-pack-${Date.now()}.zip`);
    toast.success(t('miniTools.zipDownloaded'));
  }, [generatedIcons, t]);

  const handleCopySnippet = useCallback(
    async (key: string, text: string) => {
      const ok = await copyToClipboard(text);
      if (ok) {
        setCopiedSnippet(key);
        toast.success(t('miniTools.copied'));
        setTimeout(() => setCopiedSnippet(null), 2000);
      } else {
        toast.error(t('miniTools.copyFailed'));
      }
    },
    [t]
  );

  const handleReset = useCallback(() => {
    generatedIcons.forEach((icon) => {
      if (icon.url) URL.revokeObjectURL(icon.url);
    });
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    reset();
  }, [generatedIcons, sourceUrl, reset]);

  const isTransparentBg = backgroundColor === 'transparent';

  /* ── Panel: controls (only shown when source is loaded) ── */
  const panel = sourceUrl ? (
    <div className="space-y-5">
      <BrandToolSelect value={brandId} onChange={setBrandId} />

      {/* Background color */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t('miniTools.favicon.background')}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={isTransparentBg}
            onClick={() => setBackgroundColor(isTransparentBg ? '#ffffff' : 'transparent')}
            className={cn(
              'px-2 py-0.5 rounded text-xs transition-colors duration-200 border',
              isTransparentBg
                ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/40'
                : 'bg-muted/40 text-muted-foreground border-border hover:border-ring hover:text-foreground'
            )}
          >
            {t('miniTools.favicon.none')}
          </button>
          {!isTransparentBg && (
            <Input
              type="text"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="h-6 w-24 text-2xs font-mono"
              placeholder="#ffffff"
            />
          )}
          {!isTransparentBg && (
            <input
              type="color"
              value={backgroundColor.startsWith('#') ? backgroundColor : '#ffffff'}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-border bg-transparent"
            />
          )}
        </div>
      </div>

      {/* Border radius */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {t('miniTools.favicon.radius')}
          </span>
          <span className="text-2xs font-mono tabular-nums text-muted-foreground">
            {borderRadius}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={borderRadius}
          onChange={(e) => setBorderRadius(parseInt(e.target.value))}
          className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-brand-cyan"
        />
      </div>

      {/* Padding */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {t('miniTools.favicon.padding')}
          </span>
          <span className="text-2xs font-mono tabular-nums text-muted-foreground">{padding}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="20"
          step="1"
          value={padding}
          onChange={(e) => setPadding(parseInt(e.target.value))}
          className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-brand-cyan"
        />
      </div>

      <div className="h-px bg-border" />

      {/* Generate button in panel */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-foreground border border-brand-cyan/30 text-xs font-medium"
      >
        {isGenerating ? <GlitchLoader size={14} color="currentColor" /> : <ImageIcon size={14} />}
        <span className="ml-2">
          {isGenerating ? t('miniTools.favicon.generating') : t('miniTools.favicon.generate')}
        </span>
      </Button>
    </div>
  ) : undefined;

  /* ── Status bar: Generate + Download actions ── */
  const statusBar = sourceUrl ? (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        {isGenerating ? t('miniTools.favicon.generating') : t('miniTools.favicon.generate')}
      </button>
      {generatedIcons.length > 0 && (
        <>
          <span>·</span>
          <button
            type="button"
            onClick={handleDownloadZip}
            className="hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {t('miniTools.favicon.downloadZip')}
          </button>
        </>
      )}
    </div>
  ) : undefined;

  return (
    <MiniAppShell
      icon={ImageIcon}
      title={t('apps.faviconGenerator.name')}
      toolId="favicon"
      documentTitle={t('apps.faviconGenerator.name')}
      onReset={sourceUrl ? handleReset : undefined}
      panel={panel}
      panelLabel={t('miniTools.settings')}
      statusBar={statusBar}
      centerContent={!sourceUrl}
      dragDrop={{
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        isDragOver,
      }}
    >
      <AnimatePresence mode="wait">
        {/* Empty state — centered landing */}
        {!sourceUrl ? (
          <motion.div key="empty" {...fade} className="flex w-full justify-center py-8">
            <label className="flex h-48 w-full max-w-md cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 text-center text-sm text-muted-foreground transition-colors duration-200 hover:border-ring hover:text-foreground">
              <Upload size={20} />
              {t('miniTools.dropImage')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleInputChange}
              />
            </label>
          </motion.div>
        ) : (
          /* Working state — centered max-width scrollable column */
          <div className="max-w-3xl mx-auto w-full py-8 px-4">
            <motion.div key="workspace" {...fade} className="space-y-6">
              {/* Source preview */}
              <div className="flex items-center gap-3">
                <div
                  className="w-20 h-20 rounded-2xl border border-border overflow-hidden flex items-center justify-center flex-shrink-0"
                  style={{ background: checkerboard(10) }}
                >
                  <Thumb src={sourceUrl} alt={fileName} className="w-full h-full object-contain" />
                </div>
                <span className="text-2xs font-mono text-muted-foreground truncate max-w-[200px]">
                  {fileName}
                </span>
              </div>

              {/* Generation animation */}
              <AnimatePresence>
                {isGenerating && (
                  <motion.div {...fade} className="py-6">
                    <FlyingPaperLoader label={t('miniTools.favicon.generating')} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Generated icons grid */}
              <AnimatePresence>
                {generatedIcons.length > 0 && (
                  <motion.div {...fadeScale} className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {generatedIcons.map((icon) => (
                        <div
                          key={icon.size}
                          className={cn(
                            'flex flex-col items-center gap-1.5 p-3 rounded-2xl',
                            glassSurface.surface
                          )}
                        >
                          <div
                            className="w-16 h-16 rounded flex items-center justify-center overflow-hidden"
                            style={{ background: checkerboard(8) }}
                          >
                            <img
                              src={icon.url}
                              alt={`${icon.size}x${icon.size}`}
                              className="max-w-full max-h-full object-contain"
                              style={{
                                imageRendering: icon.size <= 32 ? 'pixelated' : 'auto',
                              }}
                            />
                          </div>
                          <span className="text-2xs font-mono text-foreground">
                            {icon.size}x{icon.size}
                          </span>
                          <span className="text-2xs text-muted-foreground">
                            {SIZE_LABELS[icon.size] || ''}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Code snippets */}
                    <div className="space-y-3">
                      <h2 className="text-xs font-medium text-muted-foreground">
                        {t('miniTools.favicon.htmlTags')}
                      </h2>
                      <div className="relative">
                        <pre
                          className={cn(
                            'p-3 rounded-2xl text-2xs font-mono text-muted-foreground overflow-x-auto whitespace-pre',
                            glassSurface.surface
                          )}
                        >
                          {buildHtmlSnippet()}
                        </pre>
                        <button
                          type="button"
                          onClick={() => handleCopySnippet('html', buildHtmlSnippet())}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                          title={t('miniTools.copy')}
                          aria-label={t('miniTools.copy')}
                        >
                          {copiedSnippet === 'html' ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>

                      <h2 className="text-xs font-medium text-muted-foreground">
                        {t('miniTools.favicon.webManifest')}
                      </h2>
                      <div className="relative">
                        <pre
                          className={cn(
                            'p-3 rounded-2xl text-2xs font-mono text-muted-foreground overflow-x-auto whitespace-pre',
                            glassSurface.surface
                          )}
                        >
                          {buildManifestSnippet()}
                        </pre>
                        <button
                          type="button"
                          onClick={() => handleCopySnippet('manifest', buildManifestSnippet())}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                          title={t('miniTools.copy')}
                          aria-label={t('miniTools.copy')}
                        >
                          {copiedSnippet === 'manifest' ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    {/* Quick Actions — download, copy, send to other tools */}
                    <QuickActions
                      toolId="favicon"
                      outputMime="image/png"
                      summary={t('miniTools.favicon.generated', { count: generatedIcons.length })}
                      onDownloadAll={handleDownloadZip}
                      assetData={
                        generatedIcons.find((i) => i.size === 512)?.url
                          ? {
                              imageUrl: generatedIcons.find((i) => i.size === 512)!.url,
                              mimeType: 'image/png',
                              label: 'favicon-512x512.png',
                            }
                          : undefined
                      }
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MiniAppShell>
  );
};
