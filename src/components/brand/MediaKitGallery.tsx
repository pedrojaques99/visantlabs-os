import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Image as ImageIcon, FileText, Link2, Copy, Check, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { getProxiedUrl } from '@/utils/proxyUtils';

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
    onAssetClick?: (url: string, type: 'logo' | 'image') => void;
    onAssetDragStart?: (e: React.DragEvent, url: string, type: 'logo' | 'image') => void;
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
    onAssetClick,
    onAssetDragStart
}) => {
    const { t } = useTranslation();
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [uploadingFiles, setUploadingFiles] = useState<{ name: string; type: 'media' | 'logo' }[]>([]);
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

    const handleItemClick = (id: string, url: string, type: 'logo' | 'image', e: React.MouseEvent) => {
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
            await Promise.all(idsToDelete.map(id => {
                const isLogo = logos.some(l => l.id === id);
                return isLogo ? brandGuidelineApi.deleteLogo(guidelineId, id) : brandGuidelineApi.deleteMedia(guidelineId, id);
            }));
            
            onLogosChange(logos.filter(l => !selectedIds.has(l.id)));
            onMediaChange(media.filter(m => !selectedIds.has(m.id)));
            setSelectedIds(new Set());
            toast.success(t('mockup.mediaKit.bulkDeleteSuccess') || 'Assets deleted');
        } catch {
            toast.error(t('mockup.mediaKit.bulkDeleteError') || 'Failed to delete some assets');
        } finally {
            setIsBulkDeleting(false);
        }
    }, [selectedIds, guidelineId, logos, media, onLogosChange, onMediaChange, t, readOnly]);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
        });
    };

    const handleUpload = useCallback(async (files: File[], type: 'media' | 'logo') => {
        if (readOnly || isUploading) return;
        setIsUploading(true);
        setUploadingFiles(files.map(f => ({ name: f.name, type })));

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

            const results = await Promise.all(uploadPromises);
            const validResults = results.filter(Boolean);

            if (validResults.length > 0) {
                const latestResult = validResults[validResults.length - 1];
                if (type === 'media' && latestResult && 'allMedia' in latestResult) {
                    onMediaChange(latestResult.allMedia);
                } else if (type === 'logo' && latestResult && 'allLogos' in latestResult) {
                    onLogosChange(latestResult.allLogos);
                }
                toast.success(t('mockup.mediaKit.uploadSuccess'));
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(t('mockup.mediaKit.uploadError'));
        } finally {
            setIsUploading(false);
            setUploadingFiles([]);
        }
    }, [guidelineId, readOnly, isUploading, onMediaChange, onLogosChange, t]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (readOnly) return;

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleUpload(files, 'media');
    }, [readOnly, handleUpload]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

    const displayedMedia = compact ? media.slice(0, 12) : media;
    const displayedLogos = compact ? logos.slice(0, 12) : logos;

    return (
        <div className="flex flex-col gap-4 relative">
            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && !readOnly && (
                <div className="sticky top-0 z-20 flex items-center justify-between p-2 mb-2 bg-brand-cyan/10 border border-brand-cyan/20 rounded-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2">
                    <span className="text-[10px] font-mono text-brand-cyan font-bold px-2 uppercase">
                        {selectedIds.size} SELECTED
                    </span>
                    <div className="flex gap-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedIds(new Set())}
                            className="text-[10px] font-mono hover:bg-white/5"
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            className="text-[10px] h-7 bg-red-500 hover:bg-red-600 font-mono"
                        >
                            {isBulkDeleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                            <span className="ml-2 uppercase">Delete All</span>
                        </Button>
                    </div>
                </div>
            )}

            {/* Logos Section */}
            {(logos.length > 0 || !readOnly || uploadingFiles.some(f => f.type === 'logo')) && (
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
                    {(displayedLogos.length > 0 || uploadingFiles.some(f => f.type === 'logo')) ? (
                        <div className={cn("grid gap-2", compact ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6")}>
                            {displayedLogos.map((logo) => {
                                const isSelected = selectedIds.has(logo.id);
                                return (
                                    <div
                                        key={logo.id}
                                        onClick={(e) => handleItemClick(logo.id, logo.url, 'logo', e)}
                                        className={cn(
                                            "group/logo relative aspect-square rounded-md border transition-all cursor-pointer overflow-hidden",
                                            isSelected ? "border-brand-cyan bg-brand-cyan/5 scale-[0.98]" : "border-white/5 bg-neutral-900/40"
                                        )}
                                    >
                                        <img
                                            src={getProxiedUrl(logo.url)}
                                            alt={logo.label || logo.variant}
                                            className="w-full h-full object-contain p-2"
                                            loading="lazy"
                                            draggable={!!onAssetDragStart}
                                            onDragStart={(e) => onAssetDragStart?.(e, logo.url, 'logo')}
                                        />
                                        <span className={cn(
                                            "absolute bottom-0 left-0 right-0 text-[8px] font-mono text-neutral-500 text-center py-0.5 bg-black/60 uppercase",
                                            isSelected && "bg-brand-cyan text-black font-bold"
                                        )}>
                                            {logo.variant}
                                        </span>
                                        
                                        {/* Asset Click Indicator (Subtle) */}
                                        {onAssetClick && (
                                            <div className="absolute inset-0 bg-brand-cyan/0 group-hover/logo:bg-brand-cyan/5 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-all pointer-events-none">
                                                <MousePointerClick size={14} className="text-brand-cyan/40" />
                                            </div>
                                        )}
                                        
                                        {/* Selection Checkbox */}
                                        {!readOnly && (
                                            <div className={cn(
                                                "absolute top-1 left-1 w-4 h-4 rounded-full border flex items-center justify-center transition-opacity shadow-lg",
                                                isSelected ? "bg-brand-cyan border-brand-cyan opacity-100" : "bg-black/40 border-white/20 opacity-0 group-hover/logo:opacity-100"
                                            )}>
                                                {isSelected && <Check size={10} className="text-black" strokeWidth={4} />}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <MicroTitle className="text-[10px] text-neutral-700 ">
                            {t('mockup.mediaKit.noLogos')}
                        </MicroTitle>
                    )}
                </div>
            )}

            {/* Media Section */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] ">
                        {t('mockup.mediaKit.title')}
                    </span>
                </div>

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
                    {(displayedMedia.length > 0) ? (
                        <div className={cn("grid gap-2 p-2", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4")}>
                            {displayedMedia.map((item) => {
                                const isSelected = selectedIds.has(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={(e) => handleItemClick(item.id, item.url, 'image', e)}
                                        className={cn(
                                            "group/media relative aspect-[4/3] rounded-md border transition-all cursor-pointer overflow-hidden",
                                            isSelected ? "border-brand-cyan bg-brand-cyan/5 scale-[0.98]" : "border-white/5 bg-neutral-900/40"
                                        )}
                                    >
                                        {item.type === 'image' ? (
                                            <img
                                                src={getProxiedUrl(item.url)}
                                                alt={item.label || 'Media'}
                                                className="w-full h-full object-contain p-2"
                                                loading="lazy"
                                                draggable={!!onAssetDragStart}
                                                onDragStart={(e) => onAssetDragStart?.(e, item.url, 'image')}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-neutral-600">
                                                <FileText size={24} />
                                                <span className="text-[9px] font-mono truncate max-w-full px-2">
                                                    {item.label || 'PDF'}
                                                </span>
                                            </div>
                                        )}
                                        
                                        {/* Asset Click Indicator */}
                                        {onAssetClick && item.type === 'image' && (
                                            <div className="absolute inset-0 bg-brand-cyan/0 group-hover/media:bg-brand-cyan/5 flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-all pointer-events-none">
                                                <MousePointerClick size={14} className="text-brand-cyan/40" />
                                            </div>
                                        )}

                                        {isSelected && (
                                            <div className={cn(
                                                "absolute top-1 left-1 w-4 h-4 rounded-full border border-brand-cyan bg-brand-cyan flex items-center justify-center shadow-lg"
                                            )}>
                                                <Check size={10} className="text-black" strokeWidth={4} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-[10px] font-mono text-neutral-700 p-3 text-center">
                            {t('mockup.mediaKit.noMedia')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
