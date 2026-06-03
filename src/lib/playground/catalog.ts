import { schema } from '@json-render/react';
import { z } from 'zod';

const shaderTypeEnum = z.enum([
  'halftone',
  'vhs',
  'ascii',
  'matrixDither',
  'dither',
  'duotone',
  'filmGrain',
  'pixelate',
  'posterize',
  'chromaticAberration',
  'crtScanlines',
  'edgeDetect',
  'glitch',
]);

const materialPresetEnum = z.enum([
  'default',
  'plastic',
  'metal',
  'glass',
  'rubber',
  'chrome',
  'gold',
  'clay',
  'emissive',
  'holographic',
  'brushedSteel',
  'copper',
  'marble',
  'wood',
  'concrete',
  'fabric',
  'leather',
  'paper',
  'ceramic',
  'ice',
  'crystal',
  'neon',
  'frostedGlass',
  'carbonFiber',
  'titanium',
  'bronze',
  'obsidian',
  'jade',
  'pearl',
  'velvet',
  'resin',
  'wax',
]);

export const visantCatalog = schema.createCatalog({
  components: {
    // ─── Layout & Shells ────────────────────────────────
    PageShell: {
      props: z.object({
        title: z.string().optional(),
        className: z.string().optional(),
      }),
      slots: ['default'],
      description: 'Page wrapper with padding and optional title. Use for dashboard-style apps.',
    },
    GlassPanel: {
      props: z.object({
        className: z.string().optional(),
        style: z.record(z.string(), z.any()).optional(),
      }),
      slots: ['default'],
      description:
        'Glassmorphism container with backdrop blur and subtle border. Use to group content. Use style with $state for dynamic backgroundColor.',
    },

    // ─── Tool Panel Family ──────────────────────────────
    ToolPanel: {
      props: z.object({}),
      slots: ['default'],
      description:
        'Right-side glass panel container. Use ToolPanelHeader, ToolPanelContent, ToolPanelActions as children.',
    },
    ToolPanelHeader: {
      props: z.object({}),
      slots: ['default'],
      description: 'Header section of ToolPanel with bottom border.',
    },
    ToolPanelContent: {
      props: z.object({}),
      slots: ['default'],
      description: 'Scrollable content area of ToolPanel.',
    },
    ToolPanelSection: {
      props: z.object({
        title: z.string(),
      }),
      slots: ['default'],
      description: 'Titled section inside ToolPanelContent. Title renders as 10px mono uppercase.',
    },
    ToolPanelDisclosure: {
      props: z.object({
        label: z.string(),
        defaultOpen: z.boolean().optional(),
      }),
      slots: ['default'],
      description: 'Collapsible section with chevron toggle. Use for optional/advanced settings.',
    },
    ToolPanelGrid: {
      props: z.object({
        cols: z.number().min(2).max(5).optional(),
      }),
      slots: ['default'],
      description: 'Grid layout for chip buttons. Default 3 columns.',
    },
    ToolPanelChip: {
      props: z.object({
        active: z.boolean().optional(),
        label: z.string(),
      }),
      slots: [],
      description: 'Compact pill toggle button. Use inside ToolPanelGrid.',
    },
    ToolPanelRow: {
      props: z.object({
        label: z.string(),
      }),
      slots: ['default'],
      description: 'Label + value row for displaying settings or metadata.',
    },

    // ─── Inputs & Controls ──────────────────────────────
    NodeSlider: {
      props: z.object({
        label: z.string(),
        value: z.number(),
        min: z.number(),
        max: z.number(),
        step: z.number().optional(),
        hint: z.string().optional(),
      }),
      slots: [],
      description: 'Horizontal slider with scrub label. Primary numeric input for tools.',
    },
    ScrubInput: {
      props: z.object({
        label: z.string(),
        value: z.number(),
        min: z.number(),
        max: z.number(),
        suffix: z.string().optional(),
      }),
      slots: [],
      description: 'Compact numeric input with scrub drag.',
    },
    InlineColorPicker: {
      props: z.object({
        label: z.string(),
        value: z.string(),
      }),
      slots: [],
      description: 'Color input with hex display.',
    },
    Button: {
      props: z.object({
        variant: z
          .enum(['default', 'brand', 'surface', 'subtle', 'danger', 'outline', 'ghost'])
          .optional(),
        size: z.enum(['default', 'sm', 'xs', 'lg', 'icon']).optional(),
        disabled: z.boolean().optional(),
      }),
      slots: ['default'],
      description: "Button. 'brand' = cyan accent, 'surface' = neutral, 'subtle' = minimal.",
    },
    Switch: {
      props: z.object({
        checked: z.boolean().optional(),
        label: z.string().optional(),
      }),
      slots: [],
      description: 'Toggle switch for on/off settings.',
    },
    Input: {
      props: z.object({
        placeholder: z.string().optional(),
        type: z.enum(['text', 'number', 'email', 'url']).optional(),
        value: z.string().optional(),
      }),
      slots: [],
      description: 'Text input field. Use $bindState on value for two-way binding.',
    },
    Textarea: {
      props: z.object({
        placeholder: z.string().optional(),
        rows: z.number().optional(),
        value: z.string().optional(),
      }),
      slots: [],
      description: 'Multi-line text input. Use $bindState on value for two-way binding.',
    },

    // ─── Image & Upload ─────────────────────────────────
    ImageUploader: {
      props: z.object({}),
      slots: [],
      description:
        'Full-area drag-drop image uploader. Use as main area when app needs image input.',
    },
    ImageThumbnail: {
      props: z.object({
        src: z.string(),
        index: z.number().optional(),
      }),
      slots: [],
      description: 'Single image thumbnail with numbered badge.',
    },

    // ─── Data Display ───────────────────────────────────
    Card: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
      }),
      slots: ['default'],
      description: 'Semantic card container with optional header.',
    },
    Badge: {
      props: z.object({
        variant: z.enum(['default', 'secondary', 'destructive', 'outline']).optional(),
        label: z.string(),
      }),
      slots: [],
      description: 'Small status label or tag.',
    },
    Tabs: {
      props: z.object({
        tabs: z.array(z.object({ value: z.string(), label: z.string() })),
        defaultValue: z.string().optional(),
      }),
      slots: ['default'],
      description: 'Tab navigation for multi-section apps.',
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        change: z.string().optional(),
        trend: z.enum(['up', 'down', 'neutral']).optional(),
      }),
      slots: [],
      description: 'Single KPI metric card with optional trend indicator.',
    },

    // ─── Charts ─────────────────────────────────────────
    BarChart: {
      props: z.object({
        data: z.array(z.record(z.string(), z.any())),
        dataKey: z.string(),
        xAxisKey: z.string(),
        color: z.string().optional(),
        height: z.number().optional(),
      }),
      slots: [],
      description: 'Vertical bar chart. Color defaults to brand-cyan.',
    },
    LineChart: {
      props: z.object({
        data: z.array(z.record(z.string(), z.any())),
        dataKey: z.string(),
        xAxisKey: z.string(),
        color: z.string().optional(),
        height: z.number().optional(),
      }),
      slots: [],
      description: 'Line chart with smooth curve.',
    },
    PieChart: {
      props: z.object({
        data: z.array(z.object({ name: z.string(), value: z.number() })),
        height: z.number().optional(),
      }),
      slots: [],
      description: 'Pie/donut chart.',
    },

    // ─── Feedback & State ───────────────────────────────
    GlitchLoader: {
      props: z.object({
        size: z.enum(['sm', 'md', 'lg']).optional(),
      }),
      slots: [],
      description: 'Animated glitch loading indicator. Signature Visant loader.',
    },
    SkeletonLoader: {
      props: z.object({
        variant: z.enum(['text', 'circular', 'rectangular']).optional(),
        width: z.string().optional(),
        height: z.string().optional(),
      }),
      slots: [],
      description: 'Shimmer placeholder skeleton.',
    },
    EmptyState: {
      props: z.object({
        title: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
      }),
      slots: [],
      description: 'Centered empty state with icon, title, description.',
    },

    // ─── Layout Primitives ──────────────────────────────
    Stack: {
      props: z.object({
        direction: z.enum(['horizontal', 'vertical']).optional(),
        gap: z.number().optional(),
        align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
      }),
      slots: ['default'],
      description: 'Flex stack layout. Default vertical with gap-4.',
    },
    Grid: {
      props: z.object({
        cols: z.number().min(1).max(6).optional(),
        gap: z.number().optional(),
      }),
      slots: ['default'],
      description: 'CSS grid layout. Default 2 columns.',
    },
    Separator: {
      props: z.object({
        orientation: z.enum(['horizontal', 'vertical']).optional(),
      }),
      slots: [],
      description: 'Visual divider line.',
    },

    // ─── Power Components ───────────────────────────────
    ShaderPreview: {
      props: z.object({
        imageUrl: z.string(),
        shaderType: shaderTypeEnum,
        params: z.record(z.string(), z.any()).optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
      slots: [],
      description:
        'WebGL shader effect preview. Applies shader (halftone, vhs, ascii, dither, glitch, etc.) to an image in real-time. Use $bindState on shaderType and params for dynamic control.',
    },
    Scene3D: {
      props: z.object({
        mode: z.enum(['text', 'shape']).optional(),
        input: z.string().optional(),
        shape: z.enum(['coin', 'badge', 'stamp', 'shield', 'hexagon', 'pendant']).optional(),
        material: materialPresetEnum.optional(),
        color: z.string().optional(),
        animation: z.enum(['none', 'spin', 'float', 'pulse', 'wobble']).optional(),
        depth: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
      slots: [],
      description:
        'Interactive 3D scene with material presets. mode="text" extrudes text, mode="shape" uses preset shapes. 43 material presets available. Use $bindState on material/color/animation for dynamic control.',
    },
    VideoPlayer: {
      props: z.object({
        src: z.string().optional(),
        autoPlay: z.boolean().optional(),
        loop: z.boolean().optional(),
        controls: z.boolean().optional(),
        muted: z.boolean().optional(),
        poster: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
      slots: [],
      description:
        'Video player with native controls. Use with generateVideo action to display generated videos. Supports MP4, WebM.',
    },
    ImageCanvas: {
      props: z.object({
        width: z.number().optional(),
        height: z.number().optional(),
        layers: z
          .array(
            z.object({
              type: z.enum(['image', 'text', 'rect', 'circle']),
              x: z.number().optional(),
              y: z.number().optional(),
              width: z.number().optional(),
              height: z.number().optional(),
              src: z.string().optional(),
              text: z.string().optional(),
              fontSize: z.number().optional(),
              fontFamily: z.string().optional(),
              fill: z.string().optional(),
              stroke: z.string().optional(),
              strokeWidth: z.number().optional(),
              rotation: z.number().optional(),
              opacity: z.number().optional(),
              radius: z.number().optional(),
            })
          )
          .optional(),
      }),
      slots: [],
      description:
        'Konva 2D canvas for compositing. Define layers as array of image/text/rect/circle objects. Use $bindState on layers for dynamic updates.',
    },
    HalftonePreview: {
      props: z.object({
        imageUrl: z.string(),
        variant: z.enum(['ellipse', 'square', 'lines']).optional(),
        dotSize: z.number().optional(),
        angle: z.number().optional(),
        contrast: z.number().optional(),
        spacing: z.number().optional(),
        threshold: z.number().optional(),
        invert: z.boolean().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
      slots: [],
      description:
        'Dedicated halftone effect renderer with variant support (ellipse/square/lines). More control than ShaderPreview halftone. Use $bindState on dotSize/angle/contrast for live control.',
    },
    RisoPreview: {
      props: z.object({
        imageUrl: z.string(),
        color1: z.string().optional(),
        color2: z.string().optional(),
        halftoneAngle1: z.number().optional(),
        halftoneAngle2: z.number().optional(),
        dotSize: z.number().optional(),
        paperColor: z.string().optional(),
        blendMode: z.enum(['multiply', 'screen', 'overlay']).optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
      slots: [],
      description:
        'Riso printing simulator. 2-color separation with halftone screening. Use $bindState on colors and angles for live preview.',
    },
    MoodboardGrid: {
      props: z.object({
        images: z.array(
          z.object({
            src: z.string(),
            alt: z.string().optional(),
            span: z.number().optional(),
          })
        ),
        layout: z.enum(['bento', 'masonry', 'grid']).optional(),
        columns: z.number().optional(),
        gap: z.number().optional(),
        aspectRatio: z.string().optional(),
      }),
      slots: [],
      description:
        'Image collection layout with bento/masonry/grid modes. Use for moodboards, galleries, or image grids.',
    },

    // ─── Text ───────────────────────────────────────────
    Heading: {
      props: z.object({
        level: z.number().min(1).max(6).optional(),
        text: z.string(),
        style: z.record(z.string(), z.any()).optional(),
      }),
      slots: [],
      description:
        'Heading text. Uses Manrope font, semibold. Use style prop with $bindState for dynamic fontSize/fontFamily/fontWeight.',
    },
    Text: {
      props: z.object({
        variant: z.enum(['body', 'label', 'caption', 'mono']).optional(),
        color: z.enum(['default', 'muted', 'brand', 'danger']).optional(),
        text: z.string(),
        style: z.record(z.string(), z.any()).optional(),
      }),
      slots: [],
      description:
        "Text element. 'label' = 10px mono uppercase. 'caption' = 11px muted. Use style prop with $bindState for dynamic fontSize/fontWeight/lineHeight.",
    },
    MicroTitle: {
      props: z.object({
        text: z.string(),
      }),
      slots: [],
      description: 'Small uppercase section title. Visant signature style.',
    },
  },

  actions: {
    generateMockup: {
      description: 'Generate a product mockup using AI',
      params: z.object({
        prompt: z.string(),
        brandGuidelineId: z.string().optional(),
        referenceImages: z.array(z.string()).optional(),
      }),
    },
    generateImage: {
      description: 'Generate an image from a text prompt',
      params: z.object({
        prompt: z.string(),
        aspectRatio: z.string().optional(),
      }),
    },
    extractColors: {
      description: 'Extract color palette from an image',
      params: z.object({
        imageUrl: z.string(),
      }),
    },
    generateNaming: {
      description: 'Generate brand naming suggestions',
      params: z.object({
        context: z.string(),
        style: z.string().optional(),
        count: z.number().optional(),
      }),
    },
    describeImage: {
      description: 'Get AI description of an image',
      params: z.object({
        imageUrl: z.string(),
      }),
    },
    complianceCheck: {
      description: 'Check brand guideline compliance of an image',
      params: z.object({
        brandGuidelineId: z.string(),
        imageUrl: z.string(),
      }),
    },
    uploadImage: {
      description: 'Upload an image (base64) and get its URL',
      params: z.object({
        base64: z.string(),
      }),
    },
    getBrand: {
      description: 'Fetch brand guideline data (colors, logos, fonts)',
      params: z.object({
        brandGuidelineId: z.string(),
      }),
    },
    copyToClipboard: {
      description: 'Copy text to clipboard',
      params: z.object({
        text: z.string(),
      }),
    },
    downloadFile: {
      description: 'Download a file from URL',
      params: z.object({
        url: z.string(),
        filename: z.string().optional(),
      }),
    },
    generateVideo: {
      description: 'Generate a video from text prompt or image. Returns { videoUrl }',
      params: z.object({
        prompt: z.string(),
        startFrame: z.string().optional(),
        aspectRatio: z.string().optional(),
        duration: z.string().optional(),
        model: z.string().optional(),
      }),
    },
    applyShader: {
      description: 'Apply a WebGL shader effect to an image client-side. Returns { resultBase64 }',
      params: z.object({
        imageUrl: z.string(),
        shaderType: shaderTypeEnum,
        params: z.record(z.string(), z.any()).optional(),
      }),
    },
    detectGrid: {
      description: 'Detect grid layout in an image. Returns { boxes: BoundingBox[] }',
      params: z.object({
        imageBase64: z.string(),
      }),
    },
    upscaleImage: {
      description: 'Upscale an image to higher resolution. Returns { upscaledBase64 }',
      params: z.object({
        imageBase64: z.string(),
        size: z.enum(['1K', '2K', '4K']).optional(),
      }),
    },
  },
});

export type VisantCatalog = typeof visantCatalog;
