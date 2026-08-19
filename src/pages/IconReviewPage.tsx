/**
 * Icon Catalog — vitrine de todos os ícones do barrel `src/lib/ui/icons.ts`
 * (Phosphor sob nomes lucide), com contagem de uso real no código. Clicar num
 * card abre um picker que busca na lib Phosphor e, ao escolher, grava a nova
 * linha no barrel via POST /api/dev-icons/icon-swap (dev-only) — o HMR recarrega.
 * Contagem vem de `icon-usage.generated.ts` (rode scripts/icon-usage-report.mjs).
 * Rota descartável.
 */
import { useEffect, useMemo, useState } from 'react';
import type { IconWeight } from '@phosphor-icons/react';
import * as Phosphor from '@phosphor-icons/react';
import { toast } from 'sonner';
import { PageShell } from '@/components/ui/PageShell';
import { API_BASE } from '@/config/api';
import * as Icons from '@/lib/ui/icons';
import { ICON_USAGE, ICON_USAGE_TOTAL, type IconUsage } from '@/lib/ui/icon-usage.generated';

const WEIGHTS: IconWeight[] = ['regular', 'bold', 'duotone', 'fill', 'thin'];
type SortMode = 'usage' | 'alpha';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = Icons as Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const phosphor = Phosphor as Record<string, any>;

// Nomes canônicos dos ícones Phosphor. O pacote exporta cada glifo em duas
// formas (`Acorn` e `AcornIcon`); os aliases `*Icon` não têm arquivo CSR, então
// o endpoint os rejeitaria — ficamos só com o nome base. Exclui utilitários.
const NON_ICONS = new Set(['IconContext', 'IconBase', 'SSRBase']);
const PHOSPHOR_NAMES = Object.keys(phosphor)
  .filter((k) => /^[A-Z][A-Za-z0-9]+$/.test(k) && !k.endsWith('Icon') && !NON_ICONS.has(k))
  .sort();

export function IconReviewPage() {
  const [weight, setWeight] = useState<IconWeight>('regular');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('usage');
  const [editing, setEditing] = useState<string | null>(null); // lucide slot em edição
  const [overrides, setOverrides] = useState<Record<string, string>>({}); // slot → phosphor (feedback instantâneo)
  const [pickerQuery, setPickerQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list: IconUsage[] = q
      ? ICON_USAGE.filter((i) => i.name.toLowerCase().includes(q))
      : ICON_USAGE;
    if (sort === 'alpha') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [query, sort]);

  const pickerResults = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const base = q ? PHOSPHOR_NAMES.filter((n) => n.toLowerCase().includes(q)) : PHOSPHOR_NAMES;
    return base.slice(0, 120);
  }, [pickerQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function swap(lucideName: string, phosphorName: string) {
    setSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/dev-icons/icon-swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lucideName, phosphorName }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'falhou');
      setOverrides((o) => ({ ...o, [lucideName]: phosphorName }));
      setEditing(null);
      toast.success(`${lucideName} → ${phosphorName}`, { description: 'barrel atualizado' });
    } catch (err) {
      toast.error(`Não trocou: ${err instanceof Error ? err.message : 'erro'}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      pageId="icon-catalog"
      seoTitle="Icon Catalog — Visant Labs"
      microTitle="Design System // Icons"
      title="Icon Catalog"
      description={`${ICON_USAGE.length} ícones (Phosphor sob nomes lucide) · ${ICON_USAGE_TOTAL} usos. Clique num ícone pra trocar o glifo — grava no barrel na hora.`}
      width="7xl"
      actions={
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar…"
            className="h-9 w-40 rounded-md border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-white/25"
          />
          <div className="flex items-center gap-1 rounded-md border border-white/10 p-0.5">
            <button
              onClick={() => setSort('usage')}
              className={`rounded px-2 py-1 text-xs font-mono transition-colors ${
                sort === 'usage' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              uso
            </button>
            <button
              onClick={() => setSort('alpha')}
              className={`rounded px-2 py-1 text-xs font-mono transition-colors ${
                sort === 'alpha' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              a→z
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-white/10 p-0.5">
            {WEIGHTS.map((w) => (
              <button
                key={w}
                onClick={() => setWeight(w)}
                className={`rounded px-2 py-1 text-xs font-mono capitalize transition-colors ${
                  weight === w ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {rows.map(({ name, count, files }) => {
          const overridden = overrides[name];
          const Cmp = overridden ? phosphor[overridden] : registry[name];
          return (
            <button
              key={name}
              onClick={() => {
                setEditing(name);
                setPickerQuery('');
              }}
              title={`${count} usos em ${files} arquivo(s) · clique pra trocar`}
              className="group relative flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center transition-colors hover:border-brand-cyan/50 hover:bg-white/[0.06]"
            >
              <span
                className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 font-mono text-2xs tabular-nums ${
                  count === 0 ? 'bg-white/5 text-white/30' : 'bg-white/10 text-white/60'
                }`}
              >
                {count}
              </span>
              {Cmp ? (
                <Cmp size={32} weight={weight} className="text-white/90" />
              ) : (
                <span className="text-xs text-destructive">?</span>
              )}
              <div className="font-mono text-xs text-white/80">{name}</div>
              {overridden && (
                <div className="font-mono text-2xs text-neutral-400">→ {overridden}</div>
              )}
            </button>
          );
        })}
      </div>
      {rows.length === 0 && (
        <p className="py-16 text-center text-sm text-white/40">Nenhum ícone bate com "{query}".</p>
      )}

      {/* Picker de troca */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[8vh] backdrop-blur-sm"
          onClick={() => setEditing(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const Cur = overrides[editing] ? phosphor[overrides[editing]] : registry[editing];
                  return Cur ? <Cur size={26} className="text-white/90" /> : null;
                })()}
                <div>
                  <div className="font-mono text-sm text-white">{editing}</div>
                  <div className="text-2xs text-white/40">escolha o glifo Phosphor</div>
                </div>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="rounded-md px-2 py-1 text-sm text-white/50 hover:text-white"
              >
                esc
              </button>
            </div>
            <div className="border-b border-white/10 p-3">
              {/* autoFocus é intencional (busca de painel interno). O plugin
                  eslint-plugin-jsx-a11y não está instalado, então referenciar
                  a regra num disable quebrava o `eslint .` do CI. */}
              <input
                autoFocus
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder={`Buscar em ${PHOSPHOR_NAMES.length} ícones Phosphor…`}
                className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-white/25"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-5 md:grid-cols-6">
              {pickerResults.map((pn) => {
                const P = phosphor[pn];
                return (
                  <button
                    key={pn}
                    disabled={saving}
                    onClick={() => swap(editing, pn)}
                    title={pn}
                    className="flex flex-col items-center gap-2 rounded-lg border border-transparent p-3 text-center transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    {P ? <P size={24} weight={weight} className="text-white/85" /> : null}
                    <span className="w-full truncate font-mono text-3xs text-white/50">{pn}</span>
                  </button>
                );
              })}
              {pickerResults.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-white/40">
                  Nenhum Phosphor bate com "{pickerQuery}".
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default IconReviewPage;
