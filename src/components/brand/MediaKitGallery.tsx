import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Trash2, FileText, Link2, Copy, Check, ChevronDown, Pencil } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { getProxiedUrl } from '@/utils/proxyUtils';
import { useNeedsLightBg } from '@/hooks/useNeedsLightBg';
import { MediaTile } from '@/components/ui/MediaTile';
import { Badge } from '@/components/ui/badge';

import { GlitchLoader } from '@/components/ui/GlitchLoader';
type MediaCategory = 'background' | 'graphic' | 'stock' | 'product' | 'texture' | 'other';

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'pdf';
  label?: string;
  category?: MediaCategory;
}

const MEDIA_CATEGORIES: Array<{ value: MediaCategory; label: string }> = [
  { value: 'background', label: 'Background' },
  { value: 'graphic', label: 'Graphic Asset' },
  { value: 'stock', label: 'Stock Photo' },
  { value: 'product', label: 'Product' },
  { value: 'texture', label: 'Texture' },
  { value: 'other', label: 'Other' },
];

interface LogoItem {
  id: string;
  url: string;
  variant: 'primary' | 'dark' | 'light' | 'icon' | 'accent' | 'custom';
  label?: string;
}

interface MediaKitGalleryProps {
  guidelineId: string;
  media: MediaItem[];
  logos: LogoItem[];
  onMediaChange: (media: MediaItem[]) => void;
  onLogosChange: (logos: LogoItem[]) => void;
  compact?: boolean;
  readOnly?: boolean;
  onAssetClick?: (url: string, type: 'logo' | 'image') => void;
  onAssetDragStart?: (e: React.DragEvent, url: string, type: 'logo' | 'image') => void;
}

const classifyFile = (file: File): 'logo' | 'media' => {
  if (file.type === 'image/svg+xml') return 'logo';
  const name = file.name.toLowerCase();
  if (/logo|mark|icon|symbol|brand/.test(name)) return 'logo';
  return 'media';
};

const detectFormat = (url?: string): string => {
  if (!url) return '';
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.svg')) return 'SVG';
  if (clean.endsWith('.png')) return 'PNG';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'JPG';
  if (clean.endsWith('.webp')) return 'WEBP';
  if (clean.endsWith('.gif')) return 'GIF';
  if (clean.endsWith('.pdf')) return 'PDF';
  return '';
};

const FormatBadge: React.FC<{ url: string }> = ({ url }) => {
  const fmt = detectFormat(url);
  if (!fmt) return null;
  return (
    // EXCEÇÃO ao ui-slop/mono: extensão de arquivo (SVG/PNG) é valor técnico
    <Badge variant="neutral" className="px-1 py-px font-mono text-2xs">
      {fmt}
    </Badge>
  );
};

