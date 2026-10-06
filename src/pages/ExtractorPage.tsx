import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Search,
  Globe,
  Instagram,
  FileText,
  Download,
  ExternalLink,
  Image as ImageIcon,
  AlertCircle,
  X,
  Plus,
  ArrowRight,
  Maximize2,
  CloudDownload,
  Zap,
  Diamond,
  Copy,
} from '@/lib/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell } from '../components/ui/PageShell';
import { imageApi, SearchImage, DesignerParams, ContentMode } from '../services/imageApi';
import { applyShaderEffect } from '../utils/shaders/shaderRenderer';
import { Button } from '../components/ui/button';
import { MediaTile } from '../components/ui/MediaTile';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { copyImageAsPng } from '@/utils/clipboard';
import { useTranslation } from '@/hooks/useTranslation';
import JSZip from 'jszip';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { cn } from '@/lib/utils';

import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { glassSurface } from '@/lib/ui/glass';
type ExtractionMode = 'google' | 'url' | 'instagram' | 'document';

/**
 * Memoized image card component
 * Only re-renders if specific card state changes (url, selection, upscaling)
 * Prevents full grid re-render on parent state changes
 */
interface ImageCardProps {
  img: SearchImage;
  isHD: boolean;
  isSelected: boolean;
  isUpscaling: boolean;
  batchSelecting: boolean;
  onSelect: (url: string) => void;
  onUpscale: (e: React.MouseEvent, img: SearchImage) => void;
  onCopy: (e: React.MouseEvent, img: SearchImage) => void;
  onCrashed: () => void;
}

const ImageCard = memo<ImageCardProps>(
  ({
    img,
    isHD,
    isSelected,
    isUpscaling,
    batchSelecting,
    onSelect,
    onUpscale,
    onCopy,
    onCrashed,
  }) => {
    const { t } = useTranslation();
    const title = img.title || t('extractor.untitledImage');
    return (
      <motion.div
        key={img.url}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
      >
        <MediaTile
          layout="masonry"
          src={img.url}
          alt={img.title || ''}
          title={title}
          density="compact"
          selected={batchSelecting ? isSelected : undefined}
          onImageError={onCrashed}
          badge={
            <>
              {isHD && <Badge variant="neutral">HD</Badge>}
              <Badge variant="neutral" className="font-mono tabular-nums">
                {img.width}×{img.height}
              </Badge>
            </>
          }
          onClick={() => {
            if (batchSelecting) onSelect(img.url);
            else window.open(img.url, '_blank');
          }}
          actions={
            batchSelecting ? undefined : (
              <>
                <Button
                  asChild
                  variant="surface"
                  size="icon-sm"
                  title={t('extractor.download_original')}
                >
                  <a
                    href={imageApi.getProxiedDownloadUrl(img.url, `${img.title}.jpg`)}
                    download
                    aria-label={t('extractor.download_original')}
                  >
                    <Download size={14} />
                  </a>
                </Button>
                <Button
                  variant="surface"
                  size="icon-sm"
                  onClick={(e) => onCopy(e, img)}
                  title={t('common.copyAsPng')}
                  aria-label={t('common.copyAsPng')}
                >
                  <Copy size={14} />
                </Button>
                <Button
                  variant="surface"
                  size="icon-sm"
                  onClick={(e) => onUpscale(e, img)}
                  disabled={isUpscaling}
                  title={t('extractor.upscale_to_ultra_hd')}
                  aria-label={t('extractor.upscale_to_ultra_hd')}
                >
                  {isUpscaling ? <GlitchLoader size={14} /> : <Zap size={14} />}
                </Button>
                <Button
                  variant="surface"
                  size="icon-sm"
                  onClick={() =>
                    window.open(
                      `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(img.url)}`,
                      '_blank'
                    )
                  }
                  title={t('extractor.search_with_google_lens')}
                  aria-label={t('extractor.search_with_google_lens')}
                >
                  <Search size={14} />
                </Button>
                <Button
                  variant="surface"
                  size="icon-sm"
                  onClick={() => window.open(img.url, '_blank')}
                  title={t('extractor.viewOriginal')}
                  aria-label={t('extractor.viewOriginal')}
                >
                  <Maximize2 size={14} />
                </Button>
              </>
            )
          }
        />
      </motion.div>
    );
  },
  (prev, next) =>
    prev.img.url === next.img.url &&
    prev.isSelected === next.isSelected &&
    prev.isUpscaling === next.isUpscaling &&
    prev.batchSelecting === next.batchSelecting &&
    prev.isHD === next.isHD
);

