/**
 * r2UploadHelpers
 * 
 * Funções auxiliares para detecção e gerenciamento de uploads R2
 * Centraliza lógica de detecção de base64 que precisa de upload
 */

import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import type {
  ImageNodeData,
  LogoNodeData,
  BrandNodeData,
  PDFNodeData,
  EditNodeData,
  VideoInputNodeData,
  VideoNodeData,
  OutputNodeData
} from '@/types/reactFlow';

/**
 * Tipos de upload que podem ser necessários
 */
export type UploadType =
  | 'image-mockup'        // ImageNode.mockup.imageBase64
  | 'logo'                // LogoNode.logoBase64
  | 'brand-logo'          // BrandNode.logoBase64
  | 'pdf'                 // PDFNode.pdfBase64
  | 'result-image'        // Qualquer node com resultImageBase64
  | 'edit-uploaded'       // EditNode.uploadedImage.base64
  | 'video-input'         // VideoInputNode.uploadedVideo (base64)
  | 'video-result'        // VideoNode.resultVideoBase64
  | 'output-video';       // OutputNode.resultVideoBase64 (vídeo)

/**
 * Informação sobre um node que precisa de upload
 */
export interface NodeUploadInfo {
  nodeId: string;
  nodeType: string;
  uploadType: UploadType;
  base64Data: string;
  nodeKey?: string; // Chave específica para identificar o campo (ex: 'uploaded', 'logo')
}

/**
 * Verifica se uma string é base64 (não é URL)
 */
export function isBase64String(value: string): boolean {
  if (!value) return false;

  // Data URLs são base64 com prefixo
  if (value.startsWith('data:')) {
    return true;
  }

  // Verificar se é uma URL com scheme (qualquer coisa seguida de ://)
  // Isso cobre http://, https://, ftp://, ws://, wss://, etc.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
    return false;
  }

  // Blob URLs (blob:http://... ou blob:https://...)
  // Verificar antes do padrão de scheme para pegar blob: sem //
  if (value.startsWith('blob:')) {
    return false;
  }

  // File URLs (file://... ou file:/...)
  if (value.startsWith('file:')) {
    return false;
  }

  // Protocol-relative URLs (//cdn.example.com/file)
  if (value.startsWith('//')) {
    return false;
  }

  // Relative URLs (começando com /)
  if (value.startsWith('/')) {
    return false;
  }

  // Verificar outros schemes conhecidos que podem não ter //
  // Ex: mailto:, tel:, javascript:, etc.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    return false;
  }

  // Para outras strings, verificar se parece base64
  // Base64 válido contém apenas: A-Z, a-z, 0-9, +, /, = (padding)
  // Deve ter comprimento mínimo razoável e não conter caracteres inválidos
  const base64Pattern = /^[A-Za-z0-9+/=]+$/;
  const minLength = 20; // Base64 mínimo razoável para dados reais

  if (value.length >= minLength && base64Pattern.test(value)) {
    // Verificar se tem padding válido (0, 1 ou 2 caracteres = no final)
    const paddingMatch = value.match(/=+$/);
    const paddingLength = paddingMatch ? paddingMatch[0].length : 0;
    if (paddingLength <= 2) {
      return true;
    }
  }

  // Se não se encaixa em nenhum padrão conhecido, assumir que não é base64
  return false;
}

/**
 * Extrai base64 puro de uma string (remove data URL prefix se presente)
 */
export function extractBase64(data: string): string {
  if (!data) return '';
  // Remove data URL prefix se presente
  if (data.includes(',')) {
    return data.split(',')[1] || data;
  }
  return data;
}

/**
 * Detecta nodes que precisam de upload para R2
 * Retorna array de informações sobre nodes que têm base64 sem URL correspondente
 */
