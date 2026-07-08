import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gem,
  Copy,
  Trash2,
  Zap,
  ChevronDown,
  ArrowRight,
  Loader2,
  Pencil,
  SearchCheck,
  BookmarkPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/utils/clipboard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NamingCard } from '@/lib/naming/tasteProfile';
import type { NamingDefenseInsightResponse } from '@/services/namingApi';

const ease = [0.4, 0, 0.2, 1] as const;

/** Slugs do backend (ex. "foreign-roots") viram labels legíveis. */
const formatTag = (s: string) => s.replace(/[-_]/g, ' ').trim();

export interface ShortlistPanelProps {
  superliked: NamingCard[];
  liked: NamingCard[];
  defenseCache: Record<string, NamingDefenseInsightResponse | undefined>;
  finalists?: string[];
  showNudge?: boolean;
  onShowFinalists?: () => void;
  onMoreLikeThis: (card: NamingCard) => void;
  onRemove: (card: NamingCard) => void;
  onTransformToBrand: (card: NamingCard) => void;
  /** Presente só quando a sessão foi iniciada a partir de uma marca existente. */
  brandGuidelineId?: string | null;
  onSaveToBrand?: () => Promise<void> | void;
}

export const ShortlistPanel: React.FC<ShortlistPanelProps> = ({
  superliked,
  liked,
  defenseCache,
  finalists = [],
  showNudge = false,
  onShowFinalists,
  onMoreLikeThis,
  onRemove,
  onTransformToBrand,
  brandGuidelineId,
  onSaveToBrand,
}) => {
  const total = superliked.length + liked.length;
  const topPick = superliked[0] ?? liked[0];
  const [savingToBrand, setSavingToBrand] = useState(false);

  const copyList = async () => {
    const list = [...superliked, ...liked].map((c) => c.name).join('\n');
    const ok = await copyToClipboard(list);
    if (ok) toast.success('Lista copiada.');
    else toast.error('Falha ao copiar.');
  };

  const saveToBrand = async () => {
    if (!onSaveToBrand || savingToBrand) return;
    setSavingToBrand(true);
    try {
      await onSaveToBrand();
    } finally {
      setSavingToBrand(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-4 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
        Shortlist {total > 0 && <span className="text-neutral-600">· {total}</span>}
      </h2>

      {total === 0 ? (
        <p className="text-sm text-neutral-600">Curta um nome para começar sua shortlist.</p>
      ) : (
        <div className="flex-1 space-y-1.5 overflow-y-auto scrollbar-none pr-0.5">
          {/* Nudge de finalistas */}
          <AnimatePresence>
            {showNudge && (
              <motion.button
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                onClick={onShowFinalists}
                className="mb-2 flex w-full items-center gap-2 rounded-lg border border-brand-cyan/20 bg-brand-cyan/[0.06] px-3 py-2 text-left text-xs text-brand-cyan hover:bg-brand-cyan/10 transition-colors"
              >
                <Zap size={13} className="shrink-0" />
                Seu gosto está claro — ver 3 finalistas?
              </motion.button>
            )}
          </AnimatePresence>

          {superliked.map((card) => (
            <ShortlistRow
              key={`s-${card.name}`}
              card={card}
              isSuper
              defense={defenseCache[card.name]}
              highlighted={finalists.includes(card.name)}
              onMoreLikeThis={onMoreLikeThis}
              onRemove={onRemove}
            />
          ))}
          {liked.map((card) => (
            <ShortlistRow
              key={`l-${card.name}`}
              card={card}
              defense={undefined}
              highlighted={finalists.includes(card.name)}
              onMoreLikeThis={onMoreLikeThis}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      {/* Rodapé */}
      {total > 0 && (
        <div className="mt-4 space-y-2 border-t border-neutral-800 pt-4">
          <Button
            variant="surface"
            onClick={copyList}
            className="w-full justify-center gap-2 text-xs"
          >
            <Copy size={13} /> Copiar lista
          </Button>
          {brandGuidelineId && onSaveToBrand && (
            <Button
              variant="surface"
              onClick={saveToBrand}
              disabled={savingToBrand}
              className="w-full justify-center gap-2 text-xs"
            >
              {savingToBrand ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <BookmarkPlus size={13} />
              )}
              Salvar na marca
            </Button>
          )}
          {topPick && (
            <Button
              variant="brand"
              onClick={() => onTransformToBrand(topPick)}
              className="w-full justify-center gap-2"
            >
              <Pencil size={14} /> Transformar em marca
              <ArrowRight size={14} />
            </Button>
          )}
          <p className="pt-1 text-center text-[10px] leading-relaxed text-neutral-600">
            Paixão por nome só depois do INPI — antes disso, todo nome é hipótese.
          </p>
        </div>
      )}
    </div>
  );
};

/* ── Linha da shortlist ─────────────────────────────────────────────────── */

function ShortlistRow({
  card,
  isSuper = false,
  defense,
  highlighted = false,
  onMoreLikeThis,
  onRemove,
}: {
  card: NamingCard;
  isSuper?: boolean;
  defense?: NamingDefenseInsightResponse;
  highlighted?: boolean;
  onMoreLikeThis: (card: NamingCard) => void;
  onRemove: (card: NamingCard) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const copyName = async () => {
    const ok = await copyToClipboard(card.name);
    if (ok) toast.success(`"${card.name}" copiado.`);
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-white/[0.02] transition-colors',
        highlighted ? 'border-brand-cyan/40' : 'border-neutral-800/70'
      )}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {isSuper && <Gem size={12} className="shrink-0 text-brand-cyan" />}
        <span className="flex-1 truncate text-sm font-medium text-neutral-200">{card.name}</span>
        <ChevronDown
          size={13}
          className={cn('shrink-0 text-neutral-600 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-neutral-800/70 px-3 py-3">
              {/* Defesa */}
              {isSuper ? (
                defense ? (
                  <div className="space-y-2 text-xs text-neutral-400">
                    <p className="text-neutral-300">{defense.concept}</p>
                    {defense.layers?.length > 0 && (
                      <ul className="space-y-0.5">
                        {defense.layers.map((l, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span className="text-brand-cyan">·</span>
                            {l}
                          </li>
                        ))}
                      </ul>
                    )}
                    {defense.risks?.length > 0 && (
                      <p className="text-neutral-600">Riscos: {defense.risks.join('; ')}</p>
                    )}
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-neutral-600">
                    <Loader2 size={12} className="animate-spin" /> Montando a defesa…
                  </p>
                )
              ) : (
                <p className="text-xs leading-relaxed text-neutral-400">{card.rationale}</p>
              )}

              <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-600">
                {formatTag(card.territory)}
              </span>

              {/* Ações — uma linha, estilo uniforme */}
              <div className="flex items-center gap-1">
                <ActionChip
                  icon={<Zap size={11} />}
                  label="variações"
                  title="Gerar mais 5 nomes nesta direção"
                  onClick={() => onMoreLikeThis(card)}
                />
                <ActionChip
                  icon={<SearchCheck size={11} />}
                  label="checar"
                  title="Triagem rápida de conflitos (não substitui o INPI)"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/search?q=${encodeURIComponent(`"${card.name}" marca Brasil CNPJ`)}`,
                      '_blank',
                      'noopener'
                    )
                  }
                />
                <ActionChip icon={<Copy size={11} />} title="Copiar nome" onClick={copyName} />
                <ActionChip
                  icon={<Trash2 size={11} />}
                  title="Remover"
                  destructive
                  onClick={() => onRemove(card)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Chip de ação compacto (uma linha, sem quebra) ──────────────────────── */

function ActionChip({
  icon,
  label,
  title,
  destructive = false,
  onClick,
}: {
  icon: React.ReactNode;
  label?: string;
  title: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-neutral-800 px-2 py-1 text-[10px] text-neutral-400 transition-colors',
        destructive
          ? 'hover:border-destructive/40 hover:text-destructive'
          : 'hover:border-brand-cyan/40 hover:text-brand-cyan'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
