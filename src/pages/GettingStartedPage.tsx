import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Copy, Check, Key, Zap, Image, Palette, ChevronRight, ExternalLink } from 'lucide-react';
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
} from "../components/ui/BreadcrumbWithBack";

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
      await navigator.clipboard.writeText(code);
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
    <div className="relative group rounded-lg overflow-hidden border border-neutral-800/70 bg-neutral-950">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/80 border-b border-neutral-800/50">
        <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">{langLabel[language]}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors py-0.5 px-2 rounded hover:bg-neutral-800/60"
          aria-label="Copy code"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm font-mono text-neutral-300 leading-relaxed">
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
                : 'text-neutral-500 hover:text-neutral-300 border border-transparent hover:border-neutral-700/50'
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

const AUTH_CURL = `curl -X POST https://api.visant.dev/api/mcp \\
  -H "Authorization: Bearer visant_sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"method": "tools/call", "params": {"name": "list-tools", "arguments": {}}}'`;

const BRAND_JS = `const response = await fetch('https://api.visant.dev/api/mcp', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer visant_sk_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'generate-brand-guidelines',
      arguments: {
        brandName: 'Acme Corp',
        industry: 'Technology',
        tone: 'professional',
      },
    },
  }),
});

const result = await response.json();
console.log(result.content);`;

const BRAND_PY = `import requests

response = requests.post(
    'https://api.visant.dev/api/mcp',
    headers={
        'Authorization': 'Bearer visant_sk_YOUR_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'method': 'tools/call',
        'params': {
            'name': 'generate-brand-guidelines',
            'arguments': {
                'brandName': 'Acme Corp',
                'industry': 'Technology',
                'tone': 'professional',
            },
        },
    },
)

result = response.json()
print(result['content'])`;

const MOCKUP_JS = `const response = await fetch('https://api.visant.dev/api/mcp', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer visant_sk_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'mockup-generate',
      arguments: {
        templateId: 'tshirt-front',
        imageUrl: 'https://your-cdn.com/artwork.png',
        backgroundColor: '#ffffff',
      },
    },
  }),
});

const result = await response.json();
// result.content[0].url — generated mockup image URL`;

const MOCKUP_PY = `import requests

response = requests.post(
    'https://api.visant.dev/api/mcp',
    headers={
        'Authorization': 'Bearer visant_sk_YOUR_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'method': 'tools/call',
        'params': {
            'name': 'mockup-generate',
            'arguments': {
                'templateId': 'tshirt-front',
                'imageUrl': 'https://your-cdn.com/artwork.png',
                'backgroundColor': '#ffffff',
            },
        },
    },
)

result = response.json()
# result['content'][0]['url'] — generated mockup image URL`;

const CREATIVE_JS = `const response = await fetch('https://api.visant.dev/api/mcp', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer visant_sk_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'creative-generate',
      arguments: {
        prompt: 'A bold social media banner for a tech startup launch',
        brandId: 'YOUR_BRAND_ID',
        format: 'instagram-post',
        style: 'modern',
      },
    },
  }),
});

const result = await response.json();
// result.content[0].url — generated creative asset URL`;

const CREATIVE_PY = `import requests

response = requests.post(
    'https://api.visant.dev/api/mcp',
    headers={
        'Authorization': 'Bearer visant_sk_YOUR_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'method': 'tools/call',
        'params': {
            'name': 'creative-generate',
            'arguments': {
                'prompt': 'A bold social media banner for a tech startup launch',
                'brandId': 'YOUR_BRAND_ID',
                'format': 'instagram-post',
                'style': 'modern',
            },
        },
    },
)

result = response.json()
# result['content'][0]['url'] — generated creative asset URL`;

// ─── Page ────────────────────────────────────────────────────────────────────

