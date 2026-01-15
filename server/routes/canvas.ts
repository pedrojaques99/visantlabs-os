import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma, verifyPrismaConnectionWithDetails } from '../db/prisma.js';
import { uploadCanvasImage, uploadCanvasPdf, uploadCanvasVideo, isR2Configured, generateCanvasImageUploadUrl, generateCanvasVideoUploadUrl } from '../services/r2Service.js';
import { compressPdfSimple } from '../utils/pdfCompression.js';
import { validateAdminOrPremium, requireEditAccess, requireViewAccess } from '../middleware/canvasAuth.js';
import { Liveblocks } from '@liveblocks/node';

const router = express.Router();

// Generate unique share ID
const generateShareId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Convert email addresses to user IDs
// Accepts an array that may contain emails or user IDs
// Returns an array of user IDs only
async function convertEmailsToUserIds(identifiers: string[]): Promise<string[]> {
  if (!Array.isArray(identifiers) || identifiers.length === 0) {
    return [];
  }

  const userIds: string[] = [];
  const invalidEmails: string[] = [];

  for (const identifier of identifiers) {
    // Check if it's already a valid MongoDB ObjectId format (24 hex characters)
    if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
      userIds.push(identifier);
      continue;
    }

    // Try to find user by email
    try {
      const user = await prisma.user.findUnique({
        where: { email: identifier },
        select: { id: true },
      });

      if (user) {
        userIds.push(user.id);
      } else {
        invalidEmails.push(identifier);
      }
    } catch (error) {
      console.error(`Error finding user by email ${identifier}:`, error);
      invalidEmails.push(identifier);
    }
  }

  if (invalidEmails.length > 0) {
    console.warn(`Could not find users for emails: ${invalidEmails.join(', ')}`);
  }

  return userIds;
}

// Configuration: Base64 image expiration time in milliseconds
// Default: 7 days (7 * 24 * 60 * 60 * 1000)
const BASE64_EXPIRATION_MS = parseInt(process.env.CANVAS_BASE64_EXPIRATION_DAYS || '7') * 24 * 60 * 60 * 1000;

/**
 * Check if a base64 string is expired based on its timestamp
 * @param base64Timestamp - Timestamp when base64 was created (in ms)
 * @returns true if expired, false otherwise
 */
function isBase64Expired(base64Timestamp: number | undefined): boolean {
  if (!base64Timestamp) return true; // If no timestamp, consider expired
  const now = Date.now();
  return (now - base64Timestamp) > BASE64_EXPIRATION_MS;
}

/**
 * Clean expired base64 images from canvas nodes
 * Removes base64 data that is older than the expiration time
 * @param nodes - Array of canvas nodes
 * @returns Cleaned nodes with expired base64 images removed
 */
function cleanExpiredBase64Images(nodes: any[]): any[] {
  const cleanedNodes = nodes.map((node: any) => {
    const cleanedNode = { ...node };

    try {
      // Process ImageNode: remove expired imageBase64
      if (node.type === 'image' && node.data?.mockup) {
        const mockup = node.data.mockup;
        // If has imageUrl (R2), remove base64 regardless of expiration
        if (mockup.imageUrl) {
          cleanedNode.data = {
            ...cleanedNode.data,
            mockup: {
              ...mockup,
              imageBase64: undefined,
              base64Timestamp: undefined,
            },
          };
        } else if (mockup.imageBase64) {
          // Check if base64 is expired
          if (isBase64Expired(mockup.base64Timestamp)) {
            cleanedNode.data = {
              ...cleanedNode.data,
              mockup: {
                ...mockup,
                imageBase64: undefined,
                base64Timestamp: undefined,
              },
            };
          }
        }
      }

      // Process MergeNode: remove expired resultImageBase64
      if (node.type === 'merge' && node.data) {
        if (node.data.resultImageUrl) {
          // Has R2 URL, remove base64
          cleanedNode.data = {
            ...cleanedNode.data,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          };
        } else if (node.data.resultImageBase64) {
          // Check expiration
          if (isBase64Expired(node.data.resultImageBase64Timestamp)) {
            cleanedNode.data = {
              ...cleanedNode.data,
              resultImageBase64: undefined,
              resultImageBase64Timestamp: undefined,
            };
          }
        }
      }

      // Process EditNode: multiple image fields
      if (node.type === 'edit' && node.data) {
        // resultImageBase64
        if (node.data.resultImageUrl) {
          cleanedNode.data = {
            ...cleanedNode.data,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          };
        } else if (node.data.resultImageBase64) {
          if (isBase64Expired(node.data.resultImageBase64Timestamp)) {
            cleanedNode.data = {
              ...cleanedNode.data,
              resultImageBase64: undefined,
              resultImageBase64Timestamp: undefined,
            };
          }
        }

        // uploadedImage
        if (node.data.uploadedImage) {
          if (node.data.uploadedImage.url) {
            cleanedNode.data = {
              ...cleanedNode.data,
              uploadedImage: {
                ...node.data.uploadedImage,
                base64: undefined,
                base64Timestamp: undefined,
              },
            };
          } else if (node.data.uploadedImage.base64) {
            if (isBase64Expired(node.data.uploadedImage.base64Timestamp)) {
              cleanedNode.data = {
                ...cleanedNode.data,
                uploadedImage: {
                  ...node.data.uploadedImage,
                  base64: undefined,
                  base64Timestamp: undefined,
                },
              };
            }
          }
        }

        // referenceImage
        if (node.data.referenceImage) {
          if (node.data.referenceImage.url) {
            cleanedNode.data = {
              ...cleanedNode.data,
              referenceImage: {
                ...node.data.referenceImage,
                base64: undefined,
                base64Timestamp: undefined,
              },
            };
          } else if (node.data.referenceImage.base64) {
            if (isBase64Expired(node.data.referenceImage.base64Timestamp)) {
              cleanedNode.data = {
                ...cleanedNode.data,
                referenceImage: {
                  ...node.data.referenceImage,
                  base64: undefined,
                  base64Timestamp: undefined,
                },
              };
            }
          }
        }

        // referenceImages array
        if (node.data.referenceImages && Array.isArray(node.data.referenceImages)) {
          cleanedNode.data = {
            ...cleanedNode.data,
            referenceImages: node.data.referenceImages.map((refImage: any) => {
              if (refImage.url) {
                return {
                  ...refImage,
                  base64: undefined,
                  base64Timestamp: undefined,
                };
              } else if (refImage.base64) {
                if (isBase64Expired(refImage.base64Timestamp)) {
                  return {
                    ...refImage,
                    base64: undefined,
                    base64Timestamp: undefined,
                  };
                }
              }
              return refImage;
            }),
          };
        }
      }

      // Process UpscaleNode: remove expired resultImageBase64
      if (node.type === 'upscale' && node.data) {
        if (node.data.resultImageUrl) {
          cleanedNode.data = {
            ...cleanedNode.data,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          };
        } else if (node.data.resultImageBase64) {
          if (isBase64Expired(node.data.resultImageBase64Timestamp)) {
            cleanedNode.data = {
              ...cleanedNode.data,
              resultImageBase64: undefined,
              resultImageBase64Timestamp: undefined,
            };
          }
        }
      }

      // Process MockupNode: remove expired resultImageBase64
      if (node.type === 'mockup' && node.data) {
        if (node.data.resultImageUrl) {
          cleanedNode.data = {
            ...cleanedNode.data,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          };
        } else if (node.data.resultImageBase64) {
          if (isBase64Expired(node.data.resultImageBase64Timestamp)) {
            cleanedNode.data = {
              ...cleanedNode.data,
              resultImageBase64: undefined,
              resultImageBase64Timestamp: undefined,
            };
          }
        }
      }

      // Process node: remove expired resultImageBase64
      if (node.data) {
        if (node.data.resultImageUrl) {
          cleanedNode.data = {
            ...cleanedNode.data,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          };
        } else if (node.data.resultImageBase64) {
          if (isBase64Expired(node.data.resultImageBase64Timestamp)) {
            cleanedNode.data = {
              ...cleanedNode.data,
              resultImageBase64: undefined,
              resultImageBase64Timestamp: undefined,
            };
          }
        }
      }

      // Process OutputNode: remove expired resultImageBase64
      if (node.type === 'output' && node.data) {
        if (node.data.resultImageUrl) {
          cleanedNode.data = {
            ...cleanedNode.data,
            resultImageBase64: undefined,
            resultImageBase64Timestamp: undefined,
          };
        } else if (node.data.resultImageBase64) {
          if (isBase64Expired(node.data.resultImageBase64Timestamp)) {
            cleanedNode.data = {
              ...cleanedNode.data,
              resultImageBase64: undefined,
              resultImageBase64Timestamp: undefined,
            };
          }
        }
      }

      // Process PDFNode: remove expired pdfBase64
      if (node.type === 'pdf' && node.data) {
        if (node.data.pdfUrl) {
          // Has R2 URL, remove base64
          cleanedNode.data = {
            ...cleanedNode.data,
            pdfBase64: undefined,
            pdfBase64Timestamp: undefined,
          };
        } else if (node.data.pdfBase64) {
          // Check expiration
          if (isBase64Expired(node.data.pdfBase64Timestamp)) {
            cleanedNode.data = {
              ...cleanedNode.data,
              pdfBase64: undefined,
              pdfBase64Timestamp: undefined,
            };
          }
        }
      }

      // Process BrandNode: remove expired identityPdfBase64
      if (node.type === 'brand' && node.data) {
        if (node.data.identityPdfUrl) {
          cleanedNode.data = {
            ...cleanedNode.data,
            identityPdfBase64: undefined,
            identityPdfBase64Timestamp: undefined,
          };
        } else if (node.data.identityPdfBase64) {
          if (isBase64Expired(node.data.identityPdfBase64Timestamp)) {
            cleanedNode.data = {
              ...cleanedNode.data,
              identityPdfBase64: undefined,
              identityPdfBase64Timestamp: undefined,
            };
          }
        }
      }
    } catch (error: any) {
      console.error(`Error cleaning node ${node.id}:`, error);
      // Return original node if cleaning fails
      return node;
    }

    return cleanedNode;
  });

  return cleanedNodes;
}

