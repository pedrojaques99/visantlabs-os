/**
 * Auto-generated slides — the *smart* tier of the web preset library. Unlike the
 * slot-driven templates (where a human/agent supplies h1/photo/etc.), these read
 * the brand guideline itself and self-populate: the color palette becomes a
 * swatch showcase, the present sections become a table of contents. Content is
 * COMPUTED from brand data, so there's nothing to fill — pick the brand, get the slide.
 *
 * Same theme contract as the rest (PresetVars + fonts); only the content source
 * differs. Each function takes the full brand so it can derive its own content.
 */
import type { BrandGuideline } from '../types/brandGuideline.js';
import { DOC, esc, type PresetVars } from './preset-html.js';

type Text = Record<string, string | string[] | null | undefined>;

const asStr = (v: string | string[] | null | undefined): string =>
  v == null ? '' : Array.isArray(v) ? v.join(' ') : v;

/** Pick #000/#fff for legible text on a given hex (WCAG, mirrors the brand page). */
function readableHex(hex: string): string {
  const m = hex
    .replace('#', '')
    .match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return '#0B0B0C';
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return (lum + 0.05) / 0.05 >= 4.5 ? '#0B0B0C' : '#FFFFFF';
}

/** Slide/Palette (1920×1080) — every brand color as a swatch card (name · hex ·
 * role), in a grid that adapts to the palette size. Pure brand-data. */
