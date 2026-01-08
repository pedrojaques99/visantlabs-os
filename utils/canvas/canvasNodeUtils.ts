import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, ImageNodeData, MergeNodeData, EditNodeData, UpscaleNodeData, BrandNodeData, OutputNodeData, BrandIdentity, LogoNodeData, PromptNodeData, MockupNodeData, AngleNodeData, TextureNodeData, AmbienceNodeData, LuminanceNodeData, PDFNodeData, VideoNodeData } from '../../types/reactFlow';
import { getImageUrl } from '../imageUtils';

// Helper to generate node ID
let nodeIdCounter = 0;
export const generateNodeId = (type: string) => `${type}-${Date.now()}-${++nodeIdCounter}`;

// Get image URL or base64 from node (prefers URL from R2)
export const getImageFromNode = (
  nodeId: string,
  nodes: Node<FlowNodeData>[]
): string | null => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return null;

  if (node.type === 'image') {
    const data = node.data as ImageNodeData;
    // Prefer imageUrl (R2) over imageBase64
    if (data.mockup.imageUrl) {
      return data.mockup.imageUrl;
    }
    return data.mockup.imageBase64 || null;
  }

  if (node.type === 'merge' || node.type === 'edit' || node.type === 'upscale') {
    const data = node.data as MergeNodeData | EditNodeData | UpscaleNodeData;
    // Prefer resultImageUrl (R2) over resultImageBase64
    if ('resultImageUrl' in data && data.resultImageUrl) {
      return data.resultImageUrl;
    }
    return data.resultImageBase64 || null;
  }

  if (node.type === 'output') {
    const data = node.data as OutputNodeData;
    // Prefer resultImageUrl (R2) over resultImageBase64
    if (data.resultImageUrl) {
      return data.resultImageUrl;
    }
    if (data.resultImageBase64) {
      // Ensure it's in the correct format
      if (data.resultImageBase64.startsWith('data:')) {
        return data.resultImageBase64;
      }
      return `data:image/png;base64,${data.resultImageBase64}`;
    }
    return null;
  }

  if (node.type === 'brand') {
    const data = node.data as BrandNodeData;
    // Prefer logoBase64 over logoImage
    if (data.logoBase64) {
      // Ensure it's in the correct format
      if (data.logoBase64.startsWith('data:')) {
        return data.logoBase64;
      }
      return `data:image/png;base64,${data.logoBase64}`;
    }
    return data.logoImage || null;
  }

  return null;
};

// Get both URL and base64 from node (for fallback support)
export const getImageFromNodeWithFallback = (
  nodeId: string,
  nodes: Node<FlowNodeData>[]
): { url?: string; base64?: string } => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return {};

  if (node.type === 'image') {
    const data = node.data as ImageNodeData;
    return {
      url: data.mockup.imageUrl || undefined,
      base64: data.mockup.imageBase64 || undefined,
    };
  }

  if (node.type === 'merge' || node.type === 'edit' || node.type === 'upscale') {
    const data = node.data as MergeNodeData | EditNodeData | UpscaleNodeData;
    return {
      url: 'resultImageUrl' in data ? data.resultImageUrl : undefined,
      base64: data.resultImageBase64 || undefined,
    };
  }

  if (node.type === 'output') {
    const data = node.data as OutputNodeData;
    return {
      url: data.resultImageUrl || undefined,
      base64: data.resultImageBase64 || undefined,
    };
  }

  if (node.type === 'brand') {
    const data = node.data as BrandNodeData;
    // For brand nodes, logoImage might be URL, logoBase64 is base64
    const url = data.logoImage && (data.logoImage.startsWith('http://') || data.logoImage.startsWith('https://'))
      ? data.logoImage
      : undefined;
    return {
      url,
      base64: data.logoBase64 || undefined,
    };
  }

  return {};
};

// Get connected images for merge node
export const getConnectedImages = (
  nodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): string[] => {
  const connectedEdges = edges.filter(e => e.target === nodeId);
  const images: string[] = [];

  for (const edge of connectedEdges) {
    const imageBase64 = getImageFromNode(edge.source, nodes);
    if (imageBase64) {
      images.push(imageBase64);
    }
  }

  return images;
};

// Clean edge handles: convert null or "null" string to undefined
// React Flow doesn't accept null values for sourceHandle/targetHandle
export const cleanEdgeHandles = (edge: Edge): Edge => {
  const cleaned: Edge = {
    ...edge,
  };

  // Remove sourceHandle if it's null, "null", or empty string
  if (cleaned.sourceHandle === null || cleaned.sourceHandle === 'null' || cleaned.sourceHandle === '') {
    delete (cleaned as any).sourceHandle;
  }

  // Remove targetHandle if it's null, "null", or empty string
  if (cleaned.targetHandle === null || cleaned.targetHandle === 'null' || cleaned.targetHandle === '') {
    delete (cleaned as any).targetHandle;
  }

  return cleaned;
};

