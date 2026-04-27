import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Check, X } from 'lucide-react';
import { hexToCmyk } from '@/utils/colorUtils';
import type { BrandGuideline } from '@/lib/figma-types';

interface BrandIngestApprovalProps {
  extracted: any;
  preview: BrandGuideline;
  existing: BrandGuideline;
  onApprove: () => void;
  onReject: () => void;
  isApplying?: boolean;
}

export const BrandIngestApproval: React.FC<BrandIngestApprovalProps> = ({
  extracted, preview, existing, onApprove, onReject, isApplying,
}) => {
  const newColors = (preview.colors || []).filter(
    c => !(existing.colors || []).some(e => e.hex?.toLowerCase() === c.hex?.toLowerCase())
  );
  const newFonts = (preview.typography || []).filter(
    f => !(existing.typography || []).some(e => e.family === f.family)
  );
  const newLogos = (preview.logos || []).filter(
    l => !(existing.logos || []).some(e => e.url === l.url)
  );
  const newMedia = (preview.media || []).filter(
    m => !(existing.media || []).some(e => e.url === m.url)
  );

  const hasIdentityChange =
    preview.identity?.name !== existing.identity?.name ||
    preview.identity?.tagline !== existing.identity?.tagline ||
    preview.identity?.description !== existing.identity?.description;

  const hasManifestoChange = !!(preview.strategy?.manifesto && preview.strategy.manifesto !== existing.strategy?.manifesto);
  const hasPositioningChange = !!(preview.strategy?.positioning?.length && JSON.stringify(preview.strategy.positioning) !== JSON.stringify(existing.strategy?.positioning));
  const newArchetypes = (preview.strategy?.archetypes || []).filter(
    a => !(existing.strategy?.archetypes || []).some(e => e.name === a.name)
  );
  const newPersonas = (preview.strategy?.personas || []).filter(
    p => !(existing.strategy?.personas || []).some(e => e.name === p.name)
  );
  const newVoiceValues = (preview.strategy?.voiceValues || []).filter(
    v => !(existing.strategy?.voiceValues || []).some(e => e.title === v.title)
  );
  const hasTagsChange = !!(preview.tags && Object.keys(preview.tags).length > 0 &&
    JSON.stringify(preview.tags) !== JSON.stringify(existing.tags));
  const hasGuidelinesChange = !!(preview.guidelines &&
    (preview.guidelines.voice !== existing.guidelines?.voice ||
    JSON.stringify(preview.guidelines.dos) !== JSON.stringify(existing.guidelines?.dos) ||
    JSON.stringify(preview.guidelines.donts) !== JSON.stringify(existing.guidelines?.donts)));

  const totalChanges = newColors.length + newFonts.length + newLogos.length + newMedia.length +
    newArchetypes.length + newPersonas.length + newVoiceValues.length +
    (hasIdentityChange ? 1 : 0) + (hasManifestoChange ? 1 : 0) +
    (hasPositioningChange ? 1 : 0) + (hasTagsChange ? 1 : 0) + (hasGuidelinesChange ? 1 : 0);

  return (
    <Modal
      isOpen
      onClose={onReject}
      title="Review extracted data"
      description={`${totalChanges} change${totalChanges !== 1 ? 's' : ''} found — approve to apply`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onReject} className="gap-1.5 border border-white/10">
            <X size={13} /> Discard
          </Button>
          <Button onClick={onApprove} disabled={isApplying} className="gap-1.5 bg-white/[0.08] border border-white/15 text-neutral-200 hover:bg-white/[0.12]">
            <Check size={13} /> {isApplying ? 'Applying...' : 'Apply'}
          </Button>
        </>
      }
    >
      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        {totalChanges === 0 && (
          <p className="text-sm text-neutral-500 py-4 text-center">No new data found — guideline is already up to date.</p>
        )}

        {/* Identity */}
        {hasIdentityChange && (
          <Section title="Identity">
            {preview.identity?.name && preview.identity.name !== existing.identity?.name && (
              <Row label="Name" value={preview.identity.name} />
            )}
            {preview.identity?.tagline && preview.identity.tagline !== existing.identity?.tagline && (
              <Row label="Tagline" value={preview.identity.tagline} />
            )}
            {preview.identity?.description && preview.identity.description !== existing.identity?.description && (
              <Row label="Description" value={preview.identity.description} truncate />
            )}
          </Section>
        )}

        {/* Manifesto */}
        {hasManifestoChange && (
          <Section title="Manifesto">
            <p className="text-xs text-neutral-400 leading-relaxed line-clamp-4">{preview.strategy?.manifesto}</p>
          </Section>
        )}

        {/* Colors */}
        {newColors.length > 0 && (
          <Section title={`Colors (${newColors.length} new)`}>
            <div className="flex flex-wrap gap-2">
              {newColors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded border border-white/10 shrink-0" style={{ backgroundColor: c.hex }} />
                  <div>
                    <p className="text-xs text-neutral-300">{c.name || 'Unnamed'}</p>
                    <p className="text-[10px] font-mono text-neutral-600">{c.hex}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Typography */}
        {newFonts.length > 0 && (
          <Section title={`Typography (${newFonts.length} new)`}>
            <div className="space-y-1">
              {newFonts.map((f, i) => (
                <div key={i} className="flex items-baseline gap-3">
                  <span className="text-sm text-neutral-200" style={{ fontFamily: f.family }}>{f.family}</span>
                  <span className="text-[10px] font-mono text-neutral-600">{f.role} · {f.size}px</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Logos */}
        {newLogos.length > 0 && (
          <Section title={`Logos (${newLogos.length} new)`}>
            <div className="flex flex-wrap gap-2">
              {newLogos.map((l, i) => (
                <div key={i} className="w-16 h-16 rounded border border-white/[0.08] bg-neutral-900/60 flex items-center justify-center overflow-hidden">
                  <img src={l.url} alt={l.label || ''} className="max-w-full max-h-full object-contain" />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Media */}
        {newMedia.length > 0 && (
          <Section title={`Media (${newMedia.length} new)`}>
            <div className="flex flex-wrap gap-2">
              {newMedia.map((m, i) => (
                <div key={i} className="w-16 h-16 rounded border border-white/[0.08] bg-neutral-900/60 overflow-hidden">
                  <img src={m.url} alt={m.label || ''} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Positioning */}
        {hasPositioningChange && (
          <Section title="Positioning">
            <div className="space-y-1">
              {preview.strategy?.positioning?.map((p, i) => (
                <p key={i} className="text-xs text-neutral-400 leading-relaxed">· {p}</p>
              ))}
            </div>
          </Section>
        )}

        {/* Archetypes */}
        {newArchetypes.length > 0 && (
          <Section title={`Archetypes (${newArchetypes.length} new)`}>
            <div className="space-y-2">
              {newArchetypes.map((a, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-200 font-medium">{a.name}</span>
                    {a.role && <span className="text-[10px] font-mono text-neutral-600">{a.role}</span>}
                  </div>
                  {a.description && <p className="text-xs text-neutral-500 leading-relaxed">{a.description}</p>}
                  {a.examples && a.examples.length > 0 && (
                    <p className="text-[10px] font-mono text-neutral-600">e.g. {a.examples.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Personas */}
        {newPersonas.length > 0 && (
          <Section title={`Personas (${newPersonas.length} new)`}>
            <div className="space-y-3">
              {newPersonas.map((p, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-200 font-medium">{p.name}</span>
                    {p.age && <span className="text-[10px] font-mono text-neutral-600">{p.age}</span>}
                    {p.occupation && <span className="text-[10px] text-neutral-600">· {p.occupation}</span>}
                  </div>
                  {p.bio && <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">{p.bio}</p>}
                  {p.traits && p.traits.length > 0 && (
                    <p className="text-[10px] font-mono text-neutral-600">{p.traits.join(' · ')}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Voice Values */}
        {newVoiceValues.length > 0 && (
          <Section title={`Tone of Voice (${newVoiceValues.length} new)`}>
            <div className="space-y-2">
              {newVoiceValues.map((v, i) => (
                <div key={i} className="space-y-0.5">
                  <span className="text-xs text-neutral-200 font-medium">{v.title}</span>
                  {v.description && <p className="text-xs text-neutral-500 leading-relaxed">{v.description}</p>}
                  {v.example && <p className="text-[10px] text-neutral-600 italic">"{v.example}"</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Tags */}
        {hasTagsChange && preview.tags && (
          <Section title="Tags">
            <div className="space-y-1">
              {Object.entries(preview.tags).map(([key, values]) => (
                values.length > 0 && (
                  <div key={key} className="flex gap-2">
                    <span className="text-[10px] font-mono text-neutral-600 w-20 shrink-0 mt-0.5">{key}</span>
                    <span className="text-xs text-neutral-400">{values.join(', ')}</span>
                  </div>
                )
              ))}
            </div>
          </Section>
        )}

        {/* Guidelines */}
        {hasGuidelinesChange && preview.guidelines && (
          <Section title="Guidelines">
            {preview.guidelines.voice && preview.guidelines.voice !== existing.guidelines?.voice && (
              <Row label="Voice" value={preview.guidelines.voice} truncate />
            )}
            {preview.guidelines.dos && preview.guidelines.dos.length > 0 && (
              <div className="flex gap-3">
                <span className="text-[10px] font-mono text-neutral-600 w-20 shrink-0 mt-0.5">Do's</span>
                <div className="space-y-0.5">
                  {preview.guidelines.dos.map((d, i) => <p key={i} className="text-xs text-neutral-400">· {d}</p>)}
                </div>
              </div>
            )}
            {preview.guidelines.donts && preview.guidelines.donts.length > 0 && (
              <div className="flex gap-3">
                <span className="text-[10px] font-mono text-neutral-600 w-20 shrink-0 mt-0.5">Don'ts</span>
                <div className="space-y-0.5">
                  {preview.guidelines.donts.map((d, i) => <p key={i} className="text-xs text-neutral-400">· {d}</p>)}
                </div>
              </div>
            )}
          </Section>
        )}
      </div>
    </Modal>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    <MicroTitle className="text-neutral-500">{title}</MicroTitle>
    {children}
  </div>
);

const Row: React.FC<{ label: string; value: string; truncate?: boolean }> = ({ label, value, truncate }) => (
  <div className="flex gap-3">
    <span className="text-[10px] font-mono text-neutral-600 w-20 shrink-0 mt-0.5">{label}</span>
    <span className={`text-xs text-neutral-300 ${truncate ? 'line-clamp-2' : ''}`}>{value}</span>
  </div>
);