/**
 * Add timestamps to base64 images that don't have them
 * This helps track when base64 images were created
 * @param nodes - Array of canvas nodes
 * @returns Nodes with timestamps added to base64 images
 */
function addBase64Timestamps(nodes: any[]): any[] {
  const now = Date.now();

  return nodes.map((node: any) => {
    const timestampedNode = { ...node };

    try {
      // Process ImageNode
      if (node.type === 'image' && node.data?.mockup) {
        const mockup = node.data.mockup;
        if (mockup.imageBase64 && !mockup.base64Timestamp) {
          timestampedNode.data = {
            ...timestampedNode.data,
            mockup: {
              ...mockup,
              base64Timestamp: now,
            },
          };
        }
      }

      // Process MergeNode
      if (node.type === 'merge' && node.data?.resultImageBase64 && !node.data.resultImageBase64Timestamp) {
        timestampedNode.data = {
          ...timestampedNode.data,
          resultImageBase64Timestamp: now,
        };
      }

      // Process EditNode
      if (node.type === 'edit' && node.data) {
        if (node.data.resultImageBase64 && !node.data.resultImageBase64Timestamp) {
          timestampedNode.data = {
            ...timestampedNode.data,
            resultImageBase64Timestamp: now,
          };
        }
        if (node.data.uploadedImage?.base64 && !node.data.uploadedImage.base64Timestamp) {
          timestampedNode.data = {
            ...timestampedNode.data,
            uploadedImage: {
              ...node.data.uploadedImage,
              base64Timestamp: now,
            },
          };
        }
        if (node.data.referenceImage?.base64 && !node.data.referenceImage.base64Timestamp) {
          timestampedNode.data = {
            ...timestampedNode.data,
            referenceImage: {
              ...node.data.referenceImage,
              base64Timestamp: now,
            },
          };
        }
        if (node.data.referenceImages && Array.isArray(node.data.referenceImages)) {
          timestampedNode.data = {
            ...timestampedNode.data,
            referenceImages: node.data.referenceImages.map((refImage: any) => {
              if (refImage.base64 && !refImage.base64Timestamp) {
                return {
                  ...refImage,
                  base64Timestamp: now,
                };
              }
              return refImage;
            }),
          };
        }
      }

      // Process UpscaleNode
      if (node.type === 'upscale' && node.data?.resultImageBase64 && !node.data.resultImageBase64Timestamp) {
        timestampedNode.data = {
          ...timestampedNode.data,
          resultImageBase64Timestamp: now,
        };
      }

      // Process MockupNode
      if (node.type === 'mockup' && node.data?.resultImageBase64 && !node.data.resultImageBase64Timestamp) {
        timestampedNode.data = {
          ...timestampedNode.data,
          resultImageBase64Timestamp: now,
        };
      }


      // Process OutputNode
      if (node.type === 'output' && node.data?.resultImageBase64 && !node.data.resultImageBase64Timestamp) {
        timestampedNode.data = {
          ...timestampedNode.data,
          resultImageBase64Timestamp: now,
        };
      }

      // Process PDFNode
      if (node.type === 'pdf' && node.data?.pdfBase64 && !node.data.pdfBase64Timestamp) {
        timestampedNode.data = {
          ...timestampedNode.data,
          pdfBase64Timestamp: now,
        };
      }

      // Process BrandNode
      if (node.type === 'brand' && node.data?.identityPdfBase64 && !node.data.identityPdfBase64Timestamp) {
        timestampedNode.data = {
          ...timestampedNode.data,
          identityPdfBase64Timestamp: now,
        };
      }
    } catch (error: any) {
      console.error(`Error adding timestamp to node ${node.id}:`, error);
      return node;
    }

    return timestampedNode;
  });
}

