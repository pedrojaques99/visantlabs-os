import React, { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionBlock } from '../SectionBlock';
import { LayoutTemplate, Instagram, Linkedin, FileImage, Smartphone, Download, ChevronDown, Twitter, Bell, AppWindow, FileText, Presentation, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';
import { buildMockTokens, type MockTokens } from './mockTokens';
import {
  InstagramFeedMock,
  LinkedInPostMock,
  PosterMock,
  StoriesMock,
  WebsiteHeroMock,
  BusinessCardMock,
  EmailHeaderMock,
  XProfileMock,
  SocialCardMock,
  NotificationMock,
  AppStoreMock,
  LetterheadMock,
  PresentationSlideMock,
} from './BrandMocks';
import { exportMockElement, EXPORT_FORMATS, type ExportFormat } from './exportMock';
import { GlitchLoader } from '@/components/ui/GlitchLoader'

interface PreviewSectionProps {
  guideline: BrandGuideline;
  span?: string;
}

type ViewMode = 'bento' | 'stacked';
type FormatId = 'instagram' | 'linkedin' | 'poster' | 'stories' | 'website' | 'card' | 'email' | 'xprofile' | 'socialcard' | 'notification' | 'appstore' | 'letterhead' | 'slide';

const FORMATS: Array<{ id: FormatId; label: string; icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }> = [
  { id: 'website',      label: 'Website',       icon: LayoutTemplate },
  { id: 'instagram',    label: 'Instagram',    icon: Instagram },
  { id: 'linkedin',     label: 'LinkedIn',     icon: Linkedin },
  { id: 'stories',      label: 'Stories',       icon: Smartphone },
  { id: 'poster',       label: 'Poster',       icon: FileImage },
  { id: 'card',         label: 'Card',          icon: FileImage },
  { id: 'slide',        label: 'Slide',         icon: Presentation },
  { id: 'email',        label: 'Email',         icon: FileImage },
  { id: 'xprofile',     label: 'X / Twitter',   icon: Twitter },
  { id: 'notification', label: 'Notification',  icon: Bell },
  { id: 'socialcard',   label: 'Social Card',   icon: AppWindow },
  { id: 'appstore',     label: 'App Store',     icon: AppWindow },
  { id: 'letterhead',   label: 'Letterhead',    icon: FileText },
];

const SPANS: Record<FormatId, string> = {
  website: 'lg:col-span-8 lg:row-span-2',
  instagram: 'lg:col-span-4 lg:row-span-1',
  linkedin: 'lg:col-span-4 lg:row-span-1',
  stories: 'lg:col-span-4 lg:row-span-2',
  poster: 'lg:col-span-4 lg:row-span-1',
  card: 'lg:col-span-4 lg:row-span-1',
  slide: 'lg:col-span-8 lg:row-span-1',
  email: 'lg:col-span-4 lg:row-span-1',
  xprofile: 'lg:col-span-8 lg:row-span-1',
  notification: 'lg:col-span-4 lg:row-span-1',
  socialcard: 'lg:col-span-4 lg:row-span-1',
  appstore: 'lg:col-span-4 lg:row-span-1',
  letterhead: 'lg:col-span-4 lg:row-span-1',
};

const BentoCard = ({ 
  format, 
  tokens, 
  viewMode,
  onExport 
}: { 
  format: typeof FORMATS[0]; 
  tokens: MockTokens;
  viewMode: ViewMode;
  onExport: (el: HTMLElement, format: ExportFormat, id: string) => Promise<void>;
}) => {
  const [showExport, setShowExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const Icon = format.icon;

  useEffect(() => {
    if (!showExport) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowExport(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExport]);

  const handleExport = async (f: ExportFormat) => {
    if (!ref.current) return;
    setIsExporting(true);
    setShowExport(false);
    await onExport(ref.current, f, format.id);
    setIsExporting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "group relative flex flex-col gap-4 p-4 rounded-lg bg-white/[0.01] border border-white/[0.05] hover:border-white/[0.1] transition-all overflow-hidden",
        viewMode === 'bento' ? SPANS[format.id] : 'col-span-full'
      )}
    >
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-white/[0.01] text-neutral-700 group-hover:text-neutral-500 transition-colors">
            <Icon size={12} strokeWidth={1.5} />
          </div>
          <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-neutral-700 group-hover:text-neutral-600 transition-colors">
            {format.label}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[8px] font-mono text-neutral-800 transition-colors">
            {dimsLabel(format.id)}
          </span>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowExport(!showExport)}
              className="p-1.5 rounded-md hover:bg-white/[0.04] text-neutral-800 hover:text-neutral-400 transition-all"
            >
              {isExporting ? <GlitchLoader size={11} /> : <Download size={11} strokeWidth={1.5} />}
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-neutral-900 border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[80px]">
                {EXPORT_FORMATS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleExport(f.id)}
                    className="w-full text-left px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div 
        ref={ref} 
        className={cn(
          "flex-1 flex items-center justify-center min-h-0 w-full",
          viewMode === 'stacked' && "py-8"
        )}
        style={{ containerType: 'inline-size' }}
      >
        <div className={cn(
          "w-full transition-transform duration-700 ease-out group-hover:scale-[1.012]",
          viewMode === 'bento' && (format.id === 'stories' || format.id === 'poster' || format.id === 'appstore') && 'max-w-[280px]',
          viewMode === 'bento' && (format.id === 'card' || format.id === 'socialcard') && 'max-w-[380px]',
          viewMode === 'bento' && format.id === 'letterhead' && 'max-w-[320px]',
          viewMode === 'stacked' && "max-w-4xl"
        )}>
          {format.id === 'instagram' && <InstagramFeedMock tokens={tokens} />}
          {format.id === 'linkedin' && <LinkedInPostMock tokens={tokens} />}
          {format.id === 'poster' && <PosterMock tokens={tokens} />}
          {format.id === 'stories' && <StoriesMock tokens={tokens} />}
          {format.id === 'website' && <WebsiteHeroMock tokens={tokens} />}
          {format.id === 'card' && <BusinessCardMock tokens={tokens} />}
          {format.id === 'email' && <EmailHeaderMock tokens={tokens} />}
          {format.id === 'xprofile' && <XProfileMock tokens={tokens} />}
          {format.id === 'socialcard' && <SocialCardMock tokens={tokens} />}
          {format.id === 'notification' && <NotificationMock tokens={tokens} />}
          {format.id === 'appstore' && <AppStoreMock tokens={tokens} />}
          {format.id === 'letterhead' && <LetterheadMock tokens={tokens} />}
          {format.id === 'slide' && <PresentationSlideMock tokens={tokens} />}
        </div>
      </div>
    </motion.div>
  );
};

