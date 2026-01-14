import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Download, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NodeSlider } from './node-slider';
import { useNodeDownload } from './useNodeDownload';
import { useTranslation } from '@/hooks/useTranslation';

interface ImageFullscreenModalProps {
  imageUrl: string | null;
  imageBase64?: string | null;
  onClose: () => void;
  title?: string;
  sliders?: Array<{
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    formatValue?: (value: number) => string;
  }>;
}

export const ImageFullscreenModal: React.FC<ImageFullscreenModalProps> = ({
  imageUrl,
  imageBase64,
  onClose,
  title,
  sliders = [],
}) => {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const finalImageUrl = imageUrl || (imageBase64 ? `data:image/png;base64,${imageBase64}` : null);
  const { handleDownload } = useNodeDownload(finalImageUrl, 'image');

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((prev) => Math.min(prev + 0.1, 5));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom((prev) => Math.max(prev - 0.1, 0.1));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPanX(0);
        setPanY(0);
        setRotation(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) return;

      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.1, Math.min(5, prev + delta)));
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Handle drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.1));
  };

  const handleReset = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  if (!finalImageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center"
      onClick={onClose}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        ref={containerRef}
        className="relative w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMouseMove}
      >
        {/* Top Bar - Minimal controls */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          {title && (
            <h3 className="text-sm font-mono text-neutral-400">{title}</h3>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-md border border-neutral-700/50 p-1">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-neutral-800/50 rounded text-neutral-400 hover:text-white transition-colors"
                title={t('common.zoomOut')}
              >
                <ZoomOut size={14} strokeWidth={2} />
              </button>
              <span className="text-xs font-mono text-neutral-500 px-2 min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-neutral-800/50 rounded text-neutral-400 hover:text-white transition-colors"
                title={t('common.zoomIn')}
              >
                <ZoomIn size={14} strokeWidth={2} />
              </button>
            </div>

            {/* Rotate */}
            <button
              onClick={handleRotate}
              className="p-1.5 bg-black/40 backdrop-blur-sm hover:bg-neutral-800/50 rounded text-neutral-400 hover:text-white transition-colors border border-neutral-700/50"
              title={t('common.rotate')}
            >
              <RotateCw size={14} strokeWidth={2} />
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-1.5 bg-black/40 backdrop-blur-sm hover:bg-neutral-800/50 rounded text-neutral-400 hover:text-white transition-colors border border-neutral-700/50"
              title={t('common.download')}
            >
              <Download size={14} strokeWidth={2} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 bg-black/40 backdrop-blur-sm hover:bg-red-500/80 rounded text-neutral-400 hover:text-white transition-colors border border-neutral-700/50"
              title={t('common.closeEsc')}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <img
            ref={imageRef}
            src={finalImageUrl}
            alt={t('common.fullscreenPreview')}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg) translate(${panX / zoom}px, ${panY / zoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
            draggable={false}
          />
        </div>

        {/* Bottom Bar - Sliders */}
        {sliders.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="max-w-2xl mx-auto space-y-3">
              {sliders.map((slider, index) => (
                <NodeSlider
                  key={index}
                  label={slider.label}
                  value={slider.value}
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  onChange={slider.onChange}
                  formatValue={slider.formatValue}
                />
              ))}
            </div>
          </div>
        )}

        {/* Reset button - appears when zoomed or rotated */}
        {(zoom !== 1 || rotation !== 0 || panX !== 0 || panY !== 0) && (
          <button
            onClick={handleReset}
            className="absolute bottom-4 right-4 z-10 px-3 py-1.5 bg-black/60 backdrop-blur-sm hover:bg-black/80 rounded text-xs font-mono text-neutral-400 hover:text-white transition-colors border border-neutral-700/50"
            title={t('common.resetView')}
          >
            {t('common.reset')}
          </button>
        )}
      </div>
    </div>
  );
};










