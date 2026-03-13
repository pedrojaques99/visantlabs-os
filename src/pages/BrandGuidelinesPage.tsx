import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { SEO } from '@/components/SEO';
import { AuthModal } from '@/components/AuthModal';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { GuidelinesSidebar } from '@/components/brand/guidelines/GuidelinesSidebar';
import { GuidelineDetail } from '@/components/brand/guidelines/GuidelineDetail';
import { Plus, Palette, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import type { BrandGuideline } from '@/lib/figma-types';

export const BrandGuidelinesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Section visibility
  const [activeSections, setActiveSections] = useState<string[]>([
    'identity', 'logos', 'colors', 'typography',
  ]);

  // Auth guard
  React.useEffect(() => {
    if (isAuthenticated === false) setShowAuthModal(true);
  }, [isAuthenticated]);

  // Server state via react-query
  const { data: guidelines = [], isLoading } = useBrandGuidelines(isAuthenticated === true);

  // Auto-select first guideline
  React.useEffect(() => {
    if (!selectedId && guidelines.length > 0) {
      handleSelect(guidelines[0]);
    }
  }, [guidelines]);

  const selected = useMemo(
    () => guidelines.find((g) => g.id === selectedId),
    [guidelines, selectedId]
  );

  const handleSelect = (g: BrandGuideline) => {
    setSelectedId(g.id!);
    // Auto-show sections that have data
    const sections = ['identity', 'logos', 'colors', 'typography'];
    if (g.tags && Object.keys(g.tags).length > 0) sections.push('tags');
    if ((g.media?.length || 0) > 0) sections.push('media');
    if (g.tokens && (Object.keys(g.tokens.spacing || {}).length > 0 || Object.keys(g.tokens.radius || {}).length > 0)) sections.push('tokens');
    if (g.guidelines?.voice || (g.guidelines?.dos?.length || 0) > 0) sections.push('editorial');
    if (g.guidelines?.accessibility) sections.push('accessibility');
    setActiveSections([...new Set(sections)]);
  };

  const handleWizardSuccess = (id: string) => {
    setIsWizardOpen(false);
    setEditingGuideline(null);
    setSelectedId(id);
  };

  const toggleSection = (section: string) => {
    setActiveSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const openWizard = (guideline?: BrandGuideline | null) => {
    setEditingGuideline(guideline || null);
    setIsWizardOpen(true);
  };

  return (
    <div className="brand-guidelines-root">
      <SEO
        title={t('brandGuidelines.seoTitle')}
        description={t('brandGuidelines.seoDescription')}
      />
      <div className="min-h-[calc(100vh-80px)] bg-background selection:bg-brand-cyan/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-8 font-mono text-[10px]">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/" className="text-neutral-600 hover:text-white transition-colors">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-neutral-800" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-neutral-400 uppercase tracking-widest">{t('brandGuidelines.title')}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 mb-16 px-2">
            <div className="space-y-3">
              <motion.h1
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-4xl md:text-6xl font-bold font-manrope text-white tracking-tight"
              >
                {t('brandGuidelines.title')}
                <span className="text-brand-cyan">.</span>
              </motion.h1>
              <p className="text-neutral-500 font-mono text-xs max-w-xl leading-loose opacity-70">
                {t('brandGuidelines.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <PremiumButton
                onClick={() => openWizard()}
                className="!py-4 !px-8 !text-xs min-w-[180px] shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:shadow-brand-cyan/20"
              >
                {t('brandGuidelines.createNew')}
              </PremiumButton>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-6">
              <GlitchLoader size={40} />
              <MicroTitle className="text-neutral-700 text-[9px] animate-pulse tracking-[0.3em] uppercase">
                Synchronizing Workspace
              </MicroTitle>
            </div>
          ) : guidelines.length === 0 ? (
            <GlassPanel padding="lg" className="flex flex-col items-center justify-center py-24 gap-6 text-center border-dashed border-white/5 bg-neutral-850/10">
              <div className="p-4 rounded-full bg-white/[0.02] border border-white/[0.03]">
                <Palette size={32} strokeWidth={1} className="text-neutral-800" />
              </div>
              <div className="space-y-1">
                <MicroTitle className="text-neutral-500 uppercase tracking-widest">{t('brandGuidelines.emptyState')}</MicroTitle>
                <p className="text-neutral-700 text-[10px] font-mono max-w-xs">{t('brandGuidelines.createFirst')}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => openWizard()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 text-neutral-400 font-mono text-[10px] hover:bg-white/10 hover:border-brand-cyan/30 transition-all group"
              >
                <Plus size={12} className="group-hover:text-brand-cyan transition-colors" />
                {t('brandGuidelines.createFirst')}
              </Button>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
              <GuidelinesSidebar
                guidelines={guidelines}
                selectedId={selectedId}
                activeSections={activeSections}
                onSelect={handleSelect}
                onCreate={() => openWizard()}
                onToggleSection={toggleSection}
              />

              {selected ? (
                <GuidelineDetail
                  guideline={selected}
                  activeSections={activeSections}
                  onOpenWizard={() => openWizard(selected)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-40 text-neutral-900 gap-8 border border-dashed border-white/[0.02] rounded-3xl bg-neutral-850/[0.02]">
                  <div className="relative group/empty">
                    <div className="absolute inset-0 blur-3xl bg-brand-cyan/5 rounded-full scale-150 transition-all group-hover/empty:bg-brand-cyan/10" />
                    <Layers size={56} strokeWidth={1} className="relative text-neutral-800 opacity-20" />
                  </div>
                  <div className="text-center space-y-2 relative">
                    <p className="text-[11px] uppercase tracking-[0.5em] font-bold text-neutral-700 opacity-80">Orchestrator Idle</p>
                    <p className="text-[10px] text-neutral-900 font-mono opacity-40">Select a brand identity from the vault to modify.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <BrandGuidelineWizardModal
        isOpen={isWizardOpen}
        onClose={() => { setIsWizardOpen(false); setEditingGuideline(null); }}
        onSuccess={handleWizardSuccess}
        editGuideline={editingGuideline}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => { setShowAuthModal(false); navigate('/'); }}
        onSuccess={() => { setShowAuthModal(false); }}
        isSignUp={false}
      />
    </div>
  );
};