export function paletteSlideHtml(
  brand: BrandGuideline,
  vars: PresetVars,
  text: Text,
  fontCss: string
): string {
  const W = 1920,
    H = 1080,
    PAD = 80,
    GAP = 24;
  const title = text.h1 ? asStr(text.h1) : 'Paleta de Cores';
  const colors = (brand.colors || []).filter((c) => /^#?[0-9a-f]{6}$/i.test(c.hex || ''));

  // graceful empty state — never render a blank slide
  if (!colors.length) {
    const body = `<div class="frame"><p style="position:absolute;left:${PAD}px;top:${PAD}px;
      font-size:32px;color:${vars.text};opacity:.6">Sem paleta de cores definida.</p></div>`;
    return DOC(W, H, fontCss, body, vars);
  }

  const n = colors.length;
  const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const areaTop = 200;
  const areaH = H - areaTop - PAD;
  const cardH = Math.floor((areaH - (rows - 1) * GAP) / rows);
  const basis = `calc((100% - ${(cols - 1) * GAP}px) / ${cols})`;

  const cards = colors
    .map((c) => {
      const hex = c.hex.startsWith('#') ? c.hex.toUpperCase() : `#${c.hex.toUpperCase()}`;
      const ink = readableHex(hex);
      const role = c.role ? `<span class="role">${esc(c.role)}</span>` : '';
      return `<div class="card" style="background:${hex};color:${ink}">
        <span class="name">${esc(c.name || 'Cor')}</span>
        <div class="meta"><span class="hex">${esc(hex)}</span>${role}</div>
      </div>`;
    })
    .join('');

  const body = `<div class="frame">
  <h1 class="title">${esc(title)}</h1>
  <div class="grid">${cards}</div>
  <style>
    .title{position:absolute;left:${PAD}px;top:90px;font-size:46px;font-weight:600;
      font-family:'${vars.headingFont}',sans-serif;letter-spacing:-0.02em;color:${vars.heading}}
    .grid{position:absolute;left:${PAD}px;right:${PAD}px;top:${areaTop}px;
      display:flex;flex-wrap:wrap;gap:${GAP}px}
    .card{flex:0 0 ${basis};height:${cardH}px;border-radius:${Math.min(vars.radius, 20)}px;
      padding:32px;position:relative;display:flex;flex-direction:column;justify-content:space-between}
    .card .name{font-size:30px;font-weight:600}
    .card .meta{display:flex;justify-content:space-between;align-items:flex-end;font-size:22px;opacity:.85}
    .card .hex{letter-spacing:0.04em}
    .card .role{text-transform:uppercase;font-size:18px;letter-spacing:0.08em;opacity:.8}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}

interface TocGroup {
  title: string;
  items: string[];
}

/** Derive the table of contents from what the brand actually has filled. */
function brandToc(brand: BrandGuideline): TocGroup[] {
  const groups: TocGroup[] = [];

  const id: string[] = [];
  if (brand.logos?.length) id.push('Logotipo');
  if (brand.colors?.length) id.push('Paleta de cores');
  if (brand.typography?.length) id.push('Tipografia');
  if (brand.gradients?.length) id.push('Gradientes');
  if (id.length) groups.push({ title: 'Identidade Visual', items: id });

  const st = brand.strategy || {};
  const strat: string[] = [];
  if (st.manifesto) strat.push('Manifesto');
  if (st.positioning?.length) strat.push('Posicionamento');
  if (st.coreMessage?.product) strat.push('Mensagem central');
  if (st.pillars?.length) strat.push('Pilares');
  if (st.archetypes?.length) strat.push('Arquétipos');
  if (st.personas?.length) strat.push('Personas');
  if (strat.length) groups.push({ title: 'Estratégia', items: strat });

  const g = brand.guidelines || {};
  const guide: string[] = [];
  if (g.voice) guide.push('Tom de voz');
  if (g.dos?.length || g.donts?.length) guide.push("Do's & Don'ts");
  if (g.imagery) guide.push('Imagery');
  if (g.accessibility) guide.push('Acessibilidade');
  if (guide.length) groups.push({ title: 'Diretrizes', items: guide });

  const app: string[] = [];
  if (brand.media?.length) app.push('Aplicações gráficas');
  if (st.graphicSystem) app.push('Sistema gráfico');
  if (st.marketResearch) app.push('Pesquisa de mercado');
  if (app.length) groups.push({ title: 'Aplicações', items: app });

  return groups;
}

/** Slide/Index (1920×1080) — table of contents auto-built from the brand's
 * present sections, with an oversized rotated title on the right edge. */
export function indexSlideHtml(
  brand: BrandGuideline,
  vars: PresetVars,
  text: Text,
  fontCss: string
): string {
  const W = 1920,
    H = 1080,
    PAD = 120;
  const title = text.h1 ? asStr(text.h1) : 'Sumário';
  const groups = brandToc(brand);

  // graceful fallback — a brand with nothing filled still gets a sensible TOC
  const list: TocGroup[] = groups.length
    ? groups
    : [{ title: 'Identidade Visual', items: ['Logotipo', 'Paleta de cores', 'Tipografia'] }];

  const cols = list
    .map(
      (grp, i) => `<div class="grp">
      <div class="ghead"><span class="gn">${String(i + 1).padStart(2, '0')}</span>
        <span class="gt">${esc(grp.title)}</span></div>
      <div class="gitems">${grp.items.map((it) => `<span>${esc(it)}</span>`).join('')}</div>
    </div>`
    )
    .join('');

  const body = `<div class="frame">
  <div class="groups">${cols}</div>
  <div class="bigwrap"><span class="big">${esc(title)}</span></div>
  <style>
    .groups{position:absolute;left:${PAD}px;top:130px;right:360px;
      display:flex;flex-wrap:wrap;gap:56px 64px;align-content:flex-start}
    .grp{flex:0 0 calc(50% - 32px)}
    .ghead{display:flex;align-items:baseline;gap:18px;margin-bottom:18px}
    .gn{font-size:26px;color:${vars.accent};font-weight:600}
    .gt{font-size:30px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${vars.heading}}
    .gitems{display:flex;flex-direction:column;gap:10px;padding-left:44px}
    .gitems span{font-size:24px;color:${vars.text};opacity:.65}
    .bigwrap{position:absolute;right:0;top:0;bottom:0;width:320px;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .big{transform:rotate(-90deg);white-space:nowrap;font-family:'${vars.headingFont}',sans-serif;
      font-weight:600;font-size:190px;letter-spacing:-0.03em;color:${vars.heading};opacity:.92;text-transform:uppercase}
  </style>
</div>`;
  return DOC(W, H, fontCss, body, vars);
}
