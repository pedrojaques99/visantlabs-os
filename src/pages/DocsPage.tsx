import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Book, Server, Puzzle, Terminal, Code, Sparkles, Layers, Workflow, Copy, Check, FileText, Bot, Coins } from 'lucide-react';
import { SEO } from '../components/SEO';
import { BreadcrumbWithBack } from '../components/ui/BreadcrumbWithBack';
import {
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
import { Tabs, TabsContent } from '../components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { NavigationSidebar } from '../components/ui/NavigationSidebar';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { cn } from '../lib/utils';

// Modular docs imports
import {
  useDocsData,
  DOCS_NAVIGATION_ITEMS,
  buildNavigationWithMcpTools,
  generateTabMarkdown,
  PLATFORM_MCP_TOOLS,
  CREDIT_COSTS,
  CREDIT_PACKAGES,
} from './docs/index';

export const DocsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>(undefined);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('docs-sidebar-width');
      return saved ? parseInt(saved, 10) : 256;
    }
    return 256;
  });
  const [copied, setCopied] = useState(false);

  // Use modular data hook
  const {
    openApiSpec,
    mcpSpec,
    loading,
    authEndpoints,
    mockupEndpoints,
    pluginEndpoints,
    mcpToolNames,
  } = useDocsData();

  // Build navigation with dynamic MCP tools
  const navigationItems = useMemo(
    () => buildNavigationWithMcpTools(mcpToolNames),
    [mcpToolNames]
  );

  // Use modular markdown generator
  const getMarkdown = useCallback(
    (tab: string) => generateTabMarkdown(tab as any, mcpSpec, openApiSpec),
    [mcpSpec, openApiSpec]
  );

  const markCopied = useCallback(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback for non-https contexts
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    markCopied();
  }, [markCopied]);

  const handleCopyMarkdown = useCallback(async () => {
    const md = getMarkdown(activeTab);
    await copyToClipboard(md);
  }, [activeTab, getMarkdown, copyToClipboard]);

  const handleNavigationClick = (itemId: string, sectionId?: string) => {
    setActiveTab(itemId);
    setTimeout(() => {
      if (sectionId) {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        const contentArea = document.querySelector('.h-screen.overflow-y-auto');
        if (contentArea) {
          contentArea.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }, 100);
  };

  // Setup intersection observer for scrolling tracking (similar to DesignSystemPage)
  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'plugin') {
      setActiveSectionId(undefined);
      return;
    }

    const contentArea = document.querySelector('.h-screen.overflow-y-auto');
    if (!contentArea) return;

    const currentItem = navigationItems.find(item => item.id === activeTab);
    if (!currentItem?.sections) {
      setActiveSectionId(undefined);
      return;
    }

    const sectionIds = currentItem.sections.map(s => s.id);
    const observers: IntersectionObserver[] = [];
    const sectionVisibility = new Map<string, number>();

    const updateActiveSection = () => {
      let bestSection: string | null = null;
      let bestScore = 0;

      sectionVisibility.forEach((score, sectionId) => {
        if (score > bestScore) {
          bestScore = score;
          bestSection = sectionId;
        }
      });

      if (bestSection && bestScore > 0.1) {
        setActiveSectionId(bestSection);
      }
    };

    sectionIds.forEach((sectionId) => {
      const element = document.getElementById(sectionId);
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.rootBounds) {
              const ratio = entry.intersectionRatio;
              const boundingRect = entry.boundingClientRect;
              const rootRect = entry.rootBounds;
              const elementTop = boundingRect.top - rootRect.top;
              const viewportHeight = rootRect.height;
              const positionScore = Math.max(0, 1 - (elementTop / (viewportHeight * 0.6)));
              const score = ratio * positionScore;
              sectionVisibility.set(sectionId, score);
            } else {
              sectionVisibility.delete(sectionId);
            }
          });
          updateActiveSection();
        },
        {
          root: contentArea,
          rootMargin: '-100px 0px -50% 0px',
          threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => {
      observers.forEach(observer => observer.disconnect());
      sectionVisibility.clear();
    };
  }, [activeTab, navigationItems]);

  const renderMethodBadge = (method: string) => {
    let className = 'bg-neutral-800 text-neutral-300';
    if (method === 'GET') className = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (method === 'POST') className = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    if (method === 'PUT') className = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (method === 'DELETE') className = 'bg-red-500/10 text-red-500 border-red-500/20';

    return (
      <Badge variant="outline" className={cn("font-redhatmono uppercase", className)}>
        {method}
      </Badge>
    );
  };

  const renderEndpoints = (endpoints: any[], idPrefix: string, title: string) => {
    if (endpoints.length === 0) return null;

    return (
      <Card id={idPrefix} className="border-none bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-2xl border-b border-border pb-2 mb-4">{title} Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="px-0 space-y-6">
          {endpoints.map((ep, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-6 hover:border-brand-cyan/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                {renderMethodBadge(ep.method)}
                <span className="font-redhatmono text-lg text-foreground font-medium">{ep.path}</span>
              </div>
              <p className="text-muted-foreground mb-4">{ep.summary}</p>
              {ep.description && <p className="text-neutral-400 mb-6 text-sm">{ep.description}</p>}

              {ep.parameters && ep.parameters.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Parameters</h4>
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-secondary/50">
                        <tr>
                          <th className="px-4 py-3 font-medium text-foreground">Name</th>
                          <th className="px-4 py-3 font-medium text-foreground">Type</th>
                          <th className="px-4 py-3 font-medium text-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {ep.parameters.map((p: any, idx: number) => (
                          <tr key={idx} className="bg-card">
                            <td className="px-4 py-3 font-redhatmono text-brand-cyan">{p.name}</td>
                            <td className="px-4 py-3">
                              <span className="bg-secondary px-2 py-1 rounded text-xs font-redhatmono text-muted-foreground">
                                {p.schema?.type || 'string'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{p.schema?.description || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <SEO
        title="Documentation - Visant Copilot"
        description="API and Plugin documentation for Visant Copilot"
        keywords="documentation, API, MCP, Figma plugin, developers"
      />

      <div className="bg-background text-foreground relative min-h-screen">
        <div className="fixed inset-0 z-0">
          
        </div>

        <div className="flex relative z-10">
          <NavigationSidebar
            items={navigationItems}
            activeItemId={activeTab}
            activeSectionId={activeSectionId}
            onItemClick={handleNavigationClick}
            title="Documentation"
            isOpen={sidebarOpen}
            onToggleOpen={setSidebarOpen}
            width={sidebarWidth}
            onWidthChange={(w) => {
              setSidebarWidth(w);
              localStorage.setItem('docs-sidebar-width', w.toString());
            }}
            storageKey="docs-sidebar-width"
          />

          <div
            className="flex-1 min-w-0 pt-10 md:pt-12 transition-all duration-300 lg:ml-[var(--sidebar-width)]"
            style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
          >
            <div className="h-screen overflow-y-auto">
              <div className="max-w-5xl mx-auto px-4 pt-[30px] pb-16 md:pb-24">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <BreadcrumbWithBack to="/">
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link to="/">Home</Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Documentation</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </BreadcrumbWithBack>

                  <Button variant="brand"
                    onClick={handleCopyMarkdown}
                    title="Copy this section as clean Markdown — ideal for pasting into LLM contexts"
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-redhatmono transition-all duration-200 shrink-0",
                      copied
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500"
                        : "bg-secondary/60 border-border text-muted-foreground hover:border-brand-cyan/50 hover:text-brand-cyan hover:bg-brand-cyan/5"
                    )}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy as Markdown'}
                  </Button>
                </div>

                {activeTab === 'overview' && (
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                      <Book className="h-8 w-8 text-brand-cyan" />
                      <div>
                        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                          Visant Copilot Docs
                        </h1>
                        <p className="text-muted-foreground text-sm md:text-base mt-1">
                          Complete API, MCP, and Plugin documentation for the Visant design platform.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Agent-first hint bar */}
                <div className="mb-6 flex items-start gap-3 bg-brand-cyan/5 border border-brand-cyan/20 rounded-md px-4 py-3">
                  <FileText className="w-4 h-4 text-brand-cyan mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="text-brand-cyan font-medium">LLM / Agent tip —</span>{' '}
                    use the <span className="font-medium text-foreground">Copy as Markdown</span> button above to get the current section as clean, structured markdown.
                    Paste it directly into your agent's context window or system prompt for accurate API usage.
                  </p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsContent value="overview" className="space-y-6 bg-transparent mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="cursor-pointer hover:border-brand-cyan/50 transition-all hover:-translate-y-1" onClick={() => setActiveTab('api')}>
                        <CardHeader>
                          <Server className="w-8 h-8 text-brand-cyan mb-2" />
                          <CardTitle>REST API</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground text-sm">HTTP API endpoints for authentication, mockups, and more.</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:border-brand-cyan/50 transition-all hover:-translate-y-1" onClick={() => setActiveTab('mcp')}>
                        <CardHeader>
                          <Terminal className="w-8 h-8 text-brand-cyan mb-2" />
                          <CardTitle>MCP Tools</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground text-sm">Model Context Protocol tools for Claude and agent integration.</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:border-brand-cyan/50 transition-all hover:-translate-y-1" onClick={() => setActiveTab('plugin')}>
                        <CardHeader>
                          <Puzzle className="w-8 h-8 text-brand-cyan mb-2" />
                          <CardTitle>Figma Plugin</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground text-sm">Design automation and mockup generation inside Figma.</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:border-brand-cyan/50 transition-all hover:-translate-y-1" onClick={() => setActiveTab('agents')}>
                        <CardHeader>
                          <Bot className="w-8 h-8 text-brand-cyan mb-2" />
                          <CardTitle>For Agents</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground text-sm">Connect AI agents via MCP, API keys, llms.txt discovery, and clean HTML.</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:border-brand-cyan/50 transition-all hover:-translate-y-1" onClick={() => setActiveTab('brand-guidelines')}>
                        <CardHeader>
                          <Sparkles className="w-8 h-8 text-brand-cyan mb-2" />
                          <CardTitle>Brand Guidelines</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground text-sm">Centralized brand identity vaults with automated context extraction for AI agents.</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:border-brand-cyan/50 transition-all hover:-translate-y-1" onClick={() => setActiveTab('canvas-api')}>
                        <CardHeader>
                          <Workflow className="w-8 h-8 text-brand-cyan mb-2" />
                          <CardTitle>Canvas API</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground text-sm">Programmatically create, edit, and manipulate canvas nodes and projects — for LLM agents and external tools.</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:border-brand-cyan/50 transition-all hover:-translate-y-1" onClick={() => setActiveTab('pricing')}>
                        <CardHeader>
                          <Coins className="w-8 h-8 text-brand-cyan mb-2" />
                          <CardTitle>Pricing & Credits</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground text-sm">Transparent pricing based on official Google API costs. See what you can create with each credit package.</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="mt-8">
                      <CardHeader>
                        <CardTitle>Getting Started with API</CardTitle>
                        <CardDescription>How to authenticate and make requests to Visant Copilot.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium mb-2">1. Authentication</h3>
                          <p className="text-muted-foreground mb-3 font-sm">All API requests require authentication via JWT token or API key in the Authorization header.</p>
                          <div className="bg-secondary/50 rounded-md p-4 border border-border space-y-2">
                            <div className="text-xs font-redhatmono text-muted-foreground mb-2 uppercase tracking-wide">HTTP Header</div>
                            <code className="text-brand-cyan font-redhatmono text-sm block">Authorization: Bearer YOUR_JWT_TOKEN</code>
                            <code className="text-brand-cyan font-redhatmono text-sm block">Authorization: Bearer visant_sk_xxxxxxxxxxxx</code>
                          </div>
                          <p className="text-muted-foreground text-xs mt-2">For agents, create an API key from <a href="/settings/api-keys" className="text-brand-cyan hover:underline">Settings → API Keys</a>. See the <Button variant="ghost" onClick={() => setActiveTab('agents')} className="text-brand-cyan hover:underline">For Agents</Button> tab for details.</p>
                        </div>

                        <div>
                          <h3 className="text-lg font-medium mb-2">2. Response Format</h3>
                          <p className="text-muted-foreground mb-3 font-sm">All responses are in JSON. Success returns a 200 or 201 code with <code className="bg-secondary px-1 py-0.5 rounded text-xs">{`{ "success": true, "data": ... }`}</code>.</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="api" className="space-y-10 mt-0">
                    <div>
                      <h2 className="text-3xl font-semibold tracking-tight mb-2">REST API Reference</h2>
                      <p className="text-muted-foreground">Complete documentation for the Visant Copilot HTTP endpoints.</p>
                    </div>

                    {loading ? (
                      <div className="space-y-4">
                        <SkeletonLoader className="w-full h-32 rounded-xl" />
                        <SkeletonLoader className="w-full h-32 rounded-xl" />
                      </div>
                    ) : (
                      <div className="space-y-12">
                        {renderEndpoints(authEndpoints, 'api-auth', 'Authentication')}
                        {renderEndpoints(mockupEndpoints, 'api-mockups', 'Mockups')}
                        {renderEndpoints(pluginEndpoints, 'api-plugin', 'Plugin')}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="mcp" className="space-y-8 mt-0">
                    <div>
                      <h2 className="text-3xl font-semibold tracking-tight mb-2">MCP Tools</h2>
                      <p className="text-muted-foreground">Integrate Visant Labs directly into AI agents via the Model Context Protocol. Two servers available: <strong>Platform MCP</strong> (HTTP/SSE) for mockups, canvas, branding, and <strong>Figma MCP</strong> (stdio) for direct Figma manipulation.</p>
                    </div>

                    {/* Overview */}
                    <Card id="mcp-overview" className="border border-border bg-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5 text-brand-cyan" /> Two MCP Servers</CardTitle>
                        <CardDescription>Choose the server that fits your use case. You can use both simultaneously.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-secondary/40 border border-border rounded-md p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs">HTTP/SSE</Badge>
                              <span className="font-semibold text-foreground text-sm">Platform MCP</span>
                            </div>
                            <p className="text-muted-foreground text-xs mb-3">Generate mockups, manage canvas projects, branding, budgets, and AI tools — all via your API key over SSE.</p>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>Endpoint: <code className="font-redhatmono bg-secondary px-1 rounded">/api/mcp</code></p>
                              <p>Auth: <code className="font-redhatmono bg-secondary px-1 rounded">Bearer visant_sk_xxx</code></p>
                              <p>19 tools available</p>
                            </div>
                          </div>
                          <div className="bg-secondary/40 border border-border rounded-md p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs">stdio</Badge>
                              <span className="font-semibold text-foreground text-sm">Figma MCP</span>
                            </div>
                            <p className="text-muted-foreground text-xs mb-3">Create frames, rectangles, text, and send AI commands directly to the Figma plugin sandbox via WebSocket bridge.</p>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>Command: <code className="font-redhatmono bg-secondary px-1 rounded">npm run mcp:figma</code></p>
                              <p>Requires: Figma plugin connected</p>
                              <p>9 tools available</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Setup & Connection */}
                    <Card id="mcp-setup" className="border border-border bg-card">
                      <CardHeader>
                        <CardTitle>Setup & Connection</CardTitle>
                        <CardDescription>Configuration examples for popular AI clients.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Claude Desktop</h4>
                          <p className="text-muted-foreground text-sm mb-2">Add to your <code className="font-redhatmono bg-secondary px-1 rounded">claude_desktop_config.json</code>:</p>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Platform MCP (SSE)</div>
                            <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{
  "mcpServers": {
    "visant-platform": {
      "url": "https://your-domain.com/api/mcp",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer visant_sk_xxxxxxxxxxxx"
      }
    }
  }
}`}</pre>
                          </div>
                        </div>

                        <div>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Figma MCP (stdio)</div>
                            <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{
  "mcpServers": {
    "visant-figma": {
      "command": "npx",
      "args": ["-y", "visant-figma-mcp"],
      "env": {
        "VISANT_API_URL": "https://your-domain.com"
      }
    }
  }
}`}</pre>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Cursor / VS Code</h4>
                          <p className="text-muted-foreground text-sm mb-2">Add to your <code className="font-redhatmono bg-secondary px-1 rounded">.cursor/mcp.json</code> or workspace settings:</p>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">mcp.json</div>
                            <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{
  "mcpServers": {
    "visant-platform": {
      "url": "https://your-domain.com/api/mcp",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer visant_sk_xxxxxxxxxxxx"
      }
    }
  }
}`}</pre>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Custom Agent (TypeScript)</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">@modelcontextprotocol/sdk</div>
                            <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("https://your-domain.com/api/mcp"),
  {
    requestInit: {
      headers: {
        Authorization: "Bearer visant_sk_xxxxxxxxxxxx"
      }
    }
  }
);

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);

// List available tools
const { tools } = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: "mockup-generate",
  arguments: {
    prompt: "A smartphone mockup on a marble desk",
    model: "gemini-2.5-flash"
  }
});`}</pre>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Authentication */}
                    <Card id="mcp-auth" className="border border-border bg-card">
                      <CardHeader>
                        <CardTitle>Authentication</CardTitle>
                        <CardDescription>API keys are required for the Platform MCP server. The Figma MCP server authenticates through the plugin connection.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="bg-secondary/60 border border-border rounded-md p-4 font-redhatmono text-sm space-y-2">
                          <p className="text-muted-foreground"># Pass your API key in every request</p>
                          <p className="text-foreground">Authorization: Bearer visant_sk_xxxxxxxxxxxx</p>
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>1. Go to <a href="/settings/api-keys" className="text-brand-cyan hover:underline">Settings &rarr; API Keys</a> and create a new key</p>
                          <p>2. Select scopes: <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs mx-1">read</Badge> <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs mx-1">write</Badge> <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs mx-1">generate</Badge></p>
                          <p>3. Copy the key immediately &mdash; it is shown only once</p>
                          <p>4. Store it securely (environment variable or secrets manager)</p>
                        </div>
                        <div className="bg-secondary/30 rounded-md border border-border p-4">
                          <p className="text-xs text-muted-foreground">Every tool response includes a <code className="font-redhatmono bg-secondary px-1 rounded">_meta</code> field with your remaining credits, so your agent can track usage automatically.</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Figma MCP Tools */}
                    <div id="mcp-figma-tools">
                      <h3 className="text-2xl font-semibold tracking-tight mb-2">Figma MCP &mdash; Tool Reference</h3>
                      <p className="text-muted-foreground mb-6 text-sm">9 tools for direct Figma manipulation via the plugin bridge. Requires the Visant Copilot Figma plugin to be running and connected.</p>
                    </div>

                    {loading ? (
                      <SkeletonLoader className="w-full h-64 rounded-xl" />
                    ) : (
                      <div className="space-y-8">
                        {mcpSpec?.tools.map((tool, idx) => (
                          <Card key={idx} id={`tool-${tool.name}`} className="border border-border bg-card overflow-hidden">
                            <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4">
                              <div className="flex items-center gap-3">
                                <Code className="w-5 h-5 text-brand-cyan" />
                                <h3 className="text-xl font-redhatmono font-semibold text-brand-cyan m-0">{tool.name}</h3>
                              </div>
                              <p className="text-muted-foreground mt-2">{tool.description}</p>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                              <div>
                                <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Input Schema</h4>
                                <div className="border border-border rounded-md overflow-hidden">
                                  <table className="w-full text-sm text-left">
                                    <thead className="bg-secondary/50">
                                      <tr>
                                        <th className="px-4 py-3 font-medium text-foreground">Name</th>
                                        <th className="px-4 py-3 font-medium text-foreground">Type</th>
                                        <th className="px-4 py-3 font-medium text-foreground">Required</th>
                                        <th className="px-4 py-3 font-medium text-foreground">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {Object.entries(tool.inputSchema?.properties || {}).map(([name, prop]: [string, any], pIdx) => (
                                        <tr key={pIdx} className="bg-card">
                                          <td className="px-4 py-3 font-redhatmono text-brand-cyan">{name}</td>
                                          <td className="px-4 py-3">
                                            <span className="bg-secondary px-2 py-1 rounded text-xs font-redhatmono text-muted-foreground">
                                              {prop.type || 'string'}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
                                            {tool.inputSchema.required?.includes(name) ? (
                                              <span className="text-destructive text-xs font-semibold uppercase ">Yes</span>
                                            ) : (
                                              <span className="text-muted-foreground text-xs uppercase ">No</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-muted-foreground">{prop.description || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {tool.examples && tool.examples.length > 0 && (
                                <div>
                                  <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Example</h4>
                                  <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                                    <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">
                                      Input JSON
                                    </div>
                                    <div className="p-4 overflow-x-auto">
                                      <pre className="text-sm font-redhatmono text-foreground m-0">
                                        {JSON.stringify(tool.examples[0].input, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="plugin" className="space-y-6 mt-0">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-3xl">Figma Plugin Guide</CardTitle>
                        <CardDescription>Using Visant Copilot directly inside Figma to supercharge your design workflow.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5 text-brand-cyan" /> Capabilities</h3>
                          <ul className="space-y-2 list-none">
                            <li className="flex items-start gap-3">
                              <span className="bg-secondary text-brand-cyan p-1 rounded mt-0.5"><Puzzle className="w-4 h-4" /></span>
                              <div>
                                <strong className="block text-foreground border-none">Make mockups easily</strong>
                                <span className="text-muted-foreground text-sm">Select frames and instantaneously convert them to 3D device mockups.</span>
                              </div>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="bg-secondary text-brand-cyan p-1 rounded mt-0.5"><Terminal className="w-4 h-4" /></span>
                              <div>
                                <strong className="block text-foreground border-none">Chat with AI</strong>
                                <span className="text-muted-foreground text-sm">Tell the AI what you want to build and watch the Figma nodes create themselves.</span>
                              </div>
                            </li>
                          </ul>
                        </div>

                        <Separator />

                        <div>
                          <h3 className="text-lg font-medium mb-3">Installation</h3>
                          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                            <li>Open any file in Figma.</li>
                            <li>Go to <strong>Resources {'>'} Plugins</strong>.</li>
                            <li>Search for <strong>Visant Copilot</strong> and click Run.</li>
                            <li>Follow the on-screen prompts to connect your account.</li>
                          </ol>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="figma-nodes" className="space-y-8 mt-0">
                    <div>
                      <h2 className="text-3xl font-semibold tracking-tight mb-2">Figma Node JSON Spec</h2>
                      <p className="text-muted-foreground">Data-driven pattern for creating Figma nodes via Plugin API. Define layouts in JSON, execute in the plugin sandbox.</p>
                    </div>

                    {/* Overview */}
                    <Card id="fn-overview">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5 text-brand-cyan" /> How It Works</CardTitle>
                        <CardDescription>The Plugin API is imperative (JavaScript), not declarative. This JSON spec is parsed and executed by a renderer utility.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="bg-secondary/30 rounded-md border border-border p-4">
                          <pre className="text-sm font-redhatmono text-foreground m-0">{`JSON spec  →  buildNode(spec, parent)  →  Figma nodes

1. Define the layout tree in JSON (NodeSpec)
2. collectFonts() — gather all fonts used in the tree
3. figma.loadFontAsync() — load each font (required before text edits)
4. buildNode() — recursively create all nodes`}</pre>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                          {[
                            { type: 'FRAME', desc: 'Container with auto-layout, padding, fills', supports: 'children' },
                            { type: 'RECTANGLE', desc: 'Solid or gradient-filled box', supports: 'fills, effects' },
                            { type: 'ELLIPSE', desc: 'Circle or oval shape', supports: 'fills, strokes' },
                            { type: 'TEXT', desc: 'Text with full typography control', supports: 'font, spacing' },
                          ].map(n => (
                            <div key={n.type} className="bg-card border border-border rounded-md p-3">
                              <code className="text-brand-cyan font-redhatmono font-semibold text-sm">{n.type}</code>
                              <p className="text-muted-foreground text-xs mt-1">{n.desc}</p>
                              <p className="text-muted-foreground/60 text-xs mt-1 font-redhatmono">{n.supports}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* NodeSpec Reference */}
                    <Card id="fn-nodespec">
                      <CardHeader>
                        <CardTitle>NodeSpec — Full Property Reference</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="border border-border rounded-md overflow-hidden">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/50">
                              <tr>
                                <th className="px-4 py-3 font-medium text-foreground w-44">Property</th>
                                <th className="px-4 py-3 font-medium text-foreground w-36">Type</th>
                                <th className="px-4 py-3 font-medium text-foreground">Values / Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {[
                                ['type', 'string', "'FRAME' | 'RECTANGLE' | 'ELLIPSE' | 'TEXT' — required"],
                                ['name', 'string', 'Layer name — required'],
                                ['width / height', 'number', 'Geometry. Applied via resize() internally.'],
                                ['fills', 'FillSpec[]', 'Array of solid or gradient fills. Empty array = transparent.'],
                                ['strokes', 'FillSpec[]', 'Stroke paints (same format as fills)'],
                                ['strokeWeight', 'number', 'Stroke width in pixels'],
                                ['cornerRadius', 'number', 'Rounded corners in pixels'],
                                ['opacity', 'number', '0–1'],
                                ['effects', 'EffectSpec[]', 'DROP_SHADOW, INNER_SHADOW, LAYER_BLUR, BACKGROUND_BLUR'],
                                ['layoutMode', 'string', "'NONE' | 'HORIZONTAL' | 'VERTICAL' — FRAME only"],
                                ['primaryAxisAlignItems', 'string', "'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN'"],
                                ['counterAxisAlignItems', 'string', "'MIN' | 'MAX' | 'CENTER' | 'BASELINE'"],
                                ['paddingTop/Bottom/Left/Right', 'number', 'Inner spacing — auto-layout frames only'],
                                ['itemSpacing', 'number', 'Gap between children in auto-layout'],
                                ['layoutSizingHorizontal', 'string', "'FIXED' | 'FILL' | 'HUG' — set AFTER appendChild"],
                                ['layoutSizingVertical', 'string', "'FIXED' | 'FILL' | 'HUG' — set AFTER appendChild"],
                                ['clipsContent', 'boolean', 'Clip children outside frame bounds'],
                                ['characters', 'string', 'Text content — TEXT only'],
                                ['fontSize', 'number', 'Font size in px — TEXT only'],
                                ['fontName', 'object', '{ family: string, style: string } — must be loaded first'],
                                ['textAlignHorizontal', 'string', "'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'"],
                                ['letterSpacing', 'object', "{ unit: 'PERCENT' | 'PIXELS', value: number }"],
                                ['lineHeight', 'object', "{ unit: 'AUTO' | 'PERCENT' | 'PIXELS', value?: number }"],
                                ['children', 'NodeSpec[]', 'Nested nodes — FRAME only'],
                              ].map(([prop, type, notes]) => (
                                <tr key={prop} className="bg-card">
                                  <td className="px-4 py-2.5 font-redhatmono text-brand-cyan text-xs">{prop}</td>
                                  <td className="px-4 py-2.5">
                                    <span className="bg-secondary px-2 py-0.5 rounded text-xs font-redhatmono text-muted-foreground">{type}</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{notes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Fill & Effect Types */}
                    <Card id="fn-fills">
                      <CardHeader>
                        <CardTitle>Fill & Effect Types</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-2">Solid Fill</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">JSON</div>
                            <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{ "type": "SOLID", "color": { "r": 0.98, "g": 0.35, "b": 0.35 }, "opacity": 1 }`}</pre>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-2">Linear Gradient</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">JSON</div>
                            <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{
  "type": "GRADIENT_LINEAR",
  "gradientTransform": [[0.7, 0.7, -0.1], [-0.7, 0.7, 0.7]],
  "gradientStops": [
    { "color": { "r": 0.06, "g": 0.09, "b": 0.22, "a": 1 }, "position": 0 },
    { "color": { "r": 0.40, "g": 0.06, "b": 0.20, "a": 1 }, "position": 1 }
  ]
}`}</pre>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-2">Inner Shadow Effect</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">JSON</div>
                            <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{
  "type": "INNER_SHADOW",
  "color": { "r": 0, "g": 0, "b": 0, "a": 0.5 },
  "offset": { "x": 0, "y": -40 },
  "radius": 80,
  "spread": 0,
  "visible": true,
  "blendMode": "NORMAL"
}`}</pre>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Critical Rules */}
                    <Card id="fn-rules">
                      <CardHeader>
                        <CardTitle>Critical Rules</CardTitle>
                        <CardDescription>These mistakes will silently fail or produce wrong results.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="border border-border rounded-md overflow-hidden">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/50">
                              <tr>
                                <th className="px-4 py-3 font-medium text-foreground w-48">Rule</th>
                                <th className="px-4 py-3 font-medium text-foreground">Detail</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {[
                                ['Colors are 0–1 floats', '{ r: 1, g: 0, b: 0 } = red. Never use 0–255 integers.'],
                                ['Use resize(), not width=', 'width and height are read-only on all nodes. Call node.resize(w, h).'],
                                ['Load fonts before text edits', 'figma.loadFontAsync({ family, style }) must complete before setting characters, fontSize, fontName, etc.'],
                                ['appendChild before layoutSizing', 'layoutSizingHorizontal/Vertical only works after the node is a child of an auto-layout frame.'],
                                ['fontName.style must be exact', "{ family: 'Inter', style: 'SemiBold' } — not 'Semi Bold'. Check Figma's font list."],
                                ['lineHeight AUTO has no value', "{ unit: 'AUTO' } — omit the value field entirely."],
                                ['FILL requires auto-layout parent', "layoutSizingHorizontal: 'FILL' only works if the parent frame has layoutMode set."],
                                ['Empty fills = transparent', "fills: [] removes all fills. Don't omit the field if you want transparency."],
                              ].map(([rule, detail]) => (
                                <tr key={rule} className="bg-card">
                                  <td className="px-4 py-3 font-redhatmono text-brand-cyan text-xs font-semibold">{rule}</td>
                                  <td className="px-4 py-3 text-muted-foreground text-sm">{detail}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Renderer */}
                    <Card id="fn-renderer">
                      <CardHeader>
                        <CardTitle>Renderer — render.ts</CardTitle>
                        <CardDescription>Plugin-side utility that converts a NodeSpec tree into Figma nodes.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[
                            { fn: 'collectFonts(spec, fonts)', desc: 'Recursively walks the spec tree and collects all fontName values into a Set<string>.' },
                            { fn: 'applyFills(node, fills)', desc: 'Maps FillSpec[] to Figma Paint[] and assigns to node.fills or node.strokes.' },
                            { fn: 'buildNode(spec, parent)', desc: 'Creates the correct node type, sets all properties, appends to parent, recurses into children.' },
                            { fn: 'createFromSpec(spec)', desc: 'Entry point. Collects fonts → loads them in parallel → builds tree → centers viewport.' },
                          ].map(({ fn, desc }) => (
                            <div key={fn} className="bg-card border border-border rounded-md p-4">
                              <code className="text-brand-cyan font-redhatmono text-xs font-semibold block mb-2">{fn}</code>
                              <p className="text-muted-foreground text-sm">{desc}</p>
                            </div>
                          ))}
                        </div>
                        <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">plugin/src/code.ts — Usage</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`import { createFromSpec } from './render'
import spec from './social-media-spec.json'

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'CREATE_FROM_SPEC') {
    const frame = await createFromSpec(spec)
    figma.notify(\`Frame "\${frame.name}" created\`)
    figma.closePlugin()
  }
}`}</pre>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Social Media Example */}
                    <Card id="fn-social">
                      <CardHeader>
                        <CardTitle>Social Media Post — Instagram 1080x1080</CardTitle>
                        <CardDescription>Complete JSON spec for a dark-theme Instagram post with header, content image, caption, and footer.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Layer Structure</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto leading-relaxed">{`Instagram Post — 1080x1080  (FRAME, VERTICAL auto-layout)
├── Header                  (FRAME, HORIZONTAL, padding H:32 V:24, gap:16)
│   ├── Avatar              (ELLIPSE, 72×72, gradient + white stroke 3px)
│   ├── ProfileInfo         (FRAME, VERTICAL, FILL width, gap:4)
│   │   ├── Username        (TEXT, Inter SemiBold 28, white)
│   │   └── Subtitle        (TEXT, Inter Regular 22, gray #8C8C8C)
│   └── MoreButton          (FRAME, 40×40 circle, dark fill)
│       └── MoreIcon        (TEXT, "···", Inter Bold 20)
├── ContentImage            (RECT, FILL×680, gradient + inner shadow)
├── CaptionArea             (FRAME, VERTICAL, padding H:32 V:20, gap:8)
│   ├── Caption             (TEXT, Inter Regular 26, near-white, lh:150%)
│   └── Hashtags            (TEXT, Inter Regular 22, blue #738CFF)
└── Footer                  (FRAME, HORIZONTAL, SPACE_BETWEEN, padding H:32 V:16)
    ├── ActionsLeft         (FRAME, HORIZONTAL, gap:24)
    │   ├── LikeAction      (FRAME, HORIZONTAL, gap:8 → "♥" + "4,291")
    │   └── CommentAction   (FRAME, HORIZONTAL, gap:8 → "💬" + "318")
    └── SaveIcon            (TEXT, "🔖")`}</pre>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Key Dimension Decisions</h4>
                          <div className="border border-border rounded-md overflow-hidden">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-secondary/50">
                                <tr>
                                  <th className="px-4 py-3 font-medium text-foreground">Layer</th>
                                  <th className="px-4 py-3 font-medium text-foreground">Width</th>
                                  <th className="px-4 py-3 font-medium text-foreground">Height</th>
                                  <th className="px-4 py-3 font-medium text-foreground">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {[
                                  ['Root frame', '1080', '1080', 'Standard Instagram square'],
                                  ['Header', 'FILL', 'HUG', 'Stretches to root, height from content'],
                                  ['Avatar', '72', '72', 'FIXED — ellipse uses resize()'],
                                  ['ProfileInfo', 'FILL', 'HUG', 'Expands to fill header'],
                                  ['ContentImage', 'FILL', '680', 'Fixed height, fills width'],
                                  ['Caption text', 'FILL', 'HUG', 'Wraps to parent width'],
                                ].map(([layer, w, h, note]) => (
                                  <tr key={layer} className="bg-card">
                                    <td className="px-4 py-2.5 font-redhatmono text-brand-cyan text-xs">{layer}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{w}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{h}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{note}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Common Patterns */}
                    <Card id="fn-patterns">
                      <CardHeader>
                        <CardTitle>Common Patterns</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {[
                          {
                            title: 'Transparent fill (no background)',
                            code: `"fills": []`,
                          },
                          {
                            title: 'Text with letter-spacing and line-height',
                            code: `"letterSpacing": { "unit": "PERCENT", "value": -0.5 },\n"lineHeight": { "unit": "PERCENT", "value": 150 }`,
                          },
                          {
                            title: 'SPACE_BETWEEN layout (no spacer nodes needed)',
                            code: `"layoutMode": "HORIZONTAL",\n"primaryAxisAlignItems": "SPACE_BETWEEN"`,
                          },
                          {
                            title: 'Circle/avatar with stroke border',
                            code: `"type": "ELLIPSE",\n"width": 72, "height": 72,\n"strokeWeight": 3,\n"strokes": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }]`,
                          },
                        ].map(({ title, code }) => (
                          <div key={title}>
                            <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-2">{title}</h4>
                            <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                              <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{code}</pre>
                            </div>
                          </div>
                        ))}

                        <div className="bg-card border border-amber-500/20 rounded-md p-4 mt-4">
                          <p className="text-amber-500 text-sm font-medium mb-1">Related files</p>
                          <div className="space-y-1">
                            {[
                              ['plugin/src/render.ts', 'NodeSpec renderer — createFromSpec()'],
                              ['docs/FIGMA_NODE_JSON_SPEC.md', 'Full spec reference (markdown)'],
                              ['docs/DESIGN_SYSTEM_JSON_SPEC.md', 'Design token import spec'],
                              ['server/routes/plugin.ts', 'LLM prompt + operation generation'],
                              ['plugin/src/code.ts', 'Figma sandbox — executes operations'],
                            ].map(([file, desc]) => (
                              <div key={file} className="flex gap-3 items-start">
                                <code className="text-brand-cyan font-redhatmono text-xs shrink-0">{file}</code>
                                <span className="text-muted-foreground text-xs">{desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="canvas-api" className="space-y-8 mt-0">
                    <div>
                      <h2 className="text-3xl font-semibold tracking-tight mb-2">Canvas API</h2>
                      <p className="text-muted-foreground">REST API for programmatic creation, editing, and manipulation of canvas projects and their nodes. Designed for LLM agents and external integrations.</p>
                    </div>

                    {/* Overview */}
                    <Card id="ca-overview">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Workflow className="w-5 h-5 text-brand-cyan" /> How It Works</CardTitle>
                        <CardDescription>The canvas is a React Flow graph — a list of nodes and edges stored in a project. All mutations go through the project-level PUT endpoint.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {[
                            { step: '1', title: 'Create a Project', desc: 'POST /api/canvas with an initial nodes[] and edges[] array.' },
                            { step: '2', title: 'Read & Modify Nodes', desc: 'GET /api/canvas/:id to fetch current state. Modify the nodes array locally.' },
                            { step: '3', title: 'Persist Changes', desc: 'PUT /api/canvas/:id with the full updated nodes[] and edges[] to save.' },
                          ].map(({ step, title, desc }) => (
                            <div key={step} className="bg-card border border-border rounded-md p-4">
                              <div className="text-brand-cyan font-redhatmono text-xs uppercase mb-1">Step {step}</div>
                              <div className="font-medium text-foreground mb-1">{title}</div>
                              <div className="text-muted-foreground text-xs">{desc}</div>
                            </div>
                          ))}
                        </div>
                        <div className="bg-secondary/30 rounded-md border border-border p-4">
                          <div className="text-xs font-redhatmono text-muted-foreground mb-2 uppercase tracking-wide">Base URL</div>
                          <code className="text-brand-cyan font-redhatmono text-sm">https://your-domain.com/api/canvas</code>
                        </div>
                        <div className="bg-secondary/30 rounded-md border border-border p-4">
                          <div className="text-xs font-redhatmono text-muted-foreground mb-2 uppercase tracking-wide">Key Design Note</div>
                          <p className="text-sm text-muted-foreground">There is no individual node endpoint. Nodes are stored as a JSON array inside the project document. To add, update, or remove a node, fetch the project, mutate the nodes array, and PUT the full array back.</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Authentication */}
                    <Card id="ca-auth">
                      <CardHeader>
                        <CardTitle>Authentication</CardTitle>
                        <CardDescription>All endpoints require a JWT Bearer token except the public shared-project endpoint.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">HTTP Header (all requests)</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0">{`Authorization: Bearer <your_jwt_token>
Content-Type: application/json`}</pre>
                        </div>
                        <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Obtain Token — POST /api/auth/login</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`// Request
{ "email": "user@example.com", "password": "..." }

// Response
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }`}</pre>
                        </div>
                        <p className="text-muted-foreground text-sm">Rate limits: 60 requests/min for general endpoints, 10 uploads/15 min for media uploads.</p>
                      </CardContent>
                    </Card>

                    {/* Projects CRUD */}
                    <Card id="ca-projects">
                      <CardHeader>
                        <CardTitle>Projects CRUD</CardTitle>
                        <CardDescription>Create, read, update, and delete canvas projects. Each project stores a name, a nodes array, and an edges array.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {[
                          {
                            method: 'GET', path: '/api/canvas',
                            summary: 'List all projects for the authenticated user.',
                            response: `{ "projects": [{ "_id": "...", "name": "My Project", "nodes": [...], "edges": [...], "createdAt": "...", "updatedAt": "..." }] }`,
                          },
                          {
                            method: 'GET', path: '/api/canvas/:id',
                            summary: 'Get a single project by ID. Returns nodes with expired base64 data cleaned.',
                            response: `{ "project": { "_id": "...", "name": "...", "nodes": [...], "edges": [...] } }`,
                          },
                          {
                            method: 'POST', path: '/api/canvas',
                            summary: 'Create a new canvas project.',
                            request: `{
  "name": "My Agent Canvas",
  "nodes": [
    {
      "id": "node-1",
      "type": "prompt",
      "position": { "x": 100, "y": 100 },
      "data": { "type": "prompt", "prompt": "A product photo of running shoes on a white background" }
    }
  ],
  "edges": []
}`,
                            response: `{ "project": { "_id": "abc123", "name": "My Agent Canvas", "nodes": [...], "edges": [...] } }`,
                          },
                          {
                            method: 'PUT', path: '/api/canvas/:id',
                            summary: 'Update a project. Send only the fields you want to change. To update nodes, send the full updated nodes array.',
                            request: `{
  "name": "Updated Name",         // optional
  "nodes": [...],                  // optional — full array
  "edges": [...],                  // optional — full array
  "drawings": [...]                // optional — freehand drawing data
}`,
                            response: `{ "project": { "_id": "...", "name": "...", "nodes": [...], "edges": [...] } }`,
                          },
                          {
                            method: 'DELETE', path: '/api/canvas/:id',
                            summary: 'Delete a canvas project permanently.',
                            response: `{ "success": true }`,
                          },
                        ].map(({ method, path, summary, request, response }) => (
                          <div key={path + method} className="bg-card border border-border rounded-xl p-5 space-y-3">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className={cn("font-redhatmono uppercase", {
                                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20': method === 'GET',
                                'bg-amber-500/10 text-amber-500 border-amber-500/20': method === 'POST',
                                'bg-blue-500/10 text-blue-500 border-blue-500/20': method === 'PUT',
                                'bg-red-500/10 text-red-500 border-red-500/20': method === 'DELETE',
                              })}>{method}</Badge>
                              <span className="font-redhatmono text-foreground font-medium">{path}</span>
                            </div>
                            <p className="text-muted-foreground text-sm">{summary}</p>
                            {request && (
                              <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Request Body</div>
                                <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto">{request}</pre>
                              </div>
                            )}
                            <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                              <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Response</div>
                              <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto">{response}</pre>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Node Types */}
                    <Card id="ca-nodes">
                      <CardHeader>
                        <CardTitle>Node Types Reference</CardTitle>
                        <CardDescription>All 23 node types available in the canvas. Each node must have an <code className="bg-secondary px-1 py-0.5 rounded text-xs">id</code>, <code className="bg-secondary px-1 py-0.5 rounded text-xs">type</code>, <code className="bg-secondary px-1 py-0.5 rounded text-xs">position</code>, and a <code className="bg-secondary px-1 py-0.5 rounded text-xs">data</code> object with <code className="bg-secondary px-1 py-0.5 rounded text-xs">type</code> matching the node type.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Base Node Structure</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{
  "id": "unique-node-id",          // string — must be unique within the project
  "type": "prompt",                // FlowNodeType — see table below
  "position": { "x": 100, "y": 200 },
  "width": 320,                    // optional — display size
  "height": 240,
  "data": {
    "type": "prompt",              // must match the outer "type" field
    // ...type-specific fields
  }
}`}</pre>
                        </div>

                        <div className="border border-border rounded-md overflow-hidden">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/50">
                              <tr>
                                <th className="px-4 py-3 font-medium text-foreground w-36">type</th>
                                <th className="px-4 py-3 font-medium text-foreground">Description</th>
                                <th className="px-4 py-3 font-medium text-foreground">Key data fields</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {[
                                ['prompt', 'Text-to-image generation', 'prompt (string), model, aspectRatio, resolution, resultImageUrl'],
                                ['image', 'Display an existing mockup or image', 'mockup: { imageUrl, imageBase64, ... }'],
                                ['output', 'Result viewer — receives from flow nodes', 'resultImageUrl, resultVideoUrl, sourceNodeId'],
                                ['merge', 'Combine 2+ connected images with AI', 'prompt (string), model, resultImageUrl'],
                                ['edit', 'Edit image with Mockup Machine settings', 'uploadedImage, referenceImage, tags[], model, resolution, designType'],
                                ['upscale', 'AI upscaling (Gemini)', 'targetResolution, resultImageUrl, connectedImage'],
                                ['upscaleBicubic', 'Bicubic shader upscaling', 'scaleFactor, sharpening, resultImageUrl, resultVideoUrl'],
                                ['mockup', 'AI mockup from preset templates', 'selectedPreset, selectedColors[], withHuman, customPrompt, model'],
                                ['angle', 'Re-render with camera angle preset', 'selectedAngle, resultImageUrl, connectedImage'],
                                ['texture', 'Apply 3D texture/style preset', 'selectedPreset, resultImageUrl, connectedImage'],
                                ['ambience', 'Apply background/environment preset', 'selectedPreset, resultImageUrl, connectedImage'],
                                ['luminance', 'Apply light setup preset', 'selectedPreset, resultImageUrl, connectedImage'],
                                ['shader', 'GLSL shader effects (halftone, VHS, ASCII…)', 'shaderType, dotSize, angle, contrast, resultVideoUrl'],
                                ['colorExtractor', 'Extract color palette from image', 'connectedImage, extractedColors: string[]'],
                                ['text', 'Editable text block (connects to prompt/chat)', 'text (string)'],
                                ['logo', 'Logo upload node', 'logoImageUrl, logoBase64'],
                                ['pdf', 'Identity guide PDF upload', 'pdfUrl, fileName'],
                                ['videoInput', 'Video upload for shader/processing nodes', 'uploadedVideoUrl'],
                                ['video', 'Video generation via Veo', 'prompt, model, aspectRatio, duration, mode, resultVideoUrl'],
                                ['brand', 'Brand identity extractor (legacy)', 'logoImage, identityPdfUrl, brandIdentity'],
                                ['brandCore', 'Brand catalyst — generates visual prompts', 'connectedLogo, connectedPdf, visualPrompts, brandIdentity'],
                                ['strategy', 'Brand strategy generation (persona, archetypes…)', 'strategyType, prompt, strategyData'],
                                ['director', 'AI-assisted prompt builder with tag selection', 'connectedImage, suggestedTags, generatedPrompt'],
                                ['chat', 'Conversational AI with multimodal context', 'messages[], model, systemPrompt, connectedImage1..4'],
                              ].map(([type, desc, fields]) => (
                                <tr key={type} className="bg-card">
                                  <td className="px-4 py-2.5 font-redhatmono text-brand-cyan text-xs">{type}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{desc}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-xs font-redhatmono">{fields}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Example — Creating a Prompt Node</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{
  "id": "prompt-1",
  "type": "prompt",
  "position": { "x": 100, "y": 100 },
  "data": {
    "type": "prompt",
    "prompt": "A minimalist product photo of running shoes on white background, studio lighting",
    "model": "gemini-2.5-flash",
    "aspectRatio": "1:1",
    "resolution": "1024x1024"
  }
}`}</pre>
                        </div>

                        <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Example — Text Node connected to Prompt Node</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`// Text Node
{
  "id": "text-1",
  "type": "text",
  "position": { "x": 100, "y": 50 },
  "data": { "type": "text", "text": "A futuristic sneaker floating in space" }
}

// Prompt Node — will receive text via edge connection
{
  "id": "prompt-1",
  "type": "prompt",
  "position": { "x": 100, "y": 200 },
  "data": { "type": "prompt", "prompt": "" }
}`}</pre>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Edges */}
                    <Card id="ca-edges">
                      <CardHeader>
                        <CardTitle>Edges & Connections</CardTitle>
                        <CardDescription>Edges are React Flow edges connecting node outputs to node inputs. They drive data flow between nodes (e.g. an image node feeding into a merge node).</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Edge Structure</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{
  "id": "edge-1",               // string — must be unique
  "source": "prompt-1",         // source node ID
  "target": "output-1",         // target node ID
  "sourceHandle": "output",     // optional — handle id on source node
  "targetHandle": "input",      // optional — handle id on target node
  "type": "default"             // optional — edge rendering type
}`}</pre>
                        </div>

                        <div className="border border-border rounded-md overflow-hidden">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/50">
                              <tr>
                                <th className="px-4 py-3 font-medium text-foreground">Connection</th>
                                <th className="px-4 py-3 font-medium text-foreground">sourceHandle</th>
                                <th className="px-4 py-3 font-medium text-foreground">targetHandle</th>
                                <th className="px-4 py-3 font-medium text-foreground">Effect</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {[
                                ['image → merge', 'output', 'input-1 / input-2', 'Feeds source image into merge generation'],
                                ['prompt → output', 'output', 'input', 'Generated image flows to output display'],
                                ['text → prompt', 'output', 'text-input', 'Text node content syncs to prompt'],
                                ['logo → brandCore', 'output', 'logo-input', 'Logo base64 fed to brand core'],
                                ['pdf → brandCore', 'output', 'identity-input', 'PDF identity guide fed to brand core'],
                                ['brandCore → mockup', 'output', 'brand-input', 'Brand prompts and colors fed to mockup'],
                                ['image → colorExtractor', 'output', 'input', 'Image fed to color extraction'],
                                ['strategy → brandCore', 'output', 'strategy-input', 'Strategy data consolidated in brand core'],
                                ['image/prompt → chat', 'output', 'input-1..input-4', 'Visual context provided to chat node'],
                              ].map(([conn, src, tgt, effect]) => (
                                <tr key={conn} className="bg-card">
                                  <td className="px-4 py-2.5 font-redhatmono text-brand-cyan text-xs">{conn}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-xs font-redhatmono">{src}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-xs font-redhatmono">{tgt}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{effect}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Example — Prompt → Output flow</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`"edges": [
  {
    "id": "e1",
    "source": "prompt-1",
    "target": "output-1",
    "sourceHandle": "output",
    "targetHandle": "input"
  }
]`}</pre>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Media Upload */}
                    <Card id="ca-media">
                      <CardHeader>
                        <CardTitle>Media Upload</CardTitle>
                        <CardDescription>Upload images, PDFs, and videos to R2 storage and get back a persistent URL to embed in node data.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {[
                          {
                            method: 'POST', path: '/api/canvas/image/upload',
                            summary: 'Upload an image (base64) to R2. Returns a URL to store in node data fields like resultImageUrl or imageUrl.',
                            request: `{ "base64Image": "data:image/png;base64,...", "canvasId": "abc123", "nodeId": "node-1" }`,
                            response: `{ "imageUrl": "https://r2.example.com/canvas/abc123/node-1-xxx.png" }`,
                          },
                          {
                            method: 'GET', path: '/api/canvas/image/upload-url',
                            summary: 'Get a presigned URL for direct R2 upload (bypasses server size limits). Use for large images (>10 MB).',
                            request: `Query params: canvasId, nodeId, contentType (e.g. image/png)`,
                            response: `{ "presignedUrl": "https://r2.../...", "finalUrl": "https://r2-public.example.com/..." }`,
                          },
                          {
                            method: 'POST', path: '/api/canvas/video/upload',
                            summary: 'Upload a video (base64) to R2. No compression applied — original quality preserved.',
                            request: `{ "videoBase64": "data:video/mp4;base64,...", "canvasId": "abc123", "nodeId": "node-1" }`,
                            response: `{ "videoUrl": "https://r2.example.com/canvas/abc123/node-1-xxx.mp4" }`,
                          },
                          {
                            method: 'GET', path: '/api/canvas/video/upload-url',
                            summary: 'Get a presigned URL for direct large video upload to R2.',
                            request: `Query params: canvasId, nodeId, contentType (e.g. video/mp4)`,
                            response: `{ "presignedUrl": "https://r2.../...", "finalUrl": "https://r2-public.example.com/..." }`,
                          },
                          {
                            method: 'POST', path: '/api/canvas/pdf/upload',
                            summary: 'Upload a PDF (base64) to R2. PDF is compressed before upload.',
                            request: `{ "pdfBase64": "data:application/pdf;base64,...", "canvasId": "abc123", "nodeId": "node-1" }`,
                            response: `{ "pdfUrl": "https://r2.example.com/canvas/abc123/node-1-xxx.pdf" }`,
                          },
                          {
                            method: 'DELETE', path: '/api/canvas/image?url=<encoded>',
                            summary: 'Delete an image from R2 by URL.',
                            request: `URL query param: url (URL-encoded R2 image URL)`,
                            response: `{ "success": true }`,
                          },
                        ].map(({ method, path, summary, request, response }) => (
                          <div key={path} className="bg-card border border-border rounded-xl p-5 space-y-3">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className={cn("font-redhatmono uppercase", {
                                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20': method === 'GET',
                                'bg-amber-500/10 text-amber-500 border-amber-500/20': method === 'POST',
                                'bg-red-500/10 text-red-500 border-red-500/20': method === 'DELETE',
                              })}>{method}</Badge>
                              <span className="font-redhatmono text-foreground font-medium text-sm">{path}</span>
                            </div>
                            <p className="text-muted-foreground text-sm">{summary}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Request</div>
                                <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto">{request}</pre>
                              </div>
                              <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Response</div>
                                <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto">{response}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Sharing & Collaboration */}
                    <Card id="ca-share">
                      <CardHeader>
                        <CardTitle>Sharing & Collaboration</CardTitle>
                        <CardDescription>Share projects publicly or with specific users by email or user ID. Requires Admin or Premium subscription.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {[
                          {
                            method: 'POST', path: '/api/canvas/:id/share',
                            summary: 'Enable sharing on a project. Generates a shareId and sets collaboration permissions.',
                            request: `{ "canEdit": ["user@example.com"], "canView": ["viewer@example.com"] }`,
                            response: `{ "shareId": "abc123xyz", "shareUrl": "/canvas/shared/abc123xyz", "canEdit": [...], "canView": [...] }`,
                          },
                          {
                            method: 'GET', path: '/api/canvas/shared/:shareId',
                            summary: 'Fetch a publicly shared project. No authentication required.',
                            request: `No body — shareId in path`,
                            response: `{ "project": { "_id": "...", "name": "...", "nodes": [...], "edges": [...] } }`,
                          },
                          {
                            method: 'PUT', path: '/api/canvas/:id/share-settings',
                            summary: 'Update collaboration permissions for an existing shared project.',
                            request: `{ "canEdit": ["new-editor@example.com"], "canView": [] }`,
                            response: `{ "canEdit": [...], "canView": [...] }`,
                          },
                          {
                            method: 'DELETE', path: '/api/canvas/:id/share',
                            summary: 'Disable sharing — removes shareId and revokes all collaboration access.',
                            request: `No body`,
                            response: `{ "success": true }`,
                          },
                        ].map(({ method, path, summary, request, response }) => (
                          <div key={path} className="bg-card border border-border rounded-xl p-5 space-y-3">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className={cn("font-redhatmono uppercase", {
                                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20': method === 'GET',
                                'bg-amber-500/10 text-amber-500 border-amber-500/20': method === 'POST',
                                'bg-blue-500/10 text-blue-500 border-blue-500/20': method === 'PUT',
                                'bg-red-500/10 text-red-500 border-red-500/20': method === 'DELETE',
                              })}>{method}</Badge>
                              <span className="font-redhatmono text-foreground font-medium text-sm">{path}</span>
                            </div>
                            <p className="text-muted-foreground text-sm">{summary}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Request</div>
                                <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto">{request}</pre>
                              </div>
                              <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">Response</div>
                                <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto">{response}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Agent Integration */}
                    <Card id="ca-agents">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-brand-cyan" /> Agent Integration</CardTitle>
                        <CardDescription>Complete workflow examples for LLM agents and external tools interacting with the Canvas API.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Workflow A — Create a canvas with a prompt node and read the result</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">JavaScript / TypeScript</div>
                            <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto leading-relaxed">{`const BASE = "https://your-domain.com/api";
const TOKEN = "your_jwt_token";
const headers = { "Authorization": \`Bearer \${TOKEN}\`, "Content-Type": "application/json" };

// Step 1 — Create a canvas project with a prompt + output node
const { project } = await fetch(\`\${BASE}/canvas\`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: "Agent Canvas",
    nodes: [
      {
        id: "prompt-1",
        type: "prompt",
        position: { x: 100, y: 100 },
        data: {
          type: "prompt",
          prompt: "A luxury perfume bottle on a dark marble surface, dramatic lighting",
          model: "gemini-2.5-flash",
          aspectRatio: "1:1"
        }
      },
      {
        id: "output-1",
        type: "output",
        position: { x: 500, y: 100 },
        data: { type: "output" }
      }
    ],
    edges: [{ id: "e1", source: "prompt-1", target: "output-1", sourceHandle: "output", targetHandle: "input" }]
  })
}).then(r => r.json());

const projectId = project._id;

// Step 2 — Later, fetch the project to read generated image URLs
const { project: updated } = await fetch(\`\${BASE}/canvas/\${projectId}\`, { headers }).then(r => r.json());
const outputNode = updated.nodes.find(n => n.id === "output-1");
const imageUrl = outputNode?.data?.resultImageUrl;
console.log("Generated image:", imageUrl);`}</pre>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Workflow B — Add a node to an existing project</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">JavaScript / TypeScript</div>
                            <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto leading-relaxed">{`// Fetch current state
const { project } = await fetch(\`\${BASE}/canvas/\${projectId}\`, { headers }).then(r => r.json());

// Add a new text node
const newNode = {
  id: \`text-\${Date.now()}\`,
  type: "text",
  position: { x: 300, y: 50 },
  data: { type: "text", text: "Add dramatic red neon lighting effects" }
};

// Persist the updated nodes array
await fetch(\`\${BASE}/canvas/\${projectId}\`, {
  method: "PUT",
  headers,
  body: JSON.stringify({
    nodes: [...project.nodes, newNode],
    edges: project.edges
  })
});`}</pre>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Workflow C — Upload an image and set it in an image node</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">JavaScript / TypeScript</div>
                            <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto leading-relaxed">{`// Step 1 — Upload image to R2
const { imageUrl } = await fetch(\`\${BASE}/canvas/image/upload\`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    base64Image: "data:image/png;base64,iVBORw0KGgo...",
    canvasId: projectId,
    nodeId: "image-1"
  })
}).then(r => r.json());

// Step 2 — Create an image node referencing the uploaded URL
const imageNode = {
  id: "image-1",
  type: "image",
  position: { x: 100, y: 100 },
  data: {
    type: "image",
    mockup: { imageUrl, id: "image-1", name: "Product Shot" }
  }
};

// Step 3 — Patch the project
const { project } = await fetch(\`\${BASE}/canvas/\${projectId}\`, { headers }).then(r => r.json());
await fetch(\`\${BASE}/canvas/\${projectId}\`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ nodes: [...project.nodes, imageNode], edges: project.edges })
});`}</pre>
                          </div>
                        </div>

                        <div className="bg-card border border-amber-500/20 rounded-md p-4">
                          <p className="text-amber-500 text-sm font-medium mb-2">Key Patterns for Agents</p>
                          <ul className="space-y-1.5 text-sm text-muted-foreground">
                            <li>• <strong className="text-foreground">Node IDs must be unique</strong> within a project. Use a UUID or timestamp-based suffix.</li>
                            <li>• <strong className="text-foreground">Always PUT the full nodes array</strong> — there is no PATCH for individual nodes.</li>
                            <li>• <strong className="text-foreground">Prefer R2 URLs over base64</strong> — base64 in nodes expires after 7 days and increases payload size.</li>
                            <li>• <strong className="text-foreground">Result images are async</strong> — generation happens in the browser. The API stores whatever state the frontend last saved. Poll or listen to get updated results after generation.</li>
                            <li>• <strong className="text-foreground">Max 10,000 nodes</strong> per project. Max 15 MB payload after R2 offload.</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    {/* JSON Export / Import Format */}
                    <Card id="ca-json">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">JSON Export / Import Format</CardTitle>
                        <CardDescription>The <code className="font-redhatmono text-xs bg-secondary px-1 rounded">visant-canvas/v1</code> schema used to save and restore complete canvas workflows as portable JSON files.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Top-level structure</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">TypeScript</div>
                            <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto leading-relaxed">{`interface VisantCanvasExport {
  meta: {
    schema: "visant-canvas/v1"; // always this string — used for validation
    exportedAt: string;          // ISO-8601 timestamp
    nodeCount: number;
    edgeCount: number;
    drawingCount: number;
  };
  name: string;       // human-readable project name
  nodes: Node[];      // React Flow nodes (cleaned — no base64, no transient state)
  edges: Edge[];      // React Flow edges (id, source, target, handles, type)
  drawings: any[];    // free-draw strokes (may be empty array)
}`}</pre>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Fields stripped on export</h4>
                          <p className="text-sm text-muted-foreground mb-3">The following fields are removed from node data before export to keep files portable and compact:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-secondary/20 rounded-md border border-border p-3">
                              <p className="font-redhatmono text-xs text-muted-foreground uppercase mb-2">Large binary data (kept as R2 URLs)</p>
                              <ul className="space-y-0.5 text-xs font-redhatmono text-foreground">
                                {['resultImageBase64', 'resultVideoBase64', 'imageBase64', 'base64', 'pdfBase64', 'identityPdfBase64', 'identityImageBase64', 'logoBase64', 'uploadedVideo', 'startFrame', 'endFrame'].map(f => (
                                  <li key={f} className="text-muted-foreground"><span className="text-brand-cyan">−</span> {f}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-secondary/20 rounded-md border border-border p-3">
                              <p className="font-redhatmono text-xs text-muted-foreground uppercase mb-2">Transient / recomputed from edges</p>
                              <ul className="space-y-0.5 text-xs font-redhatmono text-foreground">
                                {['connectedImages', 'connectedImage', 'connectedLogo', 'connectedPdf', 'connectedText', 'connectedVideo', 'oversizedWarning', 'isGenerating', 'isLoading', 'promptSuggestions', 'suggestedTags', 'userMockups'].map(f => (
                                  <li key={f} className="text-muted-foreground"><span className="text-brand-cyan">−</span> {f}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Exporting programmatically</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">TypeScript</div>
                            <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto leading-relaxed">{`import { exportCanvasToJson, downloadJsonFile } from '@/utils/canvas/canvasJsonExport';

// Serialize current canvas state (nodes / edges / drawings from React Flow)
const exported = exportCanvasToJson(projectName, nodes, edges, drawings);

// Trigger browser download → "my_canvas.json"
downloadJsonFile(exported, projectName);`}</pre>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-redhatmono text-xs uppercase text-muted-foreground mb-3">Importing programmatically</h4>
                          <div className="bg-secondary/30 rounded-md border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase ">TypeScript</div>
                            <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto leading-relaxed">{`import { readJsonFile, validateVisantJson } from '@/utils/canvas/canvasJsonExport';
import { canvasApi } from '@/services/canvasApi';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// file: File from <Input type="file" accept=".json">
const raw = await readJsonFile(file);

if (!validateVisantJson(raw)) {
  throw new Error('Not a valid visant-canvas/v1 file');
}

// Create a new project from the imported data
const newProject = await canvasApi.save(
  raw.name,
  raw.nodes,
  raw.edges,
  undefined,
  raw.drawings ?? []
);

// Navigate to the newly created project
navigate(\`/canvas/\${newProject._id}\`);`}</pre>
                          </div>
                        </div>

                        <div className="bg-card border border-brand-cyan/20 rounded-md p-4">
                          <p className="text-brand-cyan text-sm font-medium mb-2">UI Entry Points</p>
                          <ul className="space-y-1.5 text-sm text-muted-foreground">
                            <li>• <strong className="text-foreground">Canvas header → Download dropdown</strong> — "Exportar como JSON" / "Importar de JSON" buttons.</li>
                            <li>• <strong className="text-foreground">Projects listing page</strong> — "Import from JSON" button next to "New Project".</li>
                            <li>• On export, base64 blobs are stripped; only R2 <code className="font-redhatmono text-xs bg-secondary px-1 rounded">*Url</code> fields are kept, so files are human-readable and reproducible.</li>
                            <li>• On import, a <strong className="text-foreground">new project is always created</strong> — it never overwrites an existing one.</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                  </TabsContent>

                  {/* Brand Guidelines Tab */}
                  <TabsContent value="brand-guidelines" className="space-y-8 mt-0">
                    <Card className="bg-card border border-border">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Sparkles className="h-8 w-8 text-brand-cyan" />
                          <div>
                            <CardTitle className="text-2xl">Brand Guidelines API</CardTitle>
                            <CardDescription>Structured brand identity context for AI agents</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div id="bg-overview" className="scroll-mt-20">
                          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                            Brand Guidelines are more than static documents — they are <strong className="text-foreground">identity vaults</strong> that provide structured context for AI generation. 
                            By connecting a guideline to a prompt or canvas, you ensure the AI maintains visual consistency with colors, typography, and tone of voice.
                          </p>
                        </div>

                        <Separator />

                        <div id="bg-rest" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">REST Endpoints</h3>
                          <div className="bg-secondary/40 border border-border rounded-md p-4">
                            <div className="font-redhatmono text-xs space-y-2">
                              <p className="flex justify-between border-b border-border/30 pb-1.5"><span className="text-green-400">GET</span> <span className="text-foreground">/api/brand-guidelines</span> <span className="text-muted-foreground">List all user's guidelines</span></p>
                              <p className="flex justify-between border-b border-border/30 pb-1.5"><span className="text-green-400">GET</span> <span className="text-foreground">/api/brand-guidelines/:id</span> <span className="text-muted-foreground">Fetch detailed guideline</span></p>
                              <p className="flex justify-between border-b border-border/30 pb-1.5"><span className="text-blue-400">POST</span> <span className="text-foreground">/api/brand-guidelines</span> <span className="text-muted-foreground">Create new identity vault</span></p>
                              <p className="flex justify-between border-b border-border/30 pb-1.5"><span className="text-amber-400">PUT</span> <span className="text-foreground">/api/brand-guidelines/:id</span> <span className="text-muted-foreground">Update guideline fields</span></p>
                              <p className="flex justify-between border-b border-border/30 pb-1.5"><span className="text-red-400">DELETE</span> <span className="text-foreground">/api/brand-guidelines/:id</span> <span className="text-muted-foreground">Remove guideline permanently</span></p>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div id="bg-schema" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Data Schema</h3>
                          <div className="bg-secondary/60 rounded p-4 font-redhatmono text-xs overflow-x-auto text-foreground">
                            <pre className="whitespace-pre">{`{
  "identity": { "name": "Brand", "tagline": "...", "description": "Story..." },
  "colors": [{ "hex": "#00E5CC", "name": "Primary", "role": "primary" }],
  "typography": [{ "family": "Inter", "role": "heading", "size": 32 }],
  "strategy": { 
    "manifesto": "...", 
    "archetypes": ["Creator"],
    "voiceValues": [{ "title": "Bold", "example": "Be direct." }] 
  },
  "guidelines": { "voice": "Professional", "dos": [], "donts": [] }
}`}</pre>
                          </div>
                        </div>

                        <Separator />

                        <div id="bg-sharing" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Public Sharing</h3>
                          <p className="text-muted-foreground text-sm mb-4">
                            Guidelines can be shared publicly via a unique slug. This allows external tools and reviewers to access brand data without authentication.
                          </p>
                          <div className="bg-secondary/40 border border-border rounded-md p-4">
                            <div className="font-redhatmono text-xs space-y-2">
                              <p><span className="text-blue-400">POST</span> <span className="text-foreground">/api/brand-guidelines/:id/share</span> <span className="text-muted-foreground">— Enable sharing</span></p>
                              <p><span className="text-green-400">GET</span> <span className="text-foreground">/api/brand-guidelines/public/:slug</span> <span className="text-muted-foreground">— Read public data</span></p>
                              <p><span className="text-red-400">DELETE</span> <span className="text-foreground">/api/brand-guidelines/:id/share</span> <span className="text-muted-foreground">— Disable sharing</span></p>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div id="bg-context" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">LLM Context Endpoint</h3>
                          <p className="text-muted-foreground text-sm mb-4">
                            Use the <code className="font-redhatmono bg-secondary px-1 rounded">/context</code> endpoint to get a version of the guideline optimized for prompt injection.
                          </p>
                          <div className="bg-secondary/60 border border-border rounded-md p-4 font-redhatmono text-xs space-y-3">
                            <p className="text-muted-foreground"># GET /api/brand-guidelines/:id/context?format=prompt&output=text</p>
                            <pre className="text-brand-cyan leading-relaxed">{`═══ BRAND: Visant ═══
Tagline: "Design at the speed of thought"
COLORS:
  Primary: #00E5CC (primary)
  Dark: #0A0A0A (background)
VOICE: Friendly but technical. Avoid jargon.`}</pre>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* For Agents Tab */}
                  <TabsContent value="agents" className="space-y-8 mt-0">
                    <Card className="bg-card border border-border">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Bot className="h-8 w-8 text-brand-cyan" />
                          <div>
                            <CardTitle className="text-2xl">For AI Agents</CardTitle>
                            <CardDescription>Connect AI agents and LLMs to the Visant Labs platform</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div id="ag-overview" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Overview</h3>
                          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                            Visant Labs provides three ways for AI agents to interact with the platform:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-secondary/40 border border-border rounded-md p-4">
                              <p className="text-brand-cyan font-semibold text-sm mb-1">Discovery</p>
                              <div className="space-y-1.5">
                                <p className="text-muted-foreground text-xs">
                                  <code className="font-redhatmono bg-secondary px-1 rounded">/llms.txt</code> — Concise overview
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  <code className="font-redhatmono bg-secondary px-1 rounded">/llms-full.txt</code> — Full platform reference
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  <code className="font-redhatmono bg-secondary px-1 rounded">/api/docs/api/spec</code> — OpenAPI JSON
                                </p>
                              </div>
                            </div>
                            <div className="bg-secondary/40 border border-border rounded-md p-4">
                              <p className="text-brand-cyan font-semibold text-sm mb-1">MCP Tools</p>
                              <p className="text-muted-foreground text-xs">Connect via SSE to <code className="font-redhatmono bg-secondary px-1 rounded">/api/mcp</code> and invoke tools directly</p>
                            </div>
                            <div className="bg-secondary/40 border border-border rounded-md p-4">
                              <p className="text-brand-cyan font-semibold text-sm mb-1">REST API</p>
                              <p className="text-muted-foreground text-xs">Full HTTP API with JSON responses for all platform features</p>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div id="ag-auth" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Authentication</h3>
                          <p className="text-muted-foreground text-sm mb-3">
                            Agents authenticate using API keys. Create one from <a href="/settings/api-keys" className="text-brand-cyan hover:underline">Settings → API Keys</a>.
                          </p>
                          <div className="bg-secondary/60 border border-border rounded-md p-4 font-redhatmono text-sm">
                            <p className="text-muted-foreground mb-1"># Pass your API key in the Authorization header</p>
                            <p className="text-foreground">Authorization: Bearer visant_sk_xxxxxxxxxxxx</p>
                          </div>
                        </div>

                        <Separator />

                        <div id="ag-mcp" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">MCP Connection</h3>
                          <div className="bg-secondary/60 border border-border rounded-md p-4 font-redhatmono text-sm space-y-2">
                            <p className="text-foreground">GET /api/mcp</p>
                            <p className="text-foreground">POST /api/mcp/message?sessionId=...</p>
                          </div>
                        </div>

                        <Separator />

                        <div id="ag-tools" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Available MCP Tools</h3>
                          <div className="overflow-x-auto border border-border rounded-md">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-secondary/30">
                                  <th className="text-left p-3 text-muted-foreground font-medium text-xs uppercase">Tool</th>
                                  <th className="text-left p-3 text-muted-foreground font-medium text-xs uppercase">Description</th>
                                  <th className="text-left p-3 text-muted-foreground font-medium text-xs uppercase">Cost</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {[
                                  { name: 'account-usage', desc: 'Get credit usage, limits, plan info', cost: 'Free' },
                                  { name: 'mockup-list', desc: 'List your generated mockups', cost: 'Free' },
                                  { name: 'mockup-generate', desc: 'Generate a mockup from prompt', cost: '1 credit' },
                                  { name: 'brand-guidelines-list', desc: 'List brand guidelines', cost: 'Free' },
                                  { name: 'brand-guidelines-get', desc: 'Get guideline with colors/fonts/strategy', cost: 'Free' },
                                  { name: 'brand-guidelines-public', desc: 'Get public guideline by slug (no auth)', cost: 'Free' },
                                  { name: 'canvas-list', desc: 'List canvas projects', cost: 'Free' },
                                  { name: 'canvas-get', desc: 'Get canvas with nodes/edges', cost: 'Free' },
                                  { name: 'canvas-create', desc: 'Create new canvas project', cost: 'Free' },
                                  { name: 'ai-improve-prompt', desc: 'Enhance a text prompt', cost: '1 credit' },
                                  { name: 'ai-describe-image', desc: 'Analyze an image', cost: '1 credit' },
                                ].map(tool => (
                                  <tr key={tool.name} className="hover:bg-secondary/20">
                                    <td className="p-3 font-redhatmono text-foreground text-xs">{tool.name}</td>
                                    <td className="p-3 text-muted-foreground text-xs">{tool.desc}</td>
                                    <td className="p-3">
                                      <Badge className={tool.cost === 'Free' ? 'bg-green-500/20 text-green-400 text-xs' : 'bg-purple-500/20 text-purple-400 text-xs'}>
                                        {tool.cost}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-muted-foreground text-xs mt-2">See <button onClick={() => setActiveTab('mcp')} className="text-brand-cyan hover:underline">MCP Tools tab</button> for full tool reference with input schemas.</p>
                        </div>

                        <div id="ag-brand-guidelines" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Brand Guidelines API</h3>
                          <p className="text-muted-foreground text-sm mb-3">
                            Guidelines are centralized identity vaults. Use the <code className="font-redhatmono bg-secondary px-1 rounded">/context</code> endpoint for optimized prompt context.
                          </p>
                          <div className="bg-secondary/40 border border-border rounded-md p-4 mb-4">
                            <div className="font-redhatmono text-xs space-y-2">
                              <p className="flex justify-between border-b border-border/30 pb-1.5"><span className="text-green-400">GET</span> <span className="text-foreground">/api/brand-guidelines/:id/context</span></p>
                              <p className="text-muted-foreground text-xs mt-1">Query params: <code className="text-foreground">format=prompt|structured</code>, <code className="text-foreground">output=text|json</code></p>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div id="ag-credits" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Credits & Limits</h3>
                          <p className="text-muted-foreground text-sm mb-3">Every MCP tool response includes quota info in <code className="font-redhatmono bg-secondary px-1 rounded">_meta</code>:</p>
                          <div className="bg-secondary/60 border border-border rounded-md p-4 font-redhatmono text-xs">
                            <pre className="text-foreground">{`{ "_meta": { "credits_remaining": 42, "plan": "pro" } }`}</pre>
                          </div>
                        </div>

                        <Separator />

                        <div id="ag-example" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Example Flow</h3>
                          <div className="space-y-3 text-sm">
                            {[
                              { step: '1', title: 'Get an API key', desc: 'Settings → API Keys → Create with "read" + "generate" scopes' },
                              { step: '2', title: 'Connect to MCP', desc: 'SSE connect to /api/mcp with Authorization header' },
                              { step: '3', title: 'Check balance', desc: 'Call account-usage to see available credits' },
                              { step: '4', title: 'Generate', desc: 'Call mockup-generate, check _meta.credits_remaining' },
                            ].map(({ step, title, desc }) => (
                              <div key={step} className="flex items-start gap-3 bg-secondary/40 border border-border rounded-md p-3">
                                <span className="bg-brand-cyan/20 text-brand-cyan text-xs font-bold px-2 py-1 rounded shrink-0">{step}</span>
                                <div>
                                  <p className="text-foreground font-medium text-sm">{title}</p>
                                  <p className="text-muted-foreground text-xs">{desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="pricing" className="space-y-8 mt-0">
                    <Card className="bg-card border border-border">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Coins className="h-8 w-8 text-brand-cyan" />
                          <div>
                            <CardTitle className="text-2xl">Pricing & Credits</CardTitle>
                            <CardDescription>Transparent pricing based on official Google API costs</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div id="pr-google" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Official Google API Pricing</h3>
                          <p className="text-muted-foreground text-sm mb-4">
                            Our credit costs are derived from <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline">Google's official pricing</a>. Updated March 2026.
                          </p>

                          <h4 className="text-sm font-semibold text-foreground mb-2">Image Generation</h4>
                          <div className="overflow-x-auto mb-4">
                            <table className="w-full text-sm border border-border rounded-md">
                              <thead className="bg-secondary/60">
                                <tr>
                                  <th className="text-left p-2 font-medium">Model</th>
                                  <th className="text-left p-2 font-medium">Resolution</th>
                                  <th className="text-right p-2 font-medium">Google Price</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-t border-border"><td className="p-2">Gemini 2.5 Flash Image</td><td className="p-2">~1K</td><td className="p-2 text-right font-redhatmono">$0.039</td></tr>
                                <tr className="border-t border-border"><td className="p-2">Gemini 3.1 Flash Image</td><td className="p-2">512px</td><td className="p-2 text-right font-redhatmono">$0.045</td></tr>
                                <tr className="border-t border-border"><td className="p-2">Gemini 3.1 Flash Image</td><td className="p-2">1K</td><td className="p-2 text-right font-redhatmono">$0.067</td></tr>
                                <tr className="border-t border-border"><td className="p-2">Gemini 3.1 Flash Image</td><td className="p-2">2K</td><td className="p-2 text-right font-redhatmono">$0.101</td></tr>
                                <tr className="border-t border-border"><td className="p-2">Gemini 3.1 Flash Image</td><td className="p-2">4K</td><td className="p-2 text-right font-redhatmono">$0.151</td></tr>
                                <tr className="border-t border-border"><td className="p-2">Gemini 3 Pro Image</td><td className="p-2">1K/2K</td><td className="p-2 text-right font-redhatmono">$0.134</td></tr>
                                <tr className="border-t border-border"><td className="p-2">Gemini 3 Pro Image</td><td className="p-2">4K</td><td className="p-2 text-right font-redhatmono">$0.24</td></tr>
                              </tbody>
                            </table>
                          </div>

                          <h4 className="text-sm font-semibold text-foreground mb-2">Video Generation (Veo 3.1)</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-border rounded-md">
                              <thead className="bg-secondary/60">
                                <tr>
                                  <th className="text-left p-2 font-medium">Model</th>
                                  <th className="text-left p-2 font-medium">Resolution</th>
                                  <th className="text-right p-2 font-medium">Per Second</th>
                                  <th className="text-right p-2 font-medium">8 sec video</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-t border-border"><td className="p-2">Veo 3.1 Fast</td><td className="p-2">720p/1080p</td><td className="p-2 text-right font-redhatmono">$0.15</td><td className="p-2 text-right font-redhatmono">$1.20</td></tr>
                                <tr className="border-t border-border"><td className="p-2">Veo 3.1 Standard</td><td className="p-2">720p/1080p</td><td className="p-2 text-right font-redhatmono">$0.40</td><td className="p-2 text-right font-redhatmono">$3.20</td></tr>
                                <tr className="border-t border-border"><td className="p-2">Veo 3.1 Fast</td><td className="p-2">4K</td><td className="p-2 text-right font-redhatmono">$0.35</td><td className="p-2 text-right font-redhatmono">$2.80</td></tr>
                                <tr className="border-t border-border"><td className="p-2">Veo 3.1 Standard</td><td className="p-2">4K</td><td className="p-2 text-right font-redhatmono">$0.60</td><td className="p-2 text-right font-redhatmono">$4.80</td></tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <Separator />

                        <div id="pr-credits" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Visant Credit System</h3>
                          <p className="text-muted-foreground text-sm mb-4">
                            Credits are our universal currency. Each operation has a fixed credit cost.
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-semibold text-foreground mb-2">Image Generation</h4>
                              <div className="space-y-1.5 text-sm">
                                {CREDIT_COSTS.filter(c => c.category === 'image').map((cost, i) => (
                                  <div key={i} className="flex justify-between items-center bg-secondary/40 border border-border rounded px-3 py-1.5">
                                    <span className="text-muted-foreground">{cost.model} {cost.resolution}</span>
                                    <Badge variant="secondary" className="font-redhatmono">{cost.creditsRequired} cr</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-foreground mb-2">Video Generation</h4>
                              <div className="space-y-1.5 text-sm">
                                {CREDIT_COSTS.filter(c => c.category === 'video').map((cost, i) => (
                                  <div key={i} className="flex justify-between items-center bg-secondary/40 border border-border rounded px-3 py-1.5">
                                    <span className="text-muted-foreground">{cost.model} {cost.resolution}</span>
                                    <Badge variant="secondary" className="font-redhatmono">{cost.creditsRequired} cr</Badge>
                                  </div>
                                ))}
                              </div>
                              <h4 className="text-sm font-semibold text-foreground mt-4 mb-2">Other Operations</h4>
                              <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between items-center bg-secondary/40 border border-border rounded px-3 py-1.5">
                                  <span className="text-muted-foreground">AI Chat (4 messages)</span>
                                  <Badge variant="secondary" className="font-redhatmono">1 cr</Badge>
                                </div>
                                <div className="flex justify-between items-center bg-secondary/40 border border-border rounded px-3 py-1.5">
                                  <span className="text-muted-foreground">Brand Analysis (complete)</span>
                                  <Badge variant="secondary" className="font-redhatmono">10 cr</Badge>
                                </div>
                                <div className="flex justify-between items-center bg-secondary/40 border border-border rounded px-3 py-1.5">
                                  <span className="text-muted-foreground">Read operations (list, get)</span>
                                  <Badge variant="outline" className="text-green-500 border-green-500/30">Free</Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div id="pr-packages" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Credit Packages</h3>
                          <p className="text-muted-foreground text-sm mb-4">What can you create with each package?</p>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-border rounded-md">
                              <thead className="bg-secondary/60">
                                <tr>
                                  <th className="text-left p-3 font-medium">Package</th>
                                  <th className="text-right p-3 font-medium">Price (BRL)</th>
                                  <th className="text-center p-3 font-medium">Images HD</th>
                                  <th className="text-center p-3 font-medium">Images 4K</th>
                                  <th className="text-center p-3 font-medium">Videos Fast</th>
                                  <th className="text-center p-3 font-medium">Videos Std</th>
                                </tr>
                              </thead>
                              <tbody>
                                {CREDIT_PACKAGES.map((pkg, i) => (
                                  <tr key={i} className="border-t border-border">
                                    <td className="p-3 font-medium text-brand-cyan">{pkg.credits} credits</td>
                                    <td className="p-3 text-right font-redhatmono">R${pkg.priceBRL.toFixed(2)}</td>
                                    <td className="p-3 text-center">~{pkg.imagesHD}</td>
                                    <td className="p-3 text-center">~{pkg.images4K}</td>
                                    <td className="p-3 text-center">~{pkg.videosFast}</td>
                                    <td className="p-3 text-center">~{pkg.videosStandard}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">*Estimates based on default models and resolutions. Actual usage may vary.</p>
                        </div>

                        <Separator />

                        <div id="pr-byok" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">BYOK (Bring Your Own Key)</h3>
                          <div className="bg-brand-cyan/10 border border-brand-cyan/30 rounded-md p-4">
                            <p className="text-sm text-foreground mb-2"><strong>Coming Soon:</strong> Use your own Google AI API key for unlimited generations.</p>
                            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                              <li>Pay Google directly at their published rates</li>
                              <li>No credit limits on your Visant account</li>
                              <li>Full control over your API usage and billing</li>
                            </ul>
                          </div>
                        </div>

                        <Separator />

                        <div id="pr-transparency" className="scroll-mt-20">
                          <h3 className="text-lg font-semibold text-foreground mb-3">Build in Public</h3>
                          <p className="text-muted-foreground text-sm mb-3">
                            Transparency is a core value. This pricing data is:
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2 bg-secondary/40 border border-border rounded-md p-3">
                              <span className="text-brand-cyan">1.</span>
                              <span className="text-muted-foreground"><strong className="text-foreground">Derived from official sources</strong> — Google's published API pricing</span>
                            </div>
                            <div className="flex items-start gap-2 bg-secondary/40 border border-border rounded-md p-3">
                              <span className="text-brand-cyan">2.</span>
                              <span className="text-muted-foreground"><strong className="text-foreground">Open in our codebase</strong> — <code className="font-redhatmono bg-secondary px-1 rounded text-xs">src/utils/pricing.ts</code>, <code className="font-redhatmono bg-secondary px-1 rounded text-xs">src/utils/creditCalculator.ts</code></span>
                            </div>
                            <div className="flex items-start gap-2 bg-secondary/40 border border-border rounded-md p-3">
                              <span className="text-brand-cyan">3.</span>
                              <span className="text-muted-foreground"><strong className="text-foreground">Updated when Google updates</strong> — We track official pricing changes</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
