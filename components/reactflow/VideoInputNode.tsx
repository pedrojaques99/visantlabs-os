import React, { useState, useEffect, memo, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Video, Upload, X } from 'lucide-react';
import type { VideoInputNodeData } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { NodeContainer } from './shared/NodeContainer';
import { NodeLabel } from './shared/node-label';
import { NodeHeader } from './shared/node-header';
import { useTranslation } from '../../hooks/useTranslation';
import { videoToBase64 } from '../../utils/fileUtils';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const VideoInputNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
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

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error(t('common.pleaseSelectVideoFile'), { duration: 3000 });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file size (50MB limit for videos)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('common.videoFileSizeExceeds'), { duration: 5000 });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      // Prefer passing File directly for upload (bypasses Vercel's 4.5MB limit)
      // Falls back to base64 if File upload fails
      if (nodeData.onUploadVideo) {
        // Try direct file upload first (better for large files)
        await nodeData.onUploadVideo(id, file);
      }
    } catch (error: any) {
      const errorMessage = error?.message || t('common.failedToProcessVideo');
      toast.error(errorMessage, { duration: 5000 });
      console.error('Failed to process uploaded video:', error);
    }
  };

  const getVideoDisplayUrl = (video: string): string => {
    if (video.startsWith('data:') || video.startsWith('http')) {
      return video;
    }
    return video; // Assume it's already a URL
  };

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="p-5 min-w-[320px]"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-brand-cyan border-2 border-black node-handle"
      />

      {/* Header */}
      <NodeHeader icon={Video} title={t('canvasNodes.videoInputNode.title') || 'Video Input'} />

      {/* Upload Video Section */}
      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="hidden"
          aria-label={t('common.uploadVideo')}
        />
        <button
          onClick={handleUploadClick}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            'w-full px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/30 rounded text-xs font-mono text-zinc-300 transition-colors flex items-center justify-center gap-2 node-interactive'
          )}
        >
          <Upload size={14} />
          {t('canvasNodes.videoInputNode.uploadVideo') || 'Upload Video'}
        </button>
      </div>

      {/* Uploaded Video Display */}
      {hasUploadedVideo && (
        <div className="mb-4">
          <NodeLabel>
            {t('canvasNodes.videoInputNode.uploadedVideo') || 'Uploaded Video'}
          </NodeLabel>
          <div className="relative group">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVideoRemove();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute top-0 right-0 w-5 h-5 bg-red-500/80 hover:bg-red-500 border border-black rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <X size={10} className="text-white" strokeWidth={3} />
            </button>
            <video
              src={getVideoDisplayUrl(uploadedVideo)}
              controls
              autoPlay
              muted
              loop
              className="w-full h-32 object-cover rounded border border-[#52ddeb]/30"
              onError={(e) => {
                const target = e.target as HTMLVideoElement;
                target.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
    </NodeContainer>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - re-render if important data changes
  const prevData = prevProps.data as VideoInputNodeData;
  const nextData = nextProps.data as VideoInputNodeData;
  
  if (prevData.uploadedVideo !== nextData.uploadedVideo ||
      prevData.uploadedVideoUrl !== nextData.uploadedVideoUrl ||
      prevProps.selected !== nextProps.selected ||
      prevProps.dragging !== nextProps.dragging) {
    return false; // Re-render
  }
  
  return true; // Skip re-render
});

VideoInputNode.displayName = 'VideoInputNode';

