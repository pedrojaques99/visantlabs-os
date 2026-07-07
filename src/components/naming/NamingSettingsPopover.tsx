import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { ModelSelector } from '@/components/shared/ModelSelector';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/lib/utils';
import { CHAT_MODELS } from '@/constants/geminiModels';
import { getPreferredChatModel } from '@/utils/modelPreferences';
import {
  NAMING_TECHNIQUES,
  NAMING_RULERS,
  NAMING_LANGUAGES,
  NAMING_MAX_LENGTHS,
  NAMING_BATCH_SIZES,
  type NamingSettings,
} from '@/lib/naming/constants';

const ease = [0.4, 0, 0.2, 1] as const;

export interface NamingSettingsPopoverProps {
  settings: NamingSettings;
  onChange: (patch: Partial<NamingSettings>) => void;
  onReset: () => void;
  className?: string;
}

/**
 * Configurações avançadas do deck — engrenagem discreta + painel compacto.
 * Zero pedágio: sem botão salvar, mudanças aplicam na PRÓXIMA leva.
 */
export const NamingSettingsPopover: React.FC<NamingSettingsPopoverProps> = ({
  settings,
  onChange,
  onReset,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickOutside(rootRef, () => setOpen(false), { enabled: open });

  const modelValue = settings.model || getPreferredChatModel() || CHAT_MODELS[0];

  const toggleTechnique = (slug: string) => {
    const has = settings.techniques.includes(slug);
    onChange({
      techniques: has
        ? settings.techniques.filter((t) => t !== slug)
        : [...settings.techniques, slug],
    });
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Configurações avançadas"
        aria-expanded={open}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
          open
            ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan'
            : 'border-neutral-800 bg-white/[0.03] text-neutral-500 hover:border-white/10 hover:text-neutral-300'
        )}
      >
        <SlidersHorizontal size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease }}
            className="absolute right-0 top-10 z-50 w-72"
          >
            <GlassPanel
              intensity="strong"
              className="max-h-[70vh] gap-4 overflow-y-auto scrollbar-none bg-neutral-900/80 p-4 backdrop-blur-xl shadow-2xl shadow-black/40"
            >
              {/* Régua fonética */}
              <Group label="Régua fonética">
                <div className="flex flex-col gap-1">
                  {NAMING_RULERS.map((r) => (
                    <Chip
                      key={r.value}
                      active={settings.ruler === r.value}
                      onClick={() => onChange({ ruler: r.value })}
                      className="justify-between"
                    >
                      <span>{r.label}</span>
                      <span className="text-[9px] text-neutral-600">{r.desc}</span>
                    </Chip>
                  ))}
                </div>
              </Group>

              {/* Tamanho máx. */}
              <Group label="Tamanho máx.">
                <div className="flex gap-1.5">
                  {NAMING_MAX_LENGTHS.map((m) => (
                    <Chip
                      key={m.value}
                      active={settings.maxLength === m.value}
                      onClick={() => onChange({ maxLength: m.value })}
                    >
                      {m.label}
                    </Chip>
                  ))}
                </div>
              </Group>

              {/* Técnicas */}
              <Group label="Técnicas" hint={settings.techniques.length === 0 ? 'todas' : undefined}>
                <div className="flex flex-wrap gap-1.5">
                  {NAMING_TECHNIQUES.map((t) => (
                    <Chip
                      key={t.slug}
                      active={settings.techniques.includes(t.slug)}
                      onClick={() => toggleTechnique(t.slug)}
                    >
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </Group>

              {/* Idioma */}
              <Group label="Idioma">
                <div className="flex gap-1.5">
                  {NAMING_LANGUAGES.map((l) => (
                    <Chip
                      key={l.value}
                      active={settings.language === l.value}
                      onClick={() => onChange({ language: l.value })}
                    >
                      {l.label}
                    </Chip>
                  ))}
                </div>
              </Group>

              {/* Modelo */}
              <Group label="Modelo">
                <ModelSelector
                  type="chat"
                  selectedModel={modelValue}
                  onModelChange={(model) => onChange({ model })}
                />
              </Group>

              {/* Nomes por leva */}
              <Group label="Nomes por leva">
                <div className="flex gap-1.5">
                  {NAMING_BATCH_SIZES.map((n) => (
                    <Chip
                      key={n}
                      active={settings.batchSize === n}
                      onClick={() => onChange({ batchSize: n })}
                    >
                      {n}
                    </Chip>
                  ))}
                </div>
              </Group>

              {/* Rodapé — restaurar padrão */}
              <button
                type="button"
                onClick={onReset}
                className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-neutral-600 transition-colors hover:text-neutral-400"
              >
                <RotateCcw size={11} />
                restaurar padrão
              </button>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Bloco rotulado ─────────────────────────────────────────────────────── */

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
        {label}
        {hint && <span className="ml-1.5 text-neutral-700">· {hint}</span>}
      </span>
      {children}
    </div>
  );
}

/* ── Chip selecionável ──────────────────────────────────────────────────── */

function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition-colors',
        active
          ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan'
          : 'border-neutral-800 text-neutral-400 hover:border-white/10 hover:text-neutral-200',
        className
      )}
    >
      {children}
    </button>
  );
}

export default NamingSettingsPopover;
