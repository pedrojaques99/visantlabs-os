import { schema } from '@json-render/react';
import { z } from 'zod';

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
      }),
      slots: ['default'],
      description:
        'Glassmorphism container with backdrop blur and subtle border. Use to group content.',
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
      }),
      slots: [],
      description: 'Text input field.',
    },
    Textarea: {
      props: z.object({
        placeholder: z.string().optional(),
        rows: z.number().optional(),
      }),
      slots: [],
      description: 'Multi-line text input.',
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

    // ─── Text ───────────────────────────────────────────
    Heading: {
      props: z.object({
        level: z.number().min(1).max(6).optional(),
        text: z.string(),
      }),
      slots: [],
      description: 'Heading text. Uses Manrope font, semibold.',
    },
    Text: {
      props: z.object({
        variant: z.enum(['body', 'label', 'caption', 'mono']).optional(),
        color: z.enum(['default', 'muted', 'brand', 'danger']).optional(),
        text: z.string(),
      }),
      slots: [],
      description: "Text element. 'label' = 10px mono uppercase. 'caption' = 11px muted.",
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
  },
});

export type VisantCatalog = typeof visantCatalog;