/** Selected marker for the MediaTile badge slot (not interactive; the tile is the toggle). */
const SelectedCheck = () => (
  <span className="flex size-4 items-center justify-center rounded-full bg-foreground">
    <Check size={10} className="text-background" strokeWidth={4} />
  </span>
);

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml';
const ACCEPTED_ALL_TYPES = `${ACCEPTED_IMAGE_TYPES},application/pdf`;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const MediaKitGallery: React.FC<MediaKitGalleryProps> = ({
  guidelineId,
  media,
  logos,
  onMediaChange,
  onLogosChange,
  compact = false,
  readOnly = false,
  onAssetClick,
  onAssetDragStart,
}) => {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanelHovered, setIsPanelHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; type: 'media' | 'logo' }[]>(
    []
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    // If onAssetClick is provided and no multi-select is happening, trigger asset click
    if (onAssetClick && !e.shiftKey && selectedIds.size === 0) {
      return;
    }

    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleItemClick = (
    id: string,
    url: string,
    type: 'logo' | 'image',
    e: React.MouseEvent
  ) => {
    if (onAssetClick && !e.shiftKey) {
      onAssetClick(url, type);
      return;
    }
    if (!readOnly) {
      toggleSelect(id, e);
    }
  };

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0 || readOnly) return;
    setIsBulkDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      await Promise.all(
        idsToDelete.map((id) => {
          const isLogo = logos.some((l) => l.id === id);
          return isLogo
            ? brandGuidelineApi.deleteLogo(guidelineId, id)
            : brandGuidelineApi.deleteMedia(guidelineId, id);
        })
      );

      onLogosChange(logos.filter((l) => !selectedIds.has(l.id)));
      onMediaChange(media.filter((m) => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      toast.success(t('mockup.mediaKit.bulkDeleteSuccess'));
    } catch {
      toast.error(t('mockup.mediaKit.bulkDeleteError'));
    } finally {
      setIsBulkDeleting(false);
    }
  }, [selectedIds, guidelineId, logos, media, onLogosChange, onMediaChange, t, readOnly]);

  const handleRenamePrompt = useCallback(() => {
    if (selectedIds.size !== 1 || readOnly) return;
    const id = Array.from(selectedIds)[0];
    const isLogo = logos.some((l) => l.id === id);
    const item = isLogo ? logos.find((l) => l.id === id) : media.find((m) => m.id === id);
    if (!item) return;

    const newLabel = window.prompt('Enter new name for asset:', item.label || '');
    if (newLabel !== null && newLabel.trim() !== '' && newLabel !== item.label) {
      handleRename(id, isLogo, newLabel.trim());
    }
  }, [selectedIds, logos, media, readOnly]);

  const handleRename = useCallback(
    async (id: string, isLogo: boolean, newLabel: string) => {
      try {
        if (isLogo) {
          const newLogos = logos.map((l) => (l.id === id ? { ...l, label: newLabel } : l));
          await brandGuidelineApi.update(guidelineId, { logos: newLogos });
          onLogosChange(newLogos);
        } else {
          const newMedia = media.map((m) => (m.id === id ? { ...m, label: newLabel } : m));
          await brandGuidelineApi.update(guidelineId, { media: newMedia });
          onMediaChange(newMedia);
        }
        setSelectedIds(new Set());
        toast.success('Asset renamed successfully');
      } catch (error) {
        toast.error('Failed to rename asset');
      }
    },
    [guidelineId, logos, media, onLogosChange, onMediaChange]
  );

  const handleCategoryChange = useCallback(
    async (id: string, category: MediaCategory) => {
      const newMedia = media.map((m) => (m.id === id ? { ...m, category } : m));
      onMediaChange(newMedia);
      try {
        await brandGuidelineApi.update(guidelineId, { media: newMedia });
      } catch {
        toast.error('Failed to update category');
      }
    },
    [guidelineId, media, onMediaChange]
  );

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const handleUpload = useCallback(
    async (files: File[], type: 'media' | 'logo') => {
      if (readOnly || isUploading) return;
      setIsUploading(true);
      setUploadingFiles(files.map((f) => ({ name: f.name, type })));

      try {
        const uploadPromises = files.map(async (file) => {
          if (file.size > MAX_FILE_SIZE) {
            toast.error(`${file.name}: ${t('mockup.mediaKit.fileTooLarge')}`);
            return null;
          }

          const base64 = await fileToBase64(file);
          const fileName = file.name.replace(/\.[^/.]+$/, '');

          if (type === 'media') {
            return brandGuidelineApi.uploadMedia(guidelineId, base64, fileName, file.type);
          } else {
            return brandGuidelineApi.uploadLogo(guidelineId, base64, 'primary', fileName);
          }
        });

        const results = (await Promise.all(uploadPromises)).filter(Boolean) as any[];

        if (results.length > 0) {
          // Parallel uploads each return their own snapshot — use the most complete.
          const key = type === 'media' ? 'allMedia' : 'allLogos';
          const arrays = results.map((r) => r?.[key]).filter(Array.isArray) as any[][];
          const best = arrays.sort((a, b) => b.length - a.length)[0];
          if (best) (type === 'media' ? onMediaChange : onLogosChange)(best);

          const skipped = results.filter((r) => r?.skipped).length;
          const similar = results.find((r) => r?.similar);
          const added = results.length - skipped;

          if (added > 0) toast.success(t('mockup.mediaKit.uploadSuccess'));
          if (skipped > 0) {
            const tmpl =
              skipped === 1
                ? t('mockup.mediaKit.duplicateSkipped')
                : t('mockup.mediaKit.duplicatesSkipped');
            toast(tmpl.replace('{count}', String(skipped)));
          }
          if (similar?.similar) {
            const label = similar.similar.label || t('mockup.mediaKit.anExistingAsset');
            toast.warning(t('mockup.mediaKit.nearDuplicate').replace('{label}', label));
          }
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(t('mockup.mediaKit.uploadError'));
      } finally {
        setIsUploading(false);
        setUploadingFiles([]);
      }
    },
    [guidelineId, readOnly, isUploading, onMediaChange, onLogosChange, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (readOnly) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      const logoFiles = files.filter((f) => classifyFile(f) === 'logo');
      const mediaFiles = files.filter((f) => classifyFile(f) === 'media');
      if (logoFiles.length) handleUpload(logoFiles, 'logo');
      if (mediaFiles.length) handleUpload(mediaFiles, 'media');
    },
    [readOnly, handleUpload]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Capture paste when panel is hovered — intercepts before chat handler
  useEffect(() => {
    if (readOnly || !isPanelHovered) return;
    const handlePaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.items || [])
        .filter((i) => i.kind === 'file')
        .map((i) => i.getAsFile())
        .filter(Boolean) as File[];
      if (files.length === 0) return;
      e.stopPropagation();
      e.preventDefault();
      const logoFiles = files.filter((f) => classifyFile(f) === 'logo');
      const mediaFiles = files.filter((f) => classifyFile(f) === 'media');
      if (logoFiles.length) handleUpload(logoFiles, 'logo');
      if (mediaFiles.length) handleUpload(mediaFiles, 'media');
    };
    // capture phase: runs before window listeners (chat paste handler)
    document.addEventListener('paste', handlePaste, { capture: true });
    return () => document.removeEventListener('paste', handlePaste, { capture: true });
  }, [readOnly, isPanelHovered, handleUpload]);

  const displayedMedia = compact ? media.slice(0, 12) : media;
  const safeLogs = logos.filter((l) => l.url);
  const displayedLogos = compact ? safeLogs.slice(0, 12) : safeLogs;

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-4 relative"
      onMouseEnter={() => setIsPanelHovered(true)}
      onMouseLeave={() => setIsPanelHovered(false)}
    >
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && !readOnly && (
        <div className="sticky top-0 z-20 flex items-center justify-between p-2 mb-2 bg-background/90 border border-border rounded-xl backdrop-blur-md animate-in fade-in">
          <span className="text-xs text-foreground font-medium px-2 tabular-nums">
            {t('mockup.mediaKit.selectedCount', { count: selectedIds.size })}
          </span>
          <div className="flex gap-2">
            {selectedIds.size === 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRenamePrompt}
                className="text-xs h-7 gap-1.5"
              >
                <Pencil size={12} />
                {t('mockup.mediaKit.rename')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs h-7"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="text-xs h-7 gap-1.5"
            >
              {isBulkDeleting ? <GlitchLoader size={10} /> : <Trash2 size={12} />}
              {t('common.delete')}
            </Button>
          </div>
        </div>
      )}

      {/* Logos Section */}
      {(logos.length > 0 || !readOnly || uploadingFiles.some((f) => f.type === 'logo')) && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <MicroTitle className="text-2xs ">{t('mockup.mediaKit.logos')}</MicroTitle>
            {!readOnly && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={isUploading}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Plus size={10} />
                {t('mockup.mediaKit.addLogo')}
              </Button>
            )}
          </div>
          {displayedLogos.length > 0 || uploadingFiles.some((f) => f.type === 'logo') ? (
            <div
              className={cn(
                'grid gap-2',
                compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'
              )}
            >
              {displayedLogos.map((logo) => (
                <LogoTile
                  key={logo.id}
                  logo={logo}
                  isSelected={selectedIds.has(logo.id)}
                  readOnly={readOnly}
                  onClick={
                    onAssetClick || !readOnly
                      ? (e) => handleItemClick(logo.id, logo.url, 'logo', e)
                      : undefined
                  }
                  onAssetDragStart={onAssetDragStart}
                />
              ))}
            </div>
          ) : (
            <MicroTitle className="text-2xs text-neutral-700 ">
              {t('mockup.mediaKit.noLogos')}
            </MicroTitle>
          )}
        </div>
      )}

      {/* Media Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-2xs ">{t('mockup.mediaKit.title')}</span>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={cn(
            'rounded-md border border-dashed transition-colors min-h-[80px]',
            isDragging ? 'border-ring bg-muted/60' : 'border-border bg-transparent',
            readOnly && 'border-transparent'
          )}
        >
          {displayedMedia.length > 0 ? (
            <div
              className={cn(
                'grid gap-2 p-2',
                compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
              )}
            >
              {displayedMedia.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const isImage = item.type === 'image';
                return (
                  <MediaTile
                    key={item.id}
                    src={isImage ? getProxiedUrl(item.url) : undefined}
                    alt={item.label || 'Media'}
                    aspectRatio="4 / 3"
                    // Decisão: no compacto a mídia fica em overlay (o nome só acessível). O que
                    // diferencia uma mídia da outra é a própria imagem; o label é texto livre.
                    layout={compact ? 'overlay' : 'stacked'}
                    title={item.label || (isImage ? undefined : 'PDF')}
                    subtitle={!compact && item.category ? item.category : undefined}
                    imageClassName="object-contain p-2"
                    fallbackIcon={isImage ? undefined : FileText}
                    fallbackLabel={isImage ? undefined : item.label || 'PDF'}
                    selected={readOnly ? undefined : isSelected}
                    onClick={
                      onAssetClick || !readOnly
                        ? (e) => handleItemClick(item.id, item.url, 'image', e)
                        : undefined
                    }
                    draggable={isImage && !!onAssetDragStart}
                    onDragStart={
                      isImage && onAssetDragStart
                        ? (e) => onAssetDragStart(e, item.url, 'image')
                        : undefined
                    }
                    badge={
                      isSelected || isImage ? (
                        <>
                          {isSelected && <SelectedCheck />}
                          {isImage && <FormatBadge url={item.url} />}
                        </>
                      ) : undefined
                    }
                    actions={
                      !readOnly && isImage ? (
                        <select
                          aria-label={item.label || 'Media'}
                          value={item.category || ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleCategoryChange(item.id, e.target.value as MediaCategory);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            'h-5 pl-1 pr-4 rounded text-2xs appearance-none cursor-pointer',
                            'bg-background/90 border border-border text-foreground',
                            'hover:border-border-hover focus:border-ring focus:outline-none transition-colors',
                            !item.category && 'text-muted-foreground'
                          )}
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 2px center',
                          }}
                        >
                          <option value="">Tag</option>
                          {MEDIA_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground p-3 text-center">
              {t('mockup.mediaKit.noMedia')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Logo tile (per-logo so `useNeedsLightBg` can run as a hook) ───────────────
interface LogoTileProps {
  logo: LogoItem;
  isSelected: boolean;
  readOnly: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  onAssetDragStart?: (e: React.DragEvent, url: string, type: 'logo' | 'image') => void;
}

const LogoTile: React.FC<LogoTileProps> = ({
  logo,
  isSelected,
  readOnly,
  onClick,
  onAssetDragStart,
}) => {
  // SSoT dark-logo detection — dark/transparent logos need a light backdrop or
  // they render invisible on the default dark tile.
  const needsLightBg = useNeedsLightBg(getProxiedUrl(logo.url));

  return (
    <MediaTile
      src={getProxiedUrl(logo.url)}
      alt={logo.label || logo.variant}
      // Decisão: logo é sempre stacked, com a variante visível. Variantes do mesmo
      // logo (primária, ícone, mono) se parecem na miniatura; o nome é o que as separa.
      layout="stacked"
      // Grade de logos é estreita (4 a 6 colunas): bloco de texto compacto pra
      // o nome da variante caber sem o padding padrão comer o rótulo.
      density="compact"
      title={logo.variant}
      actionLabel={logo.label || logo.variant}
      imageClassName={cn('object-contain p-2', needsLightBg && 'bg-white')}
      selected={readOnly ? undefined : isSelected}
      onClick={onClick}
      draggable={!!onAssetDragStart}
      onDragStart={onAssetDragStart ? (e) => onAssetDragStart(e, logo.url, 'logo') : undefined}
      badge={
        <>
          {isSelected && <SelectedCheck />}
          <FormatBadge url={logo.url} />
        </>
      }
    />
  );
};