export const GettingStartedPage: React.FC = () => {
  useLayout();

  return (
    <>
      <SEO
        title="Getting Started — Visant API"
        description="Follow a step-by-step guide to authenticate and call Visant's AI brand, mockup, and creative generation tools via API."
      />
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 relative">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <GridDotsBackground />
        </div>

        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-24 relative z-10">

          {/* Header Card */}
          <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl mb-8">
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
                        <Link to="/api/docs">API Docs</Link>
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
                  <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-neutral-200 mb-1">
                    Getting Started
                  </h1>
                  <p className="text-neutral-500 font-mono text-sm">
                    Authenticate and make your first API call in under 5 minutes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-8">
            {/* Sidebar nav */}
            <aside className="hidden lg:block w-52 shrink-0">
              <div className="sticky top-20 space-y-1">
                <p className="text-xs font-mono text-neutral-600 uppercase tracking-wider mb-3">On this page</p>
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-200 transition-colors py-1.5 px-2 rounded-md hover:bg-neutral-800/40 group"
                  >
                    <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-cyan" />
                    {s.label}
                  </a>
                ))}
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-10">

              {/* ── Authentication ── */}
              <section id="authentication">
                <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="p-2 bg-brand-cyan/10 rounded-lg">
                        <Key size={18} className="text-brand-cyan" />
                      </div>
                      <h2 className="text-xl font-semibold font-manrope text-neutral-200">Authentication</h2>
                    </div>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                      All API requests require a <code className="text-brand-cyan bg-neutral-800/60 px-1.5 py-0.5 rounded text-xs font-mono">visant_sk_</code> API key passed as a{' '}
                      <code className="text-neutral-300 bg-neutral-800/60 px-1.5 py-0.5 rounded text-xs font-mono">Bearer</code> token in the{' '}
                      <code className="text-neutral-300 bg-neutral-800/60 px-1.5 py-0.5 rounded text-xs font-mono">Authorization</code> header.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <span>Don't have a key yet?</span>
                      <Link
                        to="/settings/api-keys"
                        className="text-brand-cyan hover:text-brand-cyan/80 transition-colors flex items-center gap-1 font-mono text-xs"
                      >
                        Create an API key <ExternalLink size={12} />
                      </Link>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-neutral-500 mb-2">List available tools</p>
                      <CodeBlock code={AUTH_CURL} language="bash" />
                    </div>
                    <div className="bg-neutral-800/30 border border-neutral-700/30 rounded-lg p-4">
                      <p className="text-xs font-mono text-neutral-500 mb-2">Available scopes</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { scope: 'read', desc: 'Read resources and metadata', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
                          { scope: 'write', desc: 'Create and modify resources', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
                          { scope: 'generate', desc: 'Invoke AI generation tools', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
                        ].map(({ scope, desc, color }) => (
                          <div key={scope} className={`text-xs font-mono px-2.5 py-1.5 rounded border ${color}`}>
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
                <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Palette size={18} className="text-purple-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold font-manrope text-neutral-200">Brand Generation</h2>
                        <p className="text-xs font-mono text-neutral-600 mt-0.5">Scope required: <span className="text-purple-400">generate</span></p>
                      </div>
                    </div>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                      Generate complete brand guidelines — colors, typography, voice, and visual direction — from a brand name and industry. Brand guidelines become input for all subsequent generation tools.
                    </p>
                    <div>
                      <p className="text-xs font-mono text-neutral-500 mb-2">Generate brand guidelines</p>
                      <TabCode js={BRAND_JS} python={BRAND_PY} />
                    </div>
                    <div className="bg-neutral-800/30 border border-neutral-700/30 rounded-lg p-4 text-xs font-mono text-neutral-500 space-y-1">
                      <p className="text-neutral-400 font-semibold mb-2">Tool: <span className="text-purple-400">generate-brand-guidelines</span></p>
                      <p><span className="text-neutral-300">brandName</span> — string, required</p>
                      <p><span className="text-neutral-300">industry</span> — string, required</p>
                      <p><span className="text-neutral-300">tone</span> — "professional" | "playful" | "bold" | "minimal"</p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ── Mockup Generation ── */}
              <section id="mockup-generation">
                <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="p-2 bg-amber-500/10 rounded-lg">
                        <Image size={18} className="text-amber-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold font-manrope text-neutral-200">Mockup Generation</h2>
                        <p className="text-xs font-mono text-neutral-600 mt-0.5">Scope required: <span className="text-amber-400">generate</span></p>
                      </div>
                    </div>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                      Apply your artwork to professional product templates — apparel, packaging, devices, print — and receive a rendered mockup image URL.
                    </p>
                    <div>
                      <p className="text-xs font-mono text-neutral-500 mb-2">Generate a product mockup</p>
                      <TabCode js={MOCKUP_JS} python={MOCKUP_PY} />
                    </div>
                    <div className="bg-neutral-800/30 border border-neutral-700/30 rounded-lg p-4 text-xs font-mono text-neutral-500 space-y-1">
                      <p className="text-neutral-400 font-semibold mb-2">Tool: <span className="text-amber-400">mockup-generate</span></p>
                      <p><span className="text-neutral-300">templateId</span> — string, required</p>
                      <p><span className="text-neutral-300">imageUrl</span> — string (public URL), required</p>
                      <p><span className="text-neutral-300">backgroundColor</span> — hex string, optional</p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ── Creative Studio ── */}
              <section id="creative-studio">
                <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Zap size={18} className="text-green-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold font-manrope text-neutral-200">Creative Studio</h2>
                        <p className="text-xs font-mono text-neutral-600 mt-0.5">Scope required: <span className="text-green-400">generate</span></p>
                      </div>
                    </div>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                      Generate on-brand creative assets — social media posts, banners, ads — using a natural language prompt paired with your brand context. Brand guidelines are used as generation input, not just documentation.
                    </p>
                    <div>
                      <p className="text-xs font-mono text-neutral-500 mb-2">Generate a creative asset</p>
                      <TabCode js={CREATIVE_JS} python={CREATIVE_PY} />
                    </div>
                    <div className="bg-neutral-800/30 border border-neutral-700/30 rounded-lg p-4 text-xs font-mono text-neutral-500 space-y-1">
                      <p className="text-neutral-400 font-semibold mb-2">Tool: <span className="text-green-400">creative-generate</span></p>
                      <p><span className="text-neutral-300">prompt</span> — string, required</p>
                      <p><span className="text-neutral-300">brandId</span> — string, optional (uses brand context)</p>
                      <p><span className="text-neutral-300">format</span> — "instagram-post" | "banner" | "thumbnail" | "ad"</p>
                      <p><span className="text-neutral-300">style</span> — "modern" | "classic" | "bold" | "minimal"</p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ── Next Steps ── */}
              <section id="next-steps">
                <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold font-manrope text-neutral-200 mb-5">Next Steps</h2>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Link
                        to="/api/docs"
                        className="group flex flex-col gap-2 p-4 bg-neutral-800/30 border border-neutral-700/40 rounded-lg hover:border-neutral-700 hover:bg-neutral-800/60 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <BookOpen size={16} className="text-brand-cyan" />
                          <ChevronRight size={14} className="text-neutral-600 group-hover:text-brand-cyan transition-colors" />
                        </div>
                        <p className="text-sm font-medium text-neutral-300">Full API Reference</p>
                        <p className="text-xs text-neutral-600">Browse all 93 tools with params and response schemas</p>
                      </Link>
                      <Link
                        to="/settings/api-keys"
                        className="group flex flex-col gap-2 p-4 bg-neutral-800/30 border border-neutral-700/40 rounded-lg hover:border-neutral-700 hover:bg-neutral-800/60 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <Key size={16} className="text-brand-cyan" />
                          <ChevronRight size={14} className="text-neutral-600 group-hover:text-brand-cyan transition-colors" />
                        </div>
                        <p className="text-sm font-medium text-neutral-300">Manage API Keys</p>
                        <p className="text-xs text-neutral-600">Create, rotate, and scope your API keys</p>
                      </Link>
                      <Link
                        to="/developer/usage"
                        className="group flex flex-col gap-2 p-4 bg-neutral-800/30 border border-neutral-700/40 rounded-lg hover:border-neutral-700 hover:bg-neutral-800/60 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <Zap size={16} className="text-brand-cyan" />
                          <ChevronRight size={14} className="text-neutral-600 group-hover:text-brand-cyan transition-colors" />
                        </div>
                        <p className="text-sm font-medium text-neutral-300">Usage Dashboard</p>
                        <p className="text-xs text-neutral-600">Monitor request counts, credits, and quotas</p>
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
