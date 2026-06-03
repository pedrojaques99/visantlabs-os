import { defineRegistry } from '@json-render/react';
import { visantCatalog } from './catalog';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';

// Layout
import { PageShell } from '@/components/ui/PageShell';
import { GlassPanel } from '@/components/ui/GlassPanel';

// Tool Panel
import {
  ToolPanel,
  ToolPanelHeader,
  ToolPanelContent,
  ToolPanelSection,
  ToolPanelDisclosure,
  ToolPanelGrid,
  ToolPanelChip,
  ToolPanelRow,
} from '@/components/shared/ToolPanel';

// Inputs
import { NodeSlider } from '@/components/reactflow/shared/node-slider';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Image
import { ImageUploader } from '@/components/ui/ImageUploader';
import { ImageThumbnail } from '@/components/ui/ImageThumbnail';

// Data Display
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Feedback
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import { MicroTitle } from '@/components/ui/MicroTitle';

// Charts
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  PieChart as RePieChart,
  Pie,
  Cell,
} from 'recharts';

import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const BRAND_CYAN = 'var(--brand-cyan, #00e5ff)';
const PIE_COLORS = ['#00e5ff', '#ff6b35', '#a855f7', '#22c55e', '#eab308', '#ef4444'];

const playgroundApiBase = '/api/playground/proxy';