// Clean an array of edges
export const cleanEdges = (edges: Edge[]): Edge[] => {
  return edges.map(cleanEdgeHandles);
};

// Deep equality check for arrays - more efficient than JSON.stringify
export const arraysEqual = <T>(a: T[] | undefined | null, b: T[] | undefined | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
};

// Compare mockup arrays by ID - more efficient than JSON.stringify
export const mockupArraysEqual = (a: any[] | undefined | null, b: any[] | undefined | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  // Compare by _id if available, otherwise by reference
  const aIds = a.map(m => m?._id || m);
  const bIds = b.map(m => m?._id || m);

  if (aIds.length !== bIds.length) return false;

  const aIdSet = new Set(aIds);
  for (const id of bIds) {
    if (!aIdSet.has(id)) return false;
  }

  return true;
};

// Get connected brand identity from BrandNode
export const getConnectedBrandIdentity = (
  nodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): BrandIdentity | null => {
  const connectedEdges = edges.filter(e => e.target === nodeId);

  for (const edge of connectedEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode?.type === 'brand') {
      const brandData = sourceNode.data as BrandNodeData;
      if (brandData.brandIdentity) {
        return brandData.brandIdentity;
      }
    }
  }

  return null;
};

/**
 * Get image from a source node, prioritizing base64 for thumbnails
 * This is used for syncing connected images in nodes like Merge, Edit, Upscale, etc.
 * @param sourceNode - The source node to extract image from
 * @returns Image URL or base64 string (prioritizes base64 for better thumbnail display)
 */
export const getImageFromSourceNode = (sourceNode: Node<FlowNodeData>): string | null => {
  if (!sourceNode) return null;

  if (sourceNode.type === 'image') {
    const imageData = sourceNode.data as ImageNodeData;
    if (!imageData.mockup) return null;

    // Prioritize base64 for thumbnails
    if (imageData.mockup.imageBase64) {
      const base64 = imageData.mockup.imageBase64.startsWith('data:')
        ? imageData.mockup.imageBase64
        : `data:image/png;base64,${imageData.mockup.imageBase64}`;
      return base64;
    }

    // Fallback to URL
    const imageUrl = getImageUrl(imageData.mockup);
    if (imageUrl && imageUrl.length > 0) {
      return imageUrl;
    }
    return null;
  }

  // For LogoNode
  if (sourceNode.type === 'logo') {
    const logoData = sourceNode.data as LogoNodeData;
    // Prioritize base64 for thumbnails
    if (logoData.logoBase64) {
      const base64 = logoData.logoBase64.startsWith('data:')
        ? logoData.logoBase64
        : `data:image/png;base64,${logoData.logoBase64}`;
      return base64;
    }
    // Fallback to logoImageUrl
    if (logoData.logoImageUrl) {
      return logoData.logoImageUrl;
    }
    return null;
  }

  // For other node types that produce images
  if (sourceNode.type === 'merge' || sourceNode.type === 'edit' || sourceNode.type === 'upscale' ||
    sourceNode.type === 'mockup' || sourceNode.type === 'angle' || sourceNode.type === 'prompt' ||
    sourceNode.type === 'output' || sourceNode.type === 'shader') {
    const nodeData = sourceNode.data as MergeNodeData | EditNodeData | UpscaleNodeData |
      PromptNodeData | MockupNodeData | AngleNodeData | OutputNodeData | any;

    // Prioritize base64 for thumbnails
    if (nodeData.resultImageBase64 && typeof nodeData.resultImageBase64 === 'string') {
      const base64 = nodeData.resultImageBase64.startsWith('data:')
        ? nodeData.resultImageBase64
        : `data:image/png;base64,${nodeData.resultImageBase64}`;
      return base64;
    }

    // Fallback to resultImageUrl (R2 URL)
    if (nodeData.resultImageUrl && typeof nodeData.resultImageUrl === 'string' && nodeData.resultImageUrl.length > 0) {
      return nodeData.resultImageUrl;
    }
  }

  // For BrandNode - extract logo image
  if (sourceNode.type === 'brand') {
    const brandData = sourceNode.data as BrandNodeData;
    // Prioritize base64 for thumbnails
    if (brandData.logoBase64) {
      const base64 = brandData.logoBase64.startsWith('data:')
        ? brandData.logoBase64
        : `data:image/png;base64,${brandData.logoBase64}`;
      return base64;
    }
    // Fallback to logoImage
    if (brandData.logoImage) {
      return brandData.logoImage;
    }
  }

  // For VideoNode - extract video URL or base64
  if (sourceNode.type === 'video') {
    const videoData = sourceNode.data as VideoNodeData;
    // Prioritize base64 for immediate display
    if (videoData.resultVideoBase64) {
      const base64 = videoData.resultVideoBase64.startsWith('data:')
        ? videoData.resultVideoBase64
        : `data:video/webm;base64,${videoData.resultVideoBase64}`;
      return base64;
    }
    // Fallback to resultVideoUrl (R2 URL)
    if (videoData.resultVideoUrl && typeof videoData.resultVideoUrl === 'string' && videoData.resultVideoUrl.length > 0) {
      return videoData.resultVideoUrl;
    }
  }

  // For PDFNode - extract PDF base64
  if (sourceNode.type === 'pdf') {
    const pdfData = sourceNode.data as PDFNodeData;
    if (pdfData.pdfBase64) {
      // PDF base64 should be returned as-is (not as data URL)
      return pdfData.pdfBase64;
    }
    // Fallback to pdfUrl
    if (pdfData.pdfUrl) {
      return pdfData.pdfUrl;
    }
  }

  return null;
};

