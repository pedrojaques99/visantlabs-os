import { REGIONS, DESIGN_COUNTRIES, REGION_LABELS, countryName } from '@/lib/references/taxonomy';
import { localizedName, type LocalizableRef } from '@/lib/references/naming';
import { type ReferenceItem } from '@/services/referencesApi';

export type Option = { value: string; label: string };
export type TOr = (key: string, fallback: string) => string;

/** Rótulo de região no idioma do usuário (a taxonomia guarda o nome em inglês). */
export function regionLabel(id: string, tOr: TOr): string {
  return tOr(`references.region.${id}`, REGION_LABELS[id] || id);
}

/**
 * Opções de país/região a partir do que a biblioteca TEM (facets do servidor),
 * pra o filtro nunca anunciar um recorte vazio. Sem facets, cai na taxonomia.
 */
export function countryOptions(tOr: TOr, locale: string, available?: string[]): Option[] {
  const list = available?.length ? available : DESIGN_COUNTRIES;
  const opts = list
    .map((c) => ({ value: c, label: countryName(c, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  return [{ value: '', label: tOr('references.allCountries', 'Todos os países') }, ...opts];
}
export function regionOptions(tOr: TOr, available?: string[]): Option[] {
  const ids = available?.length
    ? REGIONS.map((r) => r.id).filter((id) => available.includes(id))
    : REGIONS.map((r) => r.id);
  return [
    { value: '', label: tOr('references.allRegions', 'Todas as regiões') },
    ...ids.map((id) => ({ value: id, label: regionLabel(id, tOr) })),
  ];
}

export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Generic source labels that aren't real titles (studio field is often just a provenance tag).
const GENERIC_STUDIO = /^(visant|curated|visant\s*curated|reference|ref)$/i;

/**
 * Human-facing title, in the viewer's language.
 *
 * Precedence used to be designer/studio FIRST, because names were junk — which
 * made every curated row render as "Visant Curated". Names are real now, so the
 * name leads and attribution is the fallback. Generic studio labels still lose
 * to anything more specific. Internal id-slugs (ref_urbanstay_56, club_ref_69)
 * are never surfaced — `localizedName` rewrites them.
 */
export function refTitle(
  item: Pick<ReferenceItem, 'name' | 'nameI18n' | 'studio' | 'provenance' | 'dimensions'>,
  locale: string,
  fallback = 'Referência'
): string {
  const title = localizedName(item as LocalizableRef, locale, '');
  if (title) return title;

  const designer = item.provenance?.designer?.trim();
  const studio = item.studio?.trim();
  if (designer && !GENERIC_STUDIO.test(designer)) return designer;
  if (studio && !GENERIC_STUDIO.test(studio)) return studio;
  return designer || studio || fallback;
}

/** Dimension values two references share — powers the "why it matches" explanation. */
export function sharedDimensions(a?: ReferenceItem, b?: ReferenceItem): string[] {
  if (!a || !b) return [];
  const da = a.dimensions || {};
  const db = b.dimensions || {};
  const out: string[] = [];
  for (const key of Object.keys(da)) {
    const set = new Set(da[key] || []);
    for (const v of db[key] || []) if (set.has(v)) out.push(v);
  }
  return [...new Set(out)].slice(0, 6);
}
