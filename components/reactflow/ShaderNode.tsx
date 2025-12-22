import React, { useEffect, memo, useRef, useCallback, useState } from 'react';
import { type NodeProps, type Node, NodeResizer, useReactFlow } from '@xyflow/react';
import { useParams } from 'react-router-dom';
import { Sparkles, Download, Maximize2, Upload, Loader2, Video, Image as ImageIcon, X } from 'lucide-react';
import type { ShaderNodeData } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { NodeHandles } from './shared/NodeHandles';
import { NodeContainer } from './shared/NodeContainer';
import { NodePlaceholder } from './shared/NodePlaceholder';
import { RealtimeShaderVideo } from './shared/RealtimeShaderVideo';
import { useTranslation } from '../../hooks/useTranslation';
import { useNodeDownload } from './shared/useNodeDownload';
import { fileToBase64, videoToBase64 } from '../../utils/fileUtils';
import { canvasApi } from '../../services/canvasApi';
import { toast } from 'sonner';
import type { ShaderSettings } from '../../utils/shaders/shaderRenderer';

const ShaderNodeComponent: React.FC<NodeProps<Node<ShaderNodeData>>> = ({ data, selected, id, dragging }) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const { id: canvasId } = useParams<{ id: string }>();
  const isLoading = data.isLoading || false;
  const hasResult = !!(data.resultImageUrl || data.resultImageBase64 || data.resultVideoUrl || data.resultVideoBase64);
  const hasVideoResult = !!(data.resultVideoUrl || data.resultVideoBase64);
  const hasConnectedImage = !!data.connectedImage;
  const isVideoInput = data.connectedImage ?
    (data.connectedImage.startsWith('data:video/') || /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(data.connectedImage) || data.connectedImage.includes('video')) :
    false;
  const previousConnectedImageRef = useRef<string | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const loadingStartTimeRef = useRef<number | null>(null);
  const previousSettingsRef = useRef<{
    shaderType: string;
    halftoneVariant?: string;
    dotSize?: number;
    angle?: number;
    contrast?: number;
    spacing?: number;
    halftoneThreshold?: number;
    tapeWaveIntensity?: number;
    tapeCreaseIntensity?: number;
    switchingNoiseIntensity?: number;
    bloomIntensity?: number;
    acBeatIntensity?: number;
    matrixSize?: number;
    bias?: number;
    ditherSize?: number;
    ditherContrast?: number;
    offset?: number;
    bitDepth?: number;
    palette?: number;
    asciiCharSize?: number;
    asciiContrast?: number;
    asciiBrightness?: number;
    asciiCharSet?: number;
    asciiColored?: number;
    asciiInvert?: number;
    duotoneShadowColor?: [number, number, number];
    duotoneHighlightColor?: [number, number, number];
    duotoneIntensity?: number;
    duotoneContrast?: number;
    duotoneBrightness?: number;
  } | undefined>(undefined);

  // Shader type with default
  const shaderType = data.shaderType ?? 'halftone';
  const halftoneVariant = data.halftoneVariant ?? 'ellipse';
  const borderSize = 0; // Always 0, no borders

  // Halftone shader settings with defaults
  const dotSize = data.dotSize ?? 5.0;
  const angle = data.angle ?? 0.0;
  const contrast = data.contrast ?? 1.0;
  const spacing = data.spacing ?? 2.0;
  const halftoneThreshold = data.halftoneThreshold ?? 1.0;

  // VHS shader settings with defaults
  const tapeWaveIntensity = data.tapeWaveIntensity ?? 1.0;
  const tapeCreaseIntensity = data.tapeCreaseIntensity ?? 1.0;
  const switchingNoiseIntensity = data.switchingNoiseIntensity ?? 1.0;
  const bloomIntensity = data.bloomIntensity ?? 1.0;
  const acBeatIntensity = data.acBeatIntensity ?? 1.0;

  // Matrix Dither shader settings with defaults
  const matrixSize = data.matrixSize ?? 4.0;
  const bias = data.bias ?? 0.0;

  // Dither shader settings with defaults
  const ditherSize = data.ditherSize ?? 4.0;
  const ditherContrast = data.ditherContrast ?? 1.5;
  const offset = data.offset ?? 0.0;
  const bitDepth = data.bitDepth ?? 4.0;
  const palette = data.palette ?? 0.0;

  // ASCII shader settings with defaults
  const asciiCharSize = data.asciiCharSize ?? 8.0;
  const asciiContrast = data.asciiContrast ?? 1.0;
  const asciiBrightness = data.asciiBrightness ?? 0.0;
  const asciiCharSet = data.asciiCharSet ?? 3.0;
  const asciiColored = data.asciiColored ?? 0.0;
  const asciiInvert = data.asciiInvert ?? 0.0;

  // Duotone shader settings with defaults
  const duotoneShadowColor = data.duotoneShadowColor ?? [0.1, 0.0, 0.2] as [number, number, number];
  const duotoneHighlightColor = data.duotoneHighlightColor ?? [0.3, 0.9, 0.9] as [number, number, number];
  const duotoneIntensity = data.duotoneIntensity ?? 1.0;
  const duotoneContrast = data.duotoneContrast ?? 1.0;
  const duotoneBrightness = data.duotoneBrightness ?? 0.0;

  // Prioritize base64 for immediate display (real-time preview)
  // Only use URL if base64 is not available
  const resultImageUrl = (data.resultImageBase64 ? `data:image/png;base64,${data.resultImageBase64}` : null) || data.resultImageUrl || null;
  const resultVideoUrl = data.resultVideoUrl || (data.resultVideoBase64 ? (data.resultVideoBase64.startsWith('data:') ? data.resultVideoBase64 : `data:video/webm;base64,${data.resultVideoBase64}`) : null);
  const { handleDownload } = useNodeDownload(hasVideoResult ? resultVideoUrl : resultImageUrl, 'shader-result');

  // Build shader settings object for real-time rendering
  const shaderSettings: ShaderSettings = {
    shaderType,
    halftoneVariant: shaderType === 'halftone' ? halftoneVariant : undefined,
    borderSize: 0,
    // Halftone
    dotSize: shaderType === 'halftone' ? dotSize : undefined,
    angle: shaderType === 'halftone' ? angle : undefined,
    contrast: shaderType === 'halftone' ? contrast : undefined,
    spacing: shaderType === 'halftone' ? spacing : undefined,
    halftoneThreshold: shaderType === 'halftone' ? halftoneThreshold : undefined,
    halftoneInvert: shaderType === 'halftone' ? (data.halftoneInvert ?? 0.0) : undefined,
    // VHS
    tapeWaveIntensity: shaderType === 'vhs' ? tapeWaveIntensity : undefined,
    tapeCreaseIntensity: shaderType === 'vhs' ? tapeCreaseIntensity : undefined,
    switchingNoiseIntensity: shaderType === 'vhs' ? switchingNoiseIntensity : undefined,
    bloomIntensity: shaderType === 'vhs' ? bloomIntensity : undefined,
    acBeatIntensity: shaderType === 'vhs' ? acBeatIntensity : undefined,
    // Matrix Dither
    matrixSize: shaderType === 'matrixDither' ? matrixSize : undefined,
    bias: shaderType === 'matrixDither' ? bias : undefined,
    // Dither
    ditherSize: shaderType === 'dither' ? ditherSize : undefined,
    ditherContrast: shaderType === 'dither' ? ditherContrast : undefined,
    ditherOffset: shaderType === 'dither' ? offset : undefined,
    ditherBitDepth: shaderType === 'dither' ? bitDepth : undefined,
    ditherPalette: shaderType === 'dither' ? palette : undefined,
    // ASCII
    asciiCharSize: shaderType === 'ascii' ? asciiCharSize : undefined,
    asciiContrast: shaderType === 'ascii' ? asciiContrast : undefined,
    asciiBrightness: shaderType === 'ascii' ? asciiBrightness : undefined,
    asciiCharSet: shaderType === 'ascii' ? asciiCharSet : undefined,
    asciiColored: shaderType === 'ascii' ? asciiColored : undefined,
    asciiInvert: shaderType === 'ascii' ? asciiInvert : undefined,
    // Duotone
    duotoneShadowColor: shaderType === 'duotone' ? duotoneShadowColor : undefined,
    duotoneHighlightColor: shaderType === 'duotone' ? duotoneHighlightColor : undefined,
    duotoneIntensity: shaderType === 'duotone' ? duotoneIntensity : undefined,
    duotoneContrast: shaderType === 'duotone' ? duotoneContrast : undefined,
    duotoneBrightness: shaderType === 'duotone' ? duotoneBrightness : undefined,
  };

  // Handle file upload (image or video)
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const supportedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];

    if (!isImage && !isVideo) {
      toast.error(t('common.unsupportedFileType'));
      return;
    }

    if (isImage && !supportedImageTypes.includes(file.type)) {
      toast.error(t('common.unsupportedImageType'));
      return;
    }

    if (isVideo && !supportedVideoTypes.includes(file.type)) {
      toast.error(t('common.unsupportedVideoType'));
      return;
    }

    // Check file size (max 10MB for images, 50MB for videos)
    const maxImageSize = 10 * 1024 * 1024;
    const maxVideoSize = 50 * 1024 * 1024;
    const maxSize = isImage ? maxImageSize : maxVideoSize;

    if (file.size > maxSize) {
      const maxSizeMB = isImage ? 10 : 50;
      toast.error(isImage ? t('common.imageTooLarge', { maxSize: maxSizeMB }) : t('common.videoTooLarge', { maxSize: maxSizeMB }));
      return;
    }

    try {
      if (isVideo && canvasId) {
        // For videos: upload directly to R2 and store only the URL
        toast.info(t('common.uploadingVideo'), { duration: 2000 });
        const videoUrl = await canvasApi.uploadVideoToR2Direct(file, canvasId, id);

        // Update node with R2 URL only (no base64)
        if (data.onUpdateData) {
          data.onUpdateData(id, { connectedImage: videoUrl });
        }

        toast.success(t('common.videoUploadedSuccess'), { duration: 2000 });
      } else {
        // For images: use base64 (can be converted to R2 later if needed)
        let dataUrl: string;

        if (isVideo) {
          // Fallback: if no canvasId, use base64
          const videoData = await videoToBase64(file);
          dataUrl = `data:${videoData.mimeType};base64,${videoData.base64}`;
        } else {
          const imageData = await fileToBase64(file);
          dataUrl = `data:${imageData.mimeType};base64,${imageData.base64}`;
        }

        // Update node with uploaded file
        if (data.onUpdateData) {
          data.onUpdateData(id, { connectedImage: dataUrl });
        }

        toast.success(isImage ? t('common.imageUploadedSuccess') : t('common.videoUploadedSuccess'));
      }
    } catch (error) {
      console.error(`Error uploading ${isImage ? 'image' : 'video'}:`, error);
      toast.error(isImage ? t('common.failedToUploadImage') : t('common.failedToUploadVideo'));
    }

    // Reset input to allow uploading the same file again
    e.target.value = '';
  }, [data, id]);

  // Auto-apply shader when image is connected or settings change
  useEffect(() => {
    const currentConnectedImage = data.connectedImage;
    const previousConnectedImage = previousConnectedImageRef.current;
    const currentSettings = {
      shaderType,
      halftoneVariant: shaderType === 'halftone' ? halftoneVariant : undefined,
      dotSize: shaderType === 'halftone' ? dotSize : undefined,
      angle: shaderType === 'halftone' ? angle : undefined,
      contrast: shaderType === 'halftone' ? contrast : undefined,
      spacing: shaderType === 'halftone' ? spacing : undefined,
      halftoneThreshold: shaderType === 'halftone' ? halftoneThreshold : undefined,
      tapeWaveIntensity: shaderType === 'vhs' ? tapeWaveIntensity : undefined,
      tapeCreaseIntensity: shaderType === 'vhs' ? tapeCreaseIntensity : undefined,
      switchingNoiseIntensity: shaderType === 'vhs' ? switchingNoiseIntensity : undefined,
      bloomIntensity: shaderType === 'vhs' ? bloomIntensity : undefined,
      acBeatIntensity: shaderType === 'vhs' ? acBeatIntensity : undefined,
      matrixSize: shaderType === 'matrixDither' ? matrixSize : undefined,
      bias: shaderType === 'matrixDither' ? bias : undefined,
      ditherSize: shaderType === 'dither' ? ditherSize : undefined,
      ditherContrast: shaderType === 'dither' ? ditherContrast : undefined,
      offset: shaderType === 'dither' ? offset : undefined,
      bitDepth: shaderType === 'dither' ? bitDepth : undefined,
      palette: shaderType === 'dither' ? palette : undefined,
      asciiCharSize: shaderType === 'ascii' ? asciiCharSize : undefined,
      asciiContrast: shaderType === 'ascii' ? asciiContrast : undefined,
      asciiBrightness: shaderType === 'ascii' ? asciiBrightness : undefined,
      asciiCharSet: shaderType === 'ascii' ? asciiCharSet : undefined,
      asciiColored: shaderType === 'ascii' ? asciiColored : undefined,
      asciiInvert: shaderType === 'ascii' ? asciiInvert : undefined,
      duotoneShadowColor: shaderType === 'duotone' ? duotoneShadowColor : undefined,
      duotoneHighlightColor: shaderType === 'duotone' ? duotoneHighlightColor : undefined,
      duotoneIntensity: shaderType === 'duotone' ? duotoneIntensity : undefined,
      duotoneContrast: shaderType === 'duotone' ? duotoneContrast : undefined,
      duotoneBrightness: shaderType === 'duotone' ? duotoneBrightness : undefined,
    };
    const previousSettings = previousSettingsRef.current;

    // Check if this is the initial mount (no previous settings/image tracked)
    const isInitialMount = previousSettings === undefined && previousConnectedImage === undefined;

    // Check if settings changed
    const settingsChanged = !previousSettings ||
      previousSettings.shaderType !== currentSettings.shaderType ||
      previousSettings.halftoneVariant !== currentSettings.halftoneVariant ||
      (shaderType === 'halftone' && (
        previousSettings.dotSize !== currentSettings.dotSize ||
        previousSettings.angle !== currentSettings.angle ||
        previousSettings.contrast !== currentSettings.contrast ||
        previousSettings.spacing !== currentSettings.spacing ||
        previousSettings.halftoneThreshold !== currentSettings.halftoneThreshold
      )) ||
      (shaderType === 'vhs' && (
        previousSettings.tapeWaveIntensity !== currentSettings.tapeWaveIntensity ||
        previousSettings.tapeCreaseIntensity !== currentSettings.tapeCreaseIntensity ||
        previousSettings.switchingNoiseIntensity !== currentSettings.switchingNoiseIntensity ||
        previousSettings.bloomIntensity !== currentSettings.bloomIntensity ||
        previousSettings.acBeatIntensity !== currentSettings.acBeatIntensity
      )) ||
      (shaderType === 'matrixDither' && (
        previousSettings.matrixSize !== currentSettings.matrixSize ||
        previousSettings.bias !== currentSettings.bias
      )) ||
      (shaderType === 'dither' && (
        previousSettings.ditherSize !== currentSettings.ditherSize ||
        previousSettings.ditherContrast !== currentSettings.ditherContrast ||
        previousSettings.offset !== currentSettings.offset ||
        previousSettings.bitDepth !== currentSettings.bitDepth ||
        previousSettings.palette !== currentSettings.palette
      )) ||
      (shaderType === 'ascii' && (
        previousSettings.asciiCharSize !== currentSettings.asciiCharSize ||
        previousSettings.asciiContrast !== currentSettings.asciiContrast ||
        previousSettings.asciiBrightness !== currentSettings.asciiBrightness ||
        previousSettings.asciiCharSet !== currentSettings.asciiCharSet ||
        previousSettings.asciiColored !== currentSettings.asciiColored ||
        previousSettings.asciiInvert !== currentSettings.asciiInvert
      )) ||
      (shaderType === 'duotone' && (
        JSON.stringify(previousSettings.duotoneShadowColor) !== JSON.stringify(currentSettings.duotoneShadowColor) ||
        JSON.stringify(previousSettings.duotoneHighlightColor) !== JSON.stringify(currentSettings.duotoneHighlightColor) ||
        previousSettings.duotoneIntensity !== currentSettings.duotoneIntensity ||
        previousSettings.duotoneContrast !== currentSettings.duotoneContrast ||
        previousSettings.duotoneBrightness !== currentSettings.duotoneBrightness
      ));

    // Check if image changed
    const imageChanged = currentConnectedImage !== previousConnectedImage;

    // Only auto-apply if:
    // 1. There's a connected image
    // 2. (Initial mount without result OR the connected image changed OR (settings changed AND not video))
    // 3. Not currently loading
    // 4. Handler is available
    // For videos: real-time rendering handles settings changes, no need to reprocess
    // For images: reprocess when settings change
    const shouldApply = currentConnectedImage &&
      !isLoading &&
      data.onApply &&
      (
        (isInitialMount && !hasResult) || // Initial mount: only if no result exists
        imageChanged || // Always reapply when image changes
        (settingsChanged && !isVideoInput) // For images: reapply when settings change (videos use real-time rendering)
      );

    if (shouldApply) {
      // Update refs immediately to prevent duplicate calls
      previousConnectedImageRef.current = currentConnectedImage;
      previousSettingsRef.current = currentSettings;

      // Apply shader immediately for both image and settings changes
      data.onApply(id, currentConnectedImage).catch((error) => {
        console.error('[ShaderNode] Error auto-applying shader:', error);
      });
    } else if (!currentConnectedImage) {
      // Clear refs when image is disconnected
      previousConnectedImageRef.current = undefined;
      previousSettingsRef.current = undefined;
    } else if (currentConnectedImage === previousConnectedImage && !settingsChanged) {
      // Update settings ref even if image didn't change (for next time)
      previousSettingsRef.current = currentSettings;
    }
  }, [
    data.connectedImage,
    data.onApply,
    id,
    isLoading,
    hasResult,
    shaderType,
    halftoneVariant,
    dotSize,
    angle,
    contrast,
    spacing,
    halftoneThreshold,
    tapeWaveIntensity,
    tapeCreaseIntensity,
    switchingNoiseIntensity,
    bloomIntensity,
    acBeatIntensity,
    matrixSize,
    bias,
    ditherSize,
    ditherContrast,
    offset,
    bitDepth,
    palette,
    asciiCharSize,
    asciiContrast,
    asciiBrightness,
    asciiCharSet,
    asciiColored,
    asciiInvert,
    duotoneShadowColor,
    duotoneHighlightColor,
    duotoneIntensity,
    duotoneContrast,
    duotoneBrightness,
  ]);

  const handleApply = async () => {
    if (!data.onApply) {
      return;
    }

    const connectedImageFromData = data.connectedImage;

    if (!connectedImageFromData) {
      return;
    }

    await data.onApply(id, connectedImageFromData);
  };

  const handleResize = useCallback((_: any, params: { width: number; height: number }) => {
    const { width, height } = params;
    setNodes((nds) => {
      return nds.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            style: {
              ...n.style,
              width,
              height,
            },
          };
        }
        return n;
      });
    });
  }, [id, setNodes]);

  // Timer for loading state (similar to OutputNode)
  useEffect(() => {
    if (isLoading) {
      // Start timer when loading begins
      if (loadingStartTimeRef.current === null) {
        loadingStartTimeRef.current = Date.now();
        setElapsedTime(0);
      }

      // Update timer every second
      const interval = setInterval(() => {
        if (loadingStartTimeRef.current !== null) {
          const elapsed = Math.floor((Date.now() - loadingStartTimeRef.current) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    } else {
      // Reset timer when loading ends
      loadingStartTimeRef.current = null;
      setElapsedTime(0);
    }
  }, [isLoading]);

  // Control video playback - auto-play connected video in loop, unmute on hover
  useEffect(() => {
    if (videoRef.current) {
      if (hasConnectedImage && isVideoInput) {
        // Auto-play connected video in loop
        videoRef.current.loop = true;
        videoRef.current.muted = !isHovered;
        videoRef.current.play().catch((e) => {
          // Ignore play errors (e.g., autoplay restrictions)
          console.debug('Video play:', e);
        });
      } else if (hasResult && hasVideoResult) {
        // For result video, play on hover
        if (isHovered) {
          videoRef.current.muted = false;
          videoRef.current.play().catch((e) => {
            console.debug('Video play on hover:', e);
          });
        } else {
          videoRef.current.muted = true;
        }
      }
    }
  }, [isHovered, hasConnectedImage, isVideoInput, hasResult, hasVideoResult]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      warning={data.oversizedWarning}
      className="p-6 min-w-[320px] w-full h-full"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="#52ddeb"
          isVisible={selected}
          minWidth={320}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          onResize={handleResize}
        />
      )}
      <NodeHandles />

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Sparkles size={16} className="text-[#52ddeb]" />
        <h3 className="text-xs font-semibold text-zinc-300 font-mono">Shader Effect</h3>
      </div>

      {/* Status/Info - Show manual apply option when ready (only for images, videos auto-process) */}
      {!isLoading && hasConnectedImage && !hasResult && !isVideoInput ? (
        <div className="w-full px-2 py-1.5 bg-zinc-800/30 border border-zinc-700/30 rounded text-xs font-mono text-zinc-400 flex items-center justify-center gap-3">
          <ImageIcon size={14} className="text-[#52ddeb]" />
          Ready to process
        </div>
      ) : null}

      {!hasConnectedImage ? (
        <div className="w-full space-y-2">
          <div className="w-full px-2 py-1.5 bg-zinc-800/30 border border-zinc-700/30 rounded text-xs font-mono text-zinc-500 flex items-center justify-center gap-3 opacity-50">
            <ImageIcon size={14} />
            {t('canvasNodes.shaderNode.connectImage') || 'Connect an image or video'}
          </div>
          <label className="w-full px-3 py-2 bg-[#52ddeb]/10 hover:bg-[#52ddeb]/20 border border-[#52ddeb]/30 hover:border-[#52ddeb]/50 rounded text-xs font-mono text-[#52ddeb] flex items-center justify-center gap-2 cursor-pointer transition-all">
            <Upload size={14} />
            {t('canvasNodes.shaderNode.uploadImageOrVideo') || 'Upload Image or Video'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      ) : hasConnectedImage && !hasResult && !isVideoInput && !isLoading ? (
        <div className="w-full px-2 py-1.5 bg-zinc-800/30 border border-zinc-700/30 rounded text-xs font-mono text-zinc-400 flex items-center justify-center gap-3">
          <ImageIcon size={14} className="text-[#52ddeb]" />
          <span>Image connected - Processing...</span>
        </div>
      ) : null}

      {/* Connected Video Preview - Show connected video in loop when no result yet, or loading state */}
      {hasConnectedImage && isVideoInput && !hasResult && (
        <>
          {isLoading ? (
            <div className="mt-2 pt-2 border-t border-zinc-700/30 flex-1 min-h-[200px] flex items-center justify-center">
              <NodePlaceholder
                isLoading={true}
                emptyMessage={t('canvasNodes.shaderNode.processingVideo') || 'Processing video frames...'}
                emptySubmessage={t('canvasNodes.shaderNode.applyingShader') || 'Applying shader effect'}
                elapsedTime={elapsedTime}
              />
            </div>
          ) : (
            <div
              className="mt-2 pt-2 border-t border-zinc-700/30 relative group flex-1 min-h-0 flex flex-col"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className="relative w-full h-full flex items-center justify-center min-h-[200px]">
                <RealtimeShaderVideo
                  videoSrc={data.connectedImage || ''}
                  settings={shaderSettings}
                  className="w-full h-full object-contain rounded"
                  loop={true}
                  muted={!isHovered}
                  playsInline={true}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Result Preview with Action Icons */}
      {hasResult && (hasVideoResult ? resultVideoUrl : resultImageUrl) && (
        <div
          className="mt-2 pt-2 border-t border-zinc-700/30 relative group flex-1 min-h-0 flex flex-col"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {hasVideoResult ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                src={resultVideoUrl || undefined}
                controls
                loop
                muted={!isHovered}
                playsInline
                className="w-full h-full object-contain rounded"
                onError={(e) => {
                  const target = e.target as HTMLVideoElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={resultImageUrl || undefined}
                alt={t('common.shaderResult')}
                className="w-full h-full object-contain rounded"
              />
            </div>
          )}

          {/* Floating Processing Indicator - subtle icon button */}
          {isLoading && (
            <div className="absolute top-3 left-3 z-20">
              <div className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm border border-[#52ddeb]/30 shadow-lg">
                <Loader2 size={14} className="text-[#52ddeb] animate-spin" />
              </div>
            </div>
          )}

          {/* Action Icons - appears on hover or when selected */}
          <div className={cn(
            "absolute top-3 right-3 flex gap-1.5 transition-all backdrop-blur-sm z-10",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (data.onViewFullscreen) {
                  const paletteNames = ['Monochrome', 'Gameboy', 'CRT Amber', 'CRT Green', 'Sepia'];
                  const sliders = shaderType === 'halftone' ? [
                    {
                      label: 'Dot Size',
                      value: dotSize,
                      min: 0.1,
                      max: 20,
                      step: 0.1,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { dotSize: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(1),
                    },
                    {
                      label: 'Angle',
                      value: angle,
                      min: 0,
                      max: 360,
                      step: 1,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { angle: value });
                        }
                      },
                      formatValue: (value: number) => `${Math.round(value)}°`,
                    },
                    {
                      label: 'Contrast',
                      value: contrast,
                      min: 0,
                      max: 2,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { contrast: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                    {
                      label: 'Spacing',
                      value: spacing,
                      min: 0.5,
                      max: 5,
                      step: 0.1,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { spacing: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(1),
                    },
                  ] : shaderType === 'dither' ? [
                    {
                      label: 'Dither Size',
                      value: ditherSize,
                      min: 1,
                      max: 16,
                      step: 1,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { ditherSize: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(0),
                    },
                    {
                      label: 'Contrast',
                      value: ditherContrast,
                      min: 0.1,
                      max: 3,
                      step: 0.1,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { ditherContrast: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(1),
                    },
                    {
                      label: 'Offset',
                      value: offset,
                      min: -0.5,
                      max: 0.5,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { offset: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                    {
                      label: 'Bit Depth',
                      value: bitDepth,
                      min: 1,
                      max: 8,
                      step: 1,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { bitDepth: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(0),
                    },
                    {
                      label: 'Palette',
                      value: palette,
                      min: 0,
                      max: 4,
                      step: 1,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { palette: value });
                        }
                      },
                      formatValue: (value: number) => paletteNames[Math.floor(value)] || 'Monochrome',
                    },
                  ] : shaderType === 'matrixDither' ? [
                    {
                      label: 'Matrix Size',
                      value: matrixSize,
                      min: 2,
                      max: 8,
                      step: 1,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { matrixSize: value });
                        }
                      },
                      formatValue: (value: number) => `${value.toFixed(0)}x${value.toFixed(0)}`,
                    },
                    {
                      label: 'Bias',
                      value: bias,
                      min: -1,
                      max: 1,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { bias: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                  ] : shaderType === 'ascii' ? [
                    {
                      label: 'Character Size',
                      value: asciiCharSize,
                      min: 2,
                      max: 32,
                      step: 1,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { asciiCharSize: value });
                        }
                      },
                      formatValue: (value: number) => `${value.toFixed(0)}px`,
                    },
                    {
                      label: 'Contrast',
                      value: asciiContrast,
                      min: 0.1,
                      max: 3,
                      step: 0.1,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { asciiContrast: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(1),
                    },
                    {
                      label: 'Brightness',
                      value: asciiBrightness,
                      min: -0.5,
                      max: 0.5,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { asciiBrightness: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                  ] : shaderType === 'duotone' ? [
                    {
                      label: 'Intensity',
                      value: duotoneIntensity,
                      min: 0,
                      max: 1,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { duotoneIntensity: value });
                        }
                      },
                      formatValue: (value: number) => `${Math.round(value * 100)}%`,
                    },
                    {
                      label: 'Contrast',
                      value: duotoneContrast,
                      min: 0.5,
                      max: 2,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { duotoneContrast: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                    {
                      label: 'Brightness',
                      value: duotoneBrightness,
                      min: -0.5,
                      max: 0.5,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { duotoneBrightness: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                  ] : [
                    {
                      label: 'Tape Wave',
                      value: tapeWaveIntensity,
                      min: 0,
                      max: 2,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { tapeWaveIntensity: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                    {
                      label: 'Tape Crease',
                      value: tapeCreaseIntensity,
                      min: 0,
                      max: 2,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { tapeCreaseIntensity: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                    {
                      label: 'Switching Noise',
                      value: switchingNoiseIntensity,
                      min: 0,
                      max: 2,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { switchingNoiseIntensity: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                    {
                      label: 'Bloom',
                      value: bloomIntensity,
                      min: 0,
                      max: 2,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { bloomIntensity: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                    {
                      label: 'AC Beat',
                      value: acBeatIntensity,
                      min: 0,
                      max: 2,
                      step: 0.01,
                      onChange: (value: number) => {
                        if (data.onUpdateData) {
                          data.onUpdateData(id, { acBeatIntensity: value });
                        }
                      },
                      formatValue: (value: number) => value.toFixed(2),
                    },
                  ];

                  data.onViewFullscreen(
                    resultImageUrl,
                    data.resultImageBase64,
                    sliders
                  );
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white border border-zinc-700/50 hover:border-zinc-600/70 transition-all"
              title={t('common.viewFullscreen')}
            >
              <Maximize2 size={14} strokeWidth={2} />
            </button>
            <button
              onClick={handleDownload}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white border border-zinc-700/50 hover:border-zinc-600/70 transition-all"
              title={hasVideoResult ? t('common.downloadVideo') : t('common.downloadImage')}
            >
              <Download size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

    </NodeContainer>
  );
};

export const ShaderNode = memo(ShaderNodeComponent, (prevProps, nextProps) => {
  const prevConnectedImage = prevProps.data.connectedImage ?? undefined;
  const nextConnectedImage = nextProps.data.connectedImage ?? undefined;
  const connectedImageChanged = prevConnectedImage !== nextConnectedImage;

  const prevShaderType = prevProps.data.shaderType ?? 'halftone';
  const nextShaderType = nextProps.data.shaderType ?? 'halftone';
  const prevHalftoneVariant = prevProps.data.halftoneVariant ?? 'ellipse';
  const nextHalftoneVariant = nextProps.data.halftoneVariant ?? 'ellipse';

  const prevSettings = {
    shaderType: prevShaderType,
    halftoneVariant: prevShaderType === 'halftone' ? prevHalftoneVariant : undefined,
    dotSize: prevShaderType === 'halftone' ? (prevProps.data.dotSize ?? 5.0) : undefined,
    angle: prevShaderType === 'halftone' ? (prevProps.data.angle ?? 0.0) : undefined,
    contrast: prevShaderType === 'halftone' ? (prevProps.data.contrast ?? 1.0) : undefined,
    spacing: prevShaderType === 'halftone' ? (prevProps.data.spacing ?? 2.0) : undefined,
    halftoneThreshold: prevShaderType === 'halftone' ? (prevProps.data.halftoneThreshold ?? 1.0) : undefined,
    tapeWaveIntensity: prevShaderType === 'vhs' ? (prevProps.data.tapeWaveIntensity ?? 1.0) : undefined,
    tapeCreaseIntensity: prevShaderType === 'vhs' ? (prevProps.data.tapeCreaseIntensity ?? 1.0) : undefined,
    switchingNoiseIntensity: prevShaderType === 'vhs' ? (prevProps.data.switchingNoiseIntensity ?? 1.0) : undefined,
    bloomIntensity: prevShaderType === 'vhs' ? (prevProps.data.bloomIntensity ?? 1.0) : undefined,
    acBeatIntensity: prevShaderType === 'vhs' ? (prevProps.data.acBeatIntensity ?? 1.0) : undefined,
    ditherSize: prevShaderType === 'dither' ? (prevProps.data.ditherSize ?? 4.0) : undefined,
    ditherContrast: prevShaderType === 'dither' ? (prevProps.data.ditherContrast ?? 1.5) : undefined,
    offset: prevShaderType === 'dither' ? (prevProps.data.offset ?? 0.0) : undefined,
    bitDepth: prevShaderType === 'dither' ? (prevProps.data.bitDepth ?? 4.0) : undefined,
    palette: prevShaderType === 'dither' ? (prevProps.data.palette ?? 0.0) : undefined,
    asciiCharSize: prevShaderType === 'ascii' ? (prevProps.data.asciiCharSize ?? 8.0) : undefined,
    asciiContrast: prevShaderType === 'ascii' ? (prevProps.data.asciiContrast ?? 1.0) : undefined,
    asciiBrightness: prevShaderType === 'ascii' ? (prevProps.data.asciiBrightness ?? 0.0) : undefined,
    asciiCharSet: prevShaderType === 'ascii' ? (prevProps.data.asciiCharSet ?? 3.0) : undefined,
    asciiColored: prevShaderType === 'ascii' ? (prevProps.data.asciiColored ?? 0.0) : undefined,
    asciiInvert: prevShaderType === 'ascii' ? (prevProps.data.asciiInvert ?? 0.0) : undefined,
    duotoneShadowColor: prevShaderType === 'duotone' ? (prevProps.data.duotoneShadowColor ?? [0.1, 0.0, 0.2]) : undefined,
    duotoneHighlightColor: prevShaderType === 'duotone' ? (prevProps.data.duotoneHighlightColor ?? [0.3, 0.9, 0.9]) : undefined,
    duotoneIntensity: prevShaderType === 'duotone' ? (prevProps.data.duotoneIntensity ?? 1.0) : undefined,
    duotoneContrast: prevShaderType === 'duotone' ? (prevProps.data.duotoneContrast ?? 1.0) : undefined,
    duotoneBrightness: prevShaderType === 'duotone' ? (prevProps.data.duotoneBrightness ?? 0.0) : undefined,
  };
  const nextSettings = {
    shaderType: nextShaderType,
    halftoneVariant: nextShaderType === 'halftone' ? nextHalftoneVariant : undefined,
    dotSize: nextShaderType === 'halftone' ? (nextProps.data.dotSize ?? 5.0) : undefined,
    angle: nextShaderType === 'halftone' ? (nextProps.data.angle ?? 0.0) : undefined,
    contrast: nextShaderType === 'halftone' ? (nextProps.data.contrast ?? 1.0) : undefined,
    spacing: nextShaderType === 'halftone' ? (nextProps.data.spacing ?? 2.0) : undefined,
    halftoneThreshold: nextShaderType === 'halftone' ? (nextProps.data.halftoneThreshold ?? 1.0) : undefined,
    tapeWaveIntensity: nextShaderType === 'vhs' ? (nextProps.data.tapeWaveIntensity ?? 1.0) : undefined,
    tapeCreaseIntensity: nextShaderType === 'vhs' ? (nextProps.data.tapeCreaseIntensity ?? 1.0) : undefined,
    switchingNoiseIntensity: nextShaderType === 'vhs' ? (nextProps.data.switchingNoiseIntensity ?? 1.0) : undefined,
    bloomIntensity: nextShaderType === 'vhs' ? (nextProps.data.bloomIntensity ?? 1.0) : undefined,
    acBeatIntensity: nextShaderType === 'vhs' ? (nextProps.data.acBeatIntensity ?? 1.0) : undefined,
    ditherSize: nextShaderType === 'dither' ? (nextProps.data.ditherSize ?? 4.0) : undefined,
    ditherContrast: nextShaderType === 'dither' ? (nextProps.data.ditherContrast ?? 1.5) : undefined,
    offset: nextShaderType === 'dither' ? (nextProps.data.offset ?? 0.0) : undefined,
    bitDepth: nextShaderType === 'dither' ? (nextProps.data.bitDepth ?? 4.0) : undefined,
    palette: nextShaderType === 'dither' ? (nextProps.data.palette ?? 0.0) : undefined,
    asciiCharSize: nextShaderType === 'ascii' ? (nextProps.data.asciiCharSize ?? 8.0) : undefined,
    asciiContrast: nextShaderType === 'ascii' ? (nextProps.data.asciiContrast ?? 1.0) : undefined,
    asciiBrightness: nextShaderType === 'ascii' ? (nextProps.data.asciiBrightness ?? 0.0) : undefined,
    asciiCharSet: nextShaderType === 'ascii' ? (nextProps.data.asciiCharSet ?? 3.0) : undefined,
    asciiColored: nextShaderType === 'ascii' ? (nextProps.data.asciiColored ?? 0.0) : undefined,
    asciiInvert: nextShaderType === 'ascii' ? (nextProps.data.asciiInvert ?? 0.0) : undefined,
    duotoneShadowColor: nextShaderType === 'duotone' ? (nextProps.data.duotoneShadowColor ?? [0.1, 0.0, 0.2]) : undefined,
    duotoneHighlightColor: nextShaderType === 'duotone' ? (nextProps.data.duotoneHighlightColor ?? [0.3, 0.9, 0.9]) : undefined,
    duotoneIntensity: nextShaderType === 'duotone' ? (nextProps.data.duotoneIntensity ?? 1.0) : undefined,
    duotoneContrast: nextShaderType === 'duotone' ? (nextProps.data.duotoneContrast ?? 1.0) : undefined,
    duotoneBrightness: nextShaderType === 'duotone' ? (nextProps.data.duotoneBrightness ?? 0.0) : undefined,
  };

  const settingsChanged =
    prevSettings.shaderType !== nextSettings.shaderType ||
    prevSettings.halftoneVariant !== nextSettings.halftoneVariant ||
    (nextShaderType === 'halftone' && (
      prevSettings.dotSize !== nextSettings.dotSize ||
      prevSettings.angle !== nextSettings.angle ||
      prevSettings.contrast !== nextSettings.contrast ||
      prevSettings.spacing !== nextSettings.spacing ||
      prevSettings.halftoneThreshold !== nextSettings.halftoneThreshold
    )) ||
    (nextShaderType === 'vhs' && (
      prevSettings.tapeWaveIntensity !== nextSettings.tapeWaveIntensity ||
      prevSettings.tapeCreaseIntensity !== nextSettings.tapeCreaseIntensity ||
      prevSettings.switchingNoiseIntensity !== nextSettings.switchingNoiseIntensity ||
      prevSettings.bloomIntensity !== nextSettings.bloomIntensity ||
      prevSettings.acBeatIntensity !== nextSettings.acBeatIntensity
    )) ||
    (nextShaderType === 'dither' && (
      prevSettings.ditherSize !== nextSettings.ditherSize ||
      prevSettings.ditherContrast !== nextSettings.ditherContrast ||
      prevSettings.offset !== nextSettings.offset ||
      prevSettings.bitDepth !== nextSettings.bitDepth ||
      prevSettings.palette !== nextSettings.palette
    )) ||
    (nextShaderType === 'ascii' && (
      prevSettings.asciiCharSize !== nextSettings.asciiCharSize ||
      prevSettings.asciiContrast !== nextSettings.asciiContrast ||
      prevSettings.asciiBrightness !== nextSettings.asciiBrightness ||
      prevSettings.asciiCharSet !== nextSettings.asciiCharSet ||
      prevSettings.asciiColored !== nextSettings.asciiColored ||
      prevSettings.asciiInvert !== nextSettings.asciiInvert
    )) ||
    (nextShaderType === 'duotone' && (
      JSON.stringify(prevSettings.duotoneShadowColor) !== JSON.stringify(nextSettings.duotoneShadowColor) ||
      JSON.stringify(prevSettings.duotoneHighlightColor) !== JSON.stringify(nextSettings.duotoneHighlightColor) ||
      prevSettings.duotoneIntensity !== nextSettings.duotoneIntensity ||
      prevSettings.duotoneContrast !== nextSettings.duotoneContrast ||
      prevSettings.duotoneBrightness !== nextSettings.duotoneBrightness
    ));

  if (connectedImageChanged || settingsChanged) {
    return false;
  }

  return (
    prevProps.id === nextProps.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging &&
    prevProps.data.isLoading === nextProps.data.isLoading &&
    prevProps.data.resultImageUrl === nextProps.data.resultImageUrl &&
    prevProps.data.resultImageBase64 === nextProps.data.resultImageBase64
  );
});

ShaderNode.displayName = 'ShaderNode';