/**
 * Process canvas nodes and upload base64 images to R2, replacing them with URLs
 * @param nodes - Array of canvas nodes
 * @param userId - User ID
 * @param canvasId - Canvas project ID
 * @returns Processed nodes with base64 images replaced by R2 URLs
 */
async function processCanvasNodesForR2(
  nodes: any[],
  userId: string,
  canvasId: string
): Promise<any[]> {
  if (!isR2Configured()) {
    console.warn('R2 not configured, skipping image upload to R2');
    return nodes;
  }

  const processedNodes = await Promise.all(
    nodes.map(async (node: any) => {
      const processedNode = { ...node };
      const nodeId = node.id;

      try {
        // Process ImageNode: data.mockup.imageBase64 -> data.mockup.imageUrl
        if (node.type === 'image' && node.data?.mockup?.imageBase64) {
          const base64Image = node.data.mockup.imageBase64;
          // Only upload if it's base64 (not already a URL)
          if (base64Image.startsWith('data:image/') || (!base64Image.startsWith('http://') && !base64Image.startsWith('https://'))) {
            try {
              const imageUrl = await uploadCanvasImage(base64Image, userId, canvasId, nodeId);
              processedNode.data = {
                ...processedNode.data,
                mockup: {
                  ...processedNode.data.mockup,
                  imageUrl,
                  imageBase64: undefined, // Remove base64 after upload
                },
              };
            } catch (uploadError: any) {
              console.error(`Failed to upload image for node ${nodeId}:`, uploadError);
              // Keep base64 if upload fails
            }
          }
        }

        // Process MergeNode: data.resultImageBase64 -> data.resultImageUrl
        if (node.type === 'merge' && node.data?.resultImageBase64) {
          const base64Image = node.data.resultImageBase64;
          if (base64Image.startsWith('data:image/') || (!base64Image.startsWith('http://') && !base64Image.startsWith('https://'))) {
            try {
              const imageUrl = await uploadCanvasImage(base64Image, userId, canvasId, nodeId);
              processedNode.data = {
                ...processedNode.data,
                resultImageUrl: imageUrl,
                resultImageBase64: undefined,
              };
            } catch (uploadError: any) {
              console.error(`Failed to upload result image for merge node ${nodeId}:`, uploadError);
            }
          }
        }

        // Process EditNode: multiple image fields
        if (node.type === 'edit') {
          // resultImageBase64 -> resultImageUrl
          if (node.data?.resultImageBase64) {
            const base64Image = node.data.resultImageBase64;
            if (base64Image.startsWith('data:image/') || (!base64Image.startsWith('http://') && !base64Image.startsWith('https://'))) {
              try {
                const imageUrl = await uploadCanvasImage(base64Image, userId, canvasId, `${nodeId}-result`);
                processedNode.data = {
                  ...processedNode.data,
                  resultImageUrl: imageUrl,
                  resultImageBase64: undefined,
                };
              } catch (uploadError: any) {
                console.error(`Failed to upload result image for edit node ${nodeId}:`, uploadError);
              }
            }
          }

          // uploadedImage.base64 -> uploadedImage.url
          if (node.data?.uploadedImage?.base64) {
            const base64Image = node.data.uploadedImage.base64;
            if (base64Image.startsWith('data:image/') || (!base64Image.startsWith('http://') && !base64Image.startsWith('https://'))) {
              try {
                const imageUrl = await uploadCanvasImage(base64Image, userId, canvasId, `${nodeId}-uploaded`);
                processedNode.data = {
                  ...processedNode.data,
                  uploadedImage: {
                    ...processedNode.data.uploadedImage,
                    url: imageUrl,
                    base64: undefined,
                  },
                };
              } catch (uploadError: any) {
                console.error(`Failed to upload uploadedImage for edit node ${nodeId}:`, uploadError);
              }
            }
          }

          // referenceImage.base64 -> referenceImage.url
          if (node.data?.referenceImage?.base64) {
            const base64Image = node.data.referenceImage.base64;
            if (base64Image.startsWith('data:image/') || (!base64Image.startsWith('http://') && !base64Image.startsWith('https://'))) {
              try {
                const imageUrl = await uploadCanvasImage(base64Image, userId, canvasId, `${nodeId}-reference`);
                processedNode.data = {
                  ...processedNode.data,
                  referenceImage: {
                    ...processedNode.data.referenceImage,
                    url: imageUrl,
                    base64: undefined,
                  },
                };
              } catch (uploadError: any) {
                console.error(`Failed to upload referenceImage for edit node ${nodeId}:`, uploadError);
              }
            }
          }

          // referenceImages[].base64 -> referenceImages[].url
          if (node.data?.referenceImages && Array.isArray(node.data.referenceImages)) {
            const processedReferenceImages = await Promise.all(
              node.data.referenceImages.map(async (refImage: any, index: number) => {
                if (refImage?.base64) {
                  const base64Image = refImage.base64;
                  if (base64Image.startsWith('data:image/') || (!base64Image.startsWith('http://') && !base64Image.startsWith('https://'))) {
                    try {
                      const imageUrl = await uploadCanvasImage(base64Image, userId, canvasId, `${nodeId}-ref-${index}`);
                      return {
                        ...refImage,
                        url: imageUrl,
                        base64: undefined,
                      };
                    } catch (uploadError: any) {
                      console.error(`Failed to upload referenceImage[${index}] for edit node ${nodeId}:`, uploadError);
                      return refImage;
                    }
                  }
                }
                return refImage;
              })
            );
            processedNode.data = {
              ...processedNode.data,
              referenceImages: processedReferenceImages,
            };
          }
        }

        // Process UpscaleNode: data.resultImageBase64 -> data.resultImageUrl
        if (node.type === 'upscale' && node.data?.resultImageBase64) {
          const base64Image = node.data.resultImageBase64;
          if (base64Image.startsWith('data:image/') || (!base64Image.startsWith('http://') && !base64Image.startsWith('https://'))) {
            try {
              const imageUrl = await uploadCanvasImage(base64Image, userId, canvasId, nodeId);
              processedNode.data = {
                ...processedNode.data,
                resultImageUrl: imageUrl,
                resultImageBase64: undefined,
              };
            } catch (uploadError: any) {
              console.error(`Failed to upload result image for upscale node ${nodeId}:`, uploadError);
            }
          }
        }

        // Process PDFNode: data.pdfBase64 -> data.pdfUrl
        if (node.type === 'pdf' && node.data?.pdfBase64) {
          const base64Pdf = node.data.pdfBase64;
          // Only upload if it's base64 (not already a URL)
          if (base64Pdf.startsWith('data:application/pdf') || (!base64Pdf.startsWith('http://') && !base64Pdf.startsWith('https://'))) {
            try {
              // Compress PDF before upload
              const compressedPdf = await compressPdfSimple(base64Pdf);
              const pdfUrl = await uploadCanvasPdf(compressedPdf, userId, canvasId, nodeId);
              processedNode.data = {
                ...processedNode.data,
                pdfUrl,
                pdfBase64: undefined, // Remove base64 after upload
              };
            } catch (uploadError: any) {
              console.error(`Failed to upload PDF for node ${nodeId}:`, uploadError);
              // Keep base64 if upload fails
            }
          }
        }

        // Process BrandNode: data.identityPdfBase64 -> data.identityPdfUrl
        if (node.type === 'brand' && node.data?.identityPdfBase64) {
          const base64Pdf = node.data.identityPdfBase64;
          if (base64Pdf.startsWith('data:application/pdf') || (!base64Pdf.startsWith('http://') && !base64Pdf.startsWith('https://'))) {
            try {
              // Compress PDF before upload
              const compressedPdf = await compressPdfSimple(base64Pdf);
              const pdfUrl = await uploadCanvasPdf(compressedPdf, userId, canvasId, `${nodeId}-identity`);
              processedNode.data = {
                ...processedNode.data,
                identityPdfUrl: pdfUrl,
                identityPdfBase64: undefined,
              };
            } catch (uploadError: any) {
              console.error(`Failed to upload identity PDF for brand node ${nodeId}:`, uploadError);
            }
          }
        }
      } catch (error: any) {
        console.error(`Error processing node ${nodeId}:`, error);
        // Return original node if processing fails
      }

      return processedNode;
    })
  );

  return processedNodes;
}