export const PreviewSection: React.FC<PreviewSectionProps> = ({ guideline, span }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('bento');
  const tokens = useMemo(() => buildMockTokens(guideline), [guideline]);

  useEffect(() => {
    const families = [tokens.headingFamily, tokens.bodyFamily]
      .map(stack => stack.match(/^'([^']+)'/)?.[1])
      .filter((f): f is string => !!f && f !== 'Inter');
    const unique = [...new Set(families)];
    if (!unique.length) return;

    const id = 'brand-preview-fonts';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    const href = `https://fonts.googleapis.com/css2?${unique.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&')}&display=swap`;

    if (link) {
      if (link.href === href) return;
      link.href = href;
    } else {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }, [tokens.headingFamily, tokens.bodyFamily]);

  const hasMinimum =
    (tokens.palette.length > 0) || !!tokens.primaryLogo || !!guideline.identity?.name;

  const handleExport = async (el: HTMLElement, format: ExportFormat, id: string) => {
    try {
      await exportMockElement(el, tokens.name, id, format);
      toast.success(`Exported ${id} as ${format.toUpperCase()}`);
    } catch {
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    }
  };

  const actions = (
    <div className="flex items-center bg-white/[0.02] border border-white/[0.05] rounded-md p-0.5">
      <button
        onClick={() => setViewMode('bento')}
        className={cn(
          "p-1 rounded transition-all",
          viewMode === 'bento' ? "bg-white/10 text-neutral-200" : "text-neutral-600 hover:text-neutral-400"
        )}
        title="Bento View"
      >
        <LayoutGrid size={11} strokeWidth={1.5} />
      </button>
      <button
        onClick={() => setViewMode('stacked')}
        className={cn(
          "p-1 rounded transition-all",
          viewMode === 'stacked' ? "bg-white/10 text-neutral-200" : "text-neutral-600 hover:text-neutral-400"
        )}
        title="Stacked View"
      >
        <List size={11} strokeWidth={1.5} />
      </button>
    </div>
  );

  return (
    <SectionBlock
      id="preview"
      span={span as any}
      icon={<LayoutTemplate size={14} />}
      title="Brand Preview"
      actions={actions}
    >
      {!hasMinimum ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
          <p className="text-xs text-neutral-500 max-w-[320px] leading-relaxed">
            Adicione cores, tipografia e um logo pra visualizar como sua marca aparece em
            criativos reais. Sem chamada de IA — render local com seus tokens.
          </p>
        </div>
      ) : (
        <div className={cn(
          "grid gap-4 p-1",
          viewMode === 'bento' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-12" : "grid-cols-1"
        )}>
          <AnimatePresence>
            {FORMATS.map(f => (
              <BentoCard 
                key={f.id} 
                format={f} 
                tokens={tokens} 
                viewMode={viewMode}
                onExport={handleExport}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </SectionBlock>
  );
};

function dimsLabel(id: FormatId): string {
  switch (id) {
    case 'instagram': return '1080 × 1080';
    case 'linkedin':  return '1200 × 627';
    case 'poster':    return '1080 × 1440';
    case 'stories':   return '1080 × 1920';
    case 'website':   return '1920 × 1080';
    case 'card':      return '3.5 × 2 in';
    case 'email':        return '600 × 200';
    case 'xprofile':     return '1920 × 1200';
    case 'socialcard':   return '800 × 1000';
    case 'notification': return '1000 × 400';
    case 'appstore':     return '640 × 960';
    case 'letterhead':   return 'A4';
    case 'slide':        return '1920 × 1080';
  }
}
