import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookmarkPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { BrandSwitcher } from '@/components/cockpit/BrandSwitcher';
import { FEATURE_FUNNEL_BANNER } from '@/config/featureFlags';
import { useTranslation } from '@/hooks/useTranslation';
import { authService } from '@/services/authService';
import { useBrandGuidelines, useUpdateGuideline } from '@/hooks/queries/useBrandGuidelines';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { trackEvent } from '@/utils/analytics';
import type { BrandGuidelineColor } from '@/lib/figma-types';

// Higiene de funil (plano Revenue-Centric §Fase 5, task 5.2): captura de VALOR
// nas free tools — a paleta extraída vira cores da guideline com 1 clique.
// Só implementado onde o mapeamento é óbvio (hex[] → BrandGuidelineColor[]);
// TODO(funnel 5.2): avaliar "salvar na marca" para upscale/remove-bg (asset de
// marca) quando o shape de upload de asset for igualmente barato de reusar.

interface SavePaletteToBrandProps {
  /** Hex colors (#RRGGBB) extraídos pela tool. */
  colors: string[];
}

export const SavePaletteToBrand: React.FC<SavePaletteToBrandProps> = ({ colors }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isAuthenticated = authService.isAuthenticated();
  const { data: guidelines = [] } = useBrandGuidelines(FEATURE_FUNNEL_BANNER && isAuthenticated);
  const updateGuideline = useUpdateGuideline();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!FEATURE_FUNNEL_BANNER || colors.length === 0) return null;

  const brands = guidelines.filter((g) => g.status !== 'archived');
  const activeId = selectedId ?? brands[0]?.id ?? null;

  const handleSave = async () => {
    if (!activeId) return;
    setSaving(true);
    trackEvent('funnel_save_to_brand', { tool: 'color-palette', count: colors.length });
    try {
      // Merge em cima das cores atuais da guideline — nunca sobrescreve.
      const current = await brandGuidelineApi.getById(activeId);
      const existing = current.colors ?? [];
      const known = new Set(existing.map((c) => c.hex.toLowerCase()));
      const added: BrandGuidelineColor[] = colors
        .filter((hex) => !known.has(hex.toLowerCase()))
        .map((hex) => ({ hex, name: hex.toUpperCase() }));
      if (added.length > 0) {
        await updateGuideline.mutateAsync({
          id: activeId,
          data: { colors: [...existing, ...added] },
        });
      }
      toast.success(t('funnel.saveToBrand.success'));
    } catch (err) {
      console.error('Save palette to brand failed:', err);
      toast.error(t('funnel.saveToBrand.error'));
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Button
        onClick={() => {
          trackEvent('funnel_save_to_brand', { tool: 'color-palette', authenticated: false });
          navigate('/welcome');
        }}
        variant="outline"
        className="font-mono text-xs uppercase tracking-widest border-neutral-700"
        data-vsn-component="SavePaletteToBrand"
      >
        <BookmarkPlus size={12} className="mr-1.5" /> {t('funnel.saveToBrand.button')}
      </Button>
    );
  }

  if (brands.length === 0) {
    return (
      <Button
        onClick={() => navigate('/brand-guidelines')}
        variant="outline"
        className="font-mono text-xs uppercase tracking-widest border-neutral-700"
        data-vsn-component="SavePaletteToBrand"
      >
        <BookmarkPlus size={12} className="mr-1.5" /> {t('funnel.saveToBrand.noBrand')}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-vsn-component="SavePaletteToBrand">
      <BrandSwitcher brands={brands} value={activeId} onChange={setSelectedId} />
      <Button
        onClick={handleSave}
        disabled={saving || !activeId}
        variant="outline"
        className="font-mono text-xs uppercase tracking-widest border-neutral-700"
      >
        <BookmarkPlus size={12} className="mr-1.5" />
        {saving ? t('funnel.saveToBrand.saving') : t('funnel.saveToBrand.button')}
      </Button>
    </div>
  );
};