// List user's canvas projects
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const projects = await prisma.canvasProject.findMany({
      where: {
        userId: req.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map Prisma's 'id' to '_id' for consistency with frontend
    res.json({
      projects: projects.map(project => ({
        ...project,
        _id: project.id,
      }))
    });
  } catch (error: any) {
    const isConnectionError = error.code === 'P1001' ||
      error.message?.includes('connect') ||
      error.message?.includes('connection');

    let connectionStatus = null;
    if (isConnectionError) {
      connectionStatus = await verifyPrismaConnectionWithDetails();
    }

    console.error('Error fetching canvas projects:', {
      error: error.message || error,
      stack: error.stack,
      name: error.name,
      code: error.code,
      userId: req.userId,
      prismaError: error.meta || error.cause,
      connectionStatus,
      timestamp: new Date().toISOString(),
    });

    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment
      ? error.message || 'An error occurred'
      : 'Failed to fetch canvas projects';

    res.status(500).json({
      error: 'Failed to fetch canvas projects',
      message: errorMessage,
      ...(isDevelopment && {
        details: {
          name: error.name,
          code: error.code,
          meta: error.meta,
          connectionIssue: isConnectionError ? connectionStatus : undefined,
        }
      })
    });
  }
});

// Get shared project by shareId (no auth required)
// MUST be before /:id route to avoid route conflicts
router.get('/shared/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;

    console.log('[Canvas] Fetching shared project with shareId:', shareId);

    const project = await prisma.canvasProject.findFirst({
      where: {
        shareId,
      },
    });

    if (!project) {
      console.log('[Canvas] Shared project not found for shareId:', shareId);
      return res.status(404).json({ error: 'Project not found' });
    }

    console.log('[Canvas] Found shared project:', { id: project.id, name: project.name, isCollaborative: project.isCollaborative });

    // Clean expired base64 images before returning
    let cleanedNodes = project.nodes as any[];
    if (Array.isArray(cleanedNodes)) {
      cleanedNodes = cleanExpiredBase64Images(cleanedNodes);
    }

    res.json({
      project: {
        ...project,
        _id: project.id,
        nodes: cleanedNodes,
      }
    });
  } catch (error: any) {
    console.error('Error fetching shared project:', error);
    res.status(500).json({
      error: 'Failed to fetch shared project',
      message: error.message || 'An error occurred'
    });
  }
});

// Get canvas project by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }


    let project = await prisma.canvasProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });


    if (!project) {

      // Check if project exists and user has collaboration permissions
      const sharedProject = await prisma.canvasProject.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          isCollaborative: true,
          canEdit: true,
          canView: true,
        },
      });


      if (!sharedProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check if project is collaborative and user has permission
      if (!sharedProject.isCollaborative) {
        return res.status(403).json({ error: 'Project is not shared' });
      }

      const canEdit = Array.isArray(sharedProject.canEdit) && sharedProject.canEdit.includes(req.userId);
      const canView = Array.isArray(sharedProject.canView) && sharedProject.canView.includes(req.userId);

      if (!canEdit && !canView) {
        return res.status(403).json({ error: 'You do not have permission to access this project' });
      }

      // User has permission, fetch full project
      const fullProject = await prisma.canvasProject.findUnique({
        where: { id },
      });

      if (!fullProject) {
        return res.status(404).json({ error: 'Project not found' });
      }


      // Use fullProject for the rest of the logic
      project = fullProject;
    } else {
    }

    // Clean expired base64 images before returning
    let cleanedNodes = project.nodes as any[];
    if (Array.isArray(cleanedNodes)) {
      cleanedNodes = cleanExpiredBase64Images(cleanedNodes);

      // If any nodes were cleaned, update the project
      const nodesChanged = JSON.stringify(cleanedNodes) !== JSON.stringify(project.nodes);
      if (nodesChanged) {
        try {
          await prisma.canvasProject.update({
            where: { id },
            data: { nodes: cleanedNodes as any },
          });
        } catch (updateError: any) {
          console.error('Failed to update project after cleaning expired base64:', updateError);
          // Continue with response even if update fails
        }
      }
    }

    // Map Prisma's 'id' to '_id' for consistency with frontend
    res.json({
      project: {
        ...project,
        _id: project.id,
        nodes: cleanedNodes,
      }
    });
  } catch (error: any) {
    console.error('Error fetching canvas project:', error);
    res.status(500).json({
      error: 'Failed to fetch canvas project',
      message: error.message || 'An error occurred'
    });
  }
});

// Create new canvas project
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, nodes, edges, drawings } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Nodes array is required' });
    }

    if (!edges || !Array.isArray(edges)) {
      return res.status(400).json({ error: 'Edges array is required' });
    }

    // Clean expired base64 images and add timestamps to new ones
    let processedNodes = cleanExpiredBase64Images(nodes);
    processedNodes = addBase64Timestamps(processedNodes);

    // Process nodes for R2 upload (if configured)
    const canvasId = `temp-${Date.now()}`; // Temporary ID, will be replaced after creation
    processedNodes = await processCanvasNodesForR2(processedNodes, req.userId, canvasId);

    const project = await prisma.canvasProject.create({
      data: {
        userId: req.userId,
        name: name || 'Untitled',
        nodes: processedNodes as any,
        edges: edges as any,
        drawings: drawings !== undefined ? (drawings as any) : null,
      },
    });

    // Re-process with actual canvas ID for any remaining base64 images
    if (isR2Configured()) {
      const finalNodes = await processCanvasNodesForR2(processedNodes, req.userId, project.id);
      if (JSON.stringify(finalNodes) !== JSON.stringify(processedNodes)) {
        await prisma.canvasProject.update({
          where: { id: project.id },
          data: { nodes: finalNodes as any },
        });
        processedNodes = finalNodes;
      }
    }

    // Map Prisma's 'id' to '_id' for consistency with frontend
    res.json({
      project: {
        ...project,
        _id: project.id,
        nodes: processedNodes,
      }
    });
  } catch (error: any) {
    console.error('Error creating canvas project:', error);
    res.status(500).json({
      error: 'Failed to create canvas project',
      message: error.message || 'An error occurred'
    });
  }
});

