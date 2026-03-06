import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Book, Server, Puzzle, Home, ChevronLeft, ChevronRight, Terminal, Code, Sparkles, Layers } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SEO } from '../components/SEO';
import { BreadcrumbWithBack } from '../components/ui/BreadcrumbWithBack';
import {
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { NavigationSidebar, type NavigationItem } from '../components/ui/NavigationSidebar';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { cn } from '../lib/utils';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<string, Record<string, any>>;
}

interface MCPSpec {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
    examples?: Array<{
      name: string;
      description?: string;
      input: any;
      expectedOutput?: string;
    }>;
  }>;
}

export const DocsPage: React.FC = () => {
  const { t } = useTranslation();
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

  const [openApiSpec, setOpenApiSpec] = useState<OpenAPISpec | null>(null);
  const [mcpSpec, setMcpSpec] = useState<MCPSpec | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const [apiRes, mcpRes] = await Promise.all([
          fetch('/api/docs/api/spec'),
          fetch('/api/docs/plugin/mcp.json')
        ]);

        if (apiRes.ok) setOpenApiSpec(await apiRes.json());
        if (mcpRes.ok) setMcpSpec(await mcpRes.json());
      } catch (error) {
        console.error('Failed to fetch documentation specs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, []);

  const apiEndpoints = useMemo(() => {
    if (!openApiSpec) return [];

    const endpoints: Array<any> = [];
    const paths = openApiSpec.paths || {};

    Object.entries(paths).forEach(([path, methods]) => {
      Object.entries(methods as Record<string, any>).forEach(([method, details]) => {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            ...details
          });
        }
      });
    });

    return endpoints;
  }, [openApiSpec]);

  const authEndpoints = apiEndpoints.filter(e => e.tags?.includes('auth'));
  const mockupEndpoints = apiEndpoints.filter(e => e.tags?.includes('mockups'));
  const pluginEndpoints = apiEndpoints.filter(e => e.tags?.includes('plugin'));

  const navigationItems: NavigationItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: Home,
    },
    {
      id: 'api',
      label: 'REST API',
      icon: Server,
      sections: [
        { id: 'api-auth', label: 'Authentication' },
        { id: 'api-mockups', label: 'Mockups' },
        { id: 'api-plugin', label: 'Plugin' },
      ],
    },
    {
      id: 'mcp',
      label: 'MCP Tools',
      icon: Terminal,
      sections: mcpSpec?.tools.map(tool => ({
        id: `tool-${tool.name}`,
        label: tool.name
      })) || [],
    },
    {
      id: 'plugin',
      label: 'Figma Plugin',
      icon: Puzzle,
    },
    {
      id: 'figma-nodes',
      label: 'Figma Node JSON',
      icon: Layers,
      sections: [
        { id: 'fn-overview', label: 'Overview' },
        { id: 'fn-nodespec', label: 'NodeSpec Reference' },
        { id: 'fn-fills', label: 'Fill & Effect Types' },
        { id: 'fn-rules', label: 'Critical Rules' },
        { id: 'fn-renderer', label: 'Renderer (render.ts)' },
        { id: 'fn-social', label: 'Social Media Example' },
        { id: 'fn-patterns', label: 'Common Patterns' },
      ],
    },
  ];

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
  }, [activeTab, mcpSpec]); // Add dependencies needed

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
                  <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-3">Parameters</h4>
                  <div className="border border-border rounded-lg overflow-hidden">
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
          <GridDotsBackground />
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
            className="flex-1 min-w-0 pt-10 md:pt-12 transition-all duration-300"
            style={{
              marginLeft: typeof window !== 'undefined' && window.innerWidth >= 1024
                ? `${sidebarWidth}px` : '0'
            }}
          >
            <div className="h-screen overflow-y-auto">
              <div className="max-w-5xl mx-auto px-4 pt-[30px] pb-16 md:pb-24">
                <div className="mb-4">
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
                    </div>

                    <Card className="mt-8">
                      <CardHeader>
                        <CardTitle>Getting Started with API</CardTitle>
                        <CardDescription>How to authenticate and make requests to Visant Copilot.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium mb-2">1. Authentication</h3>
                          <p className="text-muted-foreground mb-3 font-sm">All API requests require a JWT token in the Authorization header. First, sign up or log in.</p>
                          <div className="bg-secondary/50 rounded-lg p-4 border border-border">
                            <div className="text-xs font-redhatmono text-muted-foreground mb-2 uppercase tracking-wide">HTTP Header</div>
                            <code className="text-brand-cyan font-redhatmono text-sm">Authorization: Bearer YOUR_TOKEN_HERE</code>
                          </div>
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
                      <p className="text-muted-foreground">Integrate Visant Copilot functionality directly into your AI agents via the Model Context Protocol.</p>
                    </div>

                    {loading ? (
                      <SkeletonLoader className="w-full h-64 rounded-xl" />
                    ) : (
                      <div className="space-y-8">
                        {mcpSpec?.tools.map((tool, idx) => (
                          <Card key={idx} id={`tool-${tool.name}`} className="border border-border bg-card overfow-hidden">
                            <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4">
                              <div className="flex items-center gap-3">
                                <Code className="w-5 h-5 text-brand-cyan" />
                                <h3 className="text-xl font-redhatmono font-semibold text-brand-cyan m-0">{tool.name}</h3>
                              </div>
                              <p className="text-muted-foreground mt-2">{tool.description}</p>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                              <div>
                                <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-3">Input Schema</h4>
                                <div className="border border-border rounded-lg overflow-hidden">
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
                                              <span className="text-destructive text-xs font-semibold uppercase tracking-wider">Yes</span>
                                            ) : (
                                              <span className="text-muted-foreground text-xs uppercase tracking-wider">No</span>
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
                                  <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-3">Example</h4>
                                  <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                                    <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">
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
                        <div className="bg-secondary/30 rounded-lg border border-border p-4">
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
                            <div key={n.type} className="bg-card border border-border rounded-lg p-3">
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
                        <div className="border border-border rounded-lg overflow-hidden">
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
                          <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-2">Solid Fill</h4>
                          <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">JSON</div>
                            <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{ "type": "SOLID", "color": { "r": 0.98, "g": 0.35, "b": 0.35 }, "opacity": 1 }`}</pre>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-2">Linear Gradient</h4>
                          <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">JSON</div>
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
                          <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-2">Inner Shadow Effect</h4>
                          <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">JSON</div>
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
                        <div className="border border-border rounded-lg overflow-hidden">
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
                            <div key={fn} className="bg-card border border-border rounded-lg p-4">
                              <code className="text-brand-cyan font-redhatmono text-xs font-semibold block mb-2">{fn}</code>
                              <p className="text-muted-foreground text-sm">{desc}</p>
                            </div>
                          ))}
                        </div>
                        <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">plugin/src/code.ts — Usage</div>
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
                          <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-3">Layer Structure</h4>
                          <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
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
                          <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-3">Key Dimension Decisions</h4>
                          <div className="border border-border rounded-lg overflow-hidden">
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
                            <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
                            <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                              <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{code}</pre>
                            </div>
                          </div>
                        ))}

                        <div className="bg-card border border-amber-500/20 rounded-lg p-4 mt-4">
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

                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
