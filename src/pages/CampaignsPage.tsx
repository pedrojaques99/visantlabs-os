import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Megaphone,
  Plus,
  Wand2,
  ImageOff,
  Loader2,
  Download,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLayout } from '@/hooks/useLayout';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { useCampaigns, useCampaign } from '@/hooks/queries/useCampaigns';
import type { CampaignSummary } from '@/services/campaignApi';

/**
 * Campaigns cockpit — the user-facing surface for persisted, brand-scoped
 * campaigns. Composes existing design-system primitives (GlassPanel, MicroTitle,
 * EmptyState) and mirrors the ContentStudioPage visual language. No new
 * design-system components are introduced.
 */
export const CampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();
  const isLoggedIn = isAuthenticated === true;

  const { data: brands = [] } = useBrandGuidelines(isLoggedIn);
  const [searchParams] = useSearchParams();
  const [brandId, setBrandId] = useState<string>(searchParams.get('brandId') || '');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useCampaigns(brandId || undefined);

  if (selectedId) {
    return <CampaignDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-md hover:bg-neutral-800/50 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={16} className="text-neutral-400" />
        </button>
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-brand-cyan" />
          <MicroTitle as="h1" className="text-base">
            Campaigns
          </MicroTitle>
        </div>
        <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded">
          beta
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Brand switcher */}
          {brands.length > 0 && (
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-neutral-900/80 border border-white/10 text-[11px] font-mono text-neutral-300 focus:outline-none focus:border-white/20 transition-colors appearance-none cursor-pointer"
            >
              <option value="">All brands</option>
              {brands.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.identity?.name || g.name || g.id}
                </option>
              ))}
            </select>
          )}

          {/* Create from brand */}
          <button
            onClick={() =>
              navigate(brandId ? `/create?brandId=${brandId}` : '/create')
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono text-neutral-400 border border-white/10 bg-neutral-900/50 hover:border-neutral-600 hover:text-neutral-200 transition-all"
          >
            <Wand2 size={12} />
            Creative
          </button>

          {/* Generate campaign (lives in Canvas chat today) */}
          <button
            onClick={() => navigate('/canvas')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono font-bold bg-brand-cyan text-black hover:bg-brand-cyan/90 transition-all"
          >
            <Plus size={12} />
            New campaign
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {!isLoggedIn ? (
          <EmptyState
            icon={Megaphone}
            title="Sign in to see your campaigns"
            description="Campaigns are generated from your brand and saved here so you can pick the work back up anytime."
          />
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-neutral-900/30 overflow-hidden"
              >
                <div className="aspect-[4/3] bg-neutral-900 animate-pulse" />
                <div className="p-3 space-y-2 border-t border-white/10">
                  <div className="h-2.5 w-32 bg-neutral-800 rounded animate-pulse" />
                  <div className="h-1.5 w-full bg-neutral-800 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={brandId ? 'No campaigns for this brand yet' : 'No campaigns yet'}
            description="Open Canvas and ask the assistant to generate a campaign from your product and brand — it lands here automatically."
            actionLabel="Generate in Canvas"
            onAction={() => navigate('/canvas')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} c={c} onOpen={() => setSelectedId(c.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

function StatusBadge({ status }: { status: CampaignSummary['status'] }) {
  const map: Record<CampaignSummary['status'], [string, string]> = {
    planning: ['text-neutral-400', 'planning'],
    generating: ['text-brand-cyan', 'generating'],
    done: ['text-emerald-400', 'done'],
    error: ['text-red-400', 'error'],
  };
  const [color, label] = map[status] ?? map.planning;
  return (
    <span className={cn('text-[10px] font-mono tracking-wide', color)}>{label}</span>
  );
}

function CampaignCard({ c, onOpen }: { c: CampaignSummary; onOpen: () => void }) {
  const pct = c.totalCount ? Math.round((c.completedCount / c.totalCount) * 100) : 0;
  return (
    <button
      onClick={onOpen}
      className="group text-left rounded-xl border border-white/10 bg-neutral-900/30 overflow-hidden hover:border-white/20 transition-colors"
    >
      <div className="relative aspect-[4/3] bg-neutral-900 flex items-center justify-center overflow-hidden">
        {c.coverImageUrl ? (
          <img
            src={c.coverImageUrl}
            alt={c.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <ImageOff size={20} className="text-neutral-700" />
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10">
          <StatusBadge status={c.status} />
        </div>
      </div>
      <div className="p-3 space-y-2 border-t border-white/10">
        <p className="text-[12px] font-mono text-neutral-200 truncate">{c.name}</p>
        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
          <span>
            {c.completedCount}/{c.totalCount} ads
          </span>
          <span className="truncate ml-2">{c.formats.join(' · ')}</span>
        </div>
        <div className="h-1 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className={cn(
              'h-full transition-all',
              c.status === 'error' ? 'bg-red-500/70' : 'bg-brand-cyan'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  );
}

function CampaignDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: campaign, isLoading } = useCampaign(id);
  const results = campaign?.results ?? [];

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-neutral-800/50 transition-colors"
          aria-label="Back to campaigns"
        >
          <ArrowLeft size={16} className="text-neutral-400" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <Megaphone size={16} className="text-brand-cyan flex-shrink-0" />
          <MicroTitle as="h1" className="text-base truncate">
            {campaign?.name || 'Campaign'}
          </MicroTitle>
        </div>
        {campaign && (
          <span className="ml-2 text-[10px] font-mono text-neutral-500">
            {campaign.completedCount}/{campaign.totalCount}
          </span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin text-neutral-600" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <GlassPanel padding="lg" className="max-w-md text-center">
              <MicroTitle as="h3" className="text-neutral-300 mb-2">
                No results yet
              </MicroTitle>
              <p className="text-sm text-neutral-500 font-mono">
                {campaign?.status === 'error'
                  ? campaign?.error || 'This campaign failed.'
                  : 'This campaign is still generating.'}
              </p>
            </GlassPanel>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {results.map((r) => (
              <div
                key={r.index}
                className="rounded-xl border border-white/10 bg-neutral-900/30 overflow-hidden"
              >
                <div className="relative aspect-square bg-neutral-900 flex items-center justify-center">
                  <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10">
                    <span className="text-[10px] font-mono text-neutral-300 tracking-wide">
                      {r.adAngle}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded bg-black/50 border border-neutral-800">
                    <span className="text-[10px] font-mono text-neutral-500">{r.format}</span>
                  </div>
                  {r.status === 'done' && r.imageUrl ? (
                    <img
                      src={r.imageUrl}
                      alt={r.adAngle}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : r.status === 'error' ? (
                    <div className="flex flex-col items-center gap-2 px-4 text-center">
                      <AlertCircle size={20} className="text-red-400/60" />
                      <span className="text-[10px] font-mono text-red-400">{r.error}</span>
                    </div>
                  ) : (
                    <Loader2 size={22} className="animate-spin text-neutral-600" />
                  )}
                </div>
                {r.status === 'done' && r.imageUrl && (
                  <div className="p-3 border-t border-white/10">
                    <a
                      href={r.imageUrl}
                      download={`campaign-${r.index}.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 w-fit rounded text-[10px] font-mono text-neutral-500 hover:text-neutral-300 border border-white/10 hover:border-neutral-700 transition-all"
                    >
                      <Download size={10} />
                      Download
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