// Update canvas project
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    // Check request size early to prevent 413 errors
    const contentLength = req.headers['content-length'];
    const VERCEL_LIMIT = 50 * 1024 * 1024; // 50MB Vercel Pro limit

    if (contentLength && parseInt(contentLength) > VERCEL_LIMIT) {
      const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(2);
      return res.status(413).json({
        error: 'Request Entity Too Large',
        message: `Projeto muito grande (${sizeMB}MB) para salvar. ` +
          `O tamanho máximo é 50MB (Vercel Pro). ` +
          `Configure o R2 nas configurações do sistema para salvar projetos grandes, ou reduza o número de imagens.`,
        sizeMB,
        maxSizeMB: '50',
        limitType: 'vercel',
        suggestion: 'O R2 permite armazenar imagens separadamente, reduzindo o tamanho do payload e permitindo projetos maiores.'
      });
    }

    const { id } = req.params;

    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const { name, nodes, edges, drawings } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate project ID format
    if (!id || id.trim() === '' || id === 'undefined') {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Verify that the project exists and belongs to the user (needed for R2 processing)
    const existingProject = await prisma.canvasProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Process nodes for R2 upload BEFORE payload size check
    // This uploads base64 images to R2 and removes them from payload, reducing size
    let processedNodes = nodes !== undefined ? nodes : existingProject.nodes;
    let r2ProcessingFailed = false;

    // Validate nodes if provided
    if (nodes !== undefined) {
      if (!Array.isArray(nodes)) {
        return res.status(400).json({
          error: 'Invalid nodes format',
          message: 'Nodes must be an array'
        });
      }
    }

    if (nodes !== undefined && Array.isArray(nodes)) {
      // Clean expired base64 images and add timestamps to new ones
      processedNodes = cleanExpiredBase64Images(nodes);
      processedNodes = addBase64Timestamps(processedNodes);

      // Process nodes to upload base64 images to R2 and replace with URLs
      try {
        if (isR2Configured()) {
          processedNodes = await processCanvasNodesForR2(processedNodes, req.userId, id);
        }
      } catch (processError: any) {
        console.error('Error processing nodes for R2 upload:', {
          error: processError.message || processError,
          stack: processError.stack,
          userId: req.userId,
          canvasId: id,
        });
        r2ProcessingFailed = true;
        // Continue with processed nodes (expired base64 already removed)
        // Will check payload size below with partially processed nodes
      }
    }

    // Validate payload size AFTER R2 processing (on processed nodes with base64 removed)
    // Vercel Pro has a 50MB serverless function limit, MongoDB has a 16MB document limit
    // VERCEL_LIMIT already declared above
    const MAX_PAYLOAD_SIZE = 15 * 1024 * 1024; // 15MB (MongoDB limit is 16MB)
    const processedPayload = {
      name: name !== undefined ? name : existingProject.name,
      nodes: processedNodes,
      edges: edges !== undefined ? edges : existingProject.edges,
    };
    const payloadSize = JSON.stringify(processedPayload).length;

    // Helper function to count base64 images
    const countBase64ImagesInNodes = (nodesToCount: any[]) => {
      let count = 0;
      if (Array.isArray(nodesToCount)) {
        nodesToCount.forEach((node: any) => {
          if (node.data?.mockup?.imageBase64) count++;
          if (node.data?.resultImageBase64) count++;
          if (node.data?.uploadedImage?.base64) count++;
          if (node.data?.referenceImage?.base64) count++;
          if (node.data?.referenceImages?.some((img: any) => img?.base64)) {
            count += node.data.referenceImages.filter((img: any) => img?.base64).length;
          }
          if (node.data?.logoBase64) count++;
          if (node.data?.identityPdfBase64) count++;
          if (node.data?.identityImageBase64) count++;
          if (node.data?.pdfBase64) count++;
        });
      }
      return count;
    };

    // Check Vercel limit first (more restrictive)
    if (payloadSize > VERCEL_LIMIT) {
      const base64ImageCount = countBase64ImagesInNodes(nodes || []);
      const r2Configured = isR2Configured();

      let suggestion = '';
      if (!r2Configured) {
        suggestion = 'O limite de 50MB é imposto pela plataforma Vercel Pro. ' +
          'Configure o armazenamento R2 nas configurações do sistema para salvar projetos grandes. ' +
          'O R2 permite armazenar imagens separadamente, reduzindo o tamanho do payload.';
      } else if (r2ProcessingFailed) {
        suggestion = 'O processamento de imagens para R2 falhou. Tente novamente em alguns instantes.';
      } else if (base64ImageCount > 0) {
        suggestion = `Ainda há ${base64ImageCount} imagem(ns) em base64 que precisam ser processadas para R2. ` +
          'Aguarde alguns instantes e tente novamente.';
      } else {
        suggestion = 'O projeto ainda está muito grande mesmo após otimização. ' +
          'Reduza o número de imagens ou elementos no canvas.';
      }

      return res.status(413).json({
        error: 'Request Entity Too Large',
        message: `Projeto muito grande (${(payloadSize / 1024 / 1024).toFixed(2)}MB). ` +
          `O tamanho máximo é 50MB (Vercel Pro). ${suggestion}`,
        payloadSizeMB: (payloadSize / 1024 / 1024).toFixed(2),
        maxSizeMB: (VERCEL_LIMIT / 1024 / 1024).toFixed(2),
        base64ImageCount,
        r2Configured,
        r2ProcessingFailed,
        limitType: 'vercel',
      });
    }

    // Check MongoDB limit (less restrictive, but still important)
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      const base64ImageCount = countBase64ImagesInNodes(nodes || []);
      const r2Configured = isR2Configured();

      let suggestion = '';
      if (base64ImageCount > 0) {
        suggestion = `Detectadas ${base64ImageCount} imagem(ns) base64 no payload. `;
      }
      if (!r2Configured) {
        suggestion += 'R2 não está configurado - configure o R2 para fazer upload automático das imagens e reduzir o tamanho do payload. ';
      } else if (r2ProcessingFailed) {
        suggestion += 'O upload automático para R2 falhou - verifique se o R2 está funcionando corretamente. ';
      } else {
        suggestion += 'Após processar as imagens, o payload ainda excede o limite. Reduza o número de imagens no canvas. ';
      }
      suggestion += 'Ou reduza o número de imagens no canvas.';

      return res.status(400).json({
        error: 'Payload too large',
        message: `Payload size (${(payloadSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${MAX_PAYLOAD_SIZE / 1024 / 1024}MB). ${suggestion}`,
        payloadSizeMB: (payloadSize / 1024 / 1024).toFixed(2),
        maxSizeMB: (MAX_PAYLOAD_SIZE / 1024 / 1024).toFixed(2),
        base64ImageCount,
        r2Configured,
        r2ProcessingFailed,
      });
    }

    // Check for reasonable array size (nodes already validated above)
    if (nodes !== undefined && Array.isArray(nodes) && nodes.length > 10000) {
      return res.status(400).json({
        error: 'Too many nodes',
        message: `Number of nodes (${nodes.length}) exceeds maximum allowed (10000)`
      });
    }

    // Validate edges array if provided
    if (edges !== undefined) {
      if (!Array.isArray(edges)) {
        return res.status(400).json({ error: 'Edges must be an array' });
      }
      // Check for reasonable array size
      if (edges.length > 10000) {
        return res.status(400).json({
          error: 'Too many edges',
          message: `Number of edges (${edges.length}) exceeds maximum allowed (10000)`
        });
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (nodes !== undefined) {
      // Nodes have already been processed for R2 upload above
      // Use the processed nodes (with base64 replaced by URLs where possible)
      updateData.nodes = processedNodes as any;
    }
    if (edges !== undefined) {
      updateData.edges = edges as any;
    }
    if (drawings !== undefined) {
      updateData.drawings = drawings as any;
    }

    const project = await prisma.canvasProject.update({
      where: { id },
      data: updateData,
    });

    // Map Prisma's 'id' to '_id' for consistency with frontend
    res.json({
      project: {
        ...project,
        _id: project.id,
      }
    });
  } catch (error: any) {
    const isConnectionError = error.code === 'P1001' ||
      error.message?.includes('connect') ||
      error.message?.includes('connection');

    let connectionStatus = null;
    if (isConnectionError) {
      connectionStatus = await verifyPrismaConnectionWithDetails();
    }

    // Detect common Prisma errors
    let errorType = 'Unknown';
    let userMessage = 'An error occurred';

    if (error.code) {
      if (error.code === 'P1001') {
        errorType = 'DatabaseConnection';
        userMessage = 'Database connection failed';
      } else if (error.code === 'P2025') {
        errorType = 'RecordNotFound';
        userMessage = 'Project not found';
      } else if (error.code === 'P2002') {
        errorType = 'UniqueConstraint';
        userMessage = 'A record with this value already exists';
      } else if (error.code.startsWith('P')) {
        errorType = 'PrismaError';
        userMessage = `Database error: ${error.code}`;
      }
    }

    console.error('Error updating canvas project:', {
      error: error.message || error,
      stack: error.stack,
      name: error.name,
      code: error.code,
      userId: req.userId,
      projectId: req.params.id,
      prismaError: error.meta || error.cause,
      connectionStatus,
      errorType,
      timestamp: new Date().toISOString(),
    });

    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment
      ? error.message || 'An error occurred'
      : userMessage;

    // Return appropriate status code based on error type
    let statusCode = 500;
    if (error.code === 'P2025') {
      statusCode = 404;
    } else if (error.code === 'P2002') {
      statusCode = 409;
    } else if (error.code === 'P1001') {
      statusCode = 503;
    }

    res.status(statusCode).json({
      error: 'Failed to update canvas project',
      message: errorMessage,
      ...(isDevelopment && {
        details: {
          name: error.name,
          code: error.code,
          meta: error.meta,
          errorType,
          connectionIssue: isConnectionError ? connectionStatus : undefined,
        }
      })
    });
  }
});

