import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { useUpdateGuideline } from '@/hooks/queries/useBrandGuidelines';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guideline: BrandGuideline;
  onSuccess?: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  'strategy.coreMessage': 'Mensagem Central',
  'strategy.pillars': 'Pilares',
  'strategy.manifesto': 'Manifesto',
  'strategy.archetypes': 'Arquétipos',
  'strategy.personas': 'Personas',
  'strategy.voiceValues': 'Tom de Voz',
  'strategy.positioning': 'Posicionamento',
  'guidelines.voice': 'Voz da Marca',
  'guidelines.dos': 'Boas Práticas',
  'guidelines.donts': 'Evitar',
  'guidelines.imagery': 'Imagens',
  'tags': 'Tags',
  'identity.description': 'Descrição',
  'identity.tagline': 'Tagline',
};

const SECTION_GROUPS: Record<string, string[]> = {
  'Estratégia': ['strategy.coreMessage', 'strategy.pillars', 'strategy.manifesto', 'strategy.archetypes', 'strategy.personas', 'strategy.voiceValues', 'strategy.positioning'],
  'Diretrizes': ['guidelines.voice', 'guidelines.dos', 'guidelines.donts', 'guidelines.imagery'],
  'Identidade': ['identity.description', 'identity.tagline', 'tags'],
};

function getEmptySections(g: BrandGuideline): string[] {
  const empty: string[] = [];
  const s = (g as any).strategy;
  const gl = (g as any).guidelines;
  const id = (g as any).identity;

  if (!s?.coreMessage?.product) empty.push('strategy.coreMessage');
  if (!s?.pillars?.length) empty.push('strategy.pillars');
  if (!s?.manifesto) empty.push('strategy.manifesto');
  if (!s?.archetypes?.length) empty.push('strategy.archetypes');
  if (!s?.personas?.length) empty.push('strategy.personas');
  if (!s?.voiceValues?.length) empty.push('strategy.voiceValues');
  if (!s?.positioning?.length) empty.push('strategy.positioning');
  if (!gl?.voice) empty.push('guidelines.voice');
  if (!gl?.dos?.length) empty.push('guidelines.dos');
  if (!gl?.donts?.length) empty.push('guidelines.donts');
  if (!gl?.imagery) empty.push('guidelines.imagery');
  if (!g.tags || Object.keys(g.tags).length === 0) empty.push('tags');
  if (!id?.description) empty.push('identity.description');
  if (!id?.tagline) empty.push('identity.tagline');
  return empty;
}

