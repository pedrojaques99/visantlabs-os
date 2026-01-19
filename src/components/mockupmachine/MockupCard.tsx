import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Download, RefreshCw, ImageIcon, Heart, X, Pencil } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Tooltip } from '@/components/ui/Tooltip';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GlitchPickaxe } from '@/components/ui/GlitchPickaxe';
import { ReImaginePanel } from '../ReImaginePanel';
import { useMockupLike } from '@/hooks/useMockupLike';
import { isSafeUrl } from '@/utils/imageUtils';
import type { AspectRatio } from '@/types/types';

export interface MockupCardProps {
    base64Image: string | null;
    isLoading: boolean;
    isRedrawing: boolean;
    onRedraw: () => void;
    onView: () => void;
    onNewAngle: (angle: string) => void;
    onNewBackground: () => void;
    onReImagine?: (reimaginePrompt: string) => void;
    onSave?: (imageBase64: string) => Promise<void>;
    isSaved?: boolean;
    mockupId?: string;
    onToggleLike?: () => void;
    isLiked?: boolean;
    onLikeStateChange?: (newIsLiked: boolean) => void;
    onRemove?: () => void;
    aspectRatio: AspectRatio;
    prompt?: string;
    designType?: string;
    tags?: string[];
    brandingTags?: string[];
    editButtonsDisabled?: boolean;
    creditsPerOperation?: number;
    className?: string;
    style?: React.CSSProperties;
}

