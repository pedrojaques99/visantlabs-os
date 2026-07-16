/**
 * Icon Catalog — vitrine de todos os ícones do barrel `src/lib/ui/icons.ts`
 * (Phosphor sob nomes lucide), com contagem de uso real no código. A contagem
 * vem de `icon-usage.generated.ts` — rode `node scripts/icon-usage-report.mjs`
 * pra atualizar. Toggle de weight pra sentir a personalidade. Rota descartável.
 */
import { useMemo, useState } from 'react';
import type { IconWeight } from '@phosphor-icons/react';
import { PageShell } from '@/components/ui/PageShell';
import * as Icons from '@/lib/ui/icons';
import { ICON_USAGE, ICON_USAGE_TOTAL, type IconUsage } from '@/lib/ui/icon-usage.generated';

const WEIGHTS: IconWeight[] = ['regular', 'bold', 'duotone', 'fill', 'thin'];
type SortMode = 'usage' | 'alpha';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = Icons as Record<string, any>;

export function IconReviewPage() {
  const [weight, setWeight] = useState<IconWeight>('regular');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('usage');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list: IconUsage[] = q
      ? ICON_USAGE.filter((i) => i.name.toLowerCase().includes(q))
      : ICON_USAGE;
    if (sort === 'alpha') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [query, sort]);

  return (
    <PageShell
      pageId="icon-catalog"
      seoTitle="Icon Catalog — Visant Labs"
      microTitle="Design System // Icons"
      title="Icon Catalog"
      description={`${ICON_USAGE.length} ícones (Phosphor sob nomes lucide) · ${ICON_USAGE_TOTAL} usos no código. Contagem = quantas vezes cada ícone é renderizado em src/.`}
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
          const Cmp = registry[name];
          return (
            <div
              key={name}
              title={`${count} usos em ${files} arquivo(s)`}
              className="relative flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center transition-colors hover:border-white/25"
            >
              <span
                className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                  count === 0 ? 'bg-white/5 text-white/30' : 'bg-white/10 text-white/60'
                }`}
              >
                {count}
              </span>
              {Cmp ? (
                <Cmp size={32} weight={weight} className="text-white/90" />
              ) : (
                <span className="text-xs text-red-400">?</span>
              )}
              <div className="font-mono text-xs text-white/80">{name}</div>
            </div>
          );
        })}
      </div>
      {rows.length === 0 && (
        <p className="py-16 text-center text-sm text-white/40">Nenhum ícone bate com "{query}".</p>
      )}
    </PageShell>
  );
}

export default IconReviewPage;
