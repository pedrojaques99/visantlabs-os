import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/button';
import { AuthModal } from '../components/AuthModal';
import { useLayout } from '../hooks/useLayout';
import { authService } from '../services/authService';
import { cn } from '../lib/utils';
import { Check, Copy, ArrowRight, ExternalLink, Terminal, ChevronRight } from 'lucide-react';

const API = (import.meta as any).env?.VITE_API_URL || '/api';

const MCP_URL = 'https://api.visantlabs.com/api/mcp';

// ── Types ──

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

type Step = 'loading' | 'invite' | 'auth' | 'accepting' | 'connected' | 'error';

// ── Deep links ──

function cursorLink() {
  const cfg = btoa(JSON.stringify({ type: 'http', url: MCP_URL }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=Visant%20Labs&config=${cfg}`;
}

function vscodeLink() {
  const cfg = JSON.stringify({ name: 'Visant Labs', type: 'http', url: MCP_URL });
  return `vscode://mcp/install?${encodeURIComponent(cfg)}`;
}

// Primary, hand-held guides for non-technical clients (their most likely tools).
const ASSISTANTS = [
  {
    id: 'claude',
    name: 'Claude',
    tag: 'Recommended',
    open: 'https://claude.ai/settings/connectors',
    steps: [
      'Open Claude → Settings → Connectors',
      'Click "Add custom connector"',
      'Paste the link below',
      'Sign in with your account when Claude asks',
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    tag: '',
    open: 'https://chatgpt.com',
    steps: [
      'Open ChatGPT → Settings → Connectors',
      'Add a connector',
      'Paste the link below',
      'Sign in with your account when ChatGPT asks',
    ],
  },
] as const;

// Collapsed under "For developers".
const DEV_PROVIDERS = [
  { id: 'cursor', name: 'Cursor', sub: 'One-click install', href: cursorLink(), action: 'connect' as const },
  { id: 'vscode', name: 'VS Code', sub: 'One-click install', href: vscodeLink(), action: 'connect' as const },
  {
    id: 'cli',
    name: 'Terminal',
    sub: `claude mcp add --transport http visant ${MCP_URL}`,
    action: 'cli' as const,
    cli: `claude mcp add --transport http visant ${MCP_URL}`,
  },
] as const;

// Copy-ready first prompts so the client immediately feels the value.
const examplePrompts = (brand: string) => [
  `Create an on-brand Instagram post for ${brand}.`,
  `Write a product description in ${brand}'s tone of voice.`,
  `What are ${brand}'s colors, fonts and logos?`,
];

// ── Animations ──

const ease = [0.25, 0.46, 0.45, 0.94] as const;
const fadeIn = { opacity: 0, y: 8 };
const fadeVisible = { opacity: 1, y: 0 };
const fadeOut = { opacity: 0, y: -8 };
const dur = { duration: 0.35, ease };

const staggerVariants = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease } },
};

// ── Component ──

