import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Code, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOgImageStore, type OgTemplate } from '@/stores/ogImageStore';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { BrandToolSelect } from '@/components/shared/BrandToolSelect';
import { QuickActions } from '@/components/shared/QuickActions';
import { useBrandDefaults } from '@/hooks/useBrandDefaults';
import { useToolInput } from '@/hooks/useToolInput';
import { loadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob, copyToClipboard } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const ease = [0.4, 0, 0.2, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease },
};
const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.3, ease },
};

/* ------------------------------------------------------------------ */
/*  Canvas rendering                                                   */
/* ------------------------------------------------------------------ */

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  let lineCount = 0;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, lineY);
      line = word + ' ';
      lineY += lineHeight;
      lineCount++;
      if (lineCount >= 2) {
        ctx.fillText(line.trim() + '...', x, lineY);
        return;
      }
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, lineY);
}

async function renderOgImage(state: ReturnType<typeof useOgImageStore.getState>): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = OG_WIDTH;
  canvas.height = OG_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Background
  if (state.template === 'photo' && state.backgroundImageUrl) {
    const bg = await loadImage(state.backgroundImageUrl);
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (state.template === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, state.backgroundColor);
    grad.addColorStop(1, state.accentColor + '40');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (state.template === 'split') {
    ctx.fillStyle = state.accentColor + '20';
    ctx.fillRect(0, 0, canvas.width / 2, canvas.height);
    ctx.fillStyle = state.backgroundColor;
    ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);
  } else {
    ctx.fillStyle = state.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Accent bar
  ctx.fillStyle = state.accentColor;
  ctx.fillRect(60, canvas.height - 80, 80, 4);

  // Title
  ctx.fillStyle = state.textColor;
  ctx.font = 'bold 56px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'top';
  wrapText(ctx, state.title || 'Your title here', 60, 180, canvas.width - 120, 68);

  // Subtitle
  if (state.subtitle) {
    ctx.font = '28px Inter, system-ui, sans-serif';
    ctx.fillStyle = state.textColor + 'aa';
    ctx.fillText(state.subtitle, 60, 340, canvas.width - 120);
  }

  // Author
  if (state.authorName) {
    ctx.font = '22px Inter, system-ui, sans-serif';
    ctx.fillStyle = state.textColor + '88';
    ctx.fillText(state.authorName, 60, canvas.height - 60);
  }

  // Logo
  if (state.logoUrl) {
    try {
      const logo = await loadImage(state.logoUrl);
      const logoSize = 48;
      ctx.drawImage(logo, canvas.width - logoSize - 60, 50, logoSize, logoSize);
    } catch {
      // skip logo if loading fails
    }
  }

  return canvas.toDataURL('image/png');
}

/* ------------------------------------------------------------------ */
/*  Template thumbnails                                                */
/* ------------------------------------------------------------------ */

const TEMPLATES: { id: OgTemplate; label: string }[] = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'photo', label: 'Photo' },
  { id: 'split', label: 'Split' },
];

