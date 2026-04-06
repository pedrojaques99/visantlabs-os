/**
 * ReactFlow Node Layout Constants
 * 
 * Centralized source of truth for all sizing, spacing, and dimensional logic.
 * Ensures professional UI/UX consistency across all canvas nodes.
 */

export const NODE_LAYOUT = {
    // Basic Dimensions
    MIN_WIDTH: 280,
    MIN_HEIGHT: 150,
    MAX_WIDTH: 2000,
    MAX_HEIGHT: 2000,
    
    // Default initial sizes for new nodes
    DEFAULT_WIDTH: 320,
    PROMPT_NODE_WIDTH: 400,
    IMAGE_NODE_WIDTH: 300,
    STRATEGY_NODE_WIDTH: 500,
    STRATEGY_NODE_MIN_HEIGHT: 600,
    
    // Special Sizing
    MAX_FIT_WIDTH: 1200,
    
    // Spacing (matching index.css)
    PADDING: '2rem', // var(--node-padding)
    GAP: '1rem',    // var(--node-gap)
    
    // Handle Layout
    HANDLE_START_TOP: 60,
    HANDLE_SPACING: 60,
} as const;

export const NODE_TYPES = {
    // Nodes that perform generative AI work
    GENERATIVE: [
        'prompt', 
        'image', 
        'video', 
        'upscale', 
        'merge', 
        'edit', 
        'mockup', 
        'shader',
        'color-extractor'
    ],
    
    // Nodes that predominantly display media
    MEDIA_DISPLAY: [
        'image',
        'video',
        'mockup',
        'upscale',
    ],
    
    // Nodes that are mostly text-based
    TEXT_BASED: [
        'text',
        'chat',
        'strategy',
    ]
} as const;

/**
 * Resizer handle styles for professional look
 */
export const RESIZER_STYLE = {
    color: 'var(--brand-cyan)',
    handleSize: 8,
} as const;
