import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Layers, Brain, Zap, Globe, GitBranch, Package,
  ArrowRight, ChevronRight, Image, Palette, Type,
  FileCode, Share2, Bot, Activity, Users, ShieldCheck,
  Video, LayoutGrid, Workflow, MonitorSmartphone,
} from 'lucide-react';
import { GridDotsBackground } from '@/components/ui/GridDotsBackground';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';
import { cn } from '@/lib/utils';

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'brand',     label: 'Brand System' },
  { id: 'canvas',   label: 'Canvas' },
  { id: 'campaign', label: 'Campaign Engine' },
  { id: 'integrations', label: 'Integrações' },
  { id: 'agency',   label: 'Para Agências' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

const BRAND_CAPABILITIES = [
  {
    icon: Palette,
    title: 'Identidade Completa',
    desc: 'Cores com papéis semânticos, tipografia com hierarquia, logos em múltiplas variantes — tudo em um JSON estruturado.',
  },
  {
    icon: GitBranch,
    title: 'Versionamento',
    desc: 'Histórico de todas as alterações com diff, change notes e restauração de versão anterior.',
  },
  {
    icon: Share2,
    title: 'Link Público Interativo',
    desc: 'Cliente aprova seção por seção direto no browser. Sem PDF. Sem email com comentários.',
  },
  {
    icon: ShieldCheck,
    title: 'Validação por Seção',
    desc: 'Cada seção tem estado próprio: pending · approved · needs_work. Aprovação granular por stakeholder.',
  },
  {
    icon: FileCode,
    title: 'Export Multi-formato',
    desc: 'Um source of truth. Quatro saídas: CSS, Tailwind config, JSON, PDF.',
  },
  {
    icon: Layers,
    title: 'Design Tokens Completos',
    desc: 'Gradients, shadows, motion, borders, spacing, radius — tokens que alimentam o código e a geração IA.',
  },
];

const CANVAS_NODES = [
  { icon: Palette,         label: 'BrandCore',       desc: 'Hub da identidade — logo, cores, voz' },
  { icon: Image,           label: 'PromptNode',       desc: 'Geração com histórico e presets' },
  { icon: Brain,           label: 'MergeNode',        desc: 'Combina branches visuais com IA' },
  { icon: Layers,          label: 'ColorExtractor',   desc: 'Extrai paleta de qualquer imagem' },
  { icon: Type,            label: 'StrategyNode',     desc: 'Posicionamento, personas, arquétipos' },
  { icon: Activity,        label: 'DirectorNode',     desc: 'Brief criativo para campanhas' },
  { icon: LayoutGrid,      label: 'MockupNode',       desc: '36K+ templates de dispositivos' },
  { icon: Workflow,        label: 'BatchRunner',      desc: 'N gerações em paralelo (4 workers)' },
  { icon: Video,           label: 'VideoNode',        desc: 'Vídeo via Seedream API' },
  { icon: MonitorSmartphone, label: 'ShaderNode',     desc: 'Efeitos visuais com GLSL' },
  { icon: Bot,             label: 'ChatNode',         desc: 'Orquestra workflows em linguagem natural' },
  { icon: Package,         label: 'CustomNode',       desc: 'Node compositor — crie os seus' },
];

const CAMPAIGN_ANGLES = [
  'benefit-led', 'social-proof', 'urgency', 'lifestyle',
  'pain-agitate', 'transformation', 'curiosity', 'authority',
  'comparison', 'story',
];

const INTEGRATIONS = [
  {
    icon: Globe,
    title: 'Figma Bridge',
    points: [
      'Importa design system direto do arquivo Figma',
      'Exporta tokens como Figma Variables',
      'Plugin com contexto de marca no gerador',
      '39 operações de canvas via MCP',
    ],
  },
  {
    icon: Bot,
    title: 'MCP — Agentes Externos',
    points: [
      'Claude Desktop, Cursor, n8n se conectam direto',
      'create_ad_campaign: produto → campanha via tool call',
      'get_brand_design_system: tokens LLM-ready',
      'validate_brand_section: aprovação programática',
    ],
  },
  {
    icon: FileCode,
    title: 'API Pública',
    points: [
      'POST /api/canvas/generate-campaign',
      'GET /api/brand-guidelines/:id/context',
      'GET /api/brand-guidelines/:id/export?format=css',
      'Autenticação Bearer token',
    ],
  },
];

const AGENCY_WORKFLOWS = [
  {
    step: '01',
    title: 'Recebe o cliente',
    desc: 'Cria a guideline do cliente. Ingestão automática de PDF de marca, site ou imagens existentes.',
  },
  {
    step: '02',
    title: 'Constrói a identidade',
    desc: 'Completa cores, tipografia, tokens, voz, logos. Cada campo vira parâmetro de geração IA.',
  },
  {
    step: '03',
    title: 'Envia para aprovação',
    desc: 'Link público. Cliente aprova seção por seção — sem PDF, sem loop de email.',
  },
  {
    step: '04',
    title: 'Gera conteúdo on-brand',
    desc: '1 foto do produto → 20 ads com 10 ângulos criativos diferentes. GPT-4o planeja, gera em paralelo.',
  },
  {
    step: '05',
    title: 'Entrega ao time',
    desc: 'CSS/Tailwind para o dev. JSON para o sistema. Figma Variables para o designer. Tudo do mesmo source.',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children, delay = 0, className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MicroTitle className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
    {children}
  </MicroTitle>
);

const SectionHeading: React.FC<{ children: React.ReactNode; accent?: boolean }> = ({ children, accent }) => (
  <h2 className={cn('text-2xl md:text-3xl font-semibold tracking-tight', accent ? 'text-white' : 'text-neutral-100')}>
    {children}
  </h2>
);

// ─── Sections ─────────────────────────────────────────────────────────────────

const BrandSection: React.FC = () => (
  <div className="flex flex-col gap-10">
    <FadeIn>
      <div className="flex flex-col gap-3">
        <SectionLabel>01 · Brand System</SectionLabel>
        <SectionHeading accent>
          A guideline que <span className="text-brand-cyan">alimenta a IA</span>,<br />
          não apenas documenta.
        </SectionHeading>
        <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
          Cada campo da guideline — cores, tipografia, voz, tokens — vira parâmetro de geração.
          Não é um PDF para ninguém ler. É uma API da identidade do seu cliente.
        </p>
      </div>
    </FadeIn>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {BRAND_CAPABILITIES.map((cap, i) => (
        <FadeIn key={cap.title} delay={i * 0.07}>
          <GlassPanel padding="md" className="group hover:border-white/10 transition-colors duration-300 h-full">
            <cap.icon size={18} className="text-brand-cyan mb-3 shrink-0" />
            <p className="text-sm font-semibold text-neutral-200 mb-1">{cap.title}</p>
            <p className="text-xs text-neutral-500 leading-relaxed">{cap.desc}</p>
          </GlassPanel>
        </FadeIn>
      ))}
    </div>

    <FadeIn delay={0.3}>
      <GlassPanel padding="md" className="border-brand-cyan/20 bg-brand-cyan/5">
        <div className="flex items-start gap-3">
          <div className="w-1 h-full bg-brand-cyan rounded-full shrink-0 self-stretch min-h-[2rem]" />
          <div>
            <p className="text-sm font-semibold text-brand-cyan mb-1">Diferencial único de mercado</p>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Frontify e Brandfolder armazenam e compartilham guidelines. <strong className="text-neutral-200">Visant usa as guidelines como contexto de geração IA.</strong> Cores/tipografia/voz viram parâmetros automáticos no Canvas, Mockup Machine, Plugin Figma e API pública.
            </p>
          </div>
        </div>
      </GlassPanel>
    </FadeIn>
  </div>
);

const CanvasSection: React.FC = () => (
  <div className="flex flex-col gap-10">
    <FadeIn>
      <div className="flex flex-col gap-3">
        <SectionLabel>02 · Canvas Studio</SectionLabel>
        <SectionHeading accent>
          <span className="text-brand-cyan">30+ tipos de nó.</span><br />
          Workflows visuais com IA.
        </SectionHeading>
        <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
          Cada nó tem um papel. Você conecta, configura e executa — a marca do cliente flui automaticamente por toda a pipeline.
        </p>
      </div>
    </FadeIn>

    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {CANVAS_NODES.map((node, i) => (
        <FadeIn key={node.label} delay={i * 0.04}>
          <div className="group flex flex-col gap-2 p-4 rounded-xl border border-white/5 bg-neutral-900/30 hover:bg-neutral-900/60 hover:border-white/10 transition-all duration-200 cursor-default h-full">
            <node.icon size={16} className="text-neutral-400 group-hover:text-brand-cyan transition-colors duration-200" />
            <p className="text-xs font-semibold text-neutral-300">{node.label}</p>
            <p className="text-[10px] text-neutral-600 leading-relaxed">{node.desc}</p>
          </div>
        </FadeIn>
      ))}
    </div>

    <FadeIn delay={0.2}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Geração paralela', value: '4 workers', sub: 'BatchRunner simultâneo' },
          { label: 'Templates de mockup', value: '36K+', sub: 'dispositivos e ambientes' },
          { label: 'Modelos suportados', value: '8+', sub: 'Gemini · GPT · Seedream' },
        ].map((stat, i) => (
          <GlassPanel key={stat.label} padding="md" className="text-center">
            <p className="text-2xl font-semibold text-white mb-1">{stat.value}</p>
            <p className="text-xs font-semibold text-neutral-300 mb-0.5">{stat.label}</p>
            <p className="text-[10px] text-neutral-600">{stat.sub}</p>
          </GlassPanel>
        ))}
      </div>
    </FadeIn>
  </div>
);