/**
 * Get data from a source node with type information
 * Used for BrandNode connections to determine if source is PDF or image
 * @param sourceNode - The source node to extract data from
 * @returns Object with base64/url and type, or null
 */
export const getDataFromSourceNode = (sourceNode: Node<FlowNodeData>): { data: string; type: 'pdf' | 'png' } | null => {
  if (!sourceNode) return null;

  // For PDFNode
  if (sourceNode.type === 'pdf') {
    const pdfData = sourceNode.data as PDFNodeData;
    if (pdfData.pdfBase64) {
      return { data: pdfData.pdfBase64, type: 'pdf' };
    }
    if (pdfData.pdfUrl) {
      return { data: pdfData.pdfUrl, type: 'pdf' };
    }
    return null;
  }

  // For ImageNode and other image-producing nodes
  const imageData = getImageFromSourceNode(sourceNode);
  if (imageData) {
    return { data: imageData, type: 'png' };
  }

  return null;
};

/**
 * Get connected image from an edge
 * @param edge - The edge connecting source to target
 * @param nodes - All nodes in the canvas
 * @returns Image URL or base64 string
 */
export const getImageFromEdge = (edge: Edge | undefined, nodes: Node<FlowNodeData>[]): string | null => {
  if (!edge) return null;
  const sourceNode = nodes.find(node => node.id === edge.source);
  if (!sourceNode) return null;
  return getImageFromSourceNode(sourceNode);
};

/**
 * Sync connected image for a target node based on its connected edges
 * Used for nodes like Edit, Upscale, Mockup, Angle, Texture, Ambience, Luminance
 * @param targetNodeId - The target node ID
 * @param edges - All edges in the canvas
 * @param nodes - All nodes in the canvas
 * @returns Connected image URL or base64 string, or undefined if no connection
 */
export const syncConnectedImage = (
  targetNodeId: string,
  edges: Edge[],
  nodes: Node<FlowNodeData>[]
): string | undefined => {
  const connectedEdge = edges.find(e => e.target === targetNodeId);
  if (!connectedEdge) return undefined;

  const sourceNode = nodes.find(node => node.id === connectedEdge.source);
  if (!sourceNode) return undefined;

  // Check if source node is a valid image source
  const hasConnectedImage = sourceNode.type === 'image' ||
    sourceNode.type === 'logo' ||
    sourceNode.type === 'brand' ||
    sourceNode.type === 'output' ||
    sourceNode.type === 'merge' ||
    sourceNode.type === 'edit' ||
    sourceNode.type === 'upscale' ||
    sourceNode.type === 'upscaleBicubic' ||
    sourceNode.type === 'mockup' ||
    sourceNode.type === 'angle' ||
    sourceNode.type === 'prompt' ||
    sourceNode.type === 'shader';

  if (!hasConnectedImage) return undefined;

  return getImageFromSourceNode(sourceNode) || undefined;
};

/**
 * Get image or video URL/base64 from a node for copying to clipboard
 * Supports all node types that contain media (images or videos)
 * @param node - The node to extract media from
 * @returns Object with mediaUrl and isVideo flag, or null if no media found
 */
