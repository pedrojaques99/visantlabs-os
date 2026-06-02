/**
 * Seed script: creates pre-built miniapps via API.
 *
 * Usage:
 *   npx tsx scripts/seed-miniapps.ts
 *
 * Requires VISANT_API_URL and VISANT_TOKEN env vars (or defaults to localhost).
 */

const API_BASE = process.env.VISANT_API_URL || 'http://localhost:3001';
const TOKEN = process.env.VISANT_TOKEN;

if (!TOKEN) {
  console.error('❌ Set VISANT_TOKEN env var (JWT or API key)');
  process.exit(1);
}

// ─── MiniApp Specs ──────────────────────────────────────────────────────────

interface SeedMiniApp {
  title: string;
  description: string;
  tags: string[];
  category: string;
  spec: { root: string; elements: Record<string, any> };
  stateDefaults?: Record<string, any>;
  actionsUsed?: string[];
}

const MINIAPPS: SeedMiniApp[] = [
  // 1️⃣ Brand Color Analyzer
  {
    title: 'Brand Color Analyzer',
    description: 'Upload an image and extract its dominant color palette with role classification.',
    tags: ['colors', 'brand', 'analysis', 'palette'],
    category: 'brand',
    actionsUsed: ['uploadImage', 'extractColors'],
    spec: {
      root: 'page',
      elements: {
        page: {
          type: 'PageShell',
          props: { title: 'Brand Color Analyzer' },
          children: ['layout'],
        },
        layout: {
          type: 'Stack',
          props: { direction: 'horizontal', gap: 24 },
          children: ['leftPanel', 'rightPanel'],
        },
        leftPanel: {
          type: 'GlassPanel',
          props: {},
          children: ['leftStack'],
        },
        leftStack: {
          type: 'Stack',
          props: { direction: 'vertical', gap: 16 },
          children: ['uploadTitle', 'uploader', 'extractBtn'],
        },
        uploadTitle: {
          type: 'MicroTitle',
          props: { text: 'Upload Image' },
        },
        uploader: {
          type: 'ImageUploader',
          props: {},
        },
        extractBtn: {
          type: 'Button',
          props: { variant: 'brand', children: 'Extract Colors' },
        },
        rightPanel: {
          type: 'ToolPanel',
          props: {},
          children: ['rightHeader', 'rightContent'],
        },
        rightHeader: {
          type: 'ToolPanelHeader',
          props: {},
          children: ['resultTitle'],
        },
        resultTitle: {
          type: 'Heading',
          props: { level: 4, text: 'Extracted Palette' },
        },
        rightContent: {
          type: 'ToolPanelContent',
          props: {},
          children: ['colorGrid'],
        },
        colorGrid: {
          type: 'Grid',
          props: { cols: 3, gap: 12 },
          children: ['emptyState'],
        },
        emptyState: {
          type: 'EmptyState',
          props: { title: 'No colors yet', description: 'Upload an image to extract its palette' },
        },
      },
    },
  },

  // 2️⃣ Mockup Machine
  {
    title: 'Mockup Machine',
    description: 'Describe a scene and generate product mockups with optional brand injection.',
    tags: ['mockup', 'product', '3d', 'scene'],
    category: 'design',
    actionsUsed: ['generateMockup'],
    spec: {
      root: 'page',
      elements: {
        page: {
          type: 'PageShell',
          props: { title: 'Mockup Machine' },
          children: ['mainStack'],
        },
        mainStack: {
          type: 'Stack',
          props: { direction: 'horizontal', gap: 24 },
          children: ['controls', 'preview'],
        },
        controls: {
          type: 'ToolPanel',
          props: {},
          children: ['controlsHeader', 'controlsContent'],
        },
        controlsHeader: {
          type: 'ToolPanelHeader',
          props: {},
          children: ['controlsTitle'],
        },
        controlsTitle: {
          type: 'Heading',
          props: { level: 4, text: 'Scene Settings' },
        },
        controlsContent: {
          type: 'ToolPanelContent',
          props: {},
          children: ['sceneSection', 'imageSection', 'genBtn'],
        },
        sceneSection: {
          type: 'ToolPanelSection',
          props: { title: 'Scene Description' },
          children: ['sceneInput'],
        },
        sceneInput: {
          type: 'Textarea',
          props: { placeholder: 'e.g. Vinyl sticker on brushed steel, studio lighting...', rows: 3 },
        },
        imageSection: {
          type: 'ToolPanelSection',
          props: { title: 'Reference Design' },
          children: ['refUploader'],
        },
        refUploader: {
          type: 'ImageUploader',
          props: {},
        },
        genBtn: {
          type: 'Button',
          props: { variant: 'brand', children: 'Generate Mockup' },
        },
        preview: {
          type: 'GlassPanel',
          props: {},
          children: ['previewEmpty'],
        },
        previewEmpty: {
          type: 'EmptyState',
          props: { title: 'Preview', description: 'Configure and generate to see your mockup' },
        },
      },
    },
  },

  // 3️⃣ Naming Generator
  {
    title: 'Naming Generator',
    description: 'Generate creative brand name ideas from a brief and style.',
    tags: ['naming', 'brand', 'creative', 'generator'],
    category: 'brand',
    actionsUsed: ['generateNaming'],
    spec: {
      root: 'page',
      elements: {
        page: {
          type: 'PageShell',
          props: { title: 'Naming Generator' },
          children: ['stack'],
        },
        stack: {
          type: 'Stack',
          props: { direction: 'vertical', gap: 24 },
          children: ['inputCard', 'resultsCard'],
        },
        inputCard: {
          type: 'Card',
          props: { title: 'Brief' },
          children: ['inputStack'],
        },
        inputStack: {
          type: 'Stack',
          props: { direction: 'vertical', gap: 12 },
          children: ['briefInput', 'styleRow', 'generateBtn'],
        },
        briefInput: {
          type: 'Textarea',
          props: { placeholder: 'Describe the brand: audience, values, positioning...', rows: 3 },
        },
        styleRow: {
          type: 'Stack',
          props: { direction: 'horizontal', gap: 8 },
          children: ['styleChips'],
        },
        styleChips: {
          type: 'ToolPanelGrid',
          props: { cols: 4 },
          children: ['chipMinimal', 'chipPlayful', 'chipCorporate', 'chipAbstract'],
        },
        chipMinimal: { type: 'ToolPanelChip', props: { label: 'Minimal', active: true } },
        chipPlayful: { type: 'ToolPanelChip', props: { label: 'Playful' } },
        chipCorporate: { type: 'ToolPanelChip', props: { label: 'Corporate' } },
        chipAbstract: { type: 'ToolPanelChip', props: { label: 'Abstract' } },
        generateBtn: {
          type: 'Button',
          props: { variant: 'brand', children: 'Generate Names' },
        },
        resultsCard: {
          type: 'Card',
          props: { title: 'Suggestions' },
          children: ['resultsEmpty'],
        },
        resultsEmpty: {
          type: 'EmptyState',
          props: { title: 'No names yet', description: 'Fill in the brief and generate' },
        },
      },
    },
  },

  // 4️⃣ Compliance Checker
  {
    title: 'Compliance Checker',
    description: 'Upload a design and check it against brand guidelines for compliance.',
    tags: ['compliance', 'brand', 'check', 'guidelines'],
    category: 'brand',
    actionsUsed: ['complianceCheck', 'uploadImage'],
    spec: {
      root: 'page',
      elements: {
        page: {
          type: 'PageShell',
          props: { title: 'Compliance Checker' },
          children: ['layout'],
        },
        layout: {
          type: 'Stack',
          props: { direction: 'vertical', gap: 24 },
          children: ['uploadSection', 'brandSection', 'checkBtn', 'resultsSection'],
        },
        uploadSection: {
          type: 'Card',
          props: { title: 'Design to Check' },
          children: ['uploader'],
        },
        uploader: {
          type: 'ImageUploader',
          props: {},
        },
        brandSection: {
          type: 'Card',
          props: { title: 'Brand Guideline' },
          children: ['brandInput'],
        },
        brandInput: {
          type: 'Input',
          props: { placeholder: 'Brand guideline ID...', type: 'text' },
        },
        checkBtn: {
          type: 'Button',
          props: { variant: 'brand', children: 'Check Compliance' },
        },
        resultsSection: {
          type: 'GlassPanel',
          props: {},
          children: ['resultsEmpty'],
        },
        resultsEmpty: {
          type: 'EmptyState',
          props: { title: 'Results', description: 'Upload a design and select a brand guideline to check compliance' },
        },
      },
    },
  },

  // 5️⃣ Design Metrics Dashboard
  {
    title: 'Design Metrics Dashboard',
    description: 'Track design KPIs with charts — views, conversions, engagement.',
    tags: ['dashboard', 'metrics', 'analytics', 'charts'],
    category: 'utility',
    actionsUsed: [],
    spec: {
      root: 'page',
      elements: {
        page: {
          type: 'PageShell',
          props: { title: 'Design Metrics' },
          children: ['metricsRow', 'chartsRow'],
        },
        metricsRow: {
          type: 'Grid',
          props: { cols: 4, gap: 16 },
          children: ['metricViews', 'metricConversions', 'metricEngagement', 'metricBounce'],
        },
        metricViews: {
          type: 'Metric',
          props: { label: 'Views', value: '12,450', change: '+8.2%', trend: 'up' },
        },
        metricConversions: {
          type: 'Metric',
          props: { label: 'Conversions', value: '342', change: '+12.5%', trend: 'up' },
        },
        metricEngagement: {
          type: 'Metric',
          props: { label: 'Engagement', value: '67%', change: '-2.1%', trend: 'down' },
        },
        metricBounce: {
          type: 'Metric',
          props: { label: 'Bounce Rate', value: '23%', change: '-5.0%', trend: 'up' },
        },
        chartsRow: {
          type: 'Grid',
          props: { cols: 2, gap: 16 },
          children: ['lineCard', 'pieCard'],
        },
        lineCard: {
          type: 'Card',
          props: { title: 'Views Over Time' },
          children: ['lineChart'],
        },
        lineChart: {
          type: 'LineChart',
          props: {
            data: [
              { day: 'Mon', views: 1200 },
              { day: 'Tue', views: 1900 },
              { day: 'Wed', views: 1600 },
              { day: 'Thu', views: 2400 },
              { day: 'Fri', views: 2100 },
              { day: 'Sat', views: 1800 },
              { day: 'Sun', views: 2800 },
            ],
            dataKey: 'views',
            xAxisKey: 'day',
            height: 250,
          },
        },
        pieCard: {
          type: 'Card',
          props: { title: 'Traffic Sources' },
          children: ['pieChart'],
        },
        pieChart: {
          type: 'PieChart',
          props: {
            data: [
              { name: 'Direct', value: 40 },
              { name: 'Social', value: 30 },
              { name: 'Search', value: 20 },
              { name: 'Referral', value: 10 },
            ],
            height: 250,
          },
        },
      },
    },
  },
];

// ─── Seed Runner ────────────────────────────────────────────────────────────

async function seed() {
  console.log(`🌱 Seeding ${MINIAPPS.length} miniapps to ${API_BASE}...\n`);

  for (const app of MINIAPPS) {
    try {
      const res = await fetch(`${API_BASE}/api/playground`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify(app),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`  ✗ ${app.title}: ${res.status} — ${err}`);
        continue;
      }

      const { miniApp } = await res.json();
      console.log(`  ✓ ${app.title} → /playground/${miniApp.slug}`);
    } catch (err: any) {
      console.error(`  ✗ ${app.title}: ${err.message}`);
    }
  }

  console.log('\n✅ Done!');
}

seed();