export function detectNodesNeedingUpload(
  nodes: Node<FlowNodeData>[]
): NodeUploadInfo[] {
  const nodesNeedingUpload: NodeUploadInfo[] = [];

  nodes.forEach((node) => {
    const data = node.data as any;

    // ImageNode - mockup.imageBase64
    if (node.type === 'image') {
      const imageData = data as ImageNodeData;
      if (imageData.mockup?.imageBase64 && !imageData.mockup?.imageUrl) {
        nodesNeedingUpload.push({
          nodeId: node.id,
          nodeType: 'image',
          uploadType: 'image-mockup',
          base64Data: imageData.mockup.imageBase64,
        });
      }
    }

    // LogoNode - logoBase64
    if (node.type === 'logo') {
      const logoData = data as LogoNodeData;
      if (logoData.logoBase64 && !logoData.logoImageUrl) {
        nodesNeedingUpload.push({
          nodeId: node.id,
          nodeType: 'logo',
          uploadType: 'logo',
          base64Data: logoData.logoBase64,
        });
      }
    }

    // BrandNode - logoBase64
    if (node.type === 'brand') {
      const brandData = data as BrandNodeData;
      if (brandData.logoBase64 && !brandData.logoImage) {
        nodesNeedingUpload.push({
          nodeId: node.id,
          nodeType: 'brand',
          uploadType: 'brand-logo',
          base64Data: brandData.logoBase64,
        });
      }
    }

    // PDFNode - pdfBase64
    if (node.type === 'pdf') {
      const pdfData = data as PDFNodeData;
      if (pdfData.pdfBase64 && !pdfData.pdfUrl) {
        nodesNeedingUpload.push({
          nodeId: node.id,
          nodeType: 'pdf',
          uploadType: 'pdf',
          base64Data: pdfData.pdfBase64,
        });
      }
    }

    // Nodes com resultImageBase64 (merge, edit, upscale, mockup, prompt, output, shader, angle, texture, ambience, luminance, upscaleBicubic)
    if (data.resultImageBase64 && !data.resultImageUrl) {
      nodesNeedingUpload.push({
        nodeId: node.id,
        nodeType: node.type || 'unknown',
        uploadType: 'result-image',
        base64Data: data.resultImageBase64,
      });
    }

    // EditNode - uploadedImage.base64
    if (node.type === 'edit') {
      const editData = data as EditNodeData;
      if (editData.uploadedImage?.base64 && !editData.uploadedImage?.url) {
        nodesNeedingUpload.push({
          nodeId: node.id,
          nodeType: 'edit',
          uploadType: 'edit-uploaded',
          base64Data: editData.uploadedImage.base64,
          nodeKey: 'uploaded',
        });
      }
    }

    // VideoInputNode - uploadedVideo (base64 sem URL)
    if (node.type === 'videoInput') {
      const videoInputData = data as VideoInputNodeData;
      if (videoInputData.uploadedVideo && !videoInputData.uploadedVideoUrl) {
        // Verificar se é base64 (não URL)
        if (isBase64String(videoInputData.uploadedVideo)) {
          nodesNeedingUpload.push({
            nodeId: node.id,
            nodeType: 'videoInput',
            uploadType: 'video-input',
            base64Data: videoInputData.uploadedVideo,
          });
        }
      }
    }

    // VideoNode - resultVideoBase64
    if (node.type === 'video') {
      const videoData = data as VideoNodeData;
      if (videoData.resultVideoBase64 && !videoData.resultVideoUrl) {
        nodesNeedingUpload.push({
          nodeId: node.id,
          nodeType: 'video',
          uploadType: 'video-result',
          base64Data: videoData.resultVideoBase64,
        });
      }
    }

    // OutputNode - resultVideoBase64 (se for vídeo)
    if (node.type === 'output') {
      const outputData = data as OutputNodeData;
      if (outputData.resultVideoBase64 && !outputData.resultVideoUrl) {
        // Verificar se é vídeo (não imagem)
        const isVideo = outputData.resultVideoBase64.startsWith('data:video/') ||
          outputData.resultVideoBase64.includes('video');
        if (isVideo) {
          nodesNeedingUpload.push({
            nodeId: node.id,
            nodeType: 'output',
            uploadType: 'output-video',
            base64Data: outputData.resultVideoBase64,
          });
        }
      }
    }
  });

  return nodesNeedingUpload;
}

/**
 * Coleta todas as URLs do R2 de um node para deleção
 * Retorna array de URLs que devem ser deletadas quando o node é removido
 */
export function collectR2UrlsForDeletion(
  node: Node<FlowNodeData>,
  isLiked: boolean = false
): string[] {
  // Se for liked, não deletar
  if (isLiked) return [];

  const urls: string[] = [];
  const data = node.data as any;

  // ImageNode
  if (node.type === 'image') {
    const imageUrl = data.mockup?.imageUrl;
    if (imageUrl && !imageUrl.startsWith('data:')) {
      urls.push(imageUrl);
    }
  }

  // Nodes com resultImageUrl ou resultVideoUrl
  if (data.resultImageUrl && !data.resultImageUrl.startsWith('data:')) {
    urls.push(data.resultImageUrl);
  }
  if (data.resultVideoUrl && !data.resultVideoUrl.startsWith('data:')) {
    urls.push(data.resultVideoUrl);
  }

  // LogoNode
  if (node.type === 'logo') {
    if (data.logoImageUrl && !data.logoImageUrl.startsWith('data:')) {
      urls.push(data.logoImageUrl);
    }
  }

  // BrandNode
  if (node.type === 'brand') {
    if (data.logoImage && !data.logoImage.startsWith('data:')) {
      urls.push(data.logoImage);
    }
    if (data.identityPdfUrl && !data.identityPdfUrl.startsWith('data:')) {
      urls.push(data.identityPdfUrl);
    }
    if (data.identityImageUrl && !data.identityImageUrl.startsWith('data:')) {
      urls.push(data.identityImageUrl);
    }
  }

  // PDFNode
  if (node.type === 'pdf') {
    if (data.pdfUrl && !data.pdfUrl.startsWith('data:')) {
      urls.push(data.pdfUrl);
    }
  }

  // EditNode
  if (node.type === 'edit') {
    if (data.uploadedImage?.url && !data.uploadedImage.url.startsWith('data:')) {
      urls.push(data.uploadedImage.url);
    }
    if (data.referenceImage?.url && !data.referenceImage.url.startsWith('data:')) {
      urls.push(data.referenceImage.url);
    }
    // referenceImages array
    if (Array.isArray(data.referenceImages)) {
      data.referenceImages.forEach((refImg: any) => {
        if (refImg?.url && !refImg.url.startsWith('data:')) {
          urls.push(refImg.url);
        }
      });
    }
  }

  // VideoInputNode
  if (node.type === 'videoInput') {
    if (data.uploadedVideoUrl && !data.uploadedVideoUrl.startsWith('data:')) {
      urls.push(data.uploadedVideoUrl);
    }
  }

  return urls;
}