const CampaignSection: React.FC = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % CAMPAIGN_ANGLES.length), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <FadeIn>
        <div className="flex flex-col gap-3">
          <SectionLabel>03 · Campaign Engine</SectionLabel>
          <SectionHeading accent>
            1 foto do produto.<br />
            <span className="text-brand-cyan">20 ads on-brand.</span>
          </SectionHeading>
          <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
            GPT-4o planeja os ângulos criativos usando os dados da guideline do cliente. Gera tudo em paralelo. Entrega campanha completa via API, MCP ou ChatNode.
          </p>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn delay={0.1}>
          <GlassPanel padding="md" className="flex flex-col gap-4">
            <SectionLabel>Ângulos criativos gerados automaticamente</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_ANGLES.map((angle, i) => (
                <motion.span
                  key={angle}
                  animate={{
                    backgroundColor: active === i ? 'oklch(0.81 0.156 198.6 / 0.15)' : 'transparent',
                    borderColor: active === i ? 'oklch(0.81 0.156 198.6 / 0.4)' : 'oklch(1 0 0 / 0.08)',
                    color: active === i ? 'oklch(0.81 0.156 198.6)' : 'oklch(0.6 0 0)',
                  }}
                  transition={{ duration: 0.2 }}
                  className="px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-wider"
                >
                  {angle}
                </motion.span>
              ))}
            </div>
          </GlassPanel>
        </FadeIn>

        <FadeIn delay={0.15}>
          <GlassPanel padding="md" className="flex flex-col gap-4">
            <SectionLabel>3 formas de acionar</SectionLabel>
            <div className="flex flex-col gap-3">
              {[
                { method: 'API REST', detail: 'POST /api/canvas/generate-campaign', icon: FileCode },
                { method: 'MCP Tool', detail: 'create_ad_campaign { brandGuidelineId, productImageUrl }', icon: Bot },
                { method: 'ChatNode', detail: '"gera 20 ads para atletas" — linguagem natural', icon: Activity },
              ].map(({ method, detail, icon: Icon }) => (
                <div key={method} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03]">
                  <Icon size={14} className="text-brand-cyan shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-neutral-300">{method}</p>
                    <p className="text-[10px] text-neutral-600 font-mono mt-0.5 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </FadeIn>
      </div>
    </div>
  );
};