export default function ConnectPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();

  const [step, setStep] = useState<Step>('loading');
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid link');
      setStep('error');
      return;
    }
    fetchInvite(token);
  }, [token]);

  async function fetchInvite(t: string) {
    try {
      const res = await fetch(`${API}/brand-guidelines/invite/${t}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'This invite is no longer available');
        setStep('error');
        return;
      }
      const data: InviteData = await res.json();
      setInvite(data);
      setBrandName(data.brand.name || 'Brand Kit');
      setStep('invite');
    } catch {
      setError('Unable to load invite');
      setStep('error');
    }
  }

  async function accept() {
    if (!token) return;
    setStep('accepting');
    try {
      const authToken = authService.getToken();
      const res = await fetch(`${API}/brand-guidelines/invite/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Could not accept invite');
        setStep('error');
        return;
      }
      const data = await res.json();
      setBrandName(data.brandName || brandName);
      setStep('connected');
    } catch {
      setError('Connection failed');
      setStep('error');
    }
  }

  function handleConnect() {
    if (isAuthenticated) {
      accept();
    } else {
      setShowAuth(true);
    }
  }

  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }, []);

  const logo = invite?.brand.logo;
  const colors = invite?.brand.colors || [];
  const creator = invite?.creator?.name;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <AnimatePresence mode="wait">
        {/* ── Loading ── */}
        {step === 'loading' && (
          <motion.div
            key="load"
            initial={fadeIn}
            animate={fadeVisible}
            exit={fadeOut}
            transition={dur}
            className="flex flex-col items-center gap-3"
          >
            <Spinner />
            <p className="text-[13px] text-muted-foreground">Loading invite...</p>
          </motion.div>
        )}

        {/* ── Error ── */}
        {step === 'error' && (
          <motion.div
            key="err"
            initial={fadeIn}
            animate={fadeVisible}
            exit={fadeOut}
            transition={dur}
            className="max-w-sm w-full text-center space-y-5"
          >
            <div className="text-5xl font-mono font-bold text-foreground/10 select-none">?</div>
            <div className="space-y-1.5">
              <p className="text-sm text-foreground/80">{error}</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                This connect link may have expired or already been used. Open your brand link again
                and tap <span className="text-foreground/70">Connect</span> for a fresh one — or ask
                the team that shared it to resend.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/')}
            >
              Back to home
            </Button>
          </motion.div>
        )}

        {/* ── Invite preview ── */}
        {step === 'invite' && invite && (
          <motion.div
            key="inv"
            initial={fadeIn}
            animate={fadeVisible}
            exit={fadeOut}
            transition={dur}
            className="max-w-[420px] w-full space-y-6"
          >
            {/* Brand identity */}
            <motion.div
              className="flex flex-col items-center text-center gap-4"
              variants={staggerVariants}
              initial="initial"
              animate="animate"
            >
              <motion.div variants={itemVariants}>
                {logo ? (
                  <img
                    src={logo}
                    alt={brandName}
                    className="w-16 h-16 rounded-2xl object-contain bg-muted/50 ring-1 ring-border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 ring-1 ring-border flex items-center justify-center">
                    <span className="text-2xl font-semibold text-muted-foreground">
                      {brandName[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground tracking-tight">
                  {brandName}
                </h1>
                {creator && (
                  <p className="text-[13px] text-muted-foreground">Invited by {creator}</p>
                )}
              </motion.div>

              {/* Color strip */}
              {colors.length > 0 && (
                <motion.div variants={itemVariants} className="flex gap-1">
                  {colors.map((c, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full ring-1 ring-black/5 dark:ring-white/10 transition-transform hover:scale-110"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </motion.div>
              )}
            </motion.div>

            {/* Description */}
            <motion.p
              variants={itemVariants}
              className="text-[13px] text-muted-foreground text-center leading-relaxed max-w-xs mx-auto"
            >
              Connect <span className="text-foreground/80 font-medium">{brandName}</span> to your AI
              assistant (Claude, ChatGPT…). It will then design, write and create on-brand —
              colors, fonts, logos and voice, automatically.
            </motion.p>

            {/* CTA */}
            <motion.div variants={itemVariants} className="space-y-2">
              <Button
                className="w-full h-11 text-sm font-medium relative overflow-hidden group"
                onClick={handleConnect}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {isAuthenticated ? 'Accept & Connect' : 'Create free account & connect'}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Button>
              {!isAuthenticated && (
                <p className="text-[11px] text-muted-foreground/70 text-center">
                  Free — sign in with Google in one click.
                </p>
              )}
            </motion.div>

            <Watermark />
          </motion.div>
        )}

        {/* ── Accepting ── */}
        {step === 'accepting' && (
          <motion.div
            key="acc"
            initial={fadeIn}
            animate={fadeVisible}
            exit={fadeOut}
            transition={dur}
            className="flex flex-col items-center gap-3"
          >
            <Spinner />
            <p className="text-[13px] text-muted-foreground">Connecting {brandName}...</p>
          </motion.div>
        )}

        {/* ── Connected ── */}
        {step === 'connected' && (
          <motion.div
            key="done"
            initial={fadeIn}
            animate={fadeVisible}
            exit={fadeOut}
            transition={dur}
            className="max-w-[460px] w-full space-y-8"
          >
            {/* Success */}
            <motion.div
              className="flex flex-col items-center text-center gap-3"
              variants={staggerVariants}
              initial="initial"
              animate="animate"
            >
              <motion.div
                variants={itemVariants}
                className="w-12 h-12 rounded-full bg-success/10 ring-1 ring-success/20 flex items-center justify-center"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Check className="w-5 h-5 text-success" strokeWidth={2.5} />
              </motion.div>
              <motion.h1
                variants={itemVariants}
                className="text-lg font-semibold text-foreground tracking-tight"
              >
                {brandName} is connected
              </motion.h1>
              <motion.p
                variants={itemVariants}
                className="text-[13px] text-muted-foreground max-w-sm mx-auto leading-relaxed"
              >
                Two quick steps and your AI assistant will design, write and create on-brand —
                automatically.
              </motion.p>
            </motion.div>

            {/* Step 1 — connect your assistant */}
            <motion.div variants={itemVariants} className="space-y-3">
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                1 · Connect your assistant
              </p>
              {ASSISTANTS.map((a) => (
                <AssistantCard key={a.id} assistant={a} copied={copied} onCopy={copy} />
              ))}

              {/* Developers — collapsed */}
              <details className="group rounded-xl border border-border/50 overflow-hidden">
                <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer list-none text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  For developers (Cursor, VS Code, Terminal)
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                </summary>
                <div className="p-2 pt-0 space-y-1.5">
                  {DEV_PROVIDERS.map((p) => (
                    <ProviderRow key={p.id} provider={p} copied={copied} onCopy={copy} />
                  ))}
                </div>
              </details>
            </motion.div>

            {/* Step 2 — try it now */}
            <motion.div variants={itemVariants} className="space-y-3">
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                2 · Try it — open your assistant and ask
              </p>
              <div className="space-y-1.5">
                {examplePrompts(brandName).map((p) => (
                  <PromptChip key={p} text={p} copied={copied} onCopy={copy} />
                ))}
              </div>
            </motion.div>

            {/* Footer */}
            <motion.div variants={itemVariants} className="flex flex-col items-center gap-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground text-[13px]"
                onClick={() => navigate('/brand-guidelines')}
              >
                Go to dashboard
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
              <Watermark />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth modal */}
      {showAuth && (
        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false);
            accept();
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ──

function Spinner() {
  return (
    <div className="relative w-5 h-5">
      <div className="absolute inset-0 rounded-full border-2 border-neutral-800" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground animate-spin" />
    </div>
  );
}

function Watermark() {
  return (
    <p className="text-[11px] text-muted-foreground/50 text-center select-none">
      via{' '}
      <a
        href="https://visantlabs.com"
        className="hover:text-muted-foreground transition-colors"
        target="_blank"
        rel="noopener"
      >
        Visant Labs
      </a>
    </p>
  );
}

function CopyBtn({
  text,
  id,
  copied,
  onCopy,
  className,
}: {
  text: string;
  id: string;
  copied: string | null;
  onCopy: (t: string, id: string) => void;
  className?: string;
}) {
  const isCopied = copied === id;
  return (
    <button
      onClick={() => onCopy(text, id)}
      className={cn(
        'inline-flex items-center gap-1.5 text-[12px] font-medium rounded-md px-2.5 py-1',
        'bg-transparent hover:bg-muted/80 text-muted-foreground hover:text-foreground',
        'transition-all duration-200 active:scale-95',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isCopied ? (
          <motion.span
            key="ok"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1 text-success"
          >
            <Check className="w-3 h-3" /> Copied
          </motion.span>
        ) : (
          <motion.span
            key="cp"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1"
          >
            <Copy className="w-3 h-3" /> Copy
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function AssistantCard({
  assistant,
  copied,
  onCopy,
}: {
  assistant: (typeof ASSISTANTS)[number];
  copied: string | null;
  onCopy: (t: string, id: string) => void;
}) {
  const a = assistant;
  return (
    <div className="rounded-xl border border-border/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <ProviderIcon id={a.id} />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-foreground">{a.name}</span>
            {a.tag && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan font-medium shrink-0">
                {a.tag}
              </span>
            )}
          </div>
        </div>
        <a
          href={a.open}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          Open <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <ol className="space-y-1.5">
        {a.steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-[12px] text-muted-foreground leading-snug">
            <span className="text-foreground/40 font-mono shrink-0">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-muted/40 border border-border/60">
        <code className="flex-1 text-[11px] font-mono text-foreground/70 truncate select-all">
          {MCP_URL}
        </code>
        <CopyBtn text={MCP_URL} id={`url-${a.id}`} copied={copied} onCopy={onCopy} />
      </div>
    </div>
  );
}

function PromptChip({
  text,
  copied,
  onCopy,
}: {
  text: string;
  copied: string | null;
  onCopy: (t: string, id: string) => void;
}) {
  const id = `prompt-${text}`;
  const isCopied = copied === id;
  return (
    <button
      type="button"
      onClick={() => onCopy(text, id)}
      className={cn(
        'group w-full text-left flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200',
        isCopied
          ? 'border-success/30 bg-success/5'
          : 'border-border/60 hover:border-border hover:bg-muted/20'
      )}
    >
      <span className="text-[12px] text-foreground/80 leading-snug">{text}</span>
      {isCopied ? (
        <Check className="w-3.5 h-3.5 text-success shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}

function ProviderRow({
  provider,
  copied,
  onCopy,
}: {
  provider: (typeof DEV_PROVIDERS)[number];
  copied: string | null;
  onCopy: (t: string, id: string) => void;
}) {
  const p = provider;

  return (
    <div
      className={cn(
        'group flex items-center justify-between rounded-xl border border-border/60 px-4 py-3',
        'hover:border-border hover:bg-muted/20 transition-all duration-200'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <ProviderIcon id={p.id} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{p.name}</div>
          {p.action === 'cli' ? (
            <code className="text-[11px] text-muted-foreground font-mono truncate block max-w-[260px]">
              {p.sub}
            </code>
          ) : (
            <div className="text-[11px] text-muted-foreground">{p.sub}</div>
          )}
        </div>
      </div>

      <div className="shrink-0 ml-3">
        {p.action === 'connect' ? (
          <a
            href={p.href}
            className={cn(
              'inline-flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-3 py-1.5',
              'bg-foreground text-background hover:bg-foreground/90',
              'transition-all duration-200 active:scale-95'
            )}
          >
            Connect
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <CopyBtn text={p.cli!} id={`cli-${p.id}`} copied={copied} onCopy={onCopy} />
        )}
      </div>
    </div>
  );
}

function ProviderIcon({ id }: { id: string }) {
  const base = 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors';

  if (id === 'cursor') {
    return (
      <div className={cn(base, 'bg-neutral-900 dark:bg-white/10')}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
          <path d="M5.868 2.75L10 12l-4.132 9.25L2 12l3.868-9.25zM13.132 2.75L22 12l-8.868 9.25L9 12l4.132-9.25z" />
        </svg>
      </div>
    );
  }
  if (id === 'vscode') {
    return (
      <div className={cn(base, 'bg-[#007ACC]/10')}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#007ACC]" fill="currentColor">
          <path d="M17.583 2.296L9.23 9.652l-4.38-3.42L2.25 7.5v9l2.6 1.268 4.38-3.42 8.353 7.356L21.75 19.5V4.5l-4.167-2.204zM17.25 16.5l-5.4-4.5 5.4-4.5v9z" />
        </svg>
      </div>
    );
  }
  if (id === 'claude') {
    return (
      <div className={cn(base, 'bg-[#D97757]/10')}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#D97757]" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm4 10H8v-1c0-2 4-3.1 4-3.1s4 1.1 4 3.1v1z" />
        </svg>
      </div>
    );
  }
  if (id === 'chatgpt') {
    return (
      <div className={cn(base, 'bg-[#10A37F]/10')}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#10A37F]" fill="currentColor">
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z" />
        </svg>
      </div>
    );
  }
  // CLI / Terminal
  return (
    <div className={cn(base, 'bg-muted/50')}>
      <Terminal className="w-4 h-4 text-muted-foreground" />
    </div>
  );
}
