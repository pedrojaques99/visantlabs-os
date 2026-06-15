import React from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import type { BrandGuideline, BrandManifesto } from '@/lib/figma-types';
import { Globe, Instagram, Linkedin, Link as LinkIcon } from 'lucide-react';

interface BrandOverviewProps {
  guideline: BrandGuideline;
}

export const BrandOverview: React.FC<BrandOverviewProps> = ({ guideline }) => {
  const g = guideline;
  const identity = g.identity;
  const colors = g.colors || [];
  const typography = g.typography || [];
  const logos = g.logos || [];
  const pillars = g.strategy?.pillars || [];
  const archetypes = g.strategy?.archetypes || [];
  const coreMessage = g.strategy?.coreMessage;
  const voiceValues = g.strategy?.voiceValues || [];

  const rawManifesto = g.strategy?.manifesto;
  const manifesto: BrandManifesto | null =
    typeof rawManifesto === 'string'
      ? rawManifesto.trim()
        ? { full: rawManifesto }
        : null
      : rawManifesto && (rawManifesto.full || rawManifesto.provocation || rawManifesto.promise)
        ? rawManifesto
        : null;

  const primaryLogo =
    logos.find((l) => l.variant === 'primary') ||
    logos.find((l) => l.variant === 'icon') ||
    logos[0];
  const headlineFont =
    typography.find(
      (t) =>
        (t.role || '').toLowerCase().includes('head') ||
        (t.role || '').toLowerCase().includes('display')
    ) || typography[0];
  const bodyFont =
    typography.find(
      (t) =>
        (t.role || '').toLowerCase().includes('body') ||
        (t.role || '').toLowerCase().includes('paragraph')
    ) || typography[1];

  const socialLinks = [
    identity?.website && { icon: Globe, label: 'Website', url: identity.website },
    identity?.instagram && { icon: Instagram, label: 'Instagram', url: identity.instagram },
    identity?.linkedin && { icon: Linkedin, label: 'LinkedIn', url: identity.linkedin },
    identity?.portfolio && { icon: LinkIcon, label: 'Portfolio', url: identity.portfolio },
  ].filter(Boolean) as { icon: React.FC<any>; label: string; url: string }[];

  const isEmpty = !identity?.name && colors.length === 0 && pillars.length === 0 && !manifesto;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <p className="text-sm text-neutral-600">
          Start by filling in your brand identity and visual system.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Hero ── */}
      <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
        {primaryLogo && (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-neutral-800 bg-white/[0.03] shrink-0 flex items-center justify-center">
            <img src={primaryLogo.url} alt="" className="w-full h-full object-contain p-2" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-100 tracking-tight">
            {identity?.name || g.name || 'Untitled'}
          </h2>
          {(identity?.tagline || g.tagline) && (
            <p className="text-base text-neutral-400">{identity?.tagline || g.tagline}</p>
          )}
          {identity?.description && (
            <p className="text-sm text-neutral-500 leading-relaxed max-w-2xl">
              {identity.description}
            </p>
          )}
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-3 pt-1">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-600 hover:text-neutral-400 transition-colors"
                  title={link.label}
                >
                  <link.icon size={15} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Manifesto ── */}
      {manifesto && (
        <div className="space-y-4">
          <span className="text-xs font-medium text-neutral-500">Manifesto</span>

          {manifesto.full ? (
            <blockquote className="text-base sm:text-lg leading-relaxed text-neutral-300 max-w-3xl border-l-2 border-white/10 pl-6 py-1 whitespace-pre-line">
              {manifesto.full}
            </blockquote>
          ) : (
            <div className="space-y-6 max-w-3xl">
              {manifesto.provocation && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-neutral-600">Provocation</span>
                  <p className="text-base leading-relaxed text-neutral-300">
                    {manifesto.provocation}
                  </p>
                </div>
              )}
              {manifesto.tension && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-neutral-600">Tension</span>
                  <p className="text-base leading-relaxed text-neutral-300">{manifesto.tension}</p>
                </div>
              )}
              {manifesto.promise && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-neutral-600">Promise</span>
                  <p className="text-base leading-relaxed text-neutral-300">{manifesto.promise}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Core Message ── */}
      {coreMessage &&
        (coreMessage.product || coreMessage.differential || coreMessage.emotionalBond) && (
          <GlassPanel intensity="subtle" padding="md">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {coreMessage.product && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-neutral-600">Product</span>
                  <p className="text-sm text-neutral-300 leading-relaxed">{coreMessage.product}</p>
                </div>
              )}
              {coreMessage.differential && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-neutral-600">Differential</span>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {coreMessage.differential}
                  </p>
                </div>
              )}
              {coreMessage.emotionalBond && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-neutral-600">Emotional Bond</span>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {coreMessage.emotionalBond}
                  </p>
                </div>
              )}
            </div>
          </GlassPanel>
        )}

      {/* ── Pillars ── */}
      {pillars.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-medium text-neutral-500">Brand Pillars</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pillars.map((p, i) => (
              <GlassPanel key={i} intensity="subtle" padding="sm">
                <p className="text-sm font-medium text-neutral-200 mb-1">{p.value}</p>
                {p.description && (
                  <p className="text-xs text-neutral-500 leading-relaxed">{p.description}</p>
                )}
              </GlassPanel>
            ))}
          </div>
        </div>
      )}

      {/* ── Archetypes + Voice ── */}
      {(archetypes.length > 0 || voiceValues.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {archetypes.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-medium text-neutral-500">Archetypes</span>
              <div className="flex flex-wrap gap-2">
                {archetypes.map((a, i) => (
                  <GlassPanel key={i} intensity="subtle" className="px-3 py-2 rounded-lg">
                    <p className="text-xs font-medium text-neutral-200">{a.name}</p>
                    {a.role && <p className="text-[10px] text-neutral-600 mt-0.5">{a.role}</p>}
                  </GlassPanel>
                ))}
              </div>
            </div>
          )}
          {voiceValues.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-medium text-neutral-500">Tone of Voice</span>
              <div className="flex flex-wrap gap-2">
                {voiceValues.slice(0, 4).map((v, i) => (
                  <span
                    key={i}
                    className="text-xs text-neutral-400 px-2.5 py-1 rounded-md border border-neutral-800 bg-white/[0.03]"
                  >
                    {v.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Visual Summary ── */}
      {(colors.length > 0 || typography.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {colors.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-medium text-neutral-500">Colors</span>
              <div className="flex flex-wrap gap-2">
                {colors.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg border border-neutral-800 shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    <div className="hidden sm:block">
                      {c.name && <p className="text-xs text-neutral-300 leading-none">{c.name}</p>}
                      <p className="text-[10px] font-mono text-neutral-600 mt-0.5">{c.hex}</p>
                    </div>
                  </div>
                ))}
                {colors.length > 8 && (
                  <span className="text-[11px] text-neutral-600 self-center">
                    +{colors.length - 8}
                  </span>
                )}
              </div>
            </div>
          )}

          {typography.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-medium text-neutral-500">Typography</span>
              <div className="space-y-3">
                {headlineFont && (
                  <div>
                    <p
                      className="text-lg text-neutral-200"
                      style={{ fontFamily: headlineFont.family }}
                    >
                      {headlineFont.family}
                    </p>
                    <p className="text-[11px] text-neutral-600">{headlineFont.role}</p>
                  </div>
                )}
                {bodyFont && bodyFont !== headlineFont && (
                  <div>
                    <p
                      className="text-base text-neutral-300"
                      style={{ fontFamily: bodyFont.family }}
                    >
                      {bodyFont.family}
                    </p>
                    <p className="text-[11px] text-neutral-600">{bodyFont.role}</p>
                  </div>
                )}
                {typography.length > 2 && (
                  <p className="text-[11px] text-neutral-600">+{typography.length - 2} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
