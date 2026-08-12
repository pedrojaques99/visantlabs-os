/**
 * Marca compilada → item `registry:theme` do shadcn.
 *
 * Mora no motor, e não no repo da vitrine, porque tem DOIS consumidores agora:
 * o build que publica `/r/theme-<marca>.json`, e a própria vitrine, que compila
 * no browser o vault de quem entrou com a conta Visant. Duas cópias divergiriam
 * no primeiro token novo — e a diferença apareceria como "o tema do site não
 * bate com o que o `add` instala", que é o pior jeito de descobrir.
 */

import { compileBrandTokens, loadCraft, oklchStr } from './engine.js';
import { brandSlug } from './fetch-brand.js';

/**
 * Compila uma marca num item `registry:theme`.
 *
 * Só cssVars — zero componente. É essa separação que permite o mesmo `marquee`
 * sair lime numa marca e âmbar noutra sem fork: o componente nunca soube a cor.
 */
export function buildBrandThemeItem(brand) {
  const compiled = compileBrandTokens(brand);
  const craft = loadCraft();
  const { themes, shadow, type, meta } = compiled;

  const colorVars = (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, oklchStr(v)]));

  return {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name: `theme-${brandSlug(brand)}`,
    type: 'registry:theme',
    title: `${meta.name ?? brandSlug(brand)} — brand theme`,
    author: 'Visant Labs <visantsupply@gmail.com>',
    description:
      `Tokens gerados de brand guideline ${meta.brandId ?? '?'} v${meta.version ?? '?'}. ` +
      `Contraste AA garantido por construção. Não editar à mão — regenerar.`,
    cssVars: {
      theme: {
        // Layer 2 — o esqueleto invariante. Igual em toda marca, de propósito:
        // derivar raio/densidade/motion por marca reintroduz genericidade por
        // aleatoriedade.
        'font-sans': `'${type.sans}', ui-sans-serif, system-ui, sans-serif`,
        'font-display': `'${type.display}', ui-sans-serif, system-ui, sans-serif`,
        'r-control': craft.radius.control,
        'r-surface': craft.radius.surface,
        'r-pill': craft.radius.pill,
        'e-flat': craft.elevation.flat,
        'e-raised': craft.elevation.raised,
        'e-overlay': craft.elevation.overlay,
        'e-modal': craft.elevation.modal,
        focus: craft.focus,
        ...craft.motion,
        ...craft.density.comfortable,
      },
      light: { ...colorVars(themes.light), shadow: shadow.light },
      dark: { ...colorVars(themes.dark), shadow: shadow.dark },
    },
    css: {
      // Superfície de trabalho (fila, board, admin) roda mais densa — throughput.
      '[data-density="compact"]': Object.fromEntries(
        Object.entries(craft.density.compact).map(([k, v]) => [`--${k}`, v])
      ),
    },
    meta: {
      brandId: meta.brandId,
      brandName: meta.name,
      brandVersion: meta.version,
      completeness: meta.completeness,
      engine: '@visant/brand-tokens',
    },
  };
}