const IntegrationsSection: React.FC = () => (
  <div className="flex flex-col gap-10">
    <FadeIn>
      <div className="flex flex-col gap-3">
        <SectionLabel>04 · Integrações</SectionLabel>
        <SectionHeading accent>
          A marca do cliente<br />
          <span className="text-brand-cyan">em qualquer ferramenta.</span>
        </SectionHeading>
        <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
          Figma, agentes externos, CI/CD, n8n. A guideline é uma API — qualquer sistema pode consumir.
        </p>
      </div>
    </FadeIn>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {INTEGRATIONS.map((integ, i) => (
        <FadeIn key={integ.title} delay={i * 0.1}>
          <GlassPanel padding="md" className="flex flex-col gap-4 h-full hover:border-white/10 transition-colors duration-300">
            <div className="flex items-center gap-2">
              <integ.icon size={16} className="text-brand-cyan" />
              <p className="text-sm font-semibold text-neutral-200">{integ.title}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {integ.points.map(pt => (
                <li key={pt} className="flex items-start gap-2 text-[10px] text-neutral-500 font-mono leading-relaxed">
                  <ChevronRight size={10} className="text-neutral-600 shrink-0 mt-[3px]" />
                  {pt}
                </li>
              ))}
            </ul>
          </GlassPanel>
        </FadeIn>
      ))}
    </div>
  </div>
);

