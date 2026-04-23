import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Search, Globe, Instagram, FileText, Download, ExternalLink, Loader2, Image as ImageIcon, CheckCircle2, AlertCircle, X, Plus, ArrowRight, Maximize2, CloudDownload, Zap, Diamond, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell } from '../components/ui/PageShell';
import { imageApi, SearchImage, DesignerParams, ContentMode } from '../services/imageApi';
import { applyShaderEffect } from '../utils/shaders/shaderRenderer';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import JSZip from 'jszip';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { cn } from '@/lib/utils';

type ExtractionMode = 'google' | 'url' | 'instagram' | 'document';

/**
 * Lazy-loaded image component with skeleton and error states
 */
const StreamImage = ({ src, alt, onCrashed }: { src: string; alt: string; onCrashed: () => void }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative w-full bg-neutral-900/40 overflow-hidden rounded-xl">
      {!isLoaded && !hasError && (
        <div className="w-full h-32 bg-neutral-800/50 animate-pulse" />
      )}

      {hasError ? (
        <div className="w-full h-32 flex items-center justify-center bg-red-500/5">
          <AlertCircle size={20} strokeWidth={1} className="text-red-500/20" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true);
            onCrashed();
          }}
          className={cn(
            "w-full h-auto block transition-opacity duration-700",
            isLoaded ? "opacity-100" : "opacity-0 absolute inset-0"
          )}
        />
      )}
    </div>
  );
};

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

