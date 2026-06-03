import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { Renderer, StateProvider, ActionProvider, useStateStore } from '@json-render/react';
import type { Spec } from '@json-render/react';
import { registry, handlers as createHandlers } from '@/lib/playground/registry';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { PageShell } from '@/components/ui/PageShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import {
  Send,
  Zap,
  RotateCcw,
  Code2,
  Eye,
  Save,
  Settings,
  GripVertical,
  Download,
  AlertTriangle,
  FileCode,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  generateMiniApp,
  iterateMiniApp,
  saveMiniApp,
  getMiniApp,
  type GenerateEvent,
} from '@/services/playgroundApi';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { ejectSpec, SANDPACK_DEPS } from '@/lib/playground/eject';
import { capturePreviewThumbnail } from '@/lib/playground/thumbnail';

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
  },
  {
    label: 'Mockup Machine',
    prompt:
      'A mockup generator where I select scene types and generate product mockups from my brand',
  },
  {
    label: 'Naming Generator',
    prompt:
      'A brand naming brainstorm tool with context input, style selector, and multiple suggestions',
  },
  {
    label: 'Social Post Creator',
    prompt:
      'A social media post template creator with size presets, text overlay, and image generation',
  },
  {
    label: 'Compliance Checker',
    prompt: 'Upload a design and check it against brand guidelines for compliance scoring',
  },
  {
    label: 'Logo Tester',
    prompt: 'A tool to test my logo across different mockup scenarios side by side',
  },
];

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
      <Renderer spec={spec} registry={registry} />
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

// ─── View Tabs ──────────────────────────────────────────────────────────
type ViewTab = 'preview' | 'spec' | 'code';

