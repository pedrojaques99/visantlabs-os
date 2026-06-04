import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { AuthModal } from '../components/AuthModal';
import { useLayout } from '../hooks/useLayout';
import { authService } from '../services/authService';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || '/api';

const MCP_URL = 'https://api.visantlabs.com/api/mcp';

interface InviteData {
  invite: {
    token: string;
    label: string;
    role: string;
    status: string;
    expiresAt: string | null;
  };
  brand: {
    name: string;
    logo: string | null;
    colors: Array<{ hex: string; name?: string; role?: string }>;
  };
  creator: { name: string; picture: string | null } | null;
}

type Step = 'loading' | 'preview' | 'auth' | 'accepting' | 'connected' | 'error';

function buildCursorDeepLink() {
  const config = btoa(JSON.stringify({ type: 'http', url: MCP_URL }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=Visant%20Labs&config=${config}`;
}

function buildVscodeDeepLink() {
  const config = JSON.stringify({
    name: 'Visant Labs',
    type: 'http',
    url: MCP_URL,
  });
  return `vscode://mcp/install?${encodeURIComponent(config)}`;
}

const LLM_OPTIONS = [
  {
    id: 'cursor',
    name: 'Cursor',
    icon: '/icons/cursor.svg',
    deepLink: buildCursorDeepLink(),
    instructions: null,
  },
  {
    id: 'vscode',
    name: 'VS Code',
    icon: '/icons/vscode.svg',
    deepLink: buildVscodeDeepLink(),
    instructions: null,
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: '/icons/claude.svg',
    deepLink: null,
    instructions: 'Settings → Connectors → Add custom connector → Paste URL',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    icon: '/icons/chatgpt.svg',
    deepLink: null,
    instructions: 'Settings → Apps → Developer Mode → Create App → Paste URL',
  },
  {
    id: 'cli',
    name: 'Claude Code',
    icon: '/icons/claude.svg',
    deepLink: null,
    instructions: null,
    cliCommand: `claude mcp add --transport http visant ${MCP_URL}`,
  },
] as const;

export default function ConnectPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();

  const [step, setStep] = useState<Step>('loading');
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [acceptResult, setAcceptResult] = useState<{ brandName: string; role: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link');
      setStep('error');
      return;
    }
    fetchInvite(token);
  }, [token]);

  async function fetchInvite(t: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/brand-guidelines/invite/${t}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invite not found');
        setStep('error');
        return;
      }
      const data: InviteData = await res.json();
      setInvite(data);
      setStep('preview');
    } catch {
      setError('Failed to load invite');
      setStep('error');
    }
  }

  async function acceptInvite() {
    if (!token) return;
    setStep('accepting');
    try {
      const authToken = authService.getToken();
      const res = await fetch(`${API_BASE_URL}/brand-guidelines/invite/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to accept invite');
        setStep('error');
        return;
      }
      const data = await res.json();
      setAcceptResult({ brandName: data.brandName, role: data.role });
      setStep('connected');
    } catch {
      setError('Failed to accept invite');
      setStep('error');
    }
  }

  function handleAuthSuccess() {
    setShowAuth(false);
    acceptInvite();
  }

  function handleConnect() {
    if (isAuthenticated) {
      acceptInvite();
    } else {
      setShowAuth(true);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Loading ──
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error ──
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl font-mono font-bold text-foreground/20">404</div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            Go home
          </Button>
        </div>
      </div>
    );
  }

  const brandName = invite?.brand.name || 'Brand Kit';
  const brandLogo = invite?.brand.logo;
  const brandColors = invite?.brand.colors || [];
  const creatorName = invite?.creator?.name || 'Someone';

  // ── Preview (invite details + connect button) ──
  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8">
          {/* Brand card */}
          <div className="border border-border rounded-lg p-6 space-y-5">
            <div className="flex items-center gap-4">
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={brandName}
                  className="w-12 h-12 rounded-md object-contain bg-muted"
                />
              ) : (
                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                  {brandName[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-lg font-semibold text-foreground">{brandName}</h1>
                <p className="text-xs text-muted-foreground">
                  {creatorName} invited you as {invite?.invite.role}
                </p>
              </div>
            </div>

            {/* Color preview */}
            {brandColors.length > 0 && (
              <div className="flex gap-1.5">
                {brandColors.map((c, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border border-border"
                    style={{ backgroundColor: c.hex }}
                    title={c.name || c.hex}
                  />
                ))}
              </div>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed">
              Accept this invite to connect <strong>{brandName}</strong> to your
              AI tools. All brand guidelines, colors, typography, and assets will
              be available in your LLM of choice.
            </p>

            <Button className="w-full" onClick={handleConnect}>
              Accept &amp; Connect
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Powered by{' '}
            <a href="https://visantlabs.com" className="underline hover:text-foreground">
              Visant Labs
            </a>
          </p>
        </div>

        {showAuth && (
          <AuthModal
            isOpen={showAuth}
            onClose={() => setShowAuth(false)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </div>
    );
  }

  // ── Accepting (spinner) ──
  if (step === 'accepting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Connecting brand...</p>
        </div>
      </div>
    );
  }

  // ── Connected (deep links + instructions) ──
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-8">
        {/* Success header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            {acceptResult?.brandName || brandName} connected
          </h1>
          <p className="text-sm text-muted-foreground">
            Now connect to your AI tool of choice.
          </p>
        </div>

        {/* MCP URL copy */}
        <div className="border border-border rounded-lg p-4 space-y-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            MCP Server URL
          </label>
          <div className="flex gap-2">
            <code className="flex-1 bg-muted rounded px-3 py-2 text-sm font-mono text-foreground truncate">
              {MCP_URL}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(MCP_URL, 'mcp-url')}
            >
              {copied === 'mcp-url' ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* LLM connection options */}
        <div className="space-y-2">
          {LLM_OPTIONS.map((llm) => (
            <div
              key={llm.id}
              className="border border-border rounded-lg p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-muted-foreground">
                    {llm.name[0]}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{llm.name}</div>
                  {llm.instructions && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {llm.instructions}
                    </div>
                  )}
                  {'cliCommand' in llm && llm.cliCommand && (
                    <code className="text-[11px] text-muted-foreground font-mono">
                      {llm.cliCommand}
                    </code>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {llm.deepLink ? (
                  <Button size="sm" asChild>
                    <a href={llm.deepLink}>Connect</a>
                  </Button>
                ) : 'cliCommand' in llm && llm.cliCommand ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(llm.cliCommand!, `cli-${llm.id}`)}
                  >
                    {copied === `cli-${llm.id}` ? 'Copied' : 'Copy'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(MCP_URL, `url-${llm.id}`)}
                  >
                    {copied === `url-${llm.id}` ? 'Copied' : 'Copy URL'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center space-y-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/brand-guidelines')}>
            Go to Dashboard
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Your brand is now accessible via 100+ AI tools.{' '}
            <a href="/developer/getting-started" className="underline hover:text-foreground">
              View docs
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
