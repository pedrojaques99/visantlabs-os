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
import { useTranslation } from '@/hooks/useTranslation';

// ─── Local CodeBlock component ──────────────────────────────────────────────

type Language = 'bash' | 'javascript' | 'python';

interface CodeBlockProps {
  code: string;
  language: Language;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const { t } = useTranslation();
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
    <div className="relative group rounded-xl overflow-hidden border border-border bg-muted">
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
        <span className="text-xs font-mono text-muted-foreground">{langLabel[language]}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 px-2 rounded hover:bg-muted"
          aria-label={t('gettingStarted.copyCode')}
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          <span>{copied ? t('gettingStarted.copied') : t('common.copy')}</span>
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
                : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-border-hover'
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
  { id: 'authentication', labelKey: 'gettingStarted.sections.authentication' },
  { id: 'brand-generation', labelKey: 'gettingStarted.sections.brand' },
  { id: 'mockup-generation', labelKey: 'gettingStarted.sections.mockup' },
  { id: 'creative-studio', labelKey: 'gettingStarted.sections.creative' },
  { id: 'next-steps', labelKey: 'gettingStarted.sections.next' },
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
        identity: {
          name: 'Acme Corp',
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
                'identity': {
                    'name': 'Acme Corp',
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
// result.result.content[0].text: JSON with generated mockup URL`;

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
# result['result']['content'][0]['text']: JSON with generated mockup URL`;

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
        format: '1:1',
      },
    },
  }),
});

const result = await response.json();
// result.result.content[0].text: JSON with generated creative layers`;

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
                'format': '1:1',
            },
        },
    },
)

result = response.json()
# result['result']['content'][0]['text']: JSON with generated creative layers`;

// ─── Page ────────────────────────────────────────────────────────────────────

const CODE_CLASS = 'text-foreground bg-muted px-1.5 py-0.5 rounded text-xs font-mono';

/** Troca {chave} no texto traduzido pelos nós informados (code, link). */
const Rich: React.FC<{ text: string; slots: Record<string, React.ReactNode> }> = ({
  text,
  slots,
}) => (
  <>
    {text.split(/(\{\w+\})/).map((part, i) => {
      const m = part.match(/^\{(\w+)\}$/);
      return m && slots[m[1]] !== undefined ? (
        <React.Fragment key={i}>{slots[m[1]]}</React.Fragment>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      );
    })}
  </>
);