const ImageCard = memo<ImageCardProps>(({
  img, isHD, isSelected, isUpscaling, batchSelecting,
  onSelect, onUpscale, onCopy, onCrashed
}) => (
  <motion.div
    key={img.url}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    className="group relative rounded-2xl overflow-hidden bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300"
  >
    <div
      className="relative cursor-pointer overflow-hidden"
      onClick={() => {
        if (batchSelecting) onSelect(img.url);
        else window.open(img.url, '_blank');
      }}
    >
      {/* Technical Badges */}
      <div className="absolute top-3 left-3 z-10 flex gap-1.5">
        {isHD && (
          <div className="bg-brand-cyan/80 text-[8px] font-bold px-1.5 py-0.5 rounded text-black uppercase tracking-tighter">
            ULTRA HD
          </div>
        )}
        <div className="bg-black/40 backdrop-blur-sm text-white/50 text-[8px] font-medium px-1.5 py-0.5 rounded border border-white/5 uppercase">
          {img.width}×{img.height}
        </div>
      </div>

      {/* Selection Checkbox */}
      {batchSelecting && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className={`
            w-8 h-8 rounded-full border flex items-center justify-center transition-all
            ${isSelected
              ? 'bg-white border-white text-black scale-110'
              : 'bg-transparent border-white/30 text-transparent'
            }
          `}>
            <CheckCircle2 size={16} />
          </div>
        </div>
      )}

      {/* Image Asset */}
      <StreamImage 
        src={img.url}
        alt={img.title}
        onCrashed={onCrashed}
      />

      {/* Subtle Hover Overlay */}
      {!batchSelecting && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
          <h4 className="text-white font-medium text-[10px] line-clamp-1 mb-3 opacity-90 uppercase tracking-tight">{img.title || 'asset_stream'}</h4>
          <div className="flex gap-1.5">
            <a
              href={imageApi.getProxiedDownloadUrl(img.url, `${img.title}.jpg`)}
              download
              onClick={(e) => e.stopPropagation()}
              className="w-9 h-9 border border-white/10 bg-white text-black rounded-lg flex items-center justify-center hover:bg-neutral-200 transition-colors"
              title="Download Original"
            >
              <Download size={14} />
            </a>
            <button
              onClick={(e) => onCopy(e, img)}
              className="w-9 h-9 border border-white/10 bg-white/5 backdrop-blur-md text-white rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              title="Copy as PNG"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={(e) => onUpscale(e, img)}
              disabled={isUpscaling}
              className="w-9 h-9 border border-white/10 bg-white/5 backdrop-blur-md text-white rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              title="Upscale to ULTRA HD"
            >
              {isUpscaling ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(img.url)}`, '_blank');
              }}
              className="w-9 h-9 border border-white/10 bg-white/5 backdrop-blur-md text-white rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              title="Search with Google Lens"
            >
              <Search size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(img.url, '_blank');
              }}
              className="w-9 h-9 border border-white/10 bg-white/5 backdrop-blur-md text-white rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              title="View Original"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  </motion.div>
), (prev, next) =>
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
    return saved ? JSON.parse(saved) : { size: 'all', type: 'all', aspect: 'all', contentMode: 'all' as ContentMode };
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence: Sync to localStorage
  useEffect(() => {
    localStorage.setItem('vsn_extractor_query', query);
  }, [query]);

  useEffect(() => {
    try {
      // Filter out base64 images (too heavy for storage) and limit total items
      const sanitizedImages = images
        .filter(img => !img.url.startsWith('data:'))
        .slice(0, 80); 
      
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
    
    // Intelligence: Detect various patterns
    if (q.includes('instagram.com/') || q.startsWith('@')) {
      setMode('instagram');
    } else if (q.includes('pinterest.com/') || q.includes('behance.net/') || q.startsWith('http')) {
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
      return (b.width * b.height) - (a.width * a.height);
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
          setError('Nenhuma imagem encontrada.');
        } else if (isLoadMore) {
          toast.success(`Mais ${result.images.length - images.length} streams identificados`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar imagens');
      toast.error('Falha na extração');
    } finally {
      setLoading(false);
    }
  };

  const toggleImageSelection = useCallback((url: string) => {
    setSelectedImages(prev => {
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
      ? images.filter(img => selectedImages.has(img.url))
      : images;

    if (imagesToDownload.length === 0) return;

    setLoading(true);
    const zip = new JSZip();
    const folder = zip.folder("extracted_images");
    
    try {
      toast.info(`Iniciando download de ${imagesToDownload.length} imagens...`);
      
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
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `extraction-${Date.now()}.zip`;
      link.click();
      toast.success('Download concluído!');
    } catch (err) {
      toast.error('Erro ao gerar ZIP');
    } finally {
      setLoading(false);
    }
  };

  const handleUpscale = useCallback(async (e: React.MouseEvent, img: SearchImage) => {
    e.stopPropagation();

    setUpscalingUrls(prev => {
      if (prev.has(img.url)) return prev;
      const next = new Set(prev);
      next.add(img.url);
      return next;
    });
    toast.info('Upscaling asset to 2x ULTRA HD...');

    try {
      // Stream external URLs through server to avoid CORS issues with WebGL
      const imageUrl = img.url.startsWith('data:') || img.url.startsWith('blob:')
        ? img.url
        : `/api/images/stream?url=${encodeURIComponent(img.url)}`;
      const upscaledBase64 = await applyShaderEffect(imageUrl, undefined, undefined, {
        shaderType: 'upscale',
        scaleFactor: 2.0,
        upscaleSharpening: 0.3
      });

      // Open result in new tab instead of caching heavy base64 in state
      const win = window.open();
      if (win) {
        win.document.write(`<html><body style="margin:0;background:#0a0a0a;display:grid;place-items:center;"><img src="${upscaledBase64}" style="max-width:100%;height:auto;box-shadow:0 0 50px rgba(0,0,0,0.5); border-radius:12px;" /></body></html>`);
        win.document.title = `Upscaled Asset - ${img.title}`;
      } else {
        // Fallback to direct download if popup blocked
        const link = document.createElement('a');
        link.href = upscaledBase64;
        link.download = `upscaled-${img.title || 'asset'}.png`;
        link.click();
      }

      toast.success('Asset upscaled and delivered');
    } catch (err) {
      console.error('Upscale failed:', err);
      toast.error('Failed to upscale image');
    } finally {
      setUpscalingUrls(prev => {
        const next = new Set(prev);
        next.delete(img.url);
        return next;
      });
    }
  }, []);

  const handleCopyAsPng = useCallback(async (e: React.MouseEvent, img: SearchImage) => {
    e.stopPropagation();
    toast.info('Processing for clipboard...');

    let blobUrl: string | null = null;

    try {
      let blob: Blob;

      if (img.url.startsWith('data:')) {
        // Handle data URL directly
        const base64Data = img.url.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const mimeMatch = img.url.match(/data:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        blob = new Blob([byteArray], { type: mimeType });
      } else if (img.url.startsWith('blob:')) {
        // Handle blob URL
        const response = await fetch(img.url);
        blob = await response.blob();
      } else {
        // Stream external URLs to avoid CORS issues
        const streamUrl = `/api/images/stream?url=${encodeURIComponent(img.url)}`;
        const response = await fetch(streamUrl);
        blob = await response.blob();
      }

      const imgObj = new Image();
      imgObj.crossOrigin = 'anonymous';
      blobUrl = URL.createObjectURL(blob);

      await new Promise((resolve, reject) => {
        imgObj.onload = resolve;
        imgObj.onerror = reject;
        imgObj.src = blobUrl!;
      });

      const canvas = document.createElement('canvas');
      canvas.width = imgObj.width;
      canvas.height = imgObj.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');
      ctx.drawImage(imgObj, 0, 0);

      const pngBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!pngBlob) throw new Error('Failed to create PNG blob');

      // Copy to clipboard
      if (!navigator.clipboard?.write) {
        throw new Error('Clipboard API not supported in this browser');
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);

      URL.revokeObjectURL(blobUrl);
      toast.success('Asset copied to clipboard');
    } catch (err) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Copy failed:', message);
      toast.error(`Failed to copy: ${message}`);
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
      // @ts-ignore
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      
      const extractedImages: SearchImage[] = [];

      for (let i = 1; i <= Math.min(totalPages, 5); i++) { // Limit to first 5 pages for safety
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
                source: `PDF Page ${i}`
              });
            }
          });
        }
        setImages([...extractedImages]);
      }
      toast.success('Extração de PDF concluída');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar PDF');
    } finally {
      setExtractingPdf(false);
    }
  };

  // Memoized filtered image list - only re-computed when images change
  const visibleImages = useMemo(() =>
    images.filter(img => {
      const url = img.url.toLowerCase();
      const title = (img.title || '').toLowerCase();

      // 1. Surgical filter for reels/videos
      if (
        url.includes('/reel') || url.includes('/reels/') || 
        url.includes('/tv/') || url.includes('video') ||
        url.includes('.mp4') || url.includes('.webm') || 
        title.includes('reel') || title.includes('video')
      ) {
        return false;
      }

      // 2. Junk & Commercial Graphic Filter (Flyers, Ads, etc.)
      const junkKeywords = ['flyer', 'poster', 'event poster', 'priced', 'template', 'social media post', 'buy now'];
      if (junkKeywords.some(k => title.includes(k))) return false;

      // 3. Stock & Watermark Filter (Safeguard)
      const stockPatterns = ['shutterstock', 'adobestock', 'alamy', 'dreamstime', 'gettyimages', 'watermark'];
      if (stockPatterns.some(p => url.includes(p) || title.includes(p))) return false;

      // 4. Clipart/Illustration filter (unless explicitly requested)
      if (designerParams.type !== 'clipart') {
        const artPatterns = ['clipart', 'vector', 'illustration', 'clip-art'];
        if (artPatterns.some(p => url.includes(p) || title.includes(p))) return false;
      }

      return true;
    }),
    [images, designerParams.type]
  );

  // Callback wrappers for ImageCard to handle removal
  const handleImageCrashed = useCallback((url: string) => {
    setImages(prev => prev.filter(item => item.url !== url));
    setSelectedImages(prev => {
      const next = new Set(prev);
      next.delete(url);
      return next;
    });
  }, []);

  return (
    <PageShell
      pageId="extractor"
      title="Universal Extractor"
      description="Extrator de imagens inteligente de múltiplas fontes."
    >
      <div className={`w-full px-6 flex flex-col transition-all duration-700 ${images.length === 0 ? 'min-h-[60vh] justify-center' : 'pt-2 space-y-8 pb-20'}`}>
        
        {/* Minimalist Central Input */}
        <section className={`transition-all duration-700 ${images.length === 0 ? 'w-full max-w-xl mx-auto' : 'w-full'}`}>
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Encontre qualquer imagem..."
                className="
                  w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 pr-32
                  text-base font-medium text-white/90 focus:outline-none focus:border-white/10
                  transition-all placeholder:text-neutral-600
                "
              />
              <div className="absolute right-2 top-2 bottom-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`
                    aspect-square rounded-xl flex items-center justify-center transition-all
                    ${showFilters ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-white/[0.02] text-neutral-500 hover:bg-white/5 hover:text-neutral-300'}
                  `}
                >
                  <Diamond size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="
                    aspect-square bg-white/[0.02] text-neutral-500 rounded-xl
                    flex items-center justify-center hover:bg-white/5 hover:text-neutral-300 transition-all
                  "
                >
                  {extractingPdf ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                </button>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="
                    aspect-square bg-white/10 text-white rounded-xl
                    flex items-center justify-center hover:bg-white/20 transition-all disabled:opacity-20
                  "
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
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
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-xl"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest pl-1">Grid Zoom ({columns})</label>
                    <div className="px-1 pt-2 pb-1">
                      <input 
                        type="range" 
                        min="2" 
                        max="7" 
                        step="1" 
                        value={columns} 
                        onChange={(e) => setColumns(parseInt(e.target.value))}
                        className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest pl-1">Resolution</label>
                    <div className="flex gap-1">
                      {(['all', 'large'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setDesignerParams({ ...designerParams, size: s })}
                          className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${designerParams.size === s ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-neutral-600'}`}
                        >
                          {s === 'large' ? 'HD+' : 'ANY'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest pl-1">Content Type</label>
                    <div className="flex gap-1 flex-wrap">
                      {([
                        { value: 'all',          label: 'Todos',        hint: 'Qualquer tipo' },
                        { value: 'photo',        label: 'Imagens',      hint: 'Fotos sem texto' },
                        { value: 'logo',         label: 'Logotipo',     hint: 'Logos e marcas' },
                        { value: 'illustration', label: 'Ilustração',   hint: 'Artes e ilustrações' },
                        { value: 'vector',       label: 'Vector / SVG', hint: 'Vetores e lineart' },
                        { value: 'creative',     label: 'Criativos',    hint: 'Banners com texto' },
                      ] as { value: ContentMode; label: string; hint: string }[]).map(({ value, label, hint }) => (
                        <button
                          key={value}
                          title={hint}
                          onClick={() => setDesignerParams({ ...designerParams, contentMode: value })}
                          className={`flex-none px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${designerParams.contentMode === value ? 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan' : 'bg-transparent border-white/5 text-neutral-600 hover:text-neutral-400'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest pl-1">Format</label>
                    <div className="flex gap-1">
                      {(['all', 'square', 'wide', 'tall'] as const).map(a => (
                        <button
                          key={a}
                          onClick={() => setDesignerParams({ ...designerParams, aspect: a })}
                          className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${designerParams.aspect === a ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-neutral-600'}`}
                        >
                          {a}
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
                  className="flex items-center gap-2 text-red-400/80 bg-red-500/5 px-4 py-2 rounded-xl self-start border border-red-500/10"
                >
                  <AlertCircle size={14} />
                  <span className="text-[10px] font-medium uppercase tracking-wider">{error}</span>
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
                <h2 className="text-xs font-medium tracking-tight text-neutral-400 uppercase">
                  {images.length} assets identified
                </h2>
                <div className="text-[9px] text-neutral-600 uppercase tracking-widest border-l border-white/5 pl-3">
                  HD_SORT_ACTIVE
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBatchSelecting(!batchSelecting);
                    setSelectedImages(new Set());
                  }}
                  className={`
                    px-4 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all border
                    ${batchSelecting 
                      ? 'bg-white/10 border-white/20 text-white' 
                      : 'bg-transparent border-white/5 text-neutral-500 hover:text-neutral-300 hover:border-white/10'
                    }
                  `}
                >
                  {batchSelecting ? 'CANCEL' : 'BATCH'}
                </button>
                <button
                  onClick={handleDownloadAll}
                  className="
                    px-4 py-1.5 bg-white text-black text-[10px] font-bold uppercase tracking-wider rounded-lg 
                    hover:bg-neutral-200 transition-all flex items-center gap-1.5
                  "
                >
                  <CloudDownload size={12} />
                  SAVE ALL
                </button>
              </div>
            </div>

            {/* Grid - CSS columns for true masonry (each image keeps its natural height) */}
            <div style={{
              columns: columns,
              columnGap: '1rem',
              width: '100%'
            }}>
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
                  <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/5 opacity-40">
                    <SkeletonLoader width="100%" height="100%" variant="rectangular" />
                  </div>
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="flex justify-center py-10">
              {loading && images.length > 0 && (
                <Loader2 className="animate-spin text-white/20" size={20} />
              )}
            </div>
          </div>
        )}

      </div>
    </PageShell>
  );
}
