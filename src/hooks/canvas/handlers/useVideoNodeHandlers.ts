import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, VideoNodeData, VideoInputNodeData, OutputNodeData, GenerateVideoParams } from '@/types/reactFlow';
import { videoApi } from '@/services/videoApi';
import { canvasApi } from '@/services/canvasApi';
import { validateVideoCredits } from '@/services/reactFlowService';
import { videoToBase64 } from '@/utils/fileUtils';
import { toast } from 'sonner';

interface UseVideoNodeHandlersParams {
  nodesRef: MutableRefObject<Node<FlowNodeData>[]>;
  edgesRef: MutableRefObject<Edge[]>;
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
  updateNodeLoadingState: <T extends FlowNodeData>(nodeId: string, isLoading: boolean, nodeType?: string) => void;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  addToHistory: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  canvasId?: string;
  createOutputNodeWithSkeleton: (sourceNode: Node<FlowNodeData>, sourceNodeId: string) => { node: Node<FlowNodeData>; edge: Edge; nodeId: string } | null;
  cleanupFailedNode: (nodeId: string | null) => void;
}

export const useVideoNodeHandlers = ({
  nodesRef,
  edgesRef,
  updateNodeData,
  updateNodeLoadingState,
  setNodes,
  setEdges,
  addToHistory,
  canvasId,
  createOutputNodeWithSkeleton,
  cleanupFailedNode,
}: UseVideoNodeHandlersParams) => {

  const handleVideoNodeDataUpdate = useCallback((nodeId: string, newData: Partial<VideoNodeData>) => {
    updateNodeData<VideoNodeData>(nodeId, newData, 'video');
  }, [updateNodeData]);

  const handleVideoInputNodeDataUpdate = useCallback((nodeId: string, newData: Partial<VideoInputNodeData>) => {
    updateNodeData<VideoInputNodeData>(nodeId, newData, 'videoInput');
  }, [updateNodeData]);

  const handleVideoInputNodeUpload = useCallback(async (nodeId: string, videoData: string | File) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'videoInput') return;

    const isFile = videoData instanceof File;
    let videoBase64: string;
    let videoFile: File | undefined;

    if (isFile) {
      videoFile = videoData;
      const result = await videoToBase64(videoFile);
      videoBase64 = `data:${result.mimeType};base64,${result.base64}`;
    } else {
      videoBase64 = videoData;
    }

    setNodes((nds) => nds.map((n) => {
      if (n.id === nodeId && n.type === 'videoInput') {
        return {
          ...n,
          data: { ...(n.data as VideoInputNodeData), uploadedVideo: videoBase64, uploadedVideoUrl: undefined } as VideoInputNodeData,
        } as Node<FlowNodeData>;
      }
      return n;
    }));

    if (canvasId) {
      try {
        const videoUrl = videoFile
          ? await canvasApi.uploadVideoToR2Direct(videoFile, canvasId, nodeId)
          : await canvasApi.uploadVideoToR2(videoBase64, canvasId, nodeId);

        setNodes((nds) => nds.map((n) => {
          if (n.id === nodeId && n.type === 'videoInput') {
            return {
              ...n,
              data: { ...(n.data as VideoInputNodeData), uploadedVideoUrl: videoUrl, uploadedVideo: videoBase64 } as VideoInputNodeData,
            } as Node<FlowNodeData>;
          }
          return n;
        }));
      } catch (error: any) {
        console.warn('Failed to upload video to R2 (keeping base64):', error);
      }
    }

    toast.success('Video uploaded!', { id: `upload-video-${nodeId}`, duration: 2000 });
  }, [nodesRef, setNodes, canvasId]);

  const handleVideoNodeGenerate = useCallback(async (params: GenerateVideoParams) => {
    const { nodeId } = params;
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'video') return;

    const videoData = node.data as VideoNodeData;
    const hasCredits = await validateVideoCredits();
    if (!hasCredits || videoData.isLoading) return;

    updateNodeLoadingState<VideoNodeData>(nodeId, true, 'video');

    let newOutputNodeId: string | null = null;
    const skeletonNode = createOutputNodeWithSkeleton(node, nodeId);

    if (skeletonNode) {
      newOutputNodeId = skeletonNode.nodeId;
      addToHistory(nodesRef.current, edgesRef.current);
      setNodes((nds) => [...nds, skeletonNode.node]);
      setEdges((eds) => [...eds, skeletonNode.edge]);
    }

    try {
      const processMediaInput = async (
        input?: { file?: File; base64?: string; url?: string } | string | null,
        connected?: string
      ): Promise<string | undefined> => {
        if (!input && !connected) return undefined;
        if (typeof input === 'string') return input;
        if (input && typeof input === 'object') {
          if (input.file) { const r = await videoToBase64(input.file); return r.base64 ? `data:${r.mimeType};base64,${r.base64}` : undefined; }
          if (input.base64) return input.base64;
          if (input.url) return input.url;
        }
        return connected;
      };

      let startFrame: string | undefined;
      let endFrame: string | undefined;
      let referenceImages: string[] | undefined;
      let inputVideo: string | undefined;

      if (params.mode === 'frames_to_video') {
        startFrame = await processMediaInput(params.startFrame, videoData.connectedImage1);
        endFrame = await processMediaInput(params.endFrame, videoData.connectedImage2);
      } else if (params.mode === 'references') {
        const refs: string[] = [];
        if (Array.isArray(params.referenceImages)) {
          params.referenceImages.forEach((img: any) => {
            if (typeof img === 'string') refs.push(img);
            else if (img?.base64) refs.push(img.base64);
            else if (img?.url) refs.push(img.url);
          });
        }
        if (refs.length === 0) {
          [videoData.connectedImage1, videoData.connectedImage2, videoData.connectedImage3, videoData.connectedImage4]
            .filter(Boolean).forEach(img => refs.push(img!));
        }
        if (refs.length > 0) referenceImages = refs;
      } else if (params.mode === 'extend_video') {
        inputVideo = await processMediaInput(params.inputVideo, videoData.connectedVideo);
      } else if (params.mode !== 'text_to_video') {
        startFrame = await processMediaInput(params.startFrame, videoData.connectedImage1);
        if (startFrame) { referenceImages = [startFrame]; }
      }

      const finalPrompt = videoData.connectedText
        ? `${videoData.connectedText} ${params.prompt}`.trim()
        : params.prompt;

      const result = await videoApi.generate({
        ...params,
        prompt: finalPrompt,
        startFrame,
        endFrame,
        referenceImages,
        inputVideo,
        canvasId,
        nodeId,
      });

      if (newOutputNodeId) {
        setNodes((nds) => nds.map((n) => {
          if (n.id === newOutputNodeId && n.type === 'output') {
            return {
              ...n,
              data: {
                ...(n.data as OutputNodeData),
                resultVideoUrl: result.videoUrl || undefined,
                resultVideoBase64: result.videoUrl ? undefined : result.videoBase64,
                isLoading: false,
              } as OutputNodeData,
            } as Node<FlowNodeData>;
          }
          return n;
        }));
        addToHistory(nodesRef.current, edgesRef.current);
      }

      if (result.seed !== undefined) {
        updateNodeData<VideoNodeData>(nodeId, { seed: result.seed } as any, 'video');
      }

      toast.success('Video generated successfully!', { duration: 3000 });
    } catch (error: any) {
      cleanupFailedNode(newOutputNodeId);
      const msg = error?.status === 409
        ? 'Video generation already in progress. Please wait.'
        : error?.message || 'Failed to generate video';
      toast.error(msg, { duration: 5000 });
    } finally {
      updateNodeLoadingState<VideoNodeData>(nodeId, false, 'video');
    }
  }, [nodesRef, edgesRef, updateNodeData, updateNodeLoadingState, setNodes, setEdges, addToHistory, canvasId, createOutputNodeWithSkeleton, cleanupFailedNode]);

  return {
    handleVideoNodeDataUpdate,
    handleVideoInputNodeDataUpdate,
    handleVideoInputNodeUpload,
    handleVideoNodeGenerate,
  };
};