export const GettingStartedPage: React.FC = () => {
  useLayout();
  const inShell = useInAppShell();
  const { t } = useTranslation();

  const code = (children: string) => <code className={CODE_CLASS}>{children}</code>;
  const scopes = [
    {
      scope: 'read',
      desc: t('gettingStarted.scopes.read'),
      color: 'text-foreground bg-chart-1/10 border-chart-1/40',
    },
    {
      scope: 'write',
      desc: t('gettingStarted.scopes.write'),
      color: 'text-warning bg-warning/10 border-warning/30',
    },
    {
      scope: 'generate',
      desc: t('gettingStarted.scopes.generate'),
      color: 'text-foreground bg-chart-4/10 border-chart-4/40',
    },
  ];
  const nextSteps = [
    {
      to: '/api/docs',
      icon: BookOpen,
      title: t('gettingStarted.next.reference.title'),
      desc: t('gettingStarted.next.reference.desc'),
    },
    {
      to: '/settings/api-keys',
      icon: Key,
      title: t('gettingStarted.next.keys.title'),
      desc: t('gettingStarted.next.keys.desc'),
    },
    {
      to: '/profile?tab=overview',
      icon: Zap,
      title: t('gettingStarted.next.usage.title'),
      desc: t('gettingStarted.next.usage.desc'),
    },
  ];
  const scopeRequired = (cls: string) => (
    <p className="text-xs text-muted-foreground mt-0.5">
      {t('gettingStarted.scopeRequired')} <span className={cn('font-mono', cls)}>generate</span>
    </p>
  );
  const specBox =
    'bg-muted/40 border border-border rounded-xl p-4 text-xs font-mono text-muted-foreground space-y-1';

  return (
    <>
      <SEO
        title={t('gettingStarted.seo.title')}
        description={t('gettingStarted.seo.description')}
      />
      <div
        className={cn(
          'bg-background text-muted-foreground relative',
          inShell ? 'min-h-full' : 'min-h-screen',
          inShell ? 'pt-6' : 'pt-12 md:pt-14'
        )}
      >
        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-24 relative z-10">
          {/* Header Card */}
          <Card className="bg-card border border-border rounded-xl mb-8">
            <CardContent className="p-4 md:p-6">
              <div className="mb-4">
                <BreadcrumbWithBack to="/docs">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/">{t('common.home')}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/docs">{t('gettingStarted.breadcrumbDocs')}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{t('gettingStarted.title')}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </BreadcrumbWithBack>
              </div>
              <div className="flex items-start gap-3">
                <BookOpen className="h-7 w-7 text-muted-foreground mt-1 shrink-0" />
                <div>
                  <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-foreground mb-1">
                    {t('gettingStarted.title')}
                  </h1>
                  <p className="text-muted-foreground text-sm">{t('gettingStarted.subtitle')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-8">
            {/* Sidebar nav */}
            <aside className="hidden lg:block w-52 shrink-0">
              <div className={cn('sticky space-y-1', inShell ? 'top-4' : 'top-20')}>
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  {t('gettingStarted.onThisPage')}
                </p>
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 rounded-md hover:bg-muted/40 group"
                  >
                    <ChevronRight
                      size={12}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-foreground"
                    />
                    {t(s.labelKey)}
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
                      <div className="p-2 bg-muted rounded-xl">
                        <Key size={18} className="text-muted-foreground" />
                      </div>
                      <h2 className="text-xl font-medium font-manrope text-foreground">
                        {t('gettingStarted.sections.authentication')}
                      </h2>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      <Rich
                        text={t('gettingStarted.auth.intro')}
                        slots={{
                          key: code('visant_sk_'),
                          bearer: code('Bearer'),
                          header: code('Authorization'),
                        }}
                      />
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{t('gettingStarted.auth.noKey')}</span>
                      <Link
                        to="/settings/api-keys"
                        className="text-foreground underline-offset-2 hover:underline flex items-center gap-1 text-xs"
                      >
                        {t('gettingStarted.auth.createKey')} <ExternalLink size={12} />
                      </Link>
                    </div>
                    <div className="bg-muted/40 border border-border rounded-xl p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t('gettingStarted.auth.oauthTitle')}
                      </p>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        <Rich
                          text={t('gettingStarted.auth.oauthBody')}
                          slots={{
                            oauth: code('OAuth 2.1 + PKCE'),
                            link: (
                              <Link
                                to="/settings/connected-apps"
                                className="text-foreground underline-offset-2 hover:underline"
                              >
                                {t('gettingStarted.auth.connectedApps')}
                              </Link>
                            ),
                          }}
                        />
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t('gettingStarted.auth.listTools')}
                      </p>
                      <CodeBlock code={AUTH_CURL} language="bash" />
                    </div>
                    <div className="bg-muted/40 border border-border rounded-xl p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t('gettingStarted.auth.scopesTitle')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {scopes.map(({ scope, desc, color }) => (
                          <div
                            key={scope}
                            className={`text-xs font-mono px-2.5 py-1.5 rounded border ${color}`}
                          >
                            <span className="font-medium">{scope}</span>
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
                      <div className="p-2 bg-muted rounded-xl">
                        <Palette size={18} className="text-muted-foreground" />
                      </div>
                      <div>
                        <h2 className="text-xl font-medium font-manrope text-foreground">
                          {t('gettingStarted.sections.brand')}
                        </h2>
                        {scopeRequired('text-foreground')}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t('gettingStarted.brand.intro')}
                    </p>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t('gettingStarted.brand.example')}
                      </p>
                      <TabCode js={BRAND_JS} python={BRAND_PY} />
                    </div>
                    <div className={specBox}>
                      <p className="text-foreground font-medium mb-2">
                        {t('gettingStarted.tool')}{' '}
                        <span className="font-mono">brand-guidelines-create</span>
                      </p>
                      <p>
                        <span className="text-foreground">identity.name</span>:{' '}
                        {t('gettingStarted.brand.paramName')}
                      </p>
                      <p>
                        <span className="text-foreground">identity.description</span>:{' '}
                        {t('gettingStarted.brand.paramDescription')}
                      </p>
                      <p>
                        <span className="text-foreground">colors, typography, strategy</span>:{' '}
                        {t('gettingStarted.brand.paramRest')}
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
                      <div className="p-2 bg-muted rounded-xl">
                        <Image size={18} className="text-muted-foreground" />
                      </div>
                      <div>
                        <h2 className="text-xl font-medium font-manrope text-foreground">
                          {t('gettingStarted.sections.mockup')}
                        </h2>
                        {scopeRequired('text-foreground')}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t('gettingStarted.mockup.intro')}
                    </p>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t('gettingStarted.mockup.example')}
                      </p>
                      <TabCode js={MOCKUP_JS} python={MOCKUP_PY} />
                    </div>
                    <div className={specBox}>
                      <p className="text-foreground font-medium mb-2">
                        {t('gettingStarted.tool')}{' '}
                        <span className="font-mono">mockup-generate</span>
                      </p>
                      <p>
                        <span className="text-foreground">prompt</span>:{' '}
                        {t('gettingStarted.mockup.paramPrompt')}
                      </p>
                      <p>
                        <span className="text-foreground">brandGuidelineId</span>:{' '}
                        {t('gettingStarted.paramOptionalString')}
                      </p>
                      <p>
                        <span className="text-foreground">referenceImages</span>:{' '}
                        {t('gettingStarted.mockup.paramReferences')}
                      </p>
                      <p>
                        <span className="text-foreground">aspectRatio</span>:{' '}
                        {t('gettingStarted.paramOptionalString')}
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
                      <div className="p-2 bg-muted rounded-xl">
                        <Zap size={18} className="text-muted-foreground" />
                      </div>
                      <div>
                        <h2 className="text-xl font-medium font-manrope text-foreground">
                          {t('gettingStarted.sections.creative')}
                        </h2>
                        {scopeRequired('text-foreground')}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t('gettingStarted.creative.intro')}
                    </p>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t('gettingStarted.creative.example')}
                      </p>
                      <TabCode js={CREATIVE_JS} python={CREATIVE_PY} />
                    </div>
                    <div className={specBox}>
                      <p className="text-foreground font-medium mb-2">
                        {t('gettingStarted.tool')}{' '}
                        <span className="font-mono">creative-generate</span>
                      </p>
                      <p>
                        <span className="text-foreground">prompt</span>:{' '}
                        {t('gettingStarted.creative.paramPrompt')}
                      </p>
                      <p>
                        <span className="text-foreground">brandGuidelineId</span>:{' '}
                        {t('gettingStarted.creative.paramBrand')}
                      </p>
                      <p>
                        <span className="text-foreground">format</span>:{' '}
                        {t('gettingStarted.creative.paramFormat')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ── Next Steps ── */}
              <section id="next-steps">
                <Card className="bg-card border border-border rounded-xl">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-medium font-manrope text-foreground mb-5">
                      {t('gettingStarted.sections.next')}
                    </h2>
                    <div className="grid sm:grid-cols-3 gap-4">
                      {nextSteps.map(({ to, icon: Icon, title, desc }) => (
                        <Link
                          key={to}
                          to={to}
                          className="group flex flex-col gap-2 p-4 bg-muted/40 border border-border rounded-xl hover:border-border-hover hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <Icon size={16} className="text-muted-foreground" />
                            <ChevronRight
                              size={14}
                              className="text-muted-foreground group-hover:text-foreground transition-colors"
                            />
                          </div>
                          <p className="text-sm font-medium text-foreground">{title}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </Link>
                      ))}
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
