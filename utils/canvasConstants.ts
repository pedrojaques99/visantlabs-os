/**
 * Canvas Flow Constants
 * Shared constants for the Canvas Flow component and related functionality
 */

/**
 * Valid node types that can be dropped onto the canvas from the toolbar
 */
export const DROPPABLE_NODE_TYPES = [
    'prompt',
    'mockup',
    'shader',
    'edit',
    'angle',
    'brandkit',
    'logo',
    'pdf',
    'strategy',
    'brandcore',
    'text',
    'chat',
] as const;

export type DroppableNodeType = typeof DROPPABLE_NODE_TYPES[number];

/**
 * Maximum file size for image uploads (10MB)
 */
export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Maximum file size for image uploads in human-readable format
 */
export const MAX_IMAGE_FILE_SIZE_MB = 10;

/**
 * File size formatting helper
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Check if a node type is valid for dropping
 */
export const isValidDroppableNodeType = (nodeType: string): nodeType is DroppableNodeType => {
    return DROPPABLE_NODE_TYPES.includes(nodeType as DroppableNodeType);
};
