import React, { useState, useCallback, useEffect, useRef, Suspense, useMemo } from 'react';
import { Renderer, StateProvider, ActionProvider, VisibilityProvider, useStateStore } from '@json-render/react';
import type { Spec } from '@json-render/react';
import { registry, handlers as createHandlers } from '@/lib/playground/registry';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import { Tooltip } from '@/components/ui/Tooltip';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  Code2,
  Eye,
  Save,
  Settings,
  GripVertical,
  Download,
  AlertTriangle,
  FileCode,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  MessageSquare,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  generateMiniApp,
  iterateMiniApp,
  saveMiniApp,
  updateMiniApp,
  getMiniApp,
  getMyMiniApps,
  deleteMiniApp,
  getBrandContext,
  publishMiniApp,
  shareMiniApp,
  type GenerateEvent,
  type MiniAppSummary,
} from '@/services/playgroundApi';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { ejectSpec, SANDPACK_DEPS } from '@/lib/playground/eject';
import { capturePreviewThumbnail } from '@/lib/playground/thumbnail';
import { useLayout } from '@/hooks/useLayout';
import { relativeTime } from '@/utils/time';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { Select } from '@/components/ui/select';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { ChatInput } from '@/components/shared/chat/ChatInput';
import { CHAT_MODELS } from '@/constants/geminiModels';
import { usePasteImage } from '@/hooks/usePasteImage';
import { fileToBase64 } from '@/utils/fileUtils';
import { ImageIcon, FileText, RefreshCw, Globe, Link2, Check } from 'lucide-react';
import { MarkdownRenderer } from '@/utils/markdownRenderer';

const SandpackPreview = React.lazy(() =>
  import('@codesandbox/sandpack-react').then((m) => ({
    default: ({ files }: { files: Record<string, string> }) => {
      const sandpackFiles: Record<string, string> = {};
      for (const [path, content] of Object.entries(files)) {
        sandpackFiles[path] = content;
      }
      return (
        <m.SandpackProvider
          template="react-ts"
          files={sandpackFiles}
          customSetup={{ dependencies: SANDPACK_DEPS }}
          theme="dark"
        >
          <m.SandpackLayout
            style={{ height: '100%', border: 'none', borderRadius: 0, background: 'transparent' }}
          >
            <m.SandpackFileExplorer style={{ height: '100%' }} />
            <m.SandpackCodeEditor style={{ height: '100%' }} showLineNumbers showTabs />
            <m.SandpackPreview style={{ height: '100%' }} showOpenInCodeSandbox={false} />
          </m.SandpackLayout>
        </m.SandpackProvider>
      );
    },
  }))
);

