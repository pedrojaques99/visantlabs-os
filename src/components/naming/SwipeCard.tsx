import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  type PanInfo,
} from 'framer-motion';
import { X, Heart, Gem, AlertTriangle, Globe } from '@/lib/ui/icons';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/utils';
import type { NamingCard, Verdict } from '@/lib/naming/tasteProfile';

export interface SwipeCardHandle {
  /** Dispara o gesto programaticamente (teclado / botões). */
  fly: (verdict: Verdict) => void;
}

interface SwipeCardProps {
  card: NamingCard;
  onVerdict: (card: NamingCard, verdict: Verdict) => void;
  /** true para o card do topo (interativo); false para o de trás (preview). */
  active?: boolean;
}

const THRESHOLD = 100;

/** Slugs do backend (ex. "foreign-roots") viram labels legíveis; vírgulas viram "•". */
const formatTag = (s: string) =>
  s
    .replace(/[-_]/g, ' ')
    .replace(/\s*,\s*/g, ' • ')
    .trim();

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  ({ card, onVerdict, active = true }, ref) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const controls = useAnimationControls();
    const flying = useRef(false);

    const rotate = useTransform(x, [-260, 0, 260], [-16, 0, 16]);
    const nopeOpacity = useTransform(x, [-THRESHOLD, -24], [1, 0]);
    const likeOpacity = useTransform(x, [24, THRESHOLD], [0, 1]);
    const superOpacity = useTransform(y, [-THRESHOLD, -24], [1, 0]);

    const fly = async (verdict: Verdict) => {
      if (flying.current) return;
      flying.current = true;
      const target =
        verdict === 'superlike'
          ? { y: -900, opacity: 0 }
          : verdict === 'like'
            ? { x: 700, opacity: 0, rotate: 18 }
            : { x: -700, opacity: 0, rotate: -18 };
      await controls.start({ ...target, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } });
      onVerdict(card, verdict);
    };

    useImperativeHandle(ref, () => ({ fly }));

    const handleDragEnd = (_e: unknown, info: PanInfo) => {
      if (flying.current) return;
      const offX = info.offset.x;
      const offY = info.offset.y;
      if (offY < -THRESHOLD && Math.abs(offY) > Math.abs(offX)) {
        void fly('superlike');
      } else if (offX > THRESHOLD) {
        void fly('like');
      } else if (offX < -THRESHOLD) {
        void fly('nope');
      } else {
        controls.start({
          x: 0,
          y: 0,
          rotate: 0,
          transition: { type: 'spring', stiffness: 300, damping: 26 },
        });
      }
    };

    return (
      // Camada EXTERNA = profundidade da pilha. Anima scale/opacity/y conforme
      // o card é promovido (active vira true) — corrige o card promovido ficar
      // travado em baixa opacidade.
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        style={{ zIndex: active ? 20 : 10 }}
        animate={{ scale: active ? 1 : 0.94, y: active ? 0 : 14, opacity: active ? 1 : 0.6 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        {/* Camada INTERNA = arrasto + fly (x/y/rotate/opacity do gesto). */}
        <motion.div
          className="flex h-full w-full max-w-md items-center justify-center"
          style={active ? { x, y, rotate } : undefined}
          animate={controls}
          drag={active}
          dragElastic={0.6}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          onDragEnd={active ? handleDragEnd : undefined}
        >
          <GlassPanel
            intensity="strong"
            className={cn(
              'relative h-full w-full items-center justify-center text-center px-8 py-12 select-none',
              active && 'cursor-grab shadow-2xl shadow-black/40'
            )}
          >
            {/* Indicadores de gesto */}
            {active && (
              <>
                <motion.div
                  style={{ opacity: nopeOpacity }}
                  className="pointer-events-none absolute top-5 right-5 flex items-center gap-1.5 rounded-lg border border-destructive/60 px-2.5 py-1 text-destructive"
                >
                  <X size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Nope
                  </span>
                </motion.div>
                <motion.div
                  style={{ opacity: likeOpacity }}
                  className="pointer-events-none absolute top-5 left-5 flex items-center gap-1.5 rounded-lg border border-success/60 px-2.5 py-1 text-success"
                >
                  <Heart size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Curti
                  </span>
                </motion.div>
                <motion.div
                  style={{ opacity: superOpacity }}
                  className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-lg border border-brand-cyan/70 px-3 py-1.5 text-brand-cyan"
                >
                  <Gem size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Superlike
                  </span>
                </motion.div>
              </>
            )}

            {/* Conteúdo só no card ativo — o GlassPanel é translúcido e o texto
              do preview vazaria por baixo; o card de trás fica como moldura vazia. */}
            {active && (
              <>
                {/* Território — pill suave (não mono cru) */}
                <span className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                  {formatTag(card.territory)}
                </span>

                {/* Nome */}
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-neutral-50 break-words">
                  {card.name}
                </h2>

                {/* Divisor — dá âncora ao nome e mata o "card oco" */}
                <span className="my-5 h-px w-10 bg-white/10" />

                {/* Defesa */}
                <p className="max-w-xs text-sm leading-relaxed text-neutral-400">
                  {card.rationale}
                </p>

                {/* Técnica — mono só aqui (label técnico de verdade) */}
                <span className="mt-6 text-[10px] uppercase tracking-wider text-neutral-600">
                  {formatTag(card.technique)}
                </span>

                {/* Domínio parcialmente ocupado — o 'taken' já foi descartado no servidor */}
                {card.availability?.status === 'partial' && (
                  <span
                    title={`Já registrado: ${card.availability.registered.join(', ')}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[10px] font-mono text-warning"
                  >
                    <Globe size={11} />
                    {card.availability.registered.join(', ')} em uso
                  </span>
                )}

                {/* Domínio não verificado — RDAP em timeout/erro; NUNCA tratar
                  como livre (o servidor mantém 'unknown' de propósito) */}
                {card.availability?.status === 'unknown' && (
                  <span
                    title="RDAP indisponível — não foi possível verificar o domínio"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-mono text-neutral-500"
                  >
                    <Globe size={11} />
                    domínio não verificado
                  </span>
                )}

                {/* Flag de risco */}
                {card.riskFlag && (
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[10px] font-mono text-warning">
                    <AlertTriangle size={11} />
                    {card.riskFlag}
                  </span>
                )}
              </>
            )}
          </GlassPanel>
        </motion.div>
      </motion.div>
    );
  }
);

SwipeCard.displayName = 'SwipeCard';
