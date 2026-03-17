import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { SEO } from '@/components/SEO';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Palette,
  Type,
  FileText,
  Download,
  Globe,
  AlertCircle,
  Search,
  Compass,
  Sparkles,
  User,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';
import { Input } from '@/components/ui/input';

// Helper to download blob
function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Global helper to trigger actual file download from URL
async function triggerDownload(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    // Fallback if fetch fails (e.g. CORS)
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  }
}

// CSS Variables generator
function toCSSVariables(g: BrandGuideline): string {
  const lines: string[] = [':root {'];
  g.colors?.forEach(c => {
    const name = (c.name || 'color').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    lines.push(`  --color-${name}: ${c.hex};`);
  });
  g.typography?.forEach(t => {
    const role = (t.role || 'font').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    lines.push(`  --font-${role}: '${t.family}', sans-serif;`);
  });
  lines.push('}');
  return lines.join('\n');
}

export const PublicBrandGuideline: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [guideline, setGuideline] = useState<BrandGuideline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!slug) return;

    const fetchGuideline = async () => {
      try {
        const data = await brandGuidelineApi.getPublic(slug);
        setGuideline(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load brand guidelines');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuideline();
  }, [slug]);

  const handleDownloadJSON = () => {
    if (!guideline) return;
    const safeName = (guideline.identity?.name || 'brand').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    downloadBlob(JSON.stringify(guideline, null, 2), `${safeName}-guidelines.json`, 'application/json');
    toast.success('Downloaded as JSON');
  };

  const handleDownloadCSS = () => {
    if (!guideline) return;
    const safeName = (guideline.identity?.name || 'brand').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    downloadBlob(toCSSVariables(guideline), `${safeName}-variables.css`, 'text/css');
    toast.success('Downloaded as CSS');
  };

  const handleCopyColor = useCallback((hex: string) => {
    navigator.clipboard.writeText(hex);
    toast.success(`Copied ${hex}`);
  }, []);

  // Batch download with throttling to avoid overwhelming the browser
  const handleBatchDownload = useCallback(async (items: Array<{ url: string; label?: string; variant?: string }>) => {
    toast.info(`Downloading ${items.length} assets...`);
    for (const item of items) {
      const safeName = (item.label || item.variant || 'asset').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const ext = item.url.split('.').pop()?.split('?')[0] || 'png';
      await triggerDownload(item.url, `${safeName}.${ext}`);
      await new Promise(resolve => setTimeout(resolve, 150)); // throttle
    }
    toast.success(`Downloaded ${items.length} assets`);
  }, []);

  // Filtering Logic (memoized for performance)
  const filteredColors = useMemo(() =>
    guideline?.colors?.filter(c =>
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.hex.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    [guideline?.colors, searchTerm]
  );

  const filteredLogos = useMemo(() =>
    guideline?.logos?.filter(l =>
      l.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.variant.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    [guideline?.logos, searchTerm]
  );

  const filteredMedia = useMemo(() =>
    guideline?.media?.filter(m =>
      m.label?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    [guideline?.media, searchTerm]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 flex flex-col items-center gap-4">
          <GlitchLoader size={40} />
          <MicroTitle className="text-neutral-600 animate-pulse uppercase tracking-[0.2em]">Decrypting Brand Assets</MicroTitle>
        </motion.div>
      </div>
    );
  }

  if (error || !guideline) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <GlassPanel padding="lg" className="relative z-10 max-w-md text-center border-red-500/10 bg-red-500/[0.02]">
          <AlertCircle size={48} className="mx-auto text-red-500/40 mb-4" />
          <h1 className="text-xl font-bold text-neutral-200 mb-2 font-manrope">Access Denied</h1>
          <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
            {error || 'This brand guideline is either private or does not exist in our secure vault.'}
          </p>
          <Link to="/">
            <Button variant="outline" className="text-brand-cyan border-brand-cyan/20 hover:bg-brand-cyan/5">
              Return to Surface
            </Button>
          </Link>
        </GlassPanel>
      </div>
    );
  }

  const brandName = guideline.identity?.name || 'Brand Guidelines';
  const tabs = [
    { id: 'all', label: 'Overview', icon: Globe },
    { id: 'identity', label: 'Identity', icon: FileText },
    { id: 'strategy', label: 'Strategy', icon: Compass },
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'typography', label: 'Typography', icon: Type },
    { id: 'logos', label: 'Assets', icon: FileText },
    { id: 'media', label: 'Library', icon: Palette },
  ];

  const sectionVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 selection:bg-brand-cyan/30">
      <SEO title={`${brandName} - Brand Portal`} description={guideline.identity?.description || guideline.identity?.tagline} />

      {/* Floating Side Nav (Desktop) */}
      <nav className="fixed left-8 top-1/2 -translate-y-1/2 z-50 hidden xl:flex flex-col gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              document.getElementById(tab.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={cn(
              "group flex items-center gap-3 transition-all duration-300",
              activeTab === tab.id ? "translate-x-2" : "opacity-300 hover:opacity-300"
            )}
          >
            <div className={cn(
              "w-1 h-1 rounded-full transition-all duration-300",
              activeTab === tab.id ? "h-6 bg-brand-cyan shadow-[0_0_10px_rgba(var(--brand-cyan-rgb),0.5)]" : "bg-neutral-600 group-hover:bg-neutral-400"
            )} />
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] font-mono">{tab.label}</span>
          </button>
        ))}
      </nav>
      <div className="flex gap-2 mt-4" style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 1000 }}>
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className="h-9 px-4 text-[10px] font-mono gap-2 border border-white/5 bg-black/40 backdrop-blur-md hover:bg-white/5"
        >
          <ChevronLeft size={14} /> VOLTAR
        </Button>
      </div>

      <div className="flex gap-2 mt-4" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
        <Button onClick={handleDownloadJSON} variant="ghost" className="h-9 px-4 text-[10px] font-mono gap-2 border border-white/5 bg-black/40 backdrop-blur-md hover:bg-white/5">
          <Download size={14} /> JSON
        </Button>
        <Button onClick={handleDownloadCSS} variant="ghost" className="h-9 px-4 text-[10px] font-mono gap-2 border border-white/5 bg-black/40 backdrop-blur-md hover:bg-white/5">
          <Download size={14} /> TOKENS
        </Button>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 md:py-24">
        {/* Hero Section */}
        <motion.header
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-20 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-cyan/5 border border-brand-cyan/10 text-brand-cyan text-[10px] font-mono uppercase tracking-[0.25em] mb-6 shadow-[0_0_20px_rgba(var(--brand-cyan-rgb),0.05)]">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
            Brand DNA
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight font-manrope">{brandName}</h1>
          {guideline.identity?.tagline && (
            <p className="text-xl md:text-2xl text-neutral-500  max-w-2xl mx-auto font-serif">
              "{guideline.identity.tagline}"
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
            {guideline.identity?.website && (
              <a href={guideline.identity.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-brand-cyan transition-colors">
                <Globe size={14} /> {guideline.identity.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </motion.header>

        {/* Global Controls */}
        <div className="sticky top-6 z-40 mb-16 px-2">
          <GlassPanel padding="sm" className="bg-neutral-950/60 backdrop-blur-2xl border-white/[0.05] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                <Input
                  placeholder="Search assets, colors, or specs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-transparent border-none focus-visible:ring-0 text-sm placeholder:text-neutral-700"
                />
              </div>

              {/* Desktop Filters */}
              <div className="hidden md:flex items-center gap-1 border-l border-white/5 pl-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      activeTab === tab.id ? "bg-brand-cyan/10 text-brand-cyan" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Main Sections */}
        <div className="flex flex-col gap-24">
          <AnimatePresence mode="popLayout">
            {/* Identity Section */}
            {(activeTab === 'all' || activeTab === 'identity') && (
              <motion.section id="identity" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="flex flex-col gap-10">
                  <div className="space-y-4">
                    <MicroTitle className="text-brand-cyan/60 tracking-[0.4em]">Section 01 // Identity</MicroTitle>
                    <h2 className="text-3xl font-bold text-white font-manrope">Core Essence</h2>
                  </div>
                  {guideline.identity?.description && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                      <div className="md:col-span-2">
                        <p className="text-lg md:text-xl text-neutral-400 leading-relaxed font-light">
                          {guideline.identity.description}
                        </p>
                      </div>
                      <div className="space-y-8">
                        {guideline.identity?.tagline && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">Brand Tagline</span>
                            <p className="text-sm font-bold text-neutral-200 uppercase">{guideline.identity.tagline}</p>
                          </div>
                        )}
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">Primary Objective</span>
                          <p className="text-sm font-bold text-neutral-200">Standardize Visual & Strategic Communications</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>
            )}

            {/* Strategic Branding Section */}
            {(activeTab === 'all' || activeTab === 'strategy') && guideline.strategy && (
              <motion.section id="strategy" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-32">
                {/* Manifesto - Full Screen Style */}
                {guideline.strategy.manifesto && (
                  <div className="space-y-12">
                    <div className="flex items-center gap-4">
                      <div className="h-[1px] w-12 bg-brand-cyan/30" />
                      <MicroTitle className="text-brand-cyan/60 tracking-[0.4em]">[Manifesto]</MicroTitle>
                    </div>
                    <div className="relative group">
                      <div className="absolute -inset-8 bg-brand-cyan/[0.02] blur-3xl rounded-full opacity-0 group-hover:opacity-300 transition-opacity duration-1000" />
                      <h3 className="text-4xl md:text-6xl font-bold text-white tracking-tight font-manrope leading-[1.1]">
                        {guideline.strategy.manifesto.split('\n')[0]}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-16">
                        {guideline.strategy.manifesto.split('\n').slice(1).map((para, i) => (
                          <p key={i} className="text-lg md:text-xl text-neutral-400 leading-relaxed font-light">
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Archetypes - Tarot Style */}
                {guideline.strategy.archetypes && guideline.strategy.archetypes.length > 0 && (
                  <div className="space-y-16">
                    <div className="space-y-4">
                      <MicroTitle className="text-brand-cyan/60 tracking-[0.4em]">Section 01.A // Archetypes</MicroTitle>
                      <h2 className="text-3xl font-bold text-white font-manrope">Brand Personality</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {guideline.strategy.archetypes.map((arch, i) => (
                        <div key={i} className="group relative bg-[#F5F5F5] rounded-[40px] p-12 flex flex-col md:flex-row gap-12 items-center text-neutral-900 overflow-hidden min-h-[400px]">
                          <div className="w-full md:w-1/2 aspect-[3/4] rounded-2xl border-[3px] border-neutral-900 p-4 flex flex-col items-center justify-between relative bg-white shadow-xl group-hover:rotate-2 transition-transform duration-500">
                            <div className="w-full text-center border-b border-neutral-900 pb-2 flex items-center justify-between px-2">
                              <Sparkles size={12} />
                              <span className="text-[10px] font-bold uppercase">{arch.name}</span>
                              <Sparkles size={12} />
                            </div>
                            <div className="flex-1 flex items-center justify-center py-8">
                              {arch.image ? <img src={arch.image} className="w-full object-contain" /> : <Sparkles size={64} className="opacity-30" />}
                            </div>
                            <div className="w-full text-center border-t border-neutral-900 pt-2 font-bold uppercase tracking-widest text-xs ">
                              {arch.name}
                            </div>
                          </div>
                          <div className="flex-1 space-y-6">
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold text-brand-cyan">Arquétipo de marca // {arch.role || 'Principal'}</span>
                              <h4 className="text-3xl font-bold tracking-tight">{arch.name}</h4>
                            </div>
                            <p className="text-neutral-600 text-sm leading-relaxed font-medium">
                              {arch.description}
                            </p>
                            {arch.examples && (
                              <div className="pt-4 space-y-2">
                                <span className="text-[10px] uppercase font-bold text-neutral-400">Exemplos:</span>
                                <p className="text-xs font-bold text-neutral-500">{arch.examples.join(', ')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Personas - Gustavo Style */}
                {guideline.strategy.personas && guideline.strategy.personas.length > 0 && (
                  <div className="space-y-16">
                    <div className="space-y-4">
                      <MicroTitle className="text-brand-cyan/60 tracking-[0.4em]">Section 01.B // Personas</MicroTitle>
                      <h2 className="text-3xl font-bold text-white font-manrope">Ideal Customer Profile</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-12">
                      {guideline.strategy.personas.map((persona, i) => (
                        <GlassPanel key={i} padding="lg" className="border-white/5 bg-white/[0.01]">
                          <div className="flex flex-col md:flex-row gap-12">
                            <div className="w-full md:w-1/3 aspect-square rounded-[32px] overflow-hidden border border-white/10 shadow-2xl">
                              {persona.image ? <img src={persona.image} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-neutral-900 flex items-center justify-center"><User size={64} className="opacity-30" /></div>}
                            </div>
                            <div className="flex-1 space-y-8">
                              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div className="space-y-1">
                                  <h4 className="text-4xl font-bold text-white">{persona.name}, {persona.age}</h4>
                                  <div className="flex flex-wrap gap-2 pt-2">
                                    {persona.traits?.map((trait, idx) => (
                                      <span key={idx} className="px-3 py-1 rounded-full border border-white/10 text-[10px] font-medium text-neutral-400 uppercase tracking-widest">{trait}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="h-[1px] w-full bg-white/5" />

                              <div className="space-y-4">
                                <h5 className="text-2xl font-bold text-neutral-200">O que o {persona.name.split(' ')[0]} realmente deseja?</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {persona.desires?.map((desire, idx) => (
                                    <div key={idx} className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] hover:border-white/10 transition-colors">
                                      <p className="text-sm text-neutral-400 leading-relaxed font-light">{desire}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {persona.bio && (
                                <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] ">
                                  <p className="text-sm text-neutral-300 font-light leading-relaxed">"{persona.bio}"</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </GlassPanel>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tone of Voice - Cards Style */}
                {guideline.strategy.voiceValues && guideline.strategy.voiceValues.length > 0 && (
                  <div className="space-y-16">
                    <div className="space-y-12">
                      <div className="flex items-center justify-between">
                        <h2 className="text-4xl font-bold text-white font-manrope">Tom de voz</h2>
                        <div className="flex gap-2">
                          {guideline.strategy.voiceValues.map((v, i) => (
                            <span key={i} className="px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-mono text-neutral-500">{v.title}</span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {guideline.strategy.voiceValues.map((v, i) => (
                          <div key={i} className="relative group p-8 rounded-[32px] border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.02] transition-all duration-500 overflow-hidden min-h-[450px] flex flex-col">
                            <div className="absolute top-0 left-0 w-16 h-16 bg-white/[0.03] rounded-br-[32px] flex items-center justify-center text-xl font-bold text-white/20">{i + 1}</div>
                            <div className="mt-12 space-y-8 flex-1">
                              <h4 className="text-2xl font-bold text-white">{v.title}</h4>
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase text-neutral-600 tracking-widest">Como soa:</span>
                                <p className="text-sm text-neutral-400 leading-relaxed ">{v.description}</p>
                              </div>
                              <div className="space-y-3 pt-8 mt-auto">
                                <span className="text-[10px] font-bold uppercase text-neutral-600 tracking-widest">Exemplo de frase:</span>
                                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                  <p className="text-xs text-neutral-300 font-medium leading-relaxed">"{v.example}"</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* Colors Section */}
            {(activeTab === 'all' || activeTab === 'colors') && guideline.colors && guideline.colors.length > 0 && (
              <motion.section id="colors" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="space-y-12">
                  <div className="flex items-end justify-between border-b border-white/5 pb-6">
                    <div className="space-y-4">
                      <MicroTitle className="text-brand-cyan/60 tracking-[0.4em]">Section 02 // Chromatography</MicroTitle>
                      <h2 className="text-3xl font-bold text-white font-manrope">Color Palette</h2>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">{filteredColors.length} Defined Values</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {filteredColors.map((color, i) => (
                      <motion.div
                        key={i}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => handleCopyColor(color.hex)}
                        className="group cursor-pointer space-y-3"
                      >
                        <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 transition-all group-hover:scale-105 group-hover:border-brand-cyan/30 shadow-2xl">
                          <div className="absolute inset-0" style={{ backgroundColor: color.hex }} />
                          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-300 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-300 transition-opacity bg-black/20 backdrop-blur-[2px]">
                            <span className="text-[10px] font-mono text-white opacity-60">COPY HEX</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-neutral-200 truncate uppercase tracking-tight">{color.name || 'Untitled'}</p>
                          <p className="text-[10px] font-mono text-neutral-500 uppercase flex items-center gap-2">
                            {color.hex}
                            <div className="w-1 h-1 rounded-full bg-neutral-800" />
                            {color.role || 'Accent'}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Typography Section */}
            {(activeTab === 'all' || activeTab === 'typography') && guideline.typography && guideline.typography.length > 0 && (
              <motion.section id="typography" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="space-y-12">
                  <div className="flex items-end justify-between border-b border-white/5 pb-6">
                    <div className="space-y-4">
                      <MicroTitle className="text-brand-cyan/60 tracking-[0.4em]">Section 03 // Typography</MicroTitle>
                      <h2 className="text-3xl font-bold text-white font-manrope">Visual Language</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-8">
                    {guideline.typography.map((font, i) => (
                      <div key={i} className="group flex flex-col md:flex-row md:items-center gap-8 md:gap-16 p-8 rounded-3xl bg-white/[0.01] border border-white/[0.03] hover:border-brand-cyan/10 transition-all">
                        <div className="text-7xl md:text-8xl font-bold text-white tracking-tighter w-40 text-center shrink-0" style={{ fontFamily: font.family }}>Aa</div>
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-4">
                            <span className="px-3 py-1 rounded-full bg-brand-cyan/5 border border-brand-cyan/10 text-brand-cyan text-[10px] font-mono uppercase font-bold tracking-widest">{font.role}</span>
                            <span className="text-neutral-500 text-sm font-mono">{font.family}</span>
                          </div>
                          <p className="text-4xl md:text-5xl text-neutral-200 tracking-tight leading-none" style={{ fontFamily: font.family }}>
                            The quick brown fox jumps over the lazy dog.
                          </p>
                          <div className="flex items-center gap-6 pt-2">
                            <div className="space-y-1">
                              <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">Style</span>
                              <p className="text-sm font-medium text-neutral-400">{font.style || 'Regular'}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">Base Size</span>
                              <p className="text-sm font-medium text-neutral-400">{font.size || '16'}PX</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Logos Section */}
            {(activeTab === 'all' || activeTab === 'logos') && guideline.logos && guideline.logos.length > 0 && (
              <motion.section id="logos" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="space-y-12">
                  <div className="flex items-end justify-between border-b border-white/5 pb-6">
                    <div className="space-y-4">
                      <MicroTitle className="text-brand-cyan/60 tracking-[0.4em]">Section 04 // Symbology</MicroTitle>
                      <h2 className="text-3xl font-bold text-white font-manrope">Logotypes & Icons</h2>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] font-mono text-neutral-500 hover:text-brand-cyan gap-2"
                      onClick={() => handleBatchDownload(filteredLogos)}
                    >
                      <Download size={12} />
                      Export {filteredLogos.length} Assets
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredLogos.map((logo, i) => (
                      <motion.div
                        key={i}
                        layout
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="group relative flex flex-col gap-4"
                      >
                        <div className="relative aspect-[4/3] rounded-3xl bg-white/[0.02] border border-white/[0.04] p-8 flex items-center justify-center overflow-hidden transition-all group-hover:bg-white/[0.04] group-hover:border-white/10 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
                          <img src={logo.url} alt={logo.label || 'Logo'} className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)] group-hover:scale-105 transition-transform duration-500" />

                          {/* Quick Actions */}
                          <div className="absolute inset-x-4 bottom-4 flex gap-2 opacity-0 group-hover:opacity-300 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                            <Button
                              className="flex-1 h-9 rounded-xl bg-neutral-900/90 backdrop-blur border border-white/10 text-[9px] font-mono uppercase tracking-widest gap-2 hover:bg-brand-cyan hover:text-black transition-all"
                              onClick={() => {
                                const safeName = (logo.label || logo.variant || 'logo').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                                const ext = logo.url.split('.').pop()?.split('?')[0] || 'png';
                                triggerDownload(logo.url, `${safeName}.${ext}`);
                              }}
                            >
                              <Download size={12} /> Download
                            </Button>
                          </div>
                        </div>
                        <div className="px-2">
                          <p className="text-[10px] font-bold text-white uppercase tracking-[0.1em]">{logo.label || 'Untitled Asset'}</p>
                          <p className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest mt-1">{logo.variant} Variant</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Media Section */}
            {(activeTab === 'all' || activeTab === 'media') && guideline.media && guideline.media.length > 0 && (
              <motion.section id="media" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="space-y-12">
                  <div className="flex items-end justify-between border-b border-white/5 pb-6">
                    <div className="space-y-4">
                      <MicroTitle className="text-brand-cyan/60 tracking-[0.4em]">Section 05 // Visual Library</MicroTitle>
                      <h2 className="text-3xl font-bold text-white font-manrope">Production Assets</h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredMedia.map((item, i) => (
                      <motion.div
                        key={i}
                        layout
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="group relative flex flex-col gap-4"
                      >
                        <div className="relative aspect-[16/10] rounded-3xl overflow-hidden border border-white/[0.04] shadow-2xl transition-all group-hover:scale-[1.02] group-hover:border-white/10">
                          <img src={item.url} alt={item.label || 'Media'} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-300 transition-opacity" />

                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-300 transition-all">
                            <Button
                              size="icon"
                              className="w-14 h-14 rounded-full bg-brand-cyan text-black shadow-[0_0_30px_rgba(var(--brand-cyan-rgb),0.5)] active:scale-90 transition-all"
                              onClick={() => {
                                const safeName = (item.label || 'media').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                                const ext = item.url.split('.').pop()?.split('?')[0] || 'png';
                                triggerDownload(item.url, `${safeName}.${ext}`);
                              }}
                            >
                              <Download size={24} />
                            </Button>
                          </div>

                          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-white tracking-tight">{item.label || 'Production File'}</p>
                              <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest">Asset // 0{i + 1}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Strategy / Editorial Section */}
            {(activeTab === 'all' || activeTab === 'identity') && (guideline.guidelines?.voice || (guideline.guidelines?.dos?.length || 0) > 0) && (
              <motion.section id="editorial" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <MicroTitle className="text-brand-cyan/60 tracking-[0.4em]">Section 06 // Editorial</MicroTitle>
                      <h2 className="text-3xl font-bold text-white font-manrope">Voice & Guidelines</h2>
                    </div>
                    {guideline.guidelines?.voice && (
                      <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05]">
                        <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mb-4 block">Tone of Voice</span>
                        <p className="text-sm text-neutral-400 leading-relaxed ">"{guideline.guidelines.voice}"</p>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {guideline.guidelines?.dos && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-[1px] bg-green-500/30" />
                          <span className="text-[10px] font-mono text-green-500/60 uppercase tracking-widest">Standard Compliance (Do)</span>
                        </div>
                        <ul className="space-y-4">
                          {guideline.guidelines.dos.map((item, i) => (
                            <li key={i} className="flex gap-4 group">
                              <div className="mt-1.5 w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                              <span className="text-sm text-neutral-400 group-hover:text-neutral-200 transition-colors">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {guideline.guidelines?.donts && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-[1px] bg-red-500/30" />
                          <span className="text-[10px] font-mono text-red-500/60 uppercase tracking-widest">Restricted Patterns (Don't)</span>
                        </div>
                        <ul className="space-y-4">
                          {guideline.guidelines.donts.map((item, i) => (
                            <li key={i} className="flex gap-4 group">
                              <div className="mt-1.5 w-1 h-1 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                              <span className="text-sm text-neutral-400 group-hover:text-neutral-200 transition-colors">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Footer */}
        <footer className="mt-40 pt-20 border-t border-white/5 text-center space-y-8">
          <div className="flex justify-center gap-12">
            <div className="text-left space-y-2">
              <span className="text-[10px] font-mono text-neutral-700 uppercase tracking-widest">Version</span>
              <p className="text-xs font-bold text-neutral-500">Visant // Labs®</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
