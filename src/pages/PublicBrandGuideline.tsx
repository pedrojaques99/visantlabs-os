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
  Diamond,
  User,
  ChevronLeft,
  Sun,
  Moon,
  Home,
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

// Accessibility Helpers
function getRelativeLuminance(hex: string): number {
  const h = hex.replace('#', '').padEnd(6, '0');
  const rgb = [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255
  ].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function getContrastRatio(l1: number, l2: number): number {
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

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
  const [theme, setTheme] = useState<'brand' | 'light' | 'dark'>('brand');

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

  // Intelligent Brand Theme Extraction
  const brandTheme = useMemo(() => {
    const findByRole = (role: string) => 
      guideline?.colors?.find(c => c.role?.toUpperCase() === role || c.name?.toUpperCase() === role);
    
    const findByMatch = (keywords: string[]) => 
      guideline?.colors?.find(c => keywords.some(k => c.name?.toLowerCase().includes(k) || c.role?.toLowerCase().includes(k)));

    // Base Brand Tokens
    const accentToken = findByRole('PRIMARY') || findByRole('ACCENT') || findByMatch(['brand', 'primary', 'accent', 'main']) || { hex: '#00E5FF' };
    const bgToken = findByRole('BACKGROUND') || findByRole('BG') || findByMatch(['background', 'canvas', 'bg']) || { hex: '#0a0a0a' };
    const surfaceToken = findByRole('SURFACE') || findByRole('CARD') || findByMatch(['surface', 'card', 'neutral', 'off']) || { hex: '#141414' };
    const textToken = findByRole('TEXT') || findByRole('HEADLINE') || findByMatch(['text', 'content', 'body']) || { hex: '#ffffff' };

    // Sort palette by luminance to find extremes
    const paletteByLum = [...(guideline?.colors || [])].sort((a, b) => 
      getRelativeLuminance(a.hex) - getRelativeLuminance(b.hex)
    );

    const lightestInPalette = paletteByLum[paletteByLum.length - 1]?.hex || '#ffffff';
    const darkestInPalette = paletteByLum[0]?.hex || '#050505';

    // Resolve base colors
    let rBg = bgToken.hex;
    let rSurface = surfaceToken.hex;
    let rText = textToken.hex;

    if (theme === 'light') {
      rBg = lightestInPalette;
      // If lightest is too dark for a 'light' base, force white
      if (getRelativeLuminance(rBg) < 0.8) rBg = '#ffffff'; 
      // Surface is slightly darker than BG
      rSurface = paletteByLum[paletteByLum.length - 2]?.hex || '#f5f5f7';
      rText = darkestInPalette;
    } else if (theme === 'dark') {
      rBg = darkestInPalette;
      // If darkest is too light for a 'dark' base, force black
      if (getRelativeLuminance(rBg) > 0.2) rBg = '#050505';
      // Surface is slightly lighter than BG
      rSurface = paletteByLum[1]?.hex || '#111111';
      rText = lightestInPalette;
    }

    // Acessibilidade Audit: Check contrast between bg and text
    const bgLum = getRelativeLuminance(rBg);
    let textLum = getRelativeLuminance(rText);
    let contrast = getContrastRatio(bgLum, textLum);

    // If contrast < 4.5 (WCAG AA), intelligently fix it
    if (contrast < 4.5) {
      rText = bgLum > 0.5 ? '#000000' : '#ffffff';
    }

    const toRgb = (hex: string) => {
      const h = hex.replace('#', '').padEnd(6, '0');
      const r = parseInt(h.substring(0, 2), 16) || 0;
      const g = parseInt(h.substring(2, 4), 16) || 0;
      const b = parseInt(h.substring(4, 6), 16) || 0;
      return `${r}, ${g}, ${b}`;
    };

    return {
      accent: accentToken.hex,
      accentRgb: toRgb(accentToken.hex),
      bg: rBg,
      surface: rSurface,
      text: rText,
      isCustomBg: theme === 'brand' && (!!findByRole('BACKGROUND') || !!findByMatch(['background', 'bg']))
    };
  }, [guideline?.colors, theme]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 flex flex-col items-center gap-4">
          <GlitchLoader size={40} />
          <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em]">Decrypting Brand Assets</MicroTitle>
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
            <Button variant="outline" className="text-[var(--accent)] border-[var(--accent)]/20 hover:bg-[var(--accent)]/5" style={{ '--accent': guideline?.colors?.[0]?.hex || '#00E5FF' } as any}>
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
    <div 
      className="min-h-screen transition-all duration-1000 selection:bg-[var(--accent)]/30 overflow-x-hidden"
      style={{ 
        '--accent': brandTheme.accent,
        '--accent-rgb': brandTheme.accentRgb,
        '--brand-bg': brandTheme.bg,
        '--brand-surface': brandTheme.surface,
        '--brand-text': brandTheme.text,
        backgroundColor: 'var(--brand-bg)',
        color: 'var(--brand-text)'
      } as any}
    >
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
              activeTab === tab.id ? "translate-x-2" : "opacity-60 hover:opacity-100"
            )}
          >
            <div className={cn(
              "w-1 h-1 rounded-full transition-all duration-300",
              activeTab === tab.id 
                ? "h-6 bg-[var(--accent)] shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]" 
                : "bg-current opacity-20 group-hover:opacity-60"
            )} />
            <span className="text-[10px] uppercase font-bold tracking-wider font-mono opacity-80 group-hover:opacity-100 transition-opacity">
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
      <div className="flex gap-2" style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 1000 }}>
        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          className={cn(
            "h-9 px-4 text-[10px] font-mono gap-2 border backdrop-blur-md transition-all",
            getRelativeLuminance(brandTheme.bg) > 0.5
              ? "bg-black/5 border-black/10 text-black hover:bg-black/10"
              : "bg-white/5 border-white/10 text-white hover:bg-white/10"
          )}
        >
          <Home size={14} /> HOME
        </Button>
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className={cn(
            "h-9 px-4 text-[10px] font-mono gap-2 border backdrop-blur-md transition-all",
            getRelativeLuminance(brandTheme.bg) > 0.5
              ? "bg-black/5 border-black/10 text-black hover:bg-black/10"
              : "bg-white/5 border-white/10 text-white hover:bg-white/10"
          )}
        >
          <ChevronLeft size={14} /> VOLTAR
        </Button>
      </div>

      <div className="flex gap-2" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
        <Button 
          onClick={() => setTheme(prev => prev === 'brand' ? 'light' : prev === 'light' ? 'dark' : 'brand')}
          variant="ghost" 
          className={cn(
            "h-10 px-4 rounded-full border transition-all duration-500 gap-2 font-mono text-[10px] font-bold uppercase tracking-widest",
            theme === 'brand' 
              ? "bg-[var(--accent)] text-black border-transparent shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]" 
              : theme === 'dark'
                ? "bg-neutral-900 border-white/5 text-white hover:bg-neutral-800" 
                : "bg-white border-neutral-200 text-neutral-900 hover:bg-neutral-50 shadow-sm"
          )}
        >
          {theme === 'brand' ? <Diamond size={14} className="animate-pulse" /> : theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
          {theme}
        </Button>
        <Button 
          onClick={handleDownloadJSON} 
          variant="ghost" 
          className={cn(
            "h-10 w-10 p-0 rounded-full border transition-colors",
            theme === 'dark' 
              ? "bg-neutral-900/50 border-white/5 text-neutral-400 hover:text-white" 
              : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-900 shadow-sm"
          )}
        >
          <Download size={14} />
        </Button>
        <Button 
          onClick={handleDownloadCSS} 
          variant="ghost" 
          className={cn(
            "h-10 w-10 p-0 rounded-full border transition-colors",
            theme === 'dark' 
              ? "bg-neutral-900/50 border-white/5 text-neutral-400 hover:text-white" 
              : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-900 shadow-sm"
          )}
        >
          <Palette size={14} />
        </Button>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 md:py-24">
        {/* Dynamic Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative mb-32"
        >
          {theme === 'dark' && brandTheme.isCustomBg && (
            <div className="absolute -top-40 -left-60 w-[800px] h-[800px] bg-[var(--accent)]/5 rounded-full blur-[160px] opacity-20 pointer-events-none" />
          )}

          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-12">
            <div className="space-y-6">
              <MicroTitle className="text-[var(--accent)] tracking-[0.3em] font-bold opacity-60">
                {guideline.identity?.tagline || 'Brand Guidelines'}
              </MicroTitle>
              <h1 className="text-6xl md:text-8xl font-black font-manrope tracking-tight leading-[0.9]">
                {brandName}
              </h1>
            </div>
          </div>
        </motion.div>

        {/* Global Controls */}
        <div className="sticky top-6 z-40 mb-16 px-2">
          <GlassPanel padding="sm" className="backdrop-blur-2xl transition-all duration-500 bg-[var(--brand-surface)]/80 border-[var(--brand-text)]/10 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
                <Input
                  placeholder="Search assets, colors, or specs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-transparent border-none focus-visible:ring-0 text-sm placeholder:opacity-40"
                />
              </div>

              {/* Desktop Filters */}
              <div className="hidden md:flex items-center gap-1 border-l border-[var(--brand-text)]/10 pl-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                      activeTab === tab.id 
                        ? "bg-[var(--accent)] text-black" 
                        : "opacity-40 hover:opacity-100 hover:bg-[var(--brand-text)]/5"
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
                  <h2 className="text-4xl font-bold font-manrope opacity-90">Identity</h2>
                  {guideline.identity?.description && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                      <div className="md:col-span-2">
                        <p className="text-lg md:text-xl leading-relaxed font-light opacity-70">
                          {guideline.identity.description}
                        </p>
                      </div>
                      <div className="space-y-8">
                        {guideline.identity?.tagline && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-mono opacity-40 uppercase tracking-widest">Brand Tagline</span>
                            <p className="text-sm font-bold uppercase opacity-80">{guideline.identity.tagline}</p>
                          </div>
                        )}
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono opacity-40 uppercase tracking-widest">Primary Objective</span>
                          <p className="text-sm font-bold opacity-80">Standardize Visual & Strategic Communications</p>
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
                {/* Manifest - Full Screen Style */}
                {guideline.strategy.manifesto && (
                  <div className="space-y-12">
                    <div className="flex items-center gap-4">
                      <div className="h-[1px] w-12 bg-[var(--accent)]/30" />
                      <MicroTitle className="text-[var(--accent)]/60 tracking-wider">[Manifesto]</MicroTitle>
                    </div>
                    <div className="relative group">
                      <div className="absolute -inset-8 bg-[var(--accent)]/[0.02] blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                      <h3 className="text-4xl md:text-6xl font-bold tracking-tight font-manrope leading-[1.1] opacity-90">
                        {guideline.strategy.manifesto.split('\n')[0]}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-16">
                        {guideline.strategy.manifesto.split('\n').slice(1).map((para, i) => (
                          <p key={i} className="text-lg md:text-xl leading-relaxed font-light opacity-60">
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
                    <h2 className="text-4xl font-bold font-manrope opacity-90">Archetypes</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {guideline.strategy.archetypes.map((arch, i) => (
                        <div key={i} className="group relative rounded-[40px] p-12 flex flex-col md:flex-row gap-12 items-center overflow-hidden min-h-[400px] transition-colors bg-[var(--brand-surface)]/40 border-[var(--brand-text)]/5 hover:border-[var(--brand-text)]/10">
                          <div className="w-full md:w-1/2 aspect-[3/4] rounded-2xl border-[3px] p-4 flex flex-col items-center justify-between relative transition-all duration-500 border-[var(--brand-text)]/20 bg-[var(--brand-bg)] shadow-2xl group-hover:rotate-2">
                            <div className="w-full text-center border-b border-[var(--brand-text)]/10 pb-2 flex items-center justify-center px-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{arch.name}</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center py-8">
                              {arch.image ? <img src={arch.image} className="w-full object-contain" /> : <Diamond size={64} className="opacity-10" />}
                            </div>
                          </div>
                          <div className="flex-1 space-y-6">
                            <h4 className="text-3xl font-bold tracking-tight opacity-90">{arch.name}</h4>
                            <p className="text-lg font-light leading-relaxed opacity-60">
                              {arch.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Personas - Gustavo Style */}
                {guideline.strategy.personas && guideline.strategy.personas.length > 0 && (
                  <div className="space-y-16">
                    <h2 className="text-4xl font-bold font-manrope opacity-90">Personas</h2>
                    <div className="grid grid-cols-1 gap-12">
                      {guideline.strategy.personas.map((persona, i) => (
                        <GlassPanel key={i} padding="lg" className="bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/10">
                          <div className="flex flex-col md:flex-row gap-12">
                            <div className="w-full md:w-1/3 aspect-square rounded-[32px] overflow-hidden border border-[var(--brand-text)]/10 shadow-2xl">
                              {persona.image ? <img src={persona.image} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-black/20 flex items-center justify-center opacity-30"><User size={64} /></div>}
                            </div>
                            <div className="flex-1 space-y-8">
                              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div className="space-y-1">
                                  <h4 className="text-4xl font-bold opacity-90">{persona.name}, {persona.age}</h4>
                                  <div className="flex flex-wrap gap-2 pt-2">
                                    {persona.traits?.map((trait, idx) => (
                                      <span key={idx} className="px-3 py-1 rounded-full border border-[var(--brand-text)]/10 bg-[var(--brand-text)]/5 text-[10px] font-bold uppercase tracking-widest opacity-60">{trait}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="h-[1px] w-full bg-[var(--brand-text)]/10" />

                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {persona.desires?.map((desire, idx) => (
                                    <div key={idx} className="p-6 rounded-2xl border border-[var(--brand-text)]/5 bg-[var(--brand-surface)]/60 hover:border-[var(--brand-text)]/10 transition-all">
                                      <p className="text-sm leading-relaxed font-light opacity-60">{desire}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {persona.bio && (
                                <div className="p-6 rounded-2xl border border-[var(--brand-text)]/5 bg-[var(--brand-text)]/[0.02]">
                                  <p className="text-sm font-light leading-relaxed opacity-60">"{persona.bio}"</p>
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
                    <h2 className="text-4xl font-bold font-manrope opacity-90">Tone of Voice</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {guideline.strategy.voiceValues.map((v, i) => (
                        <div key={i} className="relative group p-8 rounded-[32px] border transition-all duration-500 overflow-hidden min-h-[400px] flex flex-col bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/5 hover:bg-[var(--brand-surface)]/40 hover:border-[var(--brand-text)]/10">
                          <div className="absolute top-0 left-0 w-16 h-16 rounded-br-[32px] flex items-center justify-center text-xl font-bold bg-[var(--brand-text)]/5 opacity-20">{i + 1}</div>
                          <div className="mt-12 space-y-8 flex-1">
                            <h4 className="text-2xl font-bold opacity-90">{v.title}</h4>
                            <p className="text-sm leading-relaxed opacity-60 transition-colors">{v.description}</p>
                            <div className="p-4 rounded-xl border mt-auto bg-[var(--brand-text)]/[0.02] border-[var(--brand-text)]/5 shadow-inner">
                              <p className="text-xs font-medium leading-relaxed italic opacity-80">"{v.example}"</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* Colors Section */}
            {(activeTab === 'all' || activeTab === 'colors') && guideline.colors && guideline.colors.length > 0 && (
              <motion.section id="colors" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="space-y-12">
                  <div className="flex items-end justify-between border-b border-[var(--brand-text)]/10 pb-12">
                    <h2 className="text-4xl font-bold font-manrope opacity-90">Color Palette</h2>
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
                        <div className="relative aspect-square rounded-2xl overflow-hidden border border-[var(--brand-text)]/10 transition-all group-hover:scale-105 group-hover:border-[var(--accent)]/30 shadow-2xl">
                          <div className="absolute inset-0" style={{ backgroundColor: color.hex }} />
                          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[2px]">
                            <span className="text-[10px] font-mono text-white opacity-60">COPY HEX</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold truncate uppercase tracking-tight opacity-90">{color.name || 'Untitled'}</p>
                          <p className="text-[10px] font-mono opacity-40 uppercase flex items-center gap-2">
                            {color.hex}
                            <div className="w-1 h-1 rounded-full bg-current opacity-20" />
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
                  <div className="flex items-end justify-between border-b border-[var(--brand-text)]/10 pb-12">
                    <h2 className="text-4xl font-bold font-manrope opacity-90">Typography</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-8">
                    {guideline.typography.map((font, i) => (
                      <div key={i} className="group flex flex-col md:flex-row md:items-center gap-8 md:gap-16 p-8 rounded-3xl border transition-all bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/5 hover:border-[var(--brand-text)]/10">
                        <div className="text-7xl md:text-8xl font-bold tracking-tighter w-40 text-center shrink-0 opacity-90" style={{ fontFamily: font.family }}>Aa</div>
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-4">
                            <span className="px-3 py-1 rounded-full text-[10px] font-mono uppercase font-black tracking-widest border bg-[var(--brand-text)]/5 text-[var(--brand-text)] border-[var(--brand-text)]/10">
                              {font.role}
                            </span>
                            <span className="text-xs font-mono font-medium opacity-40">{font.family}</span>
                          </div>
                          <p className="text-4xl md:text-5xl tracking-tight leading-none opacity-80" style={{ fontFamily: font.family }}>
                            The quick brown fox jumps over the lazy dog.
                          </p>
                          <div className="flex items-center gap-6 pt-2">
                            <div className="space-y-1">
                              <span className="text-[9px] font-mono uppercase tracking-widest font-bold opacity-30">Style</span>
                              <p className="text-sm font-bold opacity-70">{font.style || 'Regular'}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-mono uppercase tracking-widest font-bold opacity-30">Base Size</span>
                              <p className="text-sm font-bold opacity-70">{font.size || '16'}PX</p>
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
                  <div className="flex items-end justify-between border-b border-[var(--brand-text)]/10 pb-12">
                    <h2 className="text-4xl font-bold font-manrope opacity-90">Logo Assets</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] font-mono opacity-40 hover:opacity-100 hover:text-[var(--accent)] gap-2"
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
                        <div className="relative aspect-[4/3] rounded-3xl p-8 flex items-center justify-center overflow-hidden transition-all duration-500 border bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/5 group-hover:bg-[var(--brand-surface)]/40 group-hover:border-[var(--brand-text)]/10 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                          <img 
                            src={logo.url} 
                            alt={logo.label || 'Logo'} 
                            className="w-3/4 h-3/4 object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_15px_25px_rgba(0,0,0,0.2)]" 
                          />

                          {/* Quick Actions */}
                          <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                            <Button
                              className="w-full h-10 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-2 shadow-lg transition-all bg-[var(--accent)] text-black hover:scale-[1.02]"
                              onClick={() => {
                                const safeName = (logo.label || logo.variant || 'logo').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                                const ext = logo.url.split('.').pop()?.split('?')[0] || 'png';
                                triggerDownload(logo.url, `${safeName}.${ext}`);
                              }}
                            >
                              <Download size={14} /> Download
                            </Button>
                          </div>
                        </div>
                        <div className="px-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-90">{logo.label || 'Untitled Asset'}</p>
                          <p className="text-[9px] font-mono uppercase tracking-widest mt-1 opacity-40">{logo.variant} Variant</p>
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
                  <div className={cn("flex items-end justify-between border-b pb-12", theme === 'dark' ? "border-white/5" : "border-neutral-200")}>
                    <h2 className={cn("text-4xl font-bold font-manrope", theme === 'dark' ? "text-white" : "text-neutral-900")}>Media Library</h2>
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
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                            <Button
                              size="icon"
                              className="w-14 h-14 rounded-full bg-[var(--accent)] text-black shadow-[0_0_30px_rgba(var(--accent-rgb),0.5)] active:scale-90 transition-all"
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
                              <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">Asset // 0{i + 1}</span>
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
            {(activeTab === 'all' || activeTab === 'identity' || activeTab === 'strategy') && (guideline.guidelines?.voice || (guideline.guidelines?.dos?.length || 0) > 0) && (
              <motion.section id="editorial" variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                  <div className="space-y-8">
                    <h2 className="text-4xl font-bold font-manrope opacity-90">Guidelines</h2>
                    {guideline.guidelines?.voice && (
                      <div className="p-8 rounded-3xl bg-[var(--brand-text)]/[0.03] border border-[var(--brand-text)]/[0.05]">
                        <p className="text-lg md:text-xl font-serif italic leading-relaxed opacity-60">"{guideline.guidelines.voice}"</p>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {guideline.guidelines?.dos && (
                      <div className="space-y-6">
                        <ul className="space-y-4 pt-12">
                          {guideline.guidelines.dos.map((item, i) => (
                            <li key={i} className="flex gap-4 group">
                              <div className="mt-1.5 w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
                              <span className="text-sm opacity-60 group-hover:opacity-100 transition-opacity">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {guideline.guidelines?.donts && (
                      <div className="space-y-6">
                        <ul className="space-y-4 pt-12">
                          {guideline.guidelines.donts.map((item, i) => (
                            <li key={i} className="flex gap-4 group">
                              <div className="mt-1.5 w-1 h-1 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
                              <span className="text-sm opacity-60 group-hover:opacity-100 transition-opacity">{item}</span>
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
        <footer className="mt-40 pt-20 border-t border-[var(--brand-text)]/10 text-center space-y-8">
          <div className="flex justify-center gap-12">
            <div className="text-left space-y-2">
              <span className="text-[10px] font-mono opacity-30 uppercase tracking-widest">Version</span>
              <p className="text-xs font-bold opacity-40">Visant // Labs®</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