// ─── Main Page ──────────────────────────────────────────────────────────
export const PlaygroundPage: React.FC = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const isMobile = useIsMobile();

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [spec, setSpec] = useState<Spec | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [miniAppId, setMiniAppId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [expertMode, setExpertMode] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('preview');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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
      })
      .catch(() => {
        toast.error(
          'Could not load this miniapp. It may have been deleted or the URL is incorrect.'
        );
      });
  }, [slug]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleEvent = useCallback((event: GenerateEvent) => {
    if (event.event === 'status') setStatusMessage(event.data.message);
  }, []);

  const handleGenerate = useCallback(
    async (inputPrompt?: string) => {
      const finalPrompt = inputPrompt || prompt;
      if (!finalPrompt.trim()) return;

      setIsGenerating(true);
      setStatusMessage('');
      setChatHistory((prev) => [...prev, { role: 'user', content: finalPrompt }]);
      setPrompt('');

      try {
        const isIteration = spec !== null;
        const result = isIteration
          ? await iterateMiniApp(
              finalPrompt,
              spec as unknown as Record<string, unknown>,
              {},
              handleEvent
            )
          : await generateMiniApp(finalPrompt, {}, handleEvent);

        if (result) {
          setSpec(result.spec as unknown as Spec);
          setMeta(result.meta);
          setActiveTab('preview');
          const title = (result.meta?.title as string) || 'Your miniapp';
          setChatHistory((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: isIteration ? `Updated: ${title}` : `Created: ${title}`,
            },
          ]);
        }
      } catch (err: any) {
        const msg = err?.message || 'Something went wrong.';
        setChatHistory((prev) => [...prev, { role: 'assistant', content: msg }]);
        toast.error(msg);
      } finally {
        setIsGenerating(false);
        setStatusMessage('');
      }
    },
    [prompt, spec, handleEvent]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  const handleReset = useCallback(() => {
    setSpec(null);
    setMeta({});
    setMiniAppId(null);
    setChatHistory([]);
    setPrompt('');
    setActiveTab('preview');
  }, []);

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
      toast.success(thumbnail ? 'Saved with thumbnail!' : 'Saved!');
    } catch {
      toast.error('Failed to save');
    }
  }, [spec, meta, activeTab]);

  // ─── Chat Panel (shared between modes) ────────────────────────────────
  const chatPanel = (
    <div className="flex flex-col h-full">
      {/* Chat history */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5 scrollbar-thin scrollbar-thumb-neutral-700">
        {chatHistory.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Zap className="w-6 h-6 text-brand-cyan opacity-40" />
            <p className="text-[11px] text-neutral-500 max-w-[260px]">
              Describe your mini-app and the AI will compose it using the Visant design system.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-[300px]">
              {SUGGESTIONS.slice(0, 4).map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleGenerate(s.prompt)}
                  className="px-2 py-1 text-[10px] rounded-full border border-neutral-800 text-neutral-500 hover:border-brand-cyan/30 hover:text-neutral-300 transition-all"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'text-[11px] leading-relaxed',
              msg.role === 'user' ? 'text-neutral-300' : 'text-brand-cyan/80'
            )}
          >
            <span className="font-mono text-neutral-600 mr-1.5 select-none">
              {msg.role === 'user' ? '>' : '◆'}
            </span>
            {msg.content}
          </div>
        ))}
        {isGenerating && (
          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <GlitchLoader size="sm" />
            <span className="font-mono">{statusMessage || 'Thinking...'}</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-neutral-800/50 p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={spec ? 'Iterate: "change colors to purple"' : 'Describe your mini-app...'}
            rows={1}
            className="flex-1 bg-transparent border-0 text-sm text-neutral-200 placeholder:text-neutral-600 resize-none focus:outline-none min-h-[32px] max-h-[100px]"
            style={{ fieldSizing: 'content' } as any}
            disabled={isGenerating}
          />
          <Button
            variant="brand"
            size="icon-sm"
            onClick={() => handleGenerate()}
            disabled={!prompt.trim() || isGenerating}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex items-center mt-1.5 gap-2">
          <span className="text-[9px] text-neutral-700 font-mono">
            {isMobile ? 'Send' : 'Enter ↵'} to send
          </span>
        </div>
      </div>
    </div>
  );

  // ─── Preview Panel ────────────────────────────────────────────────────
  const previewContent = (
    <div className="h-full flex flex-col">
      {/* Tab bar (expert mode) */}
      {expertMode && spec && (
        <div className="shrink-0 flex items-center border-b border-neutral-800/50 px-2">
          {(['preview', 'spec', 'code'] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors border-b-2 -mb-px',
                activeTab === tab
                  ? 'text-neutral-200 border-brand-cyan'
                  : 'text-neutral-500 border-transparent hover:text-neutral-300'
              )}
            >
              {tab === 'preview' && <Eye className="w-3 h-3 inline mr-1.5" />}
              {tab === 'spec' && <Code2 className="w-3 h-3 inline mr-1.5" />}
              {tab === 'code' && <FileCode className="w-3 h-3 inline mr-1.5" />}
              {tab}
            </button>
          ))}
          <div className="flex-1" />
          {spec && (
            <span className="text-[9px] font-mono text-neutral-600">
              {Object.keys(spec.elements || {}).length} elements
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {!spec && !isGenerating ? (
          // Empty state (only in non-expert single-panel mode)
          !expertMode && (
            <div className="h-full flex flex-col items-center justify-center gap-8 animate-fade-in">
              <div className="text-center space-y-3">
                <Zap className="w-8 h-8 text-brand-cyan mx-auto opacity-60" />
                <h2 className="text-lg font-semibold text-neutral-200">
                  What would you like to build?
                </h2>
                <p className="text-[11px] text-neutral-500 max-w-md">
                  Describe your mini-app and the AI will compose it using the Visant design system
                  and API.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleGenerate(s.prompt)}
                    className="px-3 py-1.5 text-[11px] rounded-full border border-neutral-800 text-neutral-400 hover:border-brand-cyan/40 hover:text-neutral-200 transition-all duration-200"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => navigate('/playground/explore')}
                className="text-[11px] text-neutral-500 hover:text-brand-cyan transition-colors"
              >
                or explore community miniapps →
              </button>
            </div>
          )
        ) : isGenerating && !spec ? (
          <div className="h-full flex items-center justify-center animate-fade-in">
            <div className="text-center space-y-4">
              <GlitchLoader size="lg" />
              <p className="text-[11px] text-neutral-500 font-mono uppercase tracking-widest">
                {statusMessage || 'Composing...'}
              </p>
            </div>
          </div>
        ) : spec ? (
          activeTab === 'spec' ? (
            <SpecEditor spec={spec} onUpdate={setSpec} />
          ) : activeTab === 'code' ? (
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center">
                  <GlitchLoader size="md" />
                </div>
              }
            >
              <SandpackPreview files={ejectSpec(spec, (meta.title as string) || 'miniapp')} />
            </Suspense>
          ) : (
            <RendererErrorBoundary key={JSON.stringify(spec).slice(0, 100)}>
              <div ref={previewRef} className="h-full">
                <StateProvider>
                  <PlaygroundRenderer spec={spec} />
                </StateProvider>
              </div>
            </RendererErrorBoundary>
          )
        ) : null}
      </div>
    </div>
  );

  // ─── Action Bar ───────────────────────────────────────────────────────
  const actionBar = spec && (
    <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-neutral-800/30">
      <Button variant="ghost" size="xs" onClick={handleReset}>
        <RotateCcw className="w-3 h-3 mr-1" /> Reset
      </Button>
      {!expertMode && (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setActiveTab(activeTab === 'spec' ? 'preview' : 'spec')}
        >
          {activeTab === 'spec' ? (
            <Eye className="w-3 h-3 mr-1" />
          ) : (
            <Code2 className="w-3 h-3 mr-1" />
          )}
          {activeTab === 'spec' ? 'Preview' : 'Spec'}
        </Button>
      )}
      <Button
        variant="ghost"
        size="xs"
        onClick={() => downloadSpec(spec, (meta.title as string) || 'miniapp')}
      >
        <Download className="w-3 h-3 mr-1" /> Export
      </Button>
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          setExpertMode(!expertMode);
          if (!expertMode) setActiveTab('preview');
        }}
        className={cn(expertMode && 'text-brand-cyan')}
      >
        <Settings className="w-3 h-3 mr-1" /> {expertMode ? 'Simple' : 'Expert'}
      </Button>
      <Button variant="surface" size="xs" onClick={handleSave}>
        <Save className="w-3 h-3 mr-1" /> Save
      </Button>
    </div>
  );

  // ─── Layout ───────────────────────────────────────────────────────────
  return (
    <PageShell pageId="playground" title="Playground">
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {expertMode && spec ? (
          // Expert: resizable split layout
          <div className="flex-1 min-h-0">
            <PanelGroup orientation={isMobile ? 'vertical' : 'horizontal'}>
              <Panel defaultSize={30} minSize={20} maxSize={50}>
                <GlassPanel className="h-full">{chatPanel}</GlassPanel>
              </Panel>
              <PanelResizeHandle className="group flex items-center justify-center w-2 hover:bg-neutral-800/30 transition-colors">
                <GripVertical className="w-3 h-3 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
              </PanelResizeHandle>
              <Panel defaultSize={70} minSize={40}>
                <div className="h-full rounded-lg border border-neutral-800/50 bg-neutral-950/50 overflow-hidden">
                  {previewContent}
                </div>
              </Panel>
            </PanelGroup>
          </div>
        ) : (
          // Normal: stacked layout
          <div className="flex-1 min-h-0">
            {spec ? (
              <div className="h-full rounded-lg border border-neutral-800/50 bg-neutral-950/50 overflow-hidden">
                {previewContent}
              </div>
            ) : (
              previewContent
            )}
          </div>
        )}

        {actionBar}

        {/* Chat input (normal mode only — in expert mode, chat is in the left panel) */}
        {!expertMode && (
          <div className="shrink-0 mt-2">
            <GlassPanel className="p-2.5">
              {chatHistory.length > 0 && (
                <div className="mb-2 max-h-24 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-neutral-700">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        'text-[11px]',
                        msg.role === 'user' ? 'text-neutral-300' : 'text-brand-cyan/80'
                      )}
                    >
                      <span className="font-mono text-neutral-600 mr-1.5">
                        {msg.role === 'user' ? '>' : '◆'}
                      </span>
                      {msg.content}
                    </div>
                  ))}
                  {isGenerating && (
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                      <GlitchLoader size="sm" />
                      <span className="font-mono">{statusMessage || 'Thinking...'}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    spec ? 'Iterate: "add dark mode toggle"' : 'Describe your mini-app...'
                  }
                  rows={1}
                  className="flex-1 bg-transparent border-0 text-sm text-neutral-200 placeholder:text-neutral-600 resize-none focus:outline-none min-h-[32px] max-h-[100px]"
                  style={{ fieldSizing: 'content' } as any}
                  disabled={isGenerating}
                />
                <Button
                  variant="brand"
                  size="icon-sm"
                  onClick={() => handleGenerate()}
                  disabled={!prompt.trim() || isGenerating}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </GlassPanel>
          </div>
        )}
      </div>
    </PageShell>
  );
};