// Get presigned URL for direct upload to R2 (supports up to 10MB)
router.get('/image/upload-url', authenticate, async (req: AuthRequest, res) => {
  try {
    const { canvasId, nodeId, contentType } = req.query;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!isR2Configured()) {
      return res.status(503).json({ error: 'R2 storage is not configured' });
    }

    const finalCanvasId = (canvasId as string) || `temp-${Date.now()}`;
    const finalNodeId = nodeId as string | undefined;
    const finalContentType = (contentType as string) || 'image/png';

    try {
      const { presignedUrl, finalUrl } = await generateCanvasImageUploadUrl(
        req.userId,
        finalCanvasId,
        finalNodeId,
        finalContentType
      );

      res.json({ presignedUrl, finalUrl });
    } catch (error: any) {
      console.error('Error generating presigned URL:', error);
      res.status(500).json({
        error: 'Failed to generate upload URL',
        message: error.message || 'An error occurred'
      });
    }
  } catch (error: any) {
    console.error('Error in canvas image upload URL endpoint:', error);
    res.status(500).json({
      error: 'Failed to process request',
      message: error.message || 'An error occurred'
    });
  }
});

// Get presigned URL for direct video upload to R2 (for large videos)
router.get('/video/upload-url', authenticate, async (req: AuthRequest, res) => {
  try {
    const { canvasId, nodeId, contentType } = req.query;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!isR2Configured()) {
      return res.status(503).json({ error: 'R2 storage is not configured' });
    }

    const finalCanvasId = (canvasId as string) || `temp-${Date.now()}`;
    const finalNodeId = nodeId as string | undefined;
    const finalContentType = (contentType as string) || 'video/mp4';

    try {
      const { presignedUrl, finalUrl } = await generateCanvasVideoUploadUrl(
        req.userId,
        finalCanvasId,
        finalNodeId,
        finalContentType
      );

      res.json({ presignedUrl, finalUrl });
    } catch (error: any) {
      console.error('Error generating presigned URL for video:', error);
      res.status(500).json({
        error: 'Failed to generate upload URL',
        message: error.message || 'An error occurred'
      });
    }
  } catch (error: any) {
    console.error('Error in canvas video upload URL endpoint:', error);
    res.status(500).json({
      error: 'Failed to process request',
      message: error.message || 'An error occurred'
    });
  }
});

