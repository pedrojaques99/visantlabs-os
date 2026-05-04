import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { SEO } from '@/components/SEO';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Download,
  AlertCircle,
  Search,
  Diamond,
  ChevronLeft,
  ChevronDown,
  Sun,
  Moon,
  Home,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';
import { Input } from '@/components/ui/input';
import {
  BrandReadOnlyView,
  extractBrandTheme,
  getRelativeLuminance,
  toCSSVariables,
} from '@/components/brand/BrandReadOnlyView';
import {
  PUBLIC_TABS,
  downloadBlob,
  triggerAssetDownload,
  safeFileName,
  extFromUrl,
} from '@/components/brand/brand-shared-config';
import { buildMockTokens } from '@/components/brand/guidelines/preview/mockTokens';
import {
  InstagramFeedMock,
  LinkedInPostMock,
  PosterMock,
  StoriesMock,
  WebsiteHeroMock,
  BusinessCardMock,
  EmailHeaderMock,
} from '@/components/brand/guidelines/preview/BrandMocks';
import { exportMockElement, EXPORT_FORMATS, type ExportFormat } from '@/components/brand/guidelines/preview/exportMock';

const PREVIEW_MOCKS = [
  { id: 'instagram', label: 'Instagram', Component: InstagramFeedMock },
  { id: 'linkedin',  label: 'LinkedIn',  Component: LinkedInPostMock },
  { id: 'website',   label: 'Website',   Component: WebsiteHeroMock },
  { id: 'card',      label: 'Card',      Component: BusinessCardMock },
  { id: 'email',     label: 'Email',     Component: EmailHeaderMock },
  { id: 'poster',    label: 'Poster',    Component: PosterMock },
  { id: 'stories',   label: 'Stories',   Component: StoriesMock },
] as const;

export const PublicBrandGuideline: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [guideline, setGuideline] = useState<BrandGuideline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [theme, setTheme] = useState<'brand' | 'light' | 'dark'>('brand');
  const [activePreview, setActivePreview] = useState('instagram');
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const publicMockRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showExportMenu]);

  const handleExportMock = useCallback(async (format: ExportFormat) => {
    if (!publicMockRef.current || !guideline) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      await exportMockElement(publicMockRef.current, guideline.identity?.name || 'brand', activePreview, format);
      toast.success(`Exported ${activePreview} as ${format.toUpperCase()}`);
    } catch {
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    } finally {
      setExporting(false);
    }
  }, [activePreview, guideline]);

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
    const name = safeFileName(guideline.identity?.name, 'brand');
    downloadBlob(JSON.stringify(guideline, null, 2), `${name}-guidelines.json`, 'application/json');
    toast.success('Downloaded as JSON');
  };

  const handleDownloadCSS = () => {
    if (!guideline) return;
    const name = safeFileName(guideline.identity?.name, 'brand');
    downloadBlob(toCSSVariables(guideline), `${name}-variables.css`, 'text/css');
    toast.success('Downloaded as CSS');
  };

  const brandTheme = useMemo(() => extractBrandTheme(guideline, theme), [guideline, theme]);
  const tokens = useMemo(() => buildMockTokens(guideline), [guideline]);

  const currentTab = PUBLIC_TABS.find(t => t.id === activeTab) || PUBLIC_TABS[0];
  const visibleSections = currentTab.sections;

  const hasPreviewData =
    (tokens.palette.length > 0) || !!tokens.primaryLogo || !!guideline?.identity?.name;

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
  const isLightBg = getRelativeLuminance(brandTheme.bg) > 0.5;
  const navBtnClass = isLightBg
    ? "bg-black/5 border-black/10 text-black hover:bg-black/10"
    : "bg-white/5 border-white/10 text-white hover:bg-white/10";

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
        {PUBLIC_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
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
          );
        })}
      </nav>

      {/* Top-left nav buttons */}
      <div className="flex gap-2 fixed top-5 left-5 z-[1000]">
        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          className={cn("h-9 px-4 text-[10px] font-mono gap-2 border backdrop-blur-md transition-all", navBtnClass)}
        >
          <Home size={14} /> HOME
        </Button>
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className={cn("h-9 px-4 text-[10px] font-mono gap-2 border backdrop-blur-md transition-all", navBtnClass)}
        >
          <ChevronLeft size={14} /> VOLTAR
        </Button>
      </div>

      {/* Top-right controls */}
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
          <Download size={14} aria-hidden="true" />
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
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
                <Input
                  placeholder="Search assets, colors, or specs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-transparent border-none focus-visible:ring-0 text-sm placeholder:opacity-40"
                />
              </div>

              <div className="hidden md:flex items-center gap-1 border-l border-[var(--brand-text)]/10 pl-4">
                {PUBLIC_TABS.map((tab) => (
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

        {/* Brand Preview Strip — shows mocks when Preview tab active or in Overview */}
        {(activeTab === 'preview' || activeTab === 'all') && hasPreviewData && (
          <motion.div
            id="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <MicroTitle className="text-[var(--accent)] tracking-[0.15em] font-bold opacity-70">
                Brand Preview
              </MicroTitle>
              <span className="text-[9px] font-mono uppercase tracking-widest opacity-30">
                Live · local render
              </span>
            </div>

            {/* Format selector + export */}
            <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 scrollbar-none [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_16px,black_calc(100%-40px),transparent)]">
              {PREVIEW_MOCKS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActivePreview(m.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap',
                    activePreview === m.id
                      ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                      : 'opacity-40 hover:opacity-80 hover:bg-[var(--brand-text)]/5'
                  )}
                >
                  {m.label}
                </button>
              ))}

              {/* Export dropdown */}
              <div ref={exportMenuRef} className="ml-auto relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu(v => !v)}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest opacity-50 hover:opacity-100 transition-all disabled:opacity-30"
                >
                  {exporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                  Export
                  <ChevronDown size={9} />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-neutral-900 border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[100px]">
                    {EXPORT_FORMATS.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleExportMock(f.id)}
                        className="w-full text-left px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active mock */}
            <GlassPanel padding="md" className="bg-[var(--brand-surface)]/30 border-[var(--brand-text)]/5">
              <div ref={publicMockRef} className="max-w-2xl mx-auto">
                {PREVIEW_MOCKS.map(m => (
                  activePreview === m.id && <m.Component key={m.id} tokens={tokens} />
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--brand-text)]/5">
                <div className="flex items-center gap-2">
                  {tokens.palette.slice(0, 5).map((c, i) => (
                    <span key={i} className="w-3 h-3 rounded-full border border-[var(--brand-text)]/10" style={{ background: c.hex }} />
                  ))}
                </div>
                <div className="flex items-center gap-3 text-[9px] font-mono uppercase tracking-widest opacity-40">
                  <span>{tokens.headingFamily.match(/^['"]?([^'",]+)/)?.[1] || 'Inter'}</span>
                  <span>·</span>
                  <span>{tokens.primaryColor}</span>
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        )}

        {/* Brand content sections */}
        {activeTab !== 'preview' && (
          <BrandReadOnlyView
            guideline={guideline}
            sections={visibleSections}
            searchTerm={searchTerm}
            onAssetClick={(url, _type, item) => {
              const name = safeFileName(item.label || item.variant);
              triggerAssetDownload(url, `${name}.${extFromUrl(url)}`);
            }}
          />
        )}

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
