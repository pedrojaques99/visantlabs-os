import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Book, Server, Puzzle, Home, ChevronLeft, ChevronRight, Terminal, Code, Sparkles, Layers, Workflow, Copy, Check, FileText } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);

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
    {
      id: 'canvas-api',
      label: 'Canvas API',
      icon: Workflow,
      sections: [
        { id: 'ca-overview', label: 'Overview' },
        { id: 'ca-auth', label: 'Authentication' },
        { id: 'ca-projects', label: 'Projects CRUD' },
        { id: 'ca-nodes', label: 'Node Types' },
        { id: 'ca-edges', label: 'Edges & Connections' },
        { id: 'ca-media', label: 'Media Upload' },
        { id: 'ca-share', label: 'Sharing & Collab' },
        { id: 'ca-agents', label: 'Agent Integration' },
      ],
    },
  ];

  const generateTabMarkdown = useCallback((tab: string): string => {
    const lines: string[] = [];

    if (tab === 'canvas-api') {
      lines.push(`# Canvas API Reference`);
      lines.push(`\nBase URL: \`/api/canvas\`\nAuth: \`Authorization: Bearer <jwt_token>\`\nContent-Type: \`application/json\``);
      lines.push(`\n## Overview\nThe canvas is a React Flow graph stored as a project with \`nodes[]\` and \`edges[]\` arrays.\nThere is no individual node CRUD — to add/update/remove a node: GET the project, mutate the array, PUT the full array back.\n\n**Workflow:**\n1. \`POST /api/canvas\` — create project\n2. \`GET /api/canvas/:id\` — fetch current nodes\n3. Mutate locally\n4. \`PUT /api/canvas/:id\` — persist the full nodes array`);
      lines.push(`\n## Projects CRUD\n\n### GET /api/canvas\nList all projects for the authenticated user.\n\`\`\`json\n{ "projects": [{ "_id": "...", "name": "...", "nodes": [...], "edges": [...], "createdAt": "...", "updatedAt": "..." }] }\n\`\`\``);
      lines.push(`\n### GET /api/canvas/:id\nGet a single project by ID.\n\`\`\`json\n{ "project": { "_id": "...", "name": "...", "nodes": [...], "edges": [...] } }\n\`\`\``);
      lines.push(`\n### POST /api/canvas\nCreate a new canvas project.\n**Body:**\n\`\`\`json\n{\n  "name": "My Canvas",\n  "nodes": [\n    {\n      "id": "prompt-1",\n      "type": "prompt",\n      "position": { "x": 100, "y": 100 },\n      "data": { "type": "prompt", "prompt": "A product photo on white background", "model": "gemini-2.0-flash-exp" }\n    }\n  ],\n  "edges": []\n}\n\`\`\`\n**Response:** \`{ "project": { "_id": "abc123", ... } }\``);
      lines.push(`\n### PUT /api/canvas/:id\nUpdate a project. Send only fields to change; nodes/edges require the full array.\n**Body:** \`{ "name"?: string, "nodes"?: Node[], "edges"?: Edge[], "drawings"?: any[] }\`\n**Limits:** max 10 000 nodes, 15 MB payload after R2 offload.`);
      lines.push(`\n### DELETE /api/canvas/:id\nDelete a project permanently.\n**Response:** \`{ "success": true }\``);
      lines.push(`\n## Node Structure\nEvery node follows the React Flow node schema:\n\`\`\`json\n{\n  "id": "unique-id",\n  "type": "prompt",\n  "position": { "x": 0, "y": 0 },\n  "width": 320,\n  "height": 240,\n  "data": {\n    "type": "prompt",\n    "prompt": "...",\n    ...typeSpecificFields\n  }\n}\n\`\`\``);
      lines.push(`\n## Node Types\n| type | description | key data fields |\n|------|-------------|----------------|\n| \`prompt\` | Text-to-image generation | prompt, model, aspectRatio, resolution, resultImageUrl |\n| \`image\` | Display a mockup/image | mockup: { imageUrl, ... } |\n| \`output\` | Result viewer (receives from flow nodes) | resultImageUrl, resultVideoUrl, sourceNodeId |\n| \`merge\` | Combine 2+ connected images with AI | prompt, model, resultImageUrl |\n| \`edit\` | Edit image with Mockup Machine | uploadedImage, referenceImage, tags[], model, designType |\n| \`upscale\` | AI upscaling (Gemini) | targetResolution, resultImageUrl, connectedImage |\n| \`upscaleBicubic\` | Bicubic shader upscaling | scaleFactor, sharpening, resultImageUrl, resultVideoUrl |\n| \`mockup\` | AI mockup from preset templates | selectedPreset, selectedColors[], withHuman, customPrompt |\n| \`angle\` | Re-render with camera angle preset | selectedAngle, resultImageUrl, connectedImage |\n| \`texture\` | Apply 3D texture/style preset | selectedPreset, resultImageUrl, connectedImage |\n| \`ambience\` | Apply background/environment preset | selectedPreset, resultImageUrl, connectedImage |\n| \`luminance\` | Apply light setup preset | selectedPreset, resultImageUrl, connectedImage |\n| \`shader\` | GLSL shader effects (halftone, VHS, ASCII…) | shaderType, dotSize, contrast, resultVideoUrl |\n| \`colorExtractor\` | Extract color palette from image | connectedImage, extractedColors: string[] |\n| \`text\` | Editable text block (connects to prompt/chat) | text: string |\n| \`logo\` | Logo upload node | logoImageUrl, logoBase64 |\n| \`pdf\` | Identity guide PDF upload | pdfUrl, fileName |\n| \`videoInput\` | Video upload for shader/processing | uploadedVideoUrl |\n| \`video\` | Video generation via Veo | prompt, model, aspectRatio, duration, resultVideoUrl |\n| \`brand\` | Brand identity extractor (legacy) | logoImage, identityPdfUrl, brandIdentity |\n| \`brandCore\` | Brand catalyst — generates visual prompts | connectedLogo, connectedPdf, visualPrompts, brandIdentity |\n| \`strategy\` | Brand strategy generation | strategyType, prompt, strategyData |\n| \`director\` | AI-assisted prompt builder with tag selection | connectedImage, suggestedTags, generatedPrompt |\n| \`chat\` | Conversational AI with multimodal context | messages[], model, systemPrompt, connectedImage1..4 |`);
      lines.push(`\n## Edges\n\`\`\`json\n{ "id": "e1", "source": "prompt-1", "target": "output-1", "sourceHandle": "output", "targetHandle": "input" }\n\`\`\`\n\n| Connection | sourceHandle | targetHandle | Effect |\n|------------|-------------|--------------|--------|\n| image → merge | output | input-1 / input-2 | Feeds source image into merge |\n| prompt → output | output | input | Generated image to output display |\n| text → prompt | output | text-input | Text syncs to prompt node |\n| logo → brandCore | output | logo-input | Logo fed to brand core |\n| pdf → brandCore | output | identity-input | PDF identity guide to brand core |\n| brandCore → mockup | output | brand-input | Brand prompts/colors to mockup |\n| strategy → brandCore | output | strategy-input | Strategy data consolidated |\n| image → chat | output | input-1..input-4 | Visual context to chat node |`);
      lines.push(`\n## Media Upload\n\n### POST /api/canvas/image/upload\nUpload image (base64) to R2. Returns persistent URL.\n**Body:** \`{ "base64Image": "data:image/png;base64,...", "canvasId": "...", "nodeId": "..." }\`\n**Response:** \`{ "imageUrl": "https://r2.example.com/..." }\`\n\n### GET /api/canvas/image/upload-url\nPresigned URL for direct large-image upload (bypasses Vercel limit).\n**Query:** \`canvasId, nodeId, contentType\`\n**Response:** \`{ "presignedUrl": "...", "finalUrl": "..." }\`\n\n### POST /api/canvas/video/upload\n**Body:** \`{ "videoBase64": "data:video/mp4;base64,...", "canvasId": "...", "nodeId": "..." }\`\n**Response:** \`{ "videoUrl": "..." }\`\n\n### GET /api/canvas/video/upload-url\nPresigned URL for direct large-video upload.\n**Query:** \`canvasId, nodeId, contentType\`\n\n### POST /api/canvas/pdf/upload\n**Body:** \`{ "pdfBase64": "data:application/pdf;base64,...", "canvasId": "...", "nodeId": "..." }\`\n**Response:** \`{ "pdfUrl": "..." }\`\n\n### DELETE /api/canvas/image?url=<encoded>\nDelete image from R2 by URL.`);
      lines.push(`\n## Sharing & Collaboration\nRequires Admin or Premium plan.\n\n### POST /api/canvas/:id/share\n**Body:** \`{ "canEdit": ["user@example.com"], "canView": ["viewer@example.com"] }\`\n**Response:** \`{ "shareId": "abc123", "shareUrl": "/canvas/shared/abc123" }\`\n\n### GET /api/canvas/shared/:shareId\nFetch shared project — no authentication required.\n\n### PUT /api/canvas/:id/share-settings\n**Body:** \`{ "canEdit": [...], "canView": [...] }\`\n\n### DELETE /api/canvas/:id/share\nDisable sharing and revoke all access.`);
      lines.push(`\n## Agent Integration Patterns\n\n### Create and read a project\n\`\`\`js\nconst headers = { "Authorization": "Bearer TOKEN", "Content-Type": "application/json" };\n\nconst { project } = await fetch("/api/canvas", {\n  method: "POST", headers,\n  body: JSON.stringify({\n    name: "Agent Canvas",\n    nodes: [{ id: "p1", type: "prompt", position: { x: 0, y: 0 }, data: { type: "prompt", prompt: "Product photo" } }],\n    edges: []\n  })\n}).then(r => r.json());\n\n// Read after generation\nconst { project: updated } = await fetch(\`/api/canvas/\${project._id}\`, { headers }).then(r => r.json());\nconst resultUrl = updated.nodes.find(n => n.type === "output")?.data?.resultImageUrl;\n\`\`\`\n\n### Add a node to existing project\n\`\`\`js\nconst { project } = await fetch(\`/api/canvas/\${id}\`, { headers }).then(r => r.json());\nawait fetch(\`/api/canvas/\${id}\`, {\n  method: "PUT", headers,\n  body: JSON.stringify({\n    nodes: [...project.nodes, { id: "text-1", type: "text", position: { x: 0, y: 0 }, data: { type: "text", text: "neon lighting" } }],\n    edges: project.edges\n  })\n});\n\`\`\`\n\n**Key rules:**\n- Node IDs must be unique within the project (use UUID or timestamp suffix)\n- Always PUT the full nodes array (no individual node PATCH)\n- Prefer R2 URLs over base64 — base64 expires in 7 days\n- Generation is async (happens in browser) — poll GET to read updated results`);
      return lines.join('\n');
    }

    if (tab === 'mcp') {
      if (!mcpSpec) return '# MCP Tools\n\nSpec not loaded yet.';
      lines.push('# MCP Tools Reference');
      lines.push(`\nIntegrate Visant Copilot into your AI agents via Model Context Protocol.\n`);
      mcpSpec.tools.forEach(tool => {
        lines.push(`\n## ${tool.name}\n\n${tool.description}\n`);
        const props = Object.entries(tool.inputSchema?.properties || {});
        if (props.length > 0) {
          lines.push('**Parameters:**\n');
          lines.push('| name | type | required | description |');
          lines.push('|------|------|----------|-------------|');
          props.forEach(([name, prop]: [string, any]) => {
            const req = tool.inputSchema.required?.includes(name) ? 'yes' : 'no';
            lines.push(`| \`${name}\` | ${prop.type || 'string'} | ${req} | ${prop.description || '-'} |`);
          });
        }
        if (tool.examples?.[0]) {
          lines.push(`\n**Example input:**\n\`\`\`json\n${JSON.stringify(tool.examples[0].input, null, 2)}\n\`\`\``);
        }
      });
      return lines.join('\n');
    }

    if (tab === 'api') {
      if (!openApiSpec) return '# REST API\n\nSpec not loaded yet.';
      lines.push(`# ${openApiSpec.info.title} — REST API Reference`);
      lines.push(`\nVersion: ${openApiSpec.info.version}\nAuth: \`Authorization: Bearer <jwt_token>\``);
      const paths = openApiSpec.paths || {};
      Object.entries(paths).forEach(([path, methods]) => {
        Object.entries(methods as Record<string, any>).forEach(([method, details]) => {
          if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;
          lines.push(`\n## ${method.toUpperCase()} ${path}`);
          if (details.summary) lines.push(`\n${details.summary}`);
          if (details.description) lines.push(`\n${details.description}`);
          if (details.parameters?.length > 0) {
            lines.push('\n**Parameters:**\n');
            lines.push('| name | in | type | description |');
            lines.push('|------|----|------|-------------|');
            details.parameters.forEach((p: any) => {
              lines.push(`| \`${p.name}\` | ${p.in} | ${p.schema?.type || 'string'} | ${p.schema?.description || '-'} |`);
            });
          }
        });
      });
      return lines.join('\n');
    }

    if (tab === 'figma-nodes') {
      lines.push('# Figma Node JSON Spec');
      lines.push(`\nData-driven pattern for creating Figma nodes via Plugin API. Define JSON → execute with render.ts.\n\n**Flow:** JSON spec → collectFonts() → figma.loadFontAsync() → buildNode() recursively`);
      lines.push(`\n## Supported Node Types\n- FRAME — container with auto-layout, padding, fills, children\n- RECTANGLE — solid or gradient-filled box\n- ELLIPSE — circle or oval shape\n- TEXT — text with full typography control`);
      lines.push(`\n## NodeSpec Properties\n| property | type | notes |\n|----------|------|-------|\n| type | string | 'FRAME' \\| 'RECTANGLE' \\| 'ELLIPSE' \\| 'TEXT' — required |\n| name | string | Layer name — required |\n| width / height | number | Applied via resize() internally |\n| fills | FillSpec[] | Array of solid or gradient fills. Empty array = transparent |\n| strokes | FillSpec[] | Stroke paints (same format as fills) |\n| strokeWeight | number | Stroke width in pixels |\n| cornerRadius | number | Rounded corners in pixels |\n| opacity | number | 0–1 |\n| effects | EffectSpec[] | DROP_SHADOW, INNER_SHADOW, LAYER_BLUR, BACKGROUND_BLUR |\n| layoutMode | string | 'NONE' \\| 'HORIZONTAL' \\| 'VERTICAL' — FRAME only |\n| primaryAxisAlignItems | string | 'MIN' \\| 'MAX' \\| 'CENTER' \\| 'SPACE_BETWEEN' |\n| counterAxisAlignItems | string | 'MIN' \\| 'MAX' \\| 'CENTER' \\| 'BASELINE' |\n| paddingTop/Bottom/Left/Right | number | Inner spacing — auto-layout frames only |\n| itemSpacing | number | Gap between children |\n| layoutSizingHorizontal | string | 'FIXED' \\| 'FILL' \\| 'HUG' — set AFTER appendChild |\n| layoutSizingVertical | string | 'FIXED' \\| 'FILL' \\| 'HUG' — set AFTER appendChild |\n| characters | string | Text content — TEXT only |\n| fontSize | number | Font size in px — TEXT only |\n| fontName | object | { family: string, style: string } — must be loaded first |\n| textAlignHorizontal | string | 'LEFT' \\| 'CENTER' \\| 'RIGHT' \\| 'JUSTIFIED' |\n| children | NodeSpec[] | Nested nodes — FRAME only |`);
      lines.push(`\n## Critical Rules\n- **Colors are 0–1 floats** — { r: 1, g: 0, b: 0 } = red. Never 0–255.\n- **Use resize(), not width=** — width/height are read-only.\n- **Load fonts before text** — figma.loadFontAsync() must complete first.\n- **appendChild before layoutSizing** — FILL/HUG only works after node is in auto-layout parent.\n- **fontName.style must be exact** — 'SemiBold' not 'Semi Bold'.\n- **lineHeight AUTO has no value** — { unit: 'AUTO' } — omit value field.\n- **Empty fills = transparent** — fills: [] removes all background.`);
      lines.push(`\n## Fill Examples\n\`\`\`json\n// Solid fill\n{ "type": "SOLID", "color": { "r": 0.98, "g": 0.35, "b": 0.35 }, "opacity": 1 }\n\n// Linear gradient\n{\n  "type": "GRADIENT_LINEAR",\n  "gradientTransform": [[0.7, 0.7, -0.1], [-0.7, 0.7, 0.7]],\n  "gradientStops": [\n    { "color": { "r": 0.06, "g": 0.09, "b": 0.22, "a": 1 }, "position": 0 },\n    { "color": { "r": 0.40, "g": 0.06, "b": 0.20, "a": 1 }, "position": 1 }\n  ]\n}\n\`\`\``);
      return lines.join('\n');
    }

    if (tab === 'plugin') {
      return `# Figma Plugin Guide\n\n## Installation\n1. Open any file in Figma.\n2. Go to Resources > Plugins.\n3. Search for "Visant Copilot" and click Run.\n4. Follow the on-screen prompts to connect your account.\n\n## Capabilities\n- **Mockups** — select frames and convert them to 3D device mockups instantly.\n- **Chat with AI** — describe what to build; nodes are created automatically.\n- **Brand identity extraction** — upload logo + identity PDF to generate brand-aware prompts.\n- **Image generation** — text-to-image, edit, merge, upscale inside Figma.\n\n## Plugin API (for developers)\nThe plugin communicates with the server via WebSocket (pluginBridge). Agents can send commands via the \`/api/plugin/agent-command\` endpoint which validates and queues operations for execution inside Figma.`;
    }

    // overview
    return `# Visant Copilot Documentation\n\n## Sections\n- **REST API** — HTTP endpoints for auth, mockups, and canvas manipulation.\n- **Canvas API** — Create and manipulate canvas projects and nodes programmatically.\n- **MCP Tools** — Model Context Protocol tools for Claude and AI agent integration.\n- **Figma Plugin** — Design automation inside Figma.\n- **Figma Node JSON** — Data-driven node creation spec for the plugin renderer.\n\n## Authentication\nAll endpoints: \`Authorization: Bearer <jwt_token>\`\nObtain token: \`POST /api/auth/login\` → \`{ "email": "...", "password": "..." }\`\n\n## Base URL\n\`https://your-domain.com/api\``;
  }, [mcpSpec, openApiSpec]);

  const handleCopyMarkdown = useCallback(async () => {
    const md = generateTabMarkdown(activeTab);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for non-https contexts
      const el = document.createElement('textarea');
      el.value = md;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [activeTab, generateTabMarkdown]);

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

                  <button
                    onClick={handleCopyMarkdown}
                    title="Copy this section as clean Markdown — ideal for pasting into LLM contexts"
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-redhatmono transition-all duration-200 shrink-0",
                      copied
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500"
                        : "bg-secondary/60 border-border text-muted-foreground hover:border-brand-cyan/50 hover:text-brand-cyan hover:bg-brand-cyan/5"
                    )}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy as Markdown'}
                  </button>
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
                <div className="mb-6 flex items-start gap-3 bg-brand-cyan/5 border border-brand-cyan/20 rounded-lg px-4 py-3">
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

                      <Card className="cursor-pointer hover:border-brand-cyan/50 transition-all hover:-translate-y-1" onClick={() => setActiveTab('canvas-api')}>
                        <CardHeader>
                          <Workflow className="w-8 h-8 text-brand-cyan mb-2" />
                          <CardTitle>Canvas API</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground text-sm">Programmatically create, edit, and manipulate canvas nodes and projects — for LLM agents and external tools.</p>
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
                            <div key={step} className="bg-card border border-border rounded-lg p-4">
                              <div className="text-brand-cyan font-redhatmono text-xs uppercase tracking-wider mb-1">Step {step}</div>
                              <div className="font-medium text-foreground mb-1">{title}</div>
                              <div className="text-muted-foreground text-xs">{desc}</div>
                            </div>
                          ))}
                        </div>
                        <div className="bg-secondary/30 rounded-lg border border-border p-4">
                          <div className="text-xs font-redhatmono text-muted-foreground mb-2 uppercase tracking-wide">Base URL</div>
                          <code className="text-brand-cyan font-redhatmono text-sm">https://your-domain.com/api/canvas</code>
                        </div>
                        <div className="bg-secondary/30 rounded-lg border border-border p-4">
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
                        <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">HTTP Header (all requests)</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0">{`Authorization: Bearer <your_jwt_token>
Content-Type: application/json`}</pre>
                        </div>
                        <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Obtain Token — POST /api/auth/login</div>
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
                              <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Request Body</div>
                                <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto">{request}</pre>
                              </div>
                            )}
                            <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                              <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Response</div>
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
                        <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Base Node Structure</div>
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

                        <div className="border border-border rounded-lg overflow-hidden">
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

                        <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Example — Creating a Prompt Node</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{
  "id": "prompt-1",
  "type": "prompt",
  "position": { "x": 100, "y": 100 },
  "data": {
    "type": "prompt",
    "prompt": "A minimalist product photo of running shoes on white background, studio lighting",
    "model": "gemini-2.0-flash-exp",
    "aspectRatio": "1:1",
    "resolution": "1024x1024"
  }
}`}</pre>
                        </div>

                        <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Example — Text Node connected to Prompt Node</div>
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
                        <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Edge Structure</div>
                          <pre className="p-4 text-sm font-redhatmono text-foreground m-0 overflow-x-auto">{`{
  "id": "edge-1",               // string — must be unique
  "source": "prompt-1",         // source node ID
  "target": "output-1",         // target node ID
  "sourceHandle": "output",     // optional — handle id on source node
  "targetHandle": "input",      // optional — handle id on target node
  "type": "default"             // optional — edge rendering type
}`}</pre>
                        </div>

                        <div className="border border-border rounded-lg overflow-hidden">
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

                        <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                          <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Example — Prompt → Output flow</div>
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
                              <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Request</div>
                                <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto">{request}</pre>
                              </div>
                              <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Response</div>
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
                              <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Request</div>
                                <pre className="p-4 text-xs font-redhatmono text-foreground m-0 overflow-x-auto">{request}</pre>
                              </div>
                              <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">Response</div>
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
                          <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-3">Workflow A — Create a canvas with a prompt node and read the result</h4>
                          <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">JavaScript / TypeScript</div>
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
          model: "gemini-2.0-flash-exp",
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
                          <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-3">Workflow B — Add a node to an existing project</h4>
                          <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">JavaScript / TypeScript</div>
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
                          <h4 className="font-redhatmono text-xs uppercase tracking-wider text-muted-foreground mb-3">Workflow C — Upload an image and set it in an image node</h4>
                          <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                            <div className="bg-secondary/50 px-4 py-2 border-b border-border font-redhatmono text-xs text-muted-foreground uppercase tracking-wider">JavaScript / TypeScript</div>
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

                        <div className="bg-card border border-amber-500/20 rounded-lg p-4">
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