const SUGGESTIONS = [
  {
    label: 'Brand Color Palette',
    prompt: 'A tool to extract and display color palette from any image, with export options',
    description: 'Extract colors from any image with export options',
  },
  {
    label: 'Mockup Machine',
    prompt:
      'A mockup generator where I select scene types and generate product mockups from my brand',
    description: 'Generate product mockups from your brand',
  },
  {
    label: 'Naming Generator',
    prompt:
      'A brand naming brainstorm tool with context input, style selector, and multiple suggestions',
    description: 'Brainstorm brand names with style controls',
  },
  {
    label: 'Social Post Creator',
    prompt:
      'A social media post template creator with size presets, text overlay, and image generation',
    description: 'Create social media posts with templates',
  },
  {
    label: 'Compliance Checker',
    prompt: 'Upload a design and check it against brand guidelines for compliance scoring',
    description: 'Check designs against brand guidelines',
  },
  {
    label: 'Logo Tester',
    prompt: 'A tool to test my logo across different mockup scenarios side by side',
    description: 'Test your logo across mockup scenarios',
  },
  {
    label: 'Typography Pairing',
    prompt:
      'A typography pairing lab where I pick two Google Fonts, preview heading + body combinations at different sizes, adjust weight and line-height with sliders, see light and dark previews side by side, and copy the CSS snippet',
    description: 'Test font pairings with live preview and CSS export',
  },
  {
    label: 'Brand Scorecard',
    prompt:
      'A brand audit scorecard dashboard that loads my brand guideline and shows completeness metrics for colors, typography, voice, imagery, and logos as a pie chart, plus a bar chart of asset counts per category, with a compliance score metric card and tips for improvement in a collapsible section',
    description: 'Audit your brand guideline completeness with charts',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const FADE_INITIAL = { opacity: 0, y: 8 } as const;
const FADE_ANIMATE = { opacity: 1, y: 0 } as const;
const FADE_EXIT = { opacity: 0, y: -8 } as const;
const FADE_TRANSITION = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const };

// ─── Error Boundary ─────────────────────────────────────────────────────
class RendererErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-neutral-500">
          <AlertTriangle className="w-6 h-6 text-amber-500/60" />
          <p className="text-[11px] font-mono">Render error — try regenerating</p>
          <p className="text-[10px] text-neutral-600 max-w-sm text-center">
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Inner renderer (needs StateProvider context) ───────────────────────
const PlaygroundRenderer: React.FC<{ spec: Spec }> = ({ spec }) => {
  const navigate = useNavigate();
  const stateCtx = useStateStore();

  const setStateAdapter = React.useCallback(
    (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
      const next = updater(stateCtx.getSnapshot() as Record<string, unknown>);
      Object.entries(next).forEach(([k, v]) => stateCtx.set(k, v));
    },
    [stateCtx]
  );

  const actionHandlers = React.useMemo(
    () =>
      createHandlers(
        () => setStateAdapter,
        () => stateCtx.state
      ),
    [setStateAdapter, stateCtx.state]
  );

  return (
    <ActionProvider handlers={actionHandlers} navigate={(path) => navigate(path)}>
      <VisibilityProvider>
        <Renderer spec={spec} registry={registry} />
      </VisibilityProvider>
    </ActionProvider>
  );
};

// ─── Spec JSON Editor ───────────────────────────────────────────────────
const SpecEditor: React.FC<{ spec: Spec; onUpdate: (s: Spec) => void }> = ({ spec, onUpdate }) => {
  const [text, setText] = useState(JSON.stringify(spec, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(spec, null, 2));
  }, [spec]);

  const handleChange = (value: string) => {
    setText(value);
    try {
      const parsed = JSON.parse(value);
      if (parsed.root && parsed.elements) {
        setError(null);
        onUpdate(parsed as Spec);
      } else {
        setError('Missing "root" or "elements"');
      }
    } catch {
      setError('Invalid JSON');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {error && (
        <div className="shrink-0 px-3 py-1.5 text-[10px] font-mono text-amber-400 bg-amber-500/5 border-b border-amber-500/10">
          {error}
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        className="flex-1 w-full p-4 text-[11px] font-mono text-neutral-400 bg-transparent resize-none focus:outline-none leading-relaxed"
        spellCheck={false}
      />
    </div>
  );
};

// ─── Export spec as downloadable JSON ────────────────────────────────────
function downloadSpec(spec: Spec, title: string) {
  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.miniapp.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sidebar skeleton ───────────────────────────────────────────────────
const SidebarSkeleton: React.FC = () => (
  <div className="space-y-1 px-1">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex items-center gap-2 px-3 py-2">
        <SkeletonLoader width="100%" height="14px" className="animate-pulse rounded" />
      </div>
    ))}
  </div>
);

// ─── Shared extracted components ────────────────────────────────────────
const SuggestionPills: React.FC<{
  suggestions: typeof SUGGESTIONS;
  count?: number;
  size?: 'sm' | 'md';
  onSelect: (prompt: string) => void;
}> = ({ suggestions, count, size = 'md', onSelect }) => {
  const items = count ? suggestions.slice(0, count) : suggestions;
  const cls = size === 'sm'
    ? 'px-2 py-1 text-[10px] border-neutral-800/60 text-neutral-600 hover:border-neutral-700 hover:text-neutral-300'
    : 'px-3 py-1.5 text-[12px] border-neutral-800/60 text-neutral-500 hover:border-neutral-600 hover:text-neutral-200 hover:bg-white/[0.02]';
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((s) => (
        <Tooltip key={s.label} content={s.description} position="bottom" delay={400}>
          <button
            onClick={() => onSelect(s.prompt)}
            className={cn('rounded-full border transition-all duration-150', cls)}
          >
            {s.label}
          </button>
        </Tooltip>
      ))}
    </div>
  );
};

type ChatMsg = { role: 'user' | 'assistant'; content: string };

const ChatMessages: React.FC<{
  messages: ChatMsg[];
  isGenerating: boolean;
  statusMessage: string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onRetry?: (prompt: string) => void;
  className?: string;
}> = ({ messages, isGenerating, statusMessage, chatEndRef, onRetry, className }) => (
  <div className={className}>
    {messages.map((msg, i) => (
      <div
        key={i}
        className={cn(
          'text-[12px] leading-relaxed',
          msg.role === 'user' ? 'text-neutral-400' : 'text-brand-cyan/70'
        )}
      >
        <span className="font-mono text-neutral-700 mr-1.5 select-none">
          {msg.role === 'user' ? '›' : '◆'}
        </span>
        {msg.role === 'assistant' ? (
          <span className="prose-xs">
            <MarkdownRenderer content={msg.content} />
          </span>
        ) : (
          msg.content
        )}
      </div>
    ))}
    {!isGenerating && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content?.includes('failed') && onRetry && (
      <button
        onClick={() => {
          const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
          if (lastUserMsg) onRetry(lastUserMsg.content);
        }}
        className="flex items-center gap-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors mt-1"
      >
        <RefreshCw size={10} />
        Retry
      </button>
    )}
    {isGenerating && (
      <PremiumGlitchLoader steps={statusMessage ? [statusMessage] : undefined} />
    )}
    <div ref={chatEndRef} />
  </div>
);

