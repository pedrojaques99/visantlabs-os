import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Plus, Trash2, Loader2 } from '@/lib/ui/icons';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/lib/utils';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { relativeTime } from '@/utils/time';
import { namingSessionApi, type NamingSessionSummary } from '@/services/namingSessionApi';

const ease = [0.4, 0, 0.2, 1] as const;

export interface NamingHistoryPopoverProps {
  /** id da sessão atualmente aberta (destaca a linha). */
  currentId: string | null;
  /** Abre uma sessão anterior (busca o blob + restaura). */
  onRestore: (id: string) => void;
  /** Começa uma nova sessão (a atual já está salva no histórico). */
  onNew: () => void;
  className?: string;
}

/**
 * "Sessões anteriores" — mesmo padrão do NamingSettingsPopover (relógio discreto +
 * painel compacto). Lista as sessões persistidas no backend (namingSessionApi),
 * abre/deleta. Só faz sentido para usuário logado; a page controla a montagem.
 */
export const NamingHistoryPopover: React.FC<NamingHistoryPopoverProps> = ({
  currentId,
  onRestore,
  onNew,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<NamingSessionSummary[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickOutside(rootRef, () => setOpen(false), { enabled: open });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(await namingSessionApi.list());
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => {
      if (!v) void refresh();
      return !v;
    });
  }, [refresh]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setSessions((s) => s.filter((x) => x.id !== id)); // otimista
      try {
        await namingSessionApi.remove(id);
      } catch {
        void refresh(); // desfaz o otimista se falhar
      }
    },
    [refresh]
  );

  const restore = useCallback(
    (id: string) => {
      setOpen(false);
      onRestore(id);
    },
    [onRestore]
  );

  const startNew = useCallback(() => {
    setOpen(false);
    onNew();
  }, [onNew]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Sessões anteriores"
        aria-expanded={open}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
          open
            ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan'
            : 'border-neutral-800 bg-white/[0.03] text-neutral-500 hover:border-white/10 hover:text-neutral-300'
        )}
      >
        <History size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease }}
            className="absolute left-0 top-10 z-50 w-72"
          >
            <GlassPanel
              intensity="strong"
              className="max-h-[70vh] gap-2 overflow-y-auto scrollbar-none bg-neutral-900/80 p-4 backdrop-blur-xl shadow-2xl shadow-black/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xs uppercase tracking-widest text-neutral-500">
                  Sessões anteriores
                </span>
                <button
                  type="button"
                  onClick={startNew}
                  className="flex items-center gap-1 text-2xs text-neutral-500 transition-colors hover:text-brand-cyan"
                >
                  <Plus size={11} /> nova
                </button>
              </div>

              {loading ? (
                <p className="flex items-center gap-2 py-4 text-xs text-neutral-600">
                  <Loader2 size={12} className="animate-spin" /> carregando…
                </p>
              ) : sessions.length === 0 ? (
                <p className="py-4 text-center text-xs text-neutral-600">
                  Nenhuma sessão anterior ainda.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => restore(s.id)}
                      onKeyDown={(e) => e.key === 'Enter' && restore(s.id)}
                      className={cn(
                        'group flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                        s.id === currentId
                          ? 'border-brand-cyan/40 bg-brand-cyan/[0.06]'
                          : 'border-neutral-800 hover:bg-white/[0.035]'
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          s.id === currentId ? 'bg-brand-cyan' : 'bg-neutral-700'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-neutral-200">{s.name}</p>
                        <p className="text-2xs text-neutral-600">
                          {s.likedCount > 0 && `${s.likedCount} curtidos · `}
                          {relativeTime(s.updatedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, s.id)}
                        aria-label="Remover sessão"
                        className={cn(
                          hoverReveal,
                          'shrink-0 rounded p-1 text-neutral-600 hover:text-destructive'
                        )}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NamingHistoryPopover;