export const getMediaFromNodeForCopy = (
  node: Node<FlowNodeData>
): { mediaUrl: string; isVideo: boolean; mimeType?: string } | null => {
  if (!node) return null;

  // ImageNode
  if (node.type === 'image') {
    const imageData = node.data as ImageNodeData;
    const imageUrl = getImageUrl(imageData.mockup);
    if (imageUrl) {
      return { mediaUrl: imageUrl, isVideo: false };
    }
    return null;
  }

  // OutputNode - check for video first, then image
  if (node.type === 'output') {
    const outputData = node.data as OutputNodeData;
    // Check for video
    if (outputData.resultVideoUrl) {
      return { mediaUrl: outputData.resultVideoUrl, isVideo: true, mimeType: 'video/mp4' };
    }
    if (outputData.resultVideoBase64) {
      const videoUrl = outputData.resultVideoBase64.startsWith('data:')
        ? outputData.resultVideoBase64
        : `data:video/mp4;base64,${outputData.resultVideoBase64}`;
      return { mediaUrl: videoUrl, isVideo: true, mimeType: 'video/mp4' };
    }
    // Check for image
    if (outputData.resultImageUrl) {
      return { mediaUrl: outputData.resultImageUrl, isVideo: false };
    }
    if (outputData.resultImageBase64) {
      const imageUrl = outputData.resultImageBase64.startsWith('data:')
        ? outputData.resultImageBase64
        : `data:image/png;base64,${outputData.resultImageBase64}`;
      return { mediaUrl: imageUrl, isVideo: false };
    }
    return null;
  }

  // MergeNode, EditNode, UpscaleNode, UpscaleBicubicNode, MockupNode, AngleNode, PromptNode, ShaderNode
  if (node.type === 'merge' || node.type === 'edit' || node.type === 'upscale' ||
    node.type === 'upscaleBicubic' ||
    node.type === 'mockup' || node.type === 'angle' || node.type === 'prompt' ||
    node.type === 'shader') {
    const nodeData = node.data as any;
    if (nodeData.resultImageUrl) {
      return { mediaUrl: nodeData.resultImageUrl, isVideo: false };
    }
    if (nodeData.resultImageBase64) {
      const imageUrl = nodeData.resultImageBase64.startsWith('data:')
        ? nodeData.resultImageBase64
        : `data:image/png;base64,${nodeData.resultImageBase64}`;
      return { mediaUrl: imageUrl, isVideo: false };
    }
    return null;
  }

  // LogoNode
  if (node.type === 'logo') {
    const logoData = node.data as LogoNodeData;
    if (logoData.logoImageUrl) {
      return { mediaUrl: logoData.logoImageUrl, isVideo: false };
    }
    if (logoData.logoBase64) {
      const imageUrl = logoData.logoBase64.startsWith('data:')
        ? logoData.logoBase64
        : `data:image/png;base64,${logoData.logoBase64}`;
      return { mediaUrl: imageUrl, isVideo: false };
    }
    return null;
  }

  // VideoNode
  if (node.type === 'video') {
    const videoData = node.data as VideoNodeData;
    if (videoData.resultVideoUrl) {
      return { mediaUrl: videoData.resultVideoUrl, isVideo: true, mimeType: 'video/mp4' };
    }
    if (videoData.resultVideoBase64) {
      const videoUrl = videoData.resultVideoBase64.startsWith('data:')
        ? videoData.resultVideoBase64
        : `data:video/mp4;base64,${videoData.resultVideoBase64}`;
      return { mediaUrl: videoUrl, isVideo: true, mimeType: 'video/mp4' };
    }
    return null;
  }

  // VideoInputNode
  if (node.type === 'videoInput') {
    const videoInputData = node.data as any;
    if (videoInputData.uploadedVideoUrl) {
      return { mediaUrl: videoInputData.uploadedVideoUrl, isVideo: true, mimeType: 'video/mp4' };
    }
    if (videoInputData.uploadedVideo) {
      const videoUrl = videoInputData.uploadedVideo.startsWith('data:')
        ? videoInputData.uploadedVideo
        : `data:video/mp4;base64,${videoInputData.uploadedVideo}`;
      return { mediaUrl: videoUrl, isVideo: true, mimeType: 'video/mp4' };
    }
    return null;
  }

  // BrandNode - extract logo
  if (node.type === 'brand') {
    const brandData = node.data as BrandNodeData;
    if (brandData.logoBase64) {
      const imageUrl = brandData.logoBase64.startsWith('data:')
        ? brandData.logoBase64
        : `data:image/png;base64,${brandData.logoBase64}`;
      return { mediaUrl: imageUrl, isVideo: false };
    }
    if (brandData.logoImage) {
      return { mediaUrl: brandData.logoImage, isVideo: false };
    }
    return null;
  }

  return null;
};

