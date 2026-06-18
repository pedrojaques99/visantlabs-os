import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/button';
import { AuthModal } from '../components/AuthModal';
import { useLayout } from '../hooks/useLayout';
import { authService } from '../services/authService';
import { cn } from '../lib/utils';
import { Check, Copy, ArrowRight, ExternalLink, Terminal, ChevronRight } from 'lucide-react';
import { getCurrentLocale } from '../utils/localeUtils';

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

// Collapsed under "For developers" (dev terms are universal — not localized).
const DEV_PROVIDERS = [
  {
    id: 'cursor',
    name: 'Cursor',
    sub: 'One-click install',
    href: cursorLink(),
    action: 'connect' as const,
  },
  {
    id: 'vscode',
    name: 'VS Code',
    sub: 'One-click install',
    href: vscodeLink(),
    action: 'connect' as const,
  },
  {
    id: 'cli',
    name: 'Terminal',
    sub: `claude mcp add --transport http visant ${MCP_URL}`,
    action: 'cli' as const,
    cli: `claude mcp add --transport http visant ${MCP_URL}`,
  },
] as const;

// ── Localized copy (the brand manual is PT-first, so the connect flow follows) ──
type Assistant = { id: string; name: string; tag: string; open: string; steps: string[] };
interface ConnectCopy {
  loading: string;
  errorHint: string;
  back: string;
  invitedBy: (name: string) => string;
  inviteDesc: (brand: string) => string;
  ctaAuthed: string;
  ctaGuest: string;
  freeHint: string;
  accepting: (brand: string) => string;
  connectedTitle: (brand: string) => string;
  connectedSubtext: string;
  step1: string;
  step2: string;
  dashboard: string;
  dev: string;
  open: string;
  assistants: Assistant[];
  prompts: (brand: string) => string[];
}