const AgencySection: React.FC = () => (
  <div className="flex flex-col gap-10">
    <FadeIn>
      <div className="flex flex-col gap-3">
        <SectionLabel>05 · Para Agências</SectionLabel>
        <SectionHeading accent>
          Do onboarding do cliente<br />
          <span className="text-brand-cyan">à entrega de campanha.</span>
        </SectionHeading>
        <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
          Fluxo completo para agências multi-cliente. Cada cliente tem sua guideline isolada, seu link de aprovação, seu canvas de criação.
        </p>
      </div>
    </FadeIn>

    <div className="relative flex flex-col gap-0">
      {AGENCY_WORKFLOWS.map((step, i) => (
        <FadeIn key={step.step} delay={i * 0.1}>
          <div className="flex gap-5 group">
            {/* Connector */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full border border-white/10 bg-neutral-900/60 flex items-center justify-center shrink-0 group-hover:border-brand-cyan/40 transition-colors duration-300">
                <span className="font-mono text-[10px] text-neutral-500 group-hover:text-brand-cyan transition-colors duration-300">
                  {step.step}
                </span>
              </div>
              {i < AGENCY_WORKFLOWS.length - 1 && (
                <div className="w-px flex-1 bg-white/5 my-1 min-h-[2rem]" />
              )}
            </div>

            {/* Content */}
            <div className="pb-8 pt-1 flex flex-col gap-1">
              <p className="text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors duration-200">
                {step.title}
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed max-w-lg">
                {step.desc}
              </p>
            </div>
          </div>
        </FadeIn>
      ))}
    </div>

    <FadeIn delay={0.3}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Clientes isolados', desc: 'userId por guideline' },
          { label: 'Aprovação sem PDF', desc: 'link público interativo' },
          { label: 'On-brand garantido', desc: 'contexto automático' },
          { label: 'Multi-formato', desc: 'CSS · JSON · Tailwind' },
        ].map(item => (
          <div key={item.label} className="flex flex-col gap-1 p-4 rounded-xl border border-white/5 bg-neutral-900/20">
            <p className="text-xs font-semibold text-neutral-300">{item.label}</p>
            <p className="text-[10px] text-neutral-600 font-mono">{item.desc}</p>
          </div>
        ))}
      </div>
    </FadeIn>
  </div>
);