// Upload canvas image to R2 (legacy endpoint - still used for smaller images)
router.post('/image/upload', authenticate, async (req: AuthRequest, res) => {
  try {
    // Check request size early to prevent 413 errors
    const contentLength = req.headers['content-length'];
    const VERCEL_LIMIT = 50 * 1024 * 1024; // 50MB Vercel Pro limit

    if (contentLength && parseInt(contentLength) > VERCEL_LIMIT) {
      const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(2);
      return res.status(413).json({
        error: 'Request Entity Too Large',
        message: `Imagem muito grande (${sizeMB}MB). O tamanho máximo é 50MB. Por favor, use uma imagem menor.`,
        sizeMB,
        maxSizeMB: '50'
      });
    }

    const { base64Image, canvasId, nodeId } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!base64Image || typeof base64Image !== 'string') {
      return res.status(400).json({ error: 'base64Image is required' });
    }

    // Check base64 image size
    const base64Data = base64Image.includes(',')
      ? base64Image.split(',')[1]
      : base64Image;
    const imageSizeBytes = base64Data ? (base64Data.length * 3) / 4 : 0;

    if (imageSizeBytes > VERCEL_LIMIT) {
      const sizeMB = (imageSizeBytes / 1024 / 1024).toFixed(2);
      return res.status(413).json({
        error: 'Request Entity Too Large',
        message: `Imagem muito grande (${sizeMB}MB). O tamanho máximo é 50MB. ` +
          `Nota: Configure o R2 para preservar qualidade máxima em imagens grandes. ` +
          `Com R2 configurado, imagens são armazenadas com qualidade preservada (95%+).`,
        sizeMB,
        maxSizeMB: '50'
      });
    }

    if (!isR2Configured()) {
      return res.status(503).json({ error: 'R2 storage is not configured' });
    }

    // Use provided canvasId or generate a temporary one
    const finalCanvasId = canvasId || `temp-${Date.now()}`;

    try {
      // Upload to R2 - NO compression on server side
      // The image is stored as-is to preserve maximum quality for designers
      // Compression (if needed) is done on client side with high quality settings (0.95)
      const imageUrl = await uploadCanvasImage(base64Image, req.userId, finalCanvasId, nodeId);
      res.json({ imageUrl });
    } catch (uploadError: any) {
      console.error('Error uploading canvas image to R2:', uploadError);

      // Handle 413 errors from R2 or other services
      if (uploadError.message?.includes('too large') || uploadError.message?.includes('413')) {
        return res.status(413).json({
          error: 'Request Entity Too Large',
          message: 'Imagem muito grande para upload. O tamanho máximo é 50MB. Por favor, use uma imagem menor.',
        });
      }

      res.status(500).json({
        error: 'Failed to upload image to R2',
        message: uploadError.message || 'An error occurred'
      });
    }
  } catch (error: any) {
    console.error('Error in canvas image upload endpoint:', error);

    // Handle 413 errors
    if (error.status === 413 || error.message?.includes('413') || error.message?.includes('too large')) {
      return res.status(413).json({
        error: 'Request Entity Too Large',
        message: 'Imagem muito grande para upload. O tamanho máximo é 50MB. Por favor, use uma imagem menor.',
      });
    }

    res.status(500).json({
      error: 'Failed to process image upload',
      message: error.message || 'An error occurred'
    });
  }
});

// Upload canvas PDF to R2
router.post('/pdf/upload', authenticate, async (req: AuthRequest, res) => {
  try {
    const { pdfBase64, canvasId, nodeId } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({ error: 'pdfBase64 is required' });
    }

    if (!isR2Configured()) {
      return res.status(503).json({ error: 'R2 storage is not configured' });
    }

    // Use provided canvasId or generate a temporary one
    const finalCanvasId = canvasId || `temp-${Date.now()}`;

    try {
      // Compress PDF before upload
      const compressedPdf = await compressPdfSimple(pdfBase64);
      const pdfUrl = await uploadCanvasPdf(compressedPdf, req.userId, finalCanvasId, nodeId);
      res.json({ pdfUrl });
    } catch (uploadError: any) {
      console.error('Error uploading canvas PDF to R2:', uploadError);
      res.status(500).json({
        error: 'Failed to upload PDF to R2',
        message: uploadError.message || 'An error occurred'
      });
    }
  } catch (error: any) {
    console.error('Error in canvas PDF upload endpoint:', error);
    res.status(500).json({
      error: 'Failed to process PDF upload',
      message: error.message || 'An error occurred'
    });
  }
});

// Upload canvas video to R2
router.post('/video/upload', authenticate, async (req: AuthRequest, res) => {
  try {
    // Check request size early to prevent 413 errors
    const contentLength = req.headers['content-length'];
    const VERCEL_LIMIT = 50 * 1024 * 1024; // 50MB Vercel Pro limit

    if (contentLength && parseInt(contentLength) > VERCEL_LIMIT) {
      const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(2);
      return res.status(413).json({
        error: 'Request Entity Too Large',
        message: `Vídeo muito grande (${sizeMB}MB). O tamanho máximo é 50MB (Vercel Pro). ` +
          `Nota: Configure o R2 para preservar qualidade máxima em vídeos grandes. ` +
          `Com R2 configurado, vídeos são armazenados sem compressão, mantendo qualidade original.`,
        sizeMB,
        maxSizeMB: '50',
        limitType: 'vercel'
      });
    }

    const { videoBase64, canvasId, nodeId } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!videoBase64 || typeof videoBase64 !== 'string') {
      return res.status(400).json({ error: 'videoBase64 is required' });
    }

    // Check base64 video size
    const base64Data = videoBase64.includes(',')
      ? videoBase64.split(',')[1]
      : videoBase64;
    const videoSizeBytes = base64Data ? (base64Data.length * 3) / 4 : 0;

    if (videoSizeBytes > VERCEL_LIMIT) {
      const sizeMB = (videoSizeBytes / 1024 / 1024).toFixed(2);
      return res.status(413).json({
        error: 'Request Entity Too Large',
        message: `Vídeo muito grande (${sizeMB}MB). O tamanho máximo é 50MB (Vercel Pro). ` +
          `Nota: Configure o R2 para preservar qualidade máxima em vídeos grandes. ` +
          `Com R2 configurado, vídeos são armazenados sem compressão, mantendo qualidade original.`,
        sizeMB,
        maxSizeMB: '50',
        limitType: 'vercel'
      });
    }

    if (!isR2Configured()) {
      return res.status(503).json({ error: 'R2 storage is not configured' });
    }

    // Use provided canvasId or generate a temporary one
    const finalCanvasId = canvasId || `temp-${Date.now()}`;

    try {
      // Upload to R2 - NO compression on server side
      // The video is stored as-is to preserve maximum quality for designers
      // Videos are uploaded directly to R2 without any quality loss
      const videoUrl = await uploadCanvasVideo(videoBase64, req.userId, finalCanvasId, nodeId);
      res.json({ videoUrl });
    } catch (uploadError: any) {
      console.error('Error uploading canvas video to R2:', uploadError);

      // Handle 413 errors from R2 or other services
      if (uploadError.message?.includes('too large') || uploadError.message?.includes('413')) {
        return res.status(413).json({
          error: 'Request Entity Too Large',
          message: 'Vídeo muito grande para upload. Por favor, use um vídeo menor ou comprima o vídeo antes de fazer upload.',
        });
      }

      res.status(500).json({
        error: 'Failed to upload video to R2',
        message: uploadError.message || 'An error occurred'
      });
    }
  } catch (error: any) {
    console.error('Error in canvas video upload endpoint:', error);

    // Handle 413 errors
    if (error.status === 413 || error.message?.includes('413') || error.message?.includes('too large')) {
      return res.status(413).json({
        error: 'Request Entity Too Large',
        message: 'Vídeo muito grande para upload. Por favor, use um vídeo menor ou comprima o vídeo antes de fazer upload.',
      });
    }

    res.status(500).json({
      error: 'Failed to process video upload',
      message: error.message || 'An error occurred'
    });
  }
});

