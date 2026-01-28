import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import { canvasApi } from '@/services/canvasApi';

export interface ProcessNodesResult {
  processedNodes: Node<FlowNodeData>[];
  uploadedCount: number;
  failedCount: number;
}

/**
 * Process canvas nodes and upload base64 images to R2, replacing them with URLs
 * This is the frontend version that proactively uploads images before saving
 * @param nodes - Array of canvas nodes
 * @param canvasId - Canvas project ID
 * @param onProgress - Optional callback for progress updates
 * @returns Processed nodes with base64 images replaced by R2 URLs
 */
export async function processNodesForR2Upload(
  nodes: Node<FlowNodeData>[],
  canvasId: string,
  onProgress?: (current: number, total: number) => void
): Promise<ProcessNodesResult> {
  let uploadedCount = 0;
  let failedCount = 0;
  let processedIndex = 0;
  const totalImages = countBase64Images(nodes);

  const processedNodes = await Promise.all(
    nodes.map(async (node) => {
      const processedNode = { ...node };
      const nodeId = node.id;
      const nodeData = node.data as FlowNodeData;

      try {
        // Process ImageNode: data.mockup.imageBase64 -> data.mockup.imageUrl
        if (nodeData.type === 'image' && nodeData.mockup?.imageBase64) {
          const base64Image = nodeData.mockup.imageBase64;
          if (isBase64Image(base64Image)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(base64Image, canvasId, nodeId);
              processedNode.data = {
                ...nodeData,
                mockup: {
                  ...nodeData.mockup,
                  imageUrl,
                  imageBase64: undefined,
                },
              } as FlowNodeData;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload image for node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }
        }

        // Process MergeNode: data.resultImageBase64 -> data.resultImageUrl
        if (nodeData.type === 'merge' && nodeData.resultImageBase64) {
          const base64Image = nodeData.resultImageBase64;
          if (isBase64Image(base64Image)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(base64Image, canvasId, nodeId);
              processedNode.data = {
                ...nodeData,
                resultImageUrl: imageUrl,
                resultImageBase64: undefined,
              } as FlowNodeData;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload result image for merge node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }
        }

        // Process EditNode: multiple image fields
        if (nodeData.type === 'edit') {
          const editData = nodeData;
          const processedEditData: any = { ...editData };

          // resultImageBase64 -> resultImageUrl
          if (editData.resultImageBase64 && isBase64Image(editData.resultImageBase64)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(editData.resultImageBase64, canvasId, `${nodeId}-result`);
              processedEditData.resultImageUrl = imageUrl;
              processedEditData.resultImageBase64 = undefined;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload result image for edit node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }

          // uploadedImage.base64 -> uploadedImage.url
          if (editData.uploadedImage?.base64 && isBase64Image(editData.uploadedImage.base64)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(editData.uploadedImage.base64, canvasId, `${nodeId}-uploaded`);
              processedEditData.uploadedImage = {
                ...editData.uploadedImage,
                url: imageUrl,
                base64: undefined,
              };
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload uploadedImage for edit node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }

          // referenceImage.base64 -> referenceImage.url
          if (editData.referenceImage?.base64 && isBase64Image(editData.referenceImage.base64)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(editData.referenceImage.base64, canvasId, `${nodeId}-reference`);
              processedEditData.referenceImage = {
                ...editData.referenceImage,
                url: imageUrl,
                base64: undefined,
              };
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload referenceImage for edit node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }

          // referenceImages[].base64 -> referenceImages[].url
          if (editData.referenceImages && Array.isArray(editData.referenceImages)) {
            const processedReferenceImages = await Promise.all(
              editData.referenceImages.map(async (refImage: any, index: number) => {
                if (refImage?.base64 && isBase64Image(refImage.base64)) {
                  try {
                    const imageUrl = await canvasApi.uploadImageToR2(refImage.base64, canvasId, `${nodeId}-ref-${index}`);
                    processedIndex++;
                    onProgress?.(processedIndex, totalImages);
                    uploadedCount++;
                    return {
                      ...refImage,
                      url: imageUrl,
                      base64: undefined,
                    };
                  } catch (uploadError: any) {
                    console.error(`Failed to upload referenceImage[${index}] for edit node ${nodeId}:`, uploadError);
                    failedCount++;
                    processedIndex++;
                    onProgress?.(processedIndex, totalImages);
                    return refImage;
                  }
                }
                return refImage;
              })
            );
            processedEditData.referenceImages = processedReferenceImages;
          }

          processedNode.data = processedEditData as FlowNodeData;
        }

        // Process UpscaleNode: data.resultImageBase64 -> data.resultImageUrl
        if (nodeData.type === 'upscale' && nodeData.resultImageBase64) {
          const base64Image = nodeData.resultImageBase64;
          if (isBase64Image(base64Image)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(base64Image, canvasId, nodeId);
              processedNode.data = {
                ...nodeData,
                resultImageUrl: imageUrl,
                resultImageBase64: undefined,
              } as FlowNodeData;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload result image for upscale node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }
        }

        // Process MockupNode: data.resultImageBase64 -> data.resultImageUrl
        if (nodeData.type === 'mockup' && nodeData.resultImageBase64) {
          const base64Image = nodeData.resultImageBase64;
          if (isBase64Image(base64Image)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(base64Image, canvasId, nodeId);
              processedNode.data = {
                ...nodeData,
                resultImageUrl: imageUrl,
                resultImageBase64: undefined,
              } as FlowNodeData;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload result image for mockup node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }
        }

        // Process PromptNode: data.resultImageBase64 -> data.resultImageUrl
        if (nodeData.type === 'prompt' && nodeData.resultImageBase64) {
          const base64Image = nodeData.resultImageBase64;
          if (isBase64Image(base64Image)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(base64Image, canvasId, nodeId);
              processedNode.data = {
                ...nodeData,
                resultImageUrl: imageUrl,
                resultImageBase64: undefined,
              } as FlowNodeData;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload result image for prompt node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }
        }

        // Process OutputNode: data.resultImageBase64 -> data.resultImageUrl
        if (nodeData.type === 'output' && nodeData.resultImageBase64) {
          const base64Image = nodeData.resultImageBase64;
          if (isBase64Image(base64Image)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(base64Image, canvasId, nodeId);
              processedNode.data = {
                ...nodeData,
                resultImageUrl: imageUrl,
                resultImageBase64: undefined,
              } as FlowNodeData;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload result image for output node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }
        }

        // Process PDFNode: data.pdfBase64 -> data.pdfUrl
        if (nodeData.type === 'pdf' && nodeData.pdfBase64) {
          const base64Pdf = nodeData.pdfBase64;
          if (isBase64Pdf(base64Pdf)) {
            try {
              const pdfUrl = await canvasApi.uploadPdfToR2(base64Pdf, canvasId, nodeId);
              processedNode.data = {
                ...nodeData,
                pdfUrl,
                pdfBase64: undefined,
              } as FlowNodeData;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload PDF for node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }
        }

        // Process ShaderNode: data.resultImageBase64 -> data.resultImageUrl
        if (nodeData.type === 'shader' && nodeData.resultImageBase64) {
          const base64Image = nodeData.resultImageBase64;
          if (isBase64Image(base64Image)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(base64Image, canvasId, nodeId);
              processedNode.data = {
                ...nodeData,
                resultImageUrl: imageUrl,
                resultImageBase64: undefined,
              } as FlowNodeData;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload result image for shader node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }
        }

        // Process BrandNode: logoBase64, identityPdfBase64, identityImageBase64
        if (nodeData.type === 'brand') {
          const brandData = nodeData;
          const processedBrandData: any = { ...brandData };

          if (brandData.logoBase64 && isBase64Image(brandData.logoBase64)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(brandData.logoBase64, canvasId, `${nodeId}-logo`);
              processedBrandData.logoImage = imageUrl;
              processedBrandData.logoBase64 = undefined;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload logo for brand node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }

          if (brandData.identityPdfBase64) {
            try {
              const pdfUrl = await canvasApi.uploadPdfToR2(brandData.identityPdfBase64, canvasId, `${nodeId}-identity`);
              processedBrandData.identityPdfUrl = pdfUrl;
              processedBrandData.identityPdfBase64 = undefined;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload identity PDF for brand node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }

          if (brandData.identityImageBase64 && isBase64Image(brandData.identityImageBase64)) {
            try {
              const imageUrl = await canvasApi.uploadImageToR2(brandData.identityImageBase64, canvasId, `${nodeId}-identity-image`);
              processedBrandData.identityImageUrl = imageUrl;
              processedBrandData.identityImageBase64 = undefined;
              uploadedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            } catch (uploadError: any) {
              console.error(`Failed to upload identity image for brand node ${nodeId}:`, uploadError);
              failedCount++;
              processedIndex++;
              onProgress?.(processedIndex, totalImages);
            }
          }

          processedNode.data = processedBrandData as FlowNodeData;
        }
      } catch (error: any) {
        console.error(`Error processing node ${nodeId}:`, error);
      }

      return processedNode;
    })
  );

  return {
    processedNodes,
    uploadedCount,
    failedCount,
  };
}

/**
 * Check if a string is a base64 image (not already a URL)
 */
function isBase64Image(image: string): boolean {
  return (
    image.startsWith('data:image/') ||
    (!image.startsWith('http://') && !image.startsWith('https://'))
  );
}

/**
 * Check if a string is a base64 PDF (not already a URL)
 */
function isBase64Pdf(pdf: string): boolean {
  return (
    pdf.startsWith('data:application/pdf') ||
    (!pdf.startsWith('http://') && !pdf.startsWith('https://'))
  );
}

/**
 * Count total number of base64 images and PDFs in nodes
 */
function countBase64Images(nodes: Node<FlowNodeData>[]): number {
  let count = 0;
  nodes.forEach((node) => {
    const nodeData = node.data as FlowNodeData;

    if (nodeData.type === 'image' && nodeData.mockup?.imageBase64) count++;
    if (nodeData.type === 'merge' && nodeData.resultImageBase64) count++;
    if (nodeData.type === 'upscale' && nodeData.resultImageBase64) count++;
    if (nodeData.type === 'mockup' && nodeData.resultImageBase64) count++;
    if (nodeData.type === 'prompt' && nodeData.resultImageBase64) count++;
    if (nodeData.type === 'output' && nodeData.resultImageBase64) count++;
    if (nodeData.type === 'pdf' && nodeData.pdfBase64) count++;

    if (nodeData.type === 'edit') {
      if (nodeData.resultImageBase64) count++;
      if (nodeData.uploadedImage?.base64) count++;
      if (nodeData.referenceImage?.base64) count++;
      if (nodeData.referenceImages?.some((img: any) => img?.base64)) {
        count += nodeData.referenceImages.filter((img: any) => img?.base64).length;
      }
    }

    if (nodeData.type === 'brand') {
      if (nodeData.logoBase64) count++;
      if (nodeData.identityPdfBase64) count++;
      if (nodeData.identityImageBase64) count++;
    }
  });
  return count;
}