function renderPreview(key: string, value: any): React.ReactNode {
  if (typeof value === 'string') return <p className="text-[11px] text-neutral-300 whitespace-pre-wrap">{value}</p>;
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.map((item, i) => (
          <li key={i} className="text-[11px] text-neutral-300">
            {typeof item === 'string' ? `• ${item}` : `• ${item.value || item.name || item.title || JSON.stringify(item)}`}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object' && value !== null) {
    return (
      <div className="space-y-1">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="text-[11px]">
            <span className="text-neutral-500 font-mono">{k}:</span>{' '}
            <span className="text-neutral-300">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-[11px] text-neutral-400">{JSON.stringify(value)}</p>;
}

export const BrandAiPopulateDialog: React.FC<Props> = ({ open, onOpenChange, guideline, onSuccess }) => {
  const emptySections = useMemo(() => getEmptySections(guideline), [guideline]);
  const [selected, setSelected] = useState<Set<string>>(new Set(emptySections));
  const [loading, setLoading] = useState(false);
  const [patch, setPatch] = useState<Record<string, any> | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const updateMutation = useUpdateGuideline();

  const toggleSection = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === emptySections.length) setSelected(new Set());
    else setSelected(new Set(emptySections));
  }, [selected, emptySections]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setPatch(null);
    setExcluded(new Set());
    try {
      const result = await brandGuidelineApi.aiPopulate(guideline.id!, Array.from(selected));
      setPatch(result.patch);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar conteúdo');
    } finally {
      setLoading(false);
    }
  }, [guideline.id, selected]);

  const handleApply = useCallback(async () => {
    if (!patch) return;

    // Remove excluded fields from patch
    const filtered: Record<string, any> = {};
    for (const [top, val] of Object.entries(patch)) {
      if (excluded.has(top)) continue;
      if (['strategy', 'guidelines', 'identity'].includes(top) && typeof val === 'object' && !Array.isArray(val)) {
        const sub: Record<string, any> = {};
        for (const [k, v] of Object.entries(val)) {
          if (!excluded.has(`${top}.${k}`)) sub[k] = v;
        }
        if (Object.keys(sub).length > 0) filtered[top] = sub;
      } else {
        filtered[top] = val;
      }
    }

    // Deep merge with existing guideline data so PUT doesn't overwrite sibling fields
    const merged: Record<string, any> = {};
    for (const [top, val] of Object.entries(filtered)) {
      if (['strategy', 'guidelines', 'identity'].includes(top) && typeof val === 'object' && !Array.isArray(val)) {
        merged[top] = { ...(guideline as any)[top], ...val };
      } else {
        merged[top] = val;
      }
    }

    try {
      await updateMutation.mutateAsync({ id: guideline.id!, data: merged });
      toast.success('Campos preenchidos com sucesso');
      onSuccess?.();
      onOpenChange(false);
      setPatch(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aplicar');
    }
  }, [patch, excluded, guideline, updateMutation, onSuccess, onOpenChange]);

  const toggleExclude = useCallback((key: string) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const patchKeys = useMemo(() => {
    if (!patch) return [];
    const keys: string[] = [];
    for (const [top, val] of Object.entries(patch)) {
      if (['strategy', 'guidelines', 'identity'].includes(top) && typeof val === 'object' && !Array.isArray(val)) {
        for (const sub of Object.keys(val)) {
          keys.push(`${top}.${sub}`);
        }
      } else {
        keys.push(top);
      }
    }
    return keys;
  }, [patch]);

  if (emptySections.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.15em]">
              AI Generate
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col items-center gap-3 py-8">
              <Check size={24} className="text-emerald-400" />
              <p className="text-xs text-neutral-400">Todos os campos já estão preenchidos.</p>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <Zap size={14} className="text-amber-400" />
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.15em]">
              AI Generate
            </DialogTitle>
          </div>
          <DialogDescription className="text-[11px] text-neutral-500">
            Selecione os campos vazios para preencher com IA. Revise antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {!patch && !loading && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={toggleAll}
                  className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {selected.size === emptySections.length ? 'Desmarcar tudo' : 'Selecionar tudo'}
                </button>
                <span className="text-[10px] font-mono text-neutral-600">
                  {selected.size}/{emptySections.length}
                </span>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {Object.entries(SECTION_GROUPS).map(([group, keys]) => {
                  const available = keys.filter(k => emptySections.includes(k));
                  if (available.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 mb-2">{group}</p>
                      <div className="space-y-1">
                        {available.map(key => (
                          <button
                            key={key}
                            onClick={() => toggleSection(key)}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all',
                              selected.has(key)
                                ? 'border-amber-500/30 bg-amber-500/[0.06] text-neutral-200'
                                : 'border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:text-neutral-300'
                            )}
                          >
                            <div className={cn(
                              'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                              selected.has(key) ? 'border-amber-500 bg-amber-500' : 'border-neutral-600'
                            )}>
                              {selected.has(key) && <Check size={9} className="text-black" />}
                            </div>
                            <span className="text-xs">{SECTION_LABELS[key] || key}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  onClick={handleGenerate}
                  disabled={selected.size === 0}
                  className="h-8 px-4 gap-2 text-xs bg-amber-500/20 border border-amber-500/30 text-amber-200 hover:bg-amber-500/30"
                >
                  <Zap size={12} />
                  Gerar {selected.size} campo{selected.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <GlitchLoader size={20} />
              <p className="text-[11px] text-neutral-500 font-mono uppercase tracking-widest">
                Gerando conteúdo…
              </p>
            </div>
          )}

          {patch && !loading && (
            <>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {patchKeys.map(key => {
                  const [top, sub] = key.split('.');
                  const value = sub ? (patch as any)[top]?.[sub] : (patch as any)[top || key];
                  if (value === undefined) return null;
                  const isExcluded = excluded.has(key);
                  const isExpanded = expandedSection === key;
                  return (
                    <div
                      key={key}
                      className={cn(
                        'rounded-lg border p-3 transition-all',
                        isExcluded
                          ? 'border-white/[0.04] bg-white/[0.01] opacity-40'
                          : 'border-emerald-500/20 bg-emerald-500/[0.04]'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setExpandedSection(isExpanded ? null : key)}
                          className="flex items-center gap-2 text-xs font-medium text-neutral-200 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {SECTION_LABELS[key] || key}
                        </button>
                        <button
                          onClick={() => toggleExclude(key)}
                          className={cn(
                            'text-[10px] font-mono uppercase tracking-widest transition-colors',
                            isExcluded ? 'text-neutral-600 hover:text-emerald-400' : 'text-neutral-500 hover:text-red-400'
                          )}
                        >
                          {isExcluded ? 'incluir' : 'excluir'}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 pl-5">
                          {renderPreview(key, value)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setPatch(null)}
                  className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300"
                >
                  ← Voltar
                </button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => { onOpenChange(false); setPatch(null); }}
                    className="h-8 px-3 text-xs text-neutral-400"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleApply}
                    disabled={updateMutation.isPending || patchKeys.length === excluded.size}
                    className="h-8 px-4 gap-2 text-xs bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/30"
                  >
                    <Check size={12} />
                    Aplicar {patchKeys.length - excluded.size} campo{patchKeys.length - excluded.size !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