// Delete image from R2
router.delete('/image', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const imageUrl = req.query.url as string;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Only delete if URL is from R2 (not a data URL)
    if (imageUrl.startsWith('data:')) {
      return res.json({ success: true, message: 'Data URL - no R2 deletion needed' });
    }

    try {
      const r2Service = await import('@/services/r2Service.js');
      if (r2Service.isR2Configured()) {
        await r2Service.deleteImage(imageUrl);
        res.json({ success: true, message: 'Image deleted from R2' });
      } else {
        res.json({ success: true, message: 'R2 not configured - skipping deletion' });
      }
    } catch (deleteError: any) {
      console.error('Failed to delete image from R2:', deleteError);
      // Don't fail the request if R2 deletion fails
      res.json({ success: true, message: 'Image deletion attempted', warning: deleteError.message });
    }
  } catch (error: any) {
    console.error('Error deleting image from R2:', error);
    res.status(500).json({
      error: 'Failed to delete image from R2',
      message: error.message || 'An error occurred'
    });
  }
});

// Delete canvas project
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const project = await prisma.canvasProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.canvasProject.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting canvas project:', error);
    res.status(500).json({
      error: 'Failed to delete canvas project',
      message: error.message || 'An error occurred'
    });
  }
});

// Liveblocks authentication endpoint
router.post('/:id/liveblocks-auth', authenticate, validateAdminOrPremium, requireViewAccess, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const project = await prisma.canvasProject.findUnique({
      where: { id },
      select: {
        userId: true,
        isCollaborative: true,
        canEdit: true,
        canView: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.isCollaborative) {
      return res.status(400).json({ error: 'Project is not in collaborative mode' });
    }

    // Check if user has edit or view permission
    const isOwner = project.userId === req.userId;
    const canEdit = isOwner || (Array.isArray(project.canEdit) && project.canEdit.includes(req.userId));
    const canView = isOwner || canEdit || (Array.isArray(project.canView) && project.canView.includes(req.userId));

    if (!canView) {
      return res.status(403).json({ error: 'You do not have permission to access this project' });
    }

    // Get user info for Liveblocks (use Prisma as primary source)
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true, name: true, picture: true },
    });

    // Fallback to MongoDB if Prisma user not found (shouldn't happen, but safe fallback)
    let userInfo = {
      name: user?.name || user?.email || 'Anonymous',
      email: user?.email || undefined,
      picture: user?.picture || undefined,
    };

    if (!user) {
      try {
        const { connectToMongoDB, getDb } = await import('../db/mongodb.js');
        const { ObjectId } = await import('mongodb');
        await connectToMongoDB();
        const db = getDb();
        const userDoc = await db.collection('users').findOne(
          { _id: new ObjectId(req.userId) },
          { projection: { email: 1, name: 1, picture: 1 } }
        );
        if (userDoc) {
          userInfo = {
            name: userDoc.name || userDoc.email || 'Anonymous',
            email: userDoc.email,
            picture: userDoc.picture,
          };
        }
      } catch (mongoError) {
        console.warn('Could not fetch user from MongoDB, using defaults:', mongoError);
      }
    }

    const LIVEBLOCKS_SECRET_KEY = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!LIVEBLOCKS_SECRET_KEY) {
      console.error('[Liveblocks Auth] LIVEBLOCKS_SECRET_KEY not configured');
      return res.status(500).json({ error: 'Liveblocks is not configured' });
    }

    const roomId = `canvas-${id}`;
    const liveblocks = new Liveblocks({
      secret: LIVEBLOCKS_SECRET_KEY,
    });

    const session = liveblocks.prepareSession(req.userId, {
      userInfo: userInfo,
    });

    // Grant appropriate access based on permissions
    // Users with edit access get FULL_ACCESS, view-only users get READ_ACCESS
    session.allow(roomId, canEdit ? session.FULL_ACCESS : session.READ_ACCESS);
    const { body, status } = await session.authorize();

    res.status(status).end(body);
  } catch (error: any) {
    console.error('[Liveblocks Auth] Error:', error);
    console.error('[Liveblocks Auth] Error stack:', error?.stack);
    res.status(500).json({
      error: 'Failed to authenticate with Liveblocks',
      message: error.message || 'An error occurred'
    });
  }
});

// Share project (generate shareId and enable collaboration)
router.post('/:id/share', authenticate, validateAdminOrPremium, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { canEdit = [], canView = [] } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const project = await prisma.canvasProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Convert emails to user IDs
    const canEditUserIds = await convertEmailsToUserIds(Array.isArray(canEdit) ? canEdit : []);
    const canViewUserIds = await convertEmailsToUserIds(Array.isArray(canView) ? canView : []);

    // Generate new shareId if doesn't exist
    let shareId = project.shareId;
    if (!shareId) {
      shareId = generateShareId();
    }

    // Update project with share settings
    const updatedProject = await prisma.canvasProject.update({
      where: { id },
      data: {
        shareId,
        isCollaborative: true,
        canEdit: canEditUserIds,
        canView: canViewUserIds,
      },
    });

    res.json({
      shareId,
      shareUrl: `/canvas/shared/${shareId}`,
      canEdit: updatedProject.canEdit,
      canView: updatedProject.canView,
    });
  } catch (error: any) {
    console.error('Error sharing project:', error);
    res.status(500).json({
      error: 'Failed to share project',
      message: error.message || 'An error occurred'
    });
  }
});

// Update share settings (permissions)
router.put('/:id/share-settings', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { canEdit, canView } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const project = await prisma.canvasProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.isCollaborative) {
      return res.status(400).json({ error: 'Project is not in collaborative mode' });
    }

    const updateData: any = {};
    if (canEdit !== undefined) {
      // Convert emails to user IDs
      const canEditUserIds = await convertEmailsToUserIds(Array.isArray(canEdit) ? canEdit : []);
      updateData.canEdit = canEditUserIds;
    }
    if (canView !== undefined) {
      // Convert emails to user IDs
      const canViewUserIds = await convertEmailsToUserIds(Array.isArray(canView) ? canView : []);
      updateData.canView = canViewUserIds;
    }

    const updatedProject = await prisma.canvasProject.update({
      where: { id },
      data: updateData,
    });

    res.json({
      canEdit: updatedProject.canEdit,
      canView: updatedProject.canView,
    });
  } catch (error: any) {
    console.error('Error updating share settings:', error);
    res.status(500).json({
      error: 'Failed to update share settings',
      message: error.message || 'An error occurred'
    });
  }
});

// Remove sharing (disable collaboration)
router.delete('/:id/share', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const project = await prisma.canvasProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.canvasProject.update({
      where: { id },
      data: {
        shareId: null,
        isCollaborative: false,
        canEdit: [],
        canView: [],
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing share:', error);
    res.status(500).json({
      error: 'Failed to remove sharing',
      message: error.message || 'An error occurred'
    });
  }
});

export default router;




