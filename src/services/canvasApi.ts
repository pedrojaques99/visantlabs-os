import { authService } from './authService';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../types/reactFlow';
import { compressImage } from '../utils/imageCompression.js';

// Get API URL from environment or use current origin for production
const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Clean base64 images from nodes when URL exists
 * Removes base64 data to reduce payload size when R2 URLs are available
 */
function cleanBase64FromNodes(nodes: Node<FlowNodeData>[]): Node<FlowNodeData>[] {
  return nodes.map((node) => {
    const cleanedNode = { ...node };
    const nodeData = node.data as FlowNodeData;

    try {
      // ImageNode: remove imageBase64 if imageUrl exists
      if (nodeData.type === 'image' && nodeData.mockup) {
        if (nodeData.mockup.imageUrl) {
          cleanedNode.data = {
            ...nodeData,
            mockup: {
              ...nodeData.mockup,
              imageBase64: undefined,
              base64Timestamp: undefined,
            },
          } as FlowNodeData;
        }
      }

      // MergeNode: remove resultImageBase64 if resultImageUrl exists
      if (nodeData.type === 'merge') {
        if (nodeData.resultImageUrl) {
          cleanedNode.data = {
            ...nodeData,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          } as FlowNodeData;
        }
      }

      // EditNode: multiple image fields
      if (nodeData.type === 'edit') {
        const editData = nodeData;
        const cleanedEditData: any = { ...editData };

        // resultImageBase64 -> resultImageUrl
        if (editData.resultImageUrl) {
          cleanedEditData.resultImageBase64 = undefined;
          cleanedEditData.resultImageBase64Timestamp = undefined;
        }

        // uploadedImage.base64 -> uploadedImage.url
        if (editData.uploadedImage?.url) {
          cleanedEditData.uploadedImage = {
            ...editData.uploadedImage,
            base64: undefined,
            base64Timestamp: undefined,
          };
        }

        // referenceImage.base64 -> referenceImage.url
        if (editData.referenceImage?.url) {
          cleanedEditData.referenceImage = {
            ...editData.referenceImage,
            base64: undefined,
            base64Timestamp: undefined,
          };
        }

        // referenceImages[].base64 -> referenceImages[].url
        if (editData.referenceImages && Array.isArray(editData.referenceImages)) {
          cleanedEditData.referenceImages = editData.referenceImages.map((refImage) => {
            if (refImage?.url) {
              return {
                ...refImage,
                base64: undefined,
                base64Timestamp: undefined,
              };
            }
            return refImage;
          });
        }

        cleanedNode.data = cleanedEditData as FlowNodeData;
      }

      // UpscaleNode: remove resultImageBase64 if resultImageUrl exists
      if (nodeData.type === 'upscale') {
        if (nodeData.resultImageUrl) {
          cleanedNode.data = {
            ...nodeData,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          } as FlowNodeData;
        }
      }

      // MockupNode: remove resultImageBase64 if resultImageUrl exists
      if (nodeData.type === 'mockup') {
        if (nodeData.resultImageUrl) {
          cleanedNode.data = {
            ...nodeData,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          } as FlowNodeData;
        }
      }

      // PromptNode: remove resultImageBase64 if resultImageUrl exists
      if (nodeData.type === 'prompt') {
        if (nodeData.resultImageUrl) {
          cleanedNode.data = {
            ...nodeData,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          } as FlowNodeData;
        }
      }

      // OutputNode: remove resultImageBase64 if resultImageUrl exists
      if (nodeData.type === 'output') {
        if (nodeData.resultImageUrl) {
          cleanedNode.data = {
            ...nodeData,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          } as FlowNodeData;
        }
      }

      // PDFNode: remove pdfBase64 if pdfUrl exists
      if (nodeData.type === 'pdf') {
        if (nodeData.pdfUrl) {
          cleanedNode.data = {
            ...nodeData,
            pdfBase64: undefined,
            pdfBase64Timestamp: undefined,
          } as FlowNodeData;
        }
      }

      // BrandNode: remove base64 if URL exists
      if (nodeData.type === 'brand') {
        const brandData = nodeData;
        const cleanedBrandData: any = { ...brandData };

        if (brandData.logoImage && !brandData.logoImage.startsWith('data:')) {
          cleanedBrandData.logoBase64 = undefined;
        }

        if (brandData.identityPdfUrl) {
          cleanedBrandData.identityPdfBase64 = undefined;
          cleanedBrandData.identityPdfBase64Timestamp = undefined;
        }

        if (brandData.identityImageUrl) {
          cleanedBrandData.identityImageBase64 = undefined;
        }

        cleanedNode.data = cleanedBrandData as FlowNodeData;
      }
    } catch (error) {
      console.error(`Error cleaning base64 from node ${node.id}:`, error);
      // Return original node if cleaning fails
    }

    return cleanedNode;
  });
}

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export interface CanvasProject {
  _id: string;
  userId: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  drawings?: any[];
  shareId?: string | null;
  isCollaborative?: boolean;
  canEdit?: string[];
  canView?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ShareProjectResponse {
  shareId: string;
  shareUrl: string;
  canEdit: string[];
  canView: string[];
}

export interface ShareSettings {
  canEdit: string[];
  canView: string[];
}

export const canvasApi = {
  async getAll(): Promise<CanvasProject[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/canvas`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to fetch canvas projects: ${response.status} ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }

        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
      }

      const data = await response.json();
      return Array.isArray(data.projects) ? data.projects : [];
    } catch (error: any) {
      if (error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.name === 'TypeError') {
        console.error('Network error fetching canvas projects:', error);
        return [];
      }
      throw error;
    }
  },

  async getById(id: string): Promise<CanvasProject> {
    if (!id || id.trim() === '' || id === 'undefined') {
      throw new Error('Invalid project ID');
    }

    const response = await fetch(`${API_BASE_URL}/canvas/${id}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch canvas project';

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }

      const error = new Error(errorMessage);
      (error as any).status = response.status;
      throw error;
    }

    const data = await response.json();
    return data.project;
  },

  async save(name: string, nodes: Node[], edges: Edge[], projectId?: string, drawings?: any[]): Promise<CanvasProject> {
    const url = projectId
      ? `${API_BASE_URL}/canvas/${projectId}`
      : `${API_BASE_URL}/canvas`;

    const method = projectId ? 'PUT' : 'POST';

    // Clean base64 images before sending to reduce payload size
    const cleanedNodes = cleanBase64FromNodes(nodes as Node<FlowNodeData>[]);

    const payload = {
      name: name || 'Untitled',
      nodes: cleanedNodes,
      edges,
      drawings: drawings !== undefined ? drawings : null,
    };

    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to ${projectId ? 'update' : 'create'} canvas project`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;

        // Improve error message for payload too large (413) - user-friendly version
        if (response.status === 413 || (response.status === 400 && errorMessage.toLowerCase().includes('payload too large')) || errorMessage.toLowerCase().includes('request entity too large')) {
          const payloadSizeMB = errorData.payloadSizeMB || errorData.sizeMB || '4.5';
          const maxSizeMB = errorData.maxSizeMB || '4.5';
          const base64ImageCount = errorData.base64ImageCount || 0;

          if (errorData.r2Configured === false) {
            errorMessage = `Projeto muito grande (${payloadSizeMB}MB). ` +
              `O limite é ${maxSizeMB}MB devido ao limite da plataforma Vercel. ` +
              `Configure o armazenamento R2 nas configurações do sistema para salvar projetos grandes. ` +
              `O R2 permite armazenar imagens separadamente, liberando espaço no payload.`;
          } else if (errorData.r2ProcessingFailed) {
            errorMessage = `Algumas imagens não puderam ser otimizadas automaticamente para R2. ` +
              `Tente novamente em alguns instantes ou reduza o número de imagens no canvas.`;
          } else if (base64ImageCount > 0) {
            errorMessage = `Projeto muito grande (${payloadSizeMB}MB). ` +
              `Contém ${base64ImageCount} imagem(ns) que ainda precisam ser otimizadas para R2. ` +
              `Aguarde alguns instantes e tente novamente, ou reduza o número de imagens no canvas.`;
          } else {
            errorMessage = `Projeto muito grande (${payloadSizeMB}MB) para salvar. ` +
              `O limite é ${maxSizeMB}MB devido ao limite da plataforma Vercel. ` +
              `Reduza o número de imagens ou elementos no canvas. ` +
              `Nota: O R2 está configurado, mas o projeto ainda excede o limite após otimização.`;
          }
        }
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }

      const error = new Error(errorMessage);
      (error as any).status = response.status;
      throw error;
    }

    const result = await response.json();
    return result.project;
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/canvas/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to delete canvas project';

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }

      const error = new Error(errorMessage);
      (error as any).status = response.status;
      throw error;
    }
  },

  async uploadImageToR2Direct(file: File, canvasId?: string, nodeId?: string): Promise<string> {
    try {
      // Get presigned URL from server
      const queryParams = new URLSearchParams();
      if (canvasId) queryParams.append('canvasId', canvasId);
      if (nodeId) queryParams.append('nodeId', nodeId);

      // Detect content type from file
      const contentType = file.type || 'image/png';
      queryParams.append('contentType', contentType);

      const urlResponse = await fetch(`${API_BASE_URL}/canvas/image/upload-url?${queryParams.toString()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!urlResponse.ok) {
        const errorText = await urlResponse.text();
        let errorMessage = 'Failed to get upload URL';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new Error(errorMessage);
      }

      const { presignedUrl, finalUrl } = await urlResponse.json();

      // Upload directly to R2 using presigned URL
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload to R2: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      return finalUrl;
    } catch (error: any) {
      console.error('Error uploading image directly to R2:', error);
      throw error;
    }
  },

  async uploadImageToR2(base64Image: string, canvasId?: string, nodeId?: string, options?: { skipCompression?: boolean }): Promise<string> {
    try {
      const skipCompression = options?.skipCompression ?? false;

      // Dev logging
      const logR2 = (msg: string, data?: any) => console.log(`[R2Upload] ${msg}`, data ?? '');

      // Vercel Pro limit is 50MB for serverless functions
      const VERCEL_LIMIT = 50 * 1024 * 1024; // 50MB (Vercel Pro)

      // Calculate current payload size
      const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
      const binarySize = (base64Data.length * 3) / 4; // Approximate binary size from base64
      const binarySizeMB = (binarySize / 1024 / 1024).toFixed(2);

      logR2('Upload started', {
        binarySizeMB: `${binarySizeMB}MB`,
        skipCompression,
        canvasId,
        nodeId,
        exceedsLimit: binarySize > VERCEL_LIMIT * 0.75,
      });

      // If skipCompression is true and image exceeds Vercel limit, try direct upload
      if (skipCompression && binarySize > VERCEL_LIMIT * 0.75) {
        logR2('Attempting direct upload (presigned URL)...');
        try {
          // Convert base64 to Blob for direct upload
          const blob = await canvasApi.base64ToBlob(base64Image);
          const file = new File([blob], `upscale-${Date.now()}.png`, { type: 'image/png' });

          logR2('Blob created', { blobSize: `${(blob.size / 1024 / 1024).toFixed(2)}MB` });

          // Use direct upload (presigned URL) to bypass Vercel limit
          const result = await canvasApi.uploadImageToR2Direct(file, canvasId, nodeId);
          logR2('Direct upload SUCCESS!', { resultUrl: result });
          return result;
        } catch (directUploadError: any) {
          // If direct upload fails (e.g., CORS), fall back to chunked or standard upload
          logR2('Direct upload FAILED', { error: directUploadError.message });
          console.warn('Direct upload failed, trying standard upload with compression:', directUploadError.message);

          // For very large images, we need to compress to fit Vercel limit
          // Use high quality compression to preserve as much detail as possible
          logR2('Falling back to compressed upload (quality: 0.98)...');
          const dataUrl = base64Image.startsWith('data:')
            ? base64Image
            : `data:image/png;base64,${base64Image}`;

          const compressedBase64 = await compressImage(dataUrl, {
            maxWidth: 8192, // Allow very large dimensions
            maxHeight: 8192,
            maxSizeBytes: 48 * 1024 * 1024, // 48MB target (below 50MB Vercel Pro limit)
            quality: 0.98, // Near-maximum quality
          });

          // Extract base64 data
          const compressedData = compressedBase64.includes(',')
            ? compressedBase64.split(',')[1]
            : compressedBase64;

          const compressedSizeMB = ((compressedData.length * 3 / 4) / 1024 / 1024).toFixed(2);
          logR2('Compression complete', {
            originalMB: binarySizeMB,
            compressedMB: compressedSizeMB,
            reduction: `${(100 - (parseFloat(compressedSizeMB) / parseFloat(binarySizeMB) * 100)).toFixed(0)}%`,
          });

          // Continue with standard upload using compressed image
          logR2('Uploading compressed image via server...');
          const response = await fetch(`${API_BASE_URL}/canvas/image/upload`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              base64Image: compressedData,
              canvasId,
              nodeId,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            logR2('Server upload FAILED', { status: response.status, error: errorText });
            throw new Error(errorText || 'Failed to upload image');
          }

          const data = await response.json();
          logR2('Server upload SUCCESS!', { imageUrl: data.imageUrl });
          return data.imageUrl;
        }
      }

      // Check if R2 is configured to determine compression strategy
      const r2Status = await canvasApi.checkR2Status();
      const r2Configured = r2Status.configured;

      // When R2 is configured, we can preserve maximum quality
      // Use minimal compression (high quality, larger size limit) for designers
      let compressedBase64 = base64Image;
      const COMPRESSION_THRESHOLD = 10 * 1024 * 1024; // 10MB - only compress very large images
      const needsCompression = !skipCompression && binarySize > COMPRESSION_THRESHOLD;

      if (needsCompression) {
        try {
          // Add data URL prefix if missing for compression
          const dataUrl = base64Image.startsWith('data:')
            ? base64Image
            : `data:image/jpeg;base64,${base64Image}`;

          if (r2Configured) {
            // R2 configured: Use MAXIMUM quality for designers
            // Higher quality (0.95), larger size limit, preserve dimensions better
            compressedBase64 = await compressImage(dataUrl, {
              maxWidth: 4096, // Allow 4K images
              maxHeight: 4096,
              maxSizeBytes: 4.2 * 1024 * 1024, // 4.2MB target (very close to 4.5MB limit)
              quality: 0.95, // Maximum quality for designers
            });
          } else {
            // R2 not configured: Need more aggressive compression to fit in limit
            compressedBase64 = await compressImage(dataUrl, {
              maxWidth: 2048,
              maxHeight: 2048,
              maxSizeBytes: 3.5 * 1024 * 1024, // 3.5MB target (leave room for JSON overhead)
              quality: 0.85, // Standard quality
            });
          }

          // Extract base64 data (remove data URL prefix)
          compressedBase64 = compressedBase64.includes(',')
            ? compressedBase64.split(',')[1]
            : compressedBase64;
        } catch (compressError) {
          console.warn('Failed to compress image, using original:', compressError);
          // Continue with original if compression fails
        }
      }

      // Calculate final payload size before sending
      const payload = {
        base64Image: compressedBase64,
        canvasId,
        nodeId,
      };
      const payloadString = JSON.stringify(payload);
      const payloadSize = new Blob([payloadString]).size;

      // Check payload size after compression
      if (payloadSize > VERCEL_LIMIT) {
        const payloadSizeMB = (payloadSize / 1024 / 1024).toFixed(2);
        const qualityMessage = r2Configured
          ? ' Mesmo com qualidade máxima preservada, a imagem ainda excede o limite.'
          : ' Configure o R2 para preservar qualidade máxima em imagens grandes.';
        throw new Error(
          `Imagem muito grande (${payloadSizeMB}MB) para upload. ` +
          `O tamanho máximo é 50MB.${qualityMessage}`
        );
      }

      const response = await fetch(`${API_BASE_URL}/canvas/image/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          base64Image: compressedBase64,
          canvasId,
          nodeId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to upload image to R2';

        // Handle 413 Payload Too Large errors with a user-friendly message
        if (response.status === 413) {
          errorMessage = 'Imagem muito grande para upload. O tamanho máximo é 50MB. Por favor, use uma imagem menor.';
        } else if (response.status === 403) {
          // Handle Storage Limit Exceeded (and other permission errors)
          try {
            const errorData = JSON.parse(errorText);
            // Prefer the specific message from server if available
            errorMessage = errorData.message || 'Limite de armazenamento excedido. Faça upgrade para continuar fazendo upload.';
          } catch {
            errorMessage = 'Permissão negada ou limite de armazenamento excedido.';
          }
        } else {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            if (errorText) {
              errorMessage = errorText;
            }
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.imageUrl;
    } catch (error: any) {
      console.error('Error uploading image to R2:', error);
      throw error;
    }
  },

  async uploadVideoToR2Direct(file: File, canvasId?: string, nodeId?: string): Promise<string> {
    try {
      // Get presigned URL from server
      const queryParams = new URLSearchParams();
      if (canvasId) queryParams.append('canvasId', canvasId);
      if (nodeId) queryParams.append('nodeId', nodeId);

      // Detect content type from file
      const contentType = file.type || 'video/mp4';
      queryParams.append('contentType', contentType);

      const urlResponse = await fetch(`${API_BASE_URL}/canvas/video/upload-url?${queryParams.toString()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!urlResponse.ok) {
        const errorText = await urlResponse.text();
        let errorMessage = 'Failed to get upload URL';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new Error(errorMessage);
      }

      const { presignedUrl, finalUrl } = await urlResponse.json();

      // Upload directly to R2 using presigned URL
      // This bypasses Vercel's 4.5MB limit completely!
      // Video is uploaded with original quality, no compression
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload to R2: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      return finalUrl;
    } catch (error: any) {
      console.error('Error uploading video directly to R2:', error);
      throw error;
    }
  },

  async uploadVideoToR2(videoBase64: string, canvasId?: string, nodeId?: string): Promise<string> {
    try {
      // IMPORTANT: Videos are uploaded to R2 WITHOUT COMPRESSION
      // Original quality is preserved for designers

      // Vercel Pro limit is 50MB for serverless functions
      const VERCEL_LIMIT = 50 * 1024 * 1024; // 50MB (Vercel Pro)

      // Calculate base64 video size
      const base64Data = videoBase64.includes(',')
        ? videoBase64.split(',')[1]
        : videoBase64;
      const videoSizeBytes = base64Data ? (base64Data.length * 3) / 4 : 0;

      // Check payload size
      const payload = {
        videoBase64: videoBase64,
        canvasId,
        nodeId,
      };
      const payloadString = JSON.stringify(payload);
      const payloadSize = new Blob([payloadString]).size;

      if (payloadSize > VERCEL_LIMIT) {
        const payloadSizeMB = (payloadSize / 1024 / 1024).toFixed(2);
        throw new Error(
          `Vídeo muito grande (${payloadSizeMB}MB) para upload. ` +
          `O tamanho máximo é 50MB (Vercel Pro). ` +
          `Nota: Configure o R2 para preservar qualidade máxima. ` +
          `Com R2 configurado, vídeos são armazenados sem compressão, mantendo qualidade original.`
        );
      }

      // Upload to R2 - video is stored as-is, NO compression
      const response = await fetch(`${API_BASE_URL}/canvas/video/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          videoBase64: videoBase64,
          canvasId,
          nodeId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to upload video to R2';

        // Handle 413 Payload Too Large errors with a user-friendly message
        if (response.status === 413) {
          errorMessage = 'Vídeo muito grande para upload. O limite é 50MB (Vercel Pro). ' +
            'Configure o R2 para preservar qualidade máxima em vídeos grandes. ' +
            'Com R2 configurado, vídeos são armazenados sem compressão, mantendo qualidade original.';
        } else {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            if (errorText) {
              errorMessage = errorText;
            }
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.videoUrl;
    } catch (error: any) {
      console.error('Error uploading video to R2:', error);
      throw error;
    }
  },

  async uploadPdfToR2(pdfBase64: string, canvasId?: string, nodeId?: string): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/canvas/pdf/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          pdfBase64,
          canvasId,
          nodeId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to upload PDF to R2';

        // Handle 413 Payload Too Large errors with a user-friendly message
        if (response.status === 413) {
          errorMessage = 'PDF is too large to upload. Maximum size is 3MB. Please compress the PDF or use a smaller file.';
        } else {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            if (errorText) {
              errorMessage = errorText;
            }
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.pdfUrl;
    } catch (error: any) {
      console.error('Error uploading PDF to R2:', error);
      throw error;
    }
  },

  async deleteImageFromR2(imageUrl: string): Promise<void> {
    if (!imageUrl || imageUrl.startsWith('data:')) {
      // Skip deletion for data URLs (not stored in R2)
      return;
    }

    try {
      const encodedUrl = encodeURIComponent(imageUrl);
      const response = await fetch(`${API_BASE_URL}/canvas/image?url=${encodedUrl}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to delete image from R2:', errorText);
        // Don't throw - just log the error, deletion from canvas should still proceed
      }
    } catch (error: any) {
      console.error('Error deleting image from R2:', error);
      // Don't throw - just log the error, deletion from canvas should still proceed
    }
  },

  async checkR2Status(): Promise<{ configured: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/health/r2`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          configured: false,
          error: errorData.error || 'R2 não está configurado',
        };
      }

      const data = await response.json();
      return {
        configured: data.status === 'connected',
      };
    } catch (error: any) {
      console.error('Error checking R2 status:', error);
      return {
        configured: false,
        error: error.message || 'Erro ao verificar status do R2',
      };
    }
  },

  async shareProject(id: string, canEdit: string[] = [], canView: string[] = []): Promise<ShareProjectResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/canvas/${id}/share`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ canEdit, canView }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to share project';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error sharing project:', error);
      throw error;
    }
  },

  async getSharedProject(shareId: string): Promise<CanvasProject> {
    try {
      // No auth headers needed for shared projects
      const response = await fetch(`${API_BASE_URL}/canvas/shared/${shareId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch shared project';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.project;
    } catch (error: any) {
      console.error('Error fetching shared project:', error);
      throw error;
    }
  },

  async updateShareSettings(id: string, settings: Partial<ShareSettings>): Promise<ShareSettings> {
    try {
      const response = await fetch(`${API_BASE_URL}/canvas/${id}/share-settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to update share settings';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error updating share settings:', error);
      throw error;
    }
  },

  async removeShare(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/canvas/${id}/share`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to remove sharing';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error removing share:', error);
      throw error;
    }
  },

  async getLiveblocksAuth(projectId: string): Promise<{ token: string; roomId: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/canvas/${projectId}/liveblocks-auth`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to authenticate with Liveblocks';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }

      // Liveblocks returns the token in the response body
      const text = await response.text();
      const data = JSON.parse(text);

      return {
        token: data.token || text,
        roomId: `canvas-${projectId}`,
      };
    } catch (error: any) {
      console.error('Error getting Liveblocks auth:', error);
      throw error;
    }
  },

  /**
   * Convert base64 string to Blob
   * Used for direct uploads that bypass Vercel size limits
   */
  async base64ToBlob(base64: string): Promise<Blob> {
    // Extract the base64 data and mime type
    let mimeType = 'image/png';
    let base64Data = base64;

    if (base64.startsWith('data:')) {
      const match = base64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        // Handle case where there's no base64 marker
        const parts = base64.split(',');
        if (parts.length > 1) {
          base64Data = parts[1];
        }
      }
    }

    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  },
};





