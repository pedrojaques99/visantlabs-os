import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Book, Server, Puzzle, Home, ChevronLeft, ChevronRight, Terminal, Code, Sparkles } from 'lucide-react';
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
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
