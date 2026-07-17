import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Copy,
  Check,
  Key,
  Zap,
  Image,
  Palette,
  ChevronRight,
  ExternalLink,
} from '@/lib/ui/icons';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { Card, CardContent } from '../components/ui/card';
import { useLayout } from '@/hooks/useLayout';
import { SEO } from '../components/SEO';
import {
  BreadcrumbWithBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
import { copyToClipboard } from '@/utils/clipboard';
import { useInAppShell } from '@/components/shell/InAppShellContext';
import { cn } from '@/lib/utils';

// ─── Local CodeBlock component ──────────────────────────────────────────────

type Language = 'bash' | 'javascript' | 'python';

interface CodeBlockProps {
  code: string;
  language: Language;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const langLabel: Record<Language, string> = {
    bash: 'bash',
    javascript: 'javascript',
    python: 'python',
  };

  return (
    <div className="relative group rounded-lg overflow-hidden border border-border bg-muted">
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          {langLabel[language]}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 px-2 rounded hover:bg-muted"
          aria-label="Copy code"
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm font-mono text-foreground leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// ─── Tab toggle component ────────────────────────────────────────────────────

interface TabCodeProps {
  js: string;
  python: string;
}

const TabCode: React.FC<TabCodeProps> = ({ js, python }) => {
  const [tab, setTab] = useState<'js' | 'python'>('js');

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {(['js', 'python'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
              tab === t
                ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30'
                : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-ring'
            }`}
          >
            {t === 'js' ? 'JavaScript' : 'Python'}
          </button>
        ))}
      </div>
      {tab === 'js' ? (
        <CodeBlock code={js} language="javascript" />
      ) : (
        <CodeBlock code={python} language="python" />
      )}
    </div>
  );
};

// ─── Section anchor helper ───────────────────────────────────────────────────

const SECTIONS = [
  { id: 'authentication', label: 'Authentication' },
  { id: 'brand-generation', label: 'Brand Generation' },
  { id: 'mockup-generation', label: 'Mockup Generation' },
  { id: 'creative-studio', label: 'Creative Studio' },
  { id: 'next-steps', label: 'Next Steps' },
];

// ─── Code snippets ───────────────────────────────────────────────────────────

const MCP_URL = 'https://api.visantlabs.com/api/mcp';
const API_KEY_PLACEHOLDER = 'visant_sk_xxxxxxxxxxxx';

const AUTH_CURL = `curl -X POST ${MCP_URL} \\
  -H "Authorization: Bearer ${API_KEY_PLACEHOLDER}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

const BRAND_JS = `const response = await fetch('${MCP_URL}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${API_KEY_PLACEHOLDER}',
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'brand-guidelines-create',
      arguments: {
        name: 'Acme Corp',
        identity: {
          industry: 'Technology',
          description: 'Next-gen developer tools',
        },
      },
    },
  }),
});

const result = await response.json();
console.log(result.result);`;

const BRAND_PY = `import requests

response = requests.post(
    '${MCP_URL}',
    headers={
        'Authorization': 'Bearer ${API_KEY_PLACEHOLDER}',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
    },
    json={
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'tools/call',
        'params': {
            'name': 'brand-guidelines-create',
            'arguments': {
                'name': 'Acme Corp',
                'identity': {
                    'industry': 'Technology',
                    'description': 'Next-gen developer tools',
                },
            },
        },
    },
)

result = response.json()
print(result['result'])`;

const MOCKUP_JS = `const response = await fetch('${MCP_URL}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${API_KEY_PLACEHOLDER}',
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'mockup-generate',
      arguments: {
        prompt: 'White t-shirt with minimal logo, studio lighting, flat lay',
        aspectRatio: '1:1',
      },
    },
  }),
});

const result = await response.json();
// result.result.content[0].text — JSON with generated mockup URL`;

const MOCKUP_PY = `import requests

response = requests.post(
    '${MCP_URL}',
    headers={
        'Authorization': 'Bearer ${API_KEY_PLACEHOLDER}',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
    },
    json={
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'tools/call',
        'params': {
            'name': 'mockup-generate',
            'arguments': {
                'prompt': 'White t-shirt with minimal logo, studio lighting, flat lay',
                'aspectRatio': '1:1',
            },
        },
    },
)

result = response.json()
# result['result']['content'][0]['text'] — JSON with generated mockup URL`;

const CREATIVE_JS = `const response = await fetch('${MCP_URL}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${API_KEY_PLACEHOLDER}',
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'creative-generate',
      arguments: {
        prompt: 'A bold social media banner for a tech startup launch',
        brandGuidelineId: '<your-guideline-id>',
        format: 'instagram-post',
      },
    },
  }),
});

const result = await response.json();
// result.result.content[0].text — JSON with generated creative layers`;

const CREATIVE_PY = `import requests

response = requests.post(
    '${MCP_URL}',
    headers={
        'Authorization': 'Bearer ${API_KEY_PLACEHOLDER}',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
    },
    json={
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'tools/call',
        'params': {
            'name': 'creative-generate',
            'arguments': {
                'prompt': 'A bold social media banner for a tech startup launch',
                'brandGuidelineId': '<your-guideline-id>',
                'format': 'instagram-post',
            },
        },
    },
)

result = response.json()
# result['result']['content'][0]['text'] — JSON with generated creative layers`;

// ─── Page ────────────────────────────────────────────────────────────────────

export const GettingStartedPage: React.FC = () => {
  useLayout();
  const inShell = useInAppShell();

  return (
    <>
      <SEO
        title="Getting Started — Visant API"
        description="Follow a step-by-step guide to authenticate and call Visant's AI brand, mockup, and creative generation tools via API."
      />
      <div
        className={cn(
          'bg-background text-muted-foreground relative',
          inShell ? 'min-h-full' : 'min-h-screen',
          inShell ? 'pt-6' : 'pt-12 md:pt-14'
        )}
      >
        <div className={cn('inset-0 z-0 pointer-events-none', inShell ? 'absolute' : 'fixed')}>
          <GridDotsBackground />
        </div>

        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-24 relative z-10">
          {/* Header Card */}
          <Card className="bg-card border border-border rounded-xl mb-8">
            <CardContent className="p-4 md:p-6">
              <div className="mb-4">
                <BreadcrumbWithBack to="/docs">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/">Home</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/docs">Documentation</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Getting Started</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </BreadcrumbWithBack>
              </div>
              <div className="flex items-start gap-3">
                <BookOpen className="h-7 w-7 text-brand-cyan mt-1 shrink-0" />
                <div>
                  <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-foreground mb-1">
                    Getting Started
                  </h1>
                  <p className="text-muted-foreground font-mono text-sm">
                    Authenticate and make your first API call in under 5 minutes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-8">
            {/* Sidebar nav */}
            <aside className="hidden lg:block w-52 shrink-0">
              <div className={cn('sticky space-y-1', inShell ? 'top-4' : 'top-20')}>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
                  On this page
                </p>
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 rounded-md hover:bg-muted/40 group"
                  >
                    <ChevronRight
                      size={12}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-cyan"
                    />
                    {s.label}
                  </a>
                ))}
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-10">
              {/* ── Authentication ── */}
              <section id="authentication">
                <Card className="bg-card border border-border rounded-xl">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="p-2 bg-brand-cyan/10 rounded-lg">
                        <Key size={18} className="text-brand-cyan" />
                      </div>
                      <h2 className="text-xl font-semibold font-manrope text-foreground">
                        Authentication
                      </h2>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      All API requests require a{' '}
                      <code className="text-brand-cyan bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                        visant_sk_
                      </code>{' '}
                      API key passed as a{' '}
                      <code className="text-foreground bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                        Bearer
                      </code>{' '}
                      token in the{' '}
                      <code className="text-foreground bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                        Authorization
                      </code>{' '}
                      header.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Don't have a key yet?</span>
                      <Link
                        to="/settings/api-keys"
                        className="text-brand-cyan hover:text-brand-cyan/80 transition-colors flex items-center gap-1 font-mono text-xs"
                      >
                        Create an API key <ExternalLink size={12} />
                      </Link>
                    </div>
                    <div className="bg-muted/40 border border-border rounded-lg p-4">
                      <p className="text-xs font-mono text-muted-foreground mb-2">
                        OAuth 2.1 (for AI agents &amp; third-party apps)
                      </p>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Agents and apps can authenticate via{' '}
                        <code className="text-brand-cyan bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                          OAuth 2.1 + PKCE
                        </code>{' '}
                        with dynamic client registration. See{' '}
                        <Link
                          to="/settings/connected-apps"
                          className="text-brand-cyan hover:text-brand-cyan/80 transition-colors"
                        >
                          Connected Apps
                        </Link>{' '}
                        to manage authorized agents.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-2">
                        List available tools
                      </p>
                      <CodeBlock code={AUTH_CURL} language="bash" />
                    </div>
                    <div className="bg-muted/40 border border-border rounded-lg p-4">
                      <p className="text-xs font-mono text-muted-foreground mb-2">Available scopes</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          {
                            scope: 'read',
                            desc: 'Read resources and metadata',
                            color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
                          },
                          {
                            scope: 'write',
                            desc: 'Create and modify resources',
                            color: 'text-warning bg-warning/10 border-warning/30',
                          },
                          {
                            scope: 'generate',
                            desc: 'Invoke AI generation tools',
                            color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
                          },
                        ].map(({ scope, desc, color }) => (
                          <div
                            key={scope}
                            className={`text-xs font-mono px-2.5 py-1.5 rounded border ${color}`}
                          >
                            <span className="font-semibold">{scope}</span>
                            <span className="ml-2 opacity-70">{desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ── Brand Generation ── */}
              <section id="brand-generation">
                <Card className="bg-card border border-border rounded-xl">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Palette size={18} className="text-purple-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold font-manrope text-foreground">
                          Brand Generation
                        </h2>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          Scope required: <span className="text-purple-400">generate</span>
                        </p>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Generate complete brand guidelines — colors, typography, voice, and visual
                      direction — from a brand name and industry. Brand guidelines become input for
                      all subsequent generation tools.
                    </p>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-2">
                        Generate brand guidelines
                      </p>
                      <TabCode js={BRAND_JS} python={BRAND_PY} />
                    </div>
                    <div className="bg-muted/40 border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground space-y-1">
                      <p className="text-foreground font-semibold mb-2">
                        Tool: <span className="text-purple-400">generate-brand-guidelines</span>
                      </p>
                      <p>
                        <span className="text-foreground">brandName</span> — string, required
                      </p>
                      <p>
                        <span className="text-foreground">industry</span> — string, required
                      </p>
                      <p>
                        <span className="text-foreground">tone</span> — "professional" | "playful"
                        | "bold" | "minimal"
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ── Mockup Generation ── */}
              <section id="mockup-generation">
                <Card className="bg-card border border-border rounded-xl">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="p-2 bg-warning/10 rounded-lg">
                        <Image size={18} className="text-warning" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold font-manrope text-foreground">
                          Mockup Generation
                        </h2>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          Scope required: <span className="text-warning">generate</span>
                        </p>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Apply your artwork to professional product templates — apparel, packaging,
                      devices, print — and receive a rendered mockup image URL.
                    </p>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-2">
                        Generate a product mockup
                      </p>
                      <TabCode js={MOCKUP_JS} python={MOCKUP_PY} />
                    </div>
                    <div className="bg-muted/40 border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground space-y-1">
                      <p className="text-foreground font-semibold mb-2">
                        Tool: <span className="text-warning">mockup-generate</span>
                      </p>
                      <p>
                        <span className="text-foreground">templateId</span> — string, required
                      </p>
                      <p>
                        <span className="text-foreground">imageUrl</span> — string (public URL),
                        required
                      </p>
                      <p>
                        <span className="text-foreground">backgroundColor</span> — hex string,
                        optional
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ── Creative Studio ── */}
              <section id="creative-studio">
                <Card className="bg-card border border-border rounded-xl">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="p-2 bg-success/10 rounded-lg">
                        <Zap size={18} className="text-success" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold font-manrope text-foreground">
                          Creative Studio
                        </h2>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          Scope required: <span className="text-success">generate</span>
                        </p>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Generate on-brand creative assets — social media posts, banners, ads — using a
                      natural language prompt paired with your brand context. Brand guidelines are
                      used as generation input, not just documentation.
                    </p>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-2">
                        Generate a creative asset
                      </p>
                      <TabCode js={CREATIVE_JS} python={CREATIVE_PY} />
                    </div>
                    <div className="bg-muted/40 border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground space-y-1">
                      <p className="text-foreground font-semibold mb-2">
                        Tool: <span className="text-success">creative-generate</span>
                      </p>
                      <p>
                        <span className="text-foreground">prompt</span> — string, required
                      </p>
                      <p>
                        <span className="text-foreground">brandId</span> — string, optional (uses
                        brand context)
                      </p>
                      <p>
                        <span className="text-foreground">format</span> — "instagram-post" |
                        "banner" | "thumbnail" | "ad"
                      </p>
                      <p>
                        <span className="text-foreground">style</span> — "modern" | "classic" |
                        "bold" | "minimal"
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ── Next Steps ── */}
              <section id="next-steps">
                <Card className="bg-card border border-border rounded-xl">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold font-manrope text-foreground mb-5">
                      Next Steps
                    </h2>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Link
                        to="/api/docs"
                        className="group flex flex-col gap-2 p-4 bg-muted/40 border border-border rounded-lg hover:border-ring hover:bg-muted transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <BookOpen size={16} className="text-brand-cyan" />
                          <ChevronRight
                            size={14}
                            className="text-muted-foreground group-hover:text-brand-cyan transition-colors"
                          />
                        </div>
                        <p className="text-sm font-medium text-foreground">Full API Reference</p>
                        <p className="text-xs text-muted-foreground">
                          Browse all MCP tools with params and response schemas
                        </p>
                      </Link>
                      <Link
                        to="/settings/api-keys"
                        className="group flex flex-col gap-2 p-4 bg-muted/40 border border-border rounded-lg hover:border-ring hover:bg-muted transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <Key size={16} className="text-brand-cyan" />
                          <ChevronRight
                            size={14}
                            className="text-muted-foreground group-hover:text-brand-cyan transition-colors"
                          />
                        </div>
                        <p className="text-sm font-medium text-foreground">Manage API Keys</p>
                        <p className="text-xs text-muted-foreground">
                          Create, rotate, and scope your API keys
                        </p>
                      </Link>
                      <Link
                        to="/profile?tab=overview"
                        className="group flex flex-col gap-2 p-4 bg-muted/40 border border-border rounded-lg hover:border-ring hover:bg-muted transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <Zap size={16} className="text-brand-cyan" />
                          <ChevronRight
                            size={14}
                            className="text-muted-foreground group-hover:text-brand-cyan transition-colors"
                          />
                        </div>
                        <p className="text-sm font-medium text-foreground">Usage Dashboard</p>
                        <p className="text-xs text-muted-foreground">
                          Monitor request counts, credits, and quotas
                        </p>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