function TemplateThumbnail({ id, active }: { id: OgTemplate; active: boolean }) {
  const w = 72;
  const h = 38;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="rounded">
      {id === 'minimal' && (
        <>
          <rect width={w} height={h} fill="#0a0a0a" />
          <rect x={6} y={h - 8} width={10} height={2} fill="#00e5ff" />
          <rect x={6} y={14} width={40} height={4} rx={1} fill="#fff" opacity={0.8} />
          <rect x={6} y={21} width={28} height={3} rx={1} fill="#fff" opacity={0.4} />
        </>
      )}
      {id === 'gradient' && (
        <>
          <defs>
            <linearGradient id="gt" x1="0" y1="0" x2={w} y2={h} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0a0a0a" />
              <stop offset="100%" stopColor="#00e5ff" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill="url(#gt)" />
          <rect x={6} y={h - 8} width={10} height={2} fill="#00e5ff" />
          <rect x={6} y={14} width={40} height={4} rx={1} fill="#fff" opacity={0.8} />
        </>
      )}
      {id === 'photo' && (
        <>
          <rect width={w} height={h} fill="#333" />
          <rect width={w} height={h} fill="#000" opacity={0.5} />
          <rect x={6} y={h - 8} width={10} height={2} fill="#00e5ff" />
          <rect x={6} y={14} width={40} height={4} rx={1} fill="#fff" opacity={0.8} />
        </>
      )}
      {id === 'split' && (
        <>
          <rect width={w / 2} height={h} fill="#00e5ff" opacity={0.12} />
          <rect x={w / 2} width={w / 2} height={h} fill="#0a0a0a" />
          <rect x={6} y={h - 8} width={10} height={2} fill="#00e5ff" />
          <rect x={6} y={14} width={40} height={4} rx={1} fill="#fff" opacity={0.8} />
        </>
      )}
      {active && <rect width={w} height={h} fill="none" stroke="#00e5ff" strokeWidth={2} rx={4} />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export const OgImagePage: React.FC = () => {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const template = useOgImageStore((s) => s.template);
  const title = useOgImageStore((s) => s.title);
  const subtitle = useOgImageStore((s) => s.subtitle);
  const authorName = useOgImageStore((s) => s.authorName);
  const logoUrl = useOgImageStore((s) => s.logoUrl);
  const backgroundImageUrl = useOgImageStore((s) => s.backgroundImageUrl);
  const backgroundColor = useOgImageStore((s) => s.backgroundColor);
  const accentColor = useOgImageStore((s) => s.accentColor);
  const textColor = useOgImageStore((s) => s.textColor);
  const width = OG_WIDTH;
  const height = OG_HEIGHT;

  const setTemplate = useOgImageStore((s) => s.setTemplate);
  const setTitle = useOgImageStore((s) => s.setTitle);
  const setSubtitle = useOgImageStore((s) => s.setSubtitle);
  const setAuthorName = useOgImageStore((s) => s.setAuthorName);
  const setLogoUrl = useOgImageStore((s) => s.setLogoUrl);
  const setBackgroundImageUrl = useOgImageStore((s) => s.setBackgroundImageUrl);
  const setBackgroundColor = useOgImageStore((s) => s.setBackgroundColor);
  const setAccentColor = useOgImageStore((s) => s.setAccentColor);
  const setTextColor = useOgImageStore((s) => s.setTextColor);
  const reset = useOgImageStore((s) => s.reset);

  const { brandId, setBrandId, defaults: brandDefaults } = useBrandDefaults('og-image');
  useToolInput('og-image');

  /* --- Apply brand defaults when brand is selected --- */
  useEffect(() => {
    if (!brandDefaults) return;
    if (brandDefaults.bgColor) setBackgroundColor(brandDefaults.bgColor);
    if (brandDefaults.textColor) setTextColor(brandDefaults.textColor);
    if (brandDefaults.logoUrl) setLogoUrl(brandDefaults.logoUrl);
  }, [brandDefaults, setBackgroundColor, setTextColor, setLogoUrl]);

  // Debounced re-render
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const state = useOgImageStore.getState();
      renderOgImage(state)
        .then(setPreviewUrl)
        .catch(() => {});
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [
    template,
    title,
    subtitle,
    authorName,
    logoUrl,
    backgroundImageUrl,
    backgroundColor,
    accentColor,
    textColor,
  ]);

  // File uploads
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

  const handleBgUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const error = validateFile(file, 'image');
      if (error) {
        toast.error(error);
        return;
      }
      setBackgroundImageUrl(URL.createObjectURL(file));
      e.target.value = '';
    },
    [setBackgroundImageUrl]
  );

  // Actions
  const handleDownload = useCallback(async () => {
    if (!previewUrl) return;
    const resp = await fetch(previewUrl);
    const blob = await resp.blob();
    downloadBlob(blob, `og-image-${Date.now()}.png`);
    toast.success('PNG downloaded');
  }, [previewUrl]);

  const handleCopy = useCallback(async () => {
    if (!previewUrl) return;
    const result = await copyImageAsPng(previewUrl);
    if (result.success) toast.success('Copied to clipboard');
    else toast.error(result.error || 'Copy failed');
  }, [previewUrl]);

  const handleCopyMeta = useCallback(async () => {
    const meta = [
      `<meta property="og:image" content="YOUR_IMAGE_URL" />`,
      `<meta property="og:image:width" content="${width}" />`,
      `<meta property="og:image:height" content="${height}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:image" content="YOUR_IMAGE_URL" />`,
    ].join('\n');
    const ok = await copyToClipboard(meta);
    if (ok) toast.success('Meta tags copied');
    else toast.error('Copy failed');
  }, []);

  return (
    <MiniToolShell icon={Image} title="OG Image Generator" maxWidth="5xl" onReset={reset}>
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease }}
          className="relative rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950/40"
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="OG Image Preview"
              className="w-full h-auto"
              style={{ aspectRatio: `${width}/${height}` }}
            />
          ) : (
            <div
              className="w-full flex items-center justify-center text-neutral-600 text-xs font-mono"
              style={{ aspectRatio: `${width}/${height}` }}
            >
              Preview
            </div>
          )}
          <span className="absolute bottom-2 right-2 text-[10px] font-mono text-neutral-500 bg-neutral-950/80 px-2 py-0.5 rounded">
            {width} x {height}
          </span>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease }}
          className="space-y-4"
        >
          {/* Brand select */}
          <BrandToolSelect value={brandId} onChange={setBrandId} />

          {/* Template selector */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Template
            </span>
            <div className="flex gap-2">
              {TEMPLATES.map((tpl) => (
                <motion.button
                  key={tpl.id}
                  onClick={() => setTemplate(tpl.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1 group"
                  title={tpl.label}
                >
                  <TemplateThumbnail id={tpl.id} active={template === tpl.id} />
                  <span
                    className={cn(
                      'text-[9px] font-mono uppercase tracking-wider',
                      template === tpl.id
                        ? 'text-brand-cyan'
                        : 'text-neutral-600 group-hover:text-neutral-400'
                    )}
                  >
                    {tpl.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Title
            </span>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Your blog post title"
              rows={2}
              className="w-full bg-neutral-950/60 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono placeholder:text-neutral-600 focus:outline-none focus:border-brand-cyan/40 resize-none"
            />
          </div>

          {/* Subtitle */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Subtitle
            </span>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="A brief description"
              className="bg-neutral-950/60 border-neutral-800 text-sm text-neutral-200 font-mono placeholder:text-neutral-600 focus:border-brand-cyan/40"
            />
          </div>

          {/* Author */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Author
            </span>
            <Input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Author name"
              className="bg-neutral-950/60 border-neutral-800 text-sm text-neutral-200 font-mono placeholder:text-neutral-600 focus:border-brand-cyan/40"
            />
          </div>

          {/* Logo upload */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Logo
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-600 text-neutral-500 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-all">
                <Upload size={10} />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </label>
              {logoUrl && (
                <button
                  onClick={() => setLogoUrl('')}
                  className="text-neutral-600 hover:text-neutral-300 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Background image upload (photo template only) */}
          {template === 'photo' && (
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                Background Image
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-600 text-neutral-500 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-all">
                  <Upload size={10} />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBgUpload}
                  />
                </label>
                {backgroundImageUrl && (
                  <button
                    onClick={() => setBackgroundImageUrl('')}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Colors */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Colors
            </span>
            <div className="flex gap-3">
              <ColorInput label="BG" value={backgroundColor} onChange={setBackgroundColor} />
              <ColorInput label="Accent" value={accentColor} onChange={setAccentColor} />
              <ColorInput label="Text" value={textColor} onChange={setTextColor} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            {previewUrl && (
              <QuickActions
                toolId="og-image"
                outputMime="image/png"
                summary="OG image generated"
                onDownloadAll={handleDownload}
                onCopy={handleCopy}
                assetData={
                  previewUrl
                    ? {
                        imageBase64: previewUrl,
                        mimeType: 'image/png',
                        label: 'og-image.png',
                      }
                    : undefined
                }
              />
            )}
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleCopyMeta}
                variant="outline"
                className="w-full font-mono text-xs uppercase tracking-widest border-neutral-700"
              >
                <Code size={14} />
                <span className="ml-2">Copy Meta Tags</span>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </MiniToolShell>
  );
};

/* ------------------------------------------------------------------ */
/*  Color input helper                                                 */
/* ------------------------------------------------------------------ */

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded border border-neutral-700 bg-transparent cursor-pointer p-0"
      />
      <div className="flex flex-col">
        <span className="text-[9px] font-mono text-neutral-600 uppercase">{label}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-[72px] bg-transparent text-[10px] font-mono text-neutral-400 border-none outline-none p-0"
        />
      </div>
    </div>
  );
}