const GeneratingState: React.FC<{ message: string; elapsed?: number }> = ({ message, elapsed }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center space-y-6">
      <PremiumGlitchLoader />
      <div className="space-y-1">
        {message && (
          <p className="text-[11px] text-neutral-600 font-mono">{message}</p>
        )}
        {elapsed != null && elapsed > 0 && (
          <p className="text-[10px] text-neutral-700 font-mono">{elapsed}s</p>
        )}
      </div>
    </div>
  </div>
);

// ─── View Tabs ──────────────────────────────────────────────────────────
type ViewTab = 'preview' | 'spec' | 'code';

// ─── Main Page ──────────────────────────────────────────────────────────
export const PlaygroundPage: React.FC = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const isMobile = useIsMobile();
  const { user } = useLayout();

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [spec, setSpec] = useState<Spec | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [miniAppId, setMiniAppId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const { data: brandGuidelines = [] } = useBrandGuidelines();
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [expertMode, setExpertMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem('playground-model') || CHAT_MODELS[0]
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('preview');
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [genStartTime, setGenStartTime] = useState<number | null>(null);
  const [genElapsed, setGenElapsed] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);

  const {
    data: myMiniApps = [],
    isLoading: loadingMiniApps,
    refetch: refetchMiniApps,
  } = useQuery({
    queryKey: ['playground-my-miniapps'],
    queryFn: () => getMyMiniApps().then((r) => r.miniApps),
    staleTime: 30_000,
  });

  const greeting = useMemo(() => {
    const base = getGreeting();
    const firstName = user?.name?.split(' ')[0];
    return firstName ? `${base}, ${firstName}` : base;
  }, [user?.name]);

  // Image paste handler
  usePasteImage(
    useCallback((img) => {
      if (img.file) {
        setAttachedFiles((prev) => [...prev, img.file!]);
      }
    }, []),
    !isGenerating
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setAttachedFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  }, []);

  const removeAttachedFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Sidebar resize drag handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = Math.min(480, Math.max(220, startWidth + (ev.clientX - startX)));
      setSidebarWidth(newWidth);
    };
    const onUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const handleTouchResizeStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    isDraggingRef.current = true;
    const startX = touch.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const t = ev.touches[0];
      if (!t) return;
      const newWidth = Math.min(480, Math.max(220, startWidth + (t.clientX - startX)));
      setSidebarWidth(newWidth);
    };
    const onEnd = () => {
      isDraggingRef.current = false;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, [sidebarWidth]);

  // Persist model choice
  useEffect(() => {
    localStorage.setItem('playground-model', selectedModel);
  }, [selectedModel]);

  // Generation timer
  useEffect(() => {
    if (!genStartTime) { setGenElapsed(0); return; }
    const id = setInterval(() => setGenElapsed(Math.floor((Date.now() - genStartTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [genStartTime]);

  // Drag-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (files.length) setAttachedFiles((prev) => [...prev, ...files]);
  }, []);

  // Auto-focus input on empty state
  useEffect(() => {
    if (!spec && !isGenerating) {
      const timer = setTimeout(() => (document.querySelector('[data-playground-input] textarea') as HTMLElement)?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [spec, isGenerating]);

  // Load existing miniapp from slug
  useEffect(() => {
    if (!slug) return;
    getMiniApp(slug)
      .then(({ miniApp }) => {
        setSpec(miniApp.spec as unknown as Spec);
        setMeta({
          title: miniApp.title,
          description: miniApp.description,
          tags: miniApp.tags,
          category: miniApp.category,
        });
        setMiniAppId(miniApp.id);
        setIsPublished(miniApp.isPublished);
      })
      .catch(() => {
        toast.error('Could not load this miniapp.');
      });
  }, [slug]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleEvent = useCallback((event: GenerateEvent) => {
    if (event.event === 'status') setStatusMessage(event.data.message);
    if (event.event === 'clarification') {
      const { questions, suggestion } = event.data as { questions: string[]; suggestion: string };
      const msg = [
        suggestion,
        ...questions.map((q: string) => `• ${q}`),
      ].filter(Boolean).join('\n');
      setChatHistory((prev) => [...prev, { role: 'assistant', content: msg }]);
    }
  }, []);

  const handleGenerate = useCallback(
    async (inputPrompt?: string) => {
      const finalPrompt = inputPrompt || prompt;
      if (!finalPrompt.trim()) return;

      setIsGenerating(true);
      setStatusMessage('');
      setGenStartTime(Date.now());
      const currentFiles = [...attachedFiles];
      setAttachedFiles([]);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'user',
          content: currentFiles.length
            ? `${finalPrompt} [${currentFiles.length} file${currentFiles.length > 1 ? 's' : ''} attached]`
            : finalPrompt,
        },
      ]);
      setPrompt('');

      try {
        let brandContext: string | undefined;
        if (selectedBrandId) {
          try {
            const bc = await getBrandContext(selectedBrandId);
            brandContext = bc.context;
          } catch {
            // continue without brand context
          }
        }

        // Convert attached files to base64 for the API
        const imageAttachments: string[] = [];
        for (const file of currentFiles) {
          try {
            const { base64 } = await fileToBase64(file);
            imageAttachments.push(base64);
          } catch {
            // skip failed conversions
          }
        }

        const isIteration = spec !== null;
        const opts = {
          brandContext,
          model: selectedModel,
          ...(imageAttachments.length && { images: imageAttachments }),
        };
        const result = isIteration
          ? await iterateMiniApp(
              finalPrompt,
              spec as unknown as Record<string, unknown>,
              opts,
              handleEvent
            )
          : await generateMiniApp(finalPrompt, opts, handleEvent);

        if (result) {
          const newSpec = result.spec as unknown as Spec;
          const newMeta = result.meta;
          setSpec(newSpec);
          setMeta(newMeta);
          setActiveTab('preview');
          if (!isMobile) setSidebarOpen(true);
          const title = (newMeta?.title as string) || 'Untitled MiniApp';
          setChatHistory((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: isIteration ? `Updated: ${title}` : `Created: ${title}`,
            },
          ]);

          // Auto-save to DB
          try {
            if (!isIteration) {
              const saved = await saveMiniApp({
                title,
                description: (newMeta.description as string) || '',
                tags: (newMeta.tags as string[]) || [],
                category: (newMeta.category as string) || 'utility',
                spec: result.spec,
                actionsUsed: (newMeta.actionsUsed as string[]) || [],
              });
              setMiniAppId(saved.miniApp.id);
              refetchMiniApps();
              navigate(`/playground/${saved.miniApp.slug}`, { replace: true });
            } else if (miniAppId) {
              await updateMiniApp(miniAppId, {
                spec: result.spec,
                title,
                description: (newMeta.description as string) || '',
                tags: (newMeta.tags as string[]) || [],
                category: (newMeta.category as string) || 'utility',
                actionsUsed: (newMeta.actionsUsed as string[]) || [],
              } as any);
              refetchMiniApps();
            }
          } catch (saveErr: any) {
            console.error('[playground] auto-save failed:', saveErr);
            toast.error('Failed to auto-save — use ⌘S to save manually');
          }
        }
      } catch (err: any) {
        const msg = err?.message || 'Something went wrong.';
        setChatHistory((prev) => [...prev, { role: 'assistant', content: msg }]);
        toast.error(msg);
      } finally {
        setIsGenerating(false);
        setStatusMessage('');
        setGenStartTime(null);
      }
    },
    [prompt, spec, miniAppId, handleEvent, selectedModel, selectedBrandId, isMobile, navigate, refetchMiniApps]
  );

  const handleReset = useCallback(() => {
    setSpec(null);
    setMeta({});
    setMiniAppId(null);
    setChatHistory([]);
    setPrompt('');
    setActiveTab('preview');
  }, []);

  const handleDeleteMiniApp = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteMiniApp(id);
        refetchMiniApps();
        if (miniAppId === id) handleReset();
        toast.success('Deleted');
      } catch {
        toast.error('Failed to delete');
      }
    },
    [miniAppId, refetchMiniApps, handleReset]
  );

  const handleLoadMiniApp = useCallback(
    (app: MiniAppSummary) => {
      navigate(`/playground/${app.slug}`);
      if (isMobile) setSidebarOpen(false);
    },
    [navigate, isMobile]
  );

  const handleNewSession = useCallback(() => {
    navigate('/playground');
    handleReset();
    if (isMobile) setSidebarOpen(false);
  }, [navigate, handleReset, isMobile]);

  const handleSave = useCallback(async () => {
    if (!spec) return;
    try {
      let thumbnail: string | undefined;
      if (previewRef.current && activeTab === 'preview') {
        const url = await capturePreviewThumbnail(previewRef.current);
        if (url) thumbnail = url;
      }

      const result = await saveMiniApp({
        title: (meta.title as string) || 'Untitled MiniApp',
        description: (meta.description as string) || '',
        tags: (meta.tags as string[]) || [],
        category: (meta.category as string) || 'utility',
        spec: spec as unknown as Record<string, unknown>,
        actionsUsed: (meta.actionsUsed as string[]) || [],
        thumbnail,
      });
      setMiniAppId(result.miniApp.id);
      refetchMiniApps();
      toast.success(thumbnail ? 'Saved with thumbnail!' : 'Saved!');
    } catch {
      toast.error('Failed to save');
    }
  }, [spec, meta, activeTab, refetchMiniApps]);

  const handlePublish = useCallback(async () => {
    if (!miniAppId) return;
    try {
      await publishMiniApp(miniAppId);
      setIsPublished(true);
      toast.success('Published to community!');
    } catch {
      toast.error('Failed to publish');
    }
  }, [miniAppId]);

  const handleShare = useCallback(async () => {
    if (!miniAppId) return;
    try {
      const { shareUrl } = await shareMiniApp(miniAppId);
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      toast.success('Share link copied!');
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      toast.error('Failed to generate share link');
    }
  }, [miniAppId]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'n') { e.preventDefault(); handleNewSession(); return; }
      if (mod && e.key === 'k') { e.preventDefault(); (document.querySelector('[data-playground-input] textarea') as HTMLElement)?.focus(); return; }
      if (mod && e.key === 's') { e.preventDefault(); if (spec) handleSave(); return; }
      if (e.key === 'Escape' && isFullscreen) { setIsFullscreen(false); return; }
      if (e.key === 'f' && !mod && spec && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') { setIsFullscreen((v) => !v); return; }
      if (e.key === 'Escape' && isMobile && sidebarOpen) { setSidebarOpen(false); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNewSession, handleSave, spec, isMobile, sidebarOpen]);

  const isEmpty = !spec && !isGenerating;
  const appTitle = (meta.title as string) || '';

  // ─── Shared Input Bar ─────────────────────────────────────────────────
  const attachedFilesChips = attachedFiles.length > 0 && (
    <div className="flex flex-wrap gap-1.5 px-1 pb-1">
      {attachedFiles.map((file, i) => (
        <div
          key={`${file.name}-${i}`}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-neutral-400 group/chip"
        >
          {file.type.startsWith('image/') ? (
            <ImageIcon size={12} className="text-brand-cyan/60" />
          ) : (
            <FileText size={12} className="text-neutral-500" />
          )}
          <span className="truncate max-w-[100px]">{file.name}</span>
          <button
            onClick={() => removeAttachedFile(i)}
            className="opacity-0 group-hover/chip:opacity-100 transition-opacity text-neutral-500 hover:text-red-400"
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );

  const inputBar = (
    <div data-playground-input>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      {attachedFilesChips}
      <ChatInput
        value={prompt}
        onChange={setPrompt}
        onSend={() => handleGenerate()}
        isLoading={isGenerating}
        placeholder={spec ? 'Describe a change...' : 'Describe your mini-app...'}
        selectedModel={selectedModel}
        onModelChange={(m) => setSelectedModel(m)}
        showModelSelector
        modelSelectorType="chat"
        showAttach
        onAttachClick={() => fileInputRef.current?.click()}
        minHeight={36}
        maxHeight={120}
      />
    </div>
  );

  // ─── Preview renderer ─────────────────────────────────────────────────
  const renderPreview = (
    <RendererErrorBoundary key={JSON.stringify(spec).slice(0, 100)}>
      <div ref={previewRef} className="h-full">
        <StateProvider initialState={(spec as any)?.stateDefaults ?? undefined}>
          <PlaygroundRenderer spec={spec!} />
        </StateProvider>
      </div>
    </RendererErrorBoundary>
  );

  // ─── Sidebar Content ──────────────────────────────────────────────────
  const sidebarContent = (
    <div className="h-full flex flex-col bg-neutral-950/80">
      {/* New + Brand selector row */}
      <div className="shrink-0 p-3 space-y-2">
        <Tooltip content={<span>New miniapp <kbd className="ml-1 text-[9px] opacity-60">⌘N</kbd></span>} position="right">
          <button
            onClick={handleNewSession}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-neutral-300 hover:bg-white/5 hover:text-neutral-100 transition-colors"
          >
            <Plus size={14} className="opacity-50" />
            <span>New miniapp</span>
          </button>
        </Tooltip>

        {/* Brand context selector inside sidebar */}
        <div className="group/brand relative">
          <Select
            options={(brandGuidelines as any[]).map((brand: any) => ({
              value: brand.id,
              label: brand.identity?.name || brand.id,
              icon: <BrandAvatar brand={brand} size={14} rounded="sm" />,
            }))}
            value={selectedBrandId}
            onChange={setSelectedBrandId}
            placeholder="Brand context"
            className="text-xs"
            variant="node"
          />
          {selectedBrandId && (
            <button
              onClick={() => setSelectedBrandId('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover/brand:opacity-100 transition-opacity bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 z-10"
              title="Disconnect brand"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Recent list — always visible */}
      <div className={cn(
        'overflow-y-auto px-2 scrollbar-thin scrollbar-thumb-neutral-800',
        spec ? 'max-h-[35%] shrink-0 border-b border-neutral-800/30 pb-2' : 'flex-1 pb-3'
      )}>
        <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-600">
          Recent
        </div>
        {loadingMiniApps ? (
          <SidebarSkeleton />
        ) : myMiniApps.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-[11px] text-neutral-600">No miniapps yet</p>
          </div>
        ) : (
          <div className="space-y-px">
            {myMiniApps.map((app) => (
              <div
                key={app.id}
                onClick={() => handleLoadMiniApp(app)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors group cursor-pointer',
                  miniAppId === app.id
                    ? 'bg-white/8 text-neutral-100'
                    : 'text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200'
                )}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="truncate flex-1" title={app.title}>
                    {app.title}
                  </span>
                  <button
                    onClick={(e) => handleDeleteMiniApp(app.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded shrink-0"
                    aria-label="Delete"
                  >
                    <Trash2 size={11} className="text-neutral-600 hover:text-red-400" />
                  </button>
                </div>
                {app.updatedAt && (
                  <span className="text-[10px] text-neutral-600 mt-0.5 block">
                    {relativeTime(app.updatedAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {spec ? (
        <>
          {/* Chat panel below recent when editing */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 scrollbar-thin scrollbar-thumb-neutral-800">
            <ChatMessages
              messages={chatHistory}
              isGenerating={isGenerating}
              statusMessage={statusMessage}
              chatEndRef={chatEndRef}
              onRetry={handleGenerate}
              className="space-y-1"
            />
          </div>
          <div className="shrink-0 border-t border-neutral-800/30 p-3 pb-4">
            {inputBar}
          </div>
        </>
      ) : (
        <div className="shrink-0 p-3 pb-4 border-t border-neutral-800/30">
          <div className="space-y-1 text-[10px] text-neutral-700">
            <div className="flex justify-between"><span>Focus input</span><kbd className="font-mono">⌘K</kbd></div>
            <div className="flex justify-between"><span>Save</span><kbd className="font-mono">⌘S</kbd></div>
          </div>
        </div>
      )}
    </div>
  );

  // Resizable sidebar with drag handle (desktop) or overlay (mobile)
  const resizableSidebar = isMobile ? (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 w-72 transition-transform duration-200 ease-in-out',
        !sidebarOpen && '-translate-x-full'
      )}
    >
      {sidebarContent}
    </aside>
  ) : sidebarOpen ? (
    <>
      <aside
        className="shrink-0 border-r border-neutral-800/50 overflow-hidden"
        style={{ width: sidebarWidth }}
      >
        {sidebarContent}
      </aside>
      <div
        onMouseDown={handleResizeStart}
        onTouchStart={handleTouchResizeStart}
        className="group shrink-0 w-1.5 cursor-col-resize flex items-center justify-center hover:bg-neutral-800/30 transition-colors"
      >
        <GripVertical className="w-3 h-3 text-neutral-800 group-hover:text-neutral-600 transition-colors" />
      </div>
    </>
  ) : null;

  // =====================================================================
  // FULLSCREEN OVERLAY
  // =====================================================================
  if (isFullscreen && spec) {
    return (
      <div className="fixed inset-0 z-50 bg-neutral-950">
        <div className="absolute top-3 right-3 z-10">
          <Tooltip content={<span>Exit fullscreen <kbd className="ml-1 text-[9px] opacity-60">Esc</kbd></span>} position="bottom">
            <Button
              variant="surface"
              size="xs"
              onClick={() => setIsFullscreen(false)}
              className="gap-1.5 text-neutral-400 hover:text-neutral-200"
            >
              <Minimize2 className="w-3 h-3" />
              <span className="text-[10px]">Exit</span>
            </Button>
          </Tooltip>
        </div>
        <div className="h-full w-full overflow-auto">
          {renderPreview}
        </div>
      </div>
    );
  }

  // =====================================================================
  // SIMPLE MODE — clean, centered, Apple-like
  // =====================================================================
  if (!expertMode) {
    const topBar = (
      <div className="shrink-0 flex items-center h-12 px-4 border-b border-neutral-800/30">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 -ml-1.5 rounded-md text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>
        {appTitle && (
          <span className="ml-3 text-[13px] text-neutral-300 truncate">{appTitle}</span>
        )}
        <div className="flex-1" />
        {spec && (
          <div className="flex items-center gap-1">
            <Tooltip content="Reset" position="bottom">
              <Button variant="ghost" size="xs" onClick={handleReset} className="text-neutral-500 hover:text-neutral-300">
                <RotateCcw className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Export JSON" position="bottom">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => downloadSpec(spec, appTitle || 'miniapp')}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <Download className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content={<span>Save <kbd className="ml-1 text-[9px] opacity-60">⌘S</kbd></span>} position="bottom">
              <Button variant="ghost" size="xs" onClick={handleSave} className="text-neutral-500 hover:text-neutral-300">
                <Save className="w-3 h-3" />
              </Button>
            </Tooltip>
            {miniAppId && (
              <>
                <Tooltip content={copiedShare ? 'Copied!' : 'Copy share link'} position="bottom">
                  <Button variant="ghost" size="xs" onClick={handleShare} className="text-neutral-500 hover:text-neutral-300">
                    {copiedShare ? <Check className="w-3 h-3 text-green-400" /> : <Link2 className="w-3 h-3" />}
                  </Button>
                </Tooltip>
                {!isPublished && (
                  <Tooltip content="Publish to community" position="bottom">
                    <Button variant="ghost" size="xs" onClick={handlePublish} className="text-neutral-500 hover:text-brand-cyan">
                      <Globe className="w-3 h-3" />
                    </Button>
                  </Tooltip>
                )}
                {isPublished && (
                  <span className="text-[9px] font-mono text-green-500/60 px-1">Published</span>
                )}
              </>
            )}
            <Tooltip content={<span>Fullscreen <kbd className="ml-1 text-[9px] opacity-60">F</kbd></span>} position="bottom">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsFullscreen(true)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
            </Tooltip>
            <div className="w-px h-4 bg-neutral-800 mx-1" />
            <Tooltip content="Expert mode" position="bottom">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => { setExpertMode(true); setActiveTab('preview'); }}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <Settings className="w-3 h-3" />
              </Button>
            </Tooltip>
          </div>
        )}
      </div>
    );

    const mainContent = (
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {isEmpty ? (
            <motion.div
              key="empty"
              initial={FADE_INITIAL} animate={FADE_ANIMATE} exit={FADE_EXIT} transition={FADE_TRANSITION}
              className="h-full flex flex-col items-center justify-center px-6"
            >
              <div className="max-w-lg w-full space-y-8">
                <div className="text-center space-y-2">
                  <h1 className="text-2xl font-semibold text-neutral-100 tracking-tight">
                    {greeting}
                  </h1>
                  <p className="text-[13px] text-neutral-500">
                    What would you like to build?
                  </p>
                </div>
                <GlassPanel className="p-3">
                  {inputBar}
                </GlassPanel>
                <SuggestionPills suggestions={SUGGESTIONS} onSelect={handleGenerate} />
                <div className="text-center">
                  <button
                    onClick={() => navigate('/playground/explore')}
                    className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors"
                  >
                    explore community miniapps →
                  </button>
                </div>
              </div>
            </motion.div>
          ) : isGenerating && !spec ? (
            <motion.div
              key="generating"
              initial={FADE_INITIAL} animate={FADE_ANIMATE} exit={FADE_EXIT} transition={FADE_TRANSITION}
              className="h-full"
            >
              <GeneratingState message={statusMessage} elapsed={genElapsed} />
            </motion.div>
          ) : spec ? (
            <motion.div
              key="preview"
              initial={FADE_INITIAL} animate={FADE_ANIMATE} exit={FADE_EXIT} transition={FADE_TRANSITION}
              className="h-full overflow-auto"
            >
              {renderPreview}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {spec && !sidebarOpen && (
          <div className="absolute bottom-4 left-4 z-10">
            <Tooltip content="Open chat panel" position="right">
              <Button
                variant="surface"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="gap-2 text-neutral-400 hover:text-neutral-200"
              >
                <MessageSquare size={14} />
                <span className="text-xs">Chat</span>
              </Button>
            </Tooltip>
          </div>
        )}
      </div>
    );

    return (
      <div
        className="h-[100dvh] w-full flex overflow-hidden bg-neutral-950 pt-10 md:pt-14 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {resizableSidebar}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        )}
        <div className="flex-1 min-w-0 flex flex-col relative">
          {topBar}
          {mainContent}
        </div>

        {/* Drag-drop overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-brand-cyan/5 border-2 border-dashed border-brand-cyan/30 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-2">
              <ImageIcon className="w-8 h-8 text-brand-cyan/50 mx-auto" />
              <p className="text-sm text-brand-cyan/60 font-mono">Drop images here</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =====================================================================
  // EXPERT MODE — IDE-like split layout
  // =====================================================================
  // Expert mode top bar
  const expertTopBar = (
    <div className="shrink-0 flex items-center h-10 px-3 border-b border-neutral-800/30 gap-2">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-1 rounded-md text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
      </button>
      {appTitle && (
        <span className="text-[12px] text-neutral-400 truncate">{appTitle}</span>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        {spec && (
          <>
            <Button variant="ghost" size="xs" onClick={handleReset} className="text-neutral-500">
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => downloadSpec(spec, appTitle || 'miniapp')}
              className="text-neutral-500"
            >
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
            <Button variant="ghost" size="xs" onClick={handleSave} className="text-neutral-500">
              <Save className="w-3 h-3 mr-1" /> Save
            </Button>
            {miniAppId && (
              <>
                <Button variant="ghost" size="xs" onClick={handleShare} className="text-neutral-500">
                  {copiedShare ? <Check className="w-3 h-3 mr-1 text-green-400" /> : <Link2 className="w-3 h-3 mr-1" />}
                  Share
                </Button>
                {!isPublished && (
                  <Button variant="ghost" size="xs" onClick={handlePublish} className="text-neutral-500 hover:text-brand-cyan">
                    <Globe className="w-3 h-3 mr-1" /> Publish
                  </Button>
                )}
              </>
            )}
            <div className="w-px h-4 bg-neutral-800 mx-1" />
          </>
        )}
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setExpertMode(false)}
          className="text-brand-cyan"
        >
          <Eye className="w-3 h-3 mr-1" /> Simple
        </Button>
      </div>
    </div>
  );

  const expertSplitPanels = (
    <div className="flex-1 min-h-0">
      <PanelGroup orientation={isMobile ? 'vertical' : 'horizontal'}>
        {/* Chat panel */}
        <Panel defaultSize={28} minSize={20} maxSize={45}>
          <div className="h-full flex flex-col border-r border-neutral-800/30">
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin scrollbar-thumb-neutral-800">
              {chatHistory.length === 0 && !isGenerating && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <MessageSquare className="w-5 h-5 text-neutral-700" />
                  <p className="text-[11px] text-neutral-600 max-w-[220px]">
                    Describe what you want to build, then iterate with follow-up prompts.
                  </p>
                  <SuggestionPills suggestions={SUGGESTIONS} count={3} size="sm" onSelect={handleGenerate} />
                </div>
              )}
              <ChatMessages
                messages={chatHistory}
                isGenerating={isGenerating}
                statusMessage={statusMessage}
                chatEndRef={chatEndRef}
                onRetry={handleGenerate}
              />
            </div>
            <div className="shrink-0 border-t border-neutral-800/30 p-2.5 pb-4">
              {inputBar}
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="group flex items-center justify-center w-1.5 hover:bg-neutral-800/30 transition-colors">
          <GripVertical className="w-3 h-3 text-neutral-800 group-hover:text-neutral-600 transition-colors" />
        </PanelResizeHandle>

        {/* Preview panel */}
        <Panel defaultSize={72} minSize={40}>
          <div className="h-full flex flex-col">
            {spec && (
              <div className="shrink-0 flex items-center border-b border-neutral-800/30 px-2 h-9">
                {(['preview', 'spec', 'code'] as ViewTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors border-b -mb-px',
                      activeTab === tab
                        ? 'text-neutral-200 border-brand-cyan'
                        : 'text-neutral-600 border-transparent hover:text-neutral-400'
                    )}
                  >
                    {tab === 'preview' && <Eye className="w-3 h-3 inline mr-1" />}
                    {tab === 'spec' && <Code2 className="w-3 h-3 inline mr-1" />}
                    {tab === 'code' && <FileCode className="w-3 h-3 inline mr-1" />}
                    {tab}
                  </button>
                ))}
                <div className="flex-1" />
                <span className="text-[9px] font-mono text-neutral-700">
                  {Object.keys(spec.elements || {}).length} elements
                </span>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-auto">
              <AnimatePresence mode="wait">
                {!spec && !isGenerating ? (
                  <motion.div key="empty-expert" initial={FADE_INITIAL} animate={FADE_ANIMATE} exit={FADE_EXIT} transition={FADE_TRANSITION} className="h-full flex items-center justify-center">
                    <p className="text-[12px] text-neutral-600">
                      Your miniapp preview will appear here
                    </p>
                  </motion.div>
                ) : isGenerating && !spec ? (
                  <motion.div key="generating-expert" initial={FADE_INITIAL} animate={FADE_ANIMATE} exit={FADE_EXIT} transition={FADE_TRANSITION} className="h-full">
                    <GeneratingState message={statusMessage} elapsed={genElapsed} />
                  </motion.div>
                ) : spec ? (
                  <motion.div key={`tab-${activeTab}`} initial={FADE_INITIAL} animate={FADE_ANIMATE} exit={FADE_EXIT} transition={FADE_TRANSITION} className="h-full">
                    {activeTab === 'spec' ? (
                      <SpecEditor spec={spec} onUpdate={setSpec} />
                    ) : activeTab === 'code' ? (
                      <Suspense
                        fallback={
                          <div className="h-full flex items-center justify-center">
                            <GlitchLoader size="md" />
                          </div>
                        }
                      >
                        <SandpackPreview files={ejectSpec(spec, appTitle || 'miniapp')} />
                      </Suspense>
                    ) : (
                      renderPreview
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );

  return (
    <div
      className="h-[100dvh] w-full flex overflow-hidden bg-neutral-950 pt-10 md:pt-14 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {resizableSidebar}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        {expertTopBar}
        {expertSplitPanels}
      </div>

      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-brand-cyan/5 border-2 border-dashed border-brand-cyan/30 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2">
            <ImageIcon className="w-8 h-8 text-brand-cyan/50 mx-auto" />
            <p className="text-sm text-brand-cyan/60 font-mono">Drop images here</p>
          </div>
        </div>
      )}
    </div>
  );
};
