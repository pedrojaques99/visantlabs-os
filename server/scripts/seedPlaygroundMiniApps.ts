/**
 * Seed 2 community mini-apps: Typography Pairing Lab + Brand Scorecard.
 * Run: npx tsx server/scripts/seedPlaygroundMiniApps.ts
 */

import { prisma } from '../db/prisma.js';
import crypto from 'crypto';

const generateSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') +
  '-' +
  crypto.randomBytes(3).toString('hex');

const bind = (path: string) => ({ $bindState: path });

const MINI_APPS = [
  {
    title: 'Typography Pairing Lab',
    description:
      'Test font pairings with live preview at different sizes, weights, and line-heights. Light and dark mode side by side with CSS export.',
    tags: ['typography', 'fonts', 'pairing', 'css', 'preview'],
    category: 'brand',
    actionsUsed: ['copyToClipboard'],
    spec: {
      stateDefaults: {
        headingSize: 32,
        bodySize: 16,
        bodyWeight: 400,
        lineHeight: 1.6,
        headingManrope: true,
        headingInter: false,
        headingPlayfair: false,
        headingSpace: false,
        bodyInter: true,
        bodyDmSans: false,
        bodySourceSerif: false,
        bodyJetBrains: false,
      },
      root: 'page',
      elements: {
        page: {
          type: 'PageShell',
          props: { title: 'Typography Pairing Lab' },
          children: ['main-layout'],
        },
        'main-layout': {
          type: 'Stack',
          props: { direction: 'horizontal', gap: 6 },
          children: ['preview-area', 'controls-panel'],
        },

        // ─── Preview area ──────────────────────────────
        'preview-area': {
          type: 'Stack',
          props: { direction: 'vertical', gap: 6 },
          children: ['light-preview', 'dark-preview'],
        },
        'light-preview': {
          type: 'GlassPanel',
          props: { className: 'p-6 rounded-xl min-h-[220px]' },
          children: ['light-content'],
        },
        'light-content': {
          type: 'Stack',
          props: { direction: 'vertical', gap: 3 },
          children: ['light-label', 'light-heading', 'light-body'],
        },
        'light-label': {
          type: 'MicroTitle',
          props: { text: 'LIGHT MODE' },
        },
        'light-heading': {
          type: 'Heading',
          props: {
            level: 2,
            text: 'The quick brown fox jumps over the lazy dog',
            style: { fontSize: { $state: '/headingSize' } },
          },
        },
        'light-body': {
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Typography is the art and technique of arranging type to make written language legible, readable, and appealing. Selecting typefaces, sizes, line lengths, line-spacing, and letter-spacing are all part of the craft.',
            style: {
              fontSize: { $state: '/bodySize' },
              fontWeight: { $state: '/bodyWeight' },
              lineHeight: { $state: '/lineHeight' },
            },
          },
        },
        'dark-preview': {
          type: 'GlassPanel',
          props: { className: 'p-6 bg-neutral-900 rounded-xl min-h-[220px]' },
          children: ['dark-content'],
        },
        'dark-content': {
          type: 'Stack',
          props: { direction: 'vertical', gap: 3 },
          children: ['dark-label', 'dark-heading', 'dark-body'],
        },
        'dark-label': {
          type: 'MicroTitle',
          props: { text: 'DARK MODE' },
        },
        'dark-heading': {
          type: 'Heading',
          props: {
            level: 2,
            text: 'The quick brown fox jumps over the lazy dog',
            style: { fontSize: { $state: '/headingSize' } },
          },
        },
        'dark-body': {
          type: 'Text',
          props: {
            variant: 'body',
            color: 'muted',
            text: 'Typography is the art and technique of arranging type to make written language legible, readable, and appealing. Selecting typefaces, sizes, line lengths, line-spacing, and letter-spacing are all part of the craft.',
            style: {
              fontSize: { $state: '/bodySize' },
              fontWeight: { $state: '/bodyWeight' },
              lineHeight: { $state: '/lineHeight' },
            },
          },
        },

        // ─── Controls panel ────────────────────────────
        'controls-panel': {
          type: 'ToolPanel',
          props: {},
          children: ['controls-header', 'controls-content'],
        },
        'controls-header': {
          type: 'ToolPanelHeader',
          props: {},
          children: ['controls-title'],
        },
        'controls-title': {
          type: 'Heading',
          props: { level: 4, text: 'Font Controls' },
        },
        'controls-content': {
          type: 'ToolPanelContent',
          props: {},
          children: [
            'heading-section',
            'body-section',
            'spacing-section',
            'presets-section',
            'export-section',
          ],
        },

        // Heading font chips with $bindState
        'heading-section': {
          type: 'ToolPanelSection',
          props: { title: 'HEADING FONT' },
          children: ['heading-fonts-grid'],
        },
        'heading-fonts-grid': {
          type: 'ToolPanelGrid',
          props: { cols: 2 },
          children: ['font-manrope', 'font-inter', 'font-playfair', 'font-space-grotesk'],
        },
        'font-manrope': {
          type: 'ToolPanelChip',
          props: { label: 'Manrope', active: bind('/headingManrope') },
        },
        'font-inter': {
          type: 'ToolPanelChip',
          props: { label: 'Inter', active: bind('/headingInter') },
        },
        'font-playfair': {
          type: 'ToolPanelChip',
          props: { label: 'Playfair', active: bind('/headingPlayfair') },
        },
        'font-space-grotesk': {
          type: 'ToolPanelChip',
          props: { label: 'Space Grotesk', active: bind('/headingSpace') },
        },

        // Body font chips
        'body-section': {
          type: 'ToolPanelSection',
          props: { title: 'BODY FONT' },
          children: ['body-fonts-grid'],
        },
        'body-fonts-grid': {
          type: 'ToolPanelGrid',
          props: { cols: 2 },
          children: ['body-inter', 'body-dm-sans', 'body-source-serif', 'body-jetbrains'],
        },
        'body-inter': {
          type: 'ToolPanelChip',
          props: { label: 'Inter', active: bind('/bodyInter') },
        },
        'body-dm-sans': {
          type: 'ToolPanelChip',
          props: { label: 'DM Sans', active: bind('/bodyDmSans') },
        },
        'body-source-serif': {
          type: 'ToolPanelChip',
          props: { label: 'Source Serif', active: bind('/bodySourceSerif') },
        },
        'body-jetbrains': {
          type: 'ToolPanelChip',
          props: { label: 'JetBrains', active: bind('/bodyJetBrains') },
        },

        // Sizing sliders with $bindState
        'spacing-section': {
          type: 'ToolPanelSection',
          props: { title: 'SIZING & SPACING' },
          children: [
            'heading-size-slider',
            'body-size-slider',
            'weight-slider',
            'line-height-slider',
          ],
        },
        'heading-size-slider': {
          type: 'NodeSlider',
          props: {
            label: 'Heading Size',
            value: bind('/headingSize'),
            min: 18,
            max: 72,
            step: 2,
            hint: 'px',
          },
        },
        'body-size-slider': {
          type: 'NodeSlider',
          props: {
            label: 'Body Size',
            value: bind('/bodySize'),
            min: 12,
            max: 24,
            step: 1,
            hint: 'px',
          },
        },
        'weight-slider': {
          type: 'NodeSlider',
          props: {
            label: 'Body Weight',
            value: bind('/bodyWeight'),
            min: 300,
            max: 700,
            step: 100,
          },
        },
        'line-height-slider': {
          type: 'NodeSlider',
          props: {
            label: 'Line Height',
            value: bind('/lineHeight'),
            min: 1.0,
            max: 2.2,
            step: 0.1,
          },
        },

        // Presets
        'presets-section': {
          type: 'ToolPanelDisclosure',
          props: { label: 'Quick Presets', defaultOpen: false },
          children: ['presets-grid'],
        },
        'presets-grid': {
          type: 'ToolPanelGrid',
          props: { cols: 2 },
          children: ['preset-editorial', 'preset-tech', 'preset-luxury', 'preset-playful'],
        },
        'preset-editorial': {
          type: 'ToolPanelChip',
          props: { label: 'Editorial', active: false },
        },
        'preset-tech': {
          type: 'ToolPanelChip',
          props: { label: 'Tech', active: false },
        },
        'preset-luxury': {
          type: 'ToolPanelChip',
          props: { label: 'Luxury', active: false },
        },
        'preset-playful': {
          type: 'ToolPanelChip',
          props: { label: 'Playful', active: false },
        },

        // Export
        'export-section': {
          type: 'ToolPanelSection',
          props: { title: 'EXPORT' },
          children: ['copy-css-btn'],
        },
        'copy-css-btn': {
          type: 'Button',
          props: { variant: 'brand', size: 'default' },
          children: ['copy-css-label'],
          on: {
            press: {
              action: 'copyToClipboard',
              params: {
                text: '/* Heading */\nfont-family: "Manrope", sans-serif;\nfont-size: 32px;\nfont-weight: 700;\nline-height: 1.2;\n\n/* Body */\nfont-family: "Inter", sans-serif;\nfont-size: 16px;\nfont-weight: 400;\nline-height: 1.6;',
              },
            },
          },
        },
        'copy-css-label': {
          type: 'Text',
          props: { text: 'Copy CSS Snippet', variant: 'body' },
        },
      },
    },
  },
  {
    title: 'Brand Scorecard',
    description:
      'Audit your brand guideline completeness with visual metrics, charts, and actionable improvement tips.',
    tags: ['brand', 'audit', 'dashboard', 'compliance', 'metrics'],
    category: 'brand',
    actionsUsed: ['getBrand', 'complianceCheck'],
    spec: {
      stateDefaults: {
        showTips: true,
      },
      root: 'page',
      elements: {
        page: {
          type: 'PageShell',
          props: { title: 'Brand Scorecard' },
          children: ['top-metrics', 'charts-row', 'details-section'],
        },

        // ─── Top metric cards ──────────────────────────
        'top-metrics': {
          type: 'Grid',
          props: { cols: 4, gap: 4 },
          children: ['metric-overall', 'metric-colors', 'metric-typography', 'metric-assets'],
        },
        'metric-overall': {
          type: 'Metric',
          props: { label: 'Overall Score', value: '78%', change: '+12%', trend: 'up' as const },
        },
        'metric-colors': {
          type: 'Metric',
          props: {
            label: 'Color System',
            value: '5/6',
            change: 'Missing secondary',
            trend: 'neutral' as const,
          },
        },
        'metric-typography': {
          type: 'Metric',
          props: {
            label: 'Typography',
            value: '3/4',
            change: 'Needs display font',
            trend: 'neutral' as const,
          },
        },
        'metric-assets': {
          type: 'Metric',
          props: {
            label: 'Assets',
            value: '12',
            change: '+3 this week',
            trend: 'up' as const,
          },
        },

        // ─── Charts row ────────────────────────────────
        'charts-row': {
          type: 'Grid',
          props: { cols: 2, gap: 6 },
          children: ['completeness-card', 'assets-card'],
        },
        'completeness-card': {
          type: 'Card',
          props: {
            title: 'Guideline Completeness',
            description: 'How complete each section of your brand guideline is',
          },
          children: ['completeness-chart'],
        },
        'completeness-chart': {
          type: 'PieChart',
          props: {
            data: [
              { name: 'Colors', value: 90 },
              { name: 'Typography', value: 75 },
              { name: 'Voice & Tone', value: 60 },
              { name: 'Imagery', value: 45 },
              { name: 'Logos', value: 85 },
            ],
            height: 280,
          },
        },
        'assets-card': {
          type: 'Card',
          props: {
            title: 'Assets by Category',
            description: 'Number of brand assets uploaded per category',
          },
          children: ['assets-chart'],
        },
        'assets-chart': {
          type: 'BarChart',
          props: {
            data: [
              { category: 'Logos', count: 4 },
              { category: 'Icons', count: 8 },
              { category: 'Photos', count: 15 },
              { category: 'Patterns', count: 3 },
              { category: 'Templates', count: 6 },
            ],
            dataKey: 'count',
            xAxisKey: 'category',
            height: 280,
          },
        },

        // ─── Details section ───────────────────────────
        'details-section': {
          type: 'Stack',
          props: { direction: 'vertical', gap: 4 },
          children: ['status-heading', 'status-row', 'tips-toggle-row', 'tips-disclosure'],
        },
        'status-heading': {
          type: 'MicroTitle',
          props: { text: 'SECTION STATUS' },
        },
        'status-row': {
          type: 'Grid',
          props: { cols: 5, gap: 3 },
          children: [
            'badge-colors',
            'badge-typo',
            'badge-voice',
            'badge-imagery',
            'badge-logos',
          ],
        },
        'badge-colors': {
          type: 'Badge',
          props: { label: 'Colors ✓', variant: 'default' as const },
        },
        'badge-typo': {
          type: 'Badge',
          props: { label: 'Typography ✓', variant: 'default' as const },
        },
        'badge-voice': {
          type: 'Badge',
          props: { label: 'Voice ⚠', variant: 'secondary' as const },
        },
        'badge-imagery': {
          type: 'Badge',
          props: { label: 'Imagery ✗', variant: 'destructive' as const },
        },
        'badge-logos': {
          type: 'Badge',
          props: { label: 'Logos ✓', variant: 'default' as const },
        },

        // Tips toggle
        'tips-toggle-row': {
          type: 'Switch',
          props: {
            label: 'Show improvement tips',
            checked: bind('/showTips'),
          },
        },

        // Tips
        'tips-disclosure': {
          type: 'ToolPanelDisclosure',
          props: { label: 'Improvement Tips', defaultOpen: true },
          children: ['tips-stack'],
          visible: { path: '/showTips', eq: true },
        },
        'tips-stack': {
          type: 'Stack',
          props: { direction: 'vertical', gap: 3 },
          children: ['tip-1', 'tip-2', 'tip-3', 'tip-4'],
        },
        'tip-1': {
          type: 'Card',
          props: {
            title: '1. Complete Voice & Tone',
            description:
              'Add brand voice descriptors, dos and donts, and sample copy for different channels. This helps AI generate on-brand content.',
          },
        },
        'tip-2': {
          type: 'Card',
          props: {
            title: '2. Upload Imagery References',
            description:
              'Add photography style guides, moodboard images, and illustration samples. AI uses these to match your visual language.',
          },
        },
        'tip-3': {
          type: 'Card',
          props: {
            title: '3. Add a Display Font',
            description:
              'Your brand only has body and heading fonts. A display or accent font adds hierarchy and personality to hero sections.',
          },
        },
        'tip-4': {
          type: 'Card',
          props: {
            title: '4. Define Secondary Colors',
            description:
              'Add 2-3 secondary/accent colors for UI states, backgrounds, and data visualization. This prevents off-brand color choices.',
          },
        },
      },
    },
  },
];