ImageCard.displayName = 'ImageCard';

export default function ExtractorPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState(() => localStorage.getItem('vsn_extractor_query') || '');
  const [mode, setMode] = useState<ExtractionMode>('google');
  const [images, setImages] = useState<SearchImage[]>(() => {
    const saved = localStorage.getItem('vsn_extractor_images');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchSelecting, setBatchSelecting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  // PDF Document Mode States
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [upscalingUrls, setUpscalingUrls] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(80);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('vsn_extractor_columns');
    return saved ? parseInt(saved, 10) : 4;
  });
  const [designerParams, setDesignerParams] = useState<DesignerParams>(() => {
    const saved = localStorage.getItem('vsn_extractor_params');
    return saved
      ? JSON.parse(saved)
      : { size: 'all', type: 'all', aspect: 'all', contentMode: 'all' as ContentMode };
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence: Sync to localStorage
  useEffect(() => {
    localStorage.setItem('vsn_extractor_query', query);
  }, [query]);

  useEffect(() => {
    try {
      // Filter out base64 images (too heavy for storage) and limit total items
      const sanitizedImages = images.filter((img) => !img.url.startsWith('data:')).slice(0, 80);

      localStorage.setItem('vsn_extractor_images', JSON.stringify(sanitizedImages));
    } catch (e) {
      console.warn('Storage quota limit reached, clearing legacy images');
      localStorage.removeItem('vsn_extractor_images');
    }
  }, [images]);
  useEffect(() => {
    localStorage.setItem('vsn_extractor_params', JSON.stringify(designerParams));
  }, [designerParams]);

  useEffect(() => {
    localStorage.setItem('vsn_extractor_columns', columns.toString());
  }, [columns]);

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && images.length > 0) {
          handleSearch(undefined, true);
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, images.length]);

  // Auto-detect extraction mode based on input pattern
  useEffect(() => {
    const q = query.trim().toLowerCase();

    // Decide pelo hostname de verdade: `includes('instagram.com/')` casava
    // qualquer URL que tivesse esse texto em algum lugar (ex. evil.com/?instagram.com/).
    const host = (() => {
      try {
        return new URL(/^https?:\/\//.test(q) ? q : `https://${q}`).hostname;
      } catch {
        return '';
      }
    })();
    const isHost = (domain: string) => host === domain || host.endsWith(`.${domain}`);

    if (q.startsWith('@') || isHost('instagram.com')) {
      setMode('instagram');
    } else if (isHost('pinterest.com') || isHost('behance.net') || q.startsWith('http')) {
      setMode('url');
    } else {
      setMode('google');
    }
  }, [query]);

  // Helper to cluster similar results
  const organizeSimilars = (results: SearchImage[]) => {
    const sorted = [...results];

    // Sort by a combination of fuzzy title match and resolution
    // This groups similar names together while keeping HD at top of groups
    return sorted.sort((a, b) => {
      const titleA = (a.title || '').toLowerCase().substring(0, 15);
      const titleB = (b.title || '').toLowerCase().substring(0, 15);

      if (titleA < titleB) return -1;
      if (titleA > titleB) return 1;

      // If titles are similar, prioritize higher resolution
      return b.width * b.height - a.width * a.height;
    });
  };

  const handleSearch = async (e?: React.FormEvent, isLoadMore = false) => {
    e?.preventDefault();
    if (!query.trim() && mode !== 'document') return;

    if (!isLoadMore) {
      setLoading(true);
      setImages([]);
    }

    setError(null);
    const currentLimit = isLoadMore ? limit + 80 : 80;

    try {
      let result;
      if (mode === 'google' || mode === 'instagram') {
        result = await imageApi.searchImages(query, mode, currentLimit, designerParams);
      } else if (mode === 'url') {
        result = await imageApi.extractFromUrl(query, currentLimit);
      }

      if (result?.success) {
        const organized = organizeSimilars(result.images);
        setImages(organized);
        setLimit(currentLimit);
        setHasMore(result.images.length >= currentLimit);

        if (result.images.length === 0) {
          setError(t('extractor.noImagesFound'));
        } else if (isLoadMore) {
          toast.success(t('extractor.moreFound', { count: result.images.length - images.length }));
        }
      }
    } catch (err: any) {
      setError(err.message || t('extractor.searchFailed'));
      toast.error(t('extractor.falha_na_extrao'));
    } finally {
      setLoading(false);
    }
  };

  const toggleImageSelection = useCallback((url: string) => {
    setSelectedImages((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(url)) {
        newSelected.delete(url);
      } else {
        newSelected.add(url);
      }
      return newSelected;
    });
  }, []);

  const handleDownloadAll = async () => {
    const imagesToDownload = batchSelecting
      ? images.filter((img) => selectedImages.has(img.url))
      : images;

    if (imagesToDownload.length === 0) return;

    setLoading(true);
    const zip = new JSZip();
    const folder = zip.folder('extracted_images');

    try {
      toast.info(t('extractor.downloadingCount', { count: imagesToDownload.length }));

      const downloadPromises = imagesToDownload.map(async (img, index) => {
        try {
          const proxyUrl = imageApi.getProxiedDownloadUrl(img.url, `image-${index + 1}.jpg`);
          const response = await fetch(proxyUrl);
          const blob = await response.blob();
          const ext = img.url.split('.').pop()?.split('?')[0] || 'jpg';
          folder?.file(`image-${index + 1}.${ext}`, blob);
        } catch (e) {
          console.error('Failed to download image:', img.url);
        }
      });

      await Promise.all(downloadPromises);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `extraction-${Date.now()}.zip`;
      link.click();
      toast.success(t('extractor.download_concludo'));
    } catch (err) {
      toast.error(t('extractor.erro_ao_gerar_zip'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpscale = useCallback(async (e: React.MouseEvent, img: SearchImage) => {
    e.stopPropagation();

    setUpscalingUrls((prev) => {
      if (prev.has(img.url)) return prev;
      const next = new Set(prev);
      next.add(img.url);
      return next;
    });
    toast.info(t('extractor.upscaling_asset_to_2x_ultra_hd'));

    try {
      // Stream external URLs through server to avoid CORS issues with WebGL
      const imageUrl =
        img.url.startsWith('data:') || img.url.startsWith('blob:')
          ? img.url
          : `/api/images/stream?url=${encodeURIComponent(img.url)}`;
      const upscaledBase64 = await applyShaderEffect(imageUrl, undefined, undefined, {
        shaderType: 'upscale',
        scaleFactor: 2.0,
        upscaleSharpening: 0.3,
      });

      // Open result in new tab instead of caching heavy base64 in state
      const win = window.open();
      if (win) {
        win.document.write(
          `<html><body style="margin:0;background:#0a0a0a;display:grid;place-items:center;"><img src="${upscaledBase64}" style="max-width:100%;height:auto;box-shadow:0 0 50px rgba(0,0,0,0.5); border-radius:12px;" /></body></html>`
        );
        win.document.title = `Upscaled Asset - ${img.title}`;
      } else {
        // Fallback to direct download if popup blocked
        const link = document.createElement('a');
        link.href = upscaledBase64;
        link.download = `upscaled-${img.title || 'asset'}.png`;
        link.click();
      }

      toast.success(t('extractor.asset_upscaled_and_delivered'));
    } catch (err) {
      console.error('Upscale failed:', err);
      toast.error(t('extractor.failed_to_upscale_image'));
    } finally {
      setUpscalingUrls((prev) => {
        const next = new Set(prev);
        next.delete(img.url);
        return next;
      });
    }
  }, []);

  const handleCopyAsPng = useCallback(async (e: React.MouseEvent, img: SearchImage) => {
    e.stopPropagation();
    toast.info(t('extractor.processing_for_clipboard'));
    const result = await copyImageAsPng(img.url);
    if (result.success) {
      toast.success(t('extractor.asset_copied_to_clipboard'));
    } else {
      toast.error(`Failed to copy: ${result.error}`);
    }
  }, []);

  // Document Mode Implementation Logic
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      processPdf(file);
    }
  };

  const processPdf = async (file: File) => {
    setExtractingPdf(true);
    setImages([]);
    // Dynamic import for PDF.js to save bundle size
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      const extractedImages: SearchImage[] = [];

      for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        // Limit to first 5 pages for safety
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport, canvas }).promise;

        const base64Image = canvas.toDataURL('image/png').split(',')[1];

        // Proxy call to Gemini for analysis
        const analysis = await imageApi.analyzeDocPage(base64Image, i);

        if (analysis.success && analysis.data.images) {
          analysis.data.images.forEach((img: any, idx: number) => {
            const [ymin, xmin, ymax, xmax] = img.boundingBox;
            const cropX = (xmin / 1000) * canvas.width;
            const cropY = (ymin / 1000) * canvas.height;
            const cropW = ((xmax - xmin) / 1000) * canvas.width;
            const cropH = ((ymax - ymin) / 1000) * canvas.height;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
              cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              extractedImages.push({
                url: cropCanvas.toDataURL('image/png'),
                title: img.name || img.description,
                width: Math.round(cropW),
                height: Math.round(cropH),
                source: `PDF Page ${i}`,
              });
            }
          });
        }
        setImages([...extractedImages]);
      }
      toast.success(t('extractor.extrao_de_pdf_concluda'));
    } catch (err) {
      console.error(err);
      toast.error(t('extractor.erro_ao_processar_pdf'));
    } finally {
      setExtractingPdf(false);
    }
  };

  // Memoized filtered image list - only re-computed when images change
  const visibleImages = useMemo(
    () =>
      images.filter((img) => {
        const url = img.url.toLowerCase();
        const title = (img.title || '').toLowerCase();

        // 1. Surgical filter for reels/videos
        if (
          url.includes('/reel') ||
          url.includes('/reels/') ||
          url.includes('/tv/') ||
          url.includes('video') ||
          url.includes('.mp4') ||
          url.includes('.webm') ||
          title.includes('reel') ||
          title.includes('video')
        ) {
          return false;
        }

        // 2. Junk & Commercial Graphic Filter (Flyers, Ads, etc.)
        const junkKeywords = [
          'flyer',
          'poster',
          'event poster',
          'priced',
          'template',
          'social media post',
          'buy now',
        ];
        if (junkKeywords.some((k) => title.includes(k))) return false;

        // 3. Stock & Watermark Filter (Safeguard)
        const stockPatterns = [
          'shutterstock',
          'adobestock',
          'alamy',
          'dreamstime',
          'gettyimages',
          'watermark',
        ];
        if (stockPatterns.some((p) => url.includes(p) || title.includes(p))) return false;

        // 4. Clipart/Illustration filter (unless explicitly requested)
        if (designerParams.type !== 'clipart') {
          const artPatterns = ['clipart', 'vector', 'illustration', 'clip-art'];
          if (artPatterns.some((p) => url.includes(p) || title.includes(p))) return false;
        }

        return true;
      }),
    [images, designerParams.type]
  );

  // Callback wrappers for ImageCard to handle removal
  const handleImageCrashed = useCallback((url: string) => {
    setImages((prev) => prev.filter((item) => item.url !== url));
    setSelectedImages((prev) => {
      const next = new Set(prev);
      next.delete(url);
      return next;
    });
  }, []);

  return (
    <PageShell
      pageId="extractor"
      title={t('extractor.title')}
      description={t('extractor.extrator_de_imagens_inteligente_de_mltip')}
    >
      <div
        className={`w-full px-6 flex flex-col ${
          images.length === 0 ? 'min-h-[60vh] justify-center' : 'pt-2 space-y-8 pb-20'
        }`}
      >
        {/* Minimalist Central Input */}
        <section className={`${images.length === 0 ? 'w-full max-w-xl mx-auto' : 'w-full'}`}>
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('extractor.encontre_qualquer_imagem')}
                className="
                  w-full bg-muted border border-border rounded-xl py-4 px-6 pr-32
                  text-base font-medium text-foreground focus:outline-none focus:border-border-hover
                  transition-colors placeholder:text-muted-foreground
                "
              />
              <div className="absolute right-2 top-2 bottom-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  aria-label={t('extractor.filters')}
                  aria-pressed={showFilters}
                  className={`
                    aspect-square rounded-xl flex items-center justify-center transition-colors
                    ${
                      showFilters
                        ? 'bg-accent text-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                    }
                  `}
                >
                  <Diamond size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t('extractor.fromPdf')}
                  title={t('extractor.fromPdf')}
                  className="
                    aspect-square bg-muted text-muted-foreground rounded-xl
                    flex items-center justify-center hover:bg-accent hover:text-foreground transition-[color,background-color,border-color,opacity]
                  "
                >
                  {extractingPdf ? <GlitchLoader size={16} /> : <FileText size={16} />}
                </button>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  aria-label={t('extractor.search')}
                  className="
                    aspect-square bg-accent text-foreground rounded-xl
                    flex items-center justify-center hover:bg-accent transition-[color,background-color,border-color,opacity] disabled:opacity-20
                  "
                >
                  {loading ? <GlitchLoader size={18} /> : <ArrowRight size={18} />}
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePdfUpload}
                accept=".pdf"
                className="hidden"
              />
            </form>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    'grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl',
                    glassSurface.panel
                  )}
                >
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground pl-1">
                      {t('extractor.columns', { count: columns })}
                    </label>
                    <div className="px-1 pt-2 pb-1">
                      <input
                        type="range"
                        min="2"
                        max="7"
                        step="1"
                        value={columns}
                        onChange={(e) => setColumns(parseInt(e.target.value))}
                        className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-brand-cyan"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground pl-1">
                      {t('extractor.resolution')}
                    </label>
                    <div className="flex gap-1">
                      {(['all', 'large'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setDesignerParams({ ...designerParams, size: s })}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors border ${
                            designerParams.size === s
                              ? 'bg-accent border-ring text-foreground'
                              : 'bg-transparent border-border text-muted-foreground'
                          }`}
                        >
                          {s === 'large' ? 'HD+' : t('extractor.any')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground pl-1">
                      {t('extractor.contentTypeLabel')}
                    </label>
                    <div className="flex gap-1 flex-wrap">
                      {(
                        [
                          'all',
                          'photo',
                          'logo',
                          'illustration',
                          'vector',
                          'creative',
                        ] as ContentMode[]
                      ).map((value) => (
                        <button
                          key={value}
                          title={t(`extractor.contentModes.${value}.hint`)}
                          onClick={() =>
                            setDesignerParams({ ...designerParams, contentMode: value })
                          }
                          className={`flex-none px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
                            designerParams.contentMode === value
                              ? 'bg-accent border-ring text-foreground'
                              : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {t(`extractor.contentModes.${value}.label`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground pl-1">
                      {t('extractor.formatLabel')}
                    </label>
                    <div className="flex gap-1">
                      {(['all', 'square', 'wide', 'tall'] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => setDesignerParams({ ...designerParams, aspect: a })}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors border ${
                            designerParams.aspect === a
                              ? 'bg-accent border-ring text-foreground'
                              : 'bg-transparent border-border text-muted-foreground'
                          }`}
                        >
                          {t(`extractor.aspects.${a}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-destructive/80 bg-destructive/5 px-4 py-2 rounded-xl self-start border border-destructive/10"
                >
                  <AlertCircle size={14} />
                  <span className="text-xs font-medium">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Results Section */}
        {images.length > 0 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Minimal Toolbar */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-medium text-muted-foreground">
                  {t('extractor.foundCount', { count: images.length })}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBatchSelecting(!batchSelecting);
                    setSelectedImages(new Set());
                  }}
                  className={`
                    px-4 py-1.5 rounded-xl text-xs font-medium transition-colors border
                    ${
                      batchSelecting
                        ? 'bg-accent border-ring text-foreground'
                        : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-border-hover'
                    }
                  `}
                >
                  {batchSelecting ? t('common.cancel') : t('extractor.select')}
                </button>
                <button
                  onClick={handleDownloadAll}
                  className="
                    px-4 py-1.5 bg-foreground text-background text-xs font-medium rounded-xl 
                    hover:opacity-90 transition-opacity flex items-center gap-1.5
                  "
                >
                  <CloudDownload size={12} />
                  {batchSelecting ? t('extractor.downloadSelected') : t('extractor.downloadAll')}
                </button>
              </div>
            </div>

            {/* Grid - CSS columns for true masonry (each image keeps its natural height) */}
            <div
              style={{
                columns: columns,
                columnGap: '1rem',
                width: '100%',
              }}
            >
              <AnimatePresence mode="popLayout">
                {visibleImages.map((img) => {
                  const isHD = img.width >= 1920 || img.height >= 1080;
                  return (
                    <div key={img.url} style={{ breakInside: 'avoid', marginBottom: '1rem' }}>
                      <ImageCard
                        img={img}
                        isHD={isHD}
                        isSelected={selectedImages.has(img.url)}
                        isUpscaling={upscalingUrls.has(img.url)}
                        batchSelecting={batchSelecting}
                        onSelect={toggleImageSelection}
                        onUpscale={handleUpscale}
                        onCopy={handleCopyAsPng}
                        onCrashed={() => handleImageCrashed(img.url)}
                      />
                    </div>
                  );
                })}
              </AnimatePresence>
            </div>

            {(hasMore || loading) && images.length === 0 && (
              <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4 pt-10">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl overflow-hidden border border-border opacity-40"
                  >
                    <SkeletonLoader width="100%" height="100%" variant="rectangular" />
                  </div>
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="flex justify-center py-10">
              {loading && images.length > 0 && <GlitchLoader size={20} />}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