export const MockupCard: React.FC<MockupCardProps> = ({
    base64Image,
    isLoading,
    isRedrawing,
    onRedraw,
    onView,
    onNewAngle,
    onNewBackground,
    onReImagine,
    onSave,
    isSaved = false,
    mockupId,
    onToggleLike,
    isLiked = false,
    onLikeStateChange,
    onRemove,
    aspectRatio,
    prompt,
    designType,
    tags,
    brandingTags,
    editButtonsDisabled = false,
    creditsPerOperation,
    className,
    style
}) => {
    const { t } = useTranslation();
    const [showReImaginePanel, setShowReImaginePanel] = useState(false);
    const [localIsLiked, setLocalIsLiked] = useState(isLiked);
    const loadingStartTimeRef = useRef<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => { setLocalIsLiked(isLiked); }, [isLiked]);

    useEffect(() => {
        if (isLoading && !base64Image) {
            if (loadingStartTimeRef.current === null) { loadingStartTimeRef.current = Date.now(); setElapsedTime(0); }
            const interval = setInterval(() => {
                if (loadingStartTimeRef.current !== null) {
                    setElapsedTime(Math.floor((Date.now() - loadingStartTimeRef.current) / 1000));
                }
            }, 1000);
            return () => clearInterval(interval);
        } else { loadingStartTimeRef.current = null; setElapsedTime(0); }
    }, [isLoading, base64Image]);

    const { toggleLike: handleToggleLikeHook } = useMockupLike({
        mockupId: mockupId || undefined,
        isLiked: localIsLiked,
        onLikeStateChange: (newIsLiked) => {
            setLocalIsLiked(newIsLiked);
            if (onLikeStateChange) onLikeStateChange(newIsLiked);
        },
        translationKeyPrefix: 'canvas',
    });

    const handleToggleLike = mockupId && onLikeStateChange ? handleToggleLikeHook : onToggleLike;

    const imageUrl = useMemo(() => {
        if (!base64Image) return '';
        if (base64Image.startsWith('http') || base64Image.startsWith('data:')) return isSafeUrl(base64Image) ? base64Image : '';
        const dataUrl = `data:image/png;base64,${base64Image}`;
        return isSafeUrl(dataUrl) ? dataUrl : '';
    }, [base64Image]);

    const canInteract = !isLoading && base64Image;
    const showSkeleton = isLoading && !base64Image;
    const showEmptyState = !isLoading && !base64Image;
    // Map specific ratios to tailwind classes if needed, or rely on style/layout handling
    // Note: Tailwind v3 supports arbitrary values like aspect-[16/9]
    const aspectRatioClass = aspectRatio === '16:9' ? 'aspect-[16/9]' : aspectRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-square';

    return (
        <div
            className={`relative ${aspectRatioClass} bg-neutral-900/40 rounded-2xl overflow-hidden group border border-neutral-800/50 transition-all duration-500 hover:border-brand-cyan/30 hover:shadow-[0_0_40px_-10px_rgba(0,210,255,0.2)] hover:scale-[1.01] animate-fade-in ${className || 'w-full'}`}
            style={style}
        >
            {showSkeleton && (
                <div className="absolute inset-0">
                    <SkeletonLoader width="100%" height="100%" className="h-full w-full" variant="rectangular" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:scale-110 transition-transform duration-700">
                        <GlitchPickaxe />
                    </div>
                </div>
            )}

            {showEmptyState && (
                <div className="w-full h-full flex items-center justify-center text-neutral-800">
                    <ImageIcon size={48} strokeWidth={1} />
                </div>
            )}

            {base64Image && (
                <img
                    src={imageUrl}
                    alt="Generated mockup"
                    loading="lazy"
                    className={`w-full h-full object-contain cursor-pointer transition-all duration-700 ${isRedrawing ? 'filter blur-md scale-105 opacity-50' : 'group-hover:scale-[1.02]'}`}
                    onClick={(e) => { e.stopPropagation(); if (canInteract && onView) onView(); }}
                />
            )}

            {isRedrawing && (
                <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/10 backdrop-blur-[2px]">
                    <GlitchLoader size={32} color="white" />
                </div>
            )}

            {isLoading && !isRedrawing && !!base64Image && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                    <ImageIcon size={40} className="text-white/20 animate-pulse" />
                </div>
            )}

            {isLoading && elapsedTime > 0 && !base64Image && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/5 text-neutral-400 text-[10px] font-mono shadow-xl">
                        {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                    </span>
                </div>
            )}

            {/* Action Overlay */}
            {canInteract && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                    {/* Top Buttons: Remove & Like */}
                    <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-y-2 group-hover:translate-y-0 pointer-events-auto">
                        {onRemove && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                className="p-2.5 rounded-xl bg-black/60 backdrop-blur-md text-neutral-400 hover:bg-red-500/20 hover:text-red-400 border border-white/5 transition-all shadow-lg"
                                title="Remove"
                            >
                                <X size={12} />
                            </button>
                        )}
                        {handleToggleLike && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleToggleLike(); }}
                                className={`p-2.5 rounded-xl backdrop-blur-md border transition-all shadow-lg ${localIsLiked
                                    ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30 hover:bg-brand-cyan/30'
                                    : 'bg-black/60 text-neutral-400 border-white/5 hover:text-white hover:bg-black/80'
                                    }`}
                                title={localIsLiked ? "Remover dos favoritos" : "Salvar nos favoritos"}
                            >
                                <Heart size={12} className={localIsLiked ? 'fill-current' : ''} />
                            </button>
                        )}
                    </div>

                    {/* Bottom Toolbar: Download, Redraw, Reimagine */}
                    <div className="absolute bottom-0 inset-x-0 p-2 flex justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-auto">
                        <div className="flex items-center gap-1 p-1 bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                            <Tooltip content={t('mockup.download') || "Download"} position="top">
                                <a
                                    href={imageUrl}
                                    download={`mockup-${Date.now()}.png`}
                                    className="p-2 w-8 h-8 flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        try {
                                            const response = await fetch(imageUrl);
                                            const blob = await response.blob();
                                            const url = window.URL.createObjectURL(blob);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.download = `mockup-${Date.now()}.png`;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                            window.URL.revokeObjectURL(url);
                                        } catch (error) {
                                            const link = document.createElement('a');
                                            link.href = imageUrl;
                                            link.download = `mockup-${Date.now()}.png`;
                                            link.target = '_blank';
                                            link.click();
                                        }
                                    }}
                                >
                                    <Download size={12} />
                                </a>
                            </Tooltip>

                            <div className="w-px h-3 bg-white/10 mx-1" />

                            <Tooltip content={editButtonsDisabled ? (t('mockup.insufficientCredits') || "Insufficient credits") : (t('mockup.redrawTooltip') || "Re-draw")} position="top">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRedraw(); }}
                                    disabled={editButtonsDisabled || isRedrawing}
                                    className={`p-2.5 rounded-xl flex items-center gap-2 transition-all ${editButtonsDisabled || isRedrawing
                                        ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                        : 'text-neutral-400 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    <RefreshCw size={12} className={isRedrawing ? 'animate-spin' : ''} />
                                    {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                                        <span className="text-[10px] font-bold text-brand-cyan">
                                            {creditsPerOperation}
                                        </span>
                                    )}
                                </button>
                            </Tooltip>

                            {onReImagine && (
                                <Tooltip content={editButtonsDisabled ? (t('mockup.insufficientCredits') || "Insufficient credits") : (t('mockup.reimagineTooltip') || "Re-imagine")} position="top">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowReImaginePanel(true); }}
                                        disabled={editButtonsDisabled || isRedrawing}
                                        className={`p-2.5 rounded-xl flex items-center gap-2 transition-all ${editButtonsDisabled || isRedrawing
                                            ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                            : 'text-brand-cyan hover:bg-brand-cyan/20'
                                            }`}
                                    >
                                        <Pencil size={12} />
                                        {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                                            <span className="text-[10px] font-bold text-brand-cyan">
                                                {creditsPerOperation}
                                            </span>
                                        )}
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showReImaginePanel && onReImagine && (
                <ReImaginePanel
                    onSubmit={(reimaginePrompt) => {
                        onReImagine(reimaginePrompt);
                        setShowReImaginePanel(false);
                    }}
                    onClose={() => setShowReImaginePanel(false)}
                    isLoading={isRedrawing || isLoading}
                />
            )}
        </div>
    );
};