async function main() {
  const owner = await prisma.user.findFirst({
    where: { email: 'visantsupply@gmail.com' },
    select: { id: true },
  });

  if (!owner) {
    console.error('Owner user not found.');
    process.exit(1);
  }

  console.log(`Using user ${owner.id} as owner\n`);

  // Delete old versions first
  for (const app of MINI_APPS) {
    const existing = await prisma.miniApp.findFirst({
      where: { title: app.title, userId: owner.id },
    });
    if (existing) {
      await prisma.miniApp.delete({ where: { id: existing.id } });
      console.log(`Deleted old: "${app.title}" (${existing.slug})`);
    }
  }

  // Create new versions
  for (const app of MINI_APPS) {
    const shareId = crypto.randomBytes(16).toString('hex');

    const miniApp = await prisma.miniApp.create({
      data: {
        userId: owner.id,
        slug: generateSlug(app.title),
        title: app.title,
        description: app.description,
        tags: app.tags,
        category: app.category,
        spec: app.spec as any,
        stateDefaults: app.spec.stateDefaults as any,
        actionsUsed: app.actionsUsed,
        isPublished: true,
        isFeatured: true,
        shareId,
      },
    });

    console.log(`Created & published: "${miniApp.title}" -> /playground/${miniApp.slug}`);
    console.log(`   Share: /playground/shared/${shareId}\n`);
  }

  console.log('Done!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