const COPY: Record<'pt' | 'en', ConnectCopy> = {
  pt: {
    loading: 'Carregando convite...',
    errorHint:
      'Este link de conexão pode ter expirado ou já ter sido usado. Abra o link da sua marca de novo e toque em Conectar para gerar um novo — ou peça pra quem te enviou reenviar.',
    back: 'Voltar ao início',
    invitedBy: (n) => `Enviado por ${n}`,
    inviteDesc: (b) =>
      `Conecte ${b} ao seu assistente de IA (Claude, ChatGPT…). Ele vai criar, escrever e desenhar no padrão da marca — cores, fontes, logos e tom de voz, automaticamente.`,
    ctaAuthed: 'Aceitar e conectar',
    ctaGuest: 'Criar conta grátis e conectar',
    freeHint: 'Grátis — entre com o Google em um clique.',
    accepting: (b) => `Conectando ${b}...`,
    connectedTitle: (b) => `${b} está conectada`,
    connectedSubtext:
      'Dois passos rápidos e seu assistente de IA vai criar, escrever e desenhar no padrão da marca — automaticamente.',
    step1: '1 · Conecte seu assistente',
    step2: '2 · Teste — abra seu assistente e peça',
    dashboard: 'Ir para o painel',
    dev: 'Para desenvolvedores (Cursor, VS Code, Terminal)',
    open: 'Abrir',
    assistants: [
      {
        id: 'claude',
        name: 'Claude',
        tag: 'Recomendado',
        open: 'https://claude.ai/settings/connectors',
        steps: [
          'Abra o Claude → Configurações → Conectores',
          'Clique em "Adicionar conector personalizado"',
          'Cole o link abaixo',
          'Faça login com sua conta quando o Claude pedir',
        ],
      },
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        tag: '',
        open: 'https://chatgpt.com',
        steps: [
          'Abra o ChatGPT → Configurações → Conectores',
          'Adicione um conector',
          'Cole o link abaixo',
          'Faça login com sua conta quando o ChatGPT pedir',
        ],
      },
    ],
    prompts: (b) => [
      `Crie um post de Instagram no padrão da ${b}.`,
      `Escreva uma descrição de produto no tom de voz da ${b}.`,
      `Quais são as cores, fontes e logos da ${b}?`,
    ],
  },
  en: {
    loading: 'Loading invite...',
    errorHint:
      'This connect link may have expired or already been used. Open your brand link again and tap Connect for a fresh one — or ask the team that shared it to resend.',
    back: 'Back to home',
    invitedBy: (n) => `Invited by ${n}`,
    inviteDesc: (b) =>
      `Connect ${b} to your AI assistant (Claude, ChatGPT…). It will then design, write and create on-brand — colors, fonts, logos and voice, automatically.`,
    ctaAuthed: 'Accept & Connect',
    ctaGuest: 'Create free account & connect',
    freeHint: 'Free — sign in with Google in one click.',
    accepting: (b) => `Connecting ${b}...`,
    connectedTitle: (b) => `${b} is connected`,
    connectedSubtext:
      'Two quick steps and your AI assistant will design, write and create on-brand — automatically.',
    step1: '1 · Connect your assistant',
    step2: '2 · Try it — open your assistant and ask',
    dashboard: 'Go to dashboard',
    dev: 'For developers (Cursor, VS Code, Terminal)',
    open: 'Open',
    assistants: [
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
    ],
    prompts: (b) => [
      `Create an on-brand Instagram post for ${b}.`,
      `Write a product description in ${b}'s tone of voice.`,
      `What are ${b}'s colors, fonts and logos?`,
    ],
  },
};

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

  // Brand manual is PT-first → the connect flow follows the same locale.
  const L = COPY[getCurrentLocale() === 'pt-BR' ? 'pt' : 'en'];

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
            <p className="text-[13px] text-muted-foreground">{L.loading}</p>
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
              <p className="text-[12px] text-muted-foreground leading-relaxed">{L.errorHint}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/')}
            >
              {L.back}
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
                  <p className="text-[13px] text-muted-foreground">{L.invitedBy(creator)}</p>
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
              {L.inviteDesc(brandName)}
            </motion.p>

            {/* CTA */}
            <motion.div variants={itemVariants} className="space-y-2">
              <Button
                className="w-full h-11 text-sm font-medium relative overflow-hidden group"
                onClick={handleConnect}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {isAuthenticated ? L.ctaAuthed : L.ctaGuest}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Button>
              {!isAuthenticated && (
                <p className="text-[11px] text-muted-foreground/70 text-center">{L.freeHint}</p>
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
            <p className="text-[13px] text-muted-foreground">{L.accepting(brandName)}</p>
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
                {L.connectedTitle(brandName)}
              </motion.h1>
              <motion.p
                variants={itemVariants}
                className="text-[13px] text-muted-foreground max-w-sm mx-auto leading-relaxed"
              >
                {L.connectedSubtext}
              </motion.p>
            </motion.div>

            {/* Step 1 — connect your assistant */}
            <motion.div variants={itemVariants} className="space-y-3">
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                {L.step1}
              </p>
              {L.assistants.map((a) => (
                <AssistantCard
                  key={a.id}
                  assistant={a}
                  openLabel={L.open}
                  copied={copied}
                  onCopy={copy}
                />
              ))}

              {/* Developers — collapsed */}
              <details className="group rounded-xl border border-border/50 overflow-hidden">
                <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer list-none text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  {L.dev}
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
                {L.step2}
              </p>
              <div className="space-y-1.5">
                {L.prompts(brandName).map((p) => (
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
                {L.dashboard}
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
  openLabel,
  copied,
  onCopy,
}: {
  assistant: Assistant;
  openLabel: string;
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
          {openLabel} <ExternalLink className="w-3 h-3" />
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
          <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
        </svg>
      </div>
    );
  }
  if (id === 'vscode') {
    return (
      <div className={cn(base, 'bg-[#007ACC]/10')}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#007ACC]" fill="currentColor">
          <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
        </svg>
      </div>
    );
  }
  if (id === 'claude') {
    return (
      <div className={cn(base, 'bg-[#D97757]/10')}>
        <img src="/models/claude-color.svg" alt="Claude" className="w-4 h-4" />
      </div>
    );
  }
  if (id === 'chatgpt') {
    return (
      <div className={cn(base, 'bg-[#10A37F]/10')}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#10A37F]" fill="currentColor">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
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
