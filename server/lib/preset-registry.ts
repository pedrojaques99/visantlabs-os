/**
 * Web preset registry — the catalog of headless-renderable templates, keyed by the
 * same `Format/Purpose` id as the Figma library. Each entry declares its dimensions,
 * its image slots (for the asset resolver), and how to map filled slots → HTML.
 * Add a layout = add an entry. The route stays generic.
 */
import {
  postLaunchHtml,
  storySaleHtml,
  obraDeArteHtml,
  editorialHeroHtml,
  editorialManifestoHtml,
  slideCoverHtml,
  slideAgendaHtml,
  slideSectionHtml,
  slideStepsHtml,
  type PresetVars,
} from './preset-html.js';
import { paletteSlideHtml, indexSlideHtml } from './preset-autogen.js';
import type { ImageSlotSpec } from './figma-asset-resolver.js';
import type { BrandGuideline } from '../types/brandGuideline.js';

type Text = Record<string, string | string[] | null | undefined>;
type Images = Record<string, { imageUrl: string } | undefined>;

export interface WebPreset {
  id: string;
  width: number;
  height: number;
  /** Image slots the resolver should fill from brand assets. */
  imageSlots: ImageSlotSpec[];
  /** Slot-driven render: map supplied text + images → HTML (most presets). */
  build?: (vars: PresetVars, text: Text, images: Images, fontCss: string) => string;
  /**
   * Auto-generated render: derive content from the brand itself (palette, sections).
   * When set, the route uses this instead of `build` — no slots to fill, just the
   * brand. `text` may carry an optional title override.
   */
  autogen?: (brand: BrandGuideline, vars: PresetVars, text: Text, fontCss: string) => string;
}

const asList = (v: string | string[] | null | undefined): string[] | undefined =>
  v == null ? undefined : Array.isArray(v) ? v : [v];
const asStr = (v: string | string[] | null | undefined): string =>
  v == null ? '' : Array.isArray(v) ? v.join(' ') : v;

export const WEB_PRESETS: Record<string, WebPreset> = {
  'post/launch': {
    id: 'Post/Launch',
    width: 1080,
    height: 1350,
    imageSlots: [{ id: 'photo1' }, { id: 'logo', variant: 'dark' }],
    build: (vars, text, images, fontCss) =>
      postLaunchHtml(
        vars,
        {
          h1: asStr(text.h1),
          h2: text.h2 ? asStr(text.h2) : undefined,
          infos: asList(text.infos),
          photoUrl: images.photo1?.imageUrl,
          logoUrl: images.logo?.imageUrl,
        },
        fontCss
      ),
  },

  'story/sale': {
    id: 'Story/Sale',
    width: 1080,
    height: 1920,
    imageSlots: [{ id: 'photo1' }],
    build: (vars, text, images, fontCss) =>
      storySaleHtml(
        vars,
        {
          h1: asStr(text.h1),
          h2: text.h2 ? asStr(text.h2) : undefined,
          cta: text.cta ? asStr(text.cta) : undefined,
          photoUrl: images.photo1?.imageUrl,
        },
        fontCss
      ),
  },

  'post/obra-de-arte': {
    id: 'Post/Obra-de-Arte',
    width: 1080,
    height: 1350,
    imageSlots: [{ id: 'logo', variant: 'accent' }],
    build: (vars, text, images, fontCss) =>
      obraDeArteHtml(vars, { h1: asStr(text.h1), logoUrl: images.logo?.imageUrl }, fontCss),
  },

  'editorial/hero': {
    id: 'Editorial/Hero',
    width: 1080,
    height: 1350,
    imageSlots: [{ id: 'photo1' }],
    build: (vars, text, images, fontCss) =>
      editorialHeroHtml(
        vars,
        {
          h1: asStr(text.h1),
          note: text.note ? asStr(text.note) : undefined,
          tag: text.tag ? asStr(text.tag) : undefined,
          footer: text.footer ? asStr(text.footer) : undefined,
          region: text.region ? asStr(text.region) : undefined,
          photoUrl: images.photo1?.imageUrl,
        },
        fontCss
      ),
  },

  'editorial/manifesto': {
    id: 'Editorial/Manifesto',
    width: 1080,
    height: 1350,
    imageSlots: [{ id: 'photo1' }],
    build: (vars, text, images, fontCss) =>
      editorialManifestoHtml(
        vars,
        {
          h1: asStr(text.h1),
          infos: asList(text.infos),
          body: text.body ? asStr(text.body) : undefined,
          photoUrl: images.photo1?.imageUrl,
        },
        fontCss
      ),
  },

  // ── Landscape deck slides (1920×1080) ──
  'slide/cover': {
    id: 'Slide/Cover',
    width: 1920,
    height: 1080,
    imageSlots: [{ id: 'logo' }],
    build: (vars, text, images, fontCss) =>
      slideCoverHtml(
        vars,
        {
          subtitle: text.subtitle ? asStr(text.subtitle) : undefined,
          footer: text.footer ? asStr(text.footer) : undefined,
          nav: asList(text.nav),
          logoUrl: images.logo?.imageUrl,
        },
        fontCss
      ),
  },

  'slide/agenda': {
    id: 'Slide/Agenda',
    width: 1920,
    height: 1080,
    imageSlots: [{ id: 'photo1' }],
    build: (vars, text, images, fontCss) =>
      slideAgendaHtml(
        vars,
        {
          h1: asStr(text.h1),
          infos: asList(text.infos),
          photoUrl: images.photo1?.imageUrl,
        },
        fontCss
      ),
  },

  'slide/section': {
    id: 'Slide/Section',
    width: 1920,
    height: 1080,
    imageSlots: [{ id: 'photo1' }],
    build: (vars, text, images, fontCss) =>
      slideSectionHtml(
        vars,
        {
          h1: asStr(text.h1),
          body: text.body ? asStr(text.body) : undefined,
          photoUrl: images.photo1?.imageUrl,
        },
        fontCss
      ),
  },

  'slide/steps': {
    id: 'Slide/Steps',
    width: 1920,
    height: 1080,
    imageSlots: [],
    build: (vars, text, images, fontCss) =>
      slideStepsHtml(
        vars,
        {
          h1: asStr(text.h1),
          body: text.body ? asStr(text.body) : undefined,
          steps: asList(text.steps),
        },
        fontCss
      ),
  },

  // ── Auto-generated (brand-data driven; no slots to fill) ──
  'slide/palette': {
    id: 'Slide/Palette',
    width: 1920,
    height: 1080,
    imageSlots: [],
    autogen: (brand, vars, text, fontCss) => paletteSlideHtml(brand, vars, text, fontCss),
  },

  'slide/index': {
    id: 'Slide/Index',
    width: 1920,
    height: 1080,
    imageSlots: [],
    autogen: (brand, vars, text, fontCss) => indexSlideHtml(brand, vars, text, fontCss),
  },
};

export function getWebPreset(id: string): WebPreset | undefined {
  return WEB_PRESETS[id.trim().toLowerCase()];
}

export function listWebPresets(): Array<Pick<WebPreset, 'id' | 'width' | 'height'>> {
  return Object.values(WEB_PRESETS).map((p) => ({ id: p.id, width: p.width, height: p.height }));
}
