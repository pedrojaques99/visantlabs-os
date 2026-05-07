/**
 * Single source of truth for BrandGuideline export data.
 * Every export format (CSS, Tailwind, Markdown, DESIGN.md) reads from this registry.
 * When a new section is added to BrandGuideline, add it here ONCE — all exports update.
 */
import type { BrandGuideline } from './figma-types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const slug = (s: string) =>
  (s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// ── Normalized section types ─────────────────────────────────────────────────

export interface ExportColor {
  key: string;
  name: string;
  hex: string;
  role?: string;
}

export interface ExportTypography {
  key: string;
  role: string;
  family: string;
  style?: string;
  size?: number;
  lineHeight?: number | string;
  letterSpacing?: string;
}

export interface ExportSpacing { key: string; value: number }
export interface ExportRadius { key: string; value: number }

export interface ExportShadow {
  name: string;
  type: string;
  css: string;
}

export interface ExportGradient {
  name: string;
  type: string;
  css: string;
  usage?: string;
}

export interface ExportBorder {
  name: string;
  role: string;
  css: string;
}

export interface ExportMotion {
  philosophy?: string;
  easing?: string;
  durations?: Record<string, number>;
  respectsReducedMotion?: boolean;
}

export interface ExportColorTheme {
  name: string;
  key: string;
  bg: string;
  text: string;
  primary: string;
  accent: string;
}

export interface ExportIdentity {
  name?: string;
  tagline?: string;
  description?: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  portfolio?: string;
  x?: string;
}

export interface ExportLogo {
  url: string;
  variant: string;
  label?: string;
  format?: string;
}

export interface ExportMedia {
  url: string;
  type: string;
  label?: string;
  category?: string;
}

export interface ExportVoice {
  voice?: string;
  person?: string;
  emojiPolicy?: string;
  dos?: string[];
  donts?: string[];
  casingRules?: string[];
  imagery?: string;
  accessibility?: string;
}

export interface ExportStrategy {
  manifesto?: { provocation?: string; tension?: string; promise?: string; full?: string } | string;
  positioning?: string[];
  coreMessage?: { product: string; differential: string; emotionalBond: string };
  pillars?: Array<{ value: string; description: string }>;
  archetypes?: Array<{ name: string; role?: string; description: string; examples?: string[] }>;
  personas?: Array<{ name: string; age?: number; occupation?: string; traits?: string[]; bio?: string; desires?: string[]; painPoints?: string[] }>;
  voiceValues?: Array<{ title: string; description: string; example: string }>;
  marketResearch?: { competitors?: string[]; gaps?: string[]; opportunities?: string[]; notes?: string };
  graphicSystem?: { patterns?: string[]; grafisms?: string[]; imageRules?: string[]; editorialGrid?: string };
}

export interface ExportTags {
  [category: string]: string[];
}

export interface ExportTokenShadow {
  key: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

// ── Full normalized export data ──────────────────────────────────────────────

export interface GuidelineExportData {
  meta: { name: string; version: string; description?: string };
  identity: ExportIdentity;
  colors: ExportColor[];
  colorThemes: ExportColorTheme[];
  typography: ExportTypography[];
  spacing: ExportSpacing[];
  radius: ExportRadius[];
  shadows: ExportShadow[];
  gradients: ExportGradient[];
  borders: ExportBorder[];
  motion: ExportMotion | null;
  tokenShadows: ExportTokenShadow[];
  logos: ExportLogo[];
  media: ExportMedia[];
  voice: ExportVoice;
  strategy: ExportStrategy;
  tags: ExportTags;
}

// ── Extractor (THE single source of truth) ───────────────────────────────────

export function extractExportData(g: BrandGuideline): GuidelineExportData {
  const name = g.identity?.name || g.name || 'Untitled';

  return {
    meta: {
      name,
      version: new Date().toISOString().split('T')[0],
      description: g.identity?.description || g.description,
    },

    identity: {
      name,
      tagline: g.identity?.tagline || g.tagline,
      description: g.identity?.description || g.description,
      website: g.identity?.website,
      instagram: g.identity?.instagram,
      linkedin: g.identity?.linkedin,
      portfolio: g.identity?.portfolio,
      x: g.identity?.x,
    },

    colors: (g.colors || []).map(c => ({
      key: slug(c.name || 'color'),
      name: c.name || 'Color',
      hex: c.hex,
      role: c.role,
    })),

    colorThemes: (g.colorThemes || []).map(t => ({
      name: t.name,
      key: slug(t.name),
      bg: t.bg,
      text: t.text,
      primary: t.primary,
      accent: t.accent,
    })),

    typography: (g.typography || []).map(t => ({
      key: slug(t.role || 'body'),
      role: t.role || 'body',
      family: t.family,
      style: t.style,
      size: t.size,
      lineHeight: t.lineHeight,
      letterSpacing: t.letterSpacing,
    })),

    spacing: Object.entries(g.tokens?.spacing || {}).map(([k, v]) => ({ key: k, value: v })),
    radius: Object.entries(g.tokens?.radius || {}).map(([k, v]) => ({ key: k, value: v })),

    tokenShadows: Object.entries(g.tokens?.shadows || {}).map(([k, v]) => ({
      key: k, x: v.x, y: v.y, blur: v.blur, spread: v.spread, color: v.color, opacity: v.opacity,
    })),

    shadows: (g.shadows || []).map(s => ({
      name: s.name,
      type: s.type,
      css: s.css || `${s.type === 'inner' ? 'inset ' : ''}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`,
    })),

    gradients: (g.gradients || []).map(gr => ({
      name: gr.name,
      type: gr.type,
      css: gr.css || (gr.type === 'linear'
        ? `linear-gradient(${gr.angle}deg, ${gr.stops.map(s => `${s.color} ${s.position}%`).join(', ')})`
        : `radial-gradient(${gr.stops.map(s => `${s.color} ${s.position}%`).join(', ')})`),
      usage: gr.usage,
    })),

    borders: (g.borders || []).map(b => ({
      name: b.name,
      role: b.role,
      css: b.css || `${b.width}px ${b.style} ${b.color}`,
    })),

    motion: g.motion ? {
      philosophy: g.motion.philosophy,
      easing: g.motion.easing,
      durations: g.motion.durations as Record<string, number> | undefined,
      respectsReducedMotion: g.motion.respectsReducedMotion,
    } : null,

    logos: (g.logos || []).map(l => {
      const ext = l.url.split('?')[0].toLowerCase();
      const format = ext.endsWith('.svg') ? 'svg' : ext.endsWith('.png') ? 'png' : ext.endsWith('.jpg') || ext.endsWith('.jpeg') ? 'jpg' : ext.endsWith('.webp') ? 'webp' : undefined;
      return { url: l.url, variant: l.variant, label: l.label, format };
    }),

    media: (g.media || []).map(m => ({
      url: m.url,
      type: m.type,
      label: m.label,
      category: m.category,
    })),

    voice: {
      voice: g.guidelines?.voice,
      person: g.guidelines?.person,
      emojiPolicy: g.guidelines?.emojiPolicy,
      dos: g.guidelines?.dos,
      donts: g.guidelines?.donts,
      casingRules: g.guidelines?.casingRules,
      imagery: g.guidelines?.imagery,
      accessibility: g.guidelines?.accessibility,
    },

    strategy: {
      manifesto: g.strategy?.manifesto,
      positioning: g.strategy?.positioning,
      coreMessage: g.strategy?.coreMessage,
      pillars: g.strategy?.pillars,
      archetypes: g.strategy?.archetypes,
      personas: g.strategy?.personas,
      voiceValues: g.strategy?.voiceValues,
      marketResearch: g.strategy?.marketResearch,
      graphicSystem: g.strategy?.graphicSystem,
    },

    tags: g.tags || {},
  };
}

// ── Format renderers ─────────────────────────────────────────────────────────

export function renderCSS(d: GuidelineExportData): string {
  const lines: string[] = [':root {'];
  const v = (prefix: string, key: string, val: string) => lines.push(`  --${prefix}-${key}: ${val};`);

  d.colors.forEach(c => v('color', c.key, c.hex));
  d.typography.forEach(t => {
    v('font', t.key, `'${t.family}', sans-serif`);
    if (t.size) v('font-size', t.key, `${t.size}px`);
    if (t.lineHeight) v('line-height', t.key, `${t.lineHeight}`);
    if (t.letterSpacing) v('letter-spacing', t.key, t.letterSpacing);
  });
  d.spacing.forEach(s => v('spacing', s.key, `${s.value}px`));
  d.radius.forEach(r => v('radius', r.key, `${r.value}px`));
  d.shadows.forEach(s => v('shadow', slug(s.name), s.css));
  d.tokenShadows.forEach(s => v('shadow', s.key, `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`));
  d.gradients.forEach(g => v('gradient', slug(g.name), g.css));
  d.borders.forEach(b => v('border', slug(b.name), b.css));
  if (d.motion?.easing) v('motion', 'easing', d.motion.easing);
  if (d.motion?.durations) {
    Object.entries(d.motion.durations).forEach(([k, val]) => v('motion-duration', k, `${val}ms`));
  }

  // Color themes as scoped selectors
  lines.push('}');
  d.colorThemes.forEach(t => {
    lines.push('');
    lines.push(`[data-theme="${t.key}"] {`);
    lines.push(`  --theme-bg: ${t.bg};`);
    lines.push(`  --theme-text: ${t.text};`);
    lines.push(`  --theme-primary: ${t.primary};`);
    lines.push(`  --theme-accent: ${t.accent};`);
    lines.push('}');
  });

  return lines.join('\n');
}

export function renderTailwind(d: GuidelineExportData): string {
  const extend: Record<string, unknown> = {};

  if (d.colors.length) {
    const colors: Record<string, string> = {};
    d.colors.forEach(c => { colors[c.key] = c.hex; });
    extend.colors = colors;
  }

  if (d.typography.length) {
    const fontFamily: Record<string, string[]> = {};
    const fontSize: Record<string, string | [string, Record<string, string>]> = {};
    d.typography.forEach(t => {
      fontFamily[t.key] = [t.family, 'sans-serif'];
      if (t.size) {
        const meta: Record<string, string> = {};
        if (t.lineHeight) meta.lineHeight = `${t.lineHeight}`;
        if (t.letterSpacing) meta.letterSpacing = t.letterSpacing;
        fontSize[t.key] = Object.keys(meta).length ? [`${t.size}px`, meta] : `${t.size}px`;
      }
    });
    extend.fontFamily = fontFamily;
    if (Object.keys(fontSize).length) extend.fontSize = fontSize;
  }

  if (d.spacing.length) {
    const spacing: Record<string, string> = {};
    d.spacing.forEach(s => { spacing[s.key] = `${s.value}px`; });
    extend.spacing = spacing;
  }

  if (d.radius.length) {
    const borderRadius: Record<string, string> = {};
    d.radius.forEach(r => { borderRadius[r.key] = `${r.value}px`; });
    extend.borderRadius = borderRadius;
  }

  if (d.shadows.length || d.tokenShadows.length) {
    const boxShadow: Record<string, string> = {};
    d.shadows.forEach(s => { boxShadow[slug(s.name)] = s.css; });
    d.tokenShadows.forEach(s => { boxShadow[s.key] = `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`; });
    extend.boxShadow = boxShadow;
  }

  if (d.gradients.length) {
    const backgroundImage: Record<string, string> = {};
    d.gradients.forEach(g => { backgroundImage[slug(g.name)] = g.css; });
    extend.backgroundImage = backgroundImage;
  }

  if (d.borders.length) {
    const borderWidth: Record<string, string> = {};
    const borderColor: Record<string, string> = {};
    d.borders.forEach(b => {
      const parts = b.css.split(' ');
      if (parts[0]) borderWidth[slug(b.name)] = parts[0];
      if (parts[2]) borderColor[slug(b.name)] = parts[2];
    });
    if (Object.keys(borderWidth).length) extend.borderWidth = borderWidth;
    if (Object.keys(borderColor).length) extend.borderColor = borderColor;
  }

  if (d.motion) {
    if (d.motion.easing) extend.transitionTimingFunction = { brand: d.motion.easing };
    if (d.motion.durations) {
      const transitionDuration: Record<string, string> = {};
      Object.entries(d.motion.durations).forEach(([k, v]) => { transitionDuration[k] = `${v}ms`; });
      extend.transitionDuration = transitionDuration;
    }
  }

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: ${JSON.stringify(extend, null, 6).replace(/"([^"]+)":/g, '$1:')}
  }
}`;
}

export function renderMarkdown(d: GuidelineExportData): string {
  const l: string[] = [];
  const push = (...s: string[]) => l.push(...s);
  const blank = () => l.push('');
  const h2 = (t: string) => { push(`## ${t}`); blank(); };
  const h3 = (t: string) => { push(`### ${t}`); blank(); };

  // Front matter
  push('---');
  push(`name: "${d.meta.name}"`);
  if (d.meta.description) push(`description: "${d.meta.description}"`);
  push(`version: "${d.meta.version}"`);
  push('---');
  blank();
  push(`# ${d.meta.name} Brand Guidelines`);
  blank();

  // Identity
  h2('Identity');
  if (d.identity.tagline) push(`- **Tagline:** ${d.identity.tagline}`);
  if (d.identity.description) push(`- **Description:** ${d.identity.description}`);
  if (d.identity.website) push(`- **Website:** ${d.identity.website}`);
  const socials = [
    d.identity.instagram && `Instagram: ${d.identity.instagram}`,
    d.identity.linkedin && `LinkedIn: ${d.identity.linkedin}`,
    d.identity.portfolio && `Portfolio: ${d.identity.portfolio}`,
    d.identity.x && `X: ${d.identity.x}`,
  ].filter(Boolean);
  if (socials.length) push(`- **Social:** ${socials.join(' · ')}`);
  blank();

  // Strategy
  const st = d.strategy;
  const hasStrategy = st.manifesto || st.positioning?.length || st.coreMessage || st.pillars?.length || st.archetypes?.length || st.personas?.length || st.voiceValues?.length || st.marketResearch || st.graphicSystem;
  if (hasStrategy) {
    h2('Strategy');

    if (st.coreMessage) {
      h3('Core Message');
      push(`- **Product:** ${st.coreMessage.product}`);
      push(`- **Differential:** ${st.coreMessage.differential}`);
      push(`- **Emotional Bond:** ${st.coreMessage.emotionalBond}`);
      blank();
    }

    if (st.manifesto) {
      h3('Manifesto');
      if (typeof st.manifesto === 'string') {
        push(st.manifesto);
      } else {
        if (st.manifesto.provocation) push(`**Provocation:** ${st.manifesto.provocation}`);
        if (st.manifesto.tension) push(`**Tension:** ${st.manifesto.tension}`);
        if (st.manifesto.promise) push(`**Promise:** ${st.manifesto.promise}`);
        if (st.manifesto.full) { blank(); push(st.manifesto.full); }
      }
      blank();
    }

    if (st.positioning?.length) {
      h3('Positioning');
      st.positioning.forEach(p => push(`- ${p}`));
      blank();
    }

    if (st.pillars?.length) {
      h3('Brand Pillars');
      st.pillars.forEach(p => push(`- **${p.value}:** ${p.description}`));
      blank();
    }

    if (st.archetypes?.length) {
      h3('Archetypes');
      st.archetypes.forEach(a => push(`- **${a.name}** (${a.role || 'primary'}): ${a.description}`));
      blank();
    }

    if (st.voiceValues?.length) {
      h3('Tone of Voice');
      st.voiceValues.forEach(v => push(`- **${v.title}:** ${v.description} — _"${v.example}"_`));
      blank();
    }

    if (st.personas?.length) {
      h3('Personas');
      st.personas.forEach(p => {
        push(`**${p.name}**${p.age ? `, ${p.age}` : ''}${p.occupation ? ` — ${p.occupation}` : ''}`);
        if (p.bio) push(`> ${p.bio}`);
        if (p.traits?.length) push(`- Traits: ${p.traits.join(', ')}`);
        if (p.desires?.length) push(`- Desires: ${p.desires.join(', ')}`);
        if (p.painPoints?.length) push(`- Pain Points: ${p.painPoints.join(', ')}`);
        blank();
      });
    }

    if (st.marketResearch) {
      h3('Market Research');
      if (st.marketResearch.competitors?.length) push(`- **Competitors:** ${st.marketResearch.competitors.join(', ')}`);
      if (st.marketResearch.gaps?.length) push(`- **Gaps:** ${st.marketResearch.gaps.join(', ')}`);
      if (st.marketResearch.opportunities?.length) push(`- **Opportunities:** ${st.marketResearch.opportunities.join(', ')}`);
      if (st.marketResearch.notes) push(`- **Notes:** ${st.marketResearch.notes}`);
      blank();
    }

    if (st.graphicSystem) {
      h3('Graphic System');
      if (st.graphicSystem.patterns?.length) push(`- **Patterns:** ${st.graphicSystem.patterns.join(', ')}`);
      if (st.graphicSystem.grafisms?.length) push(`- **Grafisms:** ${st.graphicSystem.grafisms.join(', ')}`);
      if (st.graphicSystem.imageRules?.length) push(`- **Image Rules:** ${st.graphicSystem.imageRules.join(', ')}`);
      if (st.graphicSystem.editorialGrid) push(`- **Editorial Grid:** ${st.graphicSystem.editorialGrid}`);
      blank();
    }
  }

  // Logos
  if (d.logos.length) {
    h2('Logos');
    d.logos.forEach(lo => push(`- **${lo.variant}**${lo.label ? ` (${lo.label})` : ''}: ${lo.format?.toUpperCase() || 'image'} — ${lo.url}`));
    blank();
  }

  // Colors
  if (d.colors.length) {
    h2('Colors');
    push('| Name | Hex | Role |');
    push('|------|-----|------|');
    d.colors.forEach(c => push(`| ${c.name} | \`${c.hex}\` | ${c.role || '-'} |`));
    blank();
  }

  // Color Themes
  if (d.colorThemes.length) {
    h2('Color Themes');
    d.colorThemes.forEach(t => push(`- **${t.name}:** bg \`${t.bg}\`, text \`${t.text}\`, primary \`${t.primary}\`, accent \`${t.accent}\``));
    blank();
  }

  // Typography
  if (d.typography.length) {
    h2('Typography');
    push('| Role | Family | Style | Size | Line Height | Letter Spacing |');
    push('|------|--------|-------|------|-------------|----------------|');
    d.typography.forEach(t => push(`| ${t.role} | ${t.family} | ${t.style || '-'} | ${t.size || '-'}px | ${t.lineHeight || '-'} | ${t.letterSpacing || '-'} |`));
    blank();
  }

  // Tokens
  if (d.spacing.length || d.radius.length) {
    h2('Design Tokens');
    if (d.spacing.length) {
      h3('Spacing');
      d.spacing.forEach(s => push(`- **${s.key}:** ${s.value}px`));
      blank();
    }
    if (d.radius.length) {
      h3('Radius');
      d.radius.forEach(r => push(`- **${r.key}:** ${r.value}px`));
      blank();
    }
  }

  // Gradients
  if (d.gradients.length) {
    h2('Gradients');
    d.gradients.forEach(g => push(`- **${g.name}** (${g.type}${g.usage ? `, ${g.usage}` : ''}): \`${g.css}\``));
    blank();
  }

  // Shadows
  if (d.shadows.length) {
    h2('Shadows');
    d.shadows.forEach(s => push(`- **${s.name}** (${s.type}): \`${s.css}\``));
    blank();
  }

  // Borders
  if (d.borders.length) {
    h2('Borders');
    d.borders.forEach(b => push(`- **${b.name}** (${b.role}): \`${b.css}\``));
    blank();
  }

  // Motion
  if (d.motion) {
    h2('Motion');
    if (d.motion.philosophy) push(`- **Philosophy:** ${d.motion.philosophy}`);
    if (d.motion.easing) push(`- **Easing:** \`${d.motion.easing}\``);
    if (d.motion.durations) push(`- **Durations:** ${Object.entries(d.motion.durations).map(([k, v]) => `${k}=${v}ms`).join(', ')}`);
    if (d.motion.respectsReducedMotion) push(`- Respects \`prefers-reduced-motion\``);
    blank();
  }

  // Media
  if (d.media.length) {
    h2('Media Assets');
    d.media.forEach(m => push(`- ${m.label || 'Asset'} (${m.type}${m.category ? `, ${m.category}` : ''}): ${m.url}`));
    blank();
  }

  // Tags
  if (Object.keys(d.tags).length) {
    h2('Tags');
    Object.entries(d.tags).forEach(([cat, vals]) => {
      h3(cat);
      (vals as string[]).forEach(v => push(`- ${v}`));
      blank();
    });
  }

  // Editorial / Voice
  const vo = d.voice;
  if (vo.voice || vo.dos?.length || vo.donts?.length || vo.accessibility || vo.imagery) {
    h2('Editorial Guidelines');
    if (vo.voice) push(`**Voice:** "${vo.voice}"`);
    if (vo.person) push(`**Person:** ${vo.person}`);
    if (vo.emojiPolicy) push(`**Emoji:** ${vo.emojiPolicy}`);
    blank();
    if (vo.casingRules?.length) {
      h3('Casing');
      vo.casingRules.forEach(r => push(`- ${r}`));
      blank();
    }
    if (vo.dos?.length) {
      h3("Do's");
      vo.dos.forEach(d => push(`- ✅ ${d}`));
      blank();
    }
    if (vo.donts?.length) {
      h3("Don'ts");
      vo.donts.forEach(d => push(`- ❌ ${d}`));
      blank();
    }
    if (vo.imagery) {
      h3('Imagery');
      push(vo.imagery);
      blank();
    }
    if (vo.accessibility) {
      h3('Accessibility');
      push(vo.accessibility);
      blank();
    }
  }

  return l.join('\n');
}

