import React, { useEffect, useRef, useState, useMemo, Suspense } from 'react';
import { defineRegistry, useBoundProp } from '@json-render/react';
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
      <div className="h-full w-full overflow-auto p-6">
        {props.title && (
          <h2 className="text-lg font-semibold text-neutral-100 mb-4">{props.title}</h2>
        )}
        <div className={props.className}>{children}</div>
      </div>
    ),
    GlassPanel: ({ props, children }) => (
      <GlassPanel
        className={props.className}
        style={props.style as React.CSSProperties | undefined}
      >
        {children}
      </GlassPanel>
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
    ToolPanelChip: ({ props, bindings, emit }) => {
      const [active, setActive] = useBoundProp<boolean>(props.active, bindings?.active);
      return (
        <ToolPanelChip
          active={active ?? props.active}
          onClick={() => {
            setActive(!(active ?? props.active));
            emit('press');
          }}
        >
          {props.label}
        </ToolPanelChip>
      );
    },
    ToolPanelRow: ({ props, children }) => (
      <ToolPanelRow label={props.label}>{children}</ToolPanelRow>
    ),

    // ─── Inputs ───────────────────────────────────────
    NodeSlider: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<number>(props.value, bindings?.value);
      return (
        <NodeSlider
          label={props.label}
          value={value ?? props.value}
          min={props.min}
          max={props.max}
          step={props.step}
          onChange={setValue}
          hint={props.hint}
        />
      );
    },
    ScrubInput: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<number>(props.value, bindings?.value);
      return (
        <ScrubInput
          label={props.label}
          value={value ?? props.value}
          min={props.min}
          max={props.max}
          suffix={props.suffix}
          onChange={setValue}
        />
      );
    },
    InlineColorPicker: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);
      const current = value ?? props.value;
      return (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
            {props.label}
          </span>
          <input
            type="color"
            value={current}
            onChange={(e) => setValue(e.target.value)}
            className="w-6 h-6 rounded border-0 cursor-pointer"
          />
          <span className="text-[11px] text-neutral-400 font-mono">{current}</span>
        </div>
      );
    },
    Button: ({ props, children, emit }) => (
      <Button
        variant={props.variant as any}
        size={props.size as any}
        disabled={props.disabled}
        onClick={() => emit('press')}
      >
        {children}
      </Button>
    ),
    Switch: ({ props, bindings }) => {
      const [checked, setChecked] = useBoundProp<boolean>(props.checked, bindings?.checked);
      return (
        <div className="flex items-center gap-2">
          {props.label && <span className="text-[11px] text-neutral-400">{props.label}</span>}
          <Switch checked={checked ?? props.checked} onCheckedChange={setChecked} />
        </div>
      );
    },
    Input: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);
      return (
        <Input
          placeholder={props.placeholder}
          type={props.type}
          value={value ?? ''}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    },
    Textarea: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);
      return (
        <Textarea
          placeholder={props.placeholder}
          rows={props.rows}
          value={value ?? ''}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    },

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

    // ─── Power Components ─────────────────────────────
    ShaderPreview: ({ props, bindings }) => {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const [shaderType] = useBoundProp<string>(props.shaderType, bindings?.shaderType);
      const [params] = useBoundProp<Record<string, any>>(props.params, bindings?.params);
      const currentType = shaderType ?? props.shaderType;
      const currentParams = params ?? props.params ?? {};
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const w = props.width || 512;
      const h = props.height || 512;

      useEffect(() => {
        if (!props.imageUrl) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
          try {
            const { applyShaderEffect } = await import('@/utils/shaders/shaderRenderer');
            const result = await applyShaderEffect(props.imageUrl, w, h, {
              shaderType: currentType as any,
              ...currentParams,
            });
            if (!cancelled && canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                const img = new Image();
                img.onload = () => {
                  canvasRef.current!.width = img.naturalWidth;
                  canvasRef.current!.height = img.naturalHeight;
                  ctx.drawImage(img, 0, 0);
                  setLoading(false);
                };
                img.onerror = () => {
                  setError('Failed to render');
                  setLoading(false);
                };
                img.src = result;
              }
            }
          } catch (e: any) {
            if (!cancelled) {
              setError(e.message || 'Shader error');
              setLoading(false);
            }
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [props.imageUrl, currentType, JSON.stringify(currentParams)]);

      if (!props.imageUrl) {
        return (
          <div
            className="rounded-lg bg-neutral-900 flex items-center justify-center"
            style={{ width: w, height: h }}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Upload an image to apply shader
            </span>
          </div>
        );
      }

      return (
        <div className="relative rounded-lg overflow-hidden bg-neutral-900">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80 z-10">
              <GlitchLoader size="sm" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80 z-10">
              <span className="text-[11px] text-red-400 font-mono">{error}</span>
            </div>
          )}
          <canvas ref={canvasRef} className="w-full h-auto" style={{ maxWidth: w, maxHeight: h }} />
        </div>
      );
    },

    Scene3D: ({ props, bindings }) => {
      const containerRef = useRef<HTMLDivElement>(null);
      const [material] = useBoundProp<string>(props.material, bindings?.material);
      const [color] = useBoundProp<string>(props.color, bindings?.color);
      const [animation] = useBoundProp<string>(props.animation, bindings?.animation);
      const Scene3DLazy = useMemo(
        () => React.lazy(() => import('@/lib/playground/components/PlaygroundScene3D')),
        []
      );

      return (
        <div
          ref={containerRef}
          className="relative rounded-lg overflow-hidden bg-neutral-900"
          style={{ width: props.width || '100%', height: props.height || 400 }}
        >
          <Suspense fallback={<GlitchLoader size="md" />}>
            <Scene3DLazy
              mode={props.mode || 'text'}
              input={props.input || 'Visant'}
              shape={props.shape}
              material={(material ?? props.material) || 'chrome'}
              color={(color ?? props.color) || '#00e5ff'}
              animation={(animation ?? props.animation) || 'spin'}
              depth={props.depth || 20}
            />
          </Suspense>
        </div>
      );
    },

    VideoPlayer: ({ props, bindings }) => {
      const [src] = useBoundProp<string>(props.src, bindings?.src);
      const currentSrc = src ?? props.src;
      const w = props.width || '100%';
      const h = props.height || 300;

      if (!currentSrc) {
        return (
          <div
            className="relative rounded-lg overflow-hidden bg-neutral-900 flex items-center justify-center"
            style={{ width: w, height: h }}
          >
            <div className="text-center">
              <div className="text-neutral-600 text-3xl mb-2">▶</div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                No video loaded
              </span>
            </div>
          </div>
        );
      }

      return (
        <div className="relative rounded-lg overflow-hidden bg-neutral-900">
          <video
            src={currentSrc}
            autoPlay={props.autoPlay ?? false}
            loop={props.loop ?? false}
            controls={props.controls ?? true}
            muted={props.muted ?? true}
            poster={props.poster}
            style={{ width: w, height: props.height || 'auto', maxWidth: '100%' }}
            className="rounded-lg"
          />
        </div>
      );
    },

    ImageCanvas: ({ props, bindings }) => {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const [layers] = useBoundProp<any[]>(props.layers, bindings?.layers);
      const currentLayers = layers ?? props.layers ?? [];
      const w = props.width || 512;
      const h = props.height || 512;

      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);

        const drawLayers = async () => {
          for (const layer of currentLayers) {
            ctx.save();
            if (layer.x || layer.y) ctx.translate(layer.x || 0, layer.y || 0);
            if (layer.rotation) {
              const cx = (layer.width || 0) / 2;
              const cy = (layer.height || 0) / 2;
              ctx.translate(cx, cy);
              ctx.rotate((layer.rotation * Math.PI) / 180);
              ctx.translate(-cx, -cy);
            }
            if (layer.opacity !== undefined) ctx.globalAlpha = layer.opacity;

            switch (layer.type) {
              case 'image': {
                if (layer.src) {
                  try {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    await new Promise<void>((resolve, reject) => {
                      img.onload = () => resolve();
                      img.onerror = reject;
                      img.src = layer.src;
                    });
                    ctx.drawImage(
                      img,
                      0,
                      0,
                      layer.width || img.naturalWidth,
                      layer.height || img.naturalHeight
                    );
                  } catch {
                    /* skip broken images */
                  }
                }
                break;
              }
              case 'text': {
                ctx.font = `${layer.fontSize || 16}px ${layer.fontFamily || 'Manrope, sans-serif'}`;
                if (layer.fill) ctx.fillStyle = layer.fill;
                if (layer.stroke) {
                  ctx.strokeStyle = layer.stroke;
                  ctx.lineWidth = layer.strokeWidth || 1;
                  ctx.strokeText(layer.text || '', 0, layer.fontSize || 16);
                }
                ctx.fillText(layer.text || '', 0, layer.fontSize || 16);
                break;
              }
              case 'rect': {
                if (layer.fill) {
                  ctx.fillStyle = layer.fill;
                  ctx.fillRect(0, 0, layer.width || 100, layer.height || 100);
                }
                if (layer.stroke) {
                  ctx.strokeStyle = layer.stroke;
                  ctx.lineWidth = layer.strokeWidth || 1;
                  ctx.strokeRect(0, 0, layer.width || 100, layer.height || 100);
                }
                break;
              }
              case 'circle': {
                const r = layer.radius || 50;
                ctx.beginPath();
                ctx.arc(r, r, r, 0, Math.PI * 2);
                if (layer.fill) {
                  ctx.fillStyle = layer.fill;
                  ctx.fill();
                }
                if (layer.stroke) {
                  ctx.strokeStyle = layer.stroke;
                  ctx.lineWidth = layer.strokeWidth || 1;
                  ctx.stroke();
                }
                break;
              }
            }
            ctx.restore();
          }
        };
        drawLayers();
      }, [w, h, JSON.stringify(currentLayers)]);

      return (
        <div className="relative rounded-lg overflow-hidden bg-neutral-900">
          <canvas ref={canvasRef} className="w-full h-auto" style={{ maxWidth: w }} />
        </div>
      );
    },

    HalftonePreview: ({ props, bindings }) => {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const [dotSize] = useBoundProp<number>(props.dotSize, bindings?.dotSize);
      const [angle] = useBoundProp<number>(props.angle, bindings?.angle);
      const [contrast] = useBoundProp<number>(props.contrast, bindings?.contrast);
      const [spacing] = useBoundProp<number>(props.spacing, bindings?.spacing);
      const [loading, setLoading] = useState(false);
      const w = props.width || 512;
      const h = props.height || 512;

      useEffect(() => {
        if (!props.imageUrl) return;
        let cancelled = false;
        setLoading(true);
        (async () => {
          try {
            const { applyShaderEffect } = await import('@/utils/shaders/shaderRenderer');
            const result = await applyShaderEffect(props.imageUrl, w, h, {
              shaderType: 'halftone',
              halftoneVariant: (props.variant as any) || 'ellipse',
              dotSize: dotSize ?? props.dotSize ?? 5,
              angle: angle ?? props.angle ?? 0,
              contrast: contrast ?? props.contrast ?? 1,
              spacing: spacing ?? props.spacing ?? 2,
              halftoneThreshold: props.threshold ?? 1,
              halftoneInvert: props.invert ? 1 : 0,
            });
            if (!cancelled && canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                const img = new Image();
                img.onload = () => {
                  canvasRef.current!.width = img.naturalWidth;
                  canvasRef.current!.height = img.naturalHeight;
                  ctx.drawImage(img, 0, 0);
                  setLoading(false);
                };
                img.src = result;
              }
            }
          } catch (e) {
            console.error('[HalftonePreview]', e);
            if (!cancelled) setLoading(false);
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [
        props.imageUrl,
        props.variant,
        dotSize,
        angle,
        contrast,
        spacing,
        props.threshold,
        props.invert,
      ]);

      if (!props.imageUrl) {
        return (
          <div
            className="rounded-lg bg-neutral-900 flex items-center justify-center"
            style={{ width: w, height: h }}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Upload an image for halftone
            </span>
          </div>
        );
      }

      return (
        <div className="relative rounded-lg overflow-hidden bg-neutral-900">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80 z-10">
              <GlitchLoader size="sm" />
            </div>
          )}
          <canvas ref={canvasRef} className="w-full h-auto" style={{ maxWidth: w }} />
        </div>
      );
    },

    RisoPreview: ({ props, bindings }) => {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const [color1] = useBoundProp<string>(props.color1, bindings?.color1);
      const [color2] = useBoundProp<string>(props.color2, bindings?.color2);
      const [loading, setLoading] = useState(false);
      const w = props.width || 512;
      const h = props.height || 512;

      const hexToRgb = (hex: string): [number, number, number] => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b];
      };

      useEffect(() => {
        if (!props.imageUrl) return;
        let cancelled = false;
        setLoading(true);
        (async () => {
          try {
            const { applyShaderEffect } = await import('@/utils/shaders/shaderRenderer');
            const c1 = color1 ?? props.color1 ?? '#e63946';
            const c2 = color2 ?? props.color2 ?? '#1d3557';
            const result = await applyShaderEffect(props.imageUrl, w, h, {
              shaderType: 'duotone',
              duotoneShadowColor: hexToRgb(c1),
              duotoneHighlightColor: hexToRgb(c2),
              duotoneIntensity: 1,
              duotoneContrast: 1.2,
            });
            if (!cancelled && canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                const img = new Image();
                img.onload = () => {
                  canvasRef.current!.width = img.naturalWidth;
                  canvasRef.current!.height = img.naturalHeight;
                  ctx.drawImage(img, 0, 0);
                  setLoading(false);
                };
                img.src = result;
              }
            }
          } catch (e) {
            console.error('[RisoPreview]', e);
            if (!cancelled) setLoading(false);
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [props.imageUrl, color1, color2, props.halftoneAngle1, props.dotSize]);

      if (!props.imageUrl) {
        return (
          <div
            className="rounded-lg bg-neutral-900 flex items-center justify-center"
            style={{ width: w, height: h }}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Upload an image for riso effect
            </span>
          </div>
        );
      }

      return (
        <div className="relative rounded-lg overflow-hidden bg-neutral-900">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80 z-10">
              <GlitchLoader size="sm" />
            </div>
          )}
          <canvas ref={canvasRef} className="w-full h-auto" style={{ maxWidth: w }} />
        </div>
      );
    },

    MoodboardGrid: ({ props }) => {
      const layout = props.layout || 'grid';
      const cols = props.columns || 3;
      const gap = props.gap ?? 4;

      const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        if (img.dataset.retried) return;
        img.dataset.retried = '1';
        img.crossOrigin = '';
        img.src = `/api/images/proxy?url=${encodeURIComponent(img.src)}`;
      };

      const renderImg = (img: { src: string; alt?: string }, cls: string) => (
        <img
          src={img.src}
          alt={img.alt || ''}
          className={cls}
          crossOrigin="anonymous"
          onError={handleImgError}
        />
      );

      if (layout === 'bento') {
        return (
          <div
            className="grid auto-rows-[200px]"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: `${gap * 4}px` }}
          >
            {props.images.map((img, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden bg-neutral-800"
                style={{ gridColumn: img.span ? `span ${img.span}` : undefined }}
              >
                {renderImg(img, 'w-full h-full object-cover')}
              </div>
            ))}
          </div>
        );
      }

      if (layout === 'masonry') {
        return (
          <div style={{ columnCount: cols, columnGap: `${gap * 4}px` }}>
            {props.images.map((img, i) => (
              <div
                key={i}
                className="mb-4 rounded-lg overflow-hidden bg-neutral-800 break-inside-avoid"
              >
                {renderImg(img, 'w-full h-auto')}
              </div>
            ))}
          </div>
        );
      }

      return (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: `${gap * 4}px`,
            aspectRatio: props.aspectRatio || 'auto',
          }}
        >
          {props.images.map((img, i) => (
            <div key={i} className="rounded-lg overflow-hidden bg-neutral-800 aspect-square">
              {renderImg(img, 'w-full h-full object-cover')}
            </div>
          ))}
        </div>
      );
    },

    // ─── Text ─────────────────────────────────────────
    Heading: ({ props }) => {
      const level = props.level ?? 2;
      const cls = 'font-semibold text-neutral-100';
      const style = props.style as React.CSSProperties | undefined;
      if (level === 1)
        return (
          <h1 className={cls} style={style}>
            {props.text}
          </h1>
        );
      if (level === 3)
        return (
          <h3 className={cls} style={style}>
            {props.text}
          </h3>
        );
      if (level === 4)
        return (
          <h4 className={cls} style={style}>
            {props.text}
          </h4>
        );
      return (
        <h2 className={cls} style={style}>
          {props.text}
        </h2>
      );
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
        <span
          className={cn(styles[props.variant ?? 'body'], colors[props.color ?? 'default'])}
          style={props.style as React.CSSProperties | undefined}
        >
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
    generateVideo: async (params) => {
      const result = await playgroundFetch('/video/generate', params as Record<string, unknown>);
      toast.success('Video generated!');
      return result;
    },
    applyShader: async (params) => {
      try {
        const { applyShaderEffect } = await import('@/utils/shaders/shaderRenderer');
        const shaderParams = (params as any)?.params || {};
        const resultBase64 = await applyShaderEffect(
          (params as any)?.imageUrl,
          undefined,
          undefined,
          { shaderType: (params as any)?.shaderType, ...shaderParams }
        );
        toast.success('Shader applied!');
        return resultBase64 as any;
      } catch (e: any) {
        toast.error(`Shader failed: ${e.message}`);
        throw e;
      }
    },
    detectGrid: async (params) => {
      return playgroundFetch('/moodboard/detect-grid', params as Record<string, unknown>);
    },
    upscaleImage: async (params) => {
      const result = await playgroundFetch('/moodboard/upscale', params as Record<string, unknown>);
      toast.success('Image upscaled!');
      return result;
    },
  },
});
