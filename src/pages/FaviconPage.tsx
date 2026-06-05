import React, { useCallback, useRef, useState } from 'react';
import { Upload, Download, Copy, Image as ImageIcon, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFaviconStore, FAVICON_SIZES, type GeneratedIcon } from '@/stores/faviconStore';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { loadImage } from '@/utils/imageUtils';
import { downloadBlob, copyToClipboard } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { encodePngsToIco } from '@/utils/icoEncoder';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import JSZip from 'jszip';

const ease = [0.4, 0, 0.2, 1] as const;
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.35, ease } };
const fadeScale = { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 }, transition: { duration: 0.3, ease } };

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
  const inputRef = useRef<HTMLInputElement>(null);
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
      toast.success(`${icons.length} icons generated`);
    } catch (err: any) {
      console.error('Favicon generation failed:', err);
      toast.error(err?.message || 'Generation failed');
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
    toast.success('ZIP downloaded');
  }, [generatedIcons]);

  const handleCopySnippet = useCallback(async (key: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedSnippet(key);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedSnippet(null), 2000);
    } else {
      toast.error('Copy failed');
    }
  }, []);

  const handleReset = useCallback(() => {
    generatedIcons.forEach((icon) => {
      if (icon.url) URL.revokeObjectURL(icon.url);
    });
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    reset();
  }, [generatedIcons, sourceUrl, reset]);

  const isTransparentBg = backgroundColor === 'transparent';

  return (
    <MiniToolShell
      icon={ImageIcon}
      title="Favicon Generator"
      onReset={handleReset}
      showReset={!!sourceUrl}
      centered={!sourceUrl}
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
          <motion.div
            key="empty"
            {...fadeUp}
            className="flex flex-col items-center justify-center gap-5 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <ImageIcon size={28} className="text-neutral-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-sm font-medium text-neutral-200">
                Generate favicons for every platform
              </h2>
              <p className="text-xs text-neutral-500">
                ICO, Apple Touch, Android Chrome, PWA — all sizes
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
                Drop image or click to upload
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleInputChange}
              />
            </motion.label>
          </motion.div>
        ) : (
          /* Working state */
          <motion.div key="workspace" {...fadeScale} className="space-y-6">
            {/* Source preview + controls */}
            <motion.div {...fadeUp} className="flex flex-wrap items-start gap-4">
              {/* Source preview */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-20 h-20 rounded-2xl border border-neutral-800 overflow-hidden flex items-center justify-center duration-200"
                  style={{
                    background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 10px 10px',
                  }}
                >
                  <img src={sourceUrl} alt={fileName} className="w-full h-full object-contain" />
                </div>
                <span className="text-[10px] font-mono text-neutral-500 truncate max-w-[80px]">
                  {fileName}
                </span>
              </div>

              {/* Controls */}
              <div className="flex-1 min-w-[240px] space-y-3">
                {/* Background color */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase w-16 flex-shrink-0">
                    BG Color
                  </span>
                  <button
                    onClick={() => setBackgroundColor(isTransparentBg ? '#ffffff' : 'transparent')}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-mono transition-all duration-200 border',
                      isTransparentBg
                        ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40'
                        : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:border-neutral-600'
                    )}
                  >
                    None
                  </button>
                  {!isTransparentBg && (
                    <Input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="h-6 w-24 text-[10px] font-mono bg-neutral-900 border-neutral-800"
                      placeholder="#ffffff"
                    />
                  )}
                  {!isTransparentBg && (
                    <input
                      type="color"
                      value={backgroundColor.startsWith('#') ? backgroundColor : '#ffffff'}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border border-neutral-700 bg-transparent"
                    />
                  )}
                </div>

                {/* Border radius */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase w-16 flex-shrink-0">
                    Radius
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(parseInt(e.target.value))}
                    className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                  />
                  <span className="text-[10px] font-mono text-neutral-500 w-8 text-right">
                    {borderRadius}%
                  </span>
                </div>

                {/* Padding */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase w-16 flex-shrink-0">
                    Padding
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={padding}
                    onChange={(e) => setPadding(parseInt(e.target.value))}
                    className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                  />
                  <span className="text-[10px] font-mono text-neutral-500 w-8 text-right">
                    {padding}%
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Generate button */}
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }}>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                asChild
              >
                <motion.button whileTap={{ scale: 0.98 }} disabled={isGenerating}>
                  {isGenerating ? (
                    <GlitchLoader size={14} color="currentColor" />
                  ) : (
                    <ImageIcon size={14} />
                  )}
                  <span className="ml-2">{isGenerating ? 'Generating...' : 'Generate Icons'}</span>
                </motion.button>
              </Button>
            </motion.div>

            {/* Generation animation */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="py-6"
                >
                  <FlyingPaperLoader label="Generating icons..." />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generated icons grid */}
            <AnimatePresence>
              {generatedIcons.length > 0 && (
                <motion.div {...fadeScale} className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {generatedIcons.map((icon, i) => (
                      <motion.div
                        key={icon.size}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease, delay: i * 0.05 }}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-neutral-800 bg-neutral-950/40 duration-200"
                      >
                        <div
                          className="w-16 h-16 rounded flex items-center justify-center overflow-hidden"
                          style={{
                            background:
                              'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 8px 8px',
                          }}
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
                        <span className="text-[10px] font-mono text-neutral-300">
                          {icon.size}x{icon.size}
                        </span>
                        <span className="text-[9px] font-mono text-neutral-600 uppercase">
                          {SIZE_LABELS[icon.size] || ''}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Code snippets */}
                  <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }} className="space-y-3">
                    <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                      HTML Tags
                    </h2>
                    <div className="relative">
                      <pre className="p-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 text-[10px] font-mono text-neutral-400 overflow-x-auto whitespace-pre duration-200">
                        {buildHtmlSnippet()}
                      </pre>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCopySnippet('html', buildHtmlSnippet())}
                        className="absolute top-2 right-2 text-neutral-600 hover:text-neutral-300 transition-colors duration-200"
                        title="Copy"
                      >
                        {copiedSnippet === 'html' ? <Check size={12} /> : <Copy size={12} />}
                      </motion.button>
                    </div>

                    <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                      Web Manifest
                    </h2>
                    <div className="relative">
                      <pre className="p-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 text-[10px] font-mono text-neutral-400 overflow-x-auto whitespace-pre duration-200">
                        {buildManifestSnippet()}
                      </pre>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCopySnippet('manifest', buildManifestSnippet())}
                        className="absolute top-2 right-2 text-neutral-600 hover:text-neutral-300 transition-colors duration-200"
                        title="Copy"
                      >
                        {copiedSnippet === 'manifest' ? <Check size={12} /> : <Copy size={12} />}
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Download ZIP */}
                  <Button
                    onClick={handleDownloadZip}
                    className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                    asChild
                  >
                    <motion.button whileTap={{ scale: 0.98 }}>
                      <Download size={14} />
                      <span className="ml-2">Download ZIP</span>
                    </motion.button>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniToolShell>
  );
};