// ─── Page ──────────────────────────────────────────────────────────────────────

const SECTION_COMPONENTS: Record<SectionId, React.FC> = {
  brand:        BrandSection,
  canvas:       CanvasSection,
  campaign:     CampaignSection,
  integrations: IntegrationsSection,
  agency:       AgencySection,
};

export const OnboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionId>('brand');

  const ActiveComponent = SECTION_COMPONENTS[activeSection];

  return (
    <>
      <SEO
        title="Visant Labs — Capabilities"
        description="Brand guidelines que alimentam geração IA. Canvas visual, campaign engine, Figma bridge e MCP tools para agências multi-cliente."
      />

      <div className="min-h-screen bg-black text-white">
        <GridDotsBackground opacity={0.04} spacing={28} color="#ffffff" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-16">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-col gap-5"
          >
            <MicroTitle className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
              Visant Labs OS — Platform Capabilities
            </MicroTitle>

            <div className="flex flex-col gap-2">
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
                Brand guidelines<br />
                que <span className="text-brand-cyan">trabalham</span>.
              </h1>
              <p className="text-neutral-400 text-base md:text-lg max-w-2xl leading-relaxed">
                Não é documentação. É a identidade do cliente como API — alimentando geração IA, Canvas, Figma e agentes externos automaticamente.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <PremiumButton
                onClick={() => navigate('/brand-guidelines')}
                icon={ArrowRight}
                className="w-auto h-10 px-6 text-xs"
              >
                Começar com Brand Guidelines
              </PremiumButton>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/canvas')}
                className="border-white/10 text-neutral-400 hover:text-white hover:border-white/20 text-xs"
              >
                Abrir Canvas
              </Button>
            </div>

            {/* Stat strip */}
            <div className="flex items-center gap-6 pt-2 flex-wrap">
              {[
                { value: '30+', label: 'node types no Canvas' },
                { value: '13',  label: 'MCP tools' },
                { value: '10',  label: 'ângulos criativos' },
                { value: '20',  label: 'ads por campanha' },
              ].map(s => (
                <div key={s.label} className="flex items-baseline gap-1.5">
                  <span className="text-lg font-semibold text-white">{s.value}</span>
                  <span className="text-[10px] text-neutral-600 font-mono">{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Nav pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex gap-2 flex-wrap"
          >
            {SECTIONS.map(sec => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={cn(
                  'px-4 py-2 rounded-full border text-[10px] font-mono uppercase tracking-wider transition-all duration-200',
                  activeSection === sec.id
                    ? 'bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan'
                    : 'border-white/8 text-neutral-500 hover:border-white/15 hover:text-neutral-300',
                )}
              >
                {sec.label}
              </button>
            ))}
          </motion.div>

          {/* Active section */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>

          {/* Bottom CTA */}
          <FadeIn>
            <div className="border-t border-white/5 pt-12 flex flex-col items-center gap-6 text-center">
              <MicroTitle className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
                Pronto para começar?
              </MicroTitle>
              <h2 className="text-2xl font-semibold text-white">
                Crie a guideline do seu primeiro cliente.
              </h2>
              <p className="text-neutral-500 text-sm max-w-md leading-relaxed">
                Em 10 minutos você tem cores, tipografia, voz e tokens estruturados — prontos para alimentar a geração IA.
              </p>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <PremiumButton
                  onClick={() => navigate('/brand-guidelines')}
                  icon={ArrowRight}
                  className="w-auto h-11 px-8 text-xs"
                >
                  Criar Brand Guideline
                </PremiumButton>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/canvas')}
                  className="text-neutral-500 hover:text-neutral-300 text-xs"
                >
                  Explorar Canvas
                </Button>
              </div>
            </div>
          </FadeIn>

        </div>
      </div>
    </>
  );
};