export function renderDesignMd(d: GuidelineExportData): string {
  const l: string[] = [];
  const push = (...s: string[]) => l.push(...s);
  const blank = () => l.push('');

  // YAML front matter — machine-readable tokens
  push('---');
  push(`version: "${d.meta.version}"`);
  push(`name: "${d.meta.name}"`);
  if (d.meta.description) push(`description: "${d.meta.description}"`);

  if (d.colors.length) {
    push('colors:');
    d.colors.forEach(c => push(`  ${c.key}: "${c.hex}"`));
  }

  if (d.typography.length) {
    push('typography:');
    d.typography.forEach(t => {
      push(`  ${t.key}:`);
      push(`    fontFamily: "${t.family}"`);
      if (t.size) push(`    fontSize: "${t.size}px"`);
      if (t.style) push(`    fontWeight: "${t.style}"`);
      if (t.lineHeight) push(`    lineHeight: ${t.lineHeight}`);
      if (t.letterSpacing) push(`    letterSpacing: "${t.letterSpacing}"`);
    });
  }

  if (d.radius.length) {
    push('rounded:');
    d.radius.forEach(r => push(`  ${r.key}: "${r.value}px"`));
  }

  if (d.spacing.length) {
    push('spacing:');
    d.spacing.forEach(s => push(`  ${s.key}: "${s.value}px"`));
  }

  if (d.shadows.length) {
    push('shadows:');
    d.shadows.forEach(s => push(`  ${slug(s.name)}: "${s.css}"`));
  }

  if (d.gradients.length) {
    push('gradients:');
    d.gradients.forEach(g => push(`  ${slug(g.name)}: "${g.css}"`));
  }

  if (d.borders.length) {
    push('borders:');
    d.borders.forEach(b => push(`  ${slug(b.name)}: "${b.css}"`));
  }

  if (d.motion) {
    push('motion:');
    if (d.motion.easing) push(`  easing: "${d.motion.easing}"`);
    if (d.motion.durations) {
      push('  durations:');
      Object.entries(d.motion.durations).forEach(([k, v]) => push(`    ${k}: "${v}ms"`));
    }
  }

  if (d.colorThemes.length) {
    push('colorThemes:');
    d.colorThemes.forEach(t => {
      push(`  ${t.key}:`);
      push(`    bg: "${t.bg}"`);
      push(`    text: "${t.text}"`);
      push(`    primary: "${t.primary}"`);
      push(`    accent: "${t.accent}"`);
    });
  }

  push('---');
  blank();

  // Human-readable body — optimized for LLM consumption
  push(`# ${d.meta.name}`);
  blank();

  // Overview
  push('## Overview');
  if (d.identity.description) push(d.identity.description);
  if (d.identity.tagline) { blank(); push(`> ${d.identity.tagline}`); }
  blank();
  const links = [
    d.identity.website && `[Website](${d.identity.website})`,
    d.identity.instagram && `Instagram: ${d.identity.instagram}`,
    d.identity.linkedin && `LinkedIn: ${d.identity.linkedin}`,
    d.identity.portfolio && `Portfolio: ${d.identity.portfolio}`,
    d.identity.x && `X: ${d.identity.x}`,
  ].filter(Boolean);
  if (links.length) { push(links.join(' · ')); blank(); }

  // Strategy — critical for AI context
  const st = d.strategy;
  const hasStrategy = st.manifesto || st.positioning?.length || st.coreMessage || st.pillars?.length || st.archetypes?.length || st.personas?.length || st.voiceValues?.length;
  if (hasStrategy) {
    push('## Brand Strategy');
    blank();

    if (st.coreMessage) {
      push('### Core Message');
      push(`**Product:** ${st.coreMessage.product}`);
      push(`**Differential:** ${st.coreMessage.differential}`);
      push(`**Emotional Bond:** ${st.coreMessage.emotionalBond}`);
      blank();
    }

    if (st.manifesto) {
      push('### Manifesto');
      if (typeof st.manifesto === 'string') {
        push(st.manifesto);
      } else {
        if (st.manifesto.provocation) push(`> ${st.manifesto.provocation}`);
        if (st.manifesto.tension) push(`**Tension:** ${st.manifesto.tension}`);
        if (st.manifesto.promise) push(`**Promise:** ${st.manifesto.promise}`);
        if (st.manifesto.full) { blank(); push(st.manifesto.full); }
      }
      blank();
    }

    if (st.positioning?.length) {
      push('### Positioning');
      st.positioning.forEach(p => push(`- ${p}`));
      blank();
    }

    if (st.pillars?.length) {
      push('### Brand Pillars');
      st.pillars.forEach(p => push(`- **${p.value}:** ${p.description}`));
      blank();
    }

    if (st.archetypes?.length) {
      push('### Archetypes');
      st.archetypes.forEach(a => push(`- **${a.name}** (${a.role || 'primary'}): ${a.description}`));
      blank();
    }

    if (st.voiceValues?.length) {
      push('### Tone of Voice');
      st.voiceValues.forEach(v => push(`- **${v.title}:** ${v.description} — _"${v.example}"_`));
      blank();
    }

    if (st.personas?.length) {
      push('### Target Personas');
      st.personas.forEach(p => {
        push(`**${p.name}**${p.age ? `, ${p.age}` : ''}${p.occupation ? ` — ${p.occupation}` : ''}`);
        if (p.bio) push(`> ${p.bio}`);
        if (p.traits?.length) push(`Traits: ${p.traits.join(', ')}`);
        if (p.desires?.length) push(`Desires: ${p.desires.join(', ')}`);
        if (p.painPoints?.length) push(`Pain points: ${p.painPoints.join(', ')}`);
        blank();
      });
    }
  }

  // Market research
  if (st.marketResearch) {
    push('### Market Research');
    if (st.marketResearch.competitors?.length) push(`**Competitors:** ${st.marketResearch.competitors.join(', ')}`);
    if (st.marketResearch.gaps?.length) push(`**Gaps:** ${st.marketResearch.gaps.join(', ')}`);
    if (st.marketResearch.opportunities?.length) push(`**Opportunities:** ${st.marketResearch.opportunities.join(', ')}`);
    if (st.marketResearch.notes) push(`**Notes:** ${st.marketResearch.notes}`);
    blank();
  }

  // Graphic system
  if (st.graphicSystem) {
    push('### Graphic System');
    if (st.graphicSystem.patterns?.length) push(`**Patterns:** ${st.graphicSystem.patterns.join(', ')}`);
    if (st.graphicSystem.grafisms?.length) push(`**Grafisms:** ${st.graphicSystem.grafisms.join(', ')}`);
    if (st.graphicSystem.imageRules?.length) push(`**Image Rules:** ${st.graphicSystem.imageRules.join(', ')}`);
    if (st.graphicSystem.editorialGrid) push(`**Editorial Grid:** ${st.graphicSystem.editorialGrid}`);
    blank();
  }

  // Logos
  if (d.logos.length) {
    push('## Logos');
    d.logos.forEach(lo => push(`- **${lo.variant}**${lo.label ? ` (${lo.label})` : ''} [${lo.format?.toUpperCase() || 'IMG'}]: ${lo.url}`));
    blank();
  }

  // Colors
  if (d.colors.length) {
    push('## Colors');
    blank();
    d.colors.forEach(c => push(`\`${c.key}\` (\`${c.hex}\`) — ${c.role || 'Brand color'}.`));
    blank();
  }

  // Color Themes
  if (d.colorThemes.length) {
    push('## Color Themes');
    blank();
    push('Pre-defined color schemes for consistent application:');
    blank();
    d.colorThemes.forEach(t => push(`**${t.name}:** bg \`${t.bg}\`, text \`${t.text}\`, primary \`${t.primary}\`, accent \`${t.accent}\`.`));
    blank();
  }

  // Typography
  if (d.typography.length) {
    push('## Typography');
    blank();
    d.typography.forEach(t => {
      push(`**${t.role}:** ${t.family}${t.style ? ` ${t.style}` : ''}, ${t.size || 16}px${t.lineHeight ? `, line-height ${t.lineHeight}` : ''}${t.letterSpacing ? `, tracking ${t.letterSpacing}` : ''}.`);
    });
    blank();
  }

  // Layout
  if (d.spacing.length) {
    push('## Layout');
    push(`Spacing scale: ${d.spacing.map(s => `${s.key}=${s.value}px`).join(', ')}.`);
    blank();
  }

  // Shapes
  if (d.radius.length) {
    push('## Shapes');
    push(`Corner radii: ${d.radius.map(r => `${r.key}=${r.value}px`).join(', ')}.`);
    blank();
  }

  // Gradients
  if (d.gradients.length) {
    push('## Gradients');
    blank();
    d.gradients.forEach(g => push(`**${g.name}** (${g.type}${g.usage ? `, ${g.usage}` : ''}): \`${g.css}\``));
    blank();
  }

  // Shadows
  if (d.shadows.length) {
    push('## Elevation & Depth');
    blank();
    d.shadows.forEach(s => push(`**${s.name}** (\`${s.type}\`): \`${s.css}\``));
    blank();
  }

  // Borders
  if (d.borders.length) {
    push('## Borders');
    blank();
    d.borders.forEach(b => push(`**${b.name}** (${b.role}): \`${b.css}\``));
    blank();
  }

  // Motion
  if (d.motion) {
    push('## Motion');
    if (d.motion.philosophy) push(`Philosophy: ${d.motion.philosophy} — minimal, purposeful transitions.`);
    if (d.motion.respectsReducedMotion) push('Always respect `prefers-reduced-motion`.');
    if (d.motion.easing) push(`Default easing: \`${d.motion.easing}\`.`);
    if (d.motion.durations) push(`Durations: ${Object.entries(d.motion.durations).map(([k, v]) => `${k}=${v}ms`).join(', ')}.`);
    blank();
  }

  // Media
  if (d.media.length) {
    push('## Media Assets');
    blank();
    d.media.forEach(m => push(`- ${m.label || 'Asset'} [${m.type}${m.category ? `, ${m.category}` : ''}]: ${m.url}`));
    blank();
  }

  // Tags
  if (Object.keys(d.tags).length) {
    push('## Tags');
    Object.entries(d.tags).forEach(([cat, vals]) => {
      push(`**${cat}:** ${(vals as string[]).join(', ')}`);
    });
    blank();
  }

  // Voice & Editorial
  const vo = d.voice;
  if (vo.voice || vo.dos?.length || vo.donts?.length) {
    push("## Do's and Don'ts");
    blank();
    if (vo.voice) push(`Voice: "${vo.voice}"`);
    if (vo.person) push(`Write in ${vo.person} person.`);
    if (vo.emojiPolicy === 'none') push('Never use emoji in copy.');
    else if (vo.emojiPolicy === 'informal') push('Emoji allowed in informal contexts only.');
    if (vo.casingRules?.length) {
      blank();
      push('**Casing:**');
      vo.casingRules.forEach(r => push(`- ${r}`));
    }
    if (vo.dos?.length) {
      blank();
      push('**Do:**');
      vo.dos.forEach(item => push(`- ${item}`));
    }
    if (vo.donts?.length) {
      blank();
      push('**Don\'t:**');
      vo.donts.forEach(item => push(`- ${item}`));
    }
    if (vo.imagery) {
      blank();
      push('**Imagery:** ' + vo.imagery);
    }
    if (vo.accessibility) {
      blank();
      push('**Accessibility:** ' + vo.accessibility);
    }
    blank();
  }

  return l.join('\n');
}
