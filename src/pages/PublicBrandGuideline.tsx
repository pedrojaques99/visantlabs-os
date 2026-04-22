import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { SEO } from '@/components/SEO';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
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
  ChevronLeft,
  Sun,
  Moon,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';
import { Input } from '@/components/ui/input';
import {
  BrandReadOnlyView,
  type BrandViewSection,
  extractBrandTheme,
  getRelativeLuminance,
  toCSSVariables,
} from '@/components/brand/BrandReadOnlyView';

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  } catch {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  }
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

  const brandTheme = useMemo(() => extractBrandTheme(guideline, theme), [guideline, theme]);

  const visibleSections = useMemo<BrandViewSection[]>(() => {
    switch (activeTab) {
      case 'identity':
        return ['identity', 'guidelines'];
      case 'strategy':
        return ['manifesto', 'archetypes', 'personas', 'voiceValues', 'guidelines'];
      case 'colors':
        return ['colors'];
      case 'typography':
        return ['typography'];
      case 'logos':
        return ['logos'];
      case 'media':
        return ['media'];
      default:
        return ['identity', 'manifesto', 'archetypes', 'personas', 'voiceValues', 'colors', 'typography', 'logos', 'media', 'guidelines'];
    }
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 flex flex-col items-center gap-4">
          <GlitchLoader size={40} />
          <MicroTitle className="text-neutral-600 uppercase tracking-[0.1em]">Decrypting Brand Assets</MicroTitle>
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

  return (
    <div
      className="min-h-screen transition-all duration-1000 selection:bg-[var(--accent)]/30 overflow-x-hidden"
      style={{
        '--accent': brandTheme.accent,
        '--accent-rgb': brandTheme.accentRgb,
        '--accent-text': brandTheme.accentText,
        '--brand-bg': brandTheme.bg,
        '--brand-surface': brandTheme.surface,
        '--brand-text': brandTheme.text,
        backgroundColor: 'var(--brand-bg)',
        color: 'var(--brand-text)'
      } as any}
    >
      <SEO title={`${brandName} - Brand Portal`} description={guideline.identity?.description || guideline.identity?.tagline} />

      {/* Floating Side Nav (Desktop) */}
      <nav aria-label="Brand sections" className="fixed left-8 top-1/2 -translate-y-1/2 z-50 hidden xl:flex flex-col gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            aria-current={activeTab === tab.id ? 'true' : undefined}
            onClick={() => {
              setActiveTab(tab.id);
              document.getElementById(tab.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={cn(
              "group flex items-center gap-3 transition-all duration-300",
              activeTab === tab.id ? "translate-x-2" : "opacity-60 hover:opacity-100"
            )}
          >
            <div aria-hidden="true" className={cn(
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
      <div className="flex gap-2 fixed top-5 left-5 z-[1000]">
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

      <div className="flex gap-2 fixed top-5 right-5 z-[1000]">
        <Button
          onClick={() => setTheme(prev => prev === 'brand' ? 'light' : prev === 'light' ? 'dark' : 'brand')}
          variant="ghost"
          aria-label={`Switch theme, current: ${theme}`}
          className={cn(
            "h-10 px-4 rounded-full border transition-all duration-500 gap-2 font-mono text-[10px] font-bold uppercase tracking-widest",
            theme === 'brand'
              ? "bg-[var(--accent)] text-[var(--accent-text)] border-transparent shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]"
              : theme === 'dark'
                ? "bg-neutral-900 border-white/5 text-white hover:bg-neutral-800"
                : "bg-white border-neutral-200 text-neutral-900 hover:bg-neutral-50 shadow-sm"
          )}
        >
          {theme === 'brand' ? <Diamond size={14} className="animate-pulse" aria-hidden="true" /> : theme === 'light' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
          {theme}
        </Button>
        <Button
          onClick={handleDownloadJSON}
          variant="ghost"
          aria-label="Download brand guidelines as JSON"
          className={cn(
            "h-10 w-10 p-0 rounded-full border transition-colors",
            theme === 'dark'
              ? "bg-neutral-900/50 border-white/5 text-neutral-400 hover:text-white"
              : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-900 shadow-sm"
          )}
        >
          <Download size={14} aria-hidden="true" />
        </Button>
        <Button
          onClick={handleDownloadCSS}
          variant="ghost"
          aria-label="Download brand variables as CSS"
          className={cn(
            "h-10 w-10 p-0 rounded-full border transition-colors",
            theme === 'dark'
              ? "bg-neutral-900/50 border-white/5 text-neutral-400 hover:text-white"
              : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-900 shadow-sm"
          )}
        >
          <Palette size={14} aria-hidden="true" />
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
              <MicroTitle className="text-[var(--accent)] tracking-[0.1em] font-bold opacity-60">
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
                    aria-current={activeTab === tab.id ? 'true' : undefined}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                      activeTab === tab.id
                        ? "bg-[var(--accent)] text-[var(--accent-text)]"
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

        <BrandReadOnlyView
          guideline={guideline}
          sections={visibleSections}
          searchTerm={searchTerm}
          onAssetClick={(url, _type, item) => {
            const safeName = (item.label || item.variant || 'asset').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const ext = url.split('.').pop()?.split('?')[0] || 'png';
            triggerDownload(url, `${safeName}.${ext}`);
          }}
        />

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
