import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Image, Code, X, Download, Copy } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOgImageStore, type OgTemplate } from '@/stores/ogImageStore';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { BrandToolSelect } from '@/components/shared/BrandToolSelect';
import { QuickActions } from '@/components/shared/QuickActions';
import { useBrandDefaults } from '@/hooks/useBrandDefaults';
import { useToolInput } from '@/hooks/useToolInput';
import { loadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob, copyToClipboard } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/Dropzone';
import { glassSurface } from '@/lib/ui/glass';
import { useTranslation } from '@/hooks/useTranslation';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const ease = [0.4, 0, 0.2, 1] as const;

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

const TEMPLATES: OgTemplate[] = ['minimal', 'gradient', 'photo', 'split'];

// EXCEÇÃO ao audit:design/hardcoded-hex-color: miniatura do template desenha a SAÍDA
// (a OG image renderizada no canvas com as cores padrão do gerador), não o cromo do app;
// trocar por token mudaria a prévia conforme o tema e mentiria sobre o PNG final.
const INK = '#0a0a0a';
const ACCENT = '#00e5ff';
const PHOTO = '#333';
const PAPER = '#fff';
const SHADE = '#000';

function TemplateThumbnail({ id, active }: { id: OgTemplate; active: boolean }) {
  const w = 72;
  const h = 38;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="rounded text-foreground">
      {id === 'minimal' && (
        <>
          <rect width={w} height={h} fill={INK} />
          <rect x={6} y={h - 8} width={10} height={2} fill={ACCENT} />
          <rect x={6} y={14} width={40} height={4} rx={1} fill={PAPER} opacity={0.8} />
          <rect x={6} y={21} width={28} height={3} rx={1} fill={PAPER} opacity={0.4} />
        </>
      )}
      {id === 'gradient' && (
        <>
          <defs>
            <linearGradient id="gt" x1="0" y1="0" x2={w} y2={h} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={INK} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <rect width={w} height={h} fill="url(#gt)" />
          <rect x={6} y={h - 8} width={10} height={2} fill={ACCENT} />
          <rect x={6} y={14} width={40} height={4} rx={1} fill={PAPER} opacity={0.8} />
        </>
      )}
      {id === 'photo' && (
        <>
          <rect width={w} height={h} fill={PHOTO} />
          <rect width={w} height={h} fill={SHADE} opacity={0.5} />
          <rect x={6} y={h - 8} width={10} height={2} fill={ACCENT} />
          <rect x={6} y={14} width={40} height={4} rx={1} fill={PAPER} opacity={0.8} />
        </>
      )}
      {id === 'split' && (
        <>
          <rect width={w / 2} height={h} fill={ACCENT} opacity={0.12} />
          <rect x={w / 2} width={w / 2} height={h} fill={INK} />
          <rect x={6} y={h - 8} width={10} height={2} fill={ACCENT} />
          <rect x={6} y={14} width={40} height={4} rx={1} fill={PAPER} opacity={0.8} />
        </>
      )}
      {active && (
        <rect width={w} height={h} fill="none" stroke="currentColor" strokeWidth={2} rx={4} />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export const OgImagePage: React.FC = () => {
  const { t } = useTranslation();
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
  const handleLogoFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const error = validateFile(file, 'image');
      if (error) {
        toast.error(error);
        return;
      }
      setLogoUrl(URL.createObjectURL(file));
    },
    [setLogoUrl]
  );

  const handleBgFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const error = validateFile(file, 'image');
      if (error) {
        toast.error(error);
        return;
      }
      setBackgroundImageUrl(URL.createObjectURL(file));
    },
    [setBackgroundImageUrl]
  );

  // Actions
  const handleDownload = useCallback(async () => {
    if (!previewUrl) return;
    const resp = await fetch(previewUrl);
    const blob = await resp.blob();
    downloadBlob(blob, `og-image-${Date.now()}.png`);
    toast.success(t('miniTools.downloaded'));
  }, [previewUrl, t]);

  const handleCopy = useCallback(async () => {
    if (!previewUrl) return;
    const result = await copyImageAsPng(previewUrl);
    if (result.success) toast.success(t('miniTools.copied'));
    else toast.error(result.error || t('miniTools.copyFailed'));
  }, [previewUrl, t]);

  const handleCopyMeta = useCallback(async () => {
    const meta = [
      `<meta property="og:image" content="YOUR_IMAGE_URL" />`,
      `<meta property="og:image:width" content="${width}" />`,
      `<meta property="og:image:height" content="${height}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:image" content="YOUR_IMAGE_URL" />`,
    ].join('\n');
    const ok = await copyToClipboard(meta);
    if (ok) toast.success(t('miniTools.og.metaCopied'));
    else toast.error(t('miniTools.copyFailed'));
  }, [width, height, t]);

  const handleReset = useCallback(() => {
    reset();
    setPreviewUrl('');
  }, [reset]);

  /* ---------------------------------------------------------------- */
  /*  Panel                                                            */
  /* ---------------------------------------------------------------- */

  const panel = (
    <div className="space-y-5">
      {/* Brand select */}
      <BrandToolSelect value={brandId} onChange={setBrandId} />

      {/* Template selector */}
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground">
          {t('miniTools.og.template')}
        </span>
        <div className="flex gap-2 flex-wrap">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl}
              type="button"
              aria-pressed={template === tpl}
              onClick={() => setTemplate(tpl)}
              className="flex flex-col items-center gap-1 group rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TemplateThumbnail id={tpl} active={template === tpl} />
              <span
                className={cn(
                  'text-2xs font-medium',
                  template === tpl
                    ? 'text-foreground'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
              >
                {t(`miniTools.og.templates.${tpl}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="og-title" className="block text-xs font-medium text-muted-foreground">
          {t('miniTools.og.title')}
        </label>
        <Textarea
          id="og-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('miniTools.og.titlePlaceholder')}
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {/* Subtitle */}
      <div className="space-y-1.5">
        <label htmlFor="og-subtitle" className="block text-xs font-medium text-muted-foreground">
          {t('miniTools.og.subtitle')}
        </label>
        <Input
          id="og-subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder={t('miniTools.og.subtitlePlaceholder')}
          className="text-sm"
        />
      </div>

      {/* Author */}
      <div className="space-y-1.5">
        <label htmlFor="og-author" className="block text-xs font-medium text-muted-foreground">
          {t('miniTools.og.author')}
        </label>
        <Input
          id="og-author"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder={t('miniTools.og.authorPlaceholder')}
          className="text-sm"
        />
      </div>

      {/* Logo upload */}
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground">
          {t('miniTools.og.logo')}
        </span>
        <div className="flex items-center gap-2">
          <Dropzone
            onFiles={(files) => handleLogoFile(files[0])}
            accept="image/*"
            label={t('miniTools.og.upload')}
            size="sm"
            className="flex-1"
          />
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('miniTools.remove')}
              onClick={() => setLogoUrl('')}
            >
              <X size={12} />
            </Button>
          )}
        </div>
      </div>

      {/* Background image upload (photo template only) */}
      {template === 'photo' && (
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">
            {t('miniTools.og.backgroundImage')}
          </span>
          <div className="flex items-center gap-2">
            <Dropzone
              onFiles={(files) => handleBgFile(files[0])}
              accept="image/*"
              label={t('miniTools.og.upload')}
              size="sm"
              className="flex-1"
            />
            {backgroundImageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('miniTools.remove')}
                onClick={() => setBackgroundImageUrl('')}
              >
                <X size={12} />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Colors */}
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground">
          {t('miniTools.og.colors')}
        </span>
        <div className="flex gap-3">
          <ColorInput
            label={t('miniTools.og.colorBg')}
            value={backgroundColor}
            onChange={setBackgroundColor}
          />
          <ColorInput
            label={t('miniTools.og.colorAccent')}
            value={accentColor}
            onChange={setAccentColor}
          />
          <ColorInput
            label={t('miniTools.og.colorText')}
            value={textColor}
            onChange={setTextColor}
          />
        </div>
      </div>

      {/* QuickActions inside panel */}
      {previewUrl && (
        <QuickActions
          toolId="og-image"
          outputMime="image/png"
          summary={t('miniTools.og.generated')}
          onDownloadAll={handleDownload}
          onCopy={handleCopy}
          assetData={{
            imageBase64: previewUrl,
            mimeType: 'image/png',
            label: 'og-image.png',
          }}
        />
      )}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Status bar                                                       */
  /* ---------------------------------------------------------------- */

  const statusBar = previewUrl ? (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="xs" onClick={handleDownload}>
        <Download className="w-3.5 h-3.5" />
        {t('miniTools.og.downloadPng')}
      </Button>
      <Button type="button" variant="ghost" size="xs" onClick={handleCopy}>
        <Copy className="w-3.5 h-3.5" />
        {t('miniTools.og.copyImage')}
      </Button>
      <Button type="button" variant="ghost" size="xs" onClick={handleCopyMeta}>
        <Code className="w-3.5 h-3.5" />
        {t('miniTools.og.copyMeta')}
      </Button>
    </div>
  ) : (
    <span className="text-xs text-muted-foreground">{t('miniTools.og.configure')}</span>
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <MiniAppShell
      icon={Image}
      title={t('apps.ogImage.name')}
      toolId="og-image"
      documentTitle={t('apps.ogImage.name')}
      onReset={handleReset}
      panel={panel}
      statusBar={statusBar}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease }}
        className={cn('relative rounded-xl overflow-hidden w-full max-w-2xl', glassSurface.panel)}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={t('miniTools.og.previewAlt')}
            className="w-full h-auto"
            style={{ aspectRatio: `${width}/${height}` }}
          />
        ) : (
          <div
            className="w-full flex items-center justify-center text-muted-foreground text-xs"
            style={{ aspectRatio: `${width}/${height}` }}
          >
            {t('miniTools.og.preview')}
          </div>
        )}
        <span className="absolute bottom-2 right-2 text-2xs font-mono tabular-nums text-muted-foreground bg-background/80 px-2 py-0.5 rounded">
          {width} x {height}
        </span>
      </motion.div>
    </MiniAppShell>
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
        aria-label={label}
        className="w-6 h-6 rounded border border-border bg-transparent cursor-pointer p-0"
      />
      <div className="flex flex-col">
        <span className="text-2xs font-medium text-muted-foreground">{label}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="w-[72px] bg-transparent text-2xs font-mono text-foreground border-none outline-none p-0 rounded-md focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
