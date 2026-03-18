import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, useReactFlow } from '@xyflow/react';
import { Video, Upload, X } from 'lucide-react';
import type { VideoInputNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { NodeContainer } from './shared/NodeContainer';
import { NodeLabel } from './shared/node-label';
import { NodeHeader } from './shared/node-header';
import { NodeActionBar } from './shared/NodeActionBar';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { NodeButton } from './shared/node-button'
import { Input } from '@/components/ui/input'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const VideoInputNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const { getZoom } = useReactFlow();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const nodeData = data as VideoInputNodeData;
  const [uploadedVideo, setUploadedVideo] = useState<string | undefined>(nodeData.uploadedVideo || nodeData.uploadedVideoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasUploadedVideo = !!uploadedVideo;

  useEffect(() => {
    setUploadedVideo(nodeData.uploadedVideo || nodeData.uploadedVideoUrl);
  }, [nodeData.uploadedVideo, nodeData.uploadedVideoUrl]);

  const handleVideoRemove = () => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { uploadedVideo: undefined, uploadedVideoUrl: undefined });
    }
    setUploadedVideo(undefined);
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nodeData.onUploadVideo) return;

    if (!file.type.startsWith('video/')) {
      toast.error(t('common.pleaseSelectVideoFile'), { duration: 3000 });
      return;
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('common.videoFileSizeExceeds'), { duration: 5000 });
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      if (nodeData.onUploadVideo) {
        await nodeData.onUploadVideo(id, file);
      }
    } catch (error: any) {
      toast.error(error?.message || t('common.failedToProcessVideo'), { duration: 5000 });
      console.error('Failed to process uploaded video:', error);
    }
  };

  const getVideoDisplayUrl = (video: string): string => {
    return video;
  };

  const handleFitToContent = useCallback(() => {
    const width = nodeData.imageWidth;
    const height = nodeData.imageHeight;

    if (width && height) {
      let targetWidth = width;
      let targetHeight = height;
      const MAX_FIT_WIDTH = 1200;

      if (targetWidth > MAX_FIT_WIDTH) {
        const ratio = MAX_FIT_WIDTH / targetWidth;
        targetWidth = MAX_FIT_WIDTH;
        targetHeight = targetHeight * ratio;
      }

      fitToContent(id, Math.round(targetWidth), Math.round(targetHeight), nodeData.onResize);
    }
  }, [id, nodeData.imageWidth, nodeData.imageHeight, nodeData.onResize, fitToContent]);

  const handleResize = useCallback((_: any, params: { width: number; height: number }) => {
    handleResizeWithDebounce(id, params.width, 'auto', nodeData.onResize as any);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className="min-w-[320px]"
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={320}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          keepAspectRatio={hasUploadedVideo}
          onResize={handleResize}
        />
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-brand-cyan border-2 border-black node-handle"
      />

      <NodeHeader icon={Video} title={t('canvasNodes.videoInputNode.title') || 'Video Input'} />

      <div className="mb-4">
        <Input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="hidden"
          aria-label={t('common.uploadVideo')}
        />
        <NodeButton 
          onClick={handleUploadClick}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full"
        >
          <Upload size={14} />
          {t('canvasNodes.videoInputNode.uploadVideo') || 'Upload Video'}
        </NodeButton>
      </div>

      {hasUploadedVideo && (
        <div className="mb-4">
          <NodeLabel>
            {t('canvasNodes.videoInputNode.uploadedVideo') || 'Uploaded Video'}
          </NodeLabel>
          <div className="relative">
            <video
              src={getVideoDisplayUrl(uploadedVideo)}
              controls
              autoPlay
              muted
              loop
              className="w-full h-auto min-h-[128px] object-contain rounded border border-[brand-cyan]/30"
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement;
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  if (nodeData.onUpdateData) {
                    nodeData.onUpdateData(id, {
                      imageWidth: video.videoWidth,
                      imageHeight: video.videoHeight,
                    });
                  }
                }
              }}
              onError={(e) => {
                const target = e.target as HTMLVideoElement;
                target.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

      {!dragging && hasUploadedVideo && (
        <NodeActionBar selected={selected} getZoom={getZoom}>
          <NodeButton variant="ghost" size="xs"
            onClick={(e) => {
              e.stopPropagation();
              handleVideoRemove();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 backdrop-blur-sm border border-red-500/20 hover:border-red-500/30"
            title={t('canvasNodes.videoInputNode.removeVideo') || 'Remove Video'}
          >
            <X size={12} strokeWidth={2} />
          </NodeButton>
        </NodeActionBar>
      )}
    </NodeContainer>
  );
}, (prevProps, nextProps) => {
  const prevData = prevProps.data as VideoInputNodeData;
  const nextData = nextProps.data as VideoInputNodeData;

  return (
    prevData.uploadedVideo === nextData.uploadedVideo &&
    prevData.uploadedVideoUrl === nextData.uploadedVideoUrl &&
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging
  );
});

VideoInputNode.displayName = 'VideoInputNode';