/**
 * Copy image from a node to clipboard specifically as PNG
 * @param node - The node to copy image from
 * @returns Promise that resolves when copy is complete
 */
export const copyMediaAsPngFromNode = async (
  node: Node<FlowNodeData>
): Promise<{ success: boolean; error?: string }> => {
  const media = getMediaFromNodeForCopy(node);
  if (!media) {
    return { success: false, error: 'No media found in node' };
  }

  try {
    let blob: Blob;

    if (media.mediaUrl.startsWith('data:')) {
      const base64Data = media.mediaUrl.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      let mimeType = media.mimeType;
      if (!mimeType) {
        const mimeMatch = media.mediaUrl.match(/data:(.*?);/);
        mimeType = mimeMatch ? mimeMatch[1] : (media.isVideo ? 'video/mp4' : 'image/png');
      }

      blob = new Blob([byteArray], { type: mimeType });
    } else {
      try {
        const response = await fetch(media.mediaUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch media: ${response.statusText}`);
        }
        blob = await response.blob();
      } catch (fetchError) {
        console.warn('Direct fetch failed, trying proxy...', fetchError);
        // Fallback to proxy
        const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(media.mediaUrl)}`;
        const proxyResponse = await fetch(proxyUrl);

        if (!proxyResponse.ok) {
          throw new Error('Failed to fetch from proxy');
        }

        const data = await proxyResponse.json();
        if (data.error) {
          throw new Error(data.error);
        }

        // Convert base64 from proxy to blob
        const base64Data = data.base64;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: data.mimeType || 'image/png' });
      }
    }

    // If it's a video or not PNG, we try to convert it to PNG
    if (media.isVideo || blob.type !== 'image/png') {
      const convertToPng = async (inputBlob: Blob): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((resultBlob) => {
              if (resultBlob) {
                resolve(resultBlob);
              } else {
                reject(new Error('Failed to convert to PNG blob'));
              }
            }, 'image/png');
            URL.revokeObjectURL(img.src);
          };
          img.onerror = () => {
            reject(new Error('Failed to load image for conversion'));
            URL.revokeObjectURL(img.src);
          };
          img.src = URL.createObjectURL(inputBlob);
        });
      };

      blob = await convertToPng(blob);
    }

    // Copy to clipboard
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);

    return { success: true };
  } catch (error: any) {
    console.error('Failed to copy media as PNG:', error);
    return { success: false, error: error?.message || 'Failed to copy media to clipboard' };
  }
};

/**
 * Copy image or video from a node to clipboard
 * @param node - The node to copy media from
 * @returns Promise that resolves when copy is complete
 */
export const copyMediaFromNode = async (
  node: Node<FlowNodeData>
): Promise<{ success: boolean; error?: string }> => {
  const media = getMediaFromNodeForCopy(node);
  if (!media) {
    return { success: false, error: 'No media found in node' };
  }

  try {
    let blob: Blob;

    if (media.mediaUrl.startsWith('data:')) {
      // Handle data URL
      const base64Data = media.mediaUrl.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Extract mime type from data URL or use provided mimeType
      let mimeType = media.mimeType;
      if (!mimeType) {
        const mimeMatch = media.mediaUrl.match(/data:(.*?);/);
        mimeType = mimeMatch ? mimeMatch[1] : (media.isVideo ? 'video/mp4' : 'image/png');
      }

      blob = new Blob([byteArray], { type: mimeType });
    } else {
      // Fetch from URL
      try {
        const response = await fetch(media.mediaUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch media: ${response.statusText}`);
        }
        blob = await response.blob();
      } catch (fetchError) {
        console.warn('Direct fetch failed, trying proxy...', fetchError);
        // Fallback to proxy
        const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(media.mediaUrl)}`;
        const proxyResponse = await fetch(proxyUrl);

        if (!proxyResponse.ok) {
          throw new Error('Failed to fetch from proxy');
        }

        const data = await proxyResponse.json();
        if (data.error) {
          throw new Error(data.error);
        }

        // Convert base64 from proxy to blob
        const base64Data = data.base64;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: data.mimeType || 'image/png' });
      }
    }

    // Copy to clipboard
    // Note: Some browsers only support a limited set of types for ClipboardItem (usually image/png)
    // If it's not a common type, it might fail.
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
    } catch (clipboardError) {
      console.warn('Direct clipboard write failed, trying conversion to PNG:', clipboardError);
      // Fallback: Use the PNG conversion logic
      return await copyMediaAsPngFromNode(node);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to copy media:', error);
    return { success: false, error: error?.message || 'Failed to copy media to clipboard' };
  }
};