async function playgroundFetch(endpoint: string, body?: Record<string, unknown>) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${playgroundApiBase}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const { registry, handlers } = defineRegistry(visantCatalog, {
  components: {
    // ─── Layout ───────────────────────────────────────
    PageShell: ({ props, children }) => (
      <PageShell pageId="playground-miniapp" title={props.title}>
        <div className={props.className}>{children}</div>
      </PageShell>
    ),
    GlassPanel: ({ props, children }) => (
      <GlassPanel className={props.className}>{children}</GlassPanel>
    ),

    // ─── Tool Panel ───────────────────────────────────
    ToolPanel: ({ children }) => <ToolPanel>{children}</ToolPanel>,
    ToolPanelHeader: ({ children }) => <ToolPanelHeader>{children}</ToolPanelHeader>,
    ToolPanelContent: ({ children }) => <ToolPanelContent>{children}</ToolPanelContent>,
    ToolPanelSection: ({ props, children }) => (
      <ToolPanelSection title={props.title}>{children}</ToolPanelSection>
    ),
    ToolPanelDisclosure: ({ props, children }) => (
      <ToolPanelDisclosure label={props.label} defaultOpen={props.defaultOpen}>
        {children}
      </ToolPanelDisclosure>
    ),
    ToolPanelGrid: ({ props, children }) => (
      <ToolPanelGrid cols={props.cols as 2 | 3 | 4 | 5 | undefined}>{children}</ToolPanelGrid>
    ),
    ToolPanelChip: ({ props }) => (
      <ToolPanelChip active={props.active}>{props.label}</ToolPanelChip>
    ),
    ToolPanelRow: ({ props, children }) => (
      <ToolPanelRow label={props.label}>{children}</ToolPanelRow>
    ),

    // ─── Inputs ───────────────────────────────────────
    NodeSlider: ({ props }) => (
      <NodeSlider
        label={props.label}
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={() => {}}
        hint={props.hint}
      />
    ),
    ScrubInput: ({ props }) => (
      <ScrubInput
        label={props.label}
        value={props.value}
        min={props.min}
        max={props.max}
        suffix={props.suffix}
        onChange={() => {}}
      />
    ),
    InlineColorPicker: ({ props }) => (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          {props.label}
        </span>
        <input
          type="color"
          value={props.value}
          className="w-6 h-6 rounded border-0 cursor-pointer"
          readOnly
        />
        <span className="text-[11px] text-neutral-400 font-mono">{props.value}</span>
      </div>
    ),
    Button: ({ props, children }) => (
      <Button variant={props.variant as any} size={props.size as any} disabled={props.disabled}>
        {children}
      </Button>
    ),
    Switch: ({ props }) => (
      <div className="flex items-center gap-2">
        {props.label && <span className="text-[11px] text-neutral-400">{props.label}</span>}
        <Switch checked={props.checked} />
      </div>
    ),
    Input: ({ props }) => <Input placeholder={props.placeholder} type={props.type} />,
    Textarea: ({ props }) => <Textarea placeholder={props.placeholder} rows={props.rows} />,

    // ─── Image ────────────────────────────────────────
    ImageUploader: () => (
      <ImageUploader onImageUpload={() => {}} onProceedWithoutImage={() => {}} />
    ),
    ImageThumbnail: ({ props }) => <ImageThumbnail base64={props.src} index={props.index} />,

    // ─── Data Display ─────────────────────────────────
    Card: ({ props, children }) => (
      <Card>
        {(props.title || props.description) && (
          <CardHeader>
            {props.title && <CardTitle>{props.title}</CardTitle>}
            {props.description && <CardDescription>{props.description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent>{children}</CardContent>
      </Card>
    ),
    Badge: ({ props }) => <Badge variant={props.variant as any}>{props.label}</Badge>,
    Tabs: ({ props, children }) => (
      <Tabs defaultValue={props.defaultValue || props.tabs[0]?.value}>
        <TabsList>
          {props.tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {children}
      </Tabs>
    ),
    Metric: ({ props }) => (
      <GlassPanel className="p-4">
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          {props.label}
        </span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-semibold text-neutral-100">{props.value}</span>
          {props.change && (
            <span
              className={cn(
                'text-xs font-mono',
                props.trend === 'up'
                  ? 'text-green-400'
                  : props.trend === 'down'
                  ? 'text-red-400'
                  : 'text-neutral-400'
              )}
            >
              {props.change}
            </span>
          )}
        </div>
      </GlassPanel>
    ),

    // ─── Charts ───────────────────────────────────────
    BarChart: ({ props }) => (
      <ResponsiveContainer width="100%" height={props.height || 200}>
        <ReBarChart data={props.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey={props.xAxisKey} stroke="#666" fontSize={10} />
          <YAxis stroke="#666" fontSize={10} />
          <ReTooltip
            contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 8 }}
          />
          <Bar dataKey={props.dataKey} fill={props.color || BRAND_CYAN} radius={[4, 4, 0, 0]} />
        </ReBarChart>
      </ResponsiveContainer>
    ),
    LineChart: ({ props }) => (
      <ResponsiveContainer width="100%" height={props.height || 200}>
        <ReLineChart data={props.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey={props.xAxisKey} stroke="#666" fontSize={10} />
          <YAxis stroke="#666" fontSize={10} />
          <ReTooltip
            contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 8 }}
          />
          <Line
            type="monotone"
            dataKey={props.dataKey}
            stroke={props.color || BRAND_CYAN}
            strokeWidth={2}
            dot={false}
          />
        </ReLineChart>
      </ResponsiveContainer>
    ),
    PieChart: ({ props }) => (
      <ResponsiveContainer width="100%" height={props.height || 200}>
        <RePieChart>
          <Pie
            data={props.data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={70}
            innerRadius={40}
          >
            {props.data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <ReTooltip
            contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 8 }}
          />
        </RePieChart>
      </ResponsiveContainer>
    ),

    // ─── Feedback ─────────────────────────────────────
    GlitchLoader: ({ props }) => <GlitchLoader size={props.size} />,
    SkeletonLoader: ({ props }) => (
      <SkeletonLoader variant={props.variant} width={props.width} height={props.height} />
    ),
    EmptyState: ({ props }) => (
      <EmptyState icon={Zap} title={props.title} description={props.description} />
    ),

    // ─── Layout Primitives ────────────────────────────
    Stack: ({ props, children }) => (
      <div
        className={cn(
          'flex',
          props.direction === 'horizontal' ? 'flex-row' : 'flex-col',
          props.align === 'center' && 'items-center',
          props.align === 'end' && 'items-end',
          props.align === 'stretch' && 'items-stretch'
        )}
        style={{ gap: `${props.gap ?? 4 * 4}px` }}
      >
        {children}
      </div>
    ),
    Grid: ({ props, children }) => (
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${props.cols ?? 2}, minmax(0, 1fr))`,
          gap: `${(props.gap ?? 4) * 4}px`,
        }}
      >
        {children}
      </div>
    ),
    Separator: ({ props }) => <Separator orientation={props.orientation} />,

    // ─── Text ─────────────────────────────────────────
    Heading: ({ props }) => {
      const level = props.level ?? 2;
      const cls = 'font-semibold text-neutral-100';
      if (level === 1) return <h1 className={cls}>{props.text}</h1>;
      if (level === 3) return <h3 className={cls}>{props.text}</h3>;
      if (level === 4) return <h4 className={cls}>{props.text}</h4>;
      return <h2 className={cls}>{props.text}</h2>;
    },
    Text: ({ props }) => {
      const styles: Record<string, string> = {
        body: 'text-sm text-neutral-300',
        label: 'text-[10px] font-mono uppercase tracking-widest text-neutral-500',
        caption: 'text-[11px] text-neutral-400',
        mono: 'text-xs font-mono text-neutral-300',
      };
      const colors: Record<string, string> = {
        default: '',
        muted: 'text-neutral-500',
        brand: 'text-brand-cyan',
        danger: 'text-red-400',
      };
      return (
        <span className={cn(styles[props.variant ?? 'body'], colors[props.color ?? 'default'])}>
          {props.text}
        </span>
      );
    },
    MicroTitle: ({ props }) => <MicroTitle>{props.text}</MicroTitle>,
  },

  actions: {
    generateMockup: async (params) => {
      const result = await playgroundFetch('/mockup/generate', params as Record<string, unknown>);
      toast.success('Mockup generated!');
      return result;
    },
    generateImage: async (params) => {
      const result = await playgroundFetch('/ai/generate-image', params as Record<string, unknown>);
      toast.success('Image generated!');
      return result;
    },
    extractColors: async (params) => {
      return playgroundFetch('/ai/extract-colors', params as Record<string, unknown>);
    },
    generateNaming: async (params) => {
      return playgroundFetch('/ai/generate-naming', params as Record<string, unknown>);
    },
    describeImage: async (params) => {
      return playgroundFetch('/ai/describe-image', params as Record<string, unknown>);
    },
    complianceCheck: async (params) => {
      return playgroundFetch(
        '/brand-guidelines/compliance-check',
        params as Record<string, unknown>
      );
    },
    uploadImage: async (params) => {
      return playgroundFetch('/community/upload-image', { image: params?.base64 });
    },
    getBrand: async (params) => {
      return playgroundFetch(`/brand-guidelines/${params?.brandGuidelineId}`);
    },
    copyToClipboard: async (params) => {
      if (params?.text) {
        await navigator.clipboard.writeText(params.text);
        toast.success('Copied to clipboard');
      }
    },
    downloadFile: async (params) => {
      if (params?.url) {
        const url = String(params.url);
        if (!url.startsWith('https://') && !url.startsWith('http://') && !url.startsWith('/'))
          return;
        const a = document.createElement('a');
        a.href = url;
        a.download = params.filename || 'download';
        a.click();
      }
    },
  },
});
