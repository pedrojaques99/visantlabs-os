import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Image as ImageIcon, FileText, Link2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';

interface MediaItem {
    id: string;
    url: string;
    type: 'image' | 'pdf';
    label?: string;
}

interface LogoItem {
    id: string;
    url: string;
    variant: 'primary' | 'dark' | 'light' | 'icon' | 'custom';
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
}

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
}) => {
    const { t } = useTranslation();
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
        });
    };

    const handleMediaUpload = useCallback(async (files: File[]) => {
        if (readOnly || isUploading) return;
        setIsUploading(true);

        try {
            for (const file of files) {
                if (file.size > MAX_FILE_SIZE) {
                    toast.error(`${file.name}: ${t('mockup.mediaKit.fileTooLarge')}`);
                    continue;
                }

                const base64 = await fileToBase64(file);
                const result = await brandGuidelineApi.uploadMedia(
                    guidelineId,
                    base64,
                    file.name.replace(/\.[^/.]+$/, ''),
                    file.type,
                );
                onMediaChange(result.allMedia);
            }
            toast.success(t('mockup.mediaKit.uploadSuccess'));
        } catch {
            toast.error(t('mockup.mediaKit.uploadError'));
        } finally {
            setIsUploading(false);
        }
    }, [guidelineId, readOnly, isUploading, onMediaChange, t]);

    const handleLogoUpload = useCallback(async (files: File[]) => {
        if (readOnly || isUploading) return;
        setIsUploading(true);

        try {
            for (const file of files) {
                if (file.size > MAX_FILE_SIZE) {
                    toast.error(`${file.name}: ${t('mockup.mediaKit.fileTooLarge')}`);
                    continue;
                }

                const base64 = await fileToBase64(file);
                const result = await brandGuidelineApi.uploadLogo(
                    guidelineId,
                    base64,
                    'primary',
                    file.name.replace(/\.[^/.]+$/, ''),
                );
                onLogosChange(result.allLogos);
            }
            toast.success(t('mockup.mediaKit.uploadSuccess'));
        } catch {
            toast.error(t('mockup.mediaKit.uploadError'));
        } finally {
            setIsUploading(false);
        }
    }, [guidelineId, readOnly, isUploading, onLogosChange, t]);

    const handleDeleteMedia = useCallback(async (mediaId: string) => {
        setDeletingId(mediaId);
        try {
            await brandGuidelineApi.deleteMedia(guidelineId, mediaId);
            onMediaChange(media.filter(m => m.id !== mediaId));
            toast.success(t('mockup.mediaKit.deleteSuccess'));
        } catch {
            toast.error(t('mockup.mediaKit.deleteError'));
        } finally {
            setDeletingId(null);
        }
    }, [guidelineId, media, onMediaChange, t]);

    const handleDeleteLogo = useCallback(async (logoId: string) => {
        setDeletingId(logoId);
        try {
            await brandGuidelineApi.deleteLogo(guidelineId, logoId);
            onLogosChange(logos.filter(l => l.id !== logoId));
            toast.success(t('mockup.mediaKit.deleteSuccess'));
        } catch {
            toast.error(t('mockup.mediaKit.deleteError'));
        } finally {
            setDeletingId(null);
        }
    }, [guidelineId, logos, onLogosChange, t]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (readOnly) return;

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleMediaUpload(files);
    }, [readOnly, handleMediaUpload]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

    const displayedMedia = compact ? media.slice(0, 6) : media;
    const displayedLogos = compact ? logos.slice(0, 4) : logos;

    return (
        <div className="flex flex-col gap-4">
            {/* Logos Section */}
            {(logos.length > 0 || !readOnly) && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <MicroTitle className="text-[10px] ">
                            {t('mockup.mediaKit.logos')}
                        </MicroTitle>
                        {!readOnly && (
                            <Button variant="ghost"
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                disabled={isUploading}
                                className="text-[10px] font-mono text-neutral-600 hover:text-brand-cyan transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                                <Plus size={10} />
                                {t('mockup.mediaKit.addLogo')}
                            </Button>
                        )}
                    </div>
                    {displayedLogos.length > 0 ? (
                        <div className={cn("grid gap-2", compact ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6")}>
                            {displayedLogos.map((logo) => (
                                <div
                                    key={logo.id}
                                    className="group/logo relative aspect-square rounded-md border border-white/5 bg-neutral-900/40 overflow-hidden"
                                >
                                    <img
                                        src={logo.url}
                                        alt={logo.label || logo.variant}
                                        className="w-full h-full object-contain p-2"
                                        loading="lazy"
                                    />
                                    <span className="absolute bottom-0 left-0 right-0 text-[8px] font-mono text-neutral-500 text-center py-0.5 bg-black/60 uppercase">
                                        {logo.variant}
                                    </span>
                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/logo:opacity-100 transition-all duration-300">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 p-1 rounded bg-black/60 text-white hover:bg-black/80 hover:text-brand-cyan"
                                            onClick={() => {
                                                navigator.clipboard.writeText(logo.url);
                                                toast.success('URL copied');
                                            }}
                                        >
                                            <Copy size={10} />
                                        </Button>
                                        {!readOnly && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteLogo(logo.id)}
                                                disabled={deletingId === logo.id}
                                                className="h-6 w-6 p-1 rounded bg-red-500/80 text-white hover:bg-red-500"
                                            >
                                                {deletingId === logo.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <MicroTitle className="text-[10px] text-neutral-700 italic">
                            {t('mockup.mediaKit.noLogos')}
                        </MicroTitle>
                    )}
                    <Input
                        ref={logoInputRef}
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES}
                        multiple
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length) handleLogoUpload(files);
                            e.target.value = '';
                        }}
                        className="hidden"
                    />
                </div>
            )}

            {/* Media Section */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] ">
                        {t('mockup.mediaKit.title')}
                    </span>
                    {!readOnly && (
                        <Button variant="ghost"
                            type="button"
                            onClick={() => mediaInputRef.current?.click()}
                            disabled={isUploading}
                            className="text-[10px] font-mono text-neutral-600 hover:text-brand-cyan transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                            <Plus size={10} />
                            {t('mockup.mediaKit.addMedia')}
                        </Button>
                    )}
                </div>

                {/* Drop Zone + Grid */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    className={cn(
                        "rounded-md border border-dashed transition-colors min-h-[80px]",
                        isDragging
                            ? "border-brand-cyan/50 bg-brand-cyan/5"
                            : "border-white/10 bg-transparent",
                        readOnly && "border-transparent"
                    )}
                >
                    {displayedMedia.length > 0 ? (
                        <div className={cn("grid gap-2 p-2", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4")}>
                            {displayedMedia.map((item) => (
                                <div
                                    key={item.id}
                                    className="group/media relative aspect-[4/3] rounded-md border border-white/5 bg-neutral-900/40 overflow-hidden"
                                >
                                    {item.type === 'image' ? (
                                        <img
                                            src={item.url}
                                            alt={item.label || 'Media'}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-neutral-600">
                                            <FileText size={24} />
                                            <span className="text-[9px] font-mono truncate max-w-full px-2">
                                                {item.label || 'PDF'}
                                            </span>
                                        </div>
                                    )}
                                    {item.label && item.type === 'image' && (
                                        <span className="absolute bottom-0 left-0 right-0 text-[8px] font-mono text-neutral-400 text-center py-0.5 bg-black/60 truncate px-1">
                                            {item.label}
                                        </span>
                                    )}
                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/media:opacity-100 transition-all duration-300">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 p-1 rounded bg-black/60 text-white hover:bg-black/80 hover:text-brand-cyan"
                                            onClick={() => {
                                                navigator.clipboard.writeText(item.url);
                                                toast.success('URL copied');
                                            }}
                                        >
                                            <Copy size={10} />
                                        </Button>
                                        {!readOnly && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteMedia(item.id)}
                                                disabled={deletingId === item.id}
                                                className="h-6 w-6 p-1 rounded bg-red-500/80 text-white hover:bg-red-500"
                                            >
                                                {deletingId === item.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !readOnly ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                            <div className="p-3 rounded-full bg-white/[0.02] border border-white/[0.03]">
                                <ImageIcon size={24} strokeWidth={1} className="text-neutral-800" />
                            </div>
                            <div className="space-y-1 text-center">
                                <p className="text-[10px] uppercase font-bold text-neutral-500">{t('mockup.mediaKit.vaultEmpty') || 'Vault Empty'}</p>
                                <p className="text-[9px] text-neutral-700 font-mono">{t('mockup.mediaKit.dropHere')}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[10px] font-mono text-neutral-700 italic p-3 text-center">
                            {t('mockup.mediaKit.noMedia')}
                        </p>
                    )}
                </div>

                {compact && media.length > 6 && (
                    <span className="text-[9px] font-mono text-neutral-600 text-center">
                        +{media.length - 6} {t('mockup.mediaKit.more')}
                    </span>
                )}

                <Input
                    ref={mediaInputRef}
                    type="file"
                    accept={ACCEPTED_ALL_TYPES}
                    multiple
                    onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) handleMediaUpload(files);
                        e.target.value = '';
                    }}
                    className="hidden"
                />
            </div>
        </div>
    );
};
