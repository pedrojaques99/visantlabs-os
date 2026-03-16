/**
 * NodeMediaDisplay
 *
 * Componente unificado para exibição de mídia (imagem/vídeo) em nodes.
 * Substitui a lógica duplicada de OutputNode, MergeNode, UpscaleNode, etc.
 *
 * Features:
 * - Detecção automática de vídeo vs imagem
 * - Placeholder integrado para estados vazios/loading
 * - Timer de elapsed time durante loading
 * - Callbacks para onLoad (captura dimensões)
 * - Suporte a dragging state
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { isSafeUrl } from '@/utils/imageUtils';
import { NodeImageContainer } from './NodeImageContainer';
import { NodePlaceholder } from './NodePlaceholder';

interface NodeMediaDisplayProps {
  /** URL da mídia (imagem ou vídeo) */
  url: string | null;
  /** Se é vídeo */
  isVideo?: boolean;
  /** Se está em loading */
  isLoading?: boolean;
  /** Se o node está sendo arrastado */
  dragging?: boolean;
  /** Mensagem quando vazio */
  emptyMessage?: string;
  /** Submensagem quando vazio */
  emptySubmessage?: string;
  /** Alt text para imagens */
  alt?: string;
  /** Callback quando mídia carrega (retorna dimensões) */
  onMediaLoad?: (width: number, height: number) => void;
  /** Classe CSS adicional */
  className?: string;
  /** Style inline */
  style?: React.CSSProperties;
}

export const NodeMediaDisplay: React.FC<NodeMediaDisplayProps> = ({
  url,
  isVideo = false,
  isLoading = false,
  dragging = false,
  emptyMessage = 'No output',
  emptySubmessage = 'Connect a node to see result',
  alt = 'Output',
  onMediaLoad,
  className,
  style
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const loadingStartTimeRef = useRef<number | null>(null);

  // Timer for loading state
  useEffect(() => {
    if (isLoading) {
      if (loadingStartTimeRef.current === null) {
        loadingStartTimeRef.current = Date.now();
        setElapsedTime(0);
      }

      const interval = setInterval(() => {
        if (loadingStartTimeRef.current !== null) {
          const elapsed = Math.floor((Date.now() - loadingStartTimeRef.current) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      loadingStartTimeRef.current = null;
      setElapsedTime(0);
    }
  }, [isLoading]);

  const hasMedia = !!url;

  // Validate URL
  const isValidUrl = (urlToCheck: string): boolean => {
    return isSafeUrl(urlToCheck) ||
      urlToCheck.startsWith('http') ||
      urlToCheck.startsWith('blob:') ||
      urlToCheck.startsWith('data:');
  };

  // Handle image load
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    if (img.naturalWidth > 0 && img.naturalHeight > 0 && onMediaLoad) {
      onMediaLoad(img.naturalWidth, img.naturalHeight);
    }
  };

  // Handle video load
  const handleVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.target as HTMLVideoElement;
    if (video.videoWidth > 0 && video.videoHeight > 0 && onMediaLoad) {
      onMediaLoad(video.videoWidth, video.videoHeight);
    }
  };

  // Handle image error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
    }
  };

  return (
    <NodeImageContainer
      className={cn('flex items-center justify-center', className)}
      style={{ width: '100%', height: '100%', flex: '1 1 0%', minHeight: 0, ...style }}
    >
      {isVideo && url ? (
        <div className="relative flex items-center justify-center group/video" style={{ width: '100%', height: '100%' }}>
          <video
            src={url}
            controls
            className={cn(
              'object-contain rounded-md node-image',
              dragging ? 'node-image-dragging' : 'node-image-static'
            )}
            style={{
              width: '100%',
              height: '100%',
            }}
            onLoadedMetadata={handleVideoLoad}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            Your browser does not support the video tag.
          </video>
          {isLoading && elapsedTime > 0 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10">
              <span className="text-neutral-500/40 text-[10px] font-mono">
                {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      ) : hasMedia && url && isValidUrl(url) ? (
        <div className="relative flex items-center justify-center group/image" style={{ width: '100%', height: '100%' }}>
          <img
            src={url}
            alt={alt}
            className={cn(
              'object-contain rounded-md node-image',
              dragging ? 'node-image-dragging' : 'node-image-static'
            )}
            style={{
              width: '100%',
              height: '100%',
            }}
            draggable={false}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
          {isLoading && elapsedTime > 0 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10">
              <span className="text-neutral-500/40 text-[10px] font-mono">
                {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      ) : (
        <NodePlaceholder
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          emptySubmessage={emptySubmessage}
          elapsedTime={isLoading ? elapsedTime : 0}
        />
      )}
    </NodeImageContainer>
  );
};

export default NodeMediaDisplay;
